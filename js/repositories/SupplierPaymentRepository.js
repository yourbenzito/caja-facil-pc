/**
 * C6: Supplier Payment Repository
 * Handles all database operations for Supplier Payments.
 * Los registros de pago son INMUTABLES — no se editan ni eliminan.
 */
class SupplierPaymentRepository extends BaseRepository {
    constructor() {
        super('supplierPayments');
    }

    /**
     * Find payments by supplier ID using index.
     * @param {number} supplierId
     * @returns {Promise<Array>}
     */
    async findBySupplierId(supplierId) {
        try {
            const results = await this.findByIndex('supplierId', supplierId);
            return results.sort((a, b) => new Date(b.date) - new Date(a.date));
        } catch (indexError) {
            console.warn('SupplierPaymentRepository.findBySupplierId: index fallback', indexError);
            const all = await this.findAll();
            return all.filter(p => p.supplierId === supplierId)
                .sort((a, b) => new Date(b.date) - new Date(a.date));
        }
    }

    /**
     * Find payments by purchase ID using index.
     * @param {number} purchaseId
     * @returns {Promise<Array>}
     */
    async findByPurchaseId(purchaseId) {
        try {
            return await this.findByIndex('purchaseId', purchaseId);
        } catch (indexError) {
            console.warn('SupplierPaymentRepository.findByPurchaseId: index fallback', indexError);
            const all = await this.findAll();
            return all.filter(p => p.purchaseId === purchaseId);
        }
    }

    /**
     * Find payments by date range using index.
     * @param {Date|string} startDate
     * @param {Date|string} endDate
     * @returns {Promise<Array>}
     */
    async findByDateRange(startDate, endDate) {
        try {
            const start = new Date(startDate).toISOString();
            const end = new Date(endDate).toISOString();
            return await this.findByIndexRange('date', start, end);
        } catch (indexError) {
            console.warn('SupplierPaymentRepository.findByDateRange: index fallback', indexError);
            const all = await this.findAll();
            return all.filter(p => {
                const pDate = new Date(p.date);
                return pDate >= new Date(startDate) && pDate <= new Date(endDate);
            });
        }
    }

    /**
     * Override findAll to sort newest first.
     * @returns {Promise<Array>}
     */
    async findAll() {
        const all = await super.findAll();
        return all.sort((a, b) => new Date(b.date) - new Date(a.date));
    }
}
