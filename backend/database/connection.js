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

let lastActivity = Date.now();

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('DB Error:', err.message);
    } else { 
        db.run("PRAGMA foreign_keys = ON"); 
        db.run("PRAGMA journal_mode = WAL");
        db.run("PRAGMA busy_timeout = 5000"); // Esperar hasta 5s si la DB está ocupada
        console.log('SQLite Core: Optimizado (WAL + BusyTimeout + FK)');
    }
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => { 
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row)); 
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => { 
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)); 
});

const dbRun = (sql, params = []) => new Promise((resolve, reject) => { 
    db.run(sql, params, function(err) { 
        if (err) {
            console.error('SQL Error:', sql, params, err.message);
            reject(err);
        } else { 
            lastActivity = Date.now(); 
            resolve(this); 
        } 
    }); 
});

async function withTransaction(callback) {
    await dbRun('BEGIN IMMEDIATE');
    try { 
        const result = await callback(); 
        await dbRun('COMMIT'); 
        return result; 
    } catch (err) { 
        await dbRun('ROLLBACK'); 
        throw err; 
    }
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

module.exports = {
    db,
    dbGet,
    dbAll,
    dbRun,
    withTransaction,
    getTableColumns,
    filterToColumns,
    getLastActivity: () => lastActivity,
    updateLastActivity: () => { lastActivity = Date.now(); }
};
