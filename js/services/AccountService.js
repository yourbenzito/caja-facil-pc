/**
 * Account Service
 * Centralizes account balance and debt calculation logic
 */
class AccountService {
    /**
     * Get customer account balance
     * CRITICAL: Debt is ALWAYS calculated dynamically (never stored/overwritten)
     * Formula: SUM(credit sales) - SUM(payments)
     * Equivalent to: SUM(sale.total - sale.paidAmount) for all credit sales with remaining > 0
     * Credit sales = sales with status 'pending' or 'partial' (not 'completed')
     * 
     * @param {number} customerId - Customer ID
     * @returns {Promise<Object>} - { totalDebt: number, pendingSales: Array }
     */
    static async getCustomerBalance(customerId) {
        if (!customerId) {
            return {
                totalDebt: 0,
                pendingSales: [],
                balanceCredit: 0,
                displayBalance: 0
            };
        }

        try {
            // FASE 5: Optimización para SQLite - Usar endpoint de agregación en el servidor
            if (db.mode === 'sqlite') {
                const result = await window.ApiClient.get(`customers/${customerId}/account-status`);
                if (result && result.balance) {
                    return {
                        totalDebt: result.balance.totalDebt,
                        pendingSales: result.pendingSales,
                        balanceCredit: result.balance.totalCredit,
                        displayBalance: result.balance.totalDebt - result.balance.totalCredit
                    };
                }
            }

            // Fallback para IndexedDB o si falla el API
            const allSales = await Sale.getByCustomer(customerId);

            // Ensure sales is an array
            if (!Array.isArray(allSales)) {
                console.warn('getCustomerBalance: sales is not an array', { customerId, sales: allSales });
                return {
                    totalDebt: 0,
                    pendingSales: [],
                    balanceCredit: 0,
                    displayBalance: 0
                };
            }

            // CRITICAL: Filter credit sales (status='pending' or 'partial')
            // These are the sales that contribute to debt
            // Only sales with remaining debt > 0 count towards total debt
            const creditSales = allSales.filter(sale => {
                // Validate sale exists and has status property
                if (!sale || !sale.hasOwnProperty('status')) {
                    console.warn('Sale missing status property:', sale);
                    return false;
                }

                // Pending and partial sales contribute to debt (not completed/paid)
                return sale.status === 'pending' || sale.status === 'partial';
            });

            // CRITICAL: Calculate debt dynamically as: SUM(credit sales) - SUM(payments)
            // Formula: SUM(sale.total - sale.paidAmount) for each credit sale with remaining > 0
            // This is equivalent to: SUM(credit sales totals) - SUM(all payments applied to those sales)
            // Debt is NEVER stored - always calculated from fresh data
            let totalDebt = 0;
            const details = [];

            for (const sale of creditSales) {
                // Validate sale has required properties
                if (!sale || !sale.id || sale.total === undefined) {
                    console.warn('Invalid sale in credit sales:', sale);
                    continue;
                }

                // Obtener devoluciones hechas a esta venta para no cobrar artículos retornados
                let returnedAmount = 0;
                try {
                    const retSummary = typeof SaleReturnService !== 'undefined' ? await SaleReturnService.getReturnSummary(sale.id) : null;
                    if (retSummary) returnedAmount = parseFloat(retSummary.totalReturned) || 0;
                } catch (e) {
                    console.warn('AccountService: No se pudieron procesar las devoluciones para la deuda', sale.id, e);
                }

                // Calculate remaining debt for this sale (fresh from database)
                const saleTotal = parseFloat(sale.total) || 0;
                const salePaid = parseFloat(sale.paidAmount) || 0; // This includes all payments registered

                // FIX FASE D: Al total original se le descuenta lo que ya fue devuelto y luego los abonos de pago.
                const remaining = (saleTotal - returnedAmount) - salePaid;

                // CRITICAL: Only count sales with actual remaining debt (> 0)
                // This ensures we don't count fully paid or overpaid sales
                if (remaining > 0) {
                    // Accumulate debt (NEVER overwrite)
                    totalDebt += remaining;

                    // Add to details for history
                    details.push({
                        saleId: sale.id,
                        saleNumber: sale.saleNumber || 'N/A',
                        date: sale.date || new Date().toISOString(),
                        total: saleTotal,
                        returned: returnedAmount, // Informativo de cuánto se restó de deuda
                        paid: salePaid, // Fresh paidAmount from database (includes all payments)
                        remaining: remaining, // Fresh calculation
                        items: sale.items || []
                    });
                }
            }

            // CRITICAL: Debt is calculated, never stored
            // Round to 2 decimals to avoid floating point issues
            const calculatedDebt = Math.round(totalDebt * 100) / 100;

            // Dinero a favor del cliente (reduce el saldo a pagar)
            const customer = await Customer.getById(customerId);
            const balanceCredit = (customer && (customer.balanceCredit != null)) ? parseFloat(customer.balanceCredit) || 0 : 0;

            return {
                totalDebt: calculatedDebt,
                pendingSales: details.sort((a, b) => new Date(a.date) - new Date(b.date)),
                balanceCredit: balanceCredit,
                /** Saldo a mostrar: deuda - dinero a favor. Positivo = debe, negativo/cero con crédito = tiene a favor */
                displayBalance: Math.round((calculatedDebt - balanceCredit) * 100) / 100
            };
        } catch (error) {
            console.error('Error calculating account balance:', error, { customerId });
            return {
                totalDebt: 0,
                pendingSales: [],
                balanceCredit: 0,
                displayBalance: 0
            };
        }
    }

