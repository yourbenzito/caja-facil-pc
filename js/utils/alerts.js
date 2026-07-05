const showNotification = (message, type = 'info') => {
    // ponytail: Traducir errores técnicos nativos a un español amigable de negocio
    if (type === 'error') {
        const msg = String(message).toLowerCase();
        if (msg.includes('signal is aborted') || msg.includes('timeout') || msg.includes('aborted')) {
            message = 'El servidor tardó demasiado en responder. La operación ha sido cancelada por seguridad.';
        } else if (msg.includes('payload too large') || msg.includes('too large')) {
            message = 'El archivo es demasiado grande para ser procesado por el sistema.';
        } else if (msg.includes('failed to fetch') || msg.includes('net::err_connection')) {
            message = 'No se pudo conectar con el servidor local. Asegúrate de que el servidor esté encendido.';
        } else if (msg.includes('foreign key constraint failed') || msg.includes('foreign key')) {
            message = 'Error de integridad: Algún dato no coincide con los registros existentes.';
        } else if (msg.includes('unique constraint failed') || msg.includes('unique constraint')) {
            message = 'Este registro ya existe en el sistema (código o RUT duplicado).';
        } else if (msg.includes('sqlite_error')) {
            message = 'Error interno en la base de datos: ' + message;
        }
    }

    const container = document.getElementById('notification-container');
    if (!container) return;

    // C2: Anti-spam — No mostrar la misma notificación si ya está en pantalla
    const existingNotifications = Array.from(container.querySelectorAll('.notification'));
    const isDuplicate = existingNotifications.some(n => n.innerText.includes(message));
    if (isDuplicate) return;

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.animation = 'slideUp 0.4s ease-out forwards';

    const icons = {
        success: '✓',
        error: '✗',
        warning: '⚠',
        info: 'ℹ'
    };

    // ponytail: Registrar notificación en el centro de avisos
    if (typeof NotificationCenter !== 'undefined') {
        NotificationCenter.add(message, type);
    }

    notification.innerHTML = `
        <span style="font-size: 1.25rem;">${icons[type] || icons.info}</span>
        <div style="display: flex; flex-direction: column; gap: 0.15rem;">
            <span>${message}</span>
            ${type === 'error' ? `<small style="font-size: 0.7rem; opacity: 0.8; font-weight: 700; text-decoration: underline;">💡 Haz clic para ver solución</small>` : ''}
        </div>
    `;

    if (type === 'error') {
        notification.style.cursor = 'pointer';
        notification.title = 'Haz clic para ver solución recomendada';
        notification.onclick = () => {
            if (typeof NotificationCenter !== 'undefined') {
                NotificationCenter.showSolutionModal(message);
            }
        };
    }

    container.appendChild(notification);

    const duration = type === 'error' ? 8000 : 3000; // Aumentar duración del error para que de tiempo a hacer clic

    setTimeout(() => {
        notification.style.animation = 'slideUp 0.35s ease-in reverse';
        setTimeout(() => notification.remove(), 300);
    }, duration);
};

/**
 * Muestra una notificación persistente de actualización.
 * Diseñada para que el usuario no la ignore pero no moleste su flujo.
 */
