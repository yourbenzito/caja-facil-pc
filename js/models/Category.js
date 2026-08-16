/**
 * Model: Category
 * Manejo centralizado de categorías de productos en IndexedDB y SQLite.
 */
class Category {
    static async getAll() {
        if (db.mode === 'sqlite') {
            try {
                const cats = await window.ApiClient.get('categories');
                return (cats || []).map(c => ({
                    ...c,
                    name: CategoryHelper.sanitize(c.name)
                })).sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
            } catch (_) {
                // Fallback a categorías extraídas de productos
            }
        }

        const idbCats = await db.getAll('categories');
        if (idbCats && idbCats.length > 0) {
            return idbCats.map(c => ({
                ...c,
                name: CategoryHelper.sanitize(c.name)
            })).sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
        }

        // Fallback: extraer categorías distintas desde los productos
        const products = await Product.getAll();
        const uniqueNames = [...new Set(
            products.map(p => CategoryHelper.sanitize(p.category || 'General'))
        )].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

        return uniqueNames.map((name, index) => ({ id: index + 1, name, color: '#6b7280' }));
    }

    static async getUniqueNames() {
        const categories = await this.getAll();
        const names = categories.map(c => CategoryHelper.sanitize(c.name));
        return [...new Set(names)].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    }

    static async create(name, color = '#6b7280') {
        const cleanName = CategoryHelper.sanitize(name);
        const existing = await this.getUniqueNames();

        if (existing.some(e => CategoryHelper.areEqual(e, cleanName))) {
            throw new Error(`La categoría "${cleanName}" ya existe.`);
        }

        const catData = {
            name: cleanName,
            color: color || '#6b7280',
            createdAt: new Date().toISOString()
        };

        if (db.mode === 'sqlite') {
            const result = await window.ApiClient.post('categories', catData);
            return result.id || result;
        }

        return await db.add('categories', catData);
    }

    static async delete(id) {
        if (db.mode === 'sqlite') {
            await window.ApiClient.delete('categories', id);
            return true;
        }
        await db.delete('categories', id);
        return true;
    }

    /**
     * Unifica varias categorías bajo una única categoría destino (Target)
     * Reasigna todos los productos asociados.
     */
    static async mergeCategories(targetCategory, sourceCategories) {
        const cleanTarget = CategoryHelper.sanitize(targetCategory);
        if (!sourceCategories || !Array.isArray(sourceCategories) || sourceCategories.length === 0) {
            return;
        }

        if (db.mode === 'sqlite') {
            await window.ApiClient.post('complex/categories/merge', {
                targetCategory: cleanTarget,
                sourceCategories
            });
            return;
        }

        // Modo IndexedDB
        const products = await Product.getAll();
        const sourcesNormalized = sourceCategories.map(s => CategoryHelper.normalizeKey(s));

        for (const p of products) {
            const pNorm = CategoryHelper.normalizeKey(p.category || '');
            if (sourcesNormalized.includes(pNorm)) {
                await Product.update(p.id, { category: cleanTarget });
            }
        }

        // Eliminar categorías sobrantes en la tabla categories
        const idbCats = await db.getAll('categories');
        for (const c of idbCats) {
            if (sourcesNormalized.includes(CategoryHelper.normalizeKey(c.name)) && c.name !== cleanTarget) {
                await db.delete('categories', c.id);
            }
        }
    }

    /**
     * Normaliza todas las categorías existentes de productos en la base de datos a Title Case.
     */
    static async normalizeAll() {
        if (db.mode === 'sqlite') {
            try {
                await window.ApiClient.post('complex/categories/normalize-all', {});
            } catch (e) {
                console.warn('Error al normalizar categorías en SQLite:', e);
            }
            return;
        }

        // Modo IndexedDB
        const products = await Product.getAll();
        for (const p of products) {
            const rawCat = p.category || 'General';
            const cleanCat = CategoryHelper.sanitize(rawCat);
            if (rawCat !== cleanCat) {
                await db.update('products', { ...p, category: cleanCat });
            }
        }
    }
}
