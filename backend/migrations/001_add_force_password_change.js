#!/usr/bin/env node
/**
 * Migración 001: Agregar campo forcePasswordChange a tabla users
 * Este script agrega el campo para forzar cambio de contraseña en primer login
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ruta de la base de datos
const dbPath = path.join(__dirname, '../data/database.sqlite');

// Verificar si existe la base de datos
if (!fs.existsSync(dbPath)) {
    console.log('⚠️  Base de datos no encontrada en:', dbPath);
    console.log('ℹ️  Esta migración se ejecutará automáticamente cuando se cree la base de datos con el nuevo schema.');
    process.exit(0);
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error abriendo base de datos:', err.message);
        process.exit(1);
    }
    console.log('✅ Base de datos abierta correctamente');
});

// Verificar si el campo ya existe
db.all("PRAGMA table_info(users)", (err, columns) => {
    if (err) {
        console.error('❌ Error verificando tabla users:', err.message);
        db.close();
        process.exit(1);
    }

    const hasField = columns.some(col => col.name === 'forcePasswordChange');

    if (hasField) {
        console.log('ℹ️  El campo forcePasswordChange ya existe en la tabla users');
        db.close();
        process.exit(0);
    }

    // Agregar el campo
    db.run("ALTER TABLE users ADD COLUMN forcePasswordChange INTEGER DEFAULT 0", (err) => {
        if (err) {
            console.error('❌ Error agregando campo forcePasswordChange:', err.message);
            db.close();
            process.exit(1);
        }

        console.log('✅ Campo forcePasswordChange agregado exitosamente');
        
        // Establecer forcePasswordChange = 1 para todos los usuarios admin
        db.run("UPDATE users SET forcePasswordChange = 1 WHERE username = 'admin' OR role = 'owner'", (err) => {
            if (err) {
                console.error('⚠️  Error actualizando usuarios admin:', err.message);
                console.log('ℹ️  Esto puede ser normal si no existen usuarios admin');
            } else {
                console.log('✅ Usuarios admin configurados para forzar cambio de contraseña');
            }

            db.close((err) => {
                if (err) {
                    console.error('❌ Error cerrando base de datos:', err.message);
                    process.exit(1);
                }
                console.log('✅ Migración completada exitosamente');
                process.exit(0);
            });
        });
    });
});
