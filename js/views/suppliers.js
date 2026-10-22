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
                <div style="display: flex; gap: 0.75rem; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 250px;">
                        <input type="text" 
                               id="searchSuppliers" 
                               class="form-control supplier-search-control" 
                               placeholder="🔍 Buscar proveedor por nombre o RUT..."
                               style="height: 42px; font-size: 0.95rem;">
                    </div>
                    <div style="display: flex; gap: 0.4rem; align-items: center;">
                        <button type="button" 
                                id="btnFilterAllSuppliers" 
                                class="btn btn-sm ${!this.debtOnly ? 'btn-primary' : 'btn-secondary'}" 
                                onclick="SuppliersView.setDebtFilter(false)"
                                style="font-weight: 800; border-radius: 8px; padding: 0.5rem 0.9rem;">
                            Todos
                        </button>
                        <button type="button" 
                                id="btnFilterDebtSuppliers" 
                                class="btn btn-sm ${this.debtOnly ? 'btn-danger' : 'btn-secondary'}" 
                                onclick="SuppliersView.setDebtFilter(true)"
                                style="font-weight: 800; border-radius: 8px; padding: 0.5rem 0.9rem; display: flex; align-items: center; gap: 0.35rem;"
                                title="Mostrar solo proveedores con facturas o compras pendientes de pago">
                            <span>🚨</span>
                            <span>Solo con Deuda</span>
                        </button>
                    </div>
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
        if (searchInput) {
            searchInput.addEventListener('input', async () => {
                await this.applySupplierFilters();
            });
        }

        // C6: Cargar deudas de proveedores
        const suppliers = await Supplier.getAll();
        await this.loadSupplierDebts(suppliers);
    },

    /**
     * C6: Cargar y mostrar deuda de cada proveedor en la tabla.
     */
    async loadSupplierDebts(suppliers) {
        if (!this.supplierDebtsMap) this.supplierDebtsMap = new Map();
        for (const s of suppliers) {
            try {
                const detail = await SupplierPaymentService.getDebtDetail(s.id);
                const pending = detail.filter(d => d.balance >= 1);
                const debt = pending.reduce((sum, item) => sum + item.balance, 0);
                this.supplierDebtsMap.set(s.id, debt);
                
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
        let activeOrder = null;
        try {
            const raw = localStorage.getItem('CF_ACTIVE_PURCHASE_ORDER');
            if (raw) activeOrder = JSON.parse(raw);
        } catch (e) {}

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

                        ${(() => {
                            const hasActive = activeOrder && (
                                (activeOrder.supplierId && String(activeOrder.supplierId) === String(s.id)) ||
                                (activeOrder.supplierName && (activeOrder.supplierName || '').trim().toLowerCase() === (s.name || '').trim().toLowerCase())
                            );
                            if (!hasActive) return '';
                            return `
                                <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 1.5px solid #3b82f6; border-radius: 0.65rem; padding: 0.65rem 0.85rem; margin-top: 0.65rem; display: flex; flex-direction: column; gap: 0.35rem;">
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <span style="font-size: 0.72rem; font-weight: 900; color: #1d4ed8; text-transform: uppercase; display: flex; align-items: center; gap: 0.3rem;">
                                            <span>📋</span> Pedido Activo Guardado
                                        </span>
                                        <span style="font-size: 0.8rem; font-weight: 900; color: #1e40af;">
                                            ${formatCLP(activeOrder.totalEstimated || activeOrder.estimatedTotal || 0)}
                                        </span>
                                    </div>
                                    <div style="font-size: 0.76rem; color: #334155;">
                                        ${activeOrder.items?.length || 0} productos pedidos (${activeOrder.createdAt ? formatDateTime(activeOrder.createdAt) : 'Reciente'})
                                    </div>
                                    <div style="display: flex; gap: 0.4rem; margin-top: 0.2rem;">
                                        <button class="btn btn-sm btn-primary" style="flex: 1; font-size: 0.75rem; padding: 0.3rem 0.5rem; font-weight: 800; background: #2563eb;" onclick="SuppliersView.showActiveOrderModal('${safeAttr(s.name)}')">
                                            👁️ Ver Lista
                                        </button>
                                        <button class="btn btn-sm" style="font-size: 0.75rem; padding: 0.3rem 0.6rem; background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5;" onclick="SuppliersView.cancelActiveOrder()" title="Descartar lista">
                                            ✕ Descartar
                                        </button>
                                    </div>
                                </div>
                            `;
                        })()}

                        <div class="supplier-card-actions">
                            <button class="btn btn-sm" style="background: rgba(245, 158, 11, 0.12); color: #b45309; border: 1.5px solid rgba(245, 158, 11, 0.35); font-weight: 850;" onclick="SuppliersView.openOrderSuggestionsForSupplier('${safeAttr(s.name)}')" title="Armar pedido sugerido para este proveedor">
                                💡 Pedido
                            </button>
                            <button class="btn btn-sm" style="background: rgba(16, 185, 129, 0.08); color: #059669; border: 1px solid rgba(16, 185, 129, 0.2);" onclick="SuppliersView.showSupplierPaymentForm(${s.id})" title="Registrar pago a proveedor">
                                💰 Pagar
                            </button>
                            <button class="btn btn-sm" style="background: rgba(59, 130, 246, 0.08); color: #2563eb; border: 1px solid rgba(59, 130, 246, 0.2);" onclick="SuppliersView.showSupplierHistory(${s.id})" title="Ver historial de compras y pagos">
                                📋 Historial
                            </button>
                            <button class="btn btn-sm" style="background: rgba(139, 92, 246, 0.08); color: #7c3aed; border: 1px solid rgba(139, 92, 246, 0.2);" onclick="SuppliersView.showProductsBySupplier(${s.id})" title="Ver stock de productos de este proveedor">
                                📦 Stock
                            </button>
                            <button class="btn btn-sm" style="background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; font-weight: 800;" onclick="SuppliersView.contactSupplierWhatsApp(${s.id})" title="Contactar por WhatsApp">
                                💬 WhatsApp
                            </button>
                            <button class="btn btn-sm" style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; font-weight: 800;" onclick="SuppliersView.contactSupplierEmail(${s.id})" title="Enviar correo desde Gmail">
                                ✉️ Correo
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

        const footer = `
            <div style="display: flex; justify-content: space-between; width: 100%; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <button class="btn btn-secondary" onclick="SuppliersView.exportSupplierAccountStatementPDF(${supplierId})" style="font-weight: 800; display: flex; align-items: center; gap: 0.4rem; background: #ffffff; border: 1.5px solid #cbd5e1; color: #1e293b;">
                    <span>📄</span> <span>Estado de Cuenta (PDF)</span>
                </button>
                <button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>
            </div>
        `;
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
            <div class="modal-header-gradient" style="margin-bottom: 1.25rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <h2 style="margin: 0; font-size: 1.45rem; color: white;">📦 Órdenes de Compra</h2>
                        <div style="font-size: 0.85rem; opacity: 0.95; color: white; margin-top: 0.25rem;">Control y estado de pedidos realizados a proveedores</div>
                    </div>
                    <button type="button" class="btn btn-primary" style="background: #2563eb !important; color: #ffffff !important; font-weight: 900; border: none; box-shadow: 0 4px 12px rgba(37,99,235,0.35); border-radius: 0.6rem; padding: 0.55rem 1.25rem; display: flex; align-items: center; gap: 0.45rem; font-size: 0.9rem;" onclick="closeModal(); SuppliersView.showCreatePurchaseOrderForm()">
                        <span style="font-size: 1.1rem; line-height: 1;">➕</span> Nueva Orden
                    </button>
                </div>
            </div>

            <div id="purchaseOrdersList" style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 500px; overflow-y: auto; padding: 0.25rem;">
                ${purchaseOrders.length === 0 ? 
                    '<div class="empty-state" style="padding: 2.5rem 1rem; text-align: center; color: #64748b; font-weight: 700;">No hay órdenes de compra registradas aún. Haz clic en <strong>+ Nueva Orden</strong> para crear una.</div>' :
                    purchaseOrders.sort((a, b) => new Date(b.date) - new Date(a.date)).map(order => {
                        const supplier = suppliers.find(s => s.id === order.supplierId || String(s.id) === String(order.supplierId));
                        const isCompleted = order.status === 'completed';
                        const statusBadge = isCompleted
                            ? '<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #059669; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 900; padding: 0.25rem 0.65rem; border-radius: 999px;">✅ Realizada</span>'
                            : '<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.3); font-weight: 900; padding: 0.25rem 0.65rem; border-radius: 999px;">⏳ Pendiente</span>';

                        const itemsCount = Array.isArray(order.items) ? order.items.length : 0;

                        return `
                            <div class="modal-list-card" style="background: #ffffff; border: 1.5px solid ${isCompleted ? '#bbf7d0' : '#e2e8f0'}; border-radius: 0.85rem; padding: 1rem 1.15rem; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem;">
                                    <div>
                                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                                            <span style="font-weight: 950; color: #0f172a; font-size: 1.05rem;">Orden #${order.id}</span>
                                            ${statusBadge}
                                        </div>
                                        <div style="font-size: 0.88rem; color: #475569; font-weight: 600; margin-top: 0.3rem;">
                                            🚚 Proveedor: <strong style="color: #0f172a;">${safeHTML(supplier ? supplier.name : 'Desconocido')}</strong>
                                        </div>
                                        <div style="font-size: 0.78rem; color: #64748b; margin-top: 0.15rem;">
                                            📅 Creada: ${formatDateTime(order.date)} • 📦 ${itemsCount} producto(s)
                                        </div>
                                    </div>
                                    <div style="text-align: right; min-width: 120px;">
                                        <span style="font-size: 0.72rem; color: #64748b; font-weight: 800; text-transform: uppercase;">Total Estimado:</span>
                                        <div style="font-weight: 950; color: #2563eb; font-size: 1.25rem; line-height: 1.1;">${formatCLP(order.total)}</div>
                                    </div>
                                </div>
                                <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                                        <button type="button" class="btn btn-sm btn-secondary" style="font-weight: 800; border-radius: 0.5rem; font-size: 0.8rem;" onclick="closeModal(); SuppliersView.viewPurchaseOrder('${order.id}')">
                                            👁️ Ver Detalles
                                        </button>
                                        <button type="button" class="btn btn-sm ${isCompleted ? 'btn-outline-warning' : 'btn-success'}" style="font-weight: 850; border-radius: 0.5rem; font-size: 0.8rem; display: flex; align-items: center; gap: 0.25rem;" onclick="SuppliersView.togglePurchaseOrderStatus('${order.id}')">
                                            ${isCompleted ? '↩ Reabrir (Pendiente)' : '✓ Marcar como Realizado'}
                                        </button>
                                    </div>
                                    <button type="button" class="btn btn-sm btn-outline-danger" style="font-weight: 800; border-radius: 0.5rem; font-size: 0.8rem; display: flex; align-items: center; gap: 0.25rem;" onclick="SuppliersView.deletePurchaseOrder('${order.id}')" title="Eliminar orden">
                                        🗑️ Eliminar
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')
                }
            </div>
        `;

        const footer = '<button class="btn btn-secondary" style="font-weight: 800; border-radius: 0.6rem; padding: 0.5rem 1.25rem;" onclick="closeModal()">Cerrar</button>';
        showModal(content, { title: 'Órdenes de Compra', footer, width: '750px' });
    },

    togglePurchaseOrderStatus(orderId) {
        let purchaseOrders = JSON.parse(localStorage.getItem('purchaseOrders') || '[]');
        const order = purchaseOrders.find(o => String(o.id) === String(orderId));
        if (!order) return;

        order.status = (order.status === 'completed') ? 'pending' : 'completed';
        localStorage.setItem('purchaseOrders', JSON.stringify(purchaseOrders));

        showNotification(order.status === 'completed' ? 'Orden marcada como Realizada' : 'Orden reabierta como Pendiente', 'success');
        this.showPurchaseOrdersList();
    },

    deletePurchaseOrder(orderId) {
        showConfirm(
            '¿Eliminar esta orden de compra?',
            'Esta orden será eliminada permanentemente del registro. Esta acción no se puede deshacer.',
            'SÍ, ELIMINAR',
            'CANCELAR'
        ).then(confirmed => {
            if (confirmed) {
                let purchaseOrders = JSON.parse(localStorage.getItem('purchaseOrders') || '[]');
                purchaseOrders = purchaseOrders.filter(o => String(o.id) !== String(orderId));
                localStorage.setItem('purchaseOrders', JSON.stringify(purchaseOrders));
                showNotification('Orden de compra eliminada', 'success');
                this.showPurchaseOrdersList();
            }
        });
    },

    async getWeeklySalesMap() {
        if (this._weeklySalesMap) return this._weeklySalesMap;
        const map = {};
        try {
            if (typeof Sale !== 'undefined' && Sale.getLatest) {
                const sales = await Sale.getLatest(1000);
                if (Array.isArray(sales)) {
                    const now = Date.now();
                    const msIn28Days = 28 * 24 * 60 * 60 * 1000;
                    sales.forEach(s => {
                        const saleTime = s.date ? new Date(s.date).getTime() : 0;
                        if (now - saleTime <= msIn28Days && Array.isArray(s.items)) {
                            s.items.forEach(it => {
                                const pid = String(it.productId || it.id);
                                if (pid) {
                                    map[pid] = (map[pid] || 0) + (parseFloat(it.quantity) || 0);
                                }
                            });
                        }
                    });
                }
            }
        } catch (e) {
            console.warn('Error calculando ventas semanales:', e);
        }

        const weeklyMap = {};
        Object.keys(map).forEach(pid => {
            weeklyMap[pid] = map[pid] / 4; // Promedio semanal de las últimas 4 semanas
        });
        this._weeklySalesMap = weeklyMap;
        return weeklyMap;
    },

    async showCreatePurchaseOrderForm() {
        const suppliers = await Supplier.getAll();
        const products = await Product.getAll();
        await this.getWeeklySalesMap();

        this._allSuppliers = suppliers;
        this._allProducts = products;
        this._selectedProducts = [];
        this._currentSupplierProducts = [];

        const content = `
            <div style="max-height: 75vh; overflow-y: auto; padding: 0.25rem 0.5rem; display: flex; flex-direction: column; gap: 1rem;">
                <!-- Header informativo -->
                <div class="modal-header-gradient" style="margin: -0.25rem -0.5rem 0 -0.5rem;">
                    <h2 style="margin: 0; font-size: 1.4rem; color: white;">📦 Nueva Orden de Compra</h2>
                    <div style="font-size: 0.85rem; opacity: 0.95; color: white; margin-top: 0.25rem;">
                        Arma tu pedido de mercadería con sugerencias de compra basadas en rotación semanal
                    </div>
                </div>

                <!-- 1. SELECCIÓN DE PROVEEDOR -->
                <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 0.85rem; padding: 1rem;">
                    <label style="font-weight: 900; font-size: 0.82rem; color: #0f172a; text-transform: uppercase; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.4rem;">
                        <span>🚚</span> 1. SELECCIONA EL PROVEEDOR *
                    </label>
                    <select id="poSupplierId" class="form-control" style="height: 42px; font-weight: 850; font-size: 0.95rem; border-radius: 0.6rem; border: 2px solid #cbd5e1; background: #ffffff;" onchange="SuppliersView.onOrderSupplierChanged(this.value)">
                        <option value="">-- Elige un proveedor para filtrar sus productos --</option>
                        ${suppliers.filter(s => !s.deleted).map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                    </select>
                    <div id="poSupplierCountBadge" style="font-size: 0.8rem; margin-top: 0.4rem; font-weight: 700;"></div>
                </div>

                <!-- 2. BUSCADOR Y SUGERENCIAS DEL PROVEEDOR -->
                <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 0.85rem; padding: 1rem; box-shadow: 0 2px 6px rgba(0,0,0,0.02);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
                        <label style="font-weight: 900; font-size: 0.82rem; color: #0f172a; text-transform: uppercase; margin: 0; display: flex; align-items: center; gap: 0.4rem;">
                            <span>🔍</span> 2. PRODUCTOS Y SUGERENCIAS DE COMPRA
                        </label>
                        <span style="font-size: 0.72rem; font-weight: 850; color: #2563eb; background: #eff6ff; border: 1px solid #bfdbfe; padding: 0.15rem 0.55rem; border-radius: 999px;">
                            💡 Sugerencia: 2 semanas de ventas
                        </span>
                    </div>

                    <div style="position: relative; margin-bottom: 0.75rem;">
                        <input type="text" id="poSearchProductInput" class="form-control" placeholder="Escribe el nombre del producto o escanea su código de barras..." 
                               style="height: 40px; font-size: 0.9rem; font-weight: 700; border-radius: 0.55rem; border: 2px solid #cbd5e1; padding-left: 2.2rem;"
                               oninput="SuppliersView.renderOrderProductSuggestions(this.value)">
                        <span style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); font-size: 0.95rem; color: #94a3b8;">🔍</span>
                    </div>

                    <!-- Contenedor scrollable de productos sugeridos -->
                    <div id="poProductSuggestionsList" style="max-height: 220px; overflow-y: auto; border: 1.5px solid #e2e8f0; border-radius: 0.65rem; background: #f8fafc; padding: 0.25rem;">
                        <div style="text-align: center; padding: 1.5rem; color: #64748b; font-size: 0.85rem;">
                            🚚 Selecciona un proveedor arriba para ver sus productos y recomendaciones automáticas de compra.
                        </div>
                    </div>
                </div>

                <!-- 3. PRODUCTOS SELECCIONADOS EN LA ORDEN -->
                <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 0.85rem; padding: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <label style="font-weight: 900; font-size: 0.82rem; color: #0f172a; text-transform: uppercase; margin: 0; display: flex; align-items: center; gap: 0.4rem;">
                            <span>🛒</span> 3. PRODUCTOS EN ESTE PEDIDO
                        </label>
                        <span id="poSelectedCountBadge" style="font-size: 0.75rem; font-weight: 900; color: #4338ca; background: #e0e7ff; padding: 0.15rem 0.55rem; border-radius: 999px;">
                            0 productos
                        </span>
                    </div>
                    <div id="poSelectedProductsTable" style="max-height: 200px; overflow-y: auto; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 0.6rem;">
                        <div style="text-align: center; padding: 1.5rem; color: #94a3b8; font-size: 0.85rem;">
                            🛒 Aún no has agregado productos al pedido.<br>
                            <span style="font-size: 0.78rem;">Usa el buscador o las sugerencias de arriba para añadir.</span>
                        </div>
                    </div>
                </div>

                <!-- 4. NOTAS Y RESUMEN TOTAL -->
                <div style="display: flex; gap: 1rem; align-items: stretch; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 250px;">
                        <label style="font-weight: 850; font-size: 0.78rem; color: #64748b; text-transform: uppercase; margin-bottom: 0.25rem; display: block;">📝 Notas / Observaciones</label>
                        <textarea id="poNotes" class="form-control" rows="2" placeholder="Ej: Despachar antes de las 12:00, factura con IVA..." style="border-radius: 0.55rem; border: 1.5px solid #cbd5e1; font-size: 0.85rem;"></textarea>
                    </div>
                    <div style="flex: 1; min-width: 220px; background: #0f172a; border-radius: 0.75rem; padding: 0.85rem 1.15rem; display: flex; flex-direction: column; justify-content: center; text-align: right; box-shadow: 0 4px 10px rgba(0,0,0,0.15);">
                        <span style="font-size: 0.72rem; font-weight: 850; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Total Estimado del Pedido:</span>
                        <strong id="poTotalDisplay" style="font-size: 1.65rem; font-weight: 950; color: #38bdf8; line-height: 1.15;">$0</strong>
                    </div>
                </div>
            </div>
        `;

        const footer = `
            <div style="display: flex; justify-content: space-between; width: 100%; gap: 0.5rem; flex-wrap: wrap;">
                <button type="button" class="btn btn-secondary" style="font-weight: 800; border-radius: 0.6rem; padding: 0.55rem 1.15rem;" onclick="closeModal(); SuppliersView.showPurchaseOrdersList()">
                    Volver
                </button>
                <button type="button" class="btn btn-primary" style="background: #2563eb; color: #ffffff; font-weight: 900; border-radius: 0.6rem; padding: 0.55rem 1.35rem; box-shadow: 0 4px 12px rgba(37,99,235,0.3);" onclick="SuppliersView.createPurchaseOrder()">
                    💾 Guardar Orden de Compra
                </button>
            </div>
        `;

        showModal(content, { title: 'Nueva Orden de Compra', footer, width: '800px' });
    },

    onOrderSupplierChanged(supplierId) {
        const countBadge = document.getElementById('poSupplierCountBadge');
        if (!supplierId) {
            this._currentSupplierProducts = [];
            this.renderOrderProductSuggestions('');
            if (countBadge) countBadge.textContent = '';
            return;
        }

        const suppId = parseInt(supplierId);
        const supplier = (this._allSuppliers || []).find(s => s.id === suppId || String(s.id) === String(supplierId));
        const suppName = supplier ? (supplier.name || '').toLowerCase().trim() : '';

        // Filtrar productos asociados a este proveedor por ID o por nombre
        let matching = (this._allProducts || []).filter(p => {
            if (p.deleted) return false;
            const pId = p.supplierId ? parseInt(p.supplierId) : null;
            const pName = (p.supplierName || '').toLowerCase().trim();
            return (pId && pId === suppId) || (suppName && pName === suppName);
        });

        if (matching.length > 0) {
            this._currentSupplierProducts = matching;
            if (countBadge) {
                countBadge.innerHTML = `<span style="color: #059669;">✅ ${matching.length} producto(s) asignados a ${safeHTML(supplier ? supplier.name : '')}</span>`;
            }
        } else {
            // Si el proveedor no tiene productos asignados, permitir buscar entre todos los productos
            this._currentSupplierProducts = (this._allProducts || []).filter(p => !p.deleted);
            if (countBadge) {
                countBadge.innerHTML = `<span style="color: #b45309;">ℹ️ Este proveedor no tiene productos asignados aún. Mostrando todos los productos disponibles para agregar.</span>`;
            }
        }

        const searchInput = document.getElementById('poSearchProductInput');
        this.renderOrderProductSuggestions(searchInput ? searchInput.value : '');
    },

    renderOrderProductSuggestions(query = '') {
        const container = document.getElementById('poProductSuggestionsList');
        if (!container) return;

        const q = (query || '').toLowerCase().trim();
        const pool = this._currentSupplierProducts || [];

        if (pool.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 1.5rem; color: #64748b; font-size: 0.85rem;">
                    🚚 Selecciona un proveedor arriba para ver sus productos y recomendaciones automáticas de compra.
                </div>
            `;
            return;
        }

        let filtered = pool;
        if (q) {
            filtered = pool.filter(p => {
                const name = (p.name || '').toLowerCase();
                const barcode = (p.barcode || '').toLowerCase();
                return name.includes(q) || barcode.includes(q);
            });
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 1.25rem; color: #64748b; font-size: 0.85rem;">
                    🔍 No se encontraron productos que coincidan con "<strong>${safeHTML(q)}</strong>".
                </div>
            `;
            return;
        }

        const salesMap = this._weeklySalesMap || {};
        const decorated = filtered.map(p => {
            const pid = String(p.id);
            const stock = parseFloat(p.stock) || 0;
            const minStock = parseFloat(p.minStock) || 0;
            const weeklySales = salesMap[pid] || 0;
            const cost = parseFloat(p.cost) || parseFloat(p.costNeto) || 0;

            // Recomendación: 2 semanas de ventas menos stock actual
            let recommended = 0;
            if (weeklySales > 0) {
                recommended = Math.max(0, Math.round((weeklySales * 2) - stock));
            } else if (minStock > 0) {
                recommended = Math.max(0, Math.round((minStock * 2) - stock));
            }
            if (stock <= 0 && recommended === 0) recommended = 1;

            return {
                ...p,
                stock,
                minStock,
                weeklySales,
                recommended,
                cost
            };
        });

        // Ordenar: primero los recomendados a pedir > 0, luego mayor rotación
        decorated.sort((a, b) => {
            if (b.recommended !== a.recommended) return b.recommended - a.recommended;
            return b.weeklySales - a.weeklySales;
        });

        container.innerHTML = `
            <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem; text-align: left;">
                <thead style="position: sticky; top: 0; background: #f1f5f9; border-bottom: 2px solid #cbd5e1; z-index: 5;">
                    <tr style="color: #475569; font-weight: 850; font-size: 0.72rem; text-transform: uppercase;">
                        <th style="padding: 0.45rem 0.6rem;">Producto / Código</th>
                        <th style="padding: 0.45rem 0.6rem; text-align: center;">Stock</th>
                        <th style="padding: 0.45rem 0.6rem; text-align: center;">Ventas/Sem</th>
                        <th style="padding: 0.45rem 0.6rem; text-align: center;">Sugerido</th>
                        <th style="padding: 0.45rem 0.6rem; text-align: right;">Costo</th>
                        <th style="padding: 0.45rem 0.6rem; text-align: center; width: 140px;">Pedir</th>
                    </tr>
                </thead>
                <tbody>
                    ${decorated.slice(0, 40).map(p => {
                        const isOut = p.stock <= 0;
                        const defaultQty = p.recommended > 0 ? p.recommended : 1;
                        return `
                            <tr style="border-bottom: 1px solid #e2e8f0; background: #ffffff;">
                                <td style="padding: 0.5rem 0.6rem;">
                                    <strong style="color: #0f172a; display: block; font-size: 0.88rem;">${safeHTML(p.name)}</strong>
                                    ${p.barcode ? `<span style="font-family: monospace; font-size: 0.72rem; color: #64748b;">${safeHTML(p.barcode)}</span>` : ''}
                                </td>
                                <td style="padding: 0.5rem 0.6rem; text-align: center;">
                                    <span style="font-weight: 850; color: ${isOut ? '#dc2626' : (p.stock <= p.minStock ? '#d97706' : '#059669')};">
                                        ${p.stock}
                                    </span>
                                    ${p.minStock > 0 ? `<span style="font-size: 0.7rem; color: #94a3b8;"> (mín ${p.minStock})</span>` : ''}
                                </td>
                                <td style="padding: 0.5rem 0.6rem; text-align: center;">
                                    ${p.weeklySales > 0 ? `
                                        <span style="font-size: 0.72rem; font-weight: 900; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; padding: 0.15rem 0.45rem; border-radius: 999px;">
                                            🔥 ${p.weeklySales.toFixed(1)}/sem
                                        </span>
                                    ` : '<span style="color: #94a3b8; font-size: 0.75rem;">-</span>'}
                                </td>
                                <td style="padding: 0.5rem 0.6rem; text-align: center;">
                                    ${p.recommended > 0 ? `
                                        <span style="font-size: 0.75rem; font-weight: 950; color: #2563eb; background: #eff6ff; border: 1px solid #bfdbfe; padding: 0.15rem 0.5rem; border-radius: 999px;">
                                            💡 ${p.recommended} un.
                                        </span>
                                    ` : '<span style="color: #64748b; font-size: 0.72rem;">OK</span>'}
                                </td>
                                <td style="padding: 0.5rem 0.6rem; text-align: right; font-weight: 700; color: #334155;">
                                    ${formatCLP(p.cost)}
                                </td>
                                <td style="padding: 0.5rem 0.6rem; text-align: center;">
                                    <div style="display: flex; gap: 0.35rem; align-items: center; justify-content: center;">
                                        <input type="number" id="po-input-qty-${p.id}" value="${defaultQty}" min="1" step="${p.type === 'weight' ? '0.1' : '1'}"
                                               style="width: 55px; height: 30px; text-align: center; font-weight: 900; font-size: 0.85rem; border: 1.5px solid #cbd5e1; border-radius: 0.4rem; padding: 0;">
                                        <button type="button" class="btn btn-sm btn-primary" style="font-weight: 850; padding: 0.25rem 0.6rem; border-radius: 0.4rem; font-size: 0.78rem; background: #2563eb;"
                                                onclick="SuppliersView.addProductByIdToOrder(${p.id})">
                                            + Pedir
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    },

    addProductByIdToOrder(productId) {
        const inputQty = document.getElementById(`po-input-qty-${productId}`);
        const qty = parseFloat(inputQty ? inputQty.value : 1);
        if (isNaN(qty) || qty <= 0) {
            showNotification('Ingresa una cantidad válida', 'warning');
            return;
        }

        const product = (this._allProducts || []).find(p => p.id === productId || String(p.id) === String(productId));
        if (!product) return;

        const cost = parseFloat(product.cost) || parseFloat(product.costNeto) || 0;
        const existing = this._selectedProducts.find(item => String(item.productId) === String(product.id));

        if (existing) {
            existing.quantity += qty;
            existing.total = existing.quantity * existing.cost;
        } else {
            this._selectedProducts.push({
                productId: product.id,
                name: product.name,
                barcode: product.barcode || '',
                cost: cost,
                quantity: qty,
                total: cost * qty
            });
        }

        this.updatePurchaseOrderUI();
        showNotification(`${product.name} agregado al pedido`, 'success');
    },

    updatePurchaseOrderUI() {
        const tableContainer = document.getElementById('poSelectedProductsTable');
        const totalDisplay = document.getElementById('poTotalDisplay');
        const badge = document.getElementById('poSelectedCountBadge');

        const total = (this._selectedProducts || []).reduce((sum, item) => sum + item.total, 0);
        if (totalDisplay) totalDisplay.textContent = formatCLP(total);
        if (badge) badge.textContent = `${this._selectedProducts.length} producto${this._selectedProducts.length === 1 ? '' : 's'}`;

        if (!tableContainer) return;

        if (this._selectedProducts.length === 0) {
            tableContainer.innerHTML = `
                <div style="text-align: center; padding: 1.5rem; color: #94a3b8; font-size: 0.85rem;">
                    🛒 Aún no has agregado productos a este pedido.<br>
                    <span style="font-size: 0.78rem;">Usa el buscador o las sugerencias de arriba para añadir.</span>
                </div>
            `;
            return;
        }

        tableContainer.innerHTML = `
            <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                <thead style="position: sticky; top: 0; background: #f8fafc; border-bottom: 1.5px solid #e2e8f0;">
                    <tr style="color: #64748b; font-size: 0.72rem; text-transform: uppercase; font-weight: 850;">
                        <th style="padding: 0.5rem 0.75rem;">Producto</th>
                        <th style="padding: 0.5rem 0.75rem; text-align: right;">Costo Unid.</th>
                        <th style="padding: 0.5rem 0.75rem; text-align: center; width: 100px;">Cantidad</th>
                        <th style="padding: 0.5rem 0.75rem; text-align: right;">Subtotal</th>
                        <th style="padding: 0.5rem 0.5rem; width: 40px;"></th>
                    </tr>
                </thead>
                <tbody>
                    ${this._selectedProducts.map((item, index) => `
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 0.5rem 0.75rem;">
                                <strong style="color: #0f172a;">${safeHTML(item.name)}</strong>
                                ${item.barcode ? `<span style="font-family: monospace; font-size: 0.72rem; color: #64748b; display: block;">${safeHTML(item.barcode)}</span>` : ''}
                            </td>
                            <td style="padding: 0.5rem 0.75rem; text-align: right; color: #64748b; font-weight: 700;">
                                ${formatCLP(item.cost)}
                            </td>
                            <td style="padding: 0.5rem 0.75rem; text-align: center;">
                                <input type="number" value="${item.quantity}" min="0.1" step="any"
                                       style="width: 70px; height: 32px; text-align: center; font-weight: 900; font-size: 0.9rem; border: 1.5px solid #cbd5e1; border-radius: 0.45rem;"
                                       onchange="SuppliersView.updateSelectedProductQty(${index}, this.value)">
                            </td>
                            <td style="padding: 0.5rem 0.75rem; text-align: right; font-weight: 900; color: #0f172a;">
                                ${formatCLP(item.total)}
                            </td>
                            <td style="padding: 0.5rem 0.5rem; text-align: center;">
                                <button type="button" class="btn btn-sm btn-outline-danger" style="padding: 0.15rem 0.45rem; border-radius: 0.4rem; font-size: 0.85rem;" onclick="SuppliersView.removeProductFromOrder(${index})" title="Quitar">&times;</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    updateSelectedProductQty(index, value) {
        const q = parseFloat(value);
        if (isNaN(q) || q <= 0) {
            this._selectedProducts.splice(index, 1);
        } else {
            this._selectedProducts[index].quantity = q;
            this._selectedProducts[index].total = q * this._selectedProducts[index].cost;
        }
        this.updatePurchaseOrderUI();
    },

    removeProductFromOrder(index) {
        this._selectedProducts.splice(index, 1);
        this.updatePurchaseOrderUI();
    },

    async createPurchaseOrder() {
        const supplierSelect = document.getElementById('poSupplierId');
        const supplierId = supplierSelect ? supplierSelect.value : null;
        const notes = document.getElementById('poNotes')?.value || '';

        if (!supplierId) {
            showNotification('Por favor selecciona un proveedor', 'warning');
            return;
        }

        if (!this._selectedProducts || this._selectedProducts.length === 0) {
            showNotification('Agrega al menos un producto a la orden', 'warning');
            return;
        }

        const supplier = (this._allSuppliers || []).find(s => s.id === parseInt(supplierId) || String(s.id) === String(supplierId));
        const supplierName = supplier ? supplier.name : 'Proveedor';

        const purchaseOrders = JSON.parse(localStorage.getItem('purchaseOrders') || '[]');
        const total = this._selectedProducts.reduce((sum, item) => sum + item.total, 0);

        const newOrder = {
            id: Date.now().toString(),
            supplierId: parseInt(supplierId) || supplierId,
            supplierName: supplierName,
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
        const order = purchaseOrders.find(o => String(o.id) === String(orderId));

        if (!order) {
            showNotification('Orden no encontrada', 'error');
            return;
        }

        let supplierName = order.supplierName || 'Desconocido';
        try {
            const supplier = await Supplier.getById(order.supplierId);
            if (supplier && supplier.name) supplierName = supplier.name;
        } catch (_) {}

        const isCompleted = order.status === 'completed';
        const statusBadge = isCompleted
            ? '<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #059669; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 900; padding: 0.25rem 0.65rem; border-radius: 999px;">✅ Realizada</span>'
            : '<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.3); font-weight: 900; padding: 0.25rem 0.65rem; border-radius: 999px;">⏳ Pendiente</span>';

        const content = `
            <div class="modal-header-gradient" style="margin-bottom: 1.25rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <h2 style="margin: 0; font-size: 1.45rem; color: white;">Orden #${order.id}</h2>
                        <div style="font-size: 0.9rem; opacity: 0.95; color: white; margin-top: 0.25rem;">
                            🚚 Proveedor: <strong>${safeHTML(supplierName)}</strong>
                        </div>
                    </div>
                    <div>${statusBadge}</div>
                </div>
            </div>

            <div style="padding: 0 0.5rem; max-height: 65vh; overflow-y: auto;">
                <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500; margin-bottom: 1rem;">
                    📅 Fecha de emisión: <span style="font-weight: 700; color: var(--text-main);">${formatDateTime(order.date)}</span>
                </div>

                <h3 style="font-size: 1rem; color: #0f172a; font-weight: 900; margin-bottom: 0.5rem; text-transform: uppercase;">
                    📋 Productos del Pedido (${(order.items || []).length})
                </h3>
                <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.25rem; max-height: 250px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 0.65rem; padding: 0.4rem; background: #f8fafc;">
                    ${(order.items || []).map(item => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 0.85rem; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 0.5rem;">
                            <div>
                                <span style="font-weight: 800; color: #0f172a; display: block;">${safeHTML(item.name)}</span>
                                <span style="color: #64748b; font-size: 0.78rem;">Cantidad: <strong>x${item.quantity}</strong> • Costo: $${formatCLP(item.cost)}</span>
                            </div>
                            <span style="font-weight: 950; color: #2563eb; font-size: 1.05rem;">${formatCLP(item.total)}</span>
                        </div>
                    `).join('')}
                </div>

                ${order.notes ? `
                    <div style="margin-bottom: 1.25rem;">
                        <h4 style="font-size: 0.82rem; color: #64748b; font-weight: 850; text-transform: uppercase; margin-bottom: 0.25rem;">Notas / Observaciones</h4>
                        <div style="padding: 0.75rem; background: #f1f5f9; border-radius: 6px; border-left: 3px solid #cbd5e1; color: #0f172a; font-size: 0.88rem;">
                            ${safeHTML(order.notes)}
                        </div>
                    </div>
                ` : ''}

                <div style="background: #0f172a; padding: 1rem 1.25rem; border-radius: 0.75rem; margin-top: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.82rem; color: #94a3b8; font-weight: 800; text-transform: uppercase;">Total Estimado del Pedido:</span>
                        <strong style="font-weight: 950; font-size: 1.45rem; color: #38bdf8;">${formatCLP(order.total)}</strong>
                    </div>
                </div>
            </div>
        `;

        const footer = `
            <div style="display: flex; justify-content: space-between; width: 100%; gap: 0.5rem; flex-wrap: wrap;">
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-secondary" style="font-weight: 800; border-radius: 0.6rem; padding: 0.5rem 1rem;" onclick="closeModal(); SuppliersView.showPurchaseOrdersList()">
                        Volver
                    </button>
                    <button class="btn btn-secondary" style="color: #059669; font-weight: 850; border: 1.5px solid #a7f3d0; background: #f0fdf4; border-radius: 0.6rem; padding: 0.5rem 1rem;" onclick="SuppliersView.copyOrderToWhatsApp('${order.id}')">
                        📲 Copiar WhatsApp
                    </button>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn ${isCompleted ? 'btn-outline-warning' : 'btn-success'}" style="font-weight: 900; border-radius: 0.6rem; padding: 0.5rem 1.15rem;" onclick="closeModal(); SuppliersView.togglePurchaseOrderStatus('${order.id}')">
                        ${isCompleted ? '↩ Reabrir (Pendiente)' : '✓ Marcar Realizada'}
                    </button>
                    <button class="btn btn-outline-danger" style="font-weight: 800; border-radius: 0.6rem; padding: 0.5rem 0.85rem;" onclick="closeModal(); SuppliersView.deletePurchaseOrder('${order.id}')">
                        🗑️ Eliminar
                    </button>
                </div>
            </div>
        `;

        showModal(content, { title: 'Detalle de Orden de Compra', footer, width: '650px' });
    },

    copyOrderToWhatsApp(orderId) {
        const purchaseOrders = JSON.parse(localStorage.getItem('purchaseOrders') || '[]');
        const order = purchaseOrders.find(o => String(o.id) === String(orderId));
        if (!order) return;

        let text = `📦 *ORDEN DE COMPRA #${order.id}*\n`;
        text += `🚚 *Proveedor:* ${order.supplierName || 'General'}\n`;
        text += `📅 *Fecha:* ${new Date(order.date).toLocaleDateString()}\n\n`;
        text += `*DETALLE DE PRODUCTOS:*\n`;

        (order.items || []).forEach(it => {
            text += `• ${it.name} x${it.quantity} ($${formatCLP(it.cost)} c/u) = $${formatCLP(it.total)}\n`;
        });

        text += `\n💰 *TOTAL ESTIMADO:* $${formatCLP(order.total)}\n`;
        if (order.notes) text += `📝 *Notas:* ${order.notes}\n`;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                showNotification('Pedido copiado al portapapeles para WhatsApp 📲', 'success');
            }).catch(() => {
                showNotification('No se pudo copiar automáticamente', 'warning');
            });
        } else {
            showNotification('Copiado listo', 'success');
        }
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
    },

    showActiveOrderModal() {
        let order = null;
        try {
            const raw = localStorage.getItem('CF_ACTIVE_PURCHASE_ORDER');
            if (raw) order = JSON.parse(raw);
        } catch (e) {}

        if (!order) {
            showNotification('No hay ninguna orden de compra activa guardada', 'info');
            return;
        }

        const items = order.items || [];
        const content = `
            <div style="padding: 0.5rem; max-height: 80vh; display: flex; flex-direction: column;">
                <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 0.75rem; padding: 1rem 1.25rem; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                    <div>
                        <h3 style="margin: 0; color: #0f172a; font-size: 1.2rem; font-weight: 900;">${safeHTML(order.supplierName)}</h3>
                        <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.2rem;">
                            Generada: ${order.createdAt ? formatDateTime(order.createdAt) : 'Reciente'} • ${items.length} productos pedidos
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-size: 0.75rem; font-weight: 800; color: #64748b; text-transform: uppercase;">Inversión Estimada:</span>
                        <div style="font-size: 1.35rem; font-weight: 900; color: #2563eb;">${formatCLP(order.estimatedTotal || 0)}</div>
                    </div>
                </div>

                <div style="overflow-y: auto; max-height: 42vh; border: 1.5px solid #e2e8f0; border-radius: 0.65rem; margin-bottom: 1rem;">
                    <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;">
                        <thead style="position: sticky; top: 0; background: #f1f5f9; border-bottom: 1.5px solid #cbd5e1;">
                            <tr style="text-transform: uppercase; font-size: 0.7rem; color: #475569; font-weight: 900;">
                                <th style="padding: 0.55rem 0.75rem;">Producto</th>
                                <th style="padding: 0.55rem 0.75rem; text-align: center;">Cantidad Pedida</th>
                                <th style="padding: 0.55rem 0.75rem; text-align: right;">Costo Aprox.</th>
                                <th style="padding: 0.55rem 0.75rem; text-align: right;">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map(it => {
                                const subtotal = (it.quantity || 0) * (it.cost || 0);
                                return `
                                    <tr style="border-bottom: 1px solid #f1f5f9;">
                                        <td style="padding: 0.55rem 0.75rem;">
                                            <strong style="color: #0f172a;">${safeHTML(it.name)}</strong>
                                            ${it.barcode ? `<small style="display: block; color: #64748b; font-family: monospace;">${safeHTML(it.barcode)}</small>` : ''}
                                        </td>
                                        <td style="padding: 0.55rem 0.75rem; text-align: center; font-weight: 900; color: #2563eb; font-size: 1rem;">
                                            ${it.quantity}
                                        </td>
                                        <td style="padding: 0.55rem 0.75rem; text-align: right; color: #64748b;">
                                            ${formatCLP(it.cost || 0)}
                                        </td>
                                        <td style="padding: 0.55rem 0.75rem; text-align: right; font-weight: 800; color: #0f172a;">
                                            ${formatCLP(subtotal)}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                    <button class="btn btn-secondary" onclick="SuppliersView.cancelActiveOrder()" style="font-weight: 800; color: #dc2626;">
                        🗑️ Descartar Lista
                    </button>
                    <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                        <button class="btn btn-secondary" onclick="closeModal()" style="font-weight: 800;">
                            Cerrar
                        </button>
                        <button class="btn btn-success" onclick="SuppliersView.copyActiveOrderToWhatsApp()" style="font-weight: 900; background: #25d366; border-color: #25d366; color: white;">
                            💬 Compartir por WhatsApp
                        </button>
                        <button class="btn btn-danger" onclick="SuppliersView.sendActiveOrderViaGmail()" style="font-weight: 900; background: #ea4335; border-color: #ea4335; color: white; display: flex; align-items: center; gap: 0.4rem;">
                            <span>✉️</span> <span>Enviar por Gmail</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        showModal(content, { title: 'Orden de Compra Activa', width: '650px' });
    },

    cancelActiveOrder() {
        showModal(`
            <div style="text-align: center; padding: 1rem;">
                <p style="font-size: 1rem; margin-bottom: 1.5rem; color: #1e293b;">
                    ¿Deseas descartar esta lista de compra activa? Ya no aparecerá en proveedores.
                </p>
                <div style="display: flex; gap: 0.75rem; justify-content: center;">
                    <button class="btn btn-secondary" onclick="closeModal()" style="font-weight: 800;">No, Conservar</button>
                    <button class="btn btn-danger" onclick="SuppliersView.confirmCancelActiveOrder()" style="font-weight: 800;">Sí, Descartar</button>
                </div>
            </div>
        `, { title: 'Descartar Lista de Compra', width: '420px' });
    },

    confirmCancelActiveOrder() {
        localStorage.removeItem('CF_ACTIVE_PURCHASE_ORDER');
        closeModal();
        showNotification('Lista de compra descartada', 'info');
        if (typeof app !== 'undefined' && app.navigate) {
            app.navigate('suppliers');
        }
    },

    copyActiveOrderToWhatsApp() {
        let order = null;
        try {
            const raw = localStorage.getItem('CF_ACTIVE_PURCHASE_ORDER');
            if (raw) order = JSON.parse(raw);
        } catch (e) {}
        if (!order) return;

        let text = `📦 *ORDEN DE COMPRA - ${order.supplierName.toUpperCase()}*\n`;
        text += `📅 Fecha: ${new Date().toLocaleDateString('es-CL')}\n\n`;
        (order.items || []).forEach(it => {
            text += `• *${it.name}* x ${it.quantity} un.\n`;
        });
        text += `\n💰 *Total Aprox:* ${formatCLP(order.estimatedTotal || 0)}\n`;

        if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
            showNotification('📋 Lista copiada al portapapeles para WhatsApp', 'success');
        }
        const encoded = encodeURIComponent(text);
        window.open(`https://wa.me/?text=${encoded}`, '_blank');
    },

    showActiveOrderModal(supplierName) {
        if (!supplierName) {
            try {
                const raw = localStorage.getItem('CF_ACTIVE_PURCHASE_ORDER');
                if (raw) {
                    const order = JSON.parse(raw);
                    supplierName = order.supplierName;
                }
            } catch (e) {}
        }
        if (typeof InventoryView !== 'undefined' && typeof InventoryView.openSupplierSuggestionsModal === 'function') {
            InventoryView.openSupplierSuggestionsModal(supplierName);
        } else {
            showNotification('No se pudo abrir el pedido activo', 'warning');
        }
    },

    cancelActiveOrder() {
        if (confirm('¿Descartar esta lista de pedido activo pendiente?')) {
            localStorage.removeItem('CF_ACTIVE_PURCHASE_ORDER');
            showNotification('Lista de pedido descartada.', 'info');
            if (typeof app !== 'undefined' && typeof app.renderView === 'function') {
                app.renderView('suppliers');
            }
        }
    },

    openOrderSuggestionsForSupplier(supplierName) {
        if (typeof InventoryView !== 'undefined' && typeof InventoryView.openSupplierSuggestionsModal === 'function') {
            InventoryView.openSupplierSuggestionsModal(supplierName);
        } else {
            showNotification('Módulo de sugerencias de reposición no disponible', 'warning');
        }
    },

    // --- FILTRADO DE DEUDA Y CONTACTO DIRECTO (WHATSAPP Y GMAIL) ---
    debtOnly: false,
    supplierDebtsMap: new Map(),

    async setDebtFilter(onlyDebt) {
        this.debtOnly = onlyDebt;
        const btnAll = document.getElementById('btnFilterAllSuppliers');
        const btnDebt = document.getElementById('btnFilterDebtSuppliers');
        if (btnAll && btnDebt) {
            btnAll.className = `btn btn-sm ${!onlyDebt ? 'btn-primary' : 'btn-secondary'}`;
            btnDebt.className = `btn btn-sm ${onlyDebt ? 'btn-danger' : 'btn-secondary'}`;
        }
        await this.applySupplierFilters();
    },

    async applySupplierFilters() {
        const searchInput = document.getElementById('searchSuppliers');
        const term = (searchInput?.value || '').trim();
        let suppliers = term ? await Supplier.search(term) : await Supplier.getAll();

        if (this.debtOnly) {
            suppliers = suppliers.filter(s => (this.supplierDebtsMap.get(s.id) || 0) >= 1);
        }

        const table = document.getElementById('suppliersTable');
        if (table) {
            updateDOM(table, this.renderSuppliersTable(suppliers));
            await this.loadSupplierDebts(suppliers);
        }
    },

    getCurrentUserEmail() {
        try {
            const session = JSON.parse(localStorage.getItem('pos_current_user') || sessionStorage.getItem('pos_current_user') || '{}');
            if (session.email) return session.email;
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            if (currentUser.email) return currentUser.email;
            if (typeof AuthManager !== 'undefined' && typeof AuthManager.getCurrentUser === 'function') {
                const u = AuthManager.getCurrentUser();
                if (u && u.email) return u.email;
            }
        } catch (e) {}
        return '';
    },

    async contactSupplierWhatsApp(supplierId) {
        try {
            const supplier = await Supplier.getById(supplierId);
            if (!supplier) return;

            let phone = (supplier.phone || '').trim();
            if (!phone) {
                const content = `
                    <div style="padding: 0.5rem;">
                        <p style="color: #475569; font-size: 0.9rem; margin-bottom: 1rem;">
                            El proveedor <strong>${safeHTML(supplier.name)}</strong> no tiene teléfono o WhatsApp registrado. Ingrésalo para abrir el chat:
                        </p>
                        <div class="form-group">
                            <label style="font-weight: 700; color: #1e293b;">Número de Teléfono / WhatsApp</label>
                            <input type="text" id="promptSupplierPhone" class="form-control" placeholder="Ej: +56 9 1234 5678" style="height: 40px; font-weight: 700;">
                        </div>
                    </div>
                `;
                const footer = `
                    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                    <button class="btn btn-success" onclick="SuppliersView.savePhoneAndOpenWhatsApp(${supplierId})" style="font-weight: 800; background: #25d366; border-color: #25d366; color: white;">
                        Guardar y Abrir WhatsApp
                    </button>
                `;
                showModal(content, { title: '💬 Contactar por WhatsApp', footer, width: '450px' });
                return;
            }

            this._openWhatsAppChat(supplier, phone);
        } catch (e) {
            console.error('Error al contactar por WhatsApp:', e);
            showNotification('Error al abrir WhatsApp', 'error');
        }
    },

    async savePhoneAndOpenWhatsApp(supplierId) {
        const input = document.getElementById('promptSupplierPhone');
        const phone = (input?.value || '').trim();
        if (!phone) {
            showNotification('Por favor ingresa un número telefónico', 'warning');
            return;
        }
        try {
            await Supplier.update(supplierId, { phone });
            closeModal();
            showNotification('Teléfono guardado en la ficha del proveedor', 'success');
            const supplier = await Supplier.getById(supplierId);
            this._openWhatsAppChat(supplier, phone);
            await this.applySupplierFilters();
        } catch (e) {
            showNotification('Error al guardar teléfono: ' + e.message, 'error');
        }
    },

    _openWhatsAppChat(supplier, phone) {
        const bizName = localStorage.getItem('BUSINESS_NAME') || 'Mi Negocio';
        let cleanPhone = phone.replace(/[^0-9]/g, '');
        if (cleanPhone.length === 9) cleanPhone = '56' + cleanPhone;

        const greeting = `Hola ${supplier.contact || supplier.name}, te contacto desde *${bizName}* respecto a pedidos y disponibilidad.`;
        const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(greeting)}`;
        window.open(url, '_blank');
        showNotification('Abriendo WhatsApp...', 'success');
    },

    async contactSupplierEmail(supplierId) {
        try {
            const supplier = await Supplier.getById(supplierId);
            if (!supplier) return;

            let email = (supplier.email || '').trim();
            if (!email) {
                const content = `
                    <div style="padding: 0.5rem;">
                        <p style="color: #475569; font-size: 0.9rem; margin-bottom: 1rem;">
                            El proveedor <strong>${safeHTML(supplier.name)}</strong> no tiene correo electrónico registrado. Ingrésalo para redactar el correo:
                        </p>
                        <div class="form-group">
                            <label style="font-weight: 700; color: #1e293b;">Correo del Proveedor</label>
                            <input type="email" id="promptSupplierEmail" class="form-control" placeholder="ejemplo@proveedor.com" style="height: 40px; font-weight: 700;">
                        </div>
                    </div>
                `;
                const footer = `
                    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                    <button class="btn btn-primary" onclick="SuppliersView.saveEmailAndOpenModal(${supplierId})" style="font-weight: 800; background: #ea4335; border-color: #ea4335;">
                        Guardar y Redactar Correo
                    </button>
                `;
                showModal(content, { title: '✉️ Enviar Correo a Proveedor', footer, width: '450px' });
                return;
            }

            this.showComposeEmailModal(supplier);
        } catch (e) {
            console.error('Error al preparar correo:', e);
            showNotification('Error al abrir redacción de correo', 'error');
        }
    },

    async saveEmailAndOpenModal(supplierId) {
        const input = document.getElementById('promptSupplierEmail');
        const email = (input?.value || '').trim();
        if (!email || !email.includes('@')) {
            showNotification('Por favor ingresa un correo válido', 'warning');
            return;
        }
        try {
            await Supplier.update(supplierId, { email });
            closeModal();
            showNotification('Correo guardado en la ficha del proveedor', 'success');
            const supplier = await Supplier.getById(supplierId);
            this.showComposeEmailModal(supplier);
            await this.applySupplierFilters();
        } catch (e) {
            showNotification('Error al guardar correo: ' + e.message, 'error');
        }
    },

    showComposeEmailModal(supplier, customSubject = '', customBody = '') {
        const userEmail = this.getCurrentUserEmail();
        const bizName = localStorage.getItem('BUSINESS_NAME') || 'Mi Negocio';
        const defaultSubject = customSubject || `Consulta / Pedido de Mercadería - ${bizName}`;
        const defaultBody = customBody || `Estimado(a) ${supplier.contact || supplier.name},\n\nLe saludo cordialmente desde ${bizName}.\n\nMe comunico para consultar sobre lista de precios, disponibilidad de productos y próximos despachos.\n\nAtentamente,\n${bizName}`;

        const content = `
            <div style="display: flex; flex-direction: column; gap: 1rem; padding: 0.25rem;">
                ${userEmail ? `
                <div style="background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 0.75rem; padding: 0.65rem 0.9rem; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: #166534; font-weight: 700;">
                        <span>👤</span> <span>Enviando desde tu cuenta:</span>
                        <strong style="color: #15803d; font-family: monospace;">${safeHTML(userEmail)}</strong>
                    </div>
                    <span style="font-size: 0.7rem; background: #dcfce7; color: #166534; padding: 0.15rem 0.5rem; border-radius: 99px; font-weight: 800;">Google Gmail</span>
                </div>
                ` : ''}

                <div class="form-group" style="margin: 0;">
                    <label style="font-weight: 700; font-size: 0.82rem; color: #334155;">Para (Correo Proveedor):</label>
                    <input type="email" id="emailToAddress" class="form-control" value="${safeHTML(supplier.email || '')}" style="height: 38px; font-weight: 700;">
                </div>

                <div class="form-group" style="margin: 0;">
                    <label style="font-weight: 700; font-size: 0.82rem; color: #334155;">Asunto:</label>
                    <input type="text" id="emailSubject" class="form-control" value="${safeHTML(defaultSubject)}" style="height: 38px; font-weight: 700;">
                </div>

                <div class="form-group" style="margin: 0;">
                    <label style="font-weight: 700; font-size: 0.82rem; color: #334155;">Mensaje:</label>
                    <textarea id="emailBodyText" class="form-control" rows="8" style="font-family: inherit; font-size: 0.88rem; line-height: 1.5; resize: vertical;">${safeHTML(defaultBody)}</textarea>
                </div>

                <div style="display: flex; gap: 0.6rem; align-items: center; justify-content: flex-end; margin-top: 0.5rem; flex-wrap: wrap;">
                    <button type="button" class="btn btn-secondary" onclick="SuppliersView.copyEmailContent()" style="font-weight: 700; font-size: 0.85rem;">
                        📋 Copiar Mensaje
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="SuppliersView.sendViaMailto()" style="font-weight: 700; font-size: 0.85rem;">
                        ✉️ App de Correo (Mailto)
                    </button>
                    <button type="button" class="btn btn-primary" onclick="SuppliersView.sendViaGmailWeb()" style="font-weight: 900; font-size: 0.92rem; background: #ea4335; border-color: #ea4335; color: white; display: flex; align-items: center; gap: 0.45rem; box-shadow: 0 4px 12px rgba(234, 67, 53, 0.25);">
                        <span>🔴</span> <span>Abrir en Gmail Web</span>
                    </button>
                </div>
            </div>
        `;

        showModal(content, { title: `✉️ Redactar Correo a ${safeHTML(supplier.name)}`, footer: '<button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>', width: '620px' });
    },

    sendViaGmailWeb() {
        const to = (document.getElementById('emailToAddress')?.value || '').trim();
        const subject = (document.getElementById('emailSubject')?.value || '').trim();
        const body = (document.getElementById('emailBodyText')?.value || '').trim();

        if (!to) {
            showNotification('Ingresa un correo de destinatario', 'warning');
            return;
        }

        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(gmailUrl, '_blank');
        closeModal();
        showNotification('Abriendo Gmail con el correo preparado...', 'success');
    },

    sendViaMailto() {
        const to = (document.getElementById('emailToAddress')?.value || '').trim();
        const subject = (document.getElementById('emailSubject')?.value || '').trim();
        const body = (document.getElementById('emailBodyText')?.value || '').trim();

        if (!to) {
            showNotification('Ingresa un correo de destinatario', 'warning');
            return;
        }

        const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailtoUrl;
        closeModal();
    },

    copyEmailContent() {
        const body = document.getElementById('emailBodyText')?.value || '';
        if (navigator.clipboard) {
            navigator.clipboard.writeText(body);
            showNotification('Mensaje copiado al portapapeles', 'success');
        }
    },

    async sendActiveOrderViaGmail() {
        let order = null;
        try {
            const raw = localStorage.getItem('CF_ACTIVE_PURCHASE_ORDER');
            if (raw) order = JSON.parse(raw);
        } catch (e) {}
        if (!order) return;

        const bizName = localStorage.getItem('BUSINESS_NAME') || 'Mi Negocio';
        let body = `Estimado(a) ${order.supplierName},\n\nLe saluda cordialmente ${bizName}.\nAdjuntamos la orden de compra con fecha ${new Date().toLocaleDateString('es-CL')}:\n\n`;
        (order.items || []).forEach(it => {
            body += `• ${it.name} x ${it.quantity} un. ${it.barcode ? `(Código: ${it.barcode})` : ''}\n`;
        });
        body += `\nTotal Estimado: ${formatCLP(order.estimatedTotal || 0)}\n\nPor favor confirmar disponibilidad y fecha de despacho.\n\nAtentamente,\n${bizName}`;

        const suppliers = await Supplier.getAll();
        const sup = suppliers.find(s => (s.id && String(s.id) === String(order.supplierId)) || s.name.toLowerCase() === (order.supplierName || '').toLowerCase());

        if (sup) {
            this.showComposeEmailModal(sup, `Orden de Compra - ${bizName}`, body);
        } else {
            const dummySup = { name: order.supplierName, email: '' };
            this.showComposeEmailModal(dummySup, `Orden de Compra - ${bizName}`, body);
        }
    },

    async exportSupplierAccountStatementPDF(supplierId) {
        try {
            const jsPDF = window.jspdf ? window.jspdf.jsPDF : null;
            if (!jsPDF) {
                showNotification('Módulo PDF no disponible', 'warning');
                return;
            }

            const supplier = await Supplier.getById(supplierId);
            if (!supplier) return;

            const [purchases, payments, debt, debtDetail] = await Promise.all([
                Supplier.getPurchaseHistory(supplierId),
                SupplierPayment.getBySupplier(supplierId),
                SupplierPaymentService.getSupplierDebt(supplierId),
                SupplierPaymentService.getDebtDetail(supplierId)
            ]);

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
            doc.text('ESTADO DE CUENTA DE PROVEEDOR', 380, 38);

            // Subheader
            let y = 90;
            doc.setTextColor(30, 41, 59);
            doc.setFontSize(9);
            if (bizRut) { doc.text(`RUT Comercio: ${bizRut}`, 40, y); y += 13; }
            doc.text(`Fecha Emisión: ${now.toLocaleDateString('es-CL')} ${now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`, 40, y);

            // Supplier Data Box
            y += 18;
            doc.setFillColor(248, 250, 252);
            doc.rect(40, y, 515, 52, 'F');
            doc.setDrawColor(203, 213, 225);
            doc.rect(40, y, 515, 52, 'D');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.text(`Proveedor: ${supplier.name.toUpperCase()}`, 50, y + 18);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            const contactInfo = [
                supplier.contact ? `Contacto: ${supplier.contact}` : null,
                supplier.phone ? `Tel: ${supplier.phone}` : null,
                supplier.email ? `Email: ${supplier.email}` : null
            ].filter(Boolean).join(' | ');
            doc.text(contactInfo || 'Sin datos de contacto adicionales', 50, y + 34);

            // Resumen de Deuda
            y += 65;
            doc.setFillColor(debt > 0 ? 254 : 240, debt > 0 ? 242 : 253, debt > 0 ? 242 : 244);
            doc.rect(40, y, 515, 34, 'F');
            doc.setDrawColor(debt > 0 ? 254 : 187, debt > 0 ? 202 : 247, debt > 0 ? 202 : 208);
            doc.rect(40, y, 515, 34, 'D');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(debt > 0 ? 185 : 21, debt > 0 ? 28 : 128, debt > 0 ? 28 : 61);
            doc.text(`SALDO TOTAL PENDIENTE DE PAGO: ${formatCLP(debt)}`, 50, y + 21);

            // Tabla de Compras Pendientes
            const pendingList = debtDetail.filter(d => d.balance >= 1);
            if (pendingList.length > 0 && doc.autoTable) {
                const pendingRows = pendingList.map(d => [
                    d.purchase.date ? new Date(d.purchase.date).toLocaleDateString('es-CL') : '—',
                    `Compra #${d.purchase.id} ${d.purchase.invoiceNumber ? `(Doc: ${d.purchase.invoiceNumber})` : ''}`,
                    formatCLP(d.total),
                    formatCLP(d.paid),
                    formatCLP(d.balance)
                ]);

                doc.autoTable({
                    startY: y + 45,
                    head: [['Fecha', 'Documento / Compra', 'Monto Total', 'Abonado', 'Saldo Pendiente']],
                    body: pendingRows,
                    theme: 'striped',
                    headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
                    bodyStyles: { fontSize: 8.5, textColor: [15, 23, 42] },
                    alternateRowStyles: { fillColor: [254, 242, 242] },
                    margin: { left: 40, right: 40 }
                });
                y = doc.lastAutoTable.finalY + 15;
            } else {
                y += 50;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(22, 101, 52);
                doc.text('✓ No registra compras pendientes de pago.', 40, y);
                y += 15;
            }

            // Tabla de Últimos Pagos Realizados
            if (payments.length > 0 && doc.autoTable && y < 650) {
                const paymentRows = payments.slice(0, 10).map(p => [
                    p.date ? new Date(p.date).toLocaleDateString('es-CL') : '—',
                    p.paymentMethod === 'cash' ? 'Efectivo' : (p.paymentMethod === 'transfer' ? 'Transferencia' : 'Otro'),
                    p.reference || '—',
                    formatCLP(p.amount)
                ]);

                doc.autoTable({
                    startY: y + 10,
                    head: [['Fecha de Pago', 'Medio de Pago', 'Comprobante / Ref.', 'Monto Pagado']],
                    body: paymentRows,
                    theme: 'striped',
                    headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
                    bodyStyles: { fontSize: 8.5, textColor: [15, 23, 42] },
                    margin: { left: 40, right: 40 }
                });
            }

            const fileName = `estado_cuenta_${supplier.name.replace(/[^a-zA-Z0-9]/g, '_')}_${now.toISOString().slice(0, 10)}.pdf`;
            doc.save(fileName);
            showNotification('Estado de cuenta PDF generado con éxito', 'success');
        } catch (e) {
            console.error('Error al generar estado de cuenta PDF:', e);
            showNotification('Error al exportar estado de cuenta', 'error');
        }
    }
};
