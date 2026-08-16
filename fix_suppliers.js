const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'backend', 'data', 'database.sqlite');
const db = new sqlite3.Database(DB_PATH);

async function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

async function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function main() {
    console.log('Iniciando corrección de proveedores...');

    // Obtener todas las compras, ordenadas por ID ascendente para procesar las más antiguas primero 
    // y dejar la última compra al final (lo que sobreescribirá correctamente lastSupplierId al último proveedor).
    const purchases = await all(`SELECT supplierId, items FROM purchases ORDER BY id ASC`);
    
    if (purchases.length === 0) {
        console.log('No hay compras registradas.');
        db.close();
        return;
    }

    let updatedProducts = 0;
    const lastSupplierMap = {}; // productId -> supplierId

    for (const purchase of purchases) {
        if (!purchase.supplierId || !purchase.items) continue;
        
        let items = [];
        try {
            items = JSON.parse(purchase.items);
        } catch (e) {
            continue;
        }

        for (const item of items) {
            if (item.productId) {
                lastSupplierMap[item.productId] = purchase.supplierId;
            }
        }
    }

    const productIds = Object.keys(lastSupplierMap);
    console.log(`Se encontraron ${productIds.length} productos con historial de compras.`);

    for (const pId of productIds) {
        const sId = lastSupplierMap[pId];
        await run(`UPDATE products SET lastSupplierId = ? WHERE id = ?`, [sId, pId]);
        updatedProducts++;
    }

    console.log(`Corrección finalizada. Se actualizaron ${updatedProducts} productos con su último proveedor.`);
    db.close();
}

main().catch(console.error);
