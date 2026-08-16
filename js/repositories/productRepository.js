/**
 * Product Repository
 * Handles all database operations for Products
 * C1: findAll() filtra productos inactivos (soft-deleted).
 *     Usar findAllIncludingDeleted() para reportes/historiales.
 */
class ProductRepository extends BaseRepository {
    constructor() {
        super('products');
    }

    /**
     * C1: Override findAll — excluye productos inactivos (soft-deleted)
     * @returns {Promise<Array>}
     */
    async findAll() {
        if (db.mode === 'sqlite') return await super.findAll({ isActive: 1 });
        const all = await super.findAll();
        return all.filter(p => p.isActive !== false);
    }

    /**
     * C1: Todos los productos incluyendo inactivos (para reportes, historial, backup)
     * @returns {Promise<Array>}
     */
    async findAllIncludingDeleted() {
        if (db.mode === 'sqlite') return await super.findAll({ isActive_gte: 0 });
        return await super.findAll();
    }

    /**
     * C1: Solo productos inactivos (soft-deleted)
     * @returns {Promise<Array>}
     */
    async findDeleted() {
        if (db.mode === 'sqlite') return await super.findAll({ isActive: 0 });
        const all = await super.findAll();
        return all.filter(p => p.isActive === false);
    }

    /**
     * Find product by barcode (solo activos).
     * C4: Ya usa índice 'barcode'. Corregido para excluir soft-deleted.
     * @param {string} barcode - Barcode
     * @returns {Promise<Object|null>}
     */
    async findByBarcode(barcode) {
        const products = await this.findByIndex('barcode', barcode, { isActive: 1 });
        if (db.mode === 'sqlite') return products.length > 0 ? products[0] : null;
        // C4: Filtrar soft-deleted para no devolver productos desactivados (solo para IndexedDB)
        const active = products.filter(p => p.isActive !== false);
        return active.length > 0 ? active[0] : null;
    }

    /**
     * Find products by category (solo activos)
     * @param {string} category - Category name
     * @returns {Promise<Array>}
     */
    async findByCategory(category) {
        const all = await this.findByIndex('category', category);
        return all.filter(p => p.isActive !== false);
    }

    /**
     * Search products by term (name, barcode, description) — solo activos
     * @param {string} term - Search term
     * @returns {Promise<Array>}
     */
    async search(term) {
        // En modo SQLite, esto irá directo al backend con índices.
        // En modo IndexedDB, hará un filter local.
        return await super.search(term);
    }


    /**
     * Get products with low stock (solo activos)
     * @returns {Promise<Array>}
     */
    async findLowStock() {
        const products = await this.findAll();
        return products.filter(p => {
            const stock = parseFloat(p.stock) ?? 0;
            const minStock = p.minStock != null && p.minStock !== '' ? parseFloat(p.minStock) : 0;
            return stock <= minStock;
        });
    }

    /**
     * Find products by their last supplier (solo activos)
     * @param {number} supplierId - Supplier ID
     * @returns {Promise<Array>}
     */
    async findByLastSupplier(supplierId) {
        return await this.findByIndex('lastSupplierId', supplierId);
    }
}
