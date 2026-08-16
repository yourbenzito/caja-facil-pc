const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'backend', 'data', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('=== QUERY START ===');

db.serialize(() => {
    db.all("SELECT id, name, cost, costNeto, price, type, lastSupplierId FROM products", (err, rows) => {
        console.log('--- ALL PRODUCTS ---');
        console.log(JSON.stringify(rows, null, 2));
    });

    db.all("SELECT * FROM suppliers", (err, rows) => {
        console.log('--- ALL SUPPLIERS ---');
        console.log(JSON.stringify(rows, null, 2));
    });

    db.all("SELECT sm.*, p.name FROM stockMovements sm LEFT JOIN products p ON sm.productId = p.id WHERE sm.type IN ('loss', 'merma', 'damage', 'adjustment', 'waste')", (err, rows) => {
        console.log('--- MERMAS AND LOSSES ---');
        console.log(JSON.stringify(rows, null, 2));
    });

    db.all("SELECT * FROM categories", (err, rows) => {
        console.log('--- ALL CATEGORIES ---');
        console.log(JSON.stringify(rows, null, 2));
    });

    db.all("SELECT pur.id, pur.supplierId, pur.items, s.name as supplierName FROM purchases pur LEFT JOIN suppliers s ON pur.supplierId = s.id LIMIT 50", (err, rows) => {
        console.log('--- PURCHASES SAMPLES ---');
        console.log(JSON.stringify(rows, null, 2));
    });
});
