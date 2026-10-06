async function _hashSHA256(str) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

class User {
    static async create(username, password, phone = null, role = 'cashier') {
        try {
            const trimmedUsername = username.trim();

            if (!password || password.length < 4) {
                throw new Error('Contraseña demasiado corta (mínimo 4 caracteres)');
            }

            if (phone && !this.validatePhone(phone)) {
                throw new Error('Formato de teléfono inválido: +569XXXXXXXX');
            }

            if (db.mode === 'sqlite' && window.ApiClient) {
                const result = await window.ApiClient.post('auth/create-user', {
                    username: trimmedUsername,
                    password: password,
                    phone: phone ? this.normalizePhone(phone) : null,
                    role: role
                });
                if (!result || !result.success) throw new Error(result?.error || 'Error al crear usuario en servidor');

                const localHash = await _hashSHA256(password);
                const userData = {
                    id: result.user.id,
                    username: trimmedUsername,
                    password: password,
                    localHash: localHash,
                    phone: phone ? this.normalizePhone(phone) : null,
                    role: role,
                    business_id: result.user.business_id,
                    createdAt: new Date().toISOString()
                };
                await db.put('users', userData);
                console.log('[User] Usuario creado exitosamente en SQLite:', trimmedUsername);
                return userData;
            }

            const users = await db.getAll('users');

            if (users.some(u => u.username?.toLowerCase() === trimmedUsername.toLowerCase())) {
                throw new Error('Este nombre de usuario ya está en uso');
            }

            const localHash = await _hashSHA256(password);
            const userData = {
                username: trimmedUsername,
                password: password, // El servidor se encarga del hash
                localHash: localHash, // ponytail: hash local seguro para login offline
                phone: phone ? this.normalizePhone(phone) : null,
                role: users.length === 0 ? 'owner' : (PermissionService.isValidRole(role) ? role : 'cashier'),
                createdAt: new Date().toISOString()
            };

            const id = await db.add('users', userData);
            const resolvedId = (id && typeof id === 'object') ? id.id : id;

            console.log('[User] Usuario creado exitosamente localmente:', trimmedUsername);
            return { id: resolvedId, ...userData };
        } catch (error) {
            console.error('[User] Error en creación:', error);
            throw error;
        }
    }

    static validatePhone = (p) => /^\+569\d{8}$/.test(p.replace(/\s/g, ''));
    static normalizePhone = (p) => {
        let n = p.replace(/[\s\-]/g, '');
        if (!n.startsWith('+569')) n = n.startsWith('9') ? '+56' + n : (n.startsWith('569') ? '+' + n : n);
        return n;
    };

    static async authenticate(username, password, businessName) {
        // MODO LOCAL (100% Offline)
        console.log(`[Auth] Intentando Login Local para: ${username}`);
        
        if (db.mode === 'sqlite' && window.ApiClient) {
            try {
                const result = await window.ApiClient.post('auth/login', {
                    businessName: businessName,
                    username: username,
                    password: password
                });
                if (result && result.token) {
                    localStorage.setItem('AUTH_TOKEN', result.token);
                    localStorage.setItem('BUSINESS_ID', result.user.business_id);
                    if (result.business) {
                        localStorage.setItem('CURRENT_BUSINESS', JSON.stringify(result.business));
                    }
                    
                    // ponytail: Guardar/actualizar localHash en IndexedDB local para permitir inicio de sesión offline
                    try {
                        const localHashVal = await _hashSHA256(password);
                        const localUser = await db.get('users', result.user.id) || { id: result.user.id, username: result.user.username };
                        localUser.localHash = localHashVal;
                        localUser.password = result.user.password || password;
                        localUser.business_id = result.user.business_id;
                        localUser.role = result.user.role;
                        await db.put('users', localUser);
                    } catch (offlineErr) {
                        console.warn('[User] No se pudo persistir la credencial local para offline:', offlineErr);
                    }

                    // Asegurar que forcePasswordChange esté incluido
                    const user = result.user;
                    user.forcePasswordChange = user.forcePasswordChange || 0;
                    return user;
                }
                throw new Error('Token no devuelto por el servidor local');
            } catch (err) {
                throw new Error(err.message || 'Credenciales incorrectas locales');
            }
        } else {
            // Modo IndexedDB Puro
            const users = await db.getAll('users');
            const user = users.find(u => u.username?.toLowerCase() === username.trim().toLowerCase());
            
            let isPasswordValid = false;
            if (user) {
                if (user.localHash) {
                    const inputHash = await _hashSHA256(password);
                    isPasswordValid = user.localHash === inputHash;
                } else {
                    // ponytail: Fallback si no tiene localHash (cajas antiguas o creados sin hash)
                    isPasswordValid = user.password === password;
                }
            }

            if (!user || !isPasswordValid) {
                throw new Error('Credenciales incorrectas o usuario no encontrado localmente');
            }

            localStorage.setItem('BUSINESS_ID', user.business_id || 1);
            // Asegurar que forcePasswordChange esté incluido
            user.forcePasswordChange = user.forcePasswordChange || 0;
            return user;
        }
    }

    static getEffectiveRole(user) {
        if (!user) return 'cashier';
        return user.role || 'cashier';
    }

    static async update(id, data) {
        const user = await db.get('users', id);
        if (!user) return null;
        
        if (data.phone && !this.validatePhone(data.phone)) throw new Error('Teléfono inválido');
        const updated = { ...user, ...data, updatedAt: new Date().toISOString() };
        await db.put('users', updated);
        return updated;
    }

    static getAll = () => db.getAll('users');
    static count = () => db.count('users');
    static getById = (id) => db.get('users', id);

