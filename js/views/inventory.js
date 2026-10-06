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

const InventoryView = {
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

    // Filtros y paginación de la tabla principal
    inventorySearchQuery: '',
    inventorySelectedCategory: '',
    inventorySelectedStockStatus: 'all', // 'all' | 'low' | 'out' | 'optimum'
    inventorySelectedSupplier: '',
    inventoryCurrentPage: 1,
    inventoryPageSize: 15, // Preferencia del usuario: 15 productos por página

    // Bajas y Consumos
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
            if (this.egressSubTab === 'losses' || this.egressSubTab === 'consumptions') {
                this.setupEgressSearchListeners();
                if (this.egressSubTab === 'losses') this.loadLossReport();
                if (this.egressSubTab === 'consumptions') this.loadConsumptionReport();
            } else if (this.egressSubTab === 'bulk') {
                this.setupBulkSearchListeners();
                this.updateBulkSelectedProductsUI();
            }
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

        // Pérdidas y consumos del mes actual
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        let monthlyLoss = 0;
        let monthlyConsumption = 0;

        (this.recentMovements || []).forEach(m => {
            if (m.status === 'cancelled') return;
            const mDate = new Date(m.date);
            if (mDate.getFullYear() === currentYear && mDate.getMonth() === currentMonth) {
                const costVal = parseFloat(m.cost_value) || 0;
                if (m.type === 'loss') monthlyLoss += costVal;
                else if (m.type === 'consumption') monthlyConsumption += costVal;
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
            monthlyLoss,
            monthlyConsumption
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
            <div class="view-header animate-fade-in" style="margin-bottom: 1.25rem;">
                <div class="header-content">
                    <h1 style="color: #0f172a; font-size: 1.75rem; font-weight: 900; letter-spacing: -0.5px; margin: 0;">
                        Control de Stock e Inventario
                    </h1>
                    <p style="color: #64748b; font-size: 0.9rem; margin: 0.25rem 0 0 0; font-weight: 500;">
                        Controla existencias físicas, calcula tu inversión real y gestiona mermas y consumos.
                    </p>
                </div>
            </div>

            <div class="inventory-container animate-fade-in">
                <!-- BARRA DE PESTAÑAS PRINCIPALES (5 SECCIONES LIMPIAS) -->
                <div class="card" style="padding: 0.5rem; background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 1rem; margin-bottom: 1.25rem; box-shadow: 0 2px 4px rgba(0,0,0,0.02); overflow-x: auto; -webkit-overflow-scrolling: touch;">
                    <div style="display: flex; gap: 0.5rem; flex-wrap: nowrap; min-width: max-content;">
                        <button class="btn ${this.currentSection === 'inventory' ? 'btn-primary' : 'btn-secondary'}" 
                                onclick="InventoryView.switchSection('inventory')" 
                                style="padding: 0.55rem 1rem; font-size: 0.88rem; font-weight: 800; border-radius: 0.65rem;"
                                title="Lista completa de productos y valorización">
                            📦 Inventario
                        </button>

                        <button class="btn ${this.currentSection === 'egress' ? 'btn-primary' : 'btn-secondary'}" 
                                onclick="InventoryView.switchSection('egress')" 
                                style="padding: 0.55rem 1rem; font-size: 0.88rem; font-weight: 800; border-radius: 0.65rem;"
                                title="Registro independiente de mermas y consumos">
                            📉 Bajas y Consumos
                        </button>

                        <button class="btn ${this.currentSection === 'audit' ? 'btn-primary' : 'btn-secondary'}" 
                                onclick="InventoryView.switchSection('audit')" 
                                style="padding: 0.55rem 1rem; font-size: 0.88rem; font-weight: 800; border-radius: 0.65rem;"
                                title="Contar mercadería físicamente y cuadrar el sistema">
                            📋 Conteo Físico
                        </button>

                        <button class="btn ${this.currentSection === 'history' ? 'btn-primary' : 'btn-secondary'}" 
                                onclick="InventoryView.switchSection('history')" 
                                style="padding: 0.55rem 1rem; font-size: 0.88rem; font-weight: 800; border-radius: 0.65rem;"
                                title="Registro de todos los movimientos de stock pasados">
                            📜 Historial
                        </button>

                        <button class="btn ${this.currentSection === 'suggestions' ? 'btn-primary' : 'btn-secondary'}" 
                                onclick="InventoryView.switchSection('suggestions')" 
                                style="padding: 0.55rem 1rem; font-size: 0.88rem; font-weight: 800; border-radius: 0.65rem; ${lowCount > 0 && this.currentSection !== 'suggestions' ? 'border-color: #f59e0b; color: #b45309; background: #fffbeb;' : ''}"
                                title="Productos bajo stock mínimo para reponer">
                            💡 Sugerencias de Compra${lowCount > 0 ? ` <span style="background: #f59e0b; color: #ffffff; border-radius: 999px; padding: 0.1rem 0.45rem; font-size: 0.72rem; font-weight: 900; margin-left: 0.35rem;">${lowCount}</span>` : ''}
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
            // Actualizar botones de pestaña superior
            const buttons = document.querySelectorAll('.inventory-container .card button');
            const sections = ['inventory', 'egress', 'audit', 'history', 'suggestions'];
            buttons.forEach((btn, idx) => {
                if (sections[idx]) {
                    if (sections[idx] === this.currentSection) {
                        btn.className = 'btn btn-primary';
                    } else {
                        btn.className = 'btn btn-secondary';
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
                                   placeholder="🔍 Buscar por nombre o código de barra..." 
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

        // Filtro por texto (Nombre o Código de barra)
        if (this.inventorySearchQuery) {
            const q = this.inventorySearchQuery.toLowerCase().trim();
            list = list.filter(p => 
                (p.name || '').toLowerCase().includes(q) || 
                (p.barcode || '').toLowerCase().includes(q)
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
                        <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 0.15rem;">
                            <span style="color: #64748b; font-size: 0.75rem; background: #f1f5f9; padding: 0.05rem 0.35rem; border-radius: 0.25rem;">${safeHTML(p.category || 'General')}</span>
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
                        <button type="button" class="btn btn-sm btn-secondary" onclick="InventoryView.quickAdjustment(${p.id})" style="padding: 0.3rem 0.6rem; font-size: 0.78rem; font-weight: 800; border-radius: 0.5rem; margin-right: 0.35rem;" title="Corregir el stock de este producto">
                            ✏️ Ajustar
                        </button>
                        <button type="button" class="btn btn-sm btn-primary" onclick="InventoryView.showKardex(${p.id})" style="padding: 0.3rem 0.6rem; font-size: 0.78rem; font-weight: 800; border-radius: 0.5rem;" title="Ver todos los movimientos que afectaron a este producto">
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

        // Regla 8: Operaciones Críticas Bajo PIN de Supervisor
        const auth = await SupervisorAuth.requireAuth({
            title: 'Autorización: Ajuste de Inventario',
            message: `El cambio manual de stock para "${pName}" (de ${currentStock} a ${newStock}) requiere autorización de un Supervisor.`
        });
        if (!auth.authorized) {
            showNotification('❌ Ajuste cancelado o no autorizado.', 'warning');
            return;
        }

        const auditReason = `${reason} (Autorizado por: ${auth.supervisorName})`;

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
    // 5. SECCIÓN 2: BAJAS Y CONSUMOS (HISTORIALES 100% INDEPENDIENTES)
    // =========================================================================

    renderEgressSection(dashboard) {
        const isLoss = this.egressSubTab === 'losses';
        const isCons = this.egressSubTab === 'consumptions';
        const isBulk = this.egressSubTab === 'bulk';

        return `
            <!-- Selector de Modo de Bajas y Consumos -->
            <div class="card" style="padding: 0.75rem; background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 1rem; margin-bottom: 1.25rem;">
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem;">
                    <button type="button" 
                            class="btn ${isLoss ? 'btn-danger' : 'btn-secondary'}" 
                            onclick="InventoryView.switchEgressSubTab('losses')"
                            style="padding: 0.65rem; font-weight: 800; border-radius: 0.65rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; ${isLoss ? 'background: #dc2626; border-color: #dc2626; color: white;' : ''}">
                        <span style="font-size: 1.1rem;">🗑️</span>
                        <span>1. Pérdidas y Mermas (Vencidos / Rotos)</span>
                    </button>

                    <button type="button" 
                            class="btn ${isCons ? 'btn-primary' : 'btn-secondary'}" 
                            onclick="InventoryView.switchEgressSubTab('consumptions')"
                            style="padding: 0.65rem; font-weight: 800; border-radius: 0.65rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; ${isCons ? 'background: #2563eb; border-color: #2563eb; color: white;' : ''}">
                        <span style="font-size: 1.1rem;">🍴</span>
                        <span>2. Consumo del Local (Uso Interno)</span>
                    </button>

                    <button type="button" 
                            class="btn ${isBulk ? 'btn-primary' : 'btn-secondary'}" 
                            onclick="InventoryView.switchEgressSubTab('bulk')"
                            style="padding: 0.65rem; font-weight: 800; border-radius: 0.65rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; ${isBulk ? 'background: #059669; border-color: #059669; color: white;' : ''}">
                        <span style="font-size: 1.1rem;">⚡</span>
                        <span>3. Anotar Varios Productos a la Vez</span>
                    </button>
                </div>
            </div>

            <!-- Contenido según la sub-pestaña activa -->
            ${isLoss ? this.renderLossesSubTab(dashboard) : ''}
            ${isCons ? this.renderConsumptionsSubTab(dashboard) : ''}
            ${isBulk ? this.renderBulkAdjustmentForm() : ''}
        `;
    },

    switchEgressSubTab(subTab) {
        this.egressSubTab = subTab;
        this.selectedEgressProductData = null;
        this.switchSection('egress', subTab);
    },

    // Sub-pestaña: Pérdidas y Mermas
    renderLossesSubTab(dashboard) {
        return `
            <!-- Tarjeta KPI de Pérdidas del Mes -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 1.25rem;">
                <div class="card" style="background: #ffffff; border: 1.5px solid #fecaca; border-left: 5px solid #ef4444; border-radius: 1rem; padding: 1.25rem;">
                    <div style="font-size: 0.75rem; text-transform: uppercase; color: #dc2626; font-weight: 800; letter-spacing: 0.5px;">Pérdidas y Mermas (Mes Actual)</div>
                    <div style="font-size: 1.8rem; font-weight: 900; color: #dc2626; margin-top: 0.25rem;">
                        -${formatCLP(dashboard.monthlyLoss)}
                    </div>
                    <small style="color: #64748b; font-size: 0.78rem; display: block; margin-top: 0.25rem;">Costo acumulado de mercadería vencida, rota o en mal estado este mes.</small>
                </div>
            </div>

            <!-- Formulario de Registro Rápido de Pérdida -->
            <div class="card" style="background: #ffffff; border: 1.5px solid #fecaca; border-radius: 1.25rem; padding: 1.25rem; margin-bottom: 1.5rem;">
                <h3 style="margin: 0 0 1rem 0; color: #991b1b; font-size: 1.1rem; font-weight: 900; display: flex; align-items: center; gap: 0.5rem;">
                    <span>🗑️</span> Anotar Nueva Pérdida / Merma
                </h3>

                <div style="display: flex; gap: 1rem; align-items: flex-start; flex-wrap: wrap;">
                    <div style="position: relative; flex: 2; min-width: 250px;">
                        <label style="font-size: 0.8rem; font-weight: 800; color: #475569; display: block; margin-bottom: 0.35rem;">Buscar Producto:</label>
                        <input type="text" 
                               id="egressSearchInput" 
                               class="form-control" 
                               placeholder="🔍 Escribe nombre o código de barra..." 
                               oninput="InventoryView.handleEgressSearch(event, 'loss')" 
                               style="padding: 0.55rem 0.75rem; border-radius: 0.6rem; border: 1.5px solid #cbd5e1; width: 100%; font-size: 0.9rem; font-weight: 600;">
                        <div id="egressSearchResults" class="search-results" style="display: none; position: absolute; left: 0; right: 0; background: white; border: 1.5px solid #cbd5e1; border-radius: 0.6rem; max-height: 250px; overflow-y: auto; z-index: 100; box-shadow: 0 10px 25px rgba(0,0,0,0.1);"></div>
                    </div>

                    <div id="egressSelectedProductPanel" style="flex: 3; min-width: 300px; display: none; background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 0.75rem; padding: 0.85rem 1rem;">
                        <!-- Se llena dinámicamente con selectEgressProduct -->
                    </div>
                </div>
            </div>

            <!-- Historial Independiente de Pérdidas -->
            <div class="card" style="padding: 1.25rem; border-radius: 1.25rem; border: 1.5px solid #e2e8f0; background: #ffffff;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #f1f5f9; padding-bottom: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
                    <div>
                        <h4 style="margin: 0; color: #991b1b; font-weight: 900; font-size: 1.05rem; display: flex; align-items: center; gap: 0.4rem;">
                            <span>📜</span> Historial de Pérdidas y Mermas
                        </h4>
                        <span style="font-size: 0.78rem; color: #64748b;">Selecciona una fecha para auditar o anular registros:</span>
                    </div>

                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 0.8rem; font-weight: 800; color: #475569;">Fecha:</span>
                        <input type="date" 
                               value="${this.selectedLossDate}" 
                               onchange="InventoryView.setLossDate(this.value)"
                               style="background: #fef2f2; border: 1.5px solid #fecaca; color: #991b1b; padding: 0.4rem 0.75rem; border-radius: 0.5rem; font-size: 0.85rem; font-weight: 800; outline: none; cursor: pointer;">
                    </div>
                </div>

                <div id="lossReportContent">
                    <div style="text-align: center; padding: 2rem; color: #64748b;">Cargando historial de pérdidas...</div>
                </div>
            </div>
        `;
    },

    // Sub-pestaña: Consumos del Local
    renderConsumptionsSubTab(dashboard) {
        return `
            <!-- Tarjeta KPI de Consumo del Mes -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 1.25rem;">
                <div class="card" style="background: #ffffff; border: 1.5px solid #bfdbfe; border-left: 5px solid #3b82f6; border-radius: 1rem; padding: 1.25rem;">
                    <div style="font-size: 0.75rem; text-transform: uppercase; color: #1e40af; font-weight: 800; letter-spacing: 0.5px;">Consumo del Local (Mes Actual)</div>
                    <div style="font-size: 1.8rem; font-weight: 900; color: #2563eb; margin-top: 0.25rem;">
                        ${formatCLP(dashboard.monthlyConsumption)}
                    </div>
                    <small style="color: #64748b; font-size: 0.78rem; display: block; margin-top: 0.25rem;">Costo total acumulado de mercadería consumida por el negocio este mes.</small>
                </div>
            </div>

            <!-- Formulario de Registro Rápido de Consumo -->
            <div class="card" style="background: #ffffff; border: 1.5px solid #bfdbfe; border-radius: 1.25rem; padding: 1.25rem; margin-bottom: 1.5rem;">
                <h3 style="margin: 0 0 1rem 0; color: #1e3a8a; font-size: 1.1rem; font-weight: 900; display: flex; align-items: center; gap: 0.5rem;">
                    <span>🍴</span> Anotar Consumo de la Casa
                </h3>

                <div style="display: flex; gap: 1rem; align-items: flex-start; flex-wrap: wrap;">
                    <div style="position: relative; flex: 2; min-width: 250px;">
                        <label style="font-size: 0.8rem; font-weight: 800; color: #475569; display: block; margin-bottom: 0.35rem;">Buscar Producto:</label>
                        <input type="text" 
                               id="egressSearchInput" 
                               class="form-control" 
                               placeholder="🔍 Escribe nombre o código de barra..." 
                               oninput="InventoryView.handleEgressSearch(event, 'consumption')" 
                               style="padding: 0.55rem 0.75rem; border-radius: 0.6rem; border: 1.5px solid #cbd5e1; width: 100%; font-size: 0.9rem; font-weight: 600;">
                        <div id="egressSearchResults" class="search-results" style="display: none; position: absolute; left: 0; right: 0; background: white; border: 1.5px solid #cbd5e1; border-radius: 0.6rem; max-height: 250px; overflow-y: auto; z-index: 100; box-shadow: 0 10px 25px rgba(0,0,0,0.1);"></div>
                    </div>

                    <div id="egressSelectedProductPanel" style="flex: 3; min-width: 300px; display: none; background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 0.75rem; padding: 0.85rem 1rem;">
                        <!-- Se llena dinámicamente con selectEgressProduct -->
                    </div>
                </div>
            </div>

            <!-- Historial Independiente de Consumos -->
            <div class="card" style="padding: 1.25rem; border-radius: 1.25rem; border: 1.5px solid #e2e8f0; background: #ffffff;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #f1f5f9; padding-bottom: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
                    <div>
                        <h4 style="margin: 0; color: #1e3a8a; font-weight: 900; font-size: 1.05rem; display: flex; align-items: center; gap: 0.4rem;">
                            <span>📜</span> Historial de Consumos del Local
                        </h4>
                        <span style="font-size: 0.78rem; color: #64748b;">Selecciona una fecha para revisar o anular consumos:</span>
                    </div>

                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 0.8rem; font-weight: 800; color: #475569;">Fecha:</span>
                        <input type="date" 
                               value="${this.selectedConsumptionDate}" 
                               onchange="InventoryView.setConsumptionDate(this.value)"
                               style="background: #eff6ff; border: 1.5px solid #bfdbfe; color: #1e40af; padding: 0.4rem 0.75rem; border-radius: 0.5rem; font-size: 0.85rem; font-weight: 800; outline: none; cursor: pointer;">
                    </div>
                </div>

                <div id="consumptionReportContent">
                    <div style="text-align: center; padding: 2rem; color: #64748b;">Cargando historial de consumos...</div>
                </div>
            </div>
        `;
    },

    // Búsqueda y selección interactiva para Pérdida o Consumo
    setupEgressSearchListeners() {
        const input = document.getElementById('egressSearchInput');
        const results = document.getElementById('egressSearchResults');
        if (!input || !results) return;

        const onKeydown = (e) => {
            const items = results.querySelectorAll('.search-result-item');
            const visible = results.style.display !== 'none' && items.length > 0;
            let selectedIdx = -1;
            items.forEach((it, i) => { if (it.classList.contains('selected')) selectedIdx = i; });

            if (e.key === 'Escape') {
                results.style.display = 'none';
                input.value = '';
                return;
            }
            if (e.key === 'ArrowDown' && visible) {
                e.preventDefault();
                const next = (selectedIdx + 1) % items.length;
                this.highlightEgressResult(next);
                return;
            }
            if (e.key === 'ArrowUp' && visible) {
                e.preventDefault();
                const prev = (selectedIdx <= 0 ? items.length - 1 : selectedIdx - 1);
                this.highlightEgressResult(prev);
                return;
            }
            if (e.key === 'Enter' && visible) {
                e.preventDefault();
                const sel = selectedIdx >= 0 ? items[selectedIdx] : items[0];
                const id = sel && sel.dataset.productId;
                if (id) this.selectEgressProduct(parseInt(id, 10), this.egressSubTab === 'losses' ? 'loss' : 'consumption');
                return;
            }
        };

        input.removeEventListener('keydown', input._egressKeydown);
        input._egressKeydown = onKeydown;
        input.addEventListener('keydown', onKeydown);

        const closeDropdown = (e) => {
            if (results && input && !input.contains(e.target) && !results.contains(e.target)) {
                results.style.display = 'none';
            }
        };
        document.removeEventListener('click', document._egressCloseDropdown);
        document._egressCloseDropdown = closeDropdown;
        document.addEventListener('click', closeDropdown);
    },

    highlightEgressResult(idx) {
        const results = document.getElementById('egressSearchResults');
        if (!results) return;
        const items = results.querySelectorAll('.search-result-item');
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

    handleEgressSearch(e, type) {
        const query = (e.target.value || '').toLowerCase().trim();
        const results = document.getElementById('egressSearchResults');
        if (!results) return;

        if (query.length < 2) {
            results.style.display = 'none';
            results.innerHTML = '';
            return;
        }

        const matches = (this.allProducts || []).filter(p => 
            (p.name || '').toLowerCase().includes(query) || 
            (p.barcode || '').toLowerCase().includes(query)
        ).slice(0, 10);

        if (matches.length === 0) {
            results.innerHTML = '<div style="padding: 0.75rem; color: #64748b; font-size: 0.85rem; text-align: center;">No se encontraron productos</div>';
            results.style.display = 'block';
            return;
        }

        results.innerHTML = matches.map((p, idx) => `
            <div class="search-result-item ${idx === 0 ? 'selected' : ''}" 
                 data-product-id="${p.id}"
                 onclick="InventoryView.selectEgressProduct(${p.id}, '${type}')"
                 style="padding: 0.65rem 0.85rem; cursor: pointer; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; background: ${idx === 0 ? '#f1f5f9' : 'white'};">
                <div>
                    <strong style="color: #0f172a; font-size: 0.9rem;">${safeHTML(p.name)}</strong>
                    <div style="font-size: 0.75rem; color: #64748b; font-family: monospace;">Cód: ${safeHTML(p.barcode || 'S/N')}</div>
                </div>
                <div style="text-align: right; font-size: 0.85rem; font-weight: 800; color: #2563eb;">
                    Stock: ${p.stock} ${p.type === 'weight' ? 'kg' : 'un'}
                </div>
            </div>
        `).join('');
        results.style.display = 'block';
    },

    async selectEgressProduct(productId, type) {
        const results = document.getElementById('egressSearchResults');
        const input = document.getElementById('egressSearchInput');
        if (results) results.style.display = 'none';
        if (input) input.value = '';

        const product = await Product.getById(productId);
        if (!product) return;

        this.selectedEgressProductData = product;
        const panel = document.getElementById('egressSelectedProductPanel');
        if (!panel) return;

        const isWeight = product.type === 'weight';
        const unit = isWeight ? 'kg' : 'un';
        const step = isWeight ? '0.001' : '1';
        const isLoss = type === 'loss';

        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; width: 100%;">
                <div>
                    <strong style="color: #0f172a; font-size: 1rem; display: block;">${safeHTML(product.name)}</strong>
                    <div style="font-size: 0.78rem; color: #64748b;">
                        Stock actual: <strong>${product.stock} ${unit}</strong> | Costo unitario: <strong>${formatCLP(product.cost)}</strong>
                    </div>
                </div>

                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                    <div style="width: 100px;">
                        <input type="number" 
                               id="egressQtyInput" 
                               class="form-control" 
                               placeholder="Cant." 
                               min="${step}" 
                               step="${step}" 
                               value="1"
                               style="height: 38px; font-size: 1rem; font-weight: 800; text-align: center; border-radius: 0.5rem; border: 1.5px solid #cbd5e1;"
                               onkeydown="if(event.key === 'Enter') { event.preventDefault(); InventoryView.saveQuickEgress('${type}'); }"
                               required>
                    </div>

                    <div style="width: 170px;">
                        <input type="text" 
                               id="egressReasonInput" 
                               class="form-control" 
                               placeholder="${isLoss ? 'Motivo (ej: Vencido, Roto)' : 'Motivo (ej: Almuerzo)'}" 
                               style="height: 38px; font-size: 0.85rem; border-radius: 0.5rem; border: 1.5px solid #cbd5e1;"
                               onkeydown="if(event.key === 'Enter') { event.preventDefault(); InventoryView.saveQuickEgress('${type}'); }">
                    </div>

                    <button type="button" 
                            class="btn ${isLoss ? 'btn-danger' : 'btn-primary'}" 
                            onclick="InventoryView.saveQuickEgress('${type}')" 
                            style="height: 38px; font-weight: 900; font-size: 0.85rem; border-radius: 0.5rem; padding: 0 1rem; ${isLoss ? 'background: #dc2626;' : 'background: #2563eb;'}">
                        ${isLoss ? '🗑️ Registrar Pérdida (Enter)' : '🍴 Registrar Consumo (Enter)'}
                    </button>

                    <button type="button" class="btn btn-secondary" onclick="InventoryView.cancelEgressSelection()" style="height: 38px; padding: 0 0.6rem; border-radius: 0.5rem;" title="Cancelar selección (Esc)">
                        ✕
                    </button>
                </div>
            </div>
        `;
        panel.style.display = 'block';

        setTimeout(() => {
            const qtyInp = document.getElementById('egressQtyInput');
            if (qtyInp) {
                qtyInp.focus();
                qtyInp.select();
            }
        }, 80);
    },

    cancelEgressSelection() {
        this.selectedEgressProductData = null;
        const panel = document.getElementById('egressSelectedProductPanel');
        if (panel) panel.style.display = 'none';
        const input = document.getElementById('egressSearchInput');
        if (input) input.focus();
    },

    async saveQuickEgress(type) {
        if (!this.selectedEgressProductData) return;
        const p = this.selectedEgressProductData;
        const qtyInp = document.getElementById('egressQtyInput');
        const reasonInp = document.getElementById('egressReasonInput');

        if (!qtyInp) return;
        const qty = parseFloat(qtyInp.value);
        if (isNaN(qty) || qty <= 0) {
            showNotification('Ingresa una cantidad mayor a 0', 'warning');
            qtyInp.focus();
            return;
        }

        const isLoss = type === 'loss';
        const defaultReason = isLoss ? 'Pérdida registrada manualmente' : 'Consumo interno registrado';
        const reason = (reasonInp?.value || '').trim() || defaultReason;

        // Regla 8: Operaciones Críticas Bajo PIN de Supervisor
        const auth = await SupervisorAuth.requireAuth({
            title: isLoss ? 'Autorización: Registro de Merma / Pérdida' : 'Autorización: Consumo Interno',
            message: `Registrar ${isLoss ? 'una merma de' : 'el consumo de'} ${qty} ${p.type === 'weight' ? 'kg' : 'un'} de "${p.name}" afectará el stock físico del negocio. Ingrese el PIN de Supervisor para autorizar.`
        });
        if (!auth.authorized) {
            showNotification('❌ Operación cancelada o no autorizada.', 'warning');
            return;
        }

        const auditReason = `${reason} (Autorizado por: ${auth.supervisorName})`;

        try {
            if (isLoss) {
                await StockService.createLoss(p.id, qty, auditReason);
                showNotification(`🗑️ Pérdida guardada: -${qty} ${p.type === 'weight' ? 'kg' : 'un'} de "${p.name}"`, 'success');
            } else {
                await StockService.createConsumption(p.id, qty, auditReason);
                showNotification(`🍴 Consumo guardado: -${qty} ${p.type === 'weight' ? 'kg' : 'un'} de "${p.name}"`, 'success');
            }

            if (typeof AuditLogService !== 'undefined') {
                await AuditLogService.log({
                    entity: 'product_stock',
                    entityId: p.id,
                    action: isLoss ? 'REGISTER_LOSS' : 'REGISTER_CONSUMPTION',
                    summary: `${isLoss ? 'Merma' : 'Consumo'} de ${qty} ${p.type === 'weight' ? 'kg' : 'un'} de "${p.name}". Motivo: ${reason}. Autorizado por: ${auth.supervisorName}`,
                    metadata: { productId: p.id, qty, type, reason, authorizedBy: auth.supervisorName }
                });
            }

            this.selectedEgressProductData = null;
            const panel = document.getElementById('egressSelectedProductPanel');
            if (panel) panel.style.display = 'none';

            await this.refreshData();
            if (isLoss) await this.loadLossReport();
            else await this.loadConsumptionReport();
        } catch (error) {
            showNotification('Error al registrar: ' + error.message, 'error');
        }
    },

    // Reportes e historiales de Pérdidas y Consumos
    setLossDate(date) {
        this.selectedLossDate = date;
        this.loadLossReport();
    },

    async loadLossReport() {
        const container = document.getElementById('lossReportContent');
        if (!container) return;

        const targetDate = this.selectedLossDate || new Date().toLocaleDateString('sv-SE');
        const movements = (this.recentMovements || []).filter(m => 
            m.type === 'loss' && (m.date || '').slice(0, 10) === targetDate
        );

        if (movements.length === 0) {
            container.innerHTML = `
                <div style="padding: 2.5rem; text-align: center; color: #64748b;">
                    <div style="font-size: 2.5rem; margin-bottom: 0.5rem; opacity: 0.5;">🎉</div>
                    <strong style="font-size: 1rem; color: #1e293b; display: block;">No hay pérdidas registradas en esta fecha (${targetDate})</strong>
                    <span style="font-size: 0.8rem;">Cero mercadería dañada o vencida en este día.</span>
                </div>
            `;
            return;
        }

        const totalMoney = movements.filter(m => m.status !== 'cancelled').reduce((sum, m) => sum + (parseFloat(m.cost_value) || 0), 0);

        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; background: #fef2f2; padding: 0.6rem 1rem; border-radius: 0.6rem; border: 1px solid #fecaca;">
                <span style="font-size: 0.85rem; color: #991b1b; font-weight: 700;">Total de pérdidas registradas este día:</span>
                <strong style="font-size: 1.15rem; color: #dc2626; font-weight: 900;">-${formatCLP(totalMoney)}</strong>
            </div>

            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr style="background: #f8fafc; border-bottom: 2px solid #cbd5e1; font-size: 0.72rem; text-transform: uppercase; color: #475569; font-weight: 900;">
                            <th style="padding: 0.65rem 0.75rem;">Hora</th>
                            <th style="padding: 0.65rem 0.75rem;">Producto</th>
                            <th style="padding: 0.65rem 0.75rem; text-align: center;">Cantidad</th>
                            <th style="padding: 0.65rem 0.75rem; text-align: right;">Costo Perdido</th>
                            <th style="padding: 0.65rem 0.75rem;">Motivo</th>
                            <th style="padding: 0.65rem 0.75rem;">Usuario</th>
                            <th style="padding: 0.65rem 0.75rem; text-align: center;">Estado</th>
                            <th style="padding: 0.65rem 0.75rem; text-align: right;">Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${movements.map(m => {
                            const p = (this.allProducts || []).find(prod => prod.id === m.productId);
                            const name = p ? p.name : (m.productName || 'Producto');
                            const unit = p && p.type === 'weight' ? 'kg' : 'un';
                            const isCancelled = m.status === 'cancelled';
                            const timeStr = new Date(m.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                            return `
                                <tr style="border-bottom: 1px solid #e2e8f0; font-size: 0.85rem; ${isCancelled ? 'opacity: 0.6; background: #f8fafc;' : ''}">
                                    <td style="padding: 0.65rem 0.75rem; color: #64748b; font-weight: 600;">${timeStr}</td>
                                    <td style="padding: 0.65rem 0.75rem;"><strong style="color: #0f172a;">${safeHTML(name)}</strong></td>
                                    <td style="padding: 0.65rem 0.75rem; text-align: center; font-weight: 900; color: #dc2626;">
                                        -${Math.abs(m.quantity)} ${unit}
                                    </td>
                                    <td style="padding: 0.65rem 0.75rem; text-align: right; font-weight: 800; color: #dc2626;">
                                        -${formatCLP(m.cost_value || 0)}
                                    </td>
                                    <td style="padding: 0.65rem 0.75rem; color: #475569;">${safeHTML(m.reason || '—')}</td>
                                    <td style="padding: 0.65rem 0.75rem; color: #64748b; font-size: 0.8rem;">${safeHTML(m.userName || 'Sistema')}</td>
                                    <td style="padding: 0.65rem 0.75rem; text-align: center;">
                                        ${isCancelled 
                                            ? '<span style="background: #fee2e2; color: #dc2626; padding: 0.15rem 0.45rem; border-radius: 0.35rem; font-size: 0.68rem; font-weight: 900;">ANULADO</span>'
                                            : '<span style="background: #dcfce7; color: #15803d; padding: 0.15rem 0.45rem; border-radius: 0.35rem; font-size: 0.68rem; font-weight: 900;">ACTIVO</span>'}
                                    </td>
                                    <td style="padding: 0.65rem 0.75rem; text-align: right;">
                                        ${!isCancelled ? `
                                            <button class="btn btn-sm btn-secondary" onclick="InventoryView.promptCancelMovement(${m.id}, 'loss')" style="padding: 0.25rem 0.6rem; font-size: 0.75rem; font-weight: 800; border-radius: 0.4rem; color: #dc2626; border-color: #fecaca;" title="Anular pérdida y devolver stock">
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

    setConsumptionDate(date) {
        this.selectedConsumptionDate = date;
        this.loadConsumptionReport();
    },

    async loadConsumptionReport() {
        const container = document.getElementById('consumptionReportContent');
        if (!container) return;

        const targetDate = this.selectedConsumptionDate || new Date().toLocaleDateString('sv-SE');
        const movements = (this.recentMovements || []).filter(m => 
            m.type === 'consumption' && (m.date || '').slice(0, 10) === targetDate
        );

        if (movements.length === 0) {
            container.innerHTML = `
                <div style="padding: 2.5rem; text-align: center; color: #64748b;">
                    <div style="font-size: 2.5rem; margin-bottom: 0.5rem; opacity: 0.5;">🍽️</div>
                    <strong style="font-size: 1rem; color: #1e293b; display: block;">No hay consumos registrados en esta fecha (${targetDate})</strong>
                    <span style="font-size: 0.8rem;">No se registraron productos para uso de la casa en este día.</span>
                </div>
            `;
            return;
        }

        const totalMoney = movements.filter(m => m.status !== 'cancelled').reduce((sum, m) => sum + (parseFloat(m.cost_value) || 0), 0);

        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; background: #eff6ff; padding: 0.6rem 1rem; border-radius: 0.6rem; border: 1px solid #bfdbfe;">
                <span style="font-size: 0.85rem; color: #1e40af; font-weight: 700;">Total de consumo del local este día:</span>
                <strong style="font-size: 1.15rem; color: #2563eb; font-weight: 900;">${formatCLP(totalMoney)}</strong>
            </div>

            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr style="background: #f8fafc; border-bottom: 2px solid #cbd5e1; font-size: 0.72rem; text-transform: uppercase; color: #475569; font-weight: 900;">
                            <th style="padding: 0.65rem 0.75rem;">Hora</th>
                            <th style="padding: 0.65rem 0.75rem;">Producto</th>
                            <th style="padding: 0.65rem 0.75rem; text-align: center;">Cantidad</th>
                            <th style="padding: 0.65rem 0.75rem; text-align: right;">Costo</th>
                            <th style="padding: 0.65rem 0.75rem;">Motivo</th>
                            <th style="padding: 0.65rem 0.75rem;">Usuario</th>
                            <th style="padding: 0.65rem 0.75rem; text-align: center;">Estado</th>
                            <th style="padding: 0.65rem 0.75rem; text-align: right;">Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${movements.map(m => {
                            const p = (this.allProducts || []).find(prod => prod.id === m.productId);
                            const name = p ? p.name : (m.productName || 'Producto');
                            const unit = p && p.type === 'weight' ? 'kg' : 'un';
                            const isCancelled = m.status === 'cancelled';
                            const timeStr = new Date(m.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                            return `
                                <tr style="border-bottom: 1px solid #e2e8f0; font-size: 0.85rem; ${isCancelled ? 'opacity: 0.6; background: #f8fafc;' : ''}">
                                    <td style="padding: 0.65rem 0.75rem; color: #64748b; font-weight: 600;">${timeStr}</td>
                                    <td style="padding: 0.65rem 0.75rem;"><strong style="color: #0f172a;">${safeHTML(name)}</strong></td>
                                    <td style="padding: 0.65rem 0.75rem; text-align: center; font-weight: 900; color: #2563eb;">
                                        -${Math.abs(m.quantity)} ${unit}
                                    </td>
                                    <td style="padding: 0.65rem 0.75rem; text-align: right; font-weight: 800; color: #2563eb;">
                                        ${formatCLP(m.cost_value || 0)}
                                    </td>
                                    <td style="padding: 0.65rem 0.75rem; color: #475569;">${safeHTML(m.reason || '—')}</td>
                                    <td style="padding: 0.65rem 0.75rem; color: #64748b; font-size: 0.8rem;">${safeHTML(m.userName || 'Sistema')}</td>
                                    <td style="padding: 0.65rem 0.75rem; text-align: center;">
                                        ${isCancelled 
                                            ? '<span style="background: #fee2e2; color: #dc2626; padding: 0.15rem 0.45rem; border-radius: 0.35rem; font-size: 0.68rem; font-weight: 900;">ANULADO</span>'
                                            : '<span style="background: #dcfce7; color: #15803d; padding: 0.15rem 0.45rem; border-radius: 0.35rem; font-size: 0.68rem; font-weight: 900;">ACTIVO</span>'}
                                    </td>
                                    <td style="padding: 0.65rem 0.75rem; text-align: right;">
                                        ${!isCancelled ? `
                                            <button class="btn btn-sm btn-secondary" onclick="InventoryView.promptCancelMovement(${m.id}, 'consumption')" style="padding: 0.25rem 0.6rem; font-size: 0.75rem; font-weight: 800; border-radius: 0.4rem; color: #dc2626; border-color: #fecaca;" title="Anular consumo y devolver stock">
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

    // Anulación auditada limpia (Cero Borrado Destructivo, devuelve stock automáticamente)
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
        const name = p ? p.name : 'Producto';
        const qty = Math.abs(movement.quantity);
        const unit = p && p.type === 'weight' ? 'kg' : 'un.';
        const isLoss = type === 'loss';

        const content = `
            <div style="text-align: center; margin-bottom: 1.25rem;">
                <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">${isLoss ? '🗑️' : '🍴'}</div>
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

        // Regla 8: Operaciones Críticas Bajo PIN de Supervisor
        const auth = await SupervisorAuth.requireAuth({
            title: `Autorización: Anulación de ${type === 'loss' ? 'Merma / Pérdida' : 'Consumo'}`,
            message: `Anular este registro devolverá ${Math.abs(movement.quantity)} unidades al inventario. Ingrese el PIN de Supervisor para autorizar.`
        });
        if (!auth.authorized) {
            showNotification('❌ Anulación cancelada o no autorizada.', 'warning');
            return;
        }

        closeModal();

        try {
            let currentUserName = auth.supervisorName || 'Usuario';
            try {
                if (typeof AuthManager !== 'undefined' && AuthManager.getCurrentUser) {
                    const u = AuthManager.getCurrentUser();
                    if (u) currentUserName = u.name || u.username;
                }
            } catch (_) {}

            const qtyToReturn = Math.abs(movement.quantity);
            const p = (this.allProducts || []).find(prod => prod.id === movement.productId);
            const unit = p && p.type === 'weight' ? 'kg' : 'un.';

            // 1. Devolver stock atómicamente
            await StockService.createAdjustment(movement.productId, qtyToReturn, `Reversión por anulación de ${type === 'loss' ? 'pérdida' : 'consumo'}: ${reason} (Autorizado por: ${auth.supervisorName})`);

            // 2. Marcar movimiento como cancelado manteniendo trazabilidad
            await StockMovement.update(id, {
                status: 'cancelled',
                cancelledAt: new Date().toISOString(),
                cancelledBy: `${currentUserName} (Autorizado por: ${auth.supervisorName})`,
                cancelReason: reason
            });

            if (typeof AuditLogService !== 'undefined') {
                await AuditLogService.log({
                    entity: 'stock_movement',
                    entityId: id,
                    action: 'CANCEL_STOCK_MOVEMENT',
                    summary: `Anulación de ${type === 'loss' ? 'merma' : 'consumo'} (#${id}) reintegrando +${qtyToReturn} ${unit} a producto #${movement.productId}. Motivo: ${reason}. Autorizado por: ${auth.supervisorName}`,
                    metadata: { movementId: id, productId: movement.productId, qty: qtyToReturn, type, authorizedBy: auth.supervisorName }
                });
            }

            showNotification(`✅ Registro anulado. Se reintegraron +${qtyToReturn} ${unit} al inventario.`, 'success');
            await this.refreshData();
            if (type === 'loss') await this.loadLossReport();
            else await this.loadConsumptionReport();
        } catch (error) {
            showNotification('Error al anular registro: ' + error.message, 'error');
        }
    },

    // Sub-pestaña 3: Registro Masivo
    renderBulkAdjustmentForm() {
        return `
            <div class="card" style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 1.25rem; padding: 1.5rem; margin-bottom: 1.25rem;">
                <div style="border-bottom: 1.5px solid #f1f5f9; padding-bottom: 0.75rem; margin-bottom: 1.25rem;">
                    <h3 style="margin: 0; color: #0f172a; font-size: 1.15rem; font-weight: 900; display: flex; align-items: center; gap: 0.5rem;">
                        <span>⚡</span> Registro Masivo de Mermas o Consumos
                    </h3>
                    <p style="margin: 0.25rem 0 0 0; color: #64748b; font-size: 0.85rem;">Agrega varios productos a una lista y descuéntalos de una sola vez.</p>
                </div>

                <!-- 1. Tipo de Registro -->
                <div style="margin-bottom: 1.25rem;">
                    <label style="color: #475569; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; display: block; margin-bottom: 0.4rem;">1. Selecciona el Tipo de Movimiento:</label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                        <button type="button" 
                                onclick="InventoryView.setBulkMovementType('consumption')" 
                                class="btn" 
                                style="height: 48px; font-weight: 800; border-radius: 0.65rem; border: 2px solid ${this.selectedBulkType === 'consumption' ? '#2563eb' : '#cbd5e1'}; background: ${this.selectedBulkType === 'consumption' ? '#eff6ff' : '#ffffff'}; color: ${this.selectedBulkType === 'consumption' ? '#1e40af' : '#475569'};">
                            🍴 Consumo del Local
                        </button>
                        <button type="button" 
                                onclick="InventoryView.setBulkMovementType('loss')" 
                                class="btn" 
                                style="height: 48px; font-weight: 800; border-radius: 0.65rem; border: 2px solid ${this.selectedBulkType === 'loss' ? '#dc2626' : '#cbd5e1'}; background: ${this.selectedBulkType === 'loss' ? '#fef2f2' : '#ffffff'}; color: ${this.selectedBulkType === 'loss' ? '#991b1b' : '#475569'};">
                            🗑️ Pérdida / Merma
                        </button>
                    </div>
                </div>

                <!-- 2. Buscador de Productos -->
                <div style="margin-bottom: 1.25rem;">
                    <label style="color: #475569; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; display: block; margin-bottom: 0.4rem;">2. Busca y agrega los productos:</label>
                    <div style="position: relative;">
                        <input type="text" 
                               id="bulkSearchInput" 
                               class="form-control" 
                               placeholder="🔍 Escribe nombre o pasa la pistola lectora de código de barras..." 
                               oninput="InventoryView.handleBulkSearch(event)"
                               style="height: 46px; font-size: 0.95rem; font-weight: 700; border: 2px solid #3b82f6; border-radius: 0.65rem; padding-left: 1rem;">
                        <div id="bulkSearchResults" class="search-results" style="display: none; position: absolute; width: 100%; z-index: 100; background: white; border: 1.5px solid #cbd5e1; border-radius: 0.65rem; max-height: 250px; overflow-y: auto; box-shadow: 0 10px 25px rgba(0,0,0,0.1);"></div>
                    </div>
                </div>

                <!-- 3. Lista de Productos Seleccionados -->
                <div id="bulkSelectedProductsWrapper" style="margin-bottom: 1.25rem;">
                    <!-- Se llena con updateBulkSelectedProductsUI -->
                </div>

                <!-- 4. Motivo y Guardar -->
                <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 0.85rem; padding: 1rem;">
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label style="color: #334155; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; display: block; margin-bottom: 0.35rem;">3. Motivo general del ajuste:</label>
                        <input type="text" 
                               id="bulkReasonInput" 
                               class="form-control" 
                               placeholder="Ej: Mermas del fin de semana, limpieza mensual..."
                               value="Ajuste masivo de inventario"
                               style="height: 40px; font-size: 0.9rem; border-radius: 0.6rem; border: 1.5px solid #cbd5e1;">
                    </div>

                    <div style="display: flex; gap: 0.75rem;">
                        <button type="button" class="btn btn-secondary" onclick="InventoryView.resetBulkForm()" style="flex: 1; height: 44px; font-weight: 800; border-radius: 0.65rem;">
                            ✕ Limpiar Todo
                        </button>
                        <button type="button" class="btn btn-primary" onclick="InventoryView.saveBulkAdjustment()" style="flex: 2; height: 44px; font-weight: 900; border-radius: 0.65rem; background: #2563eb;">
                            💾 Guardar Ajuste Masivo
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    setBulkMovementType(type) {
        this.selectedBulkType = type;
        this.switchSection('egress', 'bulk');
    },

    setupBulkSearchListeners() {
        const input = document.getElementById('bulkSearchInput');
        const results = document.getElementById('bulkSearchResults');
        if (!input || !results) return;

        const onKeydown = (e) => {
            const items = results.querySelectorAll('.search-result-item');
            const visible = results.style.display !== 'none' && items.length > 0;
            let selectedIdx = -1;
            items.forEach((it, i) => { if (it.classList.contains('selected')) selectedIdx = i; });

            if (e.key === 'Escape') {
                results.style.display = 'none';
                input.value = '';
                return;
            }
            if (e.key === 'ArrowDown' && visible) {
                e.preventDefault();
                const next = (selectedIdx + 1) % items.length;
                this.highlightBulkResult(next);
                return;
            }
            if (e.key === 'ArrowUp' && visible) {
                e.preventDefault();
                const prev = (selectedIdx <= 0 ? items.length - 1 : selectedIdx - 1);
                this.highlightBulkResult(prev);
                return;
            }
            if (e.key === 'Enter' && visible) {
                e.preventDefault();
                const sel = selectedIdx >= 0 ? items[selectedIdx] : items[0];
                const id = sel && sel.dataset.productId;
                if (id) this.addProductToBulk(parseInt(id, 10));
                return;
            }
        };

        input.removeEventListener('keydown', input._bulkKeydown);
        input._bulkKeydown = onKeydown;
        input.addEventListener('keydown', onKeydown);

        const closeDropdown = (e) => {
            if (results && input && !input.contains(e.target) && !results.contains(e.target)) {
                results.style.display = 'none';
            }
        };
        document.removeEventListener('click', document._bulkCloseDropdown);
        document._bulkCloseDropdown = closeDropdown;
        document.addEventListener('click', closeDropdown);
    },

    highlightBulkResult(idx) {
        const results = document.getElementById('bulkSearchResults');
        if (!results) return;
        const items = results.querySelectorAll('.search-result-item');
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

    handleBulkSearch(e) {
        const query = (e.target.value || '').toLowerCase().trim();
        const results = document.getElementById('bulkSearchResults');
        if (!results) return;

        if (query.length < 2) {
            results.style.display = 'none';
            results.innerHTML = '';
            return;
        }

        const matches = (this.allProducts || []).filter(p => 
            (p.name || '').toLowerCase().includes(query) || 
            (p.barcode || '').toLowerCase().includes(query)
        ).slice(0, 10);

        if (matches.length === 0) {
            results.innerHTML = '<div style="padding: 0.75rem; color: #64748b; font-size: 0.85rem; text-align: center;">No se encontraron productos</div>';
            results.style.display = 'block';
            return;
        }

        results.innerHTML = matches.map((p, idx) => `
            <div class="search-result-item ${idx === 0 ? 'selected' : ''}" 
                 data-product-id="${p.id}"
                 onclick="InventoryView.addProductToBulk(${p.id})"
                 style="padding: 0.65rem 0.85rem; cursor: pointer; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; background: ${idx === 0 ? '#f1f5f9' : 'white'};">
                <div>
                    <strong style="color: #0f172a; font-size: 0.9rem;">${safeHTML(p.name)}</strong>
                    <div style="font-size: 0.75rem; color: #64748b; font-family: monospace;">Cód: ${safeHTML(p.barcode || 'S/N')}</div>
                </div>
                <div style="text-align: right; font-size: 0.85rem; font-weight: 800; color: #2563eb;">
                    Stock: ${p.stock} ${p.type === 'weight' ? 'kg' : 'un'}
                </div>
            </div>
        `).join('');
        results.style.display = 'block';
    },

    async addProductToBulk(productId) {
        const results = document.getElementById('bulkSearchResults');
        const input = document.getElementById('bulkSearchInput');
        if (results) results.style.display = 'none';
        if (input) input.value = '';

        const product = await Product.getById(productId);
        if (!product) return;

        const existing = this.selectedProducts.find(p => p.id === productId);
        if (existing) {
            existing.quantity = Math.round((existing.quantity + 1) * 1000) / 1000;
            this.updateBulkSelectedProductsUI();
            showNotification(`+${product.name}: Cantidad sumada (${existing.quantity})`, 'info');
            return;
        }

        this.selectedProducts.push({
            id: product.id,
            name: product.name,
            barcode: product.barcode,
            stock: product.stock,
            type: product.type || 'unit',
            quantity: 1,
            cost: parseFloat(product.cost) || 0
        });

        this.updateBulkSelectedProductsUI();
        showNotification(`${product.name} agregado a la lista`, 'success');
    },

    updateBulkSelectedProductsUI() {
        const wrapper = document.getElementById('bulkSelectedProductsWrapper');
        if (!wrapper) return;

        if (this.selectedProducts.length === 0) {
            wrapper.innerHTML = `
                <div style="padding: 2.5rem; text-align: center; background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 0.75rem; color: #64748b;">
                    <div style="font-size: 2.5rem; margin-bottom: 0.5rem; opacity: 0.4;">🛒</div>
                    <strong style="font-size: 0.95rem; color: #1e293b; display: block;">Aún no has agregado productos a la lista</strong>
                    <span style="font-size: 0.8rem;">Usa el buscador de arriba para agregar los artículos a descontar.</span>
                </div>
            `;
            return;
        }

        const rows = this.selectedProducts.map((p, idx) => {
            const isWeight = p.type === 'weight';
            const step = isWeight ? '0.001' : '1';
            return `
                <tr style="border-bottom: 1px solid #e2e8f0; font-size: 0.85rem;">
                    <td style="padding: 0.65rem 0.75rem;">
                        <strong style="color: #0f172a;">${safeHTML(p.name)}</strong>
                        <small style="color: #64748b; display: block;">Stock actual: ${p.stock} ${isWeight ? 'kg' : 'un'}</small>
                    </td>
                    <td style="padding: 0.65rem 0.75rem; text-align: center; width: 140px;">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 0.25rem;">
                            <button type="button" class="btn btn-sm btn-secondary" onclick="InventoryView.stepBulkQuantity(${idx}, -1)" style="padding: 0.2rem 0.5rem; font-weight: 800;">-</button>
                            <input type="number" 
                                   value="${p.quantity}" 
                                   step="${step}" 
                                   min="${step}" 
                                   onchange="InventoryView.updateBulkItemQuantity(${idx}, this.value)"
                                   style="width: 70px; height: 32px; text-align: center; font-weight: 800; border-radius: 0.4rem; border: 1.5px solid #cbd5e1;">
                            <button type="button" class="btn btn-sm btn-secondary" onclick="InventoryView.stepBulkQuantity(${idx}, 1)" style="padding: 0.2rem 0.5rem; font-weight: 800;">+</button>
                        </div>
                    </td>
                    <td style="padding: 0.65rem 0.75rem; text-align: right; font-weight: 800; color: #475569; width: 110px;">
                        ${formatCLP(p.cost * p.quantity)}
                    </td>
                    <td style="padding: 0.65rem 0.75rem; text-align: right; width: 60px;">
                        <button type="button" class="btn btn-sm btn-secondary" onclick="InventoryView.removeProductFromBulk(${idx})" style="color: #dc2626; border-color: #fecaca; font-weight: 800;" title="Quitar de la lista">
                            ✕
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        wrapper.innerHTML = `
            <div style="border: 1.5px solid #e2e8f0; border-radius: 0.75rem; overflow: hidden; background: white;">
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                    <thead style="background: #f8fafc; border-bottom: 2px solid #cbd5e1;">
                        <tr style="font-size: 0.72rem; text-transform: uppercase; color: #475569; font-weight: 900;">
                            <th style="padding: 0.6rem 0.75rem;">Producto</th>
                            <th style="padding: 0.6rem 0.75rem; text-align: center;">Cantidad a Descontar</th>
                            <th style="padding: 0.6rem 0.75rem; text-align: right;">Costo Total</th>
                            <th style="padding: 0.6rem 0.75rem; text-align: right;">Quitar</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    },

    stepBulkQuantity(idx, delta) {
        if (!this.selectedProducts[idx]) return;
        const p = this.selectedProducts[idx];
        const step = p.type === 'weight' ? 0.5 : 1;
        p.quantity = Math.max(step, Math.round((p.quantity + delta * step) * 1000) / 1000);
        this.updateBulkSelectedProductsUI();
    },

    updateBulkItemQuantity(idx, val) {
        if (!this.selectedProducts[idx]) return;
        const q = parseFloat(val);
        this.selectedProducts[idx].quantity = (isNaN(q) || q <= 0) ? 1 : q;
        this.updateBulkSelectedProductsUI();
    },

    removeProductFromBulk(idx) {
        this.selectedProducts.splice(idx, 1);
        this.updateBulkSelectedProductsUI();
    },

    resetBulkForm() {
        this.selectedProducts = [];
        this.updateBulkSelectedProductsUI();
        const input = document.getElementById('bulkSearchInput');
        if (input) input.value = '';
    },

    async saveBulkAdjustment() {
        if (this.selectedProducts.length === 0) {
            showNotification('Agrega al menos un producto a la lista', 'warning');
            return;
        }

        const reasonInp = document.getElementById('bulkReasonInput');
        const reason = (reasonInp?.value || '').trim() || 'Ajuste masivo de stock';
        const type = this.selectedBulkType || 'consumption';

        // Regla 8: Operaciones Críticas Bajo PIN de Supervisor
        const auth = await SupervisorAuth.requireAuth({
            title: `Autorización: Ajuste Masivo (${type === 'loss' ? 'Mermas' : 'Consumos'})`,
            message: `El ajuste masivo de ${this.selectedProducts.length} productos descontará unidades del inventario. Ingrese el PIN de Supervisor para autorizar.`
        });
        if (!auth.authorized) {
            showNotification('❌ Ajuste masivo cancelado o no autorizado.', 'warning');
            return;
        }

        const auditReason = `${reason} (Autorizado por: ${auth.supervisorName})`;

        try {
            await StockService.applyBulkAdjustmentAtomic(this.selectedProducts, type, auditReason);

            if (typeof AuditLogService !== 'undefined') {
                await AuditLogService.log({
                    entity: 'product_stock',
                    entityId: null,
                    action: 'BULK_STOCK_ADJUSTMENT',
                    summary: `Ajuste masivo de ${this.selectedProducts.length} productos (${type}). Motivo: ${reason}. Autorizado por: ${auth.supervisorName}`,
                    metadata: { count: this.selectedProducts.length, type, reason, authorizedBy: auth.supervisorName }
                });
            }

            showNotification(`✅ Ajuste masivo guardado (${this.selectedProducts.length} productos descontados)`, 'success');
            this.resetBulkForm();
            await this.refreshData();
            if (type === 'loss') this.switchEgressSubTab('losses');
            else this.switchEgressSubTab('consumptions');
        } catch (error) {
            showNotification('Error al guardar ajuste masivo: ' + error.message, 'error');
        }
    },

    // =========================================================================
    // 6. SECCIÓN 3: CONTEO FÍSICO / TOMA DE INVENTARIO (DISEÑO BLANCO EJECUTIVO)
    // =========================================================================

    renderAuditSection() {
        if (!this.auditState) {
            const categories = this.categories || [];
            const historyHtml = (this.auditHistory || []).map((log, idx) => {
                const loss = log.metadata?.lossMoney || 0;
                const extra = log.metadata?.extraMoney || 0;
                return `
                    <div onclick="InventoryView.openAuditHistoryDetail(${idx})"
                         style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 0.75rem; padding: 1rem; margin-bottom: 0.75rem; cursor: pointer; transition: all 0.2s;"
                         onmouseover="this.style.borderColor='#3b82f6'; this.style.transform='translateY(-2px)';"
                         onmouseout="this.style.borderColor='#e2e8f0'; this.style.transform='translateY(0)';">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong style="color: #0f172a; font-size: 0.95rem;">${safeHTML(log.metadata?.categoryName || 'Desconocida')}</strong>
                                <small style="color: #64748b; display: block; font-size: 0.78rem;">${formatDateTime(log.timestamp)}</small>
                            </div>
                            <div style="text-align: right;">
                                ${loss > 0 ? `<div style="color: #dc2626; font-weight: 900; font-size: 0.95rem;">-${formatCLP(loss)}</div>` : ''}
                                ${extra > 0 ? `<div style="color: #16a34a; font-weight: 900; font-size: 0.95rem;">+${formatCLP(extra)}</div>` : ''}
                                ${loss === 0 && extra === 0 ? '<div style="color: #16a34a; font-weight: 900; font-size: 0.85rem;">✅ Cuadrado</div>' : ''}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <div class="card" style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 1.25rem; padding: 2rem;">
                    <div style="text-align: center; max-width: 800px; margin: 0 auto 2.5rem auto;">
                        <div style="font-size: 3rem; margin-bottom: 0.5rem;">📋</div>
                        <h2 style="font-size: 1.75rem; font-weight: 900; color: #0f172a; margin: 0;">Conteo Físico de Mercadería en Local</h2>
                        <p style="color: #64748b; font-size: 0.95rem; margin-top: 0.25rem;">Cuenta los productos reales en tus estantes y sincroniza el sistema en minutos.</p>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; max-width: 1000px; margin: 0 auto;">
                        <!-- Columna Izquierda: Instrucciones y Selector -->
                        <div>
                            <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 1rem; padding: 1.25rem; margin-bottom: 1.25rem;">
                                <h4 style="color: #2563eb; margin: 0 0 0.5rem 0; font-size: 0.9rem; font-weight: 900; text-transform: uppercase;">
                                    Guía en 3 Pasos:
                                </h4>
                                <ol style="color: #475569; font-size: 0.85rem; line-height: 1.5; margin: 0; padding-left: 1.25rem;">
                                    <li>Selecciona una categoría para contar (ej: Bebidas).</li>
                                    <li>Ingresa la cantidad física real de cada artículo.</li>
                                    <li>Confirma: el sistema ajustará automáticamente diferencias.</li>
                                </ol>
                            </div>

                            <div class="form-group" style="margin-bottom: 1.25rem;">
                                <label style="font-size: 0.85rem; font-weight: 800; color: #334155; display: block; margin-bottom: 0.5rem;">Categoría a Contar:</label>
                                <select id="auditCategorySelect" class="form-control" style="height: 48px; font-size: 1.05rem; font-weight: 700; border-radius: 0.75rem; border: 2px solid #3b82f6;">
                                    <option value="">-- Seleccionar Categoría --</option>
                                    ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
                                </select>
                            </div>

                            <button class="btn btn-primary" onclick="InventoryView.startAudit()" style="width: 100%; height: 50px; font-size: 1.1rem; font-weight: 900; border-radius: 0.75rem; background: #2563eb;">
                                🚀 Iniciar Conteo Ahora
                            </button>
                        </div>

                        <!-- Columna Derecha: Controles Previos -->
                        <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 1rem; padding: 1.25rem;">
                            <h4 style="color: #475569; margin: 0 0 1rem 0; font-size: 0.85rem; font-weight: 900; text-transform: uppercase;">
                                🕒 Controles Anteriores Realizados
                            </h4>
                            <div style="max-height: 280px; overflow-y: auto;">
                                ${historyHtml || '<div style="padding: 2rem; text-align: center; color: #94a3b8; font-size: 0.85rem;">Aún no hay controles finalizados</div>'}
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
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #f1f5f9; padding-bottom: 1rem; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.5rem;">
                        <div>
                            <h2 style="margin: 0; color: #0f172a; font-size: 1.35rem; font-weight: 900; display: flex; align-items: center; gap: 0.5rem;">
                                <span>📦</span> Conteo en Vivo: ${this.auditState.categoryName}
                            </h2>
                            <div style="font-size: 0.82rem; color: #64748b; margin-top: 0.2rem;">
                                Progreso: ${total - uncounted} de ${total} productos (${progress.toFixed(0)}%)
                            </div>
                        </div>

                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-secondary" onclick="InventoryView.cancelAudit()" style="font-weight: 800;">
                                Abandonar Conteo
                            </button>
                            <button class="btn btn-primary" onclick="InventoryView.finishAudit()" style="font-weight: 900; background: #2563eb;">
                                📊 Finalizar y Ver Reporte
                            </button>
                        </div>
                    </div>

                    <div style="max-height: 55vh; overflow-y: auto; border: 1.5px solid #e2e8f0; border-radius: 0.75rem;">
                        <table style="width: 100%; border-collapse: collapse; text-align: left;">
                            <thead style="position: sticky; top: 0; background: #f8fafc; border-bottom: 2px solid #cbd5e1;">
                                <tr style="font-size: 0.72rem; text-transform: uppercase; color: #475569; font-weight: 900;">
                                    <th style="padding: 0.65rem 0.75rem;">Producto</th>
                                    <th style="padding: 0.65rem 0.75rem; text-align: center;">Stock en Sistema</th>
                                    <th style="padding: 0.65rem 0.75rem; text-align: center;">Conteo Físico Real</th>
                                    <th style="padding: 0.65rem 0.75rem; text-align: center;">Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.auditState.items.map((item, index) => {
                                    const diff = (item.physicalCount || 0) - item.systemStock;
                                    const isWeight = item.type === 'weight';
                                    const step = isWeight ? '0.001' : '1';
                                    return `
                                        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 0.85rem; ${item.counted ? 'background: #f8fafc;' : ''}">
                                            <td style="padding: 0.65rem 0.75rem;">
                                                <strong style="color: #0f172a;">${safeHTML(item.name)}</strong>
                                                <small style="color: #64748b; font-family: monospace; display: block;">Cód: ${safeHTML(item.barcode || 'S/N')}</small>
                                            </td>
                                            <td style="padding: 0.65rem 0.75rem; text-align: center; font-weight: 800; color: #475569;">
                                                ${item.systemStock}
                                            </td>
                                            <td style="padding: 0.65rem 0.75rem; text-align: center; width: 150px;">
                                                <input type="number" 
                                                       step="${step}" 
                                                       min="0"
                                                       class="form-control" 
                                                       value="${item.counted ? item.physicalCount : ''}" 
                                                       placeholder="?"
                                                       oninput="InventoryView.updateAuditPhysicalCount(${item.id}, this.value)" 
                                                       onkeydown="if(event.key === 'Enter') { event.preventDefault(); InventoryView.focusNextAuditInput(${index}); }"
                                                       style="width: 100px; height: 38px; text-align: center; font-size: 1.1rem; font-weight: 900; border-radius: 0.5rem; border: 2px solid ${item.counted ? '#10b981' : '#cbd5e1'}; margin: 0 auto;"
                                                       ${index === 0 ? 'autofocus' : ''}>
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

        // Modo Reporte de Discrepancias
        if (this.auditState.status === 'report') {
            const missing = this.auditState.items.filter(i => (i.physicalCount || 0) < i.systemStock);
            const extra = this.auditState.items.filter(i => (i.physicalCount || 0) > i.systemStock);
            const lossMoney = missing.reduce((sum, i) => sum + ((i.systemStock - (i.physicalCount || 0)) * (parseFloat(i.cost) || 0)), 0);
            const extraMoney = extra.reduce((sum, i) => sum + (((i.physicalCount || 0) - i.systemStock) * (parseFloat(i.cost) || 0)), 0);

            return `
                <div class="card" style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 1.25rem; padding: 2rem;">
                    <div style="text-align: center; margin-bottom: 2rem;">
                        <h2 style="font-size: 1.6rem; font-weight: 900; color: #0f172a; margin: 0;">Resumen del Control: ${this.auditState.categoryName}</h2>
                        <p style="color: #64748b; font-size: 0.9rem; margin-top: 0.25rem;">Revisa las diferencias antes de sincronizar el inventario con el sistema.</p>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
                        <!-- Faltantes -->
                        <div style="background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 1rem; padding: 1.25rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                                <strong style="color: #991b1b; font-size: 1rem;">🚨 Faltantes (${missing.length})</strong>
                                <span style="background: #dc2626; color: white; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.8rem; font-weight: 900;">-${formatCLP(lossMoney)}</span>
                            </div>
                            <div style="max-height: 250px; overflow-y: auto;">
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
                                <strong style="color: #166534; font-size: 1rem;">✅ Sobrantes (${extra.length})</strong>
                                <span style="background: #16a34a; color: white; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.8rem; font-weight: 900;">+${formatCLP(extraMoney)}</span>
                            </div>
                            <div style="max-height: 250px; overflow-y: auto;">
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

                    <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                        <button class="btn btn-secondary" onclick="InventoryView.backToCounting()" style="font-weight: 800;">
                            ◀ Volver al Conteo
                        </button>
                        <button class="btn btn-primary" onclick="InventoryView.applyAuditAdjustments()" style="font-weight: 900; background: #16a34a; padding: 0.75rem 1.5rem;">
                            ✅ Sincronizar Stock en Sistema
                        </button>
                    </div>
                </div>
            `;
        }

        return '';
    },

    startAudit() {
        const select = document.getElementById('auditCategorySelect');
        const cat = select ? select.value : '';
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
            systemStock: parseFloat(p.stock) || 0,
            physicalCount: null,
            counted: false
        }));

        if (items.length === 0) {
            showNotification('No hay productos en esta categoría', 'warning');
            return;
        }

        this.auditState = {
            categoryName: cat,
            status: 'counting',
            items: items
        };

        this.switchSection('audit');
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

    focusNextAuditInput(currentIndex) {
        const inputs = document.querySelectorAll('#inventory-section-content input[type="number"]');
        if (inputs && inputs[currentIndex + 1]) {
            inputs[currentIndex + 1].focus();
            inputs[currentIndex + 1].select();
        }
    },

    finishAudit() {
        if (!this.auditState) return;
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
                <p style="font-size: 1rem; margin-bottom: 1.5rem; color: #1e293b;">¿Deseas abandonar el conteo de inventario? Perderás el progreso actual.</p>
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

    async applyAuditAdjustments() {
        if (!this.auditState) return;
        const diffs = this.auditState.items.filter(i => i.physicalCount !== i.systemStock);

        if (diffs.length === 0) {
            showNotification('✨ ¡Felicidades! Todo tu stock físico cuadró exactamente con el sistema.', 'success');
            this.auditState = null;
            this.switchSection('audit');
            return;
        }

        try {
            const reason = `Ajuste por Conteo Físico: ${this.auditState.categoryName}`;
            for (const item of diffs) {
                const delta = item.physicalCount - item.systemStock;
                const type = delta < 0 ? 'loss' : 'adjustment';
                await StockService.setStock(item.id, item.physicalCount, `${reason} (${delta < 0 ? 'Faltante' : 'Sobrante'})`, type);
            }

            // Registrar en historial de auditorías
            await AuditLogService.log({
                entity: 'category_audit',
                entityId: 0,
                action: 'finish',
                summary: `Conteo completado: ${this.auditState.categoryName}`,
                metadata: {
                    categoryName: this.auditState.categoryName,
                    adjustmentsMade: diffs.length,
                    itemsCounted: this.auditState.items.length
                }
            });

            showNotification(`✅ Sincronización exitosa: se ajustaron ${diffs.length} productos.`, 'success');
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

        const content = `
            <div style="padding: 0.5rem;">
                <div style="background: #f8fafc; padding: 1rem; border-radius: 0.75rem; border: 1.5px solid #e2e8f0; margin-bottom: 1rem;">
                    <strong style="font-size: 1.15rem; color: #0f172a; display: block;">${safeHTML(meta.categoryName || 'Categoría')}</strong>
                    <div style="font-size: 0.82rem; color: #64748b; margin-top: 0.2rem;">Fecha: ${formatDateTime(log.timestamp)}</div>
                    <div style="margin-top: 0.5rem; font-size: 0.85rem; color: #334155;">
                        Se ajustaron <strong>${meta.adjustmentsMade || 0}</strong> productos de <strong>${meta.itemsCounted || 0}</strong> contados.
                    </div>
                </div>
            </div>
        `;

        showModal(content, { title: 'Detalle del Conteo Histórico', width: '480px' });
    },

    // =========================================================================
    // 7. SECCIÓN 4: HISTORIAL DE MOVIMIENTOS GENERAL
    // =========================================================================

    renderHistorySection() {
        const movements = (this.recentMovements || []).slice(0, 100);

        return `
            <div class="card" style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 1.25rem; padding: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #f1f5f9; padding-bottom: 0.75rem; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.5rem;">
                    <div>
                        <h3 style="margin: 0; color: #0f172a; font-size: 1.15rem; font-weight: 900; display: flex; align-items: center; gap: 0.4rem;">
                            <span>📜</span> Historial de Movimientos de Stock (Últimos 100)
                        </h3>
                        <span style="font-size: 0.8rem; color: #64748b;">Trazabilidad completa de ventas, compras, ajustes, mermas y consumos.</span>
                    </div>
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
                                const typeNames = { sale: 'Venta', purchase: 'Compra', adjustment: 'Ajuste', loss: 'Pérdida', consumption: 'Consumo', return: 'Devolución' };

                                return `
                                    <tr style="border-bottom: 1px solid #e2e8f0; font-size: 0.85rem;">
                                        <td style="padding: 0.65rem 0.75rem; color: #64748b; font-weight: 600;">${formatDateTime(m.date)}</td>
                                        <td style="padding: 0.65rem 0.75rem;">
                                            <span class="badge ${this.getMovementBadgeClass(m.type)}">${typeNames[m.type] || m.type}</span>
                                        </td>
                                        <td style="padding: 0.65rem 0.75rem;"><strong style="color: #0f172a;">${safeHTML(name)}</strong></td>
                                        <td style="padding: 0.65rem 0.75rem; text-align: center; font-weight: 900; color: ${isPos ? '#059669' : '#dc2626'};">
                                            ${isPos ? '+' : ''}${m.quantity} ${unit}
                                        </td>
                                        <td style="padding: 0.65rem 0.75rem; color: #475569;">${safeHTML(m.reason || m.reference || '—')}</td>
                                        <td style="padding: 0.65rem 0.75rem; color: #64748b; font-size: 0.8rem;">${safeHTML(m.userName || 'Sistema')}</td>
                                    </tr>
                                `;
                            }).join('') || '<tr><td colspan="6" style="padding: 2rem; text-align: center; color: #94a3b8;">No hay movimientos recientes registrados</td></tr>'}
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
                <div class="card" style="padding: 4rem 1.5rem; text-align: center; background: white; border: 1.5px solid #e2e8f0; border-radius: 1.25rem;">
                    <div style="font-size: 3rem; margin-bottom: 0.5rem;">🎉</div>
                    <h2 style="font-size: 1.5rem; font-weight: 900; color: #0f172a; margin: 0;">¡Todo tu stock está en orden!</h2>
                    <p style="color: #64748b; font-size: 0.9rem; margin-top: 0.25rem;">No tienes productos con existencias por debajo del stock mínimo configurado.</p>
                </div>
            `;
        }

        // Agrupar por proveedor
        const bySupplier = {};
        lowStockProducts.forEach(p => {
            const supp = p.supplierName || 'Sin proveedor asignado';
            if (!bySupplier[supp]) bySupplier[supp] = [];
            bySupplier[supp].push(p);
        });

        return `
            <div class="card" style="background: white; border: 1.5px solid #e2e8f0; border-radius: 1.25rem; padding: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #f1f5f9; padding-bottom: 0.75rem; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.5rem;">
                    <div>
                        <h3 style="margin: 0; color: #0f172a; font-size: 1.2rem; font-weight: 900; display: flex; align-items: center; gap: 0.4rem;">
                            <span>💡</span> Sugerencias de Reposición para Compras
                        </h3>
                        <span style="font-size: 0.82rem; color: #64748b;">${lowStockProducts.length} productos necesitan ser reabastecidos pronto.</span>
                    </div>

                    <button class="btn btn-primary" onclick="InventoryView.copySuggestionsToClipboard()" style="font-weight: 800; border-radius: 0.6rem; background: #2563eb;">
                        📋 Copiar Lista para WhatsApp
                    </button>
                </div>

                <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                    ${Object.entries(bySupplier).map(([supplier, items]) => `
                        <div style="border: 1.5px solid #e2e8f0; border-radius: 0.85rem; overflow: hidden;">
                            <div style="background: #f8fafc; padding: 0.75rem 1rem; border-bottom: 1.5px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                                <strong style="color: #0f172a; font-size: 0.95rem;">🚚 ${safeHTML(supplier)}</strong>
                                <span style="background: #fef9c3; color: #b45309; font-size: 0.75rem; font-weight: 900; padding: 0.15rem 0.5rem; border-radius: 999px;">${items.length} producto(s) por pedir</span>
                            </div>
                            <table style="width: 100%; border-collapse: collapse; text-align: left;">
                                <thead style="background: white; border-bottom: 1px solid #e2e8f0;">
                                    <tr style="font-size: 0.72rem; text-transform: uppercase; color: #64748b; font-weight: 800;">
                                        <th style="padding: 0.5rem 0.75rem;">Producto</th>
                                        <th style="padding: 0.5rem 0.75rem; text-align: center;">Stock Actual</th>
                                        <th style="padding: 0.5rem 0.75rem; text-align: center;">Mínimo</th>
                                        <th style="padding: 0.5rem 0.75rem; text-align: right;">Sugerido a Pedir</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${items.map(p => {
                                        const stock = parseFloat(p.stock) || 0;
                                        const minStock = parseFloat(p.minStock) || 0;
                                        const suggested = Math.max(1, (minStock * 2) - stock);
                                        const unit = p.type === 'weight' ? 'kg' : 'un';
                                        return `
                                            <tr style="border-bottom: 1px solid #f1f5f9; font-size: 0.85rem;">
                                                <td style="padding: 0.5rem 0.75rem;"><strong style="color: #0f172a;">${safeHTML(p.name)}</strong></td>
                                                <td style="padding: 0.5rem 0.75rem; text-align: center; color: #dc2626; font-weight: 800;">${stock} ${unit}</td>
                                                <td style="padding: 0.5rem 0.75rem; text-align: center; color: #64748b;">${minStock} ${unit}</td>
                                                <td style="padding: 0.5rem 0.75rem; text-align: right; color: #2563eb; font-weight: 900;">Pedir: ${suggested} ${unit}</td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    copySuggestionsToClipboard() {
        const lowStock = (this.allProducts || []).filter(p => (p.minStock || 0) > 0 && (p.stock || 0) <= (p.minStock || 0));
        if (lowStock.length === 0) {
            showNotification('No hay productos bajo stock mínimo', 'warning');
            return;
        }

        let text = '*PEDIDO DE REPOSICIÓN DE STOCK - ' + new Date().toLocaleDateString() + '*\n\n';
        lowStock.forEach(p => {
            const stock = parseFloat(p.stock) || 0;
            const min = parseFloat(p.minStock) || 0;
            const toOrder = Math.max(1, (min * 2) - stock);
            const unit = p.type === 'weight' ? 'kg' : 'un';
            text += `• ${p.name}: Pedir ${toOrder} ${unit} (Stock actual: ${stock})\n`;
        });

        navigator.clipboard.writeText(text).then(() => {
            showNotification('📋 Lista de compras copiada al portapapeles para WhatsApp', 'success');
        }).catch(() => {
            showNotification('No se pudo copiar automáticamente', 'warning');
        });
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
    }
};

window.InventoryView = InventoryView;
