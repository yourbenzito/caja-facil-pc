/**
 * Customer Repository
 * Handles all database operations for Customers
 * C1: findAll() filtra clientes inactivos (soft-deleted).
 *     Usar findAllIncludingDeleted() para reportes/historiales.
 */
class CustomerRepository extends BaseRepository {
    constructor() {
        super('customers');
    }

    /**
     * C1: Override findAll — excluye clientes inactivos (soft-deleted)
     * @returns {Promise<Array>}
     */
    async findAll() {
        const all = await super.findAll();
        return all.filter(c => c.isActive !== false);
    }

    /**
     * C1: Todos los clientes incluyendo inactivos (para reportes, historial, backup)
     * @returns {Promise<Array>}
     */
    async findAllIncludingDeleted() {
        return await super.findAll();
    }

    /**
     * C1: Solo clientes inactivos (soft-deleted)
     * @returns {Promise<Array>}
     */
    async findDeleted() {
        const all = await super.findAll();
        return all.filter(c => c.isActive === false);
    }

    /**
     * Search customers by term (name, phone, email) — solo activos
     * @param {string} term - Search term
     * @returns {Promise<Array>}
     */
    async search(term) {
        if (db.mode === 'sqlite') return await super.search(term);
        const customers = await this.findAll();
        const searchTerm = term.toLowerCase();
        return customers.filter(c => 
            c.name.toLowerCase().includes(searchTerm) ||
            (c.rut && c.rut.toLowerCase().includes(searchTerm)) ||
            (c.phone && c.phone.includes(searchTerm)) ||
            (c.email && c.email.toLowerCase().includes(searchTerm))
        );
    }
}
