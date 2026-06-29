/**
 * ============================================================
 *  IMPORTADOR DE BACKUP - Sistema POS
 * ============================================================
 *  CÓMO USAR:
 *  1. Pon el archivo backup .json en la carpeta raíz del proyecto
 *  2. Cambia BACKUP_FILE abajo con el nombre del archivo
 *  3. Ejecuta: node import_backup.js
 * ============================================================
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// ⬇️ CAMBIA ESTO con el nombre de tu archivo de backup
const BACKUP_FILE = process.argv[2] || (() => {
    // Buscar automáticamente archivos .json que parezcan backups
    const files = fs.readdirSync(__dirname)
        .filter(f => f.endsWith('.json') && (f.includes('backup') || f.includes('pos-backup')))
        .sort()
        .reverse(); // El más reciente primero
    if (files.length === 0) {
        // Buscar en subcarpetas
        const dirs = fs.readdirSync(__dirname).filter(f => {
            try { return fs.statSync(path.join(__dirname, f)).isDirectory() && !['node_modules','.git','dist'].includes(f); } catch(e) { return false; }
        });
        for (const dir of dirs) {
            const found = fs.readdirSync(path.join(__dirname, dir))
                .filter(f => f.endsWith('.json') && (f.includes('backup') || f.includes('pos-backup')))
                .sort().reverse();
            if (found.length > 0) return path.join(__dirname, dir, found[0]);
        }
        console.error('❌ No se encontró ningún archivo de backup .json');
        console.error('   Uso: node import_backup.js <ruta-al-backup.json>');
        process.exit(1);
    }
    return path.join(__dirname, files[0]);
})();

const DB_PATH = path.join(__dirname, 'backend', 'data', 'database.sqlite');
const DB_BACKUP_PATH = path.join(__dirname, 'backend', 'data', `database_respaldo_${new Date().toISOString().replace(/[:.]/g,'-').slice(0,19)}.sqlite`);

const TABLES_ORDER = [
    'businesses', 'users', 'categories', 'products', 'suppliers',
    'customers', 'cashRegisters', 'sales', 'payments', 'purchases',
    'expenses', 'cashMovements', 'stockMovements', 'settings',
    'customerCreditDeposits', 'customerCreditUses', 'auditLogs',
    'productPriceHistory', 'productCostHistory', 'supplierPayments', 'saleReturns', 'passwordResets', 'debtPaymentSessions',
];

const run  = (db, sql, p=[]) => new Promise((ok,ko) => db.run(sql,p,function(e){ e?ko(e):ok(this); }));
const get  = (db, sql, p=[]) => new Promise((ok,ko) => db.get(sql,p,(e,r)=>{ e?ko(e):ok(r); }));
const all  = (db, sql, p=[]) => new Promise((ok,ko) => db.all(sql,p,(e,r)=>{ e?ko(e):ok(r); }));
const cols = async (db, t)   => (await all(db,`PRAGMA table_info("${t}")`)).map(c=>c.name);

async function main() {
    console.log('\n' + '='.repeat(60));
    console.log('  🗄️  IMPORTADOR DE BACKUP - Sistema POS');
    console.log('='.repeat(60));

    // 1. Leer backup
    console.log(`\n📂 Archivo: ${path.basename(BACKUP_FILE)}`);
    if (!fs.existsSync(BACKUP_FILE)) { console.error('❌ Archivo no encontrado:', BACKUP_FILE); process.exit(1); }
    const backup = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
    console.log(`📅 Exportado el: ${new Date(backup.exportDate).toLocaleString('es-CL')}`);
    console.log(`📊 Resumen del backup:`);
    const tableStats = {};
    for (const t of TABLES_ORDER) if (backup[t]?.length > 0) tableStats[t] = backup[t].length;
    Object.entries(tableStats).forEach(([k,v]) => console.log(`   ${k.padEnd(25)} ${v.toLocaleString()} registros`));

    // 2. Respaldo automático de la BD actual
    console.log('\n💾 Haciendo respaldo de la BD actual...');
    if (fs.existsSync(DB_PATH)) {
        fs.copyFileSync(DB_PATH, DB_BACKUP_PATH);
        const mb = (fs.statSync(DB_BACKUP_PATH).size/1024/1024).toFixed(1);
        console.log(`   ✅ Respaldo guardado: ${path.basename(DB_BACKUP_PATH)} (${mb} MB)`);
    }

    // 3. Importar datos
    const db = new sqlite3.Database(DB_PATH);
    await run(db, 'PRAGMA foreign_keys = OFF');
    await run(db, 'PRAGMA journal_mode = WAL');
    await run(db, 'BEGIN TRANSACTION');

    try {
        console.log('\n📥 Importando tablas...');
        for (const tableName of TABLES_ORDER) {
            const rows = backup[tableName];
            if (!rows || rows.length === 0) {
                try { await run(db, `DELETE FROM "${tableName}"`); } catch(e) {}
                continue;
            }
            const tableCols = await cols(db, tableName);
            if (tableCols.length === 0) { console.log(`   ⚠️  ${tableName}: no existe, omitida`); continue; }

            await run(db, `DELETE FROM "${tableName}"`);
            let ok = 0, skip = 0;
            for (const row of rows) {
                const validCols = Object.keys(row).filter(k => tableCols.includes(k));
                if (!validCols.length) { skip++; continue; }
                const vals = validCols.map(k => {
                    const v = row[k];
                    if (v === null || v === undefined || v === 'null') return null;
                    return typeof v === 'object' ? JSON.stringify(v) : v;
                });
                try {
                    await run(db, `INSERT OR REPLACE INTO "${tableName}" (${validCols.map(c=>`"${c}"`).join(',')}) VALUES (${validCols.map(()=>'?').join(',')})`, vals);
                    ok++;
                } catch(e) { skip++; }
            }
            console.log(`   ✅ ${tableName.padEnd(25)} ${ok.toLocaleString()} registros${skip>0?` (${skip} omitidos)`:''}`);
        }
        await run(db, 'COMMIT');

        // 4. Migración automática de paidAt (en lote, muy rápida)
        console.log('\n📅 Migrando fechas de pago (paidAt)...');
        try {
            await run(db, 'ALTER TABLE sales ADD COLUMN paidAt TEXT');
        } catch(e) { /* ya existe */ }

        await run(db, `
            UPDATE sales SET paidAt = (
                SELECT p.date FROM payments p WHERE p.saleId = sales.id ORDER BY p.date DESC LIMIT 1
            )
            WHERE paidAt IS NULL AND status IN ('completed','paid')
              AND EXISTS (SELECT 1 FROM payments p WHERE p.saleId = sales.id)
        `);
        await run(db, `
            UPDATE sales SET paidAt = date
            WHERE paidAt IS NULL AND status IN ('completed','paid')
        `);

        // 5. Migración automática de costNeto (para backups antiguos sin este campo)
        console.log('💰 Migrando costos netos (costNeto)...');
        try {
            await run(db, 'ALTER TABLE products ADD COLUMN costNeto REAL');
        } catch(e) { /* ya existe */ }
        const costResult = await run(db, `
            UPDATE products SET costNeto = ROUND(CAST(cost AS REAL) / 1.19, 2) 
            WHERE costNeto IS NULL AND cost IS NOT NULL AND cost > 0
        `);
        if (costResult.changes > 0) {
            console.log(`   ✅ costNeto calculado para ${costResult.changes} productos`);
        } else {
            console.log('   ✅ Todos los productos ya tienen costNeto');
        }

        // 6. Migración automática de vatMode en purchases
        try {
            await run(db, 'ALTER TABLE purchases ADD COLUMN vatMode TEXT DEFAULT "net"');
            console.log('   ✅ Columna vatMode añadida a purchases');
        } catch(e) { /* ya existe */ }

        const stats = await get(db, `SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status IN ('completed','paid') THEN 1 ELSE 0 END) as completadas,
            SUM(CASE WHEN paidAt IS NOT NULL THEN 1 ELSE 0 END) as conPaidAt
            FROM sales`);

        console.log('\n' + '='.repeat(60));
        console.log('  ✅ IMPORTACIÓN COMPLETADA CON ÉXITO');
        console.log('='.repeat(60));
        console.log(`  📦 Total ventas:        ${stats.total?.toLocaleString()}`);
        console.log(`  ✔️  Ventas completadas:  ${stats.completadas?.toLocaleString()}`);
        console.log(`  📅 Con fecha de pago:   ${stats.conPaidAt?.toLocaleString()}`);
        console.log(`\n  🔒 Respaldo anterior:   ${path.basename(DB_BACKUP_PATH)}`);
        console.log('\n  ▶️  Inicia el sistema con: npm start\n');

    } catch(err) {
        await run(db, 'ROLLBACK').catch(()=>{});
        console.error('\n❌ Error durante la importación. Haciendo rollback...');
        console.error('   Detalle:', err.message);
        console.log(`\n🔒 Tu BD original está segura en: ${path.basename(DB_BACKUP_PATH)}`);
    }

    db.close();
}

main().catch(err => { console.error('❌ Error inesperado:', err.message); process.exit(1); });
