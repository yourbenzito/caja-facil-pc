/**
 * Supplier Repository
 * Handles all database operations for Suppliers
 * C1: findAll() filtra proveedores inactivos (soft-deleted).
 *     Usar findAllIncludingDeleted() para reportes/historiales.
 */
class SupplierRepository extends BaseRepository {
    constructor() {
        super('suppliers');
    }

    /**
     * C1: Override findAll — excluye proveedores inactivos (soft-deleted)
     * @returns {Promise<Array>}
     */
    async findAll() {
        const all = await super.findAll();
        return all.filter(s => s.isActive !== false);
    }

    /**
     * C1: Todos los proveedores incluyendo inactivos (para reportes, historial, backup)
     * @returns {Promise<Array>}
     */
    async findAllIncludingDeleted() {
        return await super.findAll();
    }

    /**
     * C1: Solo proveedores inactivos (soft-deleted)
     * @returns {Promise<Array>}
     */
    async findDeleted() {
        const all = await super.findAll();
        return all.filter(s => s.isActive === false);
    }

    /**
     * Search suppliers by term (name) — solo activos
     * @param {string} term - Search term
     * @returns {Promise<Array>}
     */
    async search(term) {
        const suppliers = await this.findAll();
        const searchTerm = term.toLowerCase();
        return suppliers.filter(s => 
            s.name.toLowerCase().includes(searchTerm)
        );
    }
}
