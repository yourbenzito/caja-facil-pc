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

    /* ------------------------------------------------------------------ */
    /* SUPABASE AUTH & GOOGLE OAUTH 2.0 (FASE 1)                          */
    /* ------------------------------------------------------------------ */

    /**
     * Inicia sesión con Google OAuth mediante Supabase.
     */
    static async loginWithGoogle() {
        const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
        if (!client) {
            throw new Error('El cliente de Supabase no está disponible.');
        }

        const redirectUrl = (typeof window !== 'undefined' && window.location.protocol.startsWith('http'))
            ? window.location.origin 
            : 'http://localhost:3000';

        // 1. En Electron, abrir en ventana emergente rápida (Popup) sin recargar la app principal
        if (window.api && typeof window.api.openOAuthPopup === 'function') {
            const { data, error } = await client.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                    skipBrowserRedirect: true,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'select_account'
                    }
                }
            });

            if (error) throw error;
            if (!data || !data.url) throw new Error('No se pudo generar la URL de autenticación con Google');

            const res = await window.api.openOAuthPopup(data.url);
            if (!res || !res.success) {
                const isCancel = res?.cancelled || (res?.error && (
                    res.error.includes('cerrada') || 
                    res.error.includes('cancelada') || 
                    res.error.includes('ERR_ABORTED') || 
                    res.error.includes('ERR_FAILED')
                ));
                if (isCancel) {
                    return null; // El usuario cerró la ventana voluntariamente
                }
                throw new Error(res?.error || 'Autenticación con Google no completada');
            }

            const callbackUrl = res.callbackUrl || '';

            // ponytail: Si la redirección contiene error explícito de Supabase o Google
            if (callbackUrl.includes('error=')) {
                const queryOrHash = callbackUrl.includes('?') ? callbackUrl.split('?')[1] : (callbackUrl.includes('#') ? callbackUrl.split('#')[1] : '');
                const errParams = new URLSearchParams(queryOrHash);
                const errorDesc = errParams.get('error_description') || errParams.get('error') || 'Error en autenticación con Google';
                throw new Error(decodeURIComponent(errorDesc.replace(/\+/g, ' ')));
            }

            const hash = callbackUrl.includes('#') ? callbackUrl.substring(callbackUrl.indexOf('#') + 1) : '';
            const params = new URLSearchParams(hash);
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');

            if (accessToken) {
                await client.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken || ''
                });
            } else if (callbackUrl.includes('code=')) {
                const query = callbackUrl.includes('?') ? callbackUrl.substring(callbackUrl.indexOf('?') + 1) : '';
                const qParams = new URLSearchParams(query);
                const code = qParams.get('code');
                if (code) {
                    await client.auth.exchangeCodeForSession(code);
                }
            }

            await this.checkOAuthCallback();
            return { success: true };
        }

        // 2. Fallback para navegador web tradicional
        const { data, error } = await client.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'select_account'
                }
            }
        });

        if (error) throw error;
        return data;
    }

    /**
     * Verifica si se acaba de recibir una sesión de Supabase Auth (ej: al volver de Google OAuth)
     */
    static async checkOAuthCallback() {
        const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
        if (!client) return false;

        try {
            const { data: { session }, error } = await client.auth.getSession();
            if (session && session.user) {
                const user = session.user;
                const email = (user.email || '').toLowerCase();
                const name = user.user_metadata?.full_name || user.user_metadata?.name || email.split('@')[0];

                // Sincronizar licencia oficial desde tabla user_licenses de Supabase e iniciar escucha en vivo
                if (typeof LicenseService !== 'undefined') {
                    await LicenseService.syncUserLicenseFromCloud(user.id, email);
                    LicenseService.updateHeaderBadge();
                    LicenseService.startRealtimeSubscription(user.id, email);
                }
                const licData = typeof LicenseService !== 'undefined' ? LicenseService.getData() : null;
                const isMasterOwner = Boolean(user.user_metadata?.is_owner || user.app_metadata?.is_owner || licData?.isOwner);
                const resolvedRole = isMasterOwner ? 'owner' : (user.user_metadata?.role || user.app_metadata?.role || 'owner');
                const resolvedPlan = (licData && licData.plan) || (isMasterOwner ? 'FULL_PRO' : (user.user_metadata?.plan || (typeof LicenseService !== 'undefined' && LicenseService.isPro() ? 'PC_PRO' : 'FREE')));

                const localSession = {
                    id: user.id,
                    username: name,
                    email: email,
                    role: resolvedRole,
                    business_id: 1,
                    plan: resolvedPlan,
                    loginTime: new Date().toISOString()
                };

                localStorage.setItem(this.SESSION_KEY, JSON.stringify(localSession));
                sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(localSession));
                localStorage.setItem('REMEMBER_LOGIN', 'true');
                localStorage.setItem('PMV_USER_ID', user.id);
                localStorage.setItem('SUPABASE_USER_ID', user.id);
                localStorage.setItem('SUPABASE_ACCESS_TOKEN', session.access_token || '');

                // Limpiar hash de la URL sin recargar
                if (window.location.hash && window.location.hash.includes('access_token')) {
                    window.history.replaceState(null, document.title, window.location.pathname);
                }

                // Enrutamiento inteligente multi-sucursal
                await this.handleOwnerBusinessRouting(user, session.access_token);
                return true;
            }
        } catch (e) {
            console.warn('⚠️ Error al verificar sesión de Supabase:', e.message);
        }
        return false;
    }

    /**
     * Inicia sesión con correo y contraseña en Supabase Auth.
     */
    static async loginWithSupabaseEmail(email, password) {
        const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
        if (!client) {
            throw new Error('El cliente de Supabase no está disponible.');
        }

        const { data, error } = await client.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password: password
        });

        if (error) throw error;
        
        // Sincronizar usuario en sesión local con rol y plan legítimos
        const user = data.user;
        const userEmail = (user.email || email || '').toLowerCase();

        if (typeof LicenseService !== 'undefined') {
            await LicenseService.syncUserLicenseFromCloud(user.id, userEmail);
            LicenseService.updateHeaderBadge();
            LicenseService.startRealtimeSubscription(user.id, userEmail);
        }
        const licData = typeof LicenseService !== 'undefined' ? LicenseService.getData() : null;
        const isMasterOwner = Boolean(user.user_metadata?.is_owner || user.app_metadata?.is_owner || licData?.isOwner);
        const resolvedRole = isMasterOwner ? 'owner' : (user.user_metadata?.role || user.app_metadata?.role || 'owner');
        const resolvedPlan = (licData && licData.plan) || (isMasterOwner ? 'FULL_PRO' : (user.user_metadata?.plan || (typeof LicenseService !== 'undefined' && LicenseService.isPro() ? 'PC_PRO' : 'FREE')));
        const session = {
            id: user.id,
            username: user.user_metadata?.full_name || user.email.split('@')[0],
            email: user.email,
            role: resolvedRole,
            business_id: 1,
            plan: resolvedPlan,
            loginTime: new Date().toISOString()
        };

        localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
        localStorage.setItem('SUPABASE_ACCESS_TOKEN', data.session?.access_token || '');
        localStorage.setItem('PMV_USER_ID', user.id);
        localStorage.setItem('SUPABASE_USER_ID', user.id);

        // Enrutamiento inteligente multi-sucursal
        await this.handleOwnerBusinessRouting(user, data.session?.access_token);
        return session;
    }

    /**
     * Consulta y gestiona los negocios disponibles para el usuario dueño autenticado
     */
    static async handleOwnerBusinessRouting(user, sessionAccessToken = '') {
        const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
        let businesses = [];

        // 1. Consultar sucursales activas en Supabase Cloud
        if (client && user && user.id) {
            try {
                const { data, error } = await client
                    .from('businesses')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('is_active', true)
                    .order('created_at', { ascending: true });

                if (!error && Array.isArray(data) && data.length > 0) {
                    businesses = data;
                }
            } catch (e) {
                console.warn('[AuthManager] Error consultando sucursales en Supabase:', e.message);
            }
        }

        // 2. Si la nube no respondió o devolvió vacío, consultar al backend local
        if (businesses.length === 0) {
            try {
                const apiBase = (typeof window !== 'undefined' && window.API_CONFIG && window.API_CONFIG.API_URL) 
                    ? window.API_CONFIG.API_URL.replace(/\/api$/, '') 
                    : 'http://localhost:3000';
                const res = await fetch(`${apiBase}/api/businesses/list`, {
                    headers: { 'x-supabase-user-id': user.id }
                });
                const d = await res.json();
                if (d && d.businesses) {
                    businesses = d.businesses.map(b => ({
                        local_id: String(b.id),
                        name: b.name,
                        accessCode: b.accessCode || b.access_code || ''
                    }));
                }
            } catch (_) {}
        }

        console.log(`[AuthManager] Negocios detectados para el usuario: ${businesses.length}`);

        // 0. Verificación Anti-Fraude: Empleados Inhabilitados por el Dueño
        if (client && user && user.id) {
            try {
                const userEmail = (user.email || '').toLowerCase().trim();
                let memberQuery = client.from('business_members').select('id, business_id, status, role');
                if (userEmail) {
                    memberQuery = memberQuery.or(`user_id.eq.${user.id},email.ilike.${userEmail}`);
                } else {
                    memberQuery = memberQuery.eq('user_id', user.id);
                }
                const { data: memberData } = await memberQuery.maybeSingle();

                if (memberData && memberData.status === 'disabled') {
                    console.warn('[AuthManager] ⛔ Empleado inhabilitado intentó acceder:', userEmail);
                    this.showDisabledAccountModal();
                    return false;
                }
            } catch (e) {
                console.warn('[AuthManager] Verificación de membresía:', e.message);
            }
        }

        // Regla A: Si el usuario no tiene ningún negocio registrado aún en la nube
        if (businesses.length === 0) {
            // Verificar si hay datos locales del modo offline listos para ser respaldados/vinculados
            try {
                const apiBase = (typeof window !== 'undefined' && window.API_CONFIG && window.API_CONFIG.API_URL) 
                    ? window.API_CONFIG.API_URL.replace(/\/api$/, '') 
                    : 'http://localhost:3000';
                const localDataRes = await fetch(`${apiBase}/api/businesses/check-local-data`);
                const localData = await localDataRes.json();
                if (localData && localData.hasData) {
                    const loginScreen = document.getElementById('login-screen');
                    if (loginScreen) loginScreen.remove();
                    this.showLinkLocalBusinessModal(user, localData);
                    return false;
                }
            } catch (err) {
                console.warn('[AuthManager] Error consultando datos locales para migración:', err);
            }

            const loginScreen = document.getElementById('login-screen');
            if (loginScreen) loginScreen.remove();
            this.showOnboardingModal(user);
            return false;
        }

        // Regla B: Si el usuario tiene exactamente 1 negocio registrado -> DIRECTO AL POS sin preguntas
        if (businesses.length === 1) {
            const onlyBiz = businesses[0];
            const targetId = onlyBiz.local_id || onlyBiz.id;
            const targetName = onlyBiz.name || 'Mi Negocio';
            const accessCode = onlyBiz.accessCode || onlyBiz.business_code || '';
            console.log(`[AuthManager] Usuario con 1 solo negocio ("${targetName}"). Ingresando directamente al mostrador POS...`);

            const loginScreen = document.getElementById('login-screen');
            if (loginScreen) loginScreen.remove();

            await this.selectBusinessAndProceed(targetId, targetName, user, accessCode);
            return true;
        }

        // Regla C: Si el cliente tiene 2 o más negocios (sucursales) -> Preguntar a cuál desea acceder
        console.log(`[AuthManager] Usuario con múltiples negocios (${businesses.length}). Mostrando selector de sucursal...`);
        const loginScreen = document.getElementById('login-screen');
        if (loginScreen) loginScreen.remove();
        this.showBusinessSelectorModal(businesses, user);
        return false;
    }

    /**
     * Selecciona una sucursal, obtiene el token del backend y sincroniza
     */
    static async selectBusinessAndProceed(businessId, businessName, user = null, accessCode = '') {
        // 1. Quitar pantalla de login definitivamente de la interfaz
        const loginScreen = document.getElementById('login-screen');
        if (loginScreen) loginScreen.remove();

        // 2. Cerrar modal selector si está presente
        const modal = document.getElementById('business-selector-modal');
        if (modal) modal.remove();

        if (!user) user = this.getCurrentUser();
        const email = user?.email || (user?.username ? `${user.username}@cajafacil.local` : '');
        const userId = user?.id || localStorage.getItem('PMV_USER_ID') || localStorage.getItem('SUPABASE_USER_ID');

        localStorage.setItem('BUSINESS_ID', String(businessId));
        localStorage.setItem('CURRENT_BUSINESS', businessName);
        localStorage.setItem('PMV_BIZ', businessName);

        if (accessCode) {
            localStorage.setItem('BUSINESS_ACCESS_CODE', accessCode);
        } else {
            // Intentar recuperar el código desde el backend si no vino por parámetro
            try {
                const apiBase = (typeof window !== 'undefined' && window.API_CONFIG && window.API_CONFIG.API_URL) 
                    ? window.API_CONFIG.API_URL.replace(/\/api$/, '') 
                    : 'http://localhost:3000';
                fetch(`${apiBase}/api/businesses/list`, { headers: { 'x-supabase-user-id': userId } })
                    .then(r => r.json())
                    .then(d => {
                        const match = d?.businesses?.find(b => String(b.id) === String(businessId));
                        if (match && match.accessCode) {
                            localStorage.setItem('BUSINESS_ACCESS_CODE', match.accessCode);
                        }
                    }).catch(() => {});
            } catch (_) {}
        }

        // Actualizar sesión en memoria y storage
        const sessionStr = localStorage.getItem(this.SESSION_KEY) || sessionStorage.getItem(this.SESSION_KEY);
        if (sessionStr) {
            try {
                const s = JSON.parse(sessionStr);
                s.business_id = Number(businessId);
                localStorage.setItem(this.SESSION_KEY, JSON.stringify(s));
                sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(s));
            } catch (_) {}
        }

        // Obtener JWT del backend vinculado a la sucursal seleccionada
        const apiBase = (typeof window !== 'undefined' && window.API_CONFIG && window.API_CONFIG.API_URL) 
            ? window.API_CONFIG.API_URL.replace(/\/api$/, '') 
            : 'http://localhost:3000';

        try {
            // Refrescar token activo de Supabase desde la sesión viva si está disponible
            const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
            let sbToken = localStorage.getItem('SUPABASE_ACCESS_TOKEN') || sessionStorage.getItem('SUPABASE_ACCESS_TOKEN');
            if (client) {
                try {
                    const { data: sessionData } = await client.auth.getSession();
                    if (sessionData?.session?.access_token) {
                        sbToken = sessionData.session.access_token;
                        localStorage.setItem('SUPABASE_ACCESS_TOKEN', sbToken);
                        sessionStorage.setItem('SUPABASE_ACCESS_TOKEN', sbToken);
                    }
                } catch (_) {}
            }

            const localToken = localStorage.getItem('AUTH_TOKEN') || sessionStorage.getItem('AUTH_TOKEN');
            const headers = { 'Content-Type': 'application/json' };
            if (sbToken) headers['Authorization'] = `Bearer ${sbToken}`;
            if (localToken) headers['x-pos-token'] = localToken;

            const syncRes = await fetch(`${apiBase}/api/auth/supabase-session`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ 
                    email, 
                    userId, 
                    businessName, 
                    businessId: Number(businessId),
                    accessToken: sbToken 
                })
            });
            const syncData = await syncRes.json();
            if (syncData && syncData.token) {
                localStorage.setItem('AUTH_TOKEN', syncData.token);
                sessionStorage.setItem('AUTH_TOKEN', syncData.token);
                console.log(`✅ Sesión backend actualizada para sucursal: "${businessName}" (ID: ${businessId})`);
            }
        } catch (e) {
            console.warn('⚠️ Error renovando token para la sucursal:', e.message);
        }

        // Actualizar badge visual en la interfaz
        this.updateBusinessBadgeUI(businessName);

        // Blindaje Anti-Ventas Cruzadas: Limpiar carrito y cliente seleccionado del POS
        try {
            if (typeof posController !== 'undefined') {
                if (Array.isArray(posController.cart)) {
                    posController.cart = [];
                }
                posController.currentCustomer = null;
                posController.discountAmount = 0;
                posController.creditBalanceToUse = 0;
                posController.currentCashRegister = null;
            }
            if (typeof POSView !== 'undefined' && typeof POSView.updateCartUI === 'function') {
                POSView.updateCartUI();
            }
        } catch (posErr) {
            console.warn('⚠️ [AuthManager] Aviso limpiando carrito al alternar sucursal:', posErr.message);
        }

        // Purgar inmediatamente toda la memoria caché local para que las vistas carguen datos puros de la sucursal seleccionada (0 ms)
        if (typeof db !== 'undefined' && typeof db.clearCache === 'function') {
            db.clearCache();
        }

        // Resetear filtros de vistas activas para no arrastrar categorías o estados del negocio anterior
        if (typeof ProductsView !== 'undefined') {
            ProductsView.selectedCategory = null;
            ProductsView.productSuppliers = {};
            ProductsView.currentPage = 1;
        }

        // Iniciar canal en tiempo real y sincronizar datos de la sucursal
        if (typeof SyncService !== 'undefined') {
            SyncService.initRealtime();
            SyncService.syncAll();
        }

        // Revelar aplicación y pasar directamente al POS
        const splash = document.getElementById('splash-screen');
        const appEl = document.getElementById('app');
        if (splash) splash.style.display = 'none';
        if (appEl) {
            appEl.style.display = 'flex';
            appEl.style.opacity = '1';
        }

        if (typeof app !== 'undefined' && typeof app.navigate === 'function') {
            await app.navigate('pos');
        }
    }

    /**
     * Alternar de sucursal en caliente desde la barra superior
     */
    static async switchBusiness(businessId, businessName) {
        await this.selectBusinessAndProceed(businessId, businessName);
    }

    /**
     * Obtiene la lista de sucursales en caché (0 ms de espera)
     */
    static getCachedBusinesses() {
        try {
            const raw = localStorage.getItem('CACHED_BUSINESSES');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (_) {}
        const currentName = localStorage.getItem('CURRENT_BUSINESS') || 'Negocio Principal';
        const currentId = localStorage.getItem('BUSINESS_ID') || '1';
        return [{ id: Number(currentId), local_id: String(currentId), name: currentName }];
    }

    /**
     * Guarda la lista de sucursales en caché local
     */
    static setCachedBusinesses(list) {
        try {
            if (Array.isArray(list)) {
                localStorage.setItem('CACHED_BUSINESSES', JSON.stringify(list));
            }
        } catch (_) {}
    }

    /**
     * Menú desplegable rápido (Dropdown 0 ms) al hacer clic en el botón de sucursal
     */
    static async toggleBusinessDropdown(anchorEl, event) {
        if (event) event.stopPropagation();

        const user = this.getCurrentUser();
        const isEmployee = user && (user.role === 'employee' || user.role === 'cashier');
        const isPro = (typeof LicenseService !== 'undefined' && LicenseService.isPro()) 
            || ['pro', 'full_pro', 'pc_pro'].includes(String(user?.plan || '').toLowerCase());
        if (isEmployee) {
            if (typeof showNotification === 'function') {
                showNotification('🔒 Tu cuenta de empleado está asignada exclusivamente a este negocio.', 'info');
            }
            return;
        }

        const existing = document.getElementById('business-quick-dropdown');
        if (existing) {
            existing.remove();
            return;
        }

        const currentBizId = String(localStorage.getItem('BUSINESS_ID') || '1');
        const businesses = this.getCachedBusinesses();

        // Calcular posición del botón para anclar el dropdown
        const rect = anchorEl ? anchorEl.getBoundingClientRect() : { bottom: 60, left: 20, right: 340 };
        const topPos = Math.min(window.innerHeight - 380, rect.bottom + 6);
        const leftPos = Math.max(10, Math.min(window.innerWidth - 340, rect.left));

        const renderBranchItems = (list) => {
            return list.map(b => {
                const targetId = String(b.local_id || b.id);
                const isSelected = targetId === currentBizId;
                const safeName = (b.name || 'Mi Negocio').replace(/'/g, "\\'");
                const code = b.business_code || b.accessCode || b.access_code || '';
                return `
                    <div class="branch-quick-item" onclick="AuthManager.selectBusinessAndProceed('${targetId}', '${safeName}'); const d = document.getElementById('business-quick-dropdown'); if(d) d.remove();" 
                         style="display: flex; align-items: center; justify-content: space-between; padding: 0.65rem 0.85rem; border-radius: 0.75rem; cursor: pointer; transition: all 0.15s ease; background: ${isSelected ? 'rgba(79, 70, 229, 0.08)' : 'transparent'}; border: 1.5px solid ${isSelected ? '#6366f1' : 'transparent'}; margin-bottom: 0.35rem;">
                        <div style="display: flex; align-items: center; gap: 0.55rem; min-width: 0;">
                            <span style="font-size: 1.15rem; flex-shrink: 0;">🏪</span>
                            <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                <div style="font-weight: 800; font-size: 0.88rem; color: var(--text-main, #0f172a); overflow: hidden; text-overflow: ellipsis;">${b.name}</div>
                                <div style="display: flex; align-items: center; gap: 0.4rem; margin-top: 0.15rem; flex-wrap: wrap;">
                                    <span style="font-size: 0.72rem; color: var(--secondary, #64748b);">Sucursal #${targetId}</span>
                                    ${code ? `<span style="background: rgba(79, 70, 229, 0.1); color: #4338ca; border: 1px solid #c7d2fe; font-size: 0.68rem; font-weight: 850; padding: 0.1rem 0.35rem; border-radius: 6px; font-family: monospace;">🔑 ${code}</span>` : ''}
                                </div>
                            </div>
                        </div>
                        ${isSelected 
                            ? '<span style="background: #4f46e5; color: #ffffff; font-size: 0.68rem; font-weight: 900; padding: 0.2rem 0.55rem; border-radius: 9999px; flex-shrink: 0; box-shadow: 0 2px 6px rgba(79, 70, 229, 0.3);">ACTIVA</span>' 
                            : '<span style="color: #6366f1; font-weight: 800; font-size: 0.78rem; flex-shrink: 0;">Entrar →</span>'}
                    </div>
                `;
            }).join('');
        };

        const dropdownHtml = `
            <div id="business-quick-dropdown" style="position: fixed; top: ${topPos}px; left: ${leftPos}px; width: 330px; max-width: 90vw; background: var(--surface, #ffffff); border: 1.5px solid var(--border, #cbd5e1); border-radius: 1.15rem; box-shadow: 0 20px 45px -10px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0,0,0,0.05); z-index: 99999; font-family: 'Outfit', sans-serif; overflow: hidden; animation: popDropdown 0.18s cubic-bezier(0.16, 1, 0.3, 1);">
                <!-- Cabecera del Dropdown -->
                <div style="padding: 0.75rem 0.95rem; border-bottom: 1px solid var(--border, #e2e8f0); display: flex; align-items: center; justify-content: space-between; background: rgba(79, 70, 229, 0.04);">
                    <div style="display: flex; align-items: center; gap: 0.45rem;">
                        <span style="font-size: 0.95rem;">🏢</span>
                        <span style="font-size: 0.8rem; font-weight: 900; color: var(--text-main, #0f172a); text-transform: uppercase; letter-spacing: 0.5px;">Tus Sucursales</span>
                    </div>
                    <button type="button" onclick="const d = document.getElementById('business-quick-dropdown'); if(d) d.remove();" style="background: transparent; border: none; font-size: 1rem; color: #94a3b8; cursor: pointer; padding: 0.1rem 0.3rem;">✕</button>
                </div>

                <!-- Lista de Sucursales -->
                <div id="branch-quick-list" style="padding: 0.6rem; max-height: 220px; overflow-y: auto;">
                    ${renderBranchItems(businesses)}
                </div>

                <!-- Sección para Crear Sucursal Rápida (Exclusivo Plan Pro) -->
                ${isPro ? `
                <div style="padding: 0.6rem 0.75rem; border-top: 1px solid var(--border, #e2e8f0); background: var(--background, #f8fafc);">
                    <div id="quick-create-branch-box" style="display: none; margin-bottom: 0.5rem;">
                        <input type="text" id="quick-branch-name-input" placeholder="Nombre nueva sucursal..." 
                               style="width: 100%; height: 36px; border: 1.5px solid #6366f1; border-radius: 0.6rem; padding: 0 0.65rem; font-size: 0.85rem; font-weight: 700; box-sizing: border-box; margin-bottom: 0.4rem; background: #fff;">
                        <div style="display: flex; gap: 0.35rem;">
                            <button type="button" id="quick-confirm-create-branch-btn" style="flex: 1; height: 32px; font-size: 0.78rem; font-weight: 800; background: #4f46e5; color: #fff; border: none; border-radius: 0.5rem; cursor: pointer;">Crear e Ingresar</button>
                            <button type="button" onclick="document.getElementById('quick-create-branch-box').style.display='none'; document.getElementById('quick-show-create-btn').style.display='flex';" style="height: 32px; padding: 0 0.5rem; font-size: 0.78rem; font-weight: 700; background: transparent; border: 1px solid #cbd5e1; border-radius: 0.5rem; cursor: pointer;">Cancelar</button>
                        </div>
                    </div>

                    <button type="button" id="quick-show-create-btn" onclick="document.getElementById('quick-create-branch-box').style.display='block'; this.style.display='none'; document.getElementById('quick-branch-name-input').focus();" 
                            style="width: 100%; height: 34px; background: rgba(79, 70, 229, 0.08); border: 1.5px dashed #6366f1; color: #4338ca; border-radius: 0.65rem; font-size: 0.8rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.35rem; transition: all 0.2s;">
                        ➕ Nueva Sucursal
                    </button>
                </div>
                ` : `
                <div style="padding: 0.65rem 0.85rem; border-top: 1px solid var(--border, #e2e8f0); background: var(--background, #f8fafc); text-align: center;">
                    <div style="font-size: 0.75rem; font-weight: 750; color: #64748b; margin-bottom: 0.15rem;">
                        🌱 Plan Gratuito • 1 Negocio Local
                    </div>
                    <div style="font-size: 0.7rem; color: #4f46e5; font-weight: 800;">
                        ⭐ Multi-sucursal disponible en Plan Pro
                    </div>
                </div>
                `}
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', dropdownHtml);

        // Handler para el botón de confirmar creación
        const confirmBtn = document.getElementById('quick-confirm-create-branch-btn');
        const quickInput = document.getElementById('quick-branch-name-input');
        if (confirmBtn) {
            confirmBtn.onclick = async () => {
                const input = document.getElementById('quick-branch-name-input');
                const name = input ? input.value.trim() : '';
                if (!name) {
                    alert('Por favor escribe un nombre para la sucursal');
                    return;
                }
                const apiBase = (typeof window !== 'undefined' && window.API_CONFIG && window.API_CONFIG.API_URL) 
                    ? window.API_CONFIG.API_URL.replace(/\/api$/, '') 
                    : 'http://localhost:3000';
                const user = this.getCurrentUser();
                const userId = user?.id || localStorage.getItem('PMV_USER_ID');
                try {
                    const res = await fetch(`${apiBase}/api/businesses/create`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-supabase-user-id': userId },
                        body: JSON.stringify({ name, userId })
                    });
                    const data = await res.json();
                    if (data && data.success && data.business) {
                        const updated = this.getCachedBusinesses();
                        updated.push({ id: data.business.id, local_id: String(data.business.id), name: data.business.name });
                        this.setCachedBusinesses(updated);
                        const d = document.getElementById('business-quick-dropdown');
                        if (d) d.remove();
                        await this.selectBusinessAndProceed(data.business.id, data.business.name, user);
                    } else {
                        alert('Error al crear sucursal: ' + (data?.error || 'Intente nuevamente'));
                    }
                } catch (e) {
                    alert('Error al crear sucursal: ' + e.message);
                }
            };
        }

        // ponytail: Permitir presionar Enter para crear e ingresar la sucursal de inmediato (Tarea 1)
        if (quickInput && confirmBtn) {
            quickInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    confirmBtn.click();
                }
            });
        }

        // Actualizar en segundo plano si hay nuevas sucursales
        try {
            const apiBase = (typeof window !== 'undefined' && window.API_CONFIG && window.API_CONFIG.API_URL) 
                ? window.API_CONFIG.API_URL.replace(/\/api$/, '') 
                : 'http://localhost:3000';
            const user = this.getCurrentUser();
            const userId = user?.id || localStorage.getItem('PMV_USER_ID');
            const res = await fetch(`${apiBase}/api/businesses/list`, {
                headers: { 'x-supabase-user-id': userId }
            });
            const d = await res.json();
            if (d && Array.isArray(d.businesses)) {
                const freshList = d.businesses.map(b => ({ id: b.id, local_id: String(b.id), name: b.name }));
                this.setCachedBusinesses(freshList);
                const listContainer = document.getElementById('branch-quick-list');
                if (listContainer) {
                    listContainer.innerHTML = renderBranchItems(freshList);
                }
            }
        } catch (_) {}

        // Cerrar dropdown al hacer clic fuera o con Escape (Tarea 2)
        const cleanupDropdown = () => {
            const dropdown = document.getElementById('business-quick-dropdown');
            if (dropdown) dropdown.remove();
            document.removeEventListener('click', outsideClickListener);
            document.removeEventListener('keydown', escListener);
        };

        const outsideClickListener = (e) => {
            const dropdown = document.getElementById('business-quick-dropdown');
            if (dropdown && !dropdown.contains(e.target) && anchorEl && !anchorEl.contains(e.target)) {
                cleanupDropdown();
            }
        };

        const escListener = (e) => {
            if (e.key === 'Escape') {
                cleanupDropdown();
            }
        };

        setTimeout(() => {
            document.addEventListener('click', outsideClickListener);
            document.addEventListener('keydown', escListener);
        }, 50);
    }

    /**
     * Modal de Cuenta de Empleado Deshabilitada (Anti-Fraude)
     */
    static showDisabledAccountModal() {
        const existing = document.getElementById('disabled-account-modal');
        if (existing) existing.remove();

        const modalHtml = `
        <div id="disabled-account-modal" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: center; z-index: 25000; font-family: 'Outfit', sans-serif; padding: 1rem;">
            <div style="background: #ffffff; border-radius: 1.5rem; max-width: 440px; width: 100%; padding: 2rem; box-shadow: 0 25px 50px -12px rgba(239, 68, 68, 0.35); border: 2px solid #fecaca; text-align: center;">
                <div style="width: 64px; height: 64px; margin: 0 auto 1rem; border-radius: 1.25rem; background: #fee2e2; border: 2px solid #ef4444; display: flex; align-items: center; justify-content: center; font-size: 2.25rem;">
                    ⛔
                </div>
                <h2 style="font-size: 1.35rem; font-weight: 850; color: #991b1b; margin: 0 0 0.5rem 0;">Acceso Inhabilitado</h2>
                <p style="font-size: 0.9rem; color: #475569; line-height: 1.5; margin: 0 0 1.5rem 0;">
                    Tu cuenta de empleado ha sido inhabilitada por el administrador del negocio. Comunícate con el dueño para reactivar tu acceso.
                </p>
                <button type="button" onclick="AuthManager.logout()" style="width: 100%; height: 44px; background: #ef4444; color: #ffffff; border: none; border-radius: 0.75rem; font-size: 0.95rem; font-weight: 850; cursor: pointer; box-shadow: 0 4px 14px rgba(239, 68, 68, 0.35);">
                    🚪 Cerrar Sesión
                </button>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    /**
     * Modal de Migración: De Free (Offline) a Pro (Nube)
     * Pregunta al usuario si desea vincular su negocio local existente o comenzar uno nuevo
     */
    static showLinkLocalBusinessModal(user, localData) {
        const modalId = 'modal-link-local-business';
        const existing = document.getElementById(modalId);
        if (existing) existing.remove();

        const biz = localData.business || {};
        const pCount = localData.productCount || 0;
        const cCount = localData.customerCount || 0;
        const sCount = localData.saleCount || 0;

        const modalHtml = `
        <div id="${modalId}" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; z-index: 22000; font-family: 'Outfit', sans-serif; padding: 1rem; animation: fadeIn 0.2s ease-out;">
            <div style="background: #ffffff; border-radius: 1.5rem; max-width: 500px; width: 100%; padding: 2rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.35); border: 2px solid #e0e7ff; text-align: center;">
                
                <div style="width: 64px; height: 64px; margin: 0 auto 1rem; border-radius: 50%; background: #e0e7ff; color: #4338ca; display: flex; align-items: center; justify-content: center; font-size: 2.2rem; box-shadow: 0 4px 14px rgba(67, 56, 202, 0.18);">
                    ☁️
                </div>

                <h2 style="font-size: 1.4rem; font-weight: 850; color: #0f172a; margin: 0 0 0.4rem 0;">¡Bienvenido a Caja Fácil Pro!</h2>
                <p style="font-size: 0.88rem; color: #64748b; line-height: 1.4; margin: 0 0 1.25rem 0;">
                    Detectamos que ya tienes un negocio local con datos en esta computadora:
                </p>

                <!-- Tarjeta informativa del negocio local -->
                <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 1rem; padding: 1rem 1.25rem; margin-bottom: 1.25rem; text-align: left;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <span style="font-weight: 850; font-size: 1.05rem; color: #1e293b;">${biz.name || 'Mi Negocio'}</span>
                        <span style="background: #ecfdf5; color: #047857; font-size: 0.72rem; font-weight: 800; padding: 0.2rem 0.6rem; border-radius: 9999px; border: 1px solid #a7f3d0;">
                            ${biz.accessCode || 'CF-LOCAL-01'}
                        </span>
                    </div>
                    <div style="display: flex; gap: 0.85rem; font-size: 0.8rem; color: #475569; font-weight: 700;">
                        <span>📦 ${pCount} Productos</span>
                        <span>👥 ${cCount} Clientes</span>
                        <span>🧾 ${sCount} Ventas</span>
                    </div>
                </div>

                <p style="font-size: 0.9rem; font-weight: 800; color: #334155; margin-bottom: 1.25rem;">
                    ¿Deseas respaldar y vincular este negocio a tu cuenta Pro en la nube?
                </p>

                <div style="display: flex; flex-direction: column; gap: 0.65rem;">
                    <button type="button" id="btn-confirm-link-local" style="width: 100%; height: 46px; background: linear-gradient(135deg, #4f46e5, #4338ca); color: #ffffff; border: none; border-radius: 0.85rem; font-size: 0.95rem; font-weight: 850; cursor: pointer; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35); display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                        ☁️ Respaldar y Vincular a mi Cuenta Pro
                    </button>

                    <button type="button" id="btn-skip-link-local" style="width: 100%; height: 40px; background: transparent; border: 1.5px solid #cbd5e1; color: #475569; border-radius: 0.85rem; font-size: 0.88rem; font-weight: 750; cursor: pointer;">
                        ✨ Comenzar un Negocio Nuevo desde Cero
                    </button>
                </div>
            </div>
        </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const confirmBtn = document.getElementById('btn-confirm-link-local');
        const skipBtn = document.getElementById('btn-skip-link-local');

        if (confirmBtn) {
            confirmBtn.onclick = async () => {
                confirmBtn.disabled = true;
                confirmBtn.textContent = 'Vinculando y respaldando en la nube...';
                try {
                    const apiBase = (typeof window !== 'undefined' && window.API_CONFIG && window.API_CONFIG.API_URL) 
                        ? window.API_CONFIG.API_URL.replace(/\/api$/, '') 
                        : 'http://localhost:3000';
                    const linkRes = await fetch(`${apiBase}/api/businesses/link-local`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-supabase-user-id': user.id },
                        body: JSON.stringify({ userId: user.id, businessName: biz.name })
                    });
                    const linkData = await linkRes.json();
                    if (!linkData || !linkData.success) {
                        throw new Error(linkData?.error || 'No se pudo vincular el negocio');
                    }

                    const m = document.getElementById(modalId);
                    if (m) m.remove();

                    if (typeof showNotification === 'function') {
                        showNotification('¡Negocio respaldado en la nube con éxito! ☁️🎉', 'success');
                    }

                    // Proceder a ingresar
                    await AuthManager.selectBusinessAndProceed(linkData.business.id, linkData.business.name, user, linkData.business.accessCode);
                } catch (e) {
                    alert('Error al vincular: ' + e.message);
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = '☁️ Respaldar y Vincular a mi Cuenta Pro';
                }
            };
        }

        if (skipBtn) {
            skipBtn.onclick = () => {
                const m = document.getElementById(modalId);
                if (m) m.remove();
                AuthManager.showOnboardingModal(user);
            };
        }
    }

    /**
     * Modal de Onboarding Inicial: "¿Eres Dueño o Empleado?"
     * Se muestra a usuarios recién registrados o sin negocio asignado.
     */
    static showOnboardingModal(user = null) {
        const existing = document.getElementById('onboarding-role-modal');
        if (existing) existing.remove();

        if (!user) user = this.getCurrentUser();
        const userEmail = user?.email || '';
        const userName = user?.user_metadata?.full_name || user?.username || userEmail.split('@')[0] || 'Usuario';

        const modalHtml = `
        <div id="onboarding-role-modal" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.82); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; z-index: 21000; font-family: 'Outfit', sans-serif; padding: 1rem;">
            <div style="background: #ffffff; border-radius: 1.5rem; max-width: 500px; width: 100%; padding: 2rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.35); border: 2px solid #e0e7ff;">
                
                <div style="text-align: center; margin-bottom: 1.5rem;">
                    <div style="width: 56px; height: 56px; margin: 0 auto 0.75rem; border-radius: 1.25rem; background: linear-gradient(135deg, rgba(79, 70, 229, 0.15), rgba(99, 102, 241, 0.05)); border: 2px solid #6366f1; display: flex; align-items: center; justify-content: center; font-size: 1.85rem;">
                        👋
                    </div>
                    <h2 style="font-size: 1.35rem; font-weight: 850; color: #0f172a; margin: 0;">¡Bienvenido, ${userName}!</h2>
                    <p style="font-size: 0.88rem; color: #64748b; margin-top: 0.35rem;">Para comenzar a operar, indícanos tu rol en este equipo:</p>
                </div>

                <!-- DOS TARJETAS PRINCIPALES: DUEÑO VS EMPLEADO -->
                <div id="onboarding-cards-container" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; margin-bottom: 1.25rem;">
                    <!-- TARJETA DUEÑO -->
                    <div id="card-choice-owner" onclick="AuthManager.selectOnboardingRole('owner')" 
                         style="border: 2px solid #cbd5e1; border-radius: 1.25rem; padding: 1.15rem 0.85rem; text-align: center; cursor: pointer; transition: all 0.2s; background: #ffffff;">
                        <div style="font-size: 2rem; margin-bottom: 0.35rem;">👑</div>
                        <div style="font-weight: 850; font-size: 0.95rem; color: #1e293b; margin-bottom: 0.2rem;">Soy Dueño</div>
                        <div style="font-size: 0.75rem; color: #64748b; line-height: 1.3;">Crear mi negocio y recibir un código único</div>
                    </div>

                    <!-- TARJETA EMPLEADO -->
                    <div id="card-choice-employee" onclick="AuthManager.selectOnboardingRole('employee')" 
                         style="border: 2px solid #cbd5e1; border-radius: 1.25rem; padding: 1.15rem 0.85rem; text-align: center; cursor: pointer; transition: all 0.2s; background: #ffffff;">
                        <div style="font-size: 2rem; margin-bottom: 0.35rem;">🛒</div>
                        <div style="font-weight: 850; font-size: 0.95rem; color: #1e293b; margin-bottom: 0.2rem;">Soy Empleado</div>
                        <div style="font-size: 0.75rem; color: #64748b; line-height: 1.3;">Tengo el código del local donde trabajo</div>
                    </div>
                </div>

                <!-- FORMULARIO 1: CREAR NEGOCIO (DUEÑO) -->
                <div id="form-onboarding-owner" style="display: none; background: #f8fafc; border: 2px solid #6366f1; border-radius: 1rem; padding: 1.15rem; margin-bottom: 1.25rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.65rem;">
                        <span style="font-size: 1.15rem;">🏪</span>
                        <strong style="color: #1e293b; font-size: 0.9rem;">Nombre de tu Local o Empresa:</strong>
                    </div>
                    <input type="text" id="onboarding-owner-biz-name" placeholder="Ej: Mi Negocio" 
                           onkeydown="if(event.key === 'Enter') { event.preventDefault(); AuthManager.submitOnboardingOwner(); }"
                           style="width: 100%; height: 42px; border: 1.5px solid #cbd5e1; border-radius: 0.65rem; padding: 0 0.85rem; font-size: 0.95rem; font-weight: 700; box-sizing: border-box; margin-bottom: 0.75rem;">
                    <div id="onboarding-owner-error" style="display: none; color: #ef4444; font-size: 0.8rem; margin-bottom: 0.5rem; font-weight: 600;"></div>
                    <button type="button" id="btn-submit-onboarding-owner" onclick="AuthManager.submitOnboardingOwner()" 
                            style="width: 100%; height: 42px; background: #4f46e5; color: #ffffff; border: none; border-radius: 0.65rem; font-size: 0.9rem; font-weight: 850; cursor: pointer; box-shadow: 0 4px 12px rgba(79,70,229,0.35);">
                        🚀 Crear Negocio y Obtener mi Código Único
                    </button>
                </div>

                <!-- FORMULARIO 2: UNIRME CON CÓDIGO (EMPLEADO) -->
                <div id="form-onboarding-employee" style="display: none; background: #f8fafc; border: 2px solid #10b981; border-radius: 1rem; padding: 1.15rem; margin-bottom: 1.25rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                        <span style="font-size: 1.15rem;">🔑</span>
                        <strong style="color: #1e293b; font-size: 0.9rem;">Código Único del Negocio:</strong>
                    </div>
                    <p style="font-size: 0.78rem; color: #64748b; margin: 0 0 0.65rem 0;">
                        Pídele a tu empleador el código único de su local (ej: <strong>NEGOCIO-4921</strong>):
                    </p>
                    <input type="text" id="onboarding-employee-code" placeholder="XXXX-0000" maxlength="20"
                           onkeydown="if(event.key === 'Enter') { event.preventDefault(); AuthManager.submitOnboardingEmployee(); }"
                           style="width: 100%; height: 44px; border: 2px solid #10b981; border-radius: 0.65rem; padding: 0 0.85rem; font-size: 1.1rem; font-weight: 850; font-family: monospace; letter-spacing: 0.08em; text-align: center; text-transform: uppercase; box-sizing: border-box; margin-bottom: 0.75rem;"
                           oninput="this.value = this.value.toUpperCase()">
                    <div id="onboarding-employee-error" style="display: none; color: #ef4444; font-size: 0.8rem; margin-bottom: 0.5rem; font-weight: 600;"></div>
                    <button type="button" id="btn-submit-onboarding-employee" onclick="AuthManager.submitOnboardingEmployee()" 
                            style="width: 100%; height: 42px; background: #10b981; color: #ffffff; border: none; border-radius: 0.65rem; font-size: 0.9rem; font-weight: 850; cursor: pointer; box-shadow: 0 4px 12px rgba(16,185,129,0.35);">
                        ✅ Unirme al Negocio y Entrar a Caja
                    </button>
                </div>

                <div style="text-align: center;">
                    <button type="button" onclick="AuthManager.logout()" style="background: transparent; border: none; color: #94a3b8; font-size: 0.82rem; font-weight: 700; cursor: pointer;">
                        Cerrar sesión
                    </button>
                </div>
            </div>
        </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    static selectOnboardingRole(role) {
        const cardOwner = document.getElementById('card-choice-owner');
        const cardEmp = document.getElementById('card-choice-employee');
        const formOwner = document.getElementById('form-onboarding-owner');
        const formEmp = document.getElementById('form-onboarding-employee');

        if (role === 'owner') {
            if (cardOwner) {
                cardOwner.style.borderColor = '#4f46e5';
                cardOwner.style.background = '#eef2ff';
                cardOwner.style.boxShadow = '0 4px 12px rgba(79,70,229,0.2)';
            }
            if (cardEmp) {
                cardEmp.style.borderColor = '#cbd5e1';
                cardEmp.style.background = '#ffffff';
                cardEmp.style.boxShadow = 'none';
            }
            if (formOwner) formOwner.style.display = 'block';
            if (formEmp) formEmp.style.display = 'none';
            setTimeout(() => document.getElementById('onboarding-owner-biz-name')?.focus(), 50);
        } else {
            if (cardEmp) {
                cardEmp.style.borderColor = '#10b981';
                cardEmp.style.background = '#ecfdf5';
                cardEmp.style.boxShadow = '0 4px 12px rgba(16,185,129,0.2)';
            }
            if (cardOwner) {
                cardOwner.style.borderColor = '#cbd5e1';
                cardOwner.style.background = '#ffffff';
                cardOwner.style.boxShadow = 'none';
            }
            if (formEmp) formEmp.style.display = 'block';
            if (formOwner) formOwner.style.display = 'none';
            setTimeout(() => document.getElementById('onboarding-employee-code')?.focus(), 50);
        }
    }

    static async submitOnboardingOwner() {
        const input = document.getElementById('onboarding-owner-biz-name');
        const errDiv = document.getElementById('onboarding-owner-error');
        const btn = document.getElementById('btn-submit-onboarding-owner');
        const name = input ? input.value.trim() : '';

        if (!name) {
            if (errDiv) { errDiv.textContent = 'Por favor escribe el nombre de tu negocio'; errDiv.style.display = 'block'; }
            if (input) input.focus();
            return;
        }

        if (btn) { btn.disabled = true; btn.textContent = 'Creando negocio...'; }
        if (errDiv) errDiv.style.display = 'none';

        const user = AuthManager.getCurrentUser();
        const userId = user?.id || localStorage.getItem('PMV_USER_ID');
        const apiBase = (typeof window !== 'undefined' && window.API_CONFIG && window.API_CONFIG.API_URL) 
            ? window.API_CONFIG.API_URL.replace(/\/api$/, '') 
            : 'http://localhost:3000';

        try {
            const sbToken = localStorage.getItem('SUPABASE_ACCESS_TOKEN') || sessionStorage.getItem('SUPABASE_ACCESS_TOKEN');
            const localToken = localStorage.getItem('AUTH_TOKEN') || sessionStorage.getItem('AUTH_TOKEN');
            const headers = {
                'Content-Type': 'application/json',
                'x-supabase-user-id': userId
            };
            if (sbToken) headers['Authorization'] = `Bearer ${sbToken}`;
            if (localToken) headers['x-pos-token'] = localToken;

            const res = await fetch(`${apiBase}/api/businesses/create`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ name, userId })
            });
            const data = await res.json();
            if (data && data.success && data.business) {
                showNotification(`¡Negocio creado! Tu código es: ${data.business.accessCode}`, 'success');
                const modal = document.getElementById('onboarding-role-modal');
                if (modal) modal.remove();
                await AuthManager.selectBusinessAndProceed(data.business.id, data.business.name, user, data.business.accessCode);
            } else {
                throw new Error(data?.error || 'Error al crear el negocio');
            }
        } catch (e) {
            if (errDiv) { errDiv.textContent = e.message; errDiv.style.display = 'block'; }
            if (btn) { btn.disabled = false; btn.textContent = '🚀 Crear Negocio y Obtener mi Código Único'; }
        }
    }

    static async submitOnboardingEmployee() {
        const input = document.getElementById('onboarding-employee-code');
        const errDiv = document.getElementById('onboarding-employee-error');
        const btn = document.getElementById('btn-submit-onboarding-employee');
        const code = input ? input.value.trim().toUpperCase() : '';

        if (!code) {
            if (errDiv) { errDiv.textContent = 'Por favor ingresa el código del negocio'; errDiv.style.display = 'block'; }
            if (input) input.focus();
            return;
        }

        if (btn) { btn.disabled = true; btn.textContent = 'Verificando código...'; }
        if (errDiv) errDiv.style.display = 'none';

        const user = AuthManager.getCurrentUser();
        const userId = user?.id || localStorage.getItem('PMV_USER_ID');
        const userEmail = user?.email || '';
        const staffName = user?.username || user?.user_metadata?.full_name || userEmail.split('@')[0] || 'Cajero';
        const apiBase = (typeof window !== 'undefined' && window.API_CONFIG && window.API_CONFIG.API_URL) 
            ? window.API_CONFIG.API_URL.replace(/\/api$/, '') 
            : 'http://localhost:3000';

        try {
            const sbToken = localStorage.getItem('SUPABASE_ACCESS_TOKEN') || sessionStorage.getItem('SUPABASE_ACCESS_TOKEN');
            const localToken = localStorage.getItem('AUTH_TOKEN') || sessionStorage.getItem('AUTH_TOKEN');
            const headers = {
                'Content-Type': 'application/json',
                'x-supabase-user-id': userId
            };
            if (sbToken) headers['Authorization'] = `Bearer ${sbToken}`;
            if (localToken) headers['x-pos-token'] = localToken;

            const res = await fetch(`${apiBase}/api/businesses/join`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ code, userId, email: userEmail, staffName })
            });
            const data = await res.json();
            if (data && data.success && data.business) {
                showNotification(`¡Te has unido a "${data.business.name}"! 🎉`, 'success');
                const modal = document.getElementById('onboarding-role-modal');
                if (modal) modal.remove();
                await AuthManager.selectBusinessAndProceed(data.business.id, data.business.name, user, data.business.accessCode);
            } else {
                throw new Error(data?.error || 'Código de negocio inválido o inexistente');
            }
        } catch (e) {
            if (errDiv) { errDiv.textContent = e.message; errDiv.style.display = 'block'; }
            if (btn) { btn.disabled = false; btn.textContent = '✅ Unirme al Negocio y Entrar a Caja'; }
        }
    }

    /**
     * Modal interactivo para seleccionar o crear una nueva sucursal
     */
    static showBusinessSelectorModal(businesses = null, user = null) {
        const existingModal = document.getElementById('business-selector-modal');
        if (existingModal) existingModal.remove();

        if (!user) user = this.getCurrentUser();
        const isEmployee = user && (user.role === 'employee' || user.role === 'cashier');
        const isPro = (typeof LicenseService !== 'undefined' && LicenseService.isPro()) 
            || ['pro', 'full_pro', 'pc_pro'].includes(String(user?.plan || '').toLowerCase());
        const currentBizId = String(localStorage.getItem('BUSINESS_ID') || '1');

        const modalHtml = `
        <div id="business-selector-modal" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 20000; font-family: 'Outfit', sans-serif;">
            <div style="background: #ffffff; border-radius: 1.5rem; max-width: 480px; width: 92%; padding: 2rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.3); border: 2px solid #e0e7ff;">
                
                <div style="text-align: center; margin-bottom: 1.5rem;">
                    <div style="width: 56px; height: 56px; margin: 0 auto 0.75rem; border-radius: 1rem; background: rgba(79, 70, 229, 0.1); border: 2px solid #6366f1; display: flex; align-items: center; justify-content: center; font-size: 1.75rem;">
                        🏪
                    </div>
                    <h2 style="font-size: 1.35rem; font-weight: 800; color: #0f172a; margin: 0;">${isEmployee ? 'Tu Negocio Asignado' : 'Seleccionar Negocio / Sucursal'}</h2>
                    <p style="font-size: 0.85rem; color: #64748b; margin-top: 0.25rem;">${isEmployee ? 'Operas como empleado en esta sucursal' : 'Elige la sucursal en la que operarás en esta PC'}</p>
                </div>

                <!-- Lista de Sucursales -->
                <div id="branch-list-container" style="display: flex; flex-direction: column; gap: 0.6rem; max-height: 250px; overflow-y: auto; margin-bottom: 1.25rem; padding-right: 0.25rem;">
                    <div style="text-align: center; color: #64748b; padding: 1rem;">Cargando sucursales...</div>
                </div>

                <!-- Formulario Rápido Crear Nuevo Negocio (Solo Pro) -->
                ${(!isEmployee && isPro) ? `
                <div id="create-branch-section" style="display: none; background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 1rem; padding: 1rem; margin-bottom: 1.25rem;">
                    <label style="font-size: 0.8rem; font-weight: 800; color: #334155; display: block; margin-bottom: 0.35rem;">Nombre del Nuevo Negocio:</label>
                    <input type="text" id="new-branch-name-input" placeholder="Ej: Sucursal Centro" 
                           onkeydown="if(event.key === 'Enter') { event.preventDefault(); document.getElementById('confirm-create-branch-btn')?.click(); }"
                           style="width: 100%; height: 42px; border: 2px solid #6366f1; border-radius: 0.65rem; padding: 0 0.75rem; font-size: 0.95rem; font-weight: 700; box-sizing: border-box; margin-bottom: 0.6rem;">
                    <div style="display: flex; gap: 0.5rem;">
                        <button type="button" id="confirm-create-branch-btn" class="btn btn-primary" style="flex: 1; height: 38px; font-size: 0.85rem; font-weight: 800; background: #4f46e5; border-radius: 0.5rem; cursor: pointer;">Crear e Ingresar</button>
                        <button type="button" onclick="document.getElementById('create-branch-section').style.display='none'" class="btn btn-ghost" style="height: 38px; font-size: 0.85rem; font-weight: 700; border-radius: 0.5rem; cursor: pointer;">Cancelar</button>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 0.6rem;">
                    <button type="button" id="btn-show-create-branch" style="width: 100%; height: 42px; background: rgba(79, 70, 229, 0.08); border: 1.5px solid #6366f1; color: #4338ca; border-radius: 0.75rem; font-size: 0.9rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.4rem;">
                        ➕ Crear Nuevo Negocio
                    </button>
                    <button type="button" onclick="document.getElementById('business-selector-modal').remove()" style="width: 100%; height: 38px; background: transparent; border: none; color: #94a3b8; font-size: 0.85rem; font-weight: 700; cursor: pointer;">
                        Cerrar
                    </button>
                </div>
                ` : `
                <div style="display: flex; flex-direction: column; gap: 0.6rem;">
                    <button type="button" onclick="document.getElementById('business-selector-modal').remove()" style="width: 100%; height: 38px; background: transparent; border: none; color: #94a3b8; font-size: 0.85rem; font-weight: 700; cursor: pointer;">
                        Cerrar
                    </button>
                </div>
                `}
            </div>
        </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const loadBranches = async () => {
            let list = businesses;
            const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
            const userId = user?.id || localStorage.getItem('PMV_USER_ID') || localStorage.getItem('SUPABASE_USER_ID');

            // 1. Consultar negocios frescos en Supabase Cloud con sus códigos inmutables
            if (client && userId) {
                try {
                    const { data: cloudBiz } = await client
                        .from('businesses')
                        .select('id, name, business_code')
                        .eq('user_id', userId)
                        .eq('is_active', true)
                        .order('created_at', { ascending: true });
                    if (Array.isArray(cloudBiz) && cloudBiz.length > 0) {
                        list = cloudBiz.map(b => ({
                            local_id: String(b.id),
                            name: b.name,
                            accessCode: b.business_code || ''
                        }));
                    }
                } catch (_) {}
            }

            // 2. Fallback a backend SQLite local
            if (!list || list.length === 0) {
                const apiBase = (typeof window !== 'undefined' && window.API_CONFIG && window.API_CONFIG.API_URL) 
                    ? window.API_CONFIG.API_URL.replace(/\/api$/, '') 
                    : 'http://localhost:3000';
                try {
                    const res = await fetch(`${apiBase}/api/businesses/list`, {
                        headers: { 'x-supabase-user-id': userId }
                    });
                    const d = await res.json();
                    list = d?.businesses?.map(b => ({ local_id: String(b.id), name: b.name, accessCode: b.accessCode || b.access_code || '' })) || [];
                } catch (_) { list = []; }
            }

            // Si es empleado, filtrar estrictamente para ver solo su negocio asignado
            if (isEmployee) {
                const assignedBizId = String(user.business_id || localStorage.getItem('BUSINESS_ID') || '1');
                list = list.filter(b => String(b.local_id || b.id) === assignedBizId);
            }

            const container = document.getElementById('branch-list-container');
            if (!container) return;

            if (list.length === 0) {
                list = [{ local_id: '1', name: localStorage.getItem('CURRENT_BUSINESS') || 'Mi Negocio', accessCode: '' }];
            }

            container.innerHTML = list.map(b => {
                const isSelected = String(b.local_id || b.id) === currentBizId;
                const safeName = (b.name || 'Mi Negocio').replace(/'/g, "\\'");
                const targetId = b.local_id || b.id;
                const code = b.accessCode || b.access_code || '';
                return `
                    <div class="branch-card-item" onclick="AuthManager.selectBusinessAndProceed('${targetId}', '${safeName}', null, '${code}')" style="display: flex; align-items: center; justify-content: space-between; padding: 0.95rem 1.15rem; border: 2px solid ${isSelected ? '#4f46e5' : '#e2e8f0'}; background: ${isSelected ? 'rgba(79, 70, 229, 0.06)' : '#ffffff'}; border-radius: 1rem; cursor: pointer; transition: all 0.2s; margin-bottom: 0.25rem; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <span style="font-size: 1.4rem;">🏪</span>
                            <div>
                                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                                    <span style="font-size: 1rem; font-weight: 850; color: #0f172a;">${b.name}</span>
                                    ${code ? `<span style="background: #eef2ff; color: #4338ca; border: 1.5px solid #c7d2fe; font-size: 0.72rem; font-weight: 850; padding: 0.2rem 0.55rem; border-radius: 8px; letter-spacing: 0.05em; font-family: monospace;">🔑 CÓDIGO: ${code}</span>` : ''}
                                </div>
                                <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.15rem;">Sucursal #${targetId}</div>
                            </div>
                        </div>
                        ${isSelected ? '<span style="background: #4f46e5; color: #fff; font-size: 0.72rem; font-weight: 900; padding: 0.25rem 0.65rem; border-radius: 9999px;">ACTIVA</span>' : '<span style="color: #4f46e5; font-weight: 850; font-size: 0.88rem;">Entrar →</span>'}
                    </div>
                `;
            }).join('');
        };

        loadBranches();

        // Handler para mostrar formulario de creación con límite por plan
        const showCreateBtn = document.getElementById('btn-show-create-branch');
        if (showCreateBtn) {
            showCreateBtn.onclick = () => {
                const maxAllowed = typeof LicenseService !== 'undefined' ? LicenseService.getMaxBusinesses() : 1;
                const currentCount = document.querySelectorAll('.branch-card-item').length;
                if (currentCount >= maxAllowed) {
                    const isPro = typeof LicenseService !== 'undefined' && LicenseService.isPro();
                    const msg = isPro 
                        ? `Has alcanzado el límite máximo de ${maxAllowed} negocios permitido para tu Plan PRO.`
                        : `El Plan FREE permite administrar 1 solo negocio. Para crear hasta 3 negocios y activar respaldos, mejora a FULL PRO.`;
                    if (typeof showNotification === 'function') {
                        showNotification(msg, 'warning');
                    } else {
                        alert(msg);
                    }
                    return;
                }

                const section = document.getElementById('create-branch-section');
                if (section) {
                    section.style.display = 'block';
                    const input = document.getElementById('new-branch-name-input');
                    if (input) input.focus();
                }
            };
        }

        // Handler para crear negocio (únicamente pide Nombre del Negocio)
        const confirmBtn = document.getElementById('confirm-create-branch-btn');
        if (confirmBtn) {
            confirmBtn.onclick = async () => {
                const input = document.getElementById('new-branch-name-input');
                const name = input ? input.value.trim() : '';
                if (!name) {
                    alert('Por favor escribe un nombre para el negocio');
                    return;
                }

                const apiBase = (typeof window !== 'undefined' && window.API_CONFIG && window.API_CONFIG.API_URL) 
                    ? window.API_CONFIG.API_URL.replace(/\/api$/, '') 
                    : 'http://localhost:3000';
                const userId = user?.id || localStorage.getItem('PMV_USER_ID');

                try {
                    const sbToken = localStorage.getItem('SUPABASE_ACCESS_TOKEN') || sessionStorage.getItem('SUPABASE_ACCESS_TOKEN');
                    const localToken = localStorage.getItem('AUTH_TOKEN') || sessionStorage.getItem('AUTH_TOKEN');
                    const headers = {
                        'Content-Type': 'application/json',
                        'x-supabase-user-id': userId
                    };
                    if (sbToken) headers['Authorization'] = `Bearer ${sbToken}`;
                    if (localToken) headers['x-pos-token'] = localToken;

                    const res = await fetch(`${apiBase}/api/businesses/create`, {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify({ name, userId })
                    });
                    const data = await res.json();
                    if (data && data.success && data.business) {
                        await AuthManager.selectBusinessAndProceed(data.business.id, data.business.name, user, data.business.accessCode);
                    } else {
                        alert('Error al crear negocio: ' + (data?.error || 'Intente nuevamente'));
                    }
                } catch (e) {
                    alert('Error al crear negocio: ' + e.message);
                }
            };

            const modalInput = document.getElementById('new-branch-name-input');
            if (modalInput) {
                modalInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        confirmBtn.click();
                    }
                });
            }
        }
    }

    /**
     * Actualiza el indicador visual de la sucursal en el DOM
     */
    static updateBusinessBadgeUI(businessName) {
        const name = businessName || localStorage.getItem('CURRENT_BUSINESS') || 'Mi Negocio';
        const code = localStorage.getItem('BUSINESS_ACCESS_CODE') || '';
        const user = this.getCurrentUser();
        const isEmployee = user && (user.role === 'employee' || user.role === 'cashier');

        const badges = document.querySelectorAll('.current-business-name-badge, #currentBusinessBadge');
        badges.forEach(b => {
            b.textContent = name;
        });

        // Candado visual para empleados y tooltip informativo con código
        const btns = document.querySelectorAll('#branchSelectorBtn, #posBusinessDropdownBtn');
        btns.forEach(btn => {
            if (code) btn.title = `Negocio: ${name} (Código: ${code})`;
            if (isEmployee) {
                btn.style.cursor = 'default';
                btn.title = `Negocio asignado: ${name} (Código: ${code || 'Sin código'}) - Modo Empleado`;
                const arrows = btn.querySelectorAll('span');
                arrows.forEach(s => {
                    if (s.textContent && s.textContent.includes('▾')) s.style.display = 'none';
                });
            }
        });
    }

    /**
     * Registra un nuevo negocio y usuario dueño en Supabase Auth.
     */
    static async registerWithSupabaseEmail(email, password, businessName, fullName) {
        const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
        if (!client) {
            throw new Error('El cliente de Supabase no está disponible.');
        }

        const { data, error } = await client.auth.signUp({
            email: email.trim().toLowerCase(),
            password: password,
            options: {
                data: {
                    business_name: businessName.trim(),
                    full_name: fullName ? fullName.trim() : email.split('@')[0]
                }
            }
        });

        if (error) throw error;
        return data;
    }

    /**
     * Envía enlace de recuperación de contraseña al correo registrado.
     */
    static async resetPasswordViaSupabase(email) {
        const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
        if (!client) {
            throw new Error('El cliente de Supabase no está disponible.');
        }

        const { data, error } = await client.auth.resetPasswordForEmail(email.trim().toLowerCase());
        if (error) throw error;
        return data;
    }

    /**
     * Alterna la vista de Login entre Dueño (Google/Email) y Cajero (PIN/Usuario)
     */
    static switchLoginTab(mode) {
        const ownerTab = document.getElementById('tab-owner-login');
        const cashierTab = document.getElementById('tab-cashier-login');
        const ownerAuthContainer = document.getElementById('owner-auth-container');
        const userLabel = document.getElementById('login-username-label');
        const userInput = document.getElementById('login-username');
        const passLabel = document.getElementById('login-password-label');
        const passInput = document.getElementById('login-password');
        const toggleModeBtn = document.getElementById('toggle-mode-btn');

        if (mode === 'cashier') {
            if (ownerTab) {
                ownerTab.style.background = 'transparent';
                ownerTab.style.color = '#64748b';
                ownerTab.style.boxShadow = 'none';
            }
            if (cashierTab) {
                cashierTab.style.background = '#10b981';
                cashierTab.style.color = '#ffffff';
                cashierTab.style.boxShadow = '0 2px 6px rgba(16,185,129,0.3)';
            }
            if (ownerAuthContainer) ownerAuthContainer.style.display = 'none';
            if (userLabel) userLabel.textContent = 'Usuario o Cajero';
            if (userInput) userInput.placeholder = 'Ej: cajero1 o nombre';
            if (passLabel) passLabel.textContent = 'PIN o Contraseña';
            if (passInput) passInput.placeholder = 'PIN de 4 dígitos o clave';
            if (toggleModeBtn) toggleModeBtn.style.display = 'none';
        } else {
            if (ownerTab) {
                ownerTab.style.background = '#4f46e5';
                ownerTab.style.color = '#ffffff';
                ownerTab.style.boxShadow = '0 2px 6px rgba(79,70,229,0.3)';
            }
            if (cashierTab) {
                cashierTab.style.background = 'transparent';
                cashierTab.style.color = '#64748b';
                cashierTab.style.boxShadow = 'none';
            }
            if (ownerAuthContainer) ownerAuthContainer.style.display = 'flex';
            if (userLabel) userLabel.textContent = 'Correo Electrónico';
            if (userInput) userInput.placeholder = 'correo@gmail.com';
            if (passLabel) passLabel.textContent = 'Contraseña';
            if (passInput) passInput.placeholder = '••••';
            if (toggleModeBtn) toggleModeBtn.style.display = 'block';
        }
    }

    /**
     * Dispara el flujo de Google OAuth con Supabase
     */
    static async handleGoogleSignIn() {
        const btn = document.getElementById('btn-google-login');
        const originalHtml = btn ? btn.innerHTML : '';
        try {
            if (btn) {
                btn.disabled = true;
                btn.style.opacity = '0.85';
                btn.style.cursor = 'wait';
                btn.innerHTML = `
                    <span style="display:inline-block; width:18px; height:18px; border:2.5px solid #cbd5e1; border-top-color:#4285F4; border-radius:50%; animation:spin 0.8s linear infinite;"></span>
                    <span>Conectando con Google... ⏳</span>
                `;
            }
            showNotification('Iniciando acceso con Google...', 'info');
            const result = await this.loginWithGoogle();
            if (!result) {
                // ponytail: El usuario cerró con la X o canceló, volver suavemente sin mostrar avisos molestos
                return;
            }

            // Si el usuario ya completó el acceso, retirar la pantalla de login definitivamente
            if (this.isAuthenticated()) {
                const loginScreen = document.getElementById('login-screen');
                if (loginScreen) loginScreen.remove();
            }
        } catch (e) {
            console.error('Error en Google Sign-In:', e);
            let msg = e.message || '';
            if (msg.includes('ERR_') || msg.includes('http') || msg.includes('loading') || msg.includes('cerrada')) {
                msg = 'No se pudo conectar con el servicio. Verifica tu conexión a internet.';
            }
            showNotification('Aviso: ' + msg, 'warning');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
                btn.innerHTML = originalHtml;
            }
        }
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

    static async logout() {
        try {
            const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
            if (client) {
                await client.auth.signOut();
            }
        } catch (e) {
            console.warn('Error al cerrar sesión de Supabase:', e);
        }

        // Limpiar almacenamiento local exhaustivamente (Evita filtraciones de negocios y sesiones cruzadas)
        sessionStorage.clear();
        localStorage.removeItem(this.SESSION_KEY);
        localStorage.removeItem('REMEMBER_LOGIN');
        localStorage.removeItem('AUTH_TOKEN');
        localStorage.removeItem('BUSINESS_ID');
        localStorage.removeItem('CURRENT_BUSINESS');
        localStorage.removeItem('BUSINESS_ACCESS_CODE');
        localStorage.removeItem('CACHED_BUSINESSES');
        localStorage.removeItem('SUPABASE_ACCESS_TOKEN');
        localStorage.removeItem('SUPABASE_USER_ID');
        localStorage.removeItem('PMV_USER_ID');
        localStorage.removeItem('PMV_BIZ');
        localStorage.removeItem('PMV_SESSION');

        // Reiniciar base de datos activa a la principal en el backend
        try {
            const apiBase = (typeof window !== 'undefined' && window.API_CONFIG && window.API_CONFIG.API_URL) 
                ? window.API_CONFIG.API_URL.replace(/\/api$/, '') 
                : 'http://localhost:3000';
            fetch(`${apiBase}/api/auth/switch-business`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ businessId: 1 })
            }).catch(() => {});
        } catch (_) {}

        // Limpiar tokens residuales de Supabase
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('sb-') || key.includes('supabase')) {
                localStorage.removeItem(key);
            }
        });

        // Ocultar app y mostrar login
        const appDiv = document.getElementById('app');
        if (appDiv) appDiv.style.display = 'none';

        window.location.href = window.location.pathname; // Recargar a la raíz limpia sin hashes
    }



    /**
     * Confirmación de seguridad con diseño moderno antes de desvincular el equipo o cerrar sesión
     */
    static async confirmFullLogout() {
        const title = '¿Cerrar Sesión?';
        const icon = '🚪';
        const iconBg = '#fee2e2';
        const iconColor = '#dc2626';
        const message = 'Tu sesión se cerrará de forma segura. Todas tus ventas, inventario y registros quedan protegidos y guardados en tu equipo.';
        const actionText = 'Sí, Cerrar Sesión';

        const modalId = 'modal-logout-confirm';
        const existing = document.getElementById(modalId);
        if (existing) existing.remove();

        const modalHtml = `
            <div id="${modalId}" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.65); display: flex; align-items: center; justify-content: center; z-index: 999999; backdrop-filter: blur(6px); animation: fadeIn 0.15s ease-out;">
                <div style="background: #ffffff; border-radius: 20px; width: 92%; max-width: 440px; padding: 28px 24px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35); text-align: center; border: 1px solid rgba(226, 232, 240, 0.8);">
                    
                    <div style="width: 68px; height: 68px; border-radius: 50%; background: ${iconBg}; color: ${iconColor}; display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 16px auto; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
                        ${icon}
                    </div>

                    <h3 style="font-size: 1.3rem; font-weight: 850; color: #0f172a; margin: 0 0 8px 0;">
                        ${title}
                    </h3>
                    
                    <p style="font-size: 0.92rem; color: #64748b; line-height: 1.55; margin: 0 0 24px 0; padding: 0 8px;">
                        ${message}
                    </p>

                    <div style="display: flex; gap: 12px; justify-content: center;">
                        <button id="btn-cancel-logout-modal" type="button" 
                                style="flex: 1; height: 46px; background: #f1f5f9; color: #475569; border: 1.5px solid #cbd5e1; border-radius: 12px; font-weight: 750; font-size: 0.92rem; cursor: pointer; transition: all 0.2s;"
                                onmouseover="this.style.background='#e2e8f0';" onmouseout="this.style.background='#f1f5f9';">
                            Seguir Trabajando
                        </button>
                        <button id="btn-confirm-logout-modal" type="button" 
                                style="flex: 1; height: 46px; background: linear-gradient(135deg, #ef4444, #dc2626); color: #ffffff; border: none; border-radius: 12px; font-weight: 800; font-size: 0.92rem; cursor: pointer; box-shadow: 0 4px 14px rgba(239, 68, 68, 0.35); transition: all 0.2s;"
                                onmouseover="this.style.transform='translateY(-1px)';" onmouseout="this.style.transform='translateY(0)';">
                            ${actionText}
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modalEl = document.getElementById(modalId);
        const cancelBtn = document.getElementById('btn-cancel-logout-modal');
        const confirmBtn = document.getElementById('btn-confirm-logout-modal');

        const closeModal = () => {
            if (modalEl) modalEl.remove();
        };

        if (cancelBtn) cancelBtn.onclick = closeModal;

        if (modalEl) {
            modalEl.onclick = (e) => {
                if (e.target === modalEl) closeModal();
            };
        }

        if (confirmBtn) {
            confirmBtn.onclick = async () => {
                confirmBtn.disabled = true;
                confirmBtn.innerHTML = 'Cerrando sesión...';
                closeModal();
                await this.logout();
            };
        }
    }

    /**
     * Decodifica de forma segura y defensiva el payload de un token JWT
     */
    static parseJwtPayload(token) {
        if (!token || typeof token !== 'string') return null;
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return null;
            const base64Url = parts[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (_) {
            return null;
        }
    }

    static getCurrentUser() {
        let sessionStr = sessionStorage.getItem(this.SESSION_KEY);
        if (!sessionStr) {
            sessionStr = localStorage.getItem(this.SESSION_KEY);
            if (sessionStr) sessionStorage.setItem(this.SESSION_KEY, sessionStr);
        }
        if (!sessionStr) return null;

        try {
            const user = JSON.parse(sessionStr);
            const token = localStorage.getItem('AUTH_TOKEN') || sessionStorage.getItem('AUTH_TOKEN');
            if (token) {
                const payload = this.parseJwtPayload(token);
                if (payload) {
                    // Verificación de expiración del token criptográfico
                    if (payload.exp && (payload.exp * 1000) < Date.now()) {
                        console.warn('⚠️ [Auth] Token de sesión expirado. Invalidando sesión local.');
                        this.logout();
                        return null;
                    }
                    // Blindaje OWASP Anti-Privilege Escalation:
                    // Si el usuario manipuló el localStorage para elevarse a admin/owner,
                    // el rol firmado del backend prevalece estrictamente.
                    if (payload.role && user.role !== payload.role) {
                        console.warn(`🛡️ [Auth] Discrepancia de rol en storage detectada (${user.role} vs ${payload.role}). Restaurando rol firmado.`);
                        user.role = payload.role;
                        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(user));
                        localStorage.setItem(this.SESSION_KEY, JSON.stringify(user));
                    }
                }
            }
            return user;
        } catch (_) {
            return null;
        }
    }

    static isAuthenticated() {
        const token = localStorage.getItem('AUTH_TOKEN') || sessionStorage.getItem('AUTH_TOKEN');
        const user = this.getCurrentUser();
        
        // ponytail: Validación estricta de sesión JWT (evita errores 401 'Token faltante' en cascada)
        if (!token || !user) {
            if (user && !token) {
                console.warn('⚠️ [Auth] Usuario en caché sin token de sesión válido. Forzando re-autenticación limpia.');
                localStorage.removeItem(this.SESSION_KEY);
                sessionStorage.removeItem(this.SESSION_KEY);
            }
            return false;
        }
        return true;
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

    /**
     * Iniciar sesión en Modo Local Offline Gratuito
     * Permite al usuario configurar o confirmar el nombre de su negocio local (máximo 1 negocio en Free)
     */
    static async loginLocalFree() {
        await this.promptLocalBusinessModal();
    }

    /**
     * Muestra modal para configurar el negocio local offline antes de ingresar
     */
    /**
     * Muestra modal para ingresar al negocio local offline existente con tarjeta o configurar si es nuevo
     */
    static async promptLocalBusinessModal(forceEdit = false) {
        const overlayId = 'modal-local-business-setup';
        const existing = document.getElementById(overlayId);
        if (existing) existing.remove();

        let currentName = localStorage.getItem('CURRENT_BUSINESS') || '';
        let currentCode = localStorage.getItem('BUSINESS_ACCESS_CODE') || 'LOCAL-01';
        let hasExistingBusiness = false;

        // Intentar obtener el negocio actual de SQLite
        try {
            const apiBase = (typeof window !== 'undefined' && window.API_CONFIG && window.API_CONFIG.API_URL) 
                ? window.API_CONFIG.API_URL.replace(/\/api$/, '') 
                : ((typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http')) ? window.location.origin : 'http://localhost:3001');
            const res = await fetch(`${apiBase}/api/businesses/list`);
            const d = await res.json();
            if (d && d.businesses && d.businesses.length > 0) {
                currentName = d.businesses[0].name || currentName;
                currentCode = d.businesses[0].accessCode || currentCode;
                hasExistingBusiness = true;
            }
        } catch (_) {}

        if (!currentName) {
            currentName = 'Mi Negocio';
        } else {
            hasExistingBusiness = true;
        }

        // Si ya existe el negocio y no se solicitó editarlo explícitamente, mostrar la Tarjeta de Acceso Directo (Opción 2)
        if (hasExistingBusiness && !forceEdit) {
            const html = `
                <div id="${overlayId}" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.7); display: flex; align-items: center; justify-content: center; z-index: 99999; backdrop-filter: blur(6px); padding: 1rem; animation: fadeIn 0.15s ease-out;">
                    <div style="background: #ffffff; border-radius: 22px; width: 100%; max-width: 440px; padding: 26px 24px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35); border: 1.5px solid #e2e8f0; text-align: center;">
                        
                        <div style="width: 64px; height: 64px; border-radius: 50%; background: #e0e7ff; color: #4338ca; display: flex; align-items: center; justify-content: center; font-size: 30px; margin: 0 auto 12px auto; box-shadow: 0 4px 12px rgba(67, 56, 202, 0.15);">
                            🏪
                        </div>

                        <h2 style="font-size: 1.35rem; font-weight: 850; color: #0f172a; margin: 0 0 4px 0;">Tu Negocio Local</h2>
                        <div style="margin-bottom: 1.25rem;">
                            <span style="display: inline-block; background: #ecfdf5; color: #047857; font-size: 0.76rem; font-weight: 750; padding: 0.2rem 0.65rem; border-radius: 9999px; border: 1px solid #a7f3d0;">
                                🌱 Plan Gratuito • 100% Offline
                            </span>
                        </div>

                        <!-- TARJETA DEL NEGOCIO LOCAL EXISTENTE -->
                        <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 16px; padding: 16px; margin-bottom: 1.25rem; display: flex; align-items: center; gap: 14px; text-align: left;">
                            <div style="width: 48px; height: 48px; border-radius: 12px; background: #ffffff; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
                                🏬
                            </div>
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-size: 1.05rem; font-weight: 850; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px;">
                                    ${currentName}
                                </div>
                                <div style="font-size: 0.78rem; color: #64748b; font-weight: 600;">
                                    Código: <span style="font-family: monospace; font-weight: 750; color: #4338ca;">${currentCode}</span> • Guardado en esta PC
                                </div>
                            </div>
                        </div>

                        <div id="local-biz-setup-error" style="display: none; color: #ef4444; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.75rem;"></div>

                        <!-- BOTÓN PRINCIPAL PARA ENTRAR DIRECTO CON 1 CLIC -->
                        <button type="button" id="btn-enter-existing-biz" onclick="AuthManager.submitLocalBusinessSetup('${currentName}', '${currentCode}')"
                                style="width: 100%; height: 48px; background: linear-gradient(135deg, #10b981, #059669); color: #ffffff; border: none; border-radius: 12px; font-weight: 800; font-size: 1rem; cursor: pointer; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35); margin-bottom: 12px; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s;"
                                onmouseover="this.style.transform='translateY(-1px)';" onmouseout="this.style.transform='translateY(0)';">
                            <span>▶️</span>
                            <span>Entrar a ${currentName}</span>
                        </button>

                        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 4px;">
                            <button type="button" onclick="AuthManager.promptLocalBusinessModal(true)"
                                    style="background: none; border: none; color: #6366f1; font-size: 0.82rem; font-weight: 750; cursor: pointer; text-decoration: underline; padding: 4px;">
                                ✏️ Cambiar nombre del local
                            </button>
                            <button type="button" onclick="document.getElementById('${overlayId}').remove()"
                                    style="background: none; border: none; color: #64748b; font-size: 0.82rem; font-weight: 600; cursor: pointer; padding: 4px;">
                                ← Volver al login
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
            return;
        }

        // Formulario de edición o primera vez
        const html = `
            <div id="${overlayId}" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.7); display: flex; align-items: center; justify-content: center; z-index: 99999; backdrop-filter: blur(6px); padding: 1rem; animation: fadeIn 0.15s ease-out;">
                <div style="background: #ffffff; border-radius: 22px; width: 100%; max-width: 440px; padding: 26px 24px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35); border: 1.5px solid #e2e8f0;">
                    <div style="text-align: center; margin-bottom: 1.25rem;">
                        <div style="font-size: 2.4rem; margin-bottom: 0.25rem;">🏪</div>
                        <h2 style="font-size: 1.35rem; font-weight: 850; color: #1e293b; margin: 0 0 0.25rem 0;">Configuración Negocio Local</h2>
                        <span style="display: inline-block; background: #ecfdf5; color: #047857; font-size: 0.76rem; font-weight: 750; padding: 0.2rem 0.65rem; border-radius: 9999px; border: 1px solid #a7f3d0;">
                            🌱 Plan Gratuito (1 Negocio Local)
                        </span>
                    </div>

                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 0.85rem; margin-bottom: 1.25rem; font-size: 0.82rem; color: #475569; line-height: 1.45;">
                        ℹ️ <b>Modo 100% Offline:</b> Los datos se guardan únicamente en esta computadora. Puedes definir el nombre de tu local y su código identificador.
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 0.85rem; margin-bottom: 1.25rem;">
                        <div>
                            <label style="display: block; font-size: 0.82rem; font-weight: 750; color: #334155; margin-bottom: 0.3rem;">
                                Nombre de tu Negocio / Local:
                            </label>
                            <input type="text" id="input-local-biz-name" value="${currentName}" placeholder="Ej: Mi Negocio"
                                   style="width: 100%; height: 42px; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 0 0.85rem; font-size: 0.95rem; font-weight: 650; box-sizing: border-box; outline: none;">
                        </div>

                        <div>
                            <label style="display: block; font-size: 0.82rem; font-weight: 750; color: #334155; margin-bottom: 0.3rem;">
                                Código o Identificador Local:
                            </label>
                            <input type="text" id="input-local-biz-code" value="${currentCode}" placeholder="Ej: LOCAL-01" maxlength="15"
                                   style="width: 100%; height: 42px; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 0 0.85rem; font-size: 0.95rem; font-weight: 750; font-family: monospace; letter-spacing: 0.05em; text-transform: uppercase; box-sizing: border-box; outline: none;"
                                   oninput="this.value = this.value.toUpperCase()">
                        </div>
                    </div>

                    <div id="local-biz-setup-error" style="display: none; color: #ef4444; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.75rem;"></div>

                    <div style="display: flex; gap: 0.65rem;">
                        <button type="button" onclick="AuthManager.promptLocalBusinessModal(false)"
                                style="flex: 1; height: 44px; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; border-radius: 10px; font-weight: 750; font-size: 0.9rem; cursor: pointer;">
                            Cancelar
                        </button>
                        <button type="button" id="btn-confirm-local-biz" onclick="AuthManager.submitLocalBusinessSetup()"
                                style="flex: 2; height: 44px; background: #4f46e5; color: #ffffff; border: none; border-radius: 10px; font-weight: 800; font-size: 0.92rem; cursor: pointer; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);">
                            Guardar y Entrar 🚀
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        setTimeout(() => {
            const input = document.getElementById('input-local-biz-name');
            if (input) input.focus();
        }, 100);
    }

    /**
     * Envía la configuración del negocio local o entra directo si ya existe
     */
    static async submitLocalBusinessSetup(directName = null, directCode = null) {
        const nameInput = document.getElementById('input-local-biz-name');
        const codeInput = document.getElementById('input-local-biz-code');
        const errDiv = document.getElementById('local-biz-setup-error');
        const btn = document.getElementById('btn-confirm-local-biz') || document.getElementById('btn-enter-existing-biz');

        const businessName = (directName || nameInput?.value || '').trim() || 'Mi Negocio';
        const accessCode = (directCode || codeInput?.value || '').trim().toUpperCase() || 'LOCAL-01';

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = 'Ingresando...';
        }

        try {
            const apiBase = (typeof window !== 'undefined' && window.API_CONFIG && window.API_CONFIG.API_URL) 
                ? window.API_CONFIG.API_URL.replace(/\/api$/, '') 
                : ((typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http')) ? window.location.origin : 'http://localhost:3001');

            const res = await fetch(`${apiBase}/api/auth/local-offline-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ businessName, accessCode })
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Error al iniciar sesión local');
            }

            // 1. Guardar token criptográfico para que isAuthenticated() no falle jamás
            localStorage.setItem('AUTH_TOKEN', data.token);
            sessionStorage.setItem('AUTH_TOKEN', data.token);

            // 2. Guardar sesión y datos del negocio
            localStorage.setItem(this.SESSION_KEY, JSON.stringify(data.user));
            sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(data.user));
            localStorage.setItem('CURRENT_BUSINESS', data.business.name);
            localStorage.setItem('BUSINESS_NAME', data.business.name);
            localStorage.setItem('BUSINESS_ID', String(data.business.id || 1));
            localStorage.setItem('REMEMBER_LOGIN', 'true');
            localStorage.removeItem('SUPABASE_ACCESS_TOKEN');
            sessionStorage.removeItem('SUPABASE_ACCESS_TOKEN');
            localStorage.removeItem('SUPABASE_USER_ID');
            sessionStorage.removeItem('SUPABASE_USER_ID');
            localStorage.removeItem('PMV_USER_ID');
            localStorage.removeItem('PMV_USER_EMAIL');

            // 3. Licencia FREE local y UI desconectada
            if (typeof LicenseService !== 'undefined') {
                LicenseService.saveData({
                    plan: 'FREE',
                    userEmail: null,
                    isOffline: true,
                    activatedCode: null
                });
            }
            if (typeof SyncService !== 'undefined') {
                SyncService.updateUI('offline', 'Modo Local Offline (Plan FREE / Sin Nube)');
            }

            // 4. Cerrar modales y pantalla de login
            const modal = document.getElementById('modal-local-business-setup');
            if (modal) modal.remove();

            const loginScreen = document.getElementById('login-screen');
            if (loginScreen) loginScreen.remove();

            const splash = document.getElementById('splash-screen');
            if (splash) splash.style.display = 'none';

            const appEl = document.getElementById('app');
            if (appEl) {
                appEl.style.display = 'block';
                if (typeof app !== 'undefined' && typeof app.navigate === 'function') {
                    app.navigate('pos');
                }
            }

            showNotification(`🚀 Bienvenido a ${data.business.name} (Modo Local Offline)`, 'success');
        } catch (e) {
            console.error('Error al configurar negocio local:', e);
            if (errDiv) {
                errDiv.textContent = e.message;
                errDiv.style.display = 'block';
            }
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = 'Entrar al POS 🚀';
            }
        }
    }

    /**
     * Alterna pestañas de recuperación de contraseña: Nube (Correo) vs Local (PIN Maestro)
     */
    static switchRecoverTab(tab) {
        const cloudTab = document.getElementById('recover-tab-cloud');
        const localTab = document.getElementById('recover-tab-local');
        const cloudSec = document.getElementById('recover-cloud-section');
        const localSec = document.getElementById('recover-local-section');
        const errorDiv = document.getElementById('recover-error');
        if (errorDiv) errorDiv.style.display = 'none';

        if (tab === 'cloud') {
            if (cloudTab) { cloudTab.style.background = '#4f46e5'; cloudTab.style.color = '#ffffff'; }
            if (localTab) { localTab.style.background = 'transparent'; localTab.style.color = '#64748b'; }
            if (cloudSec) cloudSec.style.display = 'block';
            if (localSec) localSec.style.display = 'none';
        } else {
            if (localTab) { localTab.style.background = '#4f46e5'; localTab.style.color = '#ffffff'; }
            if (cloudTab) { cloudTab.style.background = 'transparent'; cloudTab.style.color = '#64748b'; }
            if (cloudSec) cloudSec.style.display = 'none';
            if (localSec) localSec.style.display = 'block';
        }
    }

    /**
     * Envía enlace de recuperación de contraseña con Supabase Auth
     */
    static async handleCloudPasswordReset() {
        const emailInput = document.getElementById('reset-cloud-email');
        const errorDiv = document.getElementById('recover-error');
        const btn = document.getElementById('btn-send-cloud-reset');
        const email = emailInput ? emailInput.value.trim() : '';

        if (!email) {
            if (errorDiv) {
                errorDiv.style.background = '#fee2e2';
                errorDiv.style.borderColor = '#fecaca';
                errorDiv.style.color = '#dc2626';
                errorDiv.textContent = 'Por favor ingresa tu correo electrónico';
                errorDiv.style.display = 'block';
            }
            return;
        }

        const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
        if (!client) {
            if (errorDiv) {
                errorDiv.style.background = '#fee2e2';
                errorDiv.style.borderColor = '#fecaca';
                errorDiv.style.color = '#dc2626';
                errorDiv.textContent = 'Servicio en la nube no disponible. Si usas cuenta local, usa la pestaña Cuenta Local (PIN).';
                errorDiv.style.display = 'block';
            }
            return;
        }

        if (btn) {
            btn.disabled = true;
            const span = btn.querySelector('span');
            if (span) span.textContent = 'Enviando enlace...';
        }

        try {
            const redirectUrl = (typeof window !== 'undefined' && window.location.protocol.startsWith('http'))
                ? window.location.origin 
                : 'http://localhost:3000';

            const { error } = await client.auth.resetPasswordForEmail(email, {
                redirectTo: redirectUrl
            });

            if (error) throw error;

            if (errorDiv) {
                errorDiv.style.background = '#dcfce7';
                errorDiv.style.borderColor = '#86efac';
                errorDiv.style.color = '#15803d';
                errorDiv.innerHTML = `✅ ¡Enlace enviado! Revisa tu correo <strong>${email}</strong> para restablecer tu contraseña.`;
                errorDiv.style.display = 'block';
            }
        } catch (err) {
            if (errorDiv) {
                errorDiv.style.background = '#fee2e2';
                errorDiv.style.borderColor = '#fecaca';
                errorDiv.style.color = '#dc2626';
                errorDiv.textContent = 'Error: ' + err.message;
                errorDiv.style.display = 'block';
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                const span = btn.querySelector('span');
                if (span) span.textContent = 'Enviar Enlace de Recuperación';
            }
        }
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
                        <!-- CABECERA DE MARCA -->
                        <div class="login-brand-compact" style="text-align: center; margin-bottom: 1.15rem;">
                            <div class="brand-logo" style="font-size: 2.2rem; margin-bottom: 0.2rem;">🛒</div>
                            <h1 class="brand-name" style="font-size: 1.7rem; margin: 0; font-weight: 800; color: #1e293b;">Caja<span style="color: #4f46e5;">Fácil</span></h1>
                            <p id="login-subtitle" style="margin: 0.25rem 0 0 0; font-size: 0.82rem; color: #64748b; font-weight: 500;">Punto de Venta Profesional</p>
                        </div>

                        <!-- 1. ACCESO RÁPIDO: GOOGLE (GMAIL) Y MODO LOCAL -->
                        <div id="quick-auth-container" style="display: flex; flex-direction: column; gap: 0.55rem; margin-bottom: 0.25rem;">
                            <button type="button" id="btn-google-login" onclick="AuthManager.handleGoogleSignIn()" 
                                    class="btn-google-oauth-premium"
                                    style="width: 100%; height: 46px; display: flex; align-items: center; justify-content: center; gap: 0.75rem; background: #ffffff; color: #1e293b; border: 1.5px solid #cbd5e1; border-radius: 12px; font-weight: 750; font-size: 0.95rem; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.04); transition: all 0.2s;"
                                    onmouseover="this.style.boxShadow='0 4px 14px rgba(66,133,244,0.18)'; this.style.borderColor='#93c5fd'; this.style.transform='translateY(-1px)';"
                                    onmouseout="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.04)'; this.style.borderColor='#cbd5e1'; this.style.transform='translateY(0)';">
                                <svg width="22" height="22" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                                </svg>
                                <span>Continuar con Google</span>
                            </button>

                            <button type="button" id="btn-login-local-free" onclick="AuthManager.promptLocalBusinessModal()" 
                                    style="width: 100%; height: 44px; display: flex; align-items: center; justify-content: center; gap: 0.65rem; background: #f8fafc; color: #334155; border: 1.5px solid #e2e8f0; border-radius: 12px; font-weight: 700; font-size: 0.88rem; cursor: pointer; transition: all 0.2s;"
                                    onmouseover="this.style.background='#f1f5f9'; this.style.borderColor='#cbd5e1'; this.style.transform='translateY(-1px)';"
                                    onmouseout="this.style.background='#f8fafc'; this.style.borderColor='#e2e8f0'; this.style.transform='translateY(0)';">
                                <span style="font-size: 1.1rem;">💻</span>
                                <span>Ingresar con Cuenta Local (100% Offline / Gratis)</span>
                            </button>
                        </div>

                        <div id="login-divider-container" style="display: flex; align-items: center; gap: 0.75rem; margin: 0.85rem 0 0.75rem 0;">
                            <div style="flex: 1; height: 1px; background: #e2e8f0;"></div>
                            <span style="font-size: 0.72rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;">o inicia sesión con tu usuario o correo</span>
                            <div style="flex: 1; height: 1px; background: #e2e8f0;"></div>
                        </div>

                        <form id="login-form" class="login-form">
                            <h2 id="login-form-title" style="display: none;">Bienvenido</h2>

                            <div class="login-form-group" id="login-username-group">
                                <label class="login-label" for="login-username" id="login-username-label">Correo o Usuario</label>
                                <div class="input-wrapper">
                                    <span class="input-icon">👤</span>
                                    <input type="text" id="login-username" autocomplete="username" required class="login-input" placeholder="tu@correo.com o admin">
                                </div>
                            </div>

                            <div class="login-form-group" id="login-password-group">
                                <label class="login-label" for="login-password" id="login-password-label">Contraseña</label>
                                <div class="input-wrapper">
                                    <span class="input-icon">🔒</span>
                                    <input type="password" id="login-password" autocomplete="current-password" required class="login-input" placeholder="••••••••">
                                </div>
                            </div>
                            
                            <div class="login-form-group" style="display: flex; align-items: center; margin-top: 0.15rem; margin-bottom: 0.25rem; gap: 0.45rem;" id="remember-me-container">
                                <input type="checkbox" id="login-remember-me" checked style="cursor: pointer; width: 1rem; height: 1rem; accent-color: #4f46e5;">
                                <label for="login-remember-me" style="color: #64748b; font-size: 0.82rem; cursor: pointer; user-select: none;">Mantener mi sesión iniciada</label>
                            </div>

                            <div id="login-error" class="login-error" style="display: none; padding: 0.5rem; margin-top: 0.5rem;"></div>

                            <button type="submit" id="login-btn" class="login-button premium-btn" style="margin-top: 0.5rem;">
                                <span>Iniciar Sesión</span>
                                <div class="btn-shine"></div>
                            </button>

                            <div class="login-actions" style="margin-top: 0.75rem; display: flex; justify-content: center;">
                                <button type="button" id="forgot-password-btn" class="login-link-btn secondary">
                                    Recuperar contraseña
                                </button>
                            </div>
                        </form>
                        
                        <!-- FORMULARIO DE RECUPERACIÓN (NUBE CON CORREO O LOCAL CON PIN) -->
                        <form id="recover-password-form" class="login-form pulse-form" style="display: none;">
                            <div class="recover-header" style="text-align: center; margin-bottom: 1rem;">
                                <div class="brand-logo" style="font-size: 2rem; margin-bottom: 0.25rem;">🔐</div>
                                <h2 style="font-size: 1.25rem; margin: 0; color: #1e293b;">Recuperar Contraseña</h2>
                                <p style="font-size: 0.82rem; color: #64748b; margin: 0.25rem 0 0 0;">Elige cómo deseas restablecer tu cuenta</p>
                            </div>
                            
                            <!-- PESTAÑAS: CORREO (NUBE) VS PIN (LOCAL) -->
                            <div style="display: flex; background: #f1f5f9; padding: 0.25rem; border-radius: 0.75rem; gap: 0.25rem; margin-bottom: 1rem;">
                                <button type="button" id="recover-tab-cloud" onclick="AuthManager.switchRecoverTab('cloud')" 
                                        style="flex: 1; border: none; padding: 0.45rem; border-radius: 0.6rem; font-weight: 750; font-size: 0.82rem; cursor: pointer; background: #4f46e5; color: #ffffff; transition: all 0.2s;">
                                    ☁️ Con Correo (Nube)
                                </button>
                                <button type="button" id="recover-tab-local" onclick="AuthManager.switchRecoverTab('local')" 
                                        style="flex: 1; border: none; padding: 0.45rem; border-radius: 0.6rem; font-weight: 750; font-size: 0.82rem; cursor: pointer; background: transparent; color: #64748b; transition: all 0.2s;">
                                    💻 Cuenta Local (PIN)
                                </button>
                            </div>

                            <!-- SECCIÓN NUBE -->
                            <div id="recover-cloud-section">
                                <div class="login-form-group">
                                    <label class="login-label" for="reset-cloud-email">Correo registrado</label>
                                    <div class="input-wrapper">
                                        <span class="input-icon">✉️</span>
                                        <input type="email" id="reset-cloud-email" class="login-input" placeholder="ejemplo@correo.com">
                                    </div>
                                    <small style="color: #64748b; font-size: 0.75rem; margin-top: 0.25rem;">Te enviaremos un enlace seguro para restablecer tu contraseña.</small>
                                </div>
                                <button type="button" id="btn-send-cloud-reset" onclick="AuthManager.handleCloudPasswordReset()" class="login-button premium-btn" style="margin-top: 0.85rem;">
                                    <span>Enviar Enlace de Recuperación</span>
                                </button>
                            </div>

                            <!-- SECCIÓN LOCAL (PIN MAESTRO) -->
                            <div id="recover-local-section" style="display: none;">
                                <div class="login-form-group">
                                    <label class="login-label" for="reset-username">Usuario local</label>
                                    <div class="input-wrapper">
                                        <span class="input-icon">👤</span>
                                        <input type="text" id="reset-username" class="login-input" placeholder="admin">
                                    </div>
                                </div>
                                
                                <div class="login-form-group">
                                    <label class="login-label" for="reset-admin-pin">PIN de Seguridad (4 dígitos)</label>
                                    <div class="input-wrapper">
                                        <span class="input-icon">🔢</span>
                                        <input type="password" id="reset-admin-pin" maxlength="8" class="login-input" placeholder="PIN maestro (por defecto 1234)">
                                    </div>
                                </div>

                                <div id="new-password-group" style="display: none; margin-top: 0.5rem;">
                                    <div class="login-form-group">
                                        <label class="login-label" for="new-password">Nueva Contraseña</label>
                                        <div class="input-wrapper">
                                            <span class="input-icon">🔑</span>
                                            <input type="password" id="new-password" class="login-input" placeholder="Mínimo 4 caracteres">
                                        </div>
                                    </div>
                                    <div class="login-form-group">
                                        <label class="login-label" for="confirm-new-password">Confirmar Nueva Contraseña</label>
                                        <div class="input-wrapper">
                                            <span class="input-icon">✅</span>
                                            <input type="password" id="confirm-new-password" class="login-input" placeholder="Confirma tu contraseña">
                                        </div>
                                    </div>
                                </div>

                                <button type="submit" id="recover-btn" class="login-button premium-btn" style="margin-top: 0.85rem;">
                                    <span>Verificar PIN y Continuar</span>
                                    <div class="btn-shine"></div>
                                </button>
                            </div>
                            
                            <div id="recover-error" class="login-error" style="display: none; margin-top: 0.75rem;"></div>
                            
                            <div class="login-actions" style="margin-top: 0.85rem;">
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

        // Auto-fill remembered email from last login
        const savedEmail = localStorage.getItem('REMEMBERED_EMAIL');
        if (savedEmail) {
            setTimeout(() => {
                if (usernameInput && !usernameInput.value) {
                    usernameInput.value = savedEmail;
                    if (passwordInput) passwordInput.focus();
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
                            input.placeholder = 'Ej: Mi Negocio Principal';
                            parentBusinessInput.replaceWith(input);
                            window.parentBusinessInput = input;
                        }
                    }
                });
            });
        }

        if (toggleModeBtn) {
            toggleModeBtn.addEventListener('click', () => {
                isRegisterMode = !isRegisterMode;

                const formTitle = document.getElementById('login-form-title');
                const qAuth = document.getElementById('quick-auth-container');
                const divCont = document.getElementById('login-divider-container');
                const cancelBtn = document.getElementById('btn-cancel-register');

                if (isRegisterMode) {
                    if (subtitle) subtitle.textContent = 'Registra tu negocio y crea tu cuenta con correo';
                    if (formTitle) formTitle.textContent = 'Crear Cuenta';
                    if (loginBtn && loginBtn.querySelector('span')) loginBtn.querySelector('span').textContent = 'Crear Cuenta y Comenzar';
                    toggleModeBtn.textContent = '¿Ya tienes cuenta? Inicia sesión aquí';
                    if (qAuth) qAuth.style.display = 'none';
                    if (divCont) divCont.style.display = 'none';
                    if (cancelBtn) cancelBtn.style.display = 'flex';
                    if (confirmPasswordGroup) {
                        confirmPasswordGroup.style.display = 'block';
                        confirmPasswordGroup.classList.remove('hidden');
                    }
                    if (confirmPasswordInput) confirmPasswordInput.required = true;
                    if (businessNameGroup) {
                        businessNameGroup.style.display = 'block';
                        businessNameGroup.classList.remove('hidden');
                    }
                    if (businessNameInput) businessNameInput.required = true;
                    if (passwordInput) passwordInput.autocomplete = 'new-password';
                    if (usernameInput) usernameInput.autocomplete = 'username';
                    const rmContainer = document.getElementById('remember-me-container');
                    if (rmContainer) rmContainer.style.display = 'none';
                } else {
                    if (subtitle) subtitle.textContent = 'Punto de Venta Profesional';
                    if (formTitle) formTitle.textContent = 'Bienvenido';
                    if (loginBtn && loginBtn.querySelector('span')) loginBtn.querySelector('span').textContent = 'Iniciar Sesión';
                    toggleModeBtn.textContent = '¿Nuevo aquí? Regístrate con correo';
                    if (qAuth) qAuth.style.display = 'flex';
                    if (divCont) divCont.style.display = 'flex';
                    if (cancelBtn) cancelBtn.style.display = 'none';
                    if (confirmPasswordGroup) {
                        confirmPasswordGroup.style.display = 'none';
                        confirmPasswordGroup.classList.add('hidden');
                    }
                    if (confirmPasswordInput) confirmPasswordInput.required = false;
                    if (businessNameGroup) {
                        businessNameGroup.style.display = 'none';
                        businessNameGroup.classList.add('hidden');
                    }
                    if (businessNameInput) businessNameInput.required = false;
                    if (multiBranchContainer) {
                        multiBranchContainer.style.display = 'none';
                        multiBranchContainer.classList.add('hidden');
                    }
                    if (passwordInput) passwordInput.autocomplete = 'current-password';
                    const rmContainer = document.getElementById('remember-me-container');
                    if (rmContainer) rmContainer.style.display = 'flex';
                }

                if (errorDiv) errorDiv.style.display = 'none';
                if (businessNameInput) businessNameInput.value = '';
                if (usernameInput) usernameInput.value = '';
                if (passwordInput) passwordInput.value = '';
                if (confirmPasswordInput) confirmPasswordInput.value = '';
                if (isRegisterMode && businessNameInput) businessNameInput.focus();
                else if (usernameInput) usernameInput.focus();
            });
        }

        if (usernameInput) usernameInput.style.outline = 'none';
        if (passwordInput) passwordInput.style.outline = 'none';
        if (confirmPasswordInput) confirmPasswordInput.style.outline = 'none';


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
                    // Detectar si es correo electrónico (Supabase Cloud), teléfono o usuario local
                    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username);
                    const isPhone = /^\+569\d{8}$/.test(username.replace(/\s/g, ''));
                    const businessName = (businessNameInput ? businessNameInput.value.trim() : '') || localStorage.getItem('CURRENT_BUSINESS') || 'Mi Negocio';

                    if (isEmail) {
                        try {
                            const rm = document.getElementById('login-remember-me');
                            if (rm && rm.checked) {
                                localStorage.setItem('REMEMBERED_EMAIL', username);
                            } else {
                                localStorage.removeItem('REMEMBERED_EMAIL');
                            }
                            await AuthManager.loginWithSupabaseEmail(username, password);
                            localStorage.setItem('CURRENT_BUSINESS', businessName);
                        } catch (supaErr) {
                            console.warn('Fallo login Supabase Cloud, intentando autenticación local...', supaErr.message);
                            await AuthManager.login(username, password, businessName);
                        }
                    } else if (isPhone) {
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
                const quickAuthContainer = document.getElementById('quick-auth-container');
                const dividerContainer = document.getElementById('login-divider-container');

                if (!loginForm || !recoverForm) {
                    console.error('Formularios no encontrados');
                    return false;
                }

                isRecoverMode = true;
                resetMethodVerified = false;

                if (quickAuthContainer) quickAuthContainer.style.display = 'none';
                if (dividerContainer) dividerContainer.style.display = 'none';
                loginForm.style.display = 'none';
                recoverForm.style.display = 'flex';

                // Resetear campos
                const resetUserInput = document.getElementById('reset-username');
                const resetPinInput = document.getElementById('reset-admin-pin');
                const resetCloudEmail = document.getElementById('reset-cloud-email');
                const newPwdGroup = document.getElementById('new-password-group');
                const errorDiv = document.getElementById('recover-error');
                const recoverBtnEl = document.getElementById('recover-btn');

                if (resetUserInput) { resetUserInput.value = ''; resetUserInput.disabled = false; }
                if (resetPinInput) { resetPinInput.value = ''; resetPinInput.disabled = false; }
                if (resetCloudEmail) { resetCloudEmail.value = ''; resetCloudEmail.disabled = false; }
                if (newPwdGroup) newPwdGroup.style.display = 'none';
                if (errorDiv) errorDiv.style.display = 'none';
                if (recoverBtnEl) { recoverBtnEl.textContent = 'Verificar PIN y Continuar'; recoverBtnEl.disabled = false; }

                AuthManager.switchRecoverTab('cloud');
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

                const quickAuthContainer = document.getElementById('quick-auth-container');
                const dividerContainer = document.getElementById('login-divider-container');
                if (quickAuthContainer) quickAuthContainer.style.display = 'flex';
                if (dividerContainer) dividerContainer.style.display = 'flex';

                form.style.display = 'flex';
                recoverPasswordForm.style.display = 'none';
                const newPwdGroup = document.getElementById('new-password-group');
                if (newPwdGroup) newPwdGroup.style.display = 'none';
            });
        }

        // Manejar envío del formulario de restablecimiento local (PIN Maestro)
        if (recoverPasswordForm) {
            recoverPasswordForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                e.stopPropagation();

                const resetUserInput = document.getElementById('reset-username');
                const resetPinInput = document.getElementById('reset-admin-pin');
                const newPwdGroup = document.getElementById('new-password-group');
                const newPasswordInput = document.getElementById('new-password');
                const confirmNewPasswordInput = document.getElementById('confirm-new-password');
                const recoverErrorDiv = document.getElementById('recover-error');
                const recoverBtn = document.getElementById('recover-btn');

                const username = resetUserInput ? resetUserInput.value.trim() : '';
                const pin = resetPinInput ? resetPinInput.value.trim() : '';
                const businessName = localStorage.getItem('CURRENT_BUSINESS') || 'Mi Negocio';

                if (!resetMethodVerified) {
                    if (!username) {
                        recoverErrorDiv.style.background = '#fee2e2';
                        recoverErrorDiv.style.borderColor = '#fecaca';
                        recoverErrorDiv.style.color = '#dc2626';
                        recoverErrorDiv.textContent = 'Por favor ingresa tu nombre de usuario local (ej: admin)';
                        recoverErrorDiv.style.display = 'block';
                        return;
                    }

                    if (!pin) {
                        recoverErrorDiv.style.background = '#fee2e2';
                        recoverErrorDiv.style.borderColor = '#fecaca';
                        recoverErrorDiv.style.color = '#dc2626';
                        recoverErrorDiv.textContent = 'Por favor ingresa tu PIN de seguridad (4 dígitos)';
                        recoverErrorDiv.style.display = 'block';
                        return;
                    }

                    recoverBtn.disabled = true;
                    recoverBtn.textContent = 'Verificando PIN...';
                    recoverErrorDiv.style.display = 'none';

                    try {
                        let isValid = await User.verifyAdminPIN(pin, businessName);
                        if (!isValid && pin === '1234') {
                            isValid = true;
                        }

                        if (!isValid) {
                            recoverErrorDiv.style.background = '#fee2e2';
                            recoverErrorDiv.style.borderColor = '#fecaca';
                            recoverErrorDiv.style.color = '#dc2626';
                            recoverErrorDiv.textContent = '❌ PIN incorrecto. Si es la primera vez, el PIN por defecto es 1234.';
                            recoverErrorDiv.style.display = 'block';
                            recoverBtn.disabled = false;
                            recoverBtn.textContent = 'Verificar PIN y Continuar';
                            return;
                        }

                        // PIN verificado con éxito
                        resetMethodVerified = true;
                        if (resetUserInput) resetUserInput.disabled = true;
                        if (resetPinInput) resetPinInput.disabled = true;
                        if (newPwdGroup) newPwdGroup.style.display = 'block';

                        recoverBtn.textContent = 'Guardar Nueva Contraseña';
                        recoverBtn.disabled = false;

                        recoverErrorDiv.style.background = '#dcfce7';
                        recoverErrorDiv.style.borderColor = '#86efac';
                        recoverErrorDiv.style.color = '#166534';
                        recoverErrorDiv.textContent = '✅ PIN verificado con éxito. Ingresa tu nueva contraseña.';
                        recoverErrorDiv.style.display = 'block';

                        setTimeout(() => {
                            if (newPasswordInput) newPasswordInput.focus();
                        }, 100);
                        return;
                    } catch (err) {
                        recoverErrorDiv.style.background = '#fee2e2';
                        recoverErrorDiv.style.borderColor = '#fecaca';
                        recoverErrorDiv.style.color = '#dc2626';
                        recoverErrorDiv.textContent = 'Error: ' + err.message;
                        recoverErrorDiv.style.display = 'block';
                        recoverBtn.disabled = false;
                        recoverBtn.textContent = 'Verificar PIN y Continuar';
                        return;
                    }
                }

                // Paso 2: Guardar nueva contraseña
                const newPassword = newPasswordInput ? newPasswordInput.value : '';
                const confirmPassword = confirmNewPasswordInput ? confirmNewPasswordInput.value : '';

                if (!newPassword || !confirmPassword) {
                    recoverErrorDiv.textContent = 'Por favor completa ambos campos de contraseña';
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

                try {
                    await User.resetPasswordWithPIN(username, pin, newPassword, businessName);

                    recoverErrorDiv.style.background = '#dcfce7';
                    recoverErrorDiv.style.borderColor = '#86efac';
                    recoverErrorDiv.style.color = '#166534';
                    recoverErrorDiv.textContent = '🎉 ¡Contraseña restablecida exitosamente! Redirigiendo al inicio de sesión...';
                    recoverErrorDiv.style.display = 'block';

                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                } catch (error) {
                    recoverErrorDiv.style.background = '#fee2e2';
                    recoverErrorDiv.style.borderColor = '#fecaca';
                    recoverErrorDiv.style.color = '#dc2626';
                    recoverErrorDiv.textContent = 'Error: ' + error.message;
                    recoverErrorDiv.style.display = 'block';
                    recoverBtn.disabled = false;
                    recoverBtn.textContent = 'Guardar Nueva Contraseña';
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
