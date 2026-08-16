const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'backend', 'data', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Consultando negocios, productos y ventas...\n');

// Consultar negocios
db.all("SELECT id, name, slug, isActive FROM businesses", (err, businesses) => {
    if (err) {
        console.error('Error consultando negocios:', err.message);
        process.exit(1);
    }

    if (businesses.length === 0) {
        console.log('❌ No hay negocios registrados');
        db.close();
        process.exit(0);
    }

    console.log(`✅ Se encontraron ${businesses.length} negocio(s):`);
    console.log('');

    // Para cada negocio, consultar productos y ventas
    let completed = 0;
    businesses.forEach(business => {
        const businessId = business.id;
        
        // Contar productos
        db.get("SELECT COUNT(*) as count FROM products WHERE business_id = ? AND deletedAt IS NULL", [businessId], (err, productCount) => {
            if (err) {
                console.error(`Error consultando productos del negocio ${business.name}:`, err.message);
            } else {
                // Contar ventas recientes (últimos 30 días)
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                
                db.get("SELECT COUNT(*) as count, MAX(date) as lastSale FROM sales WHERE business_id = ? AND date >= ?", [businessId, thirtyDaysAgo.toISOString()], (err, salesData) => {
                    if (err) {
                        console.error(`Error consultando ventas del negocio ${business.name}:`, err.message);
                    } else {
                        console.log(`📦 Negocio: ${business.name} (ID: ${businessId})`);
                        console.log(`   Slug: ${business.slug}`);
                        console.log(`   Activo: ${business.isActive === 1 ? 'Sí' : 'No'}`);
                        console.log(`   Productos: ${productCount.count}`);
                        console.log(`   Ventas últimos 30 días: ${salesData.count}`);
                        console.log(`   Última venta: ${salesData.lastSale || 'Sin ventas'}`);
                        console.log('---');
                    }
                    
                    completed++;
                    if (completed === businesses.length) {
                        db.close();
                    }
                });
            }
        });
    });
});
