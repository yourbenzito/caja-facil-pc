/**
 * C8: Permission Service — Motor de Roles y Permisos Dinámicos
 * Centraliza roles, matriz de permisos y validaciones para la aplicación.
 * 
 * Roles del sistema:
 *   - owner   : Propietario con control total legal e intransferible.
 *   - partner : Socio / Inversionista / Familiar con acceso completo a métricas, inventario y gestión de empleados.
 *   - admin   : Administrador / Encargado con gestión comercial, stock, precios y supervisión.
 *   - cashier : Cajero con cobro en POS, arqueo ciego y sin acceso a costos ni reportes.
 */
class PermissionService {

    /** Roles válidos del sistema */
    static ROLES = ['owner', 'partner', 'admin', 'cashier'];

    /** Etiquetas legibles para cada rol */
    static ROLE_LABELS = {
        owner: 'Propietario',
        partner: 'Socio / Inversionista',
        admin: 'Administrador',
        cashier: 'Cajero'
    };

    /** Colores de identificación visual */
    static ROLE_COLORS = {
        owner: '#4f46e5',
        partner: '#059669',
        admin: '#d97706',
        cashier: '#2563eb'
    };

    /**
     * Matriz de permisos predeterminada por defecto (Fallback seguro).
     * Clave = permiso, Valor = array de roles que lo tienen activado por defecto.
     */
    static DEFAULT_PERMISSIONS = {
        // ─── 🧭 Navegación y Acceso a Módulos ───
        'nav.pos': ['owner', 'partner', 'admin', 'cashier'],
        'nav.products': ['owner', 'partner', 'admin', 'cashier'],
        'nav.customers': ['owner', 'partner', 'admin', 'cashier'],
        'nav.suppliers': ['owner', 'partner', 'admin'],
        'nav.purchases': ['owner', 'partner', 'admin'],
        'nav.cash': ['owner', 'partner', 'admin', 'cashier'],
        'nav.expenses': ['owner', 'partner', 'admin'],
        'nav.inventory': ['owner', 'partner', 'admin'],
        'nav.reports': ['owner', 'partner'],
        'nav.sales': ['owner', 'partner', 'admin', 'cashier'],
        'nav.creditNotes': ['owner', 'partner', 'admin', 'cashier'],
        'nav.settings': ['owner', 'partner', 'admin', 'cashier'], // Todos acceden a "Mi Perfil"
        'nav.auditLogs': ['owner', 'partner'],

        // ─── 🛒 Punto de Venta y Cobro ───
        'pos.sell': ['owner', 'partner', 'admin', 'cashier'],
        'pos.apply_discount': ['owner', 'partner', 'admin'],
        'pos.sell_credit': ['owner', 'partner', 'admin', 'cashier'],
        'pos.override_price': ['owner', 'partner', 'admin'],
        'pos.open_cash_drawer': ['owner', 'partner', 'admin'],
        'sales.reprint': ['owner', 'partner', 'admin', 'cashier'],
        'sales.edit': ['owner', 'partner', 'admin'],
        'sales.return': ['owner', 'partner', 'admin'],
        'sales.delete': ['owner', 'partner'],
        'sales.repairFolios': ['owner', 'partner'],

        // ─── 📦 Productos e Inventario ───
        'products.view_cost': ['owner', 'partner', 'admin'],
        'products.create': ['owner', 'partner', 'admin'],
        'products.edit': ['owner', 'partner', 'admin'],
        'products.edit_price': ['owner', 'partner', 'admin'],
        'products.edit_stock': ['owner', 'partner', 'admin'],
        'products.delete': ['owner', 'partner'],
        'products.import': ['owner', 'partner', 'admin'],
        'products.export': ['owner', 'partner', 'admin'],
        'inventory.adjust': ['owner', 'partner', 'admin'],
        'inventory.view_valuation': ['owner', 'partner'],

        // ─── 💰 Caja y Flujo de Dinero ───
        'cash.open': ['owner', 'partner', 'admin', 'cashier'],
        'cash.close': ['owner', 'partner', 'admin', 'cashier'],
        'cash.blind_close': ['cashier'], // Arqueo ciego activado por defecto solo para cajeros
        'cash.withdraw': ['owner', 'partner', 'admin'],
        'cash.deposit': ['owner', 'partner', 'admin'],
        'cash.view_history': ['owner', 'partner', 'admin'],

        // ─── 👥 Clientes y Deudas ───
        'customers.create': ['owner', 'partner', 'admin', 'cashier'],
        'customers.edit': ['owner', 'partner', 'admin'],
        'customers.delete': ['owner', 'partner'],
        'customers.edit_credit_limit': ['owner', 'partner', 'admin'],
        'customers.register_payment': ['owner', 'partner', 'admin', 'cashier'],

        // ─── 🚚 Proveedores y Compras ───
        'suppliers.create': ['owner', 'partner', 'admin'],
        'suppliers.edit': ['owner', 'partner', 'admin'],
        'suppliers.delete': ['owner', 'partner'],
        'purchases.create': ['owner', 'partner', 'admin'],
        'purchases.edit': ['owner', 'partner', 'admin'],
        'purchases.pay': ['owner', 'partner', 'admin'],
        'purchases.delete': ['owner', 'partner'],

        // ─── 💸 Gastos ───
        'expenses.create': ['owner', 'partner', 'admin'],
        'expenses.delete': ['owner', 'partner'],

        // ─── 📈 Reportes y Finanzas ───
        'reports.view_sales': ['owner', 'partner'],
        'reports.view_profits': ['owner', 'partner'],
        'reports.export': ['owner', 'partner'],

        // ─── ⚙️ Configuración del Negocio ───
        'settings.profile': ['owner', 'partner', 'admin', 'cashier'], // Mi Perfil (colores, clave)
        'settings.visual': ['owner', 'partner', 'admin', 'cashier'],
        'settings.hardware': ['owner', 'partner', 'admin'],
        'settings.pos_rules': ['owner', 'partner', 'admin'],
        'settings.users': ['owner', 'partner'], // Crear personal y gestionar permisos
        'settings.security': ['owner', 'partner', 'admin'],
        'settings.backup': ['owner', 'partner'],
        'settings.restore': ['owner'], // Solo dueño principal puede restaurar backup
        'auditLogs.view': ['owner', 'partner']
    };

