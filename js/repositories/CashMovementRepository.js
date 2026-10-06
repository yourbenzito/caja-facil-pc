/**
 * Cash Movement Repository
 * Handles all database operations for Cash Movements
 */
class CashMovementRepository extends BaseRepository {
    constructor() {
        super('cashMovements');
    }

    /**
     * Get movements by cash register ID
     * @param {number} cashRegisterId - Cash register ID
     * @returns {Promise<Array>}
     */
    async findByCashRegisterId(cashRegisterId) {
        return await this.findByIndex('cashRegisterId', cashRegisterId);
    }

    /**
     * Get movements by type
     * @param {string} type - Movement type (in, out)
     * @returns {Promise<Array>}
     */
    async findByType(type) {
        return await this.findByIndex('type', type);
    }

    /**
     * Get movements by date range
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Promise<Array>}
     */
    async findByDateRange(startDate, endDate) {
        const movements = await this.findAll();
        return movements.filter(m => {
            const mDate = new Date(m.date);
            return mDate >= new Date(startDate) && mDate <= new Date(endDate);
        });
    }

    async findByPaymentId(paymentId) {
        const all = await super.findAll();
        return all.filter(m => m.paymentId == paymentId);
    }

    async findByExpenseId(expenseId) {
        const all = await super.findAll();
        return all.filter(m => m.expenseId == expenseId);
    }

    async findBySaleId(saleId) {
        const all = await super.findAll();
        return all.filter(m => m.saleId == saleId || (m.description && String(m.description).includes(`Venta #${saleId}`)));
    }

    /**
     * Get all movements sorted by date (newest first)
     * @returns {Promise<Array>}
     */
    async findAll() {
        const movements = await super.findAll();
        return movements.sort((a, b) => new Date(b.date) - new Date(a.date));
    }
}
