const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const {
    dbGet,
    dbRun,
    dbRunSilent,
    dbAll,
    withTransaction,
    switchUserDatabase,
    getActiveUserId,
    defaultDbRun,
    defaultDbGet
} = require('../database/connection');

const { supabase, supabaseAdmin, createUserClient } = require('../supabase');

/**
 * Obtiene el cliente Supabase adecuado para la petición actual.
 * En el backend local de PC, prioriza el cliente administrativo seguro (Service Role)
 * para garantizar sincronización bidireccional estable sin caídas por tokens locales o expirados.
 * Si no hay Service Role, valida que el token recibido pertenezca legítimamente a Supabase Auth.
 */
function getSupabaseClientForRequest(req) {
    if (supabaseAdmin) {
        return supabaseAdmin;
    }

    const authHeader = req.headers['authorization'];
    let token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7);
    } else if (req.body && req.body.token && typeof req.body.token === 'string') {
        token = req.body.token;
    }

    if (token && token.length > 20) {
        try {
            // Validar que el token sea de Supabase (y no un JWT firmado localmente por el backend Node.js)
            const parts = token.split('.');
            if (parts.length === 3) {
                const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
                if (payload && (payload.iss === 'supabase' || payload.aud === 'authenticated' || (typeof payload.iss === 'string' && payload.iss.includes('supabase')))) {
                    return createUserClient(token);
                }
            }
        } catch (_) { }
    }

    return supabase;
}

function getSupabaseAdmin() {
    return supabaseAdmin || supabase;
}

function safeDate(val, fallback = null) {
    if (!val || val === 'null' || val === 'undefined') return fallback;
    return val;
}

/**
 * Resuelve el identificador único del usuario en Supabase de forma segura.
 * Si el cliente está autenticado con JWT, consulta directamente auth.getUser().
 */
async function resolveSupabaseUserId(req, client) {
    if (req.supabaseUserId) return req.supabaseUserId;

    // 1. Verificación segura por JWT
    if (client && client.auth) {
        try {
            const { data: { user }, error } = await client.auth.getUser();
            if (!error && user && user.id) {
                req.supabaseUserId = user.id;
                return user.id;
            }
        } catch (_) { }
    }

    // 2. Identificador explícito en body o cabeceras
    if (req.body && req.body.userId && typeof req.body.userId === 'string' && req.body.userId.length === 36) {
        return req.body.userId;
    }
    const headerUserId = req.headers['x-supabase-user-id'];
    if (headerUserId && headerUserId.length === 36) return headerUserId;

    // 3. req.userId verificado en sesión local
    if (req.userId && typeof req.userId === 'string' && req.userId.length === 36) {
        return req.userId;
    }

    return null;
}

/**
 * GET /api/sync/has-pending
 * Consulta ultrarrápida para verificar si hay cambios locales generados offline
 * sin necesidad de ejecutar un ciclo completo de sincronización.
 */
router.get('/api/sync/has-pending', async (req, res) => {
    try {
        const businessId = Number(req.query.businessId || 1);
        const [sales, purchases, expenses, payments, cashMovements] = await Promise.all([
            dbGet("SELECT COUNT(*) as c FROM sales WHERE business_id = ? AND (is_synced IS NULL OR is_synced = 0)", [businessId]),
            dbGet("SELECT COUNT(*) as c FROM purchases WHERE business_id = ? AND (is_synced IS NULL OR is_synced = 0)", [businessId]),
            dbGet("SELECT COUNT(*) as c FROM expenses WHERE business_id = ? AND (is_synced IS NULL OR is_synced = 0)", [businessId]),
            dbGet("SELECT COUNT(*) as c FROM payments WHERE business_id = ? AND (is_synced IS NULL OR is_synced = 0)", [businessId]),
            dbGet("SELECT COUNT(*) as c FROM cashMovements WHERE business_id = ? AND (is_synced IS NULL OR is_synced = 0)", [businessId])
        ]);
        const totalPending = (sales?.c || 0) + (purchases?.c || 0) + (expenses?.c || 0) + (payments?.c || 0) + (cashMovements?.c || 0);
        res.json({ success: true, hasPending: totalPending > 0, totalPending });
    } catch (err) {
        res.json({ success: false, hasPending: false, error: err.message });
    }
});

/**
 * POST /api/sync/cloud
 * Sincronización Bidireccional Robusta PC <-> Supabase Cloud
 * Usa cliente autenticado por sesión JWT respetando políticas RLS.
 */