    static async initializeDefaultUser() {
        if (db.mode === 'sqlite') return;
        if (await this.count() === 0) {
            await this.create('admin', 'Admin@2024!', null, 'owner');
        }
    }

    static async updateRole(userId, newRole) {
        if (!PermissionService.isValidRole(newRole)) throw new Error('Rol inválido');
        const user = await this.getById(userId);
        if (!user) throw new Error('Usuario no encontrado');

        const updated = await this.update(userId, { role: newRole });
        AuditLogService.log({
            entity: 'user', entityId: userId, action: 'updateRole',
            summary: `Rol actualizado: ${user.username} -> ${newRole}`
        });
        return updated;
    }

    /* --- LÓGICA DE RECUPERACIÓN Y SEGURIDAD SECUNDARIA --- */
    static async hasAdminPIN(businessName = null) {
        if (db.mode === 'sqlite' && window.ApiClient) {
            try {
                const result = await window.ApiClient.post('auth/has-admin-pin', { businessName });
                return !!(result && result.hasPIN);
            } catch (err) {
                console.error('[User] Error checking admin PIN:', err);
                return false;
            }
        }
        const s = await db.get('settings', 'adminPIN');
        // ponytail: Si no hay PIN en la base de datos, siempre permitimos '1234' por defecto
        return !!(s && s.value) || true;
    }

    static async setAdminPIN(pin) {
        if (!/^\d{4,8}$/.test(pin)) throw new Error('PIN debe ser de 4-8 dígitos');
        if (db.mode === 'sqlite' && window.ApiClient) {
            const result = await window.ApiClient.post('auth/set-admin-pin', { pin });
            if (!result || !result.success) throw new Error(result?.error || 'Error al guardar PIN en el servidor');
        }
        await db.put('settings', { key: 'adminPIN', value: String(pin) });
    }

    static async verifyAdminPIN(pin, businessName = null) {
        if (db.mode === 'sqlite' && window.ApiClient) {
            try {
                const result = await window.ApiClient.post('auth/verify-admin-pin', { pin, businessName });
                return !!(result && result.valid);
            } catch (err) {
                console.error('[User] Error verifying admin PIN:', err);
                return false;
            }
        }
        const s = await db.get('settings', 'adminPIN');
        // ponytail: Si no hay PIN configurado en settings, el PIN por defecto es '1234'
        const expectedPin = s && s.value !== undefined ? String(s.value) : '1234';
        return String(expectedPin) === String(pin);
    }

    static async resetPasswordWithPIN(username, pin, newPass, businessName = null) {
        if (db.mode === 'sqlite' && window.ApiClient) {
            const result = await window.ApiClient.post('auth/reset-password-pin', { username, pin, newPass, businessName });
            if (!result || !result.success) throw new Error(result?.error || 'Error al restablecer la contraseña');
            return result.user;
        }
        const user = await this.findByUsername(username, businessName);
        if (!user) throw new Error('Usuario no encontrado');
        if (!await this.verifyAdminPIN(pin, businessName)) throw new Error('PIN incorrecto');
        return await this.update(user.id, { password: newPass });
    }

    static async findByUsername(name, businessName = null) {
        if (db.mode === 'sqlite' && window.ApiClient) {
            try {
                const result = await window.ApiClient.post('auth/verify-user', { username: name, businessName });
                return result.user || null;
            } catch (err) {
                console.error('[User] Error finding user:', err);
                return null;
            }
        }
        const users = await db.getAll('users');
        return users.find(u => u.username?.trim().toLowerCase() === name.trim().toLowerCase()) || null;
    }

    static async generateAndSetRecoveryCode(userId) {
        // Generar un código con formato XXXX-XXXX-XXXX
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const genPart = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        const code = `${genPart()}-${genPart()}-${genPart()}`;

        if (db.mode === 'sqlite' && window.ApiClient) {
            const result = await window.ApiClient.post('auth/generate-recovery-code', { userId, code });
            if (!result || !result.success) throw new Error(result?.error || 'Error al generar código');
            return { code, user: result.user };
        }

        const user = await this.getById(userId);
        if (!user) throw new Error('Usuario no encontrado');

        const updated = await this.update(userId, {
            recoveryCode: code,
            recoveryCodeGeneratedAt: new Date().toISOString()
        });
        return { code, user: updated };
    }

    static async verifyRecoveryCode(userId, code) {
        if (!code) return false;
        if (db.mode === 'sqlite' && window.ApiClient) {
            try {
                const result = await window.ApiClient.post('auth/verify-recovery-code', { userId, code });
                return !!(result && result.valid);
            } catch (err) {
                console.error('[User] Error verifying recovery code:', err);
                return false;
            }
        }
        const user = await this.getById(userId);
        if (!user || !user.recoveryCode) return false;
        return user.recoveryCode.replace(/-/g, '').toUpperCase() === code.replace(/-/g, '').toUpperCase();
    }

    static async resetPasswordWithCode(username, code, newPass, businessName = null) {
        if (db.mode === 'sqlite' && window.ApiClient) {
            const result = await window.ApiClient.post('auth/reset-password-code', { username, code, newPass, businessName });
            if (!result || !result.success) throw new Error(result?.error || 'Error al restablecer la contraseña');
            return result.user;
        }
        const user = await this.findByUsername(username, businessName);
        if (!user) throw new Error('Usuario no encontrado');
        const isValid = await this.verifyRecoveryCode(user.id, code);
        if (!isValid) throw new Error('Código incorrecto');
        return await this.update(user.id, { password: newPass, recoveryCode: null, recoveryCodeGeneratedAt: null });
    }
}
