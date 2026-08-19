/**
 * C6: Supplier Payment Service
 * Handles supplier payments and supplier debt calculations.
 *
 * Rules:
 * - Purchases create stock and an obligation.
 * - Supplier payments are the cash/bank event.
 * - In SQLite mode, payment + purchase balance + optional cash movement are atomic.
 */
class SupplierPaymentService {
    static _summaryCache = null;
    static _lastSummaryTime = 0;
    static CACHE_TTL = 3000;

    /**
     * Register a new payment to a supplier.
     * @param {Object} data - {supplierId, purchaseId, amount, method, reference, notes, deductFromCashRegister}
     */
    static async registerPayment(data) {
        if (!data.amount || data.amount <= 0) throw new Error('El monto debe ser mayor a 0');

        const payment = {
            supplierId: data.supplierId,
            purchaseId: data.purchaseId || null,
            amount: parseFloat(data.amount),
            method: data.method || 'cash',
            reference: data.reference || '',
            notes: data.notes || '',
            date: new Date().toISOString()
        };

        let currentRegister = null;
        if (data.deductFromCashRegister && (payment.method === 'cash' || payment.method === 'efectivo')) {
            currentRegister = await CashRegister.getOpen();
            if (!currentRegister || !currentRegister.id) {
                throw new Error('La caja esta cerrada. Si quieres egresar dinero de caja, primero abre la caja o desmarca "Egresar dinero de la caja actual".');
            }
        }

        if (db.mode === 'sqlite') {
            const result = await ApiClient.post('complex/supplier-payment', {
                payment: {
                    ...payment,
                    createdBy: typeof AuditLogService !== 'undefined' ? AuditLogService.getCurrentUserId() : null,
                    cashRegisterId: currentRegister ? currentRegister.id : null
                },
                deductFromCashRegister: data.deductFromCashRegister === true,
                cashRegisterId: currentRegister ? currentRegister.id : null
            });
            if (!result.success) throw new Error(result.error || 'Error al registrar pago a proveedor');
            if (db.clearCache) {
                db.clearCache('supplierPayments');
                db.clearCache('purchases');
                db.clearCache('cashMovements');
                db.clearCache('cashRegisters');
                db.clearCache('auditLogs');
            }
            this._summaryCache = null;
            return result.id;
        }

        const paymentId = await SupplierPayment.create(payment);

        if (data.purchaseId) {
            try {
                await Purchase.registerPayment(data.purchaseId, data.amount);
            } catch (error) {
                console.warn('C6: Error actualizando paidAmount de compra legacy, pero el pago se registro:', error);
            }
        } else {
            try {
                const pending = await Purchase.getBySupplier(data.supplierId);
                let remainingAmount = data.amount;
                for (const p of pending.filter(p => p.status === 'pending')) {
                    if (remainingAmount <= 0) break;
                    const debt = p.total - (p.paidAmount || 0);
                    const toPay = Math.min(debt, remainingAmount);
                    if (toPay > 0) {
                        await Purchase.registerPayment(p.id, toPay);
                        remainingAmount -= toPay;
                    }
                }
            } catch (_) { /* legacy fallback */ }
        }

        if (data.deductFromCashRegister && (payment.method === 'cash' || payment.method === 'efectivo')) {
            const supplier = await Supplier.getById(data.supplierId);
            const reason = `Pago a Proveedor: ${supplier ? supplier.name : '#' + data.supplierId} ${data.purchaseId ? '(Compra #' + data.purchaseId + ')' : '(General)'}`;
            await CashMovement.create({
                cashRegisterId: currentRegister.id,
                type: 'out',
                amount: data.amount,
                reason,
                paymentId
            });
        }

        this._summaryCache = null;
        return paymentId;
    }

    /**
     * Calculate total debt for a supplier.
     * Compatibility: for old purchases with mutated paidAmount, uses the higher value
     * between registered payments and purchase.paidAmount.
     */
    static async getSupplierDebt(supplierId) {
        const purchases = await Purchase.getBySupplier(supplierId);
        const payments = await SupplierPayment.getBySupplier(supplierId);

        const purchaseIds = new Set(purchases.map(p => p.id));
        const paymentsByPurchase = {};
        let generalPayments = 0;

        for (const p of payments) {
            const amt = parseFloat(p.amount) || 0;
            if (p.purchaseId && purchaseIds.has(p.purchaseId)) {
                paymentsByPurchase[p.purchaseId] = (paymentsByPurchase[p.purchaseId] || 0) + amt;
            } else {
                generalPayments += amt;
            }
        }

        let totalDebt = 0;
        for (const purchase of purchases) {
            if (purchase.status === 'cancelled') continue;
            const total = parseFloat(purchase.total) || 0;
            const legacyPaid = parseFloat(purchase.paidAmount) || 0;
            const registeredPaid = paymentsByPurchase[purchase.id] || 0;
            const effectivePaid = Math.max(legacyPaid, registeredPaid);
            const balance = total - effectivePaid;
            totalDebt += (balance >= 1.0) ? Math.round(balance) : 0;
        }

        const netDebt = Math.round(totalDebt - generalPayments);
        return Math.max(0, netDebt >= 1.0 ? netDebt : 0);
    }

