/**
 * Model: Category
 * Manejo centralizado de categorías de productos en IndexedDB y SQLite.
 */
class Category {
    static _cache = null;
    static _cacheTime = 0;

    static clearCache() {
        this._cache = null;
        this._cacheTime = 0;
    }

    static async getAll(forceRefresh = false) {
        if (!forceRefresh && this._cache && (Date.now() - this._cacheTime < 30000)) {
            return [...this._cache];
        }

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
        const sorted = cats.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
        this._cache = sorted;
        this._cacheTime = Date.now();
        return sorted;
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

        let resultId;
        if (db.mode === 'sqlite') {
            const result = await window.ApiClient.post('categories', catData);
            resultId = result.id || result;
        } else {
            resultId = await db.add('categories', catData);
        }

        // Push inmediato a la nube
        if (typeof SyncService !== 'undefined' && typeof SyncService.pushCategories === 'function') {
            SyncService.getCurrentUserId().then(uid => { if (uid) SyncService.pushCategories(uid); }).catch(() => {});
        }

        this.clearCache();
        return resultId;
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
        } else {
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
        }

        // Sincronizar cambios a la nube
        if (typeof SyncService !== 'undefined') {
            if (typeof SyncService.markCategoryDeleted === 'function') {
                SyncService.markCategoryDeleted(cleanSource, id);
            }
            if (typeof SyncService.pushCategories === 'function') {
                SyncService.getCurrentUserId().then(uid => {
                    if (uid) {
                        SyncService.pushCategories(uid);
                        SyncService.pushProducts(uid);
                    }
                }).catch(() => {});
            }
        }

        this.clearCache();
        return true;
    }

    /**
     * Renombra o edita una categoría existente y actualiza todos sus productos asociados.
     */
    static async rename(id, oldName, newName, color = null) {
        const cleanOld = CategoryHelper.sanitize(oldName);
        const cleanNew = CategoryHelper.sanitize(newName || oldName);

        if (db.mode === 'sqlite') {
            await window.ApiClient.post('complex/categories/rename', {
                categoryId: id,
                oldName: cleanOld,
                newName: cleanNew,
                color: color || null
            });
        } else {
            // Modo IndexedDB
            if (!CategoryHelper.areEqual(cleanOld, cleanNew)) {
                const products = await Product.getAll();
                const oldNorm = CategoryHelper.normalizeKey(cleanOld);

                for (const p of products) {
                    if (CategoryHelper.normalizeKey(p.category || '') === oldNorm) {
                        await Product.update(p.id, { category: cleanNew });
                    }
                }
            }

            if (id) {
                const upd = { id, name: cleanNew };
                if (color) upd.color = color;
                await db.update('categories', upd);
            } else {
                const allCats = await db.getAll('categories');
                const oldNorm = CategoryHelper.normalizeKey(cleanOld);
                for (const c of allCats) {
                    if (CategoryHelper.normalizeKey(c.name) === oldNorm) {
                        const upd = { ...c, name: cleanNew };
                        if (color) upd.color = color;
                        await db.update('categories', upd);
                    }
                }
            }
        }

        // Sincronizar inmediatamente a la nube
        if (typeof SyncService !== 'undefined') {
            SyncService.getCurrentUserId().then(uid => {
                if (uid) {
                    if (typeof SyncService.pushCategories === 'function') SyncService.pushCategories(uid);
                    if (cleanNew !== cleanOld && typeof SyncService.pushProducts === 'function') SyncService.pushProducts(uid);
                }
            }).catch(() => {});
        }

        this.clearCache();
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
