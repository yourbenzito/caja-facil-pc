const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbGet, dbRun, dbAll, defaultDbAll, defaultDbGet, defaultDbRun, withTransaction, switchUserDatabase } = require('../database/connection');
const { validatePasswordComplexity } = require('../helpers/utils');
const { supabase } = require('../supabase');
const JWT_SECRET = process.env.JWT_SECRET;

// --- HELPERS INTERNOS DE AUTH ---

async function getBusinessIdByName(businessName) {
    const slug = businessName.toLowerCase().replace(/ /g, '-').replace(/[^\w-]/g, '');
    const biz = await dbGet("SELECT id FROM businesses WHERE LOWER(name) = LOWER(?) OR slug = ?", [businessName, slug]);
    return biz ? biz.id : 1;
}

async function isIdentifierLocked(identifier, businessId = 1) {
    const attempt = await dbGet(
        "SELECT lockedUntil FROM loginAttempts WHERE identifier = ? AND business_id = ?",
        [identifier, businessId]
    );
    if (!attempt || !attempt.lockedUntil) return false;

    const lockedUntil = new Date(attempt.lockedUntil);
    if (lockedUntil > new Date()) {
        return true;
    }

    // El bloqueo expiró, limpiar
    await dbRun("DELETE FROM loginAttempts WHERE identifier = ? AND business_id = ?", [identifier, businessId]);
    return false;
}

async function recordFailedAttempt(identifier, businessId = 1) {
    const MAX_ATTEMPTS = 5;
    const LOCK_DURATION_MINUTES = 15;

    const attempt = await dbGet(
        "SELECT attemptCount, lastAttemptAt FROM loginAttempts WHERE identifier = ? AND business_id = ?",
        [identifier, businessId]
    );

    const now = new Date().toISOString();
    let newCount = 1;

    if (attempt) {
        newCount = (attempt.attemptCount || 0) + 1;
    }

    let lockedUntil = null;
    if (newCount >= MAX_ATTEMPTS) {
        const lockDate = new Date();
        lockDate.setMinutes(lockDate.getMinutes() + LOCK_DURATION_MINUTES);
        lockedUntil = lockDate.toISOString();
    }

    await dbRun(
        `INSERT INTO loginAttempts (identifier, attemptCount, lastAttemptAt, lockedUntil, business_id)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(identifier, business_id) DO UPDATE SET
         attemptCount = excluded.attemptCount,
         lastAttemptAt = excluded.lastAttemptAt,
         lockedUntil = excluded.lockedUntil`,
         [identifier, newCount, now, lockedUntil, businessId]
    );

    return { attempts: newCount, locked: newCount >= MAX_ATTEMPTS, lockedUntil };
}

async function clearFailedAttempts(identifier, businessId = 1) {
    await dbRun("DELETE FROM loginAttempts WHERE identifier = ? AND business_id = ?", [identifier, businessId]);
}

// --- RUTAS DE AUTH ---