    /**
     * Catálogo estructurado en grupos para renderizar en el Editor Visual de Permisos
     */
    static PERMISSION_GROUPS = [
        {
            id: 'nav',
            name: 'Navegación y Módulos Visibles',
            icon: '🧭',
            permissions: [
                { key: 'nav.pos', label: 'Punto de Venta (POS)', desc: 'Muestra el acceso a la pantalla de ventas en la barra o menú' },
                { key: 'nav.products', label: 'Catálogo de Productos', desc: 'Permite abrir la lista de productos' },
                { key: 'nav.cash', label: 'Control de Caja', desc: 'Permite abrir la vista de turnos de dinero y arqueos' },
                { key: 'nav.sales', label: 'Historial de Ventas', desc: 'Permite ver el registro de ventas' },
                { key: 'nav.customers', label: 'Clientes y Créditos', desc: 'Permite abrir el módulo de clientes y cuentas corrientes' },
                { key: 'nav.purchases', label: 'Compras de Mercadería', desc: 'Permite ver compras y facturas de proveedores' },
                { key: 'nav.suppliers', label: 'Proveedores', desc: 'Permite consultar el listado de proveedores' },
                { key: 'nav.expenses', label: 'Gastos del Local', desc: 'Permite ver los egresos del negocio' },
                { key: 'nav.inventory', label: 'Control de Stock', desc: 'Permite entrar al módulo de inventario' },
                { key: 'nav.reports', label: 'Reportes Financieros', desc: 'Permite ver métricas, utilidades y estadísticas' },
                { key: 'nav.creditNotes', label: 'Devoluciones', desc: 'Permite ver notas de crédito registradas' },
                { key: 'nav.auditLogs', label: 'Auditoría del Sistema', desc: 'Permite revisar la caja negra de acciones y cambios' },
                { key: 'nav.settings', label: 'Configuración', desc: 'Permite entrar a la configuración del negocio' }
            ]
        },
        {
            id: 'pos',
            name: 'Punto de Venta y Cobro',
            icon: '🛒',
            permissions: [
                { key: 'pos.sell', label: 'Cobrar ventas', desc: 'Permite procesar pagos en efectivo, tarjeta o transferencia' },
                { key: 'pos.apply_discount', label: 'Aplicar descuentos manuales', desc: 'Permite rebajar precios o aplicar % de descuento en caja' },
                { key: 'pos.sell_credit', label: 'Vender fiado / crédito', desc: 'Permite registrar ventas fiadas a clientes autorizados' },
                { key: 'pos.override_price', label: 'Cambiar precio en carrito', desc: 'Permite alterar el precio de un producto al momento de cobrar' },
                { key: 'pos.open_cash_drawer', label: 'Abrir gaveta sin venta', desc: 'Permite enviar pulso de apertura a la gaveta de dinero' },
                { key: 'sales.reprint', label: 'Reimprimir tickets pasados', desc: 'Permite sacar copia física de ventas antiguas' },
                { key: 'sales.edit', label: 'Editar ventas realizadas', desc: 'Permite cambiar método de pago o cliente de una venta' },
                { key: 'sales.return', label: 'Hacer devoluciones', desc: 'Permite recibir ítems devueltos' },
                { key: 'sales.delete', label: 'Anular o borrar ventas', desc: 'Permite cancelar y revertir ventas registradas' }
            ]
        },
        {
            id: 'products',
            name: 'Productos e Inventario',
            icon: '📦',
            permissions: [
                { key: 'products.view_cost', label: 'Ver costos y ganancias', desc: 'Muestra columnas de costo de compra, margen % y ganancia' },
                { key: 'products.create', label: 'Crear nuevos productos', desc: 'Permite agregar productos al catálogo' },
                { key: 'products.edit_price', label: 'Modificar precios de venta', desc: 'Permite cambiar precios públicos de venta' },
                { key: 'products.edit_stock', label: 'Modificar stock manualmente', desc: 'Permite cambiar existencias en bodega o tienda' },
                { key: 'products.delete', label: 'Eliminar productos', desc: 'Permite borrar productos del catálogo' },
                { key: 'products.import', label: 'Importar desde Excel', desc: 'Permite carga masiva de productos' },
                { key: 'products.export', label: 'Exportar a Excel', desc: 'Permite descargar el catálogo a archivo' },
                { key: 'inventory.adjust', label: 'Ajustes de merma y stock', desc: 'Permite registrar mermas o roturas' },
                { key: 'inventory.view_valuation', label: 'Ver valor total del inventario', desc: 'Muestra el capital total invertido en mercadería' }
            ]
        },
        {
            id: 'cash',
            name: 'Caja y Flujo de Efectivo',
            icon: '💰',
            permissions: [
                { key: 'cash.open', label: 'Abrir turno de caja', desc: 'Permite iniciar turno ingresando fondo inicial' },
                { key: 'cash.close', label: 'Cerrar turno de caja', desc: 'Permite realizar el cierre de caja diario' },
                { key: 'cash.blind_close', label: 'Arqueo Ciego (Ocultar monto esperado)', desc: 'El cajero cuenta a ciegas sin ver cuánto dinero dice el sistema' },
                { key: 'cash.withdraw', label: 'Registrar retiros de dinero', desc: 'Permite sacar efectivo para compras o pagos menores' },
                { key: 'cash.deposit', label: 'Registrar ingresos de dinero', desc: 'Permite ingresar dinero extra o sencillo a la caja' },
                { key: 'cash.view_history', label: 'Ver historial de otras cajas', desc: 'Permite consultar cierres de caja pasados y de otros cajeros' }
            ]
        },
        {
            id: 'customers',
            name: 'Clientes y Créditos',
            icon: '👥',
            permissions: [
                { key: 'customers.create', label: 'Crear nuevos clientes', desc: 'Permite registrar clientes con nombre y teléfono' },
                { key: 'customers.edit', label: 'Editar ficha de clientes', desc: 'Permite modificar datos de clientes' },
                { key: 'customers.edit_credit_limit', label: 'Modificar límite de crédito', desc: 'Permite definir hasta cuánto se le puede fiar' },
                { key: 'customers.register_payment', label: 'Registrar abonos y pagos', desc: 'Permite cobrar cuotas o deudas pendientes' },
                { key: 'customers.delete', label: 'Eliminar clientes', desc: 'Permite borrar clientes de la base de datos' }
            ]
        },
        {
            id: 'purchases',
            name: 'Compras y Proveedores',
            icon: '📋',
            permissions: [
                { key: 'purchases.create', label: 'Cargar facturas de compra', desc: 'Permite registrar compras de mercadería' },
                { key: 'purchases.edit', label: 'Editar compras', desc: 'Permite corregir compras registradas' },
                { key: 'purchases.pay', label: 'Pagar facturas a crédito', desc: 'Permite registrar pagos a proveedores' },
                { key: 'purchases.delete', label: 'Anular facturas de compra', desc: 'Permite borrar compras del sistema' },
                { key: 'suppliers.create', label: 'Crear proveedores', desc: 'Permite dar de alta proveedores' },
                { key: 'suppliers.delete', label: 'Eliminar proveedores', desc: 'Permite borrar proveedores' }
            ]
        },
        {
            id: 'reports',
            name: 'Reportes y Utilidades',
            icon: '📈',
            permissions: [
                { key: 'reports.view_sales', label: 'Ver reportes de ventas', desc: 'Muestra gráficos y totales de venta' },
                { key: 'reports.view_profits', label: 'Ver ganancias y utilidades netas', desc: 'Muestra rentabilidad y dinero real ganado' },
                { key: 'reports.export', label: 'Exportar reportes contables', desc: 'Permite descargar reportes a Excel o PDF' }
            ]
        },
        {
            id: 'settings',
            name: 'Configuración y Personal',
            icon: '⚙️',
            permissions: [
                { key: 'settings.users', label: 'Gestionar empleados y permisos', desc: 'Permite crear trabajadores, asignar roles y modificar permisos' },
                { key: 'settings.hardware', label: 'Configurar impresoras y hardware', desc: 'Permite configurar puertos de impresora y ancho de papel' },
                { key: 'settings.pos_rules', label: 'Configurar reglas de POS', desc: 'Permite habilitar venta con stock negativo' },
                { key: 'settings.backup', label: 'Descargar copias de seguridad', desc: 'Permite generar respaldos de la base de datos' },
                { key: 'settings.restore', label: 'Restaurar copias de seguridad', desc: 'Permite sobrescribir los datos con un respaldo' },
                { key: 'auditLogs.view', label: 'Ver registros de auditoría', desc: 'Permite ver la caja negra de cambios y movimientos' }
            ]
        }
    ];

