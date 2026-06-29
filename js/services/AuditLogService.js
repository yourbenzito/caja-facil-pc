/**
 * C2: Audit Log Service — Registro centralizado de acciones críticas.
 * 
 * REGLA FUNDAMENTAL: Este servicio NUNCA debe lanzar un error que bloquee
 * la operación principal. Todos los errores se capturan internamente.
 * 
 * Estructura del registro:
 * {
 *   entity: string,       // 'product', 'customer', 'supplier', 'sale'
 *   entityId: number,     // ID del registro afectado
 *   action: string,       // 'create', 'update', 'softDelete', 'restore', etc.
 *   summary: string,      // Descripción legible de la acción
 *   metadata: object,     // Datos relevantes (liviano, no el objeto completo)
 *   userId: number|null,  // ID del usuario que realizó la acción
 *   username: string,     // Nombre del usuario (fallback: 'sistema')
 *   timestamp: string     // ISO 8601
 * }
 */
class AuditLogService {
    static STORE_NAME = 'auditLogs';

    /**
     * Registrar una acción en el audit log.
     * NUNCA lanza error — atrapa todo internamente.
     * 
     * @param {Object} params
     * @param {string} params.entity - Tipo de entidad ('product', 'customer', etc.)
     * @param {number|string} params.entityId - ID del registro afectado
     * @param {string} params.action - Acción realizada ('create', 'update', 'softDelete', 'restore')
     * @param {string} params.summary - Resumen legible de la acción
     * @param {Object} [params.metadata={}] - Datos adicionales relevantes (mantener liviano)
     * @param {number|null} [params.userId=null] - ID del usuario (se detecta automáticamente si no se pasa)
     */
    static async log({ entity, entityId, action, summary, metadata = {}, userId = null }) {
        try {
            // Obtener usuario actual con fallback seguro
            let resolvedUserId = userId;
            let resolvedUsername = 'sistema';
            try {
                if (typeof AuthManager !== 'undefined' && AuthManager.getCurrentUser) {
                    const user = AuthManager.getCurrentUser();
                    if (user) {
                        resolvedUserId = resolvedUserId || user.id || null;
                        resolvedUsername = user.username || user.name || 'usuario';
                    }
                }
            } catch (_) {
                // Si AuthManager no está disponible, usar fallback
            }

            const logEntry = {
                entity: String(entity || 'unknown'),
                entityId: entityId != null ? entityId : null,
                action: String(action || 'unknown'),
                summary: String(summary || ''),
                metadata: metadata && typeof metadata === 'object' ? metadata : {},
                userId: resolvedUserId,
                username: resolvedUsername,
                timestamp: new Date().toISOString()
            };

            await db.add(this.STORE_NAME, logEntry);

            // Invalidar caché para que la UI (especialmente en Inventario) se actualice
            if (db.mode === 'sqlite' && db.clearCache) {
                await db.clearCache(this.STORE_NAME);
            }
        } catch (error) {
            // CRÍTICO: NUNCA propagar el error. Solo loguear en consola.
            console.error('AuditLogService: Error al registrar audit log (operación principal NO afectada):', error);
        }
    }

    /**
     * Obtener todos los logs de auditoría (para vista de administración futura).
     * @returns {Promise<Array>}
     */
    static async getAll() {
        try {
            const logs = await db.getAll(this.STORE_NAME);
            return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        } catch (error) {
            console.error('AuditLogService: Error al leer audit logs:', error);
            return [];
        }
    }

    /**
     * Obtener logs por entidad.
     * @param {string} entity - Tipo de entidad
     * @returns {Promise<Array>}
     */
    static async getByEntity(entity) {
        try {
            const logs = await db.getByIndex(this.STORE_NAME, 'entity', entity);
            return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        } catch (error) {
            console.error('AuditLogService: Error al leer audit logs por entidad:', error);
            return [];
        }
    }

    /**
     * Obtener logs por ID de entidad específica.
     * @param {number} entityId - ID del registro
     * @returns {Promise<Array>}
     */
    static async getByEntityId(entityId) {
        try {
            const logs = await db.getByIndex(this.STORE_NAME, 'entityId', entityId);
            return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        } catch (error) {
            console.error('AuditLogService: Error al leer audit logs por entityId:', error);
            return [];
        }
    }

    /**
     * Obtener logs por usuario.
     * @param {number} userId - ID del usuario
     * @returns {Promise<Array>}
     */
    static async getByUser(userId) {
        try {
            const logs = await db.getByIndex(this.STORE_NAME, 'userId', userId);
            return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        } catch (error) {
            console.error('AuditLogService: Error al leer audit logs por usuario:', error);
            return [];
        }
    }

    /**
     * Contar total de logs.
     * @returns {Promise<number>}
     */
    static async count() {
        try {
            return await db.count(this.STORE_NAME);
        } catch (error) {
            console.error('AuditLogService: Error al contar audit logs:', error);
            return 0;
        }
    }

    /**
     * C3: Helper centralizado para obtener el ID del usuario actual.
     * Devuelve null si no hay sesión (bootstrap, scripts, etc.).
     * NUNCA lanza error.
     * @returns {number|null}
     */
    static getCurrentUserId() {
        try {
            if (typeof AuthManager !== 'undefined' && AuthManager.getCurrentUser) {
                const user = AuthManager.getCurrentUser();
                return user ? (user.id || null) : null;
            }
        } catch (_) { /* fallback silencioso */ }
        return null;
    }
}
