const express = require('express');
const router = express.Router();
const os = require('os');
const { dbGet, dbRun, dbAll, withTransaction, getLastActivity } = require('../database/connection');
const { requireRole } = require('../middleware/auth');
const syncRouter = require('./sync');

const ALLOWED_TABLES = [
    'products', 'categories', 'sales', 'customers', 'suppliers', 
    'purchases', 'cashRegisters', 'cashMovements', 'stockMovements', 
    'settings', 'users', 'auditLogs', 'saleReturns', 'expenses', 
    'supplierPayments', 'customerCreditDeposits', 'customerCreditUses', 
    'productPriceHistory', 'productCostHistory', 'businesses', 
    'payments', 'passwordResets', 'debtPaymentSessions'
];

router.get('/api/status', (req, res) => res.json({ status: 'online', mode: 'standalone' }));
router.get('/api/system/status', (req, res) => res.json({ status: 'online', mode: 'standalone' }));
router.get('/api/system/activity', (req, res) => res.json({ lastActivity: getLastActivity() }));

router.get('/api/system/network-info', (req, res) => {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                ips.push(iface.address);
            }
        }
    }
    res.json({ ips, port: process.env.PORT || 3000 });
});

router.get('/api/system/setup-status', async (req, res) => {
    try {
        const usersCount = await dbGet("SELECT COUNT(*) as count FROM users");
        const needsSetup = usersCount.count === 0;
        res.json({ needsSetup, isFirstInstall: needsSetup });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.get('/api/export/business', async (req, res) => {
    const businessId = req.business_id || 1;
    try {
        const tables = [
            'businesses', 'products', 'categories', 'customers', 'suppliers',
            'sales', 'purchases', 'cashRegisters', 'cashMovements', 'stockMovements',
            'settings', 'saleReturns', 'expenses', 'payments', 'customerCreditDeposits',
            'customerCreditUses', 'productPriceHistory', 'productCostHistory',
            'supplierPayments', 'passwordResets', 'auditLogs', 'debtPaymentSessions'
        ];
        
        const exportData = {
            version: '1.0.0',
            exportedAt: new Date().toISOString(),
            businessId: businessId,
            tables: {}
        };
        
        for (const tableName of tables) {
            try {
                const rows = await dbAll(`SELECT * FROM ${tableName} WHERE business_id = ?`, [businessId]);
                exportData.tables[tableName] = rows;
            } catch (e) {
                console.warn(`[Export] Error exportando tabla ${tableName}:`, e.message);
                exportData.tables[tableName] = [];
            }
        }
        
        res.json({ success: true, data: exportData });
    } catch (err) {
        console.error('[Export] Error exportando negocio:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/sales/repair-folios', requireRole('owner', 'admin'), async (req, res) => {
    const bid = req.business_id;
    try {
        let repaired = 0;
        await withTransaction(async () => {
            const sales = await dbAll(
                "SELECT id FROM sales WHERE business_id = ? AND status != 'cancelled' ORDER BY date ASC, id ASC",
                [bid]
            );
            let num = 1;
            for (const s of sales) {
                await dbRun("UPDATE sales SET saleNumber = ? WHERE id = ? AND business_id = ?", [num++, s.id, bid]);
            }
            repaired = sales.length;
        });
        res.json({ success: true, repaired });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.post('/api/system/factory-reset', requireRole('owner'), async (req, res) => {
    const bid = req.business_id;
    try {
        await withTransaction(async () => {
            for (const table of ALLOWED_TABLES) {
                if (['users', 'businesses', 'settings'].includes(table)) continue;
                await dbRun(`DELETE FROM ${table} WHERE business_id = ?`, [bid]);
            }
        });
        res.json({ success: true });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.post('/api/migration/deduplicate-customers', requireRole('owner', 'admin'), async (req, res) => {
    const bid = req.business_id;
    try {
        let mergedCount = 0;
        await withTransaction(async () => {
            const duplicates = await dbAll(`
                SELECT name, COUNT(*) as count 
                FROM customers 
                WHERE business_id = ? 
                GROUP BY name 
                HAVING count > 1
            `, [bid]);

            for (const dup of duplicates) {
                const allWithSameName = await dbAll(`
                    SELECT id, balanceCredit FROM customers 
                    WHERE name = ? AND business_id = ? 
                    ORDER BY id DESC
                `, [dup.name, bid]);

                const winner = allWithSameName[0];
                const losers = allWithSameName.slice(1);

                let newBalanceCredit = parseFloat(winner.balanceCredit) || 0;

                for (const loser of losers) {
                    const lId = loser.id;
                    const lCred = parseFloat(loser.balanceCredit) || 0;

                    newBalanceCredit += lCred;

                    await dbRun(`UPDATE sales SET customerId = ? WHERE customerId = ? AND business_id = ?`, [winner.id, lId, bid]);
                    await dbRun(`UPDATE payments SET customerId = ? WHERE customerId = ? AND business_id = ?`, [winner.id, lId, bid]);
                    await dbRun(`UPDATE customerCreditDeposits SET customerId = ? WHERE customerId = ? AND business_id = ?`, [winner.id, lId, bid]);
                    await dbRun(`UPDATE customerCreditUses SET customerId = ? WHERE customerId = ? AND business_id = ?`, [winner.id, lId, bid]);
                    await dbRun(`UPDATE auditLogs SET entityId = ? WHERE entityId = ? AND entity = 'customer' AND business_id = ?`, [winner.id, lId, bid]);

                    await dbRun(`DELETE FROM customers WHERE id = ? AND business_id = ?`, [lId, bid]);
                    mergedCount++;
                }

                await dbRun(`UPDATE customers SET balanceCredit = ? WHERE id = ?`, [newBalanceCredit, winner.id]);
            }
        });
        res.json({ success: true, merged: mergedCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/migration/deduplicate-suppliers', requireRole('owner', 'admin'), async (req, res) => {
    const bid = req.business_id;
    try {
        let mergedCount = 0;
        await withTransaction(async () => {
            const duplicates = await dbAll(`
                SELECT name, COUNT(*) as count 
                FROM suppliers 
                WHERE business_id = ? 
                GROUP BY name 
                HAVING count > 1
            `, [bid]);

            for (const dup of duplicates) {
                const allWithSameName = await dbAll(`
                    SELECT id FROM suppliers 
                    WHERE name = ? AND business_id = ? 
                    ORDER BY id DESC
                `, [dup.name, bid]);

                const keepId = allWithSameName[0].id;
                const deleteIds = allWithSameName.slice(1).map(s => s.id);

                for (const oldId of deleteIds) {
                    await dbRun(`UPDATE purchases SET supplierId = ? WHERE supplierId = ? AND business_id = ?`, [keepId, oldId, bid]);
                    await dbRun(`UPDATE supplierPayments SET supplierId = ? WHERE supplierId = ? AND business_id = ?`, [keepId, oldId, bid]);
                    await dbRun(`DELETE FROM suppliers WHERE id = ? AND business_id = ?`, [oldId, bid]);
                    mergedCount++;
                }
            }
        });
        res.json({ success: true, merged: mergedCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/migration/import', requireRole('owner', 'admin'), async (req, res) => {
    const rawData = req.body || {};
    const data = rawData.tables ? rawData.tables : rawData;
    const bid = Number(rawData.businessId || req.body?.businessId || req.headers['x-business-id'] || req.business_id || 1);
    const shouldWipeCloud = Boolean(rawData.wipeCloud || req.body.wipeCloud);

    try {
        // Limpiar Supabase Cloud si se solicitó restauración limpia (aislado al negocio seleccionado)
        let cloudWiped = false;
        if (shouldWipeCloud && syncRouter && typeof syncRouter.cleanUserCloudData === 'function') {
            try {
                const userId = await syncRouter.resolveSupabaseUserId(req);
                if (userId) {
                    await syncRouter.cleanUserCloudData(userId, bid);
                    cloudWiped = true;
                    console.log(`[MigrationImport] 🧹 Supabase Cloud limpiado exitosamente para usuario [${userId}] (Negocio: ${bid}).`);
                }
            } catch (cwErr) {
                console.warn('[MigrationImport] ⚠️ Advertencia en limpieza previa de Supabase:', cwErr.message);
            }
        }

        // ponytail: Configurar PRAGMAs de SQLite de máxima velocidad ANTES de abrir la transacción
        await dbRun('PRAGMA synchronous = OFF;');
        await dbRun('PRAGMA journal_mode = MEMORY;');

        try {
            await withTransaction(async () => {
                // Tablas exclusivas del negocio (users, businesses y passwordResets quedan intactas por seguridad)
                // Ordenadas para que las tablas maestras se procesen antes que las dependientes
                const tables = [
                    'categories', 'customers', 'suppliers', 'products', 'purchases', 
                    'cashRegisters', 'sales', 'payments', 'cashMovements', 'expenses', 
                    'stockMovements', 'settings', 'customerCreditDeposits', 'customerCreditUses', 
                    'auditLogs', 'productPriceHistory', 'productCostHistory', 'supplierPayments', 
                    'saleReturns', 'debtPaymentSessions'
                ];

                for (const table of tables) {
                    try {
                        const tableInfo = await dbAll(`PRAGMA table_info(${table})`);
                        const hasBusinessId = tableInfo.some(info => info.name === 'business_id');
                        
                        if (hasBusinessId) {
                            await dbRun(`DELETE FROM ${table} WHERE business_id = ?`, [bid]);
                        }
                    } catch (e) { 
                        console.warn(`Error limpiando tabla ${table}:`, e.message); 
                    }
                }

                // Mapas de reasignación de IDs en caso de colisión con registros de otros negocios
                const idRemaps = {
                    categories: {},
                    customers: {},
                    suppliers: {},
                    products: {},
                    cashRegisters: {},
                    sales: {}
                };

                function normalizeIncomingItem(tableName, item, defaultBid) {
                    if (!item || typeof item !== 'object') return item;
                    const it = { ...item };
                    // Forzar siempre business_id del negocio activo
                    it.business_id = defaultBid;

                    if (tableName === 'products') {
                        const priceVal = it.price !== undefined ? it.price : (it.salePrice !== undefined ? it.salePrice : 0);
                        it.price = Number(priceVal) || 0;

                        const costVal = it.cost !== undefined ? it.cost : (it.costPrice !== undefined ? it.costPrice : 0);
                        it.cost = Number(costVal) || 0;

                        const codeVal = (it.barcode || it.code || (it.id ? String(it.id) : '')).trim();
                        it.barcode = codeVal;

                        if (!it.cloud_id && it.local_id) it.cloud_id = String(it.local_id);
                        if (it.isActive === undefined) it.isActive = it.is_deleted ? 0 : 1;
                        if (!it.category) it.category = 'General';
                        it.is_synced = 0;
                    } else if (tableName === 'categories') {
                        if (!it.name) it.name = 'General';
                        it.name = String(it.name).trim();
                        if (!it.color) it.color = '#3b82f6';
                        it.is_synced = 0;
                    } else if (tableName === 'customers') {
                        if (it.debt === undefined && it.totalDebt !== undefined) it.debt = Number(it.totalDebt) || 0;
                        if (it.credit_limit === undefined && it.creditLimit !== undefined) it.credit_limit = Number(it.creditLimit) || 0;
                    } else if (tableName === 'sales') {
                        if (!it.date && it.timestamp) it.date = it.timestamp;
                        if (!it.date && it.sale_date) it.date = it.sale_date;
                        if (!it.paymentMethod && it.payment_method) it.paymentMethod = it.payment_method;
                        if (!it.customerId && it.customer_id) it.customerId = it.customer_id;
                        if (typeof it.items === 'object' && it.items !== null) it.items = JSON.stringify(it.items);
                        it.is_synced = 0;
                    } else if (tableName === 'purchases') {
                        if (!it.date && it.purchase_date) it.date = it.purchase_date;
                        if (!it.supplierId && it.supplier_id) it.supplierId = it.supplier_id;
                        if (typeof it.items === 'object' && it.items !== null) it.items = JSON.stringify(it.items);
                    }

                    return it;
                }

                for (const table of tables) {
                    const rawItems = data[table];
                    if (rawItems && Array.isArray(rawItems) && rawItems.length > 0) {
                        const tableInfo = await dbAll(`PRAGMA table_info(${table})`);
                        const dbColumns = tableInfo.map(info => info.name);
                        const hasBusinessId = dbColumns.includes('business_id');
                        const hasId = dbColumns.includes('id');

                        // Normalizar todos los items según el contrato universal
                        const items = rawItems.map(it => normalizeIncomingItem(table, it, bid));

                        // Determinar la unión de todas las columnas válidas presentes
                        const allItemKeys = new Set();
                        items.forEach(it => Object.keys(it).forEach(k => allItemKeys.add(k)));
                        const itemColumns = Array.from(allItemKeys).filter(col => dbColumns.includes(col));

                        // Asegurar que business_id esté presente en el INSERT si la tabla lo soporta
                        if (hasBusinessId && !itemColumns.includes('business_id')) {
                            itemColumns.push('business_id');
                        }

                        if (itemColumns.length === 0) continue;

                        const placeholders = itemColumns.map(() => '?').join(',');
                        const sql = `INSERT INTO ${table} (${itemColumns.join(',')}) VALUES (${placeholders})`;

                        for (const item of items) {
                            // Reasignar llaves foráneas si los padres fueron remapeados
                            if (table === 'sales') {
                                if (item.customerId && idRemaps.customers[item.customerId]) item.customerId = idRemaps.customers[item.customerId];
                                if (item.cashRegisterId && idRemaps.cashRegisters[item.cashRegisterId]) item.cashRegisterId = idRemaps.cashRegisters[item.cashRegisterId];
                            } else if (table === 'payments' || table === 'cashMovements') {
                                if (item.saleId && idRemaps.sales[item.saleId]) item.saleId = idRemaps.sales[item.saleId];
                                if (item.cashRegisterId && idRemaps.cashRegisters[item.cashRegisterId]) item.cashRegisterId = idRemaps.cashRegisters[item.cashRegisterId];
                                if (item.customerId && idRemaps.customers[item.customerId]) item.customerId = idRemaps.customers[item.customerId];
                            } else if (table === 'purchases') {
                                if (item.supplierId && idRemaps.suppliers[item.supplierId]) item.supplierId = idRemaps.suppliers[item.supplierId];
                                if (item.cashRegisterId && idRemaps.cashRegisters[item.cashRegisterId]) item.cashRegisterId = idRemaps.cashRegisters[item.cashRegisterId];
                            } else if (table === 'expenses') {
                                if (item.cashRegisterId && idRemaps.cashRegisters[item.cashRegisterId]) item.cashRegisterId = idRemaps.cashRegisters[item.cashRegisterId];
                            } else if (table === 'stockMovements') {
                                if (item.productId && idRemaps.products[item.productId]) item.productId = idRemaps.products[item.productId];
                            }

                            // Detección y prevención de colisión de clave primaria con otro negocio
                            if (hasId && item.id !== undefined && item.id !== null) {
                                const collision = await dbGet(`SELECT id FROM ${table} WHERE id = ?`, [item.id]);
                                if (collision) {
                                    // El ID ya está ocupado por otro negocio. Obtenemos el próximo ID disponible
                                    const maxRow = await dbGet(`SELECT MAX(id) as maxId FROM ${table}`);
                                    const nextId = (maxRow?.maxId || 0) + 1;
                                    const oldId = item.id;
                                    item.id = nextId;
                                    if (idRemaps[table]) idRemaps[table][oldId] = nextId;
                                }
                            }

                            const values = itemColumns.map(col => {
                                if (col === 'business_id') return bid;
                                let val = item[col];
                                if (val === 'null' || val === 'undefined') return null;
                                if (typeof val === 'object' && val !== null) return JSON.stringify(val);
                                return val;
                            });

                            try {
                                await dbRun(sql, values);
                            } catch (e) {
                                console.error(`Error insertando en ${table}:`, e.message);
                            }
                        }
                    }
                }
            });
        } finally {
            // ponytail: Restaurar PRAGMAs a su estado optimizado de producción (WAL)
            await dbRun('PRAGMA synchronous = NORMAL;');
            await dbRun('PRAGMA journal_mode = WAL;');
        }
        res.json({ success: true, cloudWiped });
    } catch (err) {
        console.error('Error en importación masiva:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
