const express = require('express');
const router = express.Router();
const os = require('os');
const { dbGet, dbRun, dbAll, withTransaction } = require('../database/connection');
const { getLastActivity } = require('../database/connection');
const { requireRole } = require('../middleware/auth');

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

router.post('/api/migration/import', requireRole('owner'), async (req, res) => {
    const data = req.body;
    const bid = req.business_id;
    try {
        // ponytail: Configurar PRAGMAs de SQLite de máxima velocidad ANTES de abrir la transacción
        await dbRun('PRAGMA synchronous = OFF;');
        await dbRun('PRAGMA journal_mode = MEMORY;');

        try {
            await withTransaction(async () => {
                const tables = [
                    'products', 'categories', 'sales', 'customers', 'suppliers', 'purchases', 
                    'expenses', 'cashRegisters', 'cashMovements', 'stockMovements', 'settings', 'users', 
                    'payments', 'customerCreditDeposits', 'customerCreditUses', 'auditLogs', 
                    'productPriceHistory', 'productCostHistory', 'supplierPayments', 'saleReturns', 'passwordResets',
                    'businesses', 'debtPaymentSessions'
                ];

                for (const table of tables) {
                    try {
                        const tableInfo = await dbAll(`PRAGMA table_info(${table})`);
                        const hasBusinessId = tableInfo.some(info => info.name === 'business_id');
                        
                        if (hasBusinessId) {
                            await dbRun(`DELETE FROM ${table} WHERE business_id = ?`, [bid]);
                        } else if (table === 'businesses') {
                            await dbRun(`DELETE FROM businesses WHERE id = ?`, [bid]);
                        }
                    } catch (e) { 
                        console.warn(`Error limpiando tabla ${table}:`, e.message); 
                    }
                }

                for (const table of tables) {
                    const items = data[table];
                    if (items && Array.isArray(items) && items.length > 0) {
                        const tableInfo = await dbAll(`PRAGMA table_info(${table})`);
                        const dbColumns = tableInfo.map(info => info.name);
                        
                        // ponytail: Pre-compilar el SQL una única vez por tabla para no sobrecargar el compilador de SQLite
                        const sampleItem = items[0];
                        const itemColumns = Object.keys(sampleItem).filter(col => dbColumns.includes(col));
                        
                        if (itemColumns.length === 0) continue;
                        
                        const placeholders = itemColumns.map(() => '?').join(',');
                        const sql = `INSERT INTO ${table} (${itemColumns.join(',')}) VALUES (${placeholders})`;

                        for (const item of items) {
                            const values = itemColumns.map(col => {
                                let val = item[col];
                                if (col === 'business_id') return bid;
                                if (val === 'null' || val === 'undefined') return null; // Limpiar 'null' strings a NULL de base de datos
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
            // ponytail: Restaurar PRAGMAs a su estado optimizado de producción (WAL) DESPUÉS de que la transacción se haya cerrado
            await dbRun('PRAGMA synchronous = NORMAL;');
            await dbRun('PRAGMA journal_mode = WAL;');
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Error en importación masiva:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
