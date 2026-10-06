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
     * ponytail: La caja más reciente del negocio y de la terminal física actual (PC-1 o PC-2)
     * determina si el turno de esta máquina está abierto o cerrado.
     * @returns {Promise<Object|null>}
     */
    async findOpen() {
        const activeBizId = Number(localStorage.getItem('BUSINESS_ID') || 1);
        const allowMultiple = localStorage.getItem('allowMultipleCashRegisters') === 'true';
        const myTerminal = (typeof SyncService !== 'undefined' && typeof SyncService.getTerminalId === 'function')
            ? SyncService.getTerminalId()
            : (localStorage.getItem('TERMINAL_ID') || 'PC-1');

        try {
            const all = await this.findAll();
            // Filtrar por negocio activo
            const bizRegisters = all.filter(r => (!r.business_id || Number(r.business_id) === activeBizId));
            if (bizRegisters.length === 0) return null;

            if (allowMultiple) {
                // Modo independiente: turno abierto de esta máquina específica
                const terminalRegs = bizRegisters.filter(r => (r.terminal_id && r.terminal_id === myTerminal));
                if (terminalRegs.length > 0 && terminalRegs[0].status === 'open') {
                    return terminalRegs[0];
                }
                return null;
            }

            // Modo por defecto (Caja Compartida del Negocio):
            // Si el turno más reciente del local está abierto, la caja está activa para cobrar
            const mostRecent = bizRegisters[0];
            if (mostRecent && mostRecent.status === 'open') {
                return mostRecent;
            }
            return null;
        } catch (error) {
            console.warn('CashRegisterRepository.findOpen error:', error);
            return null;
        }
    }

    /**
     * Get all registers sorted by date (newest first)
     * @returns {Promise<Array>}
     */
    async findAll() {
        const registers = await super.findAll();
        return registers.sort((a, b) => new Date(b.openDate) - new Date(a.openDate) || (b.id - a.id));
    }
}