    /**
     * Calculate remaining debt for a single sale
     * @param {Object} sale - Sale object
     * @returns {number}
     */
    static calculateSaleRemaining(sale) {
        return PaymentService.calculateRemainingDebt(sale);
    }

    /**
     * Get accounts receivable total (all pending sales)
     * @returns {Promise<number>}
     */
    static async getAccountsReceivable() {
        const pending = await Sale.getPendingSales();
        let totalDebt = 0;

        for (const sale of pending) {
            let returnedAmount = 0;
            try {
                const retSummary = typeof SaleReturnService !== 'undefined' ? await SaleReturnService.getReturnSummary(sale.id) : null;
                if (retSummary) returnedAmount = parseFloat(retSummary.totalReturned) || 0;
            } catch (e) {
                console.warn('AccountService: Error al procesar devoluciones para accounts receivable', sale.id, e);
            }

            const saleTotal = parseFloat(sale.total) || 0;
            const salePaid = parseFloat(sale.paidAmount) || 0;
            const remaining = (saleTotal - returnedAmount) - salePaid;

            if (remaining > 0) {
                totalDebt += remaining;
            }
        }

        return totalDebt;
    }

    /**
     * Obtiene alertas de cobranza basadas en:
     * 1. Antigüedad de la PRIMERA deuda pendiente (>7 días)
     * 2. Si hoy es el día de pago acordado del cliente
     * @returns {Promise<Array>}
     */
    static async getCollectionAlerts() {
        const now = new Date();
        const todayDay = now.getDate();
        const threshold = new Date();
        threshold.setDate(threshold.getDate() - 7); // Deudas de más de 1 semana

        // 1. Obtener todas las ventas pendientes (créditos)
        const pendingSales = await Sale.getPendingSales();
        
        // 2. Agrupar por cliente e identificar la fecha de la DEUDA MÁS ANTIGUA
        const debtorsMap = {};
        for (const sale of pendingSales) {
            const cid = sale.customerId;
            const saleDate = new Date(sale.date);
            
            // Si es la primera vez que vemos al cliente o esta venta es MÁS ANTIGUA que la que teníamos
            if (!debtorsMap[cid] || saleDate < debtorsMap[cid].oldestDebtDate) {
                if (!debtorsMap[cid]) debtorsMap[cid] = { totalDebt: 0 };
                debtorsMap[cid].customerId = cid;
                debtorsMap[cid].oldestDebtDate = saleDate;
            }
        }

        const alerts = [];
        for (const cid in debtorsMap) {
            const balance = await this.getCustomerBalance(cid);
            if (balance.totalDebt > 0) {
                const customer = await Customer.getById(cid);
                const oldestDate = debtorsMap[cid].oldestDebtDate;
                const isLate = oldestDate < threshold;
                const isPaymentDay = customer && customer.paymentDay === todayDay;

                if (isLate || isPaymentDay) {
                    alerts.push({
                        id: cid,
                        name: customer ? customer.name : 'Cliente Desconocido',
                        phone: customer ? customer.phone : '',
                        totalDebt: balance.totalDebt,
                        oldestDebtDate: oldestDate,
                        daysOwed: Math.floor((now - oldestDate) / (1000 * 60 * 60 * 24)),
                        isPaymentDay: isPaymentDay,
                        isLate: isLate,
                        paymentDay: customer ? customer.paymentDay : 0
                    });
                }
            }
        }

        // Ordenar: Primero los que tienen día de pago hoy, luego los más antiguos
        return alerts.sort((a, b) => {
            if (a.isPaymentDay && !b.isPaymentDay) return -1;
            if (!a.isPaymentDay && b.isPaymentDay) return 1;
            return b.daysOwed - a.daysOwed;
        });
    }
}
