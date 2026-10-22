const app = {
    currentView: 'pos',
    views: {},
    lastServerActivity: 0,
    activityInterval: null,

    // Catálogo maestro de módulos para personalización de la barra inferior (máximo 6)
    NAV_MODULES: [
        { id: 'pos', name: 'Punto de Venta', icon: '🛒', shortName: 'POS' },
        { id: 'customers', name: 'Clientes', icon: '👥', shortName: 'Clientes' },
        { id: 'purchases', name: 'Compras', icon: '📋', shortName: 'Compras' },
        { id: 'cash', name: 'Caja', icon: '💰', shortName: 'Caja' },
        { id: 'products', name: 'Productos', icon: '📦', shortName: 'Productos' },
        { id: 'inventory', name: 'Control Stock', icon: '📋', shortName: 'Stock' },
        { id: 'suppliers', name: 'Proveedores', icon: '🚚', shortName: 'Proveedores' },
        { id: 'expenses', name: 'Gastos', icon: '💸', shortName: 'Gastos' },
        { id: 'sales', name: 'Historial Ventas', icon: '🧾', shortName: 'Ventas' },
        { id: 'reports', name: 'Reportes', icon: '📈', shortName: 'Reportes' },
        { id: 'creditNotes', name: 'Devoluciones', icon: '↩️', shortName: 'Devoluciones' },
        { id: 'settings', name: 'Configuración', icon: '⚙️', shortName: 'Ajustes' },
        { id: 'auditLogs', name: 'Auditoría', icon: '🕵️', shortName: 'Auditoría' }
    ],
    DEFAULT_NAV_BAR: ['pos', 'customers', 'purchases', 'cash'],

    async init() {
        console.log('🚀 [App] Iniciando aplicación...');
        
        // Inicializar mapeo de vistas de forma defensiva
        this.views = {
            pos: typeof POSView !== 'undefined' ? POSView : null,
            products: typeof ProductsView !== 'undefined' ? ProductsView : null,
            customers: typeof CustomersView !== 'undefined' ? CustomersView : null,
            suppliers: typeof SuppliersView !== 'undefined' ? SuppliersView : null,
            purchases: typeof PurchasesView !== 'undefined' ? PurchasesView : null,
            cash: typeof CashView !== 'undefined' ? CashView : null,
            expenses: typeof ExpensesView !== 'undefined' ? ExpensesView : null,
            inventory: typeof InventoryView !== 'undefined' ? InventoryView : null,
            reports: typeof ReportsView !== 'undefined' ? ReportsView : null,
            sales: typeof SalesView !== 'undefined' ? SalesView : null,
            creditNotes: typeof CreditNotesView !== 'undefined' ? CreditNotesView : null,
            settings: typeof SettingsView !== 'undefined' ? SettingsView : null,
            auditLogs: typeof AuditLogsView !== 'undefined' ? AuditLogsView : null
        };

        console.log('📊 [App] Vistas registradas:', Object.keys(this.views).filter(k => this.views[k] !== null));
        const missingViews = Object.keys(this.views).filter(k => this.views[k] === null);
        if (missingViews.length > 0) {
            console.warn('⚠️ [App] Vistas no encontradas:', missingViews);
        }

        // LA LIMPIEZA POST-MIGRACIÓN SE ELIMINÓ: 
        // Ya no forzamos ID 1 para permitir multi-tenant real.

        try {
            console.log('🔌 [App] Inicializando Base de Datos...');
            const initialized = await db.init();
            if (!initialized) throw new Error('No se pudo inicializar la base de datos');
            console.log('✅ [App] Base de Datos lista');

            await User.initializeDefaultUser();
            console.log('✅ [App] Usuarios inicializados');

            // Verificar si venimos de un callback de Google OAuth (Supabase)
            if (typeof AuthManager.checkOAuthCallback === 'function') {
                await AuthManager.checkOAuthCallback();
            }

            if (!AuthManager.isAuthenticated()) {
                console.log('🔐 [App] Usuario no autenticado, mostrando login...');
                AuthManager.showLoginScreen();
                this.hideSplashScreen();
                return;
            }

            console.log('🔍 [App] Verificando integridad de categorías...');
            await this.checkAndInitializeCategories();

            console.log('🛠️ [App] Configurando sistema...');
            this.setupNavigation();
            this.renderNavigation();
            this.setupServiceWorker();
            KeyboardManager.init();

            console.log('💾 [App] Iniciando backup automático...');
            await this.startAutoBackup();
            this.setupBackupOnClose();

            console.log('📋 [App] Aplicando permisos...');
            this.applyPermissionsToSidebar();

            console.log('🚀 [App] Navegando a vista inicial (pos)...');
            await this.navigate('pos');

            console.log('💰 [App] Actualizando estado de caja...');
            await this.updateCashStatus();
            this.updateSidebarUser();

            AuthManager.addLogoutButton();

            // Iniciar Licencias, Notas y Sincronización con Supabase Cloud
            if (typeof LicenseService !== 'undefined') {
                await LicenseService.init();
            }
            if (typeof NotesService !== 'undefined' && typeof NotesService.init === 'function') {
                await NotesService.init();
            }
            if (typeof SyncService !== 'undefined') {
                SyncService.init();
                setTimeout(() => SyncService.syncAll(), 1500);
            }
            
            this.startActivityMonitor();
            
            console.log('✨ [App] Inicialización completada con éxito');
            this.hideSplashScreen();

            // --- NUEVO: ALERTA DE COBRANZA AL ENTRAR ---
            setTimeout(() => this.checkCollectionAlerts(), 1500);

        } catch (error) {
            console.error('❌ [App] Error fatal en inicialización:', error);
            showNotification('Error al inicializar: ' + error.message, 'error');
            const container = document.getElementById('view-container');
            if (container) {
                container.innerHTML = `
                    <div style="padding: 3rem; text-align: center; color: #991b1b; background: #fef2f2; border: 1px solid #fee2e2; border-radius: 1.5rem; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05); max-width: 500px; margin: 2rem auto;">
                        <h2 style="margin-bottom: 1rem; color: #b91c1c;">❌ Error Crítico</h2>
                        <p style="margin-bottom: 2rem; color: #7f1d1d; opacity: 0.8;">${error.message}</p>
                        <button class="btn btn-primary" onclick="window.location.reload()">🔄 Reintentar Carga</button>
                    </div>
                `;
            }
            this.hideSplashScreen();
            if (document.getElementById('app')) document.getElementById('app').style.display = 'flex';
        }
    },

    hideSplashScreen() {
        const splash = document.getElementById('splash-screen');
        const appDiv = document.getElementById('app');
        if (splash) {
            splash.style.transition = 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
            splash.style.opacity = '0';
            splash.style.transform = 'scale(1.02)';
            splash.style.pointerEvents = 'none';
            setTimeout(() => {
                if (splash) splash.style.display = 'none';
            }, 420);
        }
        if (appDiv) {
            appDiv.style.display = 'flex';
            appDiv.style.opacity = '1';
        }
        if (typeof AuthManager !== 'undefined' && typeof AuthManager.isAuthenticated === 'function' && AuthManager.isAuthenticated()) {
            const loginScreen = document.getElementById('login-screen');
            if (loginScreen) loginScreen.remove();
        }
    },

    async checkAndInitializeCategories() {
        try {
            const categories = await db.getAll('categories');
            if (categories.length === 0) {
                const defaultCategories = [
                    { name: 'General', color: '#6b7280' },
                    { name: 'Bebidas', color: '#3b82f6' },
                    { name: 'Abarrotes', color: '#f59e0b' },
                    { name: 'Lácteos', color: '#10b981' },
                    { name: 'Panadería', color: '#f97316' },
                    { name: 'Carnes', color: '#ef4444' },
                    { name: 'Verduras', color: '#22c55e' },
                    { name: 'Limpieza', color: '#8b5cf6' }
                ];

                for (const cat of defaultCategories) {
                    await db.add('categories', cat);
                }
            }

            // Normalización y unificación automática de categorías en la BD
            if (typeof Category !== 'undefined') {
                await Category.normalizeAll();
            }
        } catch (e) {
            console.warn('⚠️ Error inicializando/normalizando categorías:', e);
        }
    },

    setupNavigation() {
        const navLinks = document.querySelectorAll('.nav-menu a');

        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const view = link.dataset.view;

                if (view === 'products' && typeof ProductsView !== 'undefined') {
                    ProductsView.selectedCategory = null;
                    ProductsView.stockFilter = 'all';
                }

                this.navigate(view);

                const sidebar = document.getElementById('sidebar');
                const overlay = document.getElementById('mobile-overlay');
                if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('active')) {
                    sidebar.classList.remove('active');
                    if (overlay) overlay.style.display = 'none';
                }
            });
        });

        // BLOQUEO DE MOUSE DURANTE NAVEGACIÓN POR TECLADO (Evita interferencias con el puntero)
        window.addEventListener('keydown', (e) => {
            if (['ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) {
                document.body.classList.add('keyboard-nav');
            }
        });

        window.addEventListener('mousemove', () => {
            document.body.classList.remove('keyboard-nav');
        });
    },

    // ponytail: Obtiene accesos prioritarios guardados (mínimo 2, máximo 6) o devuelve los predeterminados
    getNavItems() {
        try {
            const saved = localStorage.getItem('CUSTOM_NAV_ITEMS');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length >= 2 && parsed.length <= 6) {
                    const validIds = this.NAV_MODULES.map(m => m.id);
                    const filtered = parsed.filter(id => validIds.includes(id));
                    if (filtered.length >= 2 && filtered.length <= 6) {
                        return filtered;
                    }
                }
            }
        } catch (e) {
            console.warn('⚠️ [App] Error parseando CUSTOM_NAV_ITEMS:', e);
        }
        return [...this.DEFAULT_NAV_BAR];
    },

    // ponytail: Renderiza dinámicamente la barra inferior y el cajón 'Más Módulos'
    renderNavigation() {
        const bottomNav = document.getElementById('bottom-nav');
        const moreGrid = document.querySelector('.more-menu-grid');
        if (!bottomNav || !moreGrid) return;

        const activeBarIds = this.getNavItems();
        const modulesMap = new Map(this.NAV_MODULES.map(m => [m.id, m]));

        // 1. Accesos prioritarios en la barra inferior (máximo 6)
        let navHtml = '';
        activeBarIds.forEach(id => {
            const mod = modulesMap.get(id);
            if (!mod) return;
            const isActive = this.currentView === mod.id;
            navHtml += `
                <a href="#" data-view="${mod.id}" class="nav-item ${isActive ? 'active' : ''}" onclick="app.navigate('${mod.id}')">
                    <span class="nav-icon">${mod.icon}</span>
                    <span class="nav-label">${mod.shortName || mod.name}</span>
                </a>
            `;
        });

        // Botón fijo 'Más Módulos' al final
        navHtml += `
            <button type="button" class="nav-item nav-more-btn" onclick="app.toggleMoreMenu()">
                <span class="nav-icon">☰</span>
                <span class="nav-label">Más Módulos</span>
            </button>
        `;
        bottomNav.innerHTML = navHtml;

        // 2. Módulos restantes en el panel flotante 'Más Módulos'
        let moreHtml = '';
        this.NAV_MODULES.forEach(mod => {
            if (!activeBarIds.includes(mod.id)) {
                const isActive = this.currentView === mod.id;
                moreHtml += `
                    <a href="#" data-view="${mod.id}" class="more-menu-item ${isActive ? 'active' : ''}" onclick="app.navigate('${mod.id}'); app.toggleMoreMenu(false);">
                        <span class="item-icon">${mod.icon}</span>
                        <span class="item-title">${mod.name}</span>
                    </a>
                `;
            }
        });
        moreGrid.innerHTML = moreHtml;

        // 3. Aplicar permisos de roles a los botones recién generados
        this.applyPermissionsToSidebar();
    },

    openNotesModal(tab = 'all', filterCustomer = '') {
        if (typeof NotesModal !== 'undefined' && typeof NotesModal.open === 'function') {
            NotesModal.open(tab, filterCustomer);
        } else if (typeof CashView !== 'undefined' && typeof CashView.openNotesModal === 'function') {
            CashView.openNotesModal();
        }
    },

    async navigate(viewName) {
        if (viewName === 'notes') {
            this.openNotesModal();
            return;
        }
        console.log(`📍 [App] Navegando a: ${viewName}`);
        
        // Cerrar limpiamente cualquier ventana modal que estuviera abierta antes de cambiar de módulo
        if (typeof closeAllModals === 'function') {
            closeAllModals();
        }

        // Quitar pantalla de login si el usuario ya está autenticado
        if (typeof AuthManager !== 'undefined' && typeof AuthManager.isAuthenticated === 'function' && AuthManager.isAuthenticated()) {
            const loginScreen = document.getElementById('login-screen');
            if (loginScreen) loginScreen.remove();
        }

        const view = this.views[viewName];
        if (!view) {
            console.error(`❌ [App] Vista "${viewName}" no encontrada o no cargada.`);
            showNotification(`Error: La sección "${viewName}" no está disponible.`, 'error');
            return;
        }

        const previousViewName = this.currentView;

        const navPerm = 'nav.' + viewName;
        if (!PermissionService.can(navPerm)) {
            console.warn(`🚫 [App] Acceso denegado a "${viewName}" para el rol actual.`);
            showNotification('🔒 Sección bloqueada: Tu rol actual no tiene permiso para ingresar aquí.', 'warning');
            return;
        }

        if (previousViewName && previousViewName !== viewName) {
            const prev = this.views[previousViewName];
            if (prev && typeof prev.destroy === 'function') {
                try { prev.destroy(); } catch (e) { console.warn('Error en destroy de vista:', e); }
            }
        }

        // ponytail: Limpiar cualquier dropdown flotante huérfano al cambiar de sección (Tarea 2)
        const activeQuickDropdown = document.getElementById('business-quick-dropdown');
        if (activeQuickDropdown) activeQuickDropdown.remove();

        this.currentView = viewName;

        document.querySelectorAll('#bottom-nav .nav-item, .more-menu-item').forEach(link => {
            link.classList.remove('active');
        });

        const activeLinks = document.querySelectorAll(`[data-view="${viewName}"]`);
        activeLinks.forEach(link => {
            link.classList.add('active');
        });

        const container = document.getElementById('view-container');
        if (container) {
            container.innerHTML = '<div style="text-align: center; padding: 5rem;"><div class="loading"></div><p style="margin-top: 1rem; opacity: 0.6;">Cargando sección...</p></div>';
        }

        try {
            console.log(`🎨 [App] Renderizando vista: ${viewName}`);
            if (typeof view.render !== 'function') {
                throw new Error(`La vista "${viewName}" no tiene un método render().`);
            }
            
            const html = await view.render();
            if (container) container.innerHTML = html;

            if (view.init) {
                console.log(`⚙️ [App] Inicializando vista: ${viewName}`);
                await view.init();
            }
            if (typeof NotesService !== 'undefined' && typeof NotesService.updateAllBadges === 'function') {
                NotesService.updateAllBadges();
            }
            console.log(`✅ [App] Vista ${viewName} lista`);
        } catch (error) {
            console.error(`❌ [App] Error en vista "${viewName}":`, error);
            if (container) {
                container.innerHTML = `
                    <div style="padding: 3rem; text-align: center; background: rgba(239, 68, 68, 0.05); border-radius: 1rem; border: 1px dashed #ef4444;">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
                        <h3 style="color: #ef4444;">Error al cargar la sección</h3>
                        <p style="opacity: 0.7; margin-bottom: 1.5rem;">${error.message}</p>
                        <button class="btn btn-secondary" onclick="app.navigate('pos')">🏠 Volver al Inicio</button>
                    </div>
                `;
            }
        }
    },

    /**
     * Actualiza la vista actual de forma reactiva y silenciosa sin pestañeos,
     * sin spinners intrusivos y preservando el estado de la venta en curso en POS.
     */
    async refreshCurrentViewSilently() {
        if (!this.currentView) return;
        const view = this.views[this.currentView];
        if (!view || typeof view.render !== 'function') return;

        // Invalida caché de base de datos local para que las consultas lean datos frescos
        if (typeof db !== 'undefined' && typeof db.clearCache === 'function') {
            db.clearCache();
        }

        // Si es POS y tiene productos en el carrito, NO sobreescribir el DOM completo
        if (this.currentView === 'pos') {
            if (typeof posController !== 'undefined') {
                const hadEmptyState = document.querySelector('.pos-screen-layout') === null;
                const isOpen = await posController.init();
                // Si la caja cambió de estado (abierta <-> cerrada), re-renderizamos la vista
                if ((hadEmptyState && isOpen) || (!hadEmptyState && !isOpen)) {
                    const container = document.getElementById('view-container');
                    const html = await view.render();
                    if (container) container.innerHTML = html;
                    if (view.init) await view.init();
                } else if (typeof POSView !== 'undefined' && typeof POSView.loadProductSuggestions === 'function') {
                    // Actualiza sugerencias y stock sin parpadear
                    await POSView.loadProductSuggestions();
                }
            }
            return;
        }

        // Blindaje anti-robo de foco: Si el usuario tiene un modal abierto o está escribiendo en un input,
        // NO sobreescribir la vista de fondo ni re-inicializar el DOM para no cortar la escritura.
        const hasOpenModal = document.querySelector('.modal') || 
                             document.body.classList.contains('modal-open') || 
                             document.getElementById('modal-overlay')?.classList.contains('active');
        const isUserTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
        if (hasOpenModal || isUserTyping) {
            console.log('🛡️ [App] Modal activo o usuario escribiendo en un campo. Postergando refresco de fondo...');
            this._pendingViewRefresh = true;
            return;
        }

        // Para otras vistas (ventas, compras, productos, caja, etc.):
        // Re-renderizamos directamente el HTML en el contenedor SIN borrarlo previamente ni mostrar spinner
        const container = document.getElementById('view-container');
        if (!container) return;

        try {
            const html = await view.render();
            container.innerHTML = html;
            if (view.init) await view.init();
        } catch (e) {
            console.warn('[App] Error en refreshCurrentViewSilently:', e);
        }
    },

    toggleMoreMenu(forceState = null) {
        const overlay = document.getElementById('more-menu-overlay');
        if (!overlay) return;
        if (forceState !== null) {
            overlay.style.display = forceState ? 'flex' : 'none';
        } else {
            overlay.style.display = (overlay.style.display === 'none' || overlay.style.display === '') ? 'flex' : 'none';
        }

        if (overlay.style.display !== 'none') {
            if (typeof LicenseService !== 'undefined') LicenseService.updateHeaderBadge();
            if (typeof SyncService !== 'undefined') SyncService.updateUI('synced');
            const hasCloud = Boolean(localStorage.getItem('SUPABASE_ACCESS_TOKEN') || sessionStorage.getItem('SUPABASE_ACCESS_TOKEN'));
            const unlinkBtn = document.getElementById('btn-logout-or-unlink');
            if (unlinkBtn) {
                unlinkBtn.innerHTML = '🚪 Cerrar Sesión';
            }
        }

        // ponytail: Si se cierra la ventana más módulos, destruir el dropdown de sucursales si quedó abierto (Tarea 2)
        if (overlay.style.display === 'none') {
            const quickDropdown = document.getElementById('business-quick-dropdown');
            if (quickDropdown) quickDropdown.remove();
        }
    },

    async updateCashStatus() {
        const isOpen = await CashController.checkCashStatus();
        const currentCashStatus = document.getElementById('currentCashStatus');

        if (currentCashStatus) {
            currentCashStatus.textContent = isOpen ? 'Sí' : 'No';
            currentCashStatus.style.color = isOpen ? '#10b981' : '#ef4444';
        }

        if (this.cashStatusTimer) {
            clearTimeout(this.cashStatusTimer);
        }
        this.cashStatusTimer = setTimeout(() => this.updateCashStatus(), 30000);
    },

    updateSidebarUser() {
        const userNameEl = document.getElementById('currentUserName');
        const user = AuthManager.getCurrentUser();
        if (userNameEl) {
            const role = user ? (PermissionService.ROLE_LABELS[user.role] || user.role || '') : '';
            userNameEl.textContent = user ? user.username : 'Invitado';
            const roleEl = document.getElementById('currentUserRole');
            if (roleEl) {
                roleEl.textContent = role;
            }
        }
        if (typeof AuthManager !== 'undefined' && typeof AuthManager.updateBusinessBadgeUI === 'function') {
            AuthManager.updateBusinessBadgeUI();
        }
    },

    applyPermissionsToSidebar() {
        const navLinks = document.querySelectorAll('#bottom-nav [data-view], .more-menu-item[data-view]');
        navLinks.forEach(link => {
            const view = link.dataset.view;
            const permission = 'nav.' + view;
            const allowed = PermissionService.can(permission);
            let lockSpan = link.querySelector('.perm-lock-icon');

            if (!allowed) {
                if (!lockSpan) {
                    lockSpan = document.createElement('span');
                    lockSpan.className = 'perm-lock-icon';
                    lockSpan.textContent = ' 🔒';
                    lockSpan.style.cssText = 'font-size: 0.72rem; margin-left: 3px; vertical-align: middle;';
                    link.appendChild(lockSpan);
                }
                link.style.opacity = '0.45';
                link.style.filter = 'grayscale(1)';
                link.title = '🔒 Sección bloqueada por permisos del Dueño';
            } else {
                if (lockSpan) lockSpan.remove();
                link.style.opacity = '';
                link.style.filter = '';
                link.removeAttribute('title');
            }
        });
    },

    setupServiceWorker() {
        if (!('serviceWorker' in navigator)) return;
        
        window.addEventListener('load', () => {
            // Usamos la URL base para el Service Worker; el navegador se encarga de detectar cambios reales.
            const swUrl = 'sw.js';
            
            navigator.serviceWorker.register(swUrl).then((registration) => {
                console.log('✅ [Update] ServiceWorker registrado');
                
                // 1. Detectar actualizaciones en el primer carga
                registration.onupdatefound = () => {
                    const installingWorker = registration.installing;
                    if (installingWorker) {
                        installingWorker.onstatechange = () => {
                            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                this.triggerUpdate(registration);
                            }
                        };
                    }
                };

                // 2. SONDEO PROACTIVO: Revisar el servidor cada 20 minutos por cambios en sw.js
                // Esto detecta tus subidas por FileZilla sin que el usuario refresque.
                setInterval(() => {
                    console.log('🔍 [Update] Buscando actualizaciones en el servidor...');
                    registration.update();
                }, 1000 * 60 * 20); 

                // 3. Si ya hay una actualización esperando de una sesión anterior
                if (registration.waiting) {
                    this.triggerUpdate(registration);
                }
            }).catch(err => console.warn('❌ [Update] SW Falló:', err));
        });

        // Escuchar cuando el Service Worker toma el mando para recargar la página
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
        });
    },

    /**
     * Dispara la interfaz visual de actualización
     */
    triggerUpdate(registration) {
        if (typeof showUpdateNotification === 'function') {
            showUpdateNotification(() => {
                if (registration.waiting) {
                    registration.waiting.postMessage({ action: 'skipWaiting' });
                }
            });
        } else {
            // Fallback si alerts.js no cargó
            this.showUpdateNotificationLegacy(registration);
        }
    },

    /**
     * Mantengo el método anterior como respaldo oculto
     */
    showUpdateNotificationLegacy(registration) {
        const notification = document.createElement('div');
        notification.id = 'update-notification';
        notification.style.cssText = `
            position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
            background: #2563eb; color: white; padding: 1rem 1.5rem;
            border-radius: 50px; display: flex; align-items: center; gap: 1rem;
            box-shadow: 0 10px 25px rgba(37,99,235,0.4); z-index: 99999;
            animation: slideUp 0.3s ease-out; font-weight: 500;
        `;

        notification.innerHTML = `
            <span>✨ Nueva versión disponible</span>
            <button id="update-btn" style="
                background: white; color: #2563eb; border: none; 
                padding: 0.4rem 1rem; border-radius: 20px; font-weight: 700;
                cursor: pointer; font-size: 0.8rem;
            ">REINICIAR</button>
        `;

        document.body.appendChild(notification);
        document.getElementById('update-btn').addEventListener('click', () => {
            if (registration.waiting) {
                registration.waiting.postMessage({ action: 'skipWaiting' });
                window.location.reload();
            }
        });
    },

    async startAutoBackup() {
        if (typeof window === 'undefined' || !window.api || typeof window.api.backupSaveToDisk !== 'function') return;
        try {
            const enabledRow = await db.get('settings', 'autoBackupEnabled');
            const enabled = enabledRow == null ? true : !!enabledRow.value;
            const hoursRow = await db.get('settings', 'autoBackupIntervalHours');
            const hours = (hoursRow && Number(hoursRow.value)) || 24;
            const intervalMs = Math.max(1, hours) * 60 * 60 * 1000;
            if (enabled) {
                setInterval(() => {
                    if (window.BackupManager) window.BackupManager.exportAllDataToDisk();
                }, intervalMs);
            }
        } catch (e) {
            console.warn('Auto backup skipped:', e.message);
        }
    },

    setupBackupOnClose() {
        if (typeof window === 'undefined' || !window.api || typeof window.api.onBeforeQuit !== 'function') return;
        window.api.onBeforeQuit(async () => {
            try {
                const row = await db.get('settings', 'autoBackupOnClose');
                const doBackup = row == null ? true : !!row.value;
                if (doBackup && window.BackupManager) {
                    const data = await window.BackupManager.getBackupData();
                    window.api.sendBackupData(JSON.stringify(data));
                } else {
                    window.api.sendBackupSkip();
                }
            } catch (e) {
                window.api.sendBackupSkip();
            }
        });
    },

    // --- SINCRONIZACIÓN EN TIEMPO REAL (HEARTBEAT) ---
    
    /**
     * Inicia el monitor de actividad que consulta al servidor cada 10 segundos
     */
    startActivityMonitor() {
        if (this.activityInterval) clearInterval(this.activityInterval);
        
        // Primera ejecución inmediata
        this.checkServerActivity();
        
        // Intervalo de 10 segundos para balancear reactividad y carga de red
        this.activityInterval = setInterval(() => this.checkServerActivity(), 10000);
        console.log('💓 [Sync] Monitor de actividad iniciado (10s)');
    },

    /**
     * Consulta el estado de actividad del servidor
     */
    async checkServerActivity() {
        if (db.mode !== 'sqlite' || !AuthManager.isAuthenticated()) return;

        try {
            const data = await window.ApiClient.get('system/activity');
            if (data && data.lastActivity) {
                const serverTs = parseInt(data.lastActivity, 10);
                
                // Si es la primera vez, solo guardamos el timestamp
                if (this.lastServerActivity === 0) {
                    this.lastServerActivity = serverTs;
                    return;
                }

                // Si hubo cambios en el servidor que no conocemos localmente
                if (serverTs > this.lastServerActivity) {
                    console.log(`🔄 [Sync] Actividad detectada (${serverTs}). Sincronizando...`);
                    this.lastServerActivity = serverTs;
                    await this.handleServerUpdate();
                }
            }
        } catch (error) {
            // Silencioso para evitar spam en consola por problemas de red temporales
            if (error.name !== 'AbortError') {
                console.debug('[Sync] Error consultando actividad:', error.message);
            }
        }
    },

    /**
     * Procesa una actualización desde el servidor limpiando caché y refrescando vista
     */
    async handleServerUpdate() {
        // 1. Limpiar caché de datos volátiles
        db.clearCache('products');
        db.clearCache('sales');
        db.clearCache('purchases');
        db.clearCache('customers');
        db.clearCache('stockMovements');
        db.clearCache('suppliers');
        db.clearCache('payments');

        // ponytail: Si hay modales abiertos o el usuario está interactuando con inputs, NO refrescar la vista para no borrar datos
        const hasOpenModal = !!(document.querySelector('.modal') || document.body.classList.contains('modal-open'));
        const activeTag = document.activeElement ? document.activeElement.tagName.toUpperCase() : '';
        const isUserTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag);

        if (hasOpenModal || isUserTyping) {
            console.log('⏳ [Sync] Sincronización visual pospuesta: usuario operando en modal o formulario.');
            return;
        }

        // 2. Refrescar la vista actual de forma "silenciosa" si es seguro
        const safeToRefresh = ['sales', 'purchases', 'inventory', 'reports', 'auditLogs', 'customers', 'suppliers'];
        
        if (safeToRefresh.includes(this.currentView)) {
            console.log(`✨ [Sync] Refrescando vista: ${this.currentView}`);
            const viewInstance = this.views[this.currentView];
            if (viewInstance && typeof viewInstance.refresh === 'function') {
                await viewInstance.refresh();
                console.log(`⚡ [Sync] Vista "${this.currentView}" actualizada silenciosamente vía refresh()`);
            } else if (viewInstance && typeof viewInstance.render === 'function') {
                // Reset de estado interno de la vista si es necesario
                if (viewInstance.offset !== undefined) {
                    viewInstance.offset = 0;
                }
                if (viewInstance.allSales) {
                    viewInstance.allSales = [];
                }
                
                // ponytail: actualización suave sin recarga destructiva del DOM para erradicar el pestañeo
                // notificación silenciada para no distraer al cajero
            }
        } else if (this.currentView === 'pos') {
            db.warmCache();
            console.log('⚡ [Sync] Caché de POS actualizada en background');
        }
    },

    stopActivityMonitor() {
        if (this.activityInterval) {
            clearInterval(this.activityInterval);
            this.activityInterval = null;
        }
    },



    async checkCollectionAlerts() {
        try {
            if (typeof AccountService === 'undefined') return;
            const alerts = await AccountService.getCollectionAlerts();
            
            if (alerts.length > 0) {
                // NOTIFICACIÓN FLOTANTE ELIMINADA: Ya no se muestra ventana emergente molesta al iniciar.
                // Solo se mantiene el indicador silencioso (punto rojo) en la pestaña Reportes.

                // Añadir punto rojo al menú lateral (Reportes) de forma discreta
                const reportBtn = document.querySelector('[data-view="reports"]');
                if (reportBtn && !document.getElementById('reports-alert-dot')) {
                   reportBtn.style.position = 'relative';
                   const dot = document.createElement('span');
                   dot.id = 'reports-alert-dot';
                   dot.style.cssText = "position:absolute; top:8px; right:8px; width:10px; height:10px; background:#ef4444; border-radius:50%; border:2px solid #1f2937; box-shadow: 0 0 10px rgba(239, 68, 68, 0.5);";
                   reportBtn.appendChild(dot);
                }
            }
        } catch (e) {
            console.warn('App.checkCollectionAlerts:', e);
        }
    },

    // checkSubscriptionStatus eliminada
};

// Inicialización global
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

window.addEventListener('beforeunload', async (e) => {
    if (typeof posController !== 'undefined') {
        const summary = posController.getCartSummary();
        if (summary.items.length > 0) {
            e.preventDefault();
            e.returnValue = '';
        }
    }
});

