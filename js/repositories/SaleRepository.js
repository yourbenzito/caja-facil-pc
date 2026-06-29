/**
 * Sale Repository
 * Handles all database operations for Sales
 */
class SaleRepository extends BaseRepository {
    constructor() {
        super('sales');
    }

    /**
     * Get sales by customer ID
     * CRITICAL: Returns ALL sales for the customer (credit and completed)
     * Debt is calculated as SUM of unpaid credit sales (status='pending' with remaining > 0)
     * 
     * C4: Optimizado — usa índice 'customerId' (O(k) vs O(n) full scan)
     * 
     * @param {number} customerId - Customer ID
     * @returns {Promise<Array>} - All sales for the customer
     */
    async findByCustomerId(customerId, params = {}) {
        if (!customerId) return [];

        const numericCustomerId = typeof customerId === 'string' ? parseInt(customerId, 10) : customerId;
        if (isNaN(numericCustomerId)) {
            console.error('Invalid customerId type:', customerId);
            return [];
        }

        try {
            // C4: Usar índice 'customerId' para lookup O(k) en vez de full scan O(n)
            return await this.findByIndex('customerId', numericCustomerId, params);
        } catch (indexError) {
            // C4: Fallback seguro — full scan con normalización de tipos si el índice falla
            console.warn('SaleRepository.findByCustomerId: index fallback', indexError);
            try {
                const allSales = await this.findAll(params);
                return allSales.filter(sale => {
                    if (sale.customerId == null) return false;
                    const saleCid = typeof sale.customerId === 'string' ? parseInt(sale.customerId, 10) : sale.customerId;
                    return saleCid === numericCustomerId;
                });
            } catch (fallbackError) {
                console.error('SaleRepository.findByCustomerId: complete failure', fallbackError);
                return [];
            }
        }
    }

    /**
     * Find first sale with given idempotency key (for idempotent sale creation).
     * C4: Optimizado — usa índice 'idempotencyKey' (B1) en vez de full scan.
     * @param {string} key - Idempotency key
     * @returns {Promise<Object|null>}
     */
    async findByIdempotencyKey(key) {
        if (!key || typeof key !== 'string' || key.trim() === '') return null;
        try {
            // C4: Usar índice 'idempotencyKey' para lookup O(1) en vez de full scan O(n)
            const results = await this.findByIndex('idempotencyKey', key);
            return (results && results.length > 0) ? results[0] : null;
        } catch (indexError) {
            // C4: Fallback seguro — full scan si el índice falla
            console.warn('SaleRepository.findByIdempotencyKey: index fallback', indexError);
            const sales = await this.findAll();
            return sales.find(s => s.idempotencyKey === key) || null;
        }
    }

    /**
     * Get sales by cash register ID
     * C4: Optimizado — usa índice 'cashRegisterId' (B1) en vez de full scan.
     * @param {number} cashRegisterId - Cash register ID
     * @returns {Promise<Array>}
     */
    async findByCashRegisterId(cashRegisterId) {
        try {
            // C4: Usar índice 'cashRegisterId' para lookup O(k) en vez de full scan O(n)
            return await this.findByIndex('cashRegisterId', cashRegisterId);
        } catch (indexError) {
            // C4: Fallback seguro — full scan si el índice falla
            console.warn('SaleRepository.findByCashRegisterId: index fallback', indexError);
            const sales = await this.findAll();
            return sales.filter(sale => sale.cashRegisterId === cashRegisterId);
        }
    }

    /**
     * Get sales by date range
     * C4: Optimizado — usa índice 'date' con IDBKeyRange en vez de full scan.
     * Las fechas se almacenan como ISO strings, que son lexicográficamente ordenables.
     * @param {Date|string} startDate - Start date
     * @param {Date|string} endDate - End date
     * @returns {Promise<Array>}
     */
    async findByDateRange(startDate, endDate, params = {}) {
        try {
            // C4: Usar índice 'date' con IDBKeyRange.bound() para range scan O(k) vs full scan O(n)
            const start = new Date(startDate).toISOString();
            const end = new Date(endDate).toISOString();
            return await this.findByIndexRange('date', start, end, params);
        } catch (indexError) {
            // C4: Fallback seguro — full scan con comparación de Date
            console.warn('SaleRepository.findByDateRange: index range fallback', indexError);
            const sales = await this.findAll(params);
            return sales.filter(sale => {
                const saleDate = new Date(sale.date);
                return saleDate >= new Date(startDate) && saleDate <= new Date(endDate);
            });
        }
    }

    /**
     * C4: Find sales by status using index 'status' (B1).
     * @param {string} status - Sale status (e.g. 'pending', 'partial', 'completed')
     * @returns {Promise<Array>}
     */
    async findByStatus(status) {
        try {
            // C4: Usar índice 'status' para lookup O(k) en vez de full scan O(n)
            return await this.findByIndex('status', status);
        } catch (indexError) {
            // C4: Fallback seguro — full scan si el índice falla
            console.warn('SaleRepository.findByStatus: index fallback', indexError);
            const sales = await this.findAll();
            return sales.filter(s => s.status === status);
        }
    }

