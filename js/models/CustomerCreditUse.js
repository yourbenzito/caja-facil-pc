/**
 * Customer Credit Use - Registro cuando el cliente usa su saldo a favor en una venta
 */
class CustomerCreditUse {
    static _repository = new CustomerCreditUseRepository();

    /**
     * Create a credit use record (uso de dinero a favor en venta)
     * @param {Object} data - { customerId, amount, saleId, saleNumber (opcional) }
     * @returns {Promise<number>} - ID del registro
     */
    static async create(data) {
        const record = {
            customerId: data.customerId,
            amount: parseFloat(data.amount) || 0,
            saleId: data.saleId,
            saleNumber: data.saleNumber != null ? data.saleNumber : null,
            date: new Date().toISOString()
        };
        if (record.id !== undefined) delete record.id;
        return await this._repository.create(record);
    }

    /**
     * Get all credit uses for a customer (for account movements)
     * @param {number} customerId
     * @returns {Promise<Array>}
     */
    static async getByCustomer(customerId) {
        const list = await this._repository.findByCustomerId(customerId);
        return list.sort((a, b) => new Date(b.date) - new Date(a.date));
    }
}
