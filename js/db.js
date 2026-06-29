// =====================================================
// JWT HELPER - Inyección automática de Token en API
// =====================================================
(function() {
    const originalFetch = window.fetch;
    window.fetch = function(url, options = {}) {
        if (typeof url === 'string' && url.includes('/api/') && !url.includes('/auth/login') && !url.includes('/auth/register')) {
            const token = localStorage.getItem('AUTH_TOKEN');
            if (token) {
                options.headers = options.headers || {};
                if (options.headers instanceof Headers) options.headers.set('Authorization', 'Bearer ' + token);
                else options.headers['Authorization'] = 'Bearer ' + token;
            }
        }
        return originalFetch.call(this, url, options);
    };
    console.log('🛡️ [Auth] JWT Interceptor activado (Standalone Mode)');
})();

/**
 * DATABASE MANAGER (V3.0 - Standalone Expert Edition)
 * Optimizado para SQLite local con fallback a IndexedDB.
 * Removida lógica de multi-tenancy SaaS innecesaria para el cliente.
 */
class Database {
    constructor() {
        this.dbName = 'POSMinimarket';
        this.version = 23;
        this.db = null;
        this.cache = {}; 
        this.CACHE_TTL = 10 * 1000;
        this.mode = 'sqlite';
        this._initPromise = null;
    }

    async init() {
        if (this._initPromise) return this._initPromise;
        this._initPromise = this._doInit();
        return this._initPromise;
    }

