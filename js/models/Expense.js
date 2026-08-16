/**
 * Expense Model
 * Handles business logic, validations, and database CRUD operations for Expenses
 */
class Expense {
    static _repository = new ExpenseRepository();

    /**
     * Create a new expense record
     * @param {Object} data - Expense data
     * @returns {Promise<number>} - Auto-generated ID of the new expense
     */
    static async create(data) {
        const amount = parseFloat(data.amount);
        if (isNaN(amount) || amount <= 0) {
            throw new Error('El monto del gasto debe ser un número positivo');
        }
        if (!data.description || data.description.trim() === '') {
            throw new Error('La descripción del gasto es obligatoria');
        }

        const expense = {
            category: data.category || 'otros',
            amount: amount,
            description: data.description.trim(),
            date: data.date || new Date().toISOString(),
            documentType: data.documentType || 'comprobante_interno',
            documentNumber: data.documentNumber || '',
            paymentMethod: data.paymentMethod || 'cash',
            supplierId: data.supplierId ? parseInt(data.supplierId) : null,
            userId: data.userId ? parseInt(data.userId) : null,
            attachmentPath: data.attachmentPath || '',
            cashRegisterId: data.cashRegisterId ? parseInt(data.cashRegisterId) : null,
            is_synced: 0
        };

        return await this._repository.create(expense);
    }

    /**
     * Get all expenses
     * @returns {Promise<Array>}
     */
    static async getAll() {
        return await this._repository.findAll();
    }

    /**
     * Find expense by ID
     * @param {number} id
     * @returns {Promise<Object|null>}
     */
    static async getById(id) {
        return await this._repository.findById(id);
    }

    /**
     * Get expenses in date range
     * @param {string} startDate - Start date (YYYY-MM-DD)
     * @param {string} endDate - End date (YYYY-MM-DD)
     * @returns {Promise<Array>}
     */
    static async getByDateRange(startDate, endDate) {
        const all = await this.getAll();
        return all.filter(e => {
            const d = e.date;
            if (!d) return false;
            const dateStr = d.slice(0, 10);
            const startStr = startDate.slice(0, 10);
            const endStr = endDate.slice(0, 10);
            return dateStr >= startStr && dateStr <= endStr;
        });
    }

    /**
     * Update an expense
     * @param {number} id
     * @param {Object} data
     * @returns {Promise<void>}
     */
    static async update(id, data) {
        return await this._repository.update(id, data);
    }

    /**
     * Delete an expense
     * @param {number} id
     * @returns {Promise<void>}
     */
    static async delete(id) {
        return await this._repository.delete(id);
    }
}
