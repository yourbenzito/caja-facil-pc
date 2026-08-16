/**
 * C7: Product Price History Model
 * Registra cada cambio de precio de venta como un evento inmutable.
 * NO se editan ni eliminan registros.
 */
class ProductPriceHistory {
    static _repository = new ProductPriceHistoryRepository();

    /**
     * Record a price change event.
     * @param {Object} data - { productId, oldPrice, newPrice, reason }
     * @returns {Promise<number>} - Record ID
     */
    static async create(data) {
        const record = {
            productId: data.productId,
            oldPrice: parseFloat(data.oldPrice) || 0,
            newPrice: parseFloat(data.newPrice) || 0,
            changePercent: data.oldPrice > 0
                ? Math.round(((data.newPrice - data.oldPrice) / data.oldPrice) * 10000) / 100
                : null,
            date: new Date().toISOString(),
            reason: data.reason || '',
            createdAt: new Date().toISOString(),
            createdBy: AuditLogService.getCurrentUserId()
        };

        const id = await this._repository.create(record);

        // C2: Audit log (non-blocking)
        AuditLogService.log({
            entity: 'productPriceHistory', entityId: id, action: 'create',
            summary: `Cambio de precio — Producto #${data.productId}: ${record.oldPrice} → ${record.newPrice} (${record.reason || 'sin razón'})`,
            metadata: {
                productId: data.productId,
                oldPrice: record.oldPrice,
                newPrice: record.newPrice,
                changePercent: record.changePercent,
                reason: record.reason
            }
        });

        return id;
    }

    /**
     * Record a price change ONLY if the price actually changed.
     * Utility method used from hooks to avoid noise.
     * @param {number} productId
     * @param {number} oldPrice
     * @param {number} newPrice
     * @param {string} reason
     * @returns {Promise<number|null>} Record ID or null if no change
     */
    static async recordIfChanged(productId, oldPrice, newPrice, reason) {
        const old = parseFloat(oldPrice) || 0;
        const nw = parseFloat(newPrice) || 0;

        // Solo registrar si hay un cambio real (tolerancia de 0.01)
        if (Math.abs(old - nw) < 0.01) return null;

        return await this.create({ productId, oldPrice: old, newPrice: nw, reason });
    }

    static async getById(id) {
        return await this._repository.findById(id);
    }

    static async getAll() {
        return await this._repository.findAll();
    }

    /**
     * Get all price changes for a product.
     * @param {number} productId
     * @returns {Promise<Array>}
     */
    static async getByProduct(productId) {
        return await this._repository.findByProductId(productId);
    }

    /**
     * Get price changes in a date range.
     * @param {Date|string} startDate
     * @param {Date|string} endDate
     * @returns {Promise<Array>}
     */
    static async getByDateRange(startDate, endDate) {
        return await this._repository.findByDateRange(startDate, endDate);
    }

    /**
     * Get the latest price change for a product.
     * @param {number} productId
     * @returns {Promise<Object|null>}
     */
    static async getLatestByProduct(productId) {
        const records = await this.getByProduct(productId);
        return records.length > 0 ? records[0] : null;
    }

    /**
     * Get count of price changes for a product.
     * @param {number} productId
     * @returns {Promise<number>}
     */
    static async getChangeCount(productId) {
        const records = await this.getByProduct(productId);
        return records.length;
    }
}
