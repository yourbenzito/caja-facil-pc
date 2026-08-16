const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'backend', 'data', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.all("SELECT * FROM products", (err, products) => {
        db.all("SELECT * FROM suppliers", (err, suppliers) => {
            db.all("SELECT sm.*, p.name as productName FROM stockMovements sm LEFT JOIN products p ON sm.productId = p.id WHERE sm.type IN ('loss', 'merma', 'damage', 'adjustment', 'waste')", (err, mermas) => {
                
                const targetList = [
                    'Huevo', 'Cigarro', 'Pan', 'Carezza', 'Empanada', 
                    'Cerveza', 'Papa', 'Frugele', 'Queso', 'Coca', 'Galleta'
                ];

                console.log('=== MATCHED PRODUCTS ===');
                targetList.forEach(term => {
                    const found = products.filter(p => p.name.toLowerCase().includes(term.toLowerCase()));
                    console.log(`\nItem search '${term}':`);
                    if (found.length > 0) {
                        found.forEach(f => {
                            const sup = suppliers.find(s => s.id === f.lastSupplierId);
                            console.log(`  - "${f.name}" | Precio: $${f.price} | Costo: $${f.cost} | CostoNeto: $${f.costNeto || (f.cost ? (f.cost/1.19).toFixed(2) : 0)} | Proveedor: ${sup ? sup.name : 'No asignado'}`);
                        });
                    } else {
                        console.log(`  - No disponible`);
                    }
                });

                console.log('\n=== MERMAS MASIVAS Y PERDIDAS RECIENTES ===');
                const uniqueMermas = [...new Set(mermas.map(m => m.productName))];
                console.log(uniqueMermas.join(', '));
            });
        });
    });
});
