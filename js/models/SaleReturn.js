/**
 * C5: Sale Return Model
 * Representa una devolución de venta. Los registros son INMUTABLES.
 * NO se modifican ventas existentes — la devolución es un evento nuevo.
 */
class SaleReturn {
    static _repository = new SaleReturnRepository();

    /**
     * Create a sale return record.
     * @param {Object} data - Return data
     * @returns {Promise<number>} - Return ID
     */
    static async create(data) {
        const record = {
            saleId: data.saleId,
            saleNumber: data.saleNumber || null,
            date: new Date().toISOString(),
            items: Array.isArray(data.items) ? data.items : [],
            totalReturned: parseFloat(data.totalReturned) || 0,
            reason: data.reason || '',
            createdAt: new Date().toISOString(),
            createdBy: AuditLogService.getCurrentUserId()
        };

        const id = await this._repository.create(record);

        // C2: Audit log
        AuditLogService.log({
            entity: 'saleReturn', entityId: id, action: 'create',
            summary: `Devolución creada para Venta #${data.saleNumber || data.saleId} — Total: ${record.totalReturned}`,
            metadata: {
                saleId: data.saleId,
                saleNumber: data.saleNumber,
                totalReturned: record.totalReturned,
                reason: record.reason,
                itemCount: record.items.length
            }
        });

        return id;
    }

    static async getById(id) {
        return await this._repository.findById(id);
    }

    static async getAll() {
        return await this._repository.findAll();
    }

    /**
     * Get all returns for a specific sale.
     * @param {number} saleId
     * @returns {Promise<Array>}
     */
    static async getBySale(saleId) {
        return await this._repository.findBySaleId(saleId);
    }

    /**
     * Get returns within a date range.
     * @param {Date|string} startDate
     * @param {Date|string} endDate
     * @returns {Promise<Array>}
     */
    static async getByDateRange(startDate, endDate) {
        return await this._repository.findByDateRange(startDate, endDate);
    }

    /**
     * Calculate total quantity already returned for each product in a sale.
     * @param {number} saleId
     * @returns {Promise<Object>} - { productId: totalQtyReturned }
     */
    static async getReturnedQuantitiesBySale(saleId) {
        const returns = await this.getBySale(saleId);
        const qtyByProduct = {};
        for (const ret of returns) {
            for (const item of (ret.items || [])) {
                const pid = Number(item.productId);
                if (!qtyByProduct[pid]) qtyByProduct[pid] = 0;
                qtyByProduct[pid] += parseFloat(item.quantity) || 0;
            }
        }
        return qtyByProduct;
    }
}
