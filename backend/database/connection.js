const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

// Detección de empaquetado
const IS_PACKAGED = __dirname.includes('.asar');

let DATA_DIR;
try {
    if (IS_PACKAGED) {
        const { app: electronApp } = require('electron');
        DATA_DIR = path.join(electronApp.getPath('userData'), 'data');
        console.log('[DB] Modo .exe instalado: userData =>', DATA_DIR);
    } else {
        // En desarrollo (npm start), __dirname es /backend/database. Subimos un nivel para llegar a /backend/data.
        DATA_DIR = path.join(__dirname, '..', 'data');
        console.log('[DB] Modo desarrollo: directorio local =>', DATA_DIR);
    }
} catch (e) {
    DATA_DIR = path.join(__dirname, '..', 'data');
    console.log('[DB] Fallback: directorio local =>', DATA_DIR);
}

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const dbPath = path.join(DATA_DIR, 'database.sqlite');

// ponytail: Copiar la base de datos local de desarrollo al directorio userData en producción si aún no se ha creado
if (IS_PACKAGED && !fs.existsSync(dbPath)) {
    try {
        const candidate1 = path.join(__dirname, '..', 'data', 'database.sqlite').replace('app.asar', 'app.asar.unpacked');
        const candidate2 = path.join(__dirname, '..', 'data', 'database.sqlite');
        const sourceDb = fs.existsSync(candidate1) ? candidate1 : (fs.existsSync(candidate2) ? candidate2 : null);
        if (sourceDb) {
            fs.copyFileSync(sourceDb, dbPath);
            console.log('[DB] Base de datos de desarrollo copiada exitosamente a userData:', dbPath);
        }
    } catch (copyErr) {
        console.warn('[DB] No se pudo copiar la BD inicial:', copyErr.message);
    }
}

let lastActivity = Date.now();

// Conexión por defecto
const defaultDb = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('DB Error:', err.message);
    } else { 
        defaultDb.run("PRAGMA foreign_keys = ON"); 
        defaultDb.run("PRAGMA journal_mode = WAL");
        defaultDb.run("PRAGMA synchronous = NORMAL");
        defaultDb.run("PRAGMA busy_timeout = 10000"); // Esperar hasta 10s si la DB está ocupada
        defaultDb.run("PRAGMA cache_size = -64000");  // 64MB de caché en memoria RAM
        defaultDb.run("PRAGMA temp_store = MEMORY");
        console.log('SQLite Core: Optimizado (WAL + BusyTimeout 10s + Cache 64MB + Synchronous NORMAL + FK)');
        createDailyPhysicalBackup();
    }
});

let currentDb = defaultDb;
let activeUserId = null;
const userConnections = new Map();

function getActiveDb() {
    return currentDb || defaultDb;
}

function getActiveUserId() {
    return activeUserId;
}

// Proxy transparente para exportar `db` que redirige a la base de datos activa
const db = new Proxy({}, {
    get(target, prop) {
        const active = getActiveDb();
        const value = active[prop];
        if (typeof value === 'function') {
            return value.bind(active);
        }
        return value;
    },
    set(target, prop, value) {
        getActiveDb()[prop] = value;
        return true;
    }
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => { 
    getActiveDb().get(sql, params, (err, row) => err ? reject(err) : resolve(row)); 
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => { 
    getActiveDb().all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)); 
});

const dbRunSilent = (sql, params = []) => new Promise((resolve, reject) => { 
    getActiveDb().run(sql, params, function(err) { 
        if (err) {
            console.error('SQL Error (Silent):', sql, params, err.message);
            reject(err);
        } else { 
            resolve(this); 
        } 
    }); 
});

const dbRun = (sql, params = []) => new Promise((resolve, reject) => { 
    getActiveDb().run(sql, params, function(err) { 
        if (err) {
            console.error('SQL Error:', sql, params, err.message);
            reject(err);
        } else { 
            lastActivity = Date.now(); 
            resolve(this); 
        } 
    }); 
});