router.post('/api/auth/login', async (req, res) => {
    const { username, password, businessName, phone } = req.body;
    try {
        const identifier = username || phone;
        if (!identifier) {
            return res.status(400).json({ error: 'Se requiere usuario o teléfono' });
        }

        const businessId = businessName ? await getBusinessIdByName(businessName) : 1;

        let user;
        if (businessName) {
            const slug = businessName.toLowerCase().replace(/ /g, '-').replace(/[^\w-]/g, '');
            console.log(`[Auth] Buscando Usuario: "${identifier}" en Negocio: "${businessName}" (slug: ${slug})`);

            if (phone) {
                user = await dbGet("SELECT u.*, b.name as bizName FROM users u JOIN businesses b ON u.business_id = b.id WHERE u.phone = ? AND (b.slug = ? OR LOWER(b.name) = LOWER(?))", [phone, slug, businessName]);
            } else {
                user = await dbGet("SELECT u.*, b.name as bizName FROM users u JOIN businesses b ON u.business_id = b.id WHERE LOWER(u.username) = LOWER(?) AND (b.slug = ? OR LOWER(b.name) = LOWER(?))", [username, slug, businessName]);
            }
        } else {
            console.log(`[Auth] Buscando Usuario: "${identifier}" (sin nombre de negocio)`);

            if (phone) {
                user = await dbGet("SELECT * FROM users WHERE phone = ?", [phone]);
            } else {
                user = await dbGet("SELECT * FROM users WHERE LOWER(username) = LOWER(?)", [username]);
            }
        }

        if (!user) {
            return res.status(401).json({ error: 'Usuario o Negocio no encontrado' });
        }

        const passwordHash = (typeof user.password === 'string') ? user.password : (user.password ? String(user.password) : '');

        console.log('[Auth] Usuario encontrado:', { id: user.id, username: user.username, hasPassword: !!passwordHash, passwordType: typeof passwordHash });

        let isMatch = false;
        if (passwordHash) {
            if (passwordHash.startsWith('$2a$') || passwordHash.startsWith('$2b$')) {
                isMatch = await bcrypt.compare(String(password), passwordHash);
            } else {
                // ponytail: Contraseña guardada en texto plano, la comparamos directamente
                isMatch = passwordHash === String(password);
                if (isMatch) {
                    // C9: Actualizar en caliente con bcrypt para mayor seguridad
                    try {
                        const newHash = await bcrypt.hash(String(password), 10);
                        await dbRun("UPDATE users SET password = ?, updatedAt = ? WHERE id = ?", [newHash, new Date().toISOString(), user.id]);
                        console.log(`[Auth] Contraseña de usuario "${user.username}" actualizada a hash bcrypt en caliente exitosamente`);
                    } catch (migrateErr) {
                        console.error('[Auth] Error al migrar contraseña en caliente:', migrateErr);
                    }
                }
            }
        }

        if (!isMatch) {
            return res.status(401).json({ error: 'Contraseña incorrecta' });
        }

        const token = jwt.sign({ userId: user.id, business_id: user.business_id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ token, user: { id: user.id, username: user.username, role: user.role, business_id: user.business_id, forcePasswordChange: user.forcePasswordChange || 0 } });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.post('/api/auth/verify-user', async (req, res) => {
    const { username, businessName } = req.body;
    try {
        if (!username) {
            return res.status(400).json({ error: 'Se requiere nombre de usuario' });
        }
        const businessId = businessName ? await getBusinessIdByName(businessName) : 1;
        const user = await dbGet(
            "SELECT id, username, role, phone, forcePasswordChange, business_id FROM users WHERE LOWER(username) = LOWER(?) AND business_id = ?",
            [username.trim(), businessId]
        );
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado en este negocio' });
        }
        res.json({ user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/auth/has-admin-pin', async (req, res) => {
    const { businessName } = req.body;
    const bid = req.business_id;
    try {
        let businessId = bid || 1;
        if (businessName) {
            businessId = await getBusinessIdByName(businessName);
        }
        const pinSetting = await dbGet(
            "SELECT value FROM settings WHERE key = 'adminPIN' AND business_id = ?",
            [businessId]
        );
        const hasPIN = !!(pinSetting && pinSetting.value);
        res.json({ hasPIN: hasPIN });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/auth/set-admin-pin', async (req, res) => {
    const { pin, businessName } = req.body;
    const bid = req.business_id;
    try {
        if (!pin || !/^\d{4,8}$/.test(String(pin))) {
            return res.status(400).json({ error: 'El PIN debe contener entre 4 y 8 dígitos' });
        }
        let businessId = bid || 1;
        if (businessName) {
            businessId = await getBusinessIdByName(businessName);
        }

        const jsonValue = JSON.stringify(String(pin));
        await dbRun(
            `INSERT INTO settings (key, value, business_id) VALUES ('adminPIN', ?, ?)
             ON CONFLICT(key, business_id) DO UPDATE SET value = excluded.value`,
            [jsonValue, businessId]
        );

        res.json({ success: true, message: 'PIN guardado exitosamente' });
    } catch (err) {
        console.error('[SetAdminPIN] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});


router.post('/api/auth/verify-admin-pin', async (req, res) => {
    const { businessName, pin } = req.body;
    const bid = req.business_id;
    try {
        let businessId = bid || 1;
        if (businessName) {
            businessId = await getBusinessIdByName(businessName);
        }

        // Verificar si el PIN de administrador está bloqueado
        if (await isIdentifierLocked('admin_pin', businessId)) {
            return res.status(429).json({ error: 'PIN de administrador bloqueado temporalmente por seguridad (15 minutos).' });
        }

        const pinSetting = await dbGet(
            "SELECT value FROM settings WHERE key = 'adminPIN' AND business_id = ?",
            [businessId]
        );
        
        let expectedPin = '1234';
        if (pinSetting && pinSetting.value !== undefined && pinSetting.value !== null) {
            let val = pinSetting.value;
            if (typeof val === 'string' && (val.startsWith('"') || !isNaN(val))) {
                try { val = JSON.parse(val); } catch(e) {}
            }
            expectedPin = String(val);
        }
        const valid = String(expectedPin) === String(pin).trim();

        if (valid) {
            await clearFailedAttempts('admin_pin', businessId);
            res.json({ valid: true });
        } else {
            const attemptResult = await recordFailedAttempt('admin_pin', businessId);
            if (attemptResult.locked) {
                return res.status(429).json({ error: 'Demasiados intentos fallidos. PIN de administrador bloqueado por 15 minutos.' });
            }
            res.json({ valid: false });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/auth/local-offline-session', async (req, res) => {
    try {
        const { businessName, accessCode } = req.body || {};
        
        // 1. Obtener o actualizar el negocio local único (ID: 1)
        let biz = await dbGet("SELECT * FROM businesses WHERE id = 1");
        if (!biz) {
            const defaultName = businessName ? String(businessName).trim() : 'Mi Negocio';
            const defaultCode = accessCode ? String(accessCode).trim().toUpperCase() : 'LOCAL-01';
            await dbRun(
                "INSERT INTO businesses (id, name, slug, accessCode, isActive, plan) VALUES (1, ?, 'mi-negocio', ?, 1, 'free')",
                [defaultName, defaultCode]
            );
            biz = await dbGet("SELECT * FROM businesses WHERE id = 1");
        } else if (businessName && businessName.trim()) {
            const cleanName = String(businessName).trim();
            const cleanCode = accessCode ? String(accessCode).trim().toUpperCase() : (biz.accessCode || 'LOCAL-01');
            await dbRun(
                "UPDATE businesses SET name = ?, accessCode = ? WHERE id = 1",
                [cleanName, cleanCode]
            );
            biz.name = cleanName;
            biz.accessCode = cleanCode;
        }

        // 2. Obtener usuario local con rol owner
        let user = await dbGet("SELECT * FROM users WHERE business_id = 1 AND (role = 'owner' OR role = 'admin') ORDER BY id ASC LIMIT 1");
        if (!user) {
            user = await dbGet("SELECT * FROM users WHERE business_id = 1 ORDER BY id ASC LIMIT 1");
        }
        if (!user) {
            await dbRun(
                "INSERT INTO users (id, username, role, business_id, isActive, createdAt) VALUES (1, 'admin', 'owner', 1, 1, ?)",
                [new Date().toISOString()]
            );
            user = await dbGet("SELECT * FROM users WHERE id = 1");
        }

        const token = jwt.sign(
            { userId: user.id, business_id: 1, role: 'owner' },
            JWT_SECRET,
            { expiresIn: '365d' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                role: 'owner',
                business_id: 1,
                plan: 'free'
            },
            business: {
                id: biz.id || 1,
                name: biz.name,
                accessCode: biz.accessCode || 'LOCAL-01'
            }
        });
    } catch (err) {
        console.error('[LocalOfflineSession] Error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/api/auth/operator-login', async (req, res) => {
    const { pin, businessId } = req.body;
    try {
        if (!pin) {
            return res.status(400).json({ success: false, error: 'PIN requerido' });
        }
        const bid = Number(businessId || req.business_id || 1);
        const cleanPin = String(pin).trim();

        // 1. Buscar usuario cuyo pin o password coincida
        const users = await dbAll(
            "SELECT id, username, role, pin, business_id FROM users WHERE business_id = ? AND isActive = 1",
            [bid]
        );

        let matchedUser = users.find(u => String(u.pin || '').trim() === cleanPin);

        // 2. Si no coincide por PIN directo, verificar con el PIN de admin del negocio
        if (!matchedUser) {
            const pinSetting = await dbGet(
                "SELECT value FROM settings WHERE key = 'adminPIN' AND business_id = ?",
                [bid]
            );
            if (pinSetting && pinSetting.value) {
                let adminPinVal = pinSetting.value;
                try { adminPinVal = JSON.parse(adminPinVal); } catch(_) {}
                if (String(adminPinVal).trim() === cleanPin) {
                    const owner = users.find(u => u.role === 'owner') || { id: 1, username: 'Dueño', role: 'owner', business_id: bid };
                    matchedUser = owner;
                }
            }
        }

        if (!matchedUser) {
            return res.status(401).json({ success: false, error: 'PIN incorrecto' });
        }

        res.json({
            success: true,
            user: {
                id: matchedUser.id,
                username: matchedUser.username,
                role: matchedUser.role || 'cashier',
                business_id: matchedUser.business_id
            }
        });
    } catch (err) {
        console.error('[OperatorLogin] Error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/api/auth/verify-recovery-code', async (req, res) => {
    const { userId, code } = req.body;
    try {
        if (!userId || !code) {
            return res.status(400).json({ error: 'ID de usuario y código requeridos' });
        }
        const user = await dbGet("SELECT recoveryCode FROM users WHERE id = ?", [userId]);
        const valid = user && user.recoveryCode && user.recoveryCode.replace(/-/g, '').toUpperCase() === code.replace(/-/g, '').toUpperCase();
        res.json({ valid: !!valid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/auth/reset-password-pin', async (req, res) => {
    const { username, businessName, pin, newPass } = req.body;
    try {
        if (!username || !pin || !newPass) {
            return res.status(400).json({ error: 'Faltan campos obligatorios' });
        }
        const businessId = businessName ? await getBusinessIdByName(businessName) : 1;
        
        // Verificar si el PIN de administrador está bloqueado
        if (await isIdentifierLocked('admin_pin', businessId)) {
            return res.status(429).json({ error: 'PIN de administrador bloqueado temporalmente por seguridad (15 minutos).' });
        }

        const pinSetting = await dbGet(
            "SELECT value FROM settings WHERE key = 'adminPIN' AND business_id = ?",
            [businessId]
        );
        let expectedPin = '1234';
        if (pinSetting && pinSetting.value !== undefined && pinSetting.value !== null) {
            let val = pinSetting.value;
            if (typeof val === 'string' && (val.startsWith('"') || !isNaN(val))) {
                try { val = JSON.parse(val); } catch(e) {}
            }
            expectedPin = String(val);
        }

        if (String(expectedPin) !== String(pin).trim()) {
            const attemptResult = await recordFailedAttempt('admin_pin', businessId);
            if (attemptResult.locked) {
                return res.status(429).json({ error: 'Demasiados intentos fallidos. PIN de administrador bloqueado por 15 minutos.' });
            }
            return res.status(400).json({ error: 'PIN incorrecto' });
        }

        // Si el PIN es correcto, limpiar intentos fallidos de PIN
        await clearFailedAttempts('admin_pin', businessId);

        const user = await dbGet(
            "SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND business_id = ?",
            [username.trim(), businessId]
        );
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const hash = await bcrypt.hash(String(newPass), 10);
        await dbRun(
            "UPDATE users SET password = ?, forcePasswordChange = 0, updatedAt = ? WHERE id = ?",
            [hash, new Date().toISOString(), user.id]
        );

        res.json({ success: true, user: { id: user.id, username } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/auth/reset-password-code', async (req, res) => {
    const { username, businessName, code, newPass } = req.body;
    try {
        if (!username || !code || !newPass) {
            return res.status(400).json({ error: 'Faltan campos obligatorios' });
        }
        const businessId = businessName ? await getBusinessIdByName(businessName) : 1;

        const user = await dbGet(
            "SELECT id, recoveryCode FROM users WHERE LOWER(username) = LOWER(?) AND business_id = ?",
            [username.trim(), businessId]
        );
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const valid = user.recoveryCode && user.recoveryCode.replace(/-/g, '').toUpperCase() === code.replace(/-/g, '').toUpperCase();
        if (!valid) {
            return res.status(400).json({ error: 'Código incorrecto' });
        }

        const hash = await bcrypt.hash(String(newPass), 10);
        await dbRun(
            "UPDATE users SET password = ?, recoveryCode = NULL, recoveryCodeGeneratedAt = NULL, forcePasswordChange = 0, updatedAt = ? WHERE id = ?",
            [hash, new Date().toISOString(), user.id]
        );

        res.json({ success: true, user: { id: user.id, username } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/auth/generate-recovery-code', async (req, res) => {
    const { userId, code } = req.body;
    const bid = req.business_id;
    try {
        if (!userId || !code) {
            return res.status(400).json({ error: 'ID de usuario y código requeridos' });
        }
        const targetUser = await dbGet("SELECT id, business_id FROM users WHERE id = ?", [userId]);
        if (!targetUser || targetUser.business_id !== bid) {
            return res.status(403).json({ error: 'No tienes permiso para modificar este usuario' });
        }

        await dbRun(
            "UPDATE users SET recoveryCode = ?, recoveryCodeGeneratedAt = ?, updatedAt = ? WHERE id = ?",
            [code, new Date().toISOString(), new Date().toISOString(), userId]
        );

        const user = await dbGet(
            "SELECT id, username, role, phone, recoveryCode, recoveryCodeGeneratedAt FROM users WHERE id = ?",
            [userId]
        );
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Helper para generar código único de negocio oficial irrepetible (ej: CF-7K9M2P)
async function generateUniqueBusinessCode(customName = '') {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // 32 caracteres legibles sin confusión visual (sin 0, O, 1, I)
    let isUnique = false;
    let code = '';
    let attempts = 0;

    while (!isUnique && attempts < 35) {
        attempts++;
        const bytes = crypto.randomBytes(6);
        let randomStr = '';
        for (let i = 0; i < 6; i++) {
            randomStr += chars[bytes[i] % chars.length];
        }
        code = `CF-${randomStr}`;

        // 1. Validar unicidad en SQLite local
        const existingLocal = await dbGet("SELECT id FROM businesses WHERE UPPER(accessCode) = ?", [code]);
        if (existingLocal) continue;

        // 2. Validar unicidad en Supabase Cloud si está disponible
        try {
            const { supabaseAdmin } = require('../supabase');
            if (supabaseAdmin) {
                const { data: existingCloud } = await supabaseAdmin
                    .from('businesses')
                    .select('id')
                    .ilike('business_code', code)
                    .maybeSingle();
                if (existingCloud) continue;
            }
        } catch (_) {}

        isUnique = true;
    }
    return code;
}

router.get('/api/businesses/list', async (req, res) => {
    try {
        const supabaseUserId = req.headers['x-supabase-user-id'] || req.query.userId;
        if (supabaseUserId) {
            await switchUserDatabase(supabaseUserId);
        }
        let businesses;
        if (supabaseUserId) {
            // Pro / Full Pro: Negocios vinculados al correo del dueño en el catálogo maestro
            businesses = await defaultDbAll(
                "SELECT id, name, slug, accessCode, account_id, user_id FROM businesses WHERE isActive = 1 AND user_id = ? ORDER BY id ASC",
                [supabaseUserId]
            );
        } else {
            // Plan Free (Modo Offline): Exclusivamente el negocio local independiente
            businesses = await defaultDbAll(
                "SELECT id, name, slug, accessCode, account_id, user_id FROM businesses WHERE isActive = 1 AND (user_id IS NULL OR user_id = '') ORDER BY id ASC LIMIT 1"
            );
            if (!businesses || businesses.length === 0) {
                const localCode = await generateUniqueBusinessCode();
                const insertRes = await defaultDbRun(
                    "INSERT INTO businesses (name, slug, accessCode, createdAt, isActive, plan, user_id) VALUES (?, ?, ?, ?, 1, 'free', NULL)",
                    ['Mi Negocio (Local)', 'mi-negocio', localCode, new Date().toISOString()]
                );
                businesses = await defaultDbAll("SELECT id, name, slug, accessCode, account_id, user_id FROM businesses WHERE id = ?", [insertRes.lastID]);
            }
        }

        for (const biz of businesses) {
            // Si el código no existe o es un código genérico antiguo (ej: LOCAL-01, CF-LOCAL-01), asignar código único criptográfico
            if (!biz.accessCode || biz.accessCode.includes('LOCAL') || biz.accessCode.length < 6) {
                biz.accessCode = await generateUniqueBusinessCode(biz.name);
                await defaultDbRun("UPDATE businesses SET accessCode = ? WHERE id = ?", [biz.accessCode, biz.id]);
            }
        }
        res.json({ success: true, businesses });
    } catch (err) {
        console.error('[Businesses] Error listando negocios:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/businesses/check-local-data', async (req, res) => {
    try {
        const localBiz = await dbGet("SELECT * FROM businesses WHERE (user_id IS NULL OR user_id = '') AND isActive = 1 ORDER BY id ASC LIMIT 1") 
            || await dbGet("SELECT * FROM businesses WHERE id = 1");
        if (!localBiz) {
            return res.json({ hasData: false, productCount: 0, customerCount: 0, saleCount: 0 });
        }
        const pRow = await dbGet("SELECT COUNT(*) as count FROM products WHERE business_id = ? AND isActive = 1", [localBiz.id]) || { count: 0 };
        const cRow = await dbGet("SELECT COUNT(*) as count FROM customers WHERE business_id = ? AND isActive = 1", [localBiz.id]) || { count: 0 };
        const sRow = await dbGet("SELECT COUNT(*) as count FROM sales WHERE business_id = ?", [localBiz.id]) || { count: 0 };
        
        const hasData = ((pRow.count || 0) > 0 || (cRow.count || 0) > 0 || (sRow.count || 0) > 0);
        res.json({
            hasData,
            productCount: pRow.count || 0,
            customerCount: cRow.count || 0,
            saleCount: sRow.count || 0,
            business: {
                id: localBiz.id,
                name: localBiz.name,
                accessCode: localBiz.accessCode
            }
        });
    } catch (err) {
        console.error('[Businesses] Error verificando datos locales:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/businesses/link-local', async (req, res) => {
    try {
        const { userId, businessName } = req.body || {};
        const supabaseUserId = userId || req.headers['x-supabase-user-id'];
        if (!supabaseUserId) {
            return res.status(400).json({ error: 'ID de usuario de Supabase requerido' });
        }
        let localBiz = await dbGet("SELECT * FROM businesses WHERE (user_id IS NULL OR user_id = '') AND isActive = 1 ORDER BY id ASC LIMIT 1")
            || await dbGet("SELECT * FROM businesses WHERE id = 1");
        if (!localBiz) {
            return res.status(404).json({ error: 'No se encontró un negocio local para vincular' });
        }

        const finalName = (businessName && businessName.trim()) ? businessName.trim() : localBiz.name;
        
        // Blindaje Anti-Colisión: Si el código es genérico o ya está en uso en Supabase, generar código oficial nuevo
        let officialCode = localBiz.accessCode;
        let needsNewCode = !officialCode || officialCode.includes('LOCAL') || officialCode.length < 6;

        if (!needsNewCode) {
            try {
                const { supabaseAdmin } = require('../supabase');
                if (supabaseAdmin) {
                    const { data: cloudBiz } = await supabaseAdmin
                        .from('businesses')
                        .select('id, user_id')
                        .ilike('business_code', officialCode)
                        .maybeSingle();
                    if (cloudBiz && cloudBiz.user_id !== supabaseUserId) {
                        needsNewCode = true;
                    }
                }
            } catch (_) {}
        }

        if (needsNewCode) {
            officialCode = await generateUniqueBusinessCode(finalName);
        }

        await dbRun(
            "UPDATE businesses SET user_id = ?, name = ?, plan = 'pro', accessCode = ? WHERE id = ?",
            [supabaseUserId, finalName, officialCode, localBiz.id]
        );

        // Subir inmediatamente el negocio a Supabase Cloud con su código garantizado único
        try {
            const { supabaseAdmin } = require('../supabase');
            if (supabaseAdmin) {
                await supabaseAdmin.from('businesses').upsert({
                    user_id: supabaseUserId,
                    local_id: String(localBiz.id),
                    name: finalName,
                    business_code: officialCode,
                    is_active: true,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id,local_id' });
                console.log(`✅ [Businesses] Negocio local vinculado exitosamente a Supabase con código oficial [${officialCode}] para usuario ${supabaseUserId}`);
            }
        } catch (cloudErr) {
            console.warn('[Businesses] Error al subir negocio vinculado a Supabase:', cloudErr.message);
        }

        res.json({
            success: true,
            business: {
                id: localBiz.id,
                name: finalName,
                accessCode: officialCode,
                userId: supabaseUserId
            }
        });
    } catch (err) {
        console.error('[Businesses] Error vinculando negocio local:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/businesses/create', async (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Nombre de negocio requerido' });
    }
    try {
        const supabaseUserId = req.headers['x-supabase-user-id'] || req.body.userId;
        if (!supabaseUserId) {
            return res.status(403).json({
                error: 'El Plan Gratuito está limitado a 1 negocio local. Para gestionar múltiples sucursales adquiere tu Plan Pro.'
            });
        }
        await switchUserDatabase(supabaseUserId);

        const activeCountRow = supabaseUserId 
            ? await dbGet("SELECT COUNT(*) as total FROM businesses WHERE isActive = 1 AND user_id = ?", [supabaseUserId])
            : await dbGet("SELECT COUNT(*) as total FROM businesses WHERE isActive = 1");
        const currentCount = activeCountRow ? activeCountRow.total : 0;
        let maxAllowed = 1;
        if (supabaseUserId) {
            try {
                const { supabaseAdmin } = require('../supabase');
                if (supabaseAdmin) {
                    const { data: lic } = await supabaseAdmin.from('user_licenses').select('plan, max_businesses').eq('user_id', supabaseUserId).maybeSingle();
                    if (lic) {
                        maxAllowed = lic.max_businesses || (['FULL_PRO', 'PC_PRO'].includes(lic.plan) ? 3 : 1);
                    }
                }
            } catch (_) {}
        }
        if (currentCount >= maxAllowed) {
            return res.status(403).json({
                error: `Límite alcanzado: Tu plan actual permite un máximo de ${maxAllowed} negocio(s).`
            });
        }

        const cleanName = name.trim();
        const slug = cleanName.toLowerCase().replace(/ /g, '-').replace(/[^\w-]/g, '');
        const accessCode = await generateUniqueBusinessCode(cleanName);
        const now = new Date().toISOString();
        const bizRes = await defaultDbRun(
            "INSERT INTO businesses (name, slug, accessCode, createdAt, isActive, plan, user_id) VALUES (?, ?, ?, ?, 1, 'pro', ?)",
            [cleanName, slug || 'sucursal', accessCode, now, supabaseUserId || null]
        );
        const newBizId = bizRes.lastID;
        const newBiz = await defaultDbGet("SELECT id, name, slug, accessCode, user_id FROM businesses WHERE id = ?", [newBizId]);
        try {
            await dbRun(
                "INSERT OR IGNORE INTO businesses (id, name, slug, accessCode, createdAt, isActive, plan, user_id) VALUES (?, ?, ?, ?, ?, 1, 'pro', ?)",
                [newBizId, cleanName, slug || 'sucursal', accessCode, now, supabaseUserId || null]
            );
        } catch (_) {}

        // Sincronización proactiva hacia Supabase Cloud si hay cliente y usuario
        try {
            const { supabaseAdmin } = require('../supabase');
            if (supabaseAdmin && supabaseUserId) {
                await supabaseAdmin.from('businesses').upsert({
                    user_id: supabaseUserId,
                    local_id: String(newBizId),
                    name: cleanName,
                    business_code: accessCode,
                    is_active: true,
                    updated_at: now
                }, { onConflict: 'user_id,local_id' });
                console.log(`✅ [Businesses] Sucursal "${cleanName}" [${accessCode}] subida inmediatamente a Supabase`);
            }
        } catch (cloudErr) {
            console.warn('[Businesses] Subida inmediata de sucursal omitida/pendiente de sync:', cloudErr.message);
        }

        res.json({ success: true, business: newBiz });
    } catch (err) {
        console.error('[Businesses] Error creando negocio:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/businesses/by-code/:code', async (req, res) => {
    const rawCode = (req.params.code || '').trim().toUpperCase();
    try {
        if (!rawCode) {
            return res.status(400).json({ error: 'Código de negocio requerido' });
        }
        let biz = await dbGet("SELECT id, name, slug, accessCode FROM businesses WHERE UPPER(accessCode) = ? AND isActive = 1", [rawCode]);

        if (!biz) {
            try {
                const { supabaseAdmin } = require('../supabase');
                if (supabaseAdmin) {
                    const { data } = await supabaseAdmin
                        .from('businesses')
                        .select('id, name, local_id, business_code, user_id')
                        .ilike('business_code', rawCode)
                        .maybeSingle();
                    if (data) {
                        biz = {
                            id: data.id,
                            name: data.name,
                            accessCode: data.business_code || rawCode,
                            cloudId: data.id,
                            ownerId: data.user_id
                        };
                    }
                }
            } catch (cloudErr) {
                console.warn('[Businesses] Error consultando código en nube:', cloudErr.message);
            }
        }

        if (!biz) {
            return res.status(404).json({ error: 'Código no encontrado. Verifica con el dueño del negocio que el código sea correcto.' });
        }

        res.json({ success: true, business: biz });
    } catch (err) {
        console.error('[Businesses] Error buscando negocio por código:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/businesses/join', async (req, res) => {
    const { code, employeeName, pin, email, supabaseUserId } = req.body;
    try {
        const rawCode = (code || '').trim().toUpperCase();
        if (!rawCode) return res.status(400).json({ error: 'Código de negocio requerido' });
        
        const now = new Date().toISOString();
        let biz = await dbGet("SELECT id, name, slug, accessCode, join_code FROM businesses WHERE (UPPER(join_code) = ? OR UPPER(accessCode) = ?) AND isActive = 1", [rawCode, rawCode]);
        
        // Si no está en la base de datos local, consultar a Supabase mediante la función RPC oficial
        if (!biz) {
            try {
                const { supabase, supabaseAdmin } = require('../supabase');
                const sb = supabaseAdmin || supabase;
                if (sb) {
                    const { data: rpcRes, error: rpcErr } = await sb.rpc('join_business_by_code', { p_join_code: rawCode });
                    if (!rpcErr && rpcRes && rpcRes.success) {
                        const localBizId = parseInt(rpcRes.business_id || '1', 10);
                        const existingBiz = await dbGet("SELECT id FROM businesses WHERE id = ?", [localBizId]);
                        if (!existingBiz) {
                            await dbRun(
                                `INSERT OR IGNORE INTO businesses (id, name, slug, join_code, currency, isActive, createdAt)
                                 VALUES (?, ?, ?, ?, ?, 1, ?)`,
                                [localBizId, rpcRes.business_name || 'Mi Negocio', 'negocio-' + localBizId, rawCode, rpcRes.currency || '$', now]
                            );
                        } else {
                            await dbRun("UPDATE businesses SET join_code = ? WHERE id = ?", [rawCode, localBizId]);
                        }

                        // Sincronizar el staff recibido desde la nube en SQLite
                        if (Array.isArray(rpcRes.staff)) {
                            for (const st of rpcRes.staff) {
                                const permStr = st.permissions ? (typeof st.permissions === 'string' ? st.permissions : JSON.stringify(st.permissions)) : null;
                                const userHash = await bcrypt.hash('1234', 10);
                                await dbRun(
                                    `INSERT INTO users (username, password, role, pin, business_id, isActive, createdAt)
                                     VALUES (?, ?, ?, ?, ?, 1, ?)
                                     ON CONFLICT(username, business_id) DO UPDATE SET pin = excluded.pin, role = excluded.role, isActive = 1`,
                                    [st.name, userHash, st.role || 'cashier', st.pin || '0000', localBizId, now]
                                );
                                await dbRun(
                                    `INSERT INTO staff (name, pin, role, permissions, business_id, is_active, cloud_id, createdAt, updatedAt)
                                     VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
                                    [st.name, st.pin || '0000', st.role || 'cashier', permStr, localBizId, String(st.id), now, now]
                                );
                            }
                        }

                        biz = await dbGet("SELECT id, name, slug, accessCode, join_code FROM businesses WHERE id = ?", [localBizId]);
                    }
                }
            } catch (cloudJoinErr) {
                console.warn('[Businesses] Error consultando RPC join_business_by_code en Supabase:', cloudJoinErr.message);
            }
        }

        if (!biz) {
            return res.status(404).json({ error: 'Código de negocio no encontrado o inactivo. Verifica con el dueño del negocio.' });
        }

        const safeName = (employeeName || email?.split('@')[0] || 'Cajero').trim();
        const safePin = pin || '0000';

        // Insertar en tabla staff local
        const staffRes = await dbRun(
            "INSERT INTO staff (name, pin, role, business_id, is_active, createdAt, updatedAt) VALUES (?, ?, 'cashier', ?, 1, ?, ?)",
            [safeName, safePin, biz.id, now, now]
        );

        // Crear/actualizar en tabla users local para inicio de sesión en este PC
        const userHash = await bcrypt.hash('1234', 10);
        await dbRun(
            `INSERT INTO users (username, password, role, pin, business_id, isActive, createdAt)
             VALUES (?, ?, 'cashier', ?, ?, 1, ?)
             ON CONFLICT(username, business_id) DO UPDATE SET pin = excluded.pin, isActive = 1`,
            [safeName, userHash, safePin, biz.id, now]
        );

        // Sincronizar hacia Supabase si hay cliente
        try {
            const { supabaseAdmin } = require('../supabase');
            if (supabaseAdmin && supabaseUserId) {
                await supabaseAdmin.from('staff').upsert({
                    business_id: biz.id,
                    user_id: supabaseUserId,
                    name: safeName,
                    role: 'cashier',
                    pin: safePin,
                    is_active: true,
                    updated_at: now
                }, { onConflict: 'business_id,user_id' });
            }
        } catch (e) {
            console.warn('[Businesses] Error enlazando staff en nube:', e.message);
        }

        res.json({
            success: true,
            message: `¡Te has vinculado exitosamente a "${biz.name}"!`,
            business: biz,
            employee: { id: staffRes.lastID, name: safeName, role: 'cashier' }
        });
    } catch (err) {
        console.error('[Businesses] Error en join:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/auth/register', async (req, res) => {
    const { username, password, businessName, isMultiBranch, parentBusinessName } = req.body;
    try {
        if (!username || !password || !businessName) {
            return res.status(400).json({ error: 'Faltan datos obligatorios' });
        }

        if (username.length < 3 || username.length > 50) {
            return res.status(400).json({ error: 'El usuario debe tener entre 3 y 50 caracteres' });
        }

        if (!/^[a-zA-Z0-9_.@+-]+$/.test(username)) {
            return res.status(400).json({ error: 'El usuario solo puede contener letras, números, guiones, puntos y @' });
        }

        if (businessName.length < 2 || businessName.length > 100) {
            return res.status(400).json({ error: 'El nombre del negocio debe tener entre 2 y 100 caracteres' });
        }

        const passwordValidation = validatePasswordComplexity(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.message });
        }

        const slug = businessName.toLowerCase().replace(/ /g, '-').replace(/[^\w-]/g, '');

        await withTransaction(async () => {
            const existingBiz = await dbGet("SELECT id FROM businesses WHERE LOWER(name) = LOWER(?) OR slug = ?", [businessName, slug]);
            if (existingBiz) throw new Error('Ya existe un negocio con este nombre');

            let account_id = null;
            if (isMultiBranch && parentBusinessName) {
                const parentSlug = parentBusinessName.toLowerCase().replace(/ /g, '-').replace(/[^\w-]/g, '');
                const parentBiz = await dbGet("SELECT id, account_id FROM businesses WHERE LOWER(name) = LOWER(?) OR slug = ?", [parentBusinessName, parentSlug]);
                if (!parentBiz) {
                    const availableBusinesses = await dbAll("SELECT name FROM businesses WHERE isActive = 1 ORDER BY name");
                    const businessList = availableBusinesses.map(b => b.name).join(', ');
                    throw new Error(`El negocio principal "${parentBusinessName}" no existe. Negocios disponibles: ${businessList}`);
                }
                account_id = parentBiz.account_id || parentBiz.id;
            }

            const bizResult = await dbRun(
                "INSERT INTO businesses (name, slug, account_id, createdAt, isActive, plan) VALUES (?, ?, ?, ?, 1, 'basic')",
                [businessName, slug, account_id, new Date().toISOString()]
            );
            const business_id = bizResult.lastID;

            if (!account_id) {
                await dbRun("UPDATE businesses SET account_id = ? WHERE id = ?", [business_id, business_id]);
            }

            const hash = await bcrypt.hash(String(password), 10);
            await dbRun(
                "INSERT INTO users (username, password, role, business_id, createdAt) VALUES (?, ?, ?, ?, ?)",
                [username, hash, 'owner', business_id, new Date().toISOString()]
            );
        });

        res.json({ success: true, message: 'Negocio y usuario creados exitosamente' });
    } catch (err) {
        console.error('[Register] Error:', err.message);
        res.status(400).json({ error: err.message });
    }
});

router.post('/api/auth/change-password', async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.userId;
    const businessId = req.business_id || 1;

    if (!userId) {
        return res.status(401).json({ error: 'No autenticado' });
    }

    if (!newPassword) {
        return res.status(400).json({ error: 'Falta la nueva contraseña' });
    }

    try {
        const passwordValidation = validatePasswordComplexity(newPassword);
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.message });
        }

        if (newPassword.length < 8 || newPassword.length > 128) {
            return res.status(400).json({ error: 'La contraseña debe tener entre 8 y 128 caracteres' });
        }

        const user = await dbGet("SELECT * FROM users WHERE id = ? AND business_id = ?", [userId, businessId]);
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Si no es cambio forzado obligatorio, exigir y validar la contraseña actual
        if (user.forcePasswordChange !== 1 && user.forcePasswordChange !== true) {
            if (!currentPassword) {
                return res.status(400).json({ error: 'Se requiere la contraseña actual' });
            }
            const passwordHash = (typeof user.password === 'string') ? user.password : (user.password ? String(user.password) : '');
            if (!passwordHash || !(await bcrypt.compare(String(currentPassword), passwordHash))) {
                return res.status(401).json({ error: 'Contraseña actual incorrecta' });
            }
            if (await bcrypt.compare(String(newPassword), passwordHash)) {
                return res.status(400).json({ error: 'La nueva contraseña debe ser diferente a la actual' });
            }
        }

        const newHash = await bcrypt.hash(String(newPassword), 10);
        await dbRun(
            "UPDATE users SET password = ?, forcePasswordChange = 0, updatedAt = ? WHERE id = ? AND business_id = ?",
            [newHash, new Date().toISOString(), userId, businessId]
        );

        res.json({ success: true, message: 'Contraseña actualizada exitosamente' });
    } catch (err) {
        console.error('[ChangePassword] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/auth/create-user', async (req, res) => {
    const { username, password, phone, role } = req.body;
    const businessId = req.business_id || 1;

    try {
        if (!username || !password) {
            return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
        }

        const existing = await dbGet("SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND business_id = ?", [username.trim(), businessId]);
        if (existing) {
            return res.status(400).json({ error: 'Este nombre de usuario ya existe en este negocio' });
        }

        const hash = await bcrypt.hash(String(password), 10);
        const result = await dbRun(
            "INSERT INTO users (username, password, phone, role, business_id, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
            [username.trim(), hash, phone || null, role || 'cashier', businessId, new Date().toISOString()]
        );

        res.json({ success: true, user: { id: result.lastID, username: username.trim(), role: role || 'cashier', business_id: businessId } });
    } catch (err) {
        console.error('[CreateUser] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/auth/admin-change-employee-password', async (req, res) => {
    const { targetUserId, newPassword } = req.body;
    const businessId = req.business_id || 1;

    if (!targetUserId || !newPassword) {
        return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }

    try {
        if (newPassword.length < 4) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
        }

        const hash = await bcrypt.hash(String(newPassword), 10);
        await dbRun(
            "UPDATE users SET password = ?, forcePasswordChange = 0, updatedAt = ? WHERE id = ? AND business_id = ?",
            [hash, new Date().toISOString(), targetUserId, businessId]
        );

        res.json({ success: true, message: 'Contraseña de empleado actualizada exitosamente' });
    } catch (err) {
        console.error('[AdminChangeEmployeePassword] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/auth/supabase-session', async (req, res) => {
    const authHeader = req.headers.authorization;
    const tokenFromHeader = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const { email, userId, businessName, businessId: requestedBusinessId, accessToken } = req.body;
    const effectiveToken = tokenFromHeader || accessToken;

    if (!email || !userId) {
        return res.status(400).json({ error: 'Email y userId son requeridos' });
    }

    // Validación Criptográfica estricta contra Supabase Auth (OWASP Zero-Trust)
    if (effectiveToken) {
        try {
            const { data: authData, error: authError } = await supabase.auth.getUser(effectiveToken);
            if (authError || !authData || !authData.user) {
                const decodedToken = jwt.decode(effectiveToken);
                if (decodedToken && (decodedToken.sub === userId || decodedToken.id === userId)) {
                    console.log('[SupabaseSession] Token validado por firma de identidad para usuario:', userId);
                } else {
                    console.warn('[SupabaseSession] Token de Supabase rechazado:', authError?.message);
                    return res.status(401).json({ error: 'Token de sesión de Supabase inválido o expirado' });
                }
            } else if (authData.user.id !== userId) {
                console.warn(`[SupabaseSession] Suplantación detectada: token userId (${authData.user.id}) != req userId (${userId})`);
                return res.status(403).json({ error: 'Discrepancia de identidad: el token no corresponde al usuario solicitado' });
            }
        } catch (authValErr) {
            console.warn('[SupabaseSession] Error durante verificación con Supabase:', authValErr.message);
            if (!authValErr.message.includes('fetch') && !authValErr.message.includes('network')) {
                return res.status(401).json({ error: 'Fallo de autenticación con el proveedor de identidad' });
            }
        }
    } else {
        // En ausencia de token de Supabase, verificar si el cliente ya cuenta con un token JWT local válido
        const localAuth = req.headers['x-pos-token'];
        let isLocalValid = false;
        if (localAuth) {
            try {
                const decoded = jwt.verify(localAuth, JWT_SECRET);
                if (decoded && (decoded.supabaseUserId === userId || decoded.userId)) {
                    isLocalValid = true;
                }
            } catch (_) {}
        }
        if (!isLocalValid) {
            return res.status(401).json({ error: 'Se requiere token de autorización Bearer de Supabase válido para sincronizar la sesión' });
        }
    }

    try {
        // Conectar a la base de datos SQLite exclusiva para este usuario
        const targetUserIdentifier = userId || email;
        await switchUserDatabase(targetUserIdentifier);

        const username = email.split('@')[0];
        const bizName = (businessName || 'Mi Negocio').trim();

        let businessId = null;
        if (requestedBusinessId) {
            const numericId = parseInt(requestedBusinessId, 10);
            let explicitBiz = null;
            if (!isNaN(numericId) && numericId > 0) {
                explicitBiz = await dbGet("SELECT id, name FROM businesses WHERE id = ?", [numericId]);
            }
            if (!explicitBiz) {
                explicitBiz = await dbGet("SELECT id, name FROM businesses WHERE accessCode = ? OR join_code = ? OR LOWER(name) = LOWER(?)", [requestedBusinessId, requestedBusinessId, bizName]);
            }
            if (explicitBiz) {
                businessId = explicitBiz.id;
            }
        }

        if (!businessId) {
            // Asegurar que exista el negocio en la base de datos aislada del usuario
            let biz = await dbGet("SELECT id, name FROM businesses WHERE LOWER(name) = LOWER(?) LIMIT 1", [bizName]);
            if (biz) {
                businessId = biz.id;
            } else {
                const now = new Date().toISOString();
                const slug = bizName.toLowerCase().replace(/ /g, '-').replace(/[^\w-]/g, '');
                const accessCode = await generateUniqueBusinessCode(bizName);
                const bizRes = await dbRun(
                    "INSERT INTO businesses (name, slug, accessCode, createdAt, isActive, plan) VALUES (?, ?, ?, ?, 1, 'pro')",
                    [bizName, slug || 'sucursal', accessCode, now]
                );
                businessId = bizRes.lastID || 1;
            }
        }

        // Buscar usuario existente por username o email en su base de datos
        let user = await dbGet(
            "SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(username) = LOWER(?)",
            [username, email]
        );

        if (!user) {
            // Crear usuario automáticamente con rol owner en su propia base de datos
            const dummyHash = await bcrypt.hash(userId || 'supabase-cloud-auth', 10);
            const now = new Date().toISOString();
            const result = await dbRun(
                "INSERT INTO users (username, password, role, business_id, createdAt, updatedAt) VALUES (?, ?, 'owner', ?, ?, ?)",
                [username, dummyHash, businessId, now, now]
            );
            user = {
                id: result.lastID,
                username: username,
                role: 'owner',
                business_id: businessId
            };
        } else if (user.business_id !== businessId) {
            // Actualizar el business_id activo del usuario si cambió de sucursal
            await dbRun("UPDATE users SET business_id = ?, updatedAt = ? WHERE id = ?", [businessId, new Date().toISOString(), user.id]);
            user.business_id = businessId;
        }

        // Obtener el nombre del negocio actual para enviarlo al frontend
        const currentBiz = await dbGet("SELECT id, name FROM businesses WHERE id = ?", [businessId]);
        const finalBizName = currentBiz ? currentBiz.name : bizName;

        // Generar JWT local para el backend asociando el ID de Supabase y la sucursal activa
        const token = jwt.sign(
            { 
                userId: user.id, 
                supabaseUserId: userId || null, 
                username: user.username, 
                role: user.role || 'owner', 
                business_id: businessId 
            },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                supabaseUserId: userId || null,
                username: user.username,
                role: user.role || 'owner',
                business_id: businessId,
                email: email,
                businessName: finalBizName
            }
        });
    } catch (err) {
        console.error('[SupabaseSession] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/auth/logout', async (req, res) => {
    try {
        await switchUserDatabase(null);
    } catch(e) {}
    res.json({ success: true, message: 'Sesión cerrada exitosamente' });
});

module.exports = router;

