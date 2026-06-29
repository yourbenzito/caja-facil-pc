/**
 * C5: Sale Return Service
 * Centraliza la lógica de devoluciones de ventas.
 *
 * Principios:
 * - La venta original NUNCA se modifica ni elimina.
 * - La devolución es un EVENTO NUEVO e inmutable.
 * - El stock se restaura via StockService + StockMovement tipo 'return'.
 * - Se registra audit log.
 * - Las cantidades devueltas no pueden exceder lo vendido (menos devoluciones previas).
 */
class SaleReturnService {

    /**
     * Process a return for a sale.
     *
     * @param {number} saleId - ID de la venta original
     * @param {Array<{productId: number, quantity: number}>} returnItems - Ítems a devolver
     * @param {string} reason - Motivo de la devolución
     * @param {boolean} deductFromCashRegister - Si se debe extraer el efectivo de la caja
     * @returns {Promise<{returnId: number, totalReturned: number}>}
     */
    static async processReturn(saleId, returnItems, reason, deductFromCashRegister = false) {
        // 1. Validar que la venta exista
        const sale = await Sale.getById(saleId);
        if (!sale) throw new Error('Venta no encontrada');

        if (!returnItems || returnItems.length === 0) {
            throw new Error('Debe seleccionar al menos un producto para devolver');
        }

        // 2. Construir mapa de ítems vendidos (productId → {qty, unitPrice, costAtSale, name})
        const soldByProduct = {};
        for (const item of (sale.items || [])) {
            const pid = Number(item.productId);
            if (!soldByProduct[pid]) {
                soldByProduct[pid] = {
                    quantity: 0,
                    unitPrice: parseFloat(item.unitPrice || item.price) || 0,
                    costAtSale: item.costAtSale !== undefined && item.costAtSale !== null
                        ? parseFloat(item.costAtSale) : null,
                    name: item.name || `Producto #${pid}`
                };
            }
            soldByProduct[pid].quantity += parseFloat(item.quantity) || 0;
        }

        // 3. Obtener cantidades ya devueltas previamente
        const alreadyReturned = await SaleReturn.getReturnedQuantitiesBySale(saleId);

        // 4. Validar cada ítem de devolución
        const validatedItems = [];
        let totalReturned = 0;

        for (const ri of returnItems) {
            const pid = Number(ri.productId);
            const qtyToReturn = parseFloat(ri.quantity) || 0;

            if (qtyToReturn <= 0) continue; // Ignorar cantidades 0 o negativas

            const soldInfo = soldByProduct[pid];
            if (!soldInfo) {
                throw new Error(`El producto #${pid} no pertenece a la Venta #${sale.saleNumber || saleId}`);
            }

            const maxReturnable = soldInfo.quantity - (alreadyReturned[pid] || 0);
            if (qtyToReturn > maxReturnable + 0.001) {
                throw new Error(
                    `No se puede devolver ${qtyToReturn} unidades de "${soldInfo.name}". ` +
                    `Máximo devolvible: ${maxReturnable} (vendidas: ${soldInfo.quantity}, ya devueltas: ${alreadyReturned[pid] || 0})`
                );
            }

            const itemTotal = roundPrice(qtyToReturn * soldInfo.unitPrice);
            totalReturned += itemTotal;

            validatedItems.push({
                productId: pid,
                quantity: qtyToReturn,
                unitPrice: soldInfo.unitPrice,
                costAtSale: soldInfo.costAtSale,
                name: soldInfo.name,
                total: itemTotal
            });
        }

        if (validatedItems.length === 0) {
            throw new Error('No hay ítems válidos para devolver (cantidades deben ser mayores a 0)');
        }

        let openCash = null;
        if (deductFromCashRegister) {
            openCash = await CashRegister.getOpen();
            if (!openCash || !openCash.id) {
                throw new Error('No hay una caja abierta para extraer el efectivo del reembolso');
            }
        }

        // Create return record
        const returnRecord = {
            saleId: saleId,
            saleNumber: sale.saleNumber,
            items: validatedItems,
            totalReturned: totalReturned,
            reason: reason || '',
            date: new Date().toISOString(),
            createdBy: typeof AuditLogService !== 'undefined' ? AuditLogService.getCurrentUserId() : null
        };

        if (db.mode === 'sqlite') {
            const result = await ApiClient.post('complex/sale-return', {
                returnRecord,
                validatedItems,
                deductFromCashRegister,
                cashRegisterId: openCash ? openCash.id : null
            });
            if (!result.success) throw new Error(result.error || 'Error en devolución SQLite');
            
            // CRITICAL: Invalidate relevant caches
            db.clearCache('sales');
            db.clearCache('products');
            db.clearCache('stockMovements');
            db.clearCache('saleReturns');
            
            return { returnId: result.id, totalReturned };
        }

        // CRITICAL FIX: Stock restore + movement creation + return record + optional cash deduct
        // all in a SINGLE atomic IndexedDB transaction.
        // If any operation fails, everything rolls back automatically.
        // No orphan movements, no partial stock restores.
        const returnId = await new Promise((resolve, reject) => {
            const stores = ['products', 'stockMovements', 'saleReturns'];
            if (deductFromCashRegister && openCash) stores.push('cashMovements');
            const tx = db.db.transaction(stores, 'readwrite');
            let resolvedReturnId = null;

            tx.onerror = () => reject(new Error(`Error en devolución: ${tx.error?.message || 'Error desconocido'}`));
            tx.onabort = () => reject(new Error('Devolución abortada: stock y registros no fueron modificados'));
            tx.oncomplete = () => resolve(resolvedReturnId);

            const productStore = tx.objectStore('products');
            const movementStore = tx.objectStore('stockMovements');
            const returnStore = tx.objectStore('saleReturns');
            const cashMovementStore = deductFromCashRegister && openCash ? tx.objectStore('cashMovements') : null;

            const returnRequest = returnStore.add(returnRecord);
            returnRequest.onsuccess = () => {
                resolvedReturnId = returnRequest.result;
            };

            const executeStockRestore = async () => {
                // Restore stock for each item using the unified engine
                for (const item of validatedItems) {
                    await StockService.applyStockMovement(
                        item.productId,
                        item.quantity,
                        'return',
                        saleId,
                        `Devolución Venta #${sale.saleNumber || saleId}: ${reason || 'Sin motivo'}`,
                        tx
                    );
                }
            };

            executeStockRestore().then(() => {
                if (deductFromCashRegister && openCash) {
                    const desc = `Reembolso por Devolución Venta #${sale.saleNumber || saleId}`;
                    cashMovementStore.add({
                        cashRegisterId: openCash.id,
                        type: 'out',
                        amount: totalReturned,
                        description: desc,
                        date: new Date().toISOString()
                    });
                }
            }).catch(err => {
                tx.abort();
            });
        });

        return { returnId, totalReturned };
    }

    /**
     * Get a summary of returns for a sale (total returned, items, etc.)
     * @param {number} saleId
     * @returns {Promise<{returns: Array, totalReturned: number, returnedQtyByProduct: Object}>}
     */
    static async getReturnSummary(saleId) {
        const returns = await SaleReturn.getBySale(saleId);
        const totalReturned = returns.reduce((sum, r) => sum + (parseFloat(r.totalReturned) || 0), 0);
        const returnedQtyByProduct = {};
        for (const ret of returns) {
            for (const item of (ret.items || [])) {
                const pid = Number(item.productId);
                if (!returnedQtyByProduct[pid]) returnedQtyByProduct[pid] = 0;
                returnedQtyByProduct[pid] += parseFloat(item.quantity) || 0;
            }
        }
        return { returns, totalReturned, returnedQtyByProduct };
    }
}