const showUpdateNotification = (onConfirm) => {
    // Evitar duplicados
    if (document.getElementById('update-notification')) return;

    const banner = document.createElement('div');
    banner.id = 'update-notification';
    banner.style.cssText = `
        position: fixed;
        bottom: 2rem;
        left: 50%;
        transform: translateX(-50%);
        background: #1e1b4b;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 1.25rem;
        display: flex;
        align-items: center;
        gap: 1.5rem;
        z-index: 9999;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.1);
        animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        max-width: 90vw;
    `;

    banner.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.75rem;">
            <span style="font-size: 1.5rem;">🚀</span>
            <div>
                <strong style="display: block; font-size: 0.95rem;">Nueva versión disponible</strong>
                <span style="font-size: 0.85rem; opacity: 0.8;">Actualización lista para mejorar tu sistema</span>
            </div>
        </div>
        <button id="btn-update-now" style="
            background: #4f46e5;
            color: white;
            border: none;
            padding: 0.6rem 1.2rem;
            border-radius: 0.75rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            white-space: nowrap;
        ">Actualizar ahora</button>
    `;

    document.body.appendChild(banner);

    const btn = banner.querySelector('#btn-update-now');
    btn.onclick = () => {
        btn.innerText = 'Cargando...';
        btn.style.opacity = '0.7';
        if (onConfirm) onConfirm();
    };

    // Añadir estilo de animación si no existe
    if (!document.getElementById('update-anim-styles')) {
        const style = document.createElement('style');
        style.id = 'update-anim-styles';
        style.innerHTML = `
            @keyframes slideUp {
                from { transform: translate(-50%, 100%); opacity: 0; }
                to { transform: translate(-50%, 0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
};

const showModal = (content, options = {}) => {
    const overlay = document.getElementById('modal-overlay');

    const modal = document.createElement('div');
    modal.className = 'modal';
    // M1: Responsividad para celulares — Evita desborde horizontal (max-width dinámico)
    const maxWidth = options.width || '600px';
    modal.style.maxWidth = `min(${maxWidth}, 95vw)`;
    modal.style.width = '100%';

    modal.innerHTML = `
        <div class="modal-header">
            <h3>${options.title || 'Modal'}</h3>
            <button class="close-modal" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            ${content}
        </div>
        ${options.footer ? `<div class="modal-footer">${options.footer}</div>` : ''}
    `;

    overlay.classList.add('active');
    document.body.appendChild(modal);

    return modal;
};

const closeModal = () => {
    const modals = document.querySelectorAll('.modal');
    if (modals.length === 0) {
        const overlay = document.getElementById('modal-overlay');
        if (overlay) overlay.classList.remove('active');
        return;
    }

    // Only remove the topmost modal
    const lastModal = modals[modals.length - 1];
    if (lastModal._enterKeyHandler) {
        document.removeEventListener('keydown', lastModal._enterKeyHandler, true);
    }
    lastModal.remove();

    // Only hide overlay if no more modals exist
    if (document.querySelectorAll('.modal').length === 0) {
        const overlay = document.getElementById('modal-overlay');
        if (overlay) overlay.classList.remove('active');
    }

    // Auto-refocus appropriate search when closing modals
    setTimeout(() => {
        // If a modal still exists, it should probably regain focus (handled by the modal's own init usually)
        if (document.querySelectorAll('.modal').length > 0) {
            // If it's the purchase wizard, ensure current step is focused
            if (typeof PurchasesView !== 'undefined' && document.getElementById('purchaseForm')) {
                PurchasesView.updateWizardUI();
            }
            return;
        }

        // No modals left: refocus the main view's search
        if (typeof app !== 'undefined') {
            if (app.currentView === 'pos' && typeof POSView !== 'undefined') {
                POSView.focusSearch();
            } else if (app.currentView === 'purchases' && typeof PurchasesView !== 'undefined') {
                // If there's a search input on the main purchases list
                document.getElementById('searchPurchases')?.focus();
            }
        }
    }, 80);
};

const showConfirm = (message, titleOrCallback = 'Confirmación', confirmText = 'Confirmar', cancelText = 'Cancelar') => {
    return new Promise((resolve) => {
        let title = titleOrCallback;
        let callback = null;

        if (typeof titleOrCallback === 'function') {
            title = 'Confirmación';
            callback = titleOrCallback;
        }

        const content = `
            <p style="font-size: 1.15rem; margin-bottom: 1.5rem; text-align: center; color: #1e293b; line-height: 1.6; font-weight: 700; background: rgba(0,0,0,0.03); padding: 1.5rem; border-radius: 1rem; border: 1px dashed #cbd5e1;">
                ${message}
            </p>
        `;

        const footer = `
            <button id="confirmCancelBtn" class="btn" style="flex: 1; background: #64748b; color: white; border: none; padding: 0.75rem; border-radius: 0.75rem; font-weight: 600; cursor: pointer;"> ${cancelText} </button>
            <button id="confirmActionBtn" class="btn" style="flex: 1; background: #4f46e5; color: white; border: none; padding: 0.75rem; border-radius: 0.75rem; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);"> ${confirmText} </button>
        `;

        const modal = showModal(content, {
            title: title,
            footer: `<div style="display: flex; gap: 1rem; width: 100%; border-top: 1px solid rgba(0,0,0,0.05); padding-top: 1rem;">${footer}</div>`,
            width: '450px'
        });

        const confirmBtn = modal.querySelector('#confirmActionBtn');
        const cancelBtn = modal.querySelector('#confirmCancelBtn');

        console.log('[Confirm] Modal mostrado, esperando acción...');

        if (confirmBtn) {
            confirmBtn.onclick = () => {
                console.log('[Confirm] Clic en confirmar');
                confirmBtn.disabled = true;
                confirmBtn.innerText = 'Procesando...';
                if (callback) callback();
                resolve(true);
                closeModal();
            };
        }

        if (cancelBtn) {
            cancelBtn.onclick = () => {
                console.log('[Confirm] Clic en cancelar');
                resolve(false);
                closeModal();
            };
        }
    });
};

// Global Escape key handler to close modals
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modals = document.querySelectorAll('.modal');
        if (modals.length > 0) {
            closeModal();
        }
    }
});
