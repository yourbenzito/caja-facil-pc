/**
 * C7: Product Price History Repository
 * Handles all database operations for Product Price History.
 * Los registros son INMUTABLES — no se editan ni eliminan.
 */
class ProductPriceHistoryRepository extends BaseRepository {
    constructor() {
        super('productPriceHistory');
    }

    /**
     * Find price changes by product ID using index.
     * @param {number} productId
     * @returns {Promise<Array>} sorted newest first
     */
    async findByProductId(productId) {
        try {
            const results = await this.findByIndex('productId', productId);
            return results.sort((a, b) => new Date(b.date) - new Date(a.date));
        } catch (indexError) {
            console.warn('ProductPriceHistoryRepository.findByProductId: index fallback', indexError);
            const all = await this.findAll();
            return all.filter(r => r.productId === productId)
                .sort((a, b) => new Date(b.date) - new Date(a.date));
        }
    }

    /**
     * Find price changes by date range using index.
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
            console.warn('ProductPriceHistoryRepository.findByDateRange: index fallback', indexError);
            const all = await this.findAll();
            return all.filter(r => {
                const d = new Date(r.date);
                return d >= new Date(startDate) && d <= new Date(endDate);
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