    async _doInit() {
        if (this.mode === 'sqlite') {
            let attempts = 0;
            const maxAttempts = 10; // Aumentado a 10 intentos para dar tiempo al servidor
            const baseUrl = window.API_CONFIG?.BASE_URL || 'http://localhost:3000';
            
            console.log('🔍 Iniciando conexión con SQLite local...');
            
            while (attempts < maxAttempts) {
                try {
                    const response = await fetch(`${baseUrl}/api/status`);
                    if (response.ok) {
                        console.log(`✅ Conector SQLite Local Listo (intento ${attempts + 1})`);
                        this.mode = 'sqlite';
                        // Verificar si es primera instalación (DB vacía) para mostrar hint en login
                        try {
                            const setupResp = await fetch(`${baseUrl}/api/system/setup-status`);
                            if (setupResp.ok) {
                                const setupData = await setupResp.json();
                                window.FIRST_INSTALL = setupData.needsSetup || setupData.isFirstInstall;
                                if (window.FIRST_INSTALL) {
                                    console.log('🆕 [Setup] Primera instalación detectada. Se usarán credenciales por defecto.');
                                }
                            }
                        } catch(se) { /* no crítico */ }
                        return true;
                    }
                } catch (e) {
                    attempts++;
                    if (attempts < maxAttempts) {
                        console.log(`⏳ Buscando Motor SQLite... reintento ${attempts}/${maxAttempts}`);
                        await new Promise(r => setTimeout(r, 1000)); 
                    }
                }
            }
            
            console.error('❌ CRÍTICO: No se pudo conectar con el servidor local (SQLite).');
            // En vez de cambiar silenciosamente, lanzamos una advertencia global que la UI pueda capturar
            window.SQLITE_FAILED = true;
            
            // Fallback solo como último recurso pero avisando
            console.warn('⚠️ Cambiando a Modo Navegador (IndexedDB) temporalmente. LOS DATOS PUEDEN SER DIFERENTES.');
            this.mode = 'indexeddb';
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            request.onsuccess = () => { this.db = request.result; resolve(this.db); };
            request.onerror = () => reject(request.error);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const stores = ['products', 'categories', 'sales', 'customers', 'suppliers', 'purchases', 'cashRegisters', 
                              'cashMovements', 'stockMovements', 'settings', 'users', 'auditLogs', 'expenses', 
                              'saleReturns', 'supplierPayments', 'customerCreditDeposits', 'customerCreditUses', 
                              'productPriceHistory', 'offlineQueue', 'payments', 'passwordResets', 'debtPaymentSessions', 'productCostHistory'];
                
                stores.forEach(s => {
                    let store;
                    if (!db.objectStoreNames.contains(s)) {
                        store = db.createObjectStore(s, { keyPath: 'id', autoIncrement: true });
                    } else {
                        store = event.currentTarget.transaction.objectStore(s);
                    }

                    // Crear Índices Críticos si no existen
                    if (s === 'cashRegisters' && !store.indexNames.contains('status')) {
                        store.createIndex('status', 'status', { unique: false });
                    }
                    if (s === 'sales') {
                        if (!store.indexNames.contains('date')) store.createIndex('date', 'date', { unique: false });
                        if (!store.indexNames.contains('customerId')) store.createIndex('customerId', 'customerId', { unique: false });
                        if (!store.indexNames.contains('status')) store.createIndex('status', 'status', { unique: false });
                    }
                    if (s === 'payments') {
                        if (!store.indexNames.contains('saleId')) store.createIndex('saleId', 'saleId', { unique: false });
                        if (!store.indexNames.contains('cashRegisterId')) store.createIndex('cashRegisterId', 'cashRegisterId', { unique: false });
                        if (!store.indexNames.contains('date')) store.createIndex('date', 'date', { unique: false });
                    }
                    if (s === 'stockMovements' && !store.indexNames.contains('productId')) {
                        store.createIndex('productId', 'productId', { unique: false });
                    }
                    if (s === 'cashMovements') {
                        if (!store.indexNames.contains('paymentId')) store.createIndex('paymentId', 'paymentId', { unique: false });
                        if (!store.indexNames.contains('cashRegisterId')) store.createIndex('cashRegisterId', 'cashRegisterId', { unique: false });
                        if (!store.indexNames.contains('type')) store.createIndex('type', 'type', { unique: false });
                    }
                    if (s === 'products') {
                        if (!store.indexNames.contains('category')) store.createIndex('category', 'category', { unique: false });
                        if (!store.indexNames.contains('barcode')) store.createIndex('barcode', 'barcode', { unique: false });
                    }
                });
                console.log('📦 [IndexedDB] Esquema sincronizado y optimizado (V23).');
            };
        });
    }

    // --- ACCESO A DATOS (ABSTRACCIÓN) ---

    async get(storeName, id) {
        if (this.mode === 'sqlite') {
            const cacheKey = `${storeName}_${id}`;
            if (this.cache[cacheKey] && (Date.now() - this.cache[cacheKey].t < this.CACHE_TTL)) return this.cache[cacheKey].d;
            
            const data = await window.ApiClient.get(`${storeName}/${id}`);
            this.cache[cacheKey] = { d: data, t: Date.now() };
            return data;
        }
        return new Promise(r => {
            this.db.transaction(storeName).objectStore(storeName).get(Number(id) || id).onsuccess = (e) => r(e.target.result);
        });
    }

    async getAll(storeName, params = {}) {
        if (this.mode === 'sqlite') {
            const cacheKey = `${storeName}_all_${JSON.stringify(params)}`;
            if (this.cache[cacheKey] && (Date.now() - this.cache[cacheKey].t < this.CACHE_TTL)) return this.cache[cacheKey].d;

            const data = await window.ApiClient.get(storeName, params);
            const arrayData = Array.isArray(data) ? data : [];
            this.cache[cacheKey] = { d: arrayData, t: Date.now() };
            return arrayData;
        }
        return new Promise(r => {
            this.db.transaction(storeName).objectStore(storeName).getAll().onsuccess = (e) => r(e.target.result);
        });
    }

    async findByIndex(storeName, indexName, value, params = {}) {
        if (this.mode === 'sqlite') {
            // Transformar consulta de índice a query SQL automática
            const queryParams = { ...params, [indexName]: value };
            return await this.getAll(storeName, queryParams);
        }
        return new Promise(r => {
            const index = this.db.transaction(storeName).objectStore(storeName).index(indexName);
            index.getAll(value).onsuccess = (e) => r(e.target.result);
        });
    }

    async findByIndexRange(storeName, indexName, lower, upper, params = {}) {
        if (this.mode === 'sqlite') {
            // Operadores de rango mapeados al backend (_gte, _lte)
            const queryParams = { 
                ...params, 
                [`${indexName}_gte`]: lower, 
                [`${indexName}_lte`]: upper 
            };
            return await this.getAll(storeName, queryParams);
        }
        return new Promise(r => {
            const range = IDBKeyRange.bound(lower, upper);
            this.db.transaction(storeName).objectStore(storeName).index(indexName)
                   .getAll(range).onsuccess = (e) => r(e.target.result);
        });
    }

    // Aliases for compatibility
    async getByIndex(storeName, indexName, value, params = {}) {
        return await this.findByIndex(storeName, indexName, value, params);
    }

    async getByIndexRange(storeName, indexName, lower, upper, params = {}) {
        return await this.findByIndexRange(storeName, indexName, lower, upper, params);
    }

    async add(storeName, data) {
        this.clearCache(storeName);
        if (this.mode === 'sqlite') {
            const res = await window.ApiClient.post(storeName, data);
            return res.id || res;
        }
        return new Promise(r => {
            const req = this.db.transaction(storeName, 'readwrite').objectStore(storeName).add(data);
            req.onsuccess = (e) => r(e.target.result);
        });
    }

    async put(storeName, data) {
        this.clearCache(storeName);
        if (this.mode === 'sqlite') {
            const pk = (storeName === 'settings') ? 'key' : 'id';
            return await window.ApiClient.put(storeName, data[pk], data);
        }
        return new Promise(r => {
            this.db.transaction(storeName, 'readwrite').objectStore(storeName).put(data).onsuccess = (e) => r(e.target.result);
        });
    }

    async delete(storeName, id) {
        this.clearCache(storeName);
        if (this.mode === 'sqlite') return await window.ApiClient.delete(storeName, id);
        return new Promise(r => {
            this.db.transaction(storeName, 'readwrite').objectStore(storeName).delete(Number(id) || id).onsuccess = () => r(true);
        });
    }

    clearCache(storeName = null) {
        if (storeName) {
            Object.keys(this.cache).forEach(k => { if (k.startsWith(storeName)) delete this.cache[k]; });
        } else {
            this.cache = {};
        }
    }

    /** Invalida caché de datos críticos del POS tras sync remota */
    async warmCache() {
        ['products', 'customers', 'sales', 'categories'].forEach(s => this.clearCache(s));
    }

    async search(storeName, term) {
        if (this.mode === 'sqlite') {
            // C5: Búsqueda nativa en servidor para SQLite (Mucho más rápido)
            const results = await window.ApiClient.get(`${storeName}/search`, { q: term });
            return Array.isArray(results) ? results : [];
        }
        
        const all = await this.getAll(storeName);
        if (!term) return all;
        const lowerTerm = term.toLowerCase();
        
        const filtered = all.filter(item => {
            return Object.values(item).some(val => 
                val && typeof val === 'string' && val.toLowerCase().includes(lowerTerm)
            );
        });

        // 2. Ordenar por relevancia estratégica
        return filtered.sort((a, b) => {
            const aName = (a.name || '').toLowerCase();
            const bName = (b.name || '').toLowerCase();

            // Prioridad 1: NOMBRE EXACTO (ej: "Pan")
            if (aName === lowerTerm && bName !== lowerTerm) return -1;
            if (bName === lowerTerm && aName !== lowerTerm) return 1;

            // Prioridad 2: NOMBRE EMPIEZA POR (ej: "Pan amasado" antes que "Empanada")
            const aStarts = aName.startsWith(lowerTerm);
            const bStarts = bName.startsWith(lowerTerm);
            if (aStarts && !bStarts) return -1;
            if (bStarts && !aStarts) return 1;

            // Prioridad 3: Coincidencia exacta en otros campos (como código de barras o categoría)
            const aExactOther = Object.values(a).some(v => v && typeof v === 'string' && v.toLowerCase() === lowerTerm);
            const bExactOther = Object.values(b).some(v => v && typeof v === 'string' && v.toLowerCase() === lowerTerm);
            if (aExactOther && !bExactOther) return -1;
            if (bExactOther && !aExactOther) return 1;

            // Prioridad 4: Si ambos empiezan igual, orden alfabético por nombre
            if (aStarts && bStarts) return aName.localeCompare(bName);

            return 0;
        });
    }

    async query(storeName, filterFn) {
        const all = await this.getAll(storeName);
        return all.filter(filterFn);
    }

    async clear(storeName) {
        if (this.mode === 'sqlite') {
            console.warn(`Operación 'clear' no implementada para SQLite en tabla ${storeName}`);
            return true;
        }
        return new Promise(r => {
            this.db.transaction(storeName, 'readwrite').objectStore(storeName).clear().onsuccess = () => r(true);
        });
    }

    async count(storeName) {
        const all = await this.getAll(storeName);
        return all.length;
    }

    async wipeAll() {
        if (this.mode === 'sqlite') {
            await window.ApiClient.post('system/factory-reset', {}); // Si no existe, al menos limpia local
            localStorage.clear();
            window.location.reload();
            return true;
        }
        return new Promise(r => {
            if (this.db) this.db.close();
            indexedDB.deleteDatabase(this.dbName).onsuccess = () => { localStorage.clear(); r(true); };
        });
    }
}

// Inicialización global (app.js también llama init — idempotente)
window.db = new Database();
