class CustomerController {
    static async loadCustomers() {
        return await Customer.getAll();
    }

    static async saveCustomer(data) {
        if (!data.name) {
            throw new Error('El nombre es requerido');
        }
        
        if (data.id) {
            // C8: Permiso para editar cliente
            PermissionService.require('customers.edit', 'editar clientes');
            await Customer.update(data.id, data);
            showNotification('Cliente actualizado', 'success');
        } else {
            // C8: Permiso para crear cliente (cajeros también pueden)
            PermissionService.require('customers.create', 'crear clientes');
            await Customer.create(data);
            showNotification('Cliente creado', 'success');
        }
    }

    static async deleteCustomer(id) {
        // C8: Permiso para desactivar cliente
        PermissionService.require('customers.delete', 'desactivar clientes');
        await Customer.delete(id);
        showNotification('Cliente desactivado. Ya no aparecerá en listados ni ventas nuevas.', 'success');
    }

    /**
     * C1: Restaurar un cliente desactivado
     * @param {number} id - Customer ID
     */
    static async restoreCustomer(id) {
        PermissionService.require('customers.delete', 'restaurar clientes');
        await Customer.restore(id);
        showNotification('Cliente restaurado y activo nuevamente.', 'success');
    }

    static async searchCustomers(term) {
        if (!term) return await Customer.getAll();
        return await Customer.search(term);
    }

    static async getCustomerHistory(customerId) {
        const customer = await Customer.getById(customerId);
        const sales = await Customer.getPurchaseHistory(customerId);
        
        return {
            customer,
            sales,
            totalPurchases: sales.length,
            totalAmount: sales.reduce((sum, s) => sum + s.total, 0)
        };
    }
}
