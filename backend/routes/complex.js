const express = require('express');
const router = express.Router();
const { dbGet, dbRun, dbAll, withTransaction, getTableColumns, filterToColumns } = require('../database/connection');
const { 
    roundPrice, 
    validateSaleCalculations, 
    computeFiscalFromTotal, 
    computeCashRefundForSale 
} = require('../helpers/utils');

router.post('/api/complex/sale', async (req, res) => {
    const { sale, validItems } = req.body; 
    const bid = req.business_id;
    try {
        if (sale?.idempotencyKey) {
            const existing = await dbGet(
                "SELECT id FROM sales WHERE idempotencyKey = ? AND business_id = ?",
                [sale.idempotencyKey, bid]
            );
            if (existing) return res.json({ id: existing.id, success: true, fromIdempotency: true });
        }

        const validation = validateSaleCalculations(sale);
        if (!validation.valid) {
            console.error('[Sale Validation] Errores en cálculos de venta:', validation.errors);
            const correctedFiscal = computeFiscalFromTotal(sale.total, sale.documentType || 'boleta');
            sale.base_amount = correctedFiscal.base_amount;
            sale.tax_amount = correctedFiscal.tax_amount;
            sale.commission_amount = correctedFiscal.commission_amount;
            console.log('[Sale Validation] Cálculos corregidos automáticamente:', correctedFiscal);
        }
        if (validation.warnings.length > 0) {
            console.warn('[Sale Validation] Advertencias:', validation.warnings);
        }

        if (sale.total) {
            sale.total = roundPrice(sale.total);
        }
        if (sale.subtotal) {
            sale.subtotal = roundPrice(sale.subtotal);
        }
        // El redondeo del total no puede dejar la venta con más pagado que su total
        if (parseFloat(sale.paidAmount) > parseFloat(sale.total)) {
            sale.paidAmount = sale.total;
            if (sale.status === 'partial' || sale.status === 'pending') sale.status = 'completed';
        }

        const saleId = await withTransaction(async () => {
            const saleRecord = { ...sale };
            delete saleRecord.business_id;

            const maxRow = await dbGet("SELECT MAX(CAST(saleNumber AS INTEGER)) as max FROM sales WHERE business_id = ?", [bid]);
            saleRecord.saleNumber = (parseInt(maxRow?.max, 10) || 0) + 1;

            const allowedCols = await getTableColumns('sales');
            const filtered = filterToColumns(saleRecord, allowedCols.filter(c => c !== 'business_id'));
            const cols = Object.keys(filtered);
            const r = await dbRun(
                `INSERT INTO sales (${cols.join(',')}, business_id) VALUES (${cols.map(() => '?').join(',')}, ?)`,
                [...cols.map(c => typeof filtered[c] === 'object' ? JSON.stringify(filtered[c]) : filtered[c]), bid]
            );
            const sId = r.lastID;

            for (const item of validItems) {
                const pid = item.productId || item.id; 
                const qty = item.qty || item.quantity; 
                const price = item.price || 0;
                if (!pid || !qty) continue;
                await dbRun("UPDATE products SET stock = stock - ? WHERE id = ? AND business_id = ?", [qty, pid, bid]);
                const p = await dbGet("SELECT cost FROM products WHERE id = ? AND business_id = ?", [pid, bid]);
                await dbRun(`INSERT INTO stockMovements (productId, quantity, type, date, business_id, reference, reason, cost_value, sale_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
                    [pid, -qty, 'sale', new Date().toISOString(), bid, sId, `Venta #${saleRecord.saleNumber || sId}`, (p?.cost || 0) * qty, price * qty]);
            }

            let pDetails = saleRecord.paymentDetails;
            if (typeof pDetails === 'string' && pDetails.trim() !== '') {
                try { pDetails = JSON.parse(pDetails); } catch (_) { pDetails = null; }
            }
            if (pDetails && pDetails.creditBalance) {
                const amount = parseFloat(pDetails.creditBalance);
                if (amount > 0 && saleRecord.customerId) {
                    await dbRun("UPDATE customers SET balanceCredit = balanceCredit - ? WHERE id = ? AND business_id = ?", [amount, saleRecord.customerId, bid]);
                    const ccCols = await getTableColumns('customerCreditUses');
                    const ccData = filterToColumns({
                        customerId: saleRecord.customerId,
                        amount,
                        saleId: sId,
                        saleNumber: saleRecord.saleNumber || sId,
                        date: new Date().toISOString(),
                        notes: `Uso saldo a favor Venta #${saleRecord.saleNumber || sId}`
                    }, ccCols.filter(c => c !== 'business_id'));
                    const ccKeys = Object.keys(ccData);
                    await dbRun(
                        `INSERT INTO customerCreditUses (${ccKeys.join(',')}, business_id) VALUES (${ccKeys.map(() => '?').join(',')}, ?)`,
                        [...ccKeys.map(k => ccData[k]), bid]
                    );
                }
            }

            return sId;
        });
        res.json({ id: saleId, success: true, validation });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.post('/api/complex/bulk-adjustment', async (req, res) => {
    const { items, type, reason, reference } = req.body; 
    const bid = req.business_id;
    try {
        await withTransaction(async () => {
            for (const it of items) {
                const pid = it.productId || it.id;
                const p = await dbGet("SELECT stock, cost, price FROM products WHERE id = ? AND business_id = ?", [pid, bid]);
                if (!p) throw new Error(`Producto ${pid} no encontrado para ajuste de inventario`);
                
                let delta = parseFloat(it.quantity) || 0;
                if (it.targetStock !== undefined) {
                    delta = parseFloat(it.targetStock) - (parseFloat(p.stock) || 0);
                } else if ((type === 'loss' || type === 'consumption') && delta > 0) {
                    delta = -delta;
                }
                
                if (Math.abs(delta) < 0.0001) continue;

                await dbRun("UPDATE products SET stock = stock + ? WHERE id = ? AND business_id = ?", [delta, pid, bid]);
                await dbRun(`INSERT INTO stockMovements (productId, quantity, type, date, business_id, reference, reason, cost_value, sale_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
                    [pid, delta, type || 'adjustment', new Date().toISOString(), bid, reference || null, reason || '', Math.abs(delta) * (p.cost || 0), Math.abs(delta) * (p.price || 0)]);
            }
        });
        res.json({ success: true });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

function formatTitleCase(str) {
    if (!str || typeof str !== 'string') return 'General';
    const cleaned = str.trim().replace(/\s+/g, ' ');
    if (!cleaned) return 'General';
    return cleaned.split(' ').map(word => {
        if (!word) return '';
        if (word.length <= 3 && word === word.toUpperCase() && /^[A-ZÁÉÍÓÚÑ]+$/.test(word)) {
            return word;
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
}

router.post('/api/complex/product', async (req, res) => {
    // normalizar categoría a Title Case en backend
    if (req.body.category) {
        req.body.category = formatTitleCase(req.body.category);
    }
    const product = { ...req.body, business_id: req.business_id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), isActive: 1 };
    const bid = req.business_id;
    try {
        const result = await withTransaction(async () => {
            const allowedCols = await getTableColumns('products');
            const cleanProduct = filterToColumns(product, allowedCols);
            delete cleanProduct.id;
            const ks = Object.keys(cleanProduct);
            const r = await dbRun(`INSERT INTO products (${ks.join(',')}) VALUES (${ks.map(() => '?').join(',')})`, ks.map(k => typeof cleanProduct[k] === 'object' ? JSON.stringify(cleanProduct[k]) : cleanProduct[k]));
            
            await dbRun(`INSERT INTO productPriceHistory (productId, oldPrice, newPrice, date, business_id) VALUES (?, ?, ?, ?, ?)`, 
                [r.lastID, 0, product.price || 0, new Date().toISOString(), bid]);
                
            if (product.category) {
                const existingCat = await dbGet(`SELECT id FROM categories WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND business_id = ?`, [product.category, bid]);
                if (!existingCat) {
                    await dbRun(`INSERT INTO categories (name, color, business_id, is_synced) VALUES (?, '#3b82f6', ?, 1)`, [product.category, bid]);
                }
            }
            
            return r.lastID;
        });
        res.json({ id: result, ...product });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.put('/api/complex/product/:id', async (req, res) => {
    const { id } = req.params; 
    // normalizar categoría a Title Case en backend
    if (req.body.category) {
        req.body.category = formatTitleCase(req.body.category);
    }
    const product = { ...req.body }; 
    const bid = req.business_id;
    try {
        await withTransaction(async () => {
            const old = await dbGet("SELECT price, cost FROM products WHERE id = ? AND business_id = ?", [id, bid]);
            if (!old) throw new Error('Producto no encontrado');

            delete product.id; 
            delete product.business_id;
            product.updatedAt = new Date().toISOString();
            const allowedCols = await getTableColumns('products');
            const cleanProduct = filterToColumns(product, allowedCols);
            const ks = Object.keys(cleanProduct);
            if (ks.length > 0) {
                await dbRun(`UPDATE products SET ${ks.map(k => `${k} = ?`).join(',')} WHERE id = ? AND business_id = ?`, [...ks.map(k => typeof cleanProduct[k] === 'object' ? JSON.stringify(cleanProduct[k]) : cleanProduct[k]), id, bid]);
            }
            
            if (product.category) {
                const existingCat = await dbGet(`SELECT id FROM categories WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND business_id = ?`, [product.category, bid]);
                if (!existingCat) {
                    await dbRun(`INSERT INTO categories (name, color, business_id, is_synced) VALUES (?, '#3b82f6', ?, 1)`, [product.category, bid]);
                }
            }

            if (product.price !== undefined && parseFloat(product.price) !== parseFloat(old.price)) {
                await dbRun(`INSERT INTO productPriceHistory (productId, oldPrice, newPrice, date, business_id) VALUES (?, ?, ?, ?, ?)`, 
                    [id, old.price, product.price, new Date().toISOString(), bid]);
            }
            if (product.cost !== undefined && parseFloat(product.cost) !== parseFloat(old.cost)) {
                await dbRun(`INSERT INTO productCostHistory (productId, oldCost, newCost, reason, currentPrice, date, business_id) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
                    [id, old.cost, product.cost, 'Ajuste Manual', product.price || old.price, new Date().toISOString(), bid]);
            }
        });
        res.json({ success: true });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

// Unificar categorías en productos y en la tabla categories
router.post('/api/complex/categories/merge', async (req, res) => {
    const { targetCategory, sourceCategories } = req.body;
    const bid = req.business_id;

    if (!targetCategory || !Array.isArray(sourceCategories) || sourceCategories.length === 0) {
        return res.status(400).json({ error: 'targetCategory y sourceCategories son requeridos' });
    }

    const cleanTarget = formatTitleCase(targetCategory);

    try {
        await withTransaction(async () => {
            for (const source of sourceCategories) {
                if (source === cleanTarget) continue;
                await dbRun(
                    `UPDATE products SET category = ? WHERE category = ? AND business_id = ?`,
                    [cleanTarget, source, bid]
                );
                await dbRun(
                    `DELETE FROM categories WHERE name = ? AND business_id = ?`,
                    [source, bid]
                );
            }
            // Asegurar que la categoría destino existe en categories
            const existing = await dbGet(`SELECT id FROM categories WHERE name = ? AND business_id = ?`, [cleanTarget, bid]);
            if (!existing) {
                await dbRun(`INSERT INTO categories (name, color, business_id) VALUES (?, '#6b7280', ?)`, [cleanTarget, bid]);
            }
        });
        res.json({ success: true, targetCategory: cleanTarget });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Normalizar todas las categorías existentes de productos en la BD
router.post('/api/complex/categories/normalize-all', async (req, res) => {
    const bid = req.business_id;
    try {
        const products = await dbAll(`SELECT id, category FROM products WHERE business_id = ? AND isActive = 1`, [bid]);
        let updatedCount = 0;

        await withTransaction(async () => {
            for (const p of products) {
                const normalized = formatTitleCase(p.category || 'General');
                if (normalized !== p.category) {
                    await dbRun(`UPDATE products SET category = ? WHERE id = ? AND business_id = ?`, [normalized, p.id, bid]);
                    updatedCount++;
                }
            }

            // Reconstruir/Sincronizar tabla categories con valores únicos normalizados
            const distinctCats = await dbAll(`SELECT DISTINCT category FROM products WHERE business_id = ? AND isActive = 1 AND category IS NOT NULL`, [bid]);
            for (const row of distinctCats) {
                const catName = formatTitleCase(row.category);
                const exists = await dbGet(`SELECT id FROM categories WHERE name = ? AND business_id = ?`, [catName, bid]);
                if (!exists) {
                    await dbRun(`INSERT INTO categories (name, color, business_id) VALUES (?, '#6b7280', ?)`, [catName, bid]);
                }
            }
        });
        res.json({ success: true, updatedProductsCount: updatedCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Eliminar categoría y reasignar sus productos a una categoría de destino (o 'General')
router.post('/api/complex/categories/delete-and-reassign', async (req, res) => {
    const { categoryId, categoryName, targetCategory } = req.body;
    const bid = req.business_id;

    if (!categoryName) {
        return res.status(400).json({ error: 'categoryName es requerido' });
    }

    const cleanSource = formatTitleCase(categoryName);
    const cleanTarget = targetCategory ? formatTitleCase(targetCategory) : 'General';

    try {
        await withTransaction(async () => {
            // 1. Reasignar productos que tenían la categoría a eliminar
            await dbRun(
                `UPDATE products SET category = ? WHERE category = ? AND business_id = ?`,
                [cleanTarget, cleanSource, bid]
            );

            // 2. Eliminar la categoría de la tabla categories por ID o por Nombre
            if (categoryId) {
                await dbRun(`DELETE FROM categories WHERE id = ? AND business_id = ?`, [categoryId, bid]);
            }
            await dbRun(`DELETE FROM categories WHERE name = ? AND business_id = ?`, [cleanSource, bid]);

            // 3. Garantizar que la categoría destino exista en la tabla categories
            const existing = await dbGet(`SELECT id FROM categories WHERE name = ? AND business_id = ?`, [cleanTarget, bid]);
            if (!existing) {
                await dbRun(`INSERT INTO categories (name, color, business_id) VALUES (?, '#6b7280', ?)`, [cleanTarget, bid]);
            }
        });
        res.json({ success: true, message: `Categoría "${cleanSource}" eliminada y productos reasignados a "${cleanTarget}"` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Renombrar categoría en la tabla categories y en los productos
router.post('/api/complex/categories/rename', async (req, res) => {
    const { categoryId, oldName, newName } = req.body;
    const bid = req.business_id;

    if (!oldName || !newName) {
        return res.status(400).json({ error: 'oldName y newName son requeridos' });
    }

    const cleanOld = formatTitleCase(oldName);
    const cleanNew = formatTitleCase(newName);

    try {
        await withTransaction(async () => {
            // Actualizar productos
            await dbRun(
                `UPDATE products SET category = ? WHERE category = ? AND business_id = ?`,
                [cleanNew, cleanOld, bid]
            );

            // Actualizar o renombrar en tabla categories
            if (categoryId) {
                await dbRun(`UPDATE categories SET name = ? WHERE id = ? AND business_id = ?`, [cleanNew, categoryId, bid]);
            } else {
                await dbRun(`UPDATE categories SET name = ? WHERE name = ? AND business_id = ?`, [cleanNew, cleanOld, bid]);
            }
        });
        res.json({ success: true, message: `Categoría renombrada de "${cleanOld}" a "${cleanNew}"` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Alias de actualización de productos para compatibilidad
router.put('/api/products/:id', async (req, res) => {
    const { id } = req.params; 
    const product = { ...req.body }; 
    const bid = req.business_id;
    try {
        await withTransaction(async () => {
            const old = await dbGet("SELECT price, cost FROM products WHERE id = ? AND business_id = ?", [id, bid]);
            if (!old) throw new Error('Producto no encontrado');

            if (product.price !== undefined) {
                product.price = roundPrice(product.price);
            }
            if (product.cost !== undefined) {
                product.cost = roundPrice(product.cost);
            }
            if (product.costNeto !== undefined) {
                product.costNeto = Math.round(product.costNeto * 100) / 100;
            }

            delete product.id; 
            delete product.business_id;
            product.updatedAt = new Date().toISOString();
            const ks = Object.keys(product);
            await dbRun(`UPDATE products SET ${ks.map(k => `${k} = ?`).join(',')} WHERE id = ? AND business_id = ?`, [...ks.map(k => typeof product[k] === 'object' ? JSON.stringify(product[k]) : product[k]), id, bid]);
            
            if (product.price !== undefined && parseFloat(product.price) !== parseFloat(old.price)) {
                await dbRun(`INSERT INTO productPriceHistory (productId, oldPrice, newPrice, date, business_id) VALUES (?, ?, ?, ?, ?)`, 
                    [id, old.price, product.price, new Date().toISOString(), bid]);
            }
            if (product.cost !== undefined && parseFloat(product.cost) !== parseFloat(old.cost)) {
                await dbRun(`INSERT INTO productCostHistory (productId, oldCost, newCost, reason, currentPrice, date, business_id) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
                    [id, old.cost, product.cost, 'Ajuste Manual', product.price || old.price, new Date().toISOString(), bid]);
            }
        });
        res.json({ success: true });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.post('/api/complex/purchase', async (req, res) => {
    const { purchase, items } = req.body; 
    const bid = req.business_id;
    try {
        if (purchase.subtotal !== undefined) {
            purchase.subtotal = Math.round(parseFloat(purchase.subtotal) * 100) / 100;
        }
        if (purchase.ivaAmount !== undefined) {
            purchase.ivaAmount = Math.round(parseFloat(purchase.ivaAmount) * 100) / 100;
        }
        if (purchase.total !== undefined) {
            purchase.total = Math.round(parseFloat(purchase.total));
        }

        const pId = await withTransaction(async () => {
            const allowedCols = await getTableColumns('purchases');
            const cleanPurchase = filterToColumns(purchase, allowedCols);
            delete cleanPurchase.id;
            const cols = Object.keys(cleanPurchase);
            const r = await dbRun(`INSERT INTO purchases (${cols.join(',')}, business_id) VALUES (${cols.map(() => '?').join(',')}, ?)`, [...cols.map(c => typeof cleanPurchase[c] === 'object' ? JSON.stringify(cleanPurchase[c]) : cleanPurchase[c]), bid]);
            
            for (const it of items) {
                const p = await dbGet("SELECT stock, cost, costNeto, price, additionalTaxesConfig FROM products WHERE id = ? AND business_id = ?", [it.productId, bid]); 
                if (!p) continue;
                const newQty = parseFloat(it.quantity); 
                
                let inCostNeto, inCostGross;
                if (purchase.vatMode === 'gross') {
                    inCostGross = parseFloat(it.cost) || 0;
                    inCostNeto = Math.round((inCostGross / 1.19) * 100) / 100;
                } else {
                    inCostNeto = parseFloat(it.cost) || 0;
                    inCostGross = Math.round((inCostNeto * 1.19) * 100) / 100;
                }

                // Sumar impuestos especiales manuales al costo unitario neto para promedio ponderado
                let lineTaxes = 0;
                if (it.additionalTaxesConfig && it.additionalTaxesConfig.length > 0) {
                    it.additionalTaxesConfig.forEach(tax => {
                        const amt = (typeof tax.amount === 'number' && tax.amount > 0)
                            ? tax.amount
                            : Math.round((newQty * inCostNeto) * (parseFloat(tax.rate) / 100));
                        lineTaxes += amt;
                    });
                }
                const unitSpecialTaxNeto = newQty > 0 ? (lineTaxes / newQty) : 0;
                inCostNeto += unitSpecialTaxNeto;
                inCostGross = Math.round((inCostNeto * 1.19) * 100) / 100;

                const currentStock = p.stock || 0;
                const currentCostNeto = (p.costNeto !== undefined && p.costNeto !== null) ? p.costNeto : Math.round((p.cost || 0) / 1.19 * 100) / 100;
                const currentPrice = p.price || 0;
                const newPrice = it.price !== undefined ? Math.round(parseFloat(it.price)) : currentPrice;
                
                const avgNeto = (currentStock + newQty > 0) 
                    ? ((currentStock * currentCostNeto) + (newQty * inCostNeto)) / (currentStock + newQty) 
                    : inCostNeto;
                
                const finalAvgNeto = Math.round(avgNeto * 100) / 100;
                const finalAvgGross = Math.round((finalAvgNeto * 1.19) * 100) / 100;
                
                const newTaxesConfig = it.additionalTaxesConfig ? JSON.stringify(it.additionalTaxesConfig) : p.additionalTaxesConfig;

                await dbRun("UPDATE products SET stock = stock + ?, cost = ?, costNeto = ?, price = ?, lastSupplierId = ?, additionalTaxesConfig = ? WHERE id = ? AND business_id = ?", [newQty, finalAvgGross, finalAvgNeto, newPrice, purchase.supplierId, newTaxesConfig, it.productId, bid]);
                
                if (Math.abs(newPrice - currentPrice) > 0.01) {
                    await dbRun(`INSERT INTO productPriceHistory (productId, oldPrice, newPrice, date, business_id) VALUES (?, ?, ?, ?, ?)`, 
                        [it.productId, currentPrice, newPrice, new Date().toISOString(), bid]);
                }

                if (Math.abs(finalAvgGross - (p.cost || 0)) > 0.001) {
                    await dbRun(`INSERT INTO productCostHistory (productId, oldCost, newCost, reason, referenceId, currentPrice, date, business_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
                        [it.productId, p.cost || 0, finalAvgGross, `Compra #${purchase.purchaseNumber || r.lastID}`, r.lastID, newPrice, new Date().toISOString(), bid]);
                }

                await dbRun(`INSERT INTO stockMovements (productId, quantity, type, date, business_id, reference, reason, cost_value, sale_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
                    [it.productId, newQty, 'purchase', new Date().toISOString(), bid, r.lastID, `Compra #${purchase.purchaseNumber || r.lastID}`, Math.round(newQty * inCostGross), Math.round(newQty * newPrice)]);
            }

            // Registrar egreso en cashMovements si se realizó un pago en efectivo usando caja abierta
            const paidVal = parseFloat(purchase.paidAmount) || 0;
            const pm = purchase.paymentMethod || 'cash';
            if (paidVal > 0 && pm === 'cash' && purchase.cashRegisterId) {
                await dbRun(
                    `INSERT INTO cashMovements (cashRegisterId, type, amount, description, date, business_id) VALUES (?, 'expense', ?, ?, ?, ?)`,
                    [purchase.cashRegisterId, paidVal, `Pago Compra #${purchase.purchaseNumber || r.lastID}`, new Date().toISOString(), bid]
                );
            }

            return r.lastID;
        });
        res.json({ id: pId, success: true });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.post('/api/complex/purchase/:id/cancel', async (req, res) => {
    const { id } = req.params; 
    const bid = req.business_id;
    const cancelReason = req.body && req.body.reason ? req.body.reason : 'Anulación manual';
    try {
        await withTransaction(async () => {
            const purchase = await dbGet("SELECT * FROM purchases WHERE id = ? AND business_id = ?", [id, bid]);
            if (!purchase) throw new Error('Compra no encontrada');
            if (purchase.status === 'cancelled') throw new Error('La compra ya está anulada');

            const now = new Date().toISOString();

            const items = JSON.parse(purchase.items || '[]');
            for (const item of items) {
                const pid = item.productId || item.id;
                const qty = item.quantity || item.qty || 0;
                if (pid && qty > 0) {
                    const p = await dbGet("SELECT cost, costNeto, price FROM products WHERE id = ? AND business_id = ?", [pid, bid]);
                    if (p) {
                        // Buscar si existe un historial de costo registrado por esta compra para restaurar el anterior
                        const lastCostEntry = await dbGet(
                            "SELECT oldCost FROM productCostHistory WHERE productId = ? AND referenceId = ? AND business_id = ? ORDER BY id DESC LIMIT 1",
                            [pid, id, bid]
                        );

                        let restoredGross = p.cost;
                        let restoredNeto = p.costNeto;

                        if (lastCostEntry && typeof lastCostEntry.oldCost === 'number' && lastCostEntry.oldCost > 0) {
                            restoredGross = lastCostEntry.oldCost;
                            restoredNeto = Math.round((restoredGross / 1.19) * 100) / 100;
                            await dbRun(
                                "UPDATE products SET stock = stock - ?, cost = ?, costNeto = ? WHERE id = ? AND business_id = ?",
                                [qty, restoredGross, restoredNeto, pid, bid]
                            );
                            await dbRun(
                                `INSERT INTO productCostHistory (productId, oldCost, newCost, reason, referenceId, currentPrice, date, business_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                                [pid, p.cost, restoredGross, `Anulación Compra #${purchase.purchaseNumber || id}`, id, p.price || 0, now, bid]
                            );
                        } else {
                            await dbRun("UPDATE products SET stock = stock - ? WHERE id = ? AND business_id = ?", [qty, pid, bid]);
                        }

                        await dbRun(`INSERT INTO stockMovements (productId, quantity, type, date, business_id, reference, reason, cost_value, sale_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [pid, -qty, 'adjustment', now, bid, id, `Anulación Compra #${purchase.purchaseNumber || id}`, Math.round((p?.cost || 0) * qty), Math.round((p?.price || 0) * qty)]);
                    }
                }
            }


            const payments = await dbAll("SELECT id, method FROM supplierPayments WHERE purchaseId = ? AND business_id = ?", [id, bid]);
            for (const p of payments) {
                if (p.method === 'cash') {
                    await dbRun("DELETE FROM cashMovements WHERE paymentId = ? AND business_id = ?", [p.id, bid]);
                }
                await dbRun("DELETE FROM supplierPayments WHERE id = ? AND business_id = ?", [p.id, bid]);
            }
            
            await dbRun("DELETE FROM cashMovements WHERE description LIKE ? AND business_id = ?",
                [`%Compra #${purchase.purchaseNumber || id}%`, bid]);

            await dbRun(
                "UPDATE purchases SET status = 'cancelled', cancelledAt = ?, cancelReason = ?, paidAmount = 0, updatedAt = ? WHERE id = ? AND business_id = ?",
                [now, cancelReason, now, id, bid]
            );

            await dbRun(
                `INSERT INTO auditLogs (entity, entityId, action, summary, timestamp, business_id) VALUES (?, ?, ?, ?, ?, ?)`,
                ['purchases', id, 'cancel',
                 `Anulación Compra #${purchase.purchaseNumber || id} | Motivo: ${cancelReason} | Total: ${purchase.total}`,
                 now, bid]
            );
        });
        res.json({ success: true });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.put('/api/complex/purchase/:id', async (req, res) => {
    const { id } = req.params; 
    const { purchaseData, productOps } = req.body; 
    const bid = req.business_id;
    try {
        const existingPurchase = await dbGet("SELECT status FROM purchases WHERE id = ? AND business_id = ?", [id, bid]);
        if (existingPurchase && existingPurchase.status === 'cancelled') {
            return res.status(400).json({ error: 'No se puede editar una compra anulada' });
        }

        await withTransaction(async () => {
            const allowedCols = await getTableColumns('purchases');
            const cleanPurchaseData = filterToColumns(purchaseData, allowedCols);
            delete cleanPurchaseData.id; 
            delete cleanPurchaseData.business_id;
            const updateCols = Object.keys(cleanPurchaseData);
            if (updateCols.length > 0) {
                await dbRun(`UPDATE purchases SET ${updateCols.map(c => `${c} = ?`).join(',')} WHERE id = ? AND business_id = ?`, 
                    [...updateCols.map(c => typeof cleanPurchaseData[c] === 'object' ? JSON.stringify(cleanPurchaseData[c]) : cleanPurchaseData[c]), id, bid]);
            }

            for (const pid in productOps) {
                const ops = productOps[pid];
                const product = await dbGet("SELECT stock, cost, costNeto, price FROM products WHERE id = ? AND business_id = ?", [pid, bid]);
                if (!product) continue;

                const currentStock = parseFloat(product.stock) || 0;
                let newStock = currentStock + ops.stockDelta;
                
                let inCostNeto = 0, inCostGross = 0;
                if (ops.newCost !== undefined) {
                    if (purchaseData.vatMode === 'gross') {
                        inCostGross = ops.newCost;
                        inCostNeto = parseFloat((inCostGross / 1.19).toFixed(2));
                    } else {
                        inCostNeto = ops.newCost;
                        inCostGross = parseFloat((inCostNeto * 1.19).toFixed(2));
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
                    inCostGross = Math.round(inCostNeto * 1.19 * 100) / 100;
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
                const finalAvgGross = parseFloat((finalAvgNeto * 1.19).toFixed(2));


                const newPrice = ops.newPrice !== undefined ? ops.newPrice : product.price;

                await dbRun("UPDATE products SET stock = ?, cost = ?, costNeto = ?, price = ?, updatedAt = ? WHERE id = ? AND business_id = ?", 
                    [newStock, finalAvgGross, finalAvgNeto, newPrice, new Date().toISOString(), pid, bid]);

                if (Math.abs(finalAvgGross - (product.cost || 0)) > 0.001) {
                    await dbRun(`INSERT INTO productCostHistory (productId, oldCost, newCost, reason, referenceId, currentPrice, date, business_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
                        [pid, product.cost || 0, finalAvgGross, `Edición Compra #${id}`, id, newPrice, new Date().toISOString(), bid]);
                }

                if (ops.stockDelta !== 0) {
                    await dbRun(`INSERT INTO stockMovements (productId, quantity, type, date, business_id, reference, reason, cost_value, sale_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
                        [pid, ops.stockDelta, ops.stockDelta > 0 ? 'purchase' : 'adjustment', new Date().toISOString(), bid, id, `Edición compra #${id}`, Math.abs(ops.stockDelta) * finalAvgGross, Math.abs(ops.stockDelta) * newPrice]);
                }
            }
        });
        res.json({ success: true });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.post('/api/complex/payment', async (req, res) => {
    const { payment } = req.body; 
    const bid = req.business_id;
    try {
        const pId = await withTransaction(async () => {
            const allowedCols = await getTableColumns('payments');
            const cleanPayment = filterToColumns(payment, allowedCols);
            delete cleanPayment.id;
            const cols = Object.keys(cleanPayment);
            const r = await dbRun(`INSERT INTO payments (${cols.join(',')}, business_id) VALUES (${cols.map(() => '?').join(',')}, ?)`, [...cols.map(c => typeof cleanPayment[c] === 'object' ? JSON.stringify(cleanPayment[c]) : cleanPayment[c]), bid]);
            const s = await dbGet("SELECT total, paidAmount FROM sales WHERE id = ? AND business_id = ?", [payment.saleId, bid]);
            if (s) { 
                // Nunca acreditar más de lo que resta por pagar
                const newPaid = Math.min((s.paidAmount || 0) + payment.amount, s.total);
                const isCompleted = newPaid >= s.total;
                await dbRun("UPDATE sales SET paidAmount = ?, status = ?, paidAt = ? WHERE id = ? AND business_id = ?", 
                    [newPaid, isCompleted ? 'completed' : 'partial', isCompleted ? (payment.date || new Date().toISOString()) : null, payment.saleId, bid]); 
            }
            if (payment.cashRegisterId && payment.paymentMethod === 'cash') { 
                await dbRun("INSERT INTO cashMovements (cashRegisterId, type, amount, description, date, paymentId, business_id) VALUES (?, 'in', ?, ?, ?, ?, ?)", [payment.cashRegisterId, payment.amount, `Abono Venta #${payment.saleId}`, new Date().toISOString(), r.lastID, bid]); 
            }
            return r.lastID;
        });
        res.json({ id: pId, success: true });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.post('/api/complex/supplier-payment', async (req, res) => {
    const { payment, deductFromCashRegister = false, cashRegisterId = null } = req.body;
    const bid = req.business_id;
    try {
        const pId = await withTransaction(async () => {
            if (!payment || !payment.supplierId || !(parseFloat(payment.amount) > 0)) {
                throw new Error('Pago a proveedor inválido');
            }

            const amount = parseFloat(payment.amount) || 0;
            const method = payment.method || 'cash';
            const date = payment.date || new Date().toISOString();
            const cleanSource = {
                supplierId: payment.supplierId,
                purchaseId: payment.purchaseId || null,
                amount,
                method,
                date,
                reference: payment.reference || '',
                notes: payment.notes || '',
                createdAt: payment.createdAt || date,
                updatedAt: payment.updatedAt || date,
                createdBy: payment.createdBy || null,
                updatedBy: payment.updatedBy || null
            };

            const allowedCols = await getTableColumns('supplierPayments');
            const cleanPayment = filterToColumns(cleanSource, allowedCols);
            delete cleanPayment.id;
            const cols = Object.keys(cleanPayment);
            const r = await dbRun(
                `INSERT INTO supplierPayments (${cols.join(',')}, business_id) VALUES (${cols.map(() => '?').join(',')}, ?)`,
                [...cols.map(c => typeof cleanPayment[c] === 'object' ? JSON.stringify(cleanPayment[c]) : cleanPayment[c]), bid]
            );

            if (payment.purchaseId) {
                const purchase = await dbGet(
                    "SELECT total, paidAmount FROM purchases WHERE id = ? AND business_id = ?",
                    [payment.purchaseId, bid]
                );
                if (purchase) {
                    const newPaid = (parseFloat(purchase.paidAmount) || 0) + amount;
                    const total = parseFloat(purchase.total) || 0;
                    // ponytail: Tolerancia de 2 pesos para evitar deudas residuales por redondeo de IVA
                    const isFullyPaid = (total - newPaid) <= 2.0;
                    await dbRun(
                        "UPDATE purchases SET paidAmount = ?, status = ?, updatedAt = ? WHERE id = ? AND business_id = ?",
                        [isFullyPaid ? total : newPaid, isFullyPaid ? 'paid' : 'pending', date, payment.purchaseId, bid]
                    );
                }
            }

            if (deductFromCashRegister && (method === 'cash' || method === 'efectivo')) {
                const registerId = cashRegisterId || payment.cashRegisterId;
                if (!registerId) throw new Error('No hay caja abierta para egresar el pago al proveedor');
                const supplier = await dbGet("SELECT name FROM suppliers WHERE id = ? AND business_id = ?", [payment.supplierId, bid]);
                const description = `Pago a Proveedor: ${supplier ? supplier.name : '#' + payment.supplierId}${payment.purchaseId ? ` (Compra #${payment.purchaseId})` : ' (General)'}`;
                await dbRun(
                    "INSERT INTO cashMovements (cashRegisterId, type, amount, description, date, paymentId, business_id) VALUES (?, 'out', ?, ?, ?, ?, ?)",
                    [registerId, amount, description, date, r.lastID, bid]
                );
            }

            await dbRun(
                `INSERT INTO auditLogs (entity, entityId, action, summary, metadata, timestamp, userId, username, business_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    'supplierPayment',
                    r.lastID,
                    'create',
                    `Pago a proveedor #${payment.supplierId} registrado - ${amount} (${method})`,
                    JSON.stringify({ supplierId: payment.supplierId, purchaseId: payment.purchaseId || null, amount, method }),
                    date,
                    req.userId || null,
                    req.username || 'sistema',
                    bid
                ]
            );

            return r.lastID;
        });
        res.json({ id: pId, success: true });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.post('/api/complex/credit-deposit', async (req, res) => {
    const { deposit } = req.body; 
    const bid = req.business_id;
    try {
        if (deposit.amount !== undefined) {
            deposit.amount = roundPrice(deposit.amount);
        }
        if (!(parseFloat(deposit.amount) > 0)) {
            throw new Error('El monto del depósito debe ser mayor a 0');
        }

        await withTransaction(async () => {
            const c = await dbGet("SELECT balanceCredit FROM customers WHERE id = ? AND business_id = ?", [deposit.customerId, bid]);
            if (!c) throw new Error('Cliente no encontrado');
            
            const newBalance = (c.balanceCredit || 0) + deposit.amount;
            await dbRun("UPDATE customers SET balanceCredit = ?, updatedAt = ? WHERE id = ? AND business_id = ?", [newBalance, new Date().toISOString(), deposit.customerId, bid]);
            
            const allowedCols = await getTableColumns('customerCreditDeposits');
            const cleanDeposit = filterToColumns(deposit, allowedCols);
            delete cleanDeposit.id;
            const cols = Object.keys(cleanDeposit);
            await dbRun(`INSERT INTO customerCreditDeposits (${cols.join(',')}, business_id) VALUES (${cols.map(() => '?').join(',')}, ?)`, [...cols.map(k => typeof cleanDeposit[k] === 'object' ? JSON.stringify(cleanDeposit[k]) : cleanDeposit[k]), bid]);
            
            if (deposit.cashRegisterId && (deposit.paymentMethod || 'cash') === 'cash') {
                await dbRun("INSERT INTO cashMovements (cashRegisterId, type, amount, description, date, business_id) VALUES (?, 'in', ?, ?, ?, ?)", 
                    [deposit.cashRegisterId, deposit.amount, `Carga saldo a favor: ${deposit.customerId}`, new Date().toISOString(), bid]);
            }
        });
        res.json({ success: true });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.post('/api/complex/account-payment', async (req, res) => {
    const { paymentsToCreate } = req.body; 
    const bid = req.business_id;
    try {
        await withTransaction(async () => {
            const allowedCols = await getTableColumns('payments');
            for (const p of paymentsToCreate) {
                const cleanP = filterToColumns(p, allowedCols);
                delete cleanP.id;
                const cols = Object.keys(cleanP);
                const r = await dbRun(`INSERT INTO payments (${cols.join(',')}, business_id) VALUES (${cols.map(() => '?').join(',')}, ?)`, [...cols.map(k => typeof cleanP[k] === 'object' ? JSON.stringify(cleanP[k]) : cleanP[k]), bid]);
                
                const s = await dbGet("SELECT total, paidAmount FROM sales WHERE id = ? AND business_id = ?", [p.saleId, bid]);
                if (s) {
                    // Nunca acreditar más de lo que resta por pagar
                    const newPaid = Math.min((s.paidAmount || 0) + p.amount, s.total);
                    const isCompleted = newPaid >= s.total;
                    await dbRun("UPDATE sales SET paidAmount = ?, status = ?, paidAt = ? WHERE id = ? AND business_id = ?", 
                        [newPaid, isCompleted ? 'completed' : 'partial', isCompleted ? (p.date || new Date().toISOString()) : null, p.saleId, bid]);
                }
                
                if (p.cashRegisterId && p.paymentMethod === 'cash') {
                    await dbRun("INSERT INTO cashMovements (cashRegisterId, type, amount, description, date, paymentId, business_id) VALUES (?, 'in', ?, ?, ?, ?, ?)", 
                        [p.cashRegisterId, p.amount, `Abono Venta #${p.saleId}`, new Date().toISOString(), r.lastID, bid]);
                }
            }
        });
        res.json({ success: true });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.post('/api/complex/debt-payment-session', async (req, res) => {
    const { session } = req.body; 
    const bid = req.business_id;
    try {
        await dbRun(
            `INSERT INTO debtPaymentSessions
             (customerId, date, totalPaid, totalDebt, discount, methods, salesData, notes, cashRegisterId, business_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                session.customerId,
                session.date || new Date().toISOString(),
                session.totalPaid   || 0,
                session.totalDebt   || 0,
                session.discount    || 0,
                JSON.stringify(session.methods   || {}),
                JSON.stringify(session.salesData || []),
                session.notes       || '',
                session.cashRegisterId || null,
                bid
            ]
        );
        res.json({ success: true });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.get('/api/customers/:id/debt-payment-sessions', async (req, res) => {
    const { id } = req.params; 
    const bid = req.business_id;
    try {
        const sessions = await dbAll(
            `SELECT * FROM debtPaymentSessions WHERE customerId = ? AND business_id = ? ORDER BY date DESC`,
            [id, bid]
        );
        res.json(sessions.map(s => ({
            ...s,
            methods:   s.methods   ? JSON.parse(s.methods)   : {},
            salesData: s.salesData ? JSON.parse(s.salesData) : []
        })));
    } catch (err) { 
        res.json([]); 
    }
});

router.post('/api/complex/reconcile-balances', async (req, res) => {
    const { customerId } = req.body; 
    const bid = req.business_id;
    try {
        await withTransaction(async () => {
            const c = await dbGet("SELECT balanceCredit FROM customers WHERE id = ? AND business_id = ?", [customerId, bid]);
            if (!c || (c.balanceCredit || 0) <= 0) return;

            const pend = await dbAll("SELECT * FROM sales WHERE customerId = ? AND status IN ('pending', 'partial') AND business_id = ? ORDER BY date ASC", [customerId, bid]);
            if (pend.length === 0) return;

            let remainingCredit = parseFloat(c.balanceCredit);
            const now = new Date().toISOString();

            for (const s of pend) {
                if (remainingCredit <= 0.9) break;

                const retRow = await dbGet("SELECT SUM(totalReturned) as totalReturned FROM saleReturns WHERE saleId = ? AND business_id = ?", [s.id, bid]);
                const returnedAmount = parseFloat(retRow?.totalReturned) || 0;

                const debt = parseFloat(s.total) - returnedAmount - (parseFloat(s.paidAmount) || 0);
                const toApply = Math.min(debt, remainingCredit);
                
                if (toApply > 0.9) {
                    const newPaid = (parseFloat(s.paidAmount) || 0) + toApply;
                    const finalTotalWithReturns = parseFloat(s.total) - returnedAmount;
                    await dbRun("UPDATE sales SET paidAmount = ?, status = ?, updatedAt = ? WHERE id = ? AND business_id = ?", 
                        [newPaid, newPaid >= finalTotalWithReturns - 0.01 ? 'completed' : 'partial', now, s.id, bid]);
                    
                    await dbRun("INSERT INTO customerCreditUses (customerId, amount, saleId, saleNumber, date, business_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)", 
                        [customerId, toApply, s.id, s.saleNumber || s.id, now, bid, 'Compensación automática de saldo']);
                    
                    remainingCredit -= toApply;
                }
            }

            await dbRun("UPDATE customers SET balanceCredit = ?, updatedAt = ? WHERE id = ? AND business_id = ?", [remainingCredit, now, customerId, bid]);
        });
        res.json({ success: true });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.post('/api/complex/customer-credit-use', async (req, res) => {
    const use = { ...req.body }; 
    const bid = req.business_id;
    try {
        if (use.amount !== undefined) {
            use.amount = roundPrice(use.amount);
        }

        await withTransaction(async () => {
            const c = await dbGet("SELECT balanceCredit FROM customers WHERE id = ? AND business_id = ?", [use.customerId, bid]);
            if (!c) throw new Error('Cliente no encontrado');
            if ((c.balanceCredit || 0) < use.amount) throw new Error('Saldo a favor insuficiente');
            
            const newBalance = (c.balanceCredit || 0) - use.amount;
            await dbRun("UPDATE customers SET balanceCredit = ?, updatedAt = ? WHERE id = ? AND business_id = ?", [newBalance, new Date().toISOString(), use.customerId, bid]);
            
            const allowedCols = await getTableColumns('customerCreditUses');
            const cleanUse = filterToColumns(use, allowedCols);
            delete cleanUse.id;
            const cols = Object.keys(cleanUse);
            await dbRun(`INSERT INTO customerCreditUses (${cols.join(',')}, business_id) VALUES (${cols.map(() => '?').join(',')}, ?)`, [...cols.map(k => typeof cleanUse[k] === 'object' ? JSON.stringify(cleanUse[k]) : cleanUse[k]), bid]);
        });
        res.json({ success: true });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.post('/api/complex/sale-return', async (req, res) => {
    const { returnRecord, validatedItems, deductFromCashRegister, cashRegisterId, cashRefundAmount } = req.body;
    const bid = req.business_id;
    try {
        if (returnRecord.totalReturned !== undefined) {
            returnRecord.totalReturned = roundPrice(returnRecord.totalReturned);
        }

        const rId = await withTransaction(async () => {
            const allowedCols = await getTableColumns('saleReturns');
            const cleanReturnRecord = filterToColumns(returnRecord, allowedCols);
            delete cleanReturnRecord.id;
            const cols = Object.keys(cleanReturnRecord);
            const r = await dbRun(`INSERT INTO saleReturns (${cols.join(',')}, business_id) VALUES (${cols.map(() => '?').join(',')}, ?)`, [...cols.map(c => typeof cleanReturnRecord[c] === 'object' ? JSON.stringify(cleanReturnRecord[c]) : cleanReturnRecord[c]), bid]);
            
            for (const item of validatedItems) {
                const p = await dbGet("SELECT cost, price FROM products WHERE id = ? AND business_id = ?", [item.productId, bid]);
                await dbRun("UPDATE products SET stock = stock + ? WHERE id = ? AND business_id = ?", [item.quantity, item.productId, bid]);
                await dbRun(`INSERT INTO stockMovements (productId, quantity, type, date, business_id, reference, reason, cost_value, sale_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
                    [item.productId, item.quantity, 'return', new Date().toISOString(), bid, returnRecord.saleId, `Devolución Venta #${returnRecord.saleNumber || returnRecord.saleId}: ${returnRecord.reason || ''}`, (p?.cost || 0) * item.quantity, (p?.price || 0) * item.quantity]);
            }
            
            // Solo sale de caja la parte que el cliente ya había pagado; el resto se abona a su deuda
            const refund = cashRefundAmount !== undefined ? roundPrice(cashRefundAmount) : returnRecord.totalReturned;
            if (deductFromCashRegister && cashRegisterId && refund > 0) {
                await dbRun(`INSERT INTO cashMovements (cashRegisterId, type, amount, description, date, business_id) VALUES (?, 'out', ?, ?, ?, ?)`, 
                    [cashRegisterId, refund, `Reembolso por Devolución Venta #${returnRecord.saleNumber || returnRecord.saleId}`, new Date().toISOString(), bid]);
            }
            return r.lastID;
        });
        res.json({ id: rId, success: true });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.delete('/api/complex/sale/:id', async (req, res) => {
    const { id } = req.params; 
    const bid = req.business_id;
    try {
        await withTransaction(async () => {
            const sale = await dbGet("SELECT * FROM sales WHERE id = ? AND business_id = ?", [id, bid]);
            if (!sale) throw new Error('Venta no encontrada');
            if (sale.status === 'cancelled') throw new Error('La venta ya está anulada');

            const items = JSON.parse(sale.items || '[]');
            for (const item of items) {
                const pid = item.productId || item.id;
                const qty = item.quantity || item.qty || 0;
                if (pid && qty > 0) {
                    const p = await dbGet("SELECT cost, price FROM products WHERE id = ? AND business_id = ?", [pid, bid]);
                    await dbRun("UPDATE products SET stock = stock + ? WHERE id = ? AND business_id = ?", [qty, pid, bid]);
                    await dbRun(`INSERT INTO stockMovements (productId, quantity, type, date, business_id, reference, reason, cost_value, sale_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
                        [pid, qty, 'adjustment', new Date().toISOString(), bid, id, `Anulación Venta #${sale.saleNumber || id}`, (p?.cost || 0) * qty, (p?.price || 0) * qty]);
                }
            }

            const creditUses = await dbAll("SELECT amount FROM customerCreditUses WHERE saleId = ? AND business_id = ?", [id, bid]);
            if (creditUses.length > 0 && sale.customerId) {
                for (const use of creditUses) {
                    await dbRun("UPDATE customers SET balanceCredit = balanceCredit + ? WHERE id = ? AND business_id = ?", [use.amount, sale.customerId, bid]);
                }
            }
            await dbRun("DELETE FROM customerCreditUses WHERE saleId = ? AND business_id = ?", [id, bid]);

            // Con varias cajas abiertas, el reembolso sale de la caja del usuario que anula
            const openRegister = (req.userId
                ? await dbGet("SELECT id FROM cashRegisters WHERE status = 'open' AND userId = ? AND business_id = ? ORDER BY id DESC LIMIT 1", [req.userId, bid])
                : null
            ) || await dbGet("SELECT id FROM cashRegisters WHERE status = 'open' AND business_id = ? ORDER BY id DESC LIMIT 1", [bid]);
            if (openRegister) {
                // Solo crear movimiento de egreso si la venta es de una caja ANTERIOR (ya cerrada).
                // Si es de la misma caja abierta, no se hace movimiento, porque el sistema simplemente 
                // dejará de sumarla en los ingresos del día, equilibrando el balance automáticamente.
                if (sale.cashRegisterId !== openRegister.id) {
                    const payments = await dbAll("SELECT amount, paymentMethod FROM payments WHERE saleId = ? AND business_id = ?", [id, bid]);
                    const totalCashToReturn = computeCashRefundForSale(sale, payments);

                    if (totalCashToReturn > 0) {
                        await dbRun(`INSERT INTO cashMovements (cashRegisterId, type, amount, description, date, business_id) VALUES (?, 'out', ?, ?, ?, ?)`, 
                        [openRegister.id, totalCashToReturn, `Reembolso por Anulación Venta #${sale.saleNumber || id} (Turno Anterior)`, new Date().toISOString(), bid]);
                    }
                }
            }

            const saleCols = await getTableColumns('sales');
            if (saleCols.includes('updatedAt')) {
                await dbRun("UPDATE sales SET status = 'cancelled', paymentMethod = 'cancelled', updatedAt = ? WHERE id = ? AND business_id = ?", [new Date().toISOString(), id, bid]);
            } else {
                await dbRun("UPDATE sales SET status = 'cancelled', paymentMethod = 'cancelled' WHERE id = ? AND business_id = ?", [id, bid]);
            }
            await dbRun("UPDATE payments SET paymentMethod = 'cancelled' WHERE saleId = ? AND business_id = ?", [id, bid]);
        });
        res.json({ success: true });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.put('/api/complex/sale/:id', async (req, res) => {
    const { id } = req.params; 
    const { saleData, items } = req.body; 
    const bid = req.business_id;
    try {
        let validationResult = {};
        await withTransaction(async () => {
            const old = await dbGet("SELECT items, saleNumber FROM sales WHERE id = ? AND business_id = ?", [id, bid]);
            if (!old) throw new Error('Venta no encontrada');

            const validation = validateSaleCalculations(saleData);
            validationResult = validation;
            if (!validation.valid) {
                console.error('[Sale Update Validation] Errores en cálculos de venta:', validation.errors);
                const correctedFiscal = computeFiscalFromTotal(saleData.total, saleData.documentType || 'boleta');
                saleData.base_amount = correctedFiscal.base_amount;
                saleData.tax_amount = correctedFiscal.tax_amount;
                saleData.commission_amount = correctedFiscal.commission_amount;
                console.log('[Sale Update Validation] Cálculos corregidos automáticamente:', correctedFiscal);
            }
            if (validation.warnings.length > 0) {
                console.warn('[Sale Update Validation] Advertencias:', validation.warnings);
            }

            if (saleData.total) {
                saleData.total = roundPrice(saleData.total);
            }
            if (saleData.subtotal) {
                saleData.subtotal = roundPrice(saleData.subtotal);
            }

            const allowedCols = await getTableColumns('sales');
            const cleanSaleData = filterToColumns(saleData, allowedCols);
            delete cleanSaleData.id;
            delete cleanSaleData.business_id;
            const cols = Object.keys(cleanSaleData);
            if (cols.length > 0) {
                await dbRun(`UPDATE sales SET ${cols.map(c => `${c} = ?`).join(',')} WHERE id = ? AND business_id = ?`, 
                    [...cols.map(c => typeof cleanSaleData[c] === 'object' ? JSON.stringify(cleanSaleData[c]) : cleanSaleData[c]), id, bid]);
            }

            if (items) {
                const oldItems = JSON.parse(old.items || '[]');
                const oldByP = {}; 
                oldItems.forEach(i => { 
                    const pid = i.productId || i.id; 
                    oldByP[pid] = (oldByP[pid] || 0) + (parseFloat(i.quantity) || 0); 
                });
                const newByP = {}; 
                items.forEach(i => { 
                    const pid = i.productId || i.id; 
                    newByP[pid] = (newByP[pid] || 0) + (parseFloat(i.quantity) || 0); 
                });
                
                const allPids = new Set([...Object.keys(oldByP), ...Object.keys(newByP)]);
                for (const pid of allPids) {
                    const delta = (newByP[pid] || 0) - (oldByP[pid] || 0);
                    if (Math.abs(delta) < 0.0001) continue;

                    await dbRun("UPDATE products SET stock = stock - ? WHERE id = ? AND business_id = ?", [delta, pid, bid]);
                    const p = await dbGet("SELECT cost, price FROM products WHERE id = ? AND business_id = ?", [pid, bid]);
                    await dbRun(`INSERT INTO stockMovements (productId, quantity, type, date, business_id, reference, reason, cost_value, sale_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
                        [pid, -delta, delta > 0 ? 'sale' : 'adjustment', new Date().toISOString(), bid, id, `Edición Venta #${old.saleNumber || id}`, (p?.cost || 0) * Math.abs(delta), (p?.price || 0) * Math.abs(delta)]);
                }
            }
        });
        res.json({ success: true, validation: validationResult });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

module.exports = router;
