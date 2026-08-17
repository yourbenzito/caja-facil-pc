class Product {
    static _repository = new ProductRepository();

    static async create(data) {
        const categoryName = (typeof CategoryHelper !== 'undefined') ? CategoryHelper.sanitize(data.category) : (data.category ? data.category.trim() : 'General');
        
        // Auto-registrar categoría en la lista oficial si aún no existe
        if (typeof Category !== 'undefined' && categoryName) {
            try {
                const uniqueCats = await Category.getUniqueNames();
                if (!uniqueCats.some(c => (typeof CategoryHelper !== 'undefined') ? CategoryHelper.areEqual(c, categoryName) : c.toLowerCase() === categoryName.toLowerCase())) {
                    await Category.create(categoryName);
                }
            } catch (_) {}
        }

        const product = {
            barcode: data.barcode || '',
            name: data.name,
            description: data.description || '',
            category: categoryName,
            price: parseFloat(data.price) || 0,
            cost: parseFloat(data.cost) || 0,
            type: data.type || 'unit',
            stock: parseFloat(data.stock) || 0,
            minStock: parseFloat(data.minStock) || 0,
            maxStock: parseFloat(data.maxStock) || 0,
            image: data.image || '',
            expiryDate: data.expiryDate && String(data.expiryDate).trim() ? String(data.expiryDate).trim().slice(0, 10) : null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            // Notebook Features: Markup e IVA
            markupPercent: parseFloat(data.markupPercent) || 0,
            ivaType: data.ivaType || '19%', // 19%, Exento, etc.
            costNeto: parseFloat(data.costNeto) || 0,
            // C3: Trazabilidad — quién creó/modificó
            createdBy: AuditLogService.getCurrentUserId(),
            updatedBy: AuditLogService.getCurrentUserId(),
            lastSoldAt: null, // Track product rotation
            lastSupplierId: data.lastSupplierId || null
        };

        if (db.mode === 'sqlite') {
            const result = await window.ApiClient.post('complex/product', product);
            const id = result.id || result;
            
            AuditLogService.log({
                entity: 'product', entityId: id, action: 'create',
                summary: `Producto creado: "${data.name}" (SQLite)`,
                metadata: { name: data.name, barcode: data.barcode || '', price: product.price, cost: product.cost, stock: product.stock }
            });
            return id;
        }

        const id = await this._repository.create(product);

        // C7: Registrar precio inicial en historial
        if (product.price > 0) {
            try {
                await ProductPriceHistory.create({
                    productId: id,
                    oldPrice: 0,
                    newPrice: product.price,
                    reason: 'Precio inicial (creación de producto)'
                });
            } catch (_) { /* No bloquear creación */ }
        }

        // C2: Audit log
        AuditLogService.log({
            entity: 'product', entityId: id, action: 'create',
            summary: `Producto creado: "${data.name}"`,
            metadata: { name: data.name, barcode: data.barcode || '', price: product.price, cost: product.cost, stock: product.stock }
        });
        return id;
    }

    /**
     * Update product fields. Stock cannot be modified through this method unless allowStock is true
     * (reserved for StockService / purchase flow). Use Product.updateStock() or StockService for stock changes.
     * @param {number} id - Product ID
     * @param {Object} data - Data to merge
     * @param {{ allowStock?: boolean }} options - allowStock: true only for StockService/purchase flow
     */
    static async update(id, data, options = { allowStock: false }) {
        if ('stock' in data && data.stock !== undefined && !options.allowStock) {
            throw new Error('El stock no puede modificarse directamente. Use StockService o Ajustes de inventario para cambios de stock.');
        }

        if ('category' in data && data.category !== undefined) {
            data.category = (typeof CategoryHelper !== 'undefined') ? CategoryHelper.sanitize(data.category) : (data.category ? String(data.category).trim() : 'General');
        }

        // C7: Capturar precio anterior ANTES de actualizar para historial
        let oldPrice = null;
        if ('price' in data && data.price !== undefined) {
            try {
                const currentProduct = await this.getById(id);
                if (currentProduct) oldPrice = parseFloat(currentProduct.price) || 0;
            } catch (_) { /* fallback silencioso */ }
        }

        // C3: Trazabilidad — quién modificó
        data.updatedBy = AuditLogService.getCurrentUserId();

        if (db.mode === 'sqlite') {
            await window.ApiClient.put('complex/product', id, data);
            
            // Audit log handling is tricky in complex mode, but we can do a simple one here
            // because server.js doesn't log automatically for complex/product yet
            AuditLogService.log({
                entity: 'product',
                entityId: id,
                action: 'update',
                summary: `Modificó producto (SQLite): ${id}`,
                metadata: { id, changes: Object.keys(data) }
            });
            return true;
        }

        const result = await this._repository.update(id, data);

        // C7: Registrar cambio de precio si hubo cambio real
        if (oldPrice !== null && 'price' in data) {
            try {
                await ProductPriceHistory.recordIfChanged(
                    id, oldPrice, parseFloat(data.price) || 0,
                    'Edición de producto'
                );
            } catch (_) { /* No bloquear operación principal */ }
        }

        // C2: Audit log (solo cambios de datos, no de stock por flujo interno)
        if (!options.allowStock) {
            try {
                const current = await this.getById(id);
                if (current) {
                    const changes = {};
                    const labels = {
                        name: 'Nombre',
                        barcode: 'Código de Barras',
                        category: 'Categoría',
                        price: 'Precio Venta',
                        cost: 'Costo Bruto',
                        costNeto: 'Costo Neto',
                        minStock: 'Stock Mínimo',
                        description: 'Descripción',
                        ivaType: 'Tipo IVA',
                        markupPercent: 'Markup',
                        expiryDate: 'Vencimiento',
                        type: 'Tipo de Unidad',
                        image: 'Imagen'
                    };

                    const changedFieldsLabels = [];
                    for (const key in data) {
                        if (['id', 'updatedAt', 'updatedBy'].includes(key)) continue;

                        // Solo registrar si el valor es realmente distinto
                        if (current[key] !== data[key]) {
                            changes[key] = {
                                old: current[key],
                                new: data[key],
                                label: labels[key] || key
                            };
                            changedFieldsLabels.push(labels[key] || key);
                        }
                    }

                    if (changedFieldsLabels.length > 0) {
                        await AuditLogService.log({
                            entity: 'product',
                            entityId: id,
                            action: 'update',
                            summary: `Modificó producto: ${current.name}`,
                            metadata: {
                                productName: current.name,
                                id: id,
                                changes: changes,
                                changedFields: Object.keys(changes)
                            }
                        });
                    }
                }
            } catch (e) {
                console.error('Audit: Error capturando diff de producto:', e);
            }
        }
        return result;
    }

    /**
     * C1 SOFT DELETE: Desactiva un producto (borrado lógico).
     * El registro se preserva para auditoría, reportes y ventas históricas.
     * @param {number} id - Product ID
     * @returns {Promise<void>}
     * @throws {Error} If product not found
     */
    static async delete(id) {
        return await this.softDelete(id);
    }

    /**
     * C1: Soft delete — marca como inactivo sin eliminar datos.
     * @param {number} id - Product ID
     * @returns {Promise<void>}
     */
    static async softDelete(id) {
        const product = await this.getById(id);
        if (!product) throw new Error('Producto no encontrado');

        const updated = {
            ...product,
            isActive: false,
            deletedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            // C3: Trazabilidad — quién desactivó
            updatedBy: AuditLogService.getCurrentUserId()
        };

        const result = await this._repository.replace(updated);
        // C2: Audit log
        AuditLogService.log({
            entity: 'product', entityId: id, action: 'softDelete',
            summary: `Producto desactivado: "${product.name}"`,
            metadata: { name: product.name, stock: product.stock, previousState: 'active' }
        });
        return result;
    }

    /**
     * C1: Restaurar producto desactivado.
     * @param {number} id - Product ID
     * @returns {Promise<void>}
     */
    static async restore(id) {
        const product = await this._repository.findById(id);
        if (!product) throw new Error('Producto no encontrado');
        if (product.isActive !== false) throw new Error('El producto ya está activo');

        const updated = {
            ...product,
            isActive: true,
            deletedAt: null,
            updatedAt: new Date().toISOString(),
            // C3: Trazabilidad — quién restauró
            updatedBy: AuditLogService.getCurrentUserId()
        };

        const result = await this._repository.replace(updated);
        // C2: Audit log
        AuditLogService.log({
            entity: 'product', entityId: id, action: 'restore',
            summary: `Producto restaurado: "${product.name}"`,
            metadata: { name: product.name, previousState: 'inactive', deletedAt: product.deletedAt }
        });
        return result;
    }

    /**
     * C1: Obtener todos los productos incluyendo inactivos (para reportes/historial)
     * @returns {Promise<Array>}
     */
    static async getAllIncludingDeleted() {
        return await this._repository.findAllIncludingDeleted();
    }

    /**
     * C1: Obtener solo productos inactivos
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

    static async getByBarcode(barcode) {
        return await this._repository.findByBarcode(barcode);
    }

    static async search(term) {
        return await this._repository.search(term);
    }

    static async getByCategory(category) {
        return await this._repository.findByCategory(category);
    }

    /**
     * Update stock (IMMUTABLE - creates new object instead of mutating)
     * @param {number} id - Product ID
     * @param {number} quantity - Quantity to add/subtract/set
     * @param {string} operation - 'subtract', 'add', or 'set'
     * @returns {Promise<void>}
     */
    static async updateStock(id, quantity, operation = 'subtract') {
        const product = await this.getById(id);
        if (!product) throw new Error('Producto no encontrado');

        const currentStock = parseFloat(product.stock) || 0;
        const qty = parseFloat(quantity) || 0;

        let newStock;
        if (operation === 'subtract') {
            newStock = currentStock - qty;
            if (newStock < 0) {
                throw new Error(`Stock insuficiente. Disponible: ${currentStock}, intento de restar: ${qty}`);
            }
        } else if (operation === 'add') {
            newStock = currentStock + qty;
        } else {
            newStock = parseFloat(quantity);
            if (isNaN(newStock) || newStock < 0) {
                throw new Error('El stock no puede ser negativo');
            }
        }

        const updated = {
            ...product,
            stock: newStock,
            updatedAt: new Date().toISOString(),
            // C3: Trazabilidad — quién modificó stock
            updatedBy: AuditLogService.getCurrentUserId()
        };

        return await this._repository.replace(updated);
    }

    static async getLowStock() {
        return await this._repository.findLowStock();
    }

    /**
     * Adjust price (IMMUTABLE)
     * @param {number} id - Product ID
     * @param {number} newPrice - New price
     * @returns {Promise<void>}
     */
    static async adjustPrice(id, newPrice) {
        const product = await this.getById(id);
        if (!product) throw new Error('Producto no encontrado');

        const oldPrice = parseFloat(product.price) || 0;
        const parsedNewPrice = parseFloat(newPrice);

        // Create updated product object (immutable)
        const updated = {
            ...product,
            price: parsedNewPrice,
            updatedAt: new Date().toISOString(),
            // C3: Trazabilidad — quién ajustó precio
            updatedBy: AuditLogService.getCurrentUserId()
        };

        const result = await this._repository.replace(updated);

        // C7: Registrar cambio de precio
        try {
            await ProductPriceHistory.recordIfChanged(
                id, oldPrice, parsedNewPrice,
                'Ajuste de precio'
            );
        } catch (_) { /* No bloquear operación principal */ }

        return result;
    }

    static calculateAverageCost(currentStock, currentCost, newQuantity, newCost) {
        // Validar parámetros y convertir a números
        const stock = parseFloat(currentStock) || 0;
        const cost = parseFloat(currentCost) || 0;
        const qty = parseFloat(newQuantity) || 0;
        const nCost = parseFloat(newCost) || 0;

        // Si no hay stock actual, el nuevo costo es directamente el promedio
        if (stock <= 0) {
            return nCost > 0 ? nCost : cost;
        }

        // Si la cantidad nueva es 0 o negativa, retornar costo actual
        if (qty <= 0) {
            return cost;
        }

        // Si el nuevo costo es 0 o negativo, mantener costo actual
        if (nCost <= 0) {
            return cost;
        }

        // Calcular costo medio ponderado
        // Fórmula: (StockActual * CostoActual + CantidadNueva * CostoNuevo) / (StockActual + CantidadNueva)
        const totalCurrent = stock * cost;
        const totalNew = qty * nCost;
        const totalStock = stock + qty;

        if (totalStock <= 0) {
            return nCost;
        }

        const averageCost = (totalCurrent + totalNew) / totalStock;

        // Redondear a 2 decimales para precisión contable
        const rounded = Math.round(averageCost * 100) / 100;
        return rounded > 0 ? rounded : nCost;
    }

    /**
     * Update cost with average calculation (IMMUTABLE)
     * @param {number} productId - Product ID
     * @param {number} newQuantity - New quantity being added
     * @param {number} newCost - Cost of new quantity
     * @returns {Promise<void>}
     */
    static async updateCostWithAverage(productId, newQuantity, newCost) {
        const product = await this.getById(productId);
        if (!product) throw new Error('Producto no encontrado');

        const averageCost = this.calculateAverageCost(
            product.stock,
            product.cost || 0,
            newQuantity,
            newCost
        );

        // Create updated product object (immutable)
        const updated = {
            ...product,
            cost: averageCost,
            updatedAt: new Date().toISOString(),
            // C3: Trazabilidad — quién actualizó costo promedio
            updatedBy: AuditLogService.getCurrentUserId()
        };

        return await this._repository.replace(updated);
    }

    static async importProducts(products) {
        const results = [];
        const batchSize = 10;
        
        // Optimización FASE 5: Procesar en lotes para mayor velocidad (paralelismo controlado)
        for (let i = 0; i < products.length; i += batchSize) {
            const batch = products.slice(i, i + batchSize);
            const batchPromises = batch.map(async (productData) => {
                try {
                    const id = await this.create(productData);
                    return { success: true, id, name: productData.name };
                } catch (error) {
                    return { success: false, error: error.message, name: productData.name };
                }
            });
            
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
        }
        
        return results;
    }


    static async getCategoryStats() {
        if (db.mode === 'sqlite' && window.ApiClient) {
            return await window.ApiClient.get('products/stats/categories');
        }
        // Fallback local (IndexedDB)
        const products = await this.getAll();
        const stats = {};
        products.forEach(p => {
            const cat = p.category || 'General';
            if (!stats[cat]) stats[cat] = { category: cat, total: 0, low: 0, out: 0, negative: 0 };
            stats[cat].total++;
            const stock = parseFloat(p.stock) || 0;
            const minStock = parseFloat(p.minStock) || 0;
            if (stock < 0) {
                stats[cat].negative++;
                stats[cat].out++;
            } else if (stock === 0) {
                stats[cat].out++;
            } else if (stock <= minStock) {
                stats[cat].low++;
            }
        });
        return Object.values(stats);
    }

    static async getByCategory(category) {
        return await this._repository.findByCategory(category);
    }

    static async updateLastSoldAt(id, date = new Date().toISOString()) {
        const product = await this.getById(id);
        if (!product) return;
        return await this._repository.update(id, {
            lastSoldAt: date,
            updatedAt: new Date().toISOString()
        });
    }

    static async clearAllBarcodes() {
        const products = await this.getAll();
        let updated = 0;

        for (const product of products) {
            await this._repository.update(product.id, { barcode: '' });
            updated += 1;
        }

        return updated;
    }

    static async getByLastSupplier(supplierId) {
        return await this._repository.findByLastSupplier(supplierId);
    }
}
