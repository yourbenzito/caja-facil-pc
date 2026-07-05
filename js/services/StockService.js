/**
 * Stock Service
 * Centralizes all stock-related business logic
 */
class StockService {
    /**
     * Process stock update for a sale
     * @param {Array} items - Sale items
     * @param {number} saleId - Sale ID (for stock movement reference)
     * @returns {Promise<void>}
     */


    /**
     * Motor Central de Movimientos de Stock (ATÓMICO)
     * Centraliza la matemática de redondeo, la persistencia y el historial.
     * 
     * @param {number} productId 
     * @param {number} delta - Cantidad a sumar (positivo) o restar (negativo)
     * @param {string} type - 'sale', 'purchase', 'adjustment', 'loss', 'consumption', 'return'
     * @param {number|string} reference - ID de venta, compra o ajuste
     * @param {string} reason - Explicación del movimiento
     * @param {Object} txObject - (Opcional) Transacción de IndexedDB existente
     */
    static async applyStockMovement(productId, delta, type, reference, reason = '', txObject = null) {
        const qty = roundQuantity(delta);
        if (qty === 0) return;

        // B5: Si estamos en modo SQLite, usamos la API centralizada del backend (que ya es atómica)
        if (db.mode === 'sqlite') {
            const result = await window.ApiClient.post('complex/bulk-adjustment', {
                items: [{ productId, quantity: qty }],
                type: type === 'return' ? 'adjustment' : type,
                reason: reason || `Movimiento automático: ${type}`,
                reference: reference
            });
            if (!result.success) throw new Error(result.error || 'Error en movimiento de stock (SQLite)');
            if (db.clearCache) await db.clearCache('products');
            return;
        }

        // Modo IndexedDB
        const execute = async (tx) => {
            const productStore = tx.objectStore('products');
            const movementStore = tx.objectStore('stockMovements');

            const product = await new Promise((resolve, reject) => {
                const req = productStore.get(productId);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });

            if (!product) throw new Error(`Producto #${productId} no encontrado para movimiento.`);

            const currentStock = roundQuantity(product.stock);
            const newStock = roundQuantity(currentStock + qty);

            // LOGICA FLEXIBLE: Si el stock queda negativo, lo permitimos pero podríamos registrar una alerta.
            // (Para este sistema mantendremos la integridad, pero redondeada)
            if (newStock < -1000000) { // Límite de seguridad absurdo
                throw new Error(`Error crítico: Stock resultante inválido (${newStock})`);
            }

            // Actualizar Producto
            await new Promise((resolve, reject) => {
                const updateData = {
                    ...product,
                    stock: newStock,
                    updatedAt: new Date().toISOString()
                };
                if (type === 'sale') updateData.lastSoldAt = new Date().toISOString();
                
                const req = productStore.put(updateData);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });

            // Registrar Movimiento
            await new Promise((resolve, reject) => {
                const req = movementStore.add({
                    productId,
                    type: type === 'return' ? 'adjustment' : type,
                    quantity: qty,
                    reference: reference,
                    reason: reason || '',
                    date: new Date().toISOString(),
                    cost_value: (parseFloat(product.cost) || 0) * Math.abs(qty),
                    sale_value: (parseFloat(product.price) || 0) * Math.abs(qty)
                });
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        };

        if (txObject) {
            await execute(txObject);
        } else {
            await new Promise((resolve, reject) => {
                const tx = db.db.transaction(['products', 'stockMovements'], 'readwrite');
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
                execute(tx).catch(err => {
                    tx.abort();
                    reject(err);
                });
            });
        }
    }
    static async processPurchaseStock(items, purchaseId) {
        if (!items || items.length === 0) {
            console.warn('processPurchaseStock: No items provided');
            return;
        }

        // Validate items first
        const normalizedItems = [];
        for (const item of items) {
            if (!item || !item.productId || item.quantity === undefined || item.quantity <= 0) {
                throw new Error(`Ítem inválido en la compra (Producto dictado sin ID o cantidad)`);
            }
            const newQuantity = parseFloat(item.quantity);
            const newCost = parseFloat(item.cost);

            if (isNaN(newQuantity) || newQuantity <= 0) {
                throw new Error(`Cantidad inválida para el producto: ${item.quantity}`);
            }
            if (isNaN(newCost) || newCost < 0) {
                throw new Error(`Costo inválido para el producto: ${item.cost}`);
            }

            normalizedItems.push({
                productId: item.productId,
                newQuantity,
                newCost,
                newPrice: item.price !== undefined && item.price !== null ? parseFloat(item.price) : null
            });
        }

        // Atomic transaction
        if (db.mode === 'sqlite') {
            console.log('StockService.processPurchaseStock: SQLite mode detected, skipping local transaction (server handles this).');
            return;
        }

        await new Promise((resolve, reject) => {
            if (!db.db) return reject(new Error('Base de datos no inicializada'));
            const tx = db.db.transaction(['products', 'stockMovements'], 'readwrite');

            tx.onerror = () => reject(new Error(`Transacción fallida al procesar inventario: ${tx.error?.message || 'Error desconocido'}`));
            tx.onabort = () => reject(new Error('Transacción abortada: se canceló el ingreso de compra e inventario.'));
            tx.oncomplete = () => resolve();

            const productStore = tx.objectStore('products');
            const movementStore = tx.objectStore('stockMovements');

            const executeAll = async () => {
                for (const item of normalizedItems) {
                    const productReq = productStore.get(item.productId);
                    const product = await new Promise((resolve, reject) => {
                        productReq.onsuccess = () => resolve(productReq.result);
                        productReq.onerror = () => reject(productReq.error);
                    });

                    if (!product) {
                        tx.abort();
                        return;
                    }

                    const currentStock = roundQuantity(product.stock);
                    const currentCost = parseFloat(product.cost) || 0;

                    // El costo promedio se calcula aquí porque es específico de Compras
                    const averageCost = Product.calculateAverageCost(
                        currentStock,
                        currentCost,
                        item.newQuantity,
                        item.newCost
                    );

                    const finalPrice = item.newPrice !== null ? item.newPrice : product.price;

                    // Actualizamos costo y precio en el producto (dentro de la tx)
                    productStore.put({
                        ...product,
                        cost: averageCost,
                        price: finalPrice,
                        updatedAt: new Date().toISOString()
                    });

                    // Delegamos el movimiento y el stock final al motor central
                    await this.applyStockMovement(item.productId, item.newQuantity, 'purchase', purchaseId, `Compra #${purchaseId}`, tx);
                }
            };

            executeAll().catch(err => {
                tx.abort();
                reject(err);
            });
        });
    }

    /**
     * Validate stock availability (uses ProductValidator)
     * @param {number} productId - Product ID
     * @param {number} quantity - Required quantity
     * @returns {Promise<boolean>}
     */
    static async validateStock(productId, quantity) {
        const product = await Product.getById(productId);
        const validation = ProductValidator.validateStock(product, quantity);
        return validation.valid;
    }

    /**
     * Revert stock for old purchase items when editing a purchase.
     * @param {Array} oldItems - Previous purchase items
     * @param {number} purchaseId - Purchase ID (for audit)
     * @returns {Promise<void>}
     */
    static async revertPurchaseStock(oldItems, purchaseId) {
        if (!oldItems || oldItems.length === 0) return;
        const reason = `Reversión edición compra #${purchaseId}`;
        for (const item of oldItems) {
            if (!item || !item.productId || item.quantity == null || item.quantity <= 0) continue;
            const qty = parseFloat(item.quantity);
            if (isNaN(qty) || qty <= 0) continue;
            // CORRECCIÓN: Usar applyStockMovement para atomicidad
            await this.applyStockMovement(item.productId, -qty, 'adjustment', purchaseId, reason);
        }
    }

    /**
     * Apply stock for new items when editing a purchase (add only; cost/price updated by UI).
     * @param {Array} newItems - New purchase items
     * @param {number} purchaseId - Purchase ID (for audit)
     * @returns {Promise<void>}
     */
    static async applyPurchaseStockForEdit(newItems, purchaseId) {
        if (!newItems || newItems.length === 0) return;
        const reason = `Edición compra #${purchaseId}`;
        for (const item of newItems) {
            if (!item || !item.productId || item.quantity == null || item.quantity <= 0) continue;
            const qty = parseFloat(item.quantity);
            if (isNaN(qty) || qty <= 0) continue;
            // CORRECCIÓN: Usar applyStockMovement para atomicidad
            await this.applyStockMovement(item.productId, qty, 'purchase', purchaseId, reason);
        }
    }

    /**
     * Apply quantity delta for existing items when editing a purchase.
     * Positive delta = add to stock, negative delta = subtract from stock.
     * @param {Array<{productId: number, quantityDelta: number}>} deltas - Deltas por producto
     * @param {number} purchaseId - Purchase ID (for audit)
     * @returns {Promise<void>}
     */
    static async applyPurchaseQuantityDeltas(deltas, purchaseId) {
        if (!deltas || deltas.length === 0) return;
        const reason = `Edición compra #${purchaseId}`;
        for (const { productId, quantityDelta } of deltas) {
            if (!productId || quantityDelta === 0) continue;
            const qty = Math.abs(quantityDelta);
            if (quantityDelta > 0) {
                // CORRECCIÓN: Usar applyStockMovement para atomicidad
                await this.applyStockMovement(productId, qty, 'purchase', purchaseId, reason);
            } else {
                // CORRECCIÓN: Usar applyStockMovement para atomicidad
                await this.applyStockMovement(productId, -qty, 'adjustment', purchaseId, reason);
            }
        }
    }

    /**
     * Create stock adjustment
     * ATOMIC: Product stock update + movement creation in single transaction.
     * @param {number} productId - Product ID
     * @param {number} quantity - Adjustment quantity (positive = add, negative = subtract)
     * @param {string} reason - Reason for adjustment
     * @param {string|null} reference - Optional reference ID (e.g., for corrections)
     * @returns {Promise<number|null>} - Movement ID
     */
    static async createAdjustment(productId, quantity, reason, reference = null) {
        const product = await Product.getById(productId);
        if (!product) throw new Error('Producto no encontrado');

        const qty = parseFloat(quantity) || 0;
        if (qty === 0) return null;
        const currentStock = parseFloat(product.stock) || 0;
        if (qty < 0 && currentStock < Math.abs(qty)) {
            console.warn(`⚠️ Ajuste con stock insuficiente: ${product.name} (stock: ${currentStock}, ajuste: ${qty})`);
        }

        if (db.mode === 'sqlite') {
            const result = await window.ApiClient.post('complex/bulk-adjustment', {
                items: [{ productId, quantity: qty }],
                type: 'adjustment',
                reason,
                reference
            });
            if (!result.success) throw new Error(result.error || 'Error en ajuste (SQLite)');
            
            // Invalidar caché para que la UI se actualice
            if (db.clearCache) {
                await db.clearCache('products');
                await db.clearCache('stockMovements');
            }
            return null; 
        }

        await this.applyStockMovement(productId, qty, 'adjustment', reference, reason);
        return true;
    }

    /**
     * Create stock loss
     * ATOMIC: Product stock update + movement creation in single transaction.
     * @param {number} productId - Product ID
     * @param {number} quantity - Loss quantity (positive number)
     * @param {string} reason - Reason for loss
     * @returns {Promise<number>} - Movement ID
     */
    static async createLoss(productId, quantity, reason) {
        const product = await Product.getById(productId);
        if (!product) throw new Error('Producto no encontrado');

        const qty = Math.abs(parseFloat(quantity) || 0);
        if (qty === 0) return null;

        if (db.mode === 'sqlite') {
            const result = await window.ApiClient.post('complex/bulk-adjustment', {
                items: [{ productId, quantity: -qty }],
                type: 'loss',
                reason
            });
            if (!result.success) throw new Error(result.error || 'Error en pérdida (SQLite)');
            
            // Invalidar caché
            if (db.clearCache) {
                await db.clearCache('products');
                await db.clearCache('stockMovements');
            }
            return null;
        }

        await this.applyStockMovement(productId, -qty, 'loss', null, reason);
        return true;
    }

    /**
     * Create internal consumption
     * ATOMIC: Product stock update + movement creation in single transaction.
     * @param {number} productId - Product ID
     * @param {number} quantity - Consumption quantity (positive number)
     * @param {string} reason - Reason for consumption
     * @returns {Promise<boolean>}
     */
    static async createConsumption(productId, quantity, reason) {
        const product = await Product.getById(productId);
        if (!product) throw new Error('Producto no encontrado');

        const qty = Math.abs(parseFloat(quantity) || 0);
        if (qty === 0) return null;

        if (db.mode === 'sqlite') {
            const result = await window.ApiClient.post('complex/bulk-adjustment', {
                items: [{ productId, quantity: -qty }],
                type: 'consumption',
                reason
            });
            if (!result.success) throw new Error(result.error || 'Error en consumo (SQLite)');
            
            // Invalidar caché
            if (db.clearCache) {
                await db.clearCache('products');
                await db.clearCache('stockMovements');
            }
            return null;
        }

        await this.applyStockMovement(productId, -qty, 'consumption', null, reason);
        return true;
    }

    /**
     * Set product stock to an absolute value.
     * ATOMIC: Reads current stock WITHIN transaction, calculates difference,
     * updates product AND creates movement in a single operation.
     * @param {number} productId - Product ID
     * @param {number} targetStock - Target stock value (absolute, not delta)
     * @param {string} reason - Reason for adjustment
     * @returns {Promise<number|null>} - Movement ID (null if no change)
     */
    static async setStock(productId, targetStock, reason, type = 'adjustment') {
        const product = await Product.getById(productId);
        if (!product) throw new Error('Producto no encontrado');
        if (targetStock < 0) throw new Error('El stock no puede ser negativo');

        if (db.mode === 'sqlite') {
            // FASE 5: Usamos targetStock (absoluto) para evitar errores por deltas basados en caché obsoleta
            const result = await window.ApiClient.post('complex/bulk-adjustment', {
                items: [{ productId, targetStock }],
                type: type,
                reason
            });
            if (!result.success) throw new Error(result.error || 'Error al establecer stock (SQLite)');
            
            // Invalidar caché
            if (db.clearCache) {
                await db.clearCache('products');
                await db.clearCache('stockMovements');
            }
            return null;
        }

        return await new Promise((resolve, reject) => {
            if (!db.db) return reject(new Error('Base de datos no inicializada'));
            const tx = db.db.transaction(['products', 'stockMovements'], 'readwrite');
            let movementId = null;

            tx.onerror = () => reject(new Error(`Error al establecer stock: ${tx.error?.message || 'Error desconocido'}`));
            tx.onabort = () => reject(new Error('Operación abortada'));
            tx.oncomplete = () => resolve(movementId);

            const productStore = tx.objectStore('products');
            const movementStore = tx.objectStore('stockMovements');

            const getReq = productStore.get(productId);
            getReq.onsuccess = () => {
                const currentProduct = getReq.result;
                if (!currentProduct) { tx.abort(); return; }

                const currentStock = parseFloat(currentProduct.stock) || 0;
                const difference = targetStock - currentStock;
                if (Math.abs(difference) < 0.001) return;

                productStore.put({
                    ...currentProduct,
                    stock: targetStock,
                    updatedAt: new Date().toISOString()
                });

                const movReq = movementStore.add({
                    productId,
                    type: type,
                    quantity: difference,
                    reason: reason || '',
                    date: new Date().toISOString(),
                    cost_value: (parseFloat(currentProduct.cost) || 0) * Math.abs(difference),
                    sale_value: (parseFloat(currentProduct.price) || 0) * Math.abs(difference)
                });
                movReq.onsuccess = () => { movementId = movReq.result; };
            };
        });
    }

    /**
     * Prevalidate all items for a bulk adjustment. Throws on first invalid item.
     * @param {Array<{productId: number, quantity: number}>} items
     * @param {string} type - 'adjustment' | 'loss' | 'consumption'
     * @throws {Error} If any item is invalid (product missing, quantity invalid, stock insufficient)
     */
    static async validateBulkAdjustment(items, type) {
        if (!items || items.length === 0) {
            throw new Error('No hay ítems para validar');
        }
        for (const item of items) {
            const productId = item.productId != null ? item.productId : item.id;
            const product = await Product.getById(productId);
            if (!product) {
                throw new Error(`Producto no encontrado (ID: ${productId})`);
            }
            const qty = parseFloat(item.quantity);
            if (isNaN(qty) || qty === 0) {
                throw new Error(`Cantidad inválida en "${product.name}". Debe ser distinta de 0.`);
            }
            if (type === 'loss' || type === 'consumption') {
                const absQty = Math.abs(qty);
                if (qty < 0) {
                    throw new Error(`En pérdida/consumo la cantidad debe ser positiva en "${product.name}".`);
                }
                const currentStock = parseFloat(product.stock) || 0;
                if (currentStock < absQty) {
                    console.warn(`⚠️ Stock insuficiente en "${product.name}" para ${type}.}`);
                }
            } else {
                const currentStock = parseFloat(product.stock) || 0;
                if (qty < 0 && currentStock < Math.abs(qty)) {
                    console.warn(`⚠️ Stock insuficiente para ajuste en "${product.name}".`);
                }
            }
        }
    }

    /**
     * Apply bulk adjustment atomically: ALL items in a SINGLE IndexedDB transaction.
     * If any item fails, the entire operation rolls back automatically.
     * No orphan movements, no partial stock changes.
     * @param {Array<{productId: number, quantity: number}>} items
     * @param {string} type - 'adjustment' | 'loss' | 'consumption'
     * @param {string} reason
     */
    static async applyBulkAdjustmentAtomic(items, type, reason) {
        const normalized = items.map(item => ({
            productId: item.productId != null ? item.productId : item.id,
            quantity: parseFloat(item.quantity) || 0
        })).filter(item => item.quantity !== 0);
        if (normalized.length === 0) {
            throw new Error('No hay ítems válidos para ajustar');
        }
        await this.validateBulkAdjustment(normalized, type);

        if (db.mode === 'sqlite') {
            const result = await window.ApiClient.post('complex/bulk-adjustment', {
                items: normalized,
                type,
                reason
            });
            if (!result.success) throw new Error(result.error || 'Error en ajuste masivo (SQLite)');
            
            // Invalidar caché
            if (db.clearCache) {
                await db.clearCache('products');
                await db.clearCache('stockMovements');
            }
            return;
        }

        await new Promise((resolve, reject) => {
            if (!db.db) return reject(new Error('Base de datos no inicializada'));
            const tx = db.db.transaction(['products', 'stockMovements'], 'readwrite');

            tx.onerror = () => reject(new Error(`Error en ajuste masivo: ${tx.error?.message || 'Error desconocido'}`));
            tx.onabort = () => reject(new Error('Ajuste masivo abortado: ningún cambio fue aplicado'));
            tx.oncomplete = () => resolve();

            const executeAll = async () => {
                for (const item of normalized) {
                    let stockDelta;
                    if (type === 'adjustment') {
                        stockDelta = item.quantity;
                    } else {
                        stockDelta = -Math.abs(item.quantity);
                    }
                    await this.applyStockMovement(item.productId, stockDelta, type, null, reason, tx);
                }
            };

            executeAll().catch(err => {
                tx.abort();
                reject(err);
            });
        });
    }

    /**
     * Kardex de stock por producto (solo lectura). Orden cronológico, saldo acumulado teórico,
     * comparación con Product.stock y marcas de diagnóstico. NO escribe en BD.
     * @param {number} productId - Product ID
     * @returns {Promise<{ product: Object|null, rows: Array<{date, type, reference, reason, quantity, sign, balanceAfter, noReference, isRollback, negativeBalance}>, theoreticalBalance: number, currentStock: number, inconsistency: boolean, diagnostics: Object }>}
     */
    static async getKardexByProduct(productId) {
        const product = await Product.getById(productId);
        const movements = await StockMovement.getByProduct(productId);
        const currentStock = product ? (parseFloat(product.stock) || 0) : 0;

        const sorted = [...movements].sort((a, b) => {
            const da = new Date(a.date || 0).getTime();
            const dateB = new Date(b.date || 0).getTime();
            if (da !== dateB) return da - dateB;
            return (a.id || 0) - (b.id || 0);
        });

        let balance = 0;
        const rows = [];
        let hasNegativeBalance = false;
        let hasNoReference = false;
        let hasRollback = false;

        for (const m of sorted) {
            const qty = parseFloat(m.quantity) || 0;
            balance += qty;
            const noRef = (m.type === 'sale' || m.type === 'purchase') && (m.reference == null || m.reference === '');
            const isRollback = (m.reason || '').toLowerCase().includes('rollback');
            const negativeBal = balance < 0;
            if (noRef) hasNoReference = true;
            if (isRollback) hasRollback = true;
            if (negativeBal) hasNegativeBalance = true;
            rows.push({
                id: m.id,
                date: m.date,
                type: m.type || 'adjustment',
                reference: m.reference,
                reason: m.reason || '',
                quantity: qty,
                sign: qty >= 0 ? '+' : '-',
                balanceAfter: balance,
                noReference: noRef,
                isRollback,
                negativeBalance: negativeBal
            });
        }

        const theoreticalBalance = rows.length > 0 ? rows[rows.length - 1].balanceAfter : 0;
        const inconsistency = rows.length > 0 && Math.abs(theoreticalBalance - currentStock) > 0.001;

        return {
            product,
            rows,
            theoreticalBalance,
            currentStock,
            inconsistency,
            diagnostics: {
                hasNegativeBalance,
                hasNoReference,
                hasRollback,
                movementCount: rows.length
            }
        };
    }
}
