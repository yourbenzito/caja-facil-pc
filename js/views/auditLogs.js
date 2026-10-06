const AuditLogsView = {
    async render() {
        if (!PermissionService.check('nav.auditLogs', 'ver registros de auditoría')) {
            return `
                <div class="view-header">
                    <h1>🕵️ Auditoría</h1>
                </div>
                <div class="card">
                    <div class="empty-state" style="color: var(--danger);">No tienes permisos para ver el registro de auditoría.</div>
                </div>
            `;
        }

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const start = thirtyDaysAgo.toISOString();
        const end = new Date().toISOString();
        // Carga rápida: solo los últimos 30 días para evitar lag extremo
        const logs = await db.getByIndexRange('auditLogs', 'timestamp', start, end);
        logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Group actions
        const actionCounts = { total: logs.length, delete: 0, edit: 0, login: 0 };
        logs.forEach(l => {
            if (l.action === 'delete' || l.action === 'void') actionCounts.delete++;
            if (l.action === 'update' || l.action === 'edit') actionCounts.edit++;
            if (l.action === 'login') actionCounts.login++;
        });

        return `
            <div class="view-header">
                <h1>🕵️ Registro del Sistema (Auditoría)</h1>
                <p>Historial inalterable de movimientos, eliminaciones y sesiones.</p>
            </div>
            
            <div class="grid grid-4" style="margin-bottom: 1.5rem;">
                <div class="stat-card">
                    <h3>Registros Totales</h3>
                    <div class="value">${actionCounts.total}</div>
                </div>
                <div class="stat-card">
                    <h3>Eliminaciones Críticas</h3>
                    <div class="value" style="color: var(--danger);">${actionCounts.delete}</div>
                </div>
                <div class="stat-card">
                    <h3>Ediciones</h3>
                    <div class="value" style="color: var(--warning);">${actionCounts.edit}</div>
                </div>
                <div class="stat-card">
                    <h3>Inicios de Sesión</h3>
                    <div class="value" style="color: var(--info);">${actionCounts.login}</div>
                </div>
            </div>

            <div class="card" style="margin-bottom: 2rem;">
                <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; gap: 1rem;">
                    <h3 style="margin: 0;">Detalle de Movimientos</h3>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <input type="text" id="auditSearchFilter" class="form-control" placeholder="Buscar por usuario o detalle..." oninput="AuditLogsView.filterLogs()" style="min-width: 200px;">
                        <input type="date" id="auditDateFilter" class="form-control" onchange="AuditLogsView.filterLogs()">
                        <select id="auditEntityFilter" class="form-control" onchange="AuditLogsView.filterLogs()">
                            <option value="">Todas las entidades</option>
                            <option value="sale">Ventas</option>
                            <option value="product">Productos</option>
                            <option value="cash">Caja</option>
                            <option value="auth">Accesos</option>
                            <option value="backup">Backup</option>
                        </select>
                        <select id="auditActionFilter" class="form-control" onchange="AuditLogsView.filterLogs()">
                            <option value="">Todas las acciones</option>
                            <option value="delete">Eliminaciones</option>
                            <option value="create">Creaciones</option>
                            <option value="update">Modificaciones</option>
                            <option value="login">Logins</option>
                        </select>
                    </div>
                </div>
                
                <div class="table-container">
                    <table id="auditLogsTable" style="font-size: 0.9rem;">
                        <thead>
                            <tr>
                                <th>Fecha y Hora</th>
                                <th>Usuario</th>
                                <th>Entidad</th>
                                <th>Acción</th>
                                <th>Detalle</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.renderLogsList(logs)}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    renderLogsList(logs) {
        if (logs.length === 0) {
            return `<tr><td colspan="5" class="text-center" style="padding: 2rem;">No hay registros de auditoría</td></tr>`;
        }

        return logs.map(log => {
            const date = new Date(log.timestamp);
            const userStr = log.username || (log.userId ? `Usuario ${log.userId}` : 'Sistema');
            const entityLabels = { sale: 'Venta', product: 'Producto', auth: 'App', cash: 'Caja', backup: 'Backup' };
            const entityDisplay = entityLabels[log.entity] || log.entity;

            let actionBadgeClass = 'badge-secondary';
            if (['delete', 'void'].includes(log.action)) actionBadgeClass = 'badge-danger';
            else if (['create', 'import'].includes(log.action)) actionBadgeClass = 'badge-success';
            else if (['update', 'edit', 'adjust'].includes(log.action)) actionBadgeClass = 'badge-warning';
            else if (['login', 'logout'].includes(log.action)) actionBadgeClass = 'badge-info';

            const searchIndex = `${userStr.toLowerCase()} ${log.summary.toLowerCase()} ${log.action.toLowerCase()} ${log.entity.toLowerCase()}`;

            return `
                <tr class="audit-log-row" 
                    data-date="${date.toISOString().split('T')[0]}" 
                    data-entity="${log.entity.toLowerCase()}"
                    data-action="${log.action.toLowerCase()}"
                    data-search="${searchIndex}">
                    <td style="white-space: nowrap;">${formatDateTime(log.timestamp)}</td>
                    <td><strong>${userStr}</strong></td>
                    <td>${entityDisplay}</td>
                    <td><span class="badge ${actionBadgeClass}">${log.action.toUpperCase()}</span></td>
                    <td>
                        <div style="font-weight: 500; margin-bottom: 0.25rem;">${log.summary}</div>
                        ${log.metadata && log.metadata.changes ? `
                            <div style="display: flex; flex-direction: column; gap: 0.4rem; margin-top: 0.5rem; background: rgba(255,255,255,0.03); padding: 0.75rem; border-radius: 0.6rem; border: 1px solid rgba(255,255,255,0.05);">
                                ${Object.values(log.metadata.changes).map(change => {
                const isPrice = change.label?.toLowerCase().includes('precio') || change.label?.toLowerCase().includes('costo');
                const formatValue = (val) => {
                    if (val === null || val === undefined || val === '') return '<em style="opacity: 0.4;">vacio</em>';
                    if (isPrice && !isNaN(val)) return `<strong>${formatCLP(val)}</strong>`;
                    return `<strong>${val}</strong>`;
                };
                return `
                                        <div style="font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem;">
                                            <span style="color: var(--secondary); min-width: 100px;">${change.label}:</span>
                                            <span style="color: #f87171; text-decoration: line-through; opacity: 0.6; font-size: 0.8rem;">${formatValue(change.old)}</span>
                                            <span style="color: var(--secondary); opacity: 0.5;">➜</span>
                                            <span style="color: #4ade80;">${formatValue(change.new)}</span>
                                        </div>
                                    `;
            }).join('')}
                            </div>
                        ` : ''}
                        ${log.metadata && !log.metadata.changes ? `
                            <button class="btn btn-sm btn-secondary" style="margin-top: 0.4rem; padding: 0.1rem 0.4rem; font-size: 0.7rem; opacity: 0.7;" onclick="AuditLogsView.showDetails(${log.id})">
                                🔍 Ver Metadata JSON
                            </button>
                        ` : ''}
                    </td>
                </tr>
            `;
        }).join('');
    },

    filterLogs() {
        const searchFilter = document.getElementById('auditSearchFilter').value.toLowerCase();
        const dateFilter = document.getElementById('auditDateFilter').value;
        const entityFilter = document.getElementById('auditEntityFilter').value.toLowerCase();
        const actionFilter = document.getElementById('auditActionFilter').value.toLowerCase();

        const rows = document.querySelectorAll('.audit-log-row');

        rows.forEach(row => {
            const rowDate = row.dataset.date;
            const rowEntity = row.dataset.entity;
            const rowAction = row.dataset.action;
            const rowSearch = row.dataset.search;

            const matchSearch = !searchFilter || rowSearch.includes(searchFilter);
            const matchDate = !dateFilter || rowDate === dateFilter;
            const matchEntity = !entityFilter || rowEntity.includes(entityFilter);

            // For general 'delete' filter, match 'void' or 'delete'. For 'update', match 'edit', 'adjust' too.
            let matchAction = true;
            if (actionFilter) {
                if (actionFilter === 'delete') matchAction = rowAction === 'delete' || rowAction === 'void';
                else if (actionFilter === 'update') matchAction = rowAction === 'update' || rowAction === 'edit' || rowAction === 'adjust';
                else if (actionFilter === 'create') matchAction = rowAction === 'create' || rowAction === 'import';
                else matchAction = rowAction.includes(actionFilter);
            }

            if (matchSearch && matchDate && matchEntity && matchAction) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    },

    async showDetails(logId) {
        try {
            const log = await db.get('auditLogs', parseInt(logId));
            if (!log || !log.metadata) return;

            let metaHtml = '<pre style="background: var(--light); padding: 1rem; border-radius: 0.5rem; overflow-x: auto; font-size: 0.85rem; max-height: 400px; overflow-y: auto;">';
            metaHtml += JSON.stringify(log.metadata, null, 2);
            metaHtml += '</pre>';

            showModal(metaHtml, { title: 'Detalles del Registro', width: '600px' });
        } catch (e) {
            showNotification('Error visualizando registro', 'error');
        }
    }
};
