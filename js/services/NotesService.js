/**
 * NotesService.js - Gestor de Notas del Mostrador y Tareas de Personal (Caja Fácil)
 * Soporta modo local offline y preparación para notificaciones en tiempo real en Plan Pro.
 */
const NotesService = {
    getStorageKey() {
        const bid = (typeof localStorage !== 'undefined' ? localStorage.getItem('BUSINESS_ID') : null) || 1;
        return `CF_NOTES_BIZ_${bid}`;
    },

    getAll() {
        try {
            const raw = localStorage.getItem(this.getStorageKey());
            if (!raw) return [];
            const notes = JSON.parse(raw);
            if (!Array.isArray(notes)) return [];

            // Ordenar: pendientes primero (cronológico), completadas al final
            return notes.sort((a, b) => {
                if (a.isCompleted !== b.isCompleted) {
                    return a.isCompleted ? 1 : -1;
                }
                return new Date(b.createdAt) - new Date(a.createdAt);
            });
        } catch (e) {
            console.warn('[NotesService] Error leyendo notas:', e.message);
            return [];
        }
    },

    getPendingCount() {
        const notes = this.getAll();
        return notes.filter(n => !n.isCompleted).length;
    },

    getCounts() {
        const notes = this.getAll();
        return {
            totalPending: notes.filter(n => !n.isCompleted).length,
            pendingOrders: notes.filter(n => !n.isCompleted && n.category === 'order').length,
            pendingTasks: notes.filter(n => !n.isCompleted && n.category === 'task').length
        };
    },

    addNote({ text, category = 'order', time = '', isTask = false, createdBy = null }) {
        if (!text || !text.trim()) return null;
        const notes = this.getAll();

        let author = createdBy;
        if (!author && typeof AuthManager !== 'undefined' && typeof AuthManager.getCurrentUser === 'function') {
            const u = AuthManager.getCurrentUser();
            author = u?.username || 'Dueño';
        }
        if (!author) author = 'Mostrador';

        const newNote = {
            id: 'note_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6),
            text: text.trim(),
            category: category === 'task' ? 'task' : 'order',
            time: time ? time.trim() : '',
            isCompleted: false,
            completedAt: null,
            isTask: !!isTask || category === 'task',
            createdBy: author,
            createdAt: new Date().toISOString()
        };

        notes.unshift(newNote);
        this._save(notes);

        // Si es una tarea asignada con hora o aviso y estamos en runtime, notificar si corresponde
        if (newNote.isTask && typeof showNotification === 'function') {
            showNotification(`📝 Nueva tarea anotada: "${newNote.text}"`, 'info');
        }

        return newNote;
    },

    toggleNote(noteId) {
        const notes = this.getAll();
        const note = notes.find(n => n.id === noteId);
        if (!note) return null;

        note.isCompleted = !note.isCompleted;
        note.completedAt = note.isCompleted ? new Date().toISOString() : null;

        this._save(notes);
        return note;
    },

    deleteNote(noteId) {
        let notes = this.getAll();
        notes = notes.filter(n => n.id !== noteId);
        this._save(notes);
        return true;
    },

    _save(notes) {
        try {
            localStorage.setItem(this.getStorageKey(), JSON.stringify(notes));
        } catch (e) {
            console.error('[NotesService] Error guardando notas:', e.message);
        }
    }
};

if (typeof window !== 'undefined') {
    window.NotesService = NotesService;
}
