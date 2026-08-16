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
    }

    static async deleteProduct(id) {
        // C8: Permiso para desactivar producto
        PermissionService.require('products.delete', 'desactivar productos');
        await Product.delete(id);
        showNotification('Producto desactivado. Ya no aparecerá en listados ni ventas.', 'success');
    }

    /**
     * C1: Restaurar un producto desactivado
     * @param {number} id - Product ID
     */
    static async restoreProduct(id) {
        // C8: Permiso para restaurar producto (mismo que delete)
        PermissionService.require('products.delete', 'restaurar productos');
        await Product.restore(id);
        showNotification('Producto restaurado y activo nuevamente.', 'success');
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
