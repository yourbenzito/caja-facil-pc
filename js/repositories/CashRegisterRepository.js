/**
 * Cash Register Repository
 * Handles all database operations for Cash Registers
 */
class CashRegisterRepository extends BaseRepository {
    constructor() {
        super('cashRegisters');
    }

    /**
     * Get open cash register
     * @returns {Promise<Object|null>}
     */
    async findOpen() {
        try {
            const registers = await this.findByIndex('status', 'open');
            if (registers.length > 0) {
                return registers[0];
            }
        } catch (error) {
            console.warn('CashRegisterRepository.findOpen: no se pudo usar el índice status, se recorre manualmente', error);
        }

        const all = await this.findAll();
        return all.find(register => register.status === 'open') || null;
    }

    /**
     * Get all registers sorted by date (newest first)
     * @returns {Promise<Array>}
     */
    async findAll() {
        const registers = await super.findAll();
        return registers.sort((a, b) => new Date(b.openDate) - new Date(a.openDate));
    }
}
