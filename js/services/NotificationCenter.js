/**
 * NotificationCenter.js - Centro de Notificaciones y Alertas Operativas Multi-Caja
 * Muestra alertas en vivo en una campana interactiva con contador y opciones de decisión rápida.
 */
class NotificationCenter {
    static STORAGE_KEY = 'cajafacil_notifications_history';
    static MAX_NOTIFICATIONS = 30;
    static notifications = [];
    static isDropdownOpen = false;

    static init() {
        this.loadFromStorage();
        this.renderBellIcon();
        console.log('🔔 [NotificationCenter] Centro de notificaciones inicializado.');
    }

    static loadFromStorage() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            this.notifications = raw ? JSON.parse(raw) : [];
        } catch (_) {
            this.notifications = [];
        }
    }

    static saveToStorage() {
        try {
            if (this.notifications.length > this.MAX_NOTIFICATIONS) {
                this.notifications = this.notifications.slice(0, this.MAX_NOTIFICATIONS);
            }
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.notifications));
        } catch (_) {}
    }

    /**
     * Emite una notificación al centro de notificaciones
     * @param {Object} item - { title, message, type: 'warning'|'danger'|'info'|'success', time, actionLabel, actionHandler }
     */
    static addNotification(item) {
        const notif = {
            id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            title: item.title || 'Aviso del Sistema',
            message: item.message || '',
            type: item.type || 'info', // 'warning', 'danger', 'info', 'success'
            time: item.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            read: false,
            actionLabel: item.actionLabel || null
        };

        this.notifications.unshift(notif);
        this.saveToStorage();
        this.updateBadge();
        if (this.isDropdownOpen) {
            this.renderDropdownContent();
        }

        // Si la notificación es crítica (danger o warning), vibrar o resaltar sutilmente
        const bell = document.getElementById('notificationBellBtn');
        if (bell) {
            bell.classList.add('bell-ring-animation');
            setTimeout(() => bell.classList.remove('bell-ring-animation'), 1000);
        }
    }

    /**
     * Compatible con alerts.js y módulos tradicionales: NotificationCenter.add(msg, type)
     */
    static add(message, type = 'info') {
        const msg = String(message || '').toLowerCase();
        const isImportant = type === 'error' || type === 'warning' || 
                            msg.includes('stock') || msg.includes('agotado') || 
                            msg.includes('caja') || msg.includes('diferencia') || 
                            msg.includes('descuadre') || msg.includes('error') || 
                            msg.includes('fallo') || msg.includes('seguridad');
        if (!isImportant) return;

        const title = type === 'error' ? 'Alerta de Error' : (type === 'warning' ? 'Advertencia' : 'Aviso del Sistema');
        this.addNotification({
            title,
            message: String(message || ''),
            type: type === 'error' ? 'danger' : (type === 'warning' ? 'warning' : 'info')
        });
    }

    /**
     * Mapeo didáctico de soluciones según el mensaje de error
     */
    static getSolution(message) {
        const msg = String(message || '').toLowerCase();
        
        if (msg.includes('servidor tardó demasiado') || msg.includes('timeout') || msg.includes('aborted') || msg.includes('abort')) {
            return {
                title: "⏳ Tiempo de Espera Agotado",
                cause: "El motor de base de datos tardó demasiado en guardar o procesar la solicitud.",
                solution: [
                    "Vuelve a intentar realizar la operación.",
                    "Si estás importando un archivo grande, verifica que no esté dañado.",
                    "Si persiste, reinicia la aplicación para refrescar el sistema."
                ]
            };
        }
        
        if (msg.includes('servidor local') || msg.includes('fetch') || msg.includes('connection') || msg.includes('refused')) {
            return {
                title: "📡 Sin Conexión con el Servidor Local",
                cause: "La pantalla no logra comunicarse con la base de datos interna.",
                solution: [
                    "Cierra por completo el programa y vuelve a abrirlo.",
                    "Esto encenderá el motor interno de forma automática.",
                    "Si persiste, reinicia el computador para liberar puertos."
                ]
            };
        }
        
        if (msg.includes('integridad') || msg.includes('foreign key') || msg.includes('coincide')) {
            return {
                title: "⚠️ Incoherencia de Registros",
                cause: "Se intentó guardar un dato que depende de un registro inexistente o eliminado.",
                solution: [
                    "Verifica si el cliente, categoría o proveedor existe.",
                    "Asegúrate de registrar las categorías antes de importar productos."
                ]
            };
        }
        
        if (msg.includes('ya existe') || msg.includes('unique constraint') || msg.includes('duplicado')) {
            return {
                title: "🆔 Registro Duplicado",
                cause: "El código de barras, RUT o identificador ya se encuentra registrado en el sistema.",
                solution: [
                    "Busca el código o RUT en la sección correspondiente para comprobar si ya existe.",
                    "Modifica el valor para que sea único o edita el registro existente."
                ]
            };
        }
        
        return {
            title: "💡 Orientación del Sistema",
            cause: "Ocurrió una situación inesperada en la operación solicitada.",
            solution: [
                "Lee detenidamente el mensaje mostrado en pantalla.",
                "Intenta realizar la acción nuevamente.",
                "Si la advertencia continúa, contacta a soporte técnico con los detalles del aviso."
            ]
        };
    }

    /**
     * Muestra el modal explicativo con la solución recomendada
     */
    static showSolutionModal(message) {
        const solution = this.getSolution(message);
        const prev = document.getElementById('error-solution-modal');
        if (prev) prev.remove();
        
        const listHTML = solution.solution.map(s => `<li style="margin-bottom: 0.5rem; color: #334155;">${s}</li>`).join('');
        
        const modalHTML = `
            <div id="error-solution-modal" style="
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(15, 23, 42, 0.45); backdrop-filter: blur(6px);
                display: flex; align-items: center; justify-content: center;
                z-index: 110000; font-family: 'Outfit', sans-serif;
            ">
                <div style="
                    background: #ffffff; color: #0f172a;
                    border: 1px solid #e2e8f0; border-radius: 1.25rem;
                    padding: 2rem; width: min(90%, 480px);
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
                    position: relative;
                ">
                    <button onclick="document.getElementById('error-solution-modal').remove()" style="
                        position: absolute; top: 1rem; right: 1rem;
                        background: #f1f5f9; border: none; color: #64748b;
                        width: 2rem; height: 2rem; border-radius: 50%;
                        cursor: pointer; display: flex; align-items: center; justify-content: center;
                        font-size: 0.9rem; font-weight: bold;
                    ">✕</button>

                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; color: #dc2626;">
                        <span style="font-size: 1.5rem;">💡</span>
                        <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: #b91c1c;">${solution.title}</h3>
                    </div>
                    
                    <div style="font-size: 0.78rem; color: #64748b; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 0.25rem;">Mensaje del Sistema:</div>
                    <div style="background: #fef2f2; border: 1px solid #fee2e2; padding: 0.75rem; border-radius: 0.5rem; font-size: 0.82rem; color: #991b1b; font-family: monospace; word-break: break-all; margin-bottom: 1.25rem;">
                        ${message}
                    </div>

                    <div style="margin-bottom: 1.25rem;">
                        <span style="font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px; display: block; margin-bottom: 0.25rem;">🔍 Causa Probable:</span>
                        <p style="color: #475569; margin: 0; font-size: 0.88rem; line-height: 1.5;">${solution.cause}</p>
                    </div>

                    <div style="border-top: 1px solid #f1f5f9; padding-top: 1rem;">
                        <span style="font-size: 0.75rem; color: #059669; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px; display: block; margin-bottom: 0.5rem;">🛠️ Pasos para Solucionar:</span>
                        <ol style="margin: 0; padding-left: 1.25rem; font-size: 0.88rem; line-height: 1.5;">
                            ${listHTML}
                        </ol>
                    </div>

                    <button onclick="document.getElementById('error-solution-modal').remove()" style="
                        width: 100%; background: #2563eb; color: white; border: none;
                        border-radius: 0.75rem; padding: 0.75rem; font-weight: 700;
                        font-size: 0.9rem; cursor: pointer; margin-top: 1.5rem;
                        box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);
                    ">
                        Entendido, cerrar
                    </button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    /**
     * Abre el centro de notificaciones
     */
    static show() {
        this.toggleDropdown();
    }

    static getUnreadCount() {
        return this.notifications.filter(n => !n.read).length;
    }

    static updateBadge() {
        const badge = document.getElementById('notificationBellBadge');
        if (!badge) return;
        const unread = this.getUnreadCount();
        if (unread > 0) {
            badge.textContent = unread > 99 ? '99+' : unread;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    static toggleDropdown(event) {
        if (event) event.stopPropagation();
        const dropdown = document.getElementById('notificationBellDropdown');
        if (!dropdown) return;

        this.isDropdownOpen = !this.isDropdownOpen;
        if (this.isDropdownOpen) {
            this.markAllAsRead();
            this.renderDropdownContent();
            dropdown.style.display = 'block';
            
            // Cerrar al hacer clic afuera
            const closeHandler = (e) => {
                if (!e.target.closest('#notificationBellContainer')) {
                    dropdown.style.display = 'none';
                    this.isDropdownOpen = false;
                    document.removeEventListener('click', closeHandler);
                }
            };
            setTimeout(() => document.addEventListener('click', closeHandler), 50);
        } else {
            dropdown.style.display = 'none';
        }
    }

    static markAllAsRead() {
        this.notifications.forEach(n => n.read = true);
        this.saveToStorage();
        this.updateBadge();
    }

    static clearAll() {
        this.notifications = [];
        this.saveToStorage();
        this.updateBadge();
        this.renderDropdownContent();
    }

    static renderDropdownContent() {
        const list = document.getElementById('notificationBellList');
        if (!list) return;

        if (this.notifications.length === 0) {
            list.innerHTML = `
                <div style="padding: 2rem 1rem; text-align: center; color: #94a3b8; font-size: 0.9rem;">
                    <div style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.6;">🔕</div>
                    No hay notificaciones pendientes
                </div>
            `;
            return;
        }

        const typeStyles = {
            danger: { bg: '#fef2f2', border: '#fca5a5', icon: '⛔', color: '#991b1b' },
            warning: { bg: '#fffbeb', border: '#fcd34d', icon: '⚠️', color: '#92400e' },
            success: { bg: '#f0fdf4', border: '#86efac', icon: '✅', color: '#166534' },
            info: { bg: '#f0f9ff', border: '#7dd3fc', icon: 'ℹ️', color: '#0369a1' }
        };

        list.innerHTML = this.notifications.map(n => {
            const st = typeStyles[n.type] || typeStyles.info;
            return `
                <div style="padding: 0.75rem 1rem; border-bottom: 1px solid #f1f5f9; background: ${st.bg}; border-left: 4px solid ${st.border}; display: flex; flex-direction: column; gap: 0.25rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <span style="font-weight: 800; font-size: 0.82rem; color: ${st.color}; display: flex; align-items: center; gap: 0.35rem;">
                            <span>${st.icon}</span> ${n.title}
                        </span>
                        <span style="font-size: 0.7rem; color: #64748b; font-weight: 500;">${n.time}</span>
                    </div>
                    <div style="font-size: 0.8rem; color: #334155; line-height: 1.35;">
                        ${n.message}
                    </div>
                </div>
            `;
        }).join('');
    }

    static renderBellIcon() {
        if (document.getElementById('notificationBellContainer')) return;

        // Buscar contenedor en header
        const header = document.querySelector('.header') || document.querySelector('header') || document.querySelector('.top-bar') || document.querySelector('.navbar');
        if (!header) return;

        const container = document.createElement('div');
        container.id = 'notificationBellContainer';
        container.style.cssText = 'position: relative; display: inline-flex; align-items: center; margin-left: auto; margin-right: 0.75rem; z-index: 1050;';

        container.innerHTML = `
            <button type="button" id="notificationBellBtn" onclick="NotificationCenter.toggleDropdown(event)" 
                    title="Centro de Notificaciones Multi-Caja" 
                    style="position: relative; background: rgba(255,255,255,0.15); border: 1.5px solid rgba(255,255,255,0.25); border-radius: 0.75rem; width: 2.6rem; height: 2.6rem; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; cursor: pointer; transition: all 0.2s; backdrop-filter: blur(8px);">
                🔔
                <span id="notificationBellBadge" 
                      style="display: none; position: absolute; top: -4px; right: -4px; background: #ef4444; color: white; border-radius: 999px; font-size: 0.65rem; font-weight: 800; min-width: 1.15rem; height: 1.15rem; align-items: center; justify-content: center; padding: 0 0.25rem; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.15);">
                    0
                </span>
            </button>

            <!-- Dropdown Panel -->
            <div id="notificationBellDropdown" 
                 style="display: none; position: absolute; top: 3.2rem; right: 0; width: 330px; max-width: 90vw; background: white; border-radius: 1rem; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.2), 0 8px 10px -6px rgba(0,0,0,0.1); border: 1.5px solid #e2e8f0; overflow: hidden; z-index: 2000; animation: notifDropFade 0.2s ease-out;">
                <div style="padding: 0.75rem 1rem; background: #0f172a; color: white; display: flex; align-items: center; justify-content: space-between;">
                    <div style="font-weight: 800; font-size: 0.88rem; display: flex; align-items: center; gap: 0.4rem;">
                        <span>🔔</span> Notificaciones Multi-Caja
                    </div>
                    <button type="button" onclick="NotificationCenter.clearAll()" 
                            style="background: transparent; border: none; color: #94a3b8; font-size: 0.72rem; cursor: pointer; text-decoration: underline; padding: 0;">
                        Limpiar todas
                    </button>
                </div>
                <div id="notificationBellList" style="max-height: 380px; overflow-y: auto;">
                    <!-- Lista de avisos -->
                </div>
            </div>
        `;

        // Insertar antes del perfil de usuario o al final del header
        const userMenu = header.querySelector('.user-menu') || header.querySelector('.header-user') || header.lastElementChild;
        if (userMenu && userMenu.parentNode === header) {
            header.insertBefore(container, userMenu);
        } else {
            header.appendChild(container);
        }

        this.updateBadge();
    }
}

// Iniciar al cargar
if (typeof window !== 'undefined') {
    window.NotificationCenter = NotificationCenter;
    document.addEventListener('DOMContentLoaded', () => NotificationCenter.init());
}
