const ApiClient = {
    // Timeout helper to avoid infinite hangs (e.g. if server or network is slow/dead)
    async fetchWithTimeout(resource, options = {}) {
        const { timeout = 10000 } = options;
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(resource, {
            ...options,
            cache: 'no-store', // Desactivar caché del navegador para datos frescos
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    },

    getHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        const token = localStorage.getItem('AUTH_TOKEN') || sessionStorage.getItem('AUTH_TOKEN');
        const businessId = localStorage.getItem('BUSINESS_ID') || sessionStorage.getItem('BUSINESS_ID');
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (businessId) headers['x-business-id'] = businessId;
        return headers;
    },

    async get(endpoint, params = {}) {
        const url = new URL(`${window.API_CONFIG.API_URL}/${endpoint}`);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        
        // C10: Cache-buster para asegurar datos frescos en tiempo real (Saldos, Stock, etc)
        url.searchParams.append('_t', Date.now());

        const response = await this.fetchWithTimeout(url, {
            headers: this.getHeaders()
        });
        if (!response.ok) await this.handleError(response);
        return await response.json();
    },

    async post(endpoint, data, isSync = false, options = {}) {
        // BLINDAJE 100% OFFLINE: Siempre intentar conexión local. 
        // Solo guardamos en cola si el servidor local falla realmente (catch), no por falta de internet.
        
        if (endpoint === 'auth/login') console.log('📡 [API] Enviando petición de login a:', `${window.API_CONFIG.API_URL}/${endpoint}`);
        const response = await this.fetchWithTimeout(`${window.API_CONFIG.API_URL}/${endpoint}`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(data),
            ...options
        });
        if (!response.ok) await this.handleError(response);
        const resData = await response.json();
        if (typeof app !== 'undefined' && app.lastServerActivity !== undefined) {
            app.lastServerActivity = Date.now();
        }
        return resData;
    },

    async put(endpoint, id, data) {
        const url = id ? `${window.API_CONFIG.API_URL}/${endpoint}/${id}` : `${window.API_CONFIG.API_URL}/${endpoint}`;
        const response = await this.fetchWithTimeout(url, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        if (!response.ok) await this.handleError(response);
        const resData = await response.json();
        if (typeof app !== 'undefined' && app.lastServerActivity !== undefined) {
            app.lastServerActivity = Date.now();
        }
        return resData;
    },

    async delete(endpoint, id) {
        const response = await this.fetchWithTimeout(`${window.API_CONFIG.API_URL}/${endpoint}/${id}`, {
            method: 'DELETE',
            headers: this.getHeaders()
        });
        if (!response.ok) await this.handleError(response);
        const resData = await response.json();
        if (typeof app !== 'undefined' && app.lastServerActivity !== undefined) {
            app.lastServerActivity = Date.now();
        }
        return resData;
    },

    async handleError(response) {
        let errorMsg = response.statusText;
        let errorData = {};
        try {
            errorData = await response.json();
            if (errorData && errorData.error) errorMsg = errorData.error;
        } catch (e) { }

        if (response.status === 401) {
            console.warn('Sesión expirada o inválida. Verificando estado de autenticación...');
            
            // Si hay sesión activa en Supabase Auth, intentar re-vincular sesión silenciosa antes de limpiar
            const hasSupabaseSession = localStorage.getItem('SUPABASE_ACCESS_TOKEN') || localStorage.getItem('PMV_USER_ID');
            if (hasSupabaseSession && typeof Auth !== 'undefined' && typeof Auth.checkOAuthCallback === 'function') {
                try {
                    const restored = await Auth.checkOAuthCallback();
                    if (restored) return;
                } catch(reAuthErr) {}
            }

            localStorage.removeItem('AUTH_TOKEN');
            sessionStorage.removeItem('AUTH_TOKEN');
            localStorage.removeItem('pos_current_user');
            sessionStorage.removeItem('pos_current_user');
            
            if (window.AuthManager && typeof window.AuthManager.showLogin === 'function') {
                setTimeout(() => { window.AuthManager.showLogin(); }, 150);
            }
        }

        if (response.status === 402) {
            const banner = document.getElementById('subscription-banner');
            if (banner) {
                banner.style.display = 'block';
                banner.querySelector('.banner-text').textContent = errorData.message || 'Suscripción vencida. Por favor renueve su acceso.';
            }
        }

        throw new Error(errorMsg);
    }
};

window.ApiClient = ApiClient;
