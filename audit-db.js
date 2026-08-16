const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'backend', 'data', 'database.sqlite');
const schemaPath = path.join(__dirname, 'backend', 'schema.sql');
const db = new sqlite3.Database(dbPath);

const schemaSql = fs.readFileSync(schemaPath, 'utf8');

// Parse CREATE TABLE statements
const tableRegex = /CREATE TABLE IF NOT EXISTS\s+(\w+)\s*\(([\s\S]*?)\);/gi;
let match;
const schemaTables = {};

while ((match = tableRegex.exec(schemaSql)) !== null) {
    const tableName = match[1];
    const body = match[2];
    const lines = body.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('--') && !l.startsWith('PRIMARY KEY') && !l.startsWith('CONSTRAINT') && !l.startsWith('FOREIGN KEY') && !l.startsWith('UNIQUE') && !l.startsWith('CREATE INDEX'));
    const cols = [];
    lines.forEach(line => {
        const colMatch = line.match(/^(\w+)\s+([A-Z0-9_]+)/i);
        if (colMatch) {
            cols.push({ name: colMatch[1], type: colMatch[2] });
        }
    });
    schemaTables[tableName] = cols;
}

db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", async (err, tables) => {
    if (err) { console.error(err); process.exit(1); }
    const existingTableNames = tables.map(t => t.name);
    console.log('\n========================================');
    console.log('📊 RESULTADO DE LA AUDITORÍA DE ESTRUCTURA');
    console.log('========================================');
    console.log(`Tablas requeridas en schema.sql: ${Object.keys(schemaTables).length}`);
    console.log(`Tablas reales en tu base de datos: ${existingTableNames.length}\n`);

    const missingTables = [];
    const missingColumns = [];

    for (const [table, expectedCols] of Object.entries(schemaTables)) {
        if (!existingTableNames.includes(table)) {
            missingTables.push(table);
            continue;
        }
        const currentCols = await new Promise(res => db.all(`PRAGMA table_info("${table}")`, (e, r) => res(r ? r.map(c => c.name) : [])));
        expectedCols.forEach(c => {
            if (!currentCols.includes(c.name)) {
                missingColumns.push({ table, column: c.name, type: c.type });
            }
        });
    }

    if (missingTables.length === 0) {
        console.log('✅ TODAS LAS TABLAS EXISTEN');
    } else {
        console.log('❌ TABLAS FALTANTES:', missingTables.join(', '));
    }

    if (missingColumns.length === 0) {
        console.log('✅ TODAS LAS COLUMNAS REQUERIDAS EXISTEN');
    } else {
        console.log('⚠️ COLUMNAS FALTANTES DETECTADAS:');
        missingColumns.forEach(item => {
            console.log(`   - Tabla: ${item.table} | Columna: ${item.column} (${item.type})`);
        });
    }
    console.log('========================================\n');
    db.close();
});
