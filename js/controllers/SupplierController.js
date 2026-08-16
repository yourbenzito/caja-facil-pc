class SupplierController {
    static async loadSuppliers() {
        return await Supplier.getAll();
    }

    static async saveSupplier(data) {
        if (!data.name) {
            throw new Error('El nombre es requerido');
        }

        if (data.id) {
            // C8: Permiso para editar proveedor
            PermissionService.require('suppliers.edit', 'editar proveedores');
            await Supplier.update(data.id, data);
            showNotification('Proveedor actualizado', 'success');
        } else {
            // C8: Permiso para crear proveedor
            PermissionService.require('suppliers.create', 'crear proveedores');
            await Supplier.create(data);
            showNotification('Proveedor creado', 'success');
        }
    }

    static async deleteSupplier(id) {
        // C8: Permiso para desactivar proveedor
        PermissionService.require('suppliers.delete', 'desactivar proveedores');
        await Supplier.delete(id);
        showNotification('Proveedor desactivado. Ya no aparecerá en listados ni compras nuevas.', 'success');
    }

    /**
     * C1: Restaurar un proveedor desactivado
     * @param {number} id - Supplier ID
     */
    static async restoreSupplier(id) {
        PermissionService.require('suppliers.delete', 'restaurar proveedores');
        await Supplier.restore(id);
        showNotification('Proveedor restaurado y activo nuevamente.', 'success');
    }

    static async searchSuppliers(term) {
        if (!term) return await Supplier.getAll();
        return await Supplier.search(term);
    }

    static async savePurchase(data) {
        if (!data.supplierId || !data.items || data.items.length === 0) {
            throw new Error('Proveedor e items son requeridos');
        }

        if (data.id) {
            // C8: Permiso para editar compra
            PermissionService.require('purchases.edit', 'editar compras');
            // ===== B2 FIX: Edición de compra con rollback manual =====
            // Fase 1: Lectura y cálculo de deltas (sin cambios en BD)
            const purchaseId = data.id;
            const old = await Purchase.getById(purchaseId);
            if (!old) throw new Error('Compra no encontrada');
            const oldItems = old.items || [];
            const newItems = data.items || [];
            const oldByProduct = new Map();
            for (const i of oldItems) {
                oldByProduct.set(i.productId, (oldByProduct.get(i.productId) || 0) + (parseFloat(i.quantity) || 0));
            }
            const newByProduct = new Map();
            for (const i of newItems) {
                newByProduct.set(i.productId, (newByProduct.get(i.productId) || 0) + (parseFloat(i.quantity) || 0));
            }
            const oldProductIds = new Set(oldByProduct.keys());
            const newProductIds = new Set(newByProduct.keys());
            const removedItems = oldItems.filter(i => !newProductIds.has(i.productId));
            const newItemsOnly = newItems.filter(i => !oldProductIds.has(i.productId));
            const deltas = [];
            for (const [productId, newQty] of newByProduct) {
                if (!oldByProduct.has(productId)) continue;
                const delta = newQty - (oldByProduct.get(productId) || 0);
                if (delta !== 0) deltas.push({ productId, quantityDelta: delta });
            }

            // Fase 2: Prevalidar stock suficiente para operaciones de resta
            for (const item of removedItems) {
                const qty = parseFloat(item.quantity) || 0;
                if (qty <= 0) continue;
                const product = await Product.getById(item.productId);
                if (!product) throw new Error(`Producto #${item.productId} no encontrado para revertir`);
                if ((parseFloat(product.stock) || 0) < qty) {
                    throw new Error(`Stock insuficiente para revertir ${item.productId}. Disponible: ${product.stock}, necesita: ${qty}`);
                }
            }
            for (const { productId, quantityDelta } of deltas) {
                if (quantityDelta >= 0) continue;
                const qty = Math.abs(quantityDelta);
                const product = await Product.getById(productId);
                if (!product) throw new Error(`Producto #${productId} no encontrado para ajustar delta`);
                if ((parseFloat(product.stock) || 0) < qty) {
                    throw new Error(`Stock insuficiente para ajuste de compra. Producto: ${product.name}, disponible: ${product.stock}, resta: ${qty}`);
                }
            }

            // CRITICAL FIX: Build unified product operations map, then execute ALL changes
            // (stock + movements + purchase update + cost/price) in a SINGLE atomic transaction.
            // If any fails, everything rolls back automatically. No orphan movements.
            const productOps = new Map();

            for (const item of removedItems) {
                const qty = parseFloat(item.quantity) || 0;
                if (qty <= 0) continue;
                const existing = productOps.get(item.productId) || { stockDelta: 0 };
                existing.stockDelta -= qty;
                productOps.set(item.productId, existing);
            }
            for (const item of newItemsOnly) {
                const qty = parseFloat(item.quantity) || 0;
                if (qty <= 0) continue;
                const existing = productOps.get(item.productId) || { stockDelta: 0 };
                existing.stockDelta += qty;
                productOps.set(item.productId, existing);
            }
            for (const { productId, quantityDelta } of deltas) {
                if (quantityDelta === 0) continue;
                const existing = productOps.get(productId) || { stockDelta: 0 };
                existing.stockDelta += quantityDelta;
                productOps.set(productId, existing);
            }
            // Add cost/price info from new purchase items (for weighted average)
            for (const item of newItems) {
                const existing = productOps.get(item.productId) || { stockDelta: 0 };
                existing.newCost = parseFloat(item.cost) || 0;
                existing.newPrice = item.price !== undefined ? parseFloat(item.price) : undefined;
                existing.itemQty = parseFloat(item.quantity) || 0;
                existing.additionalTaxesConfig = item.additionalTaxesConfig || [];
                productOps.set(item.productId, existing);
            }
            // Add info from old purchase items to correctly revert average cost
            const oldVatMode = old.vatMode || 'gross';
            for (const item of oldItems) {
                const existing = productOps.get(item.productId) || { stockDelta: 0 };
                const itemOldQty = parseFloat(item.quantity) || 0;
                existing.oldQty = (existing.oldQty || 0) + itemOldQty;
                
                let oldItemCostNeto = 0;
                if (oldVatMode === 'gross') {
                    oldItemCostNeto = (parseFloat(item.cost) || 0) / 1.19;
                } else {
                    oldItemCostNeto = parseFloat(item.cost) || 0;
                }
                existing.oldTotalCostNeto = (existing.oldTotalCostNeto || 0) + (itemOldQty * oldItemCostNeto);
                
                productOps.set(item.productId, existing);
            }

            if (db.mode === 'sqlite') {
                const productOpsObj = {};
                for (const [pid, o] of productOps) {
                    productOpsObj[pid] = o;
                }

                // C6 FIX: Recalcular paidAmount y status basado en pagos REALES antes de actualizar
                const registeredPaid = await SupplierPayment.getTotalPaidForPurchase(purchaseId);
                const legacyPaid = parseFloat(old.paidAmount) || 0;
                const effectivePaid = Math.max(registeredPaid, legacyPaid);
                const totalAmt = parseFloat(data.total) || 0;
                const isFullyPaid = (totalAmt - effectivePaid) < 1.0;
                
                data.paidAmount = isFullyPaid ? totalAmt : effectivePaid;
                data.status = isFullyPaid ? 'paid' : 'pending';

                const cleanPurchaseData = { ...data };
                delete cleanPurchaseData.deductFromCashRegister;

                const result = await ApiClient.put('complex/purchase', purchaseId, {
                    purchaseData: cleanPurchaseData,
                    productOps: productOpsObj
                });
                if (!result.success) throw new Error(result.error || 'Error en edición de compra SQLite');
                showNotification('Compra actualizada', 'success');
                return;
            }

            await new Promise((resolve, reject) => {
                if (!db.db) return reject(new Error('Base de datos no inicializada'));
                const tx = db.db.transaction(['purchases', 'products', 'stockMovements'], 'readwrite');

                tx.onerror = () => reject(new Error(`Error al editar compra: ${tx.error?.message || 'Error desconocido'}`));
                tx.onabort = () => reject(new Error('Edición de compra abortada: todos los cambios revertidos'));
                tx.oncomplete = () => resolve();

                const purchaseStore = tx.objectStore('purchases');
                const productStore = tx.objectStore('products');
                const movementStore = tx.objectStore('stockMovements');

                // Update purchase record within transaction
                const getPurchaseReq = purchaseStore.get(purchaseId);
                getPurchaseReq.onsuccess = async () => {
                    const existingPurchase = getPurchaseReq.result;
                    if (!existingPurchase) { tx.abort(); return; }

                    // C6 FIX: Sincronizar paidAmount con pagos reales
                    const registeredPaid = await SupplierPayment.getTotalPaidForPurchase(purchaseId);
                    const effectivePaid = Math.max(registeredPaid, parseFloat(existingPurchase.paidAmount) || 0);
                    const totalAmt = parseFloat(data.total) || 0;
                    const isFullyPaid = (totalAmt - effectivePaid) < 1.0;
                    
                    data.paidAmount = isFullyPaid ? totalAmt : effectivePaid;
                    data.status = isFullyPaid ? 'paid' : 'pending';

                    purchaseStore.put({
                        ...existingPurchase,
                        ...data,
                        id: purchaseId,
                        updatedAt: new Date().toISOString()
                    });
                };

                // Process each product operation (read WITHIN transaction)
                for (const [productId, ops] of productOps) {
                    const getReq = productStore.get(productId);
                    getReq.onsuccess = () => {
                        const product = getReq.result;
                        if (!product) { tx.abort(); return; }

                        const currentStock = parseFloat(product.stock) || 0;
                        let newStock = currentStock + ops.stockDelta;
                        if (newStock < 0) { tx.abort(); return; }

                        // Calculate weighted average cost if purchase includes this item
                        let inCostNeto = 0, inCostGross = 0;
                        if (ops.newCost !== undefined) {
                            if (data.vatMode === 'gross') {
                                inCostGross = ops.newCost;
                                inCostNeto = inCostGross / 1.19;
                            } else {
                                inCostNeto = ops.newCost;
                                inCostGross = Math.round(inCostNeto * 1.19);
                            }

                            // Sumar impuestos especiales manuales al costo unitario neto
                            let lineTaxes = 0;
                            if (ops.additionalTaxesConfig && ops.additionalTaxesConfig.length > 0) {
                                ops.additionalTaxesConfig.forEach(tax => {
                                    const amt = (typeof tax.amount === 'number' && tax.amount > 0)
                                        ? tax.amount
                                        : Math.round((ops.itemQty * inCostNeto) * (parseFloat(tax.rate) / 100));
                                    lineTaxes += amt;
                                });
                            }
                            const unitSpecialTaxNeto = ops.itemQty > 0 ? (lineTaxes / ops.itemQty) : 0;
                            inCostNeto += unitSpecialTaxNeto;
                            inCostGross = Math.round(inCostNeto * 1.19);
                        }

                        const currentCostNeto = (product.costNeto !== undefined && product.costNeto !== null) ? parseFloat(product.costNeto) : ((parseFloat(product.cost) || 0) / 1.19);
                        const oldQty = ops.oldQty || 0;
                        const oldItemCostNeto = oldQty > 0 ? (ops.oldTotalCostNeto / oldQty) : 0;

                        // Revertir solo la cantidad que realmente queda en stock de la compra anterior
                        const qtyToRevert = Math.max(0, Math.min(currentStock, oldQty));
                        const costToRevertNeto = qtyToRevert * oldItemCostNeto;

                        // Stock y costo base que pertenecen a otras compras anteriores
                        const baseStock = Math.max(0, currentStock - qtyToRevert);
                        const baseTotalCostNeto = Math.max(0, (currentStock * currentCostNeto) - costToRevertNeto);

                        // Nuevo stock e inserción de la compra editada
                        newStock = Math.max(0, currentStock + ops.stockDelta);
                        let finalAvgNeto = currentCostNeto;

                        if (newStock > 0) {
                            const qtyFromNewPurchase = Math.min(newStock, ops.itemQty);
                            const newTotalCostNeto = baseTotalCostNeto + (qtyFromNewPurchase * inCostNeto);
                            finalAvgNeto = newTotalCostNeto / newStock;
                            finalAvgNeto = Math.round(finalAvgNeto * 100) / 100;
                        } else {
                            finalAvgNeto = inCostNeto;
                        }
                        const finalAvgGross = Math.round(finalAvgNeto * 1.19);


                        let newPrice = product.price;
                        if (ops.newPrice !== undefined) {
                            newPrice = ops.newPrice;
                        }

                        productStore.put({
                            ...product,
                            stock: newStock,
                            cost: finalAvgGross,
                            costNeto: finalAvgNeto,
                            price: newPrice,
                            updatedAt: new Date().toISOString()
                        });

                        // Create stock movement if stock changed
                        if (ops.stockDelta !== 0) {
                            movementStore.add({
                                productId,
                                type: ops.stockDelta > 0 ? 'purchase' : 'adjustment',
                                quantity: ops.stockDelta,
                                reference: purchaseId,
                                date: new Date().toISOString(),
                                reason: `Edición compra #${purchaseId}`,
                                cost_value: Math.abs(ops.stockDelta) * finalAvgGross,
                                sale_value: Math.abs(ops.stockDelta) * (parseFloat(newPrice) || 0)
                            });
                        }
                    };
                }
            });
            showNotification('Compra actualizada', 'success');
        } else {
            // C8: Permiso para crear compra
            PermissionService.require('purchases.create', 'crear compras');

            const originalPaidAmount = parseFloat(data.paidAmount) || 0;
            const deductFromCash = originalPaidAmount > 0 && data.deductFromCashRegister === true;

            // Forzar que la compra se cree con paidAmount 0 para que el pago se registre de forma exclusiva
            // a través de SupplierPaymentService y evitar el doble egreso de caja
            data.paidAmount = 0;
            data.status = 'pending';

            const newPurchaseId = await Purchase.create(data);

            if (originalPaidAmount > 0) {
                await SupplierPaymentService.registerPayment({
                    supplierId: data.supplierId,
                    purchaseId: newPurchaseId,
                    amount: originalPaidAmount,
                    method: deductFromCash ? 'cash' : 'other',
                    reference: deductFromCash ? 'Pago al momento de comprar' : 'Abono inicial en compra',
                    notes: '',
                    deductFromCashRegister: deductFromCash
                });
            }

            showNotification('Compra registrada', 'success');
        }
    }

    static async deletePurchase(id) {
        // C8: Permiso para eliminar compra
        PermissionService.require('purchases.delete', 'eliminar compras');

        const purchase = await Purchase.getById(id);
        if (!purchase) {
            showNotification('Compra no encontrada', 'error');
            return;
        }
        if (purchase.status === 'cancelled') {
            showNotification('Esta compra ya se encuentra anulada', 'warning');
            return;
        }

        // Comprobar si algún producto quedará con stock negativo
        const items = (purchase.items || []).filter(item => item && (item.productId || item.id) && parseFloat(item.quantity) > 0);
        const lowStockAlerts = [];

        for (const item of items) {
            const pid = item.productId || item.id;
            const product = await Product.getById(pid);
            if (product) {
                const currentStock = parseFloat(product.stock) || 0;
                const revertQty = parseFloat(item.quantity) || 0;
                if (currentStock < revertQty) {
                    lowStockAlerts.push(`• ${product.name}: Stock actual ${currentStock}, al restar ${revertQty} quedará en (${currentStock - revertQty})`);
                }
            }
        }

        let warningText = 'El stock de los productos se revertirá y cualquier pago asociado (incluyendo caja) será anulado. Esta compra quedará registrada como ANULADA.';
        if (lowStockAlerts.length > 0) {
            warningText = `⚠️ ATENCIÓN: Algunos productos han sido vendidos total o parcialmente:\n\n${lowStockAlerts.join('\n')}\n\nSi procedes, el stock de estos productos quedará temporalmente en NEGATIVO.\n\n${warningText}`;
        }

        const confirmCancel = await showConfirm('¿Estás seguro de que deseas anular esta compra?', warningText, 'SÍ, ANULAR COMPRA', 'CANCELAR');
        if (!confirmCancel) return;

        const reason = prompt('Por favor, ingresa el motivo de la anulación (ej: Error de digitación, Devolución a proveedor):', 'Anulación manual');
        if (reason === null) return; // Canceló el prompt

        try {
            await Purchase.delete(id, reason || 'Anulación manual');
            showNotification('Compra anulada y stock revertido exitosamente', 'success');
            if (typeof app !== 'undefined' && app.navigate) {
                app.navigate('purchases');
            } else if (typeof PurchasesView !== 'undefined' && PurchasesView.refresh) {
                await PurchasesView.refresh();
            }
        } catch (error) {
            showNotification('Error al anular compra: ' + error.message, 'error');
        }
    }

    static async registerPayment(purchaseId, amount, method = 'cash', deductFromCashRegister = false) {
        // C8: Permiso para registrar pago de compra
        PermissionService.require('purchases.pay', 'registrar pagos de compras');

        const purchase = await Purchase.getById(purchaseId);
        if (!purchase) throw new Error('Compra no encontrada');

        await SupplierPaymentService.registerPayment({
            supplierId: purchase.supplierId,
            purchaseId: purchaseId,
            amount: amount,
            method: method,
            deductFromCashRegister: deductFromCashRegister
        });

        showNotification('Pago registrado', 'success');
    }

    static async getPurchaseHistory(supplierId) {
        const supplier = await Supplier.getById(supplierId);
        const purchases = await Purchase.getBySupplier(supplierId);

        return {
            supplier,
            purchases,
            totalPurchases: purchases.length,
            totalAmount: purchases.reduce((sum, p) => sum + p.total, 0),
            totalPaid: purchases.reduce((sum, p) => sum + p.paidAmount, 0),
            totalPending: purchases.reduce((sum, p) => sum + (p.total - p.paidAmount), 0)
        };
    }

    static async getAccountsPayable() {
        return await Purchase.getAccountsPayable();
    }
}
