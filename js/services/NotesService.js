/**
 * NotesService.js - Gestor de Notas del Mostrador, Envases Retornables y Tareas de Personal (Caja Fácil)
 * Soporta modo local offline en SQLite y sincronización bidireccional multicaja/multinegocio con Supabase.
 */
const NotesService = {
    _notes: null,
    _isLoading: false,

    getStorageKey() {
        const bid = (typeof localStorage !== 'undefined' ? localStorage.getItem('BUSINESS_ID') : null) || 1;
        return `CF_NOTES_BIZ_${bid}`;
    },

    async init() {
        await this.load();
        await this._migrateLegacyNotes();
    },

    async load() {
        try {
            if (typeof db !== 'undefined' && typeof db.getAll === 'function') {
                const notes = await db.getAll('counterNotes');
                if (Array.isArray(notes)) {
                    // Filtrar eliminados (soft delete)
                    this._notes = notes.filter(n => !n.deleted_at);
                    this.updateAllBadges();
                    return this._notes;
                }
            }
        } catch (e) {
            console.warn('[NotesService] Error leyendo notas de BD local:', e.message);
        }
        // Fallback defensivo a memoria o localStorage si SQLite no estuviera disponible
        if (!this._notes) {
            this._notes = this._getFromLocalStorage();
        }
        this.updateAllBadges();
        return this._notes || [];
    },

    async _migrateLegacyNotes() {
        try {
            const raw = localStorage.getItem(this.getStorageKey());
            if (!raw) return;
            const legacy = JSON.parse(raw);
            if (!Array.isArray(legacy) || legacy.length === 0) return;

            console.log(`[NotesService] 📦 Migrando ${legacy.length} notas locales desde navegador a base de datos...`);
            for (const item of legacy) {
                const exists = (this._notes || []).some(n => n.uuid === item.id || (n.text === item.text && n.clientName === item.clientName));
                if (!exists) {
                    await this.addNote({
                        category: item.category || 'general',
                        text: item.text || '',
                        clientName: item.clientName || '',
                        clientPhone: item.clientPhone || '',
                        customerId: item.customerId || null,
                        bottleDetail: item.bottleDetail || '',
                        bottleCount: item.bottleCount || 1,
                        reservationDetail: item.reservationDetail || '',
                        reservationDeposit: item.reservationDeposit || 0,
                        dueDate: item.dueDate || '',
                        dueTime: item.dueTime || '',
                        assignedTo: item.assignedTo || 'Todos',
                        createdBy: item.createdBy || 'Mostrador'
                    }, false);
                }
            }
            // Respaldar y limpiar localStorage para no duplicar
            localStorage.setItem(this.getStorageKey() + '_MIGRATED_BACKUP', raw);
            localStorage.removeItem(this.getStorageKey());
            console.log('[NotesService] ✅ Migración de notas a SQLite completada.');
        } catch (err) {
            console.warn('[NotesService] Error durante migración:', err.message);
        }
    },

    _getFromLocalStorage() {
        try {
            const raw = localStorage.getItem(this.getStorageKey());
            if (!raw) return [];
            const notes = JSON.parse(raw);
            return Array.isArray(notes) ? notes : [];
        } catch (_) {
            return [];
        }
    },

    getAll() {
        if (!this._notes) {
            this._notes = this._getFromLocalStorage();
            // Disparar carga reactiva en segundo plano
            this.load();
        }

        const notes = [...(this._notes || [])];
        // Ordenar: pendientes primero (cronológico reciente), completadas al final
        return notes.sort((a, b) => {
            const aComp = Boolean(a.isCompleted);
            const bComp = Boolean(b.isCompleted);
            if (aComp !== bComp) {
                return aComp ? 1 : -1;
            }
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });
    },

    getPendingCount() {
        const notes = this.getAll();
        return notes.filter(n => !n.isCompleted).length;
    },

    getCounts() {
        const notes = this.getAll();
        const pending = notes.filter(n => !n.isCompleted);
        const completed = notes.filter(n => n.isCompleted);
        return {
            totalPending: pending.length,
            bottlesCount: pending.filter(n => n.category === 'bottle').length,
            reservationsCount: pending.filter(n => n.category === 'reservation').length,
            tasksCount: pending.filter(n => n.category === 'task').length,
            generalCount: pending.filter(n => n.category === 'order' || n.category === 'general').length,
            completedCount: completed.length
        };
    },

    getByCustomer(customerId = null, customerName = null) {
        const notes = this.getAll();
        const normName = (customerName || '').trim().toLowerCase();
        return notes.filter(n => {
            if (customerId && n.customerId && String(n.customerId) === String(customerId)) return true;
            if (normName && n.clientName && n.clientName.trim().toLowerCase() === normName) return true;
            return false;
        });
    },

    async addNote({ 
        category = 'general', 
        text = '', 
        clientName = '', 
        clientPhone = '', 
        customerId = null,
        bottleDetail = '', 
        bottleCount = 1,
        reservationDetail = '', 
        reservationDeposit = 0,
        dueDate = '',
        dueTime = '',
        assignedTo = 'Todos',
        createdBy = null 
    }, notify = true) {
        if (!this._notes) this._notes = [];

        let author = createdBy;
        if (!author && typeof AuthManager !== 'undefined' && typeof AuthManager.getCurrentUser === 'function') {
            const u = AuthManager.getCurrentUser();
            author = u?.username || 'Dueño';
        }
        if (!author) author = 'Mostrador';

        // Construir texto representativo si viene vacío
        let cleanText = (text || '').trim();
        if (!cleanText) {
            if (category === 'bottle') {
                cleanText = `${clientName ? clientName + ': ' : ''}Debe ${bottleCount || 1} envase(s) (${bottleDetail || 'Bebida/Cerveza'})`;
            } else if (category === 'reservation') {
                cleanText = `${clientName ? clientName + ': ' : ''}Reserva de ${reservationDetail || 'Producto'} ${reservationDeposit > 0 ? `(Abonó $${reservationDeposit})` : ''}`;
            } else if (category === 'task') {
                cleanText = `Tarea: ${text || 'Sin detalle'}`;
            } else {
                cleanText = 'Nota de mostrador';
            }
        }

        const bid = (typeof localStorage !== 'undefined' ? localStorage.getItem('BUSINESS_ID') : null) || 1;
        const nowIso = new Date().toISOString();
        const uuid = 'note_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);

        const newNote = {
            uuid: uuid,
            category: category,
            text: cleanText,
            clientName: (clientName || '').trim(),
            clientPhone: (clientPhone || '').trim(),
            customerId: customerId || null,
            bottleDetail: (bottleDetail || '').trim(),
            bottleCount: parseInt(bottleCount) || 1,
            reservationDetail: (reservationDetail || '').trim(),
            reservationDeposit: parseFloat(reservationDeposit) || 0,
            dueDate: (dueDate || '').trim(),
            dueTime: (dueTime || '').trim(),
            assignedTo: (assignedTo || 'Todos').trim(),
            isCompleted: 0,
            completedAt: null,
            completedBy: null,
            createdBy: author,
            createdAt: nowIso,
            updatedAt: nowIso,
            business_id: Number(bid),
            is_synced: 0
        };

        // 1. Inserción reactiva inmediata en memoria
        this._notes.unshift(newNote);
        this.updateAllBadges();

        // 2. Persistencia en base de datos SQLite
        try {
            if (typeof db !== 'undefined' && typeof db.add === 'function') {
                const insertedId = await db.add('counterNotes', newNote);
                if (insertedId) newNote.id = insertedId;
            }
        } catch (dbErr) {
            console.warn('[NotesService] Error guardando en BD local:', dbErr.message);
        }

        if (notify && typeof showNotification === 'function') {
            const label = category === 'bottle' ? '🍾 Envase anotado' : category === 'reservation' ? '🥖 Reserva guardada' : category === 'task' ? '📋 Tarea asignada' : '📝 Nota guardada';
            showNotification(`${label} exitosamente`, 'success');
        }

        return newNote;
    },

    async toggleNote(noteId, byWho = null) {
        const note = (this._notes || []).find(n => String(n.id) === String(noteId) || n.uuid === noteId);
        if (!note) return null;

        note.isCompleted = note.isCompleted ? 0 : 1;
        note.completedAt = note.isCompleted ? new Date().toISOString() : null;
        note.completedBy = note.isCompleted ? (byWho || 'Usuario') : null;
        note.updatedAt = new Date().toISOString();
        note.is_synced = 0;

        this.updateAllBadges();

        try {
            if (typeof db !== 'undefined' && typeof db.update === 'function' && note.id) {
                await db.update('counterNotes', note);
            }
        } catch (dbErr) {
            console.warn('[NotesService] Error actualizando estado en BD:', dbErr.message);
        }

        return note;
    },

    async completeNote(noteId, byWho = null) {
        const note = (this._notes || []).find(n => String(n.id) === String(noteId) || n.uuid === noteId);
        if (!note) return null;

        note.isCompleted = 1;
        note.completedAt = new Date().toISOString();
        note.completedBy = byWho || 'Usuario';
        note.updatedAt = new Date().toISOString();
        note.is_synced = 0;

        this.updateAllBadges();

        try {
            if (typeof db !== 'undefined' && typeof db.update === 'function' && note.id) {
                await db.update('counterNotes', note);
            }
        } catch (dbErr) {
            console.warn('[NotesService] Error marcando como completada en BD:', dbErr.message);
        }

        if (typeof showNotification === 'function') {
            const msg = note.category === 'bottle' ? '🍾 Envases registrados como devueltos' : note.category === 'reservation' ? '🥖 Reserva entregada al cliente' : '✅ Tarea completada';
            showNotification(msg, 'success');
        }
        return note;
    },

    async restoreNote(noteId) {
        const note = (this._notes || []).find(n => String(n.id) === String(noteId) || n.uuid === noteId);
        if (!note) return null;

        note.isCompleted = 0;
        note.completedAt = null;
        note.completedBy = null;
        note.updatedAt = new Date().toISOString();
        note.is_synced = 0;

        this.updateAllBadges();

        try {
            if (typeof db !== 'undefined' && typeof db.update === 'function' && note.id) {
                await db.update('counterNotes', note);
            }
        } catch (dbErr) {
            console.warn('[NotesService] Error restaurando nota en BD:', dbErr.message);
        }

        if (typeof showNotification === 'function') {
            showNotification('Nota restaurada a pendientes', 'info');
        }
        return note;
    },

    async deleteNote(noteId) {
        const idx = (this._notes || []).findIndex(n => String(n.id) === String(noteId) || n.uuid === noteId);
        if (idx === -1) return false;

        const note = this._notes[idx];
        this._notes.splice(idx, 1);
        this.updateAllBadges();

        try {
            if (typeof db !== 'undefined' && note.id) {
                note.deleted_at = new Date().toISOString();
                note.is_synced = 0;
                await db.update('counterNotes', note);
            }
        } catch (dbErr) {
            console.warn('[NotesService] Error eliminando nota en BD:', dbErr.message);
        }

        return true;
    },

    updateAllBadges() {
        const counts = this.getCounts();
        
        // 1. Badge en Punto de Venta (POS)
        const posBadge = document.getElementById('pos-notes-badge');
        if (posBadge) {
            posBadge.textContent = counts.totalPending;
            posBadge.style.display = counts.totalPending > 0 ? 'inline-block' : 'none';
        }

        // 1b. Badge en Botón Flotante Universal (disponible en todos los módulos)
        const floatBadge = document.getElementById('floating-notes-badge');
        if (floatBadge) {
            floatBadge.textContent = counts.totalPending;
            floatBadge.style.display = counts.totalPending > 0 ? 'inline-flex' : 'none';
        }

        // 2. Badge en Caja (CashView)
        const cashBadge = document.getElementById('cash-exec-notes-badge');
        const cashVal = document.getElementById('cash-exec-notes-val');
        if (cashVal) {
            cashVal.textContent = `${counts.totalPending} pendientes`;
        }
        if (cashBadge) {
            if (counts.totalPending > 0) {
                cashBadge.innerHTML = `📌 ${counts.bottlesCount} envases · ${counts.reservationsCount} reservas · ${counts.tasksCount} tareas`;
                cashBadge.style.background = '#fef3c7';
                cashBadge.style.color = '#b45309';
                cashBadge.style.borderColor = '#fde68a';
            } else {
                cashBadge.textContent = '✅ Al día';
                cashBadge.style.background = '#ecfdf5';
                cashBadge.style.color = '#047857';
                cashBadge.style.borderColor = '#a7f3d0';
            }
        }
    }
};

