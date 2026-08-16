/**
 * Customer Account Service
 * Handles atomic write operations for customer accounts (deposits, debt payments).
 * Ensures consistency between Customer credit balance, Payment records, and Sales.
 */
class CustomerAccountService {
    /**
     * ATOMIC: Register a credit deposit (dinero a favor) for a customer.
     * Updates Customer.balanceCredit and creates a CustomerCreditDeposit record in ONE transaction.
     */
    static async registerCreditDeposit(customerId, amount, paymentMethod, cashRegisterId, notes = '') {
        if (!customerId || amount <= 0) throw new Error('Datos de depósito inválidos');

        // Prepare data
        const date = new Date().toISOString();
        const deposit = {
            customerId,
            amount,
            paymentMethod,
            cashRegisterId,
            date,
            notes: notes || `Depósito de dinero a favor`
        };

        if (db.mode === 'sqlite') {
            const result = await ApiClient.post('complex/credit-deposit', { deposit });
            if (!result.success) throw new Error(result.error || 'Error en depósito SQLite');
            
            // CRITICAL: Invalidate 'customers' and 'customerCreditDeposits' cache
            db.clearCache('customers');
            db.clearCache('customerCreditDeposits');
            
            return;
        }

        // Transaction (IndexedDB)
        return await new Promise((resolve, reject) => {
            const tx = db.db.transaction(['customers', 'customerCreditDeposits'], 'readwrite');
            tx.onerror = () => reject(new Error('Error en transacción de depósito: ' + tx.error?.message));
            tx.onabort = () => reject(new Error('Transacción de depósito abortada'));
            tx.oncomplete = () => resolve();

            const customerStore = tx.objectStore('customers');
            const depositStore = tx.objectStore('customerCreditDeposits');

            // 1. Get customer
            const getReq = customerStore.get(customerId);
            getReq.onsuccess = () => {
                const customer = getReq.result;
                if (!customer) { tx.abort(); return; }

                // 2. Update credit balance
                const currentCredit = parseFloat(customer.balanceCredit) || 0;
                const newCredit = currentCredit + amount;
                customerStore.put({
                    ...customer,
                    balanceCredit: newCredit,
                    updatedAt: date
                });

                // 3. Add deposit record
                depositStore.add(deposit);
            };
        });
    }

    /**
     * ATOMIC: Register a debt payment.
     * Distributes the amount among pending sales, creates Payment records, and updates Sales status.
     * Everything happens in ONE transaction to ensure consistency.
     */
    static async registerAccountPayment(customerId, amount, paymentMethod, cashRegisterId, notes = '') {
        if (!customerId || amount <= 0) throw new Error('Monto de pago inválido');

        // 1. Fetch current status to know which sales to pay
        const balance = await this.getCustomerBalance(customerId);
        if (balance.pendingSales.length === 0) {
            throw new Error('El cliente no tiene deuda pendiente');
        }

        let remainingToPay = amount;
        const paymentsToCreate = [];
        const date = new Date().toISOString();

        for (const saleSummary of balance.pendingSales) {
            if (remainingToPay <= 0) break;

            const appliedAmount = Math.min(saleSummary.remaining, remainingToPay);
            if (appliedAmount <= 0) continue;

            paymentsToCreate.push({
                saleId: saleSummary.saleId,
                customerId: customerId,
                amount: appliedAmount,
                paymentMethod: paymentMethod,
                cashRegisterId: cashRegisterId,
                date,
                notes: notes || 'Abono a cuenta corriente'
            });


            remainingToPay -= appliedAmount;
        }

        const totalToPay = amount - remainingToPay; // Total actually applicable

        if (db.mode === 'sqlite') {
            const result = await ApiClient.post('complex/account-payment', { paymentsToCreate });
            if (!result.success) throw new Error(result.error || 'Error en abono SQLite');
            
            // CRITICAL: Invalidate 'sales', 'payments' and 'customers' cache
            db.clearCache('sales');
            db.clearCache('payments');
            db.clearCache('customers');
            
            return { totalPaid: totalToPay };
        }

        // 2. Execute atomic transaction (IndexedDB)
        return await new Promise((resolve, reject) => {
            const tx = db.db.transaction(['sales', 'payments'], 'readwrite');
            tx.onerror = () => reject(new Error('Error en transacción de abono: ' + tx.error?.message));
            tx.onabort = () => reject(new Error('Transacción de abono abortada'));
            tx.oncomplete = () => resolve({ totalPaid: totalToPay });

            const saleStore = tx.objectStore('sales');
            const paymentStore = tx.objectStore('payments');

            // Process each payment/sale update
            for (const p of paymentsToCreate) {
                // Add payment record
                paymentStore.add(p);

                // Update sale record
                const saleReq = saleStore.get(p.saleId);
                saleReq.onsuccess = () => {
                    const sale = saleReq.result;
                    if (!sale) return;

                    const newPaidAmount = (parseFloat(sale.paidAmount) || 0) + p.amount;
                    const isFullyPaid = newPaidAmount >= (parseFloat(sale.total) || 0);

                    saleStore.put({
                        ...sale,
                        paidAmount: newPaidAmount,
                        status: isFullyPaid ? 'completed' : 'partial',
                        updatedAt: new Date().toISOString()
                    });
                };
            }
        });
    }

