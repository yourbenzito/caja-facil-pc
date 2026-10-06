/**
 * Customer Credit Deposit Repository
 * Depósitos de dinero a favor del cliente (se suman a caja por método de pago)
 */
class CustomerCreditDepositRepository extends BaseRepository {
    constructor() {
        super('customerCreditDeposits');
    }

    /**
     * Get deposits by cash register ID (para resumen de caja por método de pago)
     * @param {number} cashRegisterId
     * @returns {Promise<Array>}
     */
    async findByCashRegisterId(cashRegisterId) {
        return await this.findByIndex('cashRegisterId', cashRegisterId);
    }
}
