// UTILIDAD PARA RESETEAR LA BASE DE DATOS
// Ejecuta esto en la consola del navegador (F12 -> Console) si tienes problemas

async function resetDatabase() {
    const confirmation = confirm(
        '⚠️ ADVERTENCIA ⚠️\n\n' +
        'Esto eliminará TODA la base de datos y recargará la aplicación.\n' +
        'Se perderán todos los datos: productos, ventas, clientes, etc.\n\n' +
        '¿Estás seguro de continuar?'
    );
    
    if (!confirmation) {
        console.log('Operación cancelada');
        return;
    }
    
    try {
        // Cerrar conexión actual
        if (db && db.db) {
            db.db.close();
        }
        
        // Eliminar la base de datos
        const deleteRequest = indexedDB.deleteDatabase('POSMinimarket');
        
        deleteRequest.onsuccess = () => {
            console.log('✅ Base de datos eliminada exitosamente');
            console.log('🔄 Recargando aplicación...');
            
            // Limpiar sessionStorage
            sessionStorage.clear();
            
            // Recargar la página
            setTimeout(() => {
                window.location.reload();
            }, 500);
        };
        
        deleteRequest.onerror = (error) => {
            console.error('❌ Error al eliminar la base de datos:', error);
        };
        
        deleteRequest.onblocked = () => {
            console.warn('⚠️ La eliminación está bloqueada. Cierra todas las pestañas de esta aplicación e intenta nuevamente.');
        };
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

async function createDefaultUser() {
    try {
        const userCount = await db.count('users');
        console.log(`Usuarios existentes: ${userCount}`);
        
        if (userCount === 0) {
            await User.create('admin', 'Admin@2024!');
            console.log('✅ Usuario admin creado exitosamente');
            console.log('Usuario: admin');
            console.log('Contraseña: Admin@2024! (DEBE CAMBIARSE EN PRIMER LOGIN)');
        } else {
            console.log('ℹ️ Ya existen usuarios en el sistema');
            const users = await User.getAll();
            console.log('Usuarios:', users.map(u => u.username).join(', '));
        }
    } catch (error) {
        console.error('❌ Error al crear usuario:', error);
    }
}

async function checkDatabase() {
    try {
        console.log('=== ESTADO DE LA BASE DE DATOS ===');
        
        const users = await db.getAll('users');
        console.log(`👥 Usuarios: ${users.length}`);
        if (users.length > 0) {
            console.log('   - ' + users.map(u => u.username).join('\n   - '));
        }
        
        const products = await db.getAll('products');
        console.log(`📦 Productos: ${products.length}`);
        
        const customers = await db.getAll('customers');
        console.log(`👤 Clientes: ${customers.length}`);
        
        const suppliers = await db.getAll('suppliers');
        console.log(`🚚 Proveedores: ${suppliers.length}`);
        
        const sales = await db.getAll('sales');
        console.log(`💰 Ventas: ${sales.length}`);
        
        const purchases = await db.getAll('purchases');
        console.log(`📋 Compras: ${purchases.length}`);
        
        console.log('=================================');
        
    } catch (error) {
        console.error('❌ Error al verificar la base de datos:', error);
    }
}

console.log(`
╔═══════════════════════════════════════════════════════════╗
║           UTILIDADES DE BASE DE DATOS                     ║
╟───────────────────────────────────────────────────────────╢
║  resetDatabase()      - Eliminar toda la BD               ║
║  createDefaultUser()  - Crear usuario admin/admin123      ║
║  checkDatabase()      - Ver estado de la BD               ║
╚═══════════════════════════════════════════════════════════╝

📝 Instrucciones:
1. Si no puedes iniciar sesión, ejecuta: resetDatabase()
2. Para crear el usuario admin manualmente: createDefaultUser()
3. Para ver el estado actual: checkDatabase()
`);
