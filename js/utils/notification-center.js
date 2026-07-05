/**
 * ponytail: Centro de Notificaciones y Soluciones didácticas de CajaFácil.
 * Permite guardar un historial de las alertas del día y proveer soluciones rápidas a errores.
 */
const NotificationCenter = {
    history: [],
    
    // Añadir una notificación al historial
    add(message, type = 'info') {
        const item = {
            id: Date.now() + Math.random().toString(36).substr(2, 5),
            time: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            date: new Date().toLocaleDateString('es-CL'),
            message,
            type,
            read: false
        };
        
        this.history.unshift(item); // Agregar al inicio para ver las más nuevas arriba
        if (this.history.length > 50) this.history.pop(); // Limitar historial a 50
        
        this.updateBadge();
    },
    
    // Obtener la cantidad de no leídas
    getUnreadCount() {
        return this.history.filter(n => !n.read).length;
    },
    
    // Actualizar el circulito rojo del menú lateral
    updateBadge() {
        const badge = document.getElementById('nav-notification-badge');
        if (badge) {
            const count = this.getUnreadCount();
            if (count > 0) {
                badge.style.display = 'inline-block';
                badge.textContent = count;
                badge.style.background = '#ef4444';
                badge.style.color = 'white';
                badge.style.borderRadius = '50%';
                badge.style.padding = '0.1rem 0.35rem';
                badge.style.fontSize = '0.65rem';
                badge.style.fontWeight = '800';
                badge.style.marginLeft = '0.25rem';
            } else {
                badge.style.display = 'none';
            }
        }
    },
    
    // Marcar todas como leídas
    markAllAsRead() {
        this.history.forEach(n => n.read = true);
        this.updateBadge();
    },
    
    // Mapeo didáctico de soluciones según el mensaje de error
    getSolution(message) {
        const msg = String(message || '').toLowerCase();
        
        if (msg.includes('servidor tardó demasiado') || msg.includes('timeout') || msg.includes('aborted') || msg.includes('abort')) {
            return {
                title: "⏳ Tiempo de Espera Agotado (Timeout)",
                cause: "El motor de base de datos tardó demasiado en guardar o procesar la solicitud (común al procesar archivos de muchos Megabytes).",
                solution: [
                    "Vuelve a intentar realizar la operación. Ya hemos ampliado el límite de tiempo a 5 minutos, por lo que debería completarse.",
                    "Si estás importando, asegúrate de que el archivo no esté corrupto.",
                    "Si persiste, reinicia la aplicación para refrescar la memoria."
                ]
            };
        }
        
        if (msg.includes('servidor local') || msg.includes('fetch') || msg.includes('connection') || msg.includes('refused')) {
            return {
                title: "📡 Sin Conexión con el Servidor",
                cause: "La ventana visual del sistema no logra comunicarse con la base de datos local (puerto 3000 apagado o bloqueado).",
                solution: [
                    "Cierra por completo el programa de ventas.",
                    "Vuelve a abrir la aplicación. Esto encenderá el servidor de forma automática en segundo plano.",
                    "Si persiste, reinicia el computador para liberar puertos de red bloqueados por Windows."
                ]
            };
        }
        
        if (msg.includes('demasiado grande') || msg.includes('too large') || msg.includes('payload')) {
            return {
                title: "📁 Archivo Demasiado Grande",
                cause: "El archivo de respaldo o Excel que intentas subir excede el límite de transferencia permitido.",
                solution: [
                    "Comprueba que estás subiendo un archivo correcto (.json para backups o .xlsx para productos).",
                    "Asegúrate de que el archivo no contenga imágenes incrustadas muy pesadas.",
                    "Intenta generar una nueva exportación desde el sistema de origen."
                ]
            };
        }
        
        if (msg.includes('integridad') || msg.includes('foreign key') || msg.includes('coincide')) {
            return {
                title: "⚠️ Incoherencia de Relaciones (Error de Integridad)",
                cause: "Estás intentando guardar un dato que apunta a un registro que no existe en tu base de datos (por ejemplo, registrar una compra de un proveedor que fue eliminado).",
                solution: [
                    "Verifica si el cliente o proveedor involucrado existe en sus respectivas secciones.",
                    "Si estás importando un respaldo antiguo, algunos registros huérfanos pueden requerir limpieza por soporte técnico.",
                    "Crea primero las Categorías de productos antes de importar productos de forma masiva."
                ]
            };
        }
        
        if (msg.includes('ya existe') || msg.includes('unique constraint') || msg.includes('duplicado')) {
            return {
                title: "🆔 Registro Duplicado",
                cause: "Estás intentando registrar un producto, cliente o folio con un identificador único (como RUT o Código de Barras) que ya está registrado en tu local.",
                solution: [
                    "Busca el RUT en la sección de 'Clientes' o el Código de Barras en 'Productos' para verificar si ya fue creado.",
                    "Modifica el valor para que sea único o edita el registro existente en lugar de crear uno nuevo.",
                    "Asegúrate de no usar el mismo código de barras de fábrica para dos productos distintos."
                ]
            };
        }
        
        // Solución genérica
        return {
            title: "❓ Error del Sistema",
            cause: "Ocurrió una particularidad inesperada al interactuar con el motor de base de datos.",
            solution: [
                "Lee detalladamente el mensaje del aviso en pantalla.",
                "Recarga la página o reinicia el sistema si la pantalla no responde.",
                "Toma una captura del error y compártela con soporte técnico si el problema persiste."
            ]
        };
    },
    
    // Mostrar el modal explicativo de solución para un error
    showSolutionModal(message) {
        const solution = this.getSolution(message);
        
        // Cerrar modal previo si existiera
        const prev = document.getElementById('error-solution-modal');
        if (prev) prev.remove();
        
        const listHTML = solution.solution.map(s => `<li style="margin-bottom: 0.5rem; color: #f1f5f9;">${s}</li>`).join('');
        
        const modalHTML = `
            <div id="error-solution-modal" style="
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(15, 23, 42, 0.6);
                backdrop-filter: blur(8px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 110000;
                font-family: 'Outfit', sans-serif;
                animation: modalFadeIn 0.2s ease-out;
            ">
                <div style="
                    background: linear-gradient(135deg, #1e293b, #0f172a);
                    color: white;
                    border: 1px solid rgba(239, 68, 68, 0.2);
                    border-radius: 1.5rem;
                    padding: 2rem;
                    width: min(90%, 480px);
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                    position: relative;
                ">
                    <button onclick="document.getElementById('error-solution-modal').remove()" style="
                        position: absolute;
                        top: 1rem; right: 1rem;
                        background: rgba(255,255,255,0.05);
                        border: none;
                        color: #94a3b8;
                        width: 2.2rem; height: 2.2rem;
                        border-radius: 50%;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 1rem;
                        font-weight: bold;
                    ">✕</button>

                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; color: #f87171;">
                        <span style="font-size: 1.5rem;">💡</span>
                        <h3 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: #fca5a5;">${solution.title}</h3>
                    </div>
                    
                    <div style="font-size: 0.85rem; color: #94a3b8; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 0.25rem;">Mensaje del Sistema:</div>
                    <div style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.15); padding: 0.75rem; border-radius: 0.5rem; font-size: 0.85rem; color: #fca5a5; font-family: monospace; word-break: break-all; margin-bottom: 1.25rem;">
                        ${message}
                    </div>

                    <div style="margin-bottom: 1.5rem;">
                        <span style="font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px; display: block; margin-bottom: 0.25rem;">🔍 Causa Probable:</span>
                        <p style="color: #cbd5e1; margin: 0; font-size: 0.9rem; line-height: 1.5;">${solution.cause}</p>
                    </div>

                    <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 1.25rem;">
                        <span style="font-size: 0.75rem; color: #34d399; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px; display: block; margin-bottom: 0.5rem;">🛠️ Pasos para Solucionar:</span>
                        <ol style="margin: 0; padding-left: 1.25rem; font-size: 0.9rem; line-height: 1.5;">
                            ${listHTML}
                        </ol>
                    </div>

                    <button onclick="document.getElementById('error-solution-modal').remove()" style="
                        width: 100%;
                        background: #f87171;
                        color: #7f1d1d;
                        border: none;
                        border-radius: 0.75rem;
                        padding: 0.8rem;
                        font-weight: 800;
                        font-size: 0.95rem;
                        cursor: pointer;
                        margin-top: 1.5rem;
                        transition: opacity 0.2s;
                    " onmouseover="this.style.opacity=0.9" onmouseout="this.style.opacity=1">
                        Entendido, cerrar
                    </button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },
    
    // Renderizar e inyectar el Modal del Historial de Notificaciones (Centro de Notificaciones)
    show() {
        this.markAllAsRead();
        
        // Remover modal previo si existe
        const prev = document.getElementById('notification-center-modal');
        if (prev) prev.remove();
        
        const listHTML = this.history.length === 0 
            ? `<div style="text-align: center; padding: 3rem; color: #64748b;">
                 <span style="font-size: 2.5rem; display: block; margin-bottom: 0.5rem;">🔔</span>
                 No hay avisos o alertas registradas el día de hoy.
               </div>`
            : this.history.map(n => {
                const color = n.type === 'error' ? '#fca5a5' : (n.type === 'warning' ? '#fde047' : '#93c5fd');
                const bg = n.type === 'error' ? 'rgba(239,68,68,0.06)' : (n.type === 'warning' ? 'rgba(234,179,8,0.06)' : 'rgba(59,130,246,0.06)');
                const border = n.type === 'error' ? 'rgba(239,68,68,0.15)' : (n.type === 'warning' ? 'rgba(234,179,8,0.15)' : 'rgba(59,130,246,0.15)');
                const badgeText = n.type === 'error' ? 'Error' : (n.type === 'warning' ? 'Aviso' : 'Info');
                const badgeColor = n.type === 'error' ? '#ef4444' : (n.type === 'warning' ? '#eab308' : '#3b82f6');
                
                return `
                    <div style="background: ${bg}; border: 1px solid ${border}; padding: 1rem; border-radius: 0.75rem; margin-bottom: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem; position: relative;">
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem;">
                            <span style="background: rgba(255,255,255,0.05); color: ${badgeColor}; padding: 0.15rem 0.4rem; border-radius: 0.25rem; font-weight: 800; text-transform: uppercase; font-size: 0.65rem;">${badgeText}</span>
                            <span style="color: #64748b; font-weight: bold;">${n.date} - ${n.time}</span>
                        </div>
                        <p style="margin: 0; font-size: 0.9rem; color: #e2e8f0; font-weight: 500; padding-right: 2.5rem; line-height: 1.5;">${n.message}</p>
                        ${n.type === 'error' ? `
                            <button onclick="document.getElementById('notification-center-modal').remove(); NotificationCenter.showSolutionModal('${n.message.replace(/'/g, "\\'")}')" style="
                                align-self: flex-start;
                                background: rgba(248, 113, 113, 0.12);
                                border: 1px solid rgba(248, 113, 113, 0.2);
                                color: #f87171;
                                font-size: 0.75rem;
                                border-radius: 0.35rem;
                                padding: 0.25rem 0.5rem;
                                cursor: pointer;
                                font-weight: 700;
                                margin-top: 0.25rem;
                                transition: background 0.2s;
                            " onmouseover="this.style.background='rgba(248, 113, 113, 0.2)'" onmouseout="this.style.background='rgba(248, 113, 113, 0.12)'">
                                💡 Ver Solución Recomendada
                            </button>
                        ` : ''}
                    </div>
                `;
              }).join('');
              
        const modalHTML = `
            <div id="notification-center-modal" style="
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(15, 23, 42, 0.6);
                backdrop-filter: blur(8px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 105000;
                font-family: 'Outfit', sans-serif;
                animation: modalFadeIn 0.2s ease-out;
            ">
                <div style="
                    background: linear-gradient(135deg, #1e293b, #0f172a);
                    color: white;
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 1.5rem;
                    padding: 2rem;
                    width: min(90%, 500px);
                    max-height: 85vh;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                    position: relative;
                ">
                    <button onclick="document.getElementById('notification-center-modal').remove()" style="
                        position: absolute;
                        top: 1rem; right: 1rem;
                        background: rgba(255,255,255,0.05);
                        border: none;
                        color: #94a3b8;
                        width: 2.2rem; height: 2.2rem;
                        border-radius: 50%;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 1rem;
                        font-weight: bold;
                    ">✕</button>

                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.5rem;">
                        <span style="font-size: 1.5rem;">🔔</span>
                        <h3 style="margin: 0; font-size: 1.35rem; font-weight: 800; color: #f8fafc;">Historial de Avisos y Alertas</h3>
                    </div>

                    <div style="
                        flex: 1;
                        overflow-y: auto;
                        padding-right: 0.5rem;
                        max-height: 50vh;
                    ">
                        ${listHTML}
                    </div>

                    <button onclick="document.getElementById('notification-center-modal').remove()" style="
                        width: 100%;
                        background: #6366f1;
                        color: white;
                        border: none;
                        border-radius: 0.75rem;
                        padding: 0.85rem;
                        font-weight: 700;
                        font-size: 0.95rem;
                        cursor: pointer;
                        margin-top: 1.5rem;
                        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
                        transition: background 0.2s;
                    " onmouseover="this.style.background='#4f46e5'" onmouseout="this.style.background='#6366f1'">
                        Cerrar panel
                    </button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
};

window.NotificationCenter = NotificationCenter;