    /**
     * Get pending sales (includes partial payments)
     * Returns sales with status 'pending' or 'partial' (unpaid credit sales)
     * C4: Optimizado — usa dos lookups por índice 'status' en paralelo.
     * @returns {Promise<Array>}
     */
    async findPending(params = {}) {
        try {
            // C4: Dos lookups por índice en paralelo — O(k1+k2) en vez de full scan O(n)
            const [pending, partial] = await Promise.all([
                this.findByStatus('pending', params),
                this.findByStatus('partial', params)
            ]);
            return [...pending, ...partial];
        } catch (error) {
            // C4: Fallback seguro
            console.warn('SaleRepository.findPending: index fallback', error);
            const sales = await this.findAll(params);
            return sales.filter(sale => sale.status === 'pending' || sale.status === 'partial');
        }
    }

    /**
     * Get latest sales with pagination
     * @param {number} limit 
     * @param {number} offset 
     * @returns {Promise<Array>}
     */
    async findLatest(limit = 50, offset = 0) {
        if (db.mode === 'sqlite') {
            const results = await window.ApiClient.get('sales/list/latest', { limit, offset });
            return Array.isArray(results) ? results : [];
        }
        return await this.findAll({ limit, offset });
    }

    /**
     * Get last sale (most recent). En SQLite usa API optimizada.
     */
    async findLast() {
        if (db.mode === 'sqlite') {
            try {
                const rows = await window.ApiClient.get('sales/list/latest', { limit: 1, offset: 0 });
                return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
            } catch (e) {
                console.warn('findLast fallback:', e);
            }
        }
        const sales = await this.findAll({ limit: 1 });
        if (!sales || sales.length === 0) return null;
        const sorted = [...sales].sort((a, b) => new Date(b.date) - new Date(a.date));
        return sorted[0];
    }

    /**
     * Get today's sales
     * @returns {Promise<Array>}
     */
    async findToday() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        return await this.findByDateRange(today, tomorrow);
    }

    /**
     * Get total sales by payment method for a cash register.
     * Criterio efectivo esperado: solo efectivo suma. Ventas efectivo, pago mixto (parte efectivo),
     * pagos de deuda en efectivo (vía Payment), ediciones otro→efectivo suman.
     * Ediciones efectivo→otro restan (dejar de contar como efectivo).
     *
     * @param {number} cashRegisterId - Cash register ID
     * @returns {Promise<Object>}
     */
    async getTotalByPaymentMethod(cashRegisterId) {
        const sales = await this.findByCashRegisterId(cashRegisterId);

        const totals = {
            cash: 0,
            card: 0,
            qr: 0,
            other: 0
        };

        // OPTIMIZATION: Only fetch payments related to the sales in this session or made directly to this register
        // Instead of Payment.getAll(), we use the session-specific payments
        const paymentsInThisRegister = await Payment.getByCashRegister(cashRegisterId);
        
        const paymentsBySale = {};
        if (paymentsInThisRegister && paymentsInThisRegister.length > 0) {
            paymentsInThisRegister.forEach(p => {
                if (p.saleId) {
                    if (!paymentsBySale[p.saleId]) paymentsBySale[p.saleId] = [];
                    paymentsBySale[p.saleId].push(p);
                }
            });
        }

        // 1) Pagos iniciales de las ventas creadas en esta sesión
        for (const sale of sales) {
            // C6 FIX: No contar dinero de ventas canceladas en el total de caja
            if (sale.status === 'cancelled') continue;

            const allPaymentsForSale = paymentsBySale[sale.id] || [];
            const totalPaymentsForSale = allPaymentsForSale.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

            // Pago inicial = Lo que se pagó al momento de crear la venta
            // (sale.paidAmount actual - todos los abonos registrados después)
            const initialPaidAmount = Math.max(0, (parseFloat(sale.paidAmount) || 0) - totalPaymentsForSale);

            if (initialPaidAmount > 0) {
                if (sale.paymentDetails && typeof sale.paymentDetails === 'object' && Object.keys(sale.paymentDetails).length > 0) {
                    const entries = Object.entries(sale.paymentDetails).filter(([method]) => method !== 'creditBalance');
                    const totalDetails = entries.reduce((sum, [, amount]) => sum + (parseFloat(amount) || 0), 0);
                    // Proporción del pago inicial que corresponde a cada método en el pago mixto
                    const factor = totalDetails > 0 ? (initialPaidAmount / totalDetails) : 1;
                    for (const [method, amount] of entries) {
                        if (totals[method] !== undefined) {
                            totals[method] += (parseFloat(amount) || 0) * factor;
                        }
                    }
                } else {
                    const method = sale.paymentMethod || 'cash';
                    if (method !== 'creditBalance' && totals[method] !== undefined) {
                        totals[method] += initialPaidAmount;
                    }
                }
            }
        }

        // 2) TODOS los pagos (abonos) registrados EN ESTA sesión de caja
        // Esto incluye abonos a ventas de esta sesión o de sesiones anteriores
        if (paymentsInThisRegister && paymentsInThisRegister.length > 0) {
            paymentsInThisRegister.forEach(payment => {
                const method = payment.paymentMethod || 'cash';
                if (totals[method] !== undefined) {
                    totals[method] += parseFloat(payment.amount) || 0;
                }
            });
        }

        // 3) Dinero a favor del cliente (depósitos a cuenta) realizados en esta sesión
        const creditDeposits = await CustomerCreditDeposit.getByCashRegister(cashRegisterId);
        if (creditDeposits && creditDeposits.length > 0) {
            creditDeposits.forEach(deposit => {
                const method = deposit.paymentMethod || 'cash';
                if (totals[method] !== undefined) {
                    totals[method] += parseFloat(deposit.amount) || 0;
                }
            });
        }

        return totals;
    }
}