/**
 * Componente Modal Global de Pizarra de Notas, Encargos y Envases
 */
const NotesModal = {
    currentTab: 'all', // 'all' | 'bottle' | 'reservation' | 'task' | 'completed'
    searchTerm: '',
    isFormOpen: false,
    selectedCategoryForm: 'bottle', // 'bottle' | 'reservation' | 'task' | 'general'

    async open(initialTab = 'all', filterCustomer = '') {
        const existingContainer = document.getElementById('notesModalContainer');
        if (existingContainer && this.currentTab === initialTab && !filterCustomer) {
            if (typeof closeModal === 'function') closeModal();
            return;
        }
        this.currentTab = initialTab;
        this.searchTerm = filterCustomer || '';
        this.isFormOpen = false;

        this.renderModal();
    },

    renderModal() {
        const counts = NotesService.getCounts();
        let allNotes = NotesService.getAll();

        // Filtrado por pestaña
        let filtered = allNotes;
        if (this.currentTab === 'completed') {
            filtered = allNotes.filter(n => n.isCompleted);
        } else {
            filtered = allNotes.filter(n => !n.isCompleted);
            if (this.currentTab === 'bottle') filtered = filtered.filter(n => n.category === 'bottle');
            else if (this.currentTab === 'reservation') filtered = filtered.filter(n => n.category === 'reservation');
            else if (this.currentTab === 'task') filtered = filtered.filter(n => n.category === 'task');
        }

        // Filtrado por buscador
        if (this.searchTerm.trim()) {
            const term = this.searchTerm.toLowerCase().trim();
            filtered = filtered.filter(n => 
                (n.clientName && n.clientName.toLowerCase().includes(term)) ||
                (n.clientPhone && n.clientPhone.toLowerCase().includes(term)) ||
                (n.text && n.text.toLowerCase().includes(term)) ||
                (n.bottleDetail && n.bottleDetail.toLowerCase().includes(term)) ||
                (n.reservationDetail && n.reservationDetail.toLowerCase().includes(term))
            );
        }

        const content = `
            <div id="notesModalContainer" style="display: flex; flex-direction: column; gap: 1rem; max-height: 82vh;">
                <!-- 1. Cabecera con Botón de Creación y Filtros de Pestaña -->
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                    <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
                        <button type="button" class="btn btn-sm" onclick="NotesModal.switchTab('all')" 
                                style="font-weight: 800; border-radius: 0.6rem; padding: 0.45rem 0.8rem; background: ${this.currentTab === 'all' ? '#2563eb' : '#f1f5f9'}; color: ${this.currentTab === 'all' ? '#ffffff' : '#475569'}; border: 1.5px solid ${this.currentTab === 'all' ? '#1d4ed8' : '#e2e8f0'};">
                            📌 Todas (${counts.totalPending})
                        </button>
                        <button type="button" class="btn btn-sm" onclick="NotesModal.switchTab('bottle')" 
                                style="font-weight: 800; border-radius: 0.6rem; padding: 0.45rem 0.8rem; background: ${this.currentTab === 'bottle' ? '#f59e0b' : '#f1f5f9'}; color: ${this.currentTab === 'bottle' ? '#ffffff' : '#475569'}; border: 1.5px solid ${this.currentTab === 'bottle' ? '#d97706' : '#e2e8f0'};">
                            🍾 Envases (${counts.bottlesCount})
                        </button>
                        <button type="button" class="btn btn-sm" onclick="NotesModal.switchTab('reservation')" 
                                style="font-weight: 800; border-radius: 0.6rem; padding: 0.45rem 0.8rem; background: ${this.currentTab === 'reservation' ? '#0ea5e9' : '#f1f5f9'}; color: ${this.currentTab === 'reservation' ? '#ffffff' : '#475569'}; border: 1.5px solid ${this.currentTab === 'reservation' ? '#0284c7' : '#e2e8f0'};">
                            🥖 Reservas (${counts.reservationsCount})
                        </button>
                        <button type="button" class="btn btn-sm" onclick="NotesModal.switchTab('task')" 
                                style="font-weight: 800; border-radius: 0.6rem; padding: 0.45rem 0.8rem; background: ${this.currentTab === 'task' ? '#8b5cf6' : '#f1f5f9'}; color: ${this.currentTab === 'task' ? '#ffffff' : '#475569'}; border: 1.5px solid ${this.currentTab === 'task' ? '#7c3aed' : '#e2e8f0'};">
                            📋 Tareas (${counts.tasksCount})
                        </button>
                        <button type="button" class="btn btn-sm" onclick="NotesModal.switchTab('completed')" 
                                style="font-weight: 800; border-radius: 0.6rem; padding: 0.45rem 0.8rem; background: ${this.currentTab === 'completed' ? '#10b981' : '#f1f5f9'}; color: ${this.currentTab === 'completed' ? '#ffffff' : '#475569'}; border: 1.5px solid ${this.currentTab === 'completed' ? '#059669' : '#e2e8f0'};">
                            ✅ Historial (${counts.completedCount})
                        </button>
                    </div>

                    <button type="button" class="btn btn-primary" onclick="NotesModal.toggleForm()" 
                            style="font-weight: 900; border-radius: 0.65rem; background: #059669; border-color: #047857; display: flex; align-items: center; gap: 0.35rem; padding: 0.45rem 1rem;">
                        <span>${this.isFormOpen ? '✕ Cerrar Formulario' : '➕ Nueva Nota / Encargo'}</span>
                    </button>
                </div>

                <!-- 2. Formulario Desplegable para Agregar Nota -->
                ${this.isFormOpen ? this.renderCreationForm() : ''}

                <!-- 3. Buscador en Tiempo Real -->
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <input type="text" 
                           id="notesSearchInput" 
                           placeholder="🔍 Buscar por cliente, teléfono o detalle..." 
                           value="${safeHTML(this.searchTerm)}"
                           class="form-control"
                           oninput="NotesModal.handleSearch(this.value)"
                           style="height: 42px; font-size: 0.92rem; font-weight: 600; border-radius: 0.65rem; border: 1.5px solid #cbd5e1;">
                    ${this.searchTerm ? `
                        <button type="button" class="btn btn-secondary" onclick="NotesModal.handleSearch('')" style="font-weight: 800; height: 42px; padding: 0 0.75rem; border-radius: 0.65rem;">
                            Limpiar
                        </button>
                    ` : ''}
                </div>

                <!-- 4. Contenedor de Tarjetas Scrollable -->
                <div style="overflow-y: auto; max-height: 46vh; padding-right: 0.35rem;">
                    ${filtered.length === 0 ? `
                        <div style="text-align: center; padding: 3rem 1rem; color: #94a3b8; background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 1rem;">
                            <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📝</div>
                            <h4 style="margin: 0; color: #475569; font-size: 1rem; font-weight: 800;">No hay notas en esta sección</h4>
                            <p style="margin: 0.35rem 0 0 0; font-size: 0.85rem; color: #94a3b8;">
                                ${this.searchTerm ? 'No se encontraron coincidencias para la búsqueda.' : 'Presiona "+ Nueva Nota / Encargo" arriba para registrar un envase, reserva o tarea.'}
                            </p>
                        </div>
                    ` : filtered.map(n => this.renderNoteCard(n)).join('')}
                </div>
            </div>
        `;

        const existingContainer = document.getElementById('notesModalContainer');
        if (existingContainer) {
            existingContainer.outerHTML = content;
        } else {
            showModal(content, {
                title: '📝 Pizarra de Notas, Encargos y Envases [F7]',
                width: '740px',
                footer: `<button class="btn btn-secondary" onclick="closeModal()" style="font-weight: 800; border-radius: 0.65rem;">Cerrar</button>`
            });
        }

        // Foco automático si el formulario está abierto
        setTimeout(() => {
            if (this.isFormOpen) {
                const target = document.getElementById('noteFormClientName') || document.getElementById('noteFormText');
                if (target) target.focus();
            }
        }, 120);
    },

    renderCreationForm() {
        return `
            <div style="background: #f8fafc; border: 2px solid #3b82f6; border-radius: 1rem; padding: 1.25rem; animation: splashFadeIn 0.2s ease;">
                <!-- Tipo de Nota / Encargo -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
                    <strong style="color: #0f172a; font-size: 0.95rem;">Selecciona el tipo de registro:</strong>
                    <div style="display: flex; gap: 0.4rem;">
                        <button type="button" class="btn btn-sm" onclick="NotesModal.changeFormCategory('bottle')"
                                style="font-weight: 800; border-radius: 0.5rem; background: ${this.selectedCategoryForm === 'bottle' ? '#f59e0b' : '#ffffff'}; color: ${this.selectedCategoryForm === 'bottle' ? '#ffffff' : '#475569'}; border: 1.5px solid #d97706;">
                            🍾 Envases
                        </button>
                        <button type="button" class="btn btn-sm" onclick="NotesModal.changeFormCategory('reservation')"
                                style="font-weight: 800; border-radius: 0.5rem; background: ${this.selectedCategoryForm === 'reservation' ? '#0ea5e9' : '#ffffff'}; color: ${this.selectedCategoryForm === 'reservation' ? '#ffffff' : '#475569'}; border: 1.5px solid #0284c7;">
                            🥖 Reserva
                        </button>
                        <button type="button" class="btn btn-sm" onclick="NotesModal.changeFormCategory('task')"
                                style="font-weight: 800; border-radius: 0.5rem; background: ${this.selectedCategoryForm === 'task' ? '#8b5cf6' : '#ffffff'}; color: ${this.selectedCategoryForm === 'task' ? '#ffffff' : '#475569'}; border: 1.5px solid #7c3aed;">
                            📋 Tarea
                        </button>
                        <button type="button" class="btn btn-sm" onclick="NotesModal.changeFormCategory('general')"
                                style="font-weight: 800; border-radius: 0.5rem; background: ${this.selectedCategoryForm === 'general' ? '#64748b' : '#ffffff'}; color: ${this.selectedCategoryForm === 'general' ? '#ffffff' : '#475569'}; border: 1.5px solid #64748b;">
                            📝 General
                        </button>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                    ${this.selectedCategoryForm === 'bottle' ? `
                        <!-- FORMULARIO: ENVASES RETORNABLES -->
                        <div style="display: grid; grid-template-columns: 1.4fr 1fr; gap: 0.75rem;">
                            <div>
                                <label style="font-size: 0.78rem; font-weight: 800; color: #475569; display: block; margin-bottom: 0.25rem;">Nombre del Cliente *</label>
                                <input type="text" id="noteFormClientName" placeholder="Ej: Don Juan Pérez / Doña Rosa..." class="form-control" style="height: 40px; font-weight: 700; border-radius: 0.5rem;">
                            </div>
                            <div>
                                <label style="font-size: 0.78rem; font-weight: 800; color: #475569; display: block; margin-bottom: 0.25rem;">Teléfono (WhatsApp)</label>
                                <input type="text" id="noteFormClientPhone" placeholder="+569..." class="form-control" style="height: 40px; border-radius: 0.5rem;">
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 0.75rem;">
                            <div>
                                <label style="font-size: 0.78rem; font-weight: 800; color: #475569; display: block; margin-bottom: 0.25rem;">Detalle del Envase *</label>
                                <input type="text" id="noteFormBottleDetail" placeholder="Ej: Coca-Cola 2L retornable, Cajón cerveza..." class="form-control" style="height: 40px; font-weight: 700; border-radius: 0.5rem;">
                            </div>
                            <div>
                                <label style="font-size: 0.78rem; font-weight: 800; color: #475569; display: block; margin-bottom: 0.25rem;">Cantidad *</label>
                                <input type="number" id="noteFormBottleCount" value="1" min="1" class="form-control" style="height: 40px; font-weight: 900; text-align: center; border-radius: 0.5rem;">
                            </div>
                            <div>
                                <label style="font-size: 0.78rem; font-weight: 800; color: #475569; display: block; margin-bottom: 0.25rem;">Devuelve el:</label>
                                <input type="date" id="noteFormDueDate" class="form-control" style="height: 40px; border-radius: 0.5rem;">
                            </div>
                        </div>
                    ` : this.selectedCategoryForm === 'reservation' ? `
                        <!-- FORMULARIO: RESERVA O ENCARGO -->
                        <div style="display: grid; grid-template-columns: 1.4fr 1fr; gap: 0.75rem;">
                            <div>
                                <label style="font-size: 0.78rem; font-weight: 800; color: #475569; display: block; margin-bottom: 0.25rem;">Nombre del Cliente *</label>
                                <input type="text" id="noteFormClientName" placeholder="Ej: Doña María..." class="form-control" style="height: 40px; font-weight: 700; border-radius: 0.5rem;">
                            </div>
                            <div>
                                <label style="font-size: 0.78rem; font-weight: 800; color: #475569; display: block; margin-bottom: 0.25rem;">Teléfono (WhatsApp)</label>
                                <input type="text" id="noteFormClientPhone" placeholder="+569..." class="form-control" style="height: 40px; border-radius: 0.5rem;">
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 0.75rem;">
                            <div>
                                <label style="font-size: 0.78rem; font-weight: 800; color: #475569; display: block; margin-bottom: 0.25rem;">Producto y Cantidad Reservada *</label>
                                <input type="text" id="noteFormReservationDetail" placeholder="Ej: 2 kg Pan Batido, 1 Torta Selva Negra..." class="form-control" style="height: 40px; font-weight: 700; border-radius: 0.5rem;">
                            </div>
                            <div>
                                <label style="font-size: 0.78rem; font-weight: 800; color: #475569; display: block; margin-bottom: 0.25rem;">Abono Pagado ($)</label>
                                <input type="number" id="noteFormReservationDeposit" placeholder="0" min="0" class="form-control" style="height: 40px; font-weight: 800; border-radius: 0.5rem;">
                            </div>
                            <div>
                                <label style="font-size: 0.78rem; font-weight: 800; color: #475569; display: block; margin-bottom: 0.25rem;">Hora de Retiro:</label>
                                <input type="time" id="noteFormDueTime" class="form-control" style="height: 40px; border-radius: 0.5rem;">
                            </div>
                        </div>
                    ` : this.selectedCategoryForm === 'task' ? `
                        <!-- FORMULARIO: TAREAS DE PERSONAL / DUEÑO -->
                        <div>
                            <label style="font-size: 0.78rem; font-weight: 800; color: #475569; display: block; margin-bottom: 0.25rem;">Tarea a Realizar *</label>
                            <input type="text" id="noteFormText" placeholder="Ej: Reponer cecinas a las 17:00 / Hacer aseo en vitrina / Llamar a distribuidor..." class="form-control" style="height: 40px; font-weight: 700; border-radius: 0.5rem;">
                        </div>

                        <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 0.75rem;">
                            <div>
                                <label style="font-size: 0.78rem; font-weight: 800; color: #475569; display: block; margin-bottom: 0.25rem;">Asignada a:</label>
                                <select id="noteFormAssignedTo" class="form-control" style="height: 40px; font-weight: 700; border-radius: 0.5rem;">
                                    <option value="Todos">👥 Todo el Personal</option>
                                    <option value="Dueño">👔 Para Mí (Dueño / Administrador)</option>
                                    <option value="Turno Mañana">🌅 Turno Mañana</option>
                                    <option value="Turno Tarde">🌇 Turno Tarde</option>
                                </select>
                            </div>
                            <div>
                                <label style="font-size: 0.78rem; font-weight: 800; color: #475569; display: block; margin-bottom: 0.25rem;">Hora Límite:</label>
                                <input type="time" id="noteFormDueTime" class="form-control" style="height: 40px; border-radius: 0.5rem;">
                            </div>
                        </div>
                    ` : `
                        <!-- FORMULARIO: NOTA GENERAL -->
                        <div>
                            <label style="font-size: 0.78rem; font-weight: 800; color: #475569; display: block; margin-bottom: 0.25rem;">Texto de la Nota *</label>
                            <input type="text" id="noteFormText" placeholder="Escribe el recordatorio o apunte rápido..." class="form-control" style="height: 40px; font-weight: 700; border-radius: 0.5rem;">
                        </div>
                    `}

                    <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem;">
                        <button type="button" class="btn btn-secondary" onclick="NotesModal.toggleForm(false)" style="font-weight: 800; border-radius: 0.5rem;">
                            Cancelar
                        </button>
                        <button type="button" class="btn btn-primary" onclick="NotesModal.saveNoteFromForm()" style="font-weight: 900; background: #2563eb; border-radius: 0.5rem; padding: 0.5rem 1.5rem;">
                            ✓ Guardar Registro
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    renderNoteCard(note) {
        const isCompleted = note.isCompleted;
        const cat = note.category || 'general';

        let badgeBg = '#f1f5f9';
        let badgeColor = '#475569';
        let badgeIcon = '📝';
        let badgeText = 'Nota General';

        if (cat === 'bottle') {
            badgeBg = isCompleted ? '#f1f5f9' : '#fffbeb';
            badgeColor = isCompleted ? '#64748b' : '#b45309';
            badgeIcon = '🍾';
            badgeText = `Envase Retornable (${note.bottleCount || 1} un)`;
        } else if (cat === 'reservation') {
            badgeBg = isCompleted ? '#f1f5f9' : '#eff6ff';
            badgeColor = isCompleted ? '#64748b' : '#1d4ed8';
            badgeIcon = '🥖';
            badgeText = 'Reserva / Encargo';
        } else if (cat === 'task') {
            badgeBg = isCompleted ? '#f1f5f9' : '#f5f3ff';
            badgeColor = isCompleted ? '#64748b' : '#6d28d9';
            badgeIcon = '📋';
            badgeText = `Tarea (${safeHTML(note.assignedTo || 'Personal')})`;
        }

        return `
            <div id="note-card-${note.id}" 
                 style="background: ${isCompleted ? '#f8fafc' : '#ffffff'}; border: 1.5px solid ${isCompleted ? '#e2e8f0' : (cat === 'bottle' ? '#fcd34d' : cat === 'reservation' ? '#93c5fd' : cat === 'task' ? '#c4b5fd' : '#cbd5e1')}; border-radius: 0.85rem; padding: 1rem 1.25rem; margin-bottom: 0.75rem; transition: all 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <!-- Header de Tarjeta -->
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.35rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                        <span style="font-size: 0.72rem; font-weight: 850; text-transform: uppercase; padding: 0.2rem 0.55rem; border-radius: 999px; background: ${badgeBg}; color: ${badgeColor}; display: inline-flex; align-items: center; gap: 0.25rem;">
                            <span>${badgeIcon}</span> ${badgeText}
                        </span>
                        ${note.dueTime ? `<span style="font-size: 0.72rem; font-weight: 750; color: #475569; background: #f1f5f9; padding: 0.2rem 0.45rem; border-radius: 0.35rem;">⏰ ${safeHTML(note.dueTime)} hrs</span>` : ''}
                        ${note.dueDate ? `<span style="font-size: 0.72rem; font-weight: 750; color: #475569; background: #f1f5f9; padding: 0.2rem 0.45rem; border-radius: 0.35rem;">🗓️ Fecha: ${safeHTML(note.dueDate)}</span>` : ''}
                    </div>
                    <span style="font-size: 0.72rem; color: #94a3b8; font-weight: 600;">
                        ${formatDateTime ? formatDateTime(note.createdAt) : note.createdAt?.slice(0, 16)}
                    </span>
                </div>

                <!-- Cuerpo de Tarjeta -->
                <div style="margin-bottom: 0.75rem;">
                    ${note.clientName ? `
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                            <strong style="color: #0f172a; font-size: 1rem; font-weight: 900;">👤 ${safeHTML(note.clientName)}</strong>
                            ${note.clientPhone ? `<span style="font-size: 0.8rem; color: #64748b; font-family: monospace;">📞 ${safeHTML(note.clientPhone)}</span>` : ''}
                        </div>
                    ` : ''}

                    <p style="margin: 0; font-size: 0.95rem; color: ${isCompleted ? '#94a3b8' : '#1e293b'}; font-weight: 700; ${isCompleted ? 'text-decoration: line-through;' : ''} line-height: 1.4;">
                        ${safeHTML(note.text)}
                    </p>

                    ${note.reservationDeposit > 0 ? `
                        <div style="margin-top: 0.35rem;">
                            <span style="background: #dcfce7; color: #15803d; font-weight: 800; font-size: 0.75rem; padding: 0.15rem 0.5rem; border-radius: 0.35rem;">
                                💰 Dejó Abono: ${formatCLP ? formatCLP(note.reservationDeposit) : '$' + note.reservationDeposit}
                            </span>
                        </div>
                    ` : ''}

                    ${isCompleted ? `
                        <div style="margin-top: 0.4rem; font-size: 0.75rem; color: #16a34a; font-weight: 750;">
                            ✓ Completado el ${formatDateTime ? formatDateTime(note.completedAt) : note.completedAt?.slice(0, 16)} por ${safeHTML(note.completedBy || 'Mostrador')}
                        </div>
                    ` : ''}
                </div>

                <!-- Botonera de Acciones -->
                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f1f5f9; padding-top: 0.6rem; flex-wrap: wrap; gap: 0.5rem;">
                    <div>
                        ${!isCompleted ? `
                            <button type="button" 
                                    class="btn btn-sm" 
                                    onclick="NotesModal.completeNote('${note.uuid || note.id}')"
                                    style="background: #10b981; color: white; font-weight: 900; font-size: 0.8rem; border-radius: 0.5rem; padding: 0.35rem 0.85rem; border: none; cursor: pointer;">
                                ${cat === 'bottle' ? '✓ Envases Devueltos' : cat === 'reservation' ? '✓ Entregar Reserva' : '✓ Completar Tarea'}
                            </button>
                        ` : `
                            <button type="button" 
                                    class="btn btn-sm btn-secondary" 
                                    onclick="NotesModal.restoreNote('${note.uuid || note.id}')"
                                    style="font-weight: 800; font-size: 0.78rem; border-radius: 0.5rem; padding: 0.35rem 0.75rem;">
                                ↩️ Restaurar a Pendiente
                            </button>
                        `}
                    </div>

                    <div style="display: flex; gap: 0.4rem; align-items: center;">
                        ${note.clientPhone ? `
                            <button type="button" 
                                    class="btn btn-sm" 
                                    onclick="NotesModal.openWhatsApp('${safeHTML(note.clientPhone)}', '${safeHTML(note.clientName)}', '${cat}', '${safeHTML(note.text)}')"
                                    style="background: #25d366; color: white; font-weight: 800; font-size: 0.78rem; border-radius: 0.5rem; padding: 0.35rem 0.65rem; border: none; cursor: pointer;"
                                    title="Enviar recordatorio por WhatsApp">
                                💬 WhatsApp
                            </button>
                        ` : ''}

                        <button type="button" 
                                class="btn btn-sm" 
                                onclick="NotesModal.deleteNote('${note.uuid || note.id}')"
                                style="background: transparent; color: #ef4444; font-size: 1rem; border: none; cursor: pointer; padding: 0.2rem 0.4rem; border-radius: 0.4rem;"
                                title="Eliminar definitivamente">
                            🗑️
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    switchTab(tab) {
        this.currentTab = tab;
        this.renderModal();
    },

    toggleForm(force) {
        this.isFormOpen = (force !== undefined) ? force : !this.isFormOpen;
        this.renderModal();
    },

    changeFormCategory(cat) {
        this.selectedCategoryForm = cat;
        this.renderModal();
    },

    handleSearch(term) {
        this.searchTerm = term;
        this.renderModal();
        const input = document.getElementById('notesSearchInput');
        if (input) {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
        }
    },

    saveNoteFromForm() {
        const cat = this.selectedCategoryForm;
        let data = { category: cat };

        if (cat === 'bottle') {
            const nameEl = document.getElementById('noteFormClientName');
            const phoneEl = document.getElementById('noteFormClientPhone');
            const detailEl = document.getElementById('noteFormBottleDetail');
            const countEl = document.getElementById('noteFormBottleCount');
            const dateEl = document.getElementById('noteFormDueDate');

            if (!nameEl || !nameEl.value.trim()) return showNotification('Ingresa el nombre del cliente', 'warning');
            if (!detailEl || !detailEl.value.trim()) return showNotification('Ingresa el detalle de los envases prestados', 'warning');

            data.clientName = nameEl.value.trim();
            data.clientPhone = phoneEl ? phoneEl.value.trim() : '';
            data.bottleDetail = detailEl.value.trim();
            data.bottleCount = parseInt(countEl?.value) || 1;
            data.dueDate = dateEl ? dateEl.value : '';
            data.text = `Debe ${data.bottleCount} envase(s) (${data.bottleDetail})`;
        } else if (cat === 'reservation') {
            const nameEl = document.getElementById('noteFormClientName');
            const phoneEl = document.getElementById('noteFormClientPhone');
            const detailEl = document.getElementById('noteFormReservationDetail');
            const depositEl = document.getElementById('noteFormReservationDeposit');
            const timeEl = document.getElementById('noteFormDueTime');

            if (!nameEl || !nameEl.value.trim()) return showNotification('Ingresa el nombre del cliente', 'warning');
            if (!detailEl || !detailEl.value.trim()) return showNotification('Ingresa el producto y cantidad reservada', 'warning');

            data.clientName = nameEl.value.trim();
            data.clientPhone = phoneEl ? phoneEl.value.trim() : '';
            data.reservationDetail = detailEl.value.trim();
            data.reservationDeposit = parseFloat(depositEl?.value) || 0;
            data.dueTime = timeEl ? timeEl.value : '';
            data.text = `Reserva de ${data.reservationDetail}`;
        } else if (cat === 'task') {
            const textEl = document.getElementById('noteFormText');
            const assignEl = document.getElementById('noteFormAssignedTo');
            const timeEl = document.getElementById('noteFormDueTime');

            if (!textEl || !textEl.value.trim()) return showNotification('Escribe la tarea a realizar', 'warning');

            data.text = textEl.value.trim();
            data.assignedTo = assignEl ? assignEl.value : 'Todos';
            data.dueTime = timeEl ? timeEl.value : '';
        } else {
            const textEl = document.getElementById('noteFormText');
            if (!textEl || !textEl.value.trim()) return showNotification('Escribe el texto de la nota', 'warning');
            data.text = textEl.value.trim();
        }

        NotesService.addNote(data);
        this.isFormOpen = false;
        this.renderModal();
    },

    completeNote(noteId) {
        let author = 'Usuario';
        if (typeof AuthManager !== 'undefined' && typeof AuthManager.getCurrentUser === 'function') {
            const u = AuthManager.getCurrentUser();
            author = u?.username || 'Usuario';
        }
        NotesService.completeNote(noteId, author);
        this.renderModal();
    },

    restoreNote(noteId) {
        NotesService.restoreNote(noteId);
        this.renderModal();
    },

    deleteNote(noteId) {
        if (confirm('¿Deseas eliminar definitivamente este registro?')) {
            NotesService.deleteNote(noteId);
            this.renderModal();
        }
    },

    openWhatsApp(phone, clientName, cat, text) {
        let cleanPhone = phone.replace(/[^0-9]/g, '');
        if (!cleanPhone.startsWith('56') && cleanPhone.length === 9) {
            cleanPhone = '56' + cleanPhone;
        }

        let msg = '';
        if (cat === 'bottle') {
            msg = `Hola ${clientName}, te escribimos de Caja Fácil para recordarte cordialmente sobre los envases retornables que tienes pendientes de devolución (${text}). ¡Muchas gracias!`;
        } else if (cat === 'reservation') {
            msg = `Hola ${clientName}, te escribimos de Caja Fácil para avisarte que tu encargo (${text}) ya está listo para ser retirado. ¡Te esperamos!`;
        } else {
            msg = `Hola ${clientName}, te escribimos de Caja Fácil respecto a: ${text}.`;
        }

        window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    }
};

if (typeof window !== 'undefined') {
    window.NotesService = NotesService;
    window.NotesModal = NotesModal;
}