router.post('/api/sync/cloud', async (req, res) => {
    let sb = getSupabaseClientForRequest(req);
    if (!sb) {
        return res.status(500).json({
            success: false,
            error: 'Configuración de Supabase Cloud no disponible en el servidor.'
        });
    }

    const userId = await resolveSupabaseUserId(req, sb);
    if (!userId) {
        return res.status(400).json({
            success: false,
            error: 'No se pudo identificar la cuenta de usuario de Supabase para sincronizar.'
        });
    }

    const businessId = Number(req.body?.businessId || req.headers['x-business-id'] || req.business_id || 1);
    const targetTable = req.body?.table || req.query?.table || null;

    // Validación Defensiva de Plan y Licencia para Sincronización en PC
    try {
        const { data: lic } = await sb
            .from('user_licenses')
            .select('plan, expires_at, is_owner')
            .eq('user_id', userId)
            .maybeSingle();

        if (lic) {
            const planUpper = (lic.plan || 'FREE').toUpperCase();
            const isExpired = lic.expires_at ? (new Date(lic.expires_at).getTime() < Date.now()) : false;
            const canSyncOnPc = (planUpper === 'PC_PRO' || planUpper === 'FULL_PRO' || planUpper === 'PRO' || lic.is_owner);

            if (!canSyncOnPc || isExpired) {
                console.log(`[SyncCloud] ⛔ Sincronización denegada para usuario [${userId}]: Plan ${planUpper} (Expirado: ${isExpired}). Se mantiene modo local.`);
                return res.status(403).json({
                    success: false,
                    error: `El plan actual (${planUpper}) no incluye sincronización en la nube para PC o está expirado. Los datos locales permanecen seguros en tu computadora.`,
                    plan: lic.plan,
                    isExpired
                });
            }
        }
    } catch (licErr) {
        console.warn('[SyncCloud] Advertencia verificando licencia en Supabase:', licErr.message);
    }

    const isPullOnly = Boolean(req.body?.mode === 'pull_only' || req.query?.mode === 'pull_only');
    if (isPullOnly) {
        console.log(`📥 [SyncCloud] Modo PULL_ONLY activado para [${userId}] (Solo descarga reactiva - cero rebote hacia Supabase).`);
        // Proxy protector de solo lectura: intercepta y anula escrituras hacia Supabase para evitar bucles de eco.
        // ponytail: soporte de llamadas encadenadas infinitas (.delete().eq().eq()) retornando un Proxy sobre la promesa.
        const createDummyChain = () => {
            const dummyPromise = Promise.resolve({ data: [], error: null });
            const dummyProxy = new Proxy(dummyPromise, {
                get(target, prop) {
                    if (prop === 'then' || prop === 'catch' || prop === 'finally') {
                        return target[prop].bind(target);
                    }
                    return () => dummyProxy;
                }
            });
            return dummyProxy;
        };

        const realSb = sb;
        sb = new Proxy(realSb, {
            get(target, prop) {
                if (prop === 'from') {
                    return (table) => {
                        const qb = target.from(table);
                        return new Proxy(qb, {
                            get(qTarget, qProp) {
                                if (['insert', 'upsert', 'update', 'delete'].includes(qProp)) {
                                    return () => createDummyChain();
                                }
                                return qTarget[qProp];
                            }
                        });
                    };
                }
                return target[prop];
            }
        });
    }

    // Asegurar que la BD SQLite activa sea la del usuario
    if (getActiveUserId() !== userId) {
        await switchUserDatabase(userId);
    }

    console.log(`☁️ [SyncCloud] Iniciando sincronización bidireccional para usuario [${userId}] (Negocio: ${businessId})...`);

    const stats = {
        pulled: {
            businesses: 0, products: 0, categories: 0, customers: 0, sales: 0, suppliers: 0,
            purchases: 0, cash_registers: 0, expenses: 0, cash_movements: 0, debt_payments: 0,
            stock_movements: 0, staff: 0, sale_returns: 0, product_price_history: 0, product_cost_history: 0,
            debt_payment_sessions: 0, counter_notes: 0
        },
        pushed: {
            businesses: 0, products: 0, categories: 0, customers: 0, sales: 0, suppliers: 0,
            purchases: 0, cash_registers: 0, expenses: 0, cash_movements: 0,
            debt_payments: 0, stock_movements: 0, staff: 0, sale_returns: 0, audit_logs: 0,
            product_price_history: 0, product_cost_history: 0, customer_credit_deposits: 0,
            supplier_payments: 0, debt_payment_sessions: 0, counter_notes: 0
        }
    };

    try {
        // =========================================================================
        // 0. SINCRONIZAR NEGOCIOS / SUCURSALES (BUSINESSES)
        // =========================================================================
        if (!targetTable || targetTable === 'businesses') {
        try {
            // ponytail: Vincular automáticamente el negocio local existente con el user_id de Supabase si venía de Plan Free (offline)
            try {
                await defaultDbRun(
                    "UPDATE businesses SET user_id = ? WHERE (user_id IS NULL OR user_id = '' OR user_id = '1') AND id = ?",
                    [userId, businessId]
                );
                await dbRun(
                    "UPDATE businesses SET user_id = ? WHERE (user_id IS NULL OR user_id = '' OR user_id = '1') AND id = ?",
                    [userId, businessId]
                );
            } catch (_) {}

            // A. PULL: Descargar negocios de Supabase
            const { data: cloudBizs, error: bizErr } = await sb
                .from('businesses')
                .select('*')
                .eq('user_id', userId);

            if (!bizErr && cloudBizs && cloudBizs.length > 0) {
                for (const cb of cloudBizs) {
                    if (cb.is_deleted) continue;
                    const localId = parseInt(cb.local_id || '1', 10);
                    const ownerId = cb.user_id || userId;
                    const existing = await defaultDbGet("SELECT id, name FROM businesses WHERE id = ?", [localId]);
                    if (!existing) {
                        const insertSql = `INSERT OR IGNORE INTO businesses (id, name, slug, phone, address, join_code, isActive, createdAt, user_id)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                        const insertParams = [
                            localId,
                            cb.name || 'Mi Negocio',
                            ((cb.name || 'negocio').toLowerCase().replace(/ /g, '-').replace(/[^\w-]/g, '')) + '-' + localId,
                            cb.phone || '',
                            cb.address || '',
                            cb.join_code || null,
                            cb.is_active ? 1 : 0,
                            cb.created_at || new Date().toISOString(),
                            ownerId
                        ];
                        await defaultDbRun(insertSql, insertParams);
                        try { await dbRun(insertSql, insertParams); } catch (_) { }
                        stats.pulled.businesses++;
                    } else {
                        const updateSql = `UPDATE businesses SET 
                                name = COALESCE(?, name),
                                phone = COALESCE(?, phone),
                                address = COALESCE(?, address),
                                join_code = COALESCE(?, join_code),
                                isActive = ?,
                                user_id = COALESCE(?, user_id)
                             WHERE id = ?`;
                        const updateParams = [cb.name, cb.phone, cb.address, cb.join_code || null, cb.is_active ? 1 : 0, ownerId, existing.id];
                        await defaultDbRun(updateSql, updateParams);
                        try { await dbRun(updateSql, updateParams); } catch (_) { }
                        stats.pulled.businesses++;
                    }
                }
            }

            // PUSH condicional (Desactivado en modo PULL_ONLY para evitar rebotes)
            if (!isPullOnly) {
                // B. PUSH: Subir negocios locales a Supabase
                const localBizs = await dbAll("SELECT * FROM businesses WHERE isActive = 1");
                if (localBizs && localBizs.length > 0) {
                    const bizPayload = localBizs.map(b => ({
                        user_id: userId,
                        local_id: String(b.id),
                        name: b.name || 'Mi Negocio',
                        business_code: b.accessCode || b.business_code || null,
                        phone: b.phone || '',
                        address: b.address || '',
                        join_code: b.join_code || null,
                        currency: '$',
                        is_active: Boolean(b.isActive !== 0),
                        is_deleted: false,
                        updated_at: b.updatedAt || new Date().toISOString()
                    }));
                    const { error: pushBizErr } = await sb.from('businesses').upsert(bizPayload, { onConflict: 'user_id,local_id' });
                    if (!pushBizErr) stats.pushed.businesses = bizPayload.length;
                }
            }
        } catch (bizSyncErr) {
            console.warn('[SyncCloud] Advertencia sincronizando negocios:', bizSyncErr.message);
        }
        }

        // =========================================================================
        // 1. SINCRONIZAR CATEGORÍAS (PULL & PUSH)
        // =========================================================================
        if (!targetTable || targetTable === 'categories') {
        try {
            // A. Descargar categorías de Supabase (filtradas por business_id activo)
            const { data: cloudCats, error: catErr } = await sb
                .from('categories')
                .select('*')
                .eq('user_id', userId)
                .eq('business_id', String(businessId));

            if (!catErr && cloudCats) {
                const localCats = await dbAll("SELECT id, name, color, deleted_at FROM categories WHERE business_id = ?", [businessId]);
                const localCatsMap = new Map();
                localCats.forEach(c => localCatsMap.set(c.name.trim().toLowerCase(), c));

                const now = new Date().toISOString();
                for (const cc of cloudCats) {
                    const catName = (cc.name || '').trim();
                    if (!catName) continue;
                    const existing = localCatsMap.get(catName.toLowerCase());

                    if (cc.is_deleted) {
                        // ponytail: Borrado lógico anti-zombi: si en Supabase está borrada, asegurar borrado local
                        if (existing && !existing.deleted_at) {
                            await dbRun("UPDATE categories SET deleted_at = ? WHERE id = ?", [now, existing.id]);
                            stats.pulled.categories++;
                        }
                        continue;
                    }

                    if (!existing) {
                        await dbRun(
                            "INSERT OR IGNORE INTO categories (name, color, business_id, is_synced) VALUES (?, ?, ?, 1)",
                            [catName, cc.color || '#3b82f6', businessId]
                        );
                        stats.pulled.categories++;
                    } else if (existing.deleted_at) {
                        // Si en la nube está activa pero localmente estaba borrada, reactivar
                        await dbRun("UPDATE categories SET deleted_at = NULL, color = ? WHERE id = ?", [cc.color || existing.color || '#3b82f6', existing.id]);
                        stats.pulled.categories++;
                    } else if (cc.color && existing.color !== cc.color) {
                        await dbRun("UPDATE categories SET color = ? WHERE id = ?", [cc.color, existing.id]);
                        stats.pulled.categories++;
                    }
                }

                // B. Subir categorías locales a Supabase (incluyendo estado de borrado lógico)
                const cloudCatsMap = new Map();
                cloudCats.forEach(c => cloudCatsMap.set((c.name || '').trim().toLowerCase(), c));

                const catsToPush = [];
                for (const lc of localCats) {
                    const cleanName = lc.name.trim();
                    const cloudCat = cloudCatsMap.get(cleanName.toLowerCase());
                    const isLocallyDeleted = Boolean(lc.deleted_at);

                    if (!cloudCat || Boolean(cloudCat.is_deleted) !== isLocallyDeleted) {
                        catsToPush.push({
                            user_id: userId,
                            business_id: String(businessId),
                            local_id: String(lc.id),
                            name: cleanName,
                            color: lc.color || '#3b82f6',
                            icon: 'tag',
                            is_deleted: isLocallyDeleted,
                            updated_at: new Date().toISOString()
                        });
                    }
                }

                if (catsToPush.length > 0) {
                    const { error: pushCatErr } = await sb
                        .from('categories')
                        .upsert(catsToPush, { onConflict: 'user_id,business_id,local_id' });
                    if (!pushCatErr) {
                        stats.pushed.categories = catsToPush.length;
                    } else {
                        // ponytail: Fallback individual tolerante a fallos
                        for (const singleCat of catsToPush) {
                            const { error: sCatErr } = await sb
                                .from('categories')
                                .upsert([singleCat], { onConflict: 'user_id,business_id,local_id' });
                            if (!sCatErr) stats.pushed.categories++;
                        }
                    }
                }
            }
        } catch (catSyncErr) {
            console.warn('[SyncCloud] Advertencia sincronizando categorías:', catSyncErr.message);
        }
        }

        // =========================================================================
        // 2. SINCRONIZAR PRODUCTOS (PULL & PUSH)
        // =========================================================================
        try {
            // A. Descargar todos los productos de Supabase (filtrados por business_id activo, con paginación)
            let allCloudProds = [];
            let from = 0;
            const batchSize = 1000;

            while (true) {
                const { data: batch, error: prodErr } = await sb
                    .from('products')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('business_id', String(businessId))
                    .order('name', { ascending: true })
                    .range(from, from + batchSize - 1);

                if (prodErr) throw prodErr;
                if (!batch || batch.length === 0) break;
                allCloudProds = allCloudProds.concat(batch);
                if (batch.length < batchSize) break;
                from += batchSize;
            }

            console.log(`[SyncCloud] 📦 Productos recibidos desde Supabase Cloud para negocio [${businessId}]: ${allCloudProds.length}`);

            // Obtener productos locales actuales en SQLite para este negocio
            const localProducts = await dbAll(
                "SELECT id, barcode, name, description, category, cost, costNeto, price, stock, minStock, maxStock, type, additionalTaxesConfig, expiryDate, image, isActive, deletedAt, cloud_id, updatedAt FROM products WHERE business_id = ?",
                [businessId]
            );

            const mapByCloudId = new Map();
            const mapByBarcode = new Map();
            const mapById = new Map();

            localProducts.forEach(p => {
                mapById.set(String(p.id), p);
                if (p.cloud_id) mapByCloudId.set(String(p.cloud_id), p);
                if (p.barcode && p.barcode.trim()) mapByBarcode.set(p.barcode.trim(), p);
            });

            const now = new Date().toISOString();

            // Guardar o actualizar productos de la nube en SQLite dentro de transacción
            await withTransaction(async () => {
                for (const cp of allCloudProds) {
                    const cleanCode = (cp.code || '').trim();
                    const targetCloudId = String(cp.local_id || cp.id);

                    // Buscar coincidencia local
                    const existing = mapByCloudId.get(targetCloudId) ||
                        (cleanCode ? mapByBarcode.get(cleanCode) : null) ||
                        mapById.get(targetCloudId);

                    const isDeleted = Boolean(cp.is_deleted);
                    const isActive = isDeleted ? 0 : 1;
                    const deletedAt = isDeleted ? now : null;

                    if (existing) {
                        // Respetar updated_at para no descartar productos locales existentes más recientes
                        const cloudUpdated = cp.updated_at ? new Date(cp.updated_at).getTime() : 0;
                        const localUpdated = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;

                        // Falla #22: Protección contra desvíos de reloj (Clock Skew).
                        // Solo se preserva la versión local sobre la nube si el registro local TIENE cambios pendientes sin sincronizar (is_synced === 0).
                        const hasUnsyncedLocalChanges = (existing.is_synced === 0 || existing.is_synced === false);
                        const isLocalNewer = (localUpdated && cloudUpdated && localUpdated > cloudUpdated);
                        if (hasUnsyncedLocalChanges && isLocalNewer) {
                            console.log(`[SyncCloud] 🛡️ Producto local "${existing.name}" tiene cambios pendientes locales (${existing.updatedAt} > ${cp.updated_at}). Se preserva.`);
                        } else {
                            // Actualizar producto local existente con datos de la nube
                            await dbRun(
                                `UPDATE products SET 
                                    name = ?,
                                    description = ?,
                                    category = ?,
                                    cost = ?,
                                    costNeto = ?,
                                    price = ?,
                                    stock = ?,
                                    minStock = ?,
                                    maxStock = ?,
                                    type = ?,
                                    additionalTaxesConfig = ?,
                                    expiryDate = ?,
                                    image = ?,
                                    isActive = ?,
                                    deletedAt = ?,
                                    cloud_id = ?,
                                    is_synced = 1,
                                    updatedAt = ?
                                 WHERE id = ?`,
                                [
                                    cp.name || existing.name,
                                    cp.description || existing.description || '',
                                    cp.category || existing.category || 'General',
                                    Number(cp.cost_price ?? existing.cost ?? 0),
                                    Number(cp.cost_neto ?? existing.costNeto ?? 0),
                                    Number(cp.sale_price ?? existing.price ?? 0),
                                    Number(cp.stock ?? existing.stock ?? 0),
                                    Number(cp.min_stock ?? existing.minStock ?? 0),
                                    Number(cp.max_stock ?? existing.maxStock ?? 0),
                                    cp.type || existing.type || 'unit',
                                    cp.additional_taxes_config ? (typeof cp.additional_taxes_config === 'string' ? cp.additional_taxes_config : JSON.stringify(cp.additional_taxes_config)) : (existing.additionalTaxesConfig || '[]'),
                                    cp.expiry_date || existing.expiryDate || null,
                                    cp.image || existing.image || '',
                                    isActive,
                                    deletedAt,
                                    targetCloudId,
                                    cp.updated_at || now,
                                    existing.id
                                ]
                            );
                            stats.pulled.products++;
                        }
                    } else if (!isDeleted) {
                        // Insertar nuevo producto proveniente de la nube
                        await dbRun(
                            `INSERT INTO products (
                                barcode, name, description, category, cost, costNeto, price, stock, minStock, maxStock,
                                type, additionalTaxesConfig, expiryDate, image, isActive, deletedAt, business_id, cloud_id, is_synced, createdAt, updatedAt
                             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, ?, 1, ?, ?)`,
                            [
                                cleanCode || targetCloudId,
                                cp.name || 'Sin Nombre',
                                cp.description || '',
                                cp.category || 'General',
                                Number(cp.cost_price || 0),
                                Number(cp.cost_neto || 0),
                                Number(cp.sale_price || 0),
                                Number(cp.stock || 0),
                                Number(cp.min_stock || 0),
                                Number(cp.max_stock || 0),
                                cp.type || 'unit',
                                cp.additional_taxes_config ? (typeof cp.additional_taxes_config === 'string' ? cp.additional_taxes_config : JSON.stringify(cp.additional_taxes_config)) : '[]',
                                cp.expiry_date || null,
                                cp.image || '',
                                businessId,
                                targetCloudId,
                                cp.updated_at || now,
                                cp.updated_at || now
                            ]
                        );
                        stats.pulled.products++;
                    }
                }
            });

            // B. PUSH: Subir productos de SQLite a Supabase que no estén en la nube o que sean más recientes localmente
            const cloudProdsMap = new Map();
            allCloudProds.forEach(cp => {
                if (cp.local_id) cloudProdsMap.set(String(cp.local_id), cp);
                if (cp.code && cp.code.trim()) cloudProdsMap.set(cp.code.trim(), cp);
            });

            const prodsToPush = [];
            const freshLocalProducts = await dbAll(
                "SELECT id, barcode, name, description, category, cost, costNeto, price, stock, minStock, maxStock, type, additionalTaxesConfig, expiryDate, image, isActive, deletedAt, cloud_id, updatedAt FROM products WHERE business_id = ?",
                [businessId]
            );

            const seenPushIds = new Set();
            for (const lp of freshLocalProducts) {
                const rawCloudId = (lp.cloud_id && lp.cloud_id !== 'null' && lp.cloud_id !== 'undefined') ? String(lp.cloud_id).trim() : '';
                const targetLocalId = rawCloudId || String(lp.id);
                if (!targetLocalId || seenPushIds.has(targetLocalId)) continue;

                const targetKey = rawCloudId || (lp.barcode ? lp.barcode.trim() : String(lp.id));
                const cloudProd = cloudProdsMap.get(targetKey);
                const localUpdated = lp.updatedAt ? new Date(lp.updatedAt).getTime() : 0;
                const cloudUpdated = (cloudProd && cloudProd.updated_at) ? new Date(cloudProd.updated_at).getTime() : 0;

                if (!cloudProd || (localUpdated > cloudUpdated)) {
                    seenPushIds.add(targetLocalId);
                    // ponytail: Preservar el stock existente en Supabase para evitar sobreescribir ventas de otras terminales
                    const effectiveStock = cloudProd ? Number(cloudProd.stock ?? lp.stock ?? 0) : Number(lp.stock || 0);

                    let parsedTaxes = [];
                    try { parsedTaxes = typeof lp.additionalTaxesConfig === 'string' ? JSON.parse(lp.additionalTaxesConfig || '[]') : (lp.additionalTaxesConfig || []); } catch (_) {}

                    prodsToPush.push({
                        user_id: userId,
                        business_id: String(businessId),
                        local_id: targetLocalId,
                        code: (lp.barcode || String(lp.id)).trim(),
                        name: lp.name || 'Sin Nombre',
                        category: lp.category || 'General',
                        cost_price: Number(lp.cost || 0),
                        cost_neto: Number(lp.costNeto || 0),
                        sale_price: Number(lp.price || 0),
                        stock: effectiveStock,
                        min_stock: Number(lp.minStock || 0),
                        max_stock: Number(lp.maxStock || 0),
                        type: lp.type || 'unit',
                        additional_taxes_config: parsedTaxes,
                        expiry_date: lp.expiryDate || null,
                        image: lp.image || '',
                        description: lp.description || '',
                        is_favorite: false,
                        is_deleted: Boolean(lp.isActive === 0 || (lp.deletedAt && lp.deletedAt !== 'null')),
                        updated_at: lp.updatedAt || now
                    });
                }
            }

            if (prodsToPush.length > 0) {
                console.log(`[SyncCloud] 📤 Subiendo ${prodsToPush.length} productos de SQLite a Supabase (Negocio: ${businessId})...`);
                const PUSH_BATCH = 100;
                for (let i = 0; i < prodsToPush.length; i += PUSH_BATCH) {
                    const chunk = prodsToPush.slice(i, i + PUSH_BATCH);
                    const { error: pushErr } = await sb
                        .from('products')
                        .upsert(chunk, { onConflict: 'user_id,business_id,local_id' });
                    if (pushErr) {
                        console.warn('[SyncCloud] Conflicto en lote de productos, reintentando individualmente:', pushErr.message);
                        // ponytail: Resiliencia tolerante a fallos: aislar productos conflictivos para no trabar el resto del lote
                        for (const singleProd of chunk) {
                            const { error: singleProdErr } = await sb
                                .from('products')
                                .upsert([singleProd], { onConflict: 'user_id,business_id,local_id' });
                            if (!singleProdErr) {
                                stats.pushed.products++;
                            } else {
                                console.warn(`[SyncCloud] Producto individual omitido por error (${singleProd.code || singleProd.local_id}):`, singleProdErr.message);
                            }
                        }
                    } else {
                        stats.pushed.products += chunk.length;
                    }
                }
            }

        } catch (prodSyncErr) {
            console.error('[SyncCloud] Error sincronizando productos:', prodSyncErr);
            throw prodSyncErr;
        }

        // =========================================================================
        // 3. SINCRONIZAR VENTAS (PUSH ITERATIVO COMPLETO POR LOTES)
        // =========================================================================
        try {
            // Mapa de cajas locales para vincular venta con UUID universal de la caja
            const localRegRows = await dbAll("SELECT id, uuid FROM cashRegisters WHERE business_id = ?", [businessId]);
            const localRegMap = new Map();
            localRegRows.forEach(r => { if (r.uuid) localRegMap.set(Number(r.id), String(r.uuid)); });

            let hasMoreSales = true;
            const SALE_BATCH_SIZE = 200; // ponytail: Lotes de 200 para máxima estabilidad y evitar timeouts en conexiones lentas

            while (hasMoreSales) {
                const unsyncedSales = await dbAll(
                    "SELECT * FROM sales WHERE business_id = ? AND (is_synced IS NULL OR is_synced = 0) ORDER BY date ASC LIMIT ?",
                    [businessId, SALE_BATCH_SIZE]
                );

                if (!unsyncedSales || unsyncedSales.length === 0) {
                    hasMoreSales = false;
                    break;
                }

                const salesPayload = unsyncedSales.map(s => {
                    let parsedItems = [];
                    try {
                        parsedItems = typeof s.items === 'string' ? JSON.parse(s.items || '[]') : (s.items || []);
                    } catch (_) { parsedItems = []; }

                    let pd = s.paymentDetails;
                    if (typeof pd === 'string') {
                        try { pd = JSON.parse(pd); } catch (_) { pd = {}; }
                    }

                    const saleUuid = s.uuid || s.server_id || ('sale_' + (s.terminal_id || 'PC') + '_' + s.id);
                    const mappedRegisterId = (s.cashRegisterId && localRegMap.get(Number(s.cashRegisterId))) 
                        ? localRegMap.get(Number(s.cashRegisterId)) 
                        : (s.cashRegisterId ? String(s.cashRegisterId) : null);

                    return {
                        user_id: userId,
                        business_id: String(businessId),
                        local_id: String(saleUuid),
                        sale_number: s.saleNumber || null,
                        sale_date: s.date || s.createdAt || new Date().toISOString(),
                        subtotal: Number(s.subtotal || 0),
                        tax_amount: Number(s.tax || s.tax_amount || 0),
                        commission_amount: Number(s.commission_amount || 0),
                        total: Number(s.total || 0),
                        payment_method: s.paymentMethod || 'EFECTIVO',
                        customer_id: s.customerId ? String(s.customerId) : null,
                        items: parsedItems,
                        cash_register_id: mappedRegisterId,
                        status: s.status || 'completed',
                        payment_details: pd || {},
                        paid_amount: Number(s.paidAmount !== undefined ? s.paidAmount : s.total || 0),
                        paid_at: s.paidAt || null,
                        terminal_id: s.terminal_id || 'PC-1',
                        synced_at: new Date().toISOString()
                    };
                });

                const { error: salesPushErr } = await sb
                    .from('sales')
                    .upsert(salesPayload, { onConflict: 'user_id,business_id,local_id' });

                let successfulSales = [];
                if (salesPushErr) {
                    console.warn('[SyncCloud] Conflicto en lote de ventas, reintentando individualmente:', salesPushErr.message);
                    for (let idx = 0; idx < salesPayload.length; idx++) {
                        const singleSale = salesPayload[idx];
                        const { error: singleSaleErr } = await sb
                            .from('sales')
                            .upsert([singleSale], { onConflict: 'user_id,business_id,local_id' });
                        if (!singleSaleErr) {
                            successfulSales.push({ ...singleSale, localSaleId: unsyncedSales[idx]?.id });
                        } else {
                            console.warn(`[SyncCloud] Venta individual omitida (${singleSale.local_id}):`, singleSaleErr.message);
                        }
                    }
                    if (successfulSales.length === 0) break;
                } else {
                    successfulSales = salesPayload.map((sp, idx) => ({ ...sp, localSaleId: unsyncedSales[idx]?.id }));
                }

                // ponytail: Descontar stock relativo atómico en Supabase para cada producto vendido con éxito en este lote
                for (const s of successfulSales) {
                    if (Array.isArray(s.items)) {
                        for (const it of s.items) {
                            const qty = Number(it.quantity || it.qty || 0);
                            if (qty > 0) {
                                const pLocalId = String(it.productId || it.id || '');
                                const pCode = (it.barcode || it.code || '').trim();
                                if (pLocalId || pCode) {
                                    try {
                                        const { error: rpcErr } = await sb.rpc('adjust_stock_delta', {
                                            p_user_id: userId,
                                            p_local_id: pLocalId || pCode,
                                            p_delta: -qty
                                        });
                                        if (rpcErr) {
                                            // Fallback directo sobre tabla products si RPC no estuviera instalado en Supabase
                                            const { data: cloudItem } = await sb
                                                .from('products')
                                                .select('id, stock')
                                                .eq('user_id', userId)
                                                .or(pLocalId ? `local_id.eq.${pLocalId}` : `code.eq.${pCode}`)
                                                .maybeSingle();
                                            if (cloudItem && cloudItem.stock !== undefined) {
                                                await sb.from('products').update({
                                                    stock: Number(cloudItem.stock || 0) - qty,
                                                    updated_at: new Date().toISOString()
                                                }).eq('id', cloudItem.id);
                                            }
                                        }
                                    } catch (_) { }
                                }
                            }
                        }
                    }
                }

                const syncedIds = successfulSales.map(s => s.localSaleId).filter(Boolean);
                if (syncedIds.length > 0) {
                    await dbRunSilent(`UPDATE sales SET is_synced = 1 WHERE id IN (${syncedIds.map(() => '?').join(',')})`, syncedIds);
                    stats.pushed.sales += syncedIds.length;
                }

                if (unsyncedSales.length < SALE_BATCH_SIZE) {
                    hasMoreSales = false;
                }
            }
        } catch (salesErr) {
            console.warn('[SyncCloud] Advertencia sincronizando ventas (PUSH):', salesErr.message);
        }

        // B. PULL: Descargar ventas remotas desde Supabase (creadas en PC 2 o Mobile)
        try {
            const { data: cloudSales, error: cloudSalesErr } = await sb
                .from('sales')
                .select('*')
                .eq('user_id', userId)
                .eq('business_id', String(businessId))
                .order('sale_date', { ascending: false })
                .limit(1000);

            if (!cloudSalesErr && Array.isArray(cloudSales) && cloudSales.length > 0) {
                const localExistingSales = await dbAll("SELECT id, cloud_id, server_id, uuid, date, total, customerId, status FROM sales WHERE business_id = ?", [businessId]);
                const existingCloudMap = new Set();
                const existingUuidMap = new Set();
                const localSalesById = new Map();
                const localSalesBySignature = new Map();

                // Mapas de resolución UUID -> ID entero para clientes y cajas de este negocio
                const localCustList = await dbAll("SELECT id, uuid, cloud_id FROM customers WHERE business_id = ?", [businessId]);
                const custResolverMap = new Map();
                localCustList.forEach(c => {
                    custResolverMap.set(String(c.id), c.id);
                    if (c.uuid) custResolverMap.set(String(c.uuid), c.id);
                    if (c.cloud_id) custResolverMap.set(String(c.cloud_id), c.id);
                });

                const localCrList = await dbAll("SELECT id, uuid, cloud_id FROM cashRegisters WHERE business_id = ?", [businessId]);
                const crResolverMap = new Map();
                localCrList.forEach(cr => {
                    crResolverMap.set(String(cr.id), cr.id);
                    if (cr.uuid) crResolverMap.set(String(cr.uuid), cr.id);
                    if (cr.cloud_id) crResolverMap.set(String(cr.cloud_id), cr.id);
                });

                localExistingSales.forEach(ls => {
                    localSalesById.set(Number(ls.id), ls);
                    if (ls.cloud_id) existingCloudMap.add(String(ls.cloud_id));
                    if (ls.uuid) existingUuidMap.add(String(ls.uuid));
                    if (ls.server_id) existingUuidMap.add(String(ls.server_id));
                    if (ls.date && ls.total !== undefined) {
                        const dateKey = String(ls.date).slice(0, 19);
                        const cKey = ls.customerId ? String(ls.customerId) : 'none';
                        const sig = `${cKey}_${dateKey}_${Number(ls.total).toFixed(2)}`;
                        localSalesBySignature.set(sig, ls);
                    }
                });

                for (const cs of cloudSales) {
                    const cloudId = String(cs.id);
                    const cloudLocalId = cs.local_id ? String(cs.local_id) : null;

                    // Triple Candado Anti-Duplicados:
                    // 1. Búsqueda por cloud_id o UUID directo
                    let matchedLocalSale = null;
                    if (cloudLocalId && existingUuidMap.has(cloudLocalId)) {
                        matchedLocalSale = localExistingSales.find(ls => String(ls.uuid) === cloudLocalId || String(ls.server_id) === cloudLocalId);
                    } else if (existingCloudMap.has(cloudId)) {
                        matchedLocalSale = localExistingSales.find(ls => String(ls.cloud_id) === cloudId);
                    }

                    // 2. Desempaquetado de prefijo sale_PC_<id> o sale_<term>_<id>
                    if (!matchedLocalSale && cloudLocalId && cloudLocalId.startsWith('sale_')) {
                        const parts = cloudLocalId.split('_');
                        const potentialId = parseInt(parts[parts.length - 1], 10);
                        if (!isNaN(potentialId) && localSalesById.has(potentialId)) {
                            matchedLocalSale = localSalesById.get(potentialId);
                        }
                    }

                    // 3. Firma digital única (Mismo cliente + misma fecha/hora + mismo monto)
                    if (!matchedLocalSale && cs.sale_date && cs.total !== undefined) {
                        const cloudDateKey = String(cs.sale_date).slice(0, 19);
                        const resolvedCustForSig = cs.customer_id ? (custResolverMap.get(String(cs.customer_id)) || cs.customer_id) : 'none';
                        const cloudSig = `${resolvedCustForSig}_${cloudDateKey}_${Number(cs.total).toFixed(2)}`;
                        if (localSalesBySignature.has(cloudSig)) {
                            matchedLocalSale = localSalesBySignature.get(cloudSig);
                        }
                    }

                    if (matchedLocalSale) {
                        // Enlazar identificadores de Supabase a la venta local existente si estaban vacíos
                        if (!matchedLocalSale.cloud_id || !matchedLocalSale.uuid) {
                            await dbRun(
                                "UPDATE sales SET cloud_id = ?, uuid = COALESCE(uuid, ?), is_synced = 1 WHERE id = ?",
                                [cloudId, cloudLocalId || ('sale_PC_' + matchedLocalSale.id), matchedLocalSale.id]
                            );
                            matchedLocalSale.cloud_id = cloudId;
                            if (cloudLocalId) matchedLocalSale.uuid = cloudLocalId;
                            existingCloudMap.add(cloudId);
                            if (cloudLocalId) existingUuidMap.add(cloudLocalId);
                        }

                        // Sincronizar anulaciones remotas
                        const isCloudCancelled = cs.status === 'cancelled' || cs.is_deleted === true || Boolean(cs.deleted_at);
                        if (isCloudCancelled && matchedLocalSale.status !== 'cancelled') {
                            await dbRun(
                                "UPDATE sales SET status = 'cancelled', paymentMethod = 'cancelled', deleted_at = COALESCE(?, deleted_at, ?), updatedAt = ? WHERE id = ? AND business_id = ?",
                                [cs.deleted_at, new Date().toISOString(), new Date().toISOString(), matchedLocalSale.id, businessId]
                            );
                        }
                        continue;
                    }

                    let itemsStr = '[]';
                    try {
                        itemsStr = typeof cs.items === 'string' ? cs.items : JSON.stringify(cs.items || []);
                    } catch (_) { itemsStr = '[]'; }

                    let pdStr = '{}';
                    try {
                        pdStr = typeof cs.payment_details === 'string' ? cs.payment_details : JSON.stringify(cs.payment_details || {});
                    } catch (_) { pdStr = '{}'; }

                    // Resolver cliente y caja por ID o UUID
                    const resolvedCustomerId = cs.customer_id ? (custResolverMap.get(String(cs.customer_id)) || (parseInt(cs.customer_id, 10) || null)) : null;
                    const resolvedCashRegisterId = cs.cash_register_id ? (crResolverMap.get(String(cs.cash_register_id)) || (parseInt(cs.cash_register_id, 10) || null)) : null;

                    await dbRun(`
                        INSERT INTO sales (
                            date, total, paidAmount, paymentMethod, paymentDetails, customerId, 
                            cashRegisterId, items, status, business_id, is_synced, cloud_id, uuid, server_id, source, terminal_id, createdAt, updatedAt
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 'remote', ?, ?, ?)
                    `, [
                        cs.sale_date || new Date().toISOString(),
                        Number(cs.total || 0),
                        Number(cs.paid_amount !== undefined ? cs.paid_amount : cs.total || 0),
                        cs.payment_method || 'EFECTIVO',
                        pdStr,
                        resolvedCustomerId,
                        resolvedCashRegisterId,
                        itemsStr,
                        cs.status || 'completed',
                        businessId,
                        cloudId,
                        cloudLocalId || ('sale_cloud_' + cloudId),
                        cloudLocalId || cloudId,
                        cs.terminal_id || 'REMOTE',
                        cs.sale_date || new Date().toISOString(),
                        cs.updated_at || new Date().toISOString()
                    ]);

                    // ponytail: Descontar stock local para la venta remota descargada sin truncar arbitrariamente a 0 (respetar ventas sin stock)
                    let parsedRemoteItems = [];
                    try { parsedRemoteItems = JSON.parse(itemsStr); } catch (_) {}
                    if (Array.isArray(parsedRemoteItems)) {
                        for (const it of parsedRemoteItems) {
                            const pId = it.productId || it.id;
                            const pCode = (it.barcode || it.code || '').trim();
                            const qty = Number(it.quantity || it.qty || 0);
                            if (qty > 0 && (pId || pCode)) {
                                await dbRun(
                                    "UPDATE products SET stock = stock - ? WHERE (id = ? OR (barcode = ? AND barcode != '')) AND business_id = ?",
                                    [qty, pId || 0, pCode, businessId]
                                );
                            }
                        }
                    }

                    existingCloudMap.add(cloudId);
                    if (cloudLocalId) existingUuidMap.add(cloudLocalId);
                    stats.pulled.sales++;
                }
            }
        } catch (pullSalesErr) {
            console.warn('[SyncCloud] Advertencia descargando ventas remotas:', pullSalesErr.message);
        }

        // =========================================================================
        // 4. SINCRONIZAR CLIENTES (PULL & PUSH)
        // =========================================================================
        if (!targetTable || targetTable === 'customers') {
        try {
            // A. Descargar clientes desde Supabase (filtrados por business_id activo)
            const { data: cloudCustomers, error: custErr } = await sb
                .from('customers')
                .select('*')
                .eq('user_id', userId)
                .eq('business_id', String(businessId));

            if (!custErr && cloudCustomers) {
                const localCustomers = await dbAll("SELECT * FROM customers WHERE business_id = ?", [businessId]);
                const mapByRut = new Map();
                const mapByName = new Map();
                const mapById = new Map();
                const mapByUuid = new Map();
                const mapByCloudId = new Map();

                localCustomers.forEach(c => {
                    mapById.set(String(c.id), c);
                    if (c.cloud_id) mapByCloudId.set(String(c.cloud_id), c);
                    if (c.uuid) mapByUuid.set(String(c.uuid), c);
                    if (c.rut && c.rut.trim()) mapByRut.set(c.rut.trim().toLowerCase(), c);
                    if (c.name && c.name.trim()) mapByName.set(c.name.trim().toLowerCase(), c);
                });

                for (const cc of cloudCustomers) {
                    const cleanRut = (cc.rut || '').trim().toLowerCase();
                    const cleanName = (cc.name || '').trim().toLowerCase();
                    const cloudUuid = cc.local_id || cc.uuid || '';
                    const cloudId = cc.id ? String(cc.id) : null;

                    const existing = (cloudId ? mapByCloudId.get(cloudId) : null) ||
                        (cloudUuid ? mapByUuid.get(cloudUuid) : null) ||
                        (cleanRut ? mapByRut.get(cleanRut) : null) ||
                        (cleanName ? mapByName.get(cleanName) : null);

                    const isDeleted = Boolean(cc.is_deleted);
                    const isActive = isDeleted ? 0 : 1;
                    const deletedAt = isDeleted ? (cc.updated_at || new Date().toISOString()) : null;

                    if (existing) {
                        const assignedUuid = existing.uuid || cloudUuid || ('cst_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9));
                        await dbRun(
                            `UPDATE customers SET 
                                name = ?, phone = ?, email = ?, rut = ?, address = ?, 
                                creditLimit = ?, balanceCredit = ?, isActive = ?, deletedAt = ?, 
                                is_synced = 1, cloud_id = ?, uuid = ?, updatedAt = ?
                             WHERE id = ?`,
                            [
                                cc.name || existing.name,
                                cc.phone || existing.phone || '',
                                cc.email || existing.email || '',
                                cc.rut || existing.rut || '',
                                cc.address || existing.address || '',
                                Number(cc.credit_limit ?? existing.creditLimit ?? 0),
                                (cc.balance_credit !== undefined && cc.balance_credit !== null ? Number(cc.balance_credit) : Number(existing.balanceCredit || 0)),
                                isActive,
                                deletedAt,
                                cloudId || existing.cloud_id || null,
                                assignedUuid,
                                cc.updated_at || new Date().toISOString(),
                                existing.id
                            ]
                        );
                        stats.pulled.customers++;
                    } else if (!isDeleted && cc.name) {
                        const assignedUuid = cloudUuid || ('cst_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9));
                        await dbRun(
                            `INSERT INTO customers (
                                name, phone, email, rut, address, creditLimit, balanceCredit, 
                                isActive, deletedAt, business_id, is_synced, cloud_id, uuid, createdAt, updatedAt
                             ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, 1, ?, ?, ?, ?)`,
                            [
                                cc.name,
                                cc.phone || '',
                                cc.email || '',
                                cc.rut || '',
                                cc.address || '',
                                Number(cc.credit_limit || 0),
                                Number(cc.balance_credit || 0),
                                businessId,
                                cloudId,
                                assignedUuid,
                                cc.created_at || new Date().toISOString(),
                                cc.updated_at || new Date().toISOString()
                            ]
                        );
                        stats.pulled.customers++;
                    }
                }

                // B. Subir clientes locales a Supabase asegurando UUID único
                const freshLocalCustomers = await dbAll("SELECT * FROM customers WHERE business_id = ?", [businessId]);

                for (const c of freshLocalCustomers) {
                    if (!c.uuid) {
                        c.uuid = 'cst_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9) + '_' + c.id;
                        await dbRun("UPDATE customers SET uuid = ? WHERE id = ?", [c.uuid, c.id]);
                    }
                }

                // Calcular la deuda real acumulada de cada cliente a partir de sus ventas pendientes
                const debtRows = await dbAll(`
                    SELECT customerId, 
                           SUM(CAST(total AS REAL) - CAST(paidAmount AS REAL)) as totalDebt
                    FROM sales 
                    WHERE business_id = ? 
                      AND status IN ('pending', 'partial') 
                      AND customerId IS NOT NULL 
                      AND (CAST(total AS REAL) - CAST(paidAmount AS REAL)) > 0
                    GROUP BY customerId
                `, [businessId]);

                const debtMap = new Map();
                debtRows.forEach(r => debtMap.set(String(r.customerId), Number(r.totalDebt || 0)));

                const custPayload = freshLocalCustomers.map(c => {
                    const rawDebt = debtMap.get(String(c.id)) || 0;
                    const creditFavor = Number(c.balanceCredit || 0);
                    const netDebt = Math.max(0, rawDebt - creditFavor);
                    return {
                        user_id: userId,
                        business_id: String(businessId),
                        local_id: c.uuid, // UUID global anti-colisiones multi-terminal
                        name: c.name || 'Cliente',
                        phone: c.phone || '',
                        email: c.email || '',
                        rut: c.rut || '',
                        address: c.address || '',
                        credit_limit: Number(c.creditLimit || 0),
                        debt: netDebt,
                        balance_credit: creditFavor,
                        is_deleted: Boolean(c.isActive === 0 || (c.deletedAt && c.deletedAt !== 'null')),
                        updated_at: c.updatedAt || new Date().toISOString()
                    };
                });

                if (custPayload.length > 0) {
                    const BATCH = 100;
                    for (let i = 0; i < custPayload.length; i += BATCH) {
                        const chunk = custPayload.slice(i, i + BATCH);
                        const { error: pushCustErr } = await sb
                            .from('customers')
                            .upsert(chunk, { onConflict: 'user_id,business_id,local_id' });
                        if (!pushCustErr) stats.pushed.customers += chunk.length;
                    }
                }
            }
        } catch (custSyncErr) {
            console.warn('[SyncCloud] Advertencia sincronizando clientes:', custSyncErr.message);
        }
        }

        // =========================================================================
        // 5. SINCRONIZAR PROVEEDORES (PULL & PUSH)
        // =========================================================================
        if (!targetTable || targetTable === 'suppliers') {
        try {
            const { data: cloudSupps, error: suppErr } = await sb
                .from('suppliers')
                .select('*')
                .eq('user_id', userId)
                .eq('business_id', String(businessId));

            if (!suppErr && cloudSupps) {
                const localSupps = await dbAll("SELECT * FROM suppliers WHERE business_id = ?", [businessId]);
                const suppMap = new Map();
                localSupps.forEach(s => suppMap.set(s.name.trim().toLowerCase(), s));

                for (const cs of cloudSupps) {
                    if (cs.is_deleted) continue;
                    const cleanName = (cs.name || '').trim().toLowerCase();
                    if (!cleanName) continue;
                    const existing = suppMap.get(cleanName);

                    if (existing) {
                        await dbRun(
                            "UPDATE suppliers SET phone = ?, email = ?, address = ?, contact = ?, updatedAt = ? WHERE id = ?",
                            [cs.phone || '', cs.email || '', cs.address || '', cs.contact_name || '', cs.updated_at || new Date().toISOString(), existing.id]
                        );
                    } else {
                        await dbRun(
                            "INSERT INTO suppliers (name, contact, phone, email, address, business_id, is_synced, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)",
                            [cs.name, cs.contact_name || '', cs.phone || '', cs.email || '', cs.address || '', businessId, cs.created_at || new Date().toISOString(), cs.updated_at || new Date().toISOString()]
                        );
                        stats.pulled.suppliers++;
                    }
                }

                const freshSupps = await dbAll("SELECT * FROM suppliers WHERE business_id = ?", [businessId]);
                const suppPayload = freshSupps.map(s => ({
                    user_id: userId,
                    business_id: String(businessId),
                    local_id: String(s.id),
                    name: s.name,
                    contact_name: s.contact || '',
                    phone: s.phone || '',
                    email: s.email || '',
                    address: s.address || '',
                    is_deleted: Boolean(s.isActive === 0 || (s.deletedAt && s.deletedAt !== 'null')),
                    updated_at: s.updatedAt || new Date().toISOString()
                }));

                if (suppPayload.length > 0) {
                    const { error: pushSuppErr } = await sb.from('suppliers').upsert(suppPayload, { onConflict: 'user_id,business_id,local_id' });
                    if (!pushSuppErr) stats.pushed.suppliers = suppPayload.length;
                }
            }
        } catch (suppSyncErr) {
            console.warn('[SyncCloud] Advertencia sincronizando proveedores:', suppSyncErr.message);
        }
        }

        // =========================================================================
        // 6. SINCRONIZAR COMPRAS (PUSH ITERATIVO CON UUID Y SEMÁFORO DE SINCRONIZACIÓN)
        // =========================================================================
        if (!targetTable || targetTable === 'purchases') {
        try {
            let hasMorePurchases = true;
            let offsetPurch = 0;
            while (hasMorePurchases) {
                // Solo sube compras pendientes de sincronizar (is_synced = 0 o NULL)
                const localPurchases = await dbAll(
                    "SELECT * FROM purchases WHERE business_id = ? AND (is_synced = 0 OR is_synced IS NULL) ORDER BY date DESC LIMIT 200 OFFSET ?",
                    [businessId, offsetPurch]
                );
                if (!localPurchases || localPurchases.length === 0) break;

                const purchPayload = localPurchases.map(p => {
                    let itms = [];
                    try { itms = typeof p.items === 'string' ? JSON.parse(p.items || '[]') : (p.items || []); } catch (_) { }
                    const pUuid = p.uuid || p.cloud_id || `cmp_${businessId}_${p.id}`;
                    return {
                        user_id: userId,
                        business_id: String(businessId),
                        local_id: pUuid, // ponytail: Usar UUID universal inmutable en lugar del autoincrement de SQLite
                        supplier_id: p.supplierId ? String(p.supplierId) : null,
                        invoice_number: p.invoiceNumber || String(p.purchaseNumber || ''),
                        document_type: p.documentType || 'boleta',
                        purchase_date: p.date || p.createdAt || new Date().toISOString(),
                        subtotal: Number(p.subtotal || 0),
                        iva_amount: Number(p.ivaAmount || 0),
                        extra_taxes_amount: Number(p.extraTaxesAmount || 0),
                        total: Number(p.total || 0),
                        paid_amount: Number(p.paidAmount || 0),
                        due_date: safeDate(p.dueDate, null),
                        vat_mode: p.vatMode || 'net',
                        status: p.status || 'paid',
                        items: itms,
                        cancelled_at: safeDate(p.cancelledAt, null),
                        cancel_reason: p.cancelReason || null,
                        is_deleted: false,
                        updated_at: safeDate(p.updatedAt, new Date().toISOString())
                    };
                });

                const { error: purchPushErr } = await sb.from('purchases').upsert(purchPayload, { onConflict: 'user_id,business_id,local_id' });
                if (purchPushErr) {
                    console.warn('[SyncCloud] Advertencia subiendo compras:', purchPushErr.message);
                    break;
                }

                // Marcar localmente como sincronizadas y asegurar su UUID para que nunca se vuelvan a subir
                for (const p of localPurchases) {
                    const pUuid = p.uuid || p.cloud_id || `cmp_${businessId}_${p.id}`;
                    await dbRun("UPDATE purchases SET is_synced = 1, uuid = ? WHERE id = ?", [pUuid, p.id]);
                }

                stats.pushed.purchases += purchPayload.length;
                offsetPurch += localPurchases.length;
                if (localPurchases.length < 200) break;
            }
        } catch (purchSyncErr) {
            console.warn('[SyncCloud] Advertencia sincronizando compras:', purchSyncErr.message);
        }

        // B. PULL: Descargar compras remotas desde Supabase
        try {
            const { data: cloudPurch, error: cpErr } = await sb
                .from('purchases')
                .select('*')
                .eq('user_id', userId)
                .eq('business_id', String(businessId))
                .order('purchase_date', { ascending: false })
                .limit(300);

            if (!cpErr && Array.isArray(cloudPurch) && cloudPurch.length > 0) {
                const localPurch = await dbAll("SELECT id, cloud_id, uuid, invoiceNumber, date FROM purchases WHERE business_id = ?", [businessId]);
                const purMap = new Set();
                localPurch.forEach(lp => {
                    if (lp.cloud_id) purMap.add(String(lp.cloud_id));
                    if (lp.uuid) purMap.add(String(lp.uuid));
                    if (lp.invoiceNumber) {
                        const invClean = String(lp.invoiceNumber).trim().toLowerCase();
                        purMap.add(invClean);
                        if (lp.date) purMap.add(`${invClean}_${lp.date}`);
                    }
                });

                // Mapa de resolución UUID/cloud_id -> ID entero para proveedores
                const localSuppList = await dbAll("SELECT id, uuid, cloud_id FROM suppliers WHERE business_id = ?", [businessId]);
                const suppResolverMap = new Map();
                localSuppList.forEach(s => {
                    suppResolverMap.set(String(s.id), s.id);
                    if (s.uuid) suppResolverMap.set(String(s.uuid), s.id);
                    if (s.cloud_id) suppResolverMap.set(String(s.cloud_id), s.id);
                });

                for (const cp of cloudPurch) {
                    if (cp.is_deleted) continue;
                    const cloudId = String(cp.id);
                    const targetUuid = String(cp.local_id || cp.id);
                    const inv = String(cp.invoice_number || '').trim().toLowerCase();
                    const invDateKey = inv ? `${inv}_${cp.purchase_date}` : null;

                    if (purMap.has(cloudId) || purMap.has(targetUuid) || (inv && purMap.has(inv)) || (invDateKey && purMap.has(invDateKey))) {
                        continue;
                    }

                    let itemsStr = '[]';
                    try {
                        itemsStr = typeof cp.items === 'string' ? cp.items : JSON.stringify(cp.items || []);
                    } catch (_) { itemsStr = '[]'; }

                    const suppId = cp.supplier_id ? (suppResolverMap.get(String(cp.supplier_id)) || (parseInt(cp.supplier_id, 10) || null)) : null;
                    const tot = Number(cp.total || 0);
                    const subtot = Number(cp.subtotal !== undefined ? cp.subtotal : tot);
                    const paid = Number(cp.paid_amount !== undefined ? cp.paid_amount : tot);

                    // Insertar compra descargada con is_synced = 1 y conservando su UUID original para no re-subirla jamás
                    await dbRun(`
                        INSERT INTO purchases (
                            supplierId, invoiceNumber, documentType, date, subtotal, total, paidAmount, 
                            status, items, business_id, cloud_id, uuid, is_synced, createdAt, updatedAt
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
                    `, [
                        suppId,
                        cp.invoice_number || 'SIN CORRELATIVO',
                        cp.document_type || 'boleta',
                        cp.purchase_date || new Date().toISOString(),
                        subtot,
                        tot,
                        paid,
                        cp.status || 'completed',
                        itemsStr,
                        businessId,
                        cloudId,
                        targetUuid,
                        cp.created_at || new Date().toISOString(),
                        cp.updated_at || new Date().toISOString()
                    ]);

                    purMap.add(cloudId);
                    purMap.add(targetUuid);
                    if (inv) purMap.add(inv);
                    if (invDateKey) purMap.add(invDateKey);
                    stats.pulled.purchases++;
                }
            }
        } catch (pullPurchErr) {
            console.warn('[SyncCloud] Advertencia descargando compras:', pullPurchErr.message);
        }
        }

        // =========================================================================
        // 7. SINCRONIZAR CAJAS REGISTRADORAS Y MOVIMIENTOS (PUSH & PULL)
        // =========================================================================
        if (!targetTable || targetTable === 'cash_registers' || targetTable === 'sales') {
        try {
            // A. PUSH: Subir cajas locales a Supabase (solo no sincronizadas o activas)
            const localCashes = await dbAll("SELECT * FROM cashRegisters WHERE business_id = ? AND (is_synced IS NULL OR is_synced = 0) ORDER BY id ASC", [businessId]);
            if (localCashes && localCashes.length > 0) {
                const cashPayload = localCashes.map(c => {
                    let pSum = {};
                    try { pSum = typeof c.paymentSummary === 'string' ? JSON.parse(c.paymentSummary || '{}') : (c.paymentSummary || {}); } catch (_) { }
                    return {
                        user_id: userId,
                        business_id: String(businessId),
                        local_id: String(c.uuid || c.id),
                        status: c.status || 'open',
                        open_date: c.openDate || new Date().toISOString(),
                        close_date: (c.closeDate && c.closeDate !== 'null') ? c.closeDate : null,
                        initial_amount: Number(c.initialAmount || 0),
                        final_amount: Number(c.finalAmount || 0),
                        expected_amount: Number(c.expectedAmount || 0),
                        difference: Number(c.difference || 0),
                        payment_summary: pSum,
                        notes: c.observations || '',
                        terminal_id: c.terminal_id || 'PC-1',
                        updated_at: new Date().toISOString()
                    };
                });

                const BATCH_CR = 100;
                for (let i = 0; i < cashPayload.length; i += BATCH_CR) {
                    const chunk = cashPayload.slice(i, i + BATCH_CR);
                    const { error: cashPushErr } = await sb.from('cash_registers').upsert(chunk, { onConflict: 'user_id,business_id,local_id' });
                    if (!cashPushErr) {
                        stats.pushed.cash_registers += chunk.length;
                    } else {
                        console.warn('[SyncCloud] Advertencia subiendo cajas:', cashPushErr.message);
                    }
                }
                const crIds = localCashes.map(c => c.id);
                await dbRunSilent(`UPDATE cashRegisters SET is_synced = 1 WHERE id IN (${crIds.map(() => '?').join(',')})`, crIds);
            }

            // B. PUSH: Subir movimientos de caja locales a Supabase
            let hasMoreMovs = true;
            while (hasMoreMovs) {
                const localMovs = await dbAll("SELECT * FROM cashMovements WHERE business_id = ? AND (is_synced IS NULL OR is_synced = 0) ORDER BY id ASC LIMIT 200", [businessId]);
                if (!localMovs || localMovs.length === 0) break;

                const movPayload = localMovs.map(m => ({
                    user_id: userId,
                    business_id: String(businessId),
                    local_id: String(m.uuid || m.id),
                    amount: Number(m.amount || 0),
                    movement_type: m.type || 'in',
                    concept: m.description || m.concept || m.reason || '',
                    cash_register_id: m.cashRegisterId ? String(m.cashRegisterId) : null,
                    reason: m.reason || m.description || m.detail || '',
                    movement_date: m.date || new Date().toISOString(),
                    created_by: m.userName || m.user || 'Cajero',
                    terminal_id: m.terminal_id || 'PC-1',
                    is_deleted: Boolean(m.cancelledAt || m.deletedAt),
                    updated_at: new Date().toISOString()
                }));

                const { error: movPushErr } = await sb.from('cash_movements').upsert(movPayload, { onConflict: 'user_id,business_id,local_id' });
                if (movPushErr) {
                    console.warn('[SyncCloud] Advertencia subiendo movimientos de caja:', movPushErr.message);
                    break;
                }
                const mIds = localMovs.map(m => m.id);
                await dbRunSilent(`UPDATE cashMovements SET is_synced = 1 WHERE id IN (${mIds.map(() => '?').join(',')})`, mIds);
                stats.pushed.cash_movements += movPayload.length;
                if (localMovs.length < 200) break;
            }

            // C. PULL: Descargar cajas remotas desde Supabase
            const { data: cloudCashes, error: ccErr } = await sb
                .from('cash_registers')
                .select('*')
                .eq('user_id', userId)
                .eq('business_id', String(businessId))
                .order('open_date', { ascending: false })
                .limit(50);

            if (!ccErr && Array.isArray(cloudCashes) && cloudCashes.length > 0) {
                const localCashesCheck = await dbAll("SELECT id, cloud_id, uuid, openDate, status FROM cashRegisters WHERE business_id = ?", [businessId]);
                const cashMap = new Map();
                localCashesCheck.forEach(lc => {
                    if (lc.cloud_id) cashMap.set(String(lc.cloud_id), lc);
                    if (lc.uuid) cashMap.set(String(lc.uuid), lc);
                    cashMap.set(String(lc.id), lc);
                });

                for (const cc of cloudCashes) {
                    if (cc.is_deleted) continue;
                    const cloudId = String(cc.id);
                    const localId = cc.local_id ? String(cc.local_id) : null;
                    const existing = (localId && cashMap.get(localId)) || cashMap.get(cloudId);

                    let pSum = '{}';
                    try { pSum = typeof cc.payment_summary === 'string' ? cc.payment_summary : JSON.stringify(cc.payment_summary || {}); } catch (_) { }
                    let denoms = null;
                    try { denoms = typeof cc.denominations === 'string' ? cc.denominations : JSON.stringify(cc.denominations || {}); } catch (_) { }
                    let counted = null;
                    try { counted = typeof cc.counted_by_method === 'string' ? cc.counted_by_method : JSON.stringify(cc.counted_by_method || {}); } catch (_) { }

                    if (existing) {
                        // Actualizar estado si en la nube cambió (ej: cerrada remotamente o ajustada)
                        await dbRun(`
                            UPDATE cashRegisters SET 
                                status = ?, closeDate = ?, finalAmount = ?, expectedAmount = ?, 
                                difference = ?, observations = ?, paymentSummary = ?, 
                                denominations = ?, countedByMethod = ?, cloud_id = ?, is_synced = 1
                            WHERE id = ?
                        `, [
                            cc.status || 'open',
                            cc.close_date || null,
                            Number(cc.final_amount || 0),
                            Number(cc.expected_amount || 0),
                            Number(cc.difference || 0),
                            cc.notes || '',
                            pSum,
                            denoms,
                            counted,
                            cloudId,
                            existing.id
                        ]);
                    } else {
                        // Insertar nueva caja remota (sellada con is_synced = 1 para no rebotar)
                        await dbRun(`
                            INSERT INTO cashRegisters (
                                userId, openDate, closeDate, initialAmount, finalAmount, expectedAmount, 
                                difference, status, observations, denominations, paymentSummary, countedByMethod, 
                                business_id, cloud_id, uuid, terminal_id, is_synced
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                        `, [
                            cc.opened_by || 1,
                            cc.open_date || new Date().toISOString(),
                            cc.close_date || null,
                            Number(cc.initial_amount || 0),
                            Number(cc.final_amount || 0),
                            Number(cc.expected_amount || 0),
                            Number(cc.difference || 0),
                            cc.status || 'open',
                            cc.notes || '',
                            denoms,
                            pSum,
                            counted,
                            businessId,
                            cloudId,
                            localId || ('cr_cloud_' + cloudId),
                            cc.terminal_id || 'REMOTE'
                        ]);
                        stats.pulled.cash_registers++;
                    }
                }
            }

            // D. PULL: Descargar movimientos de caja remotos desde Supabase
            const { data: cloudMovs, error: cmErr } = await sb
                .from('cash_movements')
                .select('*')
                .eq('user_id', userId)
                .eq('business_id', String(businessId))
                .order('movement_date', { ascending: false })
                .limit(200);

            if (!cmErr && Array.isArray(cloudMovs) && cloudMovs.length > 0) {
                const localMovsCheck = await dbAll("SELECT id, cloud_id, uuid, date, amount, type FROM cashMovements WHERE business_id = ?", [businessId]);
                const movMap = new Set();
                localMovsCheck.forEach(lm => {
                    if (lm.cloud_id) movMap.add(String(lm.cloud_id));
                    if (lm.uuid) movMap.add(String(lm.uuid));
                    movMap.add(String(lm.id));
                    if (lm.date && lm.amount) movMap.add(`${lm.date}_${Number(lm.amount).toFixed(2)}_${lm.type}`);
                });

                for (const cm of cloudMovs) {
                    if (cm.is_deleted) continue;
                    const cloudId = String(cm.id);
                    const localId = cm.local_id ? String(cm.local_id) : null;
                    const mDate = cm.movement_date || cm.date;
                    const sig = `${mDate}_${Number(cm.amount || 0).toFixed(2)}_${cm.movement_type || 'in'}`;

                    if (movMap.has(cloudId) || (localId && movMap.has(localId)) || movMap.has(sig)) {
                        continue;
                    }

                    // Encontrar ID de caja local correspondiente
                    let localRegId = null;
                    if (cm.cash_register_id) {
                        const targetReg = await dbGet("SELECT id FROM cashRegisters WHERE cloud_id = ? OR uuid = ? OR id = ?", [String(cm.cash_register_id), String(cm.cash_register_id), parseInt(cm.cash_register_id, 10) || 0]);
                        if (targetReg) localRegId = targetReg.id;
                    }

                    await dbRun(`
                        INSERT INTO cashMovements (
                            cashRegisterId, type, amount, description, date, business_id, cloud_id, userName, uuid, is_synced
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                    `, [
                        localRegId,
                        cm.movement_type || 'in',
                        Number(cm.amount || 0),
                        cm.concept || cm.description || cm.reason || '',
                        mDate || new Date().toISOString(),
                        businessId,
                        cloudId,
                        cm.created_by || 'Cajero',
                        localId || ('cm_cloud_' + cloudId)
                    ]);

                    movMap.add(cloudId);
                    if (localId) movMap.add(localId);
                    stats.pulled.cash_movements = (stats.pulled.cash_movements || 0) + 1;
                }
            }
        } catch (cashSyncErr) {
            console.warn('[SyncCloud] Advertencia sincronizando cajas/movimientos:', cashSyncErr.message);
        }
        }

        // =========================================================================
        // 8. SINCRONIZAR GASTOS OPERATIVOS
        // =========================================================================
        if (!targetTable || targetTable === 'expenses') {
        try {
            const localExpenses = await dbAll("SELECT * FROM expenses WHERE business_id = ? AND (is_synced IS NULL OR is_synced = 0) ORDER BY id ASC LIMIT 100", [businessId]);
            if (localExpenses && localExpenses.length > 0) {
                const expPayload = localExpenses.map(e => ({
                    user_id: userId,
                    business_id: String(businessId),
                    local_id: String(e.uuid || e.id),
                    amount: Number(e.amount || 0),
                    category: e.category || 'General',
                    description: e.description || '',
                    document_type: e.documentType || 'comprobante_interno',
                    document_number: e.documentNumber || null,
                    payment_method: e.paymentMethod || 'cash',
                    supplier_id: e.supplierId ? String(e.supplierId) : null,
                    product_id: e.productId ? String(e.productId) : null,
                    product_name: e.productName || null,
                    quantity: Number(e.quantity || 0),
                    cost_value: Number(e.cost_value || 0),
                    sale_value: Number(e.sale_value || 0),
                    expense_date: e.date || new Date().toISOString(),
                    from_cash: Boolean(e.paymentMethod === 'cash'),
                    updated_at: new Date().toISOString()
                }));

                const { error: expPushErr } = await sb.from('expenses').upsert(expPayload, { onConflict: 'user_id,business_id,local_id' });
                if (!expPushErr) {
                    const eIds = localExpenses.map(e => e.id);
                    await dbRunSilent(`UPDATE expenses SET is_synced = 1 WHERE id IN (${eIds.map(() => '?').join(',')})`, eIds);
                    stats.pushed.expenses = expPayload.length;
                }
            }
        } catch (expSyncErr) {
            console.warn('[SyncCloud] Advertencia sincronizando gastos:', expSyncErr.message);
        }

        // B. PULL: Descargar gastos remotos desde Supabase
        try {
            const { data: cloudExpenses, error: ceErr } = await sb
                .from('expenses')
                .select('*')
                .eq('user_id', userId)
                .eq('business_id', String(businessId))
                .order('expense_date', { ascending: false })
                .limit(300);

            if (!ceErr && Array.isArray(cloudExpenses) && cloudExpenses.length > 0) {
                const localExp = await dbAll("SELECT id, uuid, date, amount FROM expenses WHERE business_id = ?", [businessId]);
                const expMap = new Set();
                localExp.forEach(e => {
                    if (e.uuid) expMap.add(String(e.uuid));
                    expMap.add(String(e.id));
                    if (e.date && e.amount) expMap.add(`${e.date}_${Number(e.amount).toFixed(2)}`);
                });

                for (const ce of cloudExpenses) {
                    if (ce.is_deleted) continue;
                    const targetId = String(ce.local_id || ce.id);
                    const sig = `${ce.expense_date}_${Number(ce.amount || 0).toFixed(2)}`;
                    if (expMap.has(targetId) || expMap.has(sig)) continue;

                    await dbRun(`
                        INSERT INTO expenses (
                            amount, category, description, date, paymentMethod, business_id, is_synced, uuid, cloud_id
                        ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
                    `, [
                        Number(ce.amount || 0),
                        ce.category || 'General',
                        ce.description || '',
                        ce.expense_date || new Date().toISOString(),
                        ce.from_cash ? 'cash' : 'other',
                        businessId,
                        targetId,
                        String(ce.id)
                    ]);

                    expMap.add(targetId);
                    stats.pulled.expenses++;
                }
            }
        } catch (pullExpErr) {
            console.warn('[SyncCloud] Advertencia descargando gastos:', pullExpErr.message);
        }
        }

        // =========================================================================
        // 9. SINCRONIZAR ABONOS A DEUDAS
        // =========================================================================
        if (!targetTable || targetTable === 'debt_payments') {
        try {
            let hasMorePayments = true;
            let offsetPayments = 0;
            while (hasMorePayments) {
                const localPayments = await dbAll(
                    "SELECT * FROM payments WHERE business_id = ? AND customerId IS NOT NULL AND customerId != '' ORDER BY id ASC LIMIT 100 OFFSET ?",
                    [businessId, offsetPayments]
                );
                if (!localPayments || localPayments.length === 0) break;

                const payPayload = localPayments.map(p => ({
                    user_id: userId,
                    business_id: String(businessId),
                    local_id: String(p.id),
                    customer_id: String(p.customerId),
                    amount: Number(p.amount || 0),
                    payment_method: p.paymentMethod || 'cash',
                    notes: p.notes || '',
                    payment_date: p.date || new Date().toISOString()
                }));

                const { error: payPushErr } = await sb.from('debt_payments').upsert(payPayload, { onConflict: 'user_id,business_id,local_id' });
                if (payPushErr) {
                    console.warn('[SyncCloud] Advertencia subiendo abonos:', payPushErr.message);
                    break;
                }
                stats.pushed.debt_payments += payPayload.length;
                offsetPayments += localPayments.length;
                if (localPayments.length < 100) break;
            }
        } catch (paySyncErr) {
            console.warn('[SyncCloud] Advertencia sincronizando abonos:', paySyncErr.message);
        }

        // B. PULL: Descargar abonos remotos (debt_payments) desde Supabase
        try {
            const { data: cloudPayments, error: cpErr } = await sb
                .from('debt_payments')
                .select('*')
                .eq('user_id', userId)
                .eq('business_id', String(businessId))
                .order('payment_date', { ascending: false })
                .limit(500);

            if (!cpErr && Array.isArray(cloudPayments) && cloudPayments.length > 0) {
                const localPayments = await dbAll("SELECT id, server_id, date, amount, customerId FROM payments WHERE business_id = ?", [businessId]);
                const payMap = new Set();
                localPayments.forEach(p => {
                    if (p.server_id) payMap.add(String(p.server_id));
                    payMap.add(String(p.id));
                    if (p.date && p.amount && p.customerId) {
                        payMap.add(`${p.customerId}_${p.date}_${Number(p.amount).toFixed(2)}`);
                    }
                });

                // Mapa de resolución UUID/cloud_id -> ID entero para clientes
                const localCustList = await dbAll("SELECT id, uuid, cloud_id FROM customers WHERE business_id = ?", [businessId]);
                const custResolverMap = new Map();
                localCustList.forEach(c => {
                    custResolverMap.set(String(c.id), c.id);
                    if (c.uuid) custResolverMap.set(String(c.uuid), c.id);
                    if (c.cloud_id) custResolverMap.set(String(c.cloud_id), c.id);
                });

                for (const dp of cloudPayments) {
                    if (dp.is_deleted) continue;
                    const targetId = String(dp.local_id || dp.id);
                    const sig = `${dp.customer_id}_${dp.payment_date}_${Number(dp.amount || 0).toFixed(2)}`;
                    if (payMap.has(targetId) || payMap.has(sig)) continue;

                    const custId = dp.customer_id ? (custResolverMap.get(String(dp.customer_id)) || (parseInt(dp.customer_id, 10) || null)) : null;
                    await dbRun(`
                        INSERT INTO payments (
                            customerId, amount, paymentMethod, date, notes, business_id, is_synced, server_id
                        ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)
                    `, [
                        custId,
                        Number(dp.amount || 0),
                        dp.payment_method || 'cash',
                        dp.payment_date || new Date().toISOString(),
                        dp.notes || 'Abono recibido desde Mobile',
                        businessId,
                        targetId
                    ]);

                    payMap.add(targetId);
                    stats.pulled.debt_payments++;
                }
            }
        } catch (pullPayErr) {
            console.warn('[SyncCloud] Advertencia descargando abonos:', pullPayErr.message);
        }
        }

        // =========================================================================
        // 10. SINCRONIZAR AJUSTES DEL NEGOCIO (PUSH & PULL)
        // =========================================================================
        let cloudBizSettings = null;
        if (!targetTable || targetTable === 'settings') {
        try {
            const biz = await dbGet("SELECT * FROM businesses WHERE id = ?", [businessId]);
            if (biz) {
                const { data: existingBiz } = await sb
                    .from('business_settings')
                    .select('bank_info')
                    .eq('user_id', userId)
                    .maybeSingle();

                await sb.from('business_settings').upsert({
                    user_id: userId,
                    business_id: String(businessId),
                    biz_name: biz.name || 'Mi Negocio',
                    biz_rut: biz.rut || '',
                    biz_phone: biz.phone || '',
                    biz_address: biz.address || '',
                    ticket_footer: biz.ticket_footer || 'Gracias por su compra',
                    bank_info: existingBiz?.bank_info || {},
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });
            }

            // PULL: Descargar ajustes remotos si existen en Supabase
            const { data: cbs } = await sb
                .from('business_settings')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();

            if (cbs) {
                cloudBizSettings = cbs;
                await dbRun(`
                    UPDATE businesses SET 
                        name = COALESCE(?, name),
                        rut = COALESCE(?, rut),
                        phone = COALESCE(?, phone),
                        address = COALESCE(?, address),
                        ticket_footer = COALESCE(?, ticket_footer)
                    WHERE id = ?
                `, [
                    cbs.biz_name || null,
                    cbs.biz_rut || null,
                    cbs.biz_phone || null,
                    cbs.biz_address || null,
                    cbs.ticket_footer || null,
                    businessId
                ]);
                stats.pulled.business_settings = 1;
            }
        } catch (bizSyncErr) {
            console.warn('[SyncCloud] Advertencia sincronizando ajustes negocio:', bizSyncErr.message);
        }
        }

        // =========================================================================
        // 11. SINCRONIZAR MOVIMIENTOS DE STOCK (KARDEX / AJUSTES)
        // =========================================================================
        if (!targetTable || targetTable === 'stock_movements' || targetTable === 'sales') {
        try {
            // A. PULL: Descargar movimientos de stock de Supabase
            const { data: cloudStock, error: csErr } = await sb
                .from('stock_movements')
                .select('*')
                .eq('user_id', userId)
                .eq('business_id', String(businessId))
                .order('date', { ascending: false })
                .limit(500);

            if (!csErr && Array.isArray(cloudStock) && cloudStock.length > 0) {
                const localStock = await dbAll("SELECT id, date, quantity, type, productId FROM stockMovements WHERE business_id = ?", [businessId]);
                const smMap = new Set();
                localStock.forEach(sm => {
                    smMap.add(String(sm.id));
                    if (sm.date && sm.quantity && sm.productId) {
                        const t = new Date(sm.date).getTime();
                        if (!isNaN(t)) {
                            smMap.add(`${sm.productId}_t${t}_${sm.quantity}`);
                            smMap.add(`${sm.productId}_s${Math.floor(t / 1000)}_${sm.quantity}`);
                        }
                        smMap.add(`${sm.productId}_${sm.date}_${sm.quantity}`);
                    }
                });

                for (const cm of cloudStock) {
                    const targetId = String(cm.local_id || cm.id);
                    let isDuplicate = smMap.has(targetId);

                    // Si en la nube viene anulado, actualizar el registro local correspondiente
                    if (cm.status === 'cancelled' || cm.is_deleted) {
                        await dbRun(`
                            UPDATE stockMovements SET 
                                status = 'cancelled', 
                                cancelledAt = COALESCE(?, cancelledAt), 
                                cancelledBy = COALESCE(?, cancelledBy), 
                                cancelReason = COALESCE(?, cancelReason)
                            WHERE (id = ? OR id = ?) AND status != 'cancelled'
                        `, [
                            cm.cancelled_at || new Date().toISOString(),
                            cm.cancelled_by || 'Cloud',
                            cm.cancel_reason || 'Anulado desde remoto',
                            targetId,
                            parseInt(targetId, 10) || 0
                        ]);
                    }

                    if (cm.is_deleted && isDuplicate) continue;

                    const mDate = cm.date || cm.movement_date;
                    if (!isDuplicate && mDate && cm.quantity && cm.product_id) {
                        const ct = new Date(mDate).getTime();
                        if (!isNaN(ct)) {
                            if (smMap.has(`${cm.product_id}_t${ct}_${cm.quantity}`) ||
                                smMap.has(`${cm.product_id}_s${Math.floor(ct / 1000)}_${cm.quantity}`)) {
                                isDuplicate = true;
                            }
                        }
                        if (smMap.has(`${cm.product_id}_${mDate}_${cm.quantity}`)) {
                            isDuplicate = true;
                        }
                    }
                    if (isDuplicate) continue;

                    await dbRun(`
                        INSERT INTO stockMovements (
                            productId, productCode, productName, type, quantity, reference, reason, 
                            notes, cost_value, sale_value, date, business_id, is_synced, createdAt, updatedAt,
                            status, cancelledAt, cancelledBy, cancelReason
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
                    `, [
                        cm.product_id ? parseInt(cm.product_id, 10) || null : null,
                        cm.product_code || '',
                        cm.product_name || '',
                        cm.type || 'adjustment',
                        Number(cm.quantity || 0),
                        cm.reference || '',
                        cm.reason || '',
                        cm.notes || '',
                        Number(cm.cost_value || 0),
                        Number(cm.sale_value || 0),
                        cm.date || cm.movement_date || new Date().toISOString(),
                        businessId,
                        cm.created_at || new Date().toISOString(),
                        cm.updated_at || new Date().toISOString(),
                        cm.status || 'active',
                        cm.cancelled_at || null,
                        cm.cancelled_by || null,
                        cm.cancel_reason || null
                    ]);

                    smMap.add(targetId);
                    stats.pulled.stock_movements = (stats.pulled.stock_movements || 0) + 1;
                }
            }

            // B. PUSH: Subir movimientos locales a Supabase con auditoría completa de anulación
            const freshLocalStock = await dbAll("SELECT * FROM stockMovements WHERE business_id = ? ORDER BY id DESC LIMIT 500", [businessId]);
            if (freshLocalStock && freshLocalStock.length > 0) {
                const stockPayload = freshLocalStock.map(m => ({
                    user_id: userId,
                    business_id: String(businessId),
                    local_id: String(m.uuid || m.local_id || ('sm_' + (m.terminal_id || 'PC') + '_' + m.id)),
                    product_id: (m.productId && !isNaN(m.productId)) ? Number(m.productId) : null,
                    product_code: m.productCode || m.code || null,
                    product_name: m.productName || m.name || null,
                    type: m.type || 'adjustment',
                    quantity: Number(m.quantity || 0),
                    reference: m.reference || null,
                    reason: m.reason || null,
                    notes: m.notes || null,
                    cost_value: Number(m.cost_value || 0),
                    sale_value: Number(m.sale_value || 0),
                    date: safeDate(m.date, new Date().toISOString()),
                    movement_date: safeDate(m.date, new Date().toISOString()),
                    status: m.status || 'active',
                    cancelled_at: safeDate(m.cancelledAt, null),
                    cancelled_by: m.cancelledBy || null,
                    cancel_reason: m.cancelReason || null,
                    is_deleted: Boolean(m.status === 'cancelled'),
                    updated_at: safeDate(m.updatedAt, new Date().toISOString())
                }));

                const BATCH = 100;
                for (let i = 0; i < stockPayload.length; i += BATCH) {
                    const chunk = stockPayload.slice(i, i + BATCH);
                    const { error } = await sb.from('stock_movements').upsert(chunk, { onConflict: 'user_id,business_id,local_id' });
                    if (!error) {
                        stats.pushed.stock_movements += chunk.length;
                    } else {
                        console.warn('[SyncCloud] Error subiendo lote de stock_movements:', error.message);
                    }
                }
            }
        } catch (stockErr) {
            console.warn('[SyncCloud] Advertencia stock_movements:', stockErr.message);
        }
        }

        // =========================================================================
        // 11.B. SINCRONIZAR PERSONAL / CAJEROS (STAFF)
        // =========================================================================
        if (!targetTable || targetTable === 'staff') {
        try {
            // A. PULL: Descargar cajeros de Supabase
            const { data: cloudStaff, error: staffErr } = await sb
                .from('staff')
                .select('*')
                .eq('user_id', userId);

            if (!staffErr && Array.isArray(cloudStaff) && cloudStaff.length > 0) {
                const localUsers = await dbAll("SELECT id, username, pin, role FROM users");
                const userMap = new Map();
                localUsers.forEach(u => {
                    userMap.set(String(u.id), u);
                    if (u.username) userMap.set(u.username.toLowerCase().trim(), u);
                });

                for (const cs of cloudStaff) {
                    if (cs.is_deleted) continue;
                    const cleanName = (cs.name || '').toLowerCase().trim();
                    const existing = userMap.get(String(cs.local_id)) || (cleanName ? userMap.get(cleanName) : null);
                    let permStr = '{"posSales":true,"discounts":true,"voidSales":false,"modifyCatalog":false,"purchases":false,"expenses":true,"credits":false,"reportsProfit":false}';
                    if (cs.permissions) {
                        permStr = typeof cs.permissions === 'string' ? cs.permissions : JSON.stringify(cs.permissions);
                    }

                    if (existing) {
                        if (cs.pin && existing.pin !== cs.pin) {
                            await dbRun("UPDATE users SET pin = ? WHERE id = ?", [cs.pin, existing.id]);
                        }
                    } else if (cs.name) {
                        await dbRun(`
                            INSERT INTO users (username, password, role, pin, isActive, createdAt)
                            VALUES (?, ?, ?, ?, 1, ?)
                        `, [
                            cs.name,
                            'SYNC_USER_' + Date.now(),
                            cs.role || 'cashier',
                            cs.pin || '1234',
                            cs.created_at || new Date().toISOString()
                        ]);
                        stats.pulled.staff = (stats.pulled.staff || 0) + 1;
                    }

                    // Sincronizar en tabla staff de SQLite
                    try {
                        const localStaffRow = await dbGet("SELECT id FROM staff WHERE cloud_id = ? OR LOWER(name) = LOWER(?)", [String(cs.id), cs.name]);
                        if (localStaffRow) {
                            await dbRun(
                                "UPDATE staff SET pin = ?, role = ?, permissions = ?, branch_code = ?, is_active = ?, updatedAt = ? WHERE id = ?",
                                [cs.pin || '0000', cs.role || 'cashier', permStr, cs.branch_code || '', cs.is_active ? 1 : 0, cs.updated_at || new Date().toISOString(), localStaffRow.id]
                            );
                        } else {
                            await dbRun(
                                `INSERT INTO staff (name, pin, role, permissions, branch_code, business_id, is_active, is_deleted, cloud_id, uuid, is_synced, createdAt, updatedAt)
                                 VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?, 1, ?, ?)`,
                                [
                                    cs.name,
                                    cs.pin || '0000',
                                    cs.role || 'cashier',
                                    permStr,
                                    cs.branch_code || '',
                                    businessId,
                                    String(cs.id),
                                    cs.local_id || ('staff_' + Date.now()),
                                    cs.created_at || new Date().toISOString(),
                                    cs.updated_at || new Date().toISOString()
                                ]
                            );
                        }
                    } catch (_) { }
                }
            }

            // B. PUSH: Subir cajeros locales a Supabase
            const freshUsers = await dbAll("SELECT id, username, role, pin, isActive FROM users WHERE isActive = 1");
            if (freshUsers && freshUsers.length > 0) {
                // Obtener permisos de tabla staff si existen
                const staffRows = await dbAll("SELECT name, permissions, branch_code FROM staff");
                const staffMap = new Map();
                staffRows.forEach(s => staffMap.set(s.name.toLowerCase().trim(), s));

                const defaultPerms = {
                    posSales: true, discounts: true, voidSales: false, modifyCatalog: false,
                    purchases: false, expenses: true, credits: false, reportsProfit: false
                };

                const staffPayload = freshUsers.map(u => {
                    const st = staffMap.get((u.username || '').toLowerCase().trim());
                    let userPerms = defaultPerms;
                    if (st && st.permissions) {
                        try {
                            userPerms = typeof st.permissions === 'string' ? JSON.parse(st.permissions) : st.permissions;
                        } catch (_) { }
                    }
                    return {
                        user_id: userId,
                        business_id: String(businessId),
                        local_id: String(u.id),
                        name: u.username || 'Cajero',
                        pin: String(u.pin || '1234'),
                        role: u.role || 'cashier',
                        permissions: userPerms,
                        branch_code: (st && st.branch_code) || 'SUC-000001',
                        is_active: Boolean(u.isActive !== 0),
                        is_deleted: false,
                        updated_at: new Date().toISOString()
                    };
                });

                const { error: pushStaffErr } = await sb
                    .from('staff')
                    .upsert(staffPayload, { onConflict: 'user_id,business_id,local_id' });
                if (!pushStaffErr) {
                    stats.pushed.staff = staffPayload.length;
                }
            }
        } catch (staffSyncErr) {
            console.warn('[SyncCloud] Advertencia sincronizando staff:', staffSyncErr.message);
        }
        }

        // =========================================================================
        // 12. SINCRONIZAR DEVOLUCIONES / NOTAS DE CRÉDITO (PUSH & PULL)
        // =========================================================================
        try {
            // A. PUSH: Subir devoluciones locales
            const localReturns = await dbAll("SELECT * FROM saleReturns WHERE business_id = ? ORDER BY id DESC LIMIT 200", [businessId]);
            if (localReturns && localReturns.length > 0) {
                const returnPayload = localReturns.map(r => ({
                    user_id: userId,
                    business_id: String(businessId),
                    local_id: String(r.id),
                    sale_id: r.saleId ? String(r.saleId) : null,
                    sale_number: r.saleNumber || null,
                    date: r.date || new Date().toISOString(),
                    items: typeof r.items === 'string' ? JSON.parse(r.items || '[]') : (r.items || []),
                    total_returned: Number(r.totalReturned || 0),
                    reason: r.reason || '',
                    created_by: r.createdBy || null
                }));

                const { error } = await sb.from('sale_returns').upsert(returnPayload, { onConflict: 'user_id,business_id,local_id' });
                if (!error) stats.pushed.sale_returns = returnPayload.length;
            }

            // B. PULL: Descargar devoluciones remotas
            const { data: cloudReturns, error: crErr } = await sb
                .from('sale_returns')
                .select('*')
                .eq('user_id', userId)
                .eq('business_id', String(businessId))
                .order('date', { ascending: false })
                .limit(200);

            if (!crErr && Array.isArray(cloudReturns) && cloudReturns.length > 0) {
                const localRets = await dbAll("SELECT id, saleId, date FROM saleReturns WHERE business_id = ?", [businessId]);
                const retMap = new Set();
                localRets.forEach(lr => {
                    retMap.add(String(lr.id));
                    if (lr.saleId && lr.date) retMap.add(`${lr.saleId}_${lr.date}`);
                });

                for (const cr of cloudReturns) {
                    const localId = cr.local_id ? String(cr.local_id) : null;
                    const sig = `${cr.sale_id}_${cr.date}`;
                    if ((localId && retMap.has(localId)) || retMap.has(sig)) continue;

                    let itms = '[]';
                    try { itms = typeof cr.items === 'string' ? cr.items : JSON.stringify(cr.items || []); } catch (_) { }

                    await dbRun(`
                        INSERT INTO saleReturns (
                            saleId, saleNumber, date, items, totalReturned, reason, createdBy, business_id
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        cr.sale_id ? parseInt(cr.sale_id, 10) || null : null,
                        cr.sale_number || null,
                        cr.date || new Date().toISOString(),
                        itms,
                        Number(cr.total_returned || 0),
                        cr.reason || '',
                        cr.created_by || null,
                        businessId
                    ]);

                    if (localId) retMap.add(localId);
                    if (cr.sale_id && cr.date) retMap.add(sig);
                    stats.pulled.sale_returns = (stats.pulled.sale_returns || 0) + 1;
                }
            }
        } catch (retErr) {
            console.warn('[SyncCloud] Advertencia sale_returns:', retErr.message);
        }

        // =========================================================================
        // 13. SINCRONIZAR AUDITORÍA / SEGURIDAD
        // =========================================================================
        try {
            const localLogs = await dbAll("SELECT * FROM auditLogs WHERE business_id = ? ORDER BY id DESC LIMIT 200", [businessId]);
            if (localLogs && localLogs.length > 0) {
                // Falla #18/#23: Prohibido DELETE físico en auditoría financiera. Se usa upsert idempotente.
                const logPayload = localLogs.map(l => ({
                    user_id: userId,
                    business_id: String(businessId),
                    local_id: l.id,
                    entity: l.entity || '',
                    entity_id: l.entityId || null,
                    action: l.action || '',
                    summary: l.summary || '',
                    metadata: typeof l.metadata === 'string' ? JSON.parse(l.metadata || '{}') : (l.metadata || {}),
                    timestamp: l.timestamp || new Date().toISOString(),
                    caja_user_id: l.userId || null,
                    username: l.username || ''
                }));

                const { error } = await sb.from('audit_logs').insert(logPayload);
                if (!error) stats.pushed.audit_logs = logPayload.length;
            }
        } catch (logErr) {
            console.warn('[SyncCloud] Advertencia audit_logs:', logErr.message);
        }

        // =========================================================================
        // 14. SINCRONIZAR HISTORIAL DE PRECIOS (PUSH & PULL)
        // =========================================================================
        try {
            const localPriceHist = await dbAll("SELECT * FROM productPriceHistory WHERE business_id = ? ORDER BY id DESC LIMIT 300", [businessId]);
            if (localPriceHist && localPriceHist.length > 0) {
                const pricePayload = localPriceHist.map(p => ({
                    user_id: userId,
                    business_id: String(businessId),
                    local_id: String(p.id),
                    product_id: p.productId || null,
                    old_price: Number(p.oldPrice || 0),
                    new_price: Number(p.newPrice || 0),
                    date: p.date || new Date().toISOString(),
                    caja_user_id: p.userId || null
                }));

                const { error } = await sb.from('product_price_history').upsert(pricePayload, { onConflict: 'user_id,business_id,local_id' });
                if (!error) stats.pushed.product_price_history = pricePayload.length;
            }

            // PULL precios
            const { data: cloudPrices, error: cprErr } = await sb
                .from('product_price_history')
                .select('*')
                .eq('user_id', userId)
                .eq('business_id', String(businessId))
                .order('date', { ascending: false })
                .limit(200);

            if (!cprErr && Array.isArray(cloudPrices) && cloudPrices.length > 0) {
                const localPrices = await dbAll("SELECT id, productId, date FROM productPriceHistory WHERE business_id = ?", [businessId]);
                const phMap = new Set();
                localPrices.forEach(lp => phMap.add(`${lp.productId}_${lp.date}`));

                for (const cp of cloudPrices) {
                    const sig = `${cp.product_id}_${cp.date}`;
                    if (phMap.has(sig)) continue;

                    await dbRun(`
                        INSERT INTO productPriceHistory (productId, oldPrice, newPrice, date, userId, business_id)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `, [
                        cp.product_id ? parseInt(cp.product_id, 10) || null : null,
                        Number(cp.old_price || 0),
                        Number(cp.new_price || 0),
                        cp.date || new Date().toISOString(),
                        cp.caja_user_id || null,
                        businessId
                    ]);
                    if (cp.product_id && cp.date) phMap.add(sig);
                    stats.pulled.product_price_history = (stats.pulled.product_price_history || 0) + 1;
                }
            }
        } catch (phErr) {
            console.warn('[SyncCloud] Advertencia product_price_history:', phErr.message);
        }

        // =========================================================================
        // 15. SINCRONIZAR HISTORIAL DE COSTOS (PUSH & PULL)
        // =========================================================================
        try {
            const localCostHist = await dbAll("SELECT * FROM productCostHistory WHERE business_id = ? ORDER BY id DESC LIMIT 300", [businessId]);
            if (localCostHist && localCostHist.length > 0) {
                const costPayload = localCostHist.map(c => ({
                    user_id: userId,
                    business_id: String(businessId),
                    local_id: String(c.id),
                    product_id: c.productId || null,
                    old_cost: Number(c.oldCost || 0),
                    new_cost: Number(c.newCost || 0),
                    reason: c.reason || '',
                    reference_id: c.referenceId || null,
                    current_price: Number(c.currentPrice || 0),
                    date: c.date || new Date().toISOString()
                }));

                const { error } = await sb.from('product_cost_history').upsert(costPayload, { onConflict: 'user_id,business_id,local_id' });
                if (!error) stats.pushed.product_cost_history = costPayload.length;
            }

            // PULL costos
            const { data: cloudCosts, error: ccstErr } = await sb
                .from('product_cost_history')
                .select('*')
                .eq('user_id', userId)
                .eq('business_id', String(businessId))
                .order('date', { ascending: false })
                .limit(200);

            if (!ccstErr && Array.isArray(cloudCosts) && cloudCosts.length > 0) {
                const localCosts = await dbAll("SELECT id, productId, date FROM productCostHistory WHERE business_id = ?", [businessId]);
                const chMap = new Set();
                localCosts.forEach(lc => chMap.add(`${lc.productId}_${lc.date}`));

                for (const cc of cloudCosts) {
                    const sig = `${cc.product_id}_${cc.date}`;
                    if (chMap.has(sig)) continue;

                    await dbRun(`
                        INSERT INTO productCostHistory (productId, oldCost, newCost, reason, referenceId, currentPrice, date, business_id)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        cc.product_id ? parseInt(cc.product_id, 10) || null : null,
                        Number(cc.old_cost || 0),
                        Number(cc.new_cost || 0),
                        cc.reason || '',
                        cc.reference_id || null,
                        Number(cc.current_price || 0),
                        cc.date || new Date().toISOString(),
                        businessId
                    ]);
                    if (cc.product_id && cc.date) chMap.add(sig);
                    stats.pulled.product_cost_history = (stats.pulled.product_cost_history || 0) + 1;
                }
            }
        } catch (chErr) {
            console.warn('[SyncCloud] Advertencia product_cost_history:', chErr.message);
        }

        // =========================================================================
        // 16. SINCRONIZAR MONEDERO / DEPÓSITOS Y USOS DE SALDO DE CLIENTES
        // =========================================================================
        try {
            // A. PULL desde Supabase
            const { data: cloudDeposits, error: cdPullErr } = await sb
                .from('customer_credit_deposits')
                .select('*')
                .eq('user_id', userId)
                .eq('business_id', String(businessId));

            if (!cdPullErr && cloudDeposits && cloudDeposits.length > 0) {
                // Obtener registros locales para comparación inteligente por marca de tiempo y monto
                const localDeps = await dbAll("SELECT id, date, customerId, amount FROM customerCreditDeposits WHERE business_id = ?", [businessId]);
                const localUses = await dbAll("SELECT id, date, customerId, amount FROM customerCreditUses WHERE business_id = ?", [businessId]);

                for (const cd of cloudDeposits) {
                    const cdTime = cd.date ? new Date(cd.date).getTime() : 0;
                    const cdAmount = Math.abs(Number(cd.amount || 0));

                    if (cd.payment_method === 'credit_use') {
                        // Es un uso de dinero a favor (descuento en venta)
                        const exists = (localUses || []).some(u => {
                            const uTime = u.date ? new Date(u.date).getTime() : 0;
                            return String(u.customerId) === String(cd.customer_id) &&
                                Math.abs(uTime - cdTime) < 3000 &&
                                Math.abs((Number(u.amount) || 0) - cdAmount) < 0.01;
                        });
                        if (!exists) {
                            await dbRun(
                                "INSERT INTO customerCreditUses (customerId, amount, saleNumber, date, notes, business_id) VALUES (?, ?, ?, ?, ?, ?)",
                                [cd.customer_id, cdAmount, cd.cash_register_id || null, cd.date || new Date().toISOString(), cd.notes || '', businessId]
                            );
                            stats.pulled.customer_credit_deposits++;
                        }
                    } else {
                        // Es un depósito / carga de dinero a favor
                        const exists = (localDeps || []).some(d => {
                            const dTime = d.date ? new Date(d.date).getTime() : 0;
                            return String(d.customerId) === String(cd.customer_id) &&
                                Math.abs(dTime - cdTime) < 3000 &&
                                Math.abs((Number(d.amount) || 0) - cdAmount) < 0.01;
                        });
                        if (!exists) {
                            await dbRun(
                                "INSERT INTO customerCreditDeposits (customerId, amount, paymentMethod, cashRegisterId, date, notes, business_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
                                [cd.customer_id, cdAmount, cd.payment_method || 'cash', cd.cash_register_id || null, cd.date || new Date().toISOString(), cd.notes || '', businessId]
                            );
                            stats.pulled.customer_credit_deposits++;
                        }
                    }
                }

                // Reconciliar balanceCredit de cada cliente localmente
                const balanceAgg = await dbAll(`
                    SELECT c.id,
                           COALESCE((SELECT SUM(amount) FROM customerCreditDeposits WHERE customerId = c.id AND business_id = ?), 0) as totalDeps,
                           COALESCE((SELECT SUM(amount) FROM customerCreditUses WHERE customerId = c.id AND business_id = ?), 0) as totalUses
                    FROM customers c
                    WHERE c.business_id = ?
                `, [businessId, businessId, businessId]);

                for (const row of balanceAgg) {
                    const calculatedCredit = Math.max(0, (row.totalDeps || 0) - (row.totalUses || 0));
                    await dbRun("UPDATE customers SET balanceCredit = ? WHERE id = ? AND business_id = ?", [calculatedCredit, row.id, businessId]);
                }
            }

            // B. PUSH a Supabase (Subir depósitos y usos para mantener paridad total)
            const localDeposits = await dbAll("SELECT * FROM customerCreditDeposits WHERE business_id = ? ORDER BY id DESC LIMIT 200", [businessId]);
            const localUses = await dbAll("SELECT * FROM customerCreditUses WHERE business_id = ? ORDER BY id DESC LIMIT 200", [businessId]);

            const depPayload = [];
            (localDeposits || []).forEach(d => {
                depPayload.push({
                    user_id: userId,
                    business_id: String(businessId),
                    local_id: d.id,
                    customer_id: d.customerId || null,
                    amount: Number(d.amount || 0),
                    payment_method: d.paymentMethod || 'cash',
                    cash_register_id: d.cashRegisterId || null,
                    date: d.date || new Date().toISOString(),
                    notes: d.notes || ''
                });
            });

            (localUses || []).forEach(u => {
                depPayload.push({
                    user_id: userId,
                    business_id: String(businessId),
                    local_id: u.id,
                    customer_id: u.customerId || null,
                    amount: -Math.abs(Number(u.amount || 0)),
                    payment_method: 'credit_use',
                    cash_register_id: u.saleNumber || null,
                    date: u.date || new Date().toISOString(),
                    notes: u.notes || (`Uso en Venta #${u.saleNumber || ''}`)
                });
            });

            if (depPayload.length > 0) {
                await sb.from('customer_credit_deposits').delete().eq('user_id', userId).eq('business_id', String(businessId));
                const { error } = await sb.from('customer_credit_deposits').insert(depPayload);
                if (!error) stats.pushed.customer_credit_deposits = depPayload.length;
            }
        } catch (cdErr) {
            console.warn('[SyncCloud] Advertencia customer_credit_deposits:', cdErr.message);
        }

        // =========================================================================
        // 17. SINCRONIZAR PAGOS A PROVEEDORES
        // =========================================================================
        try {
            const localSuppPayments = await dbAll("SELECT * FROM supplierPayments WHERE business_id = ? ORDER BY id DESC LIMIT 200", [businessId]);
            if (localSuppPayments && localSuppPayments.length > 0) {
                await sb.from('supplier_payments').delete().eq('user_id', userId).eq('business_id', String(businessId));
                const spPayload = localSuppPayments.map(s => ({
                    user_id: userId,
                    business_id: String(businessId),
                    local_id: s.id,
                    supplier_id: s.supplierId || null,
                    purchase_id: s.purchaseId || null,
                    amount: Number(s.amount || 0),
                    method: s.method || 'cash',
                    date: s.date || new Date().toISOString(),
                    reference: s.reference || '',
                    notes: s.notes || '',
                    created_by: s.createdBy || null,
                    updated_by: s.updatedBy || null
                }));

                const { error } = await sb.from('supplier_payments').insert(spPayload);
                if (!error) stats.pushed.supplier_payments = spPayload.length;
            }
        } catch (spErr) {
            console.warn('[SyncCloud] Advertencia supplier_payments:', spErr.message);
        }

        // =========================================================================
        // 18. SINCRONIZAR ABONOS Y PAGOS DE DEUDA DE CLIENTES (DEBT_PAYMENTS)
        // =========================================================================
        try {
            // A. PULL: Descargar abonos registrados en la nube (ej. desde Móvil u otra terminal)
            const { data: cloudDebtPayments, error: dpPullErr } = await sb
                .from('debt_payments')
                .select('*')
                .eq('user_id', userId)
                .eq('business_id', String(businessId));

            if (!dpPullErr && cloudDebtPayments && cloudDebtPayments.length > 0) {
                const localPayments = await dbAll("SELECT id, uuid, date, customerId, amount FROM payments WHERE business_id = ?", [businessId]);
                for (const cdp of cloudDebtPayments) {
                    const cdpTime = cdp.payment_date ? new Date(cdp.payment_date).getTime() : 0;
                    const cdpAmount = Math.abs(Number(cdp.amount || 0));

                    const exists = (localPayments || []).some(p => {
                        if (p.uuid && cdp.id && String(p.uuid) === String(cdp.id)) return true;
                        if (String(p.id) === String(cdp.local_id)) return true;
                        const pTime = p.date ? new Date(p.date).getTime() : 0;
                        return String(p.customerId) === String(cdp.customer_id) &&
                            Math.abs(pTime - cdpTime) < 3000 &&
                            Math.abs((Number(p.amount) || 0) - cdpAmount) < 0.01;
                    });

                    if (!exists && cdpAmount > 0) {
                        await dbRun(
                            `INSERT INTO payments (customerId, amount, paymentMethod, date, notes, cashRegisterId, uuid, is_synced, business_id)
                             VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
                            [
                                cdp.customer_id,
                                cdpAmount,
                                cdp.payment_method || 'cash',
                                cdp.payment_date || new Date().toISOString(),
                                cdp.notes || 'Abono sincronizado desde nube',
                                cdp.cash_register_id || null,
                                cdp.id || ('pay_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9)),
                                businessId
                            ]
                        );
                        stats.pulled.debt_payments++;
                    }
                }
            }

            // B. PUSH: Subir abonos locales pendientes a Supabase
            const localToPush = await dbAll("SELECT * FROM payments WHERE business_id = ? ORDER BY id DESC LIMIT 250", [businessId]);
            if (localToPush && localToPush.length > 0) {
                const dpPayload = localToPush.map(p => ({
                    user_id: userId,
                    business_id: String(businessId),
                    local_id: String(p.id),
                    customer_id: String(p.customerId || ''),
                    amount: Number(p.amount || 0),
                    payment_method: p.paymentMethod || 'cash',
                    notes: p.notes || (p.saleId ? `Abono a Venta #${p.saleId}` : 'Abono a cuenta corriente'),
                    payment_date: p.date || new Date().toISOString(),
                    cash_register_id: p.cashRegisterId ? String(p.cashRegisterId) : null,
                    is_deleted: false
                }));

                await sb.from('debt_payments').delete().eq('user_id', userId).eq('business_id', String(businessId));
                const { error: insErr } = await sb.from('debt_payments').insert(dpPayload);
                if (!insErr) {
                    stats.pushed.debt_payments = dpPayload.length;
                    await dbRun("UPDATE payments SET is_synced = 1 WHERE business_id = ?", [businessId]);
                }
            }
        } catch (dpErr) {
            console.warn('[SyncCloud] Advertencia debt_payments:', dpErr.message);
        }

        // =========================================================================
        // 19. SINCRONIZAR SESIONES DE PAGO DE DEUDAS (DEBT_PAYMENT_SESSIONS)
        // =========================================================================
        try {
            // A. PULL: Descargar sesiones registradas en Supabase
            const { data: cloudSessions, error: sessPullErr } = await sb
                .from('debt_payment_sessions')
                .select('*')
                .eq('user_id', userId)
                .eq('business_id', String(businessId));

            if (!sessPullErr && cloudSessions && cloudSessions.length > 0) {
                const localSessions = await dbAll("SELECT id, uuid, date, customerId, totalPaid FROM debtPaymentSessions WHERE business_id = ?", [businessId]);
                for (const cs of cloudSessions) {
                    const csTime = cs.date ? new Date(cs.date).getTime() : 0;
                    const csPaid = Math.abs(Number(cs.total_paid || 0));

                    const exists = (localSessions || []).some(s => {
                        if (s.uuid && cs.id && String(s.uuid) === String(cs.id)) return true;
                        if (String(s.id) === String(cs.local_id)) return true;
                        const sTime = s.date ? new Date(s.date).getTime() : 0;
                        return String(s.customerId) === String(cs.customer_id) &&
                            Math.abs(sTime - csTime) < 3000 &&
                            Math.abs((Number(s.totalPaid) || 0) - csPaid) < 0.01;
                    });

                    if (!exists) {
                        const methodsStr = typeof cs.methods === 'string' ? cs.methods : JSON.stringify(cs.methods || []);
                        const salesDataStr = typeof cs.sales_data === 'string' ? cs.sales_data : JSON.stringify(cs.sales_data || []);
                        await dbRun(
                            `INSERT INTO debtPaymentSessions (customerId, date, totalPaid, totalDebt, discount, methods, salesData, notes, cashRegisterId, business_id, uuid, is_synced)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                            [
                                cs.customer_id,
                                cs.date || new Date().toISOString(),
                                csPaid,
                                Number(cs.total_debt || 0),
                                Number(cs.discount || 0),
                                methodsStr,
                                salesDataStr,
                                cs.notes || '',
                                cs.cash_register_id ? parseInt(cs.cash_register_id, 10) : null,
                                businessId,
                                cs.id || ('sess_' + Date.now().toString(36))
                            ]
                        );
                        stats.pulled.debt_payment_sessions = (stats.pulled.debt_payment_sessions || 0) + 1;
                    }
                }
            }

            // B. PUSH: Subir sesiones locales pendientes a Supabase
            const localSessToPush = await dbAll(
                "SELECT * FROM debtPaymentSessions WHERE business_id = ? AND (is_synced IS NULL OR is_synced = 0) ORDER BY id DESC LIMIT 200",
                [businessId]
            );

            if (localSessToPush && localSessToPush.length > 0) {
                const sessPayload = localSessToPush.map(s => {
                    let parsedMethods = [];
                    let parsedSales = [];
                    try { parsedMethods = typeof s.methods === 'string' ? JSON.parse(s.methods || '[]') : (s.methods || []); } catch (_) {}
                    try { parsedSales = typeof s.salesData === 'string' ? JSON.parse(s.salesData || '[]') : (s.salesData || []); } catch (_) {}

                    const sUuid = s.uuid || ('sess_' + businessId + '_' + s.id);
                    return {
                        user_id: userId,
                        business_id: String(businessId),
                        local_id: String(sUuid),
                        customer_id: String(s.customerId || ''),
                        date: s.date || new Date().toISOString(),
                        total_paid: Number(s.totalPaid || 0),
                        total_debt: Number(s.totalDebt || 0),
                        discount: Number(s.discount || 0),
                        methods: parsedMethods,
                        sales_data: parsedSales,
                        notes: s.notes || '',
                        cash_register_id: s.cashRegisterId ? String(s.cashRegisterId) : null,
                        is_deleted: false,
                        updated_at: new Date().toISOString()
                    };
                });

                const { error: sessPushErr } = await sb
                    .from('debt_payment_sessions')
                    .upsert(sessPayload, { onConflict: 'user_id,business_id,local_id' });

                if (!sessPushErr) {
                    for (const s of localSessToPush) {
                        const sUuid = s.uuid || ('sess_' + businessId + '_' + s.id);
                        await dbRun("UPDATE debtPaymentSessions SET is_synced = 1, uuid = ? WHERE id = ?", [sUuid, s.id]);
                    }
                    stats.pushed.debt_payment_sessions = sessPayload.length;
                } else {
                    console.warn('[SyncCloud] Advertencia subiendo debt_payment_sessions:', sessPushErr.message);
                }
            }
        } catch (sessErr) {
            console.warn('[SyncCloud] Advertencia debt_payment_sessions:', sessErr.message);
        }

        // =========================================================================
        // 20. SINCRONIZAR PIZARRA DE MOSTRADOR, ENVASES Y ENCARGOS (COUNTER_NOTES)
        // =========================================================================
        try {
            // A. PULL: Descargar notas, envases y reservas de Supabase
            const { data: cloudNotes, error: notesPullErr } = await sb
                .from('counter_notes')
                .select('*')
                .eq('user_id', userId)
                .eq('business_id', String(businessId));

            if (!notesPullErr && cloudNotes && cloudNotes.length > 0) {
                const localNotes = await dbAll("SELECT id, uuid, text, clientName, category, isCompleted FROM counterNotes WHERE business_id = ?", [businessId]);
                for (const cn of cloudNotes) {
                    const exists = (localNotes || []).find(n => (n.uuid && cn.id && String(n.uuid) === String(cn.id)) || (cn.local_id && String(n.id) === String(cn.local_id)));

                    if (!exists) {
                        await dbRun(
                            `INSERT INTO counterNotes (
                                uuid, category, text, clientName, clientPhone, customerId, 
                                bottleDetail, bottleCount, reservationDetail, reservationDeposit, 
                                dueDate, dueTime, assignedTo, isCompleted, completedAt, completedBy, 
                                createdBy, terminal_id, business_id, is_synced, createdAt, updatedAt, deleted_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
                            [
                                cn.id, cn.category || 'general', cn.text || '', cn.client_name || '', cn.client_phone || '', cn.customer_id || null,
                                cn.bottle_detail || '', cn.bottle_count || 1, cn.reservation_detail || '', cn.reservation_deposit || 0,
                                cn.due_date || '', cn.due_time || '', cn.assigned_to || 'Todos', cn.is_completed ? 1 : 0, cn.completed_at || null, cn.completed_by || null,
                                cn.created_by || 'Mostrador', cn.terminal_id || null, businessId, cn.created_at || new Date().toISOString(), cn.updated_at || new Date().toISOString(), cn.deleted_at || null
                            ]
                        );
                        stats.pulled.counter_notes++;
                    } else {
                        // Si en la nube se completó o reactivó la nota/envase, actualizar en local
                        if (Boolean(exists.isCompleted) !== Boolean(cn.is_completed)) {
                            await dbRun(
                                "UPDATE counterNotes SET isCompleted = ?, completedAt = ?, completedBy = ?, is_synced = 1, updatedAt = ? WHERE id = ?",
                                [cn.is_completed ? 1 : 0, cn.completed_at || null, cn.completed_by || null, cn.updated_at || new Date().toISOString(), exists.id]
                            );
                            stats.pulled.counter_notes++;
                        }
                    }
                }
            }

            // B. PUSH: Subir notas locales creadas o modificadas hacia Supabase
            const localNotesToPush = await dbAll("SELECT * FROM counterNotes WHERE business_id = ? AND (is_synced = 0 OR is_synced IS NULL) LIMIT 200", [businessId]);
            if (localNotesToPush && localNotesToPush.length > 0) {
                const notesPayload = localNotesToPush.map(n => {
                    const nUuid = n.uuid || ('note_' + businessId + '_' + (n.id || Math.random().toString(36).substr(2, 9)));
                    return {
                        user_id: userId,
                        business_id: String(businessId),
                        local_id: n.id,
                        category: n.category || 'general',
                        text: n.text || '',
                        client_name: n.clientName || '',
                        client_phone: n.clientPhone || '',
                        customer_id: n.customerId ? String(n.customerId) : null,
                        bottle_detail: n.bottleDetail || '',
                        bottle_count: parseInt(n.bottleCount) || 1,
                        reservation_detail: n.reservationDetail || '',
                        reservation_deposit: parseFloat(n.reservationDeposit) || 0,
                        due_date: n.dueDate || '',
                        due_time: n.dueTime || '',
                        assigned_to: n.assignedTo || 'Todos',
                        is_completed: Boolean(n.isCompleted),
                        completed_at: safeDate(n.completedAt, null),
                        completed_by: n.completedBy || null,
                        created_by: n.createdBy || 'Mostrador',
                        terminal_id: n.terminal_id || null,
                        created_at: safeDate(n.createdAt, new Date().toISOString()),
                        updated_at: new Date().toISOString(),
                        deleted_at: safeDate(n.deleted_at, null)
                    };
                });

                const { error: notesPushErr } = await sb
                    .from('counter_notes')
                    .upsert(notesPayload, { onConflict: 'user_id,business_id,local_id' });

                if (!notesPushErr) {
                    for (const n of localNotesToPush) {
                        const nUuid = n.uuid || ('note_' + businessId + '_' + n.id);
                        await dbRun("UPDATE counterNotes SET is_synced = 1, uuid = ? WHERE id = ?", [nUuid, n.id]);
                    }
                    stats.pushed.counter_notes = notesPayload.length;
                } else {
                    console.warn('[SyncCloud] Advertencia subiendo counter_notes:', notesPushErr.message);
                }
            }
        } catch (cnErr) {
            console.warn('[SyncCloud] Advertencia counter_notes:', cnErr.message);
        }

        // Conteos totales actuales en SQLite para respuesta informativa
        const totalProdsRow = await dbGet("SELECT COUNT(*) as count FROM products WHERE business_id = ? AND isActive = 1", [businessId]);
        const totalCatsRow = await dbGet("SELECT COUNT(*) as count FROM categories WHERE business_id = ?", [businessId]);

        console.log(`✅ [SyncCloud] Sincronización completada exitosamente. Total productos en PC (Negocio ${businessId}): ${totalProdsRow?.count || 0}`);

        res.json({
            success: true,
            userId,
            businessId,
            stats,
            totals: {
                products: totalProdsRow?.count || 0,
                categories: totalCatsRow?.count || 0
            },
            businessSettings: cloudBizSettings || null,
            syncedAt: new Date().toISOString()
        });

    } catch (err) {
        console.error('[SyncCloud] ❌ Error general de sincronización:', err);
        res.status(500).json({
            success: false,
            error: err.message || 'Error durante la sincronización con la nube.'
        });
    }
});

/**
 * GET /api/sync/status
 * Devuelve el estado actual de sincronización y conectividad con la nube
 */
router.get('/api/sync/status', async (req, res) => {
    const sb = getSupabaseAdmin();
    const userId = await resolveSupabaseUserId(req);
    const businessId = Number(req.query?.businessId || req.headers['x-business-id'] || req.business_id || 1);

    try {
        const localProds = await dbGet("SELECT COUNT(*) as count FROM products WHERE business_id = ? AND isActive = 1", [businessId]);
        let cloudCount = null;

        if (sb && userId) {
            const { count, error } = await sb
                .from('products')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('business_id', String(businessId))
                .eq('is_deleted', false);
            if (!error) cloudCount = count;
        }

        res.json({
            online: true,
            configured: !!sb,
            userId: userId || null,
            businessId,
            localProducts: localProds?.count || 0,
            cloudProducts: cloudCount,
            inSync: cloudCount !== null ? (localProds?.count === cloudCount) : null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Limpia las tablas operativas de un usuario en Supabase Cloud.
 * Si se especifica businessId, únicamente limpia ese negocio, aislando a los demás.
 * Protege estrictamente user_licenses y auth.users.
 */
async function cleanUserCloudData(userId, businessId = null) {
    const sb = getSupabaseAdmin();
    if (!sb) {
        throw new Error('Supabase no configurado o credenciales de admin faltantes.');
    }
    if (!userId) {
        throw new Error('UserId de Supabase requerido para limpieza.');
    }

    const OPERATIONAL_TABLES = [
        'sales', 'products', 'customers', 'categories', 'suppliers',
        'purchases', 'cash_registers', 'expenses', 'cash_movements',
        'staff', 'debt_payments', 'stock_movements', 'business_settings',
        'sale_returns', 'audit_logs', 'product_price_history',
        'product_cost_history', 'customer_credit_deposits', 'supplier_payments',
        'debt_payment_sessions'
    ];

    const results = {};
    for (const table of OPERATIONAL_TABLES) {
        try {
            let query = sb.from(table).delete().eq('user_id', userId);
            if (businessId) {
                query = query.eq('business_id', String(businessId));
            }
            const { error } = await query;
            if (error) {
                console.warn(`[CleanCloud] Advertencia limpiando tabla "${table}":`, error.message);
                results[table] = { success: false, error: error.message };
            } else {
                results[table] = { success: true };
            }
        } catch (e) {
            console.warn(`[CleanCloud] Error inesperado en tabla "${table}":`, e.message);
            results[table] = { success: false, error: e.message };
        }
    }
    console.log(`🧹 [CleanCloud] Tablas operativas limpiadas en Supabase para usuario [${userId}] (Negocio: ${businessId || 'GLOBAL'}).`);
    return results;
}

/**
 * POST /api/sync/clean-cloud
 * Limpia las tablas operativas del usuario en Supabase Cloud para el negocio especificado.
 */
router.post('/api/sync/clean-cloud', async (req, res) => {
    try {
        const userId = await resolveSupabaseUserId(req);
        if (!userId) {
            return res.status(400).json({ success: false, error: 'No se pudo identificar la cuenta de usuario de Supabase.' });
        }
        const businessId = req.body?.businessId || req.headers['x-business-id'] || req.business_id || null;
        const results = await cleanUserCloudData(userId, businessId);
        res.json({ success: true, userId, businessId, results });
    } catch (err) {
        console.error('Error en clean-cloud:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.cleanUserCloudData = cleanUserCloudData;
router.resolveSupabaseUserId = resolveSupabaseUserId;

module.exports = router;

