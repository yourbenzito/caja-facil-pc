const fs = require('fs');
const path = require('path');
const { db, dbGet, dbAll, dbRun } = require('./connection');

async function getTableColumns(table) {
    const info = await dbAll(`PRAGMA table_info(${table})`);
    return info.map(c => c.name);
}

async function ensureColumn(table, column, definition) {
    const cols = await getTableColumns(table);
    if (!cols.includes(column)) {
        await dbRun(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        console.log(`[Schema] Añadida columna ${table}.${column}`);
    }
}

async function runSchemaMigrations() {
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
        ['cashMovements', 'saleId', 'INTEGER'],
        ['cashMovements', 'expenseId', 'INTEGER'],
        ['products', 'costNeto', 'REAL'],
    ];
    for (const [table, col, def] of migrations) {
        try { 
            await ensureColumn(table, col, def); 
        } catch (e) { 
            console.warn(`[Schema] Migración ${table}.${col}:`, e.message); 
        }
    }

    // Migración de datos históricos para la columna paidAt
    try {
        const unmigratedCount = await dbGet("SELECT count(*) as count FROM sales WHERE paidAt IS NULL AND (status = 'completed' OR status = 'paid')");
        if (unmigratedCount.count > 0) {
            console.log(`[Schema] Migrando paidAt para ${unmigratedCount.count} ventas históricas...`);
            // Primero: ventas con pagos registrados
            await dbRun(`
                UPDATE sales SET paidAt = (
                    SELECT date FROM payments WHERE payments.saleId = sales.id ORDER BY date DESC LIMIT 1
                ) WHERE paidAt IS NULL AND (status = 'completed' OR status = 'paid') AND id IN (
                    SELECT DISTINCT saleId FROM payments
                )
            `);
            // Segundo: ventas sin pagos (al contado) - usar fecha de creación
            await dbRun(`
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
        const result = await dbRun(
            "UPDATE products SET costNeto = ROUND(CAST(cost AS REAL) / 1.19, 2) WHERE costNeto IS NULL AND cost IS NOT NULL AND cost > 0"
        );
        if (result.changes > 0) {
            console.log(`[Schema] costNeto calculado para ${result.changes} productos desde backup antiguo`);
        }
    } catch (e) {
        console.warn('[Schema] Error en migración de costNeto:', e.message);
    }

    // Crear índice de idempotency para ventas
    try {
        await dbRun("CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_idempotency ON sales(business_id, idempotencyKey) WHERE idempotencyKey IS NOT NULL AND idempotencyKey != ''");
    } catch(e) {
        console.warn('[Schema] Índice idempotency:', e.message);
    }

    // Crear índices de rendimiento para Notas de Crédito (devoluciones)
    try {
        await dbRun("CREATE INDEX IF NOT EXISTS idx_saleReturns_business_date ON saleReturns(business_id, date)");
        await dbRun("CREATE INDEX IF NOT EXISTS idx_saleReturns_saleId ON saleReturns(saleId)");
        console.log('[Schema] Índices para saleReturns creados.');
    } catch (e) {
        console.warn('[Schema] Error asegurando índices de saleReturns:', e.message);
    }

    try {
        // Eliminar índice UNIQUE antiguo en solo username si existe (causa conflicto con multi-negocio)
        await dbRun("DROP INDEX IF EXISTS idx_users_username");
    } catch (e) {
        console.warn('[Schema] Error eliminando índice antiguo idx_users_username:', e.message);
    }

    // Migración agresiva: eliminar cualquier índice UNIQUE en solo username que pueda existir
    try {
        const indexes = await dbAll("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='users'");
        for (const idx of indexes) {
            const idxName = idx.name;
            const idxSql = idx.sql || '';
            if (idxSql.includes('UNIQUE') && idxSql.includes('username') && !idxSql.includes('business_id')) {
                console.log(`[Schema] Eliminando índice UNIQUE antiguo en solo username: ${idxName}`);
                await dbRun(`DROP INDEX IF EXISTS ${idxName}`);
            }
        }
    } catch (e) {
        console.warn('[Schema] Error en migración agresiva de índices:', e.message);
    }

    // Migración extrema: recrear tabla users si tiene constraint UNIQUE en username
    try {
        const tableDDL = await dbGet("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'");
        if (tableDDL && tableDDL.sql) {
            const sql = tableDDL.sql;
            if (sql.includes('UNIQUE') && sql.includes('username') && !sql.includes('business_id')) {
                console.log('[Schema] Detectada constraint UNIQUE en username en definición de tabla. Recreando tabla...');
                await dbRun(`CREATE TABLE IF NOT EXISTS users_backup (
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
                await dbRun(`INSERT INTO users_backup SELECT * FROM users`);
                await dbRun('DROP TABLE users');
                await dbRun('ALTER TABLE users_backup RENAME TO users');
                console.log('[Schema] Tabla users recreada sin constraint UNIQUE en username');
            }
        }
    } catch (e) {
        console.warn('[Schema] Error en migración extrema de tabla users:', e.message);
    }

    try {
        await dbRun("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_business ON users(username, business_id)");
        await dbRun("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_business ON users(phone, business_id)");
    } catch (e) { /* legacy DB con UNIQUE global */ }

    // Crear tabla loginAttempts para límite de intentos fallidos
    try {
        await dbRun(`CREATE TABLE IF NOT EXISTS loginAttempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            identifier TEXT NOT NULL,
            attemptCount INTEGER DEFAULT 0,
            lastAttemptAt TEXT,
            lockedUntil TEXT,
            business_id INTEGER DEFAULT 1
        )`);
        await dbRun("CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON loginAttempts(identifier)");
        await dbRun("CREATE INDEX IF NOT EXISTS idx_login_attempts_business ON loginAttempts(business_id)");
        console.log('[Schema] Tabla loginAttempts creada.');
    } catch (e) {
        console.warn('[Schema] Error creando tabla loginAttempts:', e.message);
    }

    // Migrar settings a PK compuesta (key, business_id)
    try {
        const settingsDDL = await dbGet("SELECT sql FROM sqlite_master WHERE type='table' AND name='settings'");
        if (settingsDDL && settingsDDL.sql && !settingsDDL.sql.includes('PRIMARY KEY (key, business_id)')) {
            console.log('[Schema] Migrando tabla settings a PK compuesta...');
            await dbRun(`CREATE TABLE IF NOT EXISTS settings_new (
                key TEXT NOT NULL, value JSON, business_id INTEGER NOT NULL DEFAULT 1,
                PRIMARY KEY (key, business_id)
            )`);
            await dbRun(`INSERT OR IGNORE INTO settings_new (key, value, business_id)
                SELECT key, value, COALESCE(business_id, 1) FROM settings`);
            await dbRun('DROP TABLE settings');
            await dbRun('ALTER TABLE settings_new RENAME TO settings');
        }
    } catch (e) { 
        console.warn('[Schema] Migración settings:', e.message); 
    }

    // Crear tabla debtPaymentSessions para registro de pagos de deudas de clientes
    try {
        await dbRun(`CREATE TABLE IF NOT EXISTS debtPaymentSessions (
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
                db.exec(schema, async (err) => {
                    if (err) {
                        console.error('[Schema] Error inicializando:', err.message);
                    } else {
                        console.log('[Schema] BD Inicializada correctamente.');
                        await dbRun("INSERT OR REPLACE INTO settings (key, value, business_id) VALUES ('schema_version', '1', 1)");
                    }
                });
            }
        } else {
            // Verificar si hay migraciones pendientes
            const migrationVersion = await dbGet("SELECT value FROM settings WHERE key = 'schema_version' AND business_id = 1");
            const currentVersion = migrationVersion ? parseInt(migrationVersion.value) : 0;
            const TARGET_VERSION = 1;

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
                console.log('[Schema] Esquema actualizado. Saltando migraciones.');
            }
        }
    } catch (e) {
        console.error('[Schema] Error en inicialización del esquema:', e.message);
    }
}

module.exports = {
    runSchemaMigrations,
    initDatabaseSchema
};
