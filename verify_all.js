const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'backend', 'data', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.all("SELECT id, name, cost, costNeto, price, type, lastSupplierId FROM products", (err, products) => {
        db.all("SELECT * FROM suppliers", (err, suppliers) => {
            const terms = ['Huevo', 'Cigarro', 'Pan', 'Carezza', 'Empanada', 'Cerveza', 'Papa', 'Frugele', 'Queso', 'Coca', 'Galleta'];
            
            console.log('=== VERIFICACION COMPLETA DE REGISTROS EN BASE DE DATOS REAL ===');
            terms.forEach(term => {
                const matches = products.filter(p => p.name.toLowerCase().includes(term.toLowerCase()));
                console.log(`\n🔍 Término "${term}" (${matches.length} coincidencias encontradas):`);
                matches.forEach(m => {
                    const sup = suppliers.find(s => s.id === m.lastSupplierId);
                    console.log(`   - ID ${m.id}: "${m.name}" | Precio: $${m.price} | Costo Bruto: $${m.cost} | Costo Neto: $${m.costNeto || (m.cost ? (m.cost/1.19).toFixed(2) : 0)} | Proveedor: ${sup ? sup.name : 'Sin proveedor asignado'}`);
                });
            });

            console.log('\n=== LISTA COMPLETA DE PROVEEDORES ===');
            suppliers.forEach(s => console.log(`   - ID ${s.id}: ${s.name}`));
        });
    });
});
