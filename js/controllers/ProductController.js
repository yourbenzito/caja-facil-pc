class ProductController {
    static async loadProducts() {
        return await Product.getAll();
    }

    static async saveProduct(data) {
        if (data.id) {
            // C8: Permiso para editar producto
            PermissionService.require('products.edit', 'editar productos');
            await ProductService.updateProduct(data.id, data);
            showNotification('Producto actualizado exitosamente', 'success');
        } else {
            // C8: Permiso para crear producto
            PermissionService.require('products.create', 'crear productos');
            await ProductService.createProduct(data);
            showNotification('Producto creado exitosamente', 'success');
        }
        if (typeof SyncService !== 'undefined' && typeof SyncService.triggerAutoSync === 'function') {
            SyncService.triggerAutoSync(800);
        }
    }

    static async deleteProduct(id) {
        // C8: Permiso para desactivar producto
        PermissionService.require('products.delete', 'desactivar productos');
        
        // Obtener el producto antes de borrar para registrar trazabilidad exacta
        const product = await Product.getById(id);
        const currentStock = product ? (parseFloat(product.stock) || 0) : 0;

        if (typeof SyncService !== 'undefined' && typeof SyncService.markProductDeleted === 'function') {
            await SyncService.markProductDeleted(id);
        }
        await Product.delete(id);

        // Registrar en el Kardex / Historial de movimientos de stock
        if (typeof StockMovement !== 'undefined' && typeof StockMovement.create === 'function') {
            await StockMovement.create({
                productId: id,
                type: 'adjustment',
                quantity: 0,
                reference: 'Baja del Catálogo',
                reason: `Producto desactivado/eliminado del catálogo (Stock al momento de baja: ${currentStock})`
            }).catch(err => console.warn('[ProductController] Error registrando movimiento de baja:', err));
        }

        showNotification('Producto desactivado. Ya no aparecerá en listados ni ventas.', 'success');
        if (typeof SyncService !== 'undefined' && typeof SyncService.triggerAutoSync === 'function') {
            SyncService.triggerAutoSync(800);
        }
    }

    /**
     * C1: Restaurar un producto desactivado
     * @param {number} id - Product ID
     */
    static async restoreProduct(id) {
        // C8: Permiso para restaurar producto (mismo que delete)
        PermissionService.require('products.delete', 'restaurar productos');
        const product = await Product.getById(id);
        await Product.restore(id);

        // Registrar restauración en el Kardex de stock
        if (typeof StockMovement !== 'undefined' && typeof StockMovement.create === 'function') {
            await StockMovement.create({
                productId: id,
                type: 'adjustment',
                quantity: 0,
                reference: 'Restauración en Catálogo',
                reason: `Producto reactivado y disponible en catálogo (Stock: ${product ? (product.stock || 0) : 0})`
            }).catch(err => console.warn('[ProductController] Error registrando movimiento de restauración:', err));
        }

        showNotification('Producto restaurado y activo nuevamente.', 'success');
        if (typeof SyncService !== 'undefined' && typeof SyncService.triggerAutoSync === 'function') {
            SyncService.triggerAutoSync(800);
        }
    }

    static async searchProducts(term) {
        if (!term) return await Product.getAll();
        return await Product.search(term);
    }

    static async adjustPrice(id, newPrice) {
        await Product.adjustPrice(id, newPrice);
        showNotification('Precio actualizado', 'success');
    }

    static async importFromJSON(jsonData) {
        try {
            const products = JSON.parse(jsonData);
            const results = await Product.importProducts(products);
            
            const successful = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;
            
            showNotification(`Importación: ${successful} exitosos, ${failed} fallidos`, 'info');
            return results;
        } catch (error) {
            showNotification('Error en la importación: ' + error.message, 'error');
            throw error;
        }
    }
}
