/**
 * C8: Permission Service
 * Centraliza roles fijos y validaciones de permisos.
 *
 * Roles:
 *   - owner   : acceso total, gestión de usuarios, backup/restore
 *   - admin   : gestión operativa completa, sin acceso a usuarios/backup
 *   - cashier : solo POS, consultas básicas
 *
 * Reglas:
 *   - NO permisos dinámicos
 *   - NO modifica lógica de negocio
 *   - Fallback seguro: si no hay rol → 'owner' (compatibilidad con usuarios existentes)
 */
class PermissionService {

    /** Roles válidos del sistema */
    static ROLES = ['owner', 'admin', 'cashier'];

    /** Etiquetas legibles para cada rol */
    static ROLE_LABELS = {
        owner: 'Propietario',
        admin: 'Administrador',
        cashier: 'Cajero'
    };

    /**
     * Matriz de permisos.
     * Clave = permiso, Valor = array de roles que lo tienen.
     */
    static PERMISSIONS = {
        // ─── Navegación / vistas ───
        'nav.pos': ['owner', 'admin', 'cashier'],
        'nav.products': ['owner', 'admin', 'cashier'],
        'nav.customers': ['owner', 'admin', 'cashier'],
        'nav.suppliers': ['owner', 'admin', 'cashier'],
        'nav.purchases': ['owner', 'admin', 'cashier'],
        'nav.cash': ['owner', 'admin', 'cashier'],
        'nav.expenses': ['owner', 'admin', 'cashier'],
        'nav.inventory': ['owner', 'admin'],
        'nav.reports': ['owner', 'admin'],
        'nav.sales': ['owner', 'admin', 'cashier'],
        'nav.creditNotes': ['owner', 'admin', 'cashier'],
        'nav.settings': ['owner', 'admin'],
        'nav.auditLogs': ['owner'],

        // ─── Productos ───
        'products.create': ['owner', 'admin'],
        'products.edit': ['owner', 'admin'],
        'products.delete': ['owner', 'admin'],
        'products.import': ['owner', 'admin'],
        'products.export': ['owner', 'admin'],

        // ─── Clientes ───
        'customers.create': ['owner', 'admin', 'cashier'],
        'customers.edit': ['owner', 'admin'],
        'customers.delete': ['owner', 'admin'],

        // ─── Proveedores ───
        'suppliers.create': ['owner', 'admin', 'cashier'],
        'suppliers.edit': ['owner', 'admin', 'cashier'],
        'suppliers.delete': ['owner', 'admin'],

        // ─── Compras ───
        'purchases.create': ['owner', 'admin', 'cashier'],
        'purchases.edit': ['owner', 'admin', 'cashier'],
        'purchases.pay': ['owner', 'admin', 'cashier'],
        'purchases.delete': ['owner', 'admin'],

        // ─── Ventas ───
        'sales.edit': ['owner', 'admin'],
        'sales.return': ['owner', 'admin'],
        'sales.delete': ['owner', 'admin'],
        'sales.repairFolios': ['owner', 'admin'],

        // ─── Inventario ───
        'inventory.adjust': ['owner', 'admin'],

        // ─── Caja ───
        'cash.open': ['owner', 'admin', 'cashier'],
        'cash.close': ['owner', 'admin', 'cashier'],



        // ─── Configuración ───
        'settings.backup': ['owner'],
        'settings.restore': ['owner'],
        'settings.users': ['owner'],
        'settings.security': ['owner', 'admin'],
    };

    /**
     * Obtener el rol del usuario actual.
     * Fallback: si no hay rol → 'owner' (compatibilidad con usuarios pre-C8).
     * @returns {string}
     */
    static getCurrentRole() {
        try {
            const session = AuthManager.getCurrentUser();
            if (session && session.role) {
                return this.ROLES.includes(session.role) ? session.role : 'owner';
            }
        } catch (_) { /* fallback */ }
        return 'owner'; // fallback para usuarios sin rol (pre-C8)
    }

    /**
     * Verificar si el usuario actual tiene un permiso específico.
     * @param {string} permission - Clave de permiso (ej: 'products.edit')
     * @returns {boolean}
     */
    static can(permission) {
        const role = this.getCurrentRole();
        const allowedRoles = this.PERMISSIONS[permission];
        if (!allowedRoles) {
            console.warn(`PermissionService.can: permiso no definido: "${permission}". Denegando por defecto.`);
            return false;
        }
        return allowedRoles.includes(role);
    }

    /**
     * Verificar permiso y lanzar error si no se tiene.
     * Usar en controllers/services para bloquear acciones.
     * @param {string} permission - Clave de permiso
     * @param {string} [actionDescription] - Descripción para el mensaje de error
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
     * Verificar permiso y mostrar notificación si no se tiene.
     * Usar en UI para bloquear botones/acciones.
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
     * Verificar si un rol específico tiene un permiso.
     * @param {string} role
     * @param {string} permission
     * @returns {boolean}
     */
    static roleHasPermission(role, permission) {
        const allowedRoles = this.PERMISSIONS[permission];
        if (!allowedRoles) return true;
        return allowedRoles.includes(role);
    }

    /**
     * Obtener todos los permisos de un rol.
     * @param {string} role
     * @returns {string[]}
     */
    static getPermissionsForRole(role) {
        return Object.keys(this.PERMISSIONS).filter(perm =>
            this.PERMISSIONS[perm].includes(role)
        );
    }

    /**
     * Verificar si el rol es válido.
     * @param {string} role
     * @returns {boolean}
     */
    static isValidRole(role) {
        return this.ROLES.includes(role);
    }
}
