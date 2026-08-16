class AuthManager {
    static SESSION_KEY = 'pos_current_user';

    static async login(username, password, businessName) {
        const rememberMeInput = document.getElementById('login-remember-me');
        const rememberMe = rememberMeInput ? rememberMeInput.checked : window.localStorage.getItem('REMEMBER_LOGIN') === 'true'; // fallback if no UI yet

        const user = await User.authenticate(username, password, businessName);
        if (!user) {
            throw new Error('Usuario o contraseña incorrectos');
        }

        // Verificar si el usuario debe cambiar contraseña
        if (user.forcePasswordChange === 1 || user.forcePasswordChange === true) {
            // Guardar usuario temporalmente para el cambio de contraseña
            sessionStorage.setItem('PENDING_PASSWORD_CHANGE_USER', JSON.stringify({
                id: user.id,
                username: user.username,
                business_id: user.business_id || 1
            }));
            
            // Mostrar modal de cambio de contraseña
            this.showForcePasswordChangeModal();
            throw new Error('FORCE_PASSWORD_CHANGE');
        }

        const effectiveRole = User.getEffectiveRole(user);

        const session = {
            id: user.id,
            username: user.username,
            role: effectiveRole,
            business_id: user.business_id || localStorage.getItem('BUSINESS_ID') || 1,
            plan: user.plan || 'basic', // 'basic' o 'pro'
            expiryDate: user.expiryDate || null,
            loginTime: new Date().toISOString()
        };

        // Verificación de Suscripción (Bloqueo)
        if (session.expiryDate && new Date(session.expiryDate) < new Date()) {
            throw new Error('Suscripción vencida. Por favor regulariza tu pago en www.cajafacil.cl');
        }

        if (rememberMe) {
            localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
            localStorage.setItem('REMEMBER_LOGIN', 'true');
        } else {
            sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
            localStorage.removeItem('REMEMBER_LOGIN');
        }
        return session;
    }

    static async loginWithPhone(phone, password, businessName) {
        const rememberMeInput = document.getElementById('login-remember-me');
        const rememberMe = rememberMeInput ? rememberMeInput.checked : window.localStorage.getItem('REMEMBER_LOGIN') === 'true';

        // Normalizar teléfono
        const normalizedPhone = phone.replace(/\s/g, '');

        // Autenticar con teléfono en modo SQLite
        if (db.mode === 'sqlite' && window.ApiClient) {
            try {
                const result = await window.ApiClient.post('auth/login', {
                    phone: normalizedPhone,
                    password: password,
                    businessName: businessName
                });
                if (result && result.token) {
                    localStorage.setItem('AUTH_TOKEN', result.token);
                    localStorage.setItem('BUSINESS_ID', result.user.business_id);

                    const session = {
                        id: result.user.id,
                        username: result.user.username,
                        role: result.user.role,
                        business_id: result.user.business_id,
                        plan: 'basic',
                        expiryDate: null,
                        loginTime: new Date().toISOString()
                    };

                    if (rememberMe) {
                        localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
                        localStorage.setItem('REMEMBER_LOGIN', 'true');
                    } else {
                        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
                        localStorage.removeItem('REMEMBER_LOGIN');
                    }
                    return session;
                }
                throw new Error('Token no devuelto por el servidor local');
            } catch (err) {
                throw new Error(err.message || 'Credenciales incorrectas locales');
            }
        } else {
            // Modo IndexedDB - buscar por teléfono
            const users = await db.getAll('users');
            const user = users.find(u => u.phone === normalizedPhone);

            if (!user || (user.password && user.password !== password)) {
                throw new Error('Credenciales incorrectas o usuario no encontrado localmente');
            }

            const effectiveRole = User.getEffectiveRole(user);
            const session = {
                id: user.id,
                username: user.username,
                role: effectiveRole,
                business_id: user.business_id || 1,
                plan: user.plan || 'basic',
                expiryDate: user.expiryDate || null,
                loginTime: new Date().toISOString()
            };

            if (rememberMe) {
                localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
                localStorage.setItem('REMEMBER_LOGIN', 'true');
            } else {
                sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
                localStorage.removeItem('REMEMBER_LOGIN');
            }
            return session;
        }
    }

    static logout() {
        sessionStorage.removeItem(this.SESSION_KEY);
        localStorage.removeItem(this.SESSION_KEY);
        localStorage.removeItem('REMEMBER_LOGIN');
        localStorage.removeItem('AUTH_TOKEN');
        localStorage.removeItem('BUSINESS_ID');
        localStorage.removeItem('CURRENT_BUSINESS');
        window.location.reload();
    }

    static getCurrentUser() {
        let session = sessionStorage.getItem(this.SESSION_KEY);
        if (!session) {
            session = localStorage.getItem(this.SESSION_KEY);
            // Si tiene sesión local recordada, copiar al sessionStorage para flujo app
            if (session) sessionStorage.setItem(this.SESSION_KEY, session);
        }
        return session ? JSON.parse(session) : null;
    }

    static isAuthenticated() {
        return this.getCurrentUser() !== null;
    }

    static requireAuth() {

        if (!this.isAuthenticated()) {
            this.showLoginScreen();
            return false;
        }
        return true;
    }

    static showForcePasswordChangeModal() {
        // Remover login screen si existe
        const existingLogin = document.getElementById('login-screen');
        if (existingLogin) existingLogin.remove();

        // Crear modal de cambio de contraseña
        const modalHTML = `
            <div id="force-password-change-modal" class="login-screen">
                <div class="login-background-overlay"></div>
                <div class="login-panel">
                    <div class="login-content">
                        <div class="login-brand-compact">
                            <div class="brand-logo">🔐</div>
                            <h1 class="brand-name">Cambio de Contraseña</h1>
                        </div>

                        <div class="login-header" style="margin-bottom: 1.5rem;">
                            <h2 style="font-size: 1.25rem; margin-bottom: 0.5rem;">🔒 Seguridad Obligatoria</h2>
                            <p class="login-subtitle" style="font-size: 0.85rem; margin: 0;">
                                Por seguridad, debes cambiar tu contraseña antes de continuar.
                            </p>
                        </div>

                        <form id="force-password-change-form" class="login-form">
                            <div class="login-form-group">
                                <label class="login-label" for="new-password">Nueva Contraseña</label>
                                <div class="input-wrapper">
                                    <span class="input-icon">🔑</span>
                                    <input type="password" id="new-password" autocomplete="new-password" required class="login-input" placeholder="Mínimo 8 caracteres">
                                </div>
                            </div>

                            <div class="login-form-group">
                                <label class="login-label" for="confirm-new-password">Confirmar Nueva Contraseña</label>
                                <div class="input-wrapper">
                                    <span class="input-icon">✅</span>
                                    <input type="password" id="confirm-new-password" autocomplete="new-password" required class="login-input" placeholder="Repite tu contraseña">
                                </div>
                            </div>

                            <div id="password-requirements" style="background: rgba(79, 70, 229, 0.05); padding: 0.75rem; border-radius: 0.5rem; margin-bottom: 1rem; border: 1px solid rgba(79, 70, 229, 0.2);">
                                <label class="login-label" style="margin-bottom: 0.5rem; font-size: 0.8rem;">Requisitos de contraseña:</label>
                                <div style="font-size: 0.75rem; line-height: 1.6; color: #64748b;">
                                    <div id="req-length">❌ Mínimo 8 caracteres</div>
                                    <div id="req-uppercase">❌ Al menos una mayúscula</div>
                                    <div id="req-lowercase">❌ Al menos una minúscula</div>
                                    <div id="req-number">❌ Al menos un número</div>
                                    <div id="req-special">❌ Al menos un carácter especial (!@#$%^&*())</div>
                                </div>
                            </div>

                            <div id="password-change-error" class="login-error" style="display: none; padding: 0.5rem; margin-top: 0.5rem;"></div>

                            <button type="submit" id="password-change-btn" class="login-button premium-btn">
                                <span>Cambiar Contraseña</span>
                                <div class="btn-shine"></div>
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const form = document.getElementById('force-password-change-form');
        const newPasswordInput = document.getElementById('new-password');
        const confirmNewPasswordInput = document.getElementById('confirm-new-password');
        const errorDiv = document.getElementById('password-change-error');
        const passwordChangeBtn = document.getElementById('password-change-btn');

        // Validación de requisitos de contraseña en tiempo real
        newPasswordInput.addEventListener('input', () => {
            const password = newPasswordInput.value;
            
            document.getElementById('req-length').innerHTML = password.length >= 8 ? '✅ Mínimo 8 caracteres' : '❌ Mínimo 8 caracteres';
            document.getElementById('req-uppercase').innerHTML = /[A-Z]/.test(password) ? '✅ Al menos una mayúscula' : '❌ Al menos una mayúscula';
            document.getElementById('req-lowercase').innerHTML = /[a-z]/.test(password) ? '✅ Al menos una minúscula' : '❌ Al menos una minúscula';
            document.getElementById('req-number').innerHTML = /[0-9]/.test(password) ? '✅ Al menos un número' : '❌ Al menos un número';
            document.getElementById('req-special').innerHTML = /[!@#$%^&*(),.?":{}|<>]/.test(password) ? '✅ Al menos un carácter especial' : '❌ Al menos un carácter especial';
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const newPassword = newPasswordInput.value;
            const confirmNewPassword = confirmNewPasswordInput.value;

            // Validaciones
            if (newPassword.length < 8) {
                errorDiv.textContent = 'La contraseña debe tener al menos 8 caracteres';
                errorDiv.style.display = 'block';
                return;
            }

            if (!/[A-Z]/.test(newPassword)) {
                errorDiv.textContent = 'La contraseña debe contener al menos una mayúscula';
                errorDiv.style.display = 'block';
                return;
            }

            if (!/[a-z]/.test(newPassword)) {
                errorDiv.textContent = 'La contraseña debe contener al menos una minúscula';
                errorDiv.style.display = 'block';
                return;
            }

            if (!/[0-9]/.test(newPassword)) {
                errorDiv.textContent = 'La contraseña debe contener al menos un número';
                errorDiv.style.display = 'block';
                return;
            }

            if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
                errorDiv.textContent = 'La contraseña debe contener al menos un carácter especial';
                errorDiv.style.display = 'block';
                return;
            }

            if (newPassword !== confirmNewPassword) {
                errorDiv.textContent = 'Las contraseñas no coinciden';
                errorDiv.style.display = 'block';
                return;
            }

            passwordChangeBtn.disabled = true;
            const btnSpan = passwordChangeBtn.querySelector('span');
            if (btnSpan) btnSpan.textContent = 'Cambiando contraseña...';
            errorDiv.style.display = 'none';

            try {
                // Obtener usuario pendiente
                const pendingUser = JSON.parse(sessionStorage.getItem('PENDING_PASSWORD_CHANGE_USER'));
                
                if (db.mode === 'sqlite' && window.ApiClient) {
                    // Modo SQLite - usar endpoint del backend
                    const result = await window.ApiClient.post('auth/change-password', {
                        userId: pendingUser.id,
                        newPassword: newPassword
                    });

                    if (result && result.success) {
                        // ponytail: Limpiar sesión pendiente y AUTH_TOKEN temporal por seguridad
                        sessionStorage.removeItem('PENDING_PASSWORD_CHANGE_USER');
                        localStorage.removeItem('AUTH_TOKEN');
                        localStorage.removeItem(AuthManager.SESSION_KEY);
                        sessionStorage.removeItem(AuthManager.SESSION_KEY);
                        
                        alert('✅ Contraseña cambiada exitosamente. Por favor inicia sesión nuevamente.');
                        document.getElementById('force-password-change-modal').remove();
                        this.showLoginScreen();
                    } else {
                        throw new Error(result?.message || 'Error cambiando contraseña');
                    }
                } else {
                    // Modo IndexedDB - cambiar localmente
                    const users = await db.getAll('users');
                    const userIndex = users.findIndex(u => u.id === pendingUser.id);
                    
                    if (userIndex !== -1) {
                        users[userIndex].password = newPassword;
                        // ponytail: Actualizar el hash local para login offline seguro
                        users[userIndex].localHash = await _hashSHA256(newPassword);
                        users[userIndex].forcePasswordChange = 0;
                        users[userIndex].updatedAt = new Date().toISOString();
                        
                        await db.put('users', users[userIndex]);
                        
                        // ponytail: Limpiar sesión pendiente y AUTH_TOKEN temporal por seguridad
                        sessionStorage.removeItem('PENDING_PASSWORD_CHANGE_USER');
                        localStorage.removeItem('AUTH_TOKEN');
                        localStorage.removeItem(AuthManager.SESSION_KEY);
                        sessionStorage.removeItem(AuthManager.SESSION_KEY);
                        
                        alert('✅ Contraseña cambiada exitosamente. Por favor inicia sesión nuevamente.');
                        document.getElementById('force-password-change-modal').remove();
                        this.showLoginScreen();
                    } else {
                        throw new Error('Usuario no encontrado');
                    }
                }
            } catch (err) {
                errorDiv.textContent = err.message || 'Error cambiando contraseña';
                errorDiv.style.display = 'block';
                passwordChangeBtn.disabled = false;
                const btnSpan = passwordChangeBtn.querySelector('span');
                if (btnSpan) btnSpan.textContent = 'Cambiar Contraseña';
            }
        });
    }

    static initParticlesCanvas() {
        // ponytail: Deshabilitado para rendimiento instantáneo en pantallas táctiles y terminales POS
        return () => {};
    }

    static generatePOSIconsGrid() {
        // ponytail: Deshabilitado para evitar consumo innecesario de GPU/CPU
        return;
    }

    static showLoginScreen() {
        const appDiv = document.getElementById('app');
        const splashScreen = document.getElementById('splash-screen');

        if (appDiv) appDiv.style.display = 'none';
        if (splashScreen) splashScreen.style.display = 'none';

        const existingLogin = document.getElementById('login-screen');
        if (existingLogin) existingLogin.remove();

        const loginHTML = `
            <div id="login-screen" class="login-screen">
                <div class="login-background-overlay"></div>
                <div class="login-panel">
                    <div class="login-content">
                        <div class="login-brand-compact">
                            <div class="brand-logo">🛒</div>
                            <h1 class="brand-name">Caja<span>Fácil</span></h1>
                        </div>

                        <div class="login-header" style="margin-bottom: 0.75rem;">
                            <h2 id="login-form-title" style="display: none;">Bienvenido</h2>
                            <p class="login-subtitle" id="login-subtitle" style="font-size: 0.8rem; margin: 0;">Ingresa tus datos para continuar</p>
                        </div>

                        <form id="login-form" class="login-form">
                            <div class="login-form-group" id="business-name-group">
                                <label class="login-label" for="login-business-name">Nombre del Negocio</label>
                                <div class="input-wrapper">
                                    <span class="input-icon">🏪</span>
                                    <input type="text" id="login-business-name" autocomplete="organization" required class="login-input" placeholder="Ej: Minimarket La Kurva">
                                </div>
                            </div>

                            <div id="multi-branch-container" style="display: none; background: rgba(79, 70, 229, 0.05); padding: 0.75rem; border-radius: 0.5rem; margin-bottom: 1rem; border: 1px solid rgba(79, 70, 229, 0.2);">
                                <label class="login-label" style="margin-bottom: 0.5rem;">¿Tipo de Negocio?</label>
                                <div style="display: flex; gap: 1rem; margin-bottom: 0.5rem;">
                                    <label style="font-size: 0.85rem; display: flex; align-items: center; gap: 0.25rem; cursor: pointer;">
                                        <input type="radio" name="business-type" value="single" checked style="accent-color: #4f46e5;"> Negocio Único
                                    </label>
                                    <label style="font-size: 0.85rem; display: flex; align-items: center; gap: 0.25rem; cursor: pointer;">
                                        <input type="radio" name="business-type" value="branch" style="accent-color: #4f46e5;"> Sucursal
                                    </label>
                                </div>
                                <div id="parent-business-group" class="login-form-group" style="display: none; margin-bottom: 0;">
                                    <label class="login-label" for="parent-business-name">Nombre del Negocio Principal</label>
                                    <div class="input-wrapper">
                                        <span class="input-icon">🏢</span>
                                        <input type="text" id="parent-business-name" class="login-input" placeholder="Ej: Cadena Kurva">
                                    </div>
                                </div>
                            </div>

                            <div class="login-form-row">
                                <div class="login-form-group">
                                    <label class="login-label" for="login-username">Usuario o Celular</label>
                                    <div class="input-wrapper">
                                        <span class="input-icon">👤</span>
                                        <input type="text" id="login-username" autocomplete="username" required class="login-input" placeholder="Usuario o +569XXXXXXXX">
                                    </div>
                                </div>

                                <div class="login-form-group">
                                    <label class="login-label" for="login-password">Contraseña</label>
                                    <div class="input-wrapper">
                                        <span class="input-icon">🔒</span>
                                        <input type="password" id="login-password" autocomplete="current-password" required class="login-input" placeholder="••••">
                                    </div>
                                </div>
                            </div>
                            
                            <div class="login-form-group" style="display: flex; align-items: center; margin-top: 0.5rem; margin-bottom: 0.5rem; gap: 0.5rem;" id="remember-me-container">
                                <input type="checkbox" id="login-remember-me" checked style="cursor: pointer; width: 1.1rem; height: 1.1rem; accent-color: #4f46e5;">
                                <label for="login-remember-me" style="color: #64748b; font-size: 0.85rem; cursor: pointer; user-select: none;">Mantener mi sesión iniciada</label>
                            </div>

                            <div id="confirm-password-group" style="display: none;" class="login-form-group">
                                <label class="login-label" for="confirm-password">Confirmar Contraseña</label>
                                <div class="input-wrapper">
                                    <span class="input-icon">🔑</span>
                                    <input type="password" id="confirm-password" autocomplete="new-password" class="login-input" placeholder="Repite tu contraseña">
                                </div>
                            </div>

                            <div id="login-error" class="login-error" style="display: none; padding: 0.5rem; margin-top: 0.5rem;"></div>

                            <button type="submit" id="login-btn" class="login-button premium-btn">
                                <span>Iniciar Sesión</span>
                                <div class="btn-shine"></div>
                            </button>

                            <div class="login-actions">
                                <button type="button" id="toggle-mode-btn" class="login-link-btn">
                                    ¿Nuevo aquí? Regístrate gratis
                                </button>
                                <button type="button" id="forgot-password-btn" class="login-link-btn secondary">
                                    Recuperar contraseña
                                </button>
                            </div>
                        </form>
                        
                        <form id="recover-password-form" class="login-form pulse-form" style="display: none;">
                            <div class="recover-header">
                                <div class="brand-logo" style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔐</div>
                                <h2>Recuperar Cuenta</h2>
                                <p>Ingresa tu PIN o código de recuperación</p>
                            </div>
                            
                            <div class="login-form-group">
                                <label class="login-label" for="reset-business-name">Nombre del Negocio</label>
                                <div class="input-wrapper">
                                    <span class="input-icon">🏪</span>
                                    <input type="text" id="reset-business-name" autocomplete="organization" required class="login-input" placeholder="Ej: Mi Negocio">
                                </div>
                            </div>
                            
                            <div class="login-form-group">
                                <label class="login-label" for="reset-username">Usuario registrado</label>
                                <div class="input-wrapper">
                                    <span class="input-icon">👤</span>
                                    <input type="text" id="reset-username" autocomplete="username" required class="login-input" placeholder="Nombre de usuario">
                                </div>
                            </div>
                            
                            <div class="login-form-group">
                                <label class="login-label">¿Cómo quieres verificar?</label>
                                <div class="login-method-options">
                                    <div class="login-method-option active" id="method-pin-label" data-value="adminPIN">
                                        PIN Admin
                                    </div>
                                    <div class="login-method-option" id="method-code-label" data-value="recoveryCode">
                                        Código
                                    </div>
                                    <input type="hidden" name="reset-method" id="reset-method-val" value="adminPIN">
                                </div>
                            </div>
                            
                            <div id="reset-pin-group" class="login-form-group">
                                <label class="login-label" for="reset-admin-pin">PIN de Administrador</label>
                                <div class="input-wrapper">
                                    <span class="input-icon">🔢</span>
                                    <input type="password" id="reset-admin-pin" autocomplete="off" maxlength="8" class="login-input" placeholder="4-8 dígitos">
                                </div>
                            </div>
                            
                            <div id="reset-code-group" style="display: none;" class="login-form-group">
                                <label class="login-label" for="reset-recovery-code">Código de Recuperación</label>
                                <div class="input-wrapper">
                                    <span class="input-icon">📜</span>
                                    <input type="text" id="reset-recovery-code" autocomplete="off" class="login-input" placeholder="XXXX-XXXX-XXXX">
                                </div>
                            </div>
                            
                            <div id="new-password-group" style="display: none;">
                                <div class="login-form-group">
                                    <label class="login-label" for="new-password">Nueva Contraseña</label>
                                    <div class="input-wrapper">
                                        <span class="input-icon">🔑</span>
                                        <input type="password" id="new-password" autocomplete="new-password" class="login-input" placeholder="Mínimo 4 caracteres">
                                    </div>
                                </div>
                                <div class="login-form-group" style="margin-top: 1rem;">
                                    <label class="login-label" for="confirm-new-password">Confirmar Nueva Contraseña</label>
                                    <div class="input-wrapper">
                                        <span class="input-icon">✅</span>
                                        <input type="password" id="confirm-new-password" autocomplete="new-password" class="login-input" placeholder="Confirma tu contraseña">
                                    </div>
                                </div>
                            </div>
                            
                            <div id="recover-error" class="login-error" style="display: none;"></div>
                            
                            <button type="submit" id="recover-btn" class="login-button premium-btn">
                                <span>Verificar Identidad</span>
                                <div class="btn-shine"></div>
                            </button>
                            
                            <div class="login-actions">
                                <button type="button" id="back-to-login-btn" class="login-link-btn">
                                    ← Volver al inicio
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', loginHTML);

        // Inicializar canvas de partículas
        this.initParticlesCanvas();

        // Generar íconos POS en grilla
        this.generatePOSIconsGrid();

        // Onboarding: Si es primera instalación, pre-rellenar datos y avisar
        if (window.FIRST_INSTALL || window._isFirstInstall) {
            const hintBanner = document.createElement('div');
            hintBanner.id = 'first-install-hint';
            hintBanner.style.cssText = `
                position: absolute; top: 1rem; left: 50%; transform: translateX(-50%);
                background: linear-gradient(135deg, #1e3a5f, #2563eb);
                color: white; padding: 0.75rem 1.25rem; border-radius: 0.75rem;
                font-size: 0.82rem; line-height: 1.6; z-index: 10;
                box-shadow: 0 8px 24px rgba(37,99,235,0.35);
                max-width: 320px; width: calc(100% - 2rem);
                border: 1px solid rgba(255,255,255,0.15);
            `;
            hintBanner.innerHTML = `
                <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.4rem;">
                    <span style="font-size:1.1rem;">🆕</span>
                    <strong>Primera vez en este equipo</strong>
                    <button onclick="this.closest('#first-install-hint').remove()" 
                            style="margin-left:auto; background:none; border:none; color:rgba(255,255,255,0.7); cursor:pointer; font-size:1rem; line-height:1;">✕</button>
                </div>
                <div>Ingresa con las credenciales por defecto:</div>
                <div style="margin-top:0.3rem; padding:0.4rem 0.6rem; background:rgba(255,255,255,0.1); border-radius:0.4rem; font-family:monospace;">
                    🏪 Negocio: <strong>Mi Negocio</strong><br>
                    👤 Usuario: <strong>admin</strong><br>
                    🔑 Contraseña: <strong>Admin@2024!</strong>
                </div>
                <div style="margin-top:0.4rem; opacity:0.75; font-size:0.75rem;">⚠️ Serás obligado a cambiar la contraseña en el primer login.</div>
            `;
            const loginPanel = document.querySelector('#login-screen .login-panel');
            if (loginPanel) loginPanel.style.position = 'relative';
            const loginScreen = document.getElementById('login-screen');
            if (loginScreen) loginScreen.appendChild(hintBanner);

            // Pre-rellenar el formulario con credenciales por defecto
            setTimeout(() => {
                const bizInput = document.getElementById('login-business-name');
                const userInput = document.getElementById('login-username');
                const passInput = document.getElementById('login-password');
                if (bizInput) bizInput.value = 'Mi Negocio';
                if (userInput) userInput.value = 'admin';
                if (passInput) passInput.value = 'Admin@2024!';
            }, 200);
        }

        const form = document.getElementById('login-form');
        const businessNameInput = document.getElementById('login-business-name');
        const businessNameGroup = document.getElementById('business-name-group');
        const multiBranchContainer = document.getElementById('multi-branch-container');
        const parentBusinessGroup = document.getElementById('parent-business-group');
        const parentBusinessInput = document.getElementById('parent-business-name');
        const businessTypeRadios = document.querySelectorAll('input[name="business-type"]');
        const usernameInput = document.getElementById('login-username');
        const passwordInput = document.getElementById('login-password');
        const confirmPasswordInput = document.getElementById('confirm-password');
        const confirmPasswordGroup = document.getElementById('confirm-password-group');
        const errorDiv = document.getElementById('login-error');
        const loginBtn = document.getElementById('login-btn');
        const toggleModeBtn = document.getElementById('toggle-mode-btn');
        const subtitle = document.getElementById('login-subtitle');
        const forgotPasswordBtn = document.getElementById('forgot-password-btn');
        const recoverPasswordForm = document.getElementById('recover-password-form');
        const backToLoginBtn = document.getElementById('back-to-login-btn');
        const resetBusinessNameInput = document.getElementById('reset-business-name');
        const resetUsernameInput = document.getElementById('reset-username');
        const resetMethodVal = document.getElementById('reset-method-val');
        const resetMethodPin = document.getElementById('reset-method-pin');
        const resetMethodCode = document.getElementById('reset-method-code');
        const methodOptions = recoverPasswordForm.querySelectorAll('.login-method-option');
        const resetPinGroup = document.getElementById('reset-pin-group');
        const resetCodeGroup = document.getElementById('reset-code-group');
        const resetAdminPinInput = document.getElementById('reset-admin-pin');
        const resetRecoveryCodeInput = document.getElementById('reset-recovery-code');
        const newPasswordGroup = document.getElementById('new-password-group');
        const newPasswordInput = document.getElementById('new-password');
        const confirmNewPasswordInput = document.getElementById('confirm-new-password');
        const recoverErrorDiv = document.getElementById('recover-error');
        const recoverBtn = document.getElementById('recover-btn');

        let isRegisterMode = false;
        let isRecoverMode = false;
        let resetMethodVerified = false;

        // Auto-fill business name from last login
        const savedBusiness = localStorage.getItem('CURRENT_BUSINESS');
        if (savedBusiness) {
            setTimeout(() => {
                if (businessNameInput && !businessNameInput.value) {
                    businessNameInput.value = savedBusiness;
                }
            }, 300);
        }

        // Handle business type radio buttons
        if (businessTypeRadios) {
            businessTypeRadios.forEach(radio => {
                radio.addEventListener('change', async (e) => {
                    if (e.target.value === 'branch') {
                        parentBusinessGroup.style.display = 'block';
                        parentBusinessInput.required = true;

                        // Cargar lista de negocios disponibles
                        try {
                            const response = await fetch(`${window.API_CONFIG.API_URL}/businesses/list`);
                            const data = await response.json();

                            if (data.success && data.businesses && data.businesses.length > 0) {
                                // Convertir input text a select dropdown
                                const select = document.createElement('select');
                                select.id = 'parent-business-name';
                                select.className = 'login-input';
                                select.required = true;

                                // Opción por defecto
                                const defaultOption = document.createElement('option');
                                defaultOption.value = '';
                                defaultOption.textContent = 'Selecciona el negocio principal';
                                select.appendChild(defaultOption);

                                // Agregar opciones de negocios
                                data.businesses.forEach(biz => {
                                    const option = document.createElement('option');
                                    option.value = biz.name;
                                    option.textContent = biz.name;
                                    select.appendChild(option);
                                });

                                // Reemplazar input con select
                                parentBusinessInput.replaceWith(select);
                                // Actualizar referencia
                                window.parentBusinessInput = select;
                            } else {
                                // Si no hay negocios, mostrar mensaje
                                parentBusinessInput.placeholder = 'No hay negocios disponibles. Crea uno primero.';
                                parentBusinessInput.disabled = true;
                            }
                        } catch (err) {
                            console.error('Error cargando negocios:', err);
                            parentBusinessInput.placeholder = 'Error cargando negocios. Ingresa el nombre manualmente.';
                        }
                    } else {
                        parentBusinessGroup.style.display = 'none';
                        parentBusinessInput.required = false;

                        // Restaurar input text si estaba como select
                        if (parentBusinessInput.tagName === 'SELECT') {
                            const input = document.createElement('input');
                            input.type = 'text';
                            input.id = 'parent-business-name';
                            input.className = 'login-input';
                            input.placeholder = 'Ej: Cadena Kurva';
                            parentBusinessInput.replaceWith(input);
                            window.parentBusinessInput = input;
                        }
                    }
                });
            });
        }

            // Función para alternar entre login y registro
        toggleModeBtn.addEventListener('click', () => {
            isRegisterMode = !isRegisterMode;

            const formTitle = document.getElementById('login-form-title');

            if (isRegisterMode) {
                // Modo Registro
                subtitle.textContent = 'Registra tu negocio y crea tu cuenta';
                formTitle.textContent = 'Crear Cuenta';
                loginBtn.querySelector('span').textContent = 'Comenzar Ahora';
                toggleModeBtn.textContent = '¿Ya tienes cuenta? Ingresa aquí';
                confirmPasswordGroup.style.display = 'block';
                confirmPasswordInput.required = true;
                businessNameGroup.style.display = 'block';
                businessNameInput.required = true;
                if (multiBranchContainer) multiBranchContainer.style.display = 'block';
                passwordInput.autocomplete = 'new-password';
                usernameInput.autocomplete = 'username';
                const rmContainer = document.getElementById('remember-me-container');
                if (rmContainer) rmContainer.style.display = 'none';
            } else {
                // Modo Login
                subtitle.textContent = 'Ingresa tus credenciales para continuar';
                formTitle.textContent = 'Bienvenido';
                loginBtn.querySelector('span').textContent = 'Iniciar Sesión';
                toggleModeBtn.textContent = '¿Nuevo aquí? Regístrate gratis';
                confirmPasswordGroup.style.display = 'none';
                confirmPasswordInput.required = false;
                businessNameGroup.style.display = 'block';
                businessNameInput.required = true;
                if (multiBranchContainer) multiBranchContainer.style.display = 'none';
                passwordInput.autocomplete = 'current-password';
                const rmContainer = document.getElementById('remember-me-container');
                if (rmContainer) rmContainer.style.display = 'flex';
            }

            errorDiv.style.display = 'none';
            businessNameInput.value = '';
            usernameInput.value = '';
            passwordInput.value = '';
            confirmPasswordInput.value = '';
            if (isRegisterMode) businessNameInput.focus();
            else usernameInput.focus();
        });

        usernameInput.style.outline = 'none';
        passwordInput.style.outline = 'none';
        confirmPasswordInput.style.outline = 'none';


        // Prevenir que el formulario se envíe cuando se hace clic en el botón de recuperación
        // Nota: El botón ya tiene type="button" en el HTML, pero agregamos protección adicional
        if (form && forgotPasswordBtn) {
            // Asegurar que el botón no haga submit del formulario
            forgotPasswordBtn.type = 'button';

            form.addEventListener('submit', (e) => {
                if (isRecoverMode) {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                }
            });
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Si estamos en modo recuperación, no procesar el submit
            if (isRecoverMode) {
                return;
            }

            const username = usernameInput.value.trim();
            const password = passwordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            if (!username || !password) {
                errorDiv.textContent = 'Por favor completa todos los campos';
                errorDiv.style.display = 'block';
                return;
            }

            if (isRegisterMode) {
                // MODO REGISTRO
                const businessName = businessNameInput.value.trim();

                if (!businessName) {
                    errorDiv.textContent = 'Por favor ingresa el nombre de tu negocio';
                    errorDiv.style.display = 'block';
                    return;
                }

                if (password !== confirmPassword) {
                    errorDiv.textContent = 'Las contraseñas no coinciden';
                    errorDiv.style.display = 'block';
                    return;
                }

                if (password.length < 8) {
                    errorDiv.textContent = 'La contraseña debe tener al menos 8 caracteres';
                    errorDiv.style.display = 'block';
                    return;
                }

                if (!/[A-Z]/.test(password)) {
                    errorDiv.textContent = 'La contraseña debe contener al menos una mayúscula';
                    errorDiv.style.display = 'block';
                    return;
                }

                if (!/[a-z]/.test(password)) {
                    errorDiv.textContent = 'La contraseña debe contener al menos una minúscula';
                    errorDiv.style.display = 'block';
                    return;
                }

                if (!/[0-9]/.test(password)) {
                    errorDiv.textContent = 'La contraseña debe contener al menos un número';
                    errorDiv.style.display = 'block';
                    return;
                }

                if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
                    errorDiv.textContent = 'La contraseña debe contener al menos un carácter especial (!@#$%^&*(),.?":{}|<>)';
                    errorDiv.style.display = 'block';
                    return;
                }

                loginBtn.disabled = true;
                const btnSpan = loginBtn.querySelector('span');
                if (btnSpan) btnSpan.textContent = 'Creando negocio...';
                errorDiv.style.display = 'none';

                try {
                    const isMultiBranch = document.querySelector('input[name="business-type"]:checked')?.value === 'branch';
                    const parentBusinessInput = document.getElementById('parent-business-name');
                    const parentName = parentBusinessInput ? parentBusinessInput.value.trim() : '';

                    if (isMultiBranch && !parentName) {
                        errorDiv.textContent = 'Por favor selecciona el negocio principal';
                        errorDiv.style.display = 'block';
                        loginBtn.disabled = false;
                        const btnSpan = loginBtn.querySelector('span');
                        if (btnSpan) btnSpan.textContent = 'Comenzar Ahora';
                        return;
                    }

                    // Si estamos en modo SQLite (servidor), usar el endpoint de registro
                    if (db.mode === 'sqlite' && window.ApiClient) {
                        const result = await window.ApiClient.post('auth/register', {
                            businessName: businessName,
                            username: username,
                            password: password,
                            isMultiBranch: isMultiBranch,
                            parentBusinessName: parentName
                        });

                        // Auto-login después del registro
                        localStorage.setItem('CURRENT_BUSINESS', businessName);
                        await AuthManager.login(username, password, businessName);

                        document.getElementById('login-screen').remove();
                        if (appDiv) appDiv.style.display = 'flex';

                        showNotification(`¡Bienvenido! Tu negocio "${businessName}" fue creado exitosamente 🎉`, 'success');

                        setTimeout(() => {
                            window.location.reload();
                        }, 500);
                    } else {
                        // Modo IndexedDB (local) - flujo original
                        const users = await User.getAll();
                        const existingUser = users.find(u => u.username === username);

                        if (existingUser) {
                            errorDiv.textContent = 'Este nombre de usuario ya está en uso';
                            errorDiv.style.display = 'block';
                            loginBtn.disabled = false;
                            const btnSpan = loginBtn.querySelector('span');
                            if (btnSpan) btnSpan.textContent = 'Comenzar Ahora';
                            return;
                        }

                        const newUser = await User.create(username, password);
                        await new Promise(resolve => setTimeout(resolve, 100));

                        const verifyUser = await User.findByUsername(username);
                        if (!verifyUser) {
                            throw new Error('Error: El usuario no se guardó correctamente.');
                        }

                        await AuthManager.login(username, password);
                        document.getElementById('login-screen').remove();
                        if (appDiv) appDiv.style.display = 'flex';

                        showNotification(`¡Bienvenido ${username}! Negocio "${businessName}" creado`, 'success');

                        setTimeout(() => {
                            window.location.reload();
                        }, 500);
                    }

                } catch (error) {
                    errorDiv.textContent = 'Error al crear el negocio: ' + error.message;
                    errorDiv.style.display = 'block';
                    loginBtn.disabled = false;
                    const btnSpan = loginBtn.querySelector('span');
                    if (btnSpan) btnSpan.textContent = 'Comenzar Ahora';
                }
            } else {
                // MODO LOGIN
                loginBtn.disabled = true;
                const btnSpan = loginBtn.querySelector('span');
                if (btnSpan) btnSpan.textContent = 'Iniciando sesión...';
                errorDiv.style.display = 'none';

                try {
                    // Detectar si es username o phone
                    const isPhone = /^\+569\d{8}$/.test(username.replace(/\s/g, ''));
                    const businessName = businessNameInput.value.trim();

                    if (isPhone) {
                        await AuthManager.loginWithPhone(username, password, businessName);
                    } else {
                        await AuthManager.login(username, password, businessName);
                    }

                    localStorage.setItem('CURRENT_BUSINESS', businessName);
                    document.getElementById('login-screen').remove();

                    if (appDiv) appDiv.style.display = 'flex';

                    window.location.reload();

                } catch (error) {
                    errorDiv.textContent = error.message;
                    errorDiv.style.display = 'block';
                    loginBtn.disabled = false;
                    if (isRegisterMode) {
                        loginBtn.querySelector('span').textContent = 'Comenzar Ahora';
                    } else {
                        loginBtn.querySelector('span').textContent = 'Iniciar Sesión';
                    }
                }
            }
        });



        // Manejo de métodos de recuperación premium (PIN o Código)
        if (methodOptions && methodOptions.length > 0) {
            methodOptions.forEach(option => {
                option.addEventListener('click', () => {
                    if (resetMethodVerified) return; // ponytail: bloquear si ya se verificó
                    methodOptions.forEach(opt => opt.classList.remove('active'));
                    option.classList.add('active');
                    
                    const value = option.dataset.value;
                    if (resetMethodVal) resetMethodVal.value = value;
                    
                    if (value === 'adminPIN') {
                        if (resetPinGroup) resetPinGroup.style.display = 'block';
                        if (resetCodeGroup) resetCodeGroup.style.display = 'none';
                        if (resetAdminPinInput) resetAdminPinInput.required = true;
                        if (resetRecoveryCodeInput) resetRecoveryCodeInput.required = false;
                    } else {
                        if (resetPinGroup) resetPinGroup.style.display = 'none';
                        if (resetCodeGroup) resetCodeGroup.style.display = 'block';
                        if (resetAdminPinInput) resetAdminPinInput.required = false;
                        if (resetRecoveryCodeInput) resetRecoveryCodeInput.required = true;
                    }
                });
            });
        }

        // Formatear código de recuperación mientras se escribe
        if (resetRecoveryCodeInput) {
            resetRecoveryCodeInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
                if (value.length > 12) value = value.substring(0, 12);

                // Add dashes: XXXX-XXXX-XXXX
                if (value.length > 4) {
                    value = value.substring(0, 4) + '-' + value.substring(4);
                }
                if (value.length > 9) {
                    value = value.substring(0, 9) + '-' + value.substring(9);
                }

                e.target.value = value;
            });
        }

        // Manejar formulario de restablecimiento de contraseña
        // Usar setTimeout para asegurar que el DOM esté completamente listo
        setTimeout(() => {
            const forgotBtn = document.getElementById('forgot-password-btn');
            if (!forgotBtn) {
                console.error('Botón de recuperación de contraseña no encontrado');
                return;
            }

            // Asegurar que el botón no haga submit
            forgotBtn.type = 'button';

            const handleRecoverClick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                const loginForm = document.getElementById('login-form');
                const recoverForm = document.getElementById('recover-password-form');

                if (!loginForm || !recoverForm) {
                    console.error('Formularios no encontrados', { loginForm: !!loginForm, recoverForm: !!recoverForm });
                    alert('Error: No se encontraron los formularios. Por favor recarga la página.');
                    return false;
                }

                isRecoverMode = true;
                resetMethodVerified = false;

                // Ocultar formulario de login y su cabecera compartida
                const loginHeader = document.querySelector('.login-header');
                if (loginHeader) loginHeader.style.display = 'none';
                loginForm.style.display = 'none';

                // Mostrar formulario de recuperación
                recoverForm.style.display = 'flex';

                // Resetear campos
                const resetBusinessInput = document.getElementById('reset-business-name');
                const resetUserInput = document.getElementById('reset-username');
                const resetPinInput = document.getElementById('reset-admin-pin');
                const resetCodeInput = document.getElementById('reset-recovery-code');
                const methodPinRadio = document.getElementById('reset-method-pin');
                const methodCodeRadio = document.getElementById('reset-method-code');
                const newPwdGroup = document.getElementById('new-password-group');
                const errorDiv = document.getElementById('recover-error');
                const recoverBtnEl = document.getElementById('recover-btn');

                if (resetBusinessInput) {
                    resetBusinessInput.value = '';
                    resetBusinessInput.disabled = false;
                }
                if (resetUserInput) {
                    resetUserInput.value = '';
                    resetUserInput.disabled = false;
                }
                if (resetPinInput) {
                    resetPinInput.value = '';
                    resetPinInput.disabled = false;
                }
                if (resetCodeInput) {
                    resetCodeInput.value = '';
                    resetCodeInput.disabled = false;
                }
                if (methodPinRadio) methodPinRadio.disabled = false;
                if (methodCodeRadio) methodCodeRadio.disabled = false;
                if (newPwdGroup) {
                    newPwdGroup.style.display = 'none';
                    // Remover required cuando los campos están ocultos
                    const newPwdInput = document.getElementById('new-password');
                    const confirmPwdInput = document.getElementById('confirm-new-password');
                    if (newPwdInput) {
                        newPwdInput.required = false;
                    }
                    if (confirmPwdInput) {
                        confirmPwdInput.required = false;
                    }
                }
                if (errorDiv) {
                    errorDiv.style.display = 'none';
                    errorDiv.style.background = '#fee2e2';
                    errorDiv.style.borderColor = '#fecaca';
                    errorDiv.style.color = '#dc2626';
                }
                if (recoverBtnEl) {
                    recoverBtnEl.textContent = 'Verificar y Continuar';
                    recoverBtnEl.disabled = false;
                }

                // Actualizar estado visual de los radio buttons
                if (methodPinRadio && methodCodeRadio) {
                    methodPinRadio.checked = true;
                    const pinGroup = document.getElementById('reset-pin-group');
                    const codeGroup = document.getElementById('reset-code-group');
                    if (pinGroup) pinGroup.style.display = 'block';
                    if (codeGroup) codeGroup.style.display = 'none';
                    if (resetPinInput) resetPinInput.required = true;
                    if (resetCodeInput) resetCodeInput.required = false;
                }

                setTimeout(() => {
                    if (resetUserInput) resetUserInput.focus();
                }, 150);

                return false;
            };

            // Agregar listener de forma robusta
            forgotBtn.addEventListener('click', handleRecoverClick, false);
            forgotBtn.onclick = handleRecoverClick;
        }, 100);

        if (backToLoginBtn && form && recoverPasswordForm) {
            backToLoginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                isRecoverMode = false;
                resetMethodVerified = false;

                const loginHeader = document.querySelector('.login-header');
                if (loginHeader) loginHeader.style.display = 'flex';

                if (form) form.style.display = 'flex';
                if (recoverPasswordForm) recoverPasswordForm.style.display = 'none';
                if (newPasswordGroup) {
                    newPasswordGroup.style.display = 'none';
                    // Remover required cuando los campos están ocultos
                    if (newPasswordInput) {
                        newPasswordInput.required = false;
                    }
                    if (confirmNewPasswordInput) {
                        confirmNewPasswordInput.required = false;
                    }
                }

                if (resetUsernameInput) {
                    resetUsernameInput.disabled = false;
                    resetUsernameInput.value = '';
                }
                if (resetAdminPinInput) {
                    resetAdminPinInput.disabled = false;
                    resetAdminPinInput.value = '';
                }
                if (resetRecoveryCodeInput) {
                    resetRecoveryCodeInput.disabled = false;
                    resetRecoveryCodeInput.value = '';
                }
                if (resetMethodPin) resetMethodPin.disabled = false;
                if (resetMethodCode) resetMethodCode.disabled = false;

                if (newPasswordInput) newPasswordInput.value = '';
                if (confirmNewPasswordInput) confirmNewPasswordInput.value = '';
                if (recoverErrorDiv) {
                    recoverErrorDiv.style.display = 'none';
                    recoverErrorDiv.style.background = '#fee2e2';
                    recoverErrorDiv.style.borderColor = '#fecaca';
                    recoverErrorDiv.style.color = '#dc2626';
                }
                if (recoverBtn) recoverBtn.textContent = 'Verificar y Continuar';
                if (subtitle) subtitle.textContent = 'Inicia sesión o crea una cuenta';

                setTimeout(() => {
                    if (usernameInput) {
                        usernameInput.disabled = false;
                        usernameInput.focus();
                    }
                    const passIn = document.getElementById('login-password');
                    if (passIn) passIn.disabled = false;
                }, 250);
            });
        }

        // Manejar envío del formulario de restablecimiento
        if (recoverPasswordForm) {
            recoverPasswordForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                e.stopPropagation();

                // Verificar que todos los elementos estén disponibles
                if (!resetBusinessNameInput || !resetUsernameInput || !resetAdminPinInput || !resetRecoveryCodeInput ||
                    !recoverBtn || !recoverErrorDiv) {
                    console.error('❌ Elementos del DOM no encontrados');
                    alert('Error: No se encontraron todos los elementos del formulario. Por favor recarga la página.');
                    return;
                }

                const businessName = resetBusinessNameInput.value.trim();
                const username = resetUsernameInput.value.trim();
                const usePIN = resetMethodVal ? resetMethodVal.value === 'adminPIN' : true;
                const pin = resetAdminPinInput.value.trim();
                const code = resetRecoveryCodeInput.value.trim().replace(/-/g, '').toUpperCase();

                // Validar campos
                if (!businessName) {
                    recoverErrorDiv.textContent = 'Por favor ingresa el nombre del negocio';
                    recoverErrorDiv.style.display = 'block';
                    return;
                }

                if (!username) {
                    recoverErrorDiv.textContent = 'Por favor ingresa el nombre de usuario';
                    recoverErrorDiv.style.display = 'block';
                    return;
                }

                // Si aún no se ha verificado el método, verificarlo
                if (!resetMethodVerified) {
                    if (!username) {
                        recoverErrorDiv.textContent = 'Por favor ingresa el nombre de usuario';
                        recoverErrorDiv.style.display = 'block';
                        return;
                    }

                    if (usePIN && !pin) {
                        recoverErrorDiv.textContent = 'Por favor ingresa el PIN de administrador';
                        recoverErrorDiv.style.display = 'block';
                        return;
                    }

                    if (!usePIN && !code) {
                        recoverErrorDiv.textContent = 'Por favor ingresa el código de recuperación';
                        recoverErrorDiv.style.display = 'block';
                        return;
                    }

                    recoverBtn.disabled = true;
                    recoverBtn.textContent = 'Verificando...';
                    recoverErrorDiv.style.display = 'none';

                    try {
                        const user = await User.findByUsername(username, businessName);
                        if (!user) {
                            console.error('❌ Usuario no encontrado:', username);
                            recoverErrorDiv.style.background = '#fee2e2';
                            recoverErrorDiv.style.borderColor = '#fecaca';
                            recoverErrorDiv.style.color = '#dc2626';
                            recoverErrorDiv.textContent = '❌ Usuario no encontrado en este negocio';
                            recoverErrorDiv.style.display = 'block';
                            recoverBtn.disabled = false;
                            recoverBtn.textContent = 'Verificar y Continuar';
                            return;
                        }

                        let isValid = false;
                        let verificationError = null;

                        if (usePIN) {
                            // Verify global admin PIN (works for any user)
                            try {
                                const hasPIN = await User.hasAdminPIN(businessName);
                                if (!hasPIN) {
                                    console.error('❌ PIN de administrador no está configurado');
                                    recoverErrorDiv.style.background = '#fef3c7';
                                    recoverErrorDiv.style.borderColor = '#fcd34d';
                                    recoverErrorDiv.style.color = '#92400e';
                                    recoverErrorDiv.innerHTML = `
                                        <strong>⚠️ PIN de administrador no configurado</strong><br>
                                        Por favor configura el PIN desde: Configuración > Seguridad > PIN de Administrador.
                                    `;
                                    recoverErrorDiv.style.display = 'block';
                                    recoverBtn.disabled = false;
                                    const btnSpan = recoverBtn.querySelector('span');
                                    if (btnSpan) btnSpan.textContent = 'Verificar y Continuar';
                                    return;
                                }

                                isValid = await User.verifyAdminPIN(pin, businessName);
                            } catch (pinError) {
                                console.error('❌ Error al verificar PIN:', pinError);
                                verificationError = pinError;
                                isValid = false;
                            }
                        } else {
                            try {
                                isValid = await User.verifyRecoveryCode(user.id, code);
                            } catch (codeError) {
                                console.error('❌ Error al verificar código:', codeError);
                                verificationError = codeError;
                                isValid = false;
                            }
                        }

                        if (verificationError) {
                            throw verificationError;
                        }

                        if (!isValid) {
                            recoverErrorDiv.style.background = '#fee2e2';
                            recoverErrorDiv.style.borderColor = '#fecaca';
                            recoverErrorDiv.style.color = '#dc2626';
                            recoverErrorDiv.textContent = usePIN ? '❌ PIN de administrador incorrecto' : '❌ Código de recuperación incorrecto';
                            recoverErrorDiv.style.display = 'block';
                            recoverBtn.disabled = false;
                            recoverBtn.textContent = 'Verificar y Continuar';
                            return;
                        }

                        // Método verificado correctamente
                        resetMethodVerified = true;

                        // Mostrar campo de nueva contraseña
                        if (newPasswordGroup) {
                            newPasswordGroup.style.display = 'block';
                            if (newPasswordInput) newPasswordInput.required = true;
                            if (confirmNewPasswordInput) confirmNewPasswordInput.required = true;
                        }

                        // Deshabilitar campos de entrada ya validados
                        if (resetUsernameInput) resetUsernameInput.disabled = true;
                        if (resetAdminPinInput) resetAdminPinInput.disabled = true;
                        if (resetRecoveryCodeInput) resetRecoveryCodeInput.disabled = true;
                        if (resetMethodPin) resetMethodPin.disabled = true;
                        if (resetMethodCode) resetMethodCode.disabled = true;

                        if (recoverBtn) {
                            recoverBtn.textContent = 'Restablecer Contraseña';
                            recoverBtn.disabled = false;
                        }

                        if (recoverErrorDiv) {
                            recoverErrorDiv.style.background = '#dcfce7';
                            recoverErrorDiv.style.borderColor = '#86efac';
                            recoverErrorDiv.style.color = '#166534';
                            recoverErrorDiv.textContent = '✅ ' + (usePIN ? 'PIN verificado correctamente' : 'Código verificado correctamente') + '. Ingresa tu nueva contraseña.';
                            recoverErrorDiv.style.display = 'block';
                        }

                        setTimeout(() => {
                            if (newPasswordInput) newPasswordInput.focus();
                        }, 100);

                    } catch (error) {
                        console.error('❌ Error durante la verificación:', error);
                        if (recoverErrorDiv) {
                            recoverErrorDiv.style.background = '#fee2e2';
                            recoverErrorDiv.style.borderColor = '#fecaca';
                            recoverErrorDiv.style.color = '#dc2626';
                            recoverErrorDiv.textContent = 'Error: ' + error.message;
                            recoverErrorDiv.style.display = 'block';
                        }
                        if (recoverBtn) {
                            recoverBtn.disabled = false;
                            recoverBtn.textContent = 'Verificar y Continuar';
                        }
                    }

                    return;
                }

                // Si ya se verificó el método, cambiar la contraseña
                const newPassword = newPasswordInput.value;
                const confirmPassword = confirmNewPasswordInput.value;

                if (!newPassword || !confirmPassword) {
                    recoverErrorDiv.textContent = 'Por favor completa todos los campos';
                    recoverErrorDiv.style.display = 'block';
                    return;
                }

                if (newPassword !== confirmPassword) {
                    recoverErrorDiv.textContent = 'Las contraseñas no coinciden';
                    recoverErrorDiv.style.display = 'block';
                    return;
                }

                if (newPassword.length < 4) {
                    recoverErrorDiv.textContent = 'La contraseña debe tener al menos 4 caracteres';
                    recoverErrorDiv.style.display = 'block';
                    return;
                }

                recoverBtn.disabled = true;
                recoverBtn.textContent = 'Restableciendo contraseña...';
                recoverErrorDiv.style.display = 'none';

                try {
                    const user = await User.findByUsername(username, businessName);
                    if (!user) {
                        throw new Error('Usuario no encontrado');
                    }

                    const usePIN = resetMethodVal ? resetMethodVal.value === 'adminPIN' : true;
                    const pin = resetAdminPinInput.value.trim();
                    const code = resetRecoveryCodeInput.value.trim().replace(/-/g, '').toUpperCase();

                    let updatedUser;
                    if (usePIN) {
                        updatedUser = await User.resetPasswordWithPIN(username, pin, newPassword, businessName);
                    } else {
                        updatedUser = await User.resetPasswordWithCode(username, code, newPassword, businessName);
                    }

                    recoverErrorDiv.style.background = '#dcfce7';
                    recoverErrorDiv.style.borderColor = '#86efac';
                    recoverErrorDiv.style.color = '#166534';
                    recoverErrorDiv.textContent = '¡Contraseña restablecida exitosamente! Redirigiendo al inicio de sesión...';
                    recoverErrorDiv.style.display = 'block';

                    setTimeout(() => {
                        backToLoginBtn.click();
                        showNotification('Contraseña restablecida. Ahora puedes iniciar sesión con tu nueva contraseña', 'success');
                    }, 2000);

                } catch (error) {
                    recoverErrorDiv.style.background = '#fee2e2';
                    recoverErrorDiv.style.borderColor = '#fecaca';
                    recoverErrorDiv.style.color = '#dc2626';
                    recoverErrorDiv.textContent = 'Error: ' + error.message;
                    recoverErrorDiv.style.display = 'block';
                    recoverBtn.disabled = false;
                    recoverBtn.textContent = 'Restablecer Contraseña';
                }
            });
        }

        // Estilos para inputs de recuperación
        if (newPasswordInput) newPasswordInput.style.outline = 'none';
        if (confirmNewPasswordInput) confirmNewPasswordInput.style.outline = 'none';

        if (newPasswordInput) {
            newPasswordInput.addEventListener('focus', (e) => {
                e.target.style.borderColor = '#667eea';
            });
            newPasswordInput.addEventListener('blur', (e) => {
                e.target.style.borderColor = '#e5e7eb';
            });
        }

        if (confirmNewPasswordInput) {
            confirmNewPasswordInput.addEventListener('focus', (e) => {
                e.target.style.borderColor = '#667eea';
            });
            confirmNewPasswordInput.addEventListener('blur', (e) => {
                e.target.style.borderColor = '#e5e7eb';
            });
        }

        if (recoverBtn) {
            recoverBtn.addEventListener('mouseenter', (e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 10px 20px rgba(102, 126, 234, 0.4)';
            });
            recoverBtn.addEventListener('mouseleave', (e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = 'none';
            });
        }

        setTimeout(() => usernameInput.focus(), 100);
    }

    static showRecoverPassword() {
        try {
            const form = document.getElementById('login-form');
            const recoverPasswordForm = document.getElementById('recover-password-form');
            const subtitle = document.getElementById('login-subtitle');
                const newPasswordGroup = document.getElementById('new-password-group');
            const recoverErrorDiv = document.getElementById('recover-error');
            const recoverBtn = document.getElementById('recover-btn');

            if (!form || !recoverPasswordForm) {
                console.error('Elementos de recuperación no encontrados', {
                    form: !!form,
                    recoverPasswordForm: !!recoverPasswordForm
                });
                return false;
            }

            // Ocultar formulario de login
            form.style.display = 'none';

            // Mostrar formulario de recuperación
            recoverPasswordForm.style.display = 'flex';

            // Actualizar título
            if (subtitle) subtitle.textContent = 'Recuperar contraseña';

            // Resetear campos

            if (newPasswordGroup) newPasswordGroup.style.display = 'none';
            if (recoverErrorDiv) {
                recoverErrorDiv.style.display = 'none';
                recoverErrorDiv.style.background = '#fee2e2';
                recoverErrorDiv.style.borderColor = '#fecaca';
                recoverErrorDiv.style.color = '#dc2626';
            }

            if (recoverBtn) {
                recoverBtn.textContent = 'Buscar Usuario';
                recoverBtn.disabled = false;
            }

            // Resetear estado global
            window.isRecoverMode = true;
            window.foundUserForRecovery = null;

            // Enfocar input de teléfono
            setTimeout(() => {
                if (resetAdminPinInput) {
                    resetAdminPinInput.focus();
                    resetAdminPinInput.select();
                }
            }, 150);

            return false; // Prevenir cualquier acción por defecto
        } catch (error) {
            console.error('Error al mostrar recuperación de contraseña:', error);
            return false;
        }
    }

    static addLogoutButton() {
        const user = this.getCurrentUser();
        if (!user) return;

        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;

        const existingUserInfo = document.getElementById('user-info-section');
        if (existingUserInfo) return;

        const userInfoHTML = `
            <div id="user-info-section" style="padding: 1rem; border-top: 1px solid rgba(255,255,255,0.1); margin-top: auto;">
                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; padding: 0.75rem; background: rgba(255,255,255,0.1); border-radius: 0.5rem;">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 1.2rem;">
                        ${user.username.charAt(0).toUpperCase()}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 600; font-size: 0.9rem; color: white; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${user.username}</div>
                        <div style="font-size: 0.75rem; color: rgba(255,255,255,0.7);">${(typeof PermissionService !== 'undefined' && user.role) ? PermissionService.ROLE_LABELS[user.role] || user.role : 'Usuario activo'}</div>
                    </div>
                </div>
                <button onclick="AuthManager.logout()" class="btn btn-danger btn-sm" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                    <span>🚪</span>
                    <span>Cerrar Sesión</span>
                </button>
            </div>
        `;

        const networkStatus = sidebar.querySelector('#network-status')?.parentElement;
        if (networkStatus) {
            networkStatus.insertAdjacentHTML('beforebegin', userInfoHTML);
        }
    }
}
