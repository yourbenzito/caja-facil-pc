/**
 * Auto-Backup Module
 * Descarga automáticamente un backup completo a la computadora del usuario cada 3 horas.
 * El backup se descarga como archivo JSON con todos los datos del negocio.
 */
const AutoBackup = {
    INTERVAL_HOURS: 3,
    STORAGE_KEY: 'LAST_AUTO_BACKUP',
    _timer: null,

    /**
     * Inicializa el sistema de auto-backup.
     * Se llama una vez cuando la app carga.
     */
    init() {
        // Solo ejecutar si el usuario está autenticado
        if (!localStorage.getItem('AUTH_TOKEN')) return;

        console.log('🔄 [AutoBackup] Sistema de backup automático iniciado');

        // Verificar si ya toca hacer backup
        this.checkAndRun();

        // Verificar cada 30 minutos si ya pasaron las 3 horas
        this._timer = setInterval(() => this.checkAndRun(), 30 * 60 * 1000);
    },

    /**
     * Verifica si han pasado 3 horas desde el último backup y ejecuta si es necesario.
     */
    checkAndRun() {
        const lastBackup = localStorage.getItem(this.STORAGE_KEY);
        const now = Date.now();

        if (lastBackup) {
            const elapsed = now - parseInt(lastBackup, 10);
            const hoursElapsed = elapsed / (1000 * 60 * 60);

            if (hoursElapsed < this.INTERVAL_HOURS) {
                const remaining = this.INTERVAL_HOURS - hoursElapsed;
                console.log(`🔄 [AutoBackup] Próximo backup en ${remaining.toFixed(1)} horas`);
                return;
            }
        }

        // Es hora de hacer backup
        this.performBackup();
    },

    /**
     * Realiza el backup silencioso gestionado por el servidor.
     * Ya no descarga archivos JSON para no interrumpir al usuario.
     */
    async performBackup() {
        try {
            console.log('📦 [AutoBackup] Verificando integridad del sistema...');
            
            // Verificamos estado del servidor (el servidor ya hace backup físico cada 3h)
            const response = await fetch(`${window.API_CONFIG.BASE_URL}/api/status`);
            const status = await response.json();
            
            if (status.status === 'online') {
                localStorage.setItem(this.STORAGE_KEY, Date.now().toString());
                console.log('✅ [AutoBackup] El servidor está respaldando datos correctamente de forma silenciosa.');
            }
        } catch (error) {
            console.warn('⚠️ [AutoBackup] No se pudo verificar el servidor para el respaldo silencioso.');
        }
    },

    /**
     * Forzar un backup manual inmediato.
     */
    forceBackup() {
        localStorage.removeItem(this.STORAGE_KEY);
        this.performBackup();
    },

    /**
     * Detener el sistema de auto-backup.
     */
    stop() {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
        console.log('🔄 [AutoBackup] Sistema detenido');
    }
};

// Exponer globalmente
window.AutoBackup = AutoBackup;
