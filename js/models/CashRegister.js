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

        const totalSalesAmount = sales.reduce((sum, s) => {
            if (s.status === 'cancelled') return sum;
            return sum + (parseFloat(s.total) || 0);
        }, 0);
        const totalSalesCount = sales.filter(s => s.status !== 'cancelled').length;

        const totalDebtPayments = payments
            .filter(p => p.paymentMethod !== 'discount' && p.paymentMethod !== 'cancelled')
            .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        const debtPaymentSummary = {
            cash: 0,
            card: 0,
            qr: 0,
            other: 0
        };
        payments.forEach(payment => {
            const method = payment.paymentMethod || 'cash';
            if (method !== 'cancelled' && debtPaymentSummary[method] !== undefined) {
                debtPaymentSummary[method] += parseFloat(payment.amount) || 0;
            }
        });

        // Sale.getTotalByPaymentMethod ya incluye ventas por método Y pagos de deuda (Payment.getBySale por venta). No sumar debtPaymentSummary para evitar duplicación.
        let paymentSummary = await Sale.getTotalByPaymentMethod(id);
        if (!paymentSummary) paymentSummary = { cash: 0, card: 0, qr: 0, other: 0 };
        paymentSummary = {
            cash: paymentSummary.cash || 0,
            card: paymentSummary.card || 0,
            qr: paymentSummary.qr || 0,
            other: paymentSummary.other || 0
        };

        // Movimientos de caja: todos los retiros restan del efectivo esperado
        const movements = await CashMovement.getByCashRegister(id);
        let totalCashIn = 0;
        let totalRetiros = 0;
        movements.forEach(m => {
            // C7 FIX: Solo evitamos doble contabilidad en INGRESOS (in).
            // 1) Los abonos de clientes (in con paymentId) ya se cuentan en paymentSummary.cash.
            // 2) Los depósitos de saldo a favor (in sin paymentId pero con desc 'saldo a favor') también
            //    se cuentan en paymentSummary.cash vía CustomerCreditDeposit → evitar doble conteo.
            // Los RETIROS (out) deben contarse SIEMPRE.
            if (m.type === 'in' && (m.paymentId || (m.description && m.description.toLowerCase().includes('saldo a favor')))) return;

            if (m.type === 'in') {
                totalCashIn += parseFloat(m.amount);
            } else {
                totalRetiros += parseFloat(m.amount);
            }
        });

        // Efectivo esperado = Monto inicial + (Pagos deudas efectivo + Ventas efectivo + Ingresos - Retiros)
        const expectedCash = cashRegister.initialAmount + (paymentSummary.cash || 0) + totalCashIn - totalRetiros;
        // Efectivo en métodos de pago = Pagos deudas efectivo + Ventas efectivo + Ingresos - Retiros (sin monto inicial)
        const cashForDisplay = (paymentSummary.cash || 0) + totalCashIn - totalRetiros;

        // Calcular IVA Débito (Ventas) e IVA Crédito (Compras en el periodo)
        // C6 FIX: IVA Débito — Using sales document information
        let ivaDebito = 0;
        sales.forEach(s => {
            if (s.status === 'cancelled') return; // No sumar IVA de ventas anuladas
            const fiscal = Sale.computeFiscalFromTotal(s.total, s.documentType);
            ivaDebito += fiscal.tax_amount;
        });
        ivaDebito = Math.round(ivaDebito);

        // Obtener solo las compras en el periodo de esta caja para el IVA Crédito
        const startTime = new Date(cashRegister.openDate);
        const endTime = cashRegister.closeDate ? new Date(cashRegister.closeDate) : new Date();

        const sessionPurchases = await Purchase.getByDateRange(startTime, endTime);
        // CORRECCIÓN: uses includes('factura') para capturar 'factura_neto' y 'factura_bruto'
        // También recalcula si ivaAmount fue guardado como 0 por error
        const ivaCredito = sessionPurchases.reduce((sum, p) => {
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

        // 1) Calcular Gastos del Turno
        let totalExpenses = 0;
        movements.forEach(m => {
            const isOut = m.type === 'out';
            const isGasto = (m.description || '').includes('[GASTO]') ||
                            (m.category && m.category !== '' &&
                             !['sale','payment','withdraw','add'].includes(m.category));
            if (isOut && isGasto) {
                totalExpenses += parseFloat(m.amount) || 0;
            }
        });

        // 2) Calcular Costo Neto de Ventas del Turno
        let totalSalesCostNet = 0;
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
            });
        });

        // Descontar devoluciones del turno en el costo
        let totalReturnedCostNet = 0;
        try {
            const returns = await SaleReturn.getByDateRange(startTime, endTime);
            if (Array.isArray(returns)) {
                returns.forEach(ret => {
                    const retItems = typeof ret.items === 'string' ? JSON.parse(ret.items || '[]') : (ret.items || []);
                    retItems.forEach(item => {
                        const pid = item.productId;
                        let itemCostGross = 0;
                        if (item.costAtSale !== undefined && item.costAtSale !== null) {
                            itemCostGross = parseFloat(item.costAtSale) * (parseFloat(item.quantity) || 0);
                        } else {
                            const product = productMap[pid];
                            itemCostGross = product ? (parseFloat(product.cost) || 0) * (parseFloat(item.quantity) || 0) : 0;
                        }
                        const isBoleta = true;
                        const itemCostNet = isBoleta ? Math.round(itemCostGross / 1.19) : itemCostGross;
                        totalReturnedCostNet += itemCostNet;
                    });
                });
            }
        } catch (_) {}

        totalSalesCostNet = Math.max(0, totalSalesCostNet - totalReturnedCostNet);

        // Calcular el ingreso neto total de las ventas (sin IVA)
        let totalSalesRevenueNet = 0;
        sales.forEach(s => {
            if (s.status === 'cancelled') return;
            const isBoleta = (s.documentType || 'boleta') === 'boleta';
            const saleNeto = Math.round(s.total / 1.19);
            const saleRevenue = isBoleta ? saleNeto : s.total;
            totalSalesRevenueNet += saleRevenue;
        });

        // Restar devoluciones del ingreso neto
        let totalReturnedRevenueNet = 0;
        try {
            const returns = await SaleReturn.getByDateRange(startTime, endTime);
            if (Array.isArray(returns)) {
                returns.forEach(ret => {
                    const returnedAmount = parseFloat(ret.totalReturned) || 0;
                    totalReturnedRevenueNet += Math.round(returnedAmount / 1.19);
                });
            }
        } catch (_) {}
        totalSalesRevenueNet = Math.max(0, totalSalesRevenueNet - totalReturnedRevenueNet);

        // ponytail: sin Math.max, para que una pérdida se vea como número negativo y no como $0
        const grossProfit = totalSalesRevenueNet - totalSalesCostNet;
        const netProfit = grossProfit - totalExpenses;

        return {
            ...cashRegister,
            totalSales: totalSalesCount,
            totalSalesAmount: totalSalesAmount,
            debtPayments: payments,
            totalDebtPayments: totalDebtPayments,
            debtPaymentSummary: debtPaymentSummary,
            paymentSummary: paymentSummary,
            movements: movements,
            totalCashIn: totalCashIn,
            totalRetiros: totalRetiros,
            cashForDisplay: cashForDisplay,
            expectedCash: expectedCash,
            ivaDebito: ivaDebito,
            ivaCredito: ivaCredito,
            totalExpenses: totalExpenses,
            grossProfit: grossProfit,
            netProfit: netProfit
        };
    }
}