    /**
     * ATOMIC: Deduct from customer credit balance to pay for something (e.g. debt).
     * Creates a CustomerCreditUse record and updates Customer balance atomically.
     */
    static async useCreditForPayment(customerId, amount, details = {}) {
        if (!customerId || amount <= 0) throw new Error('Datos de uso de crédito inválidos');

        const use = {
            customerId,
            amount,
            saleId: details.saleId || null,
            saleNumber: details.saleNumber || null,
            date: new Date().toISOString(),
            notes: details.notes || 'Uso de saldo a favor',
        };

        if (db.mode === 'sqlite') {
            const result = await ApiClient.post('complex/customer-credit-use', use);
            if (!result.success) throw new Error(result.error || 'Error en uso de crédito SQLite');
            
            db.clearCache('customers');
            db.clearCache('customerCreditUses');
            return;
        }

        // IndexedDB Transaction
        return await new Promise((resolve, reject) => {
            const tx = db.db.transaction(['customers', 'customerCreditUses'], 'readwrite');
            tx.onerror = () => reject(new Error('Error en transacción de uso de crédito: ' + tx.error?.message));
            tx.onabort = () => reject(new Error('Transacción de uso de crédito abortada'));
            tx.oncomplete = () => resolve();

            const customerStore = tx.objectStore('customers');
            const useStore = tx.objectStore('customerCreditUses');

            const getReq = customerStore.get(customerId);
            getReq.onsuccess = () => {
                const customer = getReq.result;
                if (!customer) { tx.abort(); return; }

                const currentCredit = parseFloat(customer.balanceCredit) || 0;
                if (currentCredit < amount) {
                    showNotification('Saldo insuficiente', 'error');
                    tx.abort();
                    return;
                }

                customerStore.put({
                    ...customer,
                    balanceCredit: currentCredit - amount,
                    updatedAt: new Date().toISOString()
                });

                useStore.add(use);
            };
        });
    }

    /**
     * Reconcile debt and credit balance automatically.
     */
    static async reconcileBalances(customerId) {
        if (db.mode !== 'sqlite') return;
        return await ApiClient.post('complex/reconcile-balances', { customerId });
    }

    /**
     * Get basic balance info for a customer.
     */
    static async getCustomerBalance(customerId) {
        // En SQLite usamos la ruta optimizada del backend si está disponible
        if (db.mode === 'sqlite') {
            // C10: Autocorrección - Conciliar saldos si tiene deuda y saldo a favor a la vez
            try {
                await CustomerAccountService.reconcileBalances(customerId);
            } catch (e) { console.warn('Error en reconciliación automática:', e); }

            const status = await this.getFullAccountStatus(customerId);
            if (status) {
                return {
                    totalDebt: status.summary.totalDebt,
                    balanceCredit: status.summary.balanceCredit,
                    pendingSales: status.pendingSales.map(s => ({
                        saleId: s.id,
                        saleNumber: s.saleNumber,
                        total: s.total,
                        paidAmount: s.paidAmount,
                        remaining: s.total - s.paidAmount,
                        date: s.date
                    }))
                };
            }
        }

        // Fallback or IndexedDB
        const customer = await Customer.getById(customerId);
        const sales = await Sale.getByCustomer(customerId);
        const pendingSales = sales
            .filter(s => s.status === 'pending' || s.status === 'partial')
            .map(s => ({
                saleId: s.id,
                total: s.total,
                paidAmount: s.paidAmount,
                remaining: s.total - s.paidAmount,
                date: s.date
            }));

        const totalDebt = pendingSales.reduce((sum, s) => sum + s.remaining, 0);

        return {
            totalDebt,
            balanceCredit: parseFloat(customer?.balanceCredit) || 0,
            pendingSales
        };
    }

    /**
     * Optimized: Get full account status in a single request (SQLite only)
     */
    static async getFullAccountStatus(customerId) {
        if (db.mode !== 'sqlite') return null;
        try {
            return await ApiClient.get(`customers/${customerId}/account-status`);
        } catch (e) {
            console.error('Error fetching full account status:', e);
            return null;
        }
    }

    /**
     * Optimized: Get all customers with their debt and credit balance (SQLite only)
     */
    static async getCustomersWithBalance() {
        if (db.mode !== 'sqlite') return null;
        try {
            return await ApiClient.get(`customers/pos/summary`);
        } catch (e) {
            console.error('Error fetching customers with balance:', e);
            return null;
        }
    }
}
