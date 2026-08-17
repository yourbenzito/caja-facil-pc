/**
 * Model: Category
 * Manejo centralizado de categorías de productos en IndexedDB y SQLite.
 */
class Category {
    static async getAll() {
        let cats = [];
        if (db.mode === 'sqlite') {
            try {
                const res = await window.ApiClient.get('categories');
                cats = (res || []).map(c => ({
                    ...c,
                    name: CategoryHelper.sanitize(c.name)
                }));
            } catch (_) {
                cats = [];
            }
        } else {
            const idbCats = await db.getAll('categories');
            cats = (idbCats || []).map(c => ({
                ...c,
                name: CategoryHelper.sanitize(c.name)
            }));
        }

        // Garantizar que la categoría "General" siempre exista en la lista
        const hasGeneral = cats.some(c => CategoryHelper.areEqual(c.name, 'General'));
        if (!hasGeneral) {
            cats.unshift({ id: 0, name: 'General', color: '#6b7280' });
        }

        // Ordenar alfabéticamente
        return cats.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
    }

    static async getUniqueNames() {
        const categories = await this.getAll();
        const names = categories.map(c => CategoryHelper.sanitize(c.name));
        return [...new Set(names)].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    }

    static async create(name, color = '#3b82f6') {
        const cleanName = CategoryHelper.sanitize(name);
        const existing = await this.getUniqueNames();

        if (existing.some(e => CategoryHelper.areEqual(e, cleanName))) {
            throw new Error(`La categoría "${cleanName}" ya existe.`);
        }

        const catData = {
            name: cleanName,
            color: color || '#3b82f6',
            createdAt: new Date().toISOString()
        };

        if (db.mode === 'sqlite') {
            const result = await window.ApiClient.post('categories', catData);
            return result.id || result;
        }

        return await db.add('categories', catData);
    }

    /**
     * Elimina una categoría y reasigna los productos que la tenían a una categoría destino (targetCategory).
     * Si no se especifica targetCategory, los productos pasan a "General".
     */
    static async deleteAndReassign(id, categoryName, targetCategory = 'General') {
        const cleanSource = CategoryHelper.sanitize(categoryName);
        const cleanTarget = CategoryHelper.sanitize(targetCategory || 'General');

        if (db.mode === 'sqlite') {
            await window.ApiClient.post('complex/categories/delete-and-reassign', {
                categoryId: id,
                categoryName: cleanSource,
                targetCategory: cleanTarget
            });
            return true;
        }

        // Modo IndexedDB
        const products = await Product.getAll();
        const sourceNorm = CategoryHelper.normalizeKey(cleanSource);

        for (const p of products) {
            if (CategoryHelper.normalizeKey(p.category || '') === sourceNorm) {
                await Product.update(p.id, { category: cleanTarget });
            }
        }

        if (id) {
            await db.delete('categories', id);
        } else {
            const allCats = await db.getAll('categories');
            for (const c of allCats) {
                if (CategoryHelper.normalizeKey(c.name) === sourceNorm) {
                    await db.delete('categories', c.id);
                }
            }
        }

        // Asegurar que la categoría destino existe si no era General
        if (cleanTarget !== 'General') {
            const existingTarget = await this.getUniqueNames();
            if (!existingTarget.some(t => CategoryHelper.areEqual(t, cleanTarget))) {
                await this.create(cleanTarget);
            }
        }

        return true;
    }

    /**
     * Renombra una categoría existente y actualiza todos sus productos asociados.
     */
    static async rename(id, oldName, newName) {
        const cleanOld = CategoryHelper.sanitize(oldName);
        const cleanNew = CategoryHelper.sanitize(newName);

        if (CategoryHelper.areEqual(cleanOld, cleanNew)) return;

        if (db.mode === 'sqlite') {
            await window.ApiClient.post('complex/categories/rename', {
                categoryId: id,
                oldName: cleanOld,
                newName: cleanNew
            });
            return true;
        }

        // Modo IndexedDB
        const products = await Product.getAll();
        const oldNorm = CategoryHelper.normalizeKey(cleanOld);

        for (const p of products) {
            if (CategoryHelper.normalizeKey(p.category || '') === oldNorm) {
                await Product.update(p.id, { category: cleanNew });
            }
        }

        if (id) {
            await db.update('categories', { id, name: cleanNew });
        } else {
            const allCats = await db.getAll('categories');
            for (const c of allCats) {
                if (CategoryHelper.normalizeKey(c.name) === oldNorm) {
                    await db.update('categories', { ...c, name: cleanNew });
                }
            }
        }

        return true;
    }

    static async mergeCategories(targetCategory, sourceCategories) {
        const cleanTarget = CategoryHelper.sanitize(targetCategory);
        if (!sourceCategories || !Array.isArray(sourceCategories) || sourceCategories.length === 0) return;
        if (db.mode === 'sqlite') {
            await window.ApiClient.post('complex/categories/merge', { targetCategory: cleanTarget, sourceCategories });
            return;
        }
        const products = await Product.getAll();
        const sourcesNormalized = sourceCategories.map(s => CategoryHelper.normalizeKey(s));
        for (const p of products) {
            const pNorm = CategoryHelper.normalizeKey(p.category || '');
            if (sourcesNormalized.includes(pNorm)) {
                await Product.update(p.id, { category: cleanTarget });
            }
        }
        const idbCats = await db.getAll('categories');
        for (const c of idbCats) {
            if (sourcesNormalized.includes(CategoryHelper.normalizeKey(c.name)) && c.name !== cleanTarget) {
                await db.delete('categories', c.id);
            }
        }
    }

    static async normalizeAll() {
        if (db.mode === 'sqlite') {
            try {
                await window.ApiClient.post('complex/categories/normalize-all', {});
            } catch (e) {
                console.warn('Error al normalizar categorías en SQLite:', e);
            }
            return;
        }
        const products = await Product.getAll();
        for (const p of products) {
            const rawCat = p.category || 'General';
            const cleanCat = CategoryHelper.sanitize(rawCat);
            if (rawCat !== cleanCat) {
                await db.update('products', { ...p, category: cleanCat });
            }
        }
    }

    static async delete(id, categoryName) {
        return await this.deleteAndReassign(id, categoryName, 'General');
    }
}
