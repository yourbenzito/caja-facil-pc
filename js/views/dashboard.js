/**
 * DashboardView — Rediseño Premium 2026
 * Estilo moderno claro con tarjetas animadas, micro-interacciones y datos en tiempo real
 */

const DashboardView = {
    data: {
        todaySales: 0,
        yesterdaySales: 0,
        avgTicket: 0,
        topProducts: [],
        cashStatus: { efectivo: 0, tarjeta: 0, transferencia: 0 },
        businessOpen: false,
        alerts: {
            lowStock: [],
            overdueDebt: [],
            cashOpenTooLong: false
        },
        stagnantValue: 0,
        stagnantCount: 0
    },

    async render() {
        await this.loadDashboardData();
        const today = new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const todayCap = today.charAt(0).toUpperCase() + today.slice(1);

        const diff    = this.data.todaySales - this.data.yesterdaySales;
        const pct     = this.data.yesterdaySales > 0 ? ((diff / this.data.yesterdaySales) * 100).toFixed(1) : null;
        const isUp    = diff >= 0;
        const pctText = pct !== null ? (isUp ? `+${pct}%` : `${pct}%`) : null;

        const totalCash = this.data.cashStatus.efectivo + this.data.cashStatus.tarjeta + this.data.cashStatus.transferencia;
        const salesTotal = totalCash || this.data.todaySales;

        return `
            <style>
                /* ── Animaciones ── */
                @keyframes dbFadeUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes dbCountUp {
                    from { opacity: 0; transform: scale(0.85); }
                    to   { opacity: 1; transform: scale(1); }
                }
                @keyframes dbBarFill {
                    from { width: 0; }
                }
                @keyframes dbPulseRed {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
                    50%      { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
                }
                @keyframes dbSpin {
                    to { transform: rotate(360deg); }
                }

                /* ── KPI Card ── */
                .db-kpi {
                    background: #ffffff;
                    border-radius: 1.25rem;
                    padding: 1.5rem;
                    box-shadow: 0 4px 24px rgba(0,0,0,0.07);
                    border-left: 5px solid transparent;
                    position: relative;
                    overflow: hidden;
                    transition: transform 0.22s ease, box-shadow 0.22s ease;
                    animation: dbFadeUp 0.4s ease both;
                    cursor: default;
                }
                .db-kpi:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 12px 40px rgba(0,0,0,0.13);
                }
                .db-kpi-bg-icon {
                    position: absolute; right: -12px; bottom: -12px;
                    font-size: 5rem; opacity: 0.07; line-height: 1;
                    pointer-events: none; user-select: none;
                }
                .db-kpi-label {
                    font-size: 0.75rem; font-weight: 700; text-transform: uppercase;
                    letter-spacing: 1px; margin-bottom: 0.625rem;
                }
                .db-kpi-value {
                    font-size: 1.9rem; font-weight: 900; line-height: 1;
                    letter-spacing: -1px;
                    animation: dbCountUp 0.5s ease both;
                }
                .db-kpi-sub {
                    font-size: 0.75rem; margin-top: 0.5rem; display: flex; align-items: center; gap: 0.35rem;
                }
                .db-kpi-pill {
                    display: inline-flex; align-items: center; gap: 0.2rem;
                    padding: 0.15rem 0.6rem; border-radius: 99px; font-size: 0.72rem; font-weight: 700;
                }

                /* ── Sección ── */
                .db-section {
                    background: #ffffff;
                    border-radius: 1.25rem;
                    padding: 1.5rem;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.06);
                    animation: dbFadeUp 0.4s ease both;
                }
                .db-section-title {
                    font-size: 0.9rem; font-weight: 800; color: #0f172a;
                    display: flex; align-items: center; gap: 0.5rem;
                    margin-bottom: 1.25rem;
                }

                /* ── Método de pago ── */
                .db-payment-item {
                    padding: 1rem 1.25rem; border-radius: 0.875rem;
                    transition: transform 0.18s, box-shadow 0.18s;
                    cursor: default;
                }
                .db-payment-item:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.1); }
                .db-payment-bar-wrap { height: 6px; background: #e2e8f0; border-radius: 99px; overflow: hidden; margin-top: 0.625rem; }
                .db-payment-bar { height: 100%; border-radius: 99px; animation: dbBarFill 0.8s ease; }

                /* ── Ranking productos ── */
                .db-rank-row {
                    display: flex; align-items: center; gap: 0.875rem;
                    padding: 0.75rem 1rem; border-radius: 0.75rem;
                    background: #f8fafc; margin-bottom: 0.5rem;
                    transition: background 0.18s, transform 0.18s;
                }
                .db-rank-row:hover { background: #eff6ff; transform: translateX(4px); }
                .db-rank-medal {
                    width: 2rem; height: 2rem; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    font-weight: 900; font-size: 0.8rem; flex-shrink: 0;
                }

                /* ── Accesos rápidos ── */
                .db-quick-btn {
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    gap: 0.5rem; padding: 1.5rem 1rem; border-radius: 1rem;
                    border: none; cursor: pointer; font-weight: 700; font-size: 0.85rem;
                    transition: all 0.22s ease; text-align: center; min-height: 110px;
                }
                .db-quick-btn:hover { transform: translateY(-4px); }
                .db-quick-btn .btn-icon { font-size: 1.8rem; }

                /* ── Alertas ── */
                .db-alert-box {
                    padding: 1rem 1.25rem; border-radius: 0.875rem;
                    display: flex; align-items: flex-start; gap: 0.75rem;
                    margin-bottom: 0.75rem;
                    animation: dbFadeUp 0.3s ease;
                }
                .db-alert-dot {
                    width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; margin-top: 4px;
                }
                .db-alert-dot.red   { background: #ef4444; animation: dbPulseRed 2s infinite; }
                .db-alert-dot.orange{ background: #f97316; }
                .db-alert-dot.yellow{ background: #eab308; }

                /* ── Estado del negocio ── */
                .db-status-badge {
                    padding: 0.5rem 1.25rem; border-radius: 99px; font-weight: 700; font-size: 0.85rem;
                    display: flex; align-items: center; gap: 0.5rem;
                }
            </style>

            <!-- HEADER -->
            <div class="view-header" style="animation: dbFadeUp 0.3s ease;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <h1 style="color: #0f172a; font-size: 1.6rem;">📊 Dashboard</h1>
                        <p style="color: #64748b; font-size: 0.85rem;">${todayCap}</p>
                    </div>
                    <div class="db-status-badge ${this.data.businessOpen ? 'style="background:#dcfce7; color:#166534; border: 1.5px solid #86efac;"' : 'style="background:#fee2e2; color:#991b1b; border: 1.5px solid #fca5a5;"'}">
                        <span style="width:8px; height:8px; border-radius:50%; background:${this.data.businessOpen ? '#22c55e' : '#ef4444'}; display:inline-block;"></span>
                        ${this.data.businessOpen ? 'Caja Abierta' : 'Caja Cerrada'}
                    </div>
                </div>
            </div>

            <!-- KPI GRID -->
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">

                <!-- Ventas del día -->
                <div class="db-kpi" style="border-left-color: #4f46e5; animation-delay: 0s;" onclick="app.navigate('sales')">
                    <div class="db-kpi-bg-icon">💰</div>
                    <div class="db-kpi-label" style="color:#4f46e5;">Ventas del Día</div>
                    <div class="db-kpi-value" style="color:#0f172a;">${formatCLP(this.data.todaySales, true)}</div>
                    <div class="db-kpi-sub" style="color:#64748b;">
                        ${pctText
                            ? `<span class="db-kpi-pill" style="background:${isUp ? '#dcfce7' : '#fee2e2'}; color:${isUp ? '#166534' : '#991b1b'};">${isUp ? '▲' : '▼'} ${pctText}</span> vs ayer`
                            : '<span style="opacity:0.7;">Sin datos de ayer</span>'
                        }
                    </div>
                </div>

                <!-- Ticket promedio -->
                <div class="db-kpi" style="border-left-color: #ec4899; animation-delay: 0.07s;">
                    <div class="db-kpi-bg-icon">🎟️</div>
                    <div class="db-kpi-label" style="color:#ec4899;">Ticket Promedio</div>
                    <div class="db-kpi-value" style="color:#0f172a;">${formatCLP(this.data.avgTicket, true)}</div>
                    <div class="db-kpi-sub" style="color:#64748b;">Promedio por venta de hoy</div>
                </div>

                <!-- Productos vendidos -->
                <div class="db-kpi" style="border-left-color: #06b6d4; animation-delay: 0.12s;" onclick="app.navigate('products')">
                    <div class="db-kpi-bg-icon">📦</div>
                    <div class="db-kpi-label" style="color:#06b6d4;">Ítems Vendidos</div>
                    <div class="db-kpi-value" style="color:#0f172a;">${this.data.topProducts.length}</div>
                    <div class="db-kpi-sub" style="color:#64748b;">Productos distintos hoy</div>
                </div>

                <!-- Alertas activas -->
                <div class="db-kpi" style="border-left-color: ${(this.data.alerts.lowStock.length + this.data.alerts.overdueDebt.length) > 0 ? '#ef4444' : '#10b981'}; animation-delay: 0.17s;">
                    <div class="db-kpi-bg-icon">⚠️</div>
                    <div class="db-kpi-label" style="color:${(this.data.alerts.lowStock.length + this.data.alerts.overdueDebt.length) > 0 ? '#ef4444' : '#10b981'};">Alertas</div>
                    <div class="db-kpi-value" style="color:#0f172a;">${this.data.alerts.lowStock.length + this.data.alerts.overdueDebt.length}</div>
                    <div class="db-kpi-sub" style="color:#64748b;">
                        ${this.data.alerts.lowStock.length} stock bajo · ${this.data.alerts.overdueDebt.length} deudas
                    </div>
                </div>

                <!-- Dinero Inmovilizado -->
                <div class="db-kpi" style="border-left-color: #f97316; animation-delay: 0.22s; cursor: pointer;" onclick="ReportsView.currentReport = 'stagnant'; app.navigate('reports')">
                    <div class="db-kpi-bg-icon">⏳</div>
                    <div class="db-kpi-label" style="color:#f97316;">Dinero Inmovilizado</div>
                    <div class="db-kpi-value" style="color:#0f172a;">${formatCLP(this.data.stagnantValue, true)}</div>
                    <div class="db-kpi-sub" style="color:#64748b;">
                        ${this.data.stagnantCount} productos sin venta > 30d
                    </div>
                </div>
            </div>

            <!-- FILA 2: Métodos de pago + Top Productos -->
            <div style="display: grid; grid-template-columns: 1fr 1.3fr; gap: 1.25rem; margin-bottom: 1.25rem;">

                <!-- Ventas por método de pago -->
                <div class="db-section" style="animation-delay: 0.2s;">
                    <div class="db-section-title">💳 Ventas por Método de Pago</div>
                    ${this._renderPaymentMethods(salesTotal)}
                </div>

                <!-- Productos más vendidos -->
                <div class="db-section" style="animation-delay: 0.24s;">
                    <div class="db-section-title">🏆 Productos Más Vendidos Hoy</div>
                    ${this._renderTopProducts()}
                </div>
            </div>

            <!-- ALERTAS (condicional) -->
            ${this._renderAlerts()}

            <!-- ACCESOS RÁPIDOS -->
            <div class="db-section" style="animation-delay: 0.32s;">
                <div class="db-section-title">⚡ Accesos Rápidos</div>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.875rem;">

                    <button class="db-quick-btn" onclick="app.navigate('pos')"
                            style="background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff; box-shadow: 0 4px 16px rgba(79,70,229,0.3);">
                        <span class="btn-icon">🛒</span>
                        <span>Nueva Venta</span>
                    </button>

                    <button class="db-quick-btn" onclick="app.navigate('products')"
                            style="background: #fff; color: #374151; border: 2px solid #e2e8f0; box-shadow: 0 4px 14px rgba(0,0,0,0.07);"
                            onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='#fff'">
                        <span class="btn-icon">📦</span>
                        <span>Productos</span>
                    </button>

                    <button class="db-quick-btn" onclick="app.navigate('expenses')"
                            style="background: #fff4f2; color: #dc2626; border: 2px solid #fecaca; box-shadow: 0 4px 14px rgba(0,0,0,0.07);"
                            onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='#fff4f2'">
                        <span class="btn-icon">💸</span>
                        <span>Registrar Gasto</span>
                    </button>

                    <button class="db-quick-btn" onclick="app.navigate('cash')"
                            style="background: #f0fdf4; color: #166534; border: 2px solid #86efac; box-shadow: 0 4px 14px rgba(0,0,0,0.07);"
                            onmouseover="this.style.background='#dcfce7'" onmouseout="this.style.background='#f0fdf4'">
                        <span class="btn-icon">💰</span>
                        <span>Caja</span>
                    </button>

                    <button class="db-quick-btn" onclick="app.navigate('customers')"
                            style="background: #fffbeb; color: #92400e; border: 2px solid #fde68a; box-shadow: 0 4px 14px rgba(0,0,0,0.07);"
                            onmouseover="this.style.background='#fef3c7'" onmouseout="this.style.background='#fffbeb'">
                        <span class="btn-icon">👥</span>
                        <span>Clientes</span>
                    </button>

                    <button class="db-quick-btn" onclick="app.navigate('inventory')"
                            style="background: #f0f9ff; color: #0369a1; border: 2px solid #7dd3fc; box-shadow: 0 4px 14px rgba(0,0,0,0.07);"
                            onmouseover="this.style.background='#e0f2fe'" onmouseout="this.style.background='#f0f9ff'">
                        <span class="btn-icon">📊</span>
                        <span>Stock</span>
                    </button>

                </div>
            </div>
        `;
    },

    /* ---------------------------------------------------------- */
    /* HELPERS DE RENDER                                            */
    /* ---------------------------------------------------------- */

    _renderPaymentMethods(salesTotal) {
        const methods = [
            { label: 'Efectivo',      icon: '💵', amount: this.data.cashStatus.efectivo,      color: '#10b981', bg: '#ecfdf5', border: '#6ee7b7' },
            { label: 'Tarjeta',       icon: '💳', amount: this.data.cashStatus.tarjeta,       color: '#3b82f6', bg: '#eff6ff', border: '#93c5fd' },
            { label: 'Transferencia', icon: '🏦', amount: this.data.cashStatus.transferencia, color: '#f59e0b', bg: '#fffbeb', border: '#fcd34d' }
        ];
        return methods.map(m => {
            const pct = salesTotal > 0 ? Math.min((m.amount / salesTotal) * 100, 100) : 0;
            return `
                <div class="db-payment-item" style="background:${m.bg}; border:1.5px solid ${m.border}; margin-bottom:0.625rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; align-items:center; gap:0.5rem; font-weight:700; color:${m.color}; font-size:0.875rem;">
                            ${m.icon} ${m.label}
                        </div>
                        <div style="font-weight:800; color:#0f172a; font-size:0.95rem;">${formatCLP(m.amount, true)}</div>
                    </div>
                    <div class="db-payment-bar-wrap">
                        <div class="db-payment-bar" style="width:${pct}%; background:${m.color};"></div>
                    </div>
                    <div style="font-size:0.7rem; color:#64748b; margin-top:0.25rem; text-align:right;">${pct.toFixed(1)}% del total</div>
                </div>
            `;
        }).join('');
    },

    _renderTopProducts() {
        if (this.data.topProducts.length === 0) {
            return `<div style="text-align:center; padding:1.5rem; color:#94a3b8;">
                <div style="font-size:2.5rem; margin-bottom:0.5rem;">🛍️</div>
                <p style="font-size:0.85rem;">Sin ventas registradas hoy</p>
            </div>`;
        }

        const medals = [
            { bg: '#fef3c7', color: '#d97706', text: '🥇' },
            { bg: '#f1f5f9', color: '#475569', text: '🥈' },
            { bg: '#fef3c7', color: '#b45309', text: '🥉' },
        ];

        return this.data.topProducts.map((p, i) => {
            const medal = medals[i] || { bg: '#f8fafc', color: '#94a3b8', text: `#${i+1}` };
            return `
                <div class="db-rank-row">
                    <div class="db-rank-medal" style="background:${medal.bg}; color:${medal.color};">${medal.text}</div>
                    <div style="flex:1; font-size:0.875rem; font-weight:600; color:#0f172a;">${p.name}</div>
                    <div style="font-size:0.8rem; font-weight:700; color:#4f46e5; background:#eff6ff; padding:0.2rem 0.6rem; border-radius:99px;">${p.quantity} uds.</div>
                </div>
            `;
        }).join('');
    },

    _renderAlerts() {
        const { lowStock, overdueDebt, cashOpenTooLong } = this.data.alerts;
        const hasAlerts = lowStock.length > 0 || overdueDebt.length > 0 || cashOpenTooLong;
        if (!hasAlerts) return '';

        return `
            <div class="db-section" style="animation-delay: 0.28s; margin-bottom: 1.25rem; border-left: 4px solid #f97316;">
                <div class="db-section-title">⚠️ Alertas del Sistema</div>
                ${lowStock.length > 0 ? `
                    <div class="db-alert-box" style="background:#fef2f2; border:1px solid #fecaca;">
                        <span class="db-alert-dot red"></span>
                        <div style="flex:1;">
                            <div style="font-size:0.85rem; font-weight:700; color:#dc2626; margin-bottom:0.25rem;">📦 Stock Bajo (${lowStock.length} productos)</div>
                            <div style="font-size:0.8rem; color:#7f1d1d;">${lowStock.map(p => `${p.name} (${p.stock}/${p.minStock})`).join(' · ')}</div>
                        </div>
                        <button onclick="app.navigate('inventory')" style="background:#dc2626; color:#fff; border:none; border-radius:0.5rem; padding:0.35rem 0.75rem; font-size:0.75rem; font-weight:700; cursor:pointer; white-space:nowrap; flex-shrink:0;">Ver Stock</button>
                    </div>
                ` : ''}
                ${overdueDebt.length > 0 ? `
                    <div class="db-alert-box" style="background:#fff7ed; border:1px solid #fed7aa;">
                        <span class="db-alert-dot orange"></span>
                        <div style="flex:1;">
                            <div style="font-size:0.85rem; font-weight:700; color:#c2410c; margin-bottom:0.25rem;">💳 Deudas > 1 semana (${overdueDebt.length} clientes)</div>
                            <div style="font-size:0.8rem; color:#7c2d12;">${overdueDebt.map(c => `${c.name} (${formatCLP(c.balanceCredit)})`).join(' · ')}</div>
                        </div>
                        <button onclick="app.navigate('customers')" style="background:#ea580c; color:#fff; border:none; border-radius:0.5rem; padding:0.35rem 0.75rem; font-size:0.75rem; font-weight:700; cursor:pointer; white-space:nowrap; flex-shrink:0;">Ver Clientes</button>
                    </div>
                ` : ''}
                ${cashOpenTooLong ? `
                    <div class="db-alert-box" style="background:#fefce8; border:1px solid #fde68a;">
                        <span class="db-alert-dot yellow"></span>
                        <div>
                            <div style="font-size:0.85rem; font-weight:700; color:#a16207; margin-bottom:0.25rem;">💰 Caja Abierta hace más de 8 horas</div>
                            <div style="font-size:0.8rem; color:#78350f;">Considera cerrar la caja para evitar riesgos</div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    },

    /* ---------------------------------------------------------- */
    /* CARGA DE DATOS                                               */
    /* ---------------------------------------------------------- */

    async loadDashboardData() {
        try {
            const today     = new Date().toISOString().slice(0, 10);
            const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

            const allSales = await Sale.getAll();
            const todaySales = allSales.filter(s => s.date && s.date.startsWith(today));

            this.data.todaySales    = todaySales.reduce((s, x) => s + (x.total || 0), 0);
            this.data.yesterdaySales = allSales.filter(s => s.date && s.date.startsWith(yesterday)).reduce((s, x) => s + (x.total || 0), 0);
            this.data.avgTicket     = todaySales.length > 0 ? this.data.todaySales / todaySales.length : 0;

            // Productos más vendidos
            const productSales = {};
            todaySales.forEach(sale => {
                if (sale.items && Array.isArray(sale.items)) {
                    sale.items.forEach(item => {
                        const name = item.name || 'Sin nombre';
                        productSales[name] = (productSales[name] || 0) + (item.quantity || 0);
                    });
                }
            });
            this.data.topProducts = Object.entries(productSales)
                .sort((a, b) => b[1] - a[1]).slice(0, 5)
                .map(([name, quantity]) => ({ name, quantity }));

            // Ventas por método de pago
            this.data.cashStatus = { efectivo: 0, tarjeta: 0, transferencia: 0 };
            todaySales.forEach(sale => {
                const method = (sale.paymentMethod || '').toLowerCase();
                const amount = sale.total || 0;
                if (method.includes('efectivo') || method.includes('cash')) {
                    this.data.cashStatus.efectivo += amount;
                } else if (method.includes('tarjeta') || method.includes('card')) {
                    this.data.cashStatus.tarjeta += amount;
                } else if (method.includes('transferencia') || method.includes('transfer')) {
                    this.data.cashStatus.transferencia += amount;
                }
            });

            // Estado caja
            const cashRegisters = await CashRegister.getAll();
            this.data.businessOpen = cashRegisters.some(cr => cr.status === 'open');

            // Alertas
            await this.loadAlerts();

            // Dinero Inmovilizado (>30 días de inactividad)
            try {
                const stagnantReport = await ReportController.getStagnantProducts(30);
                this.data.stagnantValue = stagnantReport.reduce((sum, item) => sum + (item.costValue || 0), 0);
                this.data.stagnantCount = stagnantReport.length;
            } catch (e) {
                console.error('[Dashboard] Error cargando dinero inmovilizado:', e);
                this.data.stagnantValue = 0;
                this.data.stagnantCount = 0;
            }

        } catch (error) {
            console.error('[Dashboard] Error cargando datos:', error);
        }
    },

    async loadAlerts() {
        try {
            const products  = await Product.getAll();
            this.data.alerts.lowStock = products.filter(p => {
                const min = p.minStock || 0;
                return min > 0 && (p.stock || 0) <= min;
            }).slice(0, 5);

            const customers = await Customer.getAll();
            const oneWeekAgo = new Date(Date.now() - 604800000);
            this.data.alerts.overdueDebt = customers.filter(c => {
                const balance = c.balanceCredit || 0;
                const last    = c.lastPurchaseAt ? new Date(c.lastPurchaseAt) : null;
                return balance > 0 && last && last < oneWeekAgo;
            }).slice(0, 5);

            const cashRegisters  = await CashRegister.getAll();
            const openCash = cashRegisters.find(cr => cr.status === 'open');
            if (openCash && openCash.openDate) {
                const hrs = (Date.now() - new Date(openCash.openDate).getTime()) / 3600000;
                this.data.alerts.cashOpenTooLong = hrs > 8;
            }
        } catch (e) {
            console.error('[Dashboard] Error alertas:', e);
        }
    },

    async afterRender() {
        this.refreshInterval = setInterval(async () => {
            await this.loadDashboardData();
        }, 30000);
    },

    destroy() {
        if (this.refreshInterval) clearInterval(this.refreshInterval);
    }
};
