class Supplier {
    static _repository = new SupplierRepository();

    static async create(data) {
        const supplier = {
            name: data.name,
            contact: data.contact || '',
            phone: data.phone || '',
            email: data.email || '',
            address: data.address || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            // C3: Trazabilidad — quién creó/modificó
            createdBy: AuditLogService.getCurrentUserId(),
            updatedBy: AuditLogService.getCurrentUserId()
        };
        
        const id = await this._repository.create(supplier);
        // C2: Audit log
        AuditLogService.log({
            entity: 'supplier', entityId: id, action: 'create',
            summary: `Proveedor creado: "${data.name}"`,
            metadata: { name: data.name, contact: supplier.contact, phone: supplier.phone }
        });
        return id;
    }

    static async update(id, data) {
        // C3: Trazabilidad — quién modificó
        data.updatedBy = AuditLogService.getCurrentUserId();
        const result = await this._repository.update(id, data);
        // C2: Audit log
        const changedFields = Object.keys(data).filter(k => k !== 'id' && k !== 'updatedAt');
        AuditLogService.log({
            entity: 'supplier', entityId: id, action: 'update',
            summary: `Proveedor #${id} actualizado (${changedFields.join(', ')})`,
            metadata: { changedFields, id }
        });
        return result;
    }

    /**
     * C1 SOFT DELETE: Desactiva un proveedor (borrado lógico).
     * Mantiene validación: no se puede desactivar si tiene compras con saldo pendiente.
     * @param {number} id - Supplier ID
     * @returns {Promise<void>}
     * @throws {Error} If supplier has pending purchases or not found
     */
    static async delete(id) {
        return await this.softDelete(id);
    }

    /**
     * C1: Soft delete — marca como inactivo con validación de deuda pendiente.
     * @param {number} id - Supplier ID
     * @returns {Promise<void>}
     */
    static async softDelete(id) {
        const supplier = await this.getById(id);
        if (!supplier) throw new Error('Proveedor no encontrado');

        // Mantener validación B4: bloquear si hay compras con saldo pendiente
        const purchases = await Purchase.getBySupplier(id);
        if (purchases && purchases.length > 0) {
            const pendingPurchases = purchases.filter(p => {
                if (p.status === 'cancelled') return false;
                const total = parseFloat(p.total) || 0;
                const paid = parseFloat(p.paidAmount) || 0;
                return (total - paid) >= 1.0;
            });
            if (pendingPurchases.length > 0) {
                const totalPending = pendingPurchases.reduce((sum, p) => sum + ((parseFloat(p.total) || 0) - (parseFloat(p.paidAmount) || 0)), 0);
                if (totalPending >= 1.0) {
                    throw new Error(
                        `No se puede desactivar "${supplier.name}" porque tiene ${pendingPurchases.length} compra(s) con saldo pendiente ` +
                        `(deuda total: $${Math.round(totalPending).toLocaleString('es-CL')}). Pague las compras antes de desactivar.`
                    );
                }
            }
        }

        const updated = {
            ...supplier,
            isActive: false,
            deletedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            // C3: Trazabilidad — quién desactivó
            updatedBy: AuditLogService.getCurrentUserId()
        };

        const result = await this._repository.replace(updated);
        // C2: Audit log
        AuditLogService.log({
            entity: 'supplier', entityId: id, action: 'softDelete',
            summary: `Proveedor desactivado: "${supplier.name}"`,
            metadata: { name: supplier.name, previousState: 'active' }
        });
        return result;
    }

    /**
     * C1: Restaurar proveedor desactivado.
     * @param {number} id - Supplier ID
     * @returns {Promise<void>}
     */
    static async restore(id) {
        const supplier = await this._repository.findById(id);
        if (!supplier) throw new Error('Proveedor no encontrado');
        if (supplier.isActive !== false) throw new Error('El proveedor ya está activo');

        const updated = {
            ...supplier,
            isActive: true,
            deletedAt: null,
            updatedAt: new Date().toISOString(),
            // C3: Trazabilidad — quién restauró
            updatedBy: AuditLogService.getCurrentUserId()
        };

        const result = await this._repository.replace(updated);
        // C2: Audit log
        AuditLogService.log({
            entity: 'supplier', entityId: id, action: 'restore',
            summary: `Proveedor restaurado: "${supplier.name}"`,
            metadata: { name: supplier.name, previousState: 'inactive', deletedAt: supplier.deletedAt }
        });
        return result;
    }

    /**
     * C1: Obtener todos los proveedores incluyendo inactivos
     * @returns {Promise<Array>}
     */
    static async getAllIncludingDeleted() {
        return await this._repository.findAllIncludingDeleted();
    }

    /**
     * C1: Obtener solo proveedores inactivos
     * @returns {Promise<Array>}
     */
    static async getDeleted() {
        return await this._repository.findDeleted();
    }

    static async getById(id) {
        return await this._repository.findById(id);
    }

    static async getAll() {
        return await this._repository.findAll();
    }

    static async search(term) {
        return await this._repository.search(term);
    }
    
    static async getPurchaseHistory(supplierId) {
        const purchases = await Purchase.getBySupplier(supplierId);
        return purchases.sort((a, b) => new Date(b.date) - new Date(a.date));
    }
    
    static async getPurchasesByDateRange(supplierId, startDate, endDate) {
        const purchases = await this.getPurchaseHistory(supplierId);
        return purchases.filter(purchase => {
            const purchaseDate = new Date(purchase.date);
            return purchaseDate >= new Date(startDate) && purchaseDate <= new Date(endDate);
        });
    }
}
