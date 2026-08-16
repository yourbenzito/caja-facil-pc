const fs = require('fs');
const path = require('path');

// ============================================================================
// EXTRACTOR DE BACKUP POR NEGOCIO
// Uso: node extract_business.js <archivo_origen.json> <business_id> <archivo_destino.json>
// Ejemplo: node extract_business.js backup_viejo.json 1 backup_filtrado.json
// ============================================================================

const inputFile = process.argv[2];
const targetBusinessId = parseInt(process.argv[3], 10);
const outputFile = process.argv[4] || 'backup_filtrado.json';

if (!inputFile || isNaN(targetBusinessId)) {
    console.error('❌ Uso incorrecto.');
    console.error('👉 Uso: node extract_business.js <archivo_origen.json> <business_id> [archivo_destino.json]');
    process.exit(1);
}

try {
    console.log(`\n📂 Leyendo archivo original: ${inputFile}`);
    const rawData = fs.readFileSync(path.resolve(inputFile), 'utf8');
    const backup = JSON.parse(rawData);
    
    const filteredBackup = {};
    
    // Conservar metadatos si existen
    if (backup.exportDate) filteredBackup.exportDate = backup.exportDate;
    if (backup.version) filteredBackup.version = backup.version;

    console.log(`\n🔍 Filtrando datos para el negocio con ID: ${targetBusinessId}...\n`);

    for (const [tableName, rows] of Object.entries(backup)) {
        if (!Array.isArray(rows)) {
            continue;
        }

        let filteredRows = [];

        if (tableName === 'businesses') {
            // En la tabla businesses, la clave principal es 'id'
            filteredRows = rows.filter(row => parseInt(row.id, 10) === targetBusinessId);
        } else {
            // En el resto de las tablas, la columna es 'business_id' (o a veces businessId)
            filteredRows = rows.filter(row => {
                const bId = row.business_id !== undefined ? row.business_id : row.businessId;
                if (bId === undefined) {
                    // Hay tablas como passwordResets o auditLogs que a veces en versiones muy antiguas no tenían business_id.
                    // Si no tiene, no la copiamos para no ensuciar la nueva base de datos.
                    return false; 
                }
                return parseInt(bId, 10) === targetBusinessId;
            });
        }

        filteredBackup[tableName] = filteredRows;
        
        const removed = rows.length - filteredRows.length;
        console.log(`✅ ${tableName.padEnd(25)} | Mantenidos: ${filteredRows.length.toString().padEnd(5)} | Descartados: ${removed}`);
    }

    // Guardar el nuevo JSON
    const outputPath = path.resolve(outputFile);
    fs.writeFileSync(outputPath, JSON.stringify(filteredBackup, null, 2), 'utf8');
    
    console.log(`\n🎉 ¡Extracción completada con éxito!`);
    console.log(`💾 El nuevo backup ha sido guardado en: ${outputPath}`);
    console.log(`\n▶️  Ahora puedes importarlo usando: node import_backup.js ${outputFile}\n`);

} catch (err) {
    console.error('❌ Ocurrió un error procesando el archivo:');
    console.error(err.message);
}
