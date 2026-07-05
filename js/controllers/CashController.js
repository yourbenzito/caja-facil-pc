class CashController {
    static async openCash(initialAmount, denominations = null) {
        if (!initialAmount || initialAmount < 0) {
            throw new Error('Monto inicial inválido');
        }
        
        try {
            const id = await CashRegister.open(initialAmount, denominations);
            showNotification('Caja abierta correctamente', 'success');
            return id;
        } catch (error) {
            showNotification(error.message, 'error');
            throw error;
        }
    }

    static async closeCash(id, finalAmount) {
        if (finalAmount < 0) {
            throw new Error('Monto final inválido');
        }
        
        try {
            await CashRegister.close(id, finalAmount);
            
            const summary = await this.getCashSummary(id);
            
            if (summary.difference !== 0) {
                const msg = summary.difference > 0 ? 'Sobrante' : 'Faltante';
                showNotification(`${msg}: ${formatCLP(Math.abs(summary.difference))}`, 'warning');
            } else {
                showNotification('Caja cerrada correctamente', 'success');
            }
            
            return summary;
        } catch (error) {
            showNotification(error.message, 'error');
            throw error;
        }
    }

    static async getOpenCash() {
        return await CashRegister.getOpen();
    }

    static async getCashSummary(id) {
        return await CashRegister.getSummary(id);
    }

    static async getCashHistory() {
        return await CashRegister.getAll();
    }

    static async checkCashStatus() {
        const openCash = await this.getOpenCash();
        return openCash !== null;
    }

    static async addCash(amount, reason) {
        const openCash = await this.getOpenCash();
        if (!openCash) {
            throw new Error('No hay una caja abierta');
        }
        
        if (!amount || amount <= 0) {
            throw new Error('El monto debe ser mayor a 0');
        }
        
        try {
            await CashMovement.create({
                cashRegisterId: openCash.id,
                type: 'in',
                amount: amount,
                reason: reason || 'Ingreso de dinero a caja'
            });
            
            showNotification(`Se agregaron ${formatCLP(amount)} a la caja`, 'success');
            return true;
        } catch (error) {
            showNotification(error.message, 'error');
            throw error;
        }
    }

    static async withdrawCash(amount, reason) {
        const openCash = await this.getOpenCash();
        if (!openCash) {
            throw new Error('No hay una caja abierta');
        }
        
        if (!amount || amount <= 0) {
            throw new Error('El monto debe ser mayor a 0');
        }
        
        // Verificar que haya suficiente efectivo disponible
        const summary = await this.getCashSummary(openCash.id);
        if (amount > summary.expectedCash) {
            throw new Error(`No hay suficiente efectivo. Disponible: ${formatCLP(summary.expectedCash)}`);
        }
        
        try {
            await CashMovement.create({
                cashRegisterId: openCash.id,
                type: 'out',
                amount: amount,
                reason: reason || 'Retiro de dinero de caja'
            });
            
            showNotification(`Se retiraron ${formatCLP(amount)} de la caja`, 'success');
            return true;
        } catch (error) {
            showNotification(error.message, 'error');
            throw error;
        }
    }

    static async getDailySales(cashRegisterId) {
        // Fetch all movements for this register
        const allSales = await Sale.getByCashRegister(cashRegisterId);
        const allPayments = await Payment.getByCashRegister(cashRegisterId);
        const allCashMovements = await CashMovement.getByCashRegister(cashRegisterId);
        
        // Group by date (DD/MM/YYYY)
        const movementsByDate = {};
        
        // Process Sales + Deudas del día (ventas fiadas/parciales creadas ese día)
        allSales.forEach(sale => {
            const dateKey = new Date(sale.date).toLocaleDateString('es-CL');
            
            if (!movementsByDate[dateKey]) {
                movementsByDate[dateKey] = {
                    date: dateKey,
                    sales: { count: 0, total: 0 },
                    debtNew: { count: 0, total: 0 },
                    debtPayments: { count: 0, total: 0 },
                    expenses: { count: 0, total: 0 },
                    cashMovementsIn: { count: 0, total: 0 },
                    cashMovementsOut: { count: 0, total: 0 }
                };
            }
            
            movementsByDate[dateKey].sales.count++;
            movementsByDate[dateKey].sales.total += sale.total;
            
            const isCredit = sale.status === 'pending' || sale.status === 'partial';
            if (isCredit) {
                const total = parseFloat(sale.total) || 0;
                const paid = parseFloat(sale.paidAmount) || 0;
                const debt = Math.max(0, total - paid);
                if (debt > 0) {
                    movementsByDate[dateKey].debtNew.count++;
                    movementsByDate[dateKey].debtNew.total += debt;
                }
            }
        });
        
        // Process Debt Payments
        allPayments.forEach(payment => {
            const dateKey = new Date(payment.date).toLocaleDateString('es-CL');
            
            if (!movementsByDate[dateKey]) {
                movementsByDate[dateKey] = {
                    date: dateKey,
                    sales: { count: 0, total: 0 },
                    debtNew: { count: 0, total: 0 },
                    debtPayments: { count: 0, total: 0 },
                    expenses: { count: 0, total: 0 },
                    cashMovementsIn: { count: 0, total: 0 },
                    cashMovementsOut: { count: 0, total: 0 }
                };
            }
            
            movementsByDate[dateKey].debtPayments.count++;
            movementsByDate[dateKey].debtPayments.total += payment.amount;
        });
        
        // Process Cash Movements
        allCashMovements.forEach(movement => {
            const dateKey = new Date(movement.date).toLocaleDateString('es-CL');
            
            if (!movementsByDate[dateKey]) {
                movementsByDate[dateKey] = {
                    date: dateKey,
                    sales: { count: 0, total: 0 },
                    debtNew: { count: 0, total: 0 },
                    debtPayments: { count: 0, total: 0 },
                    expenses: { count: 0, total: 0 },
                    cashMovementsIn: { count: 0, total: 0 },
                    cashMovementsOut: { count: 0, total: 0 }
                };
            }
            
            if (movement.type === 'in') {
                movementsByDate[dateKey].cashMovementsIn.count++;
                movementsByDate[dateKey].cashMovementsIn.total += movement.amount;
            } else if (movement.type === 'out') {
                movementsByDate[dateKey].cashMovementsOut.count++;
                movementsByDate[dateKey].cashMovementsOut.total += movement.amount;
            }
        });
        
        // Convert to array and sort (oldest first)
        return Object.values(movementsByDate).sort((a, b) => {
            // Parse DD/MM/YYYY back to comparison
            const [da, ma, ya] = a.date.split('/');
            const [db, mb, yb] = b.date.split('/');
            return new Date(`${ya}-${ma}-${da}`) - new Date(`${yb}-${mb}-${db}`);
        });
    }

    /**
     * Desglose diario con listas detalladas por sección: ventas, pago deudas, deudas (crédito), retiros, ingresos.
     * @param {number} cashRegisterId
     * @returns {Promise<Array<{ date: string, sales: Array, debtPayments: Array, creditSales: Array, cashMovementsOut: Array, cashMovementsIn: Array }>>}
     */
    static async getDailyDetail(cashRegisterId) {
        const allSales = await Sale.getByCashRegister(cashRegisterId);
        const allPayments = await Payment.getByCashRegister(cashRegisterId);
        const allCashMovements = await CashMovement.getByCashRegister(cashRegisterId);

        const customerIds = new Set();
        allSales.forEach(s => { if (s.customerId) customerIds.add(s.customerId); });
        allPayments.forEach(p => { if (p.customerId) customerIds.add(p.customerId); });
        const salesBySaleId = {};
        allSales.forEach(s => { salesBySaleId[s.id] = s; });
        allPayments.forEach(p => {
            const sale = salesBySaleId[p.saleId];
            if (sale && sale.customerId) customerIds.add(sale.customerId);
        });

        const allCustomers = await Customer.getAll();
        const customerMap = {};
        allCustomers.forEach(c => {
            customerMap[c.id] = c.name;
        });

        const toDateKey = (d) => new Date(d).toLocaleDateString('es-CL');
        const daysMap = {};

        const ensureDay = (dateKey) => {
            if (!daysMap[dateKey]) {
                daysMap[dateKey] = {
                    date: dateKey,
                    sales: [],
                    debtPayments: [],
                    creditSales: [],
                    cashMovementsOut: [],
                    cashMovementsIn: []
                };
            }
            return daysMap[dateKey];
        };

        allSales.forEach(sale => {
            // No incluir ventas anuladas en el conteo de ventas del día para evitar inflar los números
            if (sale.status === 'cancelled') return;

            const dateKey = toDateKey(sale.date);
            const day = ensureDay(dateKey);
            day.sales.push({
                id: sale.id,
                saleNumber: sale.saleNumber,
                total: sale.total,
                paymentMethod: sale.paymentMethod,
                paymentDetails: sale.paymentDetails,
                status: sale.status,
                paidAmount: sale.paidAmount,
                date: sale.date,
                customerId: sale.customerId
            });
            if (sale.status === 'pending' || sale.status === 'partial') {
                const total = parseFloat(sale.total) || 0;
                const paid = parseFloat(sale.paidAmount) || 0;
                const remaining = Math.max(0, total - paid);
                day.creditSales.push({
                    saleId: sale.id,
                    saleNumber: sale.saleNumber,
                    customerName: sale.customerId ? (customerMap[sale.customerId] || 'Sin cliente') : 'Sin cliente',
                    total,
                    paidAmount: paid,
                    remaining,
                    date: sale.date
                });
            }
        });

        allPayments.forEach(payment => {
            const dateKey = toDateKey(payment.date);
            const day = ensureDay(dateKey);
            const sale = salesBySaleId[payment.saleId];
            const customerName = (sale && sale.customerId && customerMap[sale.customerId]) ? customerMap[sale.customerId] : (payment.customerId && customerMap[payment.customerId]) ? customerMap[payment.customerId] : 'Sin cliente';
            day.debtPayments.push({
                id: payment.id,
                amount: payment.amount,
                paymentMethod: payment.paymentMethod || 'cash',
                date: payment.date,
                customerName,
                saleId: payment.saleId
            });
        });

        allCashMovements.forEach(m => {
            const dateKey = toDateKey(m.date);
            const day = ensureDay(dateKey);
            const row = { amount: m.amount, reason: m.description || m.reason || '-', date: m.date };
            if (m.type === 'in') day.cashMovementsIn.push(row);
            else day.cashMovementsOut.push(row);
        });

        return Object.values(daysMap).sort((a, b) => {
            const [da, ma, ya] = a.date.split('/');
            const [db, mb, yb] = b.date.split('/');
            return new Date(`${ya}-${ma}-${da}`) - new Date(`${yb}-${mb}-${db}`);
        });
    }
}