let txQueue = Promise.resolve();
let transactionDepth = 0;

// Cola de transacciones con soporte de Savepoints anidados (Anti-Deadlock + Atomicidad total)
async function withTransaction(callback) {
    // Si ya estamos dentro de una transacción en curso en esta cola, ejecutar directamente con Savepoint sin re-encolar
    if (transactionDepth > 0) {
        const spName = `sp_${transactionDepth}`;
        await dbRun(`SAVEPOINT ${spName}`);
        transactionDepth++;
        try {
            const result = await callback();
            transactionDepth--;
            await dbRun(`RELEASE SAVEPOINT ${spName}`);
            return result;
        } catch (err) {
            transactionDepth--;
            try { await dbRun(`ROLLBACK TO SAVEPOINT ${spName}`); } catch (_) {}
            throw err;
        }
    }

    // Transacción raíz: serializada en la cola de escrituras
    const runInQueue = async () => {
        await dbRun('BEGIN IMMEDIATE');
        transactionDepth = 1;
        try {
            const result = await callback();
            transactionDepth = 0;
            await dbRun('COMMIT');
            return result;
        } catch (err) {
            transactionDepth = 0;
            try { await dbRun('ROLLBACK'); } catch (_) {}
            throw err;
        }
    };

    const current = txQueue.then(runInQueue, runInQueue);
    txQueue = current.catch(() => {});
    return current;
}

async function getTableColumns(table) {
    const info = await dbAll(`PRAGMA table_info(${table})`);
    return info.map(c => c.name);
}

function filterToColumns(obj, allowedCols) {
    const out = {};
    for (const k of Object.keys(obj)) {
        if (allowedCols.includes(k)) out[k] = obj[k];
    }
    return out;
}

let activeBusinessId = 1;
const businessConnections = new Map();

/**
 * Conecta y activa la base de datos SQLite exclusiva para un negocio específico (Aislamiento Físico).
 * Negocio 1 (o por defecto) usa database.sqlite preservando datos históricos.
 * Negocio N (N > 1) usa database_biz_${businessId}.sqlite.
 * Si es nuevo, se inicializa automáticamente desde schema.sql para arrancar 100% limpio (0 clientes, 0 productos, 0 ventas).
 */
async function switchBusinessDatabase(businessId) {
    const bid = Number(businessId) || 1;
    if (bid <= 1) {
        currentDb = defaultDb;
        activeBusinessId = 1;
        return defaultDb;
    }

    if (businessConnections.has(bid)) {
        currentDb = businessConnections.get(bid);
        activeBusinessId = bid;
        return currentDb;
    }

    const bizDbPath = path.join(DATA_DIR, `database_biz_${bid}.sqlite`);
    const isNew = !fs.existsSync(bizDbPath);

    return new Promise((resolve) => {
        const newDb = new sqlite3.Database(bizDbPath, (err) => {
            if (err) {
                console.error(`[DB] Error conectando a BD de negocio #${bid}:`, err.message);
                return resolve(defaultDb);
            }
            newDb.run("PRAGMA foreign_keys = ON");
            newDb.run("PRAGMA journal_mode = WAL");
            newDb.run("PRAGMA synchronous = NORMAL");
            newDb.run("PRAGMA busy_timeout = 10000");
            newDb.run("PRAGMA cache_size = -64000");
            newDb.run("PRAGMA temp_store = MEMORY");

            if (isNew) {
                console.log(`[DB] Inicializando nuevo esquema limpio para negocio #${bid}...`);
                try {
                    const schemaPath = path.join(__dirname, '..', 'schema.sql');
                    if (fs.existsSync(schemaPath)) {
                        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
                        newDb.exec(schemaSql, async (execErr) => {
                            if (execErr) {
                                console.warn(`[DB] Advertencia al aplicar schema en negocio #${bid}:`, execErr.message);
                            } else {
                                console.log(`[DB] ✅ BD física de negocio #${bid} creada limpia (0 clientes, 0 productos, 0 ventas).`);
                            }
                            try {
                                const { runSchemaMigrations } = require('./migrations');
                                await runSchemaMigrations(newDb);
                            } catch (_) {}
                        });
                    }
                } catch (schemaErr) {
                    console.error('[DB] Error cargando schema.sql:', schemaErr.message);
                }
            } else {
                // Base de datos física existente: asegurar todas las columnas y migraciones al vuelo
                try {
                    const { runSchemaMigrations } = require('./migrations');
                    runSchemaMigrations(newDb).catch(mErr => {
                        console.warn(`[DB] Error en migraciones de negocio #${bid}:`, mErr.message);
                    });
                } catch (_) {}
            }

            businessConnections.set(bid, newDb);
            currentDb = newDb;
            activeBusinessId = bid;
            console.log(`[DB] 🔄 Conmutado a BD física de negocio #${bid}: database_biz_${bid}.sqlite`);
            resolve(newDb);
        });
    });
}

