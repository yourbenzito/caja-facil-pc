class User {
    static async create(username, password, phone = null, role = 'cashier') {
        try {
            const users = await db.getAll('users');
            const trimmedUsername = username.trim();

            if (users.some(u => u.username?.toLowerCase() === trimmedUsername.toLowerCase())) {
                throw new Error('Este nombre de usuario ya está en uso');
            }

            if (phone && !this.validatePhone(phone)) {
                throw new Error('Formato de teléfono inválido: +569XXXXXXXX');
            }

            if (!password || password.length < 4) {
                throw new Error('Contraseña demasiado corta (mínimo 4 caracteres)');
            }

            const userData = {
                username: trimmedUsername,
                password: password, // El servidor se encarga del hash
                phone: phone ? this.normalizePhone(phone) : null,
                role: users.length === 0 ? 'owner' : (PermissionService.isValidRole(role) ? role : 'cashier'),
                createdAt: new Date().toISOString()
            };

            const id = await db.add('users', userData);
            const resolvedId = (id && typeof id === 'object') ? id.id : id;
            
            console.log('[User] Usuario creado exitosamente:', trimmedUsername);
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
            
            if (!user || (user.password && user.password !== password)) {
                // Nota: en SQLite el password llega hasheado desde la nube, 
                // para login offline simple comparamos el texto si fue guardado (o implementamos bcrypt local)
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
        return !!(s && s.value);
    }

    static async setAdminPIN(pin) {
        if (!/^\d{4,8}$/.test(pin)) throw new Error('PIN debe ser de 4-8 dígitos');
        await db.put('settings', { key: 'adminPIN', value: pin });
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
        return s && s.value === pin;
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
