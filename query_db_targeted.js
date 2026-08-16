const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'backend', 'data', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.all("SELECT id, name, cost, costNeto, price, type, lastSupplierId FROM products", (err, products) => {
        db.all("SELECT * FROM suppliers", (err, suppliers) => {
            db.all("SELECT sm.*, p.name as productName FROM stockMovements sm LEFT JOIN products p ON sm.productId = p.id WHERE sm.type IN ('loss', 'merma', 'damage', 'adjustment', 'waste')", (err, mermas) => {
                db.all("SELECT * FROM categories", (err, categories) => {
                    db.all("SELECT pur.id, pur.supplierId, pur.items, s.name as supplierName FROM purchases pur LEFT JOIN suppliers s ON pur.supplierId = s.id", (err, purchases) => {
                        
                        console.log('=== TARGETED SEARCH RESULTS ===');
                        const searchTerms = ['Huevo', 'Cigarro', 'Pan', 'Carezza', 'Empanada', 'Cerveza', 'Papa', 'Frugele', 'Queso', 'Coca', 'Galleta'];
                        
                        searchTerms.forEach(term => {
                            const matches = products.filter(p => p.name.toLowerCase().includes(term.toLowerCase()));
                            console.log(`\n-- Matches for '${term}':`);
                            matches.forEach(m => console.log(`  ID: ${m.id} | Name: "${m.name}" | Price: $${m.price} | CostNeto: $${m.costNeto} | Cost: $${m.cost} | SupplierId: ${m.lastSupplierId}`));
                        });

                        console.log('\n=== EMPANADAS, PAN, PAN AMASADO DETAILS ===');
                        const bakeryItems = products.filter(p => ['empanada', 'pan'].some(b => p.name.toLowerCase().includes(b)));
                        bakeryItems.forEach(b => console.log(`  ID: ${b.id} | Name: "${b.name}" | Price: $${b.price} | Cost: $${b.cost} | LastSupplierId: ${b.lastSupplierId}`));

                        console.log('\n=== SUPPLIERS AND PRODUCTS DELIVERY ===');
                        suppliers.forEach(s => {
                            const sProds = products.filter(p => p.lastSupplierId === s.id);
                            console.log(`Supplier #${s.id} (${s.name}): ${sProds.map(p => p.name).join(', ') || 'Sin productos asociados directos'}`);
                        });

                        console.log('\n=== MERMAS RECORDED ===');
                        console.log(mermas.length > 0 ? JSON.stringify(mermas, null, 2) : 'No hay registros de mermas/pérdidas');

                        console.log('\n=== CATEGORIES LISTED ===');
                        console.log(categories.map(c => c.name).join(', '));
                    });
                });
            });
        });
    });
});