/**
 * Conecta y activa la base de datos SQLite exclusiva para un usuario específico.
 */
async function switchUserDatabase(userId) {
    activeUserId = userId || null;
    return getActiveDb();
}

const defaultDbAll = (sql, params = []) => new Promise((resolve, reject) => { 
    defaultDb.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || [])); 
});
const defaultDbGet = (sql, params = []) => new Promise((resolve, reject) => { 
    defaultDb.get(sql, params, (err, row) => err ? reject(err) : resolve(row)); 
});
const defaultDbRun = (sql, params = []) => new Promise((resolve, reject) => { 
    defaultDb.run(sql, params, function(err) { 
        if (err) reject(err); 
        else resolve(this); 
    }); 
});

module.exports = {
    db,
    dbGet,
    dbAll,
    dbRun, dbRunSilent,
    defaultDb,
    defaultDbAll,
    defaultDbGet,
    defaultDbRun,
    DATA_DIR,
    withTransaction,
    getTableColumns,
    filterToColumns,
    switchBusinessDatabase,
    switchUserDatabase,
    getActiveDb,
    getActiveUserId,
    getActiveBusinessId: () => activeBusinessId,
    getLastActivity: () => lastActivity,
    updateLastActivity: () => { lastActivity = Date.now(); }
};

/**
 * ponytail: Respaldo físico automático diario de SQLite
 * Guarda copias directas de database.sqlite en DATA_DIR/backups_sqlite/ manteniendo los últimos 7 días.
 */
function createDailyPhysicalBackup() {
    try {
        if (!fs.existsSync(dbPath)) return;
        // Checkpoint pasivo para flashear cambios de WAL a database.sqlite antes de la copia física
        try {
            defaultDb.run("PRAGMA wal_checkpoint(PASSIVE)");
        } catch (_) {}

        const backupDir = path.join(DATA_DIR, 'backups_sqlite');
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

        const dateStr = new Date().toISOString().slice(0, 10);
        const backupFile = path.join(backupDir, `database-${dateStr}.sqlite`);

        if (!fs.existsSync(backupFile)) {
            fs.copyFileSync(dbPath, backupFile);
            console.log(`[DB Backup] ✅ Respaldo físico automático diario creado: database-${dateStr}.sqlite`);

            const files = fs.readdirSync(backupDir)
                .filter(f => f.startsWith('database-') && f.endsWith('.sqlite'))
                .map(f => ({ name: f, path: path.join(backupDir, f), mtime: fs.statSync(path.join(backupDir, f)).mtime.getTime() }))
                .sort((a, b) => b.mtime - a.mtime);

            if (files.length > 7) {
                for (let i = 7; i < files.length; i++) {
                    try {
                        fs.unlinkSync(files[i].path);
                        console.log(`[DB Backup] Rotación: eliminado respaldo antiguo ${files[i].name}`);
                    } catch (_) {}
                }
            }
        }
    } catch (err) {
        console.warn('[DB Backup] Advertencia creando respaldo físico diario:', err.message);
    }
}
