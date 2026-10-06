/**
 * Payment Repository
 * Handles all database operations for Payments
 */
class PaymentRepository extends BaseRepository {
    constructor() {
        super('payments');
    }

    /**
     * Get payments by sale ID
     * @param {number} saleId - Sale ID
     * @returns {Promise<Array>}
     */
    async findBySaleId(saleId) {
        return await this.findByIndex('saleId', saleId);
    }

    /**
     * Get payments by customer ID
     * CRITICAL: Always fetches FRESH data from database (never uses cached values)
     * Uses index for performance but ensures data freshness
     * 
     * @param {number} customerId - Customer ID
     * @returns {Promise<Array>} - All payments for the customer (fresh from database, sorted by date newest first)
     */
    async findByCustomerId(customerId) {
        if (!customerId) {
            return [];
        }
        
        // Ensure customerId is a number
        const numericCustomerId = typeof customerId === 'string' ? parseInt(customerId, 10) : customerId;
        if (isNaN(numericCustomerId)) {
            console.error('Invalid customerId type:', customerId);
            return [];
        }
        
        try {
            // CRITICAL: Get payments from database using index (fresh, not cached)
            // IndexedDB queries always fetch fresh data from the database
            const payments = await this.findByIndex('customerId', numericCustomerId) || [];
            
            // CRITICAL: Sort by date (newest first) to show most recent payments first
            return payments.sort((a, b) => {
                const dateA = new Date(a.date || 0);
                const dateB = new Date(b.date || 0);
                return dateB - dateA; // Newest first
            });
        } catch (error) {
            console.error('Error getting payments by customer:', error);
            // Fallback: try getting all and filtering (less efficient but more robust)
            try {
                const allPayments = await this.findAll();
                const filtered = allPayments.filter(payment => {
                    if (!payment || payment.customerId === null || payment.customerId === undefined) {
                        return false;
                    }
                    const paymentCustomerId = typeof payment.customerId === 'string'
                        ? parseInt(payment.customerId, 10)
                        : payment.customerId;
                    return paymentCustomerId === numericCustomerId;
                });
                return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
            } catch (fallbackError) {
                console.error('Fallback query also failed:', fallbackError);
                return [];
            }
        }
    }

    /**
     * Get payments by cash register ID
     * @param {number} cashRegisterId - Cash register ID
     * @returns {Promise<Array>}
     */
    async findByCashRegisterId(cashRegisterId) {
        return await this.findByIndex('cashRegisterId', cashRegisterId);
    }

    /**
     * C4: Get payments by date range using index 'date' with IDBKeyRange.
     * @param {Date|string} startDate - Start date
     * @param {Date|string} endDate - End date
     * @returns {Promise<Array>} - Payments within range, sorted newest first
     */
    async findByDateRange(startDate, endDate) {
        try {
            // C4: Usar índice 'date' con IDBKeyRange — O(k) en vez de full scan O(n)
            const start = new Date(startDate).toISOString();
            const end = new Date(endDate).toISOString();
            const results = await this.findByIndexRange('date', start, end);
            return results.sort((a, b) => new Date(b.date) - new Date(a.date));
        } catch (indexError) {
            // C4: Fallback seguro — full scan con filtro manual
            console.warn('PaymentRepository.findByDateRange: index range fallback', indexError);
            const payments = await super.findAll();
            return payments.filter(p => {
                const pDate = new Date(p.date);
                return pDate >= new Date(startDate) && pDate <= new Date(endDate);
            }).sort((a, b) => new Date(b.date) - new Date(a.date));
        }
    }

    /**
     * Get all payments sorted by date (newest first)
     * @returns {Promise<Array>}
     */
    async findAll() {
        const payments = await super.findAll();
        return payments.sort((a, b) => new Date(b.date) - new Date(a.date));
    }
}
