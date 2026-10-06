/**
 * Customer Credit Deposit - Dinero a favor del cliente
 * Al sumar dinero a favor se registra el método de pago para que cuente en caja
 * (efectivo esperado y método de pago correspondiente).
 */
class CustomerCreditDeposit {
    static _repository = new CustomerCreditDepositRepository();

    /**
     * Create a credit deposit (dinero a favor) - suma a caja por método de pago
     * @param {Object} data - { customerId, amount, paymentMethod, cashRegisterId }
     * @returns {Promise<number>} - ID del registro
     */
    static async create(data) {
        const deposit = {
            customerId: data.customerId,
            amount: parseFloat(data.amount) || 0,
            paymentMethod: data.paymentMethod || 'cash',
            cashRegisterId: data.cashRegisterId,
            date: new Date().toISOString(),
            notes: data.notes || ''
        };
        if (deposit.id !== undefined) delete deposit.id;
        return await this._repository.create(deposit);
    }

    static async getByCashRegister(cashRegisterId) {
        return await this._repository.findByCashRegisterId(cashRegisterId);
    }

    /**
     * Get all credit deposits for a customer (for account movements)
     * @param {number} customerId
     * @returns {Promise<Array>}
     */
    static async getByCustomer(customerId) {
        const list = await this._repository.findByIndex('customerId', customerId);
        return list.sort((a, b) => new Date(b.date) - new Date(a.date));
    }
}
