/**
 * SyncService — Motor de Sincronización Reactivo en Tiempo Real con Supabase (PC ⟷ Mobile)
 * Tablas sincronizadas: products, sales, customers, suppliers, purchases, cash_registers, expenses, cash_movements, staff
 * Arquitectura: Event-Driven + Realtime WebSockets + RPC Atómico de Stock (Anti Lost-Updates)
 */

class SyncService {
    static isSyncing = false;
    static lastSyncTime = null;
    static timerId = null;
    static intervalMs = 12 * 60 * 60 * 1000; // Respaldo periódico cada 12 horas para planes PRO
    static _suppressRealtimeUntil = 0;
    static _realtimeChannel = null;
    static _realtimeDebounceTimer = null;
    static _autoSyncDebounceTimer = null;
    static _isRealtimeSubscribed = false;
    static _reconnectTimeout = null;
    static _reconnectAttempts = 0;
    static _recentlyPushedIds = new Set();
    static _syncBackoffAttempt = 0;

    /**
     * Registra un identificador emitido recientemente para blindar contra eco Realtime
     */
    static recordPushedId(id) {
        if (!id) return;
        this._recentlyPushedIds.add(String(id));
        setTimeout(() => {
            this._recentlyPushedIds.delete(String(id));
        }, 10000); // 10 segundos de ventana anti-eco
    }

    /**
     * Identificador único y persistente por terminal / computadora
     */
    static getTerminalId() {
        let tid = localStorage.getItem('TERMINAL_ID');
        if (!tid) {
            tid = 'term_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
            localStorage.setItem('TERMINAL_ID', tid);
        }
        return tid;
    }

    /**
     * Envía una señal ligera de broadcast a todas las computadoras conectadas
     */
    static async sendBroadcastSignal(reason = 'general') {
        if (!this._realtimeChannel || !this._isRealtimeSubscribed) return;
        try {
            await this._realtimeChannel.send({
                type: 'broadcast',
                event: 'sync_signal',
                payload: {
                    senderId: this.getTerminalId(),
                    businessId: this.getCurrentBusinessId(),
                    reason,
                    timestamp: Date.now()
                }
            });
            console.log(`📡 [Realtime Broadcast] Señal emitida (${reason})`);
        } catch (e) {
            console.warn('⚠️ [SyncService] Error enviando broadcast:', e.message);
        }
    }

    /**
     * Inicializa el servicio, conecta el canal Realtime y activa listeners de red y foco
     */
    static init() {
        if (this.timerId) clearInterval(this.timerId);

        const hasCloudSession = Boolean(localStorage.getItem('SUPABASE_ACCESS_TOKEN') || sessionStorage.getItem('SUPABASE_ACCESS_TOKEN'));
        // ponytail: Si hay sesión iniciada en Supabase, habilitamos Realtime en vivo para sincronización multi-terminal ultrarrápida.
        const canLiveSync = Boolean(hasCloudSession);
        const canBackup = Boolean(hasCloudSession || (typeof LicenseService !== 'undefined' && LicenseService.canBackup()));

        // 1. MODO LOCAL OFFLINE ESTRICTO (Plan FREE o sin sesión Supabase)
        if (!hasCloudSession) {
            this.updateUI('offline', 'Modo Local Offline (Sin Nube)');
            console.log('💻 [SyncService] Operando en Modo Local 100% Offline (SQLite local sin nube).');
            return;
        }

        // 2. ACTUALIZAR UI PARA CONEXIÓN A LA NUBE
        this.updateUI(navigator.onLine ? 'synced' : 'offline');

        // 3. CANAL REALTIME WEBSOCKET: Activo siempre que haya sesión en Supabase y conexión a internet
        if (canLiveSync) {
            setTimeout(() => {
                if (navigator.onLine) {
                    this.initRealtime();
                }
            }, 1000);
        }

        // Escuchar eventos de red
        window.addEventListener('online', async () => {
            const hasCloud = Boolean(localStorage.getItem('SUPABASE_ACCESS_TOKEN') || sessionStorage.getItem('SUPABASE_ACCESS_TOKEN'));
            if (!hasCloud) {
                this.updateUI('offline', 'Modo Local Offline');
                return;
            }
            console.log('🌐 [SyncService] Conexión a internet detectada.');
            this.updateUI('synced');
            this.initRealtime();
            await SyncService.syncPendingOfflineChanges();
        });

        window.addEventListener('beforeunload', () => {
            const client = this.getClient();
            if (this._realtimeChannel && client) {
                try { client.removeChannel(this._realtimeChannel); } catch (_) {}
            }
        });

        window.addEventListener('offline', () => {
            const hasCloud = Boolean(localStorage.getItem('SUPABASE_ACCESS_TOKEN') || sessionStorage.getItem('SUPABASE_ACCESS_TOKEN'));
            if (!hasCloud) {
                this.updateUI('offline', 'Modo Local Offline');
            } else {
                console.log('📡 [SyncService] Sin conexión temporal a internet.');
                this.updateUI('offline', 'Sin Internet (Respaldos en pausa)');
            }
        });

        // ponytail: Se elimina la sincronización por 'focus' de la ventana para que la app esté 100% en reposo pasivo.

        // Ciclo de respaldo periódico programado cada 12 horas
        this.timerId = setInterval(() => {
            if (document.querySelector('.modal') || document.body.classList.contains('modal-open')) {
                return;
            }
            const hasCloud = Boolean(localStorage.getItem('SUPABASE_ACCESS_TOKEN') || sessionStorage.getItem('SUPABASE_ACCESS_TOKEN'));
            if (navigator.onLine && hasCloud) {
                console.log('⏰ [SyncService] Disparando respaldo periódico programado (12h)...');
                this.syncAll(false);
            }
        }, this.intervalMs);

        console.log('☁️ [SyncService] Motor de respaldos inicializado.');
    }

    /**
     * Dispara una sincronización inmediata con debounce (Event-Driven)
     * Invocado tras ventas, creación/edición de productos, arqueos y gastos.
     */
    static triggerAutoSync(delayMs = 800) {
        if (!navigator.onLine) return;
        const hasCloud = Boolean(localStorage.getItem('SUPABASE_ACCESS_TOKEN') || sessionStorage.getItem('SUPABASE_ACCESS_TOKEN'));
        if (!hasCloud) return;
        if (this._autoSyncDebounceTimer) clearTimeout(this._autoSyncDebounceTimer);

        // ponytail: Reducir delay a 800ms para reflejar ventas y mutaciones casi al segundo
        const effectiveDelay = Math.max(Number(delayMs) || 0, 800);

        this._autoSyncDebounceTimer = setTimeout(async () => {
            try {
                console.log('⚡ [SyncService] Auto-sync reactivo activado por mutación local.');
                await this.syncAll(false);
                // Emitir señal de broadcast ligera para que otros terminales se enteren de inmediato
                this.sendBroadcastSignal('mutation');
            } catch (e) {
                console.warn('⚠️ [SyncService] Advertencia en auto-sync reactivo:', e.message);
            }
        }, effectiveDelay);
    }

