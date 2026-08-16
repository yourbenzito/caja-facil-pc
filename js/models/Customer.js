class Customer {
    static _repository = new CustomerRepository();

    static async create(data) {
        const creditLimit = data.creditLimit != null && data.creditLimit !== '' ? parseFloat(data.creditLimit) : null;
        const customer = {
            name: data.name,
            rut: data.rut || '',
            phone: data.phone || '',
            email: data.email || '',
            paymentDay: data.paymentDay ? parseInt(data.paymentDay) : 0,
            promiseDate: data.promiseDate || '',
            creditLimit: creditLimit != null && !isNaN(creditLimit) && creditLimit >= 0 ? creditLimit : null,
            balanceCredit: 0, // dinero a favor del cliente
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            // C3: Trazabilidad — quién creó/modificó
            createdBy: AuditLogService.getCurrentUserId(),
            updatedBy: AuditLogService.getCurrentUserId()
        };

        const id = await this._repository.create(customer);
        // C2: Audit log
        AuditLogService.log({
            entity: 'customer', entityId: id, action: 'create',
            summary: `Cliente creado: "${data.name}"`,
            metadata: { name: data.name, phone: customer.phone, creditLimit: customer.creditLimit }
        });
        return id;
    }

    static async update(id, data) {
        const creditLimit = data.creditLimit != null && data.creditLimit !== '' ? parseFloat(data.creditLimit) : null;
        const updateData = { ...data };
        updateData.creditLimit = creditLimit != null && !isNaN(creditLimit) && creditLimit >= 0 ? creditLimit : null;
        if (data.balanceCredit !== undefined) {
            const v = parseFloat(data.balanceCredit);
            updateData.balanceCredit = !isNaN(v) && v >= 0 ? v : 0;
        }
        // C3: Trazabilidad — quién modificó
        updateData.updatedBy = AuditLogService.getCurrentUserId();
        const result = await this._repository.update(id, updateData);
        // C2: Audit log (no loguear updates internos de balanceCredit desde flujo de crédito)
        try {
            const current = await this.getById(id);
            if (current) {
                const changes = {};
                const labels = {
                    name: 'Nombre',
                    rut: 'RUT/ID',
                    phone: 'Teléfono',
                    email: 'Email',
                    paymentDay: 'Día de Pago',
                    creditLimit: 'Límite de Crédito',
                    balanceCredit: 'Saldo a Favor'
                };

                const changedFieldsLabels = [];
                for (const key in data) {
                    if (['id', 'updatedAt', 'updatedBy'].includes(key)) continue;

                    // Solo registrar si el valor es realmente distinto
                    if (current[key] !== updateData[key]) {
                        changes[key] = {
                            old: current[key],
                            new: updateData[key],
                            label: labels[key] || key
                        };
                        changedFieldsLabels.push(labels[key] || key);
                    }
                }

                // Filtrar si solo cambió balanceCredit (generalmente es automático por abonos)
                const realChanges = Object.keys(changes).filter(k => k !== 'balanceCredit');

                if (realChanges.length > 0) {
                    await AuditLogService.log({
                        entity: 'customer',
                        entityId: id,
                        action: 'update',
                        summary: `Modificó cliente: ${current.name}`,
                        metadata: {
                            customerName: current.name,
                            id: id,
                            changes: changes,
                            changedFields: Object.keys(changes)
                        }
                    });
                }
            }
        } catch (e) {
            console.error('Audit: Error capturando diff de cliente:', e);
        }
        return result;
    }

    /**
     * C1 SOFT DELETE: Desactiva un cliente (borrado lógico).
     * Mantiene validaciones de integridad: no se puede desactivar si tiene deuda o saldo a favor.
     * @param {number} id - Customer ID
     * @returns {Promise<void>}
     * @throws {Error} If customer has pending debts/credit or not found
     */
    static async delete(id) {
        return await this.softDelete(id);
    }

    /**
     * C1: Soft delete — marca como inactivo con validaciones de integridad.
     * @param {number} id - Customer ID
     * @returns {Promise<void>}
     */
    static async softDelete(id) {
        const customer = await this.getById(id);
        if (!customer) throw new Error('Cliente no encontrado');

        // Mantener validaciones de integridad existentes (Fase A/B)
        const balance = await AccountService.getCustomerBalance(id);
        const saldo = (balance.displayBalance != null) ? balance.displayBalance : balance.totalDebt;
        if (saldo > 0) {
            throw new Error(
                `No se puede desactivar el cliente "${customer.name}" porque tiene un saldo pendiente de ${formatCLP(saldo)}. ` +
                `Por favor, liquide el saldo antes de desactivar.`
            );
        }
        if (saldo < 0) {
            throw new Error(
                `No se puede desactivar el cliente "${customer.name}" porque tiene saldo a favor. ` +
                `Por favor, utilice o cancele el saldo a favor antes de desactivar.`
            );
        }

        const sales = await Sale.getByCustomer(id);
        const hasPendingSales = sales.some(s => s.status === 'pending' || s.status === 'partial');
        if (hasPendingSales) {
            throw new Error(
                `No se puede desactivar el cliente "${customer.name}" porque tiene ventas pendientes o parciales. ` +
                `Por favor, complete todas las ventas antes de desactivar.`
            );
        }

        const updated = {
            ...customer,
            isActive: false,
            deletedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            // C3: Trazabilidad — quién desactivó
            updatedBy: AuditLogService.getCurrentUserId()
        };

        const result = await this._repository.replace(updated);
        // C2: Audit log
        AuditLogService.log({
            entity: 'customer', entityId: id, action: 'softDelete',
            summary: `Cliente desactivado: "${customer.name}"`,
            metadata: { name: customer.name, previousState: 'active' }
        });
        return result;
    }

    /**
     * C1: Restaurar cliente desactivado.
     * @param {number} id - Customer ID
     * @returns {Promise<void>}
     */
    static async restore(id) {
        const customer = await this._repository.findById(id);
        if (!customer) throw new Error('Cliente no encontrado');
        if (customer.isActive !== false) throw new Error('El cliente ya está activo');

        const updated = {
            ...customer,
            isActive: true,
            deletedAt: null,
            updatedAt: new Date().toISOString(),
            // C3: Trazabilidad — quién restauró
            updatedBy: AuditLogService.getCurrentUserId()
        };

        const result = await this._repository.replace(updated);
        // C2: Audit log
        AuditLogService.log({
            entity: 'customer', entityId: id, action: 'restore',
            summary: `Cliente restaurado: "${customer.name}"`,
            metadata: { name: customer.name, previousState: 'inactive', deletedAt: customer.deletedAt }
        });
        return result;
    }

    /**
     * C1: Obtener todos los clientes incluyendo inactivos (para reportes/historial)
     * @returns {Promise<Array>}
     */
    static async getAllIncludingDeleted() {
        return await this._repository.findAllIncludingDeleted();
    }

    /**
     * C1: Obtener solo clientes inactivos
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

    static async getPurchaseHistory(customerId) {
        return await Sale.getByCustomer(customerId);
    }

    static async getAccountBalance(customerId) {
        return await AccountService.getCustomerBalance(customerId);
    }

    static async getPaymentHistory(customerId) {
        return await Payment.getByCustomer(customerId);
    }

    static async useCreditForPayment(customerId, amount, details = {}) {
        return await CustomerAccountService.useCreditForPayment(customerId, amount, details);
    }
}
