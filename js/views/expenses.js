/**
 * ExpensesView — Módulo de Gastos Operativos
 * v1.0 — Módulo independiente con historial, gráficos y presupuesto mensual
 */

const ExpensesView = {

    /* ------------------------------------------------------------------ */
    /* CONFIGURACIÓN                                                        */
    /* ------------------------------------------------------------------ */

    CATEGORIES: [
        { key: 'servicios',     label: 'Servicios Básicos',   icon: '💡', color: '#3b82f6', desc: 'Luz, agua, internet, gas' },
        { key: 'sueldos',       label: 'Sueldos / Nómina',    icon: '👤', color: '#8b5cf6', desc: 'Pago a empleados' },
        { key: 'insumos',       label: 'Insumos / Materiales',icon: '📦', color: '#f59e0b', desc: 'Materiales de trabajo' },
        { key: 'mantenimiento', label: 'Mantenimiento',        icon: '🔧', color: '#10b981', desc: 'Reparaciones y mantención' },
        { key: 'arriendo',      label: 'Arriendo',             icon: '🏠', color: '#ec4899', desc: 'Alquiler del local' },
        { key: 'transporte',    label: 'Transporte',           icon: '🚚', color: '#06b6d4', desc: 'Delivery y transporte' },
        { key: 'otros',         label: 'Otros',                icon: '📝', color: '#6b7280', desc: 'Gastos varios' },
    ],

    activeTab: 'register',
    historyFilter: { category: 'all', month: '', search: '' },
    chartInstances: {},
    currentRegisterMode: 'money',
    selectedInsumoProduct: null,

    /* ------------------------------------------------------------------ */
    /* RENDER PRINCIPAL                                                     */
    /* ------------------------------------------------------------------ */

    async render() {
        return `
            <style>
                /* ── Animaciones de entrada ── */
                @keyframes expFadeUp {
                    from { opacity: 0; transform: translateY(16px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes expPulse {
                    0%, 100% { transform: scale(1); }
                    50%       { transform: scale(1.04); }
                }
                @keyframes expShimmer {
                    0%   { background-position: -400px 0; }
                    100% { background-position:  400px 0; }
                }
                @keyframes expBarFill {
                    from { width: 0; }
                }

                /* ── Tarjetas KPI ── */
                .exp-kpi {
                    background: #fff;
                    border-radius: 1rem;
                    padding: 1.25rem 1.5rem;
                    box-shadow: 0 4px 24px rgba(0,0,0,0.07);
                    border-left: 4px solid transparent;
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    animation: expFadeUp 0.4s ease both;
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .exp-kpi:hover { transform: translateY(-3px); box-shadow: 0 8px 32px rgba(0,0,0,0.12); }
                .exp-kpi-icon {
                    width: 52px; height: 52px; border-radius: 0.75rem;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 1.5rem; flex-shrink: 0;
                }
                .exp-kpi-num { font-size: 1.5rem; font-weight: 800; line-height: 1; }
                .exp-kpi-lbl { font-size: 0.78rem; color: #64748b; margin-top: 0.2rem; }

                /* ── Tabs ── */
                .exp-tabs { display: flex; gap: 0.5rem; border-bottom: 2px solid #e2e8f0; margin-bottom: 1.5rem; flex-wrap: wrap; }
                .exp-tab {
                    padding: 0.65rem 1.25rem; border-radius: 0.5rem 0.5rem 0 0;
                    font-weight: 600; font-size: 0.9rem; cursor: pointer;
                    border: none; background: transparent; color: #64748b;
                    border-bottom: 3px solid transparent; margin-bottom: -2px;
                    transition: color 0.2s, border-color 0.2s, background 0.2s;
                }
                .exp-tab:hover { background: #f1f5f9; color: #0f172a; }
                .exp-tab.active { color: #4f46e5; border-bottom-color: #4f46e5; background: #eff6ff; }

                /* ── Selector visual de categoría ── */
                .exp-cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 0.75rem; margin-bottom: 1.5rem; }
                .exp-cat-btn {
                    padding: 0.9rem 0.75rem; border-radius: 0.75rem; text-align: center;
                    cursor: pointer; border: 2px solid #e2e8f0; background: #fff;
                    transition: all 0.2s; display: flex; flex-direction: column; align-items: center; gap: 0.35rem;
                }
                .exp-cat-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                .exp-cat-btn.selected { border-color: var(--cat-color); background: var(--cat-bg); box-shadow: 0 4px 16px var(--cat-shadow); }
                .exp-cat-btn .cat-icon { font-size: 1.6rem; }
                .exp-cat-btn .cat-name { font-size: 0.72rem; font-weight: 700; color: #374151; }

                /* ── Historial tabla ── */
                .exp-hist-row {
                    display: grid; grid-template-columns: 2.5rem 1fr auto auto;
                    align-items: center; gap: 0.75rem; padding: 0.75rem 1rem;
                    border-radius: 0.625rem; background: #fff;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
                    animation: expFadeUp 0.3s ease both;
                    transition: box-shadow 0.2s;
                }
                .exp-hist-row:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1); }

                /* ── Barra de presupuesto ── */
                .exp-budget-bar-wrap { height: 10px; background: #e2e8f0; border-radius: 99px; overflow: hidden; }
                .exp-budget-bar { height: 100%; border-radius: 99px; animation: expBarFill 0.8s ease; transition: width 0.6s ease; }

                /* ── Input numérico grande ── */
                .exp-amount-input {
                    font-size: 2.5rem; font-weight: 800; text-align: center;
                    border: none; border-bottom: 3px solid #4f46e5; width: 100%;
                    padding: 0.5rem; color: #0f172a; background: transparent;
                    outline: none; letter-spacing: -1px;
                }
                .exp-amount-input::placeholder { color: #cbd5e1; }

                /* ── Badge categoría ── */
                .exp-badge {
                    display: inline-flex; align-items: center; gap: 0.3rem;
                    padding: 0.2rem 0.65rem; border-radius: 99px; font-size: 0.72rem; font-weight: 700;
                }
            </style>

            <div class="view-header" style="animation: expFadeUp 0.3s ease;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h1 style="color: #0f172a;">💸 Gastos Operativos</h1>
                        <p style="color: #64748b;">Control total de egresos de tu negocio</p>
                    </div>
                </div>
            </div>

            <!-- KPIs del mes -->
            <div id="exp-kpis" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                <div class="exp-kpi" style="border-left-color:#ef4444; animation-delay:0s;">
                    <div class="exp-kpi-icon" style="background:#fef2f2;">📅</div>
                    <div>
                        <div class="exp-kpi-num" id="kpi-month" style="color:#ef4444;">$0</div>
                        <div class="exp-kpi-lbl">Gastos este mes</div>
                    </div>
                </div>
                <div class="exp-kpi" style="border-left-color:#f59e0b; animation-delay:0.08s;">
                    <div class="exp-kpi-icon" style="background:#fffbeb;">📆</div>
                    <div>
                        <div class="exp-kpi-num" id="kpi-week" style="color:#f59e0b;">$0</div>
                        <div class="exp-kpi-lbl">Gastos esta semana</div>
                    </div>
                </div>
                <div class="exp-kpi" style="border-left-color:#3b82f6; animation-delay:0.12s;">
                    <div class="exp-kpi-icon" style="background:#eff6ff;">📊</div>
                    <div>
                        <div class="exp-kpi-num" id="kpi-count" style="color:#3b82f6;">0</div>
                        <div class="exp-kpi-lbl">Registros este mes</div>
                    </div>
                </div>
                <div class="exp-kpi" style="border-left-color:#10b981; animation-delay:0.16s;">
                    <div class="exp-kpi-icon" style="background:#ecfdf5;">🏆</div>
                    <div>
                        <div class="exp-kpi-num" id="kpi-top-cat" style="color:#10b981; font-size:1rem;">—</div>
                        <div class="exp-kpi-lbl">Mayor categoría del mes</div>
                    </div>
                </div>
            </div>

            <!-- Tabs -->
            <div class="exp-tabs">
                <button class="exp-tab active" id="tab-register" onclick="ExpensesView.switchTab('register')">📝 Registrar Gasto</button>
                <button class="exp-tab" id="tab-history"  onclick="ExpensesView.switchTab('history')">📜 Historial</button>
                <button class="exp-tab" id="tab-analysis" onclick="ExpensesView.switchTab('analysis')">📊 Análisis</button>
                <button class="exp-tab" id="tab-budget"   onclick="ExpensesView.switchTab('budget')">🎯 Presupuesto</button>
            </div>

            <!-- Contenedor de paneles -->
            <div id="exp-panel"></div>
        `;
    },

    async init() {
        await this.loadKPIs();
        await this.switchTab(this.activeTab || 'register');
    },

    /* ------------------------------------------------------------------ */
    /* TABS                                                                  */
    /* ------------------------------------------------------------------ */

    async switchTab(tab) {
        this.activeTab = tab;
        // Activar tab visual
        ['register','history','analysis','budget'].forEach(t => {
            const btn = document.getElementById(`tab-${t}`);
            if (btn) btn.classList.toggle('active', t === tab);
        });
        const panel = document.getElementById('exp-panel');
        if (!panel) return;

        if (tab === 'register') {
            let suppliers = [];
            try {
                suppliers = await Supplier.getAll();
            } catch (err) {
                console.warn('Error al cargar proveedores:', err);
            }
            panel.innerHTML = this.renderRegisterPanel(suppliers);
            this.setupCategorySelection();
        } else if (tab === 'history') {
            panel.innerHTML = this.renderHistoryPanel();
            await this.loadHistory();
        } else if (tab === 'analysis') {
            panel.innerHTML = this.renderAnalysisPanel();
            await this.loadCharts();
        } else if (tab === 'budget') {
            panel.innerHTML = this.renderBudgetPanel();
            await this.loadBudget();
        }
    },

    /* ------------------------------------------------------------------ */
    /* PANEL: REGISTRAR                                                     */
    /* ------------------------------------------------------------------ */

    attachmentBase64: '',

    handleAttachment(input) {
        const file = input.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            showNotification('El archivo es demasiado grande (máximo 2MB)', 'warning');
            input.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            ExpensesView.attachmentBase64 = e.target.result;
            const label = document.getElementById('attachment-label');
            if (label) label.textContent = `✅ ${file.name.slice(0, 15)}...`;
        };
        reader.readAsDataURL(file);
    },

    renderRegisterPanel(suppliers = []) {
        const today = new Date().toISOString().slice(0, 10);
        return `
            <div style="max-width: 700px; margin: 0 auto; animation: expFadeUp 0.3s ease;">
                <div class="card" style="padding: 2rem; background: #fff; border-radius: 1.25rem; box-shadow: 0 4px 24px rgba(0,0,0,0.07);">

                    <!-- CONMUTADOR DE MODO: DINERO VS INSUMO TIENDA -->
                    <div style="display: flex; gap: 0.5rem; margin-bottom: 1.75rem; background: #f1f5f9; padding: 0.35rem; border-radius: 0.85rem; border: 1px solid #e2e8f0;">
                        <button type="button" id="btn-mode-money" onclick="ExpensesView.setRegisterMode('money')"
                                style="flex: 1; padding: 0.75rem 1rem; border: none; border-radius: 0.65rem; font-weight: 800; font-size: 0.92rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; transition: all 0.2s; background: #ffffff; color: #4f46e5; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                            💵 Gasto Dinero / Factura
                        </button>
                        <button type="button" id="btn-mode-insumo" onclick="ExpensesView.setRegisterMode('insumo')"
                                style="flex: 1; padding: 0.75rem 1rem; border: none; border-radius: 0.65rem; font-weight: 800; font-size: 0.92rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; transition: all 0.2s; background: transparent; color: #64748b;">
                            🧹 Insumo Tienda / Consumo Interno
                        </button>
                    </div>

                    <!-- MODO A: GASTO EN DINERO / FACTURA -->
                    <div id="form-mode-money">

                    <!-- Monto grande -->
                    <div style="text-align: center; margin-bottom: 2rem;">
                        <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 0.5rem; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Monto del Gasto</div>
                        <input type="number" id="exp-amount" class="exp-amount-input" placeholder="$0" min="0" autofocus
                               onkeypress="if(event.key==='Enter') document.getElementById('exp-desc').focus()">
                    </div>

                    <!-- Selector de Categoría -->
                    <div style="margin-bottom: 1.5rem;">
                        <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Categoría</div>
                        <div class="exp-cat-grid" id="cat-selector">
                            ${this.CATEGORIES.map(c => `
                                <div class="exp-cat-btn" data-cat="${c.key}" style="--cat-color: ${c.color}; --cat-bg: ${c.color}18; --cat-shadow: ${c.color}33;"
                                     onclick="ExpensesView.selectCategory('${c.key}')">
                                    <span class="cat-icon">${c.icon}</span>
                                    <span class="cat-name">${c.label}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Descripción -->
                    <div style="margin-bottom: 1.25rem;">
                        <label style="display: block; font-size: 0.85rem; color: #64748b; margin-bottom: 0.5rem; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Descripción</label>
                        <input type="text" id="exp-desc" class="form-control" placeholder="Ej: Factura de luz mes de junio"
                               style="font-size: 1rem; padding: 0.875rem 1rem; border-radius: 0.75rem; border: 2px solid #e2e8f0;"
                               onkeypress="if(event.key==='Enter') document.getElementById('exp-document-number').focus()">
                    </div>

                    <!-- Fila 1: Medio de Pago & Tipo de Documento -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.25rem;">
                        <div>
                            <label style="display: block; font-size: 0.85rem; color: #64748b; margin-bottom: 0.5rem; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Medio de Pago</label>
                            <select id="exp-payment-method" class="form-control" style="font-size: 1rem; padding: 0.875rem 1rem; border-radius: 0.75rem; border: 2px solid #e2e8f0; height: auto;"
                                    onchange="document.getElementById('affects-cash-container').style.display = this.value === 'cash' ? 'flex' : 'none';">
                                <option value="cash">💵 Efectivo Caja</option>
                                <option value="transfer">🏦 Transferencia Bancaria</option>
                                <option value="card">💳 Tarjeta Crédito/Débito</option>
                            </select>
                            <div id="affects-cash-container" style="margin-top: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                                <input type="checkbox" id="exp-affects-cash" checked style="width: 1.1rem; height: 1.15rem; cursor: pointer;">
                                <label for="exp-affects-cash" style="font-size: 0.75rem; color: #475569; font-weight: 600; cursor: pointer; margin: 0; user-select: none;">¿Descontar de la caja activa?</label>
                            </div>
                        </div>
                        <div>
                            <label style="display: block; font-size: 0.85rem; color: #64748b; margin-bottom: 0.5rem; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Tipo de Documento</label>
                            <select id="exp-document-type" class="form-control" style="font-size: 1rem; padding: 0.875rem 1rem; border-radius: 0.75rem; border: 2px solid #e2e8f0; height: auto;">
                                <option value="comprobante_interno">📝 Comprobante Interno</option>
                                <option value="boleta">🧾 Boleta</option>
                                <option value="factura">📄 Factura</option>
                                <option value="honorarios">🧑‍💻 Boleta Honorarios</option>
                            </select>
                        </div>
                    </div>

                    <!-- Fila 2: N° Documento & Proveedor -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.25rem;">
                        <div>
                            <label style="display: block; font-size: 0.85rem; color: #64748b; margin-bottom: 0.5rem; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">N° de Documento / Folio</label>
                            <input type="text" id="exp-document-number" class="form-control" placeholder="Ej: 10423"
                                   style="font-size: 1rem; padding: 0.875rem 1rem; border-radius: 0.75rem; border: 2px solid #e2e8f0;">
                        </div>
                        <div>
                            <label style="display: block; font-size: 0.85rem; color: #64748b; margin-bottom: 0.5rem; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Proveedor</label>
                            <select id="exp-supplier" class="form-control" style="font-size: 1rem; padding: 0.875rem 1rem; border-radius: 0.75rem; border: 2px solid #e2e8f0; height: auto;">
                                <option value="">👤 Gasto General / Sin Proveedor</option>
                                ${suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <!-- Fila 3: Fecha & Adjuntar Recibo -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem; align-items: end;">
                        <div>
                            <label style="display: block; font-size: 0.85rem; color: #64748b; margin-bottom: 0.5rem; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Fecha</label>
                            <input type="date" id="exp-date" class="form-control" value="${today}"
                                   style="font-size: 1rem; padding: 0.875rem 1rem; border-radius: 0.75rem; border: 2px solid #e2e8f0;">
                        </div>
                        <div>
                            <input type="file" id="exp-attachment" accept="image/*,application/pdf" style="display:none;" onchange="ExpensesView.handleAttachment(this)">
                            <button type="button" onclick="document.getElementById('exp-attachment').click()"
                                    style="width: 100%; padding: 0.875rem 1rem; border-radius: 0.75rem; border: 2px dashed #cbd5e1; background: #f8fafc; font-weight: 600; color: #64748b; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-size: 0.9rem;"
                                    onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='#f8fafc'">
                                📎 <span id="attachment-label">Adjuntar Recibo</span>
                            </button>
                        </div>
                    </div>

                    <!-- Botón guardar -->
                    <button onclick="ExpensesView.saveExpense()"
                            style="width: 100%; padding: 1rem; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff;
                                   border: none; border-radius: 0.875rem; font-size: 1.05rem; font-weight: 700; cursor: pointer;
                                   box-shadow: 0 4px 16px rgba(79,70,229,0.35); transition: all 0.2s;"
                            onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 24px rgba(79,70,229,0.4)'"
                            onmouseout="this.style.transform=''; this.style.boxShadow='0 4px 16px rgba(79,70,229,0.35)'">
                        💸 Guardar Gasto
                    </button>

                    <input type="hidden" id="exp-category" value="">
                    </div> <!-- /#form-mode-money -->

                    <!-- MODO B: INSUMO DE TIENDA / CONSUMO INTERNO -->
                    <div id="form-mode-insumo" style="display: none; animation: expFadeUp 0.3s ease;">
                        <div style="background: #ecfdf5; border: 1.5px solid #a7f3d0; border-radius: 0.85rem; padding: 1rem 1.25rem; margin-bottom: 1.5rem; display: flex; align-items: flex-start; gap: 0.75rem;">
                            <span style="font-size: 1.8rem; line-height: 1;">🧹</span>
                            <div>
                                <strong style="color: #065f46; font-size: 0.95rem; display: block;">Retiro de Mercadería para Uso del Negocio</strong>
                                <span style="color: #047857; font-size: 0.8rem; font-weight: 500;">
                                    Artículos de aseo, bolsas, café o mercadería que usas en tu tienda. Descuenta las unidades de stock y registra el gasto contable a precio de costo, <strong>sin descontar dinero físico de tu cajón de caja</strong>.
                                </span>
                            </div>
                        </div>

                        <!-- Buscador de productos -->
                        <div style="margin-bottom: 1.25rem; position: relative;">
                            <label style="display: block; font-size: 0.85rem; color: #64748b; margin-bottom: 0.5rem; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                                Buscar Producto en Stock
                            </label>
                            <input type="text" id="insumo-prod-search" class="form-control"
                                   placeholder="🔍 Escribe nombre o código de barra..."
                                   style="font-size: 1rem; padding: 0.875rem 1rem; border-radius: 0.75rem; border: 2px solid #e2e8f0; width: 100%;"
                                   oninput="ExpensesView.searchInsumoProducts(this.value)">
                            
                            <!-- Resultados desplegables -->
                            <div id="insumo-prod-results"
                                 style="display: none; position: absolute; top: 100%; left: 0; right: 0; z-index: 50; background: #ffffff; border-radius: 0.75rem; border: 1.5px solid #cbd5e1; box-shadow: 0 10px 25px rgba(0,0,0,0.15); max-height: 250px; overflow-y: auto; margin-top: 4px;">
                            </div>
                        </div>

                        <!-- Panel de configuración del producto seleccionado -->
                        <div id="insumo-config-panel" style="display: none; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 1rem; padding: 1.25rem; margin-bottom: 1.5rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid #e2e8f0;">
                                <div>
                                    <strong id="insumo-selected-name" style="font-size: 1.1rem; color: #0f172a; display: block;">Producto</strong>
                                    <span id="insumo-selected-stock" style="font-size: 0.8rem; color: #059669; font-weight: 700;">Stock: 0 un.</span>
                                </div>
                                <div style="text-align: right;">
                                    <span style="font-size: 0.72rem; color: #64748b; display: block; font-weight: 700; text-transform: uppercase;">Costo Unitario</span>
                                    <span id="insumo-unit-cost" style="font-size: 1.05rem; font-weight: 900; color: #4f46e5;">$0</span>
                                    <span style="font-size: 0.7rem; color: #94a3b8; display: block;">Venta: <span id="insumo-unit-price">$0</span></span>
                                </div>
                            </div>

                            <div style="display: grid; grid-template-columns: 140px 1fr; gap: 1rem; margin-bottom: 1.25rem;">
                                <div>
                                    <label style="display: block; font-size: 0.82rem; color: #64748b; margin-bottom: 0.4rem; font-weight: 600;">Cantidad a Retirar</label>
                                    <input type="number" id="insumo-qty" class="form-control" value="1" min="0.01" step="any"
                                           style="font-size: 1.1rem; font-weight: 800; padding: 0.75rem 1rem; border-radius: 0.75rem; border: 2px solid #cbd5e1; text-align: center;"
                                           oninput="ExpensesView.recalcInsumoValues()">
                                </div>
                                <div>
                                    <label style="display: block; font-size: 0.82rem; color: #64748b; margin-bottom: 0.4rem; font-weight: 600;">Motivo / Destino de Uso</label>
                                    <input type="text" id="insumo-reason" class="form-control" placeholder="Ej: Limpieza de estantes y baños"
                                           value="Uso operativo en tienda"
                                           style="font-size: 0.95rem; padding: 0.75rem 1rem; border-radius: 0.75rem; border: 2px solid #cbd5e1;">
                                </div>
                            </div>

                            <!-- Resumen de doble valorización -->
                            <div style="background: #ffffff; border-radius: 0.75rem; padding: 0.85rem 1.15rem; border: 1px solid #e2e8f0; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; text-align: center;">
                                <div>
                                    <span style="font-size: 0.72rem; color: #059669; font-weight: 800; text-transform: uppercase; display: block;">Costo Empresa (Gasto Real)</span>
                                    <strong id="insumo-calc-cost" style="font-size: 1.25rem; color: #059669; font-weight: 950;">$0</strong>
                                </div>
                                <div>
                                    <span style="font-size: 0.72rem; color: #64748b; font-weight: 800; text-transform: uppercase; display: block;">Valor Comercial Equivalente</span>
                                    <strong id="insumo-calc-sale" style="font-size: 1.25rem; color: #64748b; font-weight: 950;">$0</strong>
                                </div>
                            </div>
                        </div>

                        <!-- Botón guardar insumo -->
                        <button onclick="ExpensesView.saveInsumoExpense()"
                                style="width: 100%; padding: 1rem; background: linear-gradient(135deg, #059669, #10b981); color: #fff;
                                       border: none; border-radius: 0.875rem; font-size: 1.05rem; font-weight: 800; cursor: pointer;
                                       box-shadow: 0 4px 16px rgba(16,185,129,0.35); transition: all 0.2s;"
                                onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 24px rgba(16,185,129,0.45)'"
                                onmouseout="this.style.transform=''; this.style.boxShadow='0 4px 16px rgba(16,185,129,0.35)'">
                            🧹 Registrar Insumo y Descontar Stock
                        </button>
                    </div> <!-- /#form-mode-insumo -->

                </div>
            </div>
        `;
    },

    selectedCategory: '',


    setRegisterMode(mode) {
        this.currentRegisterMode = mode;
        const btnMoney = document.getElementById('btn-mode-money');
        const btnInsumo = document.getElementById('btn-mode-insumo');
        const formMoney = document.getElementById('form-mode-money');
        const formInsumo = document.getElementById('form-mode-insumo');

        if (mode === 'insumo') {
            if (btnMoney) {
                btnMoney.style.background = 'transparent';
                btnMoney.style.color = '#64748b';
                btnMoney.style.boxShadow = 'none';
            }
            if (btnInsumo) {
                btnInsumo.style.background = '#ffffff';
                btnInsumo.style.color = '#059669';
                btnInsumo.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
            }
            if (formMoney) formMoney.style.display = 'none';
            if (formInsumo) formInsumo.style.display = 'block';
            document.getElementById('insumo-prod-search')?.focus();
        } else {
            if (btnInsumo) {
                btnInsumo.style.background = 'transparent';
                btnInsumo.style.color = '#64748b';
                btnInsumo.style.boxShadow = 'none';
            }
            if (btnMoney) {
                btnMoney.style.background = '#ffffff';
                btnMoney.style.color = '#4f46e5';
                btnMoney.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
            }
            if (formInsumo) formInsumo.style.display = 'none';
            if (formMoney) formMoney.style.display = 'block';
            document.getElementById('exp-amount')?.focus();
        }
    },

    async searchInsumoProducts(query) {
        const resultsEl = document.getElementById('insumo-prod-results');
        if (!resultsEl) return;

        const q = (query || '').trim().toLowerCase();
        if (q.length < 2) {
            resultsEl.style.display = 'none';
            resultsEl.innerHTML = '';
            return;
        }

        try {
            const allProducts = await Product.getAll();
            const filtered = allProducts.filter(p => {
                const name = (p.name || '').toLowerCase();
                const barcode = (p.barcode || '').toLowerCase();
                const cat = (p.category || '').toLowerCase();
                return name.includes(q) || barcode.includes(q) || cat.includes(q);
            }).slice(0, 8);

            if (filtered.length === 0) {
                resultsEl.style.display = 'block';
                resultsEl.innerHTML = `
                    <div style="padding: 1rem; text-align: center; color: #94a3b8; font-size: 0.85rem;">
                        No se encontraron productos coincidentes
                    </div>`;
                return;
            }

            resultsEl.style.display = 'block';
            resultsEl.innerHTML = filtered.map(p => {
                const cost = parseFloat(p.cost) || parseFloat(p.costNeto) || 0;
                const stock = parseFloat(p.stock) || 0;
                const isLowStock = stock <= (parseFloat(p.minStock) || 0);

                return `
                    <div onclick="ExpensesView.selectInsumoProduct(${p.id})"
                         style="padding: 0.75rem 1rem; border-bottom: 1px solid #f1f5f9; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; transition: background 0.15s;"
                         onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#fff'">
                        <div>
                            <div style="font-weight: 700; color: #1e293b; font-size: 0.9rem;">${p.name}</div>
                            <div style="font-size: 0.75rem; color: #64748b;">
                                Código: ${p.barcode || 'S/C'} · Cat: ${p.category || 'General'}
                            </div>
                        </div>
                        <div style="text-align: right; display: flex; align-items: center; gap: 0.75rem;">
                            <span style="font-size: 0.75rem; padding: 0.2rem 0.6rem; border-radius: 99px; font-weight: 700; background: ${isLowStock ? '#fef2f2; color:#ef4444;' : '#ecfdf5; color:#059669;'}">
                                Stock: ${stock} un.
                            </span>
                            <div style="font-size: 0.82rem; font-weight: 700; color: #0f172a;">
                                Costo: ${formatCLP(cost)}
                            </div>
                            <button type="button" style="border: none; background: #059669; color: #fff; border-radius: 0.5rem; padding: 0.35rem 0.75rem; font-size: 0.75rem; font-weight: 800; cursor: pointer;">
                                Usar ➡️
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (err) {
            console.error('[Expenses] Error buscando productos para insumos:', err);
        }
    },

    async selectInsumoProduct(productId) {
        try {
            const product = await Product.getById(productId);
            if (!product) {
                showNotification('Producto no encontrado', 'error');
                return;
            }

            this.selectedInsumoProduct = product;

            const resultsEl = document.getElementById('insumo-prod-results');
            if (resultsEl) resultsEl.style.display = 'none';

            const searchInput = document.getElementById('insumo-prod-search');
            if (searchInput) searchInput.value = product.name;

            const configPanel = document.getElementById('insumo-config-panel');
            if (configPanel) configPanel.style.display = 'block';

            const nameEl = document.getElementById('insumo-selected-name');
            const stockEl = document.getElementById('insumo-selected-stock');
            const unitCostEl = document.getElementById('insumo-unit-cost');
            const unitPriceEl = document.getElementById('insumo-unit-price');
            const qtyInput = document.getElementById('insumo-qty');
            const reasonInput = document.getElementById('insumo-reason');

            if (nameEl) nameEl.textContent = product.name;
            if (stockEl) stockEl.textContent = `Stock actual: ${parseFloat(product.stock) || 0} un.`;
            const unitCost = parseFloat(product.cost) || parseFloat(product.costNeto) || 0;
            const unitPrice = parseFloat(product.price) || 0;
            if (unitCostEl) unitCostEl.textContent = formatCLP(unitCost);
            if (unitPriceEl) unitPriceEl.textContent = formatCLP(unitPrice);

            if (qtyInput) {
                qtyInput.value = '1';
                qtyInput.focus();
            }
            if (reasonInput && !reasonInput.value) {
                reasonInput.value = 'Uso operativo en tienda';
            }

            this.recalcInsumoValues();
        } catch (err) {
            console.error('[Expenses] Error seleccionando producto para insumo:', err);
        }
    },

    recalcInsumoValues() {
        if (!this.selectedInsumoProduct) return;
        const qty = Math.abs(parseFloat(document.getElementById('insumo-qty')?.value) || 0);
        const unitCost = parseFloat(this.selectedInsumoProduct.cost) || parseFloat(this.selectedInsumoProduct.costNeto) || 0;
        const unitPrice = parseFloat(this.selectedInsumoProduct.price) || 0;

        const totalCost = Math.round(qty * unitCost);
        const totalSale = Math.round(qty * unitPrice);

        const costDisplay = document.getElementById('insumo-calc-cost');
        const saleDisplay = document.getElementById('insumo-calc-sale');

        if (costDisplay) costDisplay.textContent = formatCLP(totalCost);
        if (saleDisplay) saleDisplay.textContent = formatCLP(totalSale);
    },

    async saveInsumoExpense() {
        const prod = this.selectedInsumoProduct;
        if (!prod) {
            showNotification('Primero busca y selecciona un producto de la tienda', 'warning');
            document.getElementById('insumo-prod-search')?.focus();
            return;
        }

        const qty = Math.abs(parseFloat(document.getElementById('insumo-qty')?.value) || 0);
        if (qty <= 0) {
            showNotification('Ingresa una cantidad válida a retirar', 'warning');
            document.getElementById('insumo-qty')?.focus();
            return;
        }

        const reason = (document.getElementById('insumo-reason')?.value || '').trim() || 'Insumo de tienda / uso interno';

        let activeUserId = null;
        let activeUserName = 'Admin';
        try {
            if (typeof AuthManager !== 'undefined' && AuthManager.getCurrentUser) {
                const u = AuthManager.getCurrentUser();
                if (u) {
                    activeUserId = u.id;
                    activeUserName = u.name || u.username;
                }
            }
            if (!activeUserId) {
                const stored = JSON.parse(localStorage.getItem('currentUser') || 'null');
                if (stored) {
                    activeUserId = stored.id;
                    activeUserName = stored.name || stored.username;
                }
            }
        } catch (_) {}

        const unitCost = parseFloat(prod.cost) || parseFloat(prod.costNeto) || 0;
        const unitPrice = parseFloat(prod.price) || 0;
        const totalCost = Math.round(qty * unitCost);
        const totalSale = Math.round(qty * unitPrice);
        const expenseAmount = totalCost > 0 ? totalCost : totalSale;

        try {
            // 1. Descontar stock atómicamente y registrar movimiento
            await StockService.createConsumption(prod.id, qty, reason, {
                userId: activeUserId,
                userName: activeUserName
            });

            // 2. Registrar el gasto contable de insumos sin tocar el efectivo de caja
            await Expense.create({
                category: 'insumos',
                amount: expenseAmount,
                description: `[INSUMO TIENDA] ${prod.name} x${qty}: ${reason}`,
                date: new Date().toISOString(),
                documentType: 'comprobante_interno',
                documentNumber: '',
                paymentMethod: 'product_stock',
                supplierId: null,
                userId: activeUserId,
                userName: activeUserName,
                productId: prod.id,
                productName: prod.name,
                quantity: qty,
                cost_value: totalCost,
                sale_value: totalSale,
                cashRegisterId: null
            });

            showNotification(`🧹 Insumo registrado: ${prod.name} x${qty} (${formatCLP(expenseAmount)})`, 'success');

            // Resetear formulario de insumos
            this.selectedInsumoProduct = null;
            if (document.getElementById('insumo-prod-search')) document.getElementById('insumo-prod-search').value = '';
            if (document.getElementById('insumo-qty')) document.getElementById('insumo-qty').value = '1';
            if (document.getElementById('insumo-reason')) document.getElementById('insumo-reason').value = 'Uso operativo en tienda';
            const configPanel = document.getElementById('insumo-config-panel');
            if (configPanel) configPanel.style.display = 'none';
            const resultsEl = document.getElementById('insumo-prod-results');
            if (resultsEl) resultsEl.style.display = 'none';

            await this.loadKPIs();
        } catch (err) {
            console.error('[Expenses] Error guardando insumo de tienda:', err);
            showNotification('Error al registrar insumo: ' + err.message, 'error');
        }
    },

        setupCategorySelection() {
        this.selectCategory('servicios');
    },

    selectCategory(key) {
        this.selectedCategory = key;
        const hidden = document.getElementById('exp-category');
        if (hidden) hidden.value = key;
        document.querySelectorAll('.exp-cat-btn').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.cat === key);
        });
    },

    async saveExpense() {
        const amountRaw = parseFloat(document.getElementById('exp-amount')?.value) || 0;
        const description = (document.getElementById('exp-desc')?.value || '').trim();
        const category = document.getElementById('exp-category')?.value || 'otros';
        const dateVal = document.getElementById('exp-date')?.value || new Date().toISOString().slice(0, 10);
        const paymentMethod = document.getElementById('exp-payment-method')?.value || 'cash';
        const documentType = document.getElementById('exp-document-type')?.value || 'comprobante_interno';
        const documentNumber = (document.getElementById('exp-document-number')?.value || '').trim();
        const supplierId = document.getElementById('exp-supplier')?.value || '';
        const attachmentPath = ExpensesView.attachmentBase64 || '';
        
        const affectsCashCheckbox = document.getElementById('exp-affects-cash');
        const affectsCash = paymentMethod === 'cash' && affectsCashCheckbox ? affectsCashCheckbox.checked : false;

        if (amountRaw <= 0) {
            showNotification('Ingresa un monto válido', 'warning');
            document.getElementById('exp-amount')?.focus();
            return;
        }
        if (!description) {
            showNotification('Ingresa una descripción del gasto', 'warning');
            document.getElementById('exp-desc')?.focus();
            return;
        }

        const catInfo = this.CATEGORIES.find(c => c.key === category) || this.CATEGORIES[6];

        let expenseId;
        try {
            // Obtener usuario activo para trazabilidad
            let activeUserId = null;
            let activeUserName = 'Admin';
            try {
                if (typeof AuthManager !== 'undefined' && AuthManager.getCurrentUser) {
                    const u = AuthManager.getCurrentUser();
                    if (u) {
                        activeUserId = u.id;
                        activeUserName = u.name || u.username;
                    }
                }
                if (!activeUserId) {
                    const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
                    if (user && user.id) {
                        activeUserId = user.id;
                        activeUserName = user.name || user.username;
                    }
                }
            } catch (e) {}

            expenseId = await Expense.create({
                category,
                amount: amountRaw,
                description,
                date: new Date(dateVal).toISOString(),
                documentType,
                documentNumber,
                paymentMethod,
                supplierId: supplierId ? parseInt(supplierId) : null,
                userId: activeUserId,
                userName: activeUserName,
                attachmentPath,
                cashRegisterId: null
            });
        } catch (error) {
            console.error('[Expenses] Error guardando gasto en IndexedDB/SQLite:', error);
            showNotification('Error al registrar el gasto: ' + error.message, 'error');
            return;
        }

        // Si el pago es en Efectivo Caja y afecta la caja activa, registrar el movimiento físico
        if (paymentMethod === 'cash' && affectsCash) {
            try {
                const openCash = await CashRegister.getOpen();
                if (!openCash) {
                    // Si se seleccionó Efectivo pero la caja está cerrada, bloqueamos por seguridad
                    await Expense.delete(expenseId);
                    showNotification('No hay caja abierta. Abre una caja primero para registrar gastos en efectivo.', 'warning');
                    return;
                }

                // Asociar el gasto a la caja
                await Expense.update(expenseId, { cashRegisterId: openCash.id });

                // Crear el egreso en movimientos de caja
                await CashMovement.create({
                    cashRegisterId: openCash.id,
                    type: 'out',
                    amount: amountRaw,
                    description: `[GASTO] ${description}`,
                    reason: `[GASTO] ${description}`,
                    category: category,
                    expenseId: expenseId,
                    date: new Date(dateVal).toISOString()
                });
            } catch (cashErr) {
                console.error('[Expenses] Error al registrar movimiento de caja:', cashErr);
                // Rollback del gasto para mantener integridad
                await Expense.delete(expenseId);
                showNotification('Error al registrar salida de dinero físico. Operación cancelada.', 'error');
                return;
            }
        }

        showNotification(`${catInfo.icon} Gasto registrado: ${formatCLP(amountRaw)}`, 'success');

        // Resetear formulario y variables
        ExpensesView.attachmentBase64 = '';
        if (document.getElementById('exp-amount')) document.getElementById('exp-amount').value = '';
        if (document.getElementById('exp-desc')) document.getElementById('exp-desc').value = '';
        if (document.getElementById('exp-document-number')) document.getElementById('exp-document-number').value = '';
        if (document.getElementById('exp-supplier')) document.getElementById('exp-supplier').value = '';
        const todayStr = new Date().toISOString().slice(0, 10);
        if (document.getElementById('exp-date')) document.getElementById('exp-date').value = todayStr;
        const attachmentLabel = document.getElementById('attachment-label');
        if (attachmentLabel) attachmentLabel.textContent = 'Adjuntar Recibo';
        
        this.selectCategory('servicios');
        document.getElementById('exp-amount')?.focus();

        // Recargar KPIs
        await this.loadKPIs();
        this.checkBudgetAlert(category, amountRaw);
    },

    /* ------------------------------------------------------------------ */
    /* PANEL: HISTORIAL                                                     */
    /* ------------------------------------------------------------------ */

    renderHistoryPanel() {
        const currentMonth = new Date().toISOString().slice(0, 7);
        return `
            <div style="animation: expFadeUp 0.3s ease;">
                <!-- Filtros -->
                <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1.25rem; padding: 1rem; background: #fff; border-radius: 1rem; box-shadow: 0 2px 12px rgba(0,0,0,0.06);">
                    <input type="month" id="hist-month" value="${currentMonth}" class="form-control"
                           style="flex: 1; min-width: 150px; border-radius: 0.625rem; border: 2px solid #e2e8f0; padding: 0.625rem 0.875rem;"
                           onchange="ExpensesView.loadHistory()">
                    <select id="hist-cat" class="form-control"
                           style="flex: 1; min-width: 160px; border-radius: 0.625rem; border: 2px solid #e2e8f0; padding: 0.625rem 0.875rem;"
                           onchange="ExpensesView.loadHistory()">
                        <option value="all">Todas las categorías</option>
                        ${this.CATEGORIES.map(c => `<option value="${c.key}">${c.icon} ${c.label}</option>`).join('')}
                    </select>
                    <input type="text" id="hist-search" class="form-control" placeholder="🔍 Buscar..."
                           style="flex: 2; min-width: 180px; border-radius: 0.625rem; border: 2px solid #e2e8f0; padding: 0.625rem 0.875rem;"
                           oninput="ExpensesView.loadHistory()">
                </div>

                <!-- Total filtrado -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.875rem;">
                    <span id="hist-summary" style="font-size: 0.85rem; color: #64748b;"></span>
                    <span id="hist-total" style="font-size: 1.1rem; font-weight: 800; color: #ef4444;"></span>
                </div>

                <!-- Lista -->
                <div id="hist-list" style="display: flex; flex-direction: column; gap: 0.5rem;">
                    <div style="text-align:center; padding: 3rem; color: #94a3b8;">Cargando...</div>
                </div>
            </div>
        `;
    },

    async loadHistory() {
        const monthEl = document.getElementById('hist-month');
        const catEl   = document.getElementById('hist-cat');
        const searchEl= document.getElementById('hist-search');
        if (!monthEl) return;

        const month  = monthEl.value;
        const cat    = catEl?.value || 'all';
        const search = (searchEl?.value || '').toLowerCase();

        const [expenses, suppliers] = await Promise.all([
            this._getExpenseMovements(month),
            Supplier.getAll().catch(() => [])
        ]);

        const supplierMap = {};
        suppliers.forEach(s => supplierMap[s.id] = s);

        let filtered = expenses;
        if (cat !== 'all') filtered = filtered.filter(e => e.category === cat);
        if (search)        filtered = filtered.filter(e => e.description.toLowerCase().includes(search));

        const total = filtered.reduce((s, e) => s + e.amount, 0);

        const summaryEl = document.getElementById('hist-summary');
        const totalEl   = document.getElementById('hist-total');
        if (summaryEl) summaryEl.textContent = `${filtered.length} registro(s)`;
        if (totalEl)   totalEl.textContent   = formatCLP(total);

        const list = document.getElementById('hist-list');
        if (!list) return;

        if (filtered.length === 0) {
            list.innerHTML = `
                <div style="text-align:center; padding: 3rem; color: #94a3b8; background:#fff; border-radius:1rem;">
                    <div style="font-size:3rem; margin-bottom:0.75rem;">📭</div>
                    <p style="font-weight: 600;">Sin gastos para este período</p>
                </div>`;
            return;
        }

        const sorted = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));
        list.innerHTML = sorted.map((exp, idx) => {
            const catInfo = this.CATEGORIES.find(c => c.key === exp.category) || this.CATEGORIES[6];
            const dateStr = new Date(exp.date).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
            
            // Proveedor
            const supplierName = exp.supplierId && supplierMap[exp.supplierId] ? supplierMap[exp.supplierId].name : '';
            
            // Folio / Documento
            const docLabelMap = {
                'comprobante_interno': 'Comp. Interno',
                'boleta': 'Boleta',
                'factura': 'Factura',
                'honorarios': 'B. Honorarios'
            };
            const docTypeLabel = docLabelMap[exp.documentType] || 'Comprobante';
            const docInfo = exp.documentNumber ? `${docTypeLabel} N° ${exp.documentNumber}` : docTypeLabel;
            
            // Medio de Pago e Insumos
            const isInsumoStock = exp.paymentMethod === 'product_stock' || Boolean(exp.productId);
            const payMethodMap = {
                'cash': '💵 Efectivo',
                'transfer': '🏦 Transferencia',
                'card': '💳 Tarjeta',
                'product_stock': '🧹 Insumo Tienda'
            };
            let payMethodLabel = payMethodMap[exp.paymentMethod] || 'Efectivo';
            if (isInsumoStock) {
                payMethodLabel = '🧹 Insumo Tienda (Stock)';
            } else if (exp.paymentMethod === 'cash' && !exp.cashRegisterId) {
                payMethodLabel = '💵 Efectivo (Caja Fuerte/Bolsillo)';
            }

            // Archivo Adjunto (Download Button)
            let attachmentBtn = '';
            if (exp.attachmentPath && exp.attachmentPath.startsWith('data:')) {
                attachmentBtn = `
                    <a href="${exp.attachmentPath}" download="comprobante-${exp.category}-${exp.id}.png"
                       style="text-decoration:none; display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:50%; background:#f1f5f9; color:#475569; font-size:0.85rem; border: 1px solid #cbd5e1; cursor:pointer; margin-right: 0.5rem;"
                       title="Descargar Comprobante">
                        📎
                    </a>
                `;
            }

            return `
                <div class="exp-hist-row" style="grid-template-columns: 2.5rem 1.5fr 1fr 1fr auto auto; gap: 0.75rem; align-items: center; animation-delay:${idx * 0.04}s;">
                    <div style="width:2.5rem; height:2.5rem; border-radius:0.625rem; background:${catInfo.color}18; display:flex; align-items:center; justify-content:center; font-size:1.2rem; flex-shrink:0;">
                        ${catInfo.icon}
                    </div>
                    <div>
                        <div style="font-weight: 700; color: #0f172a; font-size: 0.9rem;">${exp.description.replace('[GASTO] ','').replace('[INSUMO TIENDA] ','')}</div>
                        <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.1rem; display: flex; align-items: center; gap: 0.5rem;">
                            <span>${dateStr}</span>
                            ${exp.userName ? `<span style="color: #6366f1; font-weight: 600;">· 👤 ${exp.userName}</span>` : ''}
                        </div>
                    </div>
                    <div style="font-size: 0.8rem; color: #475569; display: flex; flex-direction: column; gap: 0.1rem;">
                        <span style="font-weight: 600;">${docInfo}</span>
                        ${supplierName ? `<span style="color:#64748b; font-size:0.75rem;">👤 ${supplierName}</span>` : ''}
                    </div>
                    <div style="font-size: 0.8rem; color: #64748b;">
                        <span style="${isInsumoStock ? 'color:#059669; font-weight:700;' : ''}">${payMethodLabel}</span>
                        ${isInsumoStock && exp.cost_value ? `<div style="font-size:0.7rem; color:#64748b;">Costo: ${formatCLP(exp.cost_value)} · Venta: ${formatCLP(exp.sale_value || 0)}</div>` : ''}
                    </div>
                    <span class="exp-badge" style="background:${catInfo.color}18; color:${catInfo.color}; justify-self: start;">${catInfo.icon} ${catInfo.label}</span>
                    <div style="display: flex; align-items: center; gap: 0.5rem; justify-self: end;">
                        ${attachmentBtn}
                        <div style="font-weight: 800; color: #ef4444; font-size: 0.95rem; white-space: nowrap;">${formatCLP(exp.amount)}</div>
                    </div>
                </div>
            `;
        }).join('');
    },

    /* ------------------------------------------------------------------ */
    /* PANEL: ANÁLISIS                                                      */
    /* ------------------------------------------------------------------ */

    renderAnalysisPanel() {
        const currentMonth = new Date().toISOString().slice(0, 7);
        return `
            <div style="animation: expFadeUp 0.3s ease;">
                <div style="display: flex; justify-content: flex-end; margin-bottom: 1rem;">
                    <input type="month" id="analysis-month" value="${currentMonth}" class="form-control"
                           style="width: auto; border-radius: 0.625rem; border: 2px solid #e2e8f0; padding: 0.625rem 0.875rem;"
                           onchange="ExpensesView.loadCharts()">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                    <!-- Gráfico torta por categoría -->
                    <div style="background:#fff; border-radius:1.25rem; padding:1.5rem; box-shadow:0 4px 20px rgba(0,0,0,0.07);">
                        <h3 style="margin-bottom:1rem; font-size:0.95rem; color:#0f172a; font-weight:700;">🥧 Por Categoría</h3>
                        <div style="position:relative; height:260px; display:flex; align-items:center; justify-content:center;">
                            <canvas id="chart-pie" style="max-height:260px;"></canvas>
                            <div id="chart-pie-empty" style="display:none; color:#94a3b8; text-align:center;">
                                <div style="font-size:2.5rem;">📊</div>
                                <p>Sin datos este mes</p>
                            </div>
                        </div>
                    </div>
                    <!-- Gráfico barra últimos 6 meses -->
                    <div style="background:#fff; border-radius:1.25rem; padding:1.5rem; box-shadow:0 4px 20px rgba(0,0,0,0.07);">
                        <h3 style="margin-bottom:1rem; font-size:0.95rem; color:#0f172a; font-weight:700;">📅 Últimos 6 Meses</h3>
                        <div style="position:relative; height:260px;">
                            <canvas id="chart-bar"></canvas>
                        </div>
                    </div>
                </div>
                <!-- Detalle por categoría del mes -->
                <div style="background:#fff; border-radius:1.25rem; padding:1.5rem; box-shadow:0 4px 20px rgba(0,0,0,0.07); margin-top:1.5rem;">
                    <h3 style="margin-bottom:1rem; font-size:0.95rem; color:#0f172a; font-weight:700;">📋 Detalle por Categoría</h3>
                    <div id="cat-breakdown" style="display:flex; flex-direction:column; gap:0.75rem;"></div>
                </div>
            </div>
        `;
    },

    async loadCharts() {
        const monthEl = document.getElementById('analysis-month');
        const month = monthEl ? monthEl.value : new Date().toISOString().slice(0, 7);

        const expenses = await this._getExpenseMovements(month);
        const total = expenses.reduce((s, e) => s + e.amount, 0);

        // Agrupar por categoría
        const byCat = {};
        this.CATEGORIES.forEach(c => { byCat[c.key] = 0; });
        expenses.forEach(e => {
            const cat = e.category || 'otros';
            byCat[cat] = (byCat[cat] || 0) + e.amount;
        });

        const activeCats = this.CATEGORIES.filter(c => byCat[c.key] > 0);

        // Pie chart
        const pieCanvas = document.getElementById('chart-pie');
        const pieEmpty  = document.getElementById('chart-pie-empty');
        if (pieCanvas) {
            if (activeCats.length === 0) {
                pieCanvas.style.display = 'none';
                if (pieEmpty) pieEmpty.style.display = 'block';
            } else {
                pieCanvas.style.display = '';
                if (pieEmpty) pieEmpty.style.display = 'none';
                if (this.chartInstances.pie) this.chartInstances.pie.destroy();
                this.chartInstances.pie = new Chart(pieCanvas, {
                    type: 'doughnut',
                    data: {
                        labels: activeCats.map(c => `${c.icon} ${c.label}`),
                        datasets: [{
                            data: activeCats.map(c => byCat[c.key]),
                            backgroundColor: activeCats.map(c => c.color + 'cc'),
                            borderColor: activeCats.map(c => c.color),
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 12 } },
                            tooltip: {
                                callbacks: {
                                    label: (ctx) => {
                                        const val = ctx.parsed;
                                        const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                                        return ` ${formatCLP(val)} (${pct}%)`;
                                    }
                                }
                            }
                        },
                        cutout: '60%',
                        animation: { animateScale: true }
                    }
                });
            }
        }

        // Bar chart (últimos 6 meses)
        const barCanvas = document.getElementById('chart-bar');
        if (barCanvas) {
            const months = this._getLast6Months();
            const monthTotals = await Promise.all(months.map(async (m) => {
                const exps = await this._getExpenseMovements(m.value);
                return exps.reduce((s, e) => s + e.amount, 0);
            }));

            if (this.chartInstances.bar) this.chartInstances.bar.destroy();
            this.chartInstances.bar = new Chart(barCanvas, {
                type: 'bar',
                data: {
                    labels: months.map(m => m.label),
                    datasets: [{
                        label: 'Gastos',
                        data: monthTotals,
                        backgroundColor: months.map((m, i) => i === months.length - 1 ? '#4f46e5cc' : '#94a3b8aa'),
                        borderColor:     months.map((m, i) => i === months.length - 1 ? '#4f46e5' : '#94a3b8'),
                        borderWidth: 2, borderRadius: 6
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${formatCLP(ctx.parsed.y)}` } } },
                    scales: {
                        y: { ticks: { callback: v => formatCLP(v, true) }, grid: { color: '#f1f5f9' } },
                        x: { grid: { display: false } }
                    },
                    animation: { duration: 800, easing: 'easeInOutQuart' }
                }
            });
        }

        // Detalle por categoría
        const breakdown = document.getElementById('cat-breakdown');
        if (breakdown) {
            if (activeCats.length === 0) {
                breakdown.innerHTML = '<p style="color:#94a3b8; text-align:center; padding:1.5rem;">Sin gastos este mes</p>';
            } else {
                breakdown.innerHTML = this.CATEGORIES.filter(c => byCat[c.key] > 0).map(c => {
                    const pct = total > 0 ? (byCat[c.key] / total * 100).toFixed(1) : 0;
                    return `
                        <div style="display:flex; align-items:center; gap:0.75rem;">
                            <div style="width:2rem; height:2rem; border-radius:0.5rem; background:${c.color}18; display:flex; align-items:center; justify-content:center; flex-shrink:0;">${c.icon}</div>
                            <div style="flex:1;">
                                <div style="display:flex; justify-content:space-between; margin-bottom:0.3rem;">
                                    <span style="font-size:0.85rem; font-weight:600; color:#374151;">${c.label}</span>
                                    <span style="font-size:0.85rem; font-weight:700; color:#0f172a;">${formatCLP(byCat[c.key])}</span>
                                </div>
                                <div class="exp-budget-bar-wrap">
                                    <div class="exp-budget-bar" style="width:${pct}%; background:${c.color};"></div>
                                </div>
                            </div>
                            <span style="font-size:0.75rem; color:#64748b; min-width:35px; text-align:right;">${pct}%</span>
                        </div>
                    `;
                }).join('');
            }
        }
    },

    /* ------------------------------------------------------------------ */
    /* PANEL: PRESUPUESTO                                                   */
    /* ------------------------------------------------------------------ */

    renderBudgetPanel() {
        return `
            <div style="animation: expFadeUp 0.3s ease;">
                <div style="background:#eff6ff; border: 1px solid #bfdbfe; border-radius:0.75rem; padding:1rem 1.25rem; margin-bottom:1.5rem; display:flex; gap:0.75rem; align-items:flex-start;">
                    <span style="font-size:1.25rem;">💡</span>
                    <div style="font-size:0.85rem; color:#1e40af;">
                        <strong>¿Cómo funciona el presupuesto?</strong><br>
                        Define cuánto quieres gastar máximo por categoría en el mes. El sistema te avisará cuando te acerques al límite (🟡 80%) o lo superes (🔴 100%).
                    </div>
                </div>

                <div id="budget-list" style="display:flex; flex-direction:column; gap:1rem;">
                    <div style="text-align:center; padding:2rem; color:#94a3b8;">Cargando presupuesto...</div>
                </div>

                <button onclick="ExpensesView.saveBudgets()"
                        style="margin-top:1.5rem; width:100%; padding:0.875rem; background:linear-gradient(135deg,#10b981,#059669); color:#fff;
                               border:none; border-radius:0.875rem; font-size:1rem; font-weight:700; cursor:pointer;
                               box-shadow: 0 4px 14px rgba(16,185,129,0.35); transition: all 0.2s;"
                        onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
                    💾 Guardar Presupuestos
                </button>
            </div>
        `;
    },

    async loadBudget() {
        const budgets  = this._getBudgets();
        const month    = new Date().toISOString().slice(0, 7);
        const expenses = await this._getExpenseMovements(month);

        const byCat = {};
        this.CATEGORIES.forEach(c => { byCat[c.key] = 0; });
        expenses.forEach(e => { const k = e.category || 'otros'; byCat[k] = (byCat[k] || 0) + e.amount; });

        const list = document.getElementById('budget-list');
        if (!list) return;

        list.innerHTML = this.CATEGORIES.map(c => {
            const spent    = byCat[c.key] || 0;
            const budget   = budgets[c.key] || 0;
            const pct      = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
            const barColor = pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : c.color;
            const status   = pct >= 100 ? '🔴 Sobrepasado' : pct >= 80 ? '🟡 Cerca del límite' : pct > 0 ? '🟢 OK' : '—';

            return `
                <div style="background:#fff; border-radius:1rem; padding:1.25rem 1.5rem; box-shadow:0 2px 12px rgba(0,0,0,0.06); border-left:4px solid ${c.color};">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.75rem; flex-wrap:wrap; gap:0.5rem;">
                        <div style="display:flex; align-items:center; gap:0.625rem;">
                            <span style="font-size:1.3rem;">${c.icon}</span>
                            <div>
                                <div style="font-weight:700; color:#0f172a; font-size:0.9rem;">${c.label}</div>
                                <div style="font-size:0.75rem; color:#64748b;">${c.desc}</div>
                            </div>
                        </div>
                        <span style="font-size:0.75rem; font-weight:600; color:${barColor};">${status}</span>
                    </div>

                    <div style="display:flex; gap:0.75rem; align-items:center; margin-bottom:0.625rem; flex-wrap:wrap;">
                        <div style="flex:1; min-width:120px;">
                            <div style="font-size:0.72rem; color:#64748b; margin-bottom:0.2rem;">Presupuesto mensual</div>
                            <input type="number" id="budget-${c.key}" value="${budget || ''}" placeholder="Sin límite" min="0"
                                   class="form-control" style="border-radius:0.5rem; border:2px solid #e2e8f0; padding:0.5rem 0.75rem; font-size:0.9rem; font-weight:600;">
                        </div>
                        <div style="text-align:right; min-width:100px;">
                            <div style="font-size:0.72rem; color:#64748b;">Gastado este mes</div>
                            <div style="font-weight:800; color:${barColor}; font-size:1rem;">${formatCLP(spent)}</div>
                        </div>
                    </div>

                    ${budget > 0 ? `
                    <div>
                        <div class="exp-budget-bar-wrap">
                            <div class="exp-budget-bar" style="width:${pct}%; background:${barColor};"></div>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:0.72rem; color:#94a3b8; margin-top:0.3rem;">
                            <span>${pct.toFixed(1)}% utilizado</span>
                            <span>Queda: ${formatCLP(Math.max(0, budget - spent))}</span>
                        </div>
                    </div>` : ''}
                </div>
            `;
        }).join('');
    },

    saveBudgets() {
        const budgets = {};
        this.CATEGORIES.forEach(c => {
            const inp = document.getElementById(`budget-${c.key}`);
            const val = parseFloat(inp?.value) || 0;
            if (val > 0) budgets[c.key] = val;
        });
        localStorage.setItem('EXPENSE_BUDGETS', JSON.stringify(budgets));
        showNotification('💾 Presupuestos guardados correctamente', 'success');
        this.loadBudget();
    },

    checkBudgetAlert(category, addedAmount) {
        const budgets = this._getBudgets();
        const budget  = budgets[category];
        if (!budget) return;

        const month = new Date().toISOString().slice(0, 7);
        this._getExpenseMovements(month).then(expenses => {
            const spent = expenses.filter(e => e.category === category).reduce((s, e) => s + e.amount, 0);
            const pct   = (spent / budget) * 100;
            const catInfo = this.CATEGORIES.find(c => c.key === category) || this.CATEGORIES[6];
            if (pct >= 100) {
                showNotification(`⚠️ ${catInfo.icon} Superaste el presupuesto de ${catInfo.label} (${pct.toFixed(0)}%)`, 'error');
            } else if (pct >= 80) {
                showNotification(`🟡 ${catInfo.icon} Cerca del límite en ${catInfo.label} (${pct.toFixed(0)}%)`, 'warning');
            }
        });
    },

    /* ------------------------------------------------------------------ */
    /* KPIs SUPERIORES                                                      */
    /* ------------------------------------------------------------------ */

    async loadKPIs() {
        const now     = new Date();
        const month   = now.toISOString().slice(0, 7);
        const weekAgo = new Date(now - 7 * 86400000).toISOString();

        const allMonth = await this._getExpenseMovements(month);
        const monthTotal = allMonth.reduce((s, e) => s + e.amount, 0);

        const weekExp = allMonth.filter(e => e.date >= weekAgo);
        const weekTotal = weekExp.reduce((s, e) => s + e.amount, 0);

        // Top categoría del mes
        const byCat = {};
        allMonth.forEach(e => { const k = e.category || 'otros'; byCat[k] = (byCat[k] || 0) + e.amount; });
        const topKey  = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
        const topCat  = topKey ? this.CATEGORIES.find(c => c.key === topKey[0]) : null;

        const kpiMonth = document.getElementById('kpi-month');
        const kpiWeek  = document.getElementById('kpi-week');
        const kpiCount = document.getElementById('kpi-count');
        const kpiTop   = document.getElementById('kpi-top-cat');

        if (kpiMonth) kpiMonth.textContent = formatCLP(monthTotal);
        if (kpiWeek)  kpiWeek.textContent  = formatCLP(weekTotal);
        if (kpiCount) kpiCount.textContent  = allMonth.length;
        if (kpiTop)   kpiTop.textContent    = topCat ? `${topCat.icon} ${topCat.label}` : '—';
    },

    /* ------------------------------------------------------------------ */
    /* HELPERS                                                              */
    /* ------------------------------------------------------------------ */

    async _getExpenseMovements(month) {
        try {
            const all = await Expense.getAll();
            return all.filter(e => {
                const inMonth = e.date && e.date.startsWith(month);
                return inMonth;
            }).map(e => ({
                ...e,
                category: e.category || 'otros',
                description: e.description || ''
            }));
        } catch (e) {
            console.error('[Expenses] Error cargando gastos de tabla expenses:', e);
            return [];
        }
    },

    _getBudgets() {
        try {
            return JSON.parse(localStorage.getItem('EXPENSE_BUDGETS') || '{}');
        } catch { return {}; }
    },

    _getLast6Months() {
        const months = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push({
                value: d.toISOString().slice(0, 7),
                label: d.toLocaleDateString('es-CL', { month: 'short', year: '2-digit' })
            });
        }
        return months;
    },

    destroy() {
        Object.values(this.chartInstances).forEach(ch => { try { ch.destroy(); } catch(e){} });
        this.chartInstances = {};
    }
};
