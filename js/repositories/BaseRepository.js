/**
 * Base Repository Pattern Implementation
 * Provides common database operations for all repositories
 */
class BaseRepository {
    constructor(storeName) {
        this.storeName = storeName;
    }

    /**
     * Create a new record
     * CRITICAL: Always inserts as a new row, never uses INSERT OR REPLACE
     * IDs are auto-generated and never reused
     * 
     * @param {Object} data - Data to create (MUST NOT include id field)
     * @returns {Promise<number>} - Auto-generated ID of created record
     */
    async create(data) {
        // CRITICAL: Remove id if present to prevent ID reuse
        // Auto-increment will generate a new unique ID
        const cleanData = { ...data };
        if (cleanData.id !== undefined) {
            console.warn(`⚠️ Warning: Attempted to create ${this.storeName} with explicit id=${cleanData.id}. ID removed - will use auto-increment.`);
            delete cleanData.id;
        }
        
        // CRITICAL: Use db.add() which ALWAYS inserts as new row
        // db.add() throws error if ID exists (prevents overwriting)
        // This ensures each record is a unique new row
        return await db.add(this.storeName, cleanData);
    }

    /**
     * Update an existing record
     * @param {number} id - Record ID
     * @param {Object} data - Data to update (will be merged with existing)
     * @returns {Promise<void>}
     */
    async update(id, data) {
        const existing = await this.findById(id);
        if (!existing) {
            throw new Error(`${this.storeName} no encontrado con ID ${id}`);
        }
        
        const updated = {
            ...existing,
            ...data,
            updatedAt: new Date().toISOString()
        };
        
        return await db.put(this.storeName, updated);
    }

    /**
     * Replace an entire record (UPDATE existing record)
     * CRITICAL: This uses PUT (INSERT OR REPLACE) but ONLY for existing records
     * NEVER use this for creating new records - use create() instead
     * 
     * @param {Object} data - Complete record with id (MUST have id)
     * @returns {Promise<void>}
     */
    async replace(data) {
        if (!data.id) {
            throw new Error(`${this.storeName} debe incluir id para replace. Use create() para crear nuevos registros.`);
        }
        
        // CRITICAL: Verify record exists before replacing
        const existing = await this.findById(data.id);
        if (!existing) {
            throw new Error(`${this.storeName} con ID ${data.id} no existe. Use create() para crear nuevos registros.`);
        }
        
        // CRITICAL: Use db.put() which is INSERT OR REPLACE
        // This is safe here because we verified the record exists
        // IndexedDB put() will update existing record by ID
        return await db.put(this.storeName, data);
    }

    /**
     * Find a record by ID
     * @param {number} id - Record ID
     * @returns {Promise<Object|null>}
     */
    async findById(id) {
        return await db.get(this.storeName, id);
    }

    /**
     * Get all records
     * @param {Object} params - Query parameters (limit, offset, filters)
     * @returns {Promise<Array>}
     */
    async findAll(params = {}) {
        const results = await db.getAll(this.storeName, params);
        return Array.isArray(results) ? results : [];
    }

    /**
     * Find records by index
     * @param {string} indexName - Index name
     * @param {*} value - Value to search
     * @param {Object} params - Additional query parameters
     * @returns {Promise<Array>}
     */
    async findByIndex(indexName, value, params = {}) {
        const results = await db.getByIndex(this.storeName, indexName, value, params);
        return Array.isArray(results) ? results : [];
    }

    /**
     * C4: Find records by index within a key range (uses IDBKeyRange — no full scan).
     * @param {string} indexName - Index name
     * @param {*} lower - Lower bound (inclusive)
     * @param {*} upper - Upper bound (inclusive)
     * @param {Object} params - Additional query parameters
     * @returns {Promise<Array>}
     */
    async findByIndexRange(indexName, lower, upper, params = {}) {
        const results = await db.getByIndexRange(this.storeName, indexName, lower, upper, params);
        return Array.isArray(results) ? results : [];
    }

    /**
     * Delete a record
     * @param {number} id - Record ID
     * @returns {Promise<void>}
     */
    async delete(id) {
        return await db.delete(this.storeName, id);
    }

    /**
     * Query records with a filter function
     * @param {Function} filterFn - Filter function
     * @returns {Promise<Array>}
     */
    async query(filterFn) {
        return await db.query(this.storeName, filterFn);
    }

    async search(term) {
        return await db.search(this.storeName, term);
    }


    /**
     * Count records
     * @returns {Promise<number>}
     */
    async count() {
        return await db.count(this.storeName);
    }

    /**
     * Clear all records (use with caution)
     * @returns {Promise<void>}
     */
    async clear() {
        return await db.clear(this.storeName);
    }
}
