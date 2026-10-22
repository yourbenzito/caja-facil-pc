/**
 * =========================================================================
 * MÓDULO DE CONTROL DE STOCK E INVENTARIO - CAJA FÁCIL POS
 * =========================================================================
 * Remodelación Senior: Arquitectura unificada, alto rendimiento y UX ejecutiva.
 * 
 * Secciones:
 * 1. 📦 Inventario General (KPIs financieros + Tabla en vivo de 15 productos/pág)
 * 2. 📉 Bajas y Consumos (Pérdidas y Consumos con historiales 100% independientes)
 * 3. 📋 Conteo Físico (Auditoría de mercadería en local con diseño claro)
 * 4. 📜 Historial de Movimientos (Kardex general con trazabilidad completa)
 * 5. 💡 Sugerencias de Reposición (Alertas por proveedor para compras)
 * 
 * Filosofía Ponytail: Código simple, sin librerías pesadas, atajos de teclado
 * (Enter, Esc, clic afuera para cerrar) y cero duplicados en Supabase.
 */

// ponytail: Helpers de formato y protección seguros en window para no colisionar con formatter.js
if (typeof window !== 'undefined') {
    if (typeof window.safeAttr !== 'function') {
        window.safeAttr = (str) => String(str || '').replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, "&quot;");
    }
    if (typeof window.safeHTML !== 'function') {
        window.safeHTML = (str) => String(str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
    if (typeof window.formatStock !== 'function') {
        window.formatStock = (val, isWeightOrDecimals = 3) => {
            const num = parseFloat(val);
            if (isNaN(num)) return '0';
            const dec = (typeof isWeightOrDecimals === 'boolean') ? (isWeightOrDecimals ? 3 : 0) : Number(isWeightOrDecimals || 0);
            return num.toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec });
        };
    }
}

