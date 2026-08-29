class CashRegister {
    static _repository = new CashRegisterRepository();

    static async open(initialAmount, denominations = null) {
        const openCash = await this.getOpen();
        if (openCash) {
            throw new Error('Ya existe una caja abierta');
        }

        const currentUser = AuthManager.getCurrentUser();
        const cashRegister = {
            openDate: new Date().toISOString(),
            closeDate: null,
            initialAmount: parseFloat(initialAmount) || 0,
            finalAmount: 0,
            expectedAmount: 0,
            difference: 0,
            status: 'open',
            userId: currentUser ? currentUser.id : 1,
            denominations: denominations || null,
            paymentSummary: {
                cash: 0,
                card: 0,
                qr: 0,
                other: 0
            }
        };

        return await this._repository.create(cashRegister);
    }

    /**
     * Close cash register (IMMUTABLE)
     * @param {number} id - Cash register ID
     * @param {number} finalAmount - Final cash amount
     * @param {Object|null} countedByMethod - Conteo real ingresado por el cajero {cash, card, qr, other}
     * @returns {Promise<void>}
     */
    static async close(id, finalAmount, countedByMethod = null) {
        const cashRegister = await this.getById(id);
        if (!cashRegister) throw new Error('Caja no encontrada');
        if (cashRegister.status === 'closed') throw new Error('La caja ya está cerrada');

        const salesPaymentSummary = await Sale.getTotalByPaymentMethod(id);
        // Sale.getTotalByPaymentMethod ya incluye ventas por método Y pagos de deuda (Payment.getBySale por venta). No sumar Payment.getByCashRegister para evitar duplicación.
        const paymentSummary = {
            cash: salesPaymentSummary.cash || 0,
            card: salesPaymentSummary.card || 0,
            qr: salesPaymentSummary.qr || 0,
            other: salesPaymentSummary.other || 0
        };

        const movements = await CashMovement.getByCashRegister(id);
        let totalCashIn = 0;
        let totalRetiros = 0;
        movements.forEach(m => {
            // FIX: Evitar doble contabilidad.
            // 1) Los abonos (paymentId) ya están en salesPaymentSummary.cash
            // 2) Los depósitos de saldo a favor ya se computan en CustomerCreditDeposit → paymentSummary.cash
            if (m.type === 'in' && (m.paymentId || (m.description && m.description.toLowerCase().includes('saldo a favor')))) return;

            if (m.type === 'in') {
                totalCashIn += parseFloat(m.amount);
            } else {
                totalRetiros += parseFloat(m.amount);
            }
        });

        const expectedCash = cashRegister.initialAmount + paymentSummary.cash + totalCashIn - totalRetiros;
        const finalAmountParsed = parseFloat(finalAmount);

        // Create updated cash register object (IMMUTABLE)
        const updated = {
            ...cashRegister,
            closeDate: new Date().toISOString(),
            finalAmount: finalAmountParsed,
            expectedAmount: expectedCash,
            difference: finalAmountParsed - expectedCash,
            status: 'closed',
            paymentSummary: paymentSummary,
            countedByMethod: countedByMethod || cashRegister.countedByMethod || null
        };

        return await this._repository.replace(updated);
    }

    static async getOpen() {
        const allowMultiple = localStorage.getItem('allowMultipleCashRegisters') === 'true';
        if (allowMultiple) {
            const currentUser = AuthManager.getCurrentUser();
            const uid = currentUser ? currentUser.id : 1;
            const openRegisters = await this.getAllOpen();
            return openRegisters.find(r => r.userId === uid) || null;
        }
        return await this._repository.findOpen();
    }

    static async getAllOpen() {
        try {
            return await this._repository.findByIndex('status', 'open');
        } catch (error) {
            const all = await this.getAll();
            return all.filter(r => r.status === 'open');
        }
    }

    static async getById(id) {
        return await this._repository.findById(id);
    }

    static async getAll() {
        return await this._repository.findAll();
    }

    static async getLatest(limit = 50, offset = 0) {
        return await this._repository.findAll({ limit, offset, sort: { field: 'id', direction: 'desc' } });
    }

    /**
     * Create a historical closed cash register (for retroactive records)
     * @param {Object} data - Historical cash register data
     * @param {string} data.openDate - Opening date (ISO string)
     * @param {string} data.closeDate - Closing date (ISO string)
     * @param {number} data.initialAmount - Initial cash amount
     * @param {number} data.finalAmount - Final cash amount
     * @param {Object} data.paymentSummary - Payment summary by method
     * @returns {Promise<number>} - Cash register ID
     */
    static async createHistorical(data) {
        const {
            openDate,
            closeDate,
            initialAmount = 0,
            finalAmount,
            paymentSummary = { cash: 0, card: 0, qr: 0, other: 0 }
        } = data;

        if (!openDate || !closeDate) {
            throw new Error('openDate y closeDate son requeridos para crear un registro histórico');
        }

        if (finalAmount === undefined || finalAmount === null) {
            throw new Error('finalAmount es requerido');
        }

        // Calculate expected cash (solo efectivo físico en caja; card/qr/other no se cuentan)
        const expectedCash = initialAmount + (paymentSummary.cash || 0);
        const difference = finalAmount - expectedCash;

        const cashRegister = {
            openDate: openDate,
            closeDate: closeDate,
            initialAmount: parseFloat(initialAmount) || 0,
            finalAmount: parseFloat(finalAmount),
            expectedAmount: expectedCash,
            difference: difference,
            status: 'closed',
            openedBy: 1,
            denominations: null,
            paymentSummary: {
                cash: parseFloat(paymentSummary.cash) || 0,
                card: parseFloat(paymentSummary.card) || 0,
                qr: parseFloat(paymentSummary.qr) || 0,
                other: parseFloat(paymentSummary.other) || 0
            }
        };

        return await this._repository.create(cashRegister);
    }

    /**
     * Delete a cash register
     * WARNING: This will delete the cash register record. Associated data (sales, payments, expenses, movements) will remain but won't be linked to this register.
     * @param {number} id - Cash register ID
     * @returns {Promise<void>}
     */
    static async delete(id) {
        const cashRegister = await this.getById(id);
        if (!cashRegister) {
            throw new Error('Caja no encontrada');
        }

        // No permitir eliminar cajas abiertas
        if (cashRegister.status === 'open') {
            throw new Error('No se puede eliminar una caja abierta. Debes cerrarla primero.');
        }

        return await this._repository.delete(id);
    }

    static async getSummary(id) {
        const cashRegister = await this.getById(id);
        if (!cashRegister) return null;

        const sales = await Sale.getByCashRegister(id);
        const payments = await Payment.getByCashRegister(id);
        const movements = await CashMovement.getByCashRegister(id);

        const todayDateStr = new Date().toLocaleDateString('es-CL');
        const isToday = (dateVal) => {
            if (!dateVal) return false;
            try {
                return new Date(dateVal).toLocaleDateString('es-CL') === todayDateStr;
            } catch (_) {
                return false;
            }
        };

        // --- 1. VENTAS TOTALES Y DE HOY ---
        let totalSalesAmount = 0;
        let totalSalesCount = 0;
        let todaySalesAmount = 0;
        let todaySalesCount = 0;
        let sessionCreditSalesAmount = 0;
        let sessionCreditSalesCount = 0;
        let todayCreditSalesAmount = 0;
        let todayCreditSalesCount = 0;

        sales.forEach(s => {
            if (s.status === 'cancelled') return;
            const amt = parseFloat(s.total) || 0;
            totalSalesAmount += amt;
            totalSalesCount++;

            const isCredit = (s.status === 'pending' || s.status === 'partial');
            const paid = parseFloat(s.paidAmount) || 0;
            const remaining = Math.max(0, amt - paid);

            if (isCredit && remaining > 0) {
                sessionCreditSalesAmount += remaining;
                sessionCreditSalesCount++;
            }

            if (isToday(s.date || s.createdAt)) {
                todaySalesAmount += amt;
                todaySalesCount++;
                if (isCredit && remaining > 0) {
                    todayCreditSalesAmount += remaining;
                    todayCreditSalesCount++;
                }
            }
        });

        // --- 2. ABONOS DE DEUDAS (PAYMENTS) ---
        let totalDebtPayments = 0;
        let todayDebtPayments = 0;
        let todayDebtPaymentsCount = 0;
        const debtPaymentSummary = { cash: 0, card: 0, qr: 0, other: 0 };
        const todayDebtPaymentSummary = { cash: 0, card: 0, qr: 0, other: 0 };

        payments.forEach(payment => {
            if (payment.paymentMethod === 'discount' || payment.paymentMethod === 'cancelled') return;
            const amt = parseFloat(payment.amount) || 0;
            totalDebtPayments += amt;
            const method = payment.paymentMethod || 'cash';
            if (debtPaymentSummary[method] !== undefined) {
                debtPaymentSummary[method] += amt;
            } else {
                debtPaymentSummary.other += amt;
            }

            if (isToday(payment.date || payment.createdAt)) {
                todayDebtPayments += amt;
                todayDebtPaymentsCount++;
                if (todayDebtPaymentSummary[method] !== undefined) {
                    todayDebtPaymentSummary[method] += amt;
                } else {
                    todayDebtPaymentSummary.other += amt;
                }
            }
        });

        // --- 3. MÉTODOS DE PAGO DE VENTAS ---
        let paymentSummary = await Sale.getTotalByPaymentMethod(id);
        if (!paymentSummary) paymentSummary = { cash: 0, card: 0, qr: 0, other: 0 };
        paymentSummary = {
            cash: parseFloat(paymentSummary.cash) || 0,
            card: parseFloat(paymentSummary.card) || 0,
            qr: parseFloat(paymentSummary.qr) || 0,
            other: parseFloat(paymentSummary.other) || 0
        };

        // Desglose de métodos de pago SOLO DE HOY
        const todayPaymentSummary = { cash: 0, card: 0, qr: 0, other: 0 };
        sales.forEach(s => {
            if (s.status === 'cancelled' || !isToday(s.date || s.createdAt)) return;
            const method = s.paymentMethod || 'cash';
            const total = parseFloat(s.total) || 0;
            const paid = (s.status === 'pending' || s.status === 'partial') ? (parseFloat(s.paidAmount) || 0) : total;

            if (method === 'mixed' && s.paymentDetails && typeof s.paymentDetails === 'object') {
                const details = typeof s.paymentDetails === 'string' ? JSON.parse(s.paymentDetails) : s.paymentDetails;
                Object.keys(todayPaymentSummary).forEach(m => {
                    if (details[m]) todayPaymentSummary[m] += parseFloat(details[m]) || 0;
                });
            } else if (todayPaymentSummary[method] !== undefined) {
                todayPaymentSummary[method] += paid;
            } else {
                todayPaymentSummary.other += paid;
            }
        });
        // Agregar los abonos de hoy a los métodos de pago de hoy
        Object.keys(todayDebtPaymentSummary).forEach(m => {
            todayPaymentSummary[m] += todayDebtPaymentSummary[m];
        });

        // --- 4. MOVIMIENTOS MANUALES (INGRESOS Y RETIROS) ---
        let totalCashIn = 0;
        let totalRetiros = 0;
        let todayCashIn = 0;
        let todayRetiros = 0;

        movements.forEach(m => {
            // Evitar doble contabilidad en abonos o depósitos automáticos
            if (m.type === 'in' && (m.paymentId || (m.description && m.description.toLowerCase().includes('saldo a favor')))) return;

            const amt = parseFloat(m.amount) || 0;
            if (m.type === 'in') {
                totalCashIn += amt;
                if (isToday(m.date)) todayCashIn += amt;
            } else {
                totalRetiros += amt;
                if (isToday(m.date)) todayRetiros += amt;
            }
        });

        // Efectivo esperado total en el cajón físico
        const expectedCash = (parseFloat(cashRegister.initialAmount) || 0) + (paymentSummary.cash || 0) + totalCashIn - totalRetiros;
        const cashForDisplay = (paymentSummary.cash || 0) + totalCashIn - totalRetiros;

        // Efectivo esperado generado SOLO HOY
        const todayCashNet = (todayPaymentSummary.cash || 0) + todayCashIn - todayRetiros;

        // Dinero digital a verificar en Banco (Sesión y Hoy)
        const sessionBank = {
            card: paymentSummary.card || 0,
            qr: paymentSummary.qr || 0,
            other: paymentSummary.other || 0,
            total: (paymentSummary.card || 0) + (paymentSummary.qr || 0) + (paymentSummary.other || 0)
        };

        const todayBank = {
            card: todayPaymentSummary.card || 0,
            qr: todayPaymentSummary.qr || 0,
            other: todayPaymentSummary.other || 0,
            total: (todayPaymentSummary.card || 0) + (todayPaymentSummary.qr || 0) + (todayPaymentSummary.other || 0)
        };

        // --- 5. RENTABILIDAD Y COSTOS ---
        let totalSalesCostNet = 0;
        let todaySalesCostNet = 0;
        let productMap = {};
        try {
            const products = await Product.getAll();
            products.forEach(p => productMap[p.id] = p);
        } catch (e) {
            console.error('Error al cargar productos en getSummary:', e);
        }

        sales.forEach(s => {
            if (s.status === 'cancelled') return;
            const isBoleta = (s.documentType || 'boleta') === 'boleta';
            const items = typeof s.items === 'string' ? JSON.parse(s.items || '[]') : (s.items || []);
            const saleIsToday = isToday(s.date || s.createdAt);

            items.forEach(item => {
                const pid = item.productId || item.id;
                let itemCostGross = 0;
                if (item.costAtSale !== undefined && item.costAtSale !== null) {
                    itemCostGross = parseFloat(item.costAtSale) * (parseFloat(item.quantity) || 0);
                } else {
                    const product = productMap[pid];
                    itemCostGross = product ? (parseFloat(product.cost) || 0) * (parseFloat(item.quantity) || 0) : 0;
                }
                const itemCostNet = isBoleta ? Math.round(itemCostGross / 1.19) : itemCostGross;
                totalSalesCostNet += itemCostNet;
                if (saleIsToday) todaySalesCostNet += itemCostNet;
            });
        });

        // Ingreso neto de ventas (sin IVA)
        let totalSalesRevenueNet = 0;
        let todaySalesRevenueNet = 0;
        sales.forEach(s => {
            if (s.status === 'cancelled') return;
            const isBoleta = (s.documentType || 'boleta') === 'boleta';
            const saleNeto = Math.round(s.total / 1.19);
            const saleRevenue = isBoleta ? saleNeto : s.total;
            totalSalesRevenueNet += saleRevenue;
            if (isToday(s.date || s.createdAt)) todaySalesRevenueNet += saleRevenue;
        });

        const grossProfit = totalSalesRevenueNet - totalSalesCostNet;
        const todayGrossProfit = todaySalesRevenueNet - todaySalesCostNet;

        // Gastos operativos
        let totalExpenses = 0;
        let todayExpenses = 0;
        movements.forEach(m => {
            const isOut = m.type === 'out';
            const isGasto = (m.description || '').includes('[GASTO]') ||
                            (m.category && m.category !== '' &&
                             !['sale','payment','withdraw','add'].includes(m.category));
            if (isOut && isGasto) {
                const amt = parseFloat(m.amount) || 0;
                totalExpenses += amt;
                if (isToday(m.date)) todayExpenses += amt;
            }
        });

        const netProfit = grossProfit - totalExpenses;
        const todayNetProfit = todayGrossProfit - todayExpenses;

        // Ticket promedio
        const sessionTicketAverage = totalSalesCount > 0 ? Math.round(totalSalesAmount / totalSalesCount) : 0;
        const todayTicketAverage = todaySalesCount > 0 ? Math.round(todaySalesAmount / todaySalesCount) : 0;

        // Devoluciones / Anulaciones
        const rawOpenDate = cashRegister.openDate || cashRegister.openedAt || cashRegister.created_at;
        const rawCloseDate = cashRegister.closeDate || cashRegister.closedAt;
        const dStart = rawOpenDate ? new Date(rawOpenDate) : new Date(0);
        const dEnd = rawCloseDate ? new Date(rawCloseDate) : new Date();
        const startTime = isNaN(dStart.getTime()) ? new Date(0) : dStart;
        const endTime = isNaN(dEnd.getTime()) ? new Date() : dEnd;

        let totalReturnedAmount = 0;
        let totalReturnedCount = 0;
        let todayReturnedAmount = 0;
        let todayReturnedCount = 0;
        try {
            const returns = await SaleReturn.getByDateRange(startTime, endTime);
            if (Array.isArray(returns)) {
                returns.forEach(ret => {
                    const amt = parseFloat(ret.totalReturned) || 0;
                    totalReturnedAmount += amt;
                    totalReturnedCount++;
                    if (isToday(ret.date || ret.createdAt)) {
                        todayReturnedAmount += amt;
                        todayReturnedCount++;
                    }
                });
            }
        } catch (_) {}

        // IVA Débito y Crédito
        let ivaDebito = 0;
        sales.forEach(s => {
            if (s.status === 'cancelled') return;
            const fiscal = Sale.computeFiscalFromTotal ? Sale.computeFiscalFromTotal(s.total, s.documentType) : { tax_amount: Math.round(s.total - (s.total / 1.19)) };
            ivaDebito += (fiscal.tax_amount || 0);
        });
        ivaDebito = Math.round(ivaDebito);

        let ivaCredito = 0;
        try {
            const sessionPurchases = await Purchase.getByDateRange(startTime, endTime);
            if (Array.isArray(sessionPurchases)) {
                ivaCredito = sessionPurchases.reduce((sum, p) => {
                    if (!p.documentType || !p.documentType.includes('factura')) return sum;
                    const stored = parseFloat(p.ivaAmount) || 0;
                    if (stored > 0) return sum + stored;
                    const sub = parseFloat(p.subtotal) || 0;
                    if (sub <= 0) return sum;
                    const recalc = p.vatMode === 'gross'
                        ? sub - Math.round(sub / 1.19)
                        : Math.round(sub * 0.19);
                    return sum + recalc;
                }, 0);
            }
        } catch (_) {}

        return {
            ...cashRegister,
            totalSales: totalSalesCount || 0,
            totalSalesAmount: totalSalesAmount || 0,
            todaySalesAmount: todaySalesAmount || 0,
            todaySalesCount: todaySalesCount || 0,
            sessionTicketAverage: sessionTicketAverage || 0,
            todayTicketAverage: todayTicketAverage || 0,
            sessionCreditSalesAmount: sessionCreditSalesAmount || 0,
            sessionCreditSalesCount: sessionCreditSalesCount || 0,
            todayCreditSalesAmount: todayCreditSalesAmount || 0,
            todayCreditSalesCount: todayCreditSalesCount || 0,
            debtPayments: payments || [],
            totalDebtPayments: totalDebtPayments || 0,
            todayDebtPayments: todayDebtPayments || 0,
            todayDebtPaymentsCount: todayDebtPaymentsCount || 0,
            debtPaymentSummary: debtPaymentSummary || { cash: 0, card: 0, qr: 0, other: 0 },
            todayDebtPaymentSummary: todayDebtPaymentSummary || { cash: 0, card: 0, qr: 0, other: 0 },
            paymentSummary: paymentSummary || { cash: 0, card: 0, qr: 0, other: 0 },
            todayPaymentSummary: todayPaymentSummary || { cash: 0, card: 0, qr: 0, other: 0 },
            sessionBank: sessionBank || { card: 0, qr: 0, other: 0, total: 0 },
            todayBank: todayBank || { card: 0, qr: 0, other: 0, total: 0 },
            movements: movements || [],
            totalCashIn: totalCashIn || 0,
            totalRetiros: totalRetiros || 0,
            todayCashIn: todayCashIn || 0,
            todayRetiros: todayRetiros || 0,
            cashForDisplay: cashForDisplay || 0,
            todayCashNet: todayCashNet || 0,
            expectedCash: expectedCash || 0,
            ivaDebito: ivaDebito || 0,
            ivaCredito: ivaCredito || 0,
            totalExpenses: totalExpenses || 0,
            todayExpenses: todayExpenses || 0,
            grossProfit: grossProfit || 0,
            todayGrossProfit: todayGrossProfit || 0,
            netProfit: netProfit || 0,
            todayNetProfit: todayNetProfit || 0,
            totalReturnedAmount: totalReturnedAmount || 0,
            totalReturnedCount: totalReturnedCount || 0,
            todayReturnedAmount: todayReturnedAmount || 0,
            todayReturnedCount: todayReturnedCount || 0
        };
    }
}
