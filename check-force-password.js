const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'backend', 'data', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Consultando usuarios con cambio de contraseña forzado...\n');

db.all("SELECT id, username, role, forcePasswordChange, phone FROM users WHERE forcePasswordChange = 1", (err, rows) => {
    if (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }

    if (rows.length === 0) {
        console.log('❌ No hay usuarios con cambio de contraseña forzado');
    } else {
        console.log(`✅ Se encontraron ${rows.length} usuario(s) con cambio de contraseña forzado:`);
        console.log('');
        rows.forEach(user => {
            console.log(`ID: ${user.id}`);
            console.log(`Usuario: ${user.username}`);
            console.log(`Rol: ${user.role}`);
            console.log(`Teléfono: ${user.phone || 'No registrado'}`);
            console.log('---');
        });
    }

    db.close();
});
