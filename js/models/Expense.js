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

        // Obtener usuario activo para trazabilidad y auditoría
        let activeUserId = data.userId ? parseInt(data.userId) : null;
        let activeUserName = data.userName || null;
        try {
            if (!activeUserId && typeof AuthManager !== 'undefined' && typeof AuthManager.getCurrentUser === 'function') {
                const u = AuthManager.getCurrentUser();
                if (u) {
                    activeUserId = u.id || u.userId || null;
                    activeUserName = u.name || u.userName || u.username || null;
                }
            }
            if (!activeUserId) {
                const stored = JSON.parse(localStorage.getItem('currentUser') || 'null');
                if (stored) {
                    activeUserId = stored.id || stored.userId || null;
                    activeUserName = stored.name || stored.userName || stored.username || null;
                }
            }
        } catch (_) {}

        const terminalId = localStorage.getItem('pos_terminal_id') || localStorage.getItem('terminal_id') || 'PC-1';
        const uuid = 'exp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        const expense = {
            category: data.category || 'otros',
            amount: amount,
            description: data.description.trim(),
            date: data.date || new Date().toISOString(),
            documentType: data.documentType || 'comprobante_interno',
            documentNumber: data.documentNumber || '',
            paymentMethod: data.paymentMethod || 'cash',
            supplierId: data.supplierId ? parseInt(data.supplierId) : null,
            userId: activeUserId,
            userName: activeUserName,
            productId: data.productId ? parseInt(data.productId) : null,
            productName: data.productName || null,
            quantity: data.quantity ? parseFloat(data.quantity) : null,
            cost_value: data.cost_value ? parseFloat(data.cost_value) : null,
            sale_value: data.sale_value ? parseFloat(data.sale_value) : null,
            attachmentPath: data.attachmentPath || '',
            cashRegisterId: data.cashRegisterId ? parseInt(data.cashRegisterId) : null,
            uuid: uuid,
            terminal_id: terminalId,
            is_synced: 0
        };

        const result = await this._repository.create(expense);
        if (typeof SyncService !== 'undefined' && typeof SyncService.triggerAutoSync === 'function') {
            SyncService.triggerAutoSync(1000);
        }
        return result;
    }

    /**
     * Get all expenses
     * @returns {Promise<Array>}
     */
    static async getByCashRegister(cashRegisterId) {
        const all = await this.getAll();
        if (!Array.isArray(all)) return [];
        return all.filter(e => e.cashRegisterId === cashRegisterId || Number(e.cashRegisterId) === Number(cashRegisterId));
    }

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
        const toDateStr = (val) => {
            if (!val) return '';
            if (val instanceof Date) {
                const y = val.getFullYear();
                const m = String(val.getMonth() + 1).padStart(2, '0');
                const d = String(val.getDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
            }
            return String(val).slice(0, 10);
        };
        const startStr = toDateStr(startDate);
        const endStr = toDateStr(endDate);
        return all.filter(e => {
            const d = e.date;
            if (!d) return false;
            const dateStr = toDateStr(d);
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
