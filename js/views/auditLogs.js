const AuditLogsView = {
    currentLogs: [],
    currentFilter: 'all',

    ENTITY_LABELS: {
        sale: 'Venta',
        product: 'Producto',
        auth: 'Acceso y Seguridad',
        cash: 'Caja Registradora',
        backup: 'Copia de Seguridad',
        inventory: 'Inventario',
        product_stock: 'Ajuste de Stock',
        category_audit: 'Auditoría de Conteo',
        supplierPayment: 'Pago a Proveedor',
        purchase: 'Compra a Proveedor',
        supplier: 'Proveedor',
        customer: 'Cliente',
        expense: 'Gasto Operativo',
        cashMovement: 'Movimiento de Caja'
    },

    ACTION_LABELS: {
        create: 'Creación / Registro',
        update: 'Modificación',
        edit: 'Modificación',
        delete: 'Eliminación',
        softDelete: 'Desactivación',
        restore: 'Restauración',
        void: 'Anulación',
        login: 'Inicio de Sesión',
        logout: 'Cierre de Sesión',
        import: 'Importación',
        adjust: 'Ajuste de Stock',
        finish: 'Finalización de Conteo',
        MANUAL_STOCK_ADJUSTMENT: 'Ajuste Manual de Stock',
        REGISTER_LOSS_BULK: 'Registro de Mermas/Pérdidas',
        REGISTER_CONSUMPTION_BULK: 'Registro de Consumo del Local'
    },

    async render() {
        if (!PermissionService.check('nav.auditLogs', 'ver registros de auditoría')) {
            return `
                <div class="view-header">
                    <h1>🛡️ Centro de Auditoría y Seguridad</h1>
                </div>
                <div class="card" style="padding: 2.5rem; text-align: center; background: #fff; border-radius: 1rem; border: 1.5px dashed #fca5a5;">
                    <div style="font-size: 3rem; margin-bottom: 0.75rem;">🔒</div>
                    <h3 style="color: #991b1b; font-weight: 800; margin-bottom: 0.5rem;">Acceso Restringido</h3>
                    <p style="color: #64748b; margin: 0;">No tienes los permisos necesarios para visualizar el registro de auditoría del sistema.</p>
                </div>
            `;
        }

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const start = thirtyDaysAgo.toISOString();
        const end = new Date().toISOString();

        // Carga rápida: últimos 30 días
        const logs = await db.getByIndexRange('auditLogs', 'timestamp', start, end);
        logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        this.currentLogs = logs;

        // Métricas de riesgo y conteos
        let totalCount = logs.length;
        let deleteCount = 0;
        let priceCount = 0;
        let loginCount = 0;
        const usersSet = new Set();

        logs.forEach(l => {
            if (l.username) usersSet.add(l.username);
            else if (l.userId) usersSet.add(`Usuario #${l.userId}`);

            const act = (l.action || '').toLowerCase();
            const ent = (l.entity || '').toLowerCase();
            const sum = (l.summary || '').toLowerCase();

            if (act === 'delete' || act === 'void' || sum.includes('anul') || sum.includes('elimin')) {
                deleteCount++;
            } else if (act === 'login' || act === 'logout' || ent === 'auth') {
                loginCount++;
            } else if (sum.includes('precio') || sum.includes('costo') || (l.metadata && l.metadata.changes && this.normalizeChanges(l.metadata.changes).some(c => (c.label || '').toLowerCase().includes('precio') || (c.label || '').toLowerCase().includes('costo')))) {
                priceCount++;
            }
        });

        const usersList = Array.from(usersSet);

        return `
            <style>
                .audit-kpi-card {
                    background: #ffffff;
                    border-radius: 1rem;
                    padding: 1.25rem 1.5rem;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.04);
                    border: 1.5px solid #e2e8f0;
                    display: flex;
                    flex-direction: column;
                    gap: 0.35rem;
                    position: relative;
                    overflow: hidden;
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .audit-kpi-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 16px rgba(0,0,0,0.06);
                }
                .audit-kpi-card.danger {
                    background: #fef2f2;
                    border-color: #fecaca;
                }
                .audit-kpi-card.warning {
                    background: #fffbeb;
                    border-color: #fde68a;
                }
                .audit-kpi-card.info {
                    background: #eef2ff;
                    border-color: #c7d2fe;
                }
                .audit-chip-btn {
                    padding: 0.45rem 1rem;
                    border-radius: 2rem;
                    font-size: 0.85rem;
                    font-weight: 800;
                    background: #f1f5f9;
                    color: #475569;
                    border: 1.5px solid transparent;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.35rem;
                }
                .audit-chip-btn:hover {
                    background: #e2e8f0;
                    color: #1e293b;
                }
                .audit-chip-btn.active {
                    background: #1e293b;
                    color: #ffffff;
                    box-shadow: 0 4px 12px rgba(30, 41, 59, 0.25);
                }
                .audit-chip-btn.active-danger {
                    background: #ef4444;
                    color: #ffffff;
                    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
                }
                .audit-chip-btn.active-warning {
                    background: #d97706;
                    color: #ffffff;
                    box-shadow: 0 4px 12px rgba(217, 119, 6, 0.3);
                }
                .audit-chip-btn.active-info {
                    background: #4f46e5;
                    color: #ffffff;
                    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
                }
                .audit-row-item {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 0.75rem;
                    padding: 0.85rem 1.15rem;
                    display: grid;
                    grid-template-columns: 140px 140px 100px 1fr auto;
                    align-items: center;
                    gap: 1rem;
                    transition: all 0.2s;
                }
                .audit-row-item:hover {
                    background: #f8fafc;
                    border-color: #cbd5e1;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.03);
                }
                .audit-row-item.row-critical {
                    border-left: 5px solid #ef4444;
                    background: #fffafa;
                }
                .audit-row-item.row-warning {
                    border-left: 5px solid #f59e0b;
                }
                .audit-row-item.row-login {
                    border-left: 5px solid #6366f1;
                }
                .audit-row-item.row-success {
                    border-left: 5px solid #10b981;
                }
                @media (max-width: 900px) {
                    .audit-row-item {
                        grid-template-columns: 1fr;
                        gap: 0.5rem;
                    }
                }
            </style>

            <!-- Cabecera Ejecutiva -->
            <div class="view-header" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
                <div>
                    <h1 style="margin: 0; font-size: 1.75rem; font-weight: 900; color: #0f172a; display: flex; align-items: center; gap: 0.5rem;">
                        <span>🛡️</span> <span>Centro de Auditoría y Seguridad</span>
                    </h1>
                    <p style="margin: 0.35rem 0 0 0; color: #64748b; font-size: 0.95rem;">
                        Trazabilidad inalterable de operaciones, control de accesos y prevención de pérdidas
                    </p>
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                    <button type="button" class="btn btn-sm" onclick="AuditLogsView.exportAuditPDF()" style="display: flex; align-items: center; gap: 0.4rem; font-weight: 800; background: #fef2f2; border: 1.5px solid #fecaca; color: #dc2626; border-radius: 0.5rem; padding: 0.5rem 0.9rem; cursor: pointer; transition: all 0.2s;" title="Descargar informe de auditoría y seguridad en PDF">
                        <span>📄</span> <span>Informe Seguridad (PDF)</span>
                    </button>
                    <button type="button" class="btn btn-sm" onclick="AuditLogsView.exportAuditExcel()" style="display: flex; align-items: center; gap: 0.4rem; font-weight: 800; background: #ecfdf5; border: 1.5px solid #a7f3d0; color: #047857; border-radius: 0.5rem; padding: 0.5rem 0.9rem; cursor: pointer; transition: all 0.2s;" title="Exportar trazabilidad completa a Excel">
                        <span>📊</span> <span>Exportar Excel</span>
                    </button>
                    <button type="button" class="btn btn-sm" onclick="AuditLogsView.refresh()" style="display: flex; align-items: center; gap: 0.4rem; font-weight: 800; background: #f8fafc; border: 1.5px solid #cbd5e1; color: #334155; border-radius: 0.5rem; padding: 0.5rem 0.9rem; cursor: pointer; transition: all 0.2s;" title="Recargar eventos recientes">
                        <span>🔄</span> <span>Actualizar</span>
                    </button>
                </div>
            </div>

            <!-- KPIs de Seguridad -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                <div class="audit-kpi-card">
                    <span style="font-size: 0.75rem; font-weight: 800; color: #64748b; text-transform: uppercase;">Total de Registros</span>
                    <strong style="font-size: 1.75rem; font-weight: 950; color: #1e293b; margin: 0.15rem 0;">${totalCount}</strong>
                    <small style="font-size: 0.75rem; color: #94a3b8; font-weight: 600;">Últimos 30 días de actividad</small>
                </div>
                <div class="audit-kpi-card danger">
                    <span style="font-size: 0.75rem; font-weight: 800; color: #b91c1c; text-transform: uppercase;">🚨 Eliminaciones Críticas</span>
                    <strong style="font-size: 1.75rem; font-weight: 950; color: #dc2626; margin: 0.15rem 0;">${deleteCount}</strong>
                    <small style="font-size: 0.75rem; color: #ef4444; font-weight: 700;">Ventas o productos anulados</small>
                </div>
                <div class="audit-kpi-card warning">
                    <span style="font-size: 0.75rem; font-weight: 800; color: #b45309; text-transform: uppercase;">⚠️ Modificaciones de Precios</span>
                    <strong style="font-size: 1.75rem; font-weight: 950; color: #d97706; margin: 0.15rem 0;">${priceCount}</strong>
                    <small style="font-size: 0.75rem; color: #b45309; font-weight: 700;">Alteración de costos / precios</small>
                </div>
                <div class="audit-kpi-card info">
                    <span style="font-size: 0.75rem; font-weight: 800; color: #4338ca; text-transform: uppercase;">🔐 Inicios de Sesión</span>
                    <strong style="font-size: 1.75rem; font-weight: 950; color: #4f46e5; margin: 0.15rem 0;">${loginCount}</strong>
                    <small style="font-size: 0.75rem; color: #6366f1; font-weight: 700;">Accesos a la terminal</small>
                </div>
            </div>

            <!-- Panel de Filtros & Chips Táctiles -->
            <div style="background: #ffffff; border-radius: 1rem; border: 1px solid #e2e8f0; padding: 1.25rem; margin-bottom: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.03); display: flex; flex-direction: column; gap: 1rem;">
                
                <!-- Buscador & Filtro Empleado / Fecha -->
                <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center;">
                    <div style="flex: 2; min-width: 250px;">
                        <input type="text" id="auditSearchFilter" class="form-control" 
                               placeholder="🔍 Buscar por empleado, producto, detalle, folio..." 
                               oninput="AuditLogsView.filterLogs()" 
                               style="height: 42px; border-radius: 0.5rem; border: 1.5px solid #cbd5e1; font-size: 0.9rem; width: 100%;">
                    </div>
                    
                    <div style="flex: 1; min-width: 170px;">
                        <select id="auditUserFilter" class="form-control" onchange="AuditLogsView.filterLogs()" style="height: 42px; border-radius: 0.5rem; border: 1.5px solid #cbd5e1; font-size: 0.88rem; font-weight: 600;">
                            <option value="">👤 Todos los Empleados</option>
                            ${usersList.map(u => `<option value="${safeHTML(u.toLowerCase())}">👤 ${safeHTML(u)}</option>`).join('')}
                        </select>
                    </div>

                    <div style="flex: 1; min-width: 150px;">
                        <input type="date" id="auditDateFilter" class="form-control" onchange="AuditLogsView.filterLogs()" style="height: 42px; border-radius: 0.5rem; border: 1.5px solid #cbd5e1; font-size: 0.88rem;">
                    </div>

                    <button type="button" class="btn btn-secondary" onclick="AuditLogsView.clearFilters()" style="height: 42px; font-weight: 750; border-radius: 0.5rem; padding: 0 1rem;" title="Limpiar todos los filtros">
                        Limpiar
                    </button>
                </div>

                <!-- Chips Rápidos -->
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; border-top: 1px solid #f1f5f9; padding-top: 0.75rem;">
                    <span style="font-size: 0.75rem; font-weight: 800; color: #64748b; text-transform: uppercase; margin-right: 0.25rem;">Filtrar Tipo:</span>
                    <button type="button" class="audit-chip-btn ${this.currentFilter === 'all' ? 'active' : ''}" onclick="AuditLogsView.setChipFilter('all')">
                        Todos
                    </button>
                    <button type="button" class="audit-chip-btn ${this.currentFilter === 'delete' ? 'active-danger' : ''}" onclick="AuditLogsView.setChipFilter('delete')">
                        🚨 Eliminaciones
                    </button>
                    <button type="button" class="audit-chip-btn ${this.currentFilter === 'price' ? 'active-warning' : ''}" onclick="AuditLogsView.setChipFilter('price')">
                        🏷️ Cambios de Precios
                    </button>
                    <button type="button" class="audit-chip-btn ${this.currentFilter === 'inventory' ? 'active-warning' : ''}" onclick="AuditLogsView.setChipFilter('inventory')">
                        📦 Ajustes de Stock
                    </button>
                    <button type="button" class="audit-chip-btn ${this.currentFilter === 'login' ? 'active-info' : ''}" onclick="AuditLogsView.setChipFilter('login')">
                        🔐 Accesos / Logins
                    </button>
                </div>
            </div>

            <!-- Bitácora de Eventos -->
            <div style="background: #ffffff; border-radius: 1rem; border: 1px solid #e2e8f0; padding: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3 style="margin: 0; font-size: 1.05rem; font-weight: 850; color: #0f172a;">
                        Bitácora Inalterable de Movimientos
                    </h3>
                    <span id="auditCountLabel" style="font-size: 0.82rem; font-weight: 700; color: #64748b;">
                        Mostrando ${logs.length} registro(s)
                    </span>
                </div>

                <div id="auditLogsContainer" style="display: flex; flex-direction: column; gap: 0.5rem;">
                    ${this.renderLogsList(logs)}
                </div>
            </div>
        `;
    },

    setChipFilter(filterType) {
        this.currentFilter = filterType;
        document.querySelectorAll('.audit-chip-btn').forEach(btn => btn.classList.remove('active', 'active-danger', 'active-warning', 'active-info'));
        this.filterLogs();
    },

    clearFilters() {
        this.currentFilter = 'all';
        const searchInput = document.getElementById('auditSearchFilter');
        const userInput = document.getElementById('auditUserFilter');
        const dateInput = document.getElementById('auditDateFilter');
        if (searchInput) searchInput.value = '';
        if (userInput) userInput.value = '';
        if (dateInput) dateInput.value = '';
        this.filterLogs();
    },

    normalizeChanges(rawChanges) {
        if (!rawChanges) return [];
        let data = rawChanges;
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (_) { return [{ label: data, isSimpleBadge: true }]; }
        }

        const FIELD_LABELS = {
            name: 'Nombre del Producto',
            barcode: 'Código de Barras',
            category: 'Categoría',
            price: 'Precio de Venta',
            cost: 'Costo Bruto',
            costNeto: 'Costo Neto',
            stock: 'Stock',
            minStock: 'Stock Mínimo',
            description: 'Descripción',
            ivaType: 'Tipo IVA',
            markupPercent: 'Margen / Markup',
            expiryDate: 'Fecha Vencimiento',
            type: 'Tipo Unidad',
            image: 'Imagen',
            isActive: 'Estado Activo',
            supplierId: 'Proveedor',
            status: 'Estado',
            role: 'Rol de Usuario',
            email: 'Correo',
            phone: 'Teléfono',
            rut: 'RUT / Identificación',
            address: 'Dirección'
        };

        const technicalKeys = new Set(['id', 'updatedby', 'updatedat', 'createdat', 'business_id', 'businessid', 'is_synced', 'last_sync', 'sync_id', 'deletedat']);
        const result = [];
        const isPrimitive = (v) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';

        if (Array.isArray(data)) {
            data.forEach(item => {
                if (!item) return;
                if (typeof item === 'string') {
                    if (technicalKeys.has(item.toLowerCase())) return;
                    result.push({
                        label: FIELD_LABELS[item] || item,
                        isSimpleBadge: true
                    });
                } else if (typeof item === 'object') {
                    const rawKey = item.field || item.key || '';
                    if (technicalKeys.has(rawKey.toLowerCase())) return;
                    const lbl = item.label || FIELD_LABELS[rawKey] || rawKey || 'Campo';
                    if (item.old !== undefined || item.new !== undefined) {
                        const oldStr = item.old != null ? String(item.old).trim() : '';
                        const newStr = item.new != null ? String(item.new).trim() : '';
                        if (oldStr === newStr) return; // Sin cambio real
                        result.push({
                            label: lbl,
                            old: item.old,
                            new: item.new,
                            isSimpleBadge: false
                        });
                    } else {
                        result.push({ label: lbl, isSimpleBadge: true });
                    }
                }
            });
            return result;
        }

        if (typeof data === 'object') {
            for (const [key, val] of Object.entries(data)) {
                if (val === null || val === undefined) continue;
                if (technicalKeys.has(key.toLowerCase())) continue;

                if (typeof val === 'object' && !Array.isArray(val)) {
                    const lbl = val.label || FIELD_LABELS[key] || key;
                    if (val.old !== undefined || val.new !== undefined) {
                        const oldStr = val.old != null ? String(val.old).trim() : '';
                        const newStr = val.new != null ? String(val.new).trim() : '';
                        if (oldStr === newStr) continue; // Sin cambio real
                        result.push({
                            label: lbl,
                            old: val.old,
                            new: val.new,
                            isSimpleBadge: false
                        });
                    } else {
                        result.push({ label: lbl, isSimpleBadge: true });
                    }
                } else if (isPrimitive(val)) {
                    const lbl = FIELD_LABELS[key] || key;
                    result.push({
                        label: `${lbl}: ${val}`,
                        isSimpleBadge: true
                    });
                } else {
                    const lbl = FIELD_LABELS[key] || key;
                    result.push({ label: lbl, isSimpleBadge: true });
                }
            }
        }

        return result;
    },

    renderRowChanges(rawChanges) {
        const changes = this.normalizeChanges(rawChanges);
        if (!changes || changes.length === 0) return '';

        return `
            <div style="display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.35rem;">
                ${changes.map(c => {
                    if (c.isSimpleBadge) {
                        return `
                            <span style="font-size: 0.74rem; background: #f1f5f9; border: 1px solid #cbd5e1; color: #334155; padding: 0.15rem 0.45rem; border-radius: 0.35rem; font-weight: 700; display: inline-flex; align-items: center; gap: 0.25rem;">
                                🏷️ ${safeHTML(c.label)}
                            </span>
                        `;
                    }

                    const isPrice = (c.label || '').toLowerCase().includes('precio') || (c.label || '').toLowerCase().includes('costo') || (c.label || '').toLowerCase().includes('monto');
                    const formatVal = (val) => {
                        if (val === null || val === undefined || val === '') return '<em style="opacity: 0.4;">vacío</em>';
                        if (isPrice && !isNaN(val)) return `<strong>${formatCLP(val)}</strong>`;
                        return `<strong>${safeHTML(String(val))}</strong>`;
                    };

                    return `
                        <div style="font-size: 0.76rem; background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.2rem 0.5rem; border-radius: 0.4rem; display: inline-flex; align-items: center; gap: 0.35rem;">
                            <span style="color: #64748b; font-weight: 750;">${safeHTML(c.label)}:</span>
                            <span style="color: #ef4444; text-decoration: line-through; opacity: 0.75;">${formatVal(c.old)}</span>
                            <span style="color: #94a3b8;">➔</span>
                            <span style="color: #059669; font-weight: 850;">${formatVal(c.new)}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    renderModalChanges(rawChanges) {
        const changes = this.normalizeChanges(rawChanges);
        if (!changes || changes.length === 0) return '';

        const hasComparisons = changes.some(c => !c.isSimpleBadge);

        if (!hasComparisons) {
            return `
                <div style="margin-top: 1rem; border-top: 1px solid #e2e8f0; padding-top: 0.85rem;">
                    <div style="display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.5rem;">
                        <span style="font-size: 0.9rem;">📝</span>
                        <h4 style="margin: 0; font-size: 0.82rem; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.03em;">
                            Campos Modificados en esta Operación:
                        </h4>
                    </div>
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.6rem; padding: 0.75rem;">
                        <p style="margin: 0 0 0.5rem 0; font-size: 0.8rem; color: #64748b;">
                            Se actualizaron los siguientes atributos del registro:
                        </p>
                        <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
                            ${changes.map(c => `
                                <span style="background: #ffffff; border: 1px solid #cbd5e1; color: #1e293b; font-size: 0.8rem; font-weight: 750; padding: 0.25rem 0.6rem; border-radius: 0.4rem; display: inline-flex; align-items: center; gap: 0.3rem;">
                                    🏷️ ${safeHTML(c.label)}
                                </span>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <div style="margin-top: 1rem; border-top: 1px solid #e2e8f0; padding-top: 0.85rem;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.6rem;">
                    <h4 style="margin: 0; font-size: 0.82rem; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.03em;">
                        Valores Modificados (Antes vs. Después):
                    </h4>
                    <span style="font-size: 0.72rem; color: #64748b; font-weight: 600;">${changes.length} campo(s)</span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.45rem;">
                    ${changes.map(c => {
                        if (c.isSimpleBadge) {
                            return `
                                <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.45rem 0.75rem; font-size: 0.82rem;">
                                    <strong style="color: #334155;">🏷️ ${safeHTML(c.label)}</strong>
                                    <span style="color: #64748b; font-style: italic; font-size: 0.75rem;">Actualizado</span>
                                </div>
                            `;
                        }

                        const isPrice = (c.label || '').toLowerCase().includes('precio') || (c.label || '').toLowerCase().includes('costo') || (c.label || '').toLowerCase().includes('monto');
                        const fmt = (v) => {
                            if (v === null || v === undefined || v === '') return '<em style="color: #94a3b8;">vacío</em>';
                            if (isPrice && !isNaN(v)) return `<strong>${formatCLP(v)}</strong>`;
                            return `<strong>${safeHTML(String(v))}</strong>`;
                        };

                        return `
                            <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.85rem;">
                                <strong style="color: #334155;">${safeHTML(c.label)}</strong>
                                <div style="display: flex; align-items: center; gap: 0.6rem;">
                                    <span style="color: #ef4444; text-decoration: line-through; opacity: 0.8;">${fmt(c.old)}</span>
                                    <span style="color: #94a3b8;">➔</span>
                                    <span style="color: #059669; font-weight: 850;">${fmt(c.new)}</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    },

    renderLogsList(logs) {
        if (!logs || logs.length === 0) {
            return `
                <div style="text-align: center; padding: 3rem 1rem; color: #94a3b8; background: #f8fafc; border-radius: 0.75rem; border: 1.5px dashed #cbd5e1;">
                    <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🛡️</div>
                    <strong style="color: #475569; font-size: 1rem; display: block;">No se encontraron eventos</strong>
                    <span style="font-size: 0.85rem;">Prueba limpiando los filtros o seleccionando otro rango de fechas.</span>
                </div>
            `;
        }

        return logs.map(log => {
            const date = new Date(log.timestamp);
            let userStr = log.username || (log.userId ? `Usuario #${log.userId}` : 'Sistema');
            if (userStr && userStr.toLowerCase() === 'sistema') {
                userStr = 'Administrador';
            }
            const entityDisplay = this.ENTITY_LABELS[log.entity] || log.entity || 'General';

            const act = (log.action || '').toLowerCase();
            const sum = (log.summary || '').toLowerCase();

            let rowClass = '';
            let actionBadgeStyle = 'background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;';
            let actionLabel = this.ACTION_LABELS[log.action] || this.ACTION_LABELS[act] || (log.action ? log.action.toUpperCase() : 'EVENTO');

            if (act === 'delete' || act === 'void' || sum.includes('anul') || sum.includes('elimin')) {
                rowClass = 'row-critical';
                actionBadgeStyle = 'background: #fee2e2; color: #991b1b; border: 1.5px solid #fecaca;';
                actionLabel = '🚨 ELIMINACIÓN';
            } else if (sum.includes('precio') || sum.includes('costo')) {
                rowClass = 'row-warning';
                actionBadgeStyle = 'background: #fef3c7; color: #92400e; border: 1.5px solid #fde68a;';
                actionLabel = '🏷️ PRECIO/COSTO';
            } else if (act === 'update' || act === 'edit' || act === 'adjust') {
                rowClass = 'row-warning';
                actionBadgeStyle = 'background: #fffbeb; color: #b45309; border: 1.5px solid #fde68a;';
                actionLabel = '✏️ MODIFICACIÓN';
            } else if (act === 'login' || act === 'logout' || log.entity === 'auth') {
                rowClass = 'row-login';
                actionBadgeStyle = 'background: #eef2ff; color: #3730a3; border: 1.5px solid #c7d2fe;';
                actionLabel = act === 'logout' ? '🚪 SALIDA' : '🔐 INICIO SESIÓN';
            } else if (act === 'create' || act === 'import') {
                rowClass = 'row-success';
                actionBadgeStyle = 'background: #ecfdf5; color: #065f46; border: 1.5px solid #a7f3d0;';
                actionLabel = '➕ REGISTRO';
            }

            const changesList = this.normalizeChanges(log.metadata?.changes);
            const changesSearch = changesList.map(c => c.label).join(' ').toLowerCase();
            const searchIndex = `${userStr.toLowerCase()} ${sum} ${act} ${entityDisplay.toLowerCase()} ${changesSearch}`;

            return `
                <div class="audit-row-item ${rowClass}" 
                     data-date="${date.toISOString().split('T')[0]}" 
                     data-user="${userStr.toLowerCase()}"
                     data-entity="${(log.entity || '').toLowerCase()}"
                     data-action="${act}"
                     data-summary="${sum}"
                     data-search="${safeHTML(searchIndex)}">
                    
                    <!-- Fecha y Hora -->
                    <div style="font-size: 0.82rem; color: #475569; display: flex; flex-direction: column;">
                        <span style="font-weight: 750; color: #0f172a;">${date.toLocaleDateString('es-CL')}</span>
                        <span style="color: #64748b; font-size: 0.78rem;">${date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    </div>

                    <!-- Usuario Responsable -->
                    <div style="display: flex; align-items: center; gap: 0.5rem; overflow: hidden;">
                        <div style="width: 28px; height: 28px; border-radius: 50%; background: #e0e7ff; color: #4338ca; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 800; flex-shrink: 0;">
                            👤
                        </div>
                        <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            <strong style="font-size: 0.85rem; color: #0f172a; display: block; overflow: hidden; text-overflow: ellipsis;">${safeHTML(userStr)}</strong>
                            <span style="font-size: 0.72rem; color: #64748b; font-weight: 600;">${entityDisplay}</span>
                        </div>
                    </div>

                    <!-- Insignia de Acción -->
                    <div>
                        <span style="padding: 0.25rem 0.55rem; border-radius: 0.5rem; font-size: 0.72rem; font-weight: 850; white-space: nowrap; ${actionBadgeStyle}">
                            ${actionLabel}
                        </span>
                    </div>

                    <!-- Detalle & Comparativa de Cambios -->
                    <div style="font-size: 0.85rem; color: #1e293b; overflow: hidden;">
                        <div style="font-weight: 600; line-height: 1.3;">${safeHTML(log.summary)}</div>
                        
                        ${this.renderRowChanges(log.metadata?.changes)}
                    </div>

                    <!-- Botón Ver Ficha -->
                    <div style="justify-self: end;">
                        <button type="button" class="btn btn-sm" onclick="AuditLogsView.showDetails(${log.id})" style="font-weight: 750; border-radius: 6px; padding: 0.3rem 0.6rem; font-size: 0.75rem; background: #f1f5f9; border: 1px solid #cbd5e1; color: #334155; cursor: pointer; display: flex; align-items: center; gap: 0.3rem;" title="Ver ficha completa del registro">
                            <span>🔍</span> <span>Ver Ficha</span>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    filterLogs() {
        const searchFilter = (document.getElementById('auditSearchFilter')?.value || '').toLowerCase().trim();
        const userFilter = (document.getElementById('auditUserFilter')?.value || '').toLowerCase().trim();
        const dateFilter = document.getElementById('auditDateFilter')?.value;
        const chip = this.currentFilter;

        const rows = document.querySelectorAll('.audit-row-item');
        let visibleCount = 0;

        rows.forEach(row => {
            const rDate = row.dataset.date || '';
            const rUser = row.dataset.user || '';
            const rEntity = row.dataset.entity || '';
            const rAction = row.dataset.action || '';
            const rSummary = row.dataset.summary || '';
            const rSearch = row.dataset.search || '';

            const matchSearch = !searchFilter || rSearch.includes(searchFilter);
            const matchUser = !userFilter || rUser.includes(userFilter);
            const matchDate = !dateFilter || rDate === dateFilter;

            let matchChip = true;
            if (chip === 'delete') {
                matchChip = rAction === 'delete' || rAction === 'void' || rSummary.includes('anul') || rSummary.includes('elimin');
            } else if (chip === 'price') {
                matchChip = rSummary.includes('precio') || rSummary.includes('costo');
            } else if (chip === 'inventory') {
                matchChip = rEntity === 'inventory' || rEntity === 'product' || rSummary.includes('stock');
            } else if (chip === 'login') {
                matchChip = rAction === 'login' || rAction === 'logout' || rEntity === 'auth';
            }

            if (matchSearch && matchUser && matchDate && matchChip) {
                row.style.display = 'grid';
                visibleCount++;
            } else {
                row.style.display = 'none';
            }
        });

        const countLabel = document.getElementById('auditCountLabel');
        if (countLabel) {
            countLabel.textContent = `Mostrando ${visibleCount} registro(s)`;
        }
    },

    async showDetails(logId) {
        try {
            const log = await db.get('auditLogs', parseInt(logId));
            if (!log) {
                showNotification('Registro no encontrado', 'error');
                return;
            }

            const dateStr = formatDateTime(log.timestamp);
            let userStr = log.username || (log.userId ? `Usuario #${log.userId}` : 'Sistema');
            if (userStr && userStr.toLowerCase() === 'sistema') {
                userStr = 'Administrador / Sistema';
            }
            const entityDisplay = this.ENTITY_LABELS[log.entity] || log.entity || 'General';
            const actionDisplay = this.ACTION_LABELS[log.action] || this.ACTION_LABELS[String(log.action || '').toLowerCase()] || log.action || 'General';

            const changesHtml = this.renderModalChanges(log.metadata?.changes);

            const content = `
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    <!-- Cabecera de la Ficha -->
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1rem; display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.85rem;">
                        <div>
                            <span style="color: #64748b; font-weight: 700; display: block; font-size: 0.75rem; text-transform: uppercase;">Fecha y Hora:</span>
                            <strong style="color: #0f172a;">${dateStr}</strong>
                        </div>
                        <div>
                            <span style="color: #64748b; font-weight: 700; display: block; font-size: 0.75rem; text-transform: uppercase;">Usuario Responsable:</span>
                            <strong style="color: #4338ca;">👤 ${safeHTML(userStr)}</strong>
                        </div>
                        <div>
                            <span style="color: #64748b; font-weight: 700; display: block; font-size: 0.75rem; text-transform: uppercase;">Módulo / Entidad:</span>
                            <strong style="color: #0f172a;">${safeHTML(entityDisplay)}</strong>
                        </div>
                        <div>
                            <span style="color: #64748b; font-weight: 700; display: block; font-size: 0.75rem; text-transform: uppercase;">Tipo de Acción:</span>
                            <strong style="color: #0f172a;">${safeHTML(actionDisplay)}</strong>
                        </div>
                    </div>

                    <!-- Resumen del Evento -->
                    <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 0.75rem; padding: 1rem;">
                        <span style="color: #64748b; font-weight: 700; display: block; font-size: 0.75rem; text-transform: uppercase; margin-bottom: 0.25rem;">Descripción del Movimiento:</span>
                        <div style="font-size: 1rem; font-weight: 750; color: #0f172a; line-height: 1.4;">
                            ${safeHTML(log.summary)}
                        </div>
                    </div>

                    ${changesHtml}

                    <!-- Datos Técnicos Plegables -->
                    ${(log.metadata && Object.keys(log.metadata).length > 0) ? `
                        <details style="margin-top: 0.5rem; font-size: 0.8rem; color: #64748b;">
                            <summary style="cursor: pointer; font-weight: 700; user-select: none;">⚙️ Ver metadatos técnicos avanzados (Opcional)</summary>
                            <pre style="background: #1e293b; color: #a5b4fc; padding: 0.75rem; border-radius: 0.5rem; overflow-x: auto; font-size: 0.75rem; margin-top: 0.5rem;">${JSON.stringify(log.metadata, null, 2)}</pre>
                        </details>
                    ` : ''}
                </div>
            `;

            showModal(content, { title: `🛡️ Ficha de Auditoría #${log.id}`, width: '560px' });
        } catch (e) {
            console.error('Error al visualizar ficha de auditoría:', e);
            showNotification('Error visualizando registro', 'error');
        }
    },

    async exportAuditPDF() {
        try {
            const jsPDF = window.jspdf ? window.jspdf.jsPDF : null;
            if (!jsPDF) {
                showNotification('Módulo PDF no disponible', 'warning');
                return;
            }

            const logs = this.currentLogs || [];
            if (logs.length === 0) {
                showNotification('No hay eventos de auditoría para exportar', 'warning');
                return;
            }

            const doc = new jsPDF({ unit: 'pt', format: 'a4' });
            const bizName = localStorage.getItem('BUSINESS_NAME') || 'Mi Negocio';
            const bizRut = localStorage.getItem('BUSINESS_RUT') || '';
            const now = new Date();

            // Header Banner
            doc.setFillColor(30, 41, 59);
            doc.rect(0, 0, 595, 65, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.text(bizName.toUpperCase(), 40, 38);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text('INFORME DE SEGURIDAD Y AUDITORÍA', 350, 38);

            // Subheader
            let y = 90;
            doc.setTextColor(30, 41, 59);
            doc.setFontSize(9);
            if (bizRut) { doc.text(`RUT Comercio: ${bizRut}`, 40, y); y += 13; }
            doc.text(`Período: Últimos 30 días  |  Registros: ${logs.length}  |  Emisión: ${now.toLocaleDateString('es-CL')} ${now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`, 40, y);

            // Resumen de Eliminaciones Críticas
            const deletes = logs.filter(l => (l.action === 'delete' || l.action === 'void' || (l.summary || '').toLowerCase().includes('anul') || (l.summary || '').toLowerCase().includes('elimin')));
            y += 18;
            doc.setFillColor(254, 242, 242);
            doc.rect(40, y, 515, 32, 'F');
            doc.setDrawColor(254, 202, 202);
            doc.rect(40, y, 515, 32, 'D');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10.5);
            doc.setTextColor(185, 28, 28);
            doc.text(`ALERTA: Se registran ${deletes.length} eliminaciones/anulaciones críticas en el período`, 50, y + 20);

            // Tabla de Registros
            const rows = logs.slice(0, 150).map(l => {
                const dateStr = l.timestamp ? new Date(l.timestamp).toLocaleDateString('es-CL') : '—';
                const timeStr = l.timestamp ? new Date(l.timestamp).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '';
                const user = l.username || (l.userId ? `Usuario #${l.userId}` : 'Sistema');
                return [
                    `${dateStr}\n${timeStr}`,
                    user,
                    l.entity || 'General',
                    (l.action || '').toUpperCase(),
                    (l.summary || '').substring(0, 90)
                ];
            });

            if (doc.autoTable) {
                doc.autoTable({
                    startY: y + 45,
                    head: [['Fecha y Hora', 'Usuario', 'Entidad', 'Acción', 'Detalle de la Operación']],
                    body: rows,
                    theme: 'striped',
                    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
                    bodyStyles: { fontSize: 7.5, textColor: [15, 23, 42] },
                    columnStyles: {
                        0: { cellWidth: 70 },
                        1: { cellWidth: 80 },
                        2: { cellWidth: 60 },
                        3: { cellWidth: 65 }
                    },
                    margin: { left: 40, right: 40 }
                });
            }

            const fileName = `informe_seguridad_${now.toISOString().slice(0, 10)}.pdf`;
            doc.save(fileName);
            showNotification('Informe de seguridad PDF generado con éxito', 'success');
        } catch (e) {
            console.error('Error al generar PDF de auditoría:', e);
            showNotification('Error al exportar informe de seguridad', 'error');
        }
    },

    async exportAuditExcel() {
        try {
            if (typeof XLSX === 'undefined') {
                showNotification('Librería Excel no disponible', 'warning');
                return;
            }

            const logs = this.currentLogs || [];
            if (logs.length === 0) {
                showNotification('No hay eventos de auditoría para exportar', 'warning');
                return;
            }

            const data = logs.map(l => {
                let changesText = '';
                if (l.metadata && l.metadata.changes) {
                    const norm = this.normalizeChanges(l.metadata.changes);
                    changesText = norm.map(c => {
                        if (c.isSimpleBadge) return c.label;
                        return `${c.label}: ${c.old ?? '—'} ➔ ${c.new ?? '—'}`;
                    }).join(' | ');
                }
                const date = l.timestamp ? new Date(l.timestamp) : new Date();
                return {
                    'ID Evento': l.id,
                    'Fecha': date.toLocaleDateString('es-CL'),
                    'Hora': date.toLocaleTimeString('es-CL'),
                    'Usuario': l.username || (l.userId ? `Usuario #${l.userId}` : 'Sistema'),
                    'Módulo / Entidad': l.entity || 'General',
                    'Acción': (l.action || '').toUpperCase(),
                    'Resumen del Movimiento': l.summary || '',
                    'Valores Modificados': changesText
                };
            });

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Auditoría');
            const fileName = `auditoria_${new Date().toISOString().slice(0, 10)}.xlsx`;
            XLSX.writeFile(wb, fileName);
            showNotification('Planilla Excel de auditoría exportada con éxito', 'success');
        } catch (e) {
            console.error('Error al exportar auditoría a Excel:', e);
            showNotification('Error al exportar Excel de auditoría', 'error');
        }
    },

    async refresh() {
        const content = await this.render();
        const container = document.getElementById('view-container');
        if (container) container.innerHTML = content;
        showNotification('Registros de auditoría actualizados', 'info');
    }
};
