/**
 * Customer Credit Use Repository
 * Registro de usos de saldo a favor del cliente (cuando paga una venta con su crédito)
 */
class CustomerCreditUseRepository extends BaseRepository {
    constructor() {
        super('customerCreditUses');
    }

    /**
     * Get uses by customer ID
     * @param {number} customerId
     * @returns {Promise<Array>}
     */
    async findByCustomerId(customerId) {
        return await this.findByIndex('customerId', customerId);
    }
}