    /**
     * Respaldo automático disparado al Cierre de Caja (Corte Z) o Cambio de Turno
     * Habilitado para planes con respaldo en la nube (PC PRO y FULL PRO)
     */
    static async triggerShiftChangeBackup(reason = 'Cierre de Turno / Corte Z') {
        if (!navigator.onLine) {
            console.log(`[SyncService] ⏸️ Respaldo omitido (${reason}): Sin conexión a internet.`);
            return false;
        }
        if (typeof LicenseService !== 'undefined' && !LicenseService.canBackup()) {
            console.log(`[SyncService] ⏸️ Respaldo omitido (${reason}): Plan FREE no incluye respaldos en la nube.`);
            return false;
        }
        const hasCloud = Boolean(localStorage.getItem('SUPABASE_ACCESS_TOKEN') || sessionStorage.getItem('SUPABASE_ACCESS_TOKEN'));
        if (!hasCloud) {
            return false;
        }

        console.log(`☁️ [SyncService] Iniciando respaldo automático a Supabase por: ${reason}...`);
        this.updateUI('syncing', `Respaldando (${reason})...`);
        const result = await this.syncAll(false, 'push_only');
        if (result && result.success) {
            console.log(`✅ [SyncService] Respaldo completado con éxito (${reason}).`);
            this.updateUI('synced', `Último respaldo: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
        }
        return result;
    }

    /**
     * Verifica de forma ultrarrápida si se generaron ventas, compras, gastos o abonos
     * mientras la computadora estuvo sin conexión, y solo en ese caso sube los cambios pendientes (push_only).
     */
    static async syncPendingOfflineChanges() {
        try {
            const apiBase = (typeof window !== 'undefined' && window.API_CONFIG && window.API_CONFIG.API_URL) 
                ? window.API_CONFIG.API_URL.replace(/\/api$/, '') 
                : 'http://localhost:3000';
            const businessId = this.getCurrentBusinessId();
            const token = localStorage.getItem('AUTH_TOKEN') || sessionStorage.getItem('AUTH_TOKEN');
            const resp = await fetch(`${apiBase}/api/sync/has-pending?businessId=${businessId}`, {
                headers: {
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });
            if (resp.ok) {
                const data = await resp.json();
                if (data && data.hasPending) {
                    console.log(`📤 [SyncService] Se detectaron ${data.totalPending} transacciones locales pendientes creadas offline. Respaldando en la nube...`);
                    await this.syncAll(false, 'push_only');
                } else {
                    console.log('✨ [SyncService] Reconexión exitosa: Cero transacciones pendientes por subir.');
                }
            }
        } catch (e) {
            console.warn('[SyncService] Verificación de cambios offline no disponible:', e.message);
        }
    }

    /**
     * Inicializa la escucha de cambios en tiempo real vía WebSockets de Supabase
     * Exclusivo para PLAN FULL PRO
     */
    static async initRealtime() {
        const client = this.getClient();
        const userId = await this.getCurrentUserId();
        if (!client || !userId || !navigator.onLine) return;

        // ponytail: Canal en vivo habilitado para todos los usuarios con sesión en la nube activa
        const hasCloud = Boolean(localStorage.getItem('SUPABASE_ACCESS_TOKEN') || sessionStorage.getItem('SUPABASE_ACCESS_TOKEN'));
        if (!hasCloud) {
            console.log('⏸️ [Realtime PC] Canal en vivo omitido: Sin sesión en Supabase.');
            if (this._realtimeChannel) {
                try { client.removeChannel(this._realtimeChannel); } catch (_) {}
                this._realtimeChannel = null;
                this._isRealtimeSubscribed = false;
            }
            return;
        }

        try {
            if (this._realtimeChannel) {
                try { client.removeChannel(this._realtimeChannel); } catch (_) {}
                this._realtimeChannel = null;
            }

            console.log(`🔌 [Realtime PC] Suscribiendo canal en vivo para usuario: ${userId}`);
            const channel = client.channel(`pos_realtime_pc_${userId}`);

            // 1. Canal Broadcast de alta velocidad entre terminales (campanada instantánea)
            channel.on(
                'broadcast',
                { event: 'sync_signal' },
                (payload) => {
                    const data = payload?.payload;
                    if (data && data.senderId === SyncService.getTerminalId()) return;
                    console.log('⚡ [Realtime Broadcast] Señal recibida desde otra terminal:', data);
                    SyncService.scheduleDebouncedSync(data?.reason || 'broadcast', 500);
                }
            );

            // 2. Escucha de cambios en tablas de base de datos (Optimizado: Solo 4 tablas esenciales)
            const monitoredTables = ['sales', 'products', 'customers', 'cash_registers'];

            monitoredTables.forEach(tableName => {
                channel.on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: tableName, filter: `user_id=eq.${userId}` },
                    (payload) => {
                        // A. Filtro Anti-Eco estricto: Descartar si el cambio fue emitido por esta misma terminal
                        const myTerminalId = SyncService.getTerminalId();
                        const recordTerminal = payload?.new?.terminal_id || payload?.old?.terminal_id;
                        const recordId = String(payload?.new?.local_id || payload?.new?.id || payload?.old?.local_id || payload?.old?.id || '');
                        if ((recordTerminal && recordTerminal === myTerminalId) || (recordId && SyncService._recentlyPushedIds.has(recordId))) {
                            // Silenciar eco de mutación propia (Falla #20)
                            return;
                        }

                        // B. Evitar solapamiento si ya está en curso
                        if (this.isSyncing || Date.now() < (this._suppressRealtimeUntil || 0)) {
                            return;
                        }

                        console.log(`⚡ [Realtime PC] Evento remoto en "${tableName}" desde ${recordTerminal || 'otra terminal'}: ${payload.eventType}`);
                        
                        // C. Sincronización reactiva en modo PULL_ONLY (solo descarga, cero rebote a Supabase)
                        this.scheduleDebouncedSync(tableName, 1500, 'pull_only');
                    }
                );
            });

            channel.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('📡 [Realtime PC] Conectado exitosamente al canal en vivo de Supabase (Broadcast + CDC).');
                    this._isRealtimeSubscribed = true;
                    this._reconnectAttempts = 0;
                    this.updateUI('synced', 'Nube Conectada en Tiempo Real');
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                    console.warn('⚠️ [Realtime PC] Estado del canal:', status);
                    this._isRealtimeSubscribed = false;
                    this.scheduleRealtimeReconnect();
                }
            });

            this._realtimeChannel = channel;
        } catch (e) {
            console.warn('⚠️ Error al iniciar canal Realtime en PC:', e.message);
            this.scheduleRealtimeReconnect();
        }
    }

    /**
     * Reintento de conexión WebSocket con retroceso exponencial
     */
    static scheduleRealtimeReconnect() {
        if (this._reconnectTimeout) clearTimeout(this._reconnectTimeout);
        this._reconnectAttempts++;
        const delay = Math.min(30000, 2000 * Math.pow(1.5, this._reconnectAttempts));
        this._reconnectTimeout = setTimeout(() => {
            if (navigator.onLine && !this._isRealtimeSubscribed) {
                console.log(`🔄 [Realtime PC] Reintentando conexión WebSocket (intento ${this._reconnectAttempts})...`);
                this.initRealtime();
            }
        }, delay);
    }

    /**
     * Dispara una sincronización reactiva rápida agrupando llamadas consecutivas hacia SQLite
     */
    static scheduleDebouncedSync(sourceTable = 'general', delayMs = 400, mode = 'pull_only') {
        if (this._realtimeDebounceTimer) clearTimeout(this._realtimeDebounceTimer);
        this._realtimeDebounceTimer = setTimeout(async () => {
            if (!this.isSyncing && Date.now() >= (this._suppressRealtimeUntil || 0) && navigator.onLine) {
                console.log(`⚡ [SyncService] Ejecutando sincronización reactiva (${mode}) por evento: ${sourceTable}`);
                await this.syncAll(false, mode, sourceTable);
            }
        }, delayMs);
    }

    /**
     * Obtiene el cliente oficial de Supabase
     */
    static getClient() {
        if (typeof getSupabaseClient === 'function') {
            return getSupabaseClient();
        }
        return null;
    }

    /**
     * Obtiene el ID de usuario de Supabase autenticado sin credenciales en código duro
     */
    static async getCurrentUserId() {
        const client = this.getClient();
        if (client && client.auth) {
            try {
                const { data: { session } } = await client.auth.getSession();
                if (session && session.user && session.user.id) {
                    localStorage.setItem('PMV_USER_ID', session.user.id);
                    localStorage.setItem('SUPABASE_USER_ID', session.user.id);
                    return session.user.id;
                }
            } catch (e) {
                console.warn('⚠️ Error al consultar sesión de Supabase:', e.message);
            }
        }

        // Fallback por identificador guardado en sesión local
        const storedUserId = localStorage.getItem('PMV_USER_ID') || localStorage.getItem('SUPABASE_USER_ID');
        if (storedUserId) return storedUserId;

        // Si el usuario en sesión local de PC tiene un ID en formato UUID válido
        const localUser = typeof AuthManager !== 'undefined' ? AuthManager.getCurrentUser() : null;
        if (localUser && localUser.id && typeof localUser.id === 'string' && localUser.id.length === 36) {
            return localUser.id;
        }

        return null;
    }

    /**
     * Obtiene el ID del negocio activo seleccionado en la app
     */
    static getCurrentBusinessId() {
        return Number(localStorage.getItem('BUSINESS_ID') || 1);
    }

    /**
     * Sincronización completa bidireccional (Push & Pull)
     */
    static async syncAll(isManual = false, mode = 'full', targetTable = null) {
        if (this.isSyncing) return { success: false, reason: 'Sync already in progress' };
        if (!navigator.onLine) {
            this.updateUI('offline', 'Modo Local');
            return { success: false, reason: 'Offline' };
        }

        // Comprobación de plan y licencia en PC (Tanto PC PRO como FULL PRO pueden respaldar)
        if (typeof LicenseService !== 'undefined' && !LicenseService.canBackup()) {
            const isMobile = LicenseService.isMobileProOnly();
            const reasonMsg = isMobile 
                ? 'Modo Local (Tu plan es Mobile Pro. Requiere FULL PRO para PC)' 
                : 'Modo Local (Plan Free / Sin Nube)';
            this.updateUI('offline', reasonMsg);
            console.log(`[SyncService] ⏸️ Sincronización omitida: ${reasonMsg}`);
            return { success: false, reason: 'Plan does not permit cloud sync/backup' };
        }

        const userId = await this.getCurrentUserId();
        if (!userId) {
            this.updateUI('offline', 'Sin cuenta en la nube (Inicia sesión en Supabase)');
            return { success: false, reason: 'No Supabase user' };
        }

        const businessId = this.getCurrentBusinessId();
        this.isSyncing = true;
        this._suppressRealtimeUntil = Date.now() + 2000; // Silenciar eco inmediato por 2 segundos
        this.updateUI('syncing', 'Sincronizando con la nube...');

        try {
            // 0. Intentar sincronización vía Backend Node.js (Alta velocidad + Service Role sin fallos de RLS)
            const apiBase = (typeof window !== 'undefined' && window.API_CONFIG && window.API_CONFIG.API_URL) 
                ? window.API_CONFIG.API_URL.replace(/\/api$/, '') 
                : 'http://localhost:3000';
            const token = localStorage.getItem('AUTH_TOKEN') || sessionStorage.getItem('AUTH_TOKEN');

            let backendSuccess = false;
            let backendData = null;

            try {
                const resp = await fetch(`${apiBase}/api/sync/cloud`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                        'x-supabase-user-id': userId,
                        'x-business-id': String(businessId)
                    },
                    body: JSON.stringify({ userId, businessId, mode, table: targetTable })
                });

                if (resp.ok) {
                    backendData = await resp.json();
                    if (backendData && backendData.success) {
                        backendSuccess = true;
                    }
                }
            } catch (backendErr) {
                console.warn('[SyncService] Backend sync no disponible, recurriendo a sincronización directa:', backendErr.message);
            }

            if (backendSuccess && backendData) {
                this.lastSyncTime = new Date();
                const timeStr = this.lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                this.updateUI('synced', `Sincronizado (${timeStr})`);

                // Invalida caché de base de datos local para que las vistas lean datos frescos descargados
                if (typeof db !== 'undefined' && typeof db.clearCache === 'function') {
                    db.clearCache();
                }

                // Si el backend devolvió ajustes de negocio (incluyendo allowMultipleCashRegisters), sincronizar localStorage
                if (backendData.businessSettings?.bank_info && typeof backendData.businessSettings.bank_info === 'object') {
                    const bi = backendData.businessSettings.bank_info;
                    if (bi.allowMultipleCashRegisters !== undefined) {
                        localStorage.setItem('allowMultipleCashRegisters', String(bi.allowMultipleCashRegisters));
                    }
                    localStorage.setItem('PMV_BANK_INFO', JSON.stringify(bi));
                }

                // Refrescar vistas activas silenciosamente sin pestañeo ni parpadeo
                if (typeof app !== 'undefined' && typeof app.refreshCurrentViewSilently === 'function') {
                    try {
                        await app.refreshCurrentViewSilently();
                    } catch (navErr) {
                        console.warn('[SyncService] Error refrescando vista activa silenciosamente:', navErr);
                    }
                }

                // Notificar cambios descargados al usuario con un aviso amigable y claro
                const pulled = backendData.stats?.pulled || {};
                const pushed = backendData.stats?.pushed || {};
                const pulledParts = [];
                if (pulled.products > 0) pulledParts.push(`${pulled.products} productos`);
                if (pulled.categories > 0) pulledParts.push(`${pulled.categories} categorías`);
                if (pulled.sales > 0) pulledParts.push(`${pulled.sales} ventas`);
                if (pulled.purchases > 0) pulledParts.push(`${pulled.purchases} compras`);
                if (pulled.cash_registers > 0) pulledParts.push(`${pulled.cash_registers} cajas`);
                if (pulled.cash_movements > 0) pulledParts.push(`${pulled.cash_movements} movs. de caja`);
                if (pulled.customers > 0) pulledParts.push(`${pulled.customers} clientes`);
                if (pulled.suppliers > 0) pulledParts.push(`${pulled.suppliers} proveedores`);
                if (pulled.counter_notes > 0) pulledParts.push(`${pulled.counter_notes} notas/envases`);
                if (pulled.business_settings > 0) pulledParts.push(`ajustes`);

                // Recargar notas y envases en memoria si hubo cambios
                if (typeof NotesService !== 'undefined' && typeof NotesService.load === 'function') {
                    NotesService.load();
                }

                // Notificación silenciosa: no interrumpir al cajero si es sincronización en segundo plano
                if (pulledParts.length > 0) {
                    if (isManual && typeof showNotification === 'function') {
                        showNotification(`☁️ Datos sincronizados: ${pulledParts.join(', ')}`, 'info');
                    } else if (typeof NotificationCenter !== 'undefined' && typeof NotificationCenter.addNotification === 'function') {
                        NotificationCenter.addNotification({
                            title: 'Sincronización en segundo plano',
                            message: `Nuevos datos recibidos: ${pulledParts.join(', ')}`,
                            type: 'sync',
                            time: new Date()
                        });
                    }
                } else if (isManual && typeof showNotification === 'function') {
                    const totalP = backendData.totals?.products || 0;
                    showNotification(`☁️ Sincronización exitosa (${timeStr}) — Catálogo y datos al día (${totalP} productos)`, 'success');
                }

                // ponytail: Solo emitir señal broadcast si fue acción manual para evitar bucle de ping-pong infinito
                if (isManual) {
                    this.sendBroadcastSignal('manual_sync');
                }

                this.isSyncing = false;
                this._suppressRealtimeUntil = Date.now() + 2000;
                return {
                    success: true,
                    mode: 'backend_service_role',
                    timestamp: this.lastSyncTime,
                    data: backendData
                };
            }

            // Fallback: Si el backend local no responde, sincronizar cliente-a-cliente directamente
            // 1. Enviar datos locales a la nube (PUSH) en paralelo
            const [
                pPushRes, cPushRes, catPushRes, payPushRes, setPushRes,
                sPushRes, supPushRes, purPushRes, cashPushRes, expPushRes,
                movPushRes, staffPushRes, smPushRes
            ] = await Promise.allSettled([
                this.pushProducts(userId),
                this.pushCustomers(userId),
                this.pushCategories(userId),
                this.pushDebtPayments(userId),
                this.pushBusinessSettings(userId),
                this.pushSales(userId),
                this.pushSuppliers(userId),
                this.pushPurchases(userId),
                this.pushCashRegisters(userId),
                this.pushExpenses(userId),
                this.pushCashMovements(userId),
                this.pushStaff(userId),
                this.pushStockMovements(userId)
            ]);

            // 2. Descargar datos nuevos de la nube (PULL) en paralelo
            const [
                pPullRes, cPullRes, catPullRes, payPullRes, setPullRes,
                sPullRes, supPullRes, purPullRes, cashPullRes, expPullRes,
                movPullRes, staffPullRes, smPullRes
            ] = await Promise.allSettled([
                this.pullProducts(userId),
                this.pullCustomers(userId),
                this.pullCategories(userId),
                this.pullDebtPayments(userId),
                this.pullBusinessSettings(userId),
                this.pullSales(userId),
                this.pullSuppliers(userId),
                this.pullPurchases(userId),
                this.pullCashRegisters(userId),
                this.pullExpenses(userId),
                this.pullCashMovements(userId),
                this.pullStaff(userId),
                this.pullStockMovements(userId)
            ]);

            this.lastSyncTime = new Date();
            const timeStr = this.lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            this.updateUI('synced', `Sincronizado (${timeStr})`);

            const pPull = pPullRes.status === 'fulfilled' ? (pPullRes.value || 0) : 0;
            const cPull = cPullRes.status === 'fulfilled' ? (cPullRes.value || 0) : 0;
            const catPull = catPullRes.status === 'fulfilled' ? (catPullRes.value || 0) : 0;
            const sPull = sPullRes.status === 'fulfilled' ? (sPullRes.value || 0) : 0;

            // Invalida caché de base de datos local para que las vistas lean datos frescos
            if (typeof db !== 'undefined' && typeof db.clearCache === 'function') {
                db.clearCache();
            }

            // Refrescar vistas activas silenciosamente sin pestañeo ni parpadeo
            if (typeof app !== 'undefined' && typeof app.refreshCurrentViewSilently === 'function') {
                try {
                    await app.refreshCurrentViewSilently();
                } catch (navErr) {
                    console.warn('[SyncService] Error refrescando vista activa silenciosamente:', navErr);
                }
            }

            const summaryParts = [];
            if (pPull > 0) summaryParts.push(`${pPull} producto${pPull > 1 ? 's' : ''}`);
            if (catPull > 0) summaryParts.push(`${catPull} categoría${catPull > 1 ? 's' : ''}`);
            if (sPull > 0) summaryParts.push(`${sPull} venta${sPull > 1 ? 's' : ''}`);
            if (cPull > 0) summaryParts.push(`${cPull} cliente${cPull > 1 ? 's' : ''}`);

            const detailMsg = summaryParts.length > 0 
                ? `Actualizados: ${summaryParts.join(', ')}` 
                : 'Todo tu catálogo y ventas están al día';

            if (summaryParts.length > 0) {
                if (isManual && typeof showNotification === 'function') {
                    showNotification(`☁️ Datos sincronizados: ${summaryParts.join(', ')}`, 'info');
                } else if (typeof NotificationCenter !== 'undefined' && typeof NotificationCenter.addNotification === 'function') {
                    NotificationCenter.addNotification({
                        title: 'Sincronización en segundo plano',
                        message: `Nuevos datos recibidos: ${summaryParts.join(', ')}`,
                        type: 'sync',
                        time: new Date()
                    });
                }
            } else if (isManual && typeof showNotification === 'function') {
                showNotification(`☁️ Sincronización exitosa (${timeStr}) — ${detailMsg}`, 'success');
            }

            if (isManual) {
                this.sendBroadcastSignal('manual_sync');
            }

            return {
                success: true,
                timestamp: this.lastSyncTime,
                stats: { pPull, cPull, catPull, sPull }
            };
        } catch (error) {
            console.error('❌ Error durante la sincronización en PC:', error);
            this.updateUI('error', 'Error de sincronización');
            return { success: false, error: error.message };
        } finally {
            this.isSyncing = false;
            this._suppressRealtimeUntil = Date.now() + 2000;
        }
    }

    /**
     * Enviar catálogo de productos local a Supabase con preservación de UUID y Tombstones
     */
    static async pushProducts(userId) {
        const client = this.getClient();
        if (!client || !userId) return 0;
        const businessId = this.getCurrentBusinessId();

        try {
            const localProducts = (typeof Product !== 'undefined' && typeof Product.getAllIncludingDeleted === 'function')
                ? await Product.getAllIncludingDeleted()
                : ((typeof Product !== 'undefined' && typeof Product.getAll === 'function') ? await Product.getAll() : []);

            if (!localProducts || localProducts.length === 0) return 0;

            const seen = new Set();
            const payload = [];
            for (const p of localProducts) {
                const rawCloudId = (p.cloud_id && p.cloud_id !== 'null' && p.cloud_id !== 'undefined') ? String(p.cloud_id).trim() : '';
                const targetLocalId = rawCloudId || String(p.id);
                if (!targetLocalId || seen.has(targetLocalId)) continue;
                seen.add(targetLocalId);

                payload.push({
                    user_id: userId,
                    business_id: String(businessId),
                    local_id: targetLocalId,
                    code: (p.barcode || p.code || targetLocalId).trim(),
                    name: p.name || 'Sin Nombre',
                    category: p.category || 'General',
                    cost_price: Number(p.costPrice || p.cost || 0),
                    sale_price: Number(p.price || p.salePrice || 0),
                    stock: Number(p.stock || 0),
                    min_stock: Number(p.minStock || 0),
                    image: p.image || '',
                    description: p.description || '',
                    is_favorite: Boolean(p.isFavorite || false),
                    is_deleted: Boolean((p.deletedAt && p.deletedAt !== 'null') || p.isActive === false || p.isActive === 0),
                    updated_at: new Date().toISOString()
                });
            }

            // Enviar en lotes (chunks) de 100
            const BATCH_SIZE = 100;
            let totalSaved = 0;
            for (let i = 0; i < payload.length; i += BATCH_SIZE) {
                const chunk = payload.slice(i, i + BATCH_SIZE);
                const { error } = await client
                    .from('products')
                    .upsert(chunk, { onConflict: 'user_id,business_id,local_id' });
                if (error) {
                    console.warn(`⚠️ Error subiendo lote de productos ${i}-${i + chunk.length}:`, error.message);
                } else {
                    totalSaved += chunk.length;
                }
            }

            return totalSaved;
        } catch (e) {
            console.warn('⚠️ Error en pushProducts:', e.message);
            return 0;
        }
    }

    /**
     * Descargar productos creados o editados en la app móvil desde Supabase
     */
    static async pullProducts(userId) {
        const client = this.getClient();
        if (!client || !userId) return 0;
        const businessId = this.getCurrentBusinessId();

        try {
            const { data: cloudProducts, error } = await client
                .from('products')
                .select('*')
                .eq('user_id', userId)
                .eq('business_id', String(businessId));

            if (error) throw error;
            if (!cloudProducts || cloudProducts.length === 0) return 0;

            const localProducts = (typeof Product !== 'undefined' && typeof Product.getAllIncludingDeleted === 'function')
                ? await Product.getAllIncludingDeleted()
                : ((typeof Product !== 'undefined' && typeof Product.getAll === 'function') ? await Product.getAll() : []);

            const mapByCloudId = new Map();
            const mapByBarcode = new Map();
            localProducts.forEach(p => {
                if (p.cloud_id) mapByCloudId.set(String(p.cloud_id), p);
                if (p.barcode) mapByBarcode.set(String(p.barcode).trim(), p);
                mapByCloudId.set(String(p.id), p);
            });

            let imported = 0;
            for (const cp of cloudProducts) {
                const cleanCode = (cp.code || '').trim();
                const existing = mapByCloudId.get(String(cp.local_id)) || (cleanCode ? mapByBarcode.get(cleanCode) : null);

                // Manejo de eliminación remota (Tombstone): si viene borrado de la nube
                if (cp.is_deleted) {
                    if (existing && existing.isActive !== false && typeof Product.softDelete === 'function') {
                        try {
                            await Product.softDelete(existing.id);
                            imported++;
                        } catch (_) {}
                    }
                    continue;
                }

                if (!existing) {
                    // Crear nuevo producto local importado del celular preservando su cloud_id
                    await Product.create({
                        cloud_id: String(cp.local_id),
                        barcode: cleanCode,
                        name: cp.name,
                        category: cp.category || 'General',
                        cost: parseFloat(cp.cost_price || 0),
                        costPrice: parseFloat(cp.cost_price || 0),
                        price: parseFloat(cp.sale_price || 0),
                        salePrice: parseFloat(cp.sale_price || 0),
                        stock: parseFloat(cp.stock || 0),
                        minStock: parseFloat(cp.min_stock || 0),
                        image: cp.image || '',
                        description: cp.description || '',
                        isFavorite: Boolean(cp.is_favorite)
                    });
                    imported++;
                } else {
                    // Actualizar producto existente respetando diferencias reales
                    const cloudStock = parseFloat(cp.stock || 0);
                    const cloudPrice = parseFloat(cp.sale_price || 0);
                    const localStock = parseFloat(existing.stock || 0);
                    const localPrice = parseFloat(existing.price || 0);

                    const stockDiff = Math.abs(cloudStock - localStock) > 0.001;
                    const priceDiff = Math.abs(cloudPrice - localPrice) > 0.001;
                    const nameDiff = cp.name && cp.name !== existing.name;

                    if (stockDiff || priceDiff || nameDiff || !existing.cloud_id) {
                        try {
                            if (typeof Product.update === 'function') {
                                await Product.update(existing.id, {
                                    cloud_id: existing.cloud_id || String(cp.local_id),
                                    stock: cloudStock,
                                    price: cloudPrice,
                                    cost: parseFloat(cp.cost_price || existing.cost || 0),
                                    name: cp.name || existing.name,
                                    category: cp.category || existing.category
                                }, { allowStock: true });
                                imported++;
                            }
                        } catch (updErr) {
                            console.warn(`⚠️ Error actualizando producto #${existing.id} desde la nube:`, updErr.message);
                        }
                    }
                }
            }

            if (imported > 0) {
                console.log(`✅ ${imported} productos sincronizados/actualizados desde la nube.`);
                if (typeof window.dispatchEvent !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('products-updated'));
                }
            }
            return imported;
        } catch (e) {
            console.warn('⚠️ Error en pullProducts:', e.message);
            return 0;
        }
    }

    /**
     * Marca un producto como eliminado en la nube (Tombstone)
     */
    static async markProductDeleted(productId) {
        const client = this.getClient();
        const userId = await this.getCurrentUserId();
        if (!client || !userId || !productId) return;
        const businessId = this.getCurrentBusinessId();

        try {
            const prod = (typeof Product !== 'undefined') ? await Product.getById(productId) : null;
            const targetId = prod?.cloud_id || String(productId);

            await client.from('products').upsert({
                user_id: userId,
                business_id: String(businessId),
                local_id: targetId,
                name: prod?.name || 'Eliminado',
                is_deleted: true,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,business_id,local_id' });

            console.log(`🗑️ [SyncService] Producto #${productId} marcado como eliminado en Supabase.`);
        } catch (e) {
            console.warn('⚠️ Error marcando producto como eliminado en Supabase:', e.message);
        }
    }

    /**
     * Marca una categoría como eliminada en la nube (Tombstone)
     */
    static async markCategoryDeleted(categoryName, categoryId = null) {
        const client = this.getClient();
        const userId = await this.getCurrentUserId();
        if (!client || !userId || !categoryName) return;
        const businessId = this.getCurrentBusinessId();

        try {
            const targetId = String(categoryId || categoryName);
            await client.from('categories').upsert({
                user_id: userId,
                business_id: String(businessId),
                local_id: targetId,
                name: categoryName,
                is_deleted: true,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,business_id,local_id' });
            console.log(`🗑️ [SyncService] Categoría "${categoryName}" marcada como eliminada en Supabase.`);
        } catch (e) {
            console.warn('⚠️ Error marcando categoría como eliminada en Supabase:', e.message);
        }
    }

    /**
     * Enviar ventas locales a Supabase usando RPC atómico o Upsert seguro
     */
    static async pushSales(userId) {
        const client = this.getClient();
        if (!client || !userId) return 0;
        const businessId = this.getCurrentBusinessId();

        try {
            const localSales = (typeof Sale !== 'undefined') ? await Sale.getAll() : [];
            if (!localSales || localSales.length === 0) return 0;

            // Filtro anti-rebote: No volver a subir ventas que vinieron del celular
            const recentSales = localSales.slice(0, 100).filter(s => !s.server_id && String(s.source) !== 'mobile');
            if (recentSales.length === 0) return 0;

            const salesPayload = recentSales.map(s => ({
                user_id: userId,
                business_id: String(businessId),
                local_id: String(s.cloud_id || s.id),
                sale_date: s.date || s.createdAt || new Date().toISOString(),
                total: Number(s.total || 0),
                payment_method: s.paymentMethod || 'EFECTIVO',
                customer_id: s.customerId ? String(s.customerId) : null,
                items: Array.isArray(s.items) ? s.items : [],
                synced_at: new Date().toISOString()
            }));

            // Intentar RPC en paralelo para un lote pequeño (máx 10)
            await Promise.allSettled(salesPayload.slice(0, 10).map(s => 
                client.rpc('sync_sale_atomic', {
                    p_user_id: userId,
                    p_local_id: s.local_id,
                    p_sale_date: s.sale_date,
                    p_total: s.total,
                    p_payment_method: s.payment_method,
                    p_customer_id: s.customer_id,
                    p_items: s.items
                }).catch(() => null)
            ));

            // Upsert por lotes en una sola llamada
            const { error } = await client.from('sales').upsert(salesPayload, { onConflict: 'user_id,business_id,local_id' });
            if (error) console.warn('⚠️ Error en pushSales batch:', error.message);
            return salesPayload.length;
        } catch (e) {
            console.warn('⚠️ Error en pushSales:', e.message);
            return 0;
        }
    }

    /**
     * Descargar ventas realizadas en la app móvil a la base de datos de PC
     */
    static async pullSales(userId) {
        const client = this.getClient();
        if (!client || !userId) return 0;
        const businessId = this.getCurrentBusinessId();

        try {
            const { data: cloudSales, error } = await client
                .from('sales')
                .select('*')
                .eq('user_id', userId)
                .eq('business_id', String(businessId))
                .order('sale_date', { ascending: false })
                .limit(2000);

            if (error) throw error;
            if (!cloudSales || cloudSales.length === 0) return 0;

            let insertedCount = 0;
            const existingSales = (typeof Sale !== 'undefined') ? await Sale.getAll() : [];
            const existingServerIds = new Set(
                (existingSales || []).map(s => String(s.server_id || s.cloud_id || s.idempotencyKey || '')).filter(Boolean)
            );

            for (const cs of cloudSales) {
                const targetId = String(cs.local_id || cs.id);

                // Anti-duplicados estricto por ID
                if (existingServerIds.has(targetId)) {
                    continue;
                }

                try {
                    const newSaleData = {
                        date: cs.sale_date,
                        total: parseFloat(cs.total || 0),
                        paymentMethod: cs.payment_method || 'EFECTIVO',
                        items: Array.isArray(cs.items) ? cs.items : [],
                        customerId: cs.customer_id ? (parseInt(cs.customer_id) || null) : null,
                        cashRegisterId: cs.cash_register_id ? (isNaN(cs.cash_register_id) ? cs.cash_register_id : Number(cs.cash_register_id)) : null,
                        status: cs.status || 'completed',
                        paymentDetails: typeof cs.payment_details === 'string' ? JSON.parse(cs.payment_details || '{}') : (cs.payment_details || {}),
                        paidAmount: parseFloat(cs.paid_amount !== undefined ? cs.paid_amount : (cs.total || 0)),
                        discountAmount: parseFloat(cs.discount_amount || 0),
                        source: 'mobile',
                        server_id: targetId,
                        cloud_id: targetId,
                        idempotencyKey: targetId,
                        business_id: businessId,
                        is_synced: 1
                    };

                    if (typeof db !== 'undefined' && db.add) {
                        const newSaleId = await db.add('sales', newSaleData);
                        existingServerIds.add(targetId);
                        insertedCount++;

                        // Descontar inventario local de los productos incluidos en la venta móvil
                        if (Array.isArray(cs.items) && cs.items.length > 0) {
                            for (const itm of cs.items) {
                                const qty = parseFloat(itm.quantity || itm.qty || 0);
                                if (qty <= 0) continue;

                                let prodMatch = null;
                                if (itm.barcode) {
                                    prodMatch = await Product.getByBarcode(itm.barcode);
                                }
                                if (!prodMatch && itm.productId) {
                                    try {
                                        prodMatch = await Product.getByCloudId(String(itm.productId)) || await Product.getById(itm.productId);
                                    } catch (_) {}
                                }

                                if (prodMatch) {
                                    try {
                                        if (typeof StockService !== 'undefined' && typeof StockService.applyStockMovement === 'function') {
                                            await StockService.applyStockMovement(
                                                prodMatch.id,
                                                -qty,
                                                'sale',
                                                newSaleId || targetId,
                                                'Venta remota móvil'
                                            );
                                        } else if (typeof Product.updateStock === 'function') {
                                            await Product.updateStock(prodMatch.id, qty, 'subtract');
                                        }
                                    } catch (stkErr) {
                                        console.warn(`⚠️ Error descontando stock de ${prodMatch.name}:`, stkErr.message);
                                    }
                                }
                            }
                        }
                    }
                } catch (insErr) {
                    console.warn('Error insertando venta remota en PC:', insErr.message);
                }
            }

            if (insertedCount > 0) {
                console.log(`✅ ${insertedCount} ventas sincronizadas desde el celular a la PC.`);
                if (typeof window.dispatchEvent !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('sales-updated'));
                    window.dispatchEvent(new CustomEvent('products-updated'));
                }
            }
            return insertedCount;
        } catch (e) {
            console.warn('⚠️ Error en pullSales:', e.message);
            return 0;
        }
    }

    /**
     * Enviar clientes locales a Supabase
     */
    static async pushCustomers(userId) {
        const client = this.getClient();
        if (!client || !userId) return 0;
        const businessId = this.getCurrentBusinessId();

        try {
            const localCustomers = (typeof Customer !== 'undefined') ? await Customer.getAll() : [];
            if (!localCustomers || localCustomers.length === 0) return 0;

            let localSales = [];
            try {
                localSales = (typeof Sale !== 'undefined') ? await Sale.getAll() : [];
            } catch (_) {}

            const debtMap = {};
            (localSales || []).forEach(s => {
                if ((s.status === 'pending' || s.status === 'partial') && (Number(s.total) - Number(s.paidAmount || 0)) > 0) {
                    const cid = String(s.customerId);
                    const debtAmount = Number(s.total) - Number(s.paidAmount || 0);
                    debtMap[cid] = (debtMap[cid] || 0) + debtAmount;
                }
            });

            const payload = localCustomers.map(c => {
                const finalDebt = debtMap[String(c.id)] || c.currentDebt || c.balanceCredit || 0;
                return {
                    user_id: userId,
                    business_id: String(businessId),
                    local_id: c.uuid || c.cloud_id || ('cst_' + c.id),
                    name: c.name || 'Cliente',
                    phone: c.phone || '',
                    email: c.email || '',
                    rut: c.rut || '',
                    address: c.address || '',
                    credit_limit: parseFloat(c.creditLimit || 0),
                    debt: Number(finalDebt),
                    is_deleted: Boolean((c.deletedAt && c.deletedAt !== 'null') || c.isActive === 0),
                    updated_at: new Date().toISOString()
                };
            });

            const { error } = await client
                .from('customers')
                .upsert(payload, { onConflict: 'user_id,business_id,local_id' });

            if (error) throw error;
            return payload.length;
        } catch (e) {
            console.warn('⚠️ Error en pushCustomers:', e.message);
            return 0;
        }
    }

    /**
     * Descargar clientes creados o actualizados en la app móvil desde Supabase
     */
    static async pullCustomers(userId) {
        const client = this.getClient();
        if (!client || !userId) return 0;
        const businessId = this.getCurrentBusinessId();

        try {
            const { data: cloudCustomers, error } = await client
                .from('customers')
                .select('*')
                .eq('user_id', userId)
                .eq('business_id', String(businessId));

            if (error) throw error;
            if (!cloudCustomers || cloudCustomers.length === 0) return 0;

            const localCustomers = (typeof Customer !== 'undefined') ? await Customer.getAll() : [];
            const localMapByCloudId = new Map();
            const localMapByUuid = new Map();
            const localMapByRut = new Map();
            const localMapByName = new Map();

            localCustomers.forEach(c => {
                if (c.cloud_id) localMapByCloudId.set(String(c.cloud_id), c);
                if (c.uuid) localMapByUuid.set(String(c.uuid), c);
                if (c.rut && c.rut.trim()) localMapByRut.set(c.rut.trim().toLowerCase(), c);
                if (c.name && c.name.trim()) localMapByName.set(c.name.trim().toLowerCase(), c);
            });

            let imported = 0;
            for (const cc of cloudCustomers) {
                const cloudUuid = cc.local_id || cc.uuid || '';
                const cloudId = cc.id ? String(cc.id) : null;
                const cleanRut = (cc.rut || '').trim().toLowerCase();
                const cleanName = (cc.name || '').trim().toLowerCase();

                const existing = (cloudId ? localMapByCloudId.get(cloudId) : null) ||
                                 (cloudUuid ? localMapByUuid.get(cloudUuid) : null) ||
                                 (cleanRut ? localMapByRut.get(cleanRut) : null) ||
                                 (cleanName ? localMapByName.get(cleanName) : null);

                if (cc.is_deleted) {
                    if (existing && existing.isActive !== false && typeof Customer.delete === 'function') {
                        try {
                            await Customer.delete(existing.id);
                            imported++;
                        } catch (_) {}
                    }
                    continue;
                }

                if (!existing) {
                    await Customer.create({
                        cloud_id: cloudId,
                        uuid: cloudUuid || ('cst_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9)),
                        name: cc.name,
                        phone: cc.phone || '',
                        email: cc.email || '',
                        rut: cc.rut || '',
                        address: cc.address || '',
                        creditLimit: parseFloat(cc.credit_limit || 0),
                        currentDebt: cc.debt || 0
                    });
                    imported++;
                } else {
                    const cloudDebt = parseFloat(cc.debt || 0);
                    const localDebt = parseFloat(existing.currentDebt || existing.balanceCredit || 0);
                    if (Math.abs(cloudDebt - localDebt) > 0.01 || existing.phone !== cc.phone || !existing.cloud_id || existing.rut !== cc.rut) {
                        try {
                            if (typeof Customer.update === 'function') {
                                await Customer.update(existing.id, {
                                    cloud_id: existing.cloud_id || cloudId,
                                    uuid: existing.uuid || cloudUuid,
                                    currentDebt: cloudDebt,
                                    phone: cc.phone || existing.phone,
                                    email: cc.email || existing.email,
                                    rut: cc.rut || existing.rut,
                                    address: cc.address || existing.address,
                                    creditLimit: parseFloat(cc.credit_limit || existing.creditLimit || 0)
                                });
                                imported++;
                            }
                        } catch (_) {}
                    }
                }
            }
            return imported;
        } catch (e) {
            console.warn('⚠️ Error en pullCustomers:', e.message);
            return 0;
        }
    }

    /**
     * Enviar proveedores locales a Supabase
     */
    static async pushSuppliers(userId) {
        const client = this.getClient();
        if (!client || !userId) return 0;
        const businessId = this.getCurrentBusinessId();

        try {
            const localSuppliers = (typeof Supplier !== 'undefined') ? await Supplier.getAll() : [];
            if (!localSuppliers || localSuppliers.length === 0) return 0;

            const payload = localSuppliers.map(s => ({
                user_id: userId,
                business_id: String(businessId),
                local_id: s.cloud_id || String(s.id),
                name: s.name || 'Proveedor',
                phone: s.phone || '',
                email: s.email || '',
                rut: s.rut || '',
                contact_name: s.contact || '',
                address: s.address || '',
                is_deleted: Boolean((s.deletedAt && s.deletedAt !== 'null') || s.isActive === 0),
                updated_at: s.updatedAt || new Date().toISOString()
            }));

            for (let i = 0; i < payload.length; i += 100) {
                const batch = payload.slice(i, i + 100);
                const { error } = await client.from('suppliers').upsert(batch, { onConflict: 'user_id,business_id,local_id' });
                if (error) throw error;
            }
            return payload.length;
        } catch (e) {
            console.warn('⚠️ Error en pushSuppliers:', e.message);
            return 0;
        }
    }

    /**
     * Descargar proveedores creados en la app móvil desde Supabase
     */
    static async pullSuppliers(userId) {
        const client = this.getClient();
        if (!client || !userId) return 0;
        const businessId = this.getCurrentBusinessId();

        try {
            const { data: cloudSuppliers, error } = await client
                .from('suppliers')
                .select('*')
                .eq('user_id', userId)
                .eq('business_id', String(businessId));

            if (error) throw error;
            if (!cloudSuppliers || cloudSuppliers.length === 0) return 0;

            const localSuppliers = (typeof Supplier !== 'undefined') ? await Supplier.getAll() : [];
            const localNames = new Set(localSuppliers.map(s => s.name.toLowerCase().trim()));

            let imported = 0;
            for (const cs of cloudSuppliers) {
                if (!localNames.has(cs.name.toLowerCase().trim()) && !cs.is_deleted) {
                    await Supplier.create({
                        cloud_id: String(cs.local_id || cs.id),
                        name: cs.name,
                        phone: cs.phone || '',
                        email: cs.email || '',
                        contact: cs.contact_name || '',
                        address: cs.address || ''
                    });
                    imported++;
                }
            }
            return imported;
        } catch (e) {
            console.warn('⚠️ Error en pullSuppliers:', e.message);
            return 0;
        }
    }

    /**
     * Enviar compras locales a Supabase
     */
    static async pushPurchases(userId) {
        const client = this.getClient();
        if (!client || !userId) return 0;
        const businessId = this.getCurrentBusinessId();

        try {
            const localPurchases = (typeof Purchase !== 'undefined') ? await Purchase.getAll() : [];
            if (!localPurchases || localPurchases.length === 0) return 0;

            const payload = localPurchases.slice(0, 500).map(p => ({
                user_id: userId,
                business_id: String(businessId),
                local_id: p.cloud_id || String(p.id),
                supplier_id: p.supplierId ? String(p.supplierId) : null,
                supplier_name: p.supplierName || 'Proveedor',
                invoice_number: p.invoiceNumber || 'SIN CORRELATIVO',
                document_type: p.documentType || 'boleta',
                purchase_date: p.date || p.createdAt || new Date().toISOString(),
                total: Number(p.total || 0),
                paid_amount: Number(p.paidAmount || p.total || 0),
                status: p.status || 'paid',
                items: Array.isArray(p.items) ? p.items : [],
                is_deleted: Boolean(p.cancelledAt || p.deletedAt),
                updated_at: p.updatedAt || new Date().toISOString()
            }));

            for (let i = 0; i < payload.length; i += 100) {
                const batch = payload.slice(i, i + 100);
                const { error } = await client.from('purchases').upsert(batch, { onConflict: 'user_id,business_id,local_id' });
                if (error) throw error;
            }
            return payload.length;
        } catch (e) {
            console.warn('⚠️ Error en pushPurchases:', e.message);
            return 0;
        }
    }

    /**
     * Descargar compras registradas en la app móvil y guardarlas efectivamente en SQLite
     */
    static async pullPurchases(userId) {
        const client = this.getClient();
        if (!client || !userId) return 0;
        const businessId = this.getCurrentBusinessId();

        try {
            const { data: cloudPurchases, error } = await client
                .from('purchases')
                .select('*')
                .eq('user_id', userId)
                .eq('business_id', String(businessId))
                .order('purchase_date', { ascending: false })
                .limit(200);

            if (error) throw error;
            if (!cloudPurchases || cloudPurchases.length === 0) return 0;

            const localPurchases = (typeof db !== 'undefined' && db.getAll) ? await db.getAll('purchases') : [];
            const existingMap = new Map();
            localPurchases.forEach(p => {
                if (p.server_id) existingMap.set(String(p.server_id), p);
                if (p.cloud_id) existingMap.set(String(p.cloud_id), p);
                if (p.invoiceNumber) existingMap.set(String(p.invoiceNumber), p);
            });

            let inserted = 0;
            for (const cp of cloudPurchases) {
                const targetId = String(cp.local_id || cp.id);
                const existing = existingMap.get(targetId) || (cp.invoice_number ? existingMap.get(cp.invoice_number) : null);

                if (!existing && !cp.is_deleted) {
                    let parsedItems = [];
                    try { parsedItems = typeof cp.items === 'string' ? JSON.parse(cp.items) : (cp.items || []); } catch (_) {}

                    const newPurData = {
                        supplierId: cp.supplier_id ? (parseInt(cp.supplier_id) || null) : null,
                        supplierName: cp.supplier_name || 'Proveedor',
                        invoiceNumber: cp.invoice_number || 'REMOTO',
                        documentType: cp.document_type || 'boleta',
                        date: cp.purchase_date,
                        total: Number(cp.total || 0),
                        paidAmount: Number(cp.paid_amount || cp.total || 0),
                        status: cp.status || 'paid',
                        items: parsedItems,
                        server_id: targetId,
                        cloud_id: targetId,
                        business_id: businessId,
                        source: 'mobile'
                    };

                    if (typeof db !== 'undefined' && db.add) {
                        await db.add('purchases', newPurData);
                        inserted++;
                    }
                } else if (existing && cp.is_deleted && !existing.cancelledAt) {
                    if (typeof db !== 'undefined' && db.put) {
                        await db.put('purchases', { ...existing, cancelledAt: new Date().toISOString(), isActive: 0 });
                    }
                }
            }
            return inserted;
        } catch (e) {
            console.warn('⚠️ Error en pullPurchases:', e.message);
            return 0;
        }
    }

    /**
     * Enviar turnos y estado de caja a Supabase Cloud
     */
    static async pushCashRegisters(userId) {
        const client = this.getClient();
        if (!client || !userId) return 0;
        const businessId = this.getCurrentBusinessId();

        try {
            const localCash = (typeof CashRegister !== 'undefined') ? await CashRegister.getAll() : [];
            const openCash = (typeof CashRegister !== 'undefined') ? await CashRegister.getOpen() : null;

            let recentCash = (Array.isArray(localCash) && localCash.length > 0) ? localCash.slice(0, 100) : [];
            if (openCash && !recentCash.some(c => String(c.id) === String(openCash.id))) {
                recentCash.unshift(openCash);
            }

            if (recentCash.length === 0) return 0;

            const payload = recentCash.map(c => ({
                user_id: userId,
                business_id: String(businessId),
                local_id: c.cloud_id || String(c.id),
                status: c.status || 'open',
                open_date: c.openDate || new Date().toISOString(),
                close_date: (c.closeDate && c.closeDate !== 'null') ? c.closeDate : null,
                initial_amount: Number(c.initialAmount || 0),
                final_amount: Number(c.finalAmount || 0),
                expected_amount: Number(c.expectedAmount || 0),
                difference: Number(c.difference || 0),
                payment_summary: typeof c.paymentSummary === 'string' ? JSON.parse(c.paymentSummary || '{}') : (c.paymentSummary || {}),
                notes: c.observations || '',
                updated_at: new Date().toISOString()
            }));

            for (let i = 0; i < payload.length; i += 50) {
                const batch = payload.slice(i, i + 50);
                const { error } = await client.from('cash_registers').upsert(batch, { onConflict: 'user_id,business_id,local_id' });
                if (error) throw error;
            }
            return payload.length;
        } catch (e) {
            console.warn('⚠️ Error en pushCashRegisters:', e.message);
            return 0;
        }
    }

    /**
     * Sincronizar estado de turnos de caja desde Supabase
     */
    static async pullCashRegisters(userId) {
        const client = this.getClient();
        if (!client || !userId) return 0;
        const businessId = this.getCurrentBusinessId();

        try {
            const { data: openCashList, error } = await client
                .from('cash_registers')
                .select('*')
                .eq('user_id', userId)
                .eq('business_id', String(businessId))
                .order('open_date', { ascending: false })
                .limit(50);

            if (error) throw error;
            if (!openCashList || openCashList.length === 0) return 0;

            let savedCount = 0;
            for (const cr of openCashList) {
                const regId = cr.local_id ? (isNaN(cr.local_id) ? cr.local_id : Number(cr.local_id)) : cr.id;
                const registerData = {
                    id: regId,
                    userId: cr.user_id,
                    openDate: cr.open_date,
                    closeDate: cr.close_date || null,
                    initialAmount: Number(cr.initial_amount || 0),
                    finalAmount: Number(cr.final_amount || 0),
                    expectedAmount: Number(cr.expected_amount || 0),
                    difference: Number(cr.difference || 0),
                    status: cr.status || 'closed',
                    observations: cr.notes || '',
                    paymentSummary: cr.payment_summary || { cash: 0, card: 0, qr: 0, other: 0 },
                    denominations: cr.denominations || null,
                    business_id: businessId,
                    cloud_id: cr.id,
                    server_id: cr.id,
                    is_synced: 1
                };

                if (typeof db !== 'undefined' && db.put) {
                    await db.put('cashRegisters', registerData);
                    savedCount++;
                }
            }
            return savedCount;
        } catch (e) {
            console.warn('⚠️ Error en pullCashRegisters:', e.message);
            return 0;
        }
    }

    /**
     * Enviar gastos operativos a Supabase Cloud
     */
    static async pushExpenses(userId) {
        const client = this.getClient();
        if (!client || !userId) return 0;
        const businessId = this.getCurrentBusinessId();

        try {
            const localExp = (typeof db !== 'undefined' && db.getAll) ? await db.getAll('expenses') : [];
            if (!localExp || localExp.length === 0) return 0;

            const payload = localExp.slice(-200).map(e => ({
                user_id: userId,
                business_id: String(businessId),
                local_id: e.cloud_id || String(e.id),
                amount: Number(e.amount || 0),
                category: e.category || 'General',
                description: e.description || '',
                expense_date: e.date || new Date().toISOString(),
                from_cash: e.fromCash !== false,
                is_deleted: Boolean(e.cancelledAt || e.deletedAt),
                updated_at: new Date().toISOString()
            }));

            for (let i = 0; i < payload.length; i += 50) {
                const batch = payload.slice(i, i + 50);
                const { error } = await client.from('expenses').upsert(batch, { onConflict: 'user_id,business_id,local_id' });
                if (error) throw error;
            }
            return payload.length;
        } catch (e) {
            console.warn('⚠️ Error en pushExpenses:', e.message);
            return 0;
        }
    }

    /**
     * Descargar gastos operativos desde Supabase Cloud e insertarlos efectivamente en SQLite
     */
    static async pullExpenses(userId) {
        const client = this.getClient();
        if (!client || !userId) return 0;
        const businessId = this.getCurrentBusinessId();

        try {
            const { data: cloudExp, error } = await client
                .from('expenses')
                .select('*')
                .eq('user_id', userId)
                .eq('business_id', String(businessId))
                .order('expense_date', { ascending: false })
                .limit(200);

            if (error) throw error;
            if (!cloudExp || cloudExp.length === 0) return 0;

            const localExp = (typeof db !== 'undefined' && db.getAll) ? await db.getAll('expenses') : [];
            const existingKeys = new Set(localExp.map(e => String(e.server_id || e.cloud_id || `${e.date}_${e.amount}_${e.description}`)));

            let inserted = 0;
            for (const ce of cloudExp) {
                const targetId = String(ce.local_id || ce.id);
                const signature = `${ce.expense_date}_${ce.amount}_${ce.description}`;

                if (!existingKeys.has(targetId) && !existingKeys.has(signature) && !ce.is_deleted) {
                    const newExp = {
                        amount: Number(ce.amount || 0),
                        category: ce.category || 'General',
                        description: ce.description || '',
                        date: ce.expense_date,
                        fromCash: ce.from_cash !== false,
                        server_id: targetId,
                        cloud_id: targetId,
                        business_id: businessId,
                        source: 'mobile'
                    };

                    if (typeof db !== 'undefined' && db.add) {
                        await db.add('expenses', newExp);
                        existingKeys.add(targetId);
                        inserted++;
                    }
                }
            }
            return inserted;
        } catch (e) {
            console.warn('⚠️ Error en pullExpenses:', e.message);
            return 0;
        }
    }

    /**
     * Enviar movimientos manuales de caja a Supabase Cloud
     */
    static async pushCashMovements(userId) {
        const client = this.getClient();
        if (!client || !userId) return 0;
        const businessId = this.getCurrentBusinessId();

        try {
            const localMov = (typeof db !== 'undefined' && db.getAll) ? await db.getAll('cashMovements') : [];
            if (!localMov || localMov.length === 0) return 0;

            const payload = localMov.slice(-200).map(m => ({
                user_id: userId,
                business_id: String(businessId),
                local_id: m.cloud_id || String(m.id),
                amount: Number(m.amount || 0),
                movement_type: m.type || 'in',
                concept: m.concept || '',
                movement_date: m.date || new Date().toISOString(),
                created_by: m.user || 'Cajero',
                is_deleted: Boolean(m.cancelledAt || m.deletedAt),
                updated_at: new Date().toISOString()
            }));

            for (let i = 0; i < payload.length; i += 50) {
                const batch = payload.slice(i, i + 50);
                const { error } = await client.from('cash_movements').upsert(batch, { onConflict: 'user_id,business_id,local_id' });
                if (error) throw error;
            }
            return payload.length;
        } catch (e) {
            console.warn('⚠️ Error en pushCashMovements:', e.message);
            return 0;
        }
    }

    /**
     * Descargar movimientos de caja desde Supabase Cloud e insertarlos en SQLite
     */
    static async pullCashMovements(userId) {
        const client = this.getClient();
        if (!client || !userId) return 0;
        const businessId = this.getCurrentBusinessId();

        try {
            const { data: cloudMov, error } = await client
                .from('cash_movements')
                .select('*')
                .eq('user_id', userId)
                .eq('business_id', String(businessId))
                .order('movement_date', { ascending: false })
                .limit(200);

            if (error) throw error;
            if (!cloudMov || cloudMov.length === 0) return 0;

            const localMov = (typeof db !== 'undefined' && db.getAll) ? await db.getAll('cashMovements') : [];
            const existingKeys = new Set(localMov.map(m => String(m.server_id || m.cloud_id || `${m.date}_${m.amount}_${m.concept}`)));

            let inserted = 0;
            for (const cm of cloudMov) {
                const targetId = String(cm.local_id || cm.id);
                const signature = `${cm.movement_date}_${cm.amount}_${cm.concept}`;

                if (!existingKeys.has(targetId) && !existingKeys.has(signature) && !cm.is_deleted) {
                    const newMov = {
                        cashRegisterId: cm.cash_register_id ? (isNaN(cm.cash_register_id) ? cm.cash_register_id : Number(cm.cash_register_id)) : null,
                        amount: Number(cm.amount || 0),
                        type: cm.movement_type || 'in',
                        description: cm.concept || cm.reason || '',
                        concept: cm.concept || cm.reason || '',
                        reason: cm.reason || cm.concept || '',
                        date: cm.movement_date,
                        user: cm.created_by || 'Cajero Móvil',
                        server_id: targetId,
                        cloud_id: targetId,
                        business_id: businessId,
                        source: 'mobile',
                        is_synced: 1
                    };

                    if (typeof db !== 'undefined' && db.add) {
                        await db.add('cashMovements', newMov);
                        existingKeys.add(targetId);
                        inserted++;
                    }
                }
            }
            return inserted;
        } catch (e) {
            console.warn('⚠️ Error en pullCashMovements:', e.message);
            return 0;
        }
    }

    /**
     * Sincronizar cajeros y personal hacia la nube
     */
    static async pushStaff(userId) {
        const client = this.getClient();
        if (!client || !userId) return 0;
        const businessId = this.getCurrentBusinessId();

        try {
            const localUsers = (typeof User !== 'undefined' && typeof User.getAll === 'function') ? await User.getAll() : [];
            if (!localUsers || localUsers.length === 0) return 0;

            const payload = localUsers.map(u => ({
                user_id: userId,
                business_id: String(businessId),
                local_id: String(u.id),
                name: u.username || u.name || 'Cajero',
                pin: String(u.pin || '0000'),
                role: u.role || 'cashier',
                branch_code: u.branch_code || '',
                is_active: u.isActive !== false,
                is_deleted: Boolean(u.deletedAt),
                updated_at: new Date().toISOString()
            }));

            const { error } = await client.from('staff').upsert(payload, { onConflict: 'user_id,business_id,local_id' });
            if (error) throw error;
            return payload.length;
        } catch (e) {
            console.warn('⚠️ Error en pushStaff:', e.message);
            return 0;
        }
    }

    /**
     * Descargar cajeros y personal desde la nube hacia la PC
     */
    static async pullStaff(userId) {
        const client = this.getClient();
        if (!client || !userId) return 0;

        try {
            const { data: cloudStaff, error } = await client
                .from('staff')
                .select('*')
                .eq('user_id', userId);

            if (error) throw error;
            if (!cloudStaff || cloudStaff.length === 0) return 0;

            if (typeof User !== 'undefined' && typeof User.getAll === 'function') {
                const localUsers = await User.getAll();
                const localNames = new Set(localUsers.map(u => (u.username || '').toLowerCase()));

                for (const cs of cloudStaff) {
                    if (!cs.is_deleted && cs.name && !localNames.has(cs.name.toLowerCase())) {
                        try {
                            await User.create(cs.name, cs.pin || '123456');
                        } catch (_) {}
                    }
                }
            }
            return cloudStaff.length;
        } catch (e) {
            console.warn('⚠️ Error en pullStaff:', e.message);
            return 0;
        }
    }

    /**
     * Sincronización de Categorías con Supabase Cloud
     */
    static async pushCategories(userId) {
        const client = this.getClient();
        if (!client || !userId) return 0;
        const businessId = this.getCurrentBusinessId();
        try {
            const localCats = (typeof Category !== 'undefined' && typeof Category.getAll === 'function')
                ? await Category.getAll()
                : [];
            if (!localCats || localCats.length === 0) return 0;

            const payload = localCats.map(c => ({
                user_id: userId,
                business_id: String(businessId),
                local_id: String(c.id || c.name),
                name: c.name,
                color: c.color || '#2563eb',
                icon: c.icon || 'tag',
                is_deleted: false,
                updated_at: new Date().toISOString()
            }));

            const { error } = await client
                .from('categories')
                .upsert(payload, { onConflict: 'user_id,business_id,local_id' });

            return error ? 0 : payload.length;
        } catch (_) { return 0; }
    }

    static async pullCategories(userId) {
        const client = this.getClient();
        if (!client || !userId) return 0;
        const businessId = this.getCurrentBusinessId();
        try {
            const { data: cloudCats, error } = await client
                .from('categories')
                .select('*')
                .eq('user_id', userId)
                .eq('business_id', String(businessId))
                .eq('is_deleted', false);

            if (error || !cloudCats || cloudCats.length === 0) return 0;

            let count = 0;
            const existing = (typeof Category !== 'undefined' && typeof Category.getAll === 'function')
                ? await Category.getAll()
                : [];

            for (const cc of cloudCats) {
                const clean = (cc.name || '').toLowerCase().trim();
                const matched = existing.find(c => (c.name || '').toLowerCase().trim() === clean);
                if (!matched && cc.name) {
                    try {
                        if (typeof Category !== 'undefined' && typeof Category.create === 'function') {
                            await Category.create(cc.name, cc.color || '#2563eb');
                            count++;
                        }
                    } catch (_) {}
                } else if (matched && cc.color && matched.color !== cc.color) {
                    try {
                        if (typeof Category !== 'undefined' && typeof Category.rename === 'function') {
                            await Category.rename(matched.id, matched.name, matched.name, cc.color);
                            count++;
                        }
                    } catch (_) {}
                }
            }
            return count;
        } catch (_) { return 0; }
    }

    /**
     * Sincronización de Abonos a Deudas / Fiados
     */
    static async pushDebtPayments(userId) {
        const client = this.getClient();
        if (!client || !userId) return 0;
        const businessId = this.getCurrentBusinessId();
        try {
            const localPayments = (typeof Payment !== 'undefined' && typeof Payment.getAll === 'function')
                ? await Payment.getAll()
                : [];
            if (!localPayments || localPayments.length === 0) return 0;

            const recentPayments = localPayments.slice(-100);
            const payload = recentPayments.map(p => ({
                user_id: userId,
                business_id: String(businessId),
                local_id: String(p.id),
                customer_id: String(p.customerId || ''),
                amount: parseFloat(p.amount || 0),
                payment_method: p.paymentMethod || 'cash',
                notes: p.notes || '',
                payment_date: p.date || new Date().toISOString(),
                cash_register_id: p.cashRegisterId ? String(p.cashRegisterId) : null,
                is_deleted: false,
                created_at: p.date || new Date().toISOString()
            }));

            const { error } = await client
                .from('debt_payments')
                .upsert(payload, { onConflict: 'user_id,business_id,local_id' });

            return error ? 0 : payload.length;
        } catch (_) { return 0; }
    }

    static async pullDebtPayments(userId) {
        const client = this.getClient();
        if (!client || !userId) return 0;
        const businessId = this.getCurrentBusinessId();
        try {
            const { data: cloudPayments, error } = await client
                .from('debt_payments')
                .select('*')
                .eq('user_id', userId)
                .eq('business_id', String(businessId))
                .order('created_at', { ascending: false })
                .limit(100);

            if (error || !cloudPayments || cloudPayments.length === 0) return 0;

            let count = 0;
            const localPayments = (typeof Payment !== 'undefined' && typeof Payment.getAll === 'function')
                ? await Payment.getAll()
                : [];
            const existingIds = new Set(localPayments.map(p => String(p.server_id || p.id)));

            for (const cp of cloudPayments) {
                const targetId = String(cp.local_id || cp.id);
                if (!existingIds.has(targetId)) {
                    try {
                        if (typeof db !== 'undefined' && db.add) {
                            await db.add('payments', {
                                customerId: parseInt(cp.customer_id) || null,
                                amount: parseFloat(cp.amount || 0),
                                paymentMethod: cp.payment_method || 'cash',
                                date: cp.payment_date || cp.created_at,
                                notes: cp.notes || 'Abono desde app móvil',
                                server_id: targetId,
                                business_id: businessId
                            });
                            existingIds.add(targetId);
                            count++;
                        }
                    } catch (_) {}
                }
            }
            return count;
        } catch (_) { return 0; }
    }

    /**
     * Sincronización de Ajustes del Negocio y Datos Bancarios
     */
    static async pushBusinessSettings(userId) {
        const client = this.getClient();
        if (!client || !userId) return 0;
        try {
            const bizName = localStorage.getItem('PMV_BIZ') || 'Mi Negocio';
            const bizRut = localStorage.getItem('PMV_BIZ_TAX') || localStorage.getItem('PMV_RUT') || '';
            const bizPhone = localStorage.getItem('PMV_PHONE') || '';
            const bizAddress = localStorage.getItem('PMV_ADDRESS') || '';
            let bankInfo = {};
            try {
                bankInfo = JSON.parse(localStorage.getItem('PMV_BANK_INFO') || '{}');
            } catch (_) {}
            bankInfo.allowMultipleCashRegisters = localStorage.getItem('allowMultipleCashRegisters') === 'true';

            const { error } = await client.from('business_settings').upsert({
                user_id: userId,
                biz_name: bizName,
                biz_rut: bizRut,
                biz_phone: bizPhone,
                biz_address: bizAddress,
                bank_info: bankInfo,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

            return error ? 0 : 1;
        } catch (_) { return 0; }
    }

    static async pullBusinessSettings(userId) {
        const client = this.getClient();
        if (!client || !userId) return 0;
        try {
            const { data, error } = await client
                .from('business_settings')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error || !data) return 0;

            if (data.biz_name && !localStorage.getItem('PMV_BIZ')) {
                localStorage.setItem('PMV_BIZ', data.biz_name);
            }
            if (data.biz_rut && !localStorage.getItem('PMV_BIZ_TAX')) {
                localStorage.setItem('PMV_BIZ_TAX', data.biz_rut);
            }
            if (data.bank_info && typeof data.bank_info === 'object') {
                if (data.bank_info.allowMultipleCashRegisters !== undefined) {
                    localStorage.setItem('allowMultipleCashRegisters', String(data.bank_info.allowMultipleCashRegisters));
                }
                localStorage.setItem('PMV_BANK_INFO', JSON.stringify(data.bank_info));
            }
            return 1;
        } catch (_) { return 0; }
    }

    /**
     * Sincronización de Movimientos de Stock / Mermas / Ajustes hacia Supabase
     */
    static async pushStockMovements(userId) {
        const client = this.getClient();
        if (!client || !userId) return 0;
        const businessId = this.getCurrentBusinessId();
        try {
            let localMovements = [];
            if (typeof db !== 'undefined' && typeof db.getAll === 'function') {
                localMovements = await db.getAll('stockMovements') || [];
            }
            if (!localMovements || localMovements.length === 0) return 0;

            const recentMovements = localMovements.slice(-200);
            const payload = recentMovements.map(m => ({
                user_id: userId,
                business_id: String(businessId),
                local_id: String(m.id || m.local_id),
                product_id: m.productId ? String(m.productId) : '',
                product_code: m.productCode || m.code || '',
                product_name: m.productName || m.name || '',
                type: m.type || 'adjustment',
                quantity: parseFloat(m.quantity || 0),
                reference: m.reference || '',
                reason: m.reason || '',
                notes: m.notes || '',
                cost_value: parseFloat(m.cost_value || m.costValue || 0),
                sale_value: parseFloat(m.sale_value || m.saleValue || 0),
                date: m.date || new Date().toISOString(),
                movement_date: m.date || new Date().toISOString(),
                is_deleted: false,
                updated_at: new Date().toISOString()
            }));

            const BATCH_SIZE = 100;
            let totalSaved = 0;
            for (let i = 0; i < payload.length; i += BATCH_SIZE) {
                const chunk = payload.slice(i, i + BATCH_SIZE);
                const { error } = await client
                    .from('stock_movements')
                    .upsert(chunk, { onConflict: 'user_id,business_id,local_id' });
                if (!error) {
                    totalSaved += chunk.length;
                } else {
                    console.warn('⚠️ Error subiendo stock_movements en PC:', error.message);
                }
            }

            return totalSaved;
        } catch (e) {
            console.warn('⚠️ Error en pushStockMovements (PC):', e.message);
            return 0;
        }
    }

    /**
     * Descarga de Movimientos de Stock / Mermas / Ajustes desde Supabase
     */
    static async pullStockMovements(userId) {
        const client = this.getClient();
        if (!client || !userId) return 0;
        const businessId = this.getCurrentBusinessId();
        try {
            const { data: cloudMovements, error } = await client
                .from('stock_movements')
                .select('*')
                .eq('user_id', userId)
                .eq('business_id', String(businessId))
                .order('date', { ascending: false })
                .limit(200);

            if (error || !cloudMovements || cloudMovements.length === 0) return 0;

            let localMovements = [];
            if (typeof db !== 'undefined' && typeof db.getAll === 'function') {
                localMovements = await db.getAll('stockMovements') || [];
            }
            const existingIds = new Set(localMovements.map(m => String(m.server_id || m.local_id || m.id)));

            let count = 0;
            for (const cm of cloudMovements) {
                const targetId = String(cm.local_id || cm.id);
                if (!existingIds.has(targetId) && !cm.is_deleted) {
                    try {
                        if (typeof db !== 'undefined' && db.add) {
                            await db.add('stockMovements', {
                                productId: cm.product_id ? (parseInt(cm.product_id) || cm.product_id) : null,
                                productCode: cm.product_code || '',
                                productName: cm.product_name || '',
                                type: cm.type || 'adjustment',
                                quantity: parseFloat(cm.quantity || 0),
                                reference: cm.reference || '',
                                reason: cm.reason || '',
                                notes: cm.notes || '',
                                cost_value: parseFloat(cm.cost_value || 0),
                                sale_value: parseFloat(cm.sale_value || 0),
                                date: cm.date || cm.movement_date || cm.created_at,
                                server_id: targetId,
                                business_id: businessId
                            });
                            existingIds.add(targetId);
                            count++;
                        }
                    } catch (_) {}
                }
            }
            return count;
        } catch (e) {
            console.warn('⚠️ Error en pullStockMovements (PC):', e.message);
            return 0;
        }
    }

    /**
     * Actualiza el botón/insignia visual en la barra superior
     */
    static updateUI(status, tooltip = '') {
        const badge = document.getElementById('cloud-sync-badge');
        if (!badge) return;

        badge.title = tooltip || status;

        const hasCloudSession = Boolean(localStorage.getItem('SUPABASE_ACCESS_TOKEN') || sessionStorage.getItem('SUPABASE_ACCESS_TOKEN'));
        const canLiveSync = typeof LicenseService !== 'undefined' && LicenseService.canLiveSync();
        const canBackup = typeof LicenseService !== 'undefined' && LicenseService.canBackup();

        // Si está en modo local o plan FREE, mostrar siempre 'Modo Local Offline'
        if (!hasCloudSession || !canBackup) {
            badge.innerHTML = '💻 Modo Local Offline';
            badge.style.background = '#f3f4f6';
            badge.style.color = '#4b5563';
            badge.style.borderColor = '#d1d5db';
            badge.title = 'Modo Local: Datos guardados únicamente en esta computadora (Plan Free)';
            return;
        }

        switch (status) {
            case 'syncing':
                badge.innerHTML = '🔄 Sincronizando...';
                badge.style.background = '#e0e7ff';
                badge.style.color = '#4338ca';
                badge.style.borderColor = '#c7d2fe';
                break;
            case 'synced':
                badge.innerHTML = canLiveSync ? '🟢 Nube Conectada' : '☁️ Respaldo Cloud Activo';
                badge.style.background = '#ecfdf5';
                badge.style.color = '#065f46';
                badge.style.borderColor = '#a7f3d0';
                break;
            case 'offline':
                badge.innerHTML = '🟠 Sin Internet';
                badge.style.background = '#fffbeb';
                badge.style.color = '#92400e';
                badge.style.borderColor = '#fde68a';
                break;
            case 'error':
                badge.innerHTML = '⚠️ Error Respaldo';
                badge.style.background = '#fef2f2';
                badge.style.color = '#991b1b';
                badge.style.borderColor = '#fecaca';
                break;
        }
    }
}

window.SyncService = SyncService;