const InventoryView = {
    // ponytail: Gestión de orden de compra activa referencial (1 proveedor a la vez)
    getActivePurchaseOrder() {
        try {
            const data = localStorage.getItem('CF_ACTIVE_PURCHASE_ORDER');
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    },

    saveActivePurchaseOrder(order) {
        try {
            localStorage.setItem('CF_ACTIVE_PURCHASE_ORDER', JSON.stringify(order));
        } catch (e) {
            console.warn('Error guardando orden de compra activa:', e);
        }
    },

    clearActivePurchaseOrder() {
        localStorage.removeItem('CF_ACTIVE_PURCHASE_ORDER');
        this.switchSection('suggestions');
        showNotification('Lista de pedido descartada.', 'info');
    },

    // ponytail: Mapa de rotación de ventas por producto (los más vendidos primero)
    async getProductsSalesMap() {
        if (this._salesMap) return this._salesMap;
        const map = {};
        try {
            if (typeof Sale !== 'undefined' && Sale.getLatest) {
                const sales = await Sale.getLatest(1000);
                if (Array.isArray(sales)) {
                    sales.forEach(s => {
                        if (Array.isArray(s.items)) {
                            s.items.forEach(it => {
                                const pid = it.productId || it.id;
                                if (pid) {
                                    map[pid] = (map[pid] || 0) + (parseFloat(it.quantity) || 0);
                                }
                            });
                        }
                    });
                }
            }
        } catch (e) {
            console.warn('Error calculando rotación de ventas:', e);
        }
        this._salesMap = map;
        return map;
    },

    // Estado de la navegación principal
    currentSection: 'inventory', // 'inventory' | 'egress' | 'audit' | 'history' | 'suggestions'
    egressSubTab: 'losses',       // 'losses' | 'consumptions' | 'bulk'
    showCapitalDist: false,       // Panel colapsable de distribución de capital

    // Datos maestros en memoria
    products: null,
    allProducts: [],
    suppliersList: [],
    recentMovements: [],
    categories: [],
    auditHistory: [],
    historyTypeFilter: 'all',
    historySearchQuery: '',

    // Filtros y paginación de la tabla principal
    inventorySearchQuery: '',
    inventorySelectedCategory: '',
    inventorySelectedStockStatus: 'all', // 'all' | 'low' | 'out' | 'optimum'
    inventorySelectedSupplier: '',
    inventoryCurrentPage: 1,
    inventoryPageSize: 15, // Preferencia del usuario: 15 productos por página

    // Bajas y Consumos (Tarea 5)
    egressFilter: 'all',          // 'all' | 'loss' | 'consumption'
    egressTimeFilter: 'month',    // 'today' | 'week' | 'month' | 'all'
    egressSearchQuery: '',
    egressCart: [],               // Items en preparación para dar de baja
    egressReason: '',
    _egressModalActiveProduct: null,
    selectedLossDate: new Date().toLocaleDateString('sv-SE'),
    selectedConsumptionDate: new Date().toLocaleDateString('sv-SE'),
    selectedEgressProductData: null,
    selectedBulkType: 'consumption',
    selectedProducts: [], // Para ajustes masivos

    // Estado del Conteo Físico (Auditoría)
    auditState: null,

    // Historial general
    historyFilterType: 'all',

    // =========================================================================
    // 1. INICIALIZACIÓN Y CICLO DE VIDA
    // =========================================================================

    async init() {
        // Carga única inicial de datos
        if (!this.products) {
            await this.refreshData();
        }
        // Configurar escuchadores según la sección activa
        this.setupCurrentSectionListeners();
    },

    async refreshData() {
        try {
            const rawProducts = await Product.getAll();
            const suppliers = await Supplier.getAll();
            this.suppliersList = suppliers || [];

            const suppliersMap = this.suppliersList.reduce((acc, s) => {
                acc[s.id] = s.name;
                return acc;
            }, {});

            this.allProducts = (rawProducts || []).filter(p => !p.deleted).map(p => ({
                ...p,
                supplierName: suppliersMap[p.lastSupplierId || p.supplierId] || 'Sin proveedor'
            }));
            this.products = this.allProducts;

            // Categorías únicas
            this.categories = [...new Set(this.allProducts.map(p => {
                const cat = p.category || 'General';
                return (typeof CategoryHelper !== 'undefined') ? CategoryHelper.sanitize(cat) : cat.trim();
            }))].sort();

            // Movimientos recientes (últimos 30 días)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            this.recentMovements = await StockMovement.getByDateRange(thirtyDaysAgo, new Date()) || [];

            // Historial de auditorías completadas
            await this.loadAuditHistory();
        } catch (error) {
            console.error('[InventoryView] Error cargando datos:', error);
            showNotification('Error al cargar datos de inventario: ' + error.message, 'error');
        }
    },

    async loadAuditHistory() {
        try {
            const logs = await AuditLogService.getByEntity('category_audit') || [];
            this.auditHistory = logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10);
        } catch (e) {
            console.warn('[InventoryView] Historial de auditoría no disponible:', e);
            this.auditHistory = [];
        }
    },

    setupCurrentSectionListeners() {
        if (this.currentSection === 'egress') {
            this.setupEgressMainListeners();
        }
    },

    // =========================================================================
    // 2. CÁLCULO DE MÉTRICAS FINANCIERAS (DASHBOARD)
    // =========================================================================

    calculateDashboardMetrics() {
        let totalCapital = 0;
        let totalProjected = 0;
        let lowStock = 0;
        let outOfStock = 0;
        let expiringSoon = 0;
        let activeCount = 0;
        const categoryValues = {};

        const thirtyDays = new Date();
        thirtyDays.setDate(thirtyDays.getDate() + 30);

        (this.allProducts || []).forEach(p => {
            activeCount++;
            const stock = parseFloat(p.stock) || 0;
            const cost = parseFloat(p.cost) || 0;
            const price = parseFloat(p.price) || 0;
            const minStock = parseFloat(p.minStock) || 0;

            if (stock > 0) {
                totalCapital += stock * cost;
                totalProjected += stock * price;
            }

            if (stock <= 0) outOfStock++;
            else if (stock <= minStock && minStock > 0) lowStock++;

            if (p.expiryDate && new Date(p.expiryDate) <= thirtyDays) {
                expiringSoon++;
            }

            const cat = p.category || 'General';
            if (!categoryValues[cat]) {
                categoryValues[cat] = { name: cat, capital: 0, projected: 0, count: 0 };
            }
            if (stock > 0) {
                categoryValues[cat].capital += stock * cost;
                categoryValues[cat].projected += stock * price;
            }
            categoryValues[cat].count++;
        });

        const totalCapitalWithIva = totalCapital * 1.19;
        const totalProjectedNet = totalProjected / 1.19;
        const profit = totalProjectedNet - totalCapital;
        const margin = totalCapital > 0 ? (profit / totalCapital * 100) : 0;

        const categoryDistribution = Object.values(categoryValues).sort((a, b) => b.capital - a.capital).map(c => {
            const cNet = c.projected / 1.19;
            const cProfit = cNet - c.capital;
            return {
                ...c,
                profit: cProfit,
                margin: c.capital > 0 ? (cProfit / c.capital * 100) : 0,
                percent: totalCapital > 0 ? (c.capital / totalCapital * 100) : 0
            };
        });

        // Pérdidas y consumos (Hoy, Esta Semana, Este Mes)
        const now = new Date();
        const todayStr = now.toLocaleDateString('sv-SE');
        const dayOfWeek = (now.getDay() + 6) % 7; // Lunes = 0
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - dayOfWeek);
        startOfWeek.setHours(0, 0, 0, 0);
        const startOfWeekTime = startOfWeek.getTime();

        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        let lossToday = 0, lossWeek = 0, lossMonth = 0;
        let consumptionToday = 0, consumptionWeek = 0, consumptionMonth = 0;

        (this.recentMovements || []).forEach(m => {
            if (m.status === 'cancelled') return;
            const mDate = new Date(m.date);
            const mDateStr = (m.date || '').slice(0, 10);
            const mTime = mDate.getTime();
            const costVal = parseFloat(m.cost_value) || 0;

            if (m.type === 'loss') {
                if (mDateStr === todayStr) lossToday += costVal;
                if (mTime >= startOfWeekTime) lossWeek += costVal;
                if (mDate.getFullYear() === currentYear && mDate.getMonth() === currentMonth) lossMonth += costVal;
            } else if (m.type === 'consumption') {
                if (mDateStr === todayStr) consumptionToday += costVal;
                if (mTime >= startOfWeekTime) consumptionWeek += costVal;
                if (mDate.getFullYear() === currentYear && mDate.getMonth() === currentMonth) consumptionMonth += costVal;
            }
        });

        return {
            totalCapital,
            totalCapitalWithIva,
            totalProjected,
            totalProjectedNet,
            profit,
            margin,
            activeItems: activeCount,
            lowStock,
            outOfStock,
            expiringSoon,
            categoryDistribution,
            monthlyLoss: lossMonth,
            monthlyConsumption: consumptionMonth,
            lossToday,
            lossWeek,
            lossMonth,
            consumptionToday,
            consumptionWeek,
            consumptionMonth
        };
    },

    // =========================================================================
    // 3. RENDERIZADO PRINCIPAL Y NAVEGACIÓN ENTRE SECCIONES
    // =========================================================================

    async render() {
        if (!this.products) {
            await this.refreshData();
        }

        const dashboard = this.calculateDashboardMetrics();
        const lowCount = (this.allProducts || []).filter(p => (p.minStock || 0) > 0 && (p.stock || 0) <= (p.minStock || 0)).length;

        return `
            <style>
                .inv-nav-pill {
                    padding: 0.5rem 0.95rem;
                    font-size: 0.88rem;
                    font-weight: 850;
                    border-radius: 0.75rem;
                    border: 1.5px solid #cbd5e1;
                    background: #ffffff;
                    color: #334155;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.45rem;
                    transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: 0 1px 3px rgba(0,0,0,0.03);
                    user-select: none;
                }
                .inv-nav-pill:hover {
                    border-color: #3b82f6;
                    color: #1d4ed8;
                    background: #f8fafc;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 10px rgba(59,130,246,0.12);
                }
                .inv-nav-pill:active {
                    transform: translateY(0) scale(0.97);
                }
                .inv-nav-pill.active {
                    background: #2563eb;
                    color: #ffffff;
                    border-color: #1d4ed8;
                    box-shadow: 0 4px 12px rgba(37,99,235,0.3);
                }
                .inv-nav-pill.suggestions-pill {
                    border-color: #f59e0b;
                    color: #92400e;
                    background: #fffbeb;
                }
                .inv-nav-pill.suggestions-pill:hover {
                    border-color: #d97706;
                    color: #78350f;
                    background: #fef3c7;
                    box-shadow: 0 4px 10px rgba(245,158,11,0.22);
                }
                .inv-nav-pill.suggestions-pill.active {
                    background: #d97706;
                    color: #ffffff;
                    border-color: #b45309;
                    box-shadow: 0 4px 12px rgba(217,119,6,0.35);
                }
                .inv-nav-pill.suggestions-pill.active .badge-count {
                    background: #ffffff !important;
                    color: #b45309 !important;
                }
            </style>

            <!-- CABECERA COMPACTA SIN ESPACIOS DESPERDICIADOS -->
            <div class="view-header animate-fade-in" style="margin-bottom: 0.75rem; padding: 0.25rem 0;">
                <div class="header-content" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                    <div>
                        <h1 style="color: #0f172a; font-size: 1.4rem; font-weight: 950; letter-spacing: -0.5px; margin: 0; display: flex; align-items: center; gap: 0.45rem;">
                            <span>📦</span> Control de Stock e Inventario
                        </h1>
                        <p style="color: #64748b; font-size: 0.8rem; margin: 0.15rem 0 0 0; font-weight: 600;">
                            Existencias reales, mermas, pedidos referenciales a proveedores y auditoría física.
                        </p>
                    </div>
                </div>
            </div>

            <div class="inventory-container animate-fade-in">
                <!-- BARRA DE PESTAÑAS PRINCIPALES CON NUEVO ORDEN LÓGICO Y MICRO-INTERACCIONES -->
                <div class="card" style="padding: 0.45rem 0.65rem; background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 1rem; margin-bottom: 1rem; box-shadow: 0 2px 6px rgba(0,0,0,0.03); overflow-x: auto; -webkit-overflow-scrolling: touch;">
                    <div style="display: flex; gap: 0.5rem; flex-wrap: nowrap; min-width: max-content;">
                        <!-- 1. Catálogo de Stock -->
                        <button class="inv-nav-pill ${this.currentSection === 'inventory' ? 'active' : ''}" 
                                onclick="InventoryView.switchSection('inventory')" 
                                title="Lista completa de existencias y valorización">
                            <span>📦</span> Inventario
                        </button>

                        <!-- 2. Conteo Físico -->
                        <button class="inv-nav-pill ${this.currentSection === 'audit' ? 'active' : ''}" 
                                onclick="InventoryView.switchSection('audit')" 
                                title="Auditar estantes y sincronizar stock real">
                            <span>📋</span> Conteo Físico
                        </button>

                        <!-- 3. Bajas y Consumos -->
                        <button class="inv-nav-pill ${this.currentSection === 'egress' ? 'active' : ''}" 
                                onclick="InventoryView.switchSection('egress')" 
                                title="Mermas, vencidos y consumos internos">
                            <span>📉</span> Bajas y Consumos
                        </button>

                        <!-- 4. Sugerencias de Compra -->
                        <button class="inv-nav-pill suggestions-pill ${this.currentSection === 'suggestions' ? 'active' : ''}" 
                                onclick="InventoryView.switchSection('suggestions')" 
                                title="Productos bajo stock mínimo para reponer por proveedor">
                            <span>💡</span> Sugerencias de Compra${lowCount > 0 ? ` <span class="badge-count" style="background: #f59e0b; color: #ffffff; border-radius: 999px; padding: 0.1rem 0.45rem; font-size: 0.72rem; font-weight: 900; margin-left: 0.2rem;">${lowCount}</span>` : ''}
                        </button>

                        <!-- 5. Historial -->
                        <button class="inv-nav-pill ${this.currentSection === 'history' ? 'active' : ''}" 
                                onclick="InventoryView.switchSection('history')" 
                                title="Trazabilidad histórica de movimientos">
                            <span>📜</span> Historial
                        </button>
                    </div>
                </div>

                <!-- CONTENEDOR REACTIVO DINÁMICO (SIN PARPADEO) -->
                <div id="inventory-section-content">
                    ${this.renderSectionContent(dashboard)}
                </div>
            </div>
        `;
    },

    // Cambio suave entre pestañas sin recargar la página completa
    async switchSection(section, subTab = null) {
        this.currentSection = section;
        if (subTab) this.egressSubTab = subTab;

        const contentContainer = document.getElementById('inventory-section-content');
        if (contentContainer) {
            const dashboard = this.calculateDashboardMetrics();
            contentContainer.innerHTML = this.renderSectionContent(dashboard);
            this.setupCurrentSectionListeners();
            // Actualizar botones de pestaña superior preservando estilos inv-nav-pill
            const pills = document.querySelectorAll('.inv-nav-pill');
            const sectionOrder = ['inventory', 'audit', 'egress', 'suggestions', 'history'];
            pills.forEach((btn, idx) => {
                const sec = sectionOrder[idx];
                if (sec) {
                    if (sec === this.currentSection) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                }
            });
        } else {
            app.navigate('inventory');
        }
    },

    renderSectionContent(dashboard) {
        switch (this.currentSection) {
            case 'inventory':
                return this.renderInventoryDashboard(dashboard);
            case 'egress':
                return this.renderEgressSection(dashboard);
            case 'audit':
                return this.renderAuditSection();
            case 'history':
                return this.renderHistorySection();
            case 'suggestions':
                return this.renderSuggestions();
            default:
                return this.renderInventoryDashboard(dashboard);
        }
    },

    // =========================================================================
    // 4. SECCIÓN 1: INVENTARIO GENERAL (TABLA EN PANTALLA + KPIS)
    // =========================================================================

    renderInventoryDashboard(dashboard) {
        const filteredProducts = this.getFilteredProducts();
        const totalItems = filteredProducts.length;
        const totalPages = Math.ceil(totalItems / this.inventoryPageSize) || 1;
        if (this.inventoryCurrentPage > totalPages) this.inventoryCurrentPage = totalPages;

        const startIndex = (this.inventoryCurrentPage - 1) * this.inventoryPageSize;
        const pageItems = filteredProducts.slice(startIndex, startIndex + this.inventoryPageSize);

        const categories = this.categories || [];
        const suppliers = this.suppliersList || [];

        return `
            <!-- 1. Tarjetas de Resumen Financiero -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.25rem;">
                <!-- Dinero Invertido -->
                <div class="card" style="background: #ffffff; border: 1.5px solid #e2e8f0; border-left: 5px solid #3b82f6; border-radius: 1rem; padding: 1.15rem; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="font-size: 0.75rem; text-transform: uppercase; color: #64748b; font-weight: 800; letter-spacing: 0.5px;">Dinero Invertido</div>
                    <div style="font-size: 1.5rem; font-weight: 900; color: #1e293b; margin-top: 0.25rem; line-height: 1.2;">
                        ${formatCLP(dashboard.totalCapital)} <span style="font-size: 0.72rem; color: #64748b; font-weight: 700;">Neto</span>
                    </div>
                    <div style="font-size: 0.88rem; font-weight: 700; color: #64748b; margin-top: 0.2rem;">
                        ${formatCLP(dashboard.totalCapitalWithIva)} <span style="font-size: 0.68rem; color: #94a3b8;">con IVA</span>
                    </div>
                    <small style="color: #64748b; font-size: 0.75rem; display: block; margin-top: 0.4rem;">${dashboard.activeItems} productos activos en catálogo</small>
                </div>

                <!-- Venta Proyectada -->
                <div class="card" style="background: #ffffff; border: 1.5px solid #e2e8f0; border-left: 5px solid #8b5cf6; border-radius: 1rem; padding: 1.15rem; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="font-size: 0.75rem; text-transform: uppercase; color: #64748b; font-weight: 800; letter-spacing: 0.5px;">Venta Proyectada</div>
                    <div style="font-size: 1.5rem; font-weight: 900; color: #1e293b; margin-top: 0.25rem; line-height: 1.2;">
                        ${formatCLP(dashboard.totalProjected)} <span style="font-size: 0.72rem; color: #64748b; font-weight: 700;">Público</span>
                    </div>
                    <div style="font-size: 0.88rem; font-weight: 700; color: #64748b; margin-top: 0.2rem;">
                        ${formatCLP(dashboard.totalProjectedNet)} <span style="font-size: 0.68rem; color: #94a3b8;">Neto</span>
                    </div>
                    <small style="color: #64748b; font-size: 0.75rem; display: block; margin-top: 0.4rem;">Total estimado al vender todo el stock</small>
                </div>

                <!-- Ganancia Proyectada -->
                <div class="card" style="background: #ffffff; border: 1.5px solid #e2e8f0; border-left: 5px solid #10b981; border-radius: 1rem; padding: 1.15rem; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="font-size: 0.75rem; text-transform: uppercase; color: #64748b; font-weight: 800; letter-spacing: 0.5px;">Ganancia Estimada</div>
                    <div style="font-size: 1.5rem; font-weight: 900; color: #059669; margin-top: 0.25rem; line-height: 1.2;">
                        +${formatCLP(dashboard.profit)}
                    </div>
                    <div style="margin-top: 0.35rem; display: flex; align-items: center; justify-content: space-between;">
                        <span style="font-size: 0.75rem; color: #047857; font-weight: 700;">Margen Neto Global:</span>
                        <span style="background: #d1fae5; color: #065f46; padding: 0.15rem 0.5rem; border-radius: 0.4rem; font-size: 0.75rem; font-weight: 900;">+${dashboard.margin.toFixed(1)}%</span>
                    </div>
                </div>

                <!-- Alertas de Stock Crítico -->
                <div class="card" style="background: #ffffff; border: 1.5px solid #e2e8f0; border-left: 5px solid #ef4444; border-radius: 1rem; padding: 1.15rem; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="font-size: 0.75rem; text-transform: uppercase; color: #64748b; font-weight: 800; letter-spacing: 0.5px;">Alertas de Stock</div>
                    <div style="display: flex; gap: 1rem; margin-top: 0.25rem;">
                        <div style="cursor: pointer;" onclick="InventoryView.handleInventoryStockChange('out')" title="Ver solo agotados">
                            <div style="font-size: 1.35rem; font-weight: 900; color: #dc2626;">${dashboard.outOfStock}</div>
                            <small style="color: #64748b; font-size: 0.72rem; font-weight: 800;">Agotados 🔍</small>
                        </div>
                        <div style="border-left: 1px solid #cbd5e1; padding-left: 1rem; cursor: pointer;" onclick="InventoryView.handleInventoryStockChange('low')" title="Ver solo stock bajo">
                            <div style="font-size: 1.35rem; font-weight: 900; color: #d97706;">${dashboard.lowStock}</div>
                            <small style="color: #64748b; font-size: 0.72rem; font-weight: 800;">Bajo stock 🔍</small>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 2. Panel Colapsable de Análisis por Categoría -->
            <div style="margin-bottom: 1.25rem;">
                <button type="button" class="btn" 
                        onclick="InventoryView.toggleCapitalDistribution()"
                        style="width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1.25rem; border-radius: 0.75rem; border: 1.5px solid #e2e8f0; background: #ffffff; font-weight: 800; color: #1e293b; cursor: pointer; transition: all 0.2s;">
                    <span style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem;">
                        <span>🧩</span> Distribución de Inversión por Categoría (${dashboard.categoryDistribution.length} categorías)
                    </span>
                    <span style="background: #f1f5f9; padding: 0.2rem 0.65rem; border-radius: 0.4rem; font-size: 0.78rem; font-weight: 800; color: #2563eb;">
                        ${this.showCapitalDist ? '▲ Ocultar Panel' : '▼ Ver Análisis'}
                    </span>
                </button>

                <div id="capital-distribution-panel" style="display: ${this.showCapitalDist ? 'block' : 'none'}; margin-top: 0.75rem; background: #ffffff; border-radius: 1rem; padding: 1.25rem; border: 1.5px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.03);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
                        <span style="color: #64748b; font-size: 0.82rem; font-weight: 600;">Haz clic en cualquier categoría para filtrarla directamente en la tabla inferior:</span>
                        <button class="btn btn-sm btn-secondary" onclick="InventoryView.exportCapitalDistributionCSV()" style="font-weight: 800; font-size: 0.8rem;">
                            📊 Descargar Resumen en Excel
                        </button>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 0.85rem;">
                        ${dashboard.categoryDistribution.map(cat => {
                            const barColor = cat.percent > 15 ? '#3b82f6' : (cat.percent > 5 ? '#10b981' : '#f59e0b');
                            return `
                                <div onclick="InventoryView.filterByCategoryFromDistribution('${(cat.name || '').replace(/'/g, "\\'")}')"
                                     style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 0.75rem; padding: 0.85rem; cursor: pointer; transition: all 0.2s;"
                                     onmouseover="this.style.borderColor='#3b82f6'; this.style.transform='translateY(-2px)';"
                                     onmouseout="this.style.borderColor='#e2e8f0'; this.style.transform='translateY(0)';">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                                        <strong style="color: #0f172a; font-size: 0.95rem;">${safeHTML(cat.name)}</strong>
                                        <span style="font-size: 0.75rem; font-weight: 900; color: ${barColor}; background: #ffffff; padding: 0.1rem 0.4rem; border-radius: 0.3rem; border: 1px solid #e2e8f0;">${cat.percent.toFixed(1)}%</span>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: #475569; margin-bottom: 0.25rem;">
                                        <span>Capital: <strong>${formatCLP(cat.capital)}</strong></span>
                                        <span>Ganancia: <strong style="color: #059669;">+${formatCLP(cat.profit)}</strong></span>
                                    </div>
                                    <div style="width: 100%; height: 5px; background: #e2e8f0; border-radius: 3px; overflow: hidden; margin-top: 0.4rem;">
                                        <div style="width: ${Math.max(4, cat.percent)}%; height: 100%; background: ${barColor};"></div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>

            <!-- 3. Barra de Búsqueda, Filtros y Acciones -->
            <div class="card" style="padding: 1rem; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 1rem; margin-bottom: 1rem;">
                <div style="display: flex; gap: 0.75rem; align-items: center; justify-content: space-between; flex-wrap: wrap;">
                    <div style="display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; flex: 1; min-width: 280px;">
                        <!-- Buscador en tiempo real -->
                        <div style="position: relative; flex: 2; min-width: 220px;">
                            <input type="text" 
                                   id="inventorySearchInput" 
                                   class="form-control" 
                                   placeholder="🔍 Buscar por nombre, código o categoría..." 
                                   value="${safeHTML(this.inventorySearchQuery)}" 
                                   oninput="InventoryView.handleInventorySearch(this.value)" 
                                   style="padding: 0.5rem 2rem 0.5rem 0.75rem; border-radius: 0.6rem; border: 1.5px solid #cbd5e1; background: white; font-size: 0.88rem; width: 100%; font-weight: 600;">
                            ${this.inventorySearchQuery ? `
                                <button type="button" onclick="InventoryView.handleInventorySearch('')" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; font-size: 0.9rem; color: #94a3b8; cursor: pointer;">✕</button>
                            ` : ''}
                        </div>

                        <!-- Filtro de Categoría -->
                        <select onchange="InventoryView.handleInventoryCategoryChange(this.value)" 
                                style="padding: 0.5rem 0.65rem; border-radius: 0.6rem; border: 1.5px solid #cbd5e1; background: white; font-size: 0.88rem; font-weight: 600; flex: 1; min-width: 140px;">
                            <option value="">📂 Todas las Categorías</option>
                            ${categories.map(c => `<option value="${c}" ${c === this.inventorySelectedCategory ? 'selected' : ''}>${c}</option>`).join('')}
                        </select>

                        <!-- Filtro de Estado de Stock -->
                        <select onchange="InventoryView.handleInventoryStockChange(this.value)" 
                                style="padding: 0.5rem 0.65rem; border-radius: 0.6rem; border: 1.5px solid #cbd5e1; background: white; font-size: 0.88rem; font-weight: 600; flex: 1; min-width: 130px;">
                            <option value="all" ${this.inventorySelectedStockStatus === 'all' ? 'selected' : ''}>📈 Todos los Stocks</option>
                            <option value="low" ${this.inventorySelectedStockStatus === 'low' ? 'selected' : ''}>⚠️ Stock Bajo</option>
                            <option value="out" ${this.inventorySelectedStockStatus === 'out' ? 'selected' : ''}>🚨 Agotados (0 o menos)</option>
                            <option value="optimum" ${this.inventorySelectedStockStatus === 'optimum' ? 'selected' : ''}>✅ Stock Óptimo</option>
                        </select>

                        <!-- Filtro de Proveedor -->
                        <select onchange="InventoryView.handleInventorySupplierChange(this.value)" 
                                style="padding: 0.5rem 0.65rem; border-radius: 0.6rem; border: 1.5px solid #cbd5e1; background: white; font-size: 0.88rem; font-weight: 600; flex: 1; min-width: 140px;">
                            <option value="">👤 Todos los Proveedores</option>
                            <option value="none" ${this.inventorySelectedSupplier === 'none' ? 'selected' : ''}>👤 Sin Proveedor</option>
                            ${suppliers.map(s => `<option value="${s.id}" ${String(s.id) === this.inventorySelectedSupplier ? 'selected' : ''}>${s.name}</option>`).join('')}
                        </select>
                    </div>

                    <!-- Botones de Exportar -->
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-secondary" onclick="InventoryView.exportInventoryCSV()" style="padding: 0.5rem 0.85rem; border-radius: 0.6rem; font-weight: 800; font-size: 0.85rem; background: white; border: 1.5px solid #cbd5e1; display: flex; align-items: center; gap: 0.35rem;" title="Exportar productos visibles a Excel">
                            📊 Excel (CSV)
                        </button>
                        <button class="btn btn-secondary" onclick="InventoryView.exportInventoryPDF()" style="padding: 0.5rem 0.85rem; border-radius: 0.6rem; font-weight: 800; font-size: 0.85rem; background: white; border: 1.5px solid #cbd5e1; display: flex; align-items: center; gap: 0.35rem;" title="Generar lista para imprimir">
                            📄 Imprimir Lista
                        </button>
                    </div>
                </div>
            </div>

            <!-- 4. Tabla Principal en Vivo (15 productos por página) -->
            <div id="inventory-table-wrapper" class="card" style="padding: 0; background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 1rem; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);">
                ${this.renderInventoryTableHTML(pageItems, totalItems, totalPages)}
            </div>
        `;
    },

    getFilteredProducts() {
        let list = this.allProducts || [];

        // Filtro por texto (Nombre, Código de barra o Categoría)
        if (this.inventorySearchQuery) {
            const q = this.inventorySearchQuery.toLowerCase().trim();
            list = list.filter(p => 
                (p.name || '').toLowerCase().includes(q) || 
                (p.barcode || '').toLowerCase().includes(q) ||
                (p.category || '').toLowerCase().includes(q)
            );
        }

        // Filtro por categoría
        if (this.inventorySelectedCategory) {
            list = list.filter(p => (p.category || 'General') === this.inventorySelectedCategory);
        }

        // Filtro por estado de stock
        if (this.inventorySelectedStockStatus === 'low') {
            list = list.filter(p => {
                const stock = parseFloat(p.stock) || 0;
                const minStock = parseFloat(p.minStock) || 0;
                return stock > 0 && stock <= minStock && minStock > 0;
            });
        } else if (this.inventorySelectedStockStatus === 'out') {
            list = list.filter(p => (parseFloat(p.stock) || 0) <= 0);
        } else if (this.inventorySelectedStockStatus === 'optimum') {
            list = list.filter(p => {
                const stock = parseFloat(p.stock) || 0;
                const minStock = parseFloat(p.minStock) || 0;
                return stock > minStock;
            });
        }

        // Filtro por proveedor
        if (this.inventorySelectedSupplier) {
            if (this.inventorySelectedSupplier === 'none') {
                list = list.filter(p => !p.supplierId && !p.lastSupplierId);
            } else {
                list = list.filter(p => 
                    String(p.supplierId) === this.inventorySelectedSupplier || 
                    String(p.lastSupplierId) === this.inventorySelectedSupplier
                );
            }
        }

        return list;
    },

    renderInventoryTableHTML(items, totalItems, totalPages) {
        if (!items || items.length === 0) {
            return `
                <div style="padding: 4rem 1.5rem; text-align: center; color: #64748b;">
                    <div style="font-size: 3rem; margin-bottom: 0.75rem; opacity: 0.4;">📦</div>
                    <strong style="font-size: 1.1rem; color: #1e293b; display: block;">No se encontraron productos</strong>
                    <p style="margin-top: 0.25rem; font-size: 0.85rem;">Prueba cambiando o limpiando los filtros seleccionados.</p>
                    <button class="btn btn-sm btn-secondary" onclick="InventoryView.clearAllFilters()" style="margin-top: 0.5rem; font-weight: 800;">
                        🔄 Limpiar Todos los Filtros
                    </button>
                </div>
            `;
        }

        const rows = items.map(p => {
            const stock = parseFloat(p.stock) || 0;
            const minStock = parseFloat(p.minStock) || 0;
            const cost = parseFloat(p.cost) || 0;
            const price = parseFloat(p.price) || 0;
            const priceNet = price / 1.19;
            const profit = priceNet - cost;
            const margin = cost > 0 ? (profit / cost * 100) : 0;

            const isWeight = p.type === 'weight';
            const unit = isWeight ? 'kg' : 'un';
            const decimals = isWeight ? 3 : 0;

            let stockBadge = '';
            let rowStyle = '';
            if (stock <= 0) {
                rowStyle = 'background-color: #fef2f2;';
                stockBadge = '<span style="background: #fee2e2; color: #ef4444; padding: 0.15rem 0.45rem; border-radius: 0.35rem; font-size: 0.68rem; font-weight: 900; border: 1px solid rgba(239,68,68,0.25);">AGOTADO</span>';
            } else if (stock <= minStock && minStock > 0) {
                rowStyle = 'background-color: #fffbeb;';
                stockBadge = '<span style="background: #fef9c3; color: #b45309; padding: 0.15rem 0.45rem; border-radius: 0.35rem; font-size: 0.68rem; font-weight: 900; border: 1px solid rgba(245,158,11,0.25);">BAJO</span>';
            }

            // Alerta de vencimiento
            let expiryHtml = '';
            if (p.expiryDate) {
                const expiry = new Date(p.expiryDate);
                if (!isNaN(expiry.getTime())) {
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    const thirtyDays = new Date();
                    thirtyDays.setDate(thirtyDays.getDate() + 30);

                    const dateFormatted = p.expiryDate.split('-').reverse().join('/');
                    if (expiry <= today) {
                        expiryHtml = `<div style="color: #dc2626; font-size: 0.72rem; font-weight: 800;">🚨 Vencido: ${dateFormatted}</div>`;
                    } else if (expiry <= thirtyDays) {
                        expiryHtml = `<div style="color: #d97706; font-size: 0.72rem; font-weight: 800;">⚠️ Vence: ${dateFormatted}</div>`;
                    }
                }
            }

            return `
                <tr style="border-bottom: 1px solid #e2e8f0; font-size: 0.85rem; ${rowStyle}">
                    <!-- Código de Barra -->
                    <td style="padding: 0.75rem 1rem; color: #64748b; font-family: monospace; font-weight: 700; width: 130px;">
                        ${safeHTML(p.barcode || '—')}
                    </td>

                    <!-- Producto y Categoría -->
                    <td style="padding: 0.75rem 1rem;">
                        <strong style="color: #0f172a; font-size: 0.92rem; display: block;">${safeHTML(p.name)}</strong>
                        <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 0.2rem; flex-wrap: wrap;">
                            <span style="color: #334155; font-size: 0.74rem; font-weight: 700; background: #f1f5f9; border: 1px solid #e2e8f0; padding: 0.1rem 0.45rem; border-radius: 0.35rem; display: inline-flex; align-items: center; gap: 0.25rem;">📂 ${safeHTML(p.category || 'General')}</span>
                            ${expiryHtml}
                        </div>
                    </td>

                    <!-- Proveedor -->
                    <td style="padding: 0.75rem 1rem; color: #475569; font-size: 0.82rem; width: 140px;">
                        ${safeHTML(p.supplierName || '—')}
                    </td>

                    <!-- Stock Actual con Indicador -->
                    <td style="padding: 0.75rem 1rem; text-align: center; width: 150px;">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 0.4rem;">
                            <span style="font-weight: 900; font-size: 1rem; color: ${stock <= 0 ? '#dc2626' : (stock <= minStock && minStock > 0 ? '#d97706' : '#0f172a')};">
                                ${formatStock(stock, decimals)} ${unit}
                            </span>
                            ${stockBadge}
                        </div>
                    </td>

                    <!-- Costo Neto -->
                    <td style="padding: 0.75rem 1rem; text-align: right; font-weight: 700; color: #475569; width: 100px;">
                        ${formatCLP(cost)}
                    </td>

                    <!-- Precio de Venta -->
                    <td style="padding: 0.75rem 1rem; text-align: right; font-weight: 800; color: #2563eb; width: 100px;">
                        ${formatCLP(price)}
                    </td>

                    <!-- Margen % -->
                    <td style="padding: 0.75rem 1rem; text-align: center; width: 90px;">
                        <span style="background: ${margin >= 0 ? '#ecfdf5' : '#fef2f2'}; color: ${margin >= 0 ? '#047857' : '#b91c1c'}; padding: 0.15rem 0.45rem; border-radius: 0.4rem; font-weight: 800; font-size: 0.75rem;">
                            ${margin >= 0 ? '+' : ''}${margin.toFixed(1)}%
                        </span>
                    </td>

                    <!-- Acciones Rápidas -->
                    <td style="padding: 0.75rem 1rem; text-align: right; width: 160px; white-space: nowrap;">
                        <button type="button" class="btn btn-sm btn-secondary" onclick="InventoryView.quickAdjustment('${p.id}')" style="padding: 0.3rem 0.6rem; font-size: 0.78rem; font-weight: 800; border-radius: 0.5rem; margin-right: 0.35rem;" title="Corregir el stock de este producto">
                            ✏️ Ajustar
                        </button>
                        <button type="button" class="btn btn-sm btn-primary" onclick="InventoryView.showKardex('${p.id}')" style="padding: 0.3rem 0.6rem; font-size: 0.78rem; font-weight: 800; border-radius: 0.5rem;" title="Ver todos los movimientos que afectaron a este producto">
                            📋 Historial
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                    <thead style="background: #f8fafc; border-bottom: 2px solid #cbd5e1;">
                        <tr style="font-size: 0.75rem; text-transform: uppercase; color: #475569; font-weight: 900; letter-spacing: 0.5px;">
                            <th style="padding: 0.75rem 1rem;">Cód. Barra</th>
                            <th style="padding: 0.75rem 1rem;">Producto</th>
                            <th style="padding: 0.75rem 1rem;">Proveedor</th>
                            <th style="padding: 0.75rem 1rem; text-align: center;">Stock Actual</th>
                            <th style="padding: 0.75rem 1rem; text-align: right;">Costo Neto</th>
                            <th style="padding: 0.75rem 1rem; text-align: right;">P. Venta</th>
                            <th style="padding: 0.75rem 1rem; text-align: center;">Margen %</th>
                            <th style="padding: 0.75rem 1rem; text-align: right;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>

            <!-- Barra de Paginación (15 productos por página) -->
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.85rem 1.25rem; background: #f8fafc; border-top: 1.5px solid #e2e8f0; flex-wrap: wrap; gap: 0.5rem;">
                <div style="font-size: 0.85rem; color: #64748b; font-weight: 600;">
                    Mostrando <strong style="color: #0f172a;">${items.length}</strong> de <strong style="color: #0f172a;">${totalItems}</strong> productos (Página ${this.inventoryCurrentPage} de ${totalPages})
                </div>

                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <button class="btn btn-sm btn-secondary" 
                            ${this.inventoryCurrentPage <= 1 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''} 
                            onclick="InventoryView.changeInventoryPage(-1)" 
                            style="font-weight: 800; padding: 0.35rem 0.85rem; border-radius: 0.5rem;">
                        ◀ Anterior
                    </button>

                    <span style="font-size: 0.85rem; font-weight: 800; color: #1e293b; padding: 0 0.5rem;">
                        ${this.inventoryCurrentPage} / ${totalPages}
                    </span>

                    <button class="btn btn-sm btn-secondary" 
                            ${this.inventoryCurrentPage >= totalPages ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''} 
                            onclick="InventoryView.changeInventoryPage(1)" 
                            style="font-weight: 800; padding: 0.35rem 0.85rem; border-radius: 0.5rem;">
                        Siguiente ▶
                    </button>
                </div>
            </div>
        `;
    },

    // Handlers de la tabla principal
    handleInventorySearch(val) {
        this.inventorySearchQuery = val || '';
        this.inventoryCurrentPage = 1;
        this.updateInventoryTableOnly();
    },

    handleInventoryCategoryChange(val) {
        this.inventorySelectedCategory = val || '';
        this.inventoryCurrentPage = 1;
        this.updateInventoryTableOnly();
    },

    handleInventoryStockChange(val) {
        this.inventorySelectedStockStatus = val || 'all';
        this.inventoryCurrentPage = 1;
        this.updateInventoryTableOnly();
    },

    handleInventorySupplierChange(val) {
        this.inventorySelectedSupplier = val || '';
        this.inventoryCurrentPage = 1;
        this.updateInventoryTableOnly();
    },

    changeInventoryPage(delta) {
        this.inventoryCurrentPage += delta;
        this.updateInventoryTableOnly();
        const wrapper = document.getElementById('inventory-table-wrapper');
        if (wrapper) wrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },

    clearAllFilters() {
        this.inventorySearchQuery = '';
        this.inventorySelectedCategory = '';
        this.inventorySelectedStockStatus = 'all';
        this.inventorySelectedSupplier = '';
        this.inventoryCurrentPage = 1;
        this.switchSection('inventory');
    },

    updateInventoryTableOnly() {
        const wrapper = document.getElementById('inventory-table-wrapper');
        if (!wrapper) return;
        const filtered = this.getFilteredProducts();
        const totalItems = filtered.length;
        const totalPages = Math.ceil(totalItems / this.inventoryPageSize) || 1;
        if (this.inventoryCurrentPage > totalPages) this.inventoryCurrentPage = totalPages;
        const startIndex = (this.inventoryCurrentPage - 1) * this.inventoryPageSize;
        const pageItems = filtered.slice(startIndex, startIndex + this.inventoryPageSize);
        wrapper.innerHTML = this.renderInventoryTableHTML(pageItems, totalItems, totalPages);
    },

    toggleCapitalDistribution() {
        this.showCapitalDist = !this.showCapitalDist;
        const panel = document.getElementById('capital-distribution-panel');
        if (panel) {
            panel.style.display = this.showCapitalDist ? 'block' : 'none';
        }
    },

    filterByCategoryFromDistribution(categoryName) {
        this.inventorySelectedCategory = categoryName || '';
        this.inventoryCurrentPage = 1;
        this.updateInventoryTableOnly();
        const wrapper = document.getElementById('inventory-table-wrapper');
        if (wrapper) {
            wrapper.scrollIntoView({ behavior: 'smooth' });
        }
        showNotification(`Filtrando por categoría: "${categoryName}"`, 'info');
    },

    selectCategoryAndScroll(categoryName) {
        this.filterByCategoryFromDistribution(categoryName);
    },

    // Exportaciones de inventario general
    exportInventoryCSV() {
        const filtered = this.getFilteredProducts();
        if (filtered.length === 0) {
            showNotification('No hay productos para exportar con los filtros actuales', 'warning');
            return;
        }

        const headers = ['Código Barra', 'Producto', 'Categoría', 'Proveedor', 'Stock Actual', 'Tipo', 'Costo Neto', 'Precio Venta', 'Margen %'];
        const rows = filtered.map(p => {
            const stock = parseFloat(p.stock) || 0;
            const cost = parseFloat(p.cost) || 0;
            const price = parseFloat(p.price) || 0;
            const profit = (price / 1.19) - cost;
            const margin = cost > 0 ? (profit / cost * 100) : 0;
            return [
                `"${p.barcode || ''}"`,
                `"${(p.name || '').replace(/"/g, '""')}"`,
                `"${(p.category || 'General').replace(/"/g, '""')}"`,
                `"${(p.supplierName || 'Sin proveedor').replace(/"/g, '""')}"`,
                stock,
                p.type === 'weight' ? 'kg' : 'un',
                cost,
                price,
                `${margin.toFixed(1)}%`
            ];
        });

        const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `inventario_${new Date().toLocaleDateString('sv-SE')}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification('📊 Lista de inventario exportada a Excel (CSV)', 'success');
    },

    exportInventoryPDF() {
        const filtered = this.getFilteredProducts();
        if (filtered.length === 0) {
            showNotification('No hay productos para exportar', 'warning');
            return;
        }

        const printWindow = window.open('', '_blank');
        const rowsHtml = filtered.map(p => {
            const stock = parseFloat(p.stock) || 0;
            const cost = parseFloat(p.cost) || 0;
            const price = parseFloat(p.price) || 0;
            return `
                <tr>
                    <td>${p.barcode || '—'}</td>
                    <td><strong>${safeHTML(p.name)}</strong><br><small style="color:#64748b;">${safeHTML(p.category || 'General')}</small></td>
                    <td>${safeHTML(p.supplierName || '—')}</td>
                    <td style="text-align: center; font-weight: 800;">${formatStock(stock, p.type === 'weight' ? 3 : 0)} ${p.type === 'weight' ? 'kg' : 'un'}</td>
                    <td style="text-align: right;">${formatCLP(cost)}</td>
                    <td style="text-align: right; font-weight: 800;">${formatCLP(price)}</td>
                </tr>
            `;
        }).join('');

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Reporte de Inventario y Stock</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; color: #1e293b; font-size: 12px; }
                    h2 { margin: 0 0 5px 0; color: #0f172a; }
                    p { margin: 0 0 15px 0; color: #64748b; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 11px; }
                    th { background: #f1f5f9; text-transform: uppercase; font-size: 10px; }
                    @media print { button { display: none; } }
                </style>
            </head>
            <body>
                <h2>Control de Stock e Inventario</h2>
                <p>Fecha de emisión: ${new Date().toLocaleString()} • Total de productos: ${filtered.length}</p>
                <table>
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Producto</th>
                            <th>Proveedor</th>
                            <th>Stock</th>
                            <th>Costo Neto</th>
                            <th>P. Venta</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
                <script>
                    window.onload = function() {
                        setTimeout(() => { window.print(); window.close(); }, 300);
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    },

    exportCapitalDistributionCSV() {
        const dashboard = this.calculateDashboardMetrics();
        const dist = dashboard?.categoryDistribution || [];
        if (dist.length === 0) {
            showNotification('No hay datos para exportar', 'warning');
            return;
        }

        const headers = ['Categoría', 'Capital Neto ($)', 'Capital con IVA ($)', 'Ganancia Proyectada ($)', 'Margen Neto (%)', 'Participación (%)', 'Total Productos'];
        const rows = dist.map(cat => [
            `"${(cat.name || '').replace(/"/g, '""')}"`,
            Math.round(cat.capital || 0),
            Math.round(cat.capital * 1.19),
            Math.round(cat.profit || 0),
            `${(cat.margin || 0).toFixed(1)}%`,
            `${(cat.percent || 0).toFixed(1)}%`,
            cat.count || 0
        ]);

        const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `distribucion_capital_${new Date().toLocaleDateString('sv-SE')}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification('📊 Distribución de capital descargada en Excel', 'success');
    },

    // Ajuste rápido individual desde la tabla
    async quickAdjustment(productId) {
        const product = await Product.getById(productId);
        if (!product) return;

        const isWeight = product.type === 'weight';
        const stepVal = isWeight ? '0.001' : '1';
        const placeholderVal = isWeight ? 'Ej: 10.500' : 'Ej: 10';

        const content = `
            <div style="text-align: center; margin-bottom: 1.25rem;">
                <div style="font-size: 1.2rem; font-weight: 900; color: #0f172a; margin-bottom: 0.25rem;">${safeHTML(product.name)}</div>
                <div style="font-size: 0.85rem; color: #64748b;">
                    Código: <strong>${safeHTML(product.barcode || 'Sin código')}</strong> • Stock actual: <strong style="color: #2563eb;">${product.stock} ${isWeight ? 'kg' : 'un'}</strong>
                </div>
            </div>
            
            <form id="quickAdjustForm" onsubmit="event.preventDefault(); InventoryView.saveQuickAdjustment(${productId}, ${product.stock});">
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label style="font-weight: 800; font-size: 0.85rem; color: #334155; display: block; margin-bottom: 0.35rem;">
                        Nuevo Stock Físico Real *
                    </label>
                    <input type="number" 
                           id="newStockInput" 
                           class="form-control" 
                           value="${product.stock}" 
                           min="0" 
                           step="${stepVal}" 
                           placeholder="${placeholderVal}"
                           style="height: 48px; font-size: 1.25rem; font-weight: 900; text-align: center; border: 2px solid #3b82f6; border-radius: 0.65rem;"
                           required autofocus>
                    <small style="color: #64748b; font-size: 0.75rem; display: block; margin-top: 0.25rem;">Presiona Enter para confirmar el ajuste rápido.</small>
                </div>
                
                <div class="form-group" style="margin-bottom: 1.25rem;">
                    <label style="font-weight: 800; font-size: 0.85rem; color: #334155; display: block; margin-bottom: 0.35rem;">
                        Motivo del ajuste *
                    </label>
                    <input type="text" 
                           id="quickReasonInput" 
                           class="form-control" 
                           placeholder="Ej: Conteo físico, corrección por error de tipeo..."
                           value="Corrección de stock físico"
                           style="height: 40px; font-size: 0.9rem; border-radius: 0.6rem; border: 1.5px solid #cbd5e1;" 
                           required>
                </div>

                <div style="display: flex; gap: 0.75rem;">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()" style="flex: 1; padding: 0.65rem; font-weight: 800; border-radius: 0.65rem;">
                        Cancelar (Esc)
                    </button>
                    <button type="submit" class="btn btn-primary" style="flex: 2; padding: 0.65rem; font-weight: 900; border-radius: 0.65rem; background: #2563eb;">
                        💾 Guardar Ajuste
                    </button>
                </div>
            </form>
        `;

        showModal(content, { title: 'Ajuste Rápido de Stock', width: '420px', showCloseButton: true });

        setTimeout(() => {
            const input = document.getElementById('newStockInput');
            if (input) {
                input.focus();
                input.select();
            }
        }, 100);
    },

    async saveQuickAdjustment(productId, currentStock) {
        const input = document.getElementById('newStockInput');
        const reasonInput = document.getElementById('quickReasonInput');
        if (!input) return;

        const newStock = parseFloat(input.value);
        if (isNaN(newStock) || newStock < 0) {
            showNotification('Ingresa una cantidad válida mayor o igual a 0', 'warning');
            input.focus();
            return;
        }

        const reason = (reasonInput?.value || '').trim() || 'Ajuste rápido de inventario';

        const p = (this.allProducts || []).find(prod => prod.id === productId);
        const pName = p ? p.name : `Producto #${productId}`;

        // Verificar si el usuario conectado ya es dueño o administrador
        let isOwnerOrAdmin = false;
        try {
            if (typeof PermissionService !== 'undefined') {
                const role = PermissionService.getCurrentRole();
                if (role === 'owner' || role === 'partner' || role === 'admin') {
                    isOwnerOrAdmin = true;
                }
            }
        } catch (_) {}

        let auditSupervisor = 'Administrador';
        if (!isOwnerOrAdmin) {
            // Regla 8: Operaciones Críticas Bajo PIN de Supervisor (solo para cajeros/empleados)
            if (typeof SupervisorAuth !== 'undefined' && typeof SupervisorAuth.requireAuth === 'function') {
                const auth = await SupervisorAuth.requireAuth({
                    title: 'Autorización: Ajuste de Inventario',
                    message: `El cambio manual de stock para "${pName}" (de ${currentStock} a ${newStock}) requiere autorización de un Supervisor.`
                });
                if (!auth || !auth.authorized) {
                    showNotification('❌ Ajuste cancelado o no autorizado.', 'warning');
                    return;
                }
                auditSupervisor = auth.supervisorName || 'Supervisor';
            }
        }

        const auditReason = `${reason} (Autorizado por: ${auditSupervisor})`;

        try {
            await StockService.setStock(productId, newStock, auditReason, 'adjustment');

            if (typeof AuditLogService !== 'undefined') {
                await AuditLogService.log({
                    entity: 'product_stock',
                    entityId: productId,
                    action: 'MANUAL_STOCK_ADJUSTMENT',
                    summary: `Ajuste manual de stock para "${pName}": ${currentStock} -> ${newStock}. Motivo: ${reason}. Autorizado por: ${auth.supervisorName}`,
                    metadata: { productId, oldStock: currentStock, newStock, reason, authorizedBy: auth.supervisorName }
                });
            }

            showNotification('✅ Stock actualizado correctamente', 'success');
            closeModal();
            await this.refreshData();
            this.updateInventoryTableOnly();
        } catch (error) {
            showNotification('Error al ajustar stock: ' + error.message, 'error');
        }
    },

    // Kardex / Historial individual del producto
    async showKardex(productId) {
        const product = await Product.getById(productId);
        if (!product) return;

        const kardex = await StockService.getKardexByProduct(productId);
        const typeName = (t) => ({ sale: 'Venta', purchase: 'Compra', adjustment: 'Ajuste', loss: 'Pérdida', consumption: 'Consumo' }[t] || t);

        const rowsHtml = (kardex.rows || []).map(r => {
            const isPositive = r.quantity >= 0;
            return `
                <tr style="border-bottom: 1px solid #e2e8f0; font-size: 0.85rem;">
                    <td style="padding: 0.65rem 0.75rem; color: #475569;">${formatDateTime(r.date)}</td>
                    <td style="padding: 0.65rem 0.75rem;"><span class="badge ${this.getMovementBadgeClass(r.type)}">${typeName(r.type)}</span></td>
                    <td style="padding: 0.65rem 0.75rem; color: #64748b;">${r.reference || '—'}</td>
                    <td style="padding: 0.65rem 0.75rem; text-align: right; font-weight: 800; color: ${isPositive ? '#059669' : '#dc2626'};">
                        ${isPositive ? '+' : ''}${r.quantity}
                    </td>
                    <td style="padding: 0.65rem 0.75rem; text-align: right; font-weight: 900; color: #0f172a;">${r.balanceAfter}</td>
                    <td style="padding: 0.65rem 0.75rem; color: #64748b; font-size: 0.8rem;">${safeHTML(r.reason || '—')}</td>
                </tr>
            `;
        }).join('');

        const content = `
            <div style="margin-bottom: 1.25rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 0.85rem 1.25rem; border-radius: 0.85rem; border: 1.5px solid #e2e8f0; margin-bottom: 1rem;">
                    <div>
                        <strong style="font-size: 1.1rem; color: #0f172a; display: block;">${safeHTML(product.name)}</strong>
                        <small style="color: #64748b; font-weight: 700;">Código: ${safeHTML(product.barcode || 'Sin código')}</small>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 800; display: block;">Stock Actual</span>
                        <strong style="font-size: 1.35rem; color: #2563eb; font-weight: 900;">${kardex.currentStock} ${product.type === 'weight' ? 'kg' : 'un'}</strong>
                    </div>
                </div>

                <div style="max-height: 50vh; overflow-y: auto; border: 1.5px solid #e2e8f0; border-radius: 0.75rem; background: #ffffff;">
                    <table style="width: 100%; border-collapse: collapse; text-align: left;">
                        <thead style="position: sticky; top: 0; background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
                            <tr style="font-size: 0.72rem; text-transform: uppercase; color: #475569; font-weight: 900;">
                                <th style="padding: 0.6rem 0.75rem;">Fecha</th>
                                <th style="padding: 0.6rem 0.75rem;">Tipo</th>
                                <th style="padding: 0.6rem 0.75rem;">Ref.</th>
                                <th style="padding: 0.6rem 0.75rem; text-align: right;">Cantidad</th>
                                <th style="padding: 0.6rem 0.75rem; text-align: right;">Saldo</th>
                                <th style="padding: 0.6rem 0.75rem;">Motivo</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml || '<tr><td colspan="6" style="padding: 2rem; text-align: center; color: #94a3b8;">No hay movimientos registrados para este producto</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        const footer = `
            <div style="display: flex; justify-content: flex-end; width: 100%;">
                <button type="button" class="btn btn-secondary" onclick="closeModal()" style="font-weight: 800; padding: 0.5rem 1.5rem;">Cerrar (Esc)</button>
            </div>
        `;

        showModal(content, { title: 'Historial / Kardex del Producto', footer, width: '750px' });
    },

    // =========================================================================
    // 5. SECCIÓN 2: BAJAS Y CONSUMOS (PÉRDIDAS, MERMAS Y CONSUMO DEL LOCAL)
    // =========================================================================

    // --- A. GESTIÓN DE BORRADORES INTELIGENTES (AUTOSAVE) ---
    getEgressDraftKey() {
        const businessId = (typeof AuthManager !== 'undefined' && AuthManager.getCurrentBusinessId)
            ? AuthManager.getCurrentBusinessId()
            : (localStorage.getItem('CURRENT_BUSINESS_ID') || 1);
        return `cf_egress_draft_b${businessId}`;
    },

    getEgressDraft() {
        try {
            const raw = localStorage.getItem(this.getEgressDraftKey());
            return raw ? JSON.parse(raw) : null;
        } catch (_) {
            return null;
        }
    },

    hasEgressDraft() {
        const draft = this.getEgressDraft();
        return Boolean(draft && Array.isArray(draft.cart) && draft.cart.length > 0);
    },

    saveEgressDraft() {
        if (!this.egressCart || this.egressCart.length === 0) {
            this.clearEgressDraft();
            return;
        }
        try {
            const data = {
                cart: this.egressCart,
                reason: this.egressReason || '',
                savedAt: new Date().toISOString()
            };
            localStorage.setItem(this.getEgressDraftKey(), JSON.stringify(data));
        } catch (e) {
            console.warn('[InventoryView] Error guardando borrador:', e);
        }
    },

    clearEgressDraft() {
        try {
            localStorage.removeItem(this.getEgressDraftKey());
        } catch (_) {}
    },

    restoreEgressDraft() {
        const draft = this.getEgressDraft();
        if (!draft || !draft.cart || draft.cart.length === 0) {
            showNotification('No hay borrador para restaurar', 'info');
            return;
        }
        this.egressCart = draft.cart;
        this.egressReason = draft.reason || '';
        showNotification(`📥 Se restauró el borrador (${this.egressCart.length} productos)`, 'success');
        this.openEgressEntryModal();
    },

    discardEgressDraft() {
        this.clearEgressDraft();
        this.egressCart = [];
        this.egressReason = '';
        showNotification('🗑️ Borrador descartado', 'info');
        this.switchSection('egress');
    },

    // --- B. VISTA PRINCIPAL DE BAJAS Y CONSUMOS ---
    renderEgressSection(dashboard) {
        const draft = this.getEgressDraft();
        const hasDraft = Boolean(draft && draft.cart && draft.cart.length > 0);
        const draftTotal = hasDraft ? draft.cart.reduce((s, i) => s + (i.cost * i.quantity), 0) : 0;

        return `
            ${hasDraft ? `
                <!-- Alerta de Borrador No Guardado -->
                <div class="card" style="background: #fffbeb; border: 1.5px solid #fde68a; border-left: 5px solid #f59e0b; border-radius: 1rem; padding: 1rem 1.25rem; margin-bottom: 1.25rem; box-shadow: 0 2px 4px rgba(245,158,11,0.08);">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <span style="font-size: 1.5rem;">⚠️</span>
                            <div>
                                <strong style="color: #92400e; font-size: 0.95rem; display: block;">Tienes un registro de mercadería pendiente no guardado</strong>
                                <span style="color: #b45309; font-size: 0.8rem;">
                                    ${draft.cart.length} productos en borrador acumulados (${formatCLP(draftTotal)} en costo).
                                </span>
                            </div>
                        </div>
                        <div style="display: flex; gap: 0.5rem; align-items: center;">
                            <button type="button" class="btn btn-sm btn-primary" onclick="InventoryView.restoreEgressDraft()" style="background: #d97706; border-color: #d97706; font-weight: 800; padding: 0.45rem 1rem; border-radius: 0.5rem;">
                                📥 Continuar Borrador
                            </button>
                            <button type="button" class="btn btn-sm btn-secondary" onclick="InventoryView.discardEgressDraft()" style="color: #dc2626; border-color: #fecaca; font-weight: 800; padding: 0.45rem 0.85rem; border-radius: 0.5rem;">
                                ✕ Descartar
                            </button>
                        </div>
                    </div>
                </div>
            ` : ''}

            <!-- Botón Maestro de Ingreso de Mercadería y Exportaciones -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
                <div>
                    <h2 style="font-size: 1.25rem; font-weight: 900; color: #0f172a; margin: 0;">Pérdidas, Mermas y Consumo Interno</h2>
                    <p style="color: #64748b; font-size: 0.85rem; margin: 0.2rem 0 0 0;">Control de mercadería vencida, dañada o consumida por el negocio.</p>
                </div>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
                    <button type="button" 
                            class="btn btn-secondary" 
                            onclick="InventoryView.exportEgressReportPDF()" 
                            style="padding: 0.65rem 1rem; font-size: 0.88rem; font-weight: 800; border-radius: 0.75rem; display: flex; align-items: center; gap: 0.4rem; background: #ffffff; border: 1.5px solid #cbd5e1; color: #1e293b; transition: all 0.2s;"
                            onmouseover="this.style.background='#f1f5f9'"
                            onmouseout="this.style.background='#ffffff'"
                            title="Descargar informe PDF de pérdidas y mermas">
                        <span>📄</span>
                        <span>Informe Mermas (PDF)</span>
                    </button>
                    <button type="button" 
                            class="btn btn-secondary" 
                            onclick="InventoryView.exportEgressReportExcel()" 
                            style="padding: 0.65rem 1rem; font-size: 0.88rem; font-weight: 800; border-radius: 0.75rem; display: flex; align-items: center; gap: 0.4rem; background: #ffffff; border: 1.5px solid #cbd5e1; color: #047857; transition: all 0.2s;"
                            onmouseover="this.style.background='#f0fdf4'"
                            onmouseout="this.style.background='#ffffff'"
                            title="Exportar mermas y consumos a Excel">
                        <span>📊</span>
                        <span>Excel</span>
                    </button>
                    <button type="button" 
                            class="btn btn-primary" 
                            onclick="InventoryView.openEgressEntryModal()"
                            style="padding: 0.75rem 1.5rem; font-size: 0.95rem; font-weight: 900; border-radius: 0.75rem; background: linear-gradient(135deg, #1e293b, #0f172a); border: none; box-shadow: 0 4px 12px rgba(15,23,42,0.15); display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 1.2rem;">➕</span>
                        <span>Anotar Mercadería (Pérdida / Consumo)</span>
                    </button>
                </div>
            </div>

            <!-- Dos Tarjetas KPI Interactivas (Filtran el historial al hacer clic) -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1rem; margin-bottom: 1.25rem;">
                <!-- Tarjeta 1: Pérdidas y Mermas -->
                <div class="card" 
                     onclick="InventoryView.setEgressFilter('loss')"
                     style="background: #ffffff; border: 2px solid ${this.egressFilter === 'loss' ? '#dc2626' : '#fecaca'}; border-left: 6px solid #dc2626; border-radius: 1rem; padding: 1.15rem; cursor: pointer; transition: all 0.2s; box-shadow: ${this.egressFilter === 'loss' ? '0 4px 14px rgba(220,38,38,0.15)' : '0 2px 4px rgba(0,0,0,0.02)'};"
                     onmouseover="this.style.transform='translateY(-2px)';"
                     onmouseout="this.style.transform='translateY(0)';"
                     title="Haz clic para ver solo pérdidas en el historial">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span style="font-size: 1.35rem;">🗑️</span>
                            <span style="font-size: 0.82rem; text-transform: uppercase; color: #991b1b; font-weight: 900; letter-spacing: 0.5px;">Pérdidas y Mermas</span>
                        </div>
                        ${this.egressFilter === 'loss' ? '<span style="background: #fee2e2; color: #dc2626; font-size: 0.68rem; font-weight: 900; padding: 0.2rem 0.5rem; border-radius: 0.4rem;">FILTRADO ACTIVO</span>' : '<span style="font-size: 0.72rem; color: #94a3b8; font-weight: 700;">Clic para filtrar 🔍</span>'}
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; text-align: center; background: #fef2f2; padding: 0.65rem; border-radius: 0.65rem; border: 1px solid #fee2e2;">
                        <div>
                            <span style="font-size: 0.68rem; color: #991b1b; font-weight: 800; text-transform: uppercase; display: block;">Hoy</span>
                            <strong style="font-size: 1.05rem; color: #dc2626; font-weight: 900;">${formatCLP(dashboard.lossToday)}</strong>
                        </div>
                        <div style="border-left: 1px solid #fecaca; border-right: 1px solid #fecaca;">
                            <span style="font-size: 0.68rem; color: #991b1b; font-weight: 800; text-transform: uppercase; display: block;">Esta Semana</span>
                            <strong style="font-size: 1.05rem; color: #dc2626; font-weight: 900;">${formatCLP(dashboard.lossWeek)}</strong>
                        </div>
                        <div>
                            <span style="font-size: 0.68rem; color: #991b1b; font-weight: 800; text-transform: uppercase; display: block;">Este Mes</span>
                            <strong style="font-size: 1.05rem; color: #dc2626; font-weight: 900;">${formatCLP(dashboard.lossMonth)}</strong>
                        </div>
                    </div>
                    <small style="color: #64748b; font-size: 0.75rem; display: block; margin-top: 0.5rem;">Costo de mercadería vencida, rota o en descomposición.</small>
                </div>

                <!-- Tarjeta 2: Consumo del Local / Casa -->
                <div class="card" 
                     onclick="InventoryView.setEgressFilter('consumption')"
                     style="background: #ffffff; border: 2px solid ${this.egressFilter === 'consumption' ? '#2563eb' : '#bfdbfe'}; border-left: 6px solid #2563eb; border-radius: 1rem; padding: 1.15rem; cursor: pointer; transition: all 0.2s; box-shadow: ${this.egressFilter === 'consumption' ? '0 4px 14px rgba(37,99,235,0.15)' : '0 2px 4px rgba(0,0,0,0.02)'};"
                     onmouseover="this.style.transform='translateY(-2px)';"
                     onmouseout="this.style.transform='translateY(0)';"
                     title="Haz clic para ver solo consumos en el historial">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span style="font-size: 1.35rem;">🍽️</span>
                            <span style="font-size: 0.82rem; text-transform: uppercase; color: #1e40af; font-weight: 900; letter-spacing: 0.5px;">Consumo del Local / Casa</span>
                        </div>
                        ${this.egressFilter === 'consumption' ? '<span style="background: #dbeafe; color: #2563eb; font-size: 0.68rem; font-weight: 900; padding: 0.2rem 0.5rem; border-radius: 0.4rem;">FILTRADO ACTIVO</span>' : '<span style="font-size: 0.72rem; color: #94a3b8; font-weight: 700;">Clic para filtrar 🔍</span>'}
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; text-align: center; background: #eff6ff; padding: 0.65rem; border-radius: 0.65rem; border: 1px solid #dbeafe;">
                        <div>
                            <span style="font-size: 0.68rem; color: #1e40af; font-weight: 800; text-transform: uppercase; display: block;">Hoy</span>
                            <strong style="font-size: 1.05rem; color: #2563eb; font-weight: 900;">${formatCLP(dashboard.consumptionToday)}</strong>
                        </div>
                        <div style="border-left: 1px solid #bfdbfe; border-right: 1px solid #bfdbfe;">
                            <span style="font-size: 0.68rem; color: #1e40af; font-weight: 800; text-transform: uppercase; display: block;">Esta Semana</span>
                            <strong style="font-size: 1.05rem; color: #2563eb; font-weight: 900;">${formatCLP(dashboard.consumptionWeek)}</strong>
                        </div>
                        <div>
                            <span style="font-size: 0.68rem; color: #1e40af; font-weight: 800; text-transform: uppercase; display: block;">Este Mes</span>
                            <strong style="font-size: 1.05rem; color: #2563eb; font-weight: 900;">${formatCLP(dashboard.consumptionMonth)}</strong>
                        </div>
                    </div>
                    <small style="color: #64748b; font-size: 0.75rem; display: block; margin-top: 0.5rem;">Costo de mercadería consumida por el personal o la casa.</small>
                </div>
            </div>

            <!-- Estudio: Productos con Mayor Impacto (Top Pérdidas y Consumos) -->
            ${this.renderEgressTopProductsStudy()}

            <!-- HISTORIAL DE CONSUMO O PÉRDIDA -->
            <div class="card" style="padding: 1.25rem; border-radius: 1.25rem; border: 1.5px solid #e2e8f0; background: #ffffff; margin-top: 1.25rem; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #f1f5f9; padding-bottom: 0.85rem; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.75rem;">
                    <div>
                        <h3 style="margin: 0; color: #0f172a; font-weight: 900; font-size: 1.15rem; display: flex; align-items: center; gap: 0.5rem;">
                            <span>📜</span> Historial de Consumo o Pérdida
                        </h3>
                        <span style="font-size: 0.8rem; color: #64748b;">Movimientos registrados con trazabilidad y reversión de stock:</span>
                    </div>

                    <!-- Buscador en tiempo real -->
                    <div style="position: relative; width: 280px; max-width: 100%;">
                        <input type="text" 
                               id="egressHistorySearchInput" 
                               class="form-control" 
                               placeholder="🔍 Buscar producto, código, motivo..." 
                               value="${this.egressSearchQuery}"
                               oninput="InventoryView.handleEgressHistorySearch(this.value)"
                               style="height: 38px; font-size: 0.85rem; border-radius: 0.6rem; border: 1.5px solid #cbd5e1; padding-left: 0.75rem;">
                    </div>
                </div>

                <!-- Barra de Filtros: Tiempo y Tipo -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.75rem;">
                    <!-- Botones rápidos de período -->
                    <div style="display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap;">
                        <span style="font-size: 0.78rem; font-weight: 800; color: #64748b; margin-right: 0.25rem;">Período:</span>
                        <button type="button" 
                                class="btn btn-sm ${this.egressTimeFilter === 'today' ? 'btn-primary' : 'btn-secondary'}" 
                                onclick="InventoryView.setEgressTimeFilter('today')" 
                                style="font-weight: 800; border-radius: 0.5rem; padding: 0.3rem 0.75rem;">
                            📅 Hoy
                        </button>
                        <button type="button" 
                                class="btn btn-sm ${this.egressTimeFilter === 'week' ? 'btn-primary' : 'btn-secondary'}" 
                                onclick="InventoryView.setEgressTimeFilter('week')" 
                                style="font-weight: 800; border-radius: 0.5rem; padding: 0.3rem 0.75rem;">
                            📅 Esta Semana
                        </button>
                        <button type="button" 
                                class="btn btn-sm ${this.egressTimeFilter === 'month' ? 'btn-primary' : 'btn-secondary'}" 
                                onclick="InventoryView.setEgressTimeFilter('month')" 
                                style="font-weight: 800; border-radius: 0.5rem; padding: 0.3rem 0.75rem;">
                            📅 Este Mes
                        </button>
                        <button type="button" 
                                class="btn btn-sm ${this.egressTimeFilter === 'all' ? 'btn-primary' : 'btn-secondary'}" 
                                onclick="InventoryView.setEgressTimeFilter('all')" 
                                style="font-weight: 800; border-radius: 0.5rem; padding: 0.3rem 0.75rem;">
                            🔍 Ver Todos
                        </button>
                    </div>

                    <!-- Pills de Tipo -->
                    <div style="display: flex; gap: 0.35rem; align-items: center;">
                        <span style="font-size: 0.78rem; font-weight: 800; color: #64748b; margin-right: 0.25rem;">Tipo:</span>
                        <button type="button" 
                                class="btn btn-sm ${this.egressFilter === 'all' ? 'btn-primary' : 'btn-secondary'}" 
                                onclick="InventoryView.setEgressFilter('all')" 
                                style="font-weight: 800; border-radius: 0.5rem; padding: 0.3rem 0.75rem;">
                            Todos
                        </button>
                        <button type="button" 
                                class="btn btn-sm ${this.egressFilter === 'loss' ? 'btn-danger' : 'btn-secondary'}" 
                                onclick="InventoryView.setEgressFilter('loss')" 
                                style="font-weight: 800; border-radius: 0.5rem; padding: 0.3rem 0.75rem; ${this.egressFilter === 'loss' ? 'background: #dc2626; border-color: #dc2626; color: white;' : ''}">
                            🗑️ Solo Mermas
                        </button>
                        <button type="button" 
                                class="btn btn-sm ${this.egressFilter === 'consumption' ? 'btn-primary' : 'btn-secondary'}" 
                                onclick="InventoryView.setEgressFilter('consumption')" 
                                style="font-weight: 800; border-radius: 0.5rem; padding: 0.3rem 0.75rem; ${this.egressFilter === 'consumption' ? 'background: #2563eb; border-color: #2563eb; color: white;' : ''}">
                            🍽️ Solo Consumos
                        </button>
                    </div>
                </div>

                <!-- Tabla de Historial -->
                <div id="egressHistoryTableContainer">
                    ${this.renderEgressHistoryTableHtml()}
                </div>
            </div>
        `;
    },

    // --- C. ESTUDIO TOP PRODUCTOS MÁS PERDIDOS Y CONSUMIDOS ---
    renderEgressTopProductsStudy() {
        const movements = (this.recentMovements || []).filter(m => 
            (m.type === 'loss' || m.type === 'consumption') && m.status !== 'cancelled'
        );

        if (movements.length === 0) {
            return `
                <div class="card" style="padding: 1.25rem; border-radius: 1rem; border: 1.5px solid #e2e8f0; background: #ffffff;">
                    <div style="font-size: 0.9rem; font-weight: 900; color: #0f172a; margin-bottom: 0.35rem;">📊 Estudio de Mercadería con Mayor Impacto</div>
                    <div style="color: #64748b; font-size: 0.8rem;">No hay registros de pérdidas o consumos en los últimos 30 días para generar el ranking.</div>
                </div>
            `;
        }

        const grouped = {};
        movements.forEach(m => {
            const pId = m.productId || m.product_id;
            if (!grouped[pId]) {
                const prod = (this.allProducts || []).find(p => p.id === pId);
                grouped[pId] = {
                    productId: pId,
                    name: prod ? prod.name : (m.productName || 'Producto'),
                    barcode: prod ? prod.barcode : '',
                    type: prod ? prod.type : 'unit',
                    lossQty: 0,
                    lossCost: 0,
                    consumptionQty: 0,
                    consumptionCost: 0,
                    totalCost: 0
                };
            }
            const q = Math.abs(parseFloat(m.quantity) || 0);
            const c = Math.abs(parseFloat(m.cost_value) || 0);

            if (m.type === 'loss') {
                grouped[pId].lossQty += q;
                grouped[pId].lossCost += c;
            } else {
                grouped[pId].consumptionQty += q;
                grouped[pId].consumptionCost += c;
            }
            grouped[pId].totalCost += c;
        });

        const topProducts = Object.values(grouped).sort((a, b) => b.totalCost - a.totalCost).slice(0, 5);
        const maxCost = topProducts[0]?.totalCost || 1;

        return `
            <div class="card" style="padding: 1.25rem; border-radius: 1.25rem; border: 1.5px solid #e2e8f0; background: #ffffff; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
                    <div>
                        <strong style="color: #0f172a; font-size: 1.05rem; font-weight: 900; display: block;">
                            📊 Estudio: Top 5 Productos con Mayor Impacto Financiero
                        </strong>
                        <span style="color: #64748b; font-size: 0.8rem;">Productos que representan mayor costo acumulado en los últimos 30 días (Pérdidas + Consumos).</span>
                    </div>
                </div>

                <div style="display: grid; gap: 0.65rem;">
                    ${topProducts.map((p, idx) => {
                        const percent = Math.min(100, Math.round((p.totalCost / maxCost) * 100));
                        const unit = p.type === 'weight' ? 'kg' : 'un';
                        return `
                            <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 0.75rem; padding: 0.75rem 1rem;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; flex-wrap: wrap; gap: 0.5rem;">
                                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                                        <span style="background: #e2e8f0; color: #0f172a; font-weight: 900; font-size: 0.75rem; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                            ${idx + 1}
                                        </span>
                                        <strong style="color: #0f172a; font-size: 0.92rem;">${safeHTML(p.name)}</strong>
                                        <small style="color: #64748b; font-size: 0.75rem; font-family: monospace;">${safeHTML(p.barcode || '')}</small>
                                    </div>
                                    <div style="text-align: right;">
                                        <strong style="color: #dc2626; font-size: 1rem; font-weight: 900;">-${formatCLP(p.totalCost)}</strong>
                                        <span style="color: #64748b; font-size: 0.75rem; display: block;">
                                            ${p.lossQty > 0 ? `🗑️ ${p.lossQty} ${unit}` : ''} ${p.consumptionQty > 0 ? `🍽️ ${p.consumptionQty} ${unit}` : ''}
                                        </span>
                                    </div>
                                </div>
                                <div style="background: #e2e8f0; height: 6px; border-radius: 3px; overflow: hidden;">
                                    <div style="background: linear-gradient(90deg, #ef4444, #f59e0b); height: 100%; width: ${percent}%; border-radius: 3px;"></div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    },

    // --- D. HISTORIAL Y TABLA FILTRADA ---
    renderEgressHistoryTableHtml() {
        const movements = this.getFilteredEgressMovements();

        if (movements.length === 0) {
            return `
                <div style="padding: 3rem 1.5rem; text-align: center; color: #64748b;">
                    <div style="font-size: 2.75rem; margin-bottom: 0.5rem; opacity: 0.5;">📋</div>
                    <strong style="font-size: 1rem; color: #1e293b; display: block;">No se encontraron registros de pérdida o consumo</strong>
                    <span style="font-size: 0.82rem;">Prueba cambiando los filtros de período o limpiando el texto del buscador.</span>
                </div>
            `;
        }

        const totalCost = movements.filter(m => m.status !== 'cancelled').reduce((sum, m) => sum + (parseFloat(m.cost_value) || 0), 0);

        return `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; background: #f8fafc; padding: 0.65rem 1rem; border-radius: 0.65rem; border: 1.5px solid #e2e8f0; flex-wrap: wrap; gap: 0.5rem;">
                <span style="font-size: 0.85rem; color: #475569; font-weight: 700;">
                    Total acumulado en registros mostrados:
                </span>
                <strong style="font-size: 1.15rem; color: #dc2626; font-weight: 900;">
                    -${formatCLP(totalCost)}
                </strong>
            </div>

            <div style="overflow-x: auto; border: 1.5px solid #e2e8f0; border-radius: 0.75rem; background: #ffffff;">
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                    <thead style="background: #f8fafc; border-bottom: 2px solid #cbd5e1;">
                        <tr style="font-size: 0.72rem; text-transform: uppercase; color: #475569; font-weight: 900;">
                            <th style="padding: 0.65rem 0.75rem;">Fecha / Hora</th>
                            <th style="padding: 0.65rem 0.75rem;">Tipo</th>
                            <th style="padding: 0.65rem 0.75rem;">Producto</th>
                            <th style="padding: 0.65rem 0.75rem; text-align: center;">Cantidad</th>
                            <th style="padding: 0.65rem 0.75rem; text-align: right;">Costo Total</th>
                            <th style="padding: 0.65rem 0.75rem;">Motivo / Resp.</th>
                            <th style="padding: 0.65rem 0.75rem; text-align: center;">Estado</th>
                            <th style="padding: 0.65rem 0.75rem; text-align: right;">Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${movements.map(m => {
                            const p = (this.allProducts || []).find(prod => prod.id === m.productId);
                            const name = p ? p.name : (m.productName || 'Producto');
                            const barcode = p ? (p.barcode || 'S/N') : '—';
                            const unit = p && p.type === 'weight' ? 'kg' : 'un';
                            const isCancelled = m.status === 'cancelled';
                            const isLoss = m.type === 'loss';
                            const dateStr = formatDateTime(m.date);

                            return `
                                <tr style="border-bottom: 1px solid #e2e8f0; font-size: 0.85rem; ${isCancelled ? 'opacity: 0.6; background: #f8fafc;' : ''}">
                                    <td style="padding: 0.65rem 0.75rem; color: #64748b; font-weight: 600; white-space: nowrap;">
                                        ${dateStr}
                                    </td>
                                    <td style="padding: 0.65rem 0.75rem;">
                                        <span class="badge ${isLoss ? 'badge-danger' : 'badge-info'}" style="font-weight: 800; font-size: 0.72rem;">
                                            ${isLoss ? '🗑️ Pérdida' : '🍽️ Consumo'}
                                        </span>
                                    </td>
                                    <td style="padding: 0.65rem 0.75rem;">
                                        <strong style="color: #0f172a; display: block;">${safeHTML(name)}</strong>
                                        <small style="color: #64748b; font-family: monospace;">Cód: ${safeHTML(barcode)}</small>
                                    </td>
                                    <td style="padding: 0.65rem 0.75rem; text-align: center; font-weight: 900; color: ${isLoss ? '#dc2626' : '#2563eb'};">
                                        -${Math.abs(m.quantity)} ${unit}
                                    </td>
                                    <td style="padding: 0.65rem 0.75rem; text-align: right; font-weight: 800; color: #dc2626;">
                                        -${formatCLP(m.cost_value || 0)}
                                    </td>
                                    <td style="padding: 0.65rem 0.75rem; color: #475569; font-size: 0.82rem;">
                                        <div>${safeHTML(m.reason || '—')}</div>
                                        <small style="color: #64748b;">${safeHTML(m.userName || 'Sistema')}</small>
                                    </td>
                                    <td style="padding: 0.65rem 0.75rem; text-align: center;">
                                        ${isCancelled 
                                            ? '<span style="background: #fee2e2; color: #dc2626; padding: 0.15rem 0.45rem; border-radius: 0.35rem; font-size: 0.68rem; font-weight: 900;">ANULADO</span>'
                                            : '<span style="background: #dcfce7; color: #15803d; padding: 0.15rem 0.45rem; border-radius: 0.35rem; font-size: 0.68rem; font-weight: 900;">ACTIVO</span>'}
                                    </td>
                                    <td style="padding: 0.65rem 0.75rem; text-align: right;">
                                        ${!isCancelled ? `
                                            <button class="btn btn-sm btn-secondary" onclick="InventoryView.promptCancelMovement(${m.id}, '${m.type}')" style="padding: 0.25rem 0.6rem; font-size: 0.75rem; font-weight: 800; border-radius: 0.4rem; color: #dc2626; border-color: #fecaca;" title="Anular y devolver stock">
                                                🚫 Anular
                                            </button>
                                        ` : '<span style="font-size: 0.75rem; color: #94a3b8;">Reintegrado</span>'}
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    setEgressFilter(type) {
        if (this.egressFilter === type && type !== 'all') {
            this.egressFilter = 'all';
        } else {
            this.egressFilter = type;
        }
        this.updateEgressHistoryTableOnly();
    },

    setEgressTimeFilter(period) {
        this.egressTimeFilter = period;
        this.updateEgressHistoryTableOnly();
    },

    handleEgressHistorySearch(val) {
        this.egressSearchQuery = (val || '').toLowerCase().trim();
        this.updateEgressHistoryTableOnly();
    },

    updateEgressHistoryTableOnly() {
        const container = document.getElementById('egressHistoryTableContainer');
        if (container) {
            container.innerHTML = this.renderEgressHistoryTableHtml();
        } else {
            this.switchSection('egress');
        }
    },

    getFilteredEgressMovements() {
        const now = new Date();
        const todayStr = now.toLocaleDateString('sv-SE');
        const dayOfWeek = (now.getDay() + 6) % 7;
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - dayOfWeek);
        startOfWeek.setHours(0, 0, 0, 0);
        const startOfWeekTime = startOfWeek.getTime();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        let movements = (this.recentMovements || []).filter(m => (m.type === 'loss' || m.type === 'consumption'));

        if (this.egressFilter === 'loss') {
            movements = movements.filter(m => m.type === 'loss');
        } else if (this.egressFilter === 'consumption') {
            movements = movements.filter(m => m.type === 'consumption');
        }

        if (this.egressTimeFilter === 'today') {
            movements = movements.filter(m => (m.date || '').slice(0, 10) === todayStr);
        } else if (this.egressTimeFilter === 'week') {
            movements = movements.filter(m => new Date(m.date).getTime() >= startOfWeekTime);
        } else if (this.egressTimeFilter === 'month') {
            movements = movements.filter(m => {
                const d = new Date(m.date);
                return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
            });
        }

        if (this.egressSearchQuery) {
            const q = this.egressSearchQuery;
            movements = movements.filter(m => {
                const p = (this.allProducts || []).find(prod => prod.id === m.productId);
                const name = (p ? p.name : (m.productName || '')).toLowerCase();
                const barcode = (p ? (p.barcode || '') : '').toLowerCase();
                const reason = (m.reason || '').toLowerCase();
                const user = (m.userName || '').toLowerCase();
                return name.includes(q) || barcode.includes(q) || reason.includes(q) || user.includes(q);
            });
        }

        return movements;
    },

    exportEgressReportPDF() {
        try {
            const jsPDF = window.jspdf ? window.jspdf.jsPDF : null;
            if (!jsPDF) {
                showNotification('Módulo PDF no disponible', 'warning');
                return;
            }

            const movements = this.getFilteredEgressMovements();
            if (movements.length === 0) {
                showNotification('No hay registros de pérdidas o consumos para exportar con los filtros actuales', 'warning');
                return;
            }

            const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
            const bizName = localStorage.getItem('BUSINESS_NAME') || 'Mi Negocio';
            const bizRut = localStorage.getItem('BUSINESS_RUT') || '';
            const now = new Date();

            // Header Banner
            doc.setFillColor(15, 23, 42);
            doc.rect(0, 0, 842, 60, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.text(bizName.toUpperCase(), 40, 36);

            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            doc.text('INFORME DE PÉRDIDAS, MERMAS Y CONSUMO INTERNO', 480, 36);

            // Subheader metadata
            let y = 85;
            doc.setTextColor(30, 41, 59);
            doc.setFontSize(9);
            if (bizRut) doc.text(`RUT: ${bizRut}`, 40, y);
            doc.text(`Fecha Emisión: ${now.toLocaleDateString('es-CL')} ${now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`, 40, y + 14);

            const filterLabel = this.egressFilter === 'loss' ? 'Solo Mermas/Pérdidas' : (this.egressFilter === 'consumption' ? 'Solo Consumo Interno' : 'Mermas y Consumos');
            const timeLabel = this.egressTimeFilter === 'today' ? 'Hoy' : (this.egressTimeFilter === 'week' ? 'Esta Semana' : (this.egressTimeFilter === 'month' ? 'Este Mes' : 'Histórico Total'));
            doc.text(`Filtro: ${filterLabel} | Período: ${timeLabel}`, 500, y + 14);

            // Table Data
            const tableRows = movements.map(m => {
                const p = (this.allProducts || []).find(prod => prod.id === m.productId);
                const name = p ? p.name : (m.productName || 'Producto');
                const barcode = p ? (p.barcode || '—') : '—';
                const unit = p && p.type === 'weight' ? 'kg' : 'un';
                const typeText = m.type === 'loss' ? 'Merma' : 'Consumo';
                const dateText = m.date ? new Date(m.date).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
                const costVal = parseFloat(m.cost_value) || 0;
                const statusText = m.status === 'cancelled' ? 'ANULADO' : 'Vigente';

                return [
                    dateText,
                    typeText,
                    barcode,
                    name,
                    `${m.quantity} ${unit}`,
                    formatCLP(costVal),
                    m.reason || 'Sin motivo',
                    m.userName || 'Sistema',
                    statusText
                ];
            });

            const totalLoss = movements.filter(m => m.status !== 'cancelled').reduce((acc, m) => acc + (parseFloat(m.cost_value) || 0), 0);
            const totalQty = movements.filter(m => m.status !== 'cancelled').reduce((acc, m) => acc + (parseFloat(m.quantity) || 0), 0);

            if (doc.autoTable) {
                doc.autoTable({
                    startY: 115,
                    head: [['Fecha/Hora', 'Tipo', 'Código', 'Producto', 'Cantidad', 'Costo Total', 'Motivo', 'Responsable', 'Estado']],
                    body: tableRows,
                    theme: 'striped',
                    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
                    bodyStyles: { fontSize: 8, textColor: [15, 23, 42] },
                    alternateRowStyles: { fillColor: [248, 250, 252] },
                    columnStyles: {
                        0: { cellWidth: 85 },
                        1: { cellWidth: 55 },
                        2: { cellWidth: 70 },
                        3: { cellWidth: 170 },
                        4: { cellWidth: 55, halign: 'center' },
                        5: { cellWidth: 70, halign: 'right' },
                        6: { cellWidth: 120 },
                        7: { cellWidth: 65 },
                        8: { cellWidth: 50, halign: 'center' }
                    },
                    margin: { left: 40, right: 40 },
                    didDrawPage: () => {
                        const pageCount = doc.internal.getNumberOfPages();
                        doc.setFontSize(8);
                        doc.setTextColor(148, 163, 184);
                        doc.text(`Página ${doc.internal.getCurrentPageInfo().pageNumber} de ${pageCount} — Caja Fácil POS`, 40, 565);
                    }
                });

                const finalY = doc.lastAutoTable.finalY + 15;
                if (finalY < 540) {
                    doc.setFillColor(254, 242, 242);
                    doc.rect(40, finalY, 762, 35, 'F');
                    doc.setDrawColor(254, 202, 202);
                    doc.rect(40, finalY, 762, 35, 'D');

                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(153, 27, 27);
                    doc.text(`TOTAL PÉRDIDAS / CONSUMOS VIGENTES: ${formatCLP(totalLoss)}  |  Total Unidades Descontadas: ${totalQty}`, 55, finalY + 22);
                }
            }

            const fileName = `informe_mermas_${now.toISOString().slice(0, 10)}.pdf`;
            doc.save(fileName);
            showNotification('Informe PDF descargado con éxito', 'success');
        } catch (e) {
            console.error('Error al generar PDF de mermas:', e);
            showNotification('Error al exportar informe en PDF', 'error');
        }
    },

    exportEgressReportExcel() {
        try {
            if (typeof XLSX === 'undefined') {
                showNotification('Librería Excel no disponible', 'warning');
                return;
            }

            const movements = this.getFilteredEgressMovements();
            if (movements.length === 0) {
                showNotification('No hay registros de pérdidas o consumos para exportar con los filtros actuales', 'warning');
                return;
            }

            const rows = movements.map(m => {
                const p = (this.allProducts || []).find(prod => prod.id === m.productId);
                const name = p ? p.name : (m.productName || 'Producto');
                const barcode = p ? (p.barcode || '') : '';
                const unit = p && p.type === 'weight' ? 'kg' : 'un';
                const dateText = m.date ? new Date(m.date).toLocaleString('es-CL') : '';

                return {
                    'Fecha y Hora': dateText,
                    'Tipo de Movimiento': m.type === 'loss' ? 'Pérdida / Merma' : 'Consumo Interno',
                    'Código': barcode,
                    'Producto': name,
                    'Cantidad': parseFloat(m.quantity) || 0,
                    'Unidad': unit,
                    'Costo Total ($)': parseFloat(m.cost_value) || 0,
                    'Motivo': m.reason || 'Sin motivo',
                    'Responsable': m.userName || 'Sistema',
                    'Estado': m.status === 'cancelled' ? 'Anulado' : 'Vigente'
                };
            });

            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Mermas y Pérdidas');

            const now = new Date();
            const fileName = `mermas_consumos_${now.toISOString().slice(0, 10)}.xlsx`;
            XLSX.writeFile(wb, fileName);
            showNotification('Reporte Excel descargado con éxito', 'success');
        } catch (e) {
            console.error('Error al exportar Excel de mermas:', e);
            showNotification('Error al exportar reporte Excel', 'error');
        }
    },

    setupEgressMainListeners() {
        // Inicialización pasiva de la vista principal
    },

    // --- E. MODAL DEDICADO DE INGRESO DE MERCADERÍA (PÉRDIDA / CONSUMO) ---
    openEgressEntryModal() {
        const content = `
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                <!-- 1. Barra de Búsqueda Inteligente con Autofocus y Botón Limpiar -->
                <div style="position: relative;">
                    <label style="font-size: 0.82rem; font-weight: 800; color: #334155; display: block; margin-bottom: 0.35rem;">
                        Buscar o Escanear Producto (Nombre o Código de Barra):
                    </label>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <div style="position: relative; flex: 1;">
                            <input type="text" 
                                   id="egressModalSearchInput" 
                                   class="form-control" 
                                   placeholder="🔍 Escanea con la pistola o escribe nombre/código..." 
                                   oninput="InventoryView.handleEgressModalSearch(this.value)"
                                   style="height: 46px; font-size: 1rem; font-weight: 700; border-radius: 0.65rem; border: 2px solid #3b82f6; padding-left: 0.85rem; padding-right: 2.5rem; width: 100%;"
                                   autofocus>
                            <button type="button" 
                                    id="egressModalClearSearchBtn"
                                    onclick="InventoryView.clearEgressModalSearch()" 
                                    style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; font-size: 1.1rem; color: #94a3b8; cursor: pointer; padding: 4px;"
                                    title="Limpiar búsqueda">
                                ✕
                            </button>
                        </div>
                    </div>

                    <!-- Resultados Flotantes de Búsqueda -->
                    <div id="egressModalSearchResults" 
                         style="display: none; position: absolute; left: 0; right: 0; top: 100%; background: white; border: 1.5px solid #cbd5e1; border-radius: 0.65rem; max-height: 260px; overflow-y: auto; z-index: 2000; box-shadow: 0 10px 25px rgba(0,0,0,0.15); margin-top: 4px;">
                    </div>
                </div>

                <!-- 2. Lista / Carrito de Productos Acumulados -->
                <div id="egressModalCartWrapper">
                    ${this.renderEgressCartTableHtml()}
                </div>

                <!-- 3. Motivo Rápido y Libre -->
                <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 0.85rem; padding: 1rem;">
                    <label style="font-size: 0.82rem; font-weight: 800; color: #334155; display: block; margin-bottom: 0.5rem;">
                        Motivo del Registro (opcional):
                    </label>
                    <!-- Botones Rápidos de Motivo -->
                    <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.65rem;">
                        <button type="button" class="btn btn-sm btn-secondary" onclick="InventoryView.setEgressQuickReason('Vencido')" style="font-weight: 800; border-radius: 0.5rem; font-size: 0.78rem;">📅 Vencido</button>
                        <button type="button" class="btn btn-sm btn-secondary" onclick="InventoryView.setEgressQuickReason('Roto / Dañado')" style="font-weight: 800; border-radius: 0.5rem; font-size: 0.78rem;">💥 Roto / Dañado</button>
                        <button type="button" class="btn btn-sm btn-secondary" onclick="InventoryView.setEgressQuickReason('Consumo Casa')" style="font-weight: 800; border-radius: 0.5rem; font-size: 0.78rem;">🏠 Casa</button>
                        <button type="button" class="btn btn-sm btn-secondary" onclick="InventoryView.setEgressQuickReason('Colación Personal')" style="font-weight: 800; border-radius: 0.5rem; font-size: 0.78rem;">🥪 Colación</button>
                        <button type="button" class="btn btn-sm btn-secondary" onclick="InventoryView.setEgressQuickReason('Uso Interno del Local')" style="font-weight: 800; border-radius: 0.5rem; font-size: 0.78rem;">🏪 Uso Local</button>
                    </div>
                    <input type="text" 
                           id="egressReasonInput" 
                           class="form-control" 
                           placeholder="Ej: Producto quebrado al descargar, colación de turno, etc."
                           value="${safeHTML(this.egressReason || '')}"
                           oninput="InventoryView.egressReason = this.value; InventoryView.saveEgressDraft();"
                           style="height: 40px; font-size: 0.88rem; border-radius: 0.6rem; border: 1.5px solid #cbd5e1;">
                </div>
            </div>
        `;

        const footer = `
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 0.75rem; flex-wrap: nowrap;">
                <button type="button" class="btn btn-secondary" onclick="closeModal()" style="font-weight: 800; padding: 0.55rem 1.15rem; border-radius: 0.65rem; white-space: nowrap;">
                    📁 Cerrar (Guardar Borrador)
                </button>
                <div style="display: flex; gap: 0.65rem; align-items: center;">
                    <button type="button" 
                            class="btn btn-danger" 
                            onclick="InventoryView.submitEgressCart('loss')" 
                            style="font-weight: 900; padding: 0.55rem 1.15rem; border-radius: 0.65rem; background: #dc2626; border-color: #dc2626; display: flex; align-items: center; gap: 0.4rem; white-space: nowrap;">
                        <span>🗑️</span> Asignar a Pérdida / Merma
                    </button>
                    <button type="button" 
                            class="btn btn-primary" 
                            onclick="InventoryView.submitEgressCart('consumption')" 
                            style="font-weight: 900; padding: 0.55rem 1.15rem; border-radius: 0.65rem; background: #2563eb; border-color: #2563eb; display: flex; align-items: center; gap: 0.4rem; white-space: nowrap;">
                        <span>🍽️</span> Asignar a Consumo del Local
                    </button>
                </div>
            </div>
        `;

        const modalEl = showModal(content, { title: 'Anotar Mercadería (Pérdida o Consumo)', footer, width: '850px', showCloseButton: true });
        if (modalEl) {
            modalEl.style.maxHeight = '88vh';
            modalEl.style.display = 'flex';
            modalEl.style.flexDirection = 'column';
            modalEl.style.overflow = 'hidden';
            const modalBody = modalEl.querySelector('.modal-body');
            if (modalBody) {
                modalBody.style.overflowY = 'auto';
                modalBody.style.maxHeight = 'calc(88vh - 130px)';
                modalBody.style.padding = '0.85rem 1.25rem';
            }
        }

        setTimeout(() => {
            const input = document.getElementById('egressModalSearchInput');
            if (input) {
                input.focus();
                this.setupEgressModalSearchListeners();
            }
        }, 100);
    },

    clearEgressModalSearch() {
        const input = document.getElementById('egressModalSearchInput');
        const results = document.getElementById('egressModalSearchResults');
        if (input) {
            input.value = '';
            input.focus();
        }
        if (results) {
            results.style.display = 'none';
            results.innerHTML = '';
        }
    },

    setEgressQuickReason(text) {
        this.egressReason = text;
        const input = document.getElementById('egressReasonInput');
        if (input) input.value = text;
        this.saveEgressDraft();
    },

    renderEgressCartTableHtml() {
        if (!this.egressCart || this.egressCart.length === 0) {
            return `
                <div style="padding: 1.2rem; text-align: center; background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 0.75rem; color: #64748b;">
                    <div style="font-size: 1.8rem; margin-bottom: 0.25rem; opacity: 0.4;">📦</div>
                    <strong style="font-size: 0.92rem; color: #1e293b; display: block;">No hay productos agregados en la lista</strong>
                    <span style="font-size: 0.78rem;">Escribe en el buscador o escanea con la pistola para sumar ítems.</span>
                </div>
            `;
        }

        const totalCost = this.egressCart.reduce((sum, item) => sum + ((parseFloat(item.cost) || 0) * (parseFloat(item.quantity) || 0)), 0);
        const totalQty = this.egressCart.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);

        const rows = this.egressCart.map((item, idx) => {
            const isWeight = item.type === 'weight';
            const unit = isWeight ? 'kg' : 'un';
            const step = isWeight ? '0.001' : '1';
            const itemTotal = (parseFloat(item.cost) || 0) * (parseFloat(item.quantity) || 0);

            return `
                <tr style="border-bottom: 1px solid #e2e8f0; font-size: 0.88rem;">
                    <td style="padding: 0.65rem 0.75rem;">
                        <strong style="color: #0f172a; display: block;">${safeHTML(item.name)}</strong>
                        <small style="color: #64748b; font-family: monospace;">Cód: ${safeHTML(item.barcode || 'S/N')} • Stock actual: ${item.stock} ${unit}</small>
                    </td>
                    <td style="padding: 0.65rem 0.75rem; text-align: center; width: 170px;">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 0.25rem;">
                            <button type="button" class="btn btn-sm btn-secondary" onclick="InventoryView.stepEgressCartQty(${idx}, -1)" style="padding: 0.25rem 0.55rem; font-weight: 800; border-radius: 0.4rem;">-</button>
                            <input type="number" 
                                   class="form-control" 
                                   value="${item.quantity}" 
                                   min="${step}" 
                                   step="${step}" 
                                   onchange="InventoryView.updateEgressCartQty(${idx}, this.value)"
                                   style="width: 75px; height: 32px; text-align: center; font-weight: 800; border-radius: 0.4rem; padding: 0.2rem;">
                            <button type="button" class="btn btn-sm btn-secondary" onclick="InventoryView.stepEgressCartQty(${idx}, 1)" style="padding: 0.25rem 0.55rem; font-weight: 800; border-radius: 0.4rem;">+</button>
                        </div>
                    </td>
                    <td style="padding: 0.65rem 0.75rem; text-align: right; font-weight: 800; color: #dc2626; width: 110px;">
                        ${formatCLP(itemTotal)}
                    </td>
                    <td style="padding: 0.65rem 0.75rem; text-align: right; width: 45px;">
                        <button type="button" class="btn btn-sm btn-secondary" onclick="InventoryView.removeEgressCartItem(${idx})" style="color: #dc2626; border-color: #fecaca; padding: 0.2rem 0.5rem; font-weight: 800;" title="Quitar">
                            ✕
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <div style="border: 1.5px solid #e2e8f0; border-radius: 0.85rem; overflow: hidden; background: white;">
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                    <thead style="background: #f8fafc; border-bottom: 2px solid #cbd5e1;">
                        <tr style="font-size: 0.72rem; text-transform: uppercase; color: #475569; font-weight: 900;">
                            <th style="padding: 0.6rem 0.75rem;">Producto</th>
                            <th style="padding: 0.6rem 0.75rem; text-align: center;">Cantidad a Descontar</th>
                            <th style="padding: 0.6rem 0.75rem; text-align: right;">Costo Subtotal</th>
                            <th style="padding: 0.6rem 0.75rem; text-align: right;"></th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                    <tfoot style="background: #f8fafc; border-top: 2px solid #cbd5e1; font-weight: 900;">
                        <tr>
                            <td style="padding: 0.65rem 0.75rem; color: #0f172a;">
                                Total: <strong>${this.egressCart.length}</strong> productos
                            </td>
                            <td style="padding: 0.65rem 0.75rem; text-align: center; color: #2563eb;">
                                ${totalQty} un/kg en total
                            </td>
                            <td style="padding: 0.65rem 0.75rem; text-align: right; color: #dc2626; font-size: 1.05rem;">
                                ${formatCLP(totalCost)}
                            </td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    },

    stepEgressCartQty(idx, delta) {
        if (!this.egressCart[idx]) return;
        const item = this.egressCart[idx];
        const step = item.type === 'weight' ? 0.5 : 1;
        item.quantity = Math.max(step, Math.round((item.quantity + delta * step) * 1000) / 1000);
        this.saveEgressDraft();
        this.refreshEgressCartUI();
    },

    updateEgressCartQty(idx, val) {
        if (!this.egressCart[idx]) return;
        const q = parseFloat(val);
        this.egressCart[idx].quantity = (isNaN(q) || q <= 0) ? 1 : q;
        this.saveEgressDraft();
        this.refreshEgressCartUI();
    },

    removeEgressCartItem(idx) {
        this.egressCart.splice(idx, 1);
        this.saveEgressDraft();
        this.refreshEgressCartUI();
    },

    refreshEgressCartUI() {
        const wrapper = document.getElementById('egressModalCartWrapper');
        if (wrapper) {
            wrapper.innerHTML = this.renderEgressCartTableHtml();
        }
    },

    // --- F. MODAL ERGONÓMICO DE CANTIDAD Y CÓDIGO DE BARRAS ---
    openEgressQuantityModal(product) {
        this._egressModalActiveProduct = product;
        const isWeight = product.type === 'weight';
        const unit = isWeight ? 'kg' : 'un';
        const step = isWeight ? '0.001' : '1';

        const content = `
            <div style="text-align: center; margin-bottom: 1.25rem;">
                <span style="font-size: 2rem; display: block; margin-bottom: 0.25rem;">📦</span>
                <strong style="font-size: 1.15rem; color: #0f172a; display: block;">${safeHTML(product.name)}</strong>
                <span style="color: #64748b; font-size: 0.85rem;">Stock actual: <strong style="color: #2563eb;">${product.stock} ${unit}</strong> • Costo: <strong>${formatCLP(product.cost)}</strong></span>
            </div>

            <form id="egressQtyModalForm" onsubmit="event.preventDefault(); InventoryView.confirmAddProductFromModal();">
                <!-- Código de Barras Editable -->
                <div class="form-group" style="margin-bottom: 1rem; text-align: left;">
                    <label style="font-size: 0.8rem; font-weight: 800; color: #475569; display: block; margin-bottom: 0.35rem;">
                        Código de Barra (Editable):
                    </label>
                    <input type="text" 
                           id="egressModalBarcodeField" 
                           class="form-control" 
                           value="${safeHTML(product.barcode || '')}" 
                           placeholder="Sin código de barra"
                           style="height: 38px; font-family: monospace; font-size: 0.95rem; border-radius: 0.5rem; border: 1.5px solid #cbd5e1;">
                </div>

                <!-- Cantidad con 1 predefinido y seleccionado -->
                <div class="form-group" style="margin-bottom: 1.25rem; text-align: left;">
                    <label style="font-size: 0.85rem; font-weight: 900; color: #0f172a; display: block; margin-bottom: 0.35rem;">
                        Cantidad a Descontar (${unit}) *:
                    </label>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <input type="number" 
                               id="egressModalQtyField" 
                               class="form-control" 
                               value="1" 
                               min="${step}" 
                               step="${step}" 
                               style="height: 48px; font-size: 1.4rem; font-weight: 900; text-align: center; border: 2px solid #2563eb; border-radius: 0.65rem;"
                               required autofocus>
                    </div>
                    <small style="color: #64748b; font-size: 0.75rem; display: block; margin-top: 0.35rem;">
                        💡 Presiona <strong>Enter</strong> para confirmar. Si vuelves a pistolear el código, se sumará +1 automáticamente.
                    </small>
                </div>

                <div style="display: flex; gap: 0.75rem;">
                    <button type="button" class="btn btn-secondary" onclick="InventoryView.closeQuantityModal()" style="flex: 1; padding: 0.65rem; font-weight: 800; border-radius: 0.65rem;">
                        Cancelar (Esc)
                    </button>
                    <button type="submit" class="btn btn-primary" style="flex: 2; padding: 0.65rem; font-weight: 900; border-radius: 0.65rem; background: #2563eb;">
                        ✓ Agregar a la Lista (Enter)
                    </button>
                </div>
            </form>
        `;

        showModal(content, { title: 'Ingresar Cantidad', width: '420px', showCloseButton: true });

        setTimeout(() => {
            const qtyInput = document.getElementById('egressModalQtyField');
            if (qtyInput) {
                qtyInput.focus();
                qtyInput.select();
            }
            this.setupQuantityModalKeyListeners(product);
        }, 100);
    },

    setupQuantityModalKeyListeners(product) {
        let lastBarcodeScanned = '';
        let lastKeyTime = 0;

        const onKeydown = (e) => {
            const qtyInput = document.getElementById('egressModalQtyField');
            if (!qtyInput) {
                window.removeEventListener('keydown', onKeydown);
                return;
            }

            const now = Date.now();
            if (now - lastKeyTime > 100) {
                lastBarcodeScanned = '';
            }
            lastKeyTime = now;

            if (e.key === 'Enter') {
                if (lastBarcodeScanned.length >= 3) {
                    if (lastBarcodeScanned === product.barcode) {
                        e.preventDefault();
                        const current = parseFloat(qtyInput.value) || 0;
                        qtyInput.value = current + 1;
                        qtyInput.select();
                        lastBarcodeScanned = '';
                        showNotification(`+1 ${product.name} (Cantidad: ${qtyInput.value})`, 'info');
                        return;
                    }
                }
            } else if (e.key.length === 1) {
                lastBarcodeScanned += e.key;
            }
        };

        window._egressQtyKeydown = onKeydown;
        window.addEventListener('keydown', onKeydown);
    },

    closeQuantityModal() {
        if (window._egressQtyKeydown) {
            window.removeEventListener('keydown', window._egressQtyKeydown);
            window._egressQtyKeydown = null;
        }
        this._egressModalActiveProduct = null;
        this.openEgressEntryModal();
    },

    confirmAddProductFromModal() {
        const product = this._egressModalActiveProduct;
        if (!product) return;

        const qtyInput = document.getElementById('egressModalQtyField');
        const barcodeInput = document.getElementById('egressModalBarcodeField');
        const qty = parseFloat(qtyInput ? qtyInput.value : 1);

        if (isNaN(qty) || qty <= 0) {
            showNotification('Ingresa una cantidad válida mayor a 0', 'warning');
            return;
        }

        const newBarcode = barcodeInput ? barcodeInput.value.trim() : (product.barcode || '');

        if (window._egressQtyKeydown) {
            window.removeEventListener('keydown', window._egressQtyKeydown);
            window._egressQtyKeydown = null;
        }

        const existing = this.egressCart.find(i => i.id === product.id);
        if (existing) {
            existing.quantity = Math.round((existing.quantity + qty) * 1000) / 1000;
            if (newBarcode) existing.barcode = newBarcode;
        } else {
            this.egressCart.push({
                id: product.id,
                name: product.name,
                barcode: newBarcode,
                stock: product.stock,
                type: product.type || 'unit',
                quantity: qty,
                cost: parseFloat(product.cost) || 0
            });
        }

        this.saveEgressDraft();
        this._egressModalActiveProduct = null;

        this.openEgressEntryModal();
        showNotification(`✓ ${product.name} agregado (${qty} ${product.type === 'weight' ? 'kg' : 'un'})`, 'success');
    },

    handleEgressModalSearch(val) {
        const query = (val || '').toLowerCase().trim();
        const results = document.getElementById('egressModalSearchResults');
        if (!results) return;

        if (query.length < 2) {
            results.style.display = 'none';
            results.innerHTML = '';
            return;
        }

        const exactBarcodeMatch = (this.allProducts || []).find(p => (p.barcode || '').trim().toLowerCase() === query);
        if (exactBarcodeMatch) {
            results.style.display = 'none';
            this.openEgressQuantityModal(exactBarcodeMatch);
            return;
        }

        const matches = (this.allProducts || []).filter(p => 
            (p.name || '').toLowerCase().includes(query) || 
            (p.barcode || '').toLowerCase().includes(query) ||
            (p.category || '').toLowerCase().includes(query)
        ).slice(0, 8);

        if (matches.length === 0) {
            results.innerHTML = '<div style="padding: 0.75rem; color: #64748b; font-size: 0.85rem; text-align: center;">No se encontraron productos</div>';
            results.style.display = 'block';
            return;
        }

        results.innerHTML = matches.map((p, idx) => `
            <div class="egress-search-item ${idx === 0 ? 'selected' : ''}" 
                 data-product-id="${p.id}"
                 onclick="InventoryView.selectProductFromModalSearch(${p.id})"
                 style="padding: 0.65rem 0.85rem; cursor: pointer; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; background: ${idx === 0 ? '#f1f5f9' : 'white'};">
                <div>
                    <strong style="color: #0f172a; font-size: 0.9rem;">${safeHTML(p.name)}</strong>
                    <div style="font-size: 0.75rem; color: #64748b; font-family: monospace;">
                        Cód: ${safeHTML(p.barcode || 'S/N')} • <span style="background: #e2e8f0; color: #334155; padding: 0.05rem 0.35rem; border-radius: 0.25rem;">${safeHTML(p.category || 'General')}</span>
                    </div>
                </div>
                <div style="text-align: right; font-size: 0.85rem; font-weight: 800; color: #2563eb;">
                    Stock: ${p.stock} ${p.type === 'weight' ? 'kg' : 'un'}
                </div>
            </div>
        `).join('');
        results.style.display = 'block';
    },

    selectProductFromModalSearch(productId) {
        const results = document.getElementById('egressModalSearchResults');
        const input = document.getElementById('egressModalSearchInput');
        if (results) results.style.display = 'none';
        if (input) input.value = '';

        const product = (this.allProducts || []).find(p => p.id === productId);
        if (product) {
            this.openEgressQuantityModal(product);
        }
    },

    setupEgressModalSearchListeners() {
        const input = document.getElementById('egressModalSearchInput');
        const results = document.getElementById('egressModalSearchResults');
        if (!input || !results) return;

        input.onkeydown = (e) => {
            const items = results.querySelectorAll('.egress-search-item');
            const visible = results.style.display !== 'none' && items.length > 0;
            let selectedIdx = -1;
            items.forEach((it, i) => { if (it.classList.contains('selected')) selectedIdx = i; });

            if (e.key === 'Escape') {
                results.style.display = 'none';
                return;
            }
            if (e.key === 'ArrowDown' && visible) {
                e.preventDefault();
                const next = (selectedIdx + 1) % items.length;
                this.highlightModalSearchResult(next);
                return;
            }
            if (e.key === 'ArrowUp' && visible) {
                e.preventDefault();
                const prev = (selectedIdx <= 0 ? items.length - 1 : selectedIdx - 1);
                this.highlightModalSearchResult(prev);
                return;
            }
            if (e.key === 'Enter' && visible) {
                e.preventDefault();
                const sel = selectedIdx >= 0 ? items[selectedIdx] : items[0];
                const id = sel && sel.dataset.productId;
                if (id) this.selectProductFromModalSearch(parseInt(id, 10));
                return;
            }
        };
    },

    highlightModalSearchResult(idx) {
        const results = document.getElementById('egressModalSearchResults');
        if (!results) return;
        const items = results.querySelectorAll('.egress-search-item');
        items.forEach((it, i) => {
            if (i === idx) {
                it.classList.add('selected');
                it.style.background = '#f1f5f9';
            } else {
                it.classList.remove('selected');
                it.style.background = 'white';
            }
        });
    },

    // --- G. AUTORIZACIÓN Y GUARDADO DE BAJA / CONSUMO ---
    async submitEgressCart(type) {
        if (!this.egressCart || this.egressCart.length === 0) {
            showNotification('Agrega al menos un producto a la lista', 'warning');
            return;
        }

        const reasonInp = document.getElementById('egressReasonInput');
        const reason = (reasonInp?.value || this.egressReason || '').trim() || (type === 'loss' ? 'Pérdida / Merma de mercadería' : 'Consumo del local / uso interno');

        // REGLA: Dueño/Administrador no requiere ingresar PIN
        const currentRole = (typeof AuthManager !== 'undefined' && AuthManager.getCurrentUserRole)
            ? AuthManager.getCurrentUserRole()
            : (localStorage.getItem('USER_ROLE') || 'cashier');
        const isOwnerOrAdmin = ['owner', 'admin', 'partner', 'propietario', 'administrador'].includes(String(currentRole).toLowerCase().trim());

        let supervisorName = 'Dueño / Administrador';

        if (!isOwnerOrAdmin) {
            const auth = await SupervisorAuth.requireAuth({
                title: `Autorización: ${type === 'loss' ? 'Registro de Pérdida / Merma' : 'Registro de Consumo del Local'}`,
                message: `El registro de ${this.egressCart.length} producto(s) descontará unidades del inventario físico. Ingrese el PIN de Supervisor para autorizar.`
            });
            if (!auth.authorized) {
                showNotification('❌ Operación cancelada o no autorizada.', 'warning');
                return;
            }
            supervisorName = auth.supervisorName;
        }

        const auditReason = `${reason} (Autorizado por: ${supervisorName})`;

        try {
            await StockService.applyBulkAdjustmentAtomic(this.egressCart, type, auditReason);

            if (typeof AuditLogService !== 'undefined') {
                await AuditLogService.log({
                    entity: 'product_stock',
                    entityId: null,
                    action: type === 'loss' ? 'REGISTER_LOSS_BULK' : 'REGISTER_CONSUMPTION_BULK',
                    summary: `${type === 'loss' ? 'Pérdida/Merma' : 'Consumo'} de ${this.egressCart.length} productos. Motivo: ${reason}. Autorizado por: ${supervisorName}`,
                    metadata: { count: this.egressCart.length, type, reason, authorizedBy: supervisorName }
                });
            }

            const countSaved = this.egressCart.length;
            this.clearEgressDraft();
            this.egressCart = [];
            this.egressReason = '';

            closeModal();
            showNotification(`✅ ${countSaved} producto(s) asignados correctamente a ${type === 'loss' ? 'Pérdidas' : 'Consumo del Local'}`, 'success');

            await this.refreshData();
            if (this.currentSection === 'egress') {
                this.switchSection('egress');
            }
        } catch (error) {
            showNotification('Error al guardar: ' + error.message, 'error');
        }
    },

    // --- H. ANULACIÓN AUDITADA CON REVERSIÓN ATÓMICA DE STOCK ---
    async promptCancelMovement(id, type) {
        const movement = await StockMovement.getById(id);
        if (!movement) {
            showNotification('El registro no fue encontrado', 'error');
            return;
        }

        if (movement.status === 'cancelled') {
            showNotification('Este registro ya se encuentra anulado', 'warning');
            return;
        }

        const p = (this.allProducts || []).find(prod => prod.id === movement.productId);
        const name = p ? p.name : (movement.productName || 'Producto');
        const qty = Math.abs(movement.quantity);
        const unit = p && p.type === 'weight' ? 'kg' : 'un';
        const isLoss = type === 'loss';

        const content = `
            <div style="text-align: center; margin-bottom: 1.25rem;">
                <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">${isLoss ? '🗑️' : '🍽️'}</div>
                <h3 style="color: #dc2626; font-size: 1.25rem; font-weight: 900; margin: 0 0 0.5rem 0;">
                    ¿Anular ${isLoss ? 'Pérdida de Mercadería' : 'Consumo del Local'}?
                </h3>
                <p style="color: #475569; font-size: 0.95rem; margin: 0;">
                    Producto: <strong style="color: #0f172a;">${safeHTML(name)}</strong> (-${qty} ${unit})
                </p>
            </div>

            <div style="background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 0.75rem; padding: 0.85rem; margin-bottom: 1.25rem; font-size: 0.85rem; color: #166534;">
                <strong>✅ Reversión Automática de Stock:</strong>
                Al confirmar, se devolverán automáticamente <strong>+${qty} ${unit}</strong> a tu inventario disponible y el registro quedará marcado como <strong>ANULADO</strong> en la auditoría sin borrarse.
            </div>

            <form id="cancelReasonForm" onsubmit="event.preventDefault(); InventoryView.confirmCancelMovement(${id}, '${type}');">
                <div class="form-group" style="margin-bottom: 1.25rem; text-align: left;">
                    <label style="font-size: 0.82rem; font-weight: 800; color: #334155; display: block; margin-bottom: 0.35rem;">
                        Motivo de la anulación (opcional):
                    </label>
                    <input type="text" 
                           id="cancelReasonInput" 
                           class="form-control" 
                           placeholder="Ej: Error de digitación, producto no se consumió..."
                           value="Error de digitación / Reversión autorizada"
                           style="height: 42px; font-size: 0.9rem; border: 1.5px solid #cbd5e1; border-radius: 0.6rem;" 
                           autofocus>
                </div>

                <div style="display: flex; gap: 0.75rem;">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()" style="flex: 1; padding: 0.65rem; font-weight: 800; border-radius: 0.65rem;">
                        No, Volver (Esc)
                    </button>
                    <button type="submit" class="btn btn-danger" style="flex: 2; padding: 0.65rem; font-weight: 900; border-radius: 0.65rem; background: #dc2626;">
                        🚫 Confirmar y Devolver Stock
                    </button>
                </div>
            </form>
        `;

        showModal(content, { title: 'Confirmar Anulación', width: '480px' });

        setTimeout(() => {
            const input = document.getElementById('cancelReasonInput');
            if (input) {
                input.focus();
                input.select();
            }
        }, 100);
    },

    async confirmCancelMovement(id, type) {
        const movement = await StockMovement.getById(id);
        if (!movement || movement.status === 'cancelled') {
            closeModal();
            return;
        }

        const reasonInput = document.getElementById('cancelReasonInput');
        const reason = (reasonInput?.value || '').trim() || 'Anulado por usuario / corrección';

        const currentRole = (typeof AuthManager !== 'undefined' && AuthManager.getCurrentUserRole)
            ? AuthManager.getCurrentUserRole()
            : (localStorage.getItem('USER_ROLE') || 'cashier');
        const isOwnerOrAdmin = ['owner', 'admin', 'partner', 'propietario', 'administrador'].includes(String(currentRole).toLowerCase().trim());

        let supervisorName = 'Dueño / Administrador';

        if (!isOwnerOrAdmin) {
            const auth = await SupervisorAuth.requireAuth({
                title: `Autorización: Anulación de ${type === 'loss' ? 'Merma / Pérdida' : 'Consumo'}`,
                message: `Anular este registro devolverá ${Math.abs(movement.quantity)} unidades al inventario. Ingrese el PIN de Supervisor para autorizar.`
            });
            if (!auth.authorized) {
                showNotification('❌ Anulación cancelada o no autorizada.', 'warning');
                return;
            }
            supervisorName = auth.supervisorName;
        }

        closeModal();

        try {
            let currentUserName = supervisorName;
            try {
                if (typeof AuthManager !== 'undefined' && AuthManager.getCurrentUser) {
                    const u = AuthManager.getCurrentUser();
                    if (u) currentUserName = u.name || u.username;
                }
            } catch (_) {}

            const qtyToReturn = Math.abs(movement.quantity);
            const p = (this.allProducts || []).find(prod => prod.id === movement.productId);
            const unit = p && p.type === 'weight' ? 'kg' : 'un';

            // 1. Devolver stock atómicamente
            await StockService.createAdjustment(movement.productId, qtyToReturn, `Reversión por anulación de ${type === 'loss' ? 'pérdida' : 'consumo'}: ${reason} (Autorizado por: ${supervisorName})`);

            // 2. Marcar movimiento como cancelado manteniendo trazabilidad
            await StockMovement.update(id, {
                status: 'cancelled',
                cancelledAt: new Date().toISOString(),
                cancelledBy: `${currentUserName} (Autorizado por: ${supervisorName})`,
                cancelReason: reason
            });

            if (typeof AuditLogService !== 'undefined') {
                await AuditLogService.log({
                    entity: 'stock_movement',
                    entityId: id,
                    action: 'CANCEL_STOCK_MOVEMENT',
                    summary: `Anulación de ${type === 'loss' ? 'merma' : 'consumo'} (#${id}) reintegrando +${qtyToReturn} ${unit} a producto #${movement.productId}. Motivo: ${reason}. Autorizado por: ${supervisorName}`,
                    metadata: { movementId: id, productId: movement.productId, qty: qtyToReturn, type, authorizedBy: supervisorName }
                });
            }

            showNotification(`✅ Registro anulado. Se reintegraron +${qtyToReturn} ${unit} al inventario.`, 'success');
            await this.refreshData();
            if (this.currentSection === 'egress') {
                this.switchSection('egress');
            }
        } catch (error) {
            showNotification('Error al anular registro: ' + error.message, 'error');
        }
    },

    // Compatibilidad retroactiva
    switchEgressSubTab(subTab) {
        if (subTab === 'losses') this.setEgressFilter('loss');
        else if (subTab === 'consumptions') this.setEgressFilter('consumption');
        else this.openEgressEntryModal();
    },


    // =========================================================================
    // 6. SECCIÓN 3: CONTEO FÍSICO / TOMA DE INVENTARIO (DISEÑO BLANCO EJECUTIVO)
    // =========================================================================

    auditModeTab: 'category', // 'category' | 'quick'
    auditDropdownHighlightedIndex: -1,

    renderAuditSection() {
        if (!this.auditState) {
            const categories = this.categories || [];
            const historyHtml = (this.auditHistory || []).map((log, idx) => {
                const loss = log.metadata?.lossMoney || 0;
                const extra = log.metadata?.extraMoney || 0;
                const dest = log.metadata?.destinationLabel || (log.metadata?.destination === 'loss' ? 'Pérdida/Merma' : log.metadata?.destination === 'consumption' ? 'Consumo' : 'Ajuste Regular');
                return `
                    <div onclick="InventoryView.openAuditHistoryDetail(${idx})"
                         style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 0.75rem; padding: 0.85rem 1rem; margin-bottom: 0.65rem; cursor: pointer; transition: all 0.2s;"
                         onmouseover="this.style.borderColor='#3b82f6'; this.style.transform='translateY(-2px)';"
                         onmouseout="this.style.borderColor='#e2e8f0'; this.style.transform='translateY(0)';">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="display: flex; align-items: center; gap: 0.5rem;">
                                    <strong style="color: #0f172a; font-size: 0.92rem;">${safeHTML(log.metadata?.categoryName || 'Control')}</strong>
                                    <span style="font-size: 0.68rem; font-weight: 800; padding: 0.15rem 0.45rem; border-radius: 999px; background: ${log.metadata?.destination === 'loss' ? '#fee2e2; color: #dc2626;' : log.metadata?.destination === 'consumption' ? '#fef3c7; color: #b45309;' : '#eff6ff; color: #2563eb;'}">
                                        ${dest}
                                    </span>
                                </div>
                                <small style="color: #64748b; display: block; font-size: 0.76rem; margin-top: 0.15rem;">${formatDateTime(log.timestamp)} • ${log.metadata?.itemsCounted || 0} ítems</small>
                            </div>
                            <div style="text-align: right;">
                                ${loss > 0 ? `<div style="color: #dc2626; font-weight: 900; font-size: 0.9rem;">-${formatCLP(loss)}</div>` : ''}
                                ${extra > 0 ? `<div style="color: #16a34a; font-weight: 900; font-size: 0.9rem;">+${formatCLP(extra)}</div>` : ''}
                                ${loss === 0 && extra === 0 ? '<div style="color: #16a34a; font-weight: 900; font-size: 0.82rem;">✅ Cuadrado</div>' : ''}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <div class="card" style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 1.25rem; padding: 2rem;">
                    <div style="text-align: center; max-width: 800px; margin: 0 auto 2rem auto;">
                        <div style="font-size: 2.8rem; margin-bottom: 0.35rem;">📋</div>
                        <h2 style="font-size: 1.75rem; font-weight: 900; color: #0f172a; margin: 0;">Conteo Físico de Mercadería en Local</h2>
                        <p style="color: #64748b; font-size: 0.95rem; margin-top: 0.25rem;">Cuenta los productos reales en tus estantes o pasillos y sincroniza el stock en minutos.</p>
                    </div>

                    <!-- Selector de Modo de Conteo -->
                    <div style="display: flex; justify-content: center; gap: 0.75rem; margin-bottom: 2rem;">
                        <button type="button" 
                                onclick="InventoryView.setAuditModeTab('category')"
                                style="padding: 0.75rem 1.5rem; border-radius: 0.75rem; font-weight: 800; font-size: 0.95rem; cursor: pointer; transition: all 0.2s; border: 2px solid ${this.auditModeTab !== 'quick' ? '#2563eb' : '#e2e8f0'}; background: ${this.auditModeTab !== 'quick' ? '#eff6ff' : '#ffffff'}; color: ${this.auditModeTab !== 'quick' ? '#1d4ed8' : '#64748b'};">
                            📁 Conteo por Categoría Completa
                        </button>
                        <button type="button" 
                                onclick="InventoryView.setAuditModeTab('quick')"
                                style="padding: 0.75rem 1.5rem; border-radius: 0.75rem; font-weight: 800; font-size: 0.95rem; cursor: pointer; transition: all 0.2s; border: 2px solid ${this.auditModeTab === 'quick' ? '#2563eb' : '#e2e8f0'}; background: ${this.auditModeTab === 'quick' ? '#eff6ff' : '#ffffff'}; color: ${this.auditModeTab === 'quick' ? '#1d4ed8' : '#64748b'};">
                            ⚡ Conteo Rápido / Libre (Estantería o Pasillo)
                        </button>
                    </div>

                    <div style="display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 2rem; max-width: 1050px; margin: 0 auto;">
                        <!-- Columna Izquierda: Configuración según modo -->
                        <div>
                            ${this.auditModeTab !== 'quick' ? `
                                <!-- MODO 1: CATEGORÍA COMPLETA -->
                                <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 1rem; padding: 1.25rem; margin-bottom: 1.25rem;">
                                    <h4 style="color: #2563eb; margin: 0 0 0.5rem 0; font-size: 0.88rem; font-weight: 900; text-transform: uppercase;">
                                        Auditoría por Categoría:
                                    </h4>
                                    <ol style="color: #475569; font-size: 0.85rem; line-height: 1.5; margin: 0; padding-left: 1.25rem;">
                                        <li>Elige la categoría a auditar (ej: Bebidas, Lácteos).</li>
                                        <li>Ingresa o pistolea la cantidad física real de cada artículo.</li>
                                        <li>Al terminar, asigna los faltantes a Pérdida/Merma o Consumo.</li>
                                    </ol>
                                </div>

                                <div class="form-group" style="margin-bottom: 1.25rem; position: relative;">
                                    <label style="font-size: 0.85rem; font-weight: 800; color: #334155; display: block; margin-bottom: 0.5rem;">
                                        Selecciona la Categoría a Contar:
                                    </label>
                                    
                                    <!-- Buscador / Desplegable Scrollable con Teclado -->
                                    <div style="position: relative;">
                                        <input type="text" 
                                               id="auditCategorySearch" 
                                               class="form-control" 
                                               placeholder="🔍 Escribe para buscar categoría (o flechas ↑↓)..." 
                                               autocomplete="off"
                                               onfocus="InventoryView.toggleAuditCategoryDropdown(true)"
                                               oninput="InventoryView.filterAuditCategoryDropdown(this.value)"
                                               onkeydown="InventoryView.handleAuditCategoryKeydown(event)"
                                               style="height: 48px; font-size: 1rem; font-weight: 700; border-radius: 0.75rem; border: 2px solid #3b82f6; padding: 0 1rem;">
                                        <input type="hidden" id="auditCategorySelectedValue" value="">
                                        
                                        <!-- Menú Desplegable con Scroll Máximo -->
                                        <div id="auditCategoryDropdownMenu" 
                                             style="display: none; position: absolute; top: calc(100% + 4px); left: 0; right: 0; max-height: 220px; overflow-y: auto; background: #ffffff; border: 1.5px solid #3b82f6; border-radius: 0.75rem; box-shadow: 0 10px 25px rgba(0,0,0,0.12); z-index: 1000;">
                                            ${categories.map((c, i) => {
                                                const count = (this.allProducts || []).filter(p => (p.category || 'General') === c).length;
                                                return `
                                                    <div class="audit-cat-item" 
                                                         data-cat="${safeHTML(c)}" 
                                                         data-index="${i}"
                                                         onclick="InventoryView.selectAuditCategory('${safeHTML(c)}')"
                                                         style="padding: 0.7rem 1rem; border-bottom: 1px solid #f1f5f9; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.15s;"
                                                         onmouseover="InventoryView.highlightAuditCatItem(${i})">
                                                        <span style="font-weight: 700; color: #0f172a; font-size: 0.95rem;">${safeHTML(c)}</span>
                                                        <span style="font-size: 0.75rem; font-weight: 800; background: #f1f5f9; color: #475569; padding: 0.2rem 0.5rem; border-radius: 999px;">${count} productos</span>
                                                    </div>
                                                `;
                                            }).join('')}
                                        </div>
                                    </div>
                                </div>

                                <button class="btn btn-primary" onclick="InventoryView.startCategoryAudit()" style="width: 100%; height: 50px; font-size: 1.05rem; font-weight: 900; border-radius: 0.75rem; background: #2563eb; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                                    <span>🚀</span> Iniciar Conteo de Categoría
                                </button>
                            ` : `
                                <!-- MODO 2: CONTEO RÁPIDO / LIBRE -->
                                <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 1rem; padding: 1.25rem; margin-bottom: 1.25rem;">
                                    <h4 style="color: #2563eb; margin: 0 0 0.5rem 0; font-size: 0.88rem; font-weight: 900; text-transform: uppercase;">
                                        ⚡ Conteo Rápido / Libre por Estantería:
                                    </h4>
                                    <p style="color: #475569; font-size: 0.85rem; line-height: 1.5; margin: 0 0 0.75rem 0;">
                                        Ideal para auditar un pasillo o góndola con productos de distintas categorías sin necesidad de revisar todo el catálogo.
                                    </p>
                                    <ul style="color: #475569; font-size: 0.85rem; line-height: 1.5; margin: 0; padding-left: 1.25rem;">
                                        <li>Pistolea directamente los productos que encuentres.</li>
                                        <li>Cada pistoleo sumará automáticamente +1 a la cuenta.</li>
                                        <li>Al finalizar, compara las cantidades reales vs lo esperado en sistema.</li>
                                    </ul>
                                </div>

                                <div class="form-group" style="margin-bottom: 1.25rem;">
                                    <label style="font-size: 0.85rem; font-weight: 800; color: #334155; display: block; margin-bottom: 0.5rem;">
                                        Nombre / Identificador de la Sesión (Opcional):
                                    </label>
                                    <input type="text" 
                                           id="quickAuditSessionName" 
                                           class="form-control" 
                                           placeholder="Ej: Pasillo 2, Góndola Principal, Refrigerador 1..." 
                                           style="height: 48px; font-size: 1rem; font-weight: 700; border-radius: 0.75rem; border: 2px solid #3b82f6; padding: 0 1rem;">
                                </div>

                                <button class="btn btn-primary" onclick="InventoryView.startQuickAudit()" style="width: 100%; height: 50px; font-size: 1.05rem; font-weight: 900; border-radius: 0.75rem; background: #059669; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                                    <span>⚡</span> Iniciar Conteo Rápido Libre
                                </button>
                            `}
                        </div>

                        <!-- Columna Derecha: Controles Previos -->
                        <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 1rem; padding: 1.25rem;">
                            <h4 style="color: #475569; margin: 0 0 1rem 0; font-size: 0.85rem; font-weight: 900; text-transform: uppercase;">
                                🕒 Controles Anteriores Realizados
                            </h4>
                            <div style="max-height: 290px; overflow-y: auto;">
                                ${historyHtml || '<div style="padding: 2.5rem 1rem; text-align: center; color: #94a3b8; font-size: 0.85rem;">Aún no hay controles finalizados</div>'}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // Modo Conteo en Vivo
        if (this.auditState.status === 'counting') {
            const uncounted = this.auditState.items.filter(i => !i.counted).length;
            const total = this.auditState.items.length;
            const progress = total > 0 ? ((total - uncounted) / total * 100) : 0;

            return `
                <div class="card" style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 1.25rem; padding: 1.5rem;">
                    <!-- Cabecera del Conteo en Vivo -->
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #f1f5f9; padding-bottom: 1rem; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
                        <div>
                            <h2 style="margin: 0; color: #0f172a; font-size: 1.35rem; font-weight: 900; display: flex; align-items: center; gap: 0.5rem;">
                                <span>${this.auditState.mode === 'quick' ? '⚡' : '📦'}</span> Conteo en Vivo: ${safeHTML(this.auditState.categoryName)}
                            </h2>
                            <div style="font-size: 0.82rem; color: #64748b; margin-top: 0.2rem;">
                                Progreso: ${total - uncounted} de ${total} productos contados (${progress.toFixed(0)}%)
                            </div>
                        </div>

                        <div style="display: flex; gap: 0.6rem;">
                            <button class="btn btn-secondary" onclick="InventoryView.cancelAudit()" style="font-weight: 800; border-radius: 0.6rem;">
                                Abandonar Conteo
                            </button>
                            <button class="btn btn-primary" onclick="InventoryView.finishAudit()" style="font-weight: 900; background: #2563eb; border-radius: 0.6rem; padding: 0.5rem 1.2rem;">
                                📊 Finalizar y Ver Reporte
                            </button>
                        </div>
                    </div>

                    <!-- Barra Unificada de Búsqueda y Pistoleo -->
                    <div style="background: #eff6ff; border: 2px solid #3b82f6; border-radius: 0.85rem; padding: 0.85rem 1.25rem; margin-bottom: 1.25rem; position: relative;">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <span style="font-size: 1.4rem;">🔍</span>
                            <input type="text" 
                                   id="auditBarcodeScanInput" 
                                   placeholder="Pistolea código de barras o escribe el nombre del producto..." 
                                   class="form-control" 
                                   autocomplete="off"
                                   style="height: 46px; font-size: 1rem; font-weight: 700; border-radius: 0.65rem; border: 1.5px solid #3b82f6; background: #ffffff; padding-left: 0.85rem;"
                                   oninput="InventoryView.filterQuickAddProducts(this.value)"
                                   onkeydown="if(event.key === 'Enter') { event.preventDefault(); InventoryView.handleBarcodeAuditScan(this.value); }">
                        </div>
                        <div id="quickAuditProductResults" 
                             style="display: none; position: absolute; top: calc(100% + 4px); left: 1.25rem; right: 1.25rem; max-height: 250px; overflow-y: auto; background: #ffffff; border: 1.5px solid #3b82f6; border-radius: 0.65rem; box-shadow: 0 10px 25px rgba(0,0,0,0.18); z-index: 1050;">
                        </div>
                    </div>

                    <!-- Tabla de Conteo Físico -->
                    <div style="max-height: 52vh; overflow-y: auto; border: 1.5px solid #e2e8f0; border-radius: 0.75rem;">
                        <table style="width: 100%; border-collapse: collapse; text-align: left;">
                            <thead style="position: sticky; top: 0; background: #f8fafc; border-bottom: 2px solid #cbd5e1; z-index: 10;">
                                <tr style="font-size: 0.72rem; text-transform: uppercase; color: #475569; font-weight: 900;">
                                    <th style="padding: 0.65rem 0.75rem;">Producto</th>
                                    <th style="padding: 0.65rem 0.75rem; text-align: center;">Stock Sistema</th>
                                    <th style="padding: 0.65rem 0.75rem; text-align: center;">Conteo Físico Real</th>
                                    <th style="padding: 0.65rem 0.75rem; text-align: center;">Ajuste (− / +)</th>
                                    <th style="padding: 0.65rem 0.75rem; text-align: center;">Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.auditState.items.length === 0 ? `
                                    <tr>
                                        <td colspan="5" style="text-align: center; padding: 2.5rem; color: #94a3b8; font-size: 0.95rem;">
                                            🔫 Pistolea un código de barras o escribe el nombre del producto arriba para registrar su conteo físico.
                                        </td>
                                    </tr>
                                ` : this.auditState.items.map((item, index) => {
                                    const diff = (item.physicalCount !== null && item.physicalCount !== undefined) ? (item.physicalCount - item.systemStock) : null;
                                    const isWeight = item.type === 'weight';
                                    const step = isWeight ? '0.001' : '1';
                                    return `
                                        <tr id="audit-row-${item.id}" style="border-bottom: 1px solid #e2e8f0; font-size: 0.85rem; ${item.counted ? 'background: #f8fafc;' : ''}">
                                            <td style="padding: 0.65rem 0.75rem;">
                                                <strong style="color: #0f172a; cursor: pointer;" onclick="InventoryView.openItemCountModal(${item.id})" title="Click para abrir conteo en modal">${safeHTML(item.name)}</strong>
                                                <small style="color: #64748b; font-family: monospace; display: block;">Cód: ${safeHTML(item.barcode || 'S/N')}</small>
                                            </td>
                                            <td style="padding: 0.65rem 0.75rem; text-align: center; font-weight: 800; color: #475569; font-size: 1rem;">
                                                ${item.systemStock}
                                            </td>
                                            <td style="padding: 0.65rem 0.75rem; text-align: center; width: 140px;">
                                                <input type="number" 
                                                       step="${step}" 
                                                       min="0"
                                                       class="form-control" 
                                                       value="${item.counted ? item.physicalCount : ''}" 
                                                       placeholder="?"
                                                       oninput="InventoryView.updateAuditPhysicalCount(${item.id}, this.value)" 
                                                       onchange="InventoryView.onAuditRowInputChange(${item.id}, this.value)"
                                                       onkeydown="if(event.key === 'Enter') { event.preventDefault(); InventoryView.focusNextAuditInput(${index}); }"
                                                       style="width: 95px; height: 38px; text-align: center; font-size: 1.1rem; font-weight: 900; border-radius: 0.5rem; border: 2px solid ${item.counted ? '#10b981' : '#cbd5e1'}; margin: 0 auto;">
                                            </td>
                                            <td style="padding: 0.65rem 0.75rem; text-align: center; width: 120px;">
                                                <div style="display: flex; gap: 0.45rem; justify-content: center; align-items: center;">
                                                    <button type="button" 
                                                            onclick="InventoryView.adjustAuditItem(${item.id}, -1)"
                                                            style="width: 32px; height: 32px; background: #fee2e2; border: 1.5px solid #f87171; color: #dc2626; font-weight: 950; font-size: 1.15rem; border-radius: 0.45rem; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1;"
                                                            title="Restar 1 unidad">−</button>
                                                    <button type="button" 
                                                            onclick="InventoryView.adjustAuditItem(${item.id}, 1)"
                                                            style="width: 32px; height: 32px; background: #eff6ff; border: 1.5px solid #60a5fa; color: #2563eb; font-weight: 950; font-size: 1.15rem; border-radius: 0.45rem; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1;"
                                                            title="Sumar 1 unidad">+</button>
                                                </div>
                                            </td>
                                            <td style="padding: 0.65rem 0.75rem; text-align: center;">
                                                ${item.counted ? (diff === 0 
                                                    ? '<span style="background: #dcfce7; color: #15803d; padding: 0.2rem 0.5rem; border-radius: 0.35rem; font-size: 0.72rem; font-weight: 900;">✅ CUADRADO</span>'
                                                    : (diff < 0 
                                                        ? `<span style="background: #fee2e2; color: #dc2626; padding: 0.2rem 0.5rem; border-radius: 0.35rem; font-size: 0.72rem; font-weight: 900;">🚨 FALTAN ${Math.abs(diff)}</span>`
                                                        : `<span style="background: #fef9c3; color: #b45309; padding: 0.2rem 0.5rem; border-radius: 0.35rem; font-size: 0.72rem; font-weight: 900;">📦 SOBRAN +${diff}</span>`))
                                                    : '<span style="color: #94a3b8; font-size: 0.75rem; font-weight: 700;">Pendiente</span>'}
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        // Modo Reporte de Discrepancias y Asignación de Pérdida / Consumo
        if (this.auditState.status === 'report') {
            const missing = this.auditState.items.filter(i => (i.physicalCount || 0) < i.systemStock);
            const extra = this.auditState.items.filter(i => (i.physicalCount || 0) > i.systemStock);
            const lossMoney = missing.reduce((sum, i) => sum + ((i.systemStock - (i.physicalCount || 0)) * (parseFloat(i.cost) || 0)), 0);
            const extraMoney = extra.reduce((sum, i) => sum + (((i.physicalCount || 0) - i.systemStock) * (parseFloat(i.cost) || 0)), 0);

            return `
                <div class="card" style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 1.25rem; padding: 2rem;">
                    <div style="text-align: center; margin-bottom: 2rem;">
                        <h2 style="font-size: 1.6rem; font-weight: 900; color: #0f172a; margin: 0;">Resumen del Control: ${safeHTML(this.auditState.categoryName)}</h2>
                        <p style="color: #64748b; font-size: 0.9rem; margin-top: 0.25rem;">Revisa las diferencias y selecciona cómo deseas registrar las mermas o consumos antes de sincronizar.</p>
                    </div>

                    <!-- Tarjetas de Resumen KPI -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.75rem;">
                        <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 0.85rem; padding: 1rem; text-align: center;">
                            <span style="font-size: 0.75rem; font-weight: 800; color: #64748b; text-transform: uppercase;">Total Auditados</span>
                            <div style="font-size: 1.5rem; font-weight: 900; color: #0f172a; margin-top: 0.2rem;">${this.auditState.items.length} productos</div>
                        </div>
                        <div style="background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 0.85rem; padding: 1rem; text-align: center;">
                            <span style="font-size: 0.75rem; font-weight: 800; color: #991b1b; text-transform: uppercase;">🚨 Faltantes (${missing.length})</span>
                            <div style="font-size: 1.5rem; font-weight: 900; color: #dc2626; margin-top: 0.2rem;">-${formatCLP(lossMoney)}</div>
                        </div>
                        <div style="background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 0.85rem; padding: 1rem; text-align: center;">
                            <span style="font-size: 0.75rem; font-weight: 800; color: #166534; text-transform: uppercase;">✅ Sobrantes (${extra.length})</span>
                            <div style="font-size: 1.5rem; font-weight: 900; color: #16a34a; margin-top: 0.2rem;">+${formatCLP(extraMoney)}</div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
                        <!-- Faltantes -->
                        <div style="background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 1rem; padding: 1.25rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                                <strong style="color: #991b1b; font-size: 0.95rem;">🚨 Detalle de Faltantes (${missing.length})</strong>
                                <span style="background: #dc2626; color: white; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.8rem; font-weight: 900;">-${formatCLP(lossMoney)}</span>
                            </div>
                            <div style="max-height: 220px; overflow-y: auto;">
                                ${missing.map(i => {
                                    const diff = i.systemStock - i.physicalCount;
                                    return `
                                        <div style="padding: 0.5rem 0; border-bottom: 1px solid #fee2e2; display: flex; justify-content: space-between; align-items: center;">
                                            <div>
                                                <strong style="color: #0f172a; font-size: 0.85rem;">${safeHTML(i.name)}</strong>
                                                <small style="color: #64748b; display: block;">Real: ${i.physicalCount} vs Sistema: ${i.systemStock}</small>
                                            </div>
                                            <span style="color: #dc2626; font-weight: 900;">-${diff}</span>
                                        </div>
                                    `;
                                }).join('') || '<div style="color: #64748b; font-size: 0.85rem;">No hay productos faltantes</div>'}
                            </div>
                        </div>

                        <!-- Sobrantes -->
                        <div style="background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 1rem; padding: 1.25rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                                <strong style="color: #166534; font-size: 0.95rem;">✅ Detalle de Sobrantes (${extra.length})</strong>
                                <span style="background: #16a34a; color: white; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.8rem; font-weight: 900;">+${formatCLP(extraMoney)}</span>
                            </div>
                            <div style="max-height: 220px; overflow-y: auto;">
                                ${extra.map(i => {
                                    const diff = i.physicalCount - i.systemStock;
                                    return `
                                        <div style="padding: 0.5rem 0; border-bottom: 1px solid #dcfce7; display: flex; justify-content: space-between; align-items: center;">
                                            <div>
                                                <strong style="color: #0f172a; font-size: 0.85rem;">${safeHTML(i.name)}</strong>
                                                <small style="color: #64748b; display: block;">Real: ${i.physicalCount} vs Sistema: ${i.systemStock}</small>
                                            </div>
                                            <span style="color: #16a34a; font-weight: 900;">+${diff}</span>
                                        </div>
                                    `;
                                }).join('') || '<div style="color: #64748b; font-size: 0.85rem;">No hay productos sobrantes</div>'}
                            </div>
                        </div>
                    </div>

                    <!-- Panel de Asignación Contable de las Diferencias -->
                    <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 1rem; padding: 1.25rem;">
                        ${missing.length > 0 ? `
                            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                                <div>
                                    <h4 style="margin: 0; color: #0f172a; font-size: 0.95rem; font-weight: 900;">
                                        ¿A dónde deseas asignar la diferencia de los faltantes?
                                    </h4>
                                    <span style="font-size: 0.82rem; color: #64748b;">
                                        Elige la categoría contable para la merma o consumo detectado:
                                    </span>
                                </div>

                                <div style="display: flex; gap: 0.65rem; flex-wrap: wrap;">
                                    <button class="btn btn-secondary" onclick="InventoryView.backToCounting()" style="font-weight: 800; border-radius: 0.6rem;">
                                        ◀ Volver al Conteo
                                    </button>
                                    <button class="btn" onclick="InventoryView.applyAuditAdjustments('loss')" style="background: #ef4444; color: white; font-weight: 900; border-radius: 0.6rem; padding: 0.6rem 1rem;">
                                        🗑️ Asignar a Pérdida / Merma
                                    </button>
                                    <button class="btn" onclick="InventoryView.applyAuditAdjustments('consumption')" style="background: #f59e0b; color: white; font-weight: 900; border-radius: 0.6rem; padding: 0.6rem 1rem;">
                                        🍽️ Asignar a Consumo del Local
                                    </button>
                                    <button class="btn btn-primary" onclick="InventoryView.applyAuditAdjustments('adjustment')" style="font-weight: 900; background: #2563eb; border-radius: 0.6rem; padding: 0.6rem 1rem;">
                                        ⚖️ Ajuste Regular de Stock
                                    </button>
                                </div>
                            </div>
                        ` : `
                            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                                <span style="font-size: 0.95rem; font-weight: 800; color: #16a34a;">
                                    ✨ ¡No hay faltantes! Todo el stock físico coincide o tiene sobrantes para sincronizar.
                                </span>
                                <div style="display: flex; gap: 0.75rem;">
                                    <button class="btn btn-secondary" onclick="InventoryView.backToCounting()" style="font-weight: 800; border-radius: 0.6rem;">
                                        ◀ Volver al Conteo
                                    </button>
                                    <button class="btn btn-primary" onclick="InventoryView.applyAuditAdjustments('adjustment')" style="font-weight: 900; background: #16a34a; border-radius: 0.6rem; padding: 0.65rem 1.5rem;">
                                        ✅ Sincronizar Stock en Sistema
                                    </button>
                                </div>
                            </div>
                        `}
                    </div>
                </div>
            `;
        }

        return '';
    },

    setAuditModeTab(mode) {
        this.auditModeTab = mode;
        this.switchSection('audit');
    },

    toggleAuditCategoryDropdown(show) {
        const menu = document.getElementById('auditCategoryDropdownMenu');
        if (menu) {
            menu.style.display = show ? 'block' : 'none';
        }
    },

    filterAuditCategoryDropdown(query) {
        const term = (query || '').toLowerCase().trim();
        const items = document.querySelectorAll('.audit-cat-item');
        let visibleCount = 0;
        items.forEach(el => {
            const cat = (el.dataset.cat || '').toLowerCase();
            if (!term || cat.includes(term)) {
                el.style.display = 'flex';
                visibleCount++;
            } else {
                el.style.display = 'none';
            }
        });
        const menu = document.getElementById('auditCategoryDropdownMenu');
        if (menu) menu.style.display = visibleCount > 0 ? 'block' : 'none';
    },

    highlightAuditCatItem(index) {
        const items = Array.from(document.querySelectorAll('.audit-cat-item')).filter(el => el.style.display !== 'none');
        items.forEach((el, i) => {
            el.style.background = (i === index) ? '#eff6ff' : '#ffffff';
        });
        this.auditDropdownHighlightedIndex = index;
    },

    handleAuditCategoryKeydown(event) {
        const menu = document.getElementById('auditCategoryDropdownMenu');
        const items = Array.from(document.querySelectorAll('.audit-cat-item')).filter(el => el.style.display !== 'none');
        if (!items.length) return;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            this.auditDropdownHighlightedIndex = Math.min(items.length - 1, this.auditDropdownHighlightedIndex + 1);
            this.highlightAuditCatItem(this.auditDropdownHighlightedIndex);
            items[this.auditDropdownHighlightedIndex]?.scrollIntoView({ block: 'nearest' });
            if (menu) menu.style.display = 'block';
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            this.auditDropdownHighlightedIndex = Math.max(0, this.auditDropdownHighlightedIndex - 1);
            this.highlightAuditCatItem(this.auditDropdownHighlightedIndex);
            items[this.auditDropdownHighlightedIndex]?.scrollIntoView({ block: 'nearest' });
            if (menu) menu.style.display = 'block';
        } else if (event.key === 'Enter') {
            event.preventDefault();
            if (this.auditDropdownHighlightedIndex >= 0 && items[this.auditDropdownHighlightedIndex]) {
                const cat = items[this.auditDropdownHighlightedIndex].dataset.cat;
                this.selectAuditCategory(cat);
            } else if (items.length > 0) {
                this.selectAuditCategory(items[0].dataset.cat);
            }
        } else if (event.key === 'Escape') {
            this.toggleAuditCategoryDropdown(false);
        }
    },

    selectAuditCategory(catName) {
        const input = document.getElementById('auditCategorySearch');
        const hidden = document.getElementById('auditCategorySelectedValue');
        if (input) input.value = catName;
        if (hidden) hidden.value = catName;
        this.toggleAuditCategoryDropdown(false);
    },

    startCategoryAudit() {
        const hidden = document.getElementById('auditCategorySelectedValue');
        const input = document.getElementById('auditCategorySearch');
        const cat = (hidden && hidden.value) ? hidden.value : (input ? input.value.trim() : '');

        if (!cat) {
            showNotification('Selecciona una categoría para iniciar el conteo', 'warning');
            return;
        }

        const items = (this.allProducts || []).filter(p => (p.category || 'General') === cat).map(p => ({
            id: p.id,
            name: p.name,
            barcode: p.barcode,
            type: p.type || 'unit',
            cost: p.cost,
            category: p.category || 'General',
            systemStock: parseFloat(p.stock) || 0,
            physicalCount: null,
            counted: false
        }));

        if (items.length === 0) {
            showNotification('No hay productos en esta categoría', 'warning');
            return;
        }

        this.auditState = {
            mode: 'category',
            categoryName: cat,
            status: 'counting',
            items: items
        };

        this.switchSection('audit');
    },

    startQuickAudit() {
        const nameInput = document.getElementById('quickAuditSessionName');
        const sessionName = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : 'Conteo Rápido Libre';

        this.auditState = {
            mode: 'quick',
            categoryName: sessionName,
            status: 'counting',
            items: []
        };

        this.switchSection('audit');
    },

    filterQuickAddProducts(query) {
        const box = document.getElementById('quickAuditProductResults');
        if (!box) return;
        const term = (query || '').toLowerCase().trim();
        if (!term) {
            box.style.display = 'none';
            return;
        }

        // Busca indistintamente tanto por nombre como por código de barras
        const matches = (this.allProducts || []).filter(p => {
            if (p.deleted) return false;
            const name = (p.name || '').toLowerCase();
            const barcode = (p.barcode || '').toLowerCase();
            return name.includes(term) || barcode.includes(term);
        }).slice(0, 15);

        if (matches.length === 0) {
            box.innerHTML = '<div style="padding: 0.85rem; color: #64748b; font-size: 0.88rem; text-align: center;">No se encontraron productos coincidentes</div>';
            box.style.display = 'block';
            return;
        }

        box.innerHTML = matches.map(p => `
            <div onclick="InventoryView.selectProductForCountModal(${p.id})" 
                 style="padding: 0.75rem 1rem; border-bottom: 1px solid #f1f5f9; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.15s;"
                 onmouseover="this.style.background='#eff6ff';"
                 onmouseout="this.style.background='#ffffff';">
                <div>
                    <strong style="color: #0f172a; font-size: 0.92rem; display: block;">${safeHTML(p.name)}</strong>
                    <small style="color: #64748b; font-family: monospace; font-size: 0.78rem;">Cód: ${safeHTML(p.barcode || 'Sin código')}</small>
                </div>
                <div style="text-align: right;">
                    <span style="font-size: 0.78rem; font-weight: 850; color: #2563eb; background: #eff6ff; border: 1px solid #bfdbfe; padding: 0.2rem 0.55rem; border-radius: 999px;">
                        Stock Sistema: ${p.stock}
                    </span>
                </div>
            </div>
        `).join('');
        box.style.display = 'block';
    },

    selectProductForCountModal(productId) {
        const box = document.getElementById('quickAuditProductResults');
        if (box) box.style.display = 'none';
        const scanInput = document.getElementById('auditBarcodeScanInput');
        if (scanInput) scanInput.value = '';

        this.openItemCountModal(productId);
    },

    handleBarcodeAuditScan(code) {
        if (!this.auditState || !code) return;
        const trimmed = code.trim();
        if (!trimmed) return;

        const box = document.getElementById('quickAuditProductResults');
        if (box) box.style.display = 'none';

        // 1. Buscar coincidencia exacta por código de barras
        let prod = (this.allProducts || []).find(p => p.barcode && p.barcode.trim() === trimmed);

        // 2. Coincidencia por ID numérico
        if (!prod) {
            prod = (this.allProducts || []).find(p => String(p.id) === trimmed);
        }

        // 3. Coincidencia por nombre único o aproximado
        if (!prod) {
            const lower = trimmed.toLowerCase();
            const matches = (this.allProducts || []).filter(p => !p.deleted && (p.name || '').toLowerCase().includes(lower));
            if (matches.length === 1) {
                prod = matches[0];
            } else if (matches.length > 1) {
                this.filterQuickAddProducts(trimmed);
                return;
            }
        }

        if (prod) {
            const scanInput = document.getElementById('auditBarcodeScanInput');
            if (scanInput) scanInput.value = '';
            this.openItemCountModal(prod.id);
        } else {
            showNotification(`Producto "${trimmed}" no encontrado`, 'warning');
        }
    },

    adjustAuditItem(productId, amount = 1) {
        if (!this.auditState) return;
        const item = this.auditState.items.find(i => i.id === productId);
        if (!item) return;

        let current = (item.physicalCount !== null && item.physicalCount !== undefined) ? item.physicalCount : 0;
        let next = Math.max(0, current + amount);
        item.physicalCount = next;
        item.counted = true;
        this.switchSection('audit');
    },

    openItemCountModal(productId) {
        if (!this.auditState) return;
        let item = this.auditState.items.find(i => i.id === productId);
        let prod = (this.allProducts || []).find(p => p.id === productId);

        if (!item && !prod) return;

        const name = item ? item.name : prod.name;
        const barcode = item ? item.barcode : prod.barcode;
        const systemStock = item ? item.systemStock : (parseFloat(prod.stock) || 0);
        const isWeight = (item ? item.type : prod.type) === 'weight';

        const content = `
            <div style="padding: 0.5rem 1rem; text-align: center;">
                <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1.5px solid #e2e8f0; border-radius: 0.85rem; padding: 1.15rem; margin-bottom: 1.25rem;">
                    <span style="font-size: 2rem; display: block; margin-bottom: 0.35rem;">📦</span>
                    <h3 style="margin: 0; color: #0f172a; font-size: 1.3rem; font-weight: 950; line-height: 1.2;">${safeHTML(name)}</h3>
                    <div style="font-size: 0.85rem; color: #64748b; margin-top: 0.35rem; font-family: monospace;">
                        Cód: <strong>${safeHTML(barcode || 'Sin código')}</strong>
                    </div>
                    <div style="margin-top: 0.75rem; display: inline-flex; align-items: center; gap: 0.5rem; background: #ffffff; padding: 0.35rem 0.85rem; border-radius: 999px; border: 1px solid #cbd5e1;">
                        <span style="font-size: 0.82rem; color: #475569; font-weight: 800; text-transform: uppercase;">Stock en Sistema:</span>
                        <strong style="color: #2563eb; font-size: 1.1rem; font-weight: 950;">${systemStock}</strong>
                    </div>
                </div>

                <div style="margin-bottom: 1.25rem;">
                    <label style="display: block; font-size: 0.95rem; font-weight: 900; color: #0f172a; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px;">
                        ¿Cuántas unidades contaste físicamente?
                    </label>
                    <input type="number" 
                           id="modalCountInput" 
                           value="" 
                           placeholder="Ingresa la cantidad..."
                           step="${isWeight ? '0.001' : '1'}"
                           min="0"
                           style="width: 220px; height: 56px; font-size: 2rem; font-weight: 950; text-align: center; border-radius: 0.75rem; border: 2.5px solid #2563eb; margin: 0 auto; display: block; color: #1e1b4b; box-shadow: 0 4px 14px rgba(37,99,235,0.15);"
                           onkeydown="if(event.key === 'Enter') { event.preventDefault(); InventoryView.saveModalCount(${productId}); }">
                </div>

                <!-- Botones rápidos de suma y borrado -->
                <div style="display: flex; gap: 0.5rem; justify-content: center; margin-bottom: 1.25rem;">
                    <button type="button" class="btn btn-secondary" onclick="InventoryView.modalCountAdd(1)" style="font-weight: 900; font-size: 1.05rem; padding: 0.4rem 0.85rem;">+1</button>
                    <button type="button" class="btn btn-secondary" onclick="InventoryView.modalCountAdd(5)" style="font-weight: 900; font-size: 1.05rem; padding: 0.4rem 0.85rem;">+5</button>
                    <button type="button" class="btn btn-secondary" onclick="InventoryView.modalCountAdd(10)" style="font-weight: 900; font-size: 1.05rem; padding: 0.4rem 0.85rem;">+10</button>
                    <button type="button" class="btn btn-secondary" onclick="InventoryView.modalCountReset()" style="font-weight: 850; font-size: 0.85rem; padding: 0.4rem 0.75rem; color: #dc2626;">Borrar</button>
                </div>

                <div style="display: flex; gap: 0.75rem; justify-content: center;">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()" style="font-weight: 800; padding: 0.6rem 1.25rem; border-radius: 0.6rem;">
                        Cancelar
                    </button>
                    <button type="button" class="btn btn-primary" onclick="InventoryView.saveModalCount(${productId})" style="font-weight: 900; background: #2563eb; padding: 0.6rem 1.5rem; border-radius: 0.6rem; box-shadow: 0 4px 12px rgba(37,99,235,0.3);">
                        ✓ Guardar Conteo
                    </button>
                </div>
            </div>
        `;

        showModal(content, { title: 'Registrar Conteo Físico', width: '480px' });
        setTimeout(() => {
            const input = document.getElementById('modalCountInput');
            if (input) { 
                input.value = '';
                input.focus(); 
            }
        }, 150);
    },

    modalCountAdd(qty) {
        const input = document.getElementById('modalCountInput');
        if (!input) return;
        const current = parseFloat(input.value) || 0;
        input.value = current + qty;
    },

    modalCountReset() {
        const input = document.getElementById('modalCountInput');
        if (input) input.value = '';
    },

    saveModalCount(productId) {
        const input = document.getElementById('modalCountInput');
        if (!input) return;

        const val = input.value.trim();
        if (val === '' || isNaN(parseFloat(val))) {
            showNotification('Por favor ingresa la cantidad contada', 'warning');
            input.focus();
            return;
        }

        const count = Math.max(0, parseFloat(val));
        let item = this.auditState.items.find(i => i.id === productId);

        if (item) {
            item.physicalCount = count;
            item.counted = true;
            showNotification(`Actualizado: ${item.name} (${count} unidades)`, 'success');
        } else {
            const prod = (this.allProducts || []).find(p => p.id === productId);
            if (prod) {
                this.auditState.items.unshift({
                    id: prod.id,
                    name: prod.name,
                    barcode: prod.barcode || '',
                    type: prod.type || 'unit',
                    cost: prod.cost,
                    category: prod.category || 'General',
                    systemStock: parseFloat(prod.stock) || 0,
                    physicalCount: count,
                    counted: true
                });
                showNotification(`Agregado al conteo: ${prod.name} (${count} unidades)`, 'success');
            }
        }

        closeModal();
        this.switchSection('audit');

        setTimeout(() => {
            const row = document.getElementById(`audit-row-${productId}`);
            if (row) {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                row.style.transition = 'background 0.5s';
                row.style.background = '#dcfce7';
                setTimeout(() => { row.style.background = ''; }, 1200);
            }
            const scanInput = document.getElementById('auditBarcodeScanInput');
            if (scanInput) {
                scanInput.value = '';
                scanInput.focus();
            }
        }, 150);
    },

    updateAuditPhysicalCount(productId, val) {
        if (!this.auditState) return;
        const item = this.auditState.items.find(i => i.id === productId);
        if (!item) return;

        if (val === '' || val === null) {
            item.counted = false;
            item.physicalCount = null;
        } else {
            const count = parseFloat(val);
            item.counted = !isNaN(count) && count >= 0;
            item.physicalCount = item.counted ? count : 0;
        }
    },

    onAuditRowInputChange(productId, val) {
        this.updateAuditPhysicalCount(productId, val);
        this.switchSection('audit');
    },

    focusNextAuditInput(currentIndex) {
        const inputs = document.querySelectorAll('#inventory-section-content input[type="number"]');
        if (inputs && inputs[currentIndex + 1]) {
            inputs[currentIndex + 1].focus();
            inputs[currentIndex + 1].select();
        }
    },

    finishAudit() {
        if (!this.auditState) return;
        if (this.auditState.items.length === 0) {
            showNotification('No hay productos en el conteo para finalizar', 'warning');
            return;
        }
        const uncounted = this.auditState.items.filter(i => !i.counted);
        if (uncounted.length > 0) {
            showNotification(`Debes completar el conteo de todos los productos (faltan ${uncounted.length})`, 'warning');
            return;
        }

        this.auditState.status = 'report';
        this.switchSection('audit');
    },

    backToCounting() {
        if (!this.auditState) return;
        this.auditState.status = 'counting';
        this.switchSection('audit');
    },

    cancelAudit() {
        showModal(`
            <div style="text-align: center; padding: 1rem;">
                <p style="font-size: 1rem; margin-bottom: 1.5rem; color: #1e293b;">¿Deseas abandonar el conteo de inventario? Perderás el progreso actual de esta sesión.</p>
                <div style="display: flex; gap: 0.75rem; justify-content: center;">
                    <button class="btn btn-secondary" onclick="closeModal()" style="font-weight: 800;">No, Continuar</button>
                    <button class="btn btn-danger" onclick="InventoryView.performCancelAudit(); closeModal();" style="font-weight: 800;">Sí, Abandonar</button>
                </div>
            </div>
        `, { title: 'Abandonar Conteo', width: '420px' });
    },

    performCancelAudit() {
        this.auditState = null;
        this.switchSection('audit');
    },

    async applyAuditAdjustments(destination = 'adjustment') {
        if (!this.auditState) return;
        const diffs = this.auditState.items.filter(i => (i.physicalCount || 0) !== i.systemStock);

        if (diffs.length === 0) {
            showNotification('✨ ¡Felicidades! Todo tu stock físico cuadró exactamente con el sistema.', 'success');
            this.auditState = null;
            this.switchSection('audit');
            return;
        }

        const missing = this.auditState.items.filter(i => (i.physicalCount || 0) < i.systemStock);
        const extra = this.auditState.items.filter(i => (i.physicalCount || 0) > i.systemStock);
        const lossMoney = missing.reduce((sum, i) => sum + ((i.systemStock - (i.physicalCount || 0)) * (parseFloat(i.cost) || 0)), 0);
        const extraMoney = extra.reduce((sum, i) => sum + (((i.physicalCount || 0) - i.systemStock) * (parseFloat(i.cost) || 0)), 0);

        try {
            const destLabel = destination === 'loss' ? 'Pérdida/Merma' : destination === 'consumption' ? 'Consumo del Local' : 'Ajuste Regular';
            const reasonBase = `Ajuste por Conteo Físico (${destLabel}): ${this.auditState.categoryName}`;

            for (const item of diffs) {
                const delta = (item.physicalCount || 0) - item.systemStock;
                const type = delta < 0 ? (destination === 'consumption' ? 'consumption' : destination === 'loss' ? 'loss' : 'adjustment') : 'adjustment';
                await StockService.setStock(item.id, item.physicalCount || 0, `${reasonBase} (${delta < 0 ? 'Faltante' : 'Sobrante'})`, type);
            }

            // Registrar en historial de auditorías enriquecido
            await AuditLogService.log({
                entity: 'category_audit',
                entityId: 0,
                action: 'finish',
                summary: `Conteo completado: ${this.auditState.categoryName} (${destLabel})`,
                metadata: {
                    categoryName: this.auditState.categoryName,
                    mode: this.auditState.mode || 'category',
                    destination: destination,
                    destinationLabel: destLabel,
                    adjustmentsMade: diffs.length,
                    itemsCounted: this.auditState.items.length,
                    lossMoney: lossMoney,
                    extraMoney: extraMoney,
                    netMoney: extraMoney - lossMoney,
                    missingCount: missing.length,
                    extraCount: extra.length,
                    items: this.auditState.items.map(i => ({
                        id: i.id,
                        name: i.name,
                        barcode: i.barcode || '',
                        category: i.category || '',
                        systemStock: i.systemStock,
                        physicalCount: (i.physicalCount !== null && i.physicalCount !== undefined) ? i.physicalCount : 0,
                        diff: ((i.physicalCount !== null && i.physicalCount !== undefined) ? i.physicalCount : 0) - i.systemStock,
                        cost: parseFloat(i.cost) || 0,
                        diffMoney: (((i.physicalCount !== null && i.physicalCount !== undefined) ? i.physicalCount : 0) - i.systemStock) * (parseFloat(i.cost) || 0)
                    }))
                }
            });

            showNotification(`✅ Sincronización exitosa: se ajustaron ${diffs.length} productos asignados a ${destLabel}.`, 'success');
            this.auditState = null;
            await this.refreshData();
            this.switchSection('audit');
        } catch (error) {
            showNotification('Error al sincronizar ajuste: ' + error.message, 'error');
        }
    },

    openAuditHistoryDetail(idx) {
        const log = this.auditHistory[idx];
        if (!log) return;
        const meta = log.metadata || {};
        const items = meta.items || [];
        const loss = meta.lossMoney || 0;
        const extra = meta.extraMoney || 0;
        const net = meta.netMoney || (extra - loss);
        const dest = meta.destinationLabel || (meta.destination === 'loss' ? 'Pérdida / Merma' : meta.destination === 'consumption' ? 'Consumo del Local' : 'Ajuste Regular');

        const content = `
            <div style="padding: 0.5rem; max-height: 80vh; display: flex; flex-direction: column;">
                <!-- Header informativo -->
                <div style="background: #f8fafc; padding: 1rem 1.25rem; border-radius: 0.75rem; border: 1.5px solid #e2e8f0; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <strong style="font-size: 1.15rem; color: #0f172a;">${safeHTML(meta.categoryName || 'Control de Inventario')}</strong>
                            <span style="font-size: 0.75rem; font-weight: 800; padding: 0.2rem 0.6rem; border-radius: 999px; background: ${meta.destination === 'loss' ? '#fee2e2; color: #dc2626;' : meta.destination === 'consumption' ? '#fef3c7; color: #b45309;' : '#eff6ff; color: #2563eb;'}">
                                ${dest}
                            </span>
                        </div>
                        <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.25rem;">Fecha: ${formatDateTime(log.timestamp)}</div>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-size: 0.82rem; color: #64748b;">Ajustados: <strong>${meta.adjustmentsMade || 0}</strong> de <strong>${meta.itemsCounted || items.length}</strong></span>
                    </div>
                </div>

                <!-- Tarjetas KPI -->
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-bottom: 1rem;">
                    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 0.6rem; padding: 0.75rem; text-align: center;">
                        <span style="font-size: 0.7rem; font-weight: 800; color: #991b1b; text-transform: uppercase;">Total Faltante / Merma</span>
                        <div style="font-size: 1.15rem; font-weight: 900; color: #dc2626; margin-top: 0.15rem;">-${formatCLP(loss)}</div>
                    </div>
                    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 0.6rem; padding: 0.75rem; text-align: center;">
                        <span style="font-size: 0.7rem; font-weight: 800; color: #166534; text-transform: uppercase;">Total Sobrante</span>
                        <div style="font-size: 1.15rem; font-weight: 900; color: #16a34a; margin-top: 0.15rem;">+${formatCLP(extra)}</div>
                    </div>
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.6rem; padding: 0.75rem; text-align: center;">
                        <span style="font-size: 0.7rem; font-weight: 800; color: #475569; text-transform: uppercase;">Impacto Neto</span>
                        <div style="font-size: 1.15rem; font-weight: 900; color: ${net >= 0 ? '#16a34a' : '#dc2626'}; margin-top: 0.15rem;">${net >= 0 ? '+' : ''}${formatCLP(net)}</div>
                    </div>
                </div>

                <!-- Tabla de Productos Auditados -->
                <div style="overflow-y: auto; max-height: 40vh; border: 1px solid #e2e8f0; border-radius: 0.6rem; margin-bottom: 1rem;">
                    <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.82rem;">
                        <thead style="position: sticky; top: 0; background: #f1f5f9; border-bottom: 1.5px solid #cbd5e1;">
                            <tr style="text-transform: uppercase; font-size: 0.68rem; color: #475569; font-weight: 900;">
                                <th style="padding: 0.5rem 0.65rem;">Producto</th>
                                <th style="padding: 0.5rem 0.65rem; text-align: center;">Sistema</th>
                                <th style="padding: 0.5rem 0.65rem; text-align: center;">Conteo Real</th>
                                <th style="padding: 0.5rem 0.65rem; text-align: center;">Diferencia</th>
                                <th style="padding: 0.5rem 0.65rem; text-align: right;">Costo</th>
                                <th style="padding: 0.5rem 0.65rem; text-align: right;">Total $</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.length === 0 ? `
                                <tr><td colspan="6" style="padding: 1.5rem; text-align: center; color: #94a3b8;">No se guardó desglose individual en este registro anterior.</td></tr>
                            ` : items.map(it => {
                                const diff = it.diff || 0;
                                return `
                                    <tr style="border-bottom: 1px solid #f1f5f9;">
                                        <td style="padding: 0.5rem 0.65rem;">
                                            <strong style="color: #0f172a;">${safeHTML(it.name)}</strong>
                                            ${it.barcode ? `<small style="color: #64748b; display: block; font-family: monospace;">${safeHTML(it.barcode)}</small>` : ''}
                                        </td>
                                        <td style="padding: 0.5rem 0.65rem; text-align: center; color: #475569; font-weight: 700;">${it.systemStock}</td>
                                        <td style="padding: 0.5rem 0.65rem; text-align: center; color: #0f172a; font-weight: 800;">${it.physicalCount}</td>
                                        <td style="padding: 0.5rem 0.65rem; text-align: center;">
                                            ${diff === 0 
                                                ? '<span style="color: #16a34a; font-weight: 800;">0 (Cuadrado)</span>' 
                                                : diff < 0 
                                                    ? `<span style="color: #dc2626; font-weight: 900;">-${Math.abs(diff)}</span>`
                                                    : `<span style="color: #16a34a; font-weight: 900;">+${diff}</span>`}
                                        </td>
                                        <td style="padding: 0.5rem 0.65rem; text-align: right; color: #64748b;">${formatCLP(it.cost || 0)}</td>
                                        <td style="padding: 0.5rem 0.65rem; text-align: right; font-weight: 800; color: ${(it.diffMoney || 0) < 0 ? '#dc2626' : (it.diffMoney || 0) > 0 ? '#16a34a' : '#64748b'};">
                                            ${(it.diffMoney || 0) > 0 ? '+' : ''}${formatCLP(it.diffMoney || 0)}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>

                <div style="display: flex; justify-content: flex-end;">
                    <button class="btn btn-secondary" onclick="closeModal()" style="font-weight: 800;">
                        Cerrar
                    </button>
                </div>
            </div>
        `;

        showModal(content, { title: 'Detalle del Conteo Histórico', width: '700px' });
    },

    // =========================================================================
    // 7. SECCIÓN 4: HISTORIAL DE MOVIMIENTOS GENERAL
    // =========================================================================

    setHistoryFilter(type) {
        this.historyTypeFilter = type;
        this.switchSection('history');
    },

    setHistorySearch(query) {
        this.historySearchQuery = (query || '').toLowerCase().trim();
        this.switchSection('history');
    },

    renderHistorySection() {
        let movements = (this.recentMovements || []).slice();
        if (this.historyTypeFilter && this.historyTypeFilter !== 'all') {
            movements = movements.filter(m => m.type === this.historyTypeFilter);
        }
        if (this.historySearchQuery) {
            const q = this.historySearchQuery;
            movements = movements.filter(m => {
                const p = (this.allProducts || []).find(prod => prod.id === m.productId);
                const name = (p ? p.name : (m.productName || '')).toLowerCase();
                const reason = (m.reason || m.reference || '').toLowerCase();
                const user = (m.userName || '').toLowerCase();
                return name.includes(q) || reason.includes(q) || user.includes(q);
            });
        }
        movements = movements.slice(0, 150);

        return `
            <div class="card" style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 1.25rem; padding: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #f1f5f9; padding-bottom: 1rem; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <h3 style="margin: 0; color: #0f172a; font-size: 1.15rem; font-weight: 900; display: flex; align-items: center; gap: 0.4rem;">
                            <span>📜</span> Historial de Movimientos de Stock
                        </h3>
                        <span style="font-size: 0.8rem; color: #64748b;">Trazabilidad completa de ventas, compras, ajustes de catálogo, mermas y bajas.</span>
                    </div>
                    <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                        <input type="text" 
                               value="${typeof safeHTML === 'function' ? safeHTML(this.historySearchQuery || '') : (this.historySearchQuery || '')}" 
                               placeholder="🔍 Buscar producto, motivo o usuario..." 
                               oninput="InventoryView.setHistorySearch(this.value)"
                               style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 0.5rem; padding: 0.45rem 0.75rem; font-size: 0.85rem; min-width: 260px; outline: none;">
                    </div>
                </div>

                <!-- SELECTOR DE FILTRO DE MOVIMIENTOS -->
                <div style="display: flex; gap: 0.4rem; margin-bottom: 1.25rem; overflow-x: auto; padding-bottom: 0.25rem;">
                    <button type="button" class="btn btn-sm ${this.historyTypeFilter === 'all' ? 'btn-primary' : 'btn-secondary'}" onclick="InventoryView.setHistoryFilter('all')" style="font-size: 0.8rem; font-weight: 700; border-radius: 0.5rem; padding: 0.35rem 0.65rem;">Todos</button>
                    <button type="button" class="btn btn-sm ${this.historyTypeFilter === 'adjustment' ? 'btn-primary' : 'btn-secondary'}" onclick="InventoryView.setHistoryFilter('adjustment')" style="font-size: 0.8rem; font-weight: 700; border-radius: 0.5rem; padding: 0.35rem 0.65rem;">⚙️ Ajustes & Bajas</button>
                    <button type="button" class="btn btn-sm ${this.historyTypeFilter === 'sale' ? 'btn-primary' : 'btn-secondary'}" onclick="InventoryView.setHistoryFilter('sale')" style="font-size: 0.8rem; font-weight: 700; border-radius: 0.5rem; padding: 0.35rem 0.65rem;">🛒 Ventas</button>
                    <button type="button" class="btn btn-sm ${this.historyTypeFilter === 'purchase' ? 'btn-primary' : 'btn-secondary'}" onclick="InventoryView.setHistoryFilter('purchase')" style="font-size: 0.8rem; font-weight: 700; border-radius: 0.5rem; padding: 0.35rem 0.65rem;">📦 Compras</button>
                    <button type="button" class="btn btn-sm ${this.historyTypeFilter === 'loss' ? 'btn-primary' : 'btn-secondary'}" onclick="InventoryView.setHistoryFilter('loss')" style="font-size: 0.8rem; font-weight: 700; border-radius: 0.5rem; padding: 0.35rem 0.65rem;">🗑️ Mermas / Pérdidas</button>
                    <button type="button" class="btn btn-sm ${this.historyTypeFilter === 'consumption' ? 'btn-primary' : 'btn-secondary'}" onclick="InventoryView.setHistoryFilter('consumption')" style="font-size: 0.8rem; font-weight: 700; border-radius: 0.5rem; padding: 0.35rem 0.65rem;">🍽️ Consumo Interno</button>
                    <button type="button" class="btn btn-sm ${this.historyTypeFilter === 'return' ? 'btn-primary' : 'btn-secondary'}" onclick="InventoryView.setHistoryFilter('return')" style="font-size: 0.8rem; font-weight: 700; border-radius: 0.5rem; padding: 0.35rem 0.65rem;">↩️ Devoluciones</button>
                </div>

                <div style="overflow-x: auto; max-height: 60vh; border: 1.5px solid #e2e8f0; border-radius: 0.75rem;">
                    <table style="width: 100%; border-collapse: collapse; text-align: left;">
                        <thead style="position: sticky; top: 0; background: #f8fafc; border-bottom: 2px solid #cbd5e1;">
                            <tr style="font-size: 0.72rem; text-transform: uppercase; color: #475569; font-weight: 900;">
                                <th style="padding: 0.65rem 0.75rem;">Fecha y Hora</th>
                                <th style="padding: 0.65rem 0.75rem;">Tipo</th>
                                <th style="padding: 0.65rem 0.75rem;">Producto</th>
                                <th style="padding: 0.65rem 0.75rem; text-align: center;">Cantidad</th>
                                <th style="padding: 0.65rem 0.75rem;">Motivo / Ref.</th>
                                <th style="padding: 0.65rem 0.75rem;">Usuario</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${movements.map(m => {
                                const p = (this.allProducts || []).find(prod => prod.id === m.productId);
                                const name = p ? p.name : (m.productName || 'Producto');
                                const unit = p && p.type === 'weight' ? 'kg' : 'un';
                                const isPos = m.quantity > 0;
                                const typeNames = { sale: 'Venta', purchase: 'Compra', adjustment: 'Ajuste / Baja', loss: 'Pérdida', consumption: 'Consumo', return: 'Devolución' };

                                return `
                                    <tr style="border-bottom: 1px solid #e2e8f0; font-size: 0.85rem;">
                                        <td style="padding: 0.65rem 0.75rem; color: #64748b; font-weight: 600;">${formatDateTime(m.date)}</td>
                                        <td style="padding: 0.65rem 0.75rem;">
                                            <span class="badge ${this.getMovementBadgeClass(m.type)}">${typeNames[m.type] || m.type}</span>
                                        </td>
                                        <td style="padding: 0.65rem 0.75rem;"><strong style="color: #0f172a;">${safeHTML(name)}</strong></td>
                                        <td style="padding: 0.65rem 0.75rem; text-align: center; font-weight: 900; color: ${isPos ? '#059669' : (m.quantity === 0 ? '#64748b' : '#dc2626')};">
                                            ${isPos ? '+' : ''}${m.quantity} ${unit}
                                        </td>
                                        <td style="padding: 0.65rem 0.75rem; color: #475569;">${safeHTML(m.reason || m.reference || '—')}</td>
                                        <td style="padding: 0.65rem 0.75rem; color: #64748b; font-size: 0.8rem;">${safeHTML(m.userName || 'Sistema')}</td>
                                    </tr>
                                `;
                            }).join('') || '<tr><td colspan="6" style="padding: 2rem; text-align: center; color: #94a3b8;">No se encontraron movimientos con los filtros aplicados</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    // =========================================================================
    // 8. SECCIÓN 5: SUGERENCIAS DE REPOSICIÓN POR PROVEEDOR
    // =========================================================================

    renderSuggestions() {
        const lowStockProducts = (this.allProducts || []).filter(p => 
            (p.minStock || 0) > 0 && (p.stock || 0) <= (p.minStock || 0)
        );

        if (lowStockProducts.length === 0) {
            return `
                <div class="card" style="padding: 3.5rem 1.5rem; text-align: center; background: white; border: 1.5px solid #e2e8f0; border-radius: 1.25rem;">
                    <div style="font-size: 3rem; margin-bottom: 0.5rem;">🎉</div>
                    <h2 style="font-size: 1.4rem; font-weight: 900; color: #0f172a; margin: 0;">¡Todo tu stock está en orden!</h2>
                    <p style="color: #64748b; font-size: 0.88rem; margin-top: 0.25rem;">No tienes productos con existencias por debajo del stock mínimo configurado.</p>
                </div>
            `;
        }

        // Agrupar por proveedor y calcular totales estimados
        const bySupplier = {};
        lowStockProducts.forEach(p => {
            const supp = (p.supplierName && p.supplierName.trim()) ? p.supplierName.trim() : 'Sin proveedor asignado';
            if (!bySupplier[supp]) bySupplier[supp] = [];
            bySupplier[supp].push(p);
        });

        const activeOrder = this.getActivePurchaseOrder();

        return `
            <div class="card" style="background: white; border: 1.5px solid #cbd5e1; border-radius: 1.25rem; padding: 1.35rem;">
                <!-- ENCABEZADO DE SUGERENCIAS -->
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #f1f5f9; padding-bottom: 0.75rem; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.5rem;">
                    <div>
                        <h3 style="margin: 0; color: #0f172a; font-size: 1.2rem; font-weight: 950; display: flex; align-items: center; gap: 0.45rem;">
                            <span>💡</span> Sugerencias de Reposición por Proveedor
                        </h3>
                        <span style="font-size: 0.82rem; color: #64748b;">
                            ${lowStockProducts.length} productos bajo stock mínimo agrupados en ${Object.keys(bySupplier).length} proveedor(es).
                        </span>
                    </div>

                    <button class="btn btn-secondary" onclick="InventoryView.copyAllSuggestionsToClipboard()" style="font-weight: 800; border-radius: 0.65rem; font-size: 0.85rem; padding: 0.55rem 1rem;">
                        📋 Copiar Todo a Portapapeles
                    </button>
                </div>

                <!-- BANNER DE ORDEN ACTIVA PENDIENTE SI EXISTE -->
                ${activeOrder ? `
                <div style="background: #fffbeb; border: 2px solid #f59e0b; border-radius: 1rem; padding: 1rem 1.25rem; margin-bottom: 1.35rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; box-shadow: 0 4px 12px rgba(245,158,11,0.12);">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <span style="font-size: 2rem;">📋</span>
                        <div>
                            <span style="background: #f59e0b; color: #fff; font-size: 0.7rem; font-weight: 950; text-transform: uppercase; padding: 2px 7px; border-radius: 4px;">Pedido Activo Pendiente</span>
                            <h4 style="margin: 0.2rem 0 0 0; color: #92400e; font-size: 1.05rem; font-weight: 950;">
                                ${safeHTML(activeOrder.supplierName)} (${activeOrder.items.length} productos aprox.)
                            </h4>
                            <span style="color: #b45309; font-size: 0.82rem; font-weight: 700;">
                                Inversión estimada aprox: $${formatCLP(activeOrder.totalEstimated || 0)} • Creada: ${new Date(activeOrder.createdAt).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <button class="btn btn-primary" onclick="InventoryView.openSupplierSuggestionsModal('${safeAttr(activeOrder.supplierName)}')" style="font-weight: 900; font-size: 0.85rem; padding: 0.5rem 1rem; border-radius: 0.6rem; background: #d97706; border-color: #d97706;">
                            👁️ Ver / Modificar Pedido
                        </button>
                        <button class="btn btn-outline-danger" onclick="if(confirm('¿Descartar esta lista de pedido pendiente?')) InventoryView.clearActivePurchaseOrder()" style="font-weight: 800; font-size: 0.85rem; padding: 0.5rem 0.85rem; border-radius: 0.6rem;">
                            ✕ Descartar
                        </button>
                    </div>
                </div>
                ` : ''}

                <!-- CUADRÍCULA LIMPIA DE TARJETAS POR PROVEEDOR -->
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.25rem;">
                    ${Object.entries(bySupplier).map(([supplier, items]) => {
                        let totalEstimatedCost = 0;
                        items.forEach(p => {
                            const stock = parseFloat(p.stock) || 0;
                            const minStock = parseFloat(p.minStock) || 0;
                            const suggested = Math.max(1, (minStock * 2) - stock);
                            const cost = parseFloat(p.cost) || 0;
                            totalEstimatedCost += Math.round(suggested * cost);
                        });

                        const isThisActive = activeOrder && activeOrder.supplierName === supplier;

                        return `
                            <div style="background: #ffffff; border: 2px solid ${isThisActive ? '#f59e0b' : '#e2e8f0'}; border-radius: 1rem; padding: 1.15rem; display: flex; flex-direction: column; justify-content: space-between; gap: 0.85rem; box-shadow: 0 4px 12px rgba(0,0,0,0.03); position: relative; transition: all 0.2s;"
                                 onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 20px rgba(0,0,0,0.06)';"
                                 onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.03)';">
                                
                                ${isThisActive ? `
                                <div style="position: absolute; top: -10px; right: 1rem; background: #f59e0b; color: #fff; padding: 0.15rem 0.65rem; border-radius: 1rem; font-size: 0.68rem; font-weight: 950; border: 1.5px solid #fff;">
                                    ORDEN ACTIVA
                                </div>
                                ` : ''}

                                <div>
                                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.4rem;">
                                        <h4 style="margin: 0; color: #0f172a; font-size: 1.05rem; font-weight: 950; display: flex; align-items: center; gap: 0.35rem;">
                                            <span>🚚</span> ${safeHTML(supplier)}
                                        </h4>
                                        <span style="background: #fef3c7; color: #92400e; font-size: 0.75rem; font-weight: 950; padding: 0.2rem 0.6rem; border-radius: 999px; border: 1px solid #fde68a;">
                                            ${items.length} productos
                                        </span>
                                    </div>
                                    <span style="color: #64748b; font-size: 0.78rem;">Productos agotados o bajo stock mínimo.</span>
                                </div>

                                <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 0.65rem; padding: 0.65rem 0.85rem; display: flex; justify-content: space-between; align-items: center;">
                                    <span style="font-size: 0.72rem; color: #64748b; font-weight: 850; text-transform: uppercase;">Inversión Est. Aprox:</span>
                                    <strong style="color: #0f172a; font-size: 1.1rem; font-weight: 950;">$${formatCLP(totalEstimatedCost)}</strong>
                                </div>

                                <div style="display: flex; gap: 0.5rem;">
                                    <button class="btn btn-primary" onclick="InventoryView.openSupplierSuggestionsModal('${safeAttr(supplier)}')" style="flex: 2; height: 38px; font-size: 0.82rem; font-weight: 900; border-radius: 0.55rem; background: #2563eb; display: flex; align-items: center; justify-content: center; gap: 0.35rem;">
                                        <span>📋</span> Ver y Armar Pedido
                                    </button>
                                    <button class="btn btn-secondary" onclick="InventoryView.copySupplierSuggestionsToWhatsApp('${safeAttr(supplier)}')" style="flex: 1; height: 38px; font-size: 0.82rem; font-weight: 800; border-radius: 0.55rem; color: #059669; border: 1.5px solid #a7f3d0; background: #f0fdf4;" title="Copiar para WhatsApp">
                                        📲 WhatsApp
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    },

    getMovementBadgeClass(type) {
        const map = {
            sale: 'badge-info',
            purchase: 'badge-success',
            adjustment: 'badge-warning',
            loss: 'badge-danger',
            consumption: 'badge-info',
            return: 'badge-warning'
        };
        return map[type] || 'badge-secondary';
    },

    // ponytail: Modal inteligente de armado de pedidos por proveedor (Rotación + Rentabilidad)
    async openSupplierSuggestionsModal(supplierName) {
        if (!this.allProducts || this.allProducts.length === 0) {
            try {
                this.allProducts = await Product.getAll();
            } catch (e) {
                console.warn('Error cargando productos:', e);
            }
        }

        const salesMap = await this.getProductsSalesMap();

        // Filtrar productos del proveedor especificado que estén bajo stock o en cero
        const targetSupplier = (supplierName || '').trim().toLowerCase();
        let items = (this.allProducts || []).filter(p => {
            const pSupp = (p.supplierName && p.supplierName.trim()) ? p.supplierName.trim().toLowerCase() : 'sin proveedor asignado';
            const isMatch = targetSupplier === 'sin proveedor asignado' 
                ? (!p.supplierName || !p.supplierName.trim())
                : pSupp === targetSupplier;
            return isMatch && (parseFloat(p.minStock) || 0) > 0 && (parseFloat(p.stock) || 0) <= (parseFloat(p.minStock) || 0);
        });

        // Si no hay bajo stock estricto, buscar todos los del proveedor
        if (items.length === 0) {
            items = (this.allProducts || []).filter(p => {
                const pSupp = (p.supplierName && p.supplierName.trim()) ? p.supplierName.trim().toLowerCase() : 'sin proveedor asignado';
                return targetSupplier === 'sin proveedor asignado' 
                    ? (!p.supplierName || !p.supplierName.trim())
                    : pSupp === targetSupplier;
            });
        }

        // Si ya hay una orden activa para este proveedor, precargar las cantidades guardadas
        const activeOrder = this.getActivePurchaseOrder();
        const activeItemMap = {};
        if (activeOrder && (activeOrder.supplierName || '').trim().toLowerCase() === targetSupplier) {
            (activeOrder.items || []).forEach(it => {
                activeItemMap[it.id] = it.orderQty;
            });
        }

        // Calcular métricas inteligentes: rotación de ventas y margen de rentabilidad
        const decoratedItems = items.map(p => {
            const stock = parseFloat(p.stock) || 0;
            const minStock = parseFloat(p.minStock) || 0;
            const cost = parseFloat(p.cost) || parseFloat(p.costNeto) || 0;
            const price = parseFloat(p.price) || 0;
            const salesQty = salesMap[p.id] || 0;
            const margin = price > 0 ? Math.round(((price - cost) / price) * 100) : 0;
            
            // Sugerencia estándar: llegar al doble del stock mínimo
            const defaultSuggested = Math.max(1, Math.round((minStock * 2) - stock));
            const orderQty = activeItemMap[p.id] !== undefined ? activeItemMap[p.id] : defaultSuggested;

            return {
                ...p,
                stock,
                minStock,
                cost,
                price,
                salesQty,
                margin,
                orderQty
            };
        });

        // Ordenamiento Inteligente:
        // 1. Mayor rotación de ventas primero (los más vendidos)
        // 2. Stock agotado (stock <= 0)
        // 3. Mejor margen de ganancia
        decoratedItems.sort((a, b) => {
            if (b.salesQty !== a.salesQty) return b.salesQty - a.salesQty;
            if ((a.stock <= 0) !== (b.stock <= 0)) return a.stock <= 0 ? -1 : 1;
            return b.margin - a.margin;
        });

        this._currentModalItems = decoratedItems;
        this._currentModalSupplier = supplierName;

        let totalEstimated = decoratedItems.reduce((sum, it) => sum + (it.orderQty * it.cost), 0);

        const content = `
            <div style="padding: 0.5rem; max-height: 82vh; display: flex; flex-direction: column;">
                <!-- Header informativo -->
                <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 0.85rem; padding: 1rem 1.25rem; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 0.4rem;">
                            <span style="font-size: 1.4rem;">🚚</span>
                            <h3 style="margin: 0; font-size: 1.2rem; font-weight: 950; color: #0f172a;">${safeHTML(supplierName)}</h3>
                        </div>
                        <span style="font-size: 0.8rem; color: #64748b;">
                            Priorizado automáticamente por <strong>mayor rotación de ventas</strong> y <strong>margen de rentabilidad</strong>.
                        </span>
                    </div>
                    <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 0.65rem; padding: 0.5rem 0.85rem; text-align: right;">
                        <span style="font-size: 0.7rem; color: #64748b; font-weight: 800; text-transform: uppercase; display: block;">Inversión Estimada:</span>
                        <strong id="modalOrderTotalEst" style="font-size: 1.25rem; font-weight: 950; color: #2563eb;">$${formatCLP(totalEstimated)}</strong>
                    </div>
                </div>

                <!-- Tabla de productos a pedir -->
                <div style="overflow-y: auto; max-height: 48vh; border: 1.5px solid #e2e8f0; border-radius: 0.75rem; margin-bottom: 1rem;">
                    <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;">
                        <thead style="position: sticky; top: 0; background: #f1f5f9; border-bottom: 2px solid #cbd5e1; z-index: 10;">
                            <tr style="font-size: 0.7rem; text-transform: uppercase; color: #475569; font-weight: 900;">
                                <th style="padding: 0.65rem 0.75rem;">Producto</th>
                                <th style="padding: 0.65rem 0.75rem; text-align: center;">Stock / Mín.</th>
                                <th style="padding: 0.65rem 0.75rem; text-align: center;">Inteligencia</th>
                                <th style="padding: 0.65rem 0.75rem; text-align: right;">Costo</th>
                                <th style="padding: 0.65rem 0.75rem; text-align: center; width: 110px;">Cant. Pedir</th>
                                <th style="padding: 0.65rem 0.75rem; text-align: right;">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${decoratedItems.map(it => {
                                const isOut = it.stock <= 0;
                                const isTop = it.salesQty > 0;
                                const isGoodMargin = it.margin >= 30;
                                const subtotal = Math.round(it.orderQty * it.cost);

                                return `
                                    <tr style="border-bottom: 1px solid #e2e8f0;">
                                        <td style="padding: 0.65rem 0.75rem;">
                                            <strong style="color: #0f172a; display: block;">${safeHTML(it.name)}</strong>
                                            ${it.barcode ? `<span style="font-size: 0.72rem; color: #64748b; font-family: monospace;">${safeHTML(it.barcode)}</span>` : ''}
                                        </td>
                                        <td style="padding: 0.65rem 0.75rem; text-align: center;">
                                            <span style="font-weight: 800; color: ${isOut ? '#dc2626' : '#d97706'};">${it.stock}</span>
                                            <span style="color: #94a3b8; font-size: 0.75rem;"> / ${it.minStock}</span>
                                        </td>
                                        <td style="padding: 0.65rem 0.75rem; text-align: center;">
                                            <div style="display: flex; gap: 0.3rem; justify-content: center; flex-wrap: wrap;">
                                                ${isTop ? `<span style="font-size: 0.68rem; font-weight: 900; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; padding: 0.15rem 0.45rem; border-radius: 999px;">🔥 ${it.salesQty} vend.</span>` : ''}
                                                ${isGoodMargin ? `<span style="font-size: 0.68rem; font-weight: 900; background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 0.15rem 0.45rem; border-radius: 999px;">⭐ ${it.margin}%</span>` : ''}
                                                ${isOut ? `<span style="font-size: 0.68rem; font-weight: 900; background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; padding: 0.15rem 0.45rem; border-radius: 999px;">🔴 Agotado</span>` : ''}
                                            </div>
                                        </td>
                                        <td style="padding: 0.65rem 0.75rem; text-align: right; color: #64748b; font-weight: 700;">
                                            ${formatCLP(it.cost)}
                                        </td>
                                        <td style="padding: 0.65rem 0.75rem; text-align: center;">
                                            <input type="number" 
                                                   id="modal-order-qty-${it.id}"
                                                   value="${it.orderQty}" 
                                                   min="0" 
                                                   step="${it.type === 'weight' ? '0.1' : '1'}"
                                                   style="width: 75px; height: 34px; text-align: center; font-weight: 900; font-size: 0.95rem; border-radius: 0.5rem; border: 1.5px solid #cbd5e1; outline: none;"
                                                   oninput="InventoryView.updateSuggestionOrderQty('${it.id}', this.value, ${it.cost})">
                                        </td>
                                        <td style="padding: 0.65rem 0.75rem; text-align: right; font-weight: 900; color: #0f172a;" id="modal-subtotal-${it.id}">
                                            ${formatCLP(subtotal)}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>

                <!-- Botones de Acción -->
                <div style="display: flex; gap: 0.65rem; justify-content: flex-end; flex-wrap: wrap; align-items: center;">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()" style="font-weight: 800; border-radius: 0.6rem; padding: 0.6rem 1rem;">
                        Cerrar
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="InventoryView.copySupplierSuggestionsToWhatsApp('${safeAttr(supplierName)}')" style="font-weight: 800; border-radius: 0.6rem; padding: 0.6rem 1.15rem; color: #059669; border: 1.5px solid #a7f3d0; background: #f0fdf4;">
                        📲 Enviar WhatsApp
                    </button>
                    <button type="button" class="btn btn-primary" onclick="InventoryView.saveActivePurchaseOrderFromModal('${safeAttr(supplierName)}')" style="font-weight: 900; border-radius: 0.6rem; padding: 0.6rem 1.35rem; background: #2563eb;">
                        💾 Guardar como Pedido Activo
                    </button>
                </div>
            </div>
        `;

        showModal(content, { title: 'Armar Pedido con Sugerencias Inteligentes', width: '800px' });
    },

    updateSuggestionOrderQty(productId, val, unitCost) {
        const qty = Math.max(0, parseFloat(val) || 0);
        if (this._currentModalItems) {
            const item = this._currentModalItems.find(i => String(i.id) === String(productId));
            if (item) item.orderQty = qty;

            const subtotalEl = document.getElementById(`modal-subtotal-${productId}`);
            if (subtotalEl) subtotalEl.textContent = formatCLP(qty * (parseFloat(unitCost) || 0));

            const total = this._currentModalItems.reduce((sum, it) => sum + (it.orderQty * (parseFloat(it.cost) || 0)), 0);
            const totalEl = document.getElementById('modalOrderTotalEst');
            if (totalEl) totalEl.textContent = formatCLP(total);
        }
    },

    async saveActivePurchaseOrderFromModal(supplierName) {
        if (!this._currentModalItems) return;
        const validItems = this._currentModalItems.filter(i => i.orderQty > 0);
        if (validItems.length === 0) {
            showNotification('No hay productos con cantidad mayor a 0 para pedir.', 'warning');
            return;
        }

        const totalEst = validItems.reduce((sum, it) => sum + (it.orderQty * it.cost), 0);

        const order = {
            supplierName: supplierName,
            createdAt: new Date().toISOString(),
            totalEstimated: totalEst,
            items: validItems.map(it => ({
                id: it.id,
                name: it.name,
                barcode: it.barcode || '',
                orderQty: it.orderQty,
                cost: it.cost,
                subtotal: Math.round(it.orderQty * it.cost)
            }))
        };

        this.saveActivePurchaseOrder(order);
        closeModal();
        showNotification(`✅ Pedido guardado para ${supplierName} (${validItems.length} productos, ${formatCLP(totalEst)})`, 'success');
        this.switchSection('suggestions');
    },

    async copySupplierSuggestionsToWhatsApp(supplierName) {
        let items = [];
        if (this._currentModalItems && this._currentModalSupplier === supplierName) {
            items = this._currentModalItems.filter(i => i.orderQty > 0);
        }
        if (items.length === 0) {
            const targetSupplier = (supplierName || '').trim().toLowerCase();
            const prods = (this.allProducts || []).filter(p => {
                const pSupp = (p.supplierName && p.supplierName.trim()) ? p.supplierName.trim().toLowerCase() : 'sin proveedor asignado';
                return (targetSupplier === 'sin proveedor asignado' ? (!p.supplierName) : pSupp === targetSupplier) &&
                    (parseFloat(p.minStock) || 0) > 0 && (parseFloat(p.stock) || 0) <= (parseFloat(p.minStock) || 0);
            });
            items = prods.map(p => {
                const stock = parseFloat(p.stock) || 0;
                const minStock = parseFloat(p.minStock) || 0;
                const cost = parseFloat(p.cost) || 0;
                return {
                    name: p.name,
                    orderQty: Math.max(1, Math.round((minStock * 2) - stock)),
                    cost
                };
            });
        }

        if (items.length === 0) {
            showNotification('No hay productos pendientes para pedir a este proveedor.', 'info');
            return;
        }

        const totalEst = items.reduce((sum, it) => sum + (it.orderQty * (parseFloat(it.cost) || 0)), 0);
        const todayStr = new Date().toLocaleDateString('es-CL');

        let msg = `📦 *ORDEN DE COMPRA / PEDIDO DE REPOSICIÓN*\n`;
        msg += `Proveedor: *${supplierName}*\n`;
        msg += `Fecha: ${todayStr}\n\n`;
        msg += `Estimados, solicito cotizar y despachar los siguientes productos:\n\n`;

        items.forEach((it, idx) => {
            msg += `${idx + 1}. *${it.name}* -> *${it.orderQty} un.*\n`;
        });

        msg += `\nTotal Estimado: *${formatCLP(totalEst)}*\n`;
        msg += `_Generado automáticamente desde Caja Fácil POS_`;

        try {
            await navigator.clipboard.writeText(msg);
            showNotification('📋 Mensaje de WhatsApp copiado al portapapeles.', 'success');
        } catch (e) {
            console.warn('Clipboard write failed:', e);
        }

        // Si el proveedor tiene teléfono, intentar abrir WhatsApp
        try {
            const suppliers = await Supplier.getAll();
            const supp = suppliers.find(s => (s.name || '').trim().toLowerCase() === (supplierName || '').trim().toLowerCase());
            if (supp && supp.phone) {
                const cleanPhone = String(supp.phone).replace(/[^0-9]/g, '');
                if (cleanPhone) {
                    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
                    return;
                }
            }
        } catch (e) {}
    },

    async copyAllSuggestionsToClipboard() {
        const lowStockProducts = (this.allProducts || []).filter(p => 
            (p.minStock || 0) > 0 && (p.stock || 0) <= (p.minStock || 0)
        );

        if (lowStockProducts.length === 0) {
            showNotification('No hay sugerencias de reposición pendientes.', 'info');
            return;
        }

        const bySupplier = {};
        lowStockProducts.forEach(p => {
            const supp = (p.supplierName && p.supplierName.trim()) ? p.supplierName.trim() : 'Sin proveedor asignado';
            if (!bySupplier[supp]) bySupplier[supp] = [];
            bySupplier[supp].push(p);
        });

        let text = `📋 *RESUMEN GENERAL DE REPOSICIÓN DE STOCK*\n`;
        text += `Fecha: ${new Date().toLocaleDateString('es-CL')}\n\n`;

        Object.entries(bySupplier).forEach(([supp, prods]) => {
            text += `🚚 *PROVEEDOR: ${supp.toUpperCase()}*\n`;
            prods.forEach((p, idx) => {
                const stock = parseFloat(p.stock) || 0;
                const minStock = parseFloat(p.minStock) || 0;
                const suggested = Math.max(1, Math.round((minStock * 2) - stock));
                text += `  ${idx + 1}. ${p.name} (Stock: ${stock} / Mín: ${minStock}) -> Sugerido: *${suggested} un.*\n`;
            });
            text += `\n`;
        });

        try {
            await navigator.clipboard.writeText(text);
            showNotification('✅ Todas las sugerencias han sido copiadas al portapapeles.', 'success');
        } catch (e) {
            showNotification('Error al copiar al portapapeles: ' + e.message, 'error');
        }
    }
};

window.InventoryView = InventoryView;
