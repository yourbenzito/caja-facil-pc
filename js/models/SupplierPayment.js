/**
 * C6: Supplier Payment Model
 * Representa un pago a proveedor. Los registros son INMUTABLES.
 * Separación contable: compra (obligación) vs pago (evento de caja).
 */
class SupplierPayment {
    static _repository = new SupplierPaymentRepository();

    /**
     * Create a supplier payment record.
     * @param {Object} data - Payment data
     * @returns {Promise<number>} - Payment ID
     */
    static async create(data) {
        const record = {
            supplierId: data.supplierId,
            purchaseId: data.purchaseId || null,
            date: data.date || new Date().toISOString(),
            amount: parseFloat(data.amount) || 0,
            method: data.method || 'cash',
            reference: data.reference || '',
            notes: data.notes || '',
            createdAt: new Date().toISOString(),
            createdBy: AuditLogService.getCurrentUserId()
        };

        const id = await this._repository.create(record);

        // C2: Audit log
        let supplierName = `#${data.supplierId}`;
        try {
            if (typeof Supplier !== 'undefined' && Supplier.getById) {
                const s = await Supplier.getById(data.supplierId);
                if (s && s.name) supplierName = s.name;
            }
        } catch (_) {}

        const methodMap = {
            cash: 'Efectivo',
            efectivo: 'Efectivo',
            card: 'Tarjeta Débito/Crédito',
            tarjeta: 'Tarjeta Débito/Crédito',
            transfer: 'Transferencia Bancaria',
            transferencia: 'Transferencia Bancaria',
            credit: 'Crédito',
            otro: 'Otro Medio'
        };
        const methodDisplay = methodMap[(record.method || '').toLowerCase()] || record.method || 'Efectivo';
        const formattedAmount = (typeof record.amount === 'number' || !isNaN(record.amount)) ? `$${Math.round(record.amount).toLocaleString('es-CL')}` : `$${record.amount}`;
        const purchaseInfo = data.purchaseId ? ` (Compra #${data.purchaseId})` : '';

        AuditLogService.log({
            entity: 'supplierPayment', 
            entityId: id, 
            action: 'create',
            summary: `Pago a proveedor ${supplierName} por ${formattedAmount} en ${methodDisplay}${purchaseInfo}`,
            metadata: {
                supplierId: data.supplierId,
                supplierName: supplierName,
                purchaseId: data.purchaseId || null,
                amount: record.amount,
                method: methodDisplay,
                reference: record.reference
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
     * Get all payments for a specific supplier.
     * @param {number} supplierId
     * @returns {Promise<Array>}
     */
    static async getBySupplier(supplierId) {
        return await this._repository.findBySupplierId(supplierId);
    }

    /**
     * Get all payments for a specific purchase.
     * @param {number} purchaseId
     * @returns {Promise<Array>}
     */
    static async getByPurchase(purchaseId) {
        return await this._repository.findByPurchaseId(purchaseId);
    }

    /**
     * Get payments within a date range.
     * @param {Date|string} startDate
     * @param {Date|string} endDate
     * @returns {Promise<Array>}
     */
    static async getByDateRange(startDate, endDate) {
        return await this._repository.findByDateRange(startDate, endDate);
    }

    /**
     * Get total amount paid to a supplier.
     * @param {number} supplierId
     * @returns {Promise<number>}
     */
    static async getTotalPaidToSupplier(supplierId) {
        const payments = await this.getBySupplier(supplierId);
        return payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    }

    /**
     * Get total amount paid for a specific purchase.
     * @param {number} purchaseId
     * @returns {Promise<number>}
     */
    static async getTotalPaidForPurchase(purchaseId) {
        const payments = await this.getByPurchase(purchaseId);
        return payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    }
}
