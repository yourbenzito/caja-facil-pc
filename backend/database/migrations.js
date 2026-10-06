const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const { db, dbGet, dbAll, dbRun } = require('./connection');

async function getTableColumns(table, targetDb = null) {
    if (targetDb) {
        return new Promise((resolve) => {
            targetDb.all(`PRAGMA table_info(${table})`, (err, rows) => {
                resolve(err || !rows ? [] : rows.map(c => c.name));
            });
        });
    }
    const info = await dbAll(`PRAGMA table_info(${table})`);
    return info.map(c => c.name);
}

async function ensureColumn(table, column, definition, targetDb = null) {
    const cols = await getTableColumns(table, targetDb);
    if (!cols.includes(column)) {
        if (targetDb) {
            await new Promise((resolve) => {
                targetDb.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`, (err) => {
                    if (!err) console.log(`[Schema] Añadida columna ${table}.${column}`);
                    resolve();
                });
            });
        } else {
            await dbRun(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
            console.log(`[Schema] Añadida columna ${table}.${column}`);
        }
    }
}

async function runSchemaMigrations(targetDb = null) {
    const runDbRun = (sql, params = []) => {
        if (targetDb) {
            return new Promise((resolve, reject) => {
                targetDb.run(sql, params, function(err) {
                    if (err) reject(err);
                    else resolve({ lastID: this ? this.lastID : 0, changes: this ? this.changes : 0 });
                });
            });
        }
        return dbRun(sql, params);
    };

    const runDbGet = (sql, params = []) => {
        if (targetDb) {
            return new Promise((resolve, reject) => {
                targetDb.get(sql, params, (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        }
        return dbGet(sql, params);
    };

    const runDbAll = (sql, params = []) => {
        if (targetDb) {
            return new Promise((resolve, reject) => {
                targetDb.all(sql, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            });
        }
        return dbAll(sql, params);
    };

    // Asegurar columna business_id en tablas críticas para targetDb
    const criticalTables = ['products', 'categories', 'customers', 'suppliers', 'sales', 'purchases', 'cashRegisters', 'cashMovements', 'stockMovements', 'users', 'auditLogs', 'settings', 'businesses'];
    for (const tableName of criticalTables) {
        try {
            await ensureColumn(tableName, 'business_id', 'INTEGER DEFAULT 1', targetDb);
        } catch (_) {}
    }

    const migrations = [
        ['sales', 'createdAt', 'TEXT'],
        ['sales', 'updatedAt', 'TEXT'],
        ['sales', 'createdBy', 'INTEGER'],
        ['sales', 'paidAt', 'TEXT'], // registrar fecha de pago
        ['customerCreditUses', 'saleNumber', 'INTEGER'],
        ['purchases', 'cashRegisterId', 'INTEGER'],
        ['purchases', 'vatMode', 'TEXT DEFAULT "net"'],
        ['purchases', 'cancelledAt', 'TEXT'],   // fecha de anulación (soft-delete)
        ['purchases', 'cancelReason', 'TEXT'],  // motivo de anulación
        ['cashRegisters', 'countedByMethod', 'JSON'], // conteo real por método al cerrar caja
        ['cashMovements', 'saleId', 'INTEGER'],
        ['cashMovements', 'expenseId', 'INTEGER'],
        ['products', 'costNeto', 'REAL'],
        ['products', 'additionalTaxesConfig', 'JSON'],
        ['businesses', 'subscription_ends_at', 'TEXT'],
        ['businesses', 'user_id', 'TEXT'],
        ['expenses', 'documentType', 'TEXT DEFAULT "comprobante_interno"'],
        ['expenses', 'documentNumber', 'TEXT'],
        ['expenses', 'paymentMethod', 'TEXT DEFAULT "cash"'],
        ['expenses', 'supplierId', 'INTEGER'],
        ['expenses', 'userId', 'INTEGER'],
        ['expenses', 'attachmentPath', 'TEXT'],
        ['products', 'cloud_id', 'TEXT'],
        ['sales', 'cloud_id', 'TEXT'],
        ['customers', 'cloud_id', 'TEXT'],
        ['customers', 'uuid', 'TEXT'],
        ['suppliers', 'cloud_id', 'TEXT'],
        ['suppliers', 'uuid', 'TEXT'],
        ['products', 'uuid', 'TEXT'],
        ['purchases', 'cloud_id', 'TEXT'],
        ['purchases', 'uuid', 'TEXT'],
        ['purchases', 'terminal_id', 'TEXT'],
        ['purchases', 'is_synced', 'INTEGER DEFAULT 0'],
        ['sales', 'uuid', 'TEXT'],
        ['sales', 'terminal_id', 'TEXT'],
        ['expenses', 'cloud_id', 'TEXT'],
        ['expenses', 'uuid', 'TEXT'],
        ['expenses', 'terminal_id', 'TEXT'],
        ['expenses', 'is_synced', 'INTEGER DEFAULT 0'],
        ['cashRegisters', 'cloud_id', 'TEXT'],
        ['cashRegisters', 'uuid', 'TEXT'],
        ['cashRegisters', 'terminal_id', 'TEXT'],
        ['cashRegisters', 'is_synced', 'INTEGER DEFAULT 0'],
        ['cashMovements', 'cloud_id', 'TEXT'],
        ['cashMovements', 'uuid', 'TEXT'],
        ['cashMovements', 'terminal_id', 'TEXT'],
        ['cashMovements', 'is_synced', 'INTEGER DEFAULT 0'],
        // Columnas de integridad UUID para abonos y cuentas de clientes
        ['payments', 'uuid', 'TEXT'],
        ['payments', 'cloud_id', 'TEXT'],
        ['payments', 'terminal_id', 'TEXT'],
        ['payments', 'is_synced', 'INTEGER DEFAULT 0'],
        ['payments', 'deleted_at', 'TEXT'],
        ['customerCreditDeposits', 'uuid', 'TEXT'],
        ['customerCreditDeposits', 'cloud_id', 'TEXT'],
        ['customerCreditDeposits', 'terminal_id', 'TEXT'],
        ['customerCreditDeposits', 'is_synced', 'INTEGER DEFAULT 0'],
        ['debtPaymentSessions', 'uuid', 'TEXT'],
        ['debtPaymentSessions', 'cloud_id', 'TEXT'],
        ['debtPaymentSessions', 'terminal_id', 'TEXT'],
        // Trazabilidad de usuarios y auditoría en movimientos
        ['stockMovements', 'userId', 'INTEGER'],
        ['stockMovements', 'userName', 'TEXT'],
        ['stockMovements', 'status', "TEXT DEFAULT 'active'"],
        ['stockMovements', 'cancelledAt', 'TEXT'],
        ['stockMovements', 'cancelledBy', 'TEXT'],
        ['stockMovements', 'cancelReason', 'TEXT'],
        ['stockMovements', 'productCode', 'TEXT'],
        ['stockMovements', 'productName', 'TEXT'],
        ['stockMovements', 'notes', 'TEXT'],
        ['stockMovements', 'createdAt', 'TEXT'],
        ['stockMovements', 'updatedAt', 'TEXT'],
        ['cashMovements', 'userId', 'INTEGER'],
        ['cashMovements', 'userName', 'TEXT'],
        // Módulo de insumos y trazabilidad en gastos
        ['expenses', 'userName', 'TEXT'],
        ['expenses', 'productId', 'INTEGER'],
        ['expenses', 'productName', 'TEXT'],
        ['expenses', 'quantity', 'REAL'],
        ['expenses', 'cost_value', 'REAL'],
        ['expenses', 'sale_value', 'REAL'],
        ['auditLogs', 'role', 'TEXT'],
        ['auditLogs', 'terminal_id', 'TEXT'],
        ['stockMovements', 'terminal_id', 'TEXT'],
        // Columnas de negocio para sincronización con Supabase business_settings
        ['businesses', 'rut', 'TEXT'],
        ['businesses', 'ticket_footer', 'TEXT'],
        // Soft deletes (Tombstones) y trazabilidad temporal para sincronización segura
        ['sales', 'deleted_at', 'TEXT'],
        ['sales', 'synced_at', 'TEXT'],
        ['products', 'deleted_at', 'TEXT'],
        ['products', 'synced_at', 'TEXT'],
        ['customers', 'deleted_at', 'TEXT'],
        ['customers', 'synced_at', 'TEXT'],
        ['categories', 'deleted_at', 'TEXT'],
        ['categories', 'synced_at', 'TEXT'],
        ['suppliers', 'deleted_at', 'TEXT'],
        ['suppliers', 'synced_at', 'TEXT'],
        ['purchases', 'deleted_at', 'TEXT'],
        ['purchases', 'synced_at', 'TEXT'],
        ['expenses', 'deleted_at', 'TEXT'],
        ['expenses', 'synced_at', 'TEXT'],
        ['cashRegisters', 'deleted_at', 'TEXT'],
        ['cashRegisters', 'synced_at', 'TEXT'],
        ['cashMovements', 'deleted_at', 'TEXT'],
        ['cashMovements', 'synced_at', 'TEXT'],
        ['stockMovements', 'deleted_at', 'TEXT'],
        ['stockMovements', 'synced_at', 'TEXT'],
        ['supplierPayments', 'uuid', 'TEXT'],
        ['supplierPayments', 'is_synced', 'INTEGER DEFAULT 0'],
        ['supplierPayments', 'deleted_at', 'TEXT'],
        ['supplierPayments', 'synced_at', 'TEXT'],
        // Sistema de Vinculación de Sucursales y Permisos Granulares de Personal
        ['businesses', 'join_code', 'TEXT'],
        ['staff', 'permissions', 'TEXT DEFAULT \'{"posSales":true,"discounts":true,"voidSales":false,"modifyCatalog":false,"purchases":false,"expenses":true,"credits":false,"reportsProfit":false}\'']
    ];
    for (const [table, col, def] of migrations) {
        try { 
            await ensureColumn(table, col, def, targetDb); 
        } catch (e) { 
            console.warn(`[Schema] Migración ${table}.${col}:`, e.message); 
        }
    }

    // Migración de datos históricos para la columna paidAt
    try {
        const unmigratedCount = await runDbGet("SELECT count(*) as count FROM sales WHERE paidAt IS NULL AND (status = 'completed' OR status = 'paid')");
        if (unmigratedCount && unmigratedCount.count > 0) {
            console.log(`[Schema] Migrando paidAt para ${unmigratedCount.count} ventas históricas...`);
            // Primero: ventas con pagos registrados
            await runDbRun(`
                UPDATE sales SET paidAt = (
                    SELECT date FROM payments WHERE payments.saleId = sales.id ORDER BY date DESC LIMIT 1
                ) WHERE paidAt IS NULL AND (status = 'completed' OR status = 'paid') AND id IN (
                    SELECT DISTINCT saleId FROM payments
                )
            `);
            // Segundo: ventas sin pagos (al contado) - usar fecha de creación
            await runDbRun(`
                UPDATE sales SET paidAt = date
                WHERE paidAt IS NULL AND (status = 'completed' OR status = 'paid')
            `);
            console.log(`[Schema] Migración de paidAt completada con éxito.`);
        }
    } catch (e) {
        console.warn('[Schema] Error en migración histórica de paidAt:', e.message);
    }

    // Migración: poblar costNeto para productos importados de backups antiguos
    try {
        const result = await runDbRun(
            "UPDATE products SET costNeto = ROUND(CAST(cost AS REAL) / 1.19, 2) WHERE costNeto IS NULL AND cost IS NOT NULL AND cost > 0"
        );
        if (result && result.changes > 0) {
            console.log(`[Schema] costNeto calculado para ${result.changes} productos desde backup antiguo`);
        }
    } catch (e) {
        console.warn('[Schema] Error en migración de costNeto:', e.message);
    }

    // Migración de UUIDs únicos para pagos y depósitos históricos
    try {
        const unmigratedPayments = await runDbAll("SELECT id FROM payments WHERE uuid IS NULL OR uuid = ''");
        if (unmigratedPayments && unmigratedPayments.length > 0) {
            for (const p of unmigratedPayments) {
                const u = 'pay_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
                await runDbRun("UPDATE payments SET uuid = ? WHERE id = ?", [u, p.id]);
            }
            console.log(`[Schema] UUIDs asignados a ${unmigratedPayments.length} pagos históricos.`);
        }
        const unmigratedDeposits = await runDbAll("SELECT id FROM customerCreditDeposits WHERE uuid IS NULL OR uuid = ''");
        if (unmigratedDeposits && unmigratedDeposits.length > 0) {
            for (const d of unmigratedDeposits) {
                const u = 'dep_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
                await runDbRun("UPDATE customerCreditDeposits SET uuid = ? WHERE id = ?", [u, d.id]);
            }
            console.log(`[Schema] UUIDs asignados a ${unmigratedDeposits.length} depósitos históricos.`);
        }
    } catch (e) {
        console.warn('[Schema] Error en migración de UUIDs de pagos/depósitos:', e.message);
    }

    // Crear índice de idempotency para ventas
    try {
        await runDbRun("CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_idempotency ON sales(business_id, idempotencyKey) WHERE idempotencyKey IS NOT NULL AND idempotencyKey != ''");
    } catch(e) {
        console.warn('[Schema] Índice idempotency:', e.message);
    }

    // Crear índices de rendimiento para Notas de Crédito (devoluciones)
    try {
        await runDbRun("CREATE INDEX IF NOT EXISTS idx_saleReturns_business_date ON saleReturns(business_id, date)");
        await runDbRun("CREATE INDEX IF NOT EXISTS idx_saleReturns_saleId ON saleReturns(saleId)");
        console.log('[Schema] Índices para saleReturns creados.');
    } catch (e) {
        console.warn('[Schema] Error asegurando índices de saleReturns:', e.message);
    }

    // ponytail: Crear índice único para categories por negocio y nombre para blindar contra duplicados
    try {
        await runDbRun("CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_unique_name ON categories(business_id, LOWER(name))");
        console.log('[Schema] Índice único para categories creado.');
    } catch (e) {
        console.warn('[Schema] Error asegurando índice único de categories:', e.message);
    }

    // Migración: Autolimpieza de compras con saldos residuales decimales/insignificantes (<= $2.5 CLP)
    try {
        const residualPurchases = await runDbAll(
            "SELECT id, total, paidAmount FROM purchases WHERE status = 'pending' AND (CAST(total AS REAL) - CAST(paidAmount AS REAL)) <= 2.5 AND (CAST(total AS REAL) - CAST(paidAmount AS REAL)) >= 0"
        );
        if (residualPurchases && residualPurchases.length > 0) {
            console.log(`[Schema] Autolimpiando ${residualPurchases.length} compras con saldo residual <= $2.5 CLP...`);
            for (const p of residualPurchases) {
                await runDbRun(
                    "UPDATE purchases SET paidAmount = total, status = 'paid' WHERE id = ?",
                    [p.id]
                );
            }
            console.log('[Schema] Compras autolimpiadas a estado "paid".');
        }
    } catch (e) {
        console.warn('[Schema] Error en autolimpieza de saldos residuales de compras:', e.message);
    }

    try {
        // Migración: Autolimpieza de cajas abiertas huérfanas anteriores a la última caja cerrada
        try {
            const lastClosed = await runDbGet("SELECT id, openDate, closeDate FROM cashRegisters WHERE status = 'closed' ORDER BY id DESC LIMIT 1");
            if (lastClosed && lastClosed.id) {
                const orphaned = await runDbAll(
                    "SELECT id FROM cashRegisters WHERE status = 'open' AND id < ?",
                    [lastClosed.id]
                );
                if (orphaned && orphaned.length > 0) {
                    console.log(`[Schema] Autolimpiando ${orphaned.length} cajas abiertas huérfanas previas al cierre ID ${lastClosed.id}...`);
                    await runDbRun(
                        "UPDATE cashRegisters SET status = 'closed', closeDate = COALESCE(openDate, datetime('now')), is_synced = 0 WHERE status = 'open' AND id < ?",
                        [lastClosed.id]
                    );
                    console.log('[Schema] Cajas huérfanas marcadas como cerradas.');
                }
            }
        } catch (e) {
            console.warn('[Schema] Error en autolimpieza de cajas huérfanas:', e.message);
        }

        // Eliminar índice UNIQUE antiguo en solo username si existe (causa conflicto con multi-negocio)
        await runDbRun("DROP INDEX IF EXISTS idx_users_username");
    } catch (e) {
        console.warn('[Schema] Error eliminando índice antiguo idx_users_username:', e.message);
    }

    // Migración agresiva: eliminar cualquier índice UNIQUE en solo username que pueda existir
    try {
        const indexes = await runDbAll("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='users'");
        for (const idx of indexes) {
            const idxName = idx.name;
            const idxSql = idx.sql || '';
            if (idxSql.includes('UNIQUE') && idxSql.includes('username') && !idxSql.includes('business_id')) {
                console.log(`[Schema] Eliminando índice UNIQUE antiguo en solo username: ${idxName}`);
                await runDbRun(`DROP INDEX IF EXISTS ${idxName}`);
            }
        }
    } catch (e) {
        console.warn('[Schema] Error en migración agresiva de índices:', e.message);
    }

    // Migración extrema: recrear tabla users si tiene constraint UNIQUE en username
    try {
        const tableDDL = await runDbGet("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'");
        if (tableDDL && tableDDL.sql) {
            const sql = tableDDL.sql;
            if (sql.includes('UNIQUE') && sql.includes('username') && !sql.includes('business_id')) {
                console.log('[Schema] Detectada constraint UNIQUE en username en definición de tabla. Recreando tabla...');
                await runDbRun(`CREATE TABLE IF NOT EXISTS users_backup (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL,
                    password TEXT,
                    role TEXT,
                    phone TEXT,
                    createdAt TEXT,
                    updatedAt TEXT,
                    recoveryCode TEXT,
                    recoveryCodeGeneratedAt TEXT,
                    business_id INTEGER DEFAULT 1
                )`);
                await runDbRun(`INSERT INTO users_backup SELECT * FROM users`);
                await runDbRun('DROP TABLE users');
                await runDbRun('ALTER TABLE users_backup RENAME TO users');
                console.log('[Schema] Tabla users recreada sin constraint UNIQUE en username');
            }
        }
    } catch (e) {
        console.warn('[Schema] Error en migración extrema de tabla users:', e.message);
    }

    try {
        await runDbRun("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_business ON users(username, business_id)");
        await runDbRun("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_business ON users(phone, business_id)");
    } catch (e) { /* legacy DB con UNIQUE global */ }

    // Crear tabla loginAttempts para límite de intentos fallidos
    try {
        await runDbRun(`CREATE TABLE IF NOT EXISTS loginAttempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            identifier TEXT NOT NULL,
            attemptCount INTEGER DEFAULT 0,
            lastAttemptAt TEXT,
            lockedUntil TEXT,
            business_id INTEGER DEFAULT 1
        )`);
        await runDbRun("CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON loginAttempts(identifier)");
        await runDbRun("CREATE INDEX IF NOT EXISTS idx_login_attempts_business ON loginAttempts(business_id)");
        console.log('[Schema] Tabla loginAttempts creada.');
    } catch (e) {
        console.warn('[Schema] Error creando tabla loginAttempts:', e.message);
    }

    // Migrar settings a PK compuesta (key, business_id)
    try {
        const settingsDDL = await runDbGet("SELECT sql FROM sqlite_master WHERE type='table' AND name='settings'");
        if (settingsDDL && settingsDDL.sql && !settingsDDL.sql.includes('PRIMARY KEY (key, business_id)')) {
            console.log('[Schema] Migrando tabla settings a PK compuesta...');
            await runDbRun(`CREATE TABLE IF NOT EXISTS settings_new (
                key TEXT NOT NULL, value JSON, business_id INTEGER NOT NULL DEFAULT 1,
                PRIMARY KEY (key, business_id)
            )`);
            await runDbRun(`INSERT OR IGNORE INTO settings_new (key, value, business_id)
                SELECT key, value, COALESCE(business_id, 1) FROM settings`);
            await runDbRun('DROP TABLE settings');
            await runDbRun('ALTER TABLE settings_new RENAME TO settings');
        }
    } catch (e) { 
        console.warn('[Schema] Migración settings:', e.message); 
    }

    // Crear tabla debtPaymentSessions para registro de pagos de deudas de clientes
    try {
        await runDbRun(`CREATE TABLE IF NOT EXISTS debtPaymentSessions (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            customerId     TEXT NOT NULL,
            date           TEXT NOT NULL,
            totalPaid      REAL DEFAULT 0,
            totalDebt      REAL DEFAULT 0,
            discount       REAL DEFAULT 0,
            methods        TEXT,
            salesData      TEXT,
            notes          TEXT,
            cashRegisterId INTEGER,
            business_id    INTEGER DEFAULT 1
        )`);
        console.log('[Schema] Tabla debtPaymentSessions lista.');
    } catch (e) { 
        console.warn('[Schema] debtPaymentSessions:', e.message); 
    }

    // Migración: Asegurar la existencia de Proveedor Genérico
    try {
        const genericSupplier = await runDbGet("SELECT id FROM suppliers WHERE (name LIKE '%Genérico%' OR name LIKE '%Varios%' OR id = 1) LIMIT 1");
        if (!genericSupplier) {
            await runDbRun(`
                INSERT OR IGNORE INTO suppliers (id, name, contact, phone, email, address, business_id)
                VALUES (1, 'Proveedor Genérico / Varios', 'Varios', '', '', '', 1)
            `);
            console.log('[Schema] Proveedor Genérico / Varios creado automáticamente.');
        }
    } catch (e) {
        console.warn('[Schema] Error asegurando Proveedor Genérico:', e.message);
    }

    // Migración: Índices de rendimiento para sincronización delta y UUID
    try {
        await runDbRun("CREATE INDEX IF NOT EXISTS idx_purchases_uuid ON purchases(uuid)");
        await runDbRun("CREATE INDEX IF NOT EXISTS idx_purchases_is_synced ON purchases(is_synced)");
        await runDbRun("CREATE INDEX IF NOT EXISTS idx_sales_uuid ON sales(uuid)");
        await runDbRun("CREATE INDEX IF NOT EXISTS idx_sales_is_synced ON sales(is_synced)");
        await runDbRun("CREATE INDEX IF NOT EXISTS idx_expenses_uuid ON expenses(uuid)");
        await runDbRun("CREATE INDEX IF NOT EXISTS idx_expenses_is_synced ON expenses(is_synced)");
        await runDbRun("CREATE INDEX IF NOT EXISTS idx_cash_registers_uuid ON cashRegisters(uuid)");
        await runDbRun("CREATE INDEX IF NOT EXISTS idx_cash_registers_is_synced ON cashRegisters(is_synced)");
        await runDbRun("CREATE INDEX IF NOT EXISTS idx_cash_movements_uuid ON cashMovements(uuid)");
        await runDbRun("CREATE INDEX IF NOT EXISTS idx_cash_movements_is_synced ON cashMovements(is_synced)");
        await runDbRun("CREATE INDEX IF NOT EXISTS idx_supplier_payments_uuid ON supplierPayments(uuid)");
        await runDbRun("CREATE INDEX IF NOT EXISTS idx_supplier_payments_is_synced ON supplierPayments(is_synced)");
    } catch (e) {
        console.warn('[Schema] Error creando índices delta:', e.message);
    }

    // Asegurar tabla staff para control de cajeros y roles POS
    try {
        await runDbRun(`CREATE TABLE IF NOT EXISTS staff (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            pin TEXT NOT NULL DEFAULT '0000',
            role TEXT NOT NULL DEFAULT 'cashier',
            permissions TEXT DEFAULT '{"posSales":true,"discounts":true,"voidSales":false,"modifyCatalog":false,"purchases":false,"expenses":true,"credits":false,"reportsProfit":false}',
            branch_code TEXT DEFAULT '1',
            business_id INTEGER DEFAULT 1,
            is_active INTEGER DEFAULT 1,
            is_deleted INTEGER DEFAULT 0,
            cloud_id TEXT,
            uuid TEXT,
            is_synced INTEGER DEFAULT 0,
            createdAt TEXT,
            updatedAt TEXT
        )`);
        await runDbRun("CREATE INDEX IF NOT EXISTS idx_staff_business ON staff(business_id)");
        await runDbRun("CREATE INDEX IF NOT EXISTS idx_staff_pin ON staff(pin)");
    } catch (e) {
        console.warn('[Schema] Error asegurando tabla staff:', e.message);
    }
}

/**
 * Recorre y aplica todas las migraciones a cualquier base de datos física de negocio (database_biz_N.sqlite)
 */
async function migrateAllBusinessDatabases() {
    try {
        const { DATA_DIR } = require('./connection');
        if (!DATA_DIR || !fs.existsSync(DATA_DIR)) return;
        const files = fs.readdirSync(DATA_DIR).filter(f => f.startsWith('database_biz_') && f.endsWith('.sqlite'));
        for (const file of files) {
            const fullPath = path.join(DATA_DIR, file);
            await new Promise((resolve) => {
                const branchDb = new sqlite3.Database(fullPath, async (err) => {
                    if (err) {
                        console.warn(`[Schema] No se pudo abrir ${file} para migración:`, err.message);
                        return resolve();
                    }
                    try {
                        await runSchemaMigrations(branchDb);
                        console.log(`[Schema] ✅ Migraciones automáticas aplicadas con éxito a ${file}`);
                    } catch (migErr) {
                        console.warn(`[Schema] Error migrando ${file}:`, migErr.message);
                    } finally {
                        branchDb.close(() => resolve());
                    }
                });
            });
        }
    } catch (err) {
        console.warn('[Schema] Error en migrateAllBusinessDatabases:', err.message);
    }
}

async function initDatabaseSchema() {
    try {
        const tablesCount = await dbGet("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
        if (tablesCount.count === 0) {
            console.log('[Schema] BD Vacía. Inicializando desde schema.sql...');
            // schema.sql está en el nivel del backend (un nivel arriba)
            const schemaPath = path.join(__dirname, '..', 'schema.sql');
            if (fs.existsSync(schemaPath)) {
                const schema = fs.readFileSync(schemaPath, 'utf8');
                await new Promise((resolve, reject) => {
                    db.exec(schema, (err) => {
                        if (err) {
                            console.error('[Schema] Error inicializando schema.sql:', err.message);
                            reject(err);
                        } else {
                            console.log('[Schema] BD Inicializada correctamente.');
                            resolve();
                        }
                    });
                });
                await dbRun("INSERT OR REPLACE INTO settings (key, value, business_id) VALUES ('schema_version', '1', 1)");
            }
        } else {
            // Verificar si hay migraciones pendientes
            const migrationVersion = await dbGet("SELECT value FROM settings WHERE key = 'schema_version' AND business_id = 1");
            const currentVersion = migrationVersion ? parseInt(migrationVersion.value) : 0;
            const TARGET_VERSION = 3;

            if (currentVersion < TARGET_VERSION) {
                console.log(`[Schema] Versión actual: ${currentVersion}, ejecutando migraciones...`);
                // Asegurar columna business_id
                const criticalTables = ['products', 'categories', 'customers', 'suppliers', 'sales', 'purchases', 'cashRegisters', 'cashMovements', 'stockMovements', 'users', 'auditLogs', 'settings', 'businesses'];
                for (const tableName of criticalTables) {
                    try {
                        const cols = await getTableColumns(tableName);
                        if (!cols.includes('business_id')) {
                            console.log(`[Schema]  Añadiendo business_id a tabla ${tableName}...`);
                            await dbRun(`ALTER TABLE ${tableName} ADD COLUMN business_id INTEGER DEFAULT 1`);
                        }
                    } catch (e) {}
                }
                await runSchemaMigrations();
                await dbRun("INSERT OR REPLACE INTO settings (key, value, business_id) VALUES ('schema_version', ?, 1)", [TARGET_VERSION]);
                console.log(`[Schema] Migraciones completadas. Versión actualizada a ${TARGET_VERSION}.`);
            } else {
                // Asegurar siempre la verificación defensiva de columnas en el arranque
                await runSchemaMigrations();
                console.log('[Schema] Esquema actualizado y verificado.');
            }
        }

        // Migrar todas las bases de datos de sucursales existentes en DATA_DIR
        await migrateAllBusinessDatabases();
    } catch (e) {
        console.error('[Schema] Error en inicialización del esquema:', e.message);
    }
}

module.exports = {
    runSchemaMigrations,
    migrateAllBusinessDatabases,
    initDatabaseSchema
};