    /**
     * Get debt per purchase for a supplier.
     */
    static async getDebtDetail(supplierId) {
        const purchases = await Purchase.getBySupplier(supplierId);
        const payments = await SupplierPayment.getBySupplier(supplierId);

        const paymentsByPurchase = {};
        for (const p of payments) {
            if (p.purchaseId) {
                if (!paymentsByPurchase[p.purchaseId]) paymentsByPurchase[p.purchaseId] = [];
                paymentsByPurchase[p.purchaseId].push(p);
            }
        }

        const detail = [];
        for (const purchase of purchases) {
            const isCancelled = purchase.status === 'cancelled';
            const total = parseFloat(purchase.total) || 0;
            const legacyPaid = parseFloat(purchase.paidAmount) || 0;
            const purchasePayments = paymentsByPurchase[purchase.id] || [];
            const registeredPaid = purchasePayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
            const effectivePaid = isCancelled ? 0 : Math.max(legacyPaid, registeredPaid);
            const diff = isCancelled ? 0 : total - effectivePaid;
            const balance = (diff >= 1.0) ? Math.round(diff) : 0;

            detail.push({
                purchase,
                totalPaid: effectivePaid,
                balance,
                payments: purchasePayments
            });
        }

        return detail.sort((a, b) => new Date(b.purchase.date) - new Date(a.purchase.date));
    }

    /**
     * Summary of all supplier debts.
     */
    static async getAccountsPayableSummary() {
        try {
            const now = Date.now();
            if (this._summaryCache && (now - this._lastSummaryTime < this.CACHE_TTL)) {
                return this._summaryCache;
            }

            if (db.mode === 'sqlite') {
                const data = await Purchase.getStatsSummary();
                if (data && data.creditors) {
                    this._summaryCache = data.creditors;
                    this._lastSummaryTime = now;
                    return this._summaryCache;
                }
            }

            const suppliers = await Supplier.getAllIncludingDeleted();
            const allPurchases = await Purchase.getAll();
            const allPayments = await SupplierPayment.getAll();

            const purchasesBySupplier = {};
            for (const p of allPurchases) {
                if (!purchasesBySupplier[p.supplierId]) purchasesBySupplier[p.supplierId] = [];
                purchasesBySupplier[p.supplierId].push(p);
            }

            const paymentsBySupplier = {};
            for (const p of allPayments) {
                if (!paymentsBySupplier[p.supplierId]) paymentsBySupplier[p.supplierId] = [];
                paymentsBySupplier[p.supplierId].push(p);
            }

            const result = [];
            for (const supplier of suppliers) {
                const purchases = purchasesBySupplier[supplier.id] || [];
                if (purchases.length === 0) continue;

                const payments = paymentsBySupplier[supplier.id] || [];
                const purchaseIds = new Set(purchases.map(p => p.id));
                const paymentsByPurchase = {};
                let generalPayments = 0;

                for (const p of payments) {
                    const amt = parseFloat(p.amount) || 0;
                    if (p.purchaseId && purchaseIds.has(p.purchaseId)) {
                        paymentsByPurchase[p.purchaseId] = (paymentsByPurchase[p.purchaseId] || 0) + amt;
                    } else {
                        generalPayments += amt;
                    }
                }

                let totalDebt = 0;
                let totalPurchases = 0;
                let pendingCount = 0;

                for (const p of purchases) {
                    if (p.status === 'cancelled') continue;
                    const total = parseFloat(p.total) || 0;
                    totalPurchases += total;
                    const legacyPaid = parseFloat(p.paidAmount) || 0;
                    const registeredPaid = paymentsByPurchase[p.id] || 0;
                    const diff = total - Math.max(legacyPaid, registeredPaid);
                    // ponytail: Diferencias residuales <= $2 se consideran saldo saldado
                    const balance = (diff > 2.0) ? Math.round(diff) : 0;
                    totalDebt += balance;
                    if (balance > 0) pendingCount++;
                }

                const netDebt = Math.round(totalDebt - generalPayments);
                totalDebt = Math.max(0, netDebt > 2.0 ? netDebt : 0);
                const totalPaid = totalPurchases - totalDebt;

                if (totalDebt > 0) {
                    result.push({
                        supplier,
                        totalPurchases,
                        totalPaid,
                        totalDebt,
                        purchaseCount: purchases.length,
                        pendingCount
                    });
                }
            }

            this._summaryCache = result.sort((a, b) => b.totalDebt - a.totalDebt);
            this._lastSummaryTime = now;
            return this._summaryCache;
        } catch (error) {
            console.error('C6: Error en getAccountsPayableSummary:', error);
            return [];
        }
    }
}
