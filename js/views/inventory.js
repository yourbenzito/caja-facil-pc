const InventoryView = {
    currentSection: 'inventory',
    stockFilter: null,
    showCapitalDist: false,
    products: null,
    recentMovements: [],
    bulkAdjustmentItems: [],
    auditState: null,
    searchCache: null,
    selectedBulkType: 'consumption',
    categories: [],
    allProducts: [],
    auditHistory: [], // Historial de auditorías completadas
    selectedConsumptionDate: new Date().toLocaleDateString('sv-SE'), // YYYY-MM-DD local
    selectedLossDate: new Date().toLocaleDateString('sv-SE'), // YYYY-MM-DD local

    // Variables para filtros del inventario principal
    inventorySearchQuery: '',
    inventorySelectedCategory: '',
    inventorySelectedStockStatus: 'all',
    inventorySelectedSupplier: '',

    // Variables para la sección unificada de pérdidas/consumos
    lossesSearchQuery: '',
    selectedLossesProductData: null,

    async init() {
        // Siempre refrescamos para asegurar categorías y stock actualizado
        await this.refreshData();
        // Activamos funcionalidades específicas de la sección (vistas, buscadores, etc.)
        await this.initRecentMovements();
    },

    async refreshData() {
        this.products = await Product.getAll();
        const suppliers = await Supplier.getAll();
        this.suppliersList = suppliers || [];
        const suppliersMap = suppliers.reduce((acc, s) => {
            acc[s.id] = s.name;
            return acc;
        }, {});

        this.products = this.products.map(p => ({
            ...p,
            supplierName: suppliersMap[p.supplierId] || 'Sin proveedor'
        }));

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        this.recentMovements = await StockMovement.getByDateRange(thirtyDaysAgo, new Date());

        // Poblar categorías y productos para auditoría
        this.allProducts = this.products.filter(p => !p.deleted);

        // Solo mostrar categorías que realmente tengan productos activos
        this.categories = [...new Set(this.allProducts.map(p => p.category || 'General'))].sort();

        // Cargar historial de auditorías completadas
        try {
            const logs = await AuditLogService.getByEntity('category_audit');
            const history = (logs || []).map(l => ({ ...l, source: 'auditLog' }));

            // Reconstrucción de auditorías antiguas desde stockMovements
            const auditMovements = this.recentMovements.filter(m =>
                m.type === 'adjustment' &&
                m.reason &&
                m.reason.startsWith('Ajuste Automático por Auditoría de Cat:')
            );

            // Agrupar movimientos antiguos por motivo y ventana de tiempo (1 minuto)
            const reconstructed = [];
            const groups = {};

            auditMovements.forEach(m => {
                const date = new Date(m.date);
                // Redondear al minuto para agrupar movimientos de la misma auditoría
                const timeKey = `${m.reason}_${date.getFullYear()}-${date.getMonth()}-${date.getDate()}_${date.getHours()}:${date.getMinutes()}`;

                if (!groups[timeKey]) {
                    groups[timeKey] = {
                        timestamp: m.date,
                        username: 'Sistema (Recov)',
                        metadata: {
                            categoryName: m.reason.replace('Ajuste Automático por Auditoría de Cat: ', ''),
                            lossMoney: 0,
                            extraMoney: 0,
                            adjustmentsMade: 0
                        },
                        source: 'reconstructed'
                    };
                }

                const cost = m.cost_value || 0;
                if (m.quantity < 0) {
                    groups[timeKey].metadata.lossMoney += cost;
                } else {
                    groups[timeKey].metadata.extraMoney += cost;
                }
                groups[timeKey].metadata.adjustmentsMade++;
            });

            const reconstructedLogs = Object.values(groups);

            // Combinar ambos y evitar duplicados por categoría y fecha aproximada
            const combined = [...history];
            reconstructedLogs.forEach(rec => {
                const isAlreadyInHistory = history.some(h =>
                    h.metadata.categoryName === rec.metadata.categoryName &&
                    Math.abs(new Date(h.timestamp) - new Date(rec.timestamp)) < 120000 // 2 min threshold
                );
                if (!isAlreadyInHistory) {
                    combined.push(rec);
                }
            });

            this.auditHistory = combined
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .slice(0, 10);
        } catch (e) {
            console.error("Error cargando historial de auditoría:", e);
            this.auditHistory = [];
        }
    },

    calculateDashboardMetrics() {
        let totalCapital = 0;
        let totalCapitalWithIva = 0;
        let totalProjected = 0;
        let totalCapitalForMargin = 0;
        let totalProjectedForMargin = 0;
        let lowStock = 0;
        let outOfStock = 0;
        let expiringSoon = 0;
        let activeCount = 0;
        const categoryValues = {};
        
        const thirtyDays = new Date();
        thirtyDays.setDate(thirtyDays.getDate() + 30);
        
        const productsMap = {};

        // OPTIMIZACIÓN FASE 5: Un solo bucle para todas las métricas de productos
        this.products.forEach(p => {
            if (p.deleted) return;
            
            activeCount++;
            const stock = parseFloat(p.stock) || 0;
            const cost = parseFloat(p.cost) || 0;
            const price = parseFloat(p.price) || 0;
            const minStock = parseFloat(p.minStock) || 0;
            
            productsMap[p.id] = p;

            totalCapital += stock * cost;
            totalCapitalWithIva += stock * (cost * 1.19);
            totalProjected += stock * price;

            if (cost > 0) {
                totalCapitalForMargin += stock * cost;
                totalProjectedForMargin += stock * price;
            }

            if (stock <= 0) outOfStock++;
            else if (stock <= minStock) lowStock++;

            if (p.expiryDate && new Date(p.expiryDate) <= thirtyDays) expiringSoon++;

            const category = p.category || 'General';
            if (!categoryValues[category]) {
                categoryValues[category] = { 
                    name: category, 
                    capital: 0, 
                    capitalWithIva: 0, 
                    projected: 0, 
                    count: 0,
                    capitalForMargin: 0,
                    projectedForMargin: 0
                };
            }
            categoryValues[category].capital += stock * cost;
            categoryValues[category].capitalWithIva += stock * (cost * 1.19);
            categoryValues[category].projected += stock * price;
            categoryValues[category].count += 1;
            if (cost > 0) {
                categoryValues[category].capitalForMargin += stock * cost;
                categoryValues[category].projectedForMargin += stock * price;
            }
        });

        const totalProjectedNet = totalProjected / 1.19;
        const profit = totalProjectedNet - totalCapital;
        
        const totalProjectedNetForMargin = totalProjectedForMargin / 1.19;
        const profitForMargin = totalProjectedNetForMargin - totalCapitalForMargin;
        const margin = totalCapitalForMargin > 0 ? (profitForMargin / totalCapitalForMargin * 100) : 0;

        const categoryDistribution = Object.values(categoryValues).sort((a, b) => b.capital - a.capital).map(cat => {
            const catProjectedNet = cat.projected / 1.19;
            const catProfit = catProjectedNet - cat.capital;
            
            const catProjectedNetForMargin = cat.projectedForMargin / 1.19;
            const catProfitForMargin = catProjectedNetForMargin - cat.capitalForMargin;
            
            return {
                ...cat,
                profit: catProfit,
                margin: cat.capitalForMargin > 0 ? (catProfitForMargin / cat.capitalForMargin * 100) : 0,
                percent: totalCapital > 0 ? (cat.capital / totalCapital * 100) : 0
            };
        });

        // Calcular consumos y perdidas del mes actual
        const now = new Date();
        let monthlyConsumption = 0;
        let monthlyLoss = 0;
        const currentYear = now.getFullYear();
        const currentMonthIdx = now.getMonth();

        if (this.recentMovements) {
            this.recentMovements.forEach(m => {
                const mDate = new Date(m.date);
                if (mDate.getFullYear() === currentYear && mDate.getMonth() === currentMonthIdx) {
                    // OPTIMIZACIÓN FASE 5: Usar el mapa de productos precargado (O(1) vs O(n))
                    const product = productsMap[m.productId];
                    const costValue = parseFloat(m.cost_value) || (product ? (Math.abs(m.quantity) * (parseFloat(product.cost) || 0)) : 0);

                    if (m.type === 'consumption') {
                        monthlyConsumption += costValue;
                    } else if (m.type === 'loss') {
                        monthlyLoss += costValue;
                    }
                }
            });
        }

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
            monthlyConsumption,
            monthlyLoss
        };
    },


    async render() {
        if (!this.products) {
            await this.refreshData();
        }

        const dashboard = this.calculateDashboardMetrics();
        const mainContent = this.renderSectionContent(dashboard);

        return `
            <div class="view-header animate-fade-in">
                <div class="header-content">
                    <h1 style="color: #111827;">Inventario y Stock</h1>
                    <p style="color: #4b5563;">Control y movimientos de inventario</p>
                </div>
            </div>

            <div class="inventory-container animate-fade-in">
                <div class="card" style="padding: 0.75rem; background: #f9fafb; border: 1.5px solid #e5e7eb; margin-bottom: 0; overflow-x: auto; -webkit-overflow-scrolling: touch;">
                    <div style="display: flex; gap: 0.5rem; flex-wrap: nowrap; justify-content: flex-start; min-width: max-content; padding-bottom: 5px;">
                        <button class="btn ${this.currentSection === 'inventory' ? 'btn-primary' : 'btn-secondary'}" 
                                onclick="InventoryView.switchSection('inventory')" 
                                style="padding: 0.5rem 0.8rem; font-size: 0.85rem; flex: 0 0 auto; min-width: 100px;"
                                title="Ver lista completa de productos y stock actual">
                            📦 Inventario
                        </button>
                        <button class="btn ${this.currentSection === 'bulk-adjustment' ? 'btn-primary' : 'btn-secondary'}" 
                                onclick="InventoryView.switchSection('bulk-adjustment')" 
                                style="padding: 0.5rem 0.8rem; font-size: 0.85rem; flex: 0 0 auto; min-width: 110px;"
                                title="Ajuste masivo de productos">
                            ⚡ Ajustes Rápidos
                        </button>
                        <button class="btn ${this.currentSection === 'audit' ? 'btn-primary' : 'btn-secondary'}" 
                                onclick="InventoryView.switchSection('audit')" 
                                style="padding: 0.5rem 0.8rem; font-size: 0.85rem; flex: 0 0 auto; min-width: 150px;"
                                title="Contar mercancía físicamente y corregir el sistema">
                            📋 Auditoría/Toma Física
                        </button>
                        <button class="btn ${this.currentSection === 'losses' ? 'btn-primary' : 'btn-secondary'}" 
                                onclick="InventoryView.switchSection('losses')" 
                                style="padding: 0.5rem 0.8rem; font-size: 0.85rem; flex: 0 0 auto; min-width: 150px;"
                                title="Listado de consumos o mermas">
                            🗑️ Pérdidas y Consumos
                        </button>
                        <button class="btn ${this.currentSection === 'history' ? 'btn-primary' : 'btn-secondary'}" 
                                onclick="InventoryView.switchSection('history')" 
                                style="padding: 0.5rem 0.8rem; font-size: 0.85rem; flex: 0 0 auto; min-width: 90px;"
                                title="Registro de todos los cambios de stock pasados">
                            📜 Historial
                        </button>
                        ${(() => {
                            const lowCount = (this.products || []).filter(p => !p.deleted && (p.minStock || 0) > 0 && (p.stock || 0) <= (p.minStock || 0)).length;
                            return `<button class="btn ${this.currentSection === 'suggestions' ? 'btn-primary' : 'btn-secondary'}" 
                                onclick="InventoryView.switchSection('suggestions')" 
                                style="padding: 0.5rem 0.8rem; font-size: 0.85rem; flex: 0 0 auto; min-width: 110px; ${lowCount > 0 && this.currentSection !== 'suggestions' ? 'border-color:#f59e0b; color:#92400e; background:#fffbeb;' : ''}"
                                title="Ver productos que podrías reponer pronto">
                                💡 Sugerencias${lowCount > 0 ? ` <span style="background:#f59e0b; color:#fff; border-radius:99px; padding:0 6px; font-size:0.7rem; font-weight:800; margin-left:4px;">${lowCount}</span>` : ''}
                            </button>`;
                        })()}
                    </div>
                </div>

                <div id="inventory-section-content" style="margin-top: 1.5rem;">
                    ${mainContent}
                </div>
            </div>
        `;
    },

    renderSectionContent(dashboard) {
        switch (this.currentSection) {
            case 'inventory':
                return this.renderInventoryDashboard(dashboard);
            case 'bulk-adjustment':
                return this.renderBulkAdjustmentForm();
            case 'audit':
                return this.renderAuditSection();
            case 'losses':
                return this.renderLossesTab(dashboard);
            case 'history':
                return this.renderHistorySection(this.recentMovements);
            case 'suggestions':
                return this.renderSuggestions();
            default:
                return this.renderInventoryDashboard(dashboard);
        }
    },

    renderInventoryDashboard(dashboard) {
        // Generar categorías y proveedores para los selectores
        const categories = this.categories || [];
        const suppliers = this.suppliersList || [];
        
        // Obtener el valor de filtros actuales
        const searchQuery = this.inventorySearchQuery || '';
        const selectedCat = this.inventorySelectedCategory || '';
        const selectedStatus = this.inventorySelectedStockStatus || 'all';
        const selectedSupplier = this.inventorySelectedSupplier || '';

        // Calcular costo bruto de capital proyectado
        const totalCapitalBruto = dashboard.totalCapitalWithIva || (dashboard.totalCapital * 1.19);
        const totalProjectedNet = dashboard.totalProjectedNet || (dashboard.totalProjected / 1.19);

        return `
            <!-- Grid de KPIs (Tarjetas Métricas) con diseño ejecutivo y Netos/Brutos -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.25rem; margin-bottom: 1.5rem;">
                <!-- 1. Capital Invertido -->
                <div class="inventory-kpi-card card-blue-accent" style="background: white; border: 1.5px solid #d1d5db; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); position: relative; overflow: hidden; border-left: 5px solid #3b82f6;">
                    <div style="font-size: 2rem; position: absolute; right: 1rem; top: 1rem; opacity: 0.25;">💼</div>
                    <h4 style="margin: 0 0 0.5rem 0; font-size: 0.75rem; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; font-weight: 800;">Capital Invertido</h4>
                    <div style="font-size: 1.6rem; font-weight: 900; color: #1e293b; line-height: 1.2;">
                        ${formatCLP(dashboard.totalCapital)} <span style="font-size: 0.75rem; color: #64748b; font-weight: 700;">Neto</span>
                    </div>
                    <div style="font-size: 1.1rem; font-weight: 700; color: #64748b; margin-top: 0.25rem;">
                        ${formatCLP(totalCapitalBruto)} <span style="font-size: 0.7rem; color: #94a3b8; font-weight: 600;">Bruto</span>
                    </div>
                    <small style="color: #64748b; font-size: 0.75rem; margin-top: 0.5rem; display: block;">Total: ${dashboard.activeItems} productos activos</small>
                </div>

                <!-- 2. Valor Venta Proyectado (Stock) -->
                <div class="inventory-kpi-card card-purple-accent" style="background: white; border: 1.5px solid #d1d5db; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); position: relative; overflow: hidden; border-left: 5px solid #8b5cf6;">
                    <div style="font-size: 2rem; position: absolute; right: 1rem; top: 1rem; opacity: 0.25;">🏷️</div>
                    <h4 style="margin: 0 0 0.5rem 0; font-size: 0.75rem; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; font-weight: 800;">Venta Proyectada</h4>
                    <div style="font-size: 1.6rem; font-weight: 900; color: #1e293b; line-height: 1.2;">
                        ${formatCLP(dashboard.totalProjected)} <span style="font-size: 0.75rem; color: #64748b; font-weight: 700;">Bruto</span>
                    </div>
                    <div style="font-size: 1.1rem; font-weight: 700; color: #64748b; margin-top: 0.25rem;">
                        ${formatCLP(totalProjectedNet)} <span style="font-size: 0.7rem; color: #94a3b8; font-weight: 600;">Neto</span>
                    </div>
                    <small style="color: #64748b; font-size: 0.75rem; margin-top: 0.5rem; display: block;">Retorno estimado si vendes todo</small>
                </div>

                <!-- 3. Ganancia Bruta -->
                <div class="inventory-kpi-card card-green-accent" style="background: white; border: 1.5px solid #d1d5db; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); position: relative; overflow: hidden; border-left: 5px solid #10b981;">
                    <div style="font-size: 2rem; position: absolute; right: 1rem; top: 1rem; opacity: 0.25;">📈</div>
                    <h4 style="margin: 0 0 0.5rem 0; font-size: 0.75rem; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; font-weight: 800;">Ganancia Proyectada</h4>
                    <div style="font-size: 1.6rem; font-weight: 900; color: #10b981; line-height: 1.2;">
                        +${formatCLP(dashboard.profit)}
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 0.5rem; font-size: 0.8rem; font-weight: 700; color: #047857;">
                        <span>Margen Global:</span>
                        <span style="background: #d1fae5; padding: 0.15rem 0.5rem; border-radius: 0.5rem; border: 1px solid #a7f3d0;">+${dashboard.margin.toFixed(1)}%</span>
                    </div>
                </div>

                <!-- 4. Alerta de Stock Crítico -->
                <div class="inventory-kpi-card card-red-accent" style="background: white; border: 1.5px solid #d1d5db; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); position: relative; overflow: hidden; border-left: 5px solid #ef4444;">
                    <div style="font-size: 2rem; position: absolute; right: 1rem; top: 1rem; opacity: 0.25;">🚨</div>
                    <h4 style="margin: 0 0 0.5rem 0; font-size: 0.75rem; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; font-weight: 800;">Stock Crítico</h4>
                    <div style="display: flex; gap: 1rem; margin-top: 0.25rem;">
                        <div>
                            <div style="font-size: 1.4rem; font-weight: 900; color: #b91c1c;">${dashboard.outOfStock}</div>
                            <small style="color: #64748b; font-size: 0.7rem; font-weight: 700; text-transform: uppercase;">Agotados</small>
                        </div>
                        <div style="border-left: 1px solid #cbd5e1; padding-left: 1rem;">
                            <div style="font-size: 1.4rem; font-weight: 900; color: #d97706;">${dashboard.lowStock}</div>
                            <small style="color: #64748b; font-size: 0.7rem; font-weight: 700; text-transform: uppercase;">Bajo stock</small>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Fila de Búsqueda, Filtros y Acciones -->
            <div style="display: flex; gap: 0.75rem; align-items: center; justify-content: space-between; flex-wrap: wrap; background: #f1f5f9; padding: 1rem; border-radius: 1rem; border: 1px solid #cbd5e1; margin-bottom: 1.5rem;">
                <div style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; flex: 1; min-width: 300px;">
                    <!-- Buscador -->
                    <div style="position: relative; flex: 2; min-width: 200px;">
                        <input type="text" 
                               id="inventorySearchInput" 
                               class="form-control" 
                               placeholder="🔍 Buscar por nombre o código..." 
                               value="${searchQuery}" 
                               oninput="InventoryView.handleInventorySearch(this.value)" 
                               style="padding: 0.5rem 0.75rem; border-radius: 0.5rem; border: 1px solid #cbd5e1; background: white; font-size: 0.9rem; width: 100%;">
                    </div>
                    
                    <!-- Categoría -->
                    <select onchange="InventoryView.handleInventoryCategoryChange(this.value)" 
                            style="padding: 0.5rem 0.75rem; border-radius: 0.5rem; border: 1px solid #cbd5e1; background: white; font-size: 0.9rem; flex: 1; min-width: 150px;">
                        <option value="">📂 Todas las Categorías</option>
                        ${categories.map(c => `<option value="${c}" ${c === selectedCat ? 'selected' : ''}>${c}</option>`).join('')}
                    </select>
                    
                    <!-- Estado Stock -->
                    <select onchange="InventoryView.handleInventoryStockChange(this.value)" 
                            style="padding: 0.5rem 0.75rem; border-radius: 0.5rem; border: 1px solid #cbd5e1; background: white; font-size: 0.9rem; flex: 1; min-width: 150px;">
                        <option value="all" ${selectedStatus === 'all' ? 'selected' : ''}>📈 Todos los Stocks</option>
                        <option value="low" ${selectedStatus === 'low' ? 'selected' : ''}>⚠️ Stock Bajo</option>
                        <option value="out" ${selectedStatus === 'out' ? 'selected' : ''}>🚨 Agotados</option>
                        <option value="optimum" ${selectedStatus === 'optimum' ? 'selected' : ''}>✅ Stock Óptimo</option>
                    </select>

                    <!-- Proveedor -->
                    <select onchange="InventoryView.handleInventorySupplierChange(this.value)" 
                            style="padding: 0.5rem 0.75rem; border-radius: 0.5rem; border: 1px solid #cbd5e1; background: white; font-size: 0.9rem; flex: 1; min-width: 150px;">
                        <option value="">👤 Todos los Proveedores</option>
                        <option value="none" ${selectedSupplier === 'none' ? 'selected' : ''}>👤 Sin Proveedor</option>
                        ${suppliers.map(s => `<option value="${s.id}" ${String(s.id) === selectedSupplier ? 'selected' : ''}>${s.name}</option>`).join('')}
                    </select>
                </div>
                
                <!-- Exportar -->
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-secondary" onclick="InventoryView.exportInventoryCSV()" style="padding: 0.5rem 1rem; border-radius: 0.5rem; font-weight: 700; font-size: 0.85rem; background: white; border: 1px solid #cbd5e1; display: flex; align-items: center; gap: 0.25rem;">
                        📊 Excel/CSV
                    </button>
                    <button class="btn btn-secondary" onclick="InventoryView.exportInventoryPDF()" style="padding: 0.5rem 1rem; border-radius: 0.5rem; font-weight: 700; font-size: 0.85rem; background: white; border: 1px solid #cbd5e1; display: flex; align-items: center; gap: 0.25rem;">
                        📄 Imprimir PDF
                    </button>
                </div>
            </div>

            <!-- Distribución de Capital Colapsable -->
            <div style="margin-bottom: 1.5rem;">
                <button class="capital-toggle-btn" 
                        onclick="InventoryView.toggleCapitalDistribution()"
                        style="width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1.25rem; border-radius: 0.75rem; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600; color: #475569; cursor: pointer; transition: all 0.2s;">
                    <span><span style="margin-right:0.5rem">🧩</span> Ver Distribución de Capital por Categoría</span>
                    <span>${this.showCapitalDist ? '▲ Ocultar' : '▼ Mostrar Detalles'}</span>
                </button>
                
                ${this.showCapitalDist ? `
                <div class="animate-slide-down" style="margin-top: 1rem; background: #f8fafc; border-radius: 1.25rem; padding: 1.5rem; border: 1px solid #e2e8f0;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem;">
                        ${dashboard.categoryDistribution.map(cat => {
                            const barColor = cat.percent > 15 ? '#3b82f6' : (cat.percent > 5 ? '#10b981' : '#64748b');
                            return `
                            <div class="capital-dist-card" style="background: white; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                                    <h4 style="margin: 0; font-size: 0.95rem; color: #1e293b; text-transform: capitalize; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 65%; font-weight: 700;">${safeHTML(cat.name)}</h4>
                                    <div style="text-align: right;">
                                        <div style="font-size: 0.8rem; font-weight: 800; color: ${barColor};">${cat.percent.toFixed(1)}% peso</div>
                                        <div style="font-size: 0.75rem; color: #059669; font-weight: 700;">+${cat.margin.toFixed(1)}% mg</div>
                                    </div>
                                </div>
                                
                                <div style="display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 0.75rem; border-top: 1px solid #f1f5f9; padding-top: 0.5rem; margin-top: 0.5rem;">
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <span style="font-size: 0.75rem; color: #64748b; font-weight: 500;">Capital:</span>
                                        <span style="font-size: 0.95rem; font-weight: 800; color: #1e293b;">${formatCLP(cat.capital)}</span>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <span style="font-size: 0.75rem; color: #059669; font-weight: 600;">G. Bruta:</span>
                                        <span style="font-size: 0.95rem; font-weight: 800; color: #10b981;">+${formatCLP(cat.profit)}</span>
                                    </div>
                                </div>

                                <div style="font-size: 0.7rem; color: #64748b; margin-bottom: 0.5rem; font-weight: 500;">${cat.count} productos</div>
                                
                                <div style="width: 100%; height: 5px; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
                                    <div style="width: ${cat.percent}%; height: 100%; background: linear-gradient(90deg, ${barColor}, ${barColor}dd); border-radius: 3px;"></div>
                                </div>
                            </div>
                            `;
                        }).join('')}
                    </div>
                </div>` : ''}
            </div>

            <!-- Tabla Principal del Inventario -->
            <div class="table-container card glass-panel" style="padding: 1rem; border-radius: 1.25rem;">
                <div id="inventory-table-wrapper">
                    ${this.renderInventoryTableHTML(this.getFilteredProducts())}
                </div>
            </div>
        `;
    },

    // Métodos auxiliares para filtrado, visualización y exportación de stock
    getFilteredProducts() {
        const searchQuery = (this.inventorySearchQuery || '').toLowerCase().trim();
        const catFilter = this.inventorySelectedCategory;
        const statusFilter = this.inventorySelectedStockStatus;
        const supplierFilter = this.inventorySelectedSupplier;

        return this.products.filter(p => {
            if (p.deleted) return false;
            
            // Búsqueda de texto
            if (searchQuery) {
                const nameMatch = (p.name || '').toLowerCase().includes(searchQuery);
                const codeMatch = (p.barcode || '').toLowerCase().includes(searchQuery);
                if (!nameMatch && !codeMatch) return false;
            }
            
            // Filtro de categoría
            if (catFilter && p.category !== catFilter) return false;
            
            // Filtro de proveedor
            if (supplierFilter) {
                const activeSupplierIds = (this.suppliersList || []).map(s => String(s.id));
                const pSupplierIdStr = p.supplierId ? String(p.supplierId) : '';
                const hasValidSupplier = pSupplierIdStr && activeSupplierIds.includes(pSupplierIdStr);

                if (supplierFilter === 'none') {
                    if (hasValidSupplier) return false;
                } else {
                    if (pSupplierIdStr !== supplierFilter) return false;
                }
            }
            
            // Filtro de estado de stock
            const stock = parseFloat(p.stock) || 0;
            const minStock = parseFloat(p.minStock) || 0;
            
            if (statusFilter === 'low') {
                if (stock <= 0 || stock > minStock || minStock === 0) return false;
            } else if (statusFilter === 'out') {
                if (stock > 0) return false;
            } else if (statusFilter === 'optimum') {
                if (stock <= minStock && minStock > 0) return false;
            }
            
            return true;
        });
    },

    renderInventoryTableHTML(filtered) {
        if (filtered.length === 0) {
            return `
                <div style="text-align: center; padding: 3rem; color: #64748b;">
                    <span style="font-size: 3rem; display: block; margin-bottom: 1rem;">🔍</span>
                    No se encontraron productos con los filtros seleccionados.
                </div>
            `;
        }

        const rows = filtered.map(p => {
            const stock = parseFloat(p.stock) || 0;
            const minStock = parseFloat(p.minStock) || 0;
            const cost = parseFloat(p.cost) || 0;
            const price = parseFloat(p.price) || 0;
            
            const priceNet = price / 1.19;
            const profit = priceNet - cost;
            const margin = cost > 0 ? (profit / cost * 100) : 0;
            
            // Alertas de Vencimiento
            let expiryHtml = '';
            if (p.expiryDate) {
                const thirtyDays = new Date();
                thirtyDays.setDate(thirtyDays.getDate() + 30);
                const expiry = new Date(p.expiryDate);
                const today = new Date();
                const isExpired = expiry <= today;
                const isExpiringSoon = expiry <= thirtyDays && !isExpired;
                
                const expDateFormatted = p.expiryDate.split('-').reverse().join('-');
                if (isExpired) {
                    expiryHtml = `<div style="color: #ef4444; font-size: 0.75rem; font-weight: 800; margin-top: 0.25rem;">🚨 Expirado: ${expDateFormatted}</div>`;
                } else if (isExpiringSoon) {
                    expiryHtml = `<div style="color: #ca8a04; font-size: 0.75rem; font-weight: 800; margin-top: 0.25rem;">⚠️ Vence pronto: ${expDateFormatted}</div>`;
                } else {
                    expiryHtml = `<div style="color: #64748b; font-size: 0.75rem; margin-top: 0.25rem;">📅 Vence: ${expDateFormatted}</div>`;
                }
            }

            // Colores y badges de stock
            let rowStyle = '';
            let stockBadge = '';
            
            if (stock <= 0) {
                rowStyle = 'background-color: #fef2f2;';
                stockBadge = `<span style="background: #fee2e2; color: #ef4444; padding: 0.15rem 0.4rem; border-radius: 0.375rem; font-size: 0.7rem; font-weight: 800; border: 1px solid rgba(239,68,68,0.2); margin-left: 0.5rem; white-space: nowrap;">🚨 AGOTADO</span>`;
            } else if (stock <= minStock && minStock > 0) {
                rowStyle = 'background-color: #fffbeb;';
                stockBadge = `<span style="background: #fef9c3; color: #d97706; padding: 0.15rem 0.4rem; border-radius: 0.375rem; font-size: 0.7rem; font-weight: 800; border: 1px solid rgba(217,119,6,0.2); margin-left: 0.5rem; white-space: nowrap;">⚠️ STOCK BAJO</span>`;
            }

            const isWeight = p.type === 'weight';
            const decimals = isWeight ? 3 : 0;
            const unit = isWeight ? 'kg' : 'un';

            return `
                <tr style="border-bottom: 1px solid #e2e8f0; font-size: 0.875rem; color: #374151; ${rowStyle} transition: background 0.15s;" onmouseover="this.style.background='rgba(0,0,0,0.02)'" onmouseout="this.style.background='transparent'">
                    <td style="padding: 0.85rem 0.75rem; font-family: monospace; font-size: 0.8rem; font-weight: bold; color: #64748b;">
                        ${safeHTML(p.barcode || '—')}
                    </td>
                    <td style="padding: 0.85rem 0.75rem;">
                        <strong style="color: #1e293b; font-size: 0.95rem;">${safeHTML(p.name)}</strong>
                        <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.15rem;">Categoría: ${safeHTML(p.category || 'General')}</div>
                        ${expiryHtml}
                    </td>
                    <td style="padding: 0.85rem 0.75rem; color: #475569; font-weight: 500;">
                        ${safeHTML(p.supplierName || '—')}
                    </td>
                    <td style="padding: 0.85rem 0.75rem; text-align: center;">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                            <span style="font-weight: 800; font-size: 1rem; color: #1e293b;">
                                ${formatStock(stock, decimals)} ${unit}
                            </span>
                            ${stockBadge}
                            <button class="btn btn-sm btn-secondary" onclick="InventoryView.quickAdjustment(${p.id})" style="padding: 0.2rem 0.4rem; font-size: 0.75rem; border-radius: 0.375rem; border: 1px solid #cbd5e1; background: white;" title="Ajustar stock">
                                ✏️
                            </button>
                        </div>
                        <small style="color: #64748b; font-size: 0.7rem;">Mín: ${minStock} ${unit}</small>
                    </td>
                    <td style="padding: 0.85rem 0.75rem; text-align: right; font-weight: 700; color: #475569;">
                        ${formatCLP(cost)}
                    </td>
                    <td style="padding: 0.85rem 0.75rem; text-align: right; font-weight: 700; color: #2563eb;">
                        ${formatCLP(price)}
                    </td>
                    <td style="padding: 0.85rem 0.75rem; text-align: center;">
                        <span style="background: ${margin >= 0 ? '#ecfdf5' : '#fef2f2'}; color: ${margin >= 0 ? '#047857' : '#b91c1c'}; padding: 0.25rem 0.5rem; border-radius: 0.5rem; font-weight: 800; font-size: 0.8rem; border: 1px solid ${margin >= 0 ? '#a7f3d0' : '#fecaca'};">
                            ${margin >= 0 ? '+' : ''}${margin.toFixed(1)}%
                        </span>
                    </td>
                    <td style="padding: 0.85rem 0.75rem; text-align: right; white-space: nowrap;">
                        <button class="btn btn-sm btn-primary" onclick="InventoryView.showKardex(${p.id})" style="border-radius: 0.5rem; font-weight: 700; padding: 0.35rem 0.75rem;">
                            📋 Kardex
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 2px solid #cbd5e1; text-align: left; font-size: 0.8rem; color: #475569; text-transform: uppercase; font-weight: 800; background: #f8fafc;">
                        <th style="padding: 0.75rem; width: 140px;">Cód. Barra</th>
                        <th style="padding: 0.75rem;">Producto</th>
                        <th style="padding: 0.75rem;">Proveedor</th>
                        <th style="padding: 0.75rem; text-align: center; width: 180px;">Stock Actual</th>
                        <th style="padding: 0.75rem; text-align: right; width: 110px;">Costo Neto</th>
                        <th style="padding: 0.75rem; text-align: right; width: 110px;">P. Venta (Bruto)</th>
                        <th style="padding: 0.75rem; text-align: center; width: 90px;">Margen %</th>
                        <th style="padding: 0.75rem; text-align: right; width: 110px;">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;
    },

    handleInventorySearch(value) {
        this.inventorySearchQuery = value;
        this.updateInventoryTableFiltered();
    },

    handleInventoryCategoryChange(value) {
        this.inventorySelectedCategory = value;
        this.updateInventoryTableFiltered();
    },

    handleInventoryStockChange(value) {
        this.inventorySelectedStockStatus = value;
        this.updateInventoryTableFiltered();
    },

    handleInventorySupplierChange(value) {
        this.inventorySelectedSupplier = value;
        this.updateInventoryTableFiltered();
    },

    updateInventoryTableFiltered() {
        const wrapper = document.getElementById('inventory-table-wrapper');
        if (wrapper) {
            wrapper.innerHTML = this.renderInventoryTableHTML(this.getFilteredProducts());
        }
    },

    exportInventoryCSV() {
        const filtered = this.getFilteredProducts();
        if (filtered.length === 0) {
            showNotification('No hay datos para exportar', 'warning');
            return;
        }
        let csvContent = 'Código Barra;Producto;Categoría;Proveedor;Stock;Costo Neto;Precio Venta;Margen %\n';
        filtered.forEach(p => {
            const stock = parseFloat(p.stock) || 0;
            const cost = parseFloat(p.cost) || 0;
            const price = parseFloat(p.price) || 0;
            const priceNet = price / 1.19;
            const profit = priceNet - cost;
            const margin = cost > 0 ? (profit / cost * 100) : 0;
            
            csvContent += `"${p.barcode || ''}";"${p.name.replace(/"/g, '""')}";"${(p.category || 'General').replace(/"/g, '""')}";"${(p.supplierName || 'Sin proveedor').replace(/"/g, '""')}";${stock};${cost};${price};${margin.toFixed(1)}%\n`;
        });
        
        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `inventario_${new Date().toLocaleDateString('sv-SE')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification('Excel/CSV exportado', 'success');
    },

    exportInventoryPDF() {
        const filtered = this.getFilteredProducts();
        if (filtered.length === 0) {
            showNotification('No hay datos para exportar', 'warning');
            return;
        }
        const printWindow = window.open('', '_blank');
        let rowsHtml = '';
        filtered.forEach(p => {
            const stock = parseFloat(p.stock) || 0;
            const cost = parseFloat(p.cost) || 0;
            const price = parseFloat(p.price) || 0;
            rowsHtml += `
                <tr>
                    <td>${p.barcode || '—'}</td>
                    <td><strong>${p.name}</strong><br><small>${p.category || 'General'}</small></td>
                    <td>${p.supplierName || '—'}</td>
                    <td class="center">${stock} ${p.type === 'weight' ? 'kg' : 'un'}</td>
                    <td class="right">${formatCLP(cost)}</td>
                    <td class="right">${formatCLP(price)}</td>
                </tr>
            `;
        });
        
        printWindow.document.write(`
            <html>
            <head>
                <title>Reporte de Inventario - ${new Date().toLocaleDateString()}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
                    h1 { text-align: center; color: #111; margin-bottom: 5px; }
                    p { text-align: center; color: #666; margin-top: 0; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; font-size: 11px; }
                    th { background-color: #f2f2f2; text-align: left; }
                    .center { text-align: center; }
                    .right { text-align: right; }
                </style>
            </head>
            <body>
                <h1>REPORTE DE INVENTARIO</h1>
                <p>Fecha de emisión: ${new Date().toLocaleString()}</p>
                <table>
                    <thead>
                        <tr>
                            <th>Cód. Barra</th>
                            <th>Producto</th>
                            <th>Proveedor</th>
                            <th class="center">Stock</th>
                            <th class="right">Costo Neto</th>
                            <th class="right">Precio Venta</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
                <script>
                    window.onload = function() {
                        window.print();
                        window.close();
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    },

    renderBulkAdjustmentForm() {
        return `
            <div class="card" style="background: #fefce8; border: 3px solid #ca8a04; box-shadow: 0 10px 25px rgba(202, 138, 4, 0.1); padding: 2rem;">
                <h3 style="margin-bottom: 2rem; display: flex; align-items: center; gap: 0.75rem; font-size: 1.6rem; color: #854d0e;">
                    <span style="font-size: 2.5rem;">📋</span> Registro Masivo de Stock
                </h3>

                <div style="margin-bottom: 2.5rem; background: #ffffff; padding: 1.5rem; border-radius: 1.25rem; border: 2.5px solid #fde047;">
                    <label style="color: #713f12; font-size: 1.1rem; margin-bottom: 1.25rem; display: block; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">1. ¿Qué tipo de registro quieres hacer?</label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <button onclick="InventoryView.setBulkMovementType('consumption')" 
                                class="btn" 
                                style="height: 120px; font-size: 1.3rem; display: flex; flex-direction: column; gap: 0.5rem; transition: all 0.3s;
                                background: ${this.selectedBulkType === 'consumption' ? '#fef9c3' : '#ffffff'};
                                border: 4px solid ${this.selectedBulkType === 'consumption' ? '#eab308' : '#f1f5f9'};
                                color: #854d0e;">
                            <span style="font-size: 2.5rem;">🍴</span>
                            <strong>Consumo de la Casa</strong>
                        </button>
                        
                        <button onclick="InventoryView.setBulkMovementType('loss')" 
                                class="btn" 
                                style="height: 120px; font-size: 1.3rem; display: flex; flex-direction: column; gap: 0.5rem; transition: all 0.3s;
                                background: ${this.selectedBulkType === 'loss' ? '#fee2e2' : '#ffffff'};
                                border: 4px solid ${this.selectedBulkType === 'loss' ? '#ef4444' : '#f1f5f9'};
                                color: ${this.selectedBulkType === 'loss' ? '#991b1b' : '#6b7280'};">
                            <span style="font-size: 2.5rem;">🗑️</span>
                            <strong>Pérdida o Merma</strong>
                        </button>
                    </div>
                </div>

                <div style="margin-bottom: 2rem; background: #ffffff; padding: 1.5rem; border-radius: 1.25rem; border: 2.5px solid #fde047;">
                    <label style="color: #713f12; font-size: 1.1rem; margin-bottom: 1rem; display: block; font-weight: 800;">2. Busca y agrega los productos:</label>
                    <div class="search-box">
                        <input type="text" 
                               id="bulkSearchInput" 
                               class="form-control" 
                               placeholder="🔍 Escribe el nombre o usa el código de barras..."
                               style="font-size: 1.3rem; height: 65px; border: 3.5px solid #ca8a04; border-radius: 1rem; background: #fdfdfd; padding-left: 3rem;"
                               oninput="InventoryView.handleBulkSearch(event)">
                        <div id="bulkSearchResults" class="search-results" style="display: none;"></div>
                    </div>
                </div>
                
                <!-- Lista de productos seleccionados -->
                <div id="bulkSelectedProducts">
                    <div class="empty-state" style="padding: 3rem; background: rgba(17, 24, 39, 0.4); border: 1px dashed rgba(255,255,255,0.1); border-radius: 1rem; text-align: center;">
                        <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;">🛒</div>
                        <p style="color: #94a3b8; font-size: 1.1rem; margin-bottom: 0;">Aún no has agregado productos</p>
                    </div>
                </div>

                <!-- Footer con Motivo y Botones de Acción - SIEMPRE VISIBLE -->
                <div style="margin-top: 2rem; padding: 1.5rem; background: #ffffff; border-radius: 1.25rem; border: 2.5px solid #fde047; box-shadow: 0 4px 12px rgba(202, 138, 4, 0.05);">
                    <div class="form-group" style="margin-bottom: 1.5rem;">
                        <label style="color: #713f12; font-size: 1rem; margin-bottom: 0.75rem; display: block; font-weight: 800;">3. Motivo del ajuste:</label>
                        <textarea id="bulkReason" class="form-control" rows="2" 
                                  placeholder="Ej: Consumo del personal, rotura de envase, vencimiento..." 
                                  style="font-size: 1.1rem; border: 2.5px solid #fde047; border-radius: 0.75rem; background: #fffcf0; padding: 0.75rem;"></textarea>
                    </div>

                    <div style="display: flex; gap: 1rem;">
                        <button class="btn btn-secondary" onclick="InventoryView.resetBulkForm()" 
                                style="flex: 1; height: 55px; font-weight: 700; border: 2px solid #cbd5e1; color: #475569; background: #f8fafc;">
                            ❌ Limpiar Formulario
                        </button>
                        <button class="btn btn-primary" onclick="InventoryView.saveBulkAdjustment()" 
                                style="flex: 2; height: 55px; font-weight: 800; font-size: 1.1rem; background: #ca8a04; border: none; box-shadow: 0 4px 14px rgba(202, 138, 4, 0.3);">
                            💾 Guardar Ajuste Masivo
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    setBulkMovementType(type) {
        this.selectedBulkType = type;
        app.navigate('inventory');
    },

    renderLossesTab(dashboard) {
        const lossesSearchQuery = this.lossesSearchQuery || '';
        const selectedDateCons = this.selectedConsumptionDate || new Date().toLocaleDateString('sv-SE');
        const selectedDateLoss = this.selectedLossDate || new Date().toLocaleDateString('sv-SE');

        return `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.25rem; margin-bottom: 1.5rem;">
                <!-- Tarjeta Pérdidas Mes -->
                <div class="inventory-kpi-card card-red-accent" style="background: white; border: 1.5px solid #d1d5db; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); position: relative; overflow: hidden; border-left: 5px solid #ef4444;">
                    <div style="font-size: 2rem; position: absolute; right: 1rem; top: 1rem; opacity: 0.25;">🗑️</div>
                    <h4 style="margin: 0 0 0.5rem 0; font-size: 0.75rem; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; font-weight: 800;">Pérdidas / Mermas (Mes Actual)</h4>
                    <div style="font-size: 1.8rem; font-weight: 900; color: #ef4444;">
                        ${formatCLP(dashboard.monthlyLoss)}
                    </div>
                    <small style="color: #64748b; font-size: 0.75rem; margin-top: 0.5rem; display: block;">Costo total acumulado de mercadería perdida</small>
                </div>

                <!-- Tarjeta Consumos Mes -->
                <div class="inventory-kpi-card card-blue-accent" style="background: white; border: 1.5px solid #d1d5db; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); position: relative; overflow: hidden; border-left: 5px solid #3b82f6;">
                    <div style="font-size: 2rem; position: absolute; right: 1rem; top: 1rem; opacity: 0.25;">🍴</div>
                    <h4 style="margin: 0 0 0.5rem 0; font-size: 0.75rem; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; font-weight: 800;">Consumo de la Casa (Mes Actual)</h4>
                    <div style="font-size: 1.8rem; font-weight: 900; color: #3b82f6;">
                        ${formatCLP(dashboard.monthlyConsumption)}
                    </div>
                    <small style="color: #64748b; font-size: 0.75rem; margin-top: 0.5rem; display: block;">Costo total acumulado de mercadería consumida</small>
                </div>
            </div>

            <!-- Formulario de Registro de Egreso de Stock -->
            <div class="card" style="background: white; border: 1.5px solid #cbd5e1; border-radius: 1.25rem; padding: 1.5rem; margin-bottom: 2rem;">
                <h3 style="margin-top: 0; margin-bottom: 1rem; color: #1e293b; font-size: 1.15rem; font-weight: 800; display: flex; align-items: center; gap: 0.5rem;">
                    <span>🚨</span> Registrar Egresos de Stock (Merma / Consumo)
                </h3>
                
                <div style="display: flex; gap: 1rem; align-items: flex-start; flex-wrap: wrap;">
                    <!-- Buscador -->
                    <div style="position: relative; flex: 2; min-width: 250px;">
                        <label style="font-size: 0.8rem; font-weight: 700; color: #475569; display: block; margin-bottom: 0.35rem;">Buscar Producto:</label>
                        <input type="text" 
                               id="lossesSearchInput" 
                               class="form-control" 
                               placeholder="🔍 Escribe nombre o código de barras..." 
                               value="${lossesSearchQuery}" 
                               oninput="InventoryView.handleLossesSearch(event)" 
                               style="padding: 0.5rem 0.75rem; border-radius: 0.5rem; border: 1px solid #cbd5e1; width: 100%; font-size: 0.9rem;">
                        <div id="lossesSearchResults" class="search-results" style="display: none; position: absolute; left: 0; right: 0; background: white; border: 1px solid #cbd5e1; border-radius: 0.5rem; max-height: 250px; overflow-y: auto; z-index: 100; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);"></div>
                    </div>

                    <!-- Si hay producto seleccionado, mostramos sus detalles de forma compacta en línea -->
                    <div id="lossesSelectedProductPanel" style="flex: 3; min-width: 300px; display: none; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 0.75rem 1rem;">
                    </div>
                </div>
            </div>

            <!-- Grilla de Reportes Diarios Recientes (Lado a Lado) -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
                <!-- Panel Consumos -->
                <div class="card" style="padding: 1.25rem; border-radius: 1.25rem; border: 1.5px solid #cbd5e1; background: white; margin-bottom: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
                        <h4 style="margin: 0; color: #1e3a8a; font-weight: 800; display: flex; align-items: center; gap: 0.35rem;">
                            <span>🍴</span> Historial de Consumos
                        </h4>
                        <!-- Input fecha -->
                        <input type="date" value="${selectedDateCons}" 
                               onchange="InventoryView.setConsumptionDate(this.value)"
                               style="background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; padding: 0.35rem 0.75rem; border-radius: 0.5rem; font-size: 0.85rem; font-weight: 700; outline: none; cursor: pointer;">
                    </div>
                    <div id="consumptionReportContent">
                        <div style="text-align: center; padding: 2rem; color: #64748b;">Cargando consumos...</div>
                    </div>
                </div>

                <!-- Panel Pérdidas -->
                <div class="card" style="padding: 1.25rem; border-radius: 1.25rem; border: 1.5px solid #cbd5e1; background: white; margin-bottom: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
                        <h4 style="margin: 0; color: #991b1b; font-weight: 800; display: flex; align-items: center; gap: 0.35rem;">
                            <span>🗑️</span> Historial de Pérdidas
                        </h4>
                        <!-- Input fecha -->
                        <input type="date" value="${selectedDateLoss}" 
                               onchange="InventoryView.setLossDate(this.value)"
                               style="background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 0.35rem 0.75rem; border-radius: 0.5rem; font-size: 0.85rem; font-weight: 700; outline: none; cursor: pointer;">
                    </div>
                    <div id="lossReportContent">
                        <div style="text-align: center; padding: 2rem; color: #64748b;">Cargando pérdidas...</div>
                    </div>
                </div>
            </div>
        `;
    },

    renderHistorySection(movements) {
        return `
            <div class="card">
                <h3 style="margin-bottom: 1.5rem; color: #fff; font-size: 1.2rem; display: flex; align-items: center; gap: 0.5rem;">📚 Historial Completo de Movimientos (Últimos 100)</h3>
                <div id="fullMovementsTable">
                    ${this.renderMovements(movements.slice(0, 100))}
                </div>
            </div>
        `;
    },

    async switchSection(section) {
        this.currentSection = section;
        this.stockFilter = null; // Reset stock filter when switching sections
        // No necesitamos refreshData aquí si ProductsView.render/init lo hacen,
        // pero para asegurar que el cambio de tab se refleje usamos app.navigate
        await app.navigate('inventory');
    },

    async setStockFilter(filter) {
        this.stockFilter = filter;
        if (this.currentSection !== 'inventory') {
            this.currentSection = 'inventory';
        }
        await this.refreshData();
        app.navigate('inventory');
    },

    renderStockAlerts() {
        let title = '';
        let icon = '';
        let items = [];

        if (this.stockFilter === 'low') {
            title = 'Productos con Stock Bajo';
            icon = '⚠️';
            items = this.products.filter(p => !p.deleted && (parseFloat(p.stock) || 0) <= (parseFloat(p.minStock) || 0) && (parseFloat(p.stock) || 0) > 0);
        } else if (this.stockFilter === 'out') {
            title = 'Productos Sin Stock';
            icon = '🛑';
            items = this.products.filter(p => !p.deleted && (parseFloat(p.stock) || 0) <= 0);
        } else if (this.stockFilter === 'expiring') {
            title = 'Próximo a Vencer';
            icon = '⏳';
            const thirtyDays = new Date();
            thirtyDays.setDate(thirtyDays.getDate() + 30);
            items = this.products.filter(p => !p.deleted && p.expiryDate && new Date(p.expiryDate) <= thirtyDays);
        }

        // Agrupar por Categoría
        const grouped = items.reduce((acc, p) => {
            const cat = p.category || 'General';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(p);
            return acc;
        }, {});

        const categories = Object.keys(grouped).sort();

        return `
            <div class="stock-alerts-list animate-fade-in">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <div class="section-title" style="margin: 0;">
                        <span class="icon">${icon}</span> ${title} (${items.length})
                    </div>
                    <button class="btn btn-secondary" onclick="InventoryView.setStockFilter(null)">✖ Cerrar Vista</button>
                </div>

                ${categories.length === 0 ? `
                    <div class="card glass-panel" style="text-align: center; padding: 3rem; color: #94a3b8;">
                        <span style="font-size: 3rem; display: block; margin-bottom: 1rem;">🎉</span>
                        No hay productos en esta condición. ¡Buen trabajo!
                    </div>
                ` : categories.map(catName => `
                    <div class="alert-category-group" style="margin-bottom: 2rem;">
                        <h3 style="color: #6ee7b7; border-bottom: 1px solid rgba(110, 231, 183, 0.2); padding-bottom: 0.5rem; margin-bottom: 1rem; font-size: 1.1rem; display: flex; justify-content: space-between;">
                            <span>📂 ${safeHTML(catName)}</span>
                            <small style="color: #94a3b8; font-weight: normal;">${grouped[catName].length} ítems</small>
                        </h3>
                        <div class="card glass-panel" style="padding: 0; overflow: hidden;">
                            <table class="table compact-table" style="width: 100%; border-collapse: collapse;">
                                <thead style="background: rgba(0,0,0,0.2);">
                                    <tr>
                                        <th style="text-align: left; padding: 0.75rem 1rem;">Producto / Código</th>
                                        <th style="text-align: left; padding: 0.75rem 1rem;">Proveedor</th>
                                        <th style="text-align: center; padding: 0.75rem 1rem;">Stock Actual</th>
                                        <th style="text-align: center; padding: 0.75rem 1rem;">Mínimo</th>
                                        <th style="text-align: right; padding: 0.75rem 1rem;">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${grouped[catName].map(p => {
            const stock = parseFloat(p.stock) || 0;
            const minStock = parseFloat(p.minStock) || 0;
            let stockColor = '#34d399'; // Verde
            let stockLabel = 'Stock OK';

            if (stock <= 0) {
                stockColor = '#ef4444'; // Rojo
                stockLabel = 'Sin Stock';
            } else if (stock <= minStock) {
                stockColor = '#fbbf24'; // Amarillo
                stockLabel = 'Stock Bajo';
            }

            return `
                                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                                            <td style="padding: 0.75rem 1rem;" data-label="Producto">
                                                <div style="font-weight: 600; color: #1e293b;">${safeHTML(p.name)}</div>
                                                <small style="color: #64748b;">${safeHTML(p.barcode || 'Sin código')}</small>
                                            </td>
                                            <td style="padding: 0.75rem 1rem; color: #475569;" data-label="Proveedor">
                                                ${p.supplierName || '—'}
                                            </td>
                                            <td style="padding: 0.75rem 1rem; text-align: center;" data-label="Stock">
                                                <div style="color: ${stockColor}; font-weight: 800; font-size: 1.1rem;">
                                                    ${formatStock(p.stock, p.type === 'weight' ? 3 : 0)}
                                                </div>
                                                <small style="color: ${stockColor}; font-size: 0.65rem; text-transform: uppercase;">${stockLabel}</small>
                                            </td>
                                            <td style="padding: 0.75rem 1rem; text-align: center; color: #64748b; font-size: 0.9rem;" data-label="Mínimo">
                                                ${p.minStock || 0}
                                            </td>
                                            <td style="padding: 0.75rem 1rem; text-align: right;" data-label="Acción">
                                                <button class="btn btn-primary" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;" onclick="InventoryView.quickAdjustment(${p.id})" title="Corregir el stock de este producto">Ajustar</button>
                                                <button class="btn btn-secondary" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;" onclick="InventoryView.showKardex(${p.id})" title="Ver todos los movimientos que afectaron a este producto">Historial</button>
                                            </td>
                                        </tr>
                                    `}).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    renderRecentMovements() {
        const movements = this.recentMovements.slice(0, 15); // Show only recent movements
        return `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 0.5rem;">
                    <h3 style="color: #fff; font-size: 1.2rem; display: flex; align-items: center; gap: 0.5rem;">🔄 Últimos Movimientos de Stock</h3>
                    <div style="font-size: 0.85rem; color: var(--secondary);">Los últimos 15 registros</div>
                </div>
                <div id="movementsTable">
                    ${this.renderMovements(movements)}
                </div>
            </div>
        `;
    },

    async showKardex(productId) {
        const product = await Product.getById(productId);
        if (!product) {
            showNotification('Producto no encontrado', 'error');
            return;
        }
        const kardex = await StockService.getKardexByProduct(productId);
        const typeName = (t) => ({ sale: 'Venta', purchase: 'Compra', adjustment: 'Ajuste', loss: 'Pérdida', consumption: 'Consumo' }[t] || t);
        let rowsHtml = '';
        for (const r of kardex.rows) {
            const refText = r.reference != null && r.reference !== '' ? String(r.reference) : '-';
            const diag = [];
            if (r.noReference) diag.push('Sin ref.');
            if (r.isRollback) diag.push('Rollback');
            if (r.negativeBalance) diag.push('Saldo &lt; 0');
            const diagHtml = diag.length ? ` <span class="badge badge-warning" title="Diagnóstico">${diag.join(', ')}</span>` : '';
            rowsHtml += `
                <tr>
                    <td>${formatDateTime(r.date)}</td>
                    <td><span class="badge ${this.getMovementBadgeClass(r.type)}">${typeName(r.type)}</span>${diagHtml}</td>
                    <td>${refText}</td>
                    <td style="text-align: right; font-weight: 600; color: ${r.quantity >= 0 ? 'var(--success)' : 'var(--danger)'}">${r.sign}${Math.abs(r.quantity)}</td>
                    <td style="text-align: right; font-weight: 600;">${r.balanceAfter}</td>
                </tr>
            `;
        }
        const inconsistencyHtml = kardex.inconsistency
            ? `<div class="pos-alert" style="margin-bottom: 1rem; background: #fef2f2; border-color: var(--danger);"><strong>⚠️ INCONSISTENCIA DETECTADA:</strong> El saldo teórico por movimientos (${kardex.theoreticalBalance}) no coincide con el stock actual del producto (${kardex.currentStock}). No se ha modificado ningún dato.</div>`
            : '';
        const content = `
            <div style="margin-bottom: 1rem;">
                <p><strong>Producto:</strong> ${safeHTML(product.name)}</p>
                <p><strong>Stock actual (Product.stock):</strong> ${kardex.currentStock} ${product.type === 'weight' ? 'kg' : 'un'}</p>
                <p><strong>Saldo teórico (suma de movimientos):</strong> ${kardex.theoreticalBalance}</p>
            </div>
            ${inconsistencyHtml}
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Tipo</th>
                            <th>Referencia</th>
                            <th>Cantidad</th>
                            <th>Saldo</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml || '<tr><td colspan="5" class="empty-state">No hay movimientos</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
        showModal(content, { title: 'Kardex de stock', width: '700px' });
    },

    renderMovements(movements) {
        if (movements.length === 0) {
            return '<div class="empty-state">No hay movimientos o cargando...</div>';
        }

        const typeSymbols = { 
            'sale': '↓', 
            'purchase': '↑', 
            'adjustment': '±', 
            'loss': '×', 
            'consumption': 'C' 
        };

        return `
            <div class="stock-timeline-container">
                <div class="stock-timeline-line"></div>
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    ${movements.map(m => {
                        const symbol = typeSymbols[m.type] || '•';
                        return `
                            <div class="stock-timeline-item">
                                <div class="stock-timeline-marker marker-${m.type}">
                                    ${symbol}
                                </div>
                                <div class="stock-timeline-card">
                                    <div style="flex: 1; min-width: 0;">
                                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.35rem; flex-wrap: wrap; gap: 0.25rem;">
                                            <strong id="product-name-${m.id}" style="font-size: 1rem; color: #1e293b; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 280px; font-weight: 700;">-</strong>
                                            <span style="font-size: 0.75rem; color: #94a3b8; font-weight: 700;">${formatDateTime(m.date)}</span>
                                        </div>
                                        <div style="display: flex; gap: 0.5rem; align-items: center; font-size: 0.85rem; flex-wrap: wrap;">
                                            <span class="badge ${this.getMovementBadgeClass(m.type)}">${this.getMovementTypeName(m.type)}</span>
                                            ${m.reason ? `<span style="color: #64748b; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500;">${safeHTML(m.reason)}</span>` : ''}
                                        </div>
                                    </div>
                                    <div style="text-align: right; min-width: 80px;">
                                        <span class="stock-qty-badge ${m.quantity >= 0 ? 'qty-positive' : 'qty-negative'}">
                                            ${m.quantity >= 0 ? '+' : ''}${m.quantity}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    },

    async initRecentMovements() {
        const movements = this.recentMovements;
        const limit = this.currentSection === 'history' ? Math.min(movements.length, 100) : Math.min(movements.length, 15);

        // Solo para secciones que muestran la tabla de movimientos rápidos
        if (this.currentSection === 'inventory' || this.currentSection === 'history') {
            for (const movement of movements.slice(0, limit)) {
                const product = this.products.find(p => p.id === movement.productId);
                const elem = document.getElementById(`product-name-${movement.id}`);
                if (elem && product) elem.textContent = product.name;
            }
        }

        if (this.currentSection === 'losses') {
            this.setupLossesSearchListeners();
            await this.loadConsumptionReport();
            await this.loadLossReport();
        } else if (this.currentSection === 'bulk-adjustment') {
            this.setupBulkSearchListeners();
            this.updateBulkSelectedProducts();
        }
    },

    setupBulkSearchListeners() {
        const searchInput = document.getElementById('bulkSearchInput');
        const resultsContainer = document.getElementById('bulkSearchResults');
        if (!searchInput || !resultsContainer) return;
        const onKeydown = async (e) => {
            const items = resultsContainer.querySelectorAll('.search-result-item');
            const visible = resultsContainer.style.display !== 'none' && items.length > 0;
            let idx = -1;
            items.forEach((it, i) => { if (it.classList.contains('selected')) idx = i; });
            if (e.key === 'Escape') {
                resultsContainer.innerHTML = '';
                resultsContainer.style.display = 'none';
                searchInput.value = '';
                return;
            }
            if (e.key === 'ArrowDown' && visible) {
                e.preventDefault();
                const next = (idx + 1) % items.length;
                this.highlightBulkResult(next);
                return;
            }
            if (e.key === 'ArrowUp' && visible) {
                e.preventDefault();
                const prev = (idx <= 0 ? items.length - 1 : idx - 1);
                this.highlightBulkResult(prev);
                return;
            }
            if (e.key === 'Enter' && visible) {
                e.preventDefault();
                const sel = idx >= 0 ? items[idx] : items[0];
                const id = sel && (sel.dataset.productId || sel.getAttribute('data-product-id'));
                if (id) this.selectBulkProduct(parseInt(id, 10));
                return;
            }
        };
        searchInput.removeEventListener('keydown', searchInput._bulkKeydown);
        searchInput._bulkKeydown = onKeydown;
        searchInput.addEventListener('keydown', onKeydown);
        const closeDropdown = (e) => {
            if (resultsContainer && searchInput && !searchInput.contains(e.target) && !resultsContainer.contains(e.target)) {
                resultsContainer.style.display = 'none';
            }
        };
        document.removeEventListener('click', document._bulkCloseDropdown);
        document._bulkCloseDropdown = closeDropdown;
        document.addEventListener('click', closeDropdown);
    },

    setupLossesSearchListeners() {
        const searchInput = document.getElementById('lossesSearchInput');
        const resultsContainer = document.getElementById('lossesSearchResults');
        if (!searchInput || !resultsContainer) return;
        
        const onKeydown = async (e) => {
            const items = resultsContainer.querySelectorAll('.search-result-item');
            const visible = resultsContainer.style.display !== 'none' && items.length > 0;
            let idx = -1;
            items.forEach((it, i) => { if (it.classList.contains('selected')) idx = i; });
            if (e.key === 'Escape') {
                resultsContainer.innerHTML = '';
                resultsContainer.style.display = 'none';
                searchInput.value = '';
                return;
            }
            if (e.key === 'ArrowDown' && visible) {
                e.preventDefault();
                const next = (idx + 1) % items.length;
                this.highlightLossesResult(next);
                return;
            }
            if (e.key === 'ArrowUp' && visible) {
                e.preventDefault();
                const prev = (idx <= 0 ? items.length - 1 : idx - 1);
                this.highlightLossesResult(prev);
                return;
            }
            if (e.key === 'Enter' && visible) {
                e.preventDefault();
                const sel = idx >= 0 ? items[idx] : items[0];
                const id = sel && (sel.dataset.productId || sel.getAttribute('data-product-id'));
                if (id) this.selectLossesProduct(parseInt(id, 10));
                return;
            }
        };
        searchInput.removeEventListener('keydown', searchInput._lossesKeydown);
        searchInput._lossesKeydown = onKeydown;
        searchInput.addEventListener('keydown', onKeydown);
        
        const closeDropdown = (e) => {
            if (resultsContainer && searchInput && !searchInput.contains(e.target) && !resultsContainer.contains(e.target)) {
                resultsContainer.style.display = 'none';
            }
        };
        document.removeEventListener('click', document._lossesCloseDropdown);
        document._lossesCloseDropdown = closeDropdown;
        document.addEventListener('click', closeDropdown);
    },

    highlightLossesResult(index, isMouse = false) {
        if (isMouse && document.body.classList.contains('keyboard-nav')) return;
        const resultsContainer = document.getElementById('lossesSearchResults');
        if (!resultsContainer) return;
        const items = resultsContainer.querySelectorAll('.search-result-item');
        items.forEach((item, i) => item.classList.toggle('selected', i === index));
        const target = resultsContainer.querySelector(`.search-result-item[data-index="${index}"]`);
        if (target) target.scrollIntoView({ block: 'nearest' });
    },

    async handleLossesSearch(event) {
        const term = event.target.value.trim();
        const resultsContainer = document.getElementById('lossesSearchResults');
        const searchInput = document.getElementById('lossesSearchInput');
        if (!resultsContainer || !searchInput) return;

        const isBarcode = term.length >= 8 && !isNaN(term);
        if (isBarcode) {
            const product = await Product.getByBarcode(term);
            if (product) {
                searchInput.value = '';
                resultsContainer.style.display = 'none';
                this.selectLossesProduct(product.id);
                return;
            }
        }

        if (term.length < 2) {
            resultsContainer.innerHTML = '';
            resultsContainer.style.display = 'none';
            return;
        }

        if (this.lossesSearchTimeout) clearTimeout(this.lossesSearchTimeout);
        this.lossesSearchTimeout = setTimeout(async () => {
            const products = await Product.search(term);
            this.showLossesSearchDropdown(products);
        }, 280);
    },

    showLossesSearchDropdown(products) {
        const resultsContainer = document.getElementById('lossesSearchResults');
        if (!resultsContainer) return;
        if (!products || products.length === 0) {
            resultsContainer.innerHTML = '<div style="padding: 1rem; color: #991b1b; background: #fef2f2; font-weight: 700; text-align: center;">❌ No se encontraron productos</div>';
            resultsContainer.style.display = 'block';
            return;
        }
        resultsContainer.innerHTML = products.map((p, index) => {
            const isWeight = p.type === 'weight';
            const stockIcon = p.stock <= 0 ? '❌' : (p.stock <= (isWeight ? 1 : 5) ? '⚠️' : '✅');
            return `
                <div class="search-result-item ${index === 0 ? 'selected' : ''}" 
                     data-index="${index}"
                     data-product-id="${p.id}"
                     onmouseover="InventoryView.highlightLossesResult(${index}, true)"
                     onclick="InventoryView.selectLossesProduct(${p.id})">
                    <div style="flex: 1; padding: 0.5rem 0.75rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9;">
                        <div>
                            <div style="font-weight: 700; color: #1e293b;">${safeHTML(p.name)}</div>
                            <small style="color: #64748b;">CÓD: ${safeHTML(p.barcode || 'S/N')}</small>
                        </div>
                        <div style="font-size: 0.85rem; font-weight: bold; color: #475569;">
                            ${stockIcon} ${formatStock(p.stock)} ${isWeight ? 'kg' : 'un'}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        resultsContainer.style.display = 'block';
        if (products.length > 0) this.highlightLossesResult(0);
    },

    async selectLossesProduct(productId) {
        const resultsContainer = document.getElementById('lossesSearchResults');
        const searchInput = document.getElementById('lossesSearchInput');
        if (resultsContainer) { resultsContainer.innerHTML = ''; resultsContainer.style.display = 'none'; }
        if (searchInput) searchInput.value = '';
        
        const product = await Product.getById(productId);
        if (!product) return;
        
        this.selectedLossesProductData = product;
        
        const panel = document.getElementById('lossesSelectedProductPanel');
        if (!panel) return;
        
        const isWeight = product.type === 'weight';
        const unit = isWeight ? 'kg' : 'un';
        const stepVal = isWeight ? '0.001' : '1';
        const minVal = isWeight ? '0.001' : '1';
        const placeholderVal = isWeight ? '0.000 kg' : 'Cant.';
        
        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; width: 100%;">
                <div>
                    <strong style="color: #1e293b; font-size: 1.05rem;">${safeHTML(product.name)}</strong>
                    <div style="font-size: 0.75rem; color: #64748b;">Stock: ${product.stock} ${unit} | Costo: ${formatCLP(product.cost)}</div>
                </div>
                
                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                    <div style="width: 90px;">
                        <input type="number" id="lossesQtyInput" class="form-control" placeholder="${placeholderVal}" min="${minVal}" step="${stepVal}" style="padding: 0.4rem; font-size: 0.9rem; text-align: center;" required>
                    </div>
                    
                    <div style="display: flex; gap: 0.25rem; background: #e2e8f0; padding: 0.2rem; border-radius: 0.5rem;">
                        <label style="padding: 0.35rem 0.6rem; font-size: 0.8rem; font-weight: 700; color: #475569; display: flex; align-items: center; gap: 0.2rem; cursor: pointer; border-radius: 0.375rem;" id="lblTypeLoss">
                            <input type="radio" name="lossesType" value="loss" checked style="display: none;" onchange="document.getElementById('lblTypeLoss').style.background='white'; document.getElementById('lblTypeLoss').style.color='#ef4444'; document.getElementById('lblTypeCons').style.background='transparent'; document.getElementById('lblTypeCons').style.color='#475569';">
                            🗑️ Merma
                        </label>
                        <label style="padding: 0.35rem 0.6rem; font-size: 0.8rem; font-weight: 700; color: #475569; display: flex; align-items: center; gap: 0.2rem; cursor: pointer; border-radius: 0.375rem;" id="lblTypeCons">
                            <input type="radio" name="lossesType" value="consumption" style="display: none;" onchange="document.getElementById('lblTypeCons').style.background='white'; document.getElementById('lblTypeCons').style.color='#3b82f6'; document.getElementById('lblTypeLoss').style.background='transparent'; document.getElementById('lblTypeLoss').style.color='#475569';">
                            🍴 Consumo
                        </label>
                    </div>

                    <div>
                        <input type="text" id="lossesReasonInput" class="form-control" placeholder="Motivo (ej: Vencido)" style="padding: 0.4rem; font-size: 0.9rem; width: 140px;">
                    </div>

                    <button class="btn btn-primary" onclick="InventoryView.saveQuickLossOrConsumption()" style="padding: 0.45rem 1rem; font-weight: 800; font-size: 0.85rem; background: #10b981; border: none; border-radius: 0.5rem;">
                        Registrar
                    </button>
                    
                    <button class="btn btn-secondary" onclick="InventoryView.cancelLossesSelection()" style="padding: 0.45rem; font-size: 0.85rem; border-radius: 0.5rem; background: white; border: 1px solid #cbd5e1; color: #475569;">
                        ✖
                    </button>
                </div>
            </div>
        `;
        panel.style.display = 'block';
        
        document.getElementById('lblTypeLoss').style.background = 'white';
        document.getElementById('lblTypeLoss').style.color = '#ef4444';
        
        const qtyInp = document.getElementById('lossesQtyInput');
        if (qtyInp) {
            qtyInp.focus();
            qtyInp.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.saveQuickLossOrConsumption();
                }
            });
        }
    },
    
    cancelLossesSelection() {
        this.selectedLossesProductData = null;
        const panel = document.getElementById('lossesSelectedProductPanel');
        if (panel) panel.style.display = 'none';
    },

    async saveQuickLossOrConsumption() {
        if (!this.selectedLossesProductData) return;
        const p = this.selectedLossesProductData;
        const qtyInput = document.getElementById('lossesQtyInput');
        const reasonInput = document.getElementById('lossesReasonInput');
        
        if (!qtyInput) return;
        const qty = parseFloat(qtyInput.value);
        if (isNaN(qty) || qty <= 0) {
            showNotification('Ingresa una cantidad mayor a 0', 'warning');
            return;
        }
        
        const selectedType = document.querySelector('input[name="lossesType"]:checked')?.value || 'loss';
        const reason = (reasonInput?.value || '').trim() || (selectedType === 'loss' ? 'Pérdida registrada manualmente' : 'Consumo registrado manualmente');
        
        try {
            if (selectedType === 'loss') {
                await StockService.createLoss(p.id, qty, reason);
            } else {
                await StockService.createConsumption(p.id, qty, reason);
            }
            
            showNotification('Egreso registrado correctamente', 'success');
            this.selectedLossesProductData = null;
            
            await this.refreshData();
            app.navigate('inventory');
        } catch (err) {
            showNotification(err.message, 'error');
        }
    },

    selectedProducts: [],
    bulkSearchTimeout: null,
    bulkSearchResults: [],

    async handleBulkSearch(event) {
        const term = event.target.value.trim();
        const resultsContainer = document.getElementById('bulkSearchResults');
        const searchInput = document.getElementById('bulkSearchInput');
        if (!resultsContainer || !searchInput) return;

        const isBarcode = term.length >= 8 && !isNaN(term);
        if (isBarcode) {
            const product = await Product.getByBarcode(term);
            if (product) {
                searchInput.value = '';
                resultsContainer.style.display = 'none';
                this.showBulkQuantityModal(product);
                return;
            }
        }

        if (term.length < 2) {
            resultsContainer.innerHTML = '';
            resultsContainer.style.display = 'none';
            return;
        }

        if (this.bulkSearchTimeout) clearTimeout(this.bulkSearchTimeout);
        this.bulkSearchTimeout = setTimeout(async () => {
            const products = await Product.search(term);
            this.bulkSearchResults = products;
            this.showBulkSearchDropdown(products);
        }, 280);
    },

    showBulkSearchDropdown(products) {
        const resultsContainer = document.getElementById('bulkSearchResults');
        if (!resultsContainer) return;
        if (!products || products.length === 0) {
            resultsContainer.innerHTML = '<div style="padding: 1.5rem; color: #991b1b; background: #fef2f2; font-weight: 700; text-align: center;">❌ No se encontraron productos</div>';
            resultsContainer.style.display = 'block';
            return;
        }
        resultsContainer.innerHTML = products.map((p, index) => {
            const isWeight = p.type === 'weight';
            const stockClass = p.stock <= 0 ? 'stock-none' : (p.stock <= (isWeight ? 1 : 5) ? 'stock-low' : 'stock-ok');
            const stockIcon = p.stock <= 0 ? '❌' : (p.stock <= (isWeight ? 1 : 5) ? '⚠️' : '✅');

            return `
                <div class="search-result-item ${index === 0 ? 'selected' : ''}" 
                     data-index="${index}"
                     data-product-id="${p.id}"
                     onmouseover="InventoryView.highlightBulkResult(${index}, true)"
                     onclick="InventoryView.selectBulkProduct(${p.id})">
                    <div style="flex: 1;">
                        <div class="search-result-name" style="font-size: 1.1rem;">${safeHTML(p.name)}</div>
                        <div style="font-size: 0.8rem; color: #64748b; font-weight: 600;">CÓD: ${safeHTML(p.barcode || 'S/N')}</div>
                    </div>
                    <div style="text-align: right;">
                        <div class="search-result-stock ${stockClass}" style="font-size: 0.85rem; padding: 0.4rem 0.8rem;">
                            ${stockIcon} Stock: ${formatStock(p.stock)} ${isWeight ? 'kg' : 'un'}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        resultsContainer.style.display = 'block';
        if (products.length > 0) this.highlightBulkResult(0);
    },

    highlightBulkResult(index, isMouse = false) {
        // Bloqueo de interferencia de mouse (Punto 1)
        if (isMouse && document.body.classList.contains('keyboard-nav')) return;

        const resultsContainer = document.getElementById('bulkSearchResults');
        if (!resultsContainer) return;
        const items = resultsContainer.querySelectorAll('.search-result-item');
        items.forEach((item, i) => item.classList.toggle('selected', i === index));
        const target = resultsContainer.querySelector(`.search-result-item[data-index="${index}"]`);
        if (target) target.scrollIntoView({ block: 'nearest' });
    },

    async selectBulkProduct(productId) {
        const resultsContainer = document.getElementById('bulkSearchResults');
        const searchInput = document.getElementById('bulkSearchInput');
        if (resultsContainer) { resultsContainer.innerHTML = ''; resultsContainer.style.display = 'none'; }
        if (searchInput) searchInput.value = '';
        const product = await Product.getById(productId);
        if (product) this.showBulkQuantityModal(product);
    },

    showBulkQuantityModal(product) {
        if (this.selectedProducts.some(p => p.id === product.id)) {
            showNotification('Este producto ya está en la lista', 'warning');
            return;
        }
        const isWeight = product.type === 'weight';
        const content = `
            <div style="text-align: center; margin-bottom: 1.5rem;">
                <div style="font-size: 1.25rem; font-weight: bold; color: var(--primary); margin-bottom: 0.5rem;">${safeHTML(product.name)}</div>
                <div style="font-size: 0.95rem; color: var(--secondary);">
                    Código: ${safeHTML(product.barcode || 'Sin código')} • Stock: ${product.stock} ${isWeight ? 'kg' : 'un'}
                </div>
            </div>
            <div class="form-group">
                <label>Cantidad a ajustar *</label>
                <input type="number" id="bulkModalQty" step="any" class="form-control" 
                       step="${isWeight ? '0.001' : '1'}" placeholder="${isWeight ? '0.001' : '1'}" 
                       style="font-size: 1.25rem; text-align: center; padding: 0.75rem;" autofocus>
                <small>${isWeight ? 'Kg (ej: 0.250, 1.5)' : 'Unidades'}. + sumar, − restar (solo en Ajuste de inventario).</small>
            </div>
        `;
        const footer = `
            <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-primary" data-action="bulk-add" onclick="InventoryView.addProductFromBulkModal(${product.id})">Agregar al ajuste</button>
        `;
        showModal(content, { title: 'Cantidad para ajuste', footer, width: '420px' });
        const qtyInput = document.getElementById('bulkModalQty');
        if (qtyInput) {
            setTimeout(() => { qtyInput.focus(); qtyInput.select(); }, 80);
            qtyInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); InventoryView.addProductFromBulkModal(product.id); }
            });
        }
    },

    async addProductFromBulkModal(productId) {
        const product = await Product.getById(productId);
        const qtyInput = document.getElementById('bulkModalQty');
        if (!product || !qtyInput) return;

        let qty = parseFloat(qtyInput.value);

        // Si el campo está vacío, el valor por defecto es 1
        if (qtyInput.value === '') {
            qty = 1;
        }

        if (isNaN(qty) || qty === 0) {
            showNotification('Ingresa una cantidad distinta de 0', 'warning');
            return;
        }

        if (this.selectedProducts.some(p => p.id === productId)) {
            showNotification('Este producto ya está en la lista', 'warning');
            closeModal();
            return;
        }

        this.selectedProducts.push({
            id: productId,
            name: product.name,
            stock: product.stock,
            unit: product.type === 'weight' ? 'kg' : 'un',
            quantity: qty,
            cost: parseFloat(product.cost) || 0,
            price: parseFloat(product.price) || 0
        });
        this.updateBulkSelectedProducts();
        closeModal();
        const searchInput = document.getElementById('bulkSearchInput');
        if (searchInput) { searchInput.value = ''; searchInput.focus(); }
        showNotification(`${product.name} agregado`, 'success');
    },

    async addProductToBulk(productId) {
        const product = await Product.getById(productId);
        if (!product) return;
        if (this.selectedProducts.find(p => p.id === productId)) {
            showNotification('Este producto ya está en la lista', 'warning');
            return;
        }
        this.showBulkQuantityModal(product);
    },

    updateBulkSelectedProducts() {
        const container = document.getElementById('bulkSelectedProducts');
        const counter = document.getElementById('bulkSelectedCount');

        if (counter) {
            counter.textContent = `${this.selectedProducts.length} seleccionados`;
            counter.style.background = this.selectedProducts.length > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)';
            counter.style.color = this.selectedProducts.length > 0 ? '#34d399' : '#60a5fa';
        }

        if (this.selectedProducts.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 3rem; background: rgba(17, 24, 39, 0.4); border: 1px dashed rgba(255,255,255,0.1); border-radius: 1rem; text-align: center;">
                    <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;">🛒</div>
                    <p style="color: #94a3b8; font-size: 1.1rem; margin-bottom: 0;">Aún no has agregado productos</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                ${this.selectedProducts.map((p, index) => {
            const diffValue = parseFloat(p.quantity) || 0;
            const isPositive = diffValue > 0;
            const isNegative = diffValue < 0;
            const colorIndicator = isPositive ? '#10b981' : (isNegative ? '#ef4444' : '#64748b');
            const bgIndicator = isPositive ? '#f0fdf4' : (isNegative ? '#fff1f2' : '#f8fafc');

            return `
                    <div style="display: flex; align-items: center; background: #ffffff; border: 2px solid #e2e8f0; border-radius: 1rem; padding: 1.25rem; transition: all 0.2s; box-shadow: var(--shadow-sm);" onmouseover="this.style.borderColor='#cbd5e1'; this.style.transform='translateX(4px)';" onmouseout="this.style.borderColor='#e2e8f0'; this.style.transform='translateX(0)';">
                        
                        <!-- Columna Info -->
                        <div style="flex: 1;">
                            <strong style="font-size: 1.15rem; color: #1e293b; display: block; margin-bottom: 0.5rem; font-weight: 800;">${safeHTML(p.name)}</strong>
                            <div style="display: flex; gap: 0.75rem; font-size: 0.82rem; color: #475569; flex-wrap: wrap; font-weight: 600;">
                                <span style="background: #f1f5f9; padding: 0.25rem 0.6rem; border-radius: 0.5rem; border: 1px solid #e2e8f0;">
                                    📦 Stock: <strong style="color: #1e293b;">${p.stock} ${p.unit}</strong>
                                </span>
                                <span style="background: #eff6ff; color: #1e40af; padding: 0.25rem 0.6rem; border-radius: 0.5rem; border: 1px solid #bfdbfe;">
                                    💰 Neto: <strong>${formatCLP(p.cost)}</strong>
                                </span>
                                <span style="background: #f0fdf4; color: #166534; padding: 0.25rem 0.6rem; border-radius: 0.5rem; border: 1px solid #bbf7d0;">
                                    🏷️ Venta: <strong>${formatCLP(p.price)}</strong>
                                </span>
                            </div>
                        </div>

                        <!-- Columna Input Ajuste -->
                        <div style="display: flex; align-items: center; gap: 1rem; margin-left: 1rem; padding-left: 1rem; border-left: 2px dashed #e2e8f0;">
                            <div style="display: flex; align-items: center; background: ${bgIndicator}; border-radius: 0.75rem; border: 2px solid ${colorIndicator}; overflow: hidden; transition: all 0.2s;">
                                <div style="background: ${colorIndicator}; color: white; padding: 0.5rem 0.75rem; font-weight: 900; font-size: 1.3rem; display: flex; align-items: center; justify-content: center; min-width: 45px;">
                                    ${isPositive ? '+' : (isNegative ? '−' : '±')}
                                </div>
                                <input type="number" step="any" 
                                       class="bulk-qty-input" 
                                       data-index="${index}"
                                       value="${p.quantity}" 
                                       step="${p.unit === 'kg' ? '0.001' : '1'}"
                                       placeholder="${p.unit === 'kg' ? '0.001' : '1'}"
                                       style="background: transparent; border: none; color: #1e293b; text-align: center; width: 110px; font-size: 1.3rem; font-weight: 800; padding: 0.5rem; outline: none;"
                                       oninput="InventoryView.updateProductQuantity(${index}, this.value); const v = parseFloat(this.value); const isP = v > 0; const isN = v < 0; const cId = isP ? '#10b981' : (isN ? '#ef4444' : '#64748b'); const bId = isP ? '#f0fdf4' : (isN ? '#fff1f2' : '#f8fafc'); this.parentElement.style.borderColor = cId; this.parentElement.style.background = bId; this.previousElementSibling.textContent = isP ? '+' : (isN ? '−' : '±'); this.previousElementSibling.style.background = cId;"
                                       onkeypress="if(event.key === 'Enter') { event.preventDefault(); InventoryView.focusNextBulkInput(${index}); }">
                                <div style="color: #475569; padding-right: 0.75rem; font-size: 0.9rem; font-weight: 700;">
                                    ${p.unit}
                                </div>
                            </div>
                            
                            <!-- Boton Quitar -->
                            <button class="btn" onclick="InventoryView.removeProductFromBulk(${index})" 
                                    style="background: #fee2e2; color: #dc2626; border: 2px solid #fecaca; width: 2.8rem; height: 2.8rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; padding: 0; transition: all 0.2s; font-weight: bold;" onmouseover="this.style.background='#fecaca';" onmouseout="this.style.background='#fee2e2';">
                                ✕
                            </button>
                        </div>
                    </div>
                `}).join('')}
            </div>

        `;
    },

    focusNextBulkInput(currentIndex) {
        const nextInput = document.querySelector(`.bulk-qty-input[data-index="${currentIndex + 1}"]`);
        if (nextInput) {
            nextInput.focus();
            nextInput.select();
        } else {
            const searchInput = document.getElementById('bulkSearchInput');
            const reasonEl = document.getElementById('bulkReason');
            if (searchInput) searchInput.focus();
            else if (reasonEl) reasonEl.focus();
        }
    },

    updateProductQuantity(index, value) {
        this.selectedProducts[index].quantity = parseFloat(value) || 0;
    },

    removeProductFromBulk(index) {
        this.selectedProducts.splice(index, 1);
        this.updateBulkSelectedProducts();
    },

    resetBulkForm() {
        this.selectedProducts = [];
        this.bulkSearchResults = [];
        const searchInput = document.getElementById('bulkSearchInput');
        const resultsEl = document.getElementById('bulkSearchResults');
        const typeEl = document.getElementById('bulkMovementType');
        const reasonEl = document.getElementById('bulkReason');
        if (searchInput) searchInput.value = '';
        if (resultsEl) { resultsEl.innerHTML = ''; resultsEl.style.display = 'none'; }
        this.selectedBulkType = 'consumption';
        if (reasonEl) reasonEl.value = '';
        this.updateBulkSelectedProducts();
        if (searchInput) searchInput.focus();
    },

    async saveBulkAdjustment() {
        if (this.selectedProducts.length === 0) {
            showNotification('Debes seleccionar al menos un producto', 'warning');
            return;
        }
        const reasonEl = document.getElementById('bulkReason');
        const type = this.selectedBulkType;
        const reason = (reasonEl && reasonEl.value ? reasonEl.value.trim() : '') || (type === 'consumption' ? 'Consumo masivo' : 'Pérdida masiva');
        const invalidProducts = this.selectedProducts.filter(p => p.quantity === 0);
        if (invalidProducts.length > 0) {
            showNotification('Todos los productos deben tener cantidad distinta de 0', 'warning');
            return;
        }
        const absInvalid = this.selectedProducts.some(p => p.quantity < 0);
        if (absInvalid) {
            showNotification('En pérdida o consumo masivo la cantidad debe ser positiva (el sistema la descontará solo)', 'warning');
            return;
        }
        try {
            await StockService.applyBulkAdjustmentAtomic(this.selectedProducts, type, reason);
            showNotification(`Ajuste masivo guardado (${this.selectedProducts.length} productos)`, 'success');
            this.resetBulkForm();
            this.currentSection = 'inventory';
            await this.refreshData();
            app.navigate('inventory');
        } catch (error) {
            showNotification(error.message, 'error');
        }
    },

    async loadConsumptionReport() {
        const allMovements = await StockMovement.getByType('consumption');
        const container = document.getElementById('consumptionReportContent');
        if (!container) return;

        const targetDate = new Date(this.selectedConsumptionDate + 'T00:00:00');
        const targetY = targetDate.getFullYear();
        const targetM = targetDate.getMonth() + 1;
        const targetD = targetDate.getDate();

        // Semana actual (ISO Week or last 7 days? Let's do current week Mon-Sun)
        const startOfWeek = new Date(targetDate);
        const day = startOfWeek.getDay() || 7; // 1 (Mon) to 7 (Sun)
        startOfWeek.setHours(0,0,0,0);
        startOfWeek.setDate(startOfWeek.getDate() - (day - 1));
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        endOfWeek.setHours(23,59,59,999);

        const dayMovements = allMovements.filter(m => {
            const d = new Date(m.date);
            return d.getFullYear() === targetY && (d.getMonth() + 1) === targetM && d.getDate() === targetD;
        });

        const weekMovements = allMovements.filter(m => {
            const d = new Date(m.date);
            return d >= startOfWeek && d <= endOfWeek;
        });

        const monthMovements = allMovements.filter(m => {
            const d = new Date(m.date);
            return d.getFullYear() === targetY && (d.getMonth() + 1) === targetM;
        });

        const calcTotal = (movs) => movs.reduce((sum, m) => {
            const p = this.products.find(prod => prod.id === m.productId);
            return sum + (parseFloat(m.cost_value) || (p ? Math.abs(m.quantity) * (parseFloat(p.cost) || 0) : 0));
        }, 0);

        const dayTotalCost = calcTotal(dayMovements);
        const weekTotalCost = calcTotal(weekMovements);
        const monthTotalCost = calcTotal(monthMovements);
        const dayTotalQty = dayMovements.reduce((sum, m) => sum + Math.abs(m.quantity), 0);

        let html = `
            <div style="background: #ffffff; padding: 2rem; border-radius: 1.5rem; margin-bottom: 2rem; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 2px solid #f1f5f9;">
                    <div>
                        <h3 style="margin: 0; color: #1e3a8a; font-size: 1.5rem; font-weight: 800; display: flex; align-items: center; gap: 0.5rem;">
                            <span>📊</span> Resumen de Consumo de la Casa
                        </h3>
                        <p style="margin: 0.5rem 0 0 0; color: #64748b; font-size: 0.95rem; font-weight: 600;">Valores calculados a Precio de Costo (Neto)</p>
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
                        <label style="font-size: 0.75rem; font-weight: 800; color: #1e3a8a; text-transform: uppercase;">Fecha de Análisis</label>
                        <input type="date" value="${this.selectedConsumptionDate}" 
                               onchange="InventoryView.setConsumptionDate(this.value)"
                               style="background: #eff6ff; border: 2px solid #bfdbfe; color: #1e40af; padding: 0.75rem 1.25rem; border-radius: 1rem; font-size: 1.1rem; font-weight: 800; outline: none; cursor: pointer; transition: all 0.2s;"
                               onmouseover="this.style.borderColor='#3b82f6'" onmouseout="this.style.borderColor='#bfdbfe'">
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem;">
                    <div style="background: #ffffff; border: 2px solid #bfdbfe; border-radius: 1.25rem; padding: 1.5rem; display: flex; flex-direction: column; gap: 0.5rem;">
                        <span style="font-size: 0.8rem; font-weight: 800; color: #3b82f6; text-transform: uppercase; letter-spacing: 1px;">TOTAL HOY</span>
                        <span style="font-size: 2.2rem; font-weight: 900; color: #1e40af;">${formatCLP(dayTotalCost)}</span>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; font-size: 0.85rem; color: #64748b; font-weight: 600;">
                            <span>Cant. de productos:</span>
                            <span style="background: #dbeafe; color: #1e40af; padding: 0.2rem 0.6rem; border-radius: 0.5rem;">${dayTotalQty} items</span>
                        </div>
                    </div>

                    <div style="background: #ffffff; border: 2px solid #c084fc; border-radius: 1.25rem; padding: 1.5rem; display: flex; flex-direction: column; gap: 0.5rem;">
                        <span style="font-size: 0.8rem; font-weight: 800; color: #a855f7; text-transform: uppercase; letter-spacing: 1px;">ESTA SEMANA</span>
                        <span style="font-size: 2.2rem; font-weight: 900; color: #7e22ce;">${formatCLP(weekTotalCost)}</span>
                        <p style="margin: 0.5rem 0 0 0; font-size: 0.75rem; color: #9333ea; font-weight: 600;">Del ${startOfWeek.toLocaleDateString()} al ${endOfWeek.toLocaleDateString()}</p>
                    </div>

                    <div style="background: linear-gradient(135deg, #1e3a8a, #1d4ed8); border-radius: 1.25rem; padding: 1.5rem; display: flex; flex-direction: column; gap: 0.5rem; box-shadow: 0 10px 20px -5px rgba(37, 99, 235, 0.3);">
                        <span style="font-size: 0.8rem; font-weight: 800; color: #bfdbfe; text-transform: uppercase; letter-spacing: 1px;">TOTAL MES</span>
                        <span style="font-size: 2.2rem; font-weight: 900; color: #ffffff;">${formatCLP(monthTotalCost)}</span>
                        <p style="margin: 0.5rem 0 0 0; font-size: 0.75rem; color: #93c5fd; font-weight: 600; text-transform: capitalize;">Acumulado ${formatMonthYear(this.selectedConsumptionDate)}</p>
                    </div>
                </div>
            </div>

            <div class="card" style="padding: 0; overflow: hidden; border: 1px solid #e2e8f0; border-radius: 1.5rem;">
                <div style="padding: 1.5rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                    <h4 style="margin: 0; color: #334155; font-weight: 800;">Detalle de Consumo del Día</h4>
                    <span style="font-size: 0.85rem; color: #64748b; font-weight: 700;">${dayMovements.length} Registros</span>
                </div>
                <div class="table-container" style="margin: 0; max-height: 500px; overflow-y: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead style="position: sticky; top: 0; background: #ffffff; z-index: 10; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                            <tr>
                                <th style="text-align: left; padding: 1rem 1.5rem; font-size: 0.75rem; color: #64748b; text-transform: uppercase;">Hora</th>
                                <th style="text-align: left; padding: 1rem 1.5rem; font-size: 0.75rem; color: #64748b; text-transform: uppercase;">Producto</th>
                                <th style="text-align: center; padding: 1rem 1.5rem; font-size: 0.75rem; color: #64748b; text-transform: uppercase;">Cant.</th>
                                <th style="text-align: right; padding: 1rem 1.5rem; font-size: 0.75rem; color: #64748b; text-transform: uppercase;">Costo Unit.</th>
                                <th style="text-align: right; padding: 1rem 1.5rem; font-size: 0.75rem; color: #64748b; text-transform: uppercase;">Total Neto</th>
                                <th style="text-align: left; padding: 1rem 1.5rem; font-size: 0.75rem; color: #64748b; text-transform: uppercase;">Motivo</th>
                                <th style="text-align: right; padding: 1rem 1.5rem; font-size: 0.75rem; color: #64748b; text-transform: uppercase;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${dayMovements.length === 0 ? `
                                <tr><td colspan="7" style="padding: 4rem; text-align: center; color: #94a3b8;">No se encontraron consumos registrados para esta fecha.</td></tr>
                            ` : dayMovements.map(m => {
                                const p = this.products.find(prod => prod.id === m.productId);
                                const costVal = parseFloat(m.cost_value) || (p ? Math.abs(m.quantity) * (parseFloat(p.cost) || 0) : 0);
                                const unitC = p ? parseFloat(p.cost) : (m.quantity !== 0 ? costVal / Math.abs(m.quantity) : 0);
                                return `
                                    <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                                        <td style="padding: 1.25rem 1.5rem; font-weight: 700; color: #64748b;">${new Date(m.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                        <td style="padding: 1.25rem 1.5rem;">
                                            <div style="font-weight: 800; color: #1e293b;">${p ? safeHTML(p.name) : 'Producto no encontrado'}</div>
                                            <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 0.25rem;">${p ? p.barcode : '-'}</div>
                                        </td>
                                        <td style="padding: 1.25rem 1.5rem; text-align: center;">
                                            <span style="background: #f1f5f9; color: #334155; padding: 0.4rem 0.8rem; border-radius: 0.5rem; font-weight: 900; font-size: 1.1rem; border: 1px solid #e2e8f0;">${Math.abs(m.quantity)}</span>
                                        </td>
                                        <td style="padding: 1.25rem 1.5rem; text-align: right; color: #64748b; font-weight: 700;">${formatCLP(unitC)}</td>
                                        <td style="padding: 1.25rem 1.5rem; text-align: right;">
                                            <div style="font-weight: 900; color: #1e293b; font-size: 1.15rem;">${formatCLP(costVal)}</div>
                                            <div style="font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Valor Neto</div>
                                        </td>
                                        <td style="padding: 1.25rem 1.5rem; color: #64748b; font-style: italic; font-weight: 600; font-size: 0.9rem;">${safeHTML(m.reason || '-')}</td>
                                        <td style="padding: 1.25rem 1.5rem; text-align: right;">
                                            <button class="btn btn-sm btn-outline-danger" onclick="InventoryView.deleteConsumption(${m.id})" title="Eliminar registro">🗑️</button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        container.innerHTML = html;
    },

    setConsumptionDate(date) {
        if (!date) return;
        this.selectedConsumptionDate = date;
        this.loadConsumptionReport();
    },

    async deleteConsumption(id) {
        const movement = await StockMovement.getById(id);
        if (!movement) {
            showNotification('El registro no fue encontrado', 'error');
            return;
        }

        const p = this.products.find(prod => prod.id === movement.productId);
        const productName = p ? p.name : 'Producto desconocido';
        const qty = Math.abs(movement.quantity);

        const modalContent = `
            <div style="text-align: center; padding: 2rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🍴</div>
                <h3 style="color: #dc2626; font-size: 1.5rem; font-weight: 800; margin-bottom: 1rem;">¿Eliminar Registro de Consumo Interno?</h3>
                <p style="color: #64748b; font-size: 1rem; margin-bottom: 1.5rem;">
                    <strong>${productName}</strong> (${qty} unidades)
                </p>
                <p style="color: #64748b; font-size: 0.95rem; margin-bottom: 2rem;">
                    ¿Deseas que el stock de este producto vuelva al inventario?
                </p>
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <button id="returnStockBtn" style="flex: 1; padding: 1rem 2rem; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 0.75rem; font-weight: 800; font-size: 1rem; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);"
                            onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(16, 185, 129, 0.4)';"
                            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(16, 185, 129, 0.3)';">
                        🟢 SÍ - Devolver Stock
                    </button>
                    <button id="noReturnStockBtn" style="flex: 1; padding: 1rem 2rem; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border: none; border-radius: 0.75rem; font-weight: 800; font-size: 1rem; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);"
                            onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(239, 68, 68, 0.4)';"
                            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(239, 68, 68, 0.3)';">
                        🔴 NO - Solo Eliminar
                    </button>
                </div>
                <button id="cancelBtn" style="margin-top: 1.5rem; padding: 0.75rem 1.5rem; background: transparent; color: #64748b; border: 2px solid #e2e8f0; border-radius: 0.5rem; font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: all 0.2s;"
                        onmouseover="this.style.background='#f1f5f9';"
                        onmouseout="this.style.background='transparent';">
                    Cancelar
                </button>
            </div>
        `;

        showModal(modalContent, {
            title: '',
            width: '500px',
            showCloseButton: false
        });

        document.getElementById('returnStockBtn').addEventListener('click', async () => {
            closeModal();
            try {
                const qtyToReturn = Math.abs(movement.quantity);
                await StockService.createAdjustment(movement.productId, qtyToReturn, 'Devolución por eliminación de consumo interno');
                await StockMovement.delete(id);
                showNotification('Registro eliminado y stock devuelto', 'success');
                await this.refreshData();
                if (window.app) app.navigate('inventory');
            } catch (error) {
                console.error('Error al eliminar consumo:', error);
                showNotification('Ocurrió un error al intentar eliminar el registro', 'error');
            }
        });

        document.getElementById('noReturnStockBtn').addEventListener('click', async () => {
            closeModal();
            try {
                await StockMovement.delete(id);
                showNotification('Registro de consumo eliminado (stock no devuelto)', 'success');
                await this.refreshData();
                if (window.app) app.navigate('inventory');
            } catch (error) {
                console.error('Error al eliminar consumo:', error);
                showNotification('Ocurrió un error al intentar eliminar el registro', 'error');
            }
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            closeModal();
        });
    },

    async loadLossReport() {
        const allMovements = await StockMovement.getByType('loss');
        const container = document.getElementById('lossReportContent');
        if (!container) return;

        const targetDate = new Date(this.selectedLossDate + 'T00:00:00');
        const targetY = targetDate.getFullYear();
        const targetM = targetDate.getMonth() + 1;
        const targetD = targetDate.getDate();

        // Semana actual (Mon-Sun)
        const startOfWeek = new Date(targetDate);
        const day = startOfWeek.getDay() || 7;
        startOfWeek.setHours(0,0,0,0);
        startOfWeek.setDate(startOfWeek.getDate() - (day - 1));
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        endOfWeek.setHours(23,59,59,999);

        const dayMovements = allMovements.filter(m => {
            const d = new Date(m.date);
            return d.getFullYear() === targetY && (d.getMonth() + 1) === targetM && d.getDate() === targetD;
        });

        const weekMovements = allMovements.filter(m => {
            const d = new Date(m.date);
            return d >= startOfWeek && d <= endOfWeek;
        });

        const monthMovements = allMovements.filter(m => {
            const d = new Date(m.date);
            return d.getFullYear() === targetY && (d.getMonth() + 1) === targetM;
        });

        const calcTotal = (movs) => movs.reduce((sum, m) => {
            const p = this.products.find(prod => prod.id === m.productId);
            return sum + (parseFloat(m.cost_value) || (p ? Math.abs(m.quantity) * (parseFloat(p.cost) || 0) : 0));
        }, 0);

        const dayTotalCost = calcTotal(dayMovements);
        const weekTotalCost = calcTotal(weekMovements);
        const monthTotalCost = calcTotal(monthMovements);
        const dayTotalQty = dayMovements.reduce((sum, m) => sum + Math.abs(m.quantity), 0);

        let html = `
            <div style="background: #ffffff; padding: 2rem; border-radius: 1.5rem; margin-bottom: 2rem; border: 1px solid #fee2e2; box-shadow: 0 10px 25px -5px rgba(239, 68, 68, 0.05);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 2px solid #fef2f2;">
                    <div>
                        <h3 style="margin: 0; color: #991b1b; font-size: 1.5rem; font-weight: 800; display: flex; align-items: center; gap: 0.5rem;">
                            <span>🗑️</span> Reporte de Pérdidas y Mermas
                        </h3>
                        <p style="margin: 0.5rem 0 0 0; color: #7f1d1d; font-size: 0.95rem; font-weight: 600;">Valor de mercadería perdida a Precio de Costo (Neto)</p>
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
                        <label style="font-size: 0.75rem; font-weight: 800; color: #991b1b; text-transform: uppercase;">Fecha de Análisis</label>
                        <input type="date" value="${this.selectedLossDate}" 
                               onchange="InventoryView.setLossDate(this.value)"
                               style="background: #fff1f2; border: 2px solid #fecaca; color: #991b1b; padding: 0.75rem 1.25rem; border-radius: 1rem; font-size: 1.1rem; font-weight: 800; outline: none; cursor: pointer;">
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem;">
                    <div style="background: #ffffff; border: 2px solid #fecaca; border-radius: 1.25rem; padding: 1.5rem; display: flex; flex-direction: column; gap: 0.5rem;">
                        <span style="font-size: 0.8rem; font-weight: 800; color: #ef4444; text-transform: uppercase; letter-spacing: 1px;">PÉRDIDA HOY</span>
                        <span style="font-size: 2.2rem; font-weight: 900; color: #b91c1c;">${formatCLP(dayTotalCost)}</span>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; font-size: 0.85rem; color: #991b1b; font-weight: 600;">
                            <span>Cant. afectada:</span>
                            <span style="background: #fee2e2; color: #b91c1c; padding: 0.2rem 0.6rem; border-radius: 0.5rem;">${dayTotalQty} items</span>
                        </div>
                    </div>

                    <div style="background: #ffffff; border: 2px solid #fca5a5; border-radius: 1.25rem; padding: 1.5rem; display: flex; flex-direction: column; gap: 0.5rem;">
                        <span style="font-size: 0.8rem; font-weight: 800; color: #dc2626; text-transform: uppercase; letter-spacing: 1px;">ESTA SEMANA</span>
                        <span style="font-size: 2.2rem; font-weight: 900; color: #991b1b;">${formatCLP(weekTotalCost)}</span>
                        <p style="margin: 0.5rem 0 0 0; font-size: 0.75rem; color: #b91c1c; font-weight: 600;">Del ${startOfWeek.toLocaleDateString()} al ${endOfWeek.toLocaleDateString()}</p>
                    </div>

                    <div style="background: linear-gradient(135deg, #991b1b, #7f1d1d); border-radius: 1.25rem; padding: 1.5rem; display: flex; flex-direction: column; gap: 0.5rem; box-shadow: 0 10px 20px -5px rgba(185, 28, 28, 0.3);">
                        <span style="font-size: 0.8rem; font-weight: 800; color: #fca5a5; text-transform: uppercase; letter-spacing: 1px;">ACUMULADO MES</span>
                        <span style="font-size: 2.2rem; font-weight: 900; color: #ffffff;">${formatCLP(monthTotalCost)}</span>
                        <p style="margin: 0.5rem 0 0 0; font-size: 0.75rem; color: #fecaca; font-weight: 600; text-transform: capitalize;">Mes de ${formatMonthYear(this.selectedLossDate)}</p>
                    </div>
                </div>
            </div>

            <div class="card" style="padding: 0; overflow: hidden; border: 1px solid #fee2e2; border-radius: 1.5rem;">
                <div style="padding: 1.5rem; background: #fff1f2; border-bottom: 1px solid #fecaca; display: flex; justify-content: space-between; align-items: center;">
                    <h4 style="margin: 0; color: #991b1b; font-weight: 800;">Detalle de Mermas del Día</h4>
                    <span style="font-size: 0.85rem; color: #b91c1c; font-weight: 700;">${dayMovements.length} Registros</span>
                </div>
                <div class="table-container" style="margin: 0; max-height: 500px; overflow-y: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead style="position: sticky; top: 0; background: #ffffff; z-index: 10; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                            <tr>
                                <th style="text-align: left; padding: 1rem 1.5rem; font-size: 0.75rem; color: #991b1b; text-transform: uppercase;">Hora</th>
                                <th style="text-align: left; padding: 1rem 1.5rem; font-size: 0.75rem; color: #991b1b; text-transform: uppercase;">Producto</th>
                                <th style="text-align: center; padding: 1rem 1.5rem; font-size: 0.75rem; color: #991b1b; text-transform: uppercase;">Cant.</th>
                                <th style="text-align: right; padding: 1rem 1.5rem; font-size: 0.75rem; color: #991b1b; text-transform: uppercase;">Costo Unit.</th>
                                <th style="text-align: right; padding: 1rem 1.5rem; font-size: 0.75rem; color: #991b1b; text-transform: uppercase;">Pérdida Neta</th>
                                <th style="text-align: left; padding: 1rem 1.5rem; font-size: 0.75rem; color: #991b1b; text-transform: uppercase;">Motivo</th>
                                <th style="text-align: right; padding: 1rem 1.5rem; font-size: 0.75rem; color: #991b1b; text-transform: uppercase;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${dayMovements.length === 0 ? `
                                <tr><td colspan="7" style="padding: 4rem; text-align: center; color: #fca5a5;">No hay pérdidas registradas en esta fecha.</td></tr>
                            ` : dayMovements.map(m => {
                                const p = this.products.find(prod => prod.id === m.productId);
                                const costVal = parseFloat(m.cost_value) || (p ? Math.abs(m.quantity) * (parseFloat(p.cost) || 0) : 0);
                                const unitC = p ? parseFloat(p.cost) : (m.quantity !== 0 ? costVal / Math.abs(m.quantity) : 0);
                                return `
                                    <tr style="border-bottom: 1px solid #fee2e2; transition: background 0.2s;" onmouseover="this.style.background='#fff1f2'" onmouseout="this.style.background='transparent'">
                                        <td style="padding: 1.25rem 1.5rem; font-weight: 700; color: #b91c1c;">${new Date(m.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                        <td style="padding: 1.25rem 1.5rem;">
                                            <div style="font-weight: 800; color: #7f1d1d;">${p ? safeHTML(p.name) : 'Producto no encontrado'}</div>
                                            <div style="font-size: 0.75rem; color: #b91c1c; margin-top: 0.25rem;">${p ? p.barcode : '-'}</div>
                                        </td>
                                        <td style="padding: 1.25rem 1.5rem; text-align: center;">
                                            <span style="background: #ef4444; color: white; padding: 0.4rem 0.8rem; border-radius: 0.5rem; font-weight: 900; font-size: 1.1rem;">${Math.abs(m.quantity)}</span>
                                        </td>
                                        <td style="padding: 1.25rem 1.5rem; text-align: right; color: #991b1b; font-weight: 700;">${formatCLP(unitC)}</td>
                                        <td style="padding: 1.25rem 1.5rem; text-align: right;">
                                            <div style="font-weight: 900; color: #b91c1c; font-size: 1.15rem;">${formatCLP(costVal)}</div>
                                            <div style="font-size: 0.7rem; color: #f87171; text-transform: uppercase; font-weight: 700;">Costo Neto</div>
                                        </td>
                                        <td style="padding: 1.25rem 1.5rem; color: #991b1b; font-style: italic; font-weight: 600; font-size: 0.9rem;">${safeHTML(m.reason || '-')}</td>
                                        <td style="padding: 1.25rem 1.5rem; text-align: right;">
                                            <button class="btn btn-sm btn-outline-danger" onclick="InventoryView.deleteLoss(${m.id})" title="Eliminar registro">🗑️</button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        container.innerHTML = html;
    },

    setLossDate(date) {
        if (!date) return;
        this.selectedLossDate = date;
        this.loadLossReport();
    },

    async deleteLoss(id) {
        const movement = await StockMovement.getById(id);
        if (!movement) {
            showNotification('El registro no fue encontrado', 'error');
            return;
        }

        const p = this.products.find(prod => prod.id === movement.productId);
        const productName = p ? p.name : 'Producto desconocido';
        const qty = Math.abs(movement.quantity);

        const modalContent = `
            <div style="text-align: center; padding: 2rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🗑️</div>
                <h3 style="color: #dc2626; font-size: 1.5rem; font-weight: 800; margin-bottom: 1rem;">¿Eliminar Registro de Pérdida?</h3>
                <p style="color: #64748b; font-size: 1rem; margin-bottom: 1.5rem;">
                    <strong>${productName}</strong> (${qty} unidades)
                </p>
                <p style="color: #64748b; font-size: 0.95rem; margin-bottom: 2rem;">
                    ¿Deseas que el stock de este producto vuelva al inventario?
                </p>
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <button id="returnStockBtn" style="flex: 1; padding: 1rem 2rem; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 0.75rem; font-weight: 800; font-size: 1rem; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);"
                            onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(16, 185, 129, 0.4)';"
                            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(16, 185, 129, 0.3)';">
                        🟢 SÍ - Devolver Stock
                    </button>
                    <button id="noReturnStockBtn" style="flex: 1; padding: 1rem 2rem; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border: none; border-radius: 0.75rem; font-weight: 800; font-size: 1rem; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);"
                            onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(239, 68, 68, 0.4)';"
                            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(239, 68, 68, 0.3)';">
                        🔴 NO - Solo Eliminar
                    </button>
                </div>
                <button id="cancelBtn" style="margin-top: 1.5rem; padding: 0.75rem 1.5rem; background: transparent; color: #64748b; border: 2px solid #e2e8f0; border-radius: 0.5rem; font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: all 0.2s;"
                        onmouseover="this.style.background='#f1f5f9';"
                        onmouseout="this.style.background='transparent';">
                    Cancelar
                </button>
            </div>
        `;

        showModal(modalContent, {
            title: '',
            width: '500px',
            showCloseButton: false
        });

        document.getElementById('returnStockBtn').addEventListener('click', async () => {
            closeModal();
            try {
                const qtyToReturn = Math.abs(movement.quantity);
                await StockService.createAdjustment(movement.productId, qtyToReturn, 'Devolución por eliminación de pérdida');
                await StockMovement.delete(id);
                showNotification('Registro eliminado y stock devuelto', 'success');
                await this.refreshData();
                if (window.app) app.navigate('inventory');
            } catch (error) {
                console.error('Error al eliminar pérdida:', error);
                showNotification('Ocurrió un error al intentar eliminar el registro', 'error');
            }
        });

        document.getElementById('noReturnStockBtn').addEventListener('click', async () => {
            closeModal();
            try {
                await StockMovement.delete(id);
                showNotification('Registro de pérdida eliminado (stock no devuelto)', 'success');
                await this.refreshData();
                if (window.app) app.navigate('inventory');
            } catch (error) {
                console.error('Error al eliminar pérdida:', error);
                showNotification('Ocurrió un error al intentar eliminar el registro', 'error');
            }
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            closeModal();
        });
    },

    getMovementTypeName(type) {
        const names = {
            sale: 'Venta',
            purchase: 'Compra',
            adjustment: 'Ajuste',
            loss: 'Pérdida',
            consumption: 'Consumo'
        };
        return names[type] || type;
    },

    getMovementBadgeClass(type) {
        const classes = {
            sale: 'badge-info',
            purchase: 'badge-success',
            adjustment: 'badge-warning',
            loss: 'badge-danger',
            consumption: 'badge-warning'
        };
        return classes[type] || 'badge-info';
    },

    async showAdjustmentForm() {
        const products = await Product.getAll();

        const content = `
            <form id="adjustmentForm" onsubmit="InventoryView.saveAdjustment(event)">
                <div class="form-group">
                    <label>Producto *</label>
                    <select name="productId" class="form-control" required>
                        <option value="">Seleccionar...</option>
                        ${products.map(p => `
                            <option value="${p.id}">${safeHTML(p.name)} (Stock: ${p.stock})</option>
                        `).join('')}
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Tipo de Ajuste *</label>
                    <select name="type" class="form-control" required>
                        <option value="adjustment">Ajuste de Inventario</option>
                        <option value="loss">Pérdida / Merma</option>
                        <option value="consumption">Consumo Interno</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Cantidad *</label>
                    <input type="number" 
                           name="quantity" 
                           class="form-control" 
                           step="any" 
                           required>
                    <small style="color: var(--text); opacity: 0.7;">
                        Para ajustes: usa valores positivos para aumentar, negativos para disminuir<br>
                        Para pérdidas/consumo: usa valores positivos (se restarán automáticamente)
                    </small>
                </div>
                
                <div class="form-group">
                    <label>Motivo *</label>
                    <textarea name="reason" class="form-control" rows="3" required></textarea>
                </div>
            </form>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="document.getElementById('adjustmentForm').requestSubmit()">
                Guardar Ajuste
            </button>
        `;

        showModal(content, { title: 'Ajuste de Stock', footer, width: '500px' });
    },

    async saveAdjustment(event) {
        event.preventDefault();

        const formData = new FormData(event.target);
        const productId = parseInt(formData.get('productId'));
        const type = formData.get('type');
        const quantity = parseFloat(formData.get('quantity'));
        const reason = formData.get('reason');

        try {
            if (type === 'adjustment') {
                await StockMovement.createAdjustment(productId, quantity, reason);
            } else if (type === 'loss') {
                await StockMovement.createLoss(productId, Math.abs(quantity), reason);
            } else if (type === 'consumption') {
                await StockMovement.createConsumption(productId, Math.abs(quantity), reason);
            }

            showNotification('Ajuste de stock registrado', 'success');
            closeModal();
            await this.refreshData();
            app.navigate('inventory');
        } catch (error) {
            showNotification(error.message, 'error');
        }
    },

    async quickAdjustment(productId) {
        const product = await Product.getById(productId);
        const isWeight = product.type === 'weight';
        const stepVal = isWeight ? '0.001' : '1';
        const placeholderVal = isWeight ? 'Ej: 10.500' : 'Ej: 10';

        const content = `
            <div style="margin-bottom: 1.5rem;">
                <p><strong>Producto:</strong> ${safeHTML(product.name)}</p>
                <p><strong>Stock Actual:</strong> ${product.stock} ${isWeight ? 'kg' : 'un'}</p>
            </div>
            
            <form id="quickAdjustForm">
                <div class="form-group">
                    <label>Nueva Cantidad *</label>
                    <input type="number" 
                           id="newStock" 
                           class="form-control" 
                           value="${product.stock}" 
                           min="0" 
                           step="${stepVal}" 
                           placeholder="${placeholderVal}"
                           required>
                </div>
                
                <div class="form-group">
                    <label>Motivo *</label>
                    <textarea id="quickReason" class="form-control" rows="2" required></textarea>
                </div>
            </form>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="InventoryView.saveQuickAdjustment(${productId}, ${product.stock})">
                Ajustar
            </button>
        `;

        showModal(content, { title: 'Ajuste Rápido', footer, width: '400px' });
    },

    async saveQuickAdjustment(productId, currentStock) {
        const newStock = parseFloat(document.getElementById('newStock').value);
        const reason = document.getElementById('quickReason').value;

        if (!reason) {
            showNotification('Debes ingresar un motivo', 'warning');
            return;
        }

        try {
            await StockService.setStock(productId, newStock, reason, 'adjustment');
            showNotification('Stock ajustado correctamente', 'success');
            closeModal();
            app.navigate('inventory');
        } catch (error) {
            showNotification(error.message, 'error');
        }
    },

    async showSetStockManuallyForm() {
        const products = await Product.getAll();
        const content = `
            <p style="margin-bottom: 1rem; color: var(--secondary);">Fija el stock de un producto al valor que indiques. Se registrará como ajuste (queda en el historial). Útil para cuadrar con inventario físico.</p>
            <form id="setStockManuallyForm">
                <div class="form-group">
                    <label>Producto *</label>
                    <select id="setStockProductId" class="form-control" required>
                        <option value="">Seleccionar producto...</option>
                        ${products.map(p => `
                            <option value="${p.id}" data-stock="${p.stock}" data-type="${p.type || 'unit'}">${p.name} — Stock actual: ${p.stock} ${p.type === 'weight' ? 'kg' : 'un'}</option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Stock actual (solo lectura)</label>
                    <input type="text" id="setStockCurrent" class="form-control" readonly style="background: var(--light);">
                </div>
                <div class="form-group">
                    <label>Nuevo stock (cantidad a la que quieres fijar) *</label>
                    <input type="number" id="setStockNew" class="form-control" min="0" step="any" required placeholder="Ej: 10">
                    <small id="setStockUnit">un</small>
                </div>
                <div class="form-group">
                    <label>Motivo * (ej: Conteo físico, corrección por desfase)</label>
                    <textarea id="setStockReason" class="form-control" rows="2" required placeholder="Obligatorio para auditoría"></textarea>
                </div>
            </form>
        `;
        const footer = `
            <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="InventoryView.saveSetStockManually()">Aplicar y registrar ajuste</button>
        `;
        showModal(content, { title: 'Fijar stock manualmente', footer, width: '480px' });
        const sel = document.getElementById('setStockProductId');
        const currentInp = document.getElementById('setStockCurrent');
        const unitSpan = document.getElementById('setStockUnit');
        function updateCurrent() {
            const opt = sel.options[sel.selectedIndex];
            if (opt && opt.value) {
                const isWeight = opt.getAttribute('data-type') === 'weight';
                currentInp.value = opt.getAttribute('data-stock') + ' ' + (isWeight ? 'kg' : 'un');
                unitSpan.textContent = isWeight ? 'kg' : 'un';
                const setStockNewInp = document.getElementById('setStockNew');
                if (setStockNewInp) {
                    setStockNewInp.step = isWeight ? '0.001' : '1';
                    setStockNewInp.placeholder = isWeight ? 'Ej: 10.500' : 'Ej: 10';
                }
            } else {
                currentInp.value = '';
                unitSpan.textContent = 'un';
            }
        }
        sel.addEventListener('change', updateCurrent);
        updateCurrent();
    },

    async saveSetStockManually() {
        const productId = document.getElementById('setStockProductId').value;
        const newStock = parseFloat(document.getElementById('setStockNew').value); // Changed from 'setStockAmount' to 'setStockNew'
        const reason = document.getElementById('setStockReason').value;

        if (!productId) {
            showNotification('Seleccione un producto', 'warning');
            return;
        }
        if (isNaN(newStock) || newStock < 0) {
            showNotification('Ingrese una cantidad válida y mayor o igual a 0', 'warning');
            return;
        }
        if (!reason) {
            showNotification('El motivo es obligatorio', 'warning');
            return;
        }
        StockService.setStock(parseInt(productId), newStock, reason)
            .then(() => {
                showNotification('Stock establecido correctamente', 'success');
                closeModal();
                app.navigate('inventory'); // Changed from InventoryView.switchSection('inventory') to app.navigate('inventory')
            })
            .catch(err => {
                showNotification(err.message || 'Error al establecer el stock', 'error');
            });
    },

    renderAuditSection() {
        if (!this.auditState) {
            const categories = this.categories || [];
            const historyHtml = this.auditHistory.length > 0
                ? this.auditHistory.map((log, idx) => {
                    const loss = log.metadata.lossMoney || 0;
                    const extra = log.metadata.extraMoney || 0;
                    const hasLoss = loss > 0;
                    const hasExtra = extra > 0;
                    const cardStyle = hasLoss && hasExtra 
                        ? 'background: linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(245, 158, 11, 0.12)); border: 1px solid rgba(239, 68, 68, 0.3);'
                        : (hasLoss 
                            ? 'background: linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(239, 68, 68, 0.06)); border: 1px solid rgba(239, 68, 68, 0.3);'
                            : 'background: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0.06)); border: 1px solid rgba(16, 185, 129, 0.3);');
                    return `
                    <div onclick="InventoryView.openAuditHistoryDetail(${idx})"
                         style="background: ${cardStyle}; border-radius: 1.25rem; padding: 1.5rem; margin-bottom: 1rem; cursor: pointer; transition: all 0.3s ease; position: relative; overflow: hidden;"
                         onmouseover="this.style.transform='translateY(-3px) scale(1.02); this.style.boxShadow='0 12px 35px rgba(0,0,0,0.4)';"
                         onmouseout="this.style.transform='translateY(0) scale(1); this.style.boxShadow='none';">
                        <div style="display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 1;">
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
                                    <span style="font-size: 1.5rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));">📋</span>
                                    <span style="color: #f1f5f9; font-weight: 800; font-size: 1.1rem; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">${log.metadata.categoryName || 'Desconocida'}</span>
                                </div>
                                <div style="color: #94a3b8; font-size: 0.85rem; margin-left: 2.25rem; font-weight: 500;">${formatDateTime(log.timestamp)}</div>
                            </div>
                            <div style="text-align: right; min-width: 120px;">
                                ${hasLoss ? `<div style="color: #f87171; font-weight: 900; font-size: 1.1rem; text-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);">-${formatCLP(loss)}</div>` : ''}
                                ${hasExtra ? `<div style="color: #34d399; font-weight: 900; font-size: 1.1rem; text-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);">+${formatCLP(extra)}</div>` : ''}
                                ${!hasLoss && !hasExtra ? '<div style="color: #34d399; font-weight: 900; font-size: 1.1rem; text-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);">✅ Perfecto</div>' : ''}
                            </div>
                        </div>
                        <div style="position: absolute; top: -20px; right: -20px; width: 100px; height: 100px; background: ${hasLoss ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)'}; border-radius: 50%; transform: translate(30%, -30%); z-index: 0; filter: blur(20px);"></div>
                        <div style="position: absolute; bottom: -10px; left: -10px; width: 80px; height: 80px; background: ${hasLoss ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)'}; border-radius: 50%; z-index: 0; filter: blur(15px);"></div>
                    </div>
                `}).join('')
                : `<div style="padding: 4rem; text-align: center; color: #64748b; font-style: italic; font-size: 1rem;">Aún no hay registros de auditorías finalizadas.</div>`;

            return `
                <div class="card" style="background: #1e293b; border: 1px solid rgba(255,255,255,0.05); border-radius: 1.5rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
                    <div style="text-align: center; max-width: 1000px; margin: 0 auto; padding: 3rem 1.5rem;">
                        <div style="display: flex; flex-direction: column; align-items: center; margin-bottom: 3rem;">
                            <div style="font-size: 3.5rem; margin-bottom: 1rem; filter: drop-shadow(0 0 15px rgba(110, 231, 183, 0.3));">📋</div>
                            <h2 style="font-size: 2.5rem; font-weight: 800; background: linear-gradient(135deg, #f8fafc 0%, #94a3b8 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0;">Control de Inventario</h2>
                            <p style="color: #94a3b8; font-size: 1.1rem; margin-top: 0.5rem;">Cuenta físicamente tu stock y sincroniza el sistema en minutos.</p>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1.2fr; gap: 3rem; text-align: left;">
                            <!-- Columna Izquierda: Instrucciones y Selector -->
                            <div>
                                <div style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(37, 99, 235, 0.06)); border: 1px solid rgba(59, 130, 246, 0.28); border-radius: 1.25rem; padding: 1.75rem; margin-bottom: 1.25rem; position: relative; overflow: hidden;">
                                    <div style="position: absolute; top: -10px; right: -10px; font-size: 4rem; opacity: 0.05;">💡</div>
                                    <h3 style="color: #60a5fa; margin-top: 0; display: flex; align-items: center; gap: 0.75rem; font-size: 1.1rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
                                        Guía rápida (3 pasos)
                                    </h3>
                                    <ul style="color: #cbd5e1; line-height: 1.6; margin: 1rem 0 0 0; padding-left: 1.25rem; font-size: 0.95rem;">
                                        <li style="margin-bottom: 0.75rem;">Selecciona una categoría (ej: <strong>Bebidas</strong>, <strong>Aseo</strong>, etc.).</li>
                                        <li style="margin-bottom: 0.75rem;">Cuenta físicamente todos los productos y registra el número real.</li>
                                        <li>Confirma: el sistema ajustará automáticamente diferencias (faltantes o sobrantes).</li>
                                    </ul>
                                </div>

                                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; margin-bottom: 1.5rem;">
                                    <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.24); border-radius: 0.9rem; padding: 0.75rem;">
                                        <div style="font-size: 0.75rem; color: #6ee7b7; font-weight: 900;">✅ CUADRADO</div>
                                        <div style="font-size: 0.8rem; color: #cbd5e1; margin-top: 0.25rem;">Conteo igual al sistema</div>
                                    </div>
                                    <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.24); border-radius: 0.9rem; padding: 0.75rem;">
                                        <div style="font-size: 0.75rem; color: #fca5a5; font-weight: 900;">🚨 FALTANTE</div>
                                        <div style="font-size: 0.8rem; color: #cbd5e1; margin-top: 0.25rem;">Hay menos físico que sistema</div>
                                    </div>
                                    <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.24); border-radius: 0.9rem; padding: 0.75rem;">
                                        <div style="font-size: 0.75rem; color: #fcd34d; font-weight: 900;">📦 SOBRANTE</div>
                                        <div style="font-size: 0.8rem; color: #cbd5e1; margin-top: 0.25rem;">Hay más físico que sistema</div>
                                    </div>
                                </div>

                                <div style="background: rgba(15, 23, 42, 0.6); padding: 2rem; border-radius: 1.25rem; border: 1px solid rgba(255,255,255,0.05); box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);">
                                    <label style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 1rem; display: block; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">Categoría a controlar</label>
                                    <select id="auditCategorySelect" class="form-control" style="font-size: 1.1rem; padding: 1.1rem; background: #0f172a; border: 2px solid rgba(99, 102, 241, 0.2); border-radius: 1rem; margin-bottom: 1.5rem; color: white; width: 100%; outline: none; transition: border-color 0.2s;">
                                        <option value="">-- Seleccionar Categoría --</option>
                                        ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
                                    </select>
                                    <div style="display:flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem;">
                                        <span style="background: rgba(99,102,241,0.12); color:#c7d2fe; border:1px solid rgba(99,102,241,0.35); padding: 0.3rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: 800;">⚡ Escáner compatible</span>
                                        <span style="background: rgba(16,185,129,0.12); color:#86efac; border:1px solid rgba(16,185,129,0.35); padding: 0.3rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: 800;">🧮 Conteo manual permitido</span>
                                        <span style="background: rgba(245,158,11,0.12); color:#fcd34d; border:1px solid rgba(245,158,11,0.35); padding: 0.3rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: 800;">🔒 Validación completa</span>
                                    </div>
                                    <button class="btn" style="width: 100%; font-size: 1.2rem; padding: 1.35rem; background: linear-gradient(135deg, #6366f1, #4f46e5); color: white; font-weight: 900; border: none; border-radius: 1rem; cursor: pointer; transition: all 0.2s; box-shadow: 0 10px 25px rgba(99, 102, 241, 0.2);" 
                                            onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 15px 30px rgba(99, 102, 241, 0.3)';"
                                            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 10px 25px rgba(99, 102, 241, 0.2)';"
                                            onclick="InventoryView.startAudit()">
                                        🚀 Iniciar Control Ahora
                                    </button>
                                </div>
                            </div>

                            <!-- Columna Derecha: Historial -->
                            <div style="background: rgba(15, 23, 42, 0.42); border-radius: 1.25rem; border: 1px solid rgba(255,255,255,0.08); padding: 2rem; display: flex; flex-direction: column; height: 100%;">
                                <h3 style="color: #94a3b8; margin-top: 0; margin-bottom: 1.5rem; font-size: 1rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 0.5rem;">
                                    <span>🕒 Controles Recientes</span>
                                </h3>
                                <div style="color: rgba(148, 163, 184, 0.9); font-size: 0.85rem; margin-bottom: 1rem;">
                                    Haz click en cualquier control para ver <strong>detalle de faltantes y sobrantes por producto</strong>.
                                </div>
                                <div style="flex: 1; overflow-y: auto; padding-right: 0.5rem; min-height: 500px;">
                                    ${historyHtml}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }


        if (this.auditState.status === 'counting') {
            const uncounted = this.auditState.items.filter(i => !i.counted).length;
            const matchedCount = this.auditState.items.filter(i => i.counted).length;
            const totalItems = this.auditState.items.length;
            const progress = totalItems > 0 ? (matchedCount / totalItems) * 100 : 0;

            return `
                <div class="card" style="background: #1e293b; border: 1px solid rgba(255,255,255,0.05); border-radius: 1.5rem; padding: 2rem;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2.5rem; gap: 2rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 1.5rem;">
                        <div style="flex: 1;">
                            <h2 style="color: #6ee7b7; margin: 0; font-size: 1.8rem; font-weight: 800; display: flex; align-items: center; gap: 0.75rem;">
                                <span style="font-size: 2.2rem;">📦</span> Control en Vivo: ${this.auditState.categoryName}
                            </h2>
                            <div style="display: flex; align-items: center; gap: 1rem; margin-top: 0.75rem;">
                                <div style="flex: 1; max-width: 300px; height: 10px; background: rgba(0,0,0,0.3); border-radius: 10px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05);">
                                    <div style="width: ${progress}%; height: 100%; background: linear-gradient(90deg, #6ee7b7, #34d399); border-radius: 10px; transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);"></div>
                                </div>
                                <span id="audit-progress-text" style="color: ${uncounted > 0 ? '#fbbf24' : '#34d399'}; font-size: 0.95rem; font-weight: 700;">
                                    ${uncounted > 0 ? `⚠️ Faltan ${uncounted} items` : '✅ ¡Todo contado!'} (${progress.toFixed(0)}%)
                                </span>
                            </div>
                        </div>
                        <div style="text-align: right;">
                             <button class="btn" style="background: rgba(239, 68, 68, 0.1); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.2); padding: 0.75rem 1.5rem; border-radius: 0.75rem; font-weight: 600;" onclick="InventoryView.cancelAudit()">Abandonar</button>
                        </div>
                    </div>

                    <div style="background: rgba(15, 23, 42, 0.4); border-radius: 1.25rem; border: 1px solid rgba(255,255,255,0.05); overflow: hidden; max-height: 55vh; overflow-y: auto; box-shadow: inset 0 2px 10px rgba(0,0,0,0.3);">
                        <table class="table" style="margin: 0; width: 100%; border-collapse: separate; border-spacing: 0;">
                            <thead style="position: sticky; top: 0; background: #1e293b; z-index: 10; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3);">
                                <tr>
                                    <th style="padding: 1.25rem; color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; font-weight: 800;">Producto</th>
                                    <th style="padding: 1.25rem; text-align: center; color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; font-weight: 800;">Sistema</th>
                                    <th style="padding: 1.25rem; text-align: center; color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; font-weight: 800;">Conteo Físico</th>
                                    <th style="padding: 1.25rem; text-align: center; color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; font-weight: 800;">Estado / Diferencia</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.auditState.items.map((item, index) => {
                const diff = (item.physicalCount || 0) - item.systemStock;
                const diffColor = diff === 0 ? '#10b981' : (diff < 0 ? '#ef4444' : '#f59e0b');
                const diffSign = diff > 0 ? '+' : '';
                return `
                                        <tr id="audit-row-${item.id}" style="background: ${item.counted ? 'rgba(16, 185, 129, 0.03)' : 'rgba(239, 68, 68, 0.02)'}; border-bottom: 1px solid rgba(255,255,255,0.03);">
                                            <td style="padding: 1.25rem;">
                                                <div style="color: #f1f5f9; font-weight: 700; font-size: 1.05rem;">${item.name}</div>
                                                <div style="color: #64748b; font-size: 0.8rem; font-family: monospace; margin-top: 0.25rem;">${item.barcode || 'SIN CÓDIGO'}</div>
                                            </td>
                                            <td style="font-size: 1.25rem; color: #94a3b8; text-align: center; font-weight: 500;">${item.systemStock}</td>
                                            <td style="text-align: center;">
                                                <input type="number" step="any" class="form-control audit-qty-input" 
                                                       data-index="${index}"
                                                       style="width: 120px; text-align: center; background: #0f172a; border-radius: 0.75rem; border: 2px solid ${item.counted ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.2)'}; color: white; font-size: 1.35rem; font-weight: 800; padding: 0.5rem;" 
                                                       value="${item.counted ? item.physicalCount : ''}" 
                                                       placeholder="?"
                                                       min="0"
                                                       oninput="InventoryView.updateAuditPhysicalCount(${item.id}, this.value)" 
                                                       onkeydown="if(event.key === 'Enter') { event.preventDefault(); InventoryView.focusNextAuditInput(${index}); }"
                                                       onclick="this.select()"
                                                       title="Ingresa la cantidad física actual"
                                                       ${index === 0 ? 'autofocus' : ''}>
                                            </td>
                                            <td id="audit-status-${item.id}" style="text-align: center;">
                                                ${item.counted
                        ? (diff === 0
                            ? `<span style="background: rgba(16, 185, 129, 0.1); color: #10b981; padding: 0.4rem 0.8rem; border-radius: 0.5rem; font-weight: 800; font-size: 0.85rem; border: 1px solid rgba(16, 185, 129, 0.2);">PERFECTO</span>`
                            : `<span style="background: ${diff < 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)'}; color: ${diffColor}; padding: 0.4rem 0.8rem; border-radius: 0.5rem; font-weight: 800; font-size: 0.85rem; border: 1px solid ${diff < 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'}">${diffSign}${diff} UNID.</span>`)
                        : '<span style="color:rgba(239, 68, 68, 0.5); font-weight: 800; font-size: 0.75rem; letter-spacing: 1px;">⚙️ PENDIENTE</span>'}
                                            </td>
                                        </tr>
                                    `;
            }).join('')}
                            </tbody>
                        </table>
                    </div>
                    
                    <div style="margin-top: 2rem; display: flex; justify-content: space-between; align-items: center; background: rgba(15, 23, 42, 0.4); padding: 1.5rem; border-radius: 1.25rem; border: 1px solid rgba(255,255,255,0.05);">
                        <div style="color: #64748b; font-size: 0.95rem; display: flex; align-items: center; gap: 0.5rem;">
                            <span style="font-size: 1.2rem;">⌨️</span> <span>Tip: escribe una cantidad y presiona <strong>Enter</strong> para pasar al siguiente producto.</span>
                        </div>
                        <button class="btn" 
                                style="background: ${uncounted > 0 ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #10b981, #059669)'}; color: ${uncounted > 0 ? '#475569' : 'white'}; border: none; font-size: 1.2rem; padding: 1.25rem 3rem; border-radius: 1rem; font-weight: 800; cursor: ${uncounted > 0 ? 'not-allowed' : 'pointer'}; transition: transform 0.2s, box-shadow 0.2s;" 
                                onclick="${uncounted > 0 ? "showNotification('Debes completar el conteo de todos los productos (rojos)', 'warning')" : 'InventoryView.finishAudit()'}">
                            📊 Finalizar y Ver Reporte
                        </button>
                    </div>
                </div>
            `;
        }


        if (this.auditState.status === 'report') {
            const missing = this.auditState.items.filter(i => i.physicalCount < i.systemStock);
            const extra = this.auditState.items.filter(i => i.physicalCount > i.systemStock);
            // CORRECCIÓN: Para productos sobrantes, si el stock estaba negativo, contabilizar desde 0
            const lossMoney = missing.reduce((sum, i) => sum + ((i.systemStock - i.physicalCount) * parseFloat(i.cost || 0)), 0);
            const extraMoney = extra.reduce((sum, i) => {
                const systemStock = i.systemStock < 0 ? 0 : i.systemStock;
                return sum + ((i.physicalCount - systemStock) * parseFloat(i.cost || 0));
            }, 0);

            let missingHtml = missing.length > 0 ? missing.map(i => {
                const diff = (i.systemStock - i.physicalCount);
                const displayDiff = Number.isInteger(diff) ? diff : diff.toFixed(2);
                return `
                <div style="display: flex; flex-direction: column; padding: 1rem; border-bottom: 1px solid rgba(239, 68, 68, 0.1);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <div style="color: #f1f5f9; font-weight: 600;">${i.name}</div>
                        <div style="text-align: right;">
                            <div style="color: #f87171; font-weight: 800; font-size: 1rem;">Faltan ${displayDiff}</div>
                            <div style="color: #64748b; font-size: 0.75rem;">(${i.physicalCount} real vs ${i.systemStock} sys)</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.75rem; margin-top: 0.75rem;">
                        <label class="missing-type-label" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.75rem 1rem; border-radius: 0.75rem; cursor: pointer; transition: all 0.2s ease; border: 2px solid rgba(16, 185, 129, 0.6); background: rgba(16, 185, 129, 0.2); color: #34d399; font-weight: 700; font-size: 0.9rem;">
                            <input type="radio" name="missing-type-${i.id}" value="consumption" checked style="display: none;">
                            <span style="font-size: 1.1rem;">🍴</span>
                            <span>Consumo Interno</span>
                        </label>
                        <label class="missing-type-label" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.75rem 1rem; border-radius: 0.75rem; cursor: pointer; transition: all 0.2s ease; border: 2px solid rgba(239, 68, 68, 0.2); background: rgba(239, 68, 68, 0.05); color: #64748b; font-weight: 700; font-size: 0.9rem;">
                            <input type="radio" name="missing-type-${i.id}" value="loss" style="display: none;">
                            <span style="font-size: 1.1rem;">🗑️</span>
                            <span>Pérdida</span>
                        </label>
                    </div>
                </div>
            `}).join('') : '<div style="padding: 3rem; text-align: center; color: #64748b; font-style: italic;">✨ No hay productos faltantes. Todo está en orden.</div>';

            let extraHtml = extra.length > 0 ? extra.map(i => {
                const diff = (i.physicalCount - i.systemStock);
                const displayDiff = Number.isInteger(diff) ? diff : diff.toFixed(2);
                // CORRECCIÓN: Si el stock estaba negativo, contabilizar desde 0
                const systemStock = i.systemStock < 0 ? 0 : i.systemStock;
                const adjustedDiff = i.physicalCount - systemStock;
                const displayAdjustedDiff = Number.isInteger(adjustedDiff) ? adjustedDiff : adjustedDiff.toFixed(2);
                const note = i.systemStock < 0 ? '<div style="color: #f59e0b; font-size: 0.7rem; margin-top: 0.25rem;">⚠️ Stock estaba negativo, contabiliza desde 0</div>' : '';
                return `
                <div style="display: flex; justify-content: space-between; padding: 1rem; border-bottom: 1px solid rgba(16, 185, 129, 0.1); align-items: center;">
                    <div style="color: #f1f5f9; font-weight: 600;">${i.name}</div>
                    <div style="text-align: right;">
                        <div style="color: #34d399; font-weight: 800; font-size: 1rem;">Sobran ${displayAdjustedDiff}</div>
                        <div style="color: #64748b; font-size: 0.75rem;">(${i.physicalCount} real vs ${systemStock} sys)</div>
                        ${note}
                    </div>
                </div>
            `}).join('') : '<div style="padding: 3rem; text-align: center; color: #64748b; font-style: italic;">No se detectaron productos sobrantes.</div>';

            return `
                <div class="card" style="background: #1e293b; border: 1px solid rgba(255,255,255,0.05); border-radius: 1.5rem; padding: 3rem;">
                    <div style="text-align: center; margin-bottom: 3.5rem;">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">📊</div>
                        <h2 style="font-size: 2.2rem; font-weight: 800; color: white; margin: 0;">Resumen del Control de Inventario</h2>
                        <p style="color: #94a3b8; font-size: 1.15rem; margin-top: 0.5rem;">Análisis de discrepancias para <strong>${this.auditState.categoryName}</strong></p>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; margin-bottom: 3.5rem;">
                        <!-- Faltantes (Merma) -->
                        <div style="background: rgba(239, 68, 68, 0.03); border: 1px solid rgba(239, 68, 68, 0.15); border-radius: 1.5rem; padding: 2rem; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid rgba(239, 68, 68, 0.2); padding-bottom: 1.25rem; margin-bottom: 1.5rem;">
                                <h3 style="color: #fca5a5; margin: 0; font-size: 1.2rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">🚨 Merma / Faltantes</h3>
                                ${lossMoney > 0 ? `<div style="background: #ef4444; color: white; padding: 0.4rem 1rem; border-radius: 2rem; font-size: 0.9rem; font-weight: 800;">-${formatCLP(lossMoney)}</div>` : ''}
                            </div>
                            <div style="max-height: 40vh; overflow-y: auto; padding-right: 0.5rem;">
                                ${missingHtml}
                            </div>
                        </div>

                        <!-- Sobrantes -->
                        <div style="background: rgba(16, 185, 129, 0.03); border: 1px solid rgba(16, 185, 129, 0.15); border-radius: 1.5rem; padding: 2rem; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid rgba(16, 185, 129, 0.2); padding-bottom: 1.25rem; margin-bottom: 1.5rem;">
                                <h3 style="color: #6ee7b7; margin: 0; font-size: 1.2rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">✅ Excedentes / Sobrantes</h3>
                                ${extraMoney > 0 ? `<div style="background: #10b981; color: white; padding: 0.4rem 1rem; border-radius: 2rem; font-size: 0.9rem; font-weight: 800;">+${formatCLP(extraMoney)}</div>` : ''}
                            </div>
                            <div style="max-height: 40vh; overflow-y: auto; padding-right: 0.5rem;">
                                ${extraHtml}
                            </div>
                        </div>
                    </div>

                    <div class="audit-report-actions">
                        <button class="btn btn-audit-back" onclick="InventoryView.backToCounting()">◀ Volver al Conteo</button>
                        <button class="btn btn-audit-cancel" onclick="InventoryView.cancelAudit()">Descartar Control</button>
                        <button class="btn btn-audit-confirm" onclick="InventoryView.applyAuditAdjustments()">
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
        const categoryName = select.value;
        if (!categoryName) {
            showNotification('Selecciona la categoría a la que pertenece la estantería que contarás', 'warning');
            return;
        }

        const productsInCategory = this.allProducts.filter(p => (p.category || 'General') === categoryName);

        this.auditState = {
            categoryName,
            status: 'counting',
            items: productsInCategory.map(p => ({
                id: p.id,
                name: p.name,
                barcode: p.barcode,
                cost: p.cost,
                systemStock: parseFloat(p.stock) || 0,
                physicalCount: 0,
                counted: false
            }))
        };
        app.navigate('inventory');
    },

    processAuditBarcode(barcode) {
        if (!barcode || !barcode.trim()) return;
        barcode = barcode.trim();
        const item = this.auditState.items.find(i => i.barcode === barcode);
        const input = document.getElementById('auditBarcode');
        if (input) {
            input.value = '';
            input.focus();
        }

        if (item) {
            item.physicalCount += 1;
            item.counted = true;
            app.navigate('inventory');
            showNotification(`+1 Sumado a producto: ${item.name}`, 'success');
        } else {
            showNotification(`Producto desconocido en esta categoría en la BBDD (Código: ${barcode})`, 'error');
        }
    },

    updateAuditPhysicalCount(productId, strValue) {
        const val = parseFloat(strValue);
        const item = this.auditState.items.find(i => i.id === productId);
        if (item && !isNaN(val) && val >= 0) {
            item.physicalCount = val;
            item.counted = true;

            const row = document.getElementById(`audit-row-${productId}`);
            const statusCell = document.getElementById(`audit-status-${productId}`);
            const inputField = document.querySelector(`#audit-row-${productId} input.audit-qty-input`);

            if (row && statusCell) {
                row.style.background = 'rgba(16, 185, 129, 0.05)';
                if (inputField) inputField.style.borderColor = 'rgba(16, 185, 129, 0.4)';

                const diff = item.physicalCount - item.systemStock;
                const diffColor = diff === 0 ? '#34d399' : (diff < 0 ? '#ef4444' : '#fbbf24');
                const diffSign = diff > 0 ? '+' : '';

                statusCell.innerHTML = diff === 0
                    ? `<span style="color: #34d399; font-weight: bold;">✔ OK</span>`
                    : `<span style="color: ${diffColor}; font-weight: bold;">${diffSign}${diff} dif.</span>`;
            }

            const progressHeader = document.getElementById('audit-progress-text');
            if (progressHeader) {
                const totalItems = this.auditState.items.length;
                const matchedCount = this.auditState.items.filter(i => i.counted).length;
                const progress = totalItems > 0 ? (matchedCount / totalItems) * 100 : 0;

                progressHeader.style.color = matchedCount === totalItems ? '#34d399' : '#fbbf24';
                progressHeader.innerHTML = matchedCount === totalItems
                    ? `✅ ¡Todos los productos han sido contados! (${progress.toFixed(0)}% completado)`
                    : `⚠️ Faltan ${totalItems - matchedCount} productos por contar (${progress.toFixed(0)}% completado)`;
            }

            // CORRECCIÓN: No re-renderizar automáticamente cuando todos están contados para evitar perder el foco del input
            // En su lugar, actualizar manualmente el botón de finalizar si existe
            const uncounted = this.auditState.items.filter(i => !i.counted).length;
            if (uncounted === 0) {
                // Buscar el botón por su texto contenido
                const buttons = document.querySelectorAll('button');
                const finishBtn = Array.from(buttons).find(btn => btn.textContent.includes('Finalizar y Ver Reporte'));
                if (finishBtn) {
                    finishBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                    finishBtn.style.color = 'white';
                    finishBtn.style.cursor = 'pointer';
                    // CORRECCIÓN: También actualizar el onclick para permitir finalizar
                    finishBtn.setAttribute('onclick', 'InventoryView.finishAudit()');
                }
            }
        }
    },

    focusNextAuditInput(currentIndex) {
        const nextInput = document.querySelector(`.audit-qty-input[data-index="${currentIndex + 1}"]`);
        if (nextInput) {
            nextInput.focus();
            nextInput.select();
        } else {
            // Si es el último, intentar enfocar el botón de finalizar
            const finishBtn = document.querySelector('button[onclick*="finishAudit"]');
            if (finishBtn) finishBtn.focus();
        }
    },

    finishAudit() {
        if (!this.auditState) return;

        // Validación estricta: No permite avanzar si hay productos sin tocar
        const uncountedItems = this.auditState.items.filter(i => !i.counted);
        if (uncountedItems.length > 0) {
            showNotification(`¡Atención! Aún faltan ${uncountedItems.length} productos por contar. Debes ingresar un valor (aunque sea "0") para todos los productos en rojo.`, 'error');
            return;
        }

        this.auditState.status = 'report';
        app.navigate('inventory');
    },

    backToCounting() {
        if (!this.auditState) return;
        this.auditState.status = 'counting';
        app.navigate('inventory');
    },

    cancelAudit() {
        const modal = showModal(`
            <div style="padding: 1rem; text-align: center;">
                <p style="font-size: 1.1rem; margin-bottom: 2rem;">¿Estás seguro que deseas abandonar este control de inventario? Perderás todo tu progreso de conteo.</p>
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <button class="btn btn-secondary" onclick="closeModal()">No, volver</button>
                    <button class="btn" style="background: #ef4444; color: white; border: none; padding: 0.5rem 2rem; border-radius: 0.5rem;" onclick="InventoryView.performCancelAudit(); closeModal();">Sí, Abandonar</button>
                </div>
            </div>
        `, { title: 'Cancelar Control de Inventario', width: '500px' });
    },

    performCancelAudit() {
        this.auditState = null;
        app.navigate('inventory');
    },

    async applyAuditAdjustments() {
        try {
            // Solo se editan aquellos que tienen una diferencia con el sistema
            // Al llegar aquí, ya validamos en finishAudit que item.counted es true para todos
            const differences = this.auditState.items.filter(i => i.counted && i.physicalCount !== i.systemStock);

            if (differences.length === 0) {
                showNotification('¡Felicidades! Todo tu stock físico cuadró perfectamente con el sistema.', 'success');
                this.auditState = null;
                app.navigate('inventory');
                return;
            }

            const reason = `Ajuste Automático por Auditoría de Cat: ${this.auditState.categoryName}`;
            let adjustmentsMade = 0;

            for (const item of differences) {
                // CORRECCIÓN ATÓMICA: Fijar stock absoluto para evitar doble descuadre por ventas simultáneas
                if (item.physicalCount < item.systemStock) {
                    const radioName = `missing-type-${item.id}`;
                    const selectedType = document.querySelector(`input[name="${radioName}"]:checked`)?.value || 'loss';
                    const detailReason = `${reason} - ${selectedType === 'consumption' ? 'Consumo interno' : 'Pérdida'}`;
                    await StockService.setStock(item.id, item.physicalCount, detailReason, selectedType);
                } else {
                    await StockService.setStock(item.id, item.physicalCount, reason, 'adjustment');
                }
                adjustmentsMade++;
            }

            showNotification(`¡Sincronización Exitosa! Se aplicaron ${adjustmentsMade} correcciones al inventario.`, 'success');

            // Calcular pérdidas y sobrantes monetarios para el log
            const missing = this.auditState.items.filter(i => i.physicalCount < i.systemStock);
            const extra = this.auditState.items.filter(i => i.physicalCount > i.systemStock);
            const lossMoney = missing.reduce((sum, i) => sum + ((i.systemStock - i.physicalCount) * parseFloat(i.cost || 0)), 0);
            // CORRECCIÓN: Para productos sobrantes, si el stock estaba negativo, contabilizar desde 0
            const extraMoney = extra.reduce((sum, i) => {
                const systemStock = i.systemStock < 0 ? 0 : i.systemStock;
                return sum + ((i.physicalCount - systemStock) * parseFloat(i.cost || 0));
            }, 0);

            // Guardar detalle para mostrar en "Controles recientes"
            const missingItems = missing.map(i => ({
                productId: i.id,
                name: i.name,
                barcode: i.barcode || null,
                systemStock: i.systemStock,
                physicalCount: i.physicalCount,
                diff: (i.physicalCount - i.systemStock),
                unitsMissing: (i.systemStock - i.physicalCount),
                cost: parseFloat(i.cost || 0),
                moneyImpact: (i.systemStock - i.physicalCount) * parseFloat(i.cost || 0)
            }));

            const extraItems = extra.map(i => ({
                productId: i.id,
                name: i.name,
                barcode: i.barcode || null,
                systemStock: i.systemStock,
                physicalCount: i.physicalCount,
                diff: (i.physicalCount - i.systemStock),
                unitsExtra: (i.physicalCount - i.systemStock),
                cost: parseFloat(i.cost || 0),
                moneyImpact: (i.physicalCount - i.systemStock) * parseFloat(i.cost || 0)
            }));

            // Registrar en el log de auditoría para el historial
            await AuditLogService.log({
                entity: 'category_audit',
                entityId: 0,
                action: 'finish',
                summary: `Auditoría finalizada: ${this.auditState.categoryName}`,
                metadata: {
                    categoryName: this.auditState.categoryName,
                    adjustmentsMade,
                    itemsCounted: this.auditState.items.length,
                    lossMoney,
                    extraMoney,
                    // Detalle para UI
                    missingItems,
                    extraItems
                }
            });

            this.auditState = null;
            await this.refreshData(); // Actualizar historial en la vista
            app.navigate('inventory');
        } catch (e) {
            showNotification('Error al ajustar automáticamente: ' + e.message, 'error');
        }
    }
    ,

    openAuditHistoryDetail(index) {
        const log = (this.auditHistory || [])[index];
        if (!log) {
            showNotification('Registro no encontrado', 'warning');
            return;
        }

        const meta = log.metadata || {};
        const categoryName = meta.categoryName || 'Sin categoría';
        const missingItems = Array.isArray(meta.missingItems) ? meta.missingItems : null;
        const extraItems = Array.isArray(meta.extraItems) ? meta.extraItems : null;

        const lossMoney = meta.lossMoney || 0;
        const extraMoney = meta.extraMoney || 0;
        const adjustmentsMade = meta.adjustmentsMade || 0;
        const itemsCounted = meta.itemsCounted || 0;

        const renderList = (items, mode) => {
            if (!items) {
                return `<div style="padding: 1.25rem; color: #64748b; font-weight: 600;">Este registro es antiguo y no guardó detalle por producto.</div>`;
            }
            if (items.length === 0) {
                return `<div style="padding: 1.25rem; color: #64748b; font-weight: 600;">No hay ${mode === 'missing' ? 'faltantes' : 'sobrantes'}.</div>`;
            }

            return `
                <div style="max-height: 45vh; overflow-y: auto; padding-right: 0.5rem;">
                    ${items.map(i => `
                        <div style="display:flex; justify-content:space-between; gap: 1rem; padding: 0.9rem 0.75rem; border-bottom: 1px solid #e2e8f0;">
                            <div style="min-width: 0;">
                                <div style="font-weight: 800; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${i.name}</div>
                                <div style="color:#64748b; font-size: 0.8rem; font-family: monospace;">${i.barcode || 'SIN CÓDIGO'}</div>
                            </div>
                            <div style="text-align:right;">
                                <div style="font-weight: 900; color: ${mode === 'missing' ? '#b91c1c' : '#047857'};">
                                    ${mode === 'missing' ? `Faltan ${i.unitsMissing}` : `Sobran ${i.unitsExtra}`}
                                </div>
                                <div style="color:#94a3b8; font-size: 0.8rem;">Real ${i.physicalCount} vs Sys ${i.systemStock}</div>
                                <div style="color:#64748b; font-size: 0.8rem;">Impacto: ${formatCLP(i.moneyImpact || 0)}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        };

        const content = `
            <div style="padding: 0.25rem 0.25rem 0.75rem 0.25rem;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem;">
                    <div>
                        <div style="font-size: 0.8rem; color: #64748b; text-transform: uppercase; font-weight: 900; letter-spacing: 1px;">Control de inventario</div>
                        <div style="font-size: 1.35rem; font-weight: 900; color: #1e293b;">${categoryName}</div>
                        <div style="color:#64748b; margin-top: 0.25rem; font-weight: 600;">${formatDateTime(log.timestamp)}</div>
                    </div>
                    <div style="display:flex; gap: 0.75rem; flex-wrap: wrap;">
                        <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 0.75rem 1rem; border-radius: 0.9rem;">
                            <div style="color:#ef4444; font-weight: 900;">Merma</div>
                            <div style="color:#7f1d1d; font-weight: 900; font-size: 1.05rem;">-${formatCLP(lossMoney)}</div>
                        </div>
                        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 0.75rem 1rem; border-radius: 0.9rem;">
                            <div style="color:#10b981; font-weight: 900;">Sobrantes</div>
                            <div style="color:#065f46; font-weight: 900; font-size: 1.05rem;">+${formatCLP(extraMoney)}</div>
                        </div>
                        <div style="background: #eef2ff; border: 1px solid #c7d2fe; padding: 0.75rem 1rem; border-radius: 0.9rem;">
                            <div style="color:#6366f1; font-weight: 900;">Ajustes</div>
                            <div style="color:#3730a3; font-weight: 900; font-size: 1.05rem;">${adjustmentsMade}</div>
                        </div>
                        <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 0.75rem 1rem; border-radius: 0.9rem;">
                            <div style="color:#475569; font-weight: 900;">Productos</div>
                            <div style="color:#0f172a; font-weight: 900; font-size: 1.05rem;">${itemsCounted}</div>
                        </div>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div style="background: #fff7f7; border: 1px solid #fecaca; border-radius: 1rem; overflow: hidden;">
                        <div style="padding: 0.9rem 1rem; border-bottom: 1px solid #fecaca; font-weight: 900; color: #ef4444;">🚨 Faltantes</div>
                        ${renderList(missingItems, 'missing')}
                    </div>
                    <div style="background: #f2fff8; border: 1px solid #a7f3d0; border-radius: 1rem; overflow: hidden;">
                        <div style="padding: 0.9rem 1rem; border-bottom: 1px solid #a7f3d0; font-weight: 900; color: #10b981;">✅ Sobrantes</div>
                        ${renderList(extraItems, 'extra')}
                    </div>
                </div>
            </div>
        `;

        showModal(content, {
            title: 'Detalle del Control',
            width: '980px',
            footer: '<button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>'
        });
    },

    renderSuggestions() {
        this.collapsedSuggestions = this.collapsedSuggestions || {};
        
        const lowStockProducts = this.products.filter(p => 
            !p.deleted && 
            (p.minStock || 0) > 0 && 
            (p.stock || 0) <= (p.minStock || 0)
        );

        // Group by supplier
        const grouped = lowStockProducts.reduce((acc, p) => {
            const supplier = p.supplierName || 'Sin proveedor';
            if (!acc[supplier]) acc[supplier] = [];
            acc[supplier].push(p);
            return acc;
        }, {});

        const suppliers = Object.keys(grouped).sort();

        let suppliersHtml = '';

        if (suppliers.length === 0) {
            suppliersHtml = `
                <div class="card" style="text-align: center; padding: 3rem; background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 1rem;">
                    <span style="font-size: 3rem; display: block; margin-bottom: 1rem;">🎉</span>
                    <h3 style="color: #166534; margin: 0 0 0.5rem 0; font-weight: 800;">¡Todo al día!</h3>
                    <p style="color: #475569; margin: 0; font-weight: 600;">No hay sugerencias de reposición. Todos los productos tienen stock suficiente.</p>
                </div>
            `;
        } else {
            suppliersHtml = suppliers.map(supplierName => {
                const items = grouped[supplierName];
                const isCollapsed = this.collapsedSuggestions[supplierName] === true;
                const chevron = isCollapsed ? '▼' : '▲';
                const listHtml = isCollapsed ? '' : `
                    <div style="padding: 0; border-top: 1px solid #e2e8f0; overflow-x: auto;">
                        <table class="table compact-table" style="width: 100%; border-collapse: collapse; margin: 0;">
                            <thead style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                                <tr>
                                    <th style="text-align: left; padding: 0.75rem 1rem; color: #475569; font-weight: 700; font-size: 0.85rem;">Producto</th>
                                    <th style="text-align: left; padding: 0.75rem 1rem; color: #475569; font-weight: 700; font-size: 0.85rem;">Categoría</th>
                                    <th style="text-align: center; padding: 0.75rem 1rem; color: #475569; font-weight: 700; font-size: 0.85rem;">Stock Actual</th>
                                    <th style="text-align: center; padding: 0.75rem 1rem; color: #475569; font-weight: 700; font-size: 0.85rem;">Stock Mínimo</th>
                                    <th style="text-align: center; padding: 0.75rem 1rem; color: #475569; font-weight: 700; font-size: 0.85rem;">Sugerencia Compra</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${items.map(p => {
                                    const stock = parseFloat(p.stock) || 0;
                                    const minStock = parseFloat(p.minStock) || 0;
                                    const toBuy = Math.max(0, minStock - stock);
                                    
                                    let stockColor = '#ca8a04'; // Amarillo/dorado para sugerencia
                                    let stockBg = '#fef9c3';
                                    if (stock <= 0) {
                                        stockColor = '#dc2626'; // Rojo si de plano no hay
                                        stockBg = '#fee2e2';
                                    }
                                    
                                    return `
                                        <tr style="border-bottom: 1px solid #e2e8f0; transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                                            <td style="padding: 0.75rem 1rem; vertical-align: middle;">
                                                <div style="font-weight: 700; color: #1e293b;">${safeHTML(p.name)}</div>
                                                <small style="color: #64748b; font-family: monospace; font-size: 0.8rem;">${safeHTML(p.barcode || 'Sin código')}</small>
                                            </td>
                                            <td style="padding: 0.75rem 1rem; vertical-align: middle; color: #475569; font-weight: 500;">
                                                ${safeHTML(p.category || 'General')}
                                            </td>
                                            <td style="padding: 0.75rem 1rem; text-align: center; vertical-align: middle;">
                                                <span style="background: ${stockBg}; color: ${stockColor}; padding: 0.25rem 0.6rem; border-radius: 0.5rem; font-weight: 800; font-size: 0.95rem; border: 1px solid ${stockColor}44;">
                                                    ${formatStock(stock, p.type === 'weight' ? 3 : 0)} ${p.type === 'weight' ? 'kg' : 'un'}
                                                </span>
                                            </td>
                                            <td style="padding: 0.75rem 1rem; text-align: center; vertical-align: middle; color: #475569; font-weight: 600; font-size: 0.95rem;">
                                                ${minStock}
                                            </td>
                                            <td style="padding: 0.75rem 1rem; text-align: center; vertical-align: middle;">
                                                <span style="background: #eff6ff; color: #1d4ed8; padding: 0.25rem 0.6rem; border-radius: 0.5rem; font-weight: 800; font-size: 0.95rem; border: 1px solid #bfdbfe;">
                                                    Comprar +${formatStock(toBuy, p.type === 'weight' ? 3 : 0)}
                                                </span>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `;

                return `
                    <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 1.25rem; border: 1.5px solid #e2e8f0; border-radius: 1rem; box-shadow: var(--shadow-sm);">
                        <div style="padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer; background: #ffffff; user-select: none; transition: background 0.15s;" 
                             onclick="InventoryView.toggleSuggestionSupplier('${supplierName.replace(/'/g, "\\'")}')"
                             onmouseover="this.style.background='#f8fafc'"
                             onmouseout="this.style.background='#ffffff'">
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <span style="font-size: 1.2rem;">🚚</span>
                                <strong style="font-size: 1.1rem; color: #1e293b; text-transform: capitalize;">${safeHTML(supplierName)}</strong>
                                <span style="background: #fef3c7; color: #b45309; font-weight: 800; font-size: 0.8rem; padding: 0.15rem 0.5rem; border-radius: 99px; border: 1px solid #fde047;">
                                    ${items.length} sugeridos
                                </span>
                            </div>
                            <span style="font-size: 1.1rem; color: #64748b; font-weight: bold;">${chevron}</span>
                        </div>
                        ${listHtml}
                    </div>
                `;
            }).join('');
        }

        return `
            <div class="suggestions-section animate-fade-in">
                <!-- Banner de Sugerencias Suaves -->
                <div style="background: #eff6ff; border: 1.5px solid #bfdbfe; border-left: 5px solid #3b82f6; border-radius: 1.25rem; padding: 1.5rem; margin-bottom: 2rem; display: flex; gap: 1rem; align-items: flex-start; flex-wrap: wrap;">
                    <div style="font-size: 2.2rem; line-height: 1;">💡</div>
                    <div style="flex: 1; min-width: 250px;">
                        <h3 style="color: #1e3a8a; margin: 0 0 0.25rem 0; font-size: 1.2rem; font-weight: 800;">Sugerencias de Reposición de Stock</h3>
                        <p style="color: #1e40af; margin: 0; font-size: 0.95rem; font-weight: 600; line-height: 1.4;">
                            Los siguientes productos se encuentran en o por debajo de su stock mínimo configurado.
                            Esta lista está agrupada por <strong>Proveedor</strong> para planificar tus compras y mantener tu negocio abastecido.
                        </p>
                        
                        <!-- Acciones rápidas de exportación -->
                        <div style="display: flex; gap: 0.5rem; margin-top: 1rem; flex-wrap: wrap;">
                            <button class="btn btn-secondary" onclick="InventoryView.copySuggestionsToClipboard()" style="padding: 0.45rem 0.85rem; border-radius: 0.5rem; font-weight: 700; font-size: 0.82rem; background: white; border: 1px solid #cbd5e1; display: flex; align-items: center; gap: 0.35rem; color: #475569;">
                                💬 WhatsApp
                            </button>
                            <button class="btn btn-secondary" onclick="InventoryView.exportSuggestionsPDF()" style="padding: 0.45rem 0.85rem; border-radius: 0.5rem; font-weight: 700; font-size: 0.82rem; background: white; border: 1px solid #cbd5e1; display: flex; align-items: center; gap: 0.35rem; color: #475569;">
                                📄 Orden de Compra PDF
                            </button>
                        </div>
                    </div>
                    <div style="text-align: right; min-width: 140px;">
                        <div style="font-size: 0.75rem; font-weight: 800; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px;">Total sugeridos</div>
                        <div style="font-size: 2rem; font-weight: 900; color: #1d4ed8; line-height: 1.1; margin-top: 0.2rem;">${lowStockProducts.length}</div>
                    </div>
                </div>

                <!-- Lista de proveedores colapsables -->
                <div>
                    ${suppliersHtml}
                </div>
            </div>
        `;
    },

    toggleSuggestionSupplier(supplierName) {
        this.collapsedSuggestions = this.collapsedSuggestions || {};
        this.collapsedSuggestions[supplierName] = !this.collapsedSuggestions[supplierName];
        app.navigate('inventory');
    },

    copySuggestionsToClipboard() {
        const lowStockProducts = this.products.filter(p => 
            !p.deleted && 
            (p.minStock || 0) > 0 && 
            (p.stock || 0) <= (p.minStock || 0)
        );
        
        if (lowStockProducts.length === 0) {
            showNotification('No hay productos sugeridos para reponer', 'warning');
            return;
        }
        
        // Group by supplier
        const grouped = lowStockProducts.reduce((acc, p) => {
            const supplier = p.supplierName || 'Sin proveedor';
            if (!acc[supplier]) acc[supplier] = [];
            acc[supplier].push(p);
            return acc;
        }, {});

        const suppliers = Object.keys(grouped).sort();

        let text = '*SUGERENCIAS DE REPOSICIÓN POR PROVEEDOR - CONTROL DE STOCK*\n\n';
        suppliers.forEach(supplier => {
            text += `*📦 PROVEEDOR: ${supplier.toUpperCase()}*\n`;
            grouped[supplier].forEach(p => {
                const toBuy = Math.max(0, (p.minStock || 0) - (p.stock || 0));
                text += `• *${p.name}* (Cód: ${p.barcode || 'S/N'})\n  Stock actual: ${p.stock} | Mínimo: ${p.minStock}\n  *Sugerido comprar: +${toBuy}*\n`;
            });
            text += '\n';
        });
        
        navigator.clipboard.writeText(text.trim())
            .then(() => showNotification('Listado copiado al portapapeles', 'success'))
            .catch(() => showNotification('Error al copiar el listado', 'error'));
    },

    exportSuggestionsPDF() {
        const lowStockProducts = this.products.filter(p => 
            !p.deleted && 
            (p.minStock || 0) > 0 && 
            (p.stock || 0) <= (p.minStock || 0)
        );
        
        if (lowStockProducts.length === 0) {
            showNotification('No hay productos sugeridos para reponer', 'warning');
            return;
        }
        
        // Sort by supplier name, then product name
        const sortedProducts = [...lowStockProducts].sort((a, b) => {
            const sA = a.supplierName || 'Sin proveedor';
            const sB = b.supplierName || 'Sin proveedor';
            if (sA !== sB) return sA.localeCompare(sB);
            return (a.name || '').localeCompare(b.name || '');
        });

        const printWindow = window.open('', '_blank');
        let rowsHtml = '';
        sortedProducts.forEach(p => {
            const stock = parseFloat(p.stock) || 0;
            const minStock = parseFloat(p.minStock) || 0;
            const toBuy = Math.max(0, minStock - stock);
            rowsHtml += `
                <tr>
                    <td>${p.barcode || '—'}</td>
                    <td><strong>${p.name}</strong><br><small>${p.category || 'General'}</small></td>
                    <td>${p.supplierName || 'Sin proveedor'}</td>
                    <td class="center">${stock} ${p.type === 'weight' ? 'kg' : 'un'}</td>
                    <td class="center">${minStock}</td>
                    <td class="center" style="color: #1d4ed8; font-weight: bold;">+${toBuy}</td>
                </tr>
            `;
        });
        
        printWindow.document.write(`
            <html>
            <head>
                <title>Orden de Reposición - ${new Date().toLocaleDateString()}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
                    h1 { text-align: center; color: #111; margin-bottom: 5px; }
                    p { text-align: center; color: #666; margin-top: 0; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; font-size: 11px; }
                    th { background-color: #f2f2f2; text-align: left; }
                    .center { text-align: center; }
                </style>
            </head>
            <body>
                <h1>ORDEN DE COMPRA / REPOSICIÓN</h1>
                <p>Fecha de emisión: ${new Date().toLocaleString()}</p>
                <table>
                    <thead>
                        <tr>
                            <th>Cód. Barra</th>
                            <th>Producto</th>
                            <th>Proveedor</th>
                            <th class="center">Stock Act.</th>
                            <th class="center">Stock Mín.</th>
                            <th class="center">Sugerido Comprar</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
                <script>
                    window.onload = function() {
                        window.print();
                        window.close();
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }
};

// CORRECCIÓN: Event listener global para manejar la selección de consumo interno/pérdida
document.addEventListener('click', function(e) {
    const label = e.target.closest('.missing-type-label');
    if (label) {
        const radio = label.querySelector('input[type="radio"]');
        if (radio) {
            const name = radio.name;
            const allLabels = document.querySelectorAll(`.missing-type-label input[name="${name}"]`);
            allLabels.forEach(r => {
                const parentLabel = r.closest('.missing-type-label');
                if (r.value === 'consumption') {
                    parentLabel.style.borderColor = 'rgba(16, 185, 129, 0.2)';
                    parentLabel.style.background = 'rgba(16, 185, 129, 0.05)';
                    parentLabel.style.color = '#64748b';
                } else {
                    parentLabel.style.borderColor = 'rgba(239, 68, 68, 0.2)';
                    parentLabel.style.background = 'rgba(239, 68, 68, 0.05)';
                    parentLabel.style.color = '#64748b';
                }
            });
            if (radio.value === 'consumption') {
                label.style.borderColor = 'rgba(16, 185, 129, 0.6)';
                label.style.background = 'rgba(16, 185, 129, 0.2)';
                label.style.color = '#34d399';
            } else {
                label.style.borderColor = 'rgba(239, 68, 68, 0.6)';
                label.style.background = 'rgba(239, 68, 68, 0.2)';
                label.style.color = '#f87171';
            }
            radio.checked = true;
        }
    }
});