    /**
     * Obtiene el ID del negocio activo
     * @returns {string}
     */
    static getActiveBusinessId() {
        try {
            return localStorage.getItem('BUSINESS_ID') || '1';
        } catch (_) {
            return '1';
        }
    }

    /**
     * Clave de almacenamiento en localStorage para permisos dinámicos por negocio
     */
    static getStorageKey(businessId = null) {
        const bId = businessId || this.getActiveBusinessId();
        return `CUSTOM_ROLE_PERMISSIONS_${bId}`;
    }

    /**
     * Obtiene la matriz de permisos activa (personalizada o por defecto)
     * @returns {Object}
     */
    static getPermissions(businessId = null) {
        try {
            const key = this.getStorageKey(businessId);
            const saved = localStorage.getItem(key);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && typeof parsed === 'object') {
                    // Combinar defensivamente con defaults para asegurar que permisos nuevos no falten
                    const merged = { ...this.DEFAULT_PERMISSIONS };
                    for (const [permKey, rolesArray] of Object.entries(parsed)) {
                        if (Array.isArray(rolesArray)) {
                            merged[permKey] = rolesArray;
                        }
                    }
                    return merged;
                }
            }
        } catch (e) {
            console.warn('⚠️ [PermissionService] Error leyendo permisos dinámicos:', e);
        }
        return this.DEFAULT_PERMISSIONS;
    }

    /**
     * Obtener el rol del usuario actualmente autenticado
     * @returns {string}
     */
    static getCurrentRole() {
        try {
            if (typeof AuthManager !== 'undefined' && typeof AuthManager.getCurrentUser === 'function') {
                const session = AuthManager.getCurrentUser();
                if (session && session.role) {
                    return this.ROLES.includes(session.role) ? session.role : 'owner';
                }
            }
        } catch (_) { /* fallback */ }
        return 'owner'; // Fallback seguro
    }

    /** Mapa de correspondencia entre permisos granulares de staff (JSON de Supabase) y claves del POS */
    static STAFF_KEY_MAP = {
        'pos.sell': 'posSales',
        'nav.pos': 'posSales',
        'pos.apply_discount': 'discounts',
        'pos.sell_credit': 'credits',
        'sales.delete': 'voidSales',
        'sales.edit': 'voidSales',
        'sales.return': 'voidSales',
        'products.create': 'modifyCatalog',
        'products.edit': 'modifyCatalog',
        'products.edit_price': 'modifyCatalog',
        'products.edit_stock': 'modifyCatalog',
        'products.delete': 'modifyCatalog',
        'purchases.create': 'purchases',
        'purchases.edit': 'purchases',
        'purchases.pay': 'purchases',
        'purchases.delete': 'purchases',
        'nav.purchases': 'purchases',
        'expenses.create': 'expenses',
        'expenses.delete': 'expenses',
        'nav.expenses': 'expenses',
        'customers.edit_credit_limit': 'credits',
        'reports.view_profits': 'reportsProfit',
        'reports.view_sales': 'reportsProfit',
        'products.view_cost': 'reportsProfit',
        'nav.reports': 'reportsProfit'
    };

    /**
     * Obtiene los permisos granulares del empleado activo si existen
     */
    static getCurrentUserPermissions() {
        try {
            if (typeof AuthManager !== 'undefined' && typeof AuthManager.getCurrentUser === 'function') {
                const session = AuthManager.getCurrentUser();
                if (session && session.permissions) {
                    return typeof session.permissions === 'string' ? JSON.parse(session.permissions) : session.permissions;
                }
            }
        } catch (_) {}
        return null;
    }

    /**
     * Verificar si el usuario actual tiene un permiso específico.
     * Regla: El propietario ('owner') SIEMPRE tiene acceso total al 100% del sistema.
     * @param {string} permission
     * @returns {boolean}
     */
    static can(permission) {
        const role = this.getCurrentRole();
        // El dueño nunca puede quedar bloqueado
        if (role === 'owner') return true;

        // Comprobación de permisos granulares del empleado sincronizados desde Supabase (staff.permissions)
        const staffPerms = this.getCurrentUserPermissions();
        if (staffPerms && typeof staffPerms === 'object') {
            const mappedKey = this.STAFF_KEY_MAP[permission];
            if (mappedKey && staffPerms[mappedKey] !== undefined) {
                return Boolean(staffPerms[mappedKey]);
            }
        }

        const matrix = this.getPermissions();
        const allowedRoles = matrix[permission];
        if (!allowedRoles) {
            const fallbackRoles = this.DEFAULT_PERMISSIONS[permission];
            return fallbackRoles ? fallbackRoles.includes(role) : false;
        }
        return allowedRoles.includes(role);
    }

    /**
     * Verificar si un rol específico tiene un permiso asignado
     * @param {string} role
     * @param {string} permission
     * @param {string} [businessId]
     * @returns {boolean}
     */
    static roleHasPermission(role, permission, businessId = null) {
        if (role === 'owner') return true;
        const matrix = this.getPermissions(businessId);
        const allowedRoles = matrix[permission];
        if (!allowedRoles) {
            const fallbackRoles = this.DEFAULT_PERMISSIONS[permission];
            return fallbackRoles ? fallbackRoles.includes(role) : false;
        }
        return allowedRoles.includes(role);
    }

    /**
     * Modifica el estado de un permiso para un rol específico y lo guarda
     * @param {string} role
     * @param {string} permission
     * @param {boolean} isAllowed
     * @param {string} [businessId]
     */
    static setRolePermission(role, permission, isAllowed, businessId = null) {
        if (role === 'owner') {
            console.warn('⚠️ [PermissionService] Los permisos del Propietario no pueden modificarse.');
            return;
        }

        const currentMatrix = { ...this.getPermissions(businessId) };
        const allowedRoles = new Set(currentMatrix[permission] || this.DEFAULT_PERMISSIONS[permission] || []);

        if (isAllowed) {
            allowedRoles.add(role);
        } else {
            allowedRoles.delete(role);
        }

        currentMatrix[permission] = Array.from(allowedRoles);

        const key = this.getStorageKey(businessId);
        localStorage.setItem(key, JSON.stringify(currentMatrix));

        // Aplicar cambios en vivo a la navegación si la app está cargada
        if (typeof app !== 'undefined' && typeof app.applyPermissionsToSidebar === 'function') {
            app.applyPermissionsToSidebar();
        }
    }

    /**
     * Guarda la lista completa de permisos para un rol
     * @param {string} role
     * @param {string[]} permissionsList
     * @param {string} [businessId]
     */
    static saveRolePermissions(role, permissionsList, businessId = null) {
        if (role === 'owner') return;

        const currentMatrix = { ...this.getPermissions(businessId) };
        const permSet = new Set(permissionsList);

        // Actualizar todos los permisos conocidos para ese rol
        for (const permKey of Object.keys(this.DEFAULT_PERMISSIONS)) {
            const allowedRoles = new Set(currentMatrix[permKey] || this.DEFAULT_PERMISSIONS[permKey] || []);
            if (permSet.has(permKey)) {
                allowedRoles.add(role);
            } else {
                allowedRoles.delete(role);
            }
            currentMatrix[permKey] = Array.from(allowedRoles);
        }

        const key = this.getStorageKey(businessId);
        localStorage.setItem(key, JSON.stringify(currentMatrix));

        if (typeof app !== 'undefined' && typeof app.applyPermissionsToSidebar === 'function') {
            app.applyPermissionsToSidebar();
        }
    }

    /**
     * Restablece la matriz de permisos a los valores predeterminados de fábrica
     * @param {string} [businessId]
     */
    static resetRolePermissions(businessId = null) {
        const key = this.getStorageKey(businessId);
        localStorage.removeItem(key);

        if (typeof app !== 'undefined' && typeof app.applyPermissionsToSidebar === 'function') {
            app.applyPermissionsToSidebar();
        }
    }

    /**
     * Obtener todos los permisos activos para un rol
     * @param {string} role
     * @returns {string[]}
     */
    static getPermissionsForRole(role) {
        if (role === 'owner') {
            return Object.keys(this.DEFAULT_PERMISSIONS);
        }
        const matrix = this.getPermissions();
        return Object.keys(matrix).filter(perm => (matrix[perm] || []).includes(role));
    }

    /**
     * Verificar permiso y lanzar excepción si no se tiene
     * @param {string} permission
     * @param {string} [actionDescription]
     * @throws {Error}
     */
    static require(permission, actionDescription = '') {
        if (!this.can(permission)) {
            const role = this.getCurrentRole();
            const roleLabel = this.ROLE_LABELS[role] || role;
            const desc = actionDescription || permission;
            throw new Error(`Acceso denegado: tu rol (${roleLabel}) no tiene permiso para "${desc}".`);
        }
    }

    /**
     * Verificar permiso y mostrar notificación visual en UI
     * @param {string} permission
     * @param {string} [actionDescription]
     * @returns {boolean}
     */
    static check(permission, actionDescription = '') {
        if (!this.can(permission)) {
            const role = this.getCurrentRole();
            const roleLabel = this.ROLE_LABELS[role] || role;
            const desc = actionDescription || permission;
            if (typeof showNotification === 'function') {
                showNotification(`Acceso denegado: tu rol (${roleLabel}) no puede "${desc}".`, 'error');
            }
            return false;
        }
        return true;
    }

    /**
     * Verificar si el nombre del rol es válido
     * @param {string} role
     * @returns {boolean}
     */
    static isValidRole(role) {
        return this.ROLES.includes(role);
    }
}
