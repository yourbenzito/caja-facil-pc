const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbGet, dbRun, dbAll, withTransaction } = require('../database/connection');
const { validatePasswordComplexity } = require('../helpers/utils');
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

router.get('/api/businesses/list', async (req, res) => {
    try {
        const businesses = await dbAll("SELECT id, name, slug, account_id FROM businesses WHERE isActive = 1 ORDER BY name");
        res.json({ success: true, businesses });
    } catch (err) {
        console.error('[Businesses] Error listando negocios:', err);
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

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return res.status(400).json({ error: 'El usuario solo puede contener letras, números y guiones bajos' });
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
                [username, hash, 'admin', business_id, new Date().toISOString()]
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

router.post('/api/auth/logout', async (req, res) => {
    res.json({ success: true, message: 'Sesión cerrada exitosamente' });
});

module.exports = router;

