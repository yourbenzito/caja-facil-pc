const SuppliersView = {
    async render() {
        const suppliers = await Supplier.getAll();
        
        // Calcular órdenes de compra pendientes
        const purchaseOrders = JSON.parse(localStorage.getItem('purchaseOrders') || '[]');
        const pendingOrdersCount = purchaseOrders.filter(o => o.status === 'pending').length;

        // Calcular promedio de calificación
        const evaluations = JSON.parse(localStorage.getItem('supplierEvaluations') || '{}');
        const evalValues = Object.values(evaluations).map(e => e.rating);
        const avgRating = evalValues.length > 0 
            ? (evalValues.reduce((sum, r) => sum + r, 0) / evalValues.length).toFixed(1) 
            : '5.0';

        return `
            <style>
            /* CSS local para Dashboard de Proveedores */
            .suppliers-kpi-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                gap: 1.25rem;
                margin-bottom: 2rem;
            }
            .supplier-kpi-card {
                background: var(--surface-content);
                border: 1px solid var(--border);
                border-radius: var(--radius-md);
                padding: 1.25rem;
                display: flex;
                align-items: center;
                gap: 1rem;
                box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.01);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .supplier-kpi-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -2px rgba(0,0,0,0.02);
                border-color: var(--border-strong);
            }
            .kpi-icon-wrapper {
                width: 48px;
                height: 48px;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.5rem;
                font-weight: bold;
                flex-shrink: 0;
            }
            .kpi-info-wrapper {
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .kpi-label {
                font-size: 0.70rem;
                font-weight: 800;
                color: var(--text-muted);
                letter-spacing: 0.5px;
                text-transform: uppercase;
            }
            .kpi-val {
                font-size: 1.4rem;
                font-weight: 800;
                color: var(--text-main);
                margin: 0.15rem 0 0 0;
                line-height: 1.1;
            }

            /* Contenedor principal de proveedores */
            .suppliers-dashboard-container {
                background: var(--surface-content) !important;
                border: 1px solid var(--border) !important;
                border-radius: var(--radius-xl) !important;
                padding: 1.50rem !important;
                box-shadow: var(--shadow-premium) !important;
            }

            /* Buscador de proveedores */
            .supplier-search-control {
                border: 1.5px solid var(--border) !important;
                font-size: 1.05rem !important;
                height: 52px !important;
                padding: 0 1.25rem !important;
                border-radius: var(--radius-md) !important;
                transition: all 0.2s ease !important;
            }
            .supplier-search-control:focus {
                border-color: var(--primary) !important;
                box-shadow: 0 0 0 3px var(--primary-soft) !important;
            }

            /* Tarjetas de proveedores */
            .supplier-dashboard-card {
                background: var(--surface-content) !important;
                border: 1px solid var(--border) !important;
                border-radius: var(--radius-md) !important;
                padding: 1.25rem !important;
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
                position: relative !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 1rem !important;
                box-shadow: 0 2px 5px rgba(0,0,0,0.02) !important;
            }
            .supplier-dashboard-card:hover {
                transform: translateY(-4px) !important;
                box-shadow: var(--shadow-premium) !important;
                border-color: var(--border-strong) !important;
            }
            .supplier-avatar {
                width: 48px;
                height: 48px;
                color: white;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.2rem;
                font-weight: bold;
                box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                flex-shrink: 0;
            }
            .supplier-debt-box {
                background: #f8fafc;
                padding: 0.85rem;
                border-radius: 10px;
                border: 1px solid var(--border);
                text-align: center;
                transition: all 0.2s ease;
            }
            .supplier-dashboard-card:hover .supplier-debt-box {
                background: #f1f5f9;
            }
            .supplier-card-actions {
                display: flex;
                flex-wrap: wrap;
                justify-content: center;
                gap: 0.4rem;
                margin-top: auto;
                padding-top: 0.75rem;
                border-top: 1px solid var(--border);
            }
            .supplier-card-actions .btn-sm {
                flex: 1;
                min-width: 65px;
                padding: 0.4rem 0.6rem;
                font-size: 0.8rem;
                font-weight: 700;
                border-radius: 8px;
                transition: all 0.2s;
            }

            /* Estilo para Historial de Compras Modal */
            .modal-header-gradient {
                margin: -1.5rem -1.5rem 1.5rem -1.5rem;
                padding: 1.5rem;
                background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
                color: white;
                border-top-left-radius: inherit;
                border-top-right-radius: inherit;
                box-shadow: 0 4px 12px var(--primary-soft);
            }
            .modal-kpi-container {
                margin-bottom: 1.5rem;
                padding: 1.25rem;
                background: #1e293b;
                border-radius: var(--radius-md);
                border: 1px solid #334155;
                box-shadow: 0 4px 6px rgba(0,0,0,0.15);
            }
            .modal-kpi-container .kpi-label {
                color: #94a3b8 !important;
            }
            .modal-kpi-container .kpi-value {
                color: #38bdf8 !important;
            }
            .purchase-history-item-card {
                padding: 1.25rem;
                margin-bottom: 0.75rem;
                border: 1px solid var(--border);
                border-radius: var(--radius-md);
                background: #f8fafc;
                transition: all 0.2s ease;
            }
            .purchase-history-item-card:hover {
                border-color: var(--border-strong);
                background: #ffffff;
                box-shadow: 0 4px 12px rgba(0,0,0,0.03);
            }
            .purchase-detail-toggle {
                cursor: pointer;
                color: var(--primary);
                font-weight: 700;
                font-size: 0.85rem;
                display: inline-flex;
                align-items: center;
                gap: 0.25rem;
                margin-top: 0.25rem;
                user-select: none;
            }
            .purchase-detail-toggle:hover {
                color: var(--primary-hover);
                text-decoration: underline;
            }
            .purchase-detail-box {
                margin-top: 0.75rem;
                padding: 0.75rem 1rem;
                background: #ffffff;
                border-radius: 8px;
                border: 1px solid var(--border);
            }
            .modal-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 0.5rem;
            }
            .modal-table thead th {
                background: #1e293b !important;
                color: #ffffff !important;
                font-weight: 700;
                text-transform: uppercase;
                font-size: 0.8rem;
                padding: 0.75rem 1rem;
                letter-spacing: 0.5px;
            }
            .modal-table tbody td {
                padding: 0.75rem 1rem;
                border-bottom: 1px solid var(--border);
                color: var(--text-main) !important;
                font-size: 0.9rem;
            }
            .modal-table tbody tr:hover {
                background: #f8fafc;
            }
            .modal-list-card {
                padding: 1rem;
                background: #f8fafc;
                border: 1px solid var(--border);
                border-radius: var(--radius-md);
                transition: all 0.2s ease;
            }
            .modal-list-card:hover {
                border-color: var(--border-strong);
                background: #ffffff;
                box-shadow: 0 4px 12px rgba(0,0,0,0.03);
            }
            .btn-tab {
                background: none;
                border: none;
                padding: 0.5rem 1rem;
                font-weight: 800;
                font-size: 1rem;
                cursor: pointer;
                color: var(--text-muted);
                border-bottom: 3px solid transparent;
                transition: all 0.2s ease;
            }
            .btn-tab:hover {
                color: var(--primary);
            }
            .btn-tab.active {
                color: var(--primary) !important;
                border-bottom-color: var(--primary) !important;
            }
            </style>

            <div class="view-header">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h1>Proveedores</h1>
                        <p>Gestiona tus proveedores e historial de compras</p>
                    </div>
                    <div style="display: flex; gap: 0.75rem;">
                        ${PermissionService.can('suppliers.delete') ? `
                        <button class="btn btn-warning" onclick="SuppliersView.showDeletedSuppliers()" title="Ver proveedores desactivados">
                            📋 Desactivados
                        </button>` : ''}
                        ${PermissionService.can('suppliers.create') ? `
                        <button class="btn btn-info" onclick="SuppliersView.showPurchaseOrdersList()">
                            📦 Órdenes de Compra
                        </button>` : ''}
                        ${PermissionService.can('suppliers.create') ? `
                        <button class="btn btn-primary" onclick="SuppliersView.showSupplierForm()">
                            Nuevo Proveedor
                        </button>` : ''}
                    </div>
                </div>
            </div>
            
            <div class="suppliers-dashboard-container">
                <div style="margin-bottom: 1.5rem;">
                    <input type="text" 
                           id="searchSuppliers" 
                           class="form-control supplier-search-control" 
                           placeholder="🔍 Buscar proveedor por nombre o RUT...">
                </div>
                
                <div id="suppliersTable">
                    ${this.renderSuppliersTable(suppliers)}
                </div>
            </div>
        `;
    },

    focusSearch() {
        const el = document.getElementById('searchSuppliers');
        if (el) { el.focus(); el.select?.(); }
    },

    async init() {
        const searchInput = document.getElementById('searchSuppliers');

        searchInput.addEventListener('input', async (e) => {
            const term = e.target.value;
            const suppliers = term ? await Supplier.search(term) : await Supplier.getAll();
            const table = document.getElementById('suppliersTable');
            if (table) {
                updateDOM(table, this.renderSuppliersTable(suppliers));
                await this.loadSupplierDebts(suppliers);
            }
        });

        // C6: Cargar deudas de proveedores
        const suppliers = await Supplier.getAll();
        await this.loadSupplierDebts(suppliers);
    },

    /**
     * C6: Cargar y mostrar deuda de cada proveedor en la tabla.
     */
    async loadSupplierDebts(suppliers) {
        console.log(`C6: Cargando deudas para ${suppliers.length} proveedores`);
        for (const s of suppliers) {
            try {
                const detail = await SupplierPaymentService.getDebtDetail(s.id);
                const pending = detail.filter(d => d.balance >= 1);
                const debt = pending.reduce((sum, item) => sum + item.balance, 0);
                
                const elem = document.getElementById(`supplier-debt-${s.id}`);
                if (elem) {
                    if (debt >= 1) {
                        elem.innerHTML = `
                            <span style="color: #dc2626; font-size: 1.3rem; font-weight: 800;">${formatCLP(debt)}</span>
                            <span style="font-size: 0.75rem; color: #dc2626; font-weight: 600; background: #fef2f2; padding: 0.2rem 0.5rem; border-radius: 0.4rem; margin-top: 0.25rem; border: 1px solid #fecaca;">
                                ${pending.length} compras pendientes
                            </span>
                        `;
                    } else {
                        elem.innerHTML = `
                            <span style="color: #16a34a; font-size: 1.1rem; font-weight: 700;">Sin deuda</span>
                            <span style="font-size: 0.7rem; color: #6b7280; margin-top: 0.25rem; font-weight: 500;">Al día ✓</span>
                        `;
                    }
                }
            } catch (error) {
                console.error(`C6: Error cargando deuda proveedor #${s.id}:`, error);
                const elem = document.getElementById(`supplier-debt-${s.id}`);
                if (elem) elem.textContent = 'Error';
            }
        }
    },

    renderSuppliersTable(suppliers) {
        if (suppliers.length === 0) {
            return '<div class="empty-state"><div class="empty-state-icon">🚚</div>No hay proveedores</div>';
        }

        const colors = ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#22c55e', '#84cc16', '#eab308', '#f59e0b', '#f97316', '#ef4444'];

        return `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem; padding: 0.5rem 0;">
                ${suppliers.map(s => {
            const nameParts = (s.name || 'Proveedor').trim().split(' ');
            const initials = ((nameParts[0]?.[0] || '') + (nameParts[1]?.[0] || '')).toUpperCase() || 'P';

            let hash = 0;
            for (let i = 0; i < (s.name || '').length; i++) hash = (s.name || '').charCodeAt(i) + ((hash << 5) - hash);
            const bgColor = colors[Math.abs(hash) % colors.length];

            return `
                    <div class="supplier-dashboard-card">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <div style="display: flex; align-items: center; gap: 1rem;">
                                <div class="supplier-avatar" style="background: ${bgColor};">
                                    ${initials}
                                </div>
                                <div>
                                    <h3 style="margin: 0; font-size: 1.1rem; color: var(--text-main); line-height: 1.2; font-weight: 800;">${safeHTML(s.name)}</h3>
                                    ${s.contact ? `<div style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.2rem; font-weight: 500;">👤 ${safeHTML(s.contact)}</div>` : ''}
                                </div>
                            </div>
                        </div>

                        ${(s.phone || s.email) ? `
                        <div style="display: flex; flex-direction: column; gap: 0.4rem; padding: 0.65rem 0.85rem; background: var(--surface); border-radius: 0.5rem; font-size: 0.875rem; color: var(--text-main); border: 1px solid var(--border);">
                            ${s.phone ? `<div style="display: flex; align-items: center; gap: 0.5rem; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">📞 ${safeHTML(s.phone)}</div>` : ''}
                            ${s.email ? `<div style="display: flex; align-items: center; gap: 0.5rem; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${safeHTML(s.email)}">✉️ ${safeHTML(s.email)}</div>` : ''}
                        </div>
                        ` : ''}

                        <div class="supplier-debt-box">
                            <div style="font-size: 0.70rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 800;">DEUDA AL PROVEEDOR</div>
                            <div id="supplier-debt-${s.id}" style="font-weight: 800; font-size: 1.2rem; color: var(--text-main); margin-top: 0.25rem; display: flex; align-items: center; justify-content: center; gap: 0.4rem; flex-direction: column;">
                                <span style="color: var(--text-muted); font-size: 0.9rem;">⏳ Calculando...</span>
                            </div>
                        </div>

                        <div class="supplier-card-actions">
                            <button class="btn btn-sm" style="background: rgba(16, 185, 129, 0.08); color: #059669; border: 1px solid rgba(16, 185, 129, 0.2);" onclick="SuppliersView.showSupplierPaymentForm(${s.id})" title="Registrar pago a proveedor">
                                💰 Pagar
                            </button>
                            <button class="btn btn-sm" style="background: rgba(59, 130, 246, 0.08); color: #2563eb; border: 1px solid rgba(59, 130, 246, 0.2);" onclick="SuppliersView.showSupplierHistory(${s.id})" title="Ver historial de compras y pagos">
                                📋 Historial
                            </button>
                            <button class="btn btn-sm" style="background: rgba(139, 92, 246, 0.08); color: #7c3aed; border: 1px solid rgba(139, 92, 246, 0.2);" onclick="SuppliersView.showProductsBySupplier(${s.id})" title="Ver stock de productos de este proveedor">
                                📦 Stock
                            </button>
                            ${PermissionService.can('suppliers.edit') ? `
                            <button class="btn btn-sm" style="background: var(--surface); color: var(--text-main); border: 1px solid var(--border); min-width: 35px; max-width: 35px; padding: 0.4rem 0;" onclick="SuppliersView.showSupplierForm(${s.id})" title="Editar proveedor">✏️</button>
                            ` : ''}
                            ${PermissionService.can('suppliers.delete') ? `
                            <button class="btn btn-sm" style="background: rgba(239, 68, 68, 0.08); color: var(--danger); border: 1px solid rgba(239, 68, 68, 0.2); min-width: 35px; max-width: 35px; padding: 0.4rem 0;" onclick="SuppliersView.deleteSupplier(${s.id})" title="Desactivar proveedor">🗑️</button>
                            ` : ''}
                        </div>
                    </div>
                    `;
        }).join('')}
            </div>
        `;
    },

    async showSupplierForm(id = null) {
        const supplier = id ? await Supplier.getById(id) : null;

        const content = `
            <form id="supplierForm" onsubmit="SuppliersView.saveSupplier(event, ${id})">
                <div class="form-group">
                    <label>Nombre *</label>
                    <input type="text" name="name" class="form-control" value="${supplier?.name || ''}" required>
                </div>
                
                <div class="form-group">
                    <label>Nombre de Contacto</label>
                    <input type="text" name="contact" class="form-control" value="${supplier?.contact || ''}">
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>Teléfono</label>
                        <input type="text" name="phone" class="form-control" value="${supplier?.phone || ''}" inputmode="numeric" pattern="[0-9]*" title="Sólo números" placeholder="Ej: +56912345678">
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" name="email" class="form-control" value="${supplier?.email || ''}">
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Dirección</label>
                    <textarea name="address" class="form-control" rows="2">${supplier?.address || ''}</textarea>
                </div>
            </form>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="document.getElementById('supplierForm').requestSubmit()">
                ${id ? 'Actualizar' : 'Crear'}
            </button>
        `;

        window._focusSearchAfterClose = () => SuppliersView.focusSearch();
        showModal(content, {
            title: id ? 'Editar Proveedor' : 'Nuevo Proveedor',
            footer,
            width: '600px'
        });

        // Add Enter key listener to submit form
        const form = document.getElementById('supplierForm');
        form.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Prevent default form submission if any
                form.requestSubmit(); // Trigger the form's submit event programmatically
            }
        });
    },

    async saveSupplier(event, id) {
        event.preventDefault();

        const formData = new FormData(event.target);
        const data = Object.fromEntries(formData);

        if (id) data.id = id;

        try {
            await SupplierController.saveSupplier(data);
            closeModal();
            await this.refresh();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    },

    async deleteSupplier(id) {
        const supplier = await Supplier.getById(id);
        const name = supplier ? supplier.name : `#${id}`;
        showConfirm(`¿Desactivar al proveedor "${name}"? Dejará de aparecer en listados y compras nuevas, pero se preserva para reportes. Podrás restaurarlo luego.`, async () => {
            try {
                await SupplierController.deleteSupplier(id);
                await this.refresh();
            } catch (error) {
                showNotification(error.message, 'error');
            }
        });
    },

    /**
     * C1: Mostrar proveedores desactivados con opción de restaurar
     */
    async showDeletedSuppliers() {
        const deleted = await Supplier.getDeleted();

        if (deleted.length === 0) {
            window._focusSearchAfterClose = () => SuppliersView.focusSearch();
            showModal(
                '<div class="empty-state"><div class="empty-state-icon">✅</div>No hay proveedores desactivados</div>',
                { title: 'Proveedores Desactivados', footer: '<button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>', width: '600px' }
            );
            return;
        }

        const content = `
            <div class="modal-header-gradient" style="margin-bottom: 1.5rem;">
                <h2 style="margin: 0; font-size: 1.5rem; color: white;">📋 Proveedores Desactivados</h2>
                <div style="font-size: 0.9rem; opacity: 0.95; color: white; margin-top: 0.25rem;">Lista de proveedores archivados del sistema</div>
            </div>

            <p style="margin-bottom: 1rem; color: var(--text-muted); font-size: 0.9rem;">
                Estos proveedores están desactivados. No aparecen en compras nuevas ni listados, pero se preservan para reportes.
            </p>
            
            <div style="max-height: 400px; overflow-y: auto; border-radius: var(--radius-md); border: 1px solid var(--border);">
                <table class="modal-table" style="margin-top: 0;">
                    <thead style="position: sticky; top: 0; z-index: 10;">
                        <tr>
                            <th style="text-align: left;">Nombre</th>
                            <th style="text-align: left;">Contacto</th>
                            <th style="text-align: left;">Desactivado</th>
                            <th style="text-align: center;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${deleted.map(s => `
                            <tr style="opacity: 0.85;">
                                <td style="font-weight: 700; color: var(--text-main);">${safeHTML(s.name)}</td>
                                <td style="color: var(--text-main);">${safeHTML(s.contact || '-')}</td>
                                <td style="color: var(--text-muted);">${s.deletedAt ? new Date(s.deletedAt).toLocaleDateString('es-CL') : '-'}</td>
                                <td style="text-align: center;">
                                    <button class="btn btn-sm btn-success" style="font-weight: 700;" onclick="SuppliersView.restoreSupplier(${s.id})">
                                        ✓ Restaurar
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        window._focusSearchAfterClose = () => SuppliersView.focusSearch();
        showModal(content, {
            title: `Proveedores Desactivados (${deleted.length})`,
            footer: '<button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>',
            width: '600px'
        });
    },

    async restoreSupplier(id) {
        try {
            await SupplierController.restoreSupplier(id);
            closeModal();
            await this.refresh();
            await this.showDeletedSuppliers();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    },

    async refresh() {
        const suppliers = await Supplier.getAll();
        const table = document.getElementById('suppliersTable');
        
        if (table) {
            updateDOM(table, this.renderSuppliersTable(suppliers));
            await this.loadSupplierDebts(suppliers);
        }

        // C6: También refrescar el resumen de deudas en Compras si está visible
        if (typeof PurchasesView !== 'undefined' && document.getElementById('accountsPayableSummary')) {
            await PurchasesView.renderAccountsPayableSummary();
        }
    },

    /**
     * C6: Mostrar formulario para registrar pago a proveedor (general o por compra).
     */
    async showSupplierPaymentForm(supplierId) {
        const supplier = await Supplier.getById(supplierId);
        if (!supplier) { showNotification('Proveedor no encontrado', 'error'); return; }

        const debt = await SupplierPaymentService.getSupplierDebt(supplierId);
        const debtDetail = await SupplierPaymentService.getDebtDetail(supplierId);
        const pendingPurchases = debtDetail.filter(d => d.balance >= 1);

        const purchaseOptions = pendingPurchases.length > 0 ? `
            <option value="">Pago general al proveedor</option>
            ${pendingPurchases.map(d => `
                <option value="${d.purchase.id}">Compra #${d.purchase.id} — ${formatDate(d.purchase.date)} — Saldo: ${formatCLP(d.balance)}</option>
            `).join('')}
        ` : '<option value="">Sin compras pendientes</option>';

        const content = `
            <div class="modal-header-gradient" style="margin-bottom: 1.5rem;">
                <h2 style="margin: 0 0 0.5rem 0; font-size: 1.5rem; color: white;">💰 Registrar Pago</h2>
                <div style="font-size: 0.9rem; opacity: 0.95; color: white;">
                    ${safeHTML(supplier.name)}
                </div>
            </div>

            <div class="modal-kpi-container" style="margin-bottom: 1.5rem; text-align: center;">
                <div class="kpi-label" style="font-size: 0.8rem; font-weight: 800; text-transform: uppercase; margin-bottom: 0.25rem;">Deuda Total Pendiente</div>
                <div class="kpi-value" style="font-size: 1.8rem; font-weight: 900; color: #ef4444 !important;">${formatCLP(debt)}</div>
            </div>

            <form id="supplierPaymentForm" style="padding: 0 0.5rem;">
                <div class="form-group">
                    <label style="font-weight: 700; color: var(--text-main);">Compra asociada (opcional)</label>
                    <select id="spPurchaseId" class="form-control" onchange="SuppliersView.onPurchaseSelect()">
                        ${purchaseOptions}
                    </select>
                    <small class="form-text text-muted">Selecciona una compra para vincular el pago, o deja "general"</small>
                </div>
                <div class="form-group">
                    <label style="font-weight: 700; color: var(--text-main);">Monto a Pagar (CLP) *</label>
                    <input type="number" id="spAmount" class="form-control" 
                           value="${debt > 0 ? Math.round(debt) : ''}" min="1" required
                           placeholder="Monto del pago">
                </div>
                <div class="form-group">
                    <label style="font-weight: 700; color: var(--text-main);">Método de Pago</label>
                    <select id="spMethod" class="form-control">
                        <option value="cash">Efectivo</option>
                        <option value="transfer">Transferencia</option>
                        <option value="other">Otro</option>
                    </select>
                </div>
                <div class="form-group">
                    <label style="font-weight: 700; color: var(--text-main);">Referencia / Comprobante (opcional)</label>
                    <input type="text" id="spReference" class="form-control" placeholder="Ej: Nro. transferencia, recibo...">
                </div>
                <div class="form-group">
                    <label style="font-weight: 700; color: var(--text-main);">Notas (opcional)</label>
                    <input type="text" id="spNotes" class="form-control" placeholder="Notas adicionales...">
                </div>

                <div class="form-group" style="margin-top: 1.25rem; padding: 0.75rem; background: #f8fafc; border: 1px solid var(--border); border-radius: 8px;">
                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-weight: 700; margin-bottom: 0.25rem;">
                        <input type="checkbox" id="spDeductFromCash" style="width: 16px; height: 16px;">
                        <span>Egresar dinero de la caja actual</span>
                    </label>
                    <small style="display: block; color: var(--text-muted); line-height: 1.3;">
                        Si desmarcas esta opción, el pago quedará registrado pero <strong>no</strong> afectará la caja.
                    </small>
                </div>
            </form>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-success" onclick="SuppliersView.processSupplierPayment(${supplierId})" id="btnProcessSupplierPayment">
                💰 Registrar Pago
            </button>
        `;

        window._focusSearchAfterClose = () => SuppliersView.focusSearch();
        showModal(content, { title: `Pago a ${safeHTML(supplier.name)}`, footer, width: '550px' });
    },

    /**
     * C6: Al seleccionar una compra, actualizar el monto sugerido.
     */
    onPurchaseSelect() {
        const select = document.getElementById('spPurchaseId');
        const amountInput = document.getElementById('spAmount');
        if (!select || !amountInput) return;

        const selectedOption = select.options[select.selectedIndex];
        if (selectedOption && selectedOption.value) {
            // Extraer saldo del texto de la opción
            const match = selectedOption.textContent.match(/Saldo:\s*\$?([\d.,]+)/);
            if (match) {
                const saldo = parseInt(match[1].replace(/\./g, '').replace(',', ''), 10);
                if (!isNaN(saldo)) amountInput.value = saldo;
            }
        }
    },

    /**
     * C6: Procesar pago a proveedor.
     */
    async processSupplierPayment(supplierId) {
        const purchaseId = document.getElementById('spPurchaseId').value;
        const amount = parseFloat(document.getElementById('spAmount').value);
        const method = document.getElementById('spMethod').value;
        const reference = document.getElementById('spReference').value.trim();
        const notes = document.getElementById('spNotes').value.trim();

        if (!amount || amount <= 0) {
            showNotification('Ingresa un monto válido', 'warning');
            return;
        }

        const btn = document.getElementById('btnProcessSupplierPayment');
        if (btn) { btn.disabled = true; btn.textContent = 'Procesando...'; }

        const deductFromCash = document.getElementById('spDeductFromCash').checked;

        try {
            await SupplierPaymentService.registerPayment({
                supplierId: supplierId,
                purchaseId: purchaseId ? parseInt(purchaseId, 10) : null,
                amount: amount,
                method: method,
                reference: reference,
                notes: notes,
                deductFromCashRegister: deductFromCash
            });
            closeModal();
            showNotification('Pago registrado exitosamente', 'success');
            await this.refresh();
        } catch (error) {
            showNotification(error.message, 'error');
            if (btn) { btn.disabled = false; btn.textContent = '💰 Registrar Pago'; }
        }
    },

    /**
     * C6: Mostrar historial unificado (Compras y Pagos) de un proveedor.
     */
    async showSupplierHistory(supplierId) {
        const supplier = await Supplier.getById(supplierId);
        if (!supplier) { showNotification('Proveedor no encontrado', 'error'); return; }

        const content = `
            <div class="modal-header-gradient" style="margin-bottom: 1rem;">
                <h2 style="margin: 0 0 0.5rem 0; font-size: 1.5rem; color: white;">${safeHTML(supplier.name)}</h2>
                <div style="font-size: 0.9rem; opacity: 0.95; color: white;">
                    ${safeHTML(supplier.contact ? supplier.contact + ' • ' : '')}${safeHTML(supplier.phone || '')} ${supplier.email ? '• ' + safeHTML(supplier.email) : ''}
                </div>
            </div>

            <!-- TABS SELECTOR -->
            <div style="display: flex; border-bottom: 2px solid var(--border); margin-bottom: 1.25rem; gap: 0.5rem;">
                <button class="btn-tab active" id="tab-purchases" 
                        onclick="SuppliersView.switchHistoryTab(${supplierId}, 'purchases')">
                    📋 Compras
                </button>
                <button class="btn-tab" id="tab-payments" 
                        onclick="SuppliersView.switchHistoryTab(${supplierId}, 'payments')">
                    📜 Pagos y Abonos
                </button>
            </div>

            <div id="supplierHistoryTabContent">
                <div style="text-align: center; padding: 2rem; color: var(--text-muted);">Cargando historial...</div>
            </div>
        `;

        const footer = `<button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>`;
        window._focusSearchAfterClose = () => SuppliersView.focusSearch();
        const modal = showModal(content, { title: `Historial - ${safeHTML(supplier.name)}`, footer, width: '900px' });
        
        this._historyModal = modal;
        await this.switchHistoryTab(supplierId, 'purchases');
    },

    async switchHistoryTab(supplierId, activeTab) {
        const purchases = await Supplier.getPurchaseHistory(supplierId);
        const totalPurchases = purchases.reduce((sum, p) => sum + p.total, 0);

        const payments = await SupplierPayment.getBySupplier(supplierId);
        const totalPaid = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
        const debt = await SupplierPaymentService.getSupplierDebt(supplierId);

        const btnPurchases = document.getElementById('tab-purchases');
        const btnPayments = document.getElementById('tab-payments');
        if (btnPurchases && btnPayments) {
            if (activeTab === 'purchases') {
                btnPurchases.classList.add('active');
                btnPayments.classList.remove('active');
            } else {
                btnPurchases.classList.remove('active');
                btnPayments.classList.add('active');
            }
            btnPurchases.innerHTML = `📋 Compras (${purchases.length})`;
            btnPayments.innerHTML = `📜 Pagos y Abonos (${payments.length})`;
        }

        const tabContentEl = document.getElementById('supplierHistoryTabContent');
        if (!tabContentEl) return;

        if (activeTab === 'purchases') {
            tabContentEl.innerHTML = `
                <div class="modal-kpi-container" style="margin-bottom: 1.25rem;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; text-align: center;">
                        <div>
                            <div class="kpi-label" style="font-size: 0.8rem; font-weight: 800; text-transform: uppercase; margin-bottom: 0.25rem;">Total de Compras</div>
                            <div class="kpi-value" style="font-size: 1.8rem; font-weight: 900; color: #38bdf8 !important;">${purchases.length}</div>
                        </div>
                        <div>
                            <div class="kpi-label" style="font-size: 0.8rem; font-weight: 800; text-transform: uppercase; margin-bottom: 0.25rem;">Monto Total</div>
                            <div class="kpi-value" style="font-size: 1.8rem; font-weight: 900; color: #38bdf8 !important;">${formatCLP(totalPurchases)}</div>
                        </div>
                    </div>
                </div>
                
                <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
                    <input type="date" id="filterStartDate" class="form-control" style="flex: 1;" placeholder="Desde">
                    <input type="date" id="filterEndDate" class="form-control" style="flex: 1;" placeholder="Hasta">
                    <button class="btn btn-secondary btn-sm" onclick="SuppliersView.filterPurchaseHistory(${supplierId})">
                        Filtrar
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="SuppliersView.switchHistoryTab(${supplierId}, 'purchases')">
                        Limpiar
                    </button>
                </div>

                <div id="purchaseHistoryList" style="max-height: 350px; overflow-y: auto;">
                    ${this.renderPurchaseHistoryList(purchases)}
                </div>
            `;
        } else {
            const methodLabel = (m) => m === 'cash' ? 'Efectivo' : m === 'transfer' ? 'Transferencia' : 'Otro';
            const paymentRows = payments.length === 0
                ? '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">No hay pagos registrados</td></tr>'
                : payments.map(p => `
                    <tr>
                        <td>${formatDateTime(p.date)}</td>
                        <td style="font-weight: 800; color: var(--primary);">${formatCLP(p.amount)}</td>
                        <td>${methodLabel(p.method)}</td>
                        <td>${p.purchaseId ? `<span class="badge" style="background: rgba(99, 102, 241, 0.15); color: #4f46e5; font-weight: 800; border: 1px solid rgba(99, 102, 241, 0.25);">Compra #${p.purchaseId}</span>` : '<span class="badge" style="background: rgba(100, 116, 139, 0.15); color: #475569; font-weight: 800; border: 1px solid rgba(100, 116, 139, 0.25);">General</span>'}</td>
                        <td>${p.reference || '-'}</td>
                        <td>${p.notes || '-'}</td>
                    </tr>
                `).join('');

            tabContentEl.innerHTML = `
                <div class="modal-kpi-container" style="margin-bottom: 1.25rem;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; text-align: center;">
                        <div>
                            <div class="kpi-label" style="font-size: 0.8rem; font-weight: 800; text-transform: uppercase; margin-bottom: 0.25rem;">Total Pagado</div>
                            <div class="kpi-value" style="font-size: 1.8rem; font-weight: 900; color: #10b981 !important;">${formatCLP(totalPaid)}</div>
                        </div>
                        <div>
                            <div class="kpi-label" style="font-size: 0.8rem; font-weight: 800; text-transform: uppercase; margin-bottom: 0.25rem;">Deuda Pendiente</div>
                            <div class="kpi-value" style="font-size: 1.8rem; font-weight: 900; color: ${debt > 0 ? '#ef4444' : '#10b981'} !important;">${formatCLP(debt)}</div>
                        </div>
                    </div>
                </div>

                <div style="max-height: 350px; overflow-y: auto; border-radius: var(--radius-md); border: 1px solid var(--border);">
                    <table class="modal-table" style="margin-top: 0;">
                        <thead style="position: sticky; top: 0; z-index: 10;">
                            <tr>
                                <th style="text-align: left;">Fecha</th>
                                <th style="text-align: left;">Monto</th>
                                <th style="text-align: left;">Método</th>
                                <th style="text-align: left;">Destino</th>
                                <th style="text-align: left;">Referencia</th>
                                <th style="text-align: left;">Notas</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${paymentRows}
                        </tbody>
                    </table>
                </div>
            `;
        }

        if (this._historyModal) {
            const footerEl = this._historyModal.querySelector('.modal-footer');
            if (footerEl) {
                footerEl.innerHTML = activeTab === 'payments' ? `
                    <button class="btn btn-success" onclick="closeModal(); SuppliersView.showSupplierPaymentForm(${supplierId})">
                        💰 Nuevo Pago
                    </button>
                    <button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>
                ` : `
                    <button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>
                `;
            }
        }
    },

    renderPurchaseHistoryList(purchases) {
        if (purchases.length === 0) {
            return '<div class="empty-state">No hay compras registradas</div>';
        }

        return purchases.map(purchase => `
            <div class="purchase-history-item-card">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                    <div>
                        <div style="font-weight: 800; font-size: 1.05rem; color: var(--text-main);">Compra #${purchase.id}</div>
                        <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500; margin-top: 0.15rem;">${formatDateTime(purchase.date)}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase;">Total</div>
                        <div style="font-weight: 900; font-size: 1.25rem; color: var(--primary); margin-top: 0.15rem;">${formatCLP(purchase.total)}</div>
                    </div>
                </div>
                
                <details style="margin-top: 0.75rem;">
                    <summary class="purchase-detail-toggle">Ver detalle de productos (${purchase.items.length} items)</summary>
                    <div class="purchase-detail-box" id="purchase-items-${purchase.id}">
                        ${purchase.items && purchase.items.length > 0 ? `
                            <table style="width: 100%; font-size: 0.85rem; margin-top: 0.5rem; border-collapse: collapse;">
                                <thead>
                                    <tr style="border-bottom: 1px solid var(--border); color: var(--text-muted); text-transform: uppercase; font-size: 0.75rem;">
                                        <th style="text-align: left; padding: 0.35rem 0.5rem; font-weight: 700;">Producto</th>
                                        <th style="text-align: right; padding: 0.35rem 0.5rem; font-weight: 700;">Cant.</th>
                                        <th style="text-align: right; padding: 0.35rem 0.5rem; font-weight: 700;">Costo</th>
                                        <th style="text-align: right; padding: 0.35rem 0.5rem; font-weight: 700;">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${purchase.items.map(item => `
                                        <tr style="border-bottom: 1px dashed var(--border);">
                                            <td style="padding: 0.35rem 0.5rem; font-weight: 600; color: var(--text-main);">${safeHTML(item.name || 'Producto')}</td>
                                            <td style="text-align: right; padding: 0.35rem 0.5rem; color: var(--text-main); font-weight: 500;">${item.quantity}</td>
                                            <td style="text-align: right; padding: 0.35rem 0.5rem; color: var(--text-main); font-weight: 500;">${formatCLP(item.cost)}</td>
                                            <td style="text-align: right; padding: 0.35rem 0.5rem; font-weight: 700; color: var(--primary);">${formatCLP(item.total)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        ` : '<div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500;">No hay detalles registrados para esta compra</div>'}
                    </div>
                </details>
            </div>
        `).join('');
    },

    async filterPurchaseHistory(supplierId) {
        const startDate = document.getElementById('filterStartDate').value;
        const endDate = document.getElementById('filterEndDate').value;

        if (!startDate || !endDate) {
            showNotification('Selecciona ambas fechas', 'warning');
            return;
        }

        const purchases = await Supplier.getPurchasesByDateRange(supplierId, startDate, endDate);
        document.getElementById('purchaseHistoryList').innerHTML = this.renderPurchaseHistoryList(purchases);
    },

    /**
     * Modal independiente: productos comprados a un proveedor y stock actual.
     */
    async showProductsBySupplier(supplierId) {
        const supplier = await Supplier.getById(supplierId);
        const products = await Product.getByLastSupplier(supplierId);

        // Categorizar y calcular puntuación de prioridad para el ordenamiento
        const rows = products.map(product => {
            const name = product.name || `Producto #${product.id}`;
            const safeName = safeHTML(name);
            const stock = parseFloat(product.stock) || 0;
            const min = parseFloat(product.minStock) || 0;

            let statusBadge = '';
            let rowStyle = '';
            let priority = 0; // 0=Normal, 1=Bajo Stock, 2=Sin Stock

            if (stock <= 0) {
                statusBadge = '<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.25); font-weight: 800;">🛑 Sin Stock</span>';
                rowStyle = 'background-color: rgba(239, 68, 68, 0.05); border-left: 4px solid #ef4444;';
                priority = 2;
            } else if (min > 0 && stock <= min) {
                statusBadge = '<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.25); font-weight: 800;">⚠️ Bajo Stock</span>';
                rowStyle = 'background-color: rgba(245, 158, 11, 0.05); border-left: 4px solid #f59e0b;';
                priority = 1;
            } else {
                statusBadge = '<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #059669; border: 1px solid rgba(16, 185, 129, 0.25); font-weight: 800;">✓ Normal</span>';
                priority = 0;
            }

            return { 
                id: product.id, 
                name: safeName, 
                stock, 
                statusBadge, 
                rowStyle, 
                stockVal: stock, 
                priority, 
                minStock: min
            };
        });

        // Ordenar: Prioridad desc (2->1->0) y luego Alfabético
        rows.sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));

        const tableBody = rows.length === 0
            ? '<tr><td colspan="3" style="text-align: center; padding: 2rem; color: var(--text-muted);">No hay productos asociados a este proveedor como fuente principal</td></tr>'
            : rows.map(r => `
                <tr style="${r.rowStyle}">
                    <td style="font-weight: 600; color: var(--text-main);">${r.name}</td>
                    <td style="text-align: right; font-weight: 800; color: var(--text-main);">${r.stock}</td>
                    <td style="text-align: center;">${r.statusBadge}</td>
                </tr>
            `).join('');

        const outOfStockCount = rows.filter(r => r.stockVal <= 0).length;
        const lowStockCount = rows.filter(r => r.stockVal > 0 && r.stockVal <= r.minStock).length;

        const content = `
            <div class="modal-header-gradient" style="margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <h2 style="margin: 0 0 0.25rem 0; font-size: 1.5rem; color: white;">${safeHTML(supplier.name)}</h2>
                        <div style="font-size: 0.9rem; opacity: 0.95; color: white;">Catálogo de productos histórico y stock actual</div>
                    </div>
                    <button class="btn" 
                            style="background: #25d366; color: white; border: none; padding: 0.6rem 1rem; font-weight: bold; display: flex; align-items: center; gap: 0.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.15); border-radius: 8px; font-size: 0.85rem;"
                            onclick="SuppliersView.copyOrderText(${supplierId})">
                        📋 Copiar Pedido
                    </button>
                </div>
                
                <div style="display: flex; gap: 1rem; margin-top: 1.25rem;">
                    <div class="stat-card-order" 
                         onclick="SuppliersView.filterByQuickStatus('sin', event)" 
                         style="flex: 1; cursor: pointer; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.3); padding: 0.75rem; border-radius: 0.5rem; text-align: center; transition: all 0.2s;">
                        <div style="font-size: 0.7rem; text-transform: uppercase; font-weight: bold; margin-bottom: 0.2rem; color: #f87171;">Sin Stock</div>
                        <div style="font-size: 1.5rem; font-weight: 800; color: #ffffff;">${outOfStockCount}</div>
                    </div>
                    <div class="stat-card-order" 
                         onclick="SuppliersView.filterByQuickStatus('bajo', event)"
                         style="flex: 1; cursor: pointer; background: rgba(245, 158, 11, 0.2); border: 1px solid rgba(245, 158, 11, 0.3); padding: 0.75rem; border-radius: 0.5rem; text-align: center; transition: all 0.2s;">
                        <div style="font-size: 0.7rem; text-transform: uppercase; font-weight: bold; margin-bottom: 0.2rem; color: #fbbf24;">Bajo Stock</div>
                        <div style="font-size: 1.5rem; font-weight: 800; color: #ffffff;">${lowStockCount}</div>
                    </div>
                    <div class="stat-card-order" 
                         onclick="SuppliersView.filterByQuickStatus('todos', event)"
                         style="flex: 1; cursor: pointer; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); padding: 0.75rem; border-radius: 0.5rem; text-align: center; transition: all 0.2s;">
                        <div style="font-size: 0.7rem; text-transform: uppercase; font-weight: bold; margin-bottom: 0.2rem; color: rgba(255,255,255,0.85);">Total Items</div>
                        <div style="font-size: 1.5rem; font-weight: 800; color: #ffffff;">${rows.length}</div>
                    </div>
                </div>
            </div>

            <div style="max-height: 400px; overflow-y: auto; border-radius: var(--radius-md); border: 1px solid var(--border);">
                <table class="modal-table" style="margin-top: 0;">
                    <thead style="position: sticky; top: 0; z-index: 10;">
                        <tr>
                            <th style="text-align: left;">Producto</th>
                            <th style="text-align: right;">Stock Actual</th>
                            <th style="text-align: center;">Estado</th>
                        </tr>
                    </thead>
                    <tbody id="supplierProductsBody">${tableBody}</tbody>
                </table>
            </div>
            
            <p style="margin-top: 1rem; font-size: 0.85rem; color: var(--text-muted); text-align: center; font-style: italic;">
                ℹ️ Tip: Haz clic en las tarjetas de arriba para filtrar, o en el botón verde para copiar el pedido completo (Sin Stock + Bajo Stock).
            </p>
        `;

        const footer = '<button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>';
        showModal(content, { title: `Inventario por Proveedor - ${safeHTML(supplier.name)}`, footer, width: '750px' });
    },

    /**
     * Genera un texto formateado con los productos faltantes y lo copia al portapapeles.
     */
    async copyOrderText(supplierId) {
        const supplier = await Supplier.getById(supplierId);
        const products = await Product.getByLastSupplier(supplierId);

        const missing = products.filter(p => (parseFloat(p.stock) || 0) <= (parseFloat(p.minStock) || 0));

        if (missing.length === 0) {
            showNotification('¡Genial! No tienes productos con bajo stock de este proveedor.', 'info');
            return;
        }

        // Ordenar por stock (0 primero)
        missing.sort((a, b) => (parseFloat(a.stock) || 0) - (parseFloat(b.stock) || 0));

        let text = `📦 *PEDIDO PARA: ${supplier.name.toUpperCase()}*\n`;
        text += `📅 Fecha: ${new Date().toLocaleDateString('es-CL')}\n`;
        text += `--------------------------------------\n\n`;

        text += `⚠️ *PRODUCTOS A REPOSICIÓN:*\n\n`;

        missing.forEach(p => {
            const stock = parseFloat(p.stock) || 0;
            const min = parseFloat(p.minStock) || 0;
            const max = parseFloat(p.maxStock) || 0;

            let suggested = '';
            if (max > 0) {
                const diff = max - stock;
                suggested = ` (Pedir: ${diff} ${p.type === 'weight' ? 'kg' : 'un'})`;
            } else {
                suggested = ` (Reponer Stock)`;
            }

            const emoji = stock <= 0 ? '🔴' : '🟡';
            text += `${emoji} *${p.name.trim()}*\n`;
            text += `   - Stock Actual: ${stock}\n`;
            text += `   - *${suggested}*\n`;
            if (p.barcode) text += `   - Cód: ${p.barcode}\n`;
            text += `\n`;
        });

        text += `--------------------------------------\n`;
        text += `_Generado automáticamente por POS Minimarket_`;

        try {
            await navigator.clipboard.writeText(text);
            showNotification('✅ Lista de pedido copiada al portapapeles. ¡Pégala en WhatsApp!', 'success');
        } catch (err) {
            console.error('Error al copiar:', err);
            // Fallback: mostrar en un modal si falla clipboard API
            showModal(`<textarea style="width:100%; height:300px; background: #000; color: #0f0; padding:10px; font-family: monospace;">${text}</textarea>`, {
                title: 'Copia este texto manualmente',
                footer: '<button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>'
            });
        }
    },

    /**
     * Filtra visualmente los productos por su estado (rápido).
     */
    filterByQuickStatus(status, event) {
        const rows = document.querySelectorAll('#supplierProductsBody tr');

        rows.forEach(row => {
            const badgeText = row.querySelector('.badge')?.textContent || '';

            if (status === 'sin') {
                row.style.display = badgeText.includes('Sin Stock') ? '' : 'none';
            } else if (status === 'bajo') {
                row.style.display = badgeText.includes('Bajo Stock') ? '' : 'none';
            } else {
                row.style.display = '';
            }
        });

        // Feedback visual en las tarjetas
        const cards = document.querySelectorAll('.stat-card-order');
        cards.forEach(c => {
            c.style.transform = 'scale(1)';
            c.style.boxShadow = 'none';
            c.style.filter = 'brightness(1)';
            c.style.border = '1px solid rgba(255,255,255,0.1)';
        });

        // El elemento clickeado se verá activo
        if (event && event.currentTarget) {
            const card = event.currentTarget;
            card.style.transform = 'scale(1.05)';
            card.style.filter = 'brightness(1.5)';
            card.style.border = '2px solid white';
            card.style.boxShadow = '0 0 15px rgba(255,255,255,0.2)';
        }
    },

    filterMissingProducts(supplierId) {
        // Redireccionar al nuevo sistema rápido
    },

    async showPurchaseOrdersList() {
        const suppliers = await Supplier.getAll();
        const purchaseOrders = JSON.parse(localStorage.getItem('purchaseOrders') || '[]');

        const content = `
            <div class="modal-header-gradient" style="margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <h2 style="margin: 0; font-size: 1.5rem; color: white;">📦 Órdenes de Compra</h2>
                        <div style="font-size: 0.9rem; opacity: 0.95; color: white; margin-top: 0.25rem;">Control y estado de pedidos realizados</div>
                    </div>
                    <button class="btn btn-primary" style="background: white; color: var(--primary); font-weight: bold; border: none; box-shadow: 0 4px 6px rgba(0,0,0,0.1);" onclick="closeModal(); SuppliersView.showCreatePurchaseOrderForm()">
                        + Nueva Orden
                    </button>
                </div>
            </div>

            <div id="purchaseOrdersList" style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 450px; overflow-y: auto; padding: 0.25rem;">
                ${purchaseOrders.length === 0 ? 
                    '<div class="empty-state">No hay órdenes de compra registradas</div>' :
                    purchaseOrders.sort((a, b) => new Date(b.date) - new Date(a.date)).map(order => {
                        const supplier = suppliers.find(s => s.id === order.supplierId);
                        const statusBadge = order.status === 'pending'
                            ? '<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.25); font-weight: 800;">Pendiente</span>'
                            : order.status === 'completed'
                                ? '<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #059669; border: 1px solid rgba(16, 185, 129, 0.25); font-weight: 800;">Completada</span>'
                                : '<span class="badge" style="background: rgba(100, 116, 139, 0.15); color: #475569; border: 1px solid rgba(100, 116, 139, 0.25); font-weight: 800;">Cancelada</span>';

                        return `
                            <div class="modal-list-card">
                                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                                    <div>
                                        <div style="font-weight: 800; color: var(--text-main); font-size: 1.05rem;">Orden #${order.id}</div>
                                        <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500; margin-top: 0.25rem;">
                                            👤 Proveedor: <span style="font-weight: 700; color: var(--text-main);">${supplier ? supplier.name : 'Desconocido'}</span>
                                        </div>
                                        <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500; margin-top: 0.1rem;">
                                            📅 Fecha: <span>${formatDateTime(order.date)}</span>
                                        </div>
                                    </div>
                                    <div style="text-align: right; min-width: 120px;">
                                        <div style="font-weight: 900; color: var(--primary); font-size: 1.15rem; margin-bottom: 0.25rem;">${formatCLP(order.total)}</div>
                                        <div style="margin-bottom: 0.5rem;">${statusBadge}</div>
                                    </div>
                                </div>
                                <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border); display: flex; gap: 0.5rem;">
                                    <button class="btn btn-sm btn-secondary" style="font-weight: 700;" onclick="closeModal(); SuppliersView.viewPurchaseOrder('${order.id}')">👁️ Detalles</button>
                                    ${order.status === 'pending' ? `
                                        <button class="btn btn-sm btn-success" style="font-weight: 700;" onclick="SuppliersView.markOrderAsCompleted('${order.id}')">✓ Completar</button>
                                    ` : ''}
                                </div>
                            </div>
                        `;
                    }).join('')
                }
            </div>
        `;

        const footer = '<button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>';
        showModal(content, { title: 'Órdenes de Compra', footer, width: '700px' });
    },

    async showCreatePurchaseOrderForm() {
        const suppliers = await Supplier.getAll();
        const products = await Product.getAll();

        const content = `
            <div class="modal-header-gradient" style="margin-bottom: 1.5rem;">
                <h2 style="margin: 0; font-size: 1.5rem; color: white;">📦 Nueva Orden de Compra</h2>
                <div style="font-size: 0.9rem; opacity: 0.95; color: white; margin-top: 0.25rem;">Crea un registro de pedido para tus proveedores</div>
            </div>

            <form id="purchaseOrderForm" style="padding: 0 0.5rem;" onsubmit="event.preventDefault();">
                <div class="form-group">
                    <label style="font-weight: 700; color: var(--text-main);">Proveedor *</label>
                    <select id="poSupplierId" class="form-control">
                        <option value="">Seleccionar proveedor...</option>
                        ${suppliers.filter(s => !s.deleted).map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                    </select>
                </div>

                <div class="form-group" style="padding: 1rem; background: #f8fafc; border: 1px solid var(--border); border-radius: var(--radius-md); margin-bottom: 1.25rem;">
                    <label style="font-weight: 800; color: var(--text-main); margin-bottom: 0.5rem; display: block;">Agregar Productos</label>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <select id="poProductSelect" class="form-control" style="flex: 2; min-width: 200px;">
                            <option value="">Seleccionar producto...</option>
                            ${products.filter(p => !p.deleted).map(p => `<option value="${p.id}">${p.name} - $${formatCLP(p.cost)}</option>`).join('')}
                        </select>
                        <input type="number" id="poProductQty" class="form-control" placeholder="Cant." style="flex: 0.7; min-width: 80px;" min="1">
                        <button class="btn btn-primary" style="font-weight: 700;" onclick="SuppliersView.addProductToOrder()">Agregar</button>
                    </div>
                    <div id="poSelectedProducts" style="margin-top: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem;"></div>
                </div>

                <div class="form-group">
                    <label style="font-weight: 700; color: var(--text-main);">Notas / Observaciones</label>
                    <textarea id="poNotes" class="form-control" rows="2" placeholder="Notas adicionales sobre el pedido..."></textarea>
                </div>

                <div style="background: #1e293b; padding: 1rem; border-radius: var(--radius-md); margin-top: 1.25rem;">
                    <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 1.2rem; color: #38bdf8;">
                        <span>Total de la Orden:</span>
                        <span id="poTotal">$0</span>
                    </div>
                </div>
            </form>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="closeModal(); SuppliersView.showPurchaseOrdersList()">Volver</button>
            <button class="btn btn-primary" onclick="SuppliersView.createPurchaseOrder()">Crear Orden</button>
        `;

        showModal(content, { title: 'Nueva Orden de Compra', footer, width: '600px' });
        this._selectedProducts = [];
    },

    addProductToOrder() {
        const productId = document.getElementById('poProductSelect').value;
        const qty = parseInt(document.getElementById('poProductQty').value);

        if (!productId || !qty || qty < 1) {
            showNotification('Selecciona un producto y cantidad válida', 'warning');
            return;
        }

        Product.getById(productId).then(product => {
            if (!product) return;

            this._selectedProducts.push({
                productId,
                name: product.name,
                cost: product.cost,
                quantity: qty,
                total: product.cost * qty
            });

            this.updatePurchaseOrderUI();
            document.getElementById('poProductSelect').value = '';
            document.getElementById('poProductQty').value = '';
        });
    },

    updatePurchaseOrderUI() {
        const container = document.getElementById('poSelectedProducts');
        const totalEl = document.getElementById('poTotal');

        if (!container) return;

        container.innerHTML = this._selectedProducts.map((item, index) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 0.25rem;">
                <span>${item.name} x${item.quantity}</span>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <span>${formatCLP(item.total)}</span>
                    <button class="btn btn-sm btn-danger" onclick="SuppliersView.removeProductFromOrder(${index})">×</button>
                </div>
            </div>
        `).join('');

        const total = this._selectedProducts.reduce((sum, item) => sum + item.total, 0);
        if (totalEl) totalEl.textContent = formatCLP(total);
    },

    removeProductFromOrder(index) {
        this._selectedProducts.splice(index, 1);
        this.updatePurchaseOrderUI();
    },

    async createPurchaseOrder() {
        const supplierId = document.getElementById('poSupplierId').value;
        const notes = document.getElementById('poNotes').value;

        if (!supplierId) {
            showNotification('Selecciona un proveedor', 'warning');
            return;
        }

        if (this._selectedProducts.length === 0) {
            showNotification('Agrega al menos un producto', 'warning');
            return;
        }

        const purchaseOrders = JSON.parse(localStorage.getItem('purchaseOrders') || '[]');
        const total = this._selectedProducts.reduce((sum, item) => sum + item.total, 0);

        const newOrder = {
            id: Date.now().toString(),
            supplierId,
            items: this._selectedProducts,
            total,
            notes,
            status: 'pending',
            date: new Date().toISOString()
        };

        purchaseOrders.push(newOrder);
        localStorage.setItem('purchaseOrders', JSON.stringify(purchaseOrders));

        closeModal();
        showNotification('Orden de compra creada exitosamente', 'success');
        this.showPurchaseOrdersList();
    },

    async viewPurchaseOrder(orderId) {
        const purchaseOrders = JSON.parse(localStorage.getItem('purchaseOrders') || '[]');
        const order = purchaseOrders.find(o => o.id === orderId);

        if (!order) {
            showNotification('Orden no encontrada', 'error');
            return;
        }

        const supplier = await Supplier.getById(order.supplierId);
        const statusBadge = order.status === 'pending'
            ? '<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.25); font-weight: 800;">Pendiente</span>'
            : order.status === 'completed'
                ? '<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #059669; border: 1px solid rgba(16, 185, 129, 0.25); font-weight: 800;">Completada</span>'
                : '<span class="badge" style="background: rgba(100, 116, 139, 0.15); color: #475569; border: 1px solid rgba(100, 116, 139, 0.25); font-weight: 800;">Cancelada</span>';

        const content = `
            <div class="modal-header-gradient" style="margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <h2 style="margin: 0; font-size: 1.5rem; color: white;">Orden #${order.id}</h2>
                        <div style="font-size: 0.9rem; opacity: 0.95; color: white; margin-top: 0.25rem;">
                            👤 Proveedor: ${supplier ? supplier.name : 'Desconocido'}
                        </div>
                    </div>
                    <div>${statusBadge}</div>
                </div>
            </div>

            <div style="padding: 0 0.5rem;">
                <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500; margin-bottom: 1rem;">
                    📅 Fecha de emisión: <span style="font-weight: 700; color: var(--text-main);">${formatDateTime(order.date)}</span>
                </div>

                <h3 style="font-size: 1.05rem; color: var(--text-main); font-weight: 800; margin-bottom: 0.5rem;">📋 Productos de la Orden</h3>
                <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.25rem; max-height: 250px; overflow-y: auto;">
                    ${order.items.map(item => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 0.85rem; background: #f8fafc; border: 1px solid var(--border); border-radius: 6px;">
                            <span style="font-weight: 600; color: var(--text-main);">${item.name} <span style="color: var(--text-muted); font-weight: 500;">x${item.quantity}</span></span>
                            <span style="font-weight: 800; color: var(--primary);">${formatCLP(item.total)}</span>
                        </div>
                    `).join('')}
                </div>

                ${order.notes ? `
                    <div style="margin-bottom: 1.25rem;">
                        <h4 style="font-size: 0.9rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase; margin-bottom: 0.25rem;">Notas</h4>
                        <div style="padding: 0.75rem; background: #f1f5f9; border-radius: 6px; border-left: 3px solid #cbd5e1; color: var(--text-main); font-size: 0.9rem;">
                            ${safeHTML(order.notes)}
                        </div>
                    </div>
                ` : ''}

                <div style="background: #1e293b; padding: 1rem; border-radius: var(--radius-md); margin-top: 1rem;">
                    <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 1.2rem; color: #38bdf8;">
                        <span>Total:</span>
                        <span>${formatCLP(order.total)}</span>
                    </div>
                </div>
            </div>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="closeModal(); SuppliersView.showPurchaseOrdersList()">Volver</button>
            <button class="btn btn-primary" onclick="closeModal()">Cerrar</button>
        `;

        showModal(content, { title: 'Detalle de Orden de Compra', footer, width: '500px' });
    },

    markOrderAsCompleted(orderId) {
        const purchaseOrders = JSON.parse(localStorage.getItem('purchaseOrders') || '[]');
        const orderIndex = purchaseOrders.findIndex(o => o.id === orderId);

        if (orderIndex === -1) {
            showNotification('Orden no encontrada', 'error');
            return;
        }

        purchaseOrders[orderIndex].status = 'completed';
        localStorage.setItem('purchaseOrders', JSON.stringify(purchaseOrders));

        showNotification('Orden marcada como completada', 'success');
        closeModal();
        this.showPurchaseOrdersList();
    },

    async showPriceHistory() {
        const suppliers = await Supplier.getAll();
        const products = await Product.getAll();
        const priceHistory = JSON.parse(localStorage.getItem('priceHistory') || '[]');

        const content = `
            <div class="modal-header-gradient" style="margin-bottom: 1.5rem;">
                <h2 style="margin: 0; font-size: 1.5rem; color: white;">📈 Historial de Precios</h2>
                <div style="font-size: 0.9rem; opacity: 0.95; color: white; margin-top: 0.25rem;">Cambios recientes de precios de costo por proveedor</div>
            </div>

            <div id="priceHistoryList" style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 450px; overflow-y: auto; padding: 0.25rem;">
                ${priceHistory.length === 0 ? 
                    '<div class="empty-state">No hay historial de precios registrado</div>' :
                    priceHistory.sort((a, b) => new Date(b.date) - new Date(a.date)).map(entry => {
                        const supplier = suppliers.find(s => s.id === entry.supplierId);
                        const product = products.find(p => p.id === entry.productId);
                        const isIncrease = entry.newPrice > entry.oldPrice;
                        return `
                            <div class="modal-list-card">
                                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                                    <div>
                                        <div style="font-weight: 800; color: var(--text-main); font-size: 1rem;">${product ? product.name : 'Producto desconocido'}</div>
                                        <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500; margin-top: 0.15rem;">
                                            👤 Proveedor: <span style="font-weight: 700; color: var(--text-main);">${supplier ? supplier.name : 'Desconocido'}</span>
                                        </div>
                                        <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500; margin-top: 0.1rem;">
                                            📅 Fecha: <span>${formatDateTime(entry.date)}</span>
                                        </div>
                                    </div>
                                    <div style="text-align: right; min-width: 120px;">
                                        <div style="font-weight: 900; color: var(--primary); font-size: 1.15rem;">${formatCLP(entry.newPrice)}</div>
                                        <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">Anterior: ${formatCLP(entry.oldPrice)}</div>
                                        <div style="font-size: 0.8rem; color: ${isIncrease ? '#ef4444' : '#10b981'}; font-weight: 700; margin-top: 0.1rem;">
                                            ${isIncrease ? '📈 ↑' : '📉 ↓'} ${Math.abs(((entry.newPrice - entry.oldPrice) / (entry.oldPrice || 1)) * 100).toFixed(1)}%
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')
                }
            </div>
        `;

        const footer = '<button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>';
        showModal(content, { title: 'Historial de Precios', footer, width: '700px' });
    },

    async showSupplierEvaluation() {
        const suppliers = await Supplier.getAll();
        const purchaseOrders = JSON.parse(localStorage.getItem('purchaseOrders') || '[]');
        const evaluations = JSON.parse(localStorage.getItem('supplierEvaluations') || '{}');

        const content = `
            <div class="modal-header-gradient" style="margin-bottom: 1.5rem;">
                <h2 style="margin: 0; font-size: 1.5rem; color: white;">⭐ Evaluación de Proveedores</h2>
                <div style="font-size: 0.9rem; opacity: 0.95; color: white; margin-top: 0.25rem;">Calificaciones de calidad y cumplimiento de entregas</div>
            </div>

            <div id="supplierEvaluationsList" style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 450px; overflow-y: auto; padding: 0.25rem;">
                ${suppliers.filter(s => !s.deleted).map(supplier => {
                    const supplierOrders = purchaseOrders.filter(po => po.supplierId === supplier.id);
                    const evaluation = evaluations[supplier.id] || { rating: 0, notes: '' };
                    const avgRating = evaluation.rating || (supplierOrders.length > 0 ? 4 : 0);

                    return `
                        <div class="modal-list-card">
                            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                                <div>
                                    <div style="font-weight: 800; color: var(--text-main); font-size: 1.05rem;">${supplier.name}</div>
                                    <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500; margin-top: 0.25rem;">
                                        📦 Órdenes de compra: <span style="font-weight: 700; color: var(--text-main);">${supplierOrders.length}</span>
                                    </div>
                                    <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500; margin-top: 0.1rem;">
                                        📞 Contacto: <span>${supplier.phone || 'No registrado'}</span>
                                    </div>
                                    ${evaluation.notes ? `
                                        <div style="margin-top: 0.5rem; font-size: 0.85rem; padding: 0.5rem; background: #f1f5f9; border-radius: 6px; border-left: 3px solid #cbd5e1; color: var(--text-main); font-style: italic;">
                                            "${safeHTML(evaluation.notes)}"
                                        </div>
                                    ` : ''}
                                </div>
                                <div style="text-align: right; min-width: 100px;">
                                    <div style="font-size: 1.25rem; color: #f59e0b;">
                                        ${avgRating > 0 ? '⭐'.repeat(Math.round(avgRating)) + '☆'.repeat(5 - Math.round(avgRating)) : 'Sin evaluar'}
                                    </div>
                                    <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 700; margin-top: 0.15rem;">
                                        ${avgRating > 0 ? `${avgRating.toFixed(1)} / 5.0` : '-'}
                                    </div>
                                    <button class="btn btn-sm btn-secondary" style="margin-top: 0.5rem; font-weight: 700;" onclick="closeModal(); SuppliersView.showEvaluationForm('${supplier.id}')">
                                        ⭐ Evaluar
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        const footer = '<button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>';
        showModal(content, { title: 'Evaluación de Proveedores', footer, width: '700px' });
    },

    async showEvaluationForm(supplierId) {
        const supplier = await Supplier.getById(supplierId);
        const evaluations = JSON.parse(localStorage.getItem('supplierEvaluations') || '{}');
        const currentEvaluation = evaluations[supplierId] || { rating: 0, notes: '' };

        const content = `
            <div class="modal-header-gradient" style="margin-bottom: 1.5rem;">
                <h2 style="margin: 0; font-size: 1.5rem; color: white;">⭐ Evaluar Proveedor</h2>
                <div style="font-size: 0.9rem; opacity: 0.95; color: white; margin-top: 0.25rem;">${safeHTML(supplier.name)}</div>
            </div>

            <form id="supplierEvaluationForm" style="padding: 0 0.5rem;">
                <div class="form-group">
                    <label style="font-weight: 700; color: var(--text-main);">Calificación (1-5) *</label>
                    <div style="display: flex; gap: 0.5rem; margin-top: 0.25rem; margin-bottom: 0.5rem;">
                        ${[1, 2, 3, 4, 5].map(star => `
                            <button type="button" class="btn ${currentEvaluation.rating >= star ? 'btn-warning' : 'btn-secondary'}" 
                                    style="font-size: 1.25rem; padding: 0.5rem 0.75rem; border-radius: 8px; transition: all 0.15s;"
                                    onclick="SuppliersView.setRating(${star})" 
                                    id="ratingStar${star}">
                                ⭐
                            </button>
                        `).join('')}
                    </div>
                    <input type="hidden" id="evaluationRating" value="${currentEvaluation.rating}">
                </div>

                <div class="form-group">
                    <label style="font-weight: 700; color: var(--text-main);">Comentarios / Notas</label>
                    <textarea id="evaluationNotes" class="form-control" rows="3" placeholder="Comentarios sobre tiempos de entrega, calidad de productos, etc...">${currentEvaluation.notes || ''}</textarea>
                </div>

                <div style="background: rgba(59, 130, 246, 0.08); color: #1e3a8a; padding: 0.85rem; border-radius: var(--radius-md); font-size: 0.85rem; margin-top: 1.25rem; border: 1px solid rgba(59, 130, 246, 0.15); line-height: 1.4;">
                    ℹ️ <strong>Nota contable:</strong> Esta calificación servirá de apoyo en decisiones de compra y reportes de proveedores.
                </div>
            </form>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="closeModal(); SuppliersView.showSupplierEvaluation()">Volver</button>
            <button class="btn btn-primary" onclick="SuppliersView.saveEvaluation('${supplierId}')">Guardar Evaluación</button>
        `;

        showModal(content, { title: 'Evaluar Proveedor', footer, width: '500px' });
    },

    setRating(rating) {
        document.getElementById('evaluationRating').value = rating;
        
        // Actualizar visualmente las estrellas
        for (let i = 1; i <= 5; i++) {
            const starBtn = document.getElementById(`ratingStar${i}`);
            if (starBtn) {
                starBtn.className = `btn btn-sm ${i <= rating ? 'btn-warning' : 'btn-secondary'}`;
            }
        }
    },

    saveEvaluation(supplierId) {
        const rating = parseInt(document.getElementById('evaluationRating').value);
        const notes = document.getElementById('evaluationNotes').value;

        if (rating < 1 || rating > 5) {
            showNotification('Selecciona una calificación válida (1-5)', 'warning');
            return;
        }

        const evaluations = JSON.parse(localStorage.getItem('supplierEvaluations') || '{}');
        evaluations[supplierId] = { rating, notes, date: new Date().toISOString() };
        localStorage.setItem('supplierEvaluations', JSON.stringify(evaluations));

        closeModal();
        showNotification('Evaluación guardada exitosamente', 'success');
        this.showSupplierEvaluation();
    }
};
