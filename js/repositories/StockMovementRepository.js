/**
 * Stock Movement Repository
 * Handles all database operations for Stock Movements
 */
class StockMovementRepository extends BaseRepository {
    constructor() {
        super('stockMovements');
    }

    /**
     * Get movements by product ID
     * @param {number} productId - Product ID
     * @returns {Promise<Array>}
     */
    async findByProductId(productId) {
        return await this.findByIndex('productId', productId);
    }

    /**
     * Get movements by type
     * @param {string} type - Movement type (sale, purchase, adjustment, loss, consumption)
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
        const start = new Date(startDate).toISOString();
        const end = new Date(endDate).toISOString();
        const movements = await this.findByIndexRange('date', start, end);
        if (!movements) return [];
        return movements.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    /**
     * Get all movements sorted by date (newest first)
     * @returns {Promise<Array>}
     */
    async findAll() {
        const movements = await super.findAll();
        if (!movements) return [];
        return movements.sort((a, b) => new Date(b.date) - new Date(a.date));
    }
}
