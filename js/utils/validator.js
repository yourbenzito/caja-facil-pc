// Sistema de Validación y Testing Básico
const SystemValidator = {
    async runAllTests() {
        console.log('🧪 Iniciando validación del sistema...\n');
        
        const results = {
            database: await this.testDatabase(),
            models: await this.testModels(),
            controllers: await this.testControllers(),
            views: await this.testViews(),
            storage: await this.testStorage()
        };
        
        this.showResults(results);
        return results;
    },
    
    async testDatabase() {
        console.log('📊 Probando base de datos...');
        try {
            await db.init();
            const stores = ['products', 'sales', 'customers', 'suppliers', 
                          'purchases', 'cashRegisters', 'cashMovements', 'stockMovements', 'categories', 'settings'];
            
            for (const store of stores) {
                const count = await db.count(store);
                console.log(`  ✓ Store ${store}: ${count} registros`);
            }
            
            return { status: 'pass', message: 'Base de datos funcionando correctamente' };
        } catch (error) {
            return { status: 'fail', message: error.message };
        }
    },
    
    async testModels() {
        console.log('\n📦 Probando modelos...');
        try {
            const testProduct = await Product.create({
                name: 'Test Product',
                price: 1000,
                cost: 500,
                stock: 10,
                minStock: 5,
                type: 'unit',
                category: 'Test'
            });
            
            const product = await Product.getById(testProduct);
            console.log(`  ✓ Producto creado: ${product.name}`);
            
            await Product.delete(testProduct);
            console.log('  ✓ Producto eliminado');
            
            return { status: 'pass', message: 'Modelos funcionan correctamente' };
        } catch (error) {
            return { status: 'fail', message: error.message };
        }
    },
    
    async testControllers() {
        console.log('\n🎮 Probando controladores...');
        try {
            const products = await ProductController.searchProducts('test');
            console.log(`  ✓ ProductController: búsqueda exitosa`);
            
            return { status: 'pass', message: 'Controladores funcionan correctamente' };
        } catch (error) {
            return { status: 'fail', message: error.message };
        }
    },
    
    async testViews() {
        console.log('\n🖼️ Probando vistas...');
        try {
            const views = ['pos', 'products', 'customers', 'suppliers', 
                         'purchases', 'cash', 'inventory', 'reports', 'settings'];
            
            for (const viewName of views) {
                if (app.views[viewName]) {
                    console.log(`  ✓ Vista ${viewName}: disponible`);
                } else {
                    throw new Error(`Vista ${viewName} no encontrada`);
                }
            }
            
            return { status: 'pass', message: 'Todas las vistas disponibles' };
        } catch (error) {
            return { status: 'fail', message: error.message };
        }
    },
    
    async testStorage() {
        console.log('\n💾 Probando almacenamiento...');
        try {
            if ('storage' in navigator && 'estimate' in navigator.storage) {
                const estimate = await navigator.storage.estimate();
                const usedMB = (estimate.usage / 1024 / 1024).toFixed(2);
                const quotaMB = (estimate.quota / 1024 / 1024).toFixed(2);
                console.log(`  ✓ Almacenamiento: ${usedMB}MB / ${quotaMB}MB`);
            }
            
            if ('serviceWorker' in navigator) {
                console.log('  ✓ Service Worker: disponible');
            }
            
            return { status: 'pass', message: 'Almacenamiento funcionando' };
        } catch (error) {
            return { status: 'fail', message: error.message };
        }
    },
    
    showResults(results) {
        console.log('\n' + '='.repeat(50));
        console.log('📋 RESUMEN DE VALIDACIÓN');
        console.log('='.repeat(50));
        
        let totalTests = 0;
        let passedTests = 0;
        
        for (const [test, result] of Object.entries(results)) {
            totalTests++;
            const status = result.status === 'pass' ? '✅' : '❌';
            console.log(`${status} ${test}: ${result.message}`);
            if (result.status === 'pass') passedTests++;
        }
        
        console.log('='.repeat(50));
        console.log(`Resultado: ${passedTests}/${totalTests} tests pasados`);
        
        if (passedTests === totalTests) {
            console.log('🎉 ¡Sistema completamente funcional!');
        } else {
            console.log('⚠️ Algunos tests fallaron, revisar errores.');
        }
        console.log('='.repeat(50) + '\n');
    }
};

// Función de ayuda en consola
window.validateSystem = () => {
    console.log('Ejecutando validación del sistema...\n');
    SystemValidator.runAllTests();
};

console.log('%c💡 Tip: Ejecuta validateSystem() en la consola para validar el sistema', 
           'color: #2563eb; font-size: 14px; font-weight: bold;');
