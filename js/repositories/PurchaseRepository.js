/**
 * Purchase Repository
 * Handles all database operations for Purchases
 */
class PurchaseRepository extends BaseRepository {
    constructor() {
        super('purchases');
    }

    /**
     * Get purchases by supplier ID
     * @param {number} supplierId - Supplier ID
     * @returns {Promise<Array>}
     */
    async findBySupplierId(supplierId, params = {}) {
        return await this.findByIndex('supplierId', supplierId, params);
    }

    /**
     * Get all purchases sorted by date (newest first)
     * @returns {Promise<Array>}
     */
    async findAll(params = {}) {
        const purchases = await super.findAll(params);
        // El servidor ya debería devolverlos ordenados si es SQLite, 
        // pero mantenemos el sort por seguridad y para el modo IndexedDB.
        return purchases.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    /**
     * Get pending purchases
     * @returns {Promise<Array>}
     */
    async findPending() {
        const purchases = await this.findAll();
        return purchases.filter(p => p.status === 'pending');
    }

    /**
     * Get purchases by date range using 'date' index
     * @param {Date|string} startDate - Start date
     * @param {Date|string} endDate - End date
     * @returns {Promise<Array>}
     */
    async findByDateRange(startDate, endDate, params = {}) {
        const dStart = new Date(startDate);
        const dEnd = new Date(endDate);
        
        if (isNaN(dStart.getTime()) || isNaN(dEnd.getTime())) {
            console.warn('PurchaseRepository: Invalid dates provided', { startDate, endDate });
            return [];
        }

        try {
            const start = dStart.toISOString();
            const end = dEnd.toISOString();
            return await this.findByIndexRange('date', start, end, params);
        } catch (indexError) {
            console.warn('PurchaseRepository.findByDateRange: index range fallback', indexError);
            const purchases = await super.findAll(params);
            return purchases.filter(p => {
                const pDate = new Date(p.date);
                return pDate >= new Date(startDate) && pDate <= new Date(endDate);
            });
        }
    }
}
