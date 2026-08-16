/**
 * C5: Sale Return Repository
 * Handles all database operations for Sale Returns (devoluciones).
 * Los registros de devolución son INMUTABLES — no se editan ni eliminan.
 */
class SaleReturnRepository extends BaseRepository {
    constructor() {
        super('saleReturns');
    }

    /**
     * Find returns by sale ID using index.
     * @param {number} saleId - Sale ID
     * @returns {Promise<Array>}
     */
    async findBySaleId(saleId) {
        try {
            return await this.findByIndex('saleId', saleId);
        } catch (indexError) {
            console.warn('SaleReturnRepository.findBySaleId: index fallback', indexError);
            const all = await this.findAll();
            return all.filter(r => r.saleId === saleId);
        }
    }

    /**
     * Find returns by date range using index.
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
            console.warn('SaleReturnRepository.findByDateRange: index fallback', indexError);
            const all = await this.findAll();
            return all.filter(r => {
                const rDate = new Date(r.date);
                return rDate >= new Date(startDate) && rDate <= new Date(endDate);
            });
        }
    }
}
