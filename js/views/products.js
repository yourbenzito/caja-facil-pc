const ProductsView = {
    selectedCategory: null,
    stockFilter: 'all',
    productSuppliers: {},
    currentPage: 1,
    itemsPerPage: 50,

    formatExpiry(expiryDate) {
        if (!expiryDate || String(expiryDate).trim() === '') return '-';
        const d = new Date(String(expiryDate).slice(0, 10));
        if (isNaN(d.getTime())) return '-';
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const exp = new Date(d);
        exp.setHours(0, 0, 0, 0);
        const days = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
        const label = exp.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
        if (days < 0) return `<span class="badge badge-danger" title="Vencido">Vencido ${label}</span>`;
        if (days <= 7) return `<span class="badge badge-warning" title="Próximo a vencer">${label}</span>`;
        return label;
    },

    async render() {
        let contentHtml = '';
        this.categoriesList = (typeof Category !== 'undefined' && typeof Category.getAll === 'function')
            ? await Category.getAll()
            : [];
        const stats = await Product.getCategoryStats();
        this.categoryStats = stats;

        if (this.selectedCategory) {
            const products = await Product.getByCategory(this.selectedCategory);
            let filteredProducts = products;
            if (this.stockFilter === 'low') {
                filteredProducts = filteredProducts.filter(p => (parseFloat(p.stock)||0) > 0 && (parseFloat(p.stock)||0) <= (parseFloat(p.minStock)||0));
            } else if (this.stockFilter === 'out') {
                filteredProducts = filteredProducts.filter(p => (parseFloat(p.stock)||0) === 0);
            } else if (this.stockFilter === 'negative') {
                filteredProducts = filteredProducts.filter(p => (parseFloat(p.stock)||0) < 0);
            }
            contentHtml = this.renderProductsTable(filteredProducts);
        } else {
            contentHtml = this.renderCategoriesGrid(stats);
        }

        // Carga diferida de proveedores (background)
        if (Object.keys(this.productSuppliers).length === 0) {
            this.getLastSuppliers().then(suppliers => {
                this.productSuppliers = suppliers;
                if (app.currentView === 'products') this.updateSupplierLabels();
            });
        }

        return `
            <!-- CABECERA PRINCIPAL ELEGANTE -->
            <div class="view-header" style="margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
                    <div>
                        <h1 style="margin: 0; font-size: 1.85rem; font-weight: 950; color: #0f172a; letter-spacing: -0.5px;">Catálogo de Productos</h1>
                        <p style="margin: 0; color: #64748b; font-size: 0.88rem; font-weight: 600;">Control integral de inventario, salud de stock y categorías</p>
                    </div>
                    <style>
                        .products-action-btn {
                            background: #ffffff;
                            color: #334155;
                            border: 1.5px solid #e2e8f0;
                            border-radius: 0.65rem;
                            height: 40px;
                            padding: 0 1rem;
                            display: inline-flex;
                            align-items: center;
                            gap: 0.5rem;
                            font-size: 0.88rem;
                            font-weight: 700;
                            box-shadow: 0 1px 3px rgba(0,0,0,0.03);
                            cursor: pointer;
                            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                            user-select: none;
                        }
                        .products-action-btn:hover {
                            background: #f8fafc;
                            border-color: #cbd5e1;
                            color: #0f172a;
                            transform: translateY(-1.5px);
                            box-shadow: 0 4px 12px rgba(0,0,0,0.07);
                        }
                        .products-action-btn:active {
                            transform: translateY(0) scale(0.98);
                        }
                        .products-action-btn svg {
                            color: #64748b;
                            transition: color 0.2s, transform 0.2s;
                        }
                        .products-action-btn:hover svg {
                            color: #0f172a;
                            transform: scale(1.05);
                        }
                        .products-danger-action-btn {
                            background: #fff1f2;
                            color: #e11d48;
                            border: 1.5px solid #fecdd3;
                            border-radius: 0.65rem;
                            height: 40px;
                            padding: 0 1rem;
                            display: inline-flex;
                            align-items: center;
                            gap: 0.5rem;
                            font-size: 0.88rem;
                            font-weight: 700;
                            cursor: pointer;
                            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                        }
                        .products-danger-action-btn:hover {
                            background: #ffe4e6;
                            border-color: #fda4af;
                            transform: translateY(-1.5px);
                            box-shadow: 0 4px 12px rgba(225,29,72,0.15);
                        }
                        .products-primary-btn {
                            height: 40px;
                            font-weight: 900;
                            border-radius: 0.65rem;
                            padding: 0 1.25rem;
                            display: inline-flex;
                            align-items: center;
                            gap: 0.5rem;
                            font-size: 0.92rem;
                            background: var(--primary, #4f46e5);
                            color: #ffffff;
                            border: none;
                            box-shadow: 0 4px 14px rgba(79,70,229,0.28);
                            cursor: pointer;
                            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                            user-select: none;
                        }
                        .products-primary-btn:hover {
                            filter: brightness(1.08);
                            transform: translateY(-1.5px);
                            box-shadow: 0 6px 18px rgba(79,70,229,0.42);
                        }
                        .products-primary-btn:active {
                            transform: translateY(0) scale(0.98);
                        }
                        .products-primary-btn svg {
                            transition: transform 0.2s;
                        }
                        .products-primary-btn:hover svg {
                            transform: rotate(90deg);
                        }
                    </style>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
                        ${PermissionService.can('products.delete') ? `
                        <button class="products-action-btn" onclick="ProductsView.showDeletedProducts()" title="Ver productos desactivados">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
                            <span>Desactivados</span>
                        </button>
                        <button class="products-danger-action-btn" onclick="ProductsView.deleteSelected()" id="btnDeleteSelected" style="display: none;" title="Desactivar productos seleccionados">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                            <span>Desactivar</span>
                        </button>` : ''}

                        ${PermissionService.can('products.export') ? `
                        <button class="products-action-btn" onclick="ProductsView.exportToExcel()" title="Exportar productos a Excel">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            <span>Exportar</span>
                        </button>` : ''}

                        ${PermissionService.can('products.import') ? `
                        <button class="products-action-btn" onclick="ProductsView.showImportModal()" title="Importar productos desde Excel">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                            <span>Importar</span>
                        </button>` : ''}

                        <button class="products-action-btn" onclick="ProductsView.showCategoryManagerModal()" title="Administrar Categorías">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                            <span>Categorías</span>
                        </button>

                        ${PermissionService.can('products.create') ? `
                        <button class="products-primary-btn" onclick="ProductsView.showProductForm()" title="Crear nuevo producto">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            <span>Nuevo Producto</span>
                        </button>` : ''}
                    </div>
                </div>
            </div>

            <!-- BARRA DE CONTROL FLOTANTE (STICKY AL HACER SCROLL) -->
            <div class="products-sticky-header">
                <!-- Fila 1: Buscador + Filtros Rápidos de Alerta + Botón Volver -->
                <div style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;">
                    <div style="flex: 1; position: relative; min-width: 240px; display: flex; align-items: center;">
                        <span style="position: absolute; left: 1rem; font-size: 1.15rem; color: #64748b; pointer-events: none;">🔍</span>
                        <input type="text" id="searchProducts" class="form-control" 
                               placeholder="Buscar productos o categorías (F1)..." 
                               style="width: 100%; height: 46px; padding-left: 2.75rem; padding-right: 1rem; font-size: 0.98rem; font-weight: 700; border: 1.5px solid #cbd5e1; border-radius: 0.85rem; background: #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.02); transition: all 0.2s;">
                    </div>

                    <div id="productsReturnBtnContainer">
                        ${this.renderReturnButton()}
                    </div>

                    <div style="display: flex; gap: 0.45rem; align-items: center; flex-shrink: 0;">
                        <button class="btn btn-sm ${this.stockFilter === 'negative' ? 'btn-danger' : 'btn-outline-danger'}" 
                                onclick="ProductsView.setStockFilter(ProductsView.stockFilter === 'negative' ? 'all' : 'negative')" 
                                style="height: 42px; font-weight: 800; border-radius: 0.75rem; padding: 0 0.85rem;"
                                title="Filtrar productos con stock menor a 0">
                            🔴 Stock Negativo
                        </button>

                        <button class="btn btn-sm ${this.stockFilter === 'low' ? 'btn-warning' : 'btn-outline-warning'}" 
                                onclick="ProductsView.setStockFilter(ProductsView.stockFilter === 'low' ? 'all' : 'low')" 
                                style="height: 42px; font-weight: 800; border-radius: 0.75rem; padding: 0 0.85rem;"
                                title="Filtrar productos con bajo stock">
                            ⚠️ Bajo Stock
                        </button>
                    </div>
                </div>

                <!-- Fila 2: Chips Rápidos de Categorías con Scroll Horizontal Fluido -->
                ${this.renderCategoryChipsBar()}
            </div>

            <!-- CONTENEDOR DE ALERTAS Y CONTENIDO PRINCIPAL -->
            <div id="productsAlertContainer">${this.renderCategoryAlert()}</div>
            <div id="productsTable" style="margin-top: 0.5rem;">${contentHtml}</div>
        `;
    },

    renderCategoryChipsBar() {
        const categories = (this.categoriesList || []).map(c => c.name || c).filter(Boolean);
        if (!categories.length) return '';

        const statsMap = {};
        let totalAll = 0;
        if (Array.isArray(this.categoryStats)) {
            this.categoryStats.forEach(s => {
                const count = s.total || 0;
                totalAll += count;
                statsMap[(s.category || 'General').toLowerCase()] = count;
            });
        }

        return `
            <div class="category-chips-bar" id="categoryChipsBar" title="Usa la rueda del mouse para deslizar las categorías horizontalmente">
                <div class="category-chip-pill ${!this.selectedCategory ? 'active' : ''}" 
                     onclick="ProductsView.clearCategoryFilter()">
                    <span>⭐</span>
                    <span>Todas</span>
                    <span style="font-size: 0.72rem; font-weight: 850; background: ${!this.selectedCategory ? 'rgba(255,255,255,0.25)' : '#e2e8f0'}; color: ${!this.selectedCategory ? '#fff' : '#475569'}; padding: 0.1rem 0.45rem; border-radius: 999px; margin-left: 0.25rem;">${totalAll}</span>
                </div>
                ${categories.map(cat => {
                    const isActive = (this.selectedCategory || '').toLowerCase() === (cat || '').toLowerCase();
                    const icon = this.getCategoryIcon(cat);
                    const count = statsMap[(cat || '').toLowerCase()] || 0;
                    return `
                        <div class="category-chip-pill ${isActive ? 'active' : ''}" 
                             onclick="ProductsView.filterByCategory('${safeHTML(cat)}')">
                            <span>${icon}</span>
                            <span>${safeHTML(cat)}</span>
                            <span style="font-size: 0.72rem; font-weight: 850; background: ${isActive ? 'rgba(255,255,255,0.25)' : '#e2e8f0'}; color: ${isActive ? '#fff' : '#475569'}; padding: 0.1rem 0.45rem; border-radius: 999px; margin-left: 0.25rem;">${count}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    renderReturnButton() {
        if (!this.selectedCategory && this.stockFilter === 'all') return '';
        return `
            <button class="btn btn-primary" onclick="ProductsView.clearCategoryFilter()" 
                    style="height: 46px; font-weight: 800; border-radius: 0.85rem; padding: 0 1.25rem; display: flex; align-items: center; gap: 0.45rem; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);">
                <span>⬅</span>
                <span>Volver a Categorías</span>
            </button>
        `;
    },

    renderCategoryAlert() {
        if (!this.selectedCategory && this.stockFilter === 'all') return '';
        const filterName = this.stockFilter === 'negative' ? '🔴 Stock Negativo (<0)' : (this.stockFilter === 'low' ? '⚠️ Bajo Stock' : (this.stockFilter === 'out' ? '❌ Sin Stock (0)' : 'Todos'));
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; background: #ffffff; padding: 0.75rem 1.25rem; border-radius: 1rem; border: 1.5px solid #cbd5e1; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.75rem; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                <div style="font-weight: 800; color: #1e293b; font-size: 0.95rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                    ${this.selectedCategory ? `<span style="background: rgba(79, 70, 229, 0.1); color: #4338ca; padding: 0.25rem 0.75rem; border-radius: 0.5rem; border: 1px solid rgba(79, 70, 229, 0.2);">📁 Categoría: <strong>${safeHTML(this.selectedCategory)}</strong></span>` : ''}
                    ${this.stockFilter !== 'all' ? `<span style="background: #f1f5f9; padding: 0.25rem 0.75rem; border-radius: 0.5rem; color: #0f172a; border: 1px solid #cbd5e1;">Filtro: <strong>${filterName}</strong></span>` : ''}
                </div>
                <button class="btn btn-sm btn-secondary" style="font-weight: 800; border-radius: 0.65rem;" onclick="ProductsView.clearCategoryFilter()">Quitar Filtros ✕</button>
            </div>
        `;
    },

    focusSearch() {
        const el = document.getElementById('searchProducts');
        if (el) { el.focus(); el.select?.(); }
    },

    async init() {
        const searchInput = document.getElementById('searchProducts');
        let searchTimeout;
        if (searchInput) {
            // Solo dar foco automático al buscador si no hay modales abiertos
            if (!document.querySelector('.modal') && !document.body.classList.contains('modal-open')) {
                setTimeout(() => {
                    if (!document.querySelector('.modal') && !document.body.classList.contains('modal-open')) {
                        searchInput.focus();
                    }
                }, 100);
            }
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => this.applyFilters(e.target.value.trim()), 200);
            });
        }

        // Desplazamiento horizontal fluido con la rueda del ratón en la barra de categorías
        const chipsBar = document.getElementById('categoryChipsBar');
        if (chipsBar) {
            chipsBar.addEventListener('wheel', (e) => {
                if (e.deltaY !== 0) {
                    e.preventDefault();
                    chipsBar.scrollLeft += e.deltaY * 1.4;
                }
            }, { passive: false });
        }

        // Autofoco automático: al ingresar o escribir cualquier tecla sin clic, enfocar el buscador
        const productsGlobalKeydown = (e) => {
            if (app.currentView !== 'products') return;
            const activeElem = document.activeElement;
            const activeTag = activeElem ? activeElem.tagName.toUpperCase() : '';
            const activeModal = document.querySelector('.modal') || document.body.classList.contains('modal-open');
            if (!activeModal && activeTag !== 'INPUT' && activeTag !== 'TEXTAREA' && activeTag !== 'SELECT') {
                if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    if (searchInput && activeElem !== searchInput) {
                        searchInput.focus();
                    }
                }
            }
        };
        if (document._productsGlobalKeydown) document.removeEventListener('keydown', document._productsGlobalKeydown);
        document._productsGlobalKeydown = productsGlobalKeydown;
        document.addEventListener('keydown', productsGlobalKeydown);
    },

    async applyFilters(searchTerm = '') {
        const productsTable = document.getElementById('productsTable');
        
        let products;
        if (searchTerm.length >= 2) {
            this.currentPage = 1;
            // MODO BÚSQUEDA RÁPIDA (SERVIDOR)
            if (productsTable) productsTable.style.opacity = '0.5';
            products = await Product.search(searchTerm);
            if (productsTable) productsTable.style.opacity = '1';
            
            const alertContainer = document.getElementById('productsAlertContainer');
            if (alertContainer) alertContainer.innerHTML = `<div class="pos-alert" style="margin-bottom: 1rem;"><strong>Resultados para:</strong> "${safeHTML(searchTerm)}"</div>`;
            const btnContainer = document.getElementById('productsReturnBtnContainer');
            if (btnContainer) btnContainer.innerHTML = this.renderReturnButton();
        } else {
            // Si el buscador está vacío y no hay categoría seleccionada, volver a mostrar la grilla de categorías
            if (!this.selectedCategory) {
                this.categoriesList = (typeof Category !== 'undefined' && typeof Category.getAll === 'function')
                    ? await Category.getAll()
                    : [];
                const stats = await Product.getCategoryStats();
                if (productsTable) {
                    productsTable.innerHTML = this.renderCategoriesGrid(stats);
                }
                const alertContainer = document.getElementById('productsAlertContainer');
                if (alertContainer) alertContainer.innerHTML = '';
                const btnContainer = document.getElementById('productsReturnBtnContainer');
                if (btnContainer) btnContainer.innerHTML = '';
                return;
            }
            
            // MODO CATEGORÍA (MÁS PESADO PERO CACHEADO)
            products = await Product.getAll();
            
            const alertContainer = document.getElementById('productsAlertContainer');
            if (alertContainer) alertContainer.innerHTML = this.renderCategoryAlert();
            const btnContainer = document.getElementById('productsReturnBtnContainer');
            if (btnContainer) btnContainer.innerHTML = this.renderReturnButton();

            if (this.selectedCategory) {
                products = products.filter(p => (p.category || 'General') === this.selectedCategory);
                products.sort((a, b) => (parseFloat(b.stock) || 0) - (parseFloat(a.stock) || 0));
            }
        }

        // Filtros adicionales de stock
        if (this.stockFilter === 'low') {
            products = products.filter(p => (parseFloat(p.stock) || 0) > 0 && (parseFloat(p.stock) || 0) <= (parseFloat(p.minStock) || 0));
        } else if (this.stockFilter === 'out') {
            products = products.filter(p => (parseFloat(p.stock) || 0) === 0);
        } else if (this.stockFilter === 'negative') {
            products = products.filter(p => (parseFloat(p.stock) || 0) < 0);
        }

        if (productsTable) {
            productsTable.innerHTML = this.renderProductsTable(products);
        }
    },

    renderCategoriesGrid(statsArray) {
        // Normalizar stats si vienen en formato array del nuevo endpoint o objeto del fallback
        const stats = {};
        if (Array.isArray(statsArray)) {
            statsArray.forEach(s => {
                const name = s.category || 'General';
                stats[name] = { total: s.total, low: s.low || 0, out: s.out || 0, negative: s.negative || 0 };
            });
        } else {
            return '<p>Error cargando categorías</p>';
        }

        let categories = Object.keys(stats).length > 0 ? Object.keys(stats).sort() : ['General'];

        // Si hay un filtro rápido de stock activo, filtrar las tarjetas de categoría
        if (this.stockFilter === 'low') {
            categories = categories.filter(cat => (stats[cat]?.low || 0) > 0);
        } else if (this.stockFilter === 'out') {
            categories = categories.filter(cat => (stats[cat]?.out || 0) > 0);
        } else if (this.stockFilter === 'negative') {
            categories = categories.filter(cat => (stats[cat]?.negative || 0) > 0);
        }

        if (categories.length === 0) {
            const filterLabel = this.stockFilter === 'negative' ? 'Stock Negativo' : (this.stockFilter === 'low' ? 'Bajo Stock' : 'Sin Stock');
            return `
                <div style="text-align: center; padding: 4rem 2rem; background: #ffffff; border-radius: 1.25rem; border: 2px dashed #cbd5e1; margin: 1rem 0;">
                    <div style="font-size: 3.5rem; margin-bottom: 0.5rem;">🎉</div>
                    <h3 style="color: #1e293b; font-weight: 800;">¡No hay categorías con ${filterLabel}!</h3>
                    <p style="color: #64748b; font-size: 0.9rem;">Todos tus productos en esta condición están al día.</p>
                </div>
            `;
        }

        return `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; padding: 0.5rem 0 2rem 0;">
                ${categories.map(cat => {
                    const s = stats[cat] || { total: 0, low: 0, out: 0, negative: 0 };
                    const catObj = (this.categoriesList || []).find(c => (typeof CategoryHelper !== 'undefined') ? CategoryHelper.areEqual(c.name, cat) : (c.name || '').toLowerCase() === cat.toLowerCase());
                    const catColor = catObj?.color || '#3b82f6';
                    
                    const total = s.total || 0;
                    const out = s.out || 0;
                    const low = s.low || 0;
                    const healthy = Math.max(0, total - out - low);
                    const healthPct = total > 0 ? Math.round(((total - out) / total) * 100) : 100;
                    
                    const mainOnClick = this.stockFilter !== 'all' 
                        ? `ProductsView.filterByCategoryWithStock('${safeHTML(cat)}', '${this.stockFilter}')` 
                        : `ProductsView.filterByCategory('${safeHTML(cat)}')`;
                    
                    const icon = this.getCategoryIcon(cat);

                    return `
                        <div class="cat-card-pro" 
                             style="border-top: 4px solid ${catColor}; --cat-glow: ${catColor}35; padding: 1.15rem 1rem 0.85rem;"
                             onclick="${mainOnClick}"
                             title="Clic para explorar los productos de ${safeHTML(cat)}">
                            
                            <!-- Icono Central con Badge Circular y Sombra Sutil -->
                            <div class="cat-icon-container" style="background: ${catColor}15; border: 2px solid ${catColor}30; width: 58px; height: 58px; font-size: 2rem; margin: 0 auto 0.5rem; box-shadow: 0 4px 10px ${catColor}20;">
                                ${icon}
                            </div>

                            <!-- Título de la Categoría -->
                            <h3 style="margin: 0 0 0.3rem 0; font-size: 1.08rem; font-weight: 900; color: #0f172a; text-align: center; text-transform: uppercase; letter-spacing: 0.3px;">
                                ${safeHTML(cat)}
                            </h3>

                            <!-- Total Productos y Porcentaje de Salud de Inventario -->
                            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; font-weight: 800; color: #64748b; margin-bottom: 0.35rem; padding: 0 0.2rem;">
                                <span>${total} Productos</span>
                                <span style="color: ${healthPct >= 90 ? '#10b981' : (healthPct >= 70 ? '#f59e0b' : '#ef4444')}; font-weight: 900;">
                                    ${healthPct}% En Stock
                                </span>
                            </div>

                            <!-- Barra Visual Segmentada de Salud de Stock -->
                            <div style="height: 5px; background: #e2e8f0; border-radius: 9999px; overflow: hidden; margin-bottom: 0.75rem; display: flex;" title="Verde: Disponible (${healthy}) | Naranja: Bajo Stock (${low}) | Rojo: Agotado (${out})">
                                <div style="width: ${total > 0 ? (healthy/total)*100 : 100}%; background: #10b981; transition: width 0.4s ease;"></div>
                                <div style="width: ${total > 0 ? (low/total)*100 : 0}%; background: #f59e0b; transition: width 0.4s ease;"></div>
                                <div style="width: ${total > 0 ? (out/total)*100 : 0}%; background: #ef4444; transition: width 0.4s ease;"></div>
                            </div>

                            <!-- Chips Inferiores Interactivos Clicables -->
                            <div style="display: flex; gap: 0.45rem; margin-top: auto; padding-top: 0.75rem; border-top: 1.5px solid #f1f5f9;">
                                <div class="cat-chip-alert" 
                                     onclick="event.stopPropagation(); ProductsView.filterByCategoryWithStock('${safeHTML(cat)}', 'low')"
                                     title="${low > 0 ? `Ver ${low} producto(s) con bajo stock` : 'Sin alertas de bajo stock'}"
                                     style="background: ${low > 0 ? 'rgba(245, 158, 11, 0.12)' : '#f8fafc'}; color: ${low > 0 ? '#b45309' : '#94a3b8'}; border: 1.5px solid ${low > 0 ? 'rgba(245, 158, 11, 0.35)' : '#e2e8f0'}; cursor: ${low > 0 ? 'pointer' : 'default'};">
                                    <span>⚠️</span>
                                    <span>${low} Bajos</span>
                                </div>
                                <div class="cat-chip-alert" 
                                     onclick="event.stopPropagation(); ProductsView.filterByCategoryWithStock('${safeHTML(cat)}', 'out')"
                                     title="${out > 0 ? `Ver ${out} producto(s) agotados` : 'Todos los productos tienen stock'}"
                                     style="background: ${out > 0 ? 'rgba(239, 68, 68, 0.12)' : '#f8fafc'}; color: ${out > 0 ? '#b91c1c' : '#94a3b8'}; border: 1.5px solid ${out > 0 ? 'rgba(239, 68, 68, 0.35)' : '#e2e8f0'}; cursor: ${out > 0 ? 'pointer' : 'default'};">
                                    <span>🔴</span>
                                    <span>${out} Agotados</span>
                                </div>
                            </div>

                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    getCategoryIcon(categoryName) {
        const name = (categoryName || '').toLowerCase().trim();
        // Bebidas, aguas y líquidos
        if (name.includes('agua') || name.includes('mineral')) return '💧';
        if (name.includes('jugo') || name.includes('liquido') || name.includes('bebestible') || name.includes('bebida')) return '🥤';
        if (name.includes('alcohol') || name.includes('cerveza') || name.includes('vino') || name.includes('licor') || name.includes('pisco')) return '🍺';
        
        // Panadería, masas y abarrotes
        if (name.includes('pan') || name.includes('panaderia') || name.includes('bolleria')) return '🥐';
        if (name.includes('abarrote') || name.includes('pasta') || name.includes('fideo') || name.includes('arroz') || name.includes('aceite') || name.includes('harina')) return '🍞';
        
        // Frutas y verduras
        if (name.includes('fruta') || name.includes('manzana') || name.includes('platano') || name.includes('naranja')) return '🍎';
        if (name.includes('verdura') || name.includes('vegetal') || name.includes('fresco') || name.includes('tomate') || name.includes('lechuga')) return '🥦';
        
        // Carnes, aves y pescados
        if (name.includes('carne') || name.includes('vacuno') || name.includes('parrilla') || name.includes('cerdo')) return '🥩';
        if (name.includes('pollo') || name.includes('ave') || name.includes('pavo')) return '🍗';
        if (name.includes('pescado') || name.includes('marisco') || name.includes('salmon') || name.includes('atun')) return '🐟';
        
        // Lácteos y quesos
        if (name.includes('lacteo') || name.includes('leche') || name.includes('yogurt')) return '🥛';
        if (name.includes('queso') || name.includes('mantequilla')) return '🧀';
        
        // Snacks, confites y golosinas
        if (name.includes('snack') || name.includes('papas') || name.includes('ramitas') || name.includes('doritos')) return '🍿';
        if (name.includes('dulce') || name.includes('chocolate') || name.includes('galleta') || name.includes('golosina') || name.includes('confite')) return '🍫';
        if (name.includes('helado') || name.includes('postre')) return '🍦';

        // Congelados
        if (name.includes('congelado') || name.includes('hielo')) return '🧊';
        
        // Aseo y limpieza
        if (name.includes('aseo') || name.includes('limpieza') || name.includes('detergente') || name.includes('cloro') || name.includes('jabon')) return '🧼';
        if (name.includes('higiene') || name.includes('shampoo') || name.includes('cuidado')) return '🧴';
        
        // Mascotas / Animal
        if (name.includes('mascota') || name.includes('animal') || name.includes('perro') || name.includes('gato')) return '🐾';
        
        // Otros rubros comunes
        if (name.includes('cigarro') || name.includes('tabaco')) return '🚬';
        if (name.includes('farmacia') || name.includes('salud') || name.includes('medicamento')) return '💊';
        if (name.includes('ferreteria') || name.includes('herramienta')) return '🔨';
        if (name.includes('oficina') || name.includes('libreria') || name.includes('papel')) return '📚';
        if (name.includes('bazar') || name.includes('juguete')) return '🧸';
        if (name.includes('venta') || name.includes('mas vendido') || name.includes('top') || name.includes('favorito')) return '⭐';

        return '📦';
    },

    async filterByCategory(cat) {
        this.selectedCategory = cat;
        this.stockFilter = 'all';
        this.currentPage = 1;
        await this.applyFilters();
    },

    async filterByCategoryWithStock(cat, stockStatus) {
        this.selectedCategory = cat;
        this.stockFilter = stockStatus;
        this.currentPage = 1;
        await this.applyFilters();
    },

    async clearCategoryFilter() {
        this.selectedCategory = null;
        this.stockFilter = 'all';
        this.currentPage = 1;
        await this.refresh();
    },

    async setStockFilter(f) {
        this.stockFilter = f;
        this.currentPage = 1;
        await this.refresh();
    },

    async changePage(delta) {
        this.currentPage += delta;
        if (this.currentPage < 1) this.currentPage = 1;
        const searchInput = document.getElementById('searchProducts');
        const term = searchInput ? searchInput.value.trim() : '';
        await this.applyFilters(term);
        // Desplazarse hacia arriba suavemente
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    async quickAdjustStock(productId, delta) {
        try {
            const product = await Product.getById(productId);
            if (!product) return;
            const currentStock = parseFloat(product.stock) || 0;
            const step = product.type === 'weight' ? 0.5 : 1;
            const qtyChange = Math.abs(delta) * step;
            const op = delta > 0 ? 'add' : 'subtract';

            if (op === 'subtract' && currentStock < qtyChange) {
                showNotification('No puedes restar más del stock disponible', 'warning');
                return;
            }

            // Confirmación de seguridad para evitar ajustes accidentales en pantallas táctiles
            const unitLabel = product.type === 'weight' ? 'kg' : 'u.';
            const actionText = delta > 0 ? `sumar +${qtyChange} ${unitLabel}` : `restar -${qtyChange} ${unitLabel}`;
            const confirmed = await showConfirm(
                `¿Deseas ${actionText} al stock de <strong>${safeHTML(product.name)}</strong>?`,
                'Ajuste Rápido de Stock',
                'Sí, Ajustar',
                'Cancelar'
            );
            if (!confirmed) return;

            await Product.updateStock(productId, qtyChange, op);

            const newStock = op === 'add' ? currentStock + qtyChange : currentStock - qtyChange;
            const stockValEl = document.getElementById(`stock-val-${productId}`);
            if (stockValEl) {
                const minStock = parseFloat(product.minStock) || 0;
                let color = '#10b981';
                if (newStock <= 0) color = '#ef4444';
                else if (newStock <= minStock) color = '#f59e0b';
                stockValEl.style.color = color;
                stockValEl.innerHTML = `${formatStock(newStock, product.type === 'weight' ? 3 : 0)}<span style="font-size: 0.75rem; font-weight: 700; color: ${color}; opacity: 0.6;">${product.type === 'weight' ? 'kg' : 'u'}</span>`;
                if (stockValEl.parentElement && stockValEl.parentElement.parentElement) {
                    stockValEl.parentElement.parentElement.style.borderColor = color;
                }
            }

            showNotification(`Stock: ${delta > 0 ? '+' : ''}${delta * step} ${product.type === 'weight' ? 'kg' : 'u.'}`, 'success');
        } catch (error) {
            console.error('Error al ajustar stock rápido:', error);
            showNotification(error.message || 'Error al ajustar stock', 'error');
        }
    },

    renderProductsTable(products) {
        if (products.length === 0) return `
            <div style="text-align: center; padding: 5rem 2rem; background: #f9fafb; border-radius: 1.25rem; border: 2px dashed #d1d5db;">
                <div style="font-size: 4rem; opacity: 0.4; margin-bottom: 1rem;">📦</div>
                <h3 style="color: #6b7280;">No hay productos en esta categoría</h3>
                <p style="color: #9ca3af; font-size: 0.9rem;">Prueba buscando otro nombre o cambia de categoría</p>
            </div>
        `;

        const totalItems = products.length;
        const totalPages = Math.ceil(totalItems / this.itemsPerPage) || 1;
        if (this.currentPage > totalPages) this.currentPage = totalPages;

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const paginatedProducts = products.slice(startIndex, endIndex);

        let paginationHtml = '';
        if (totalPages > 1) {
            paginationHtml = `
                <div style="display: flex; justify-content: center; align-items: center; gap: 1rem; margin-top: 2rem; padding: 1rem; background: #f8fafc; border-radius: 1rem; border: 1px solid #e2e8f0;">
                    <button class="btn btn-secondary" onclick="ProductsView.changePage(-1)" ${this.currentPage === 1 ? 'disabled style="opacity:0.5"' : ''}>⬅ Anterior</button>
                    <span style="font-weight: 700; color: #475569;">Página ${this.currentPage} de ${totalPages} <span style="font-weight: normal; font-size: 0.85rem; color: #94a3b8;">(${totalItems} productos)</span></span>
                    <button class="btn btn-secondary" onclick="ProductsView.changePage(1)" ${this.currentPage === totalPages ? 'disabled style="opacity:0.5"' : ''}>Siguiente ➡</button>
                </div>
            `;
        }

        return `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem; padding: 0.5rem 0;">
                ${paginatedProducts.map(p => {
            const sup = this.productSuppliers[p.id] || 'Proveedor Desconocido';
            const stock = parseFloat(p.stock) || 0;
            const minStock = parseFloat(p.minStock) || 0;
            const canEditStock = typeof PermissionService !== 'undefined' ? PermissionService.can('products.edit_stock') : true;

            let stockLevelColor = '#10b981'; // OK
            if (stock <= 0) stockLevelColor = '#ef4444'; // Agotado
            else if (stock <= minStock) stockLevelColor = '#f59e0b'; // Bajo

            return `
                    <div class="product-card" 
                         style="background: #ffffff; border: 1.5px solid #e5e7eb; border-radius: 1.25rem; padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; position: relative; transition: all 0.25s ease; box-shadow: 0 2px 8px rgba(0,0,0,0.04);"
                         onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 12px 28px rgba(0,0,0,0.09)'; this.style.borderColor='#9ca3af';"
                         onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.04)'; this.style.borderColor='#e5e7eb';">
                        
                        <!-- Header: Nombre e Icono -->
                        <div style="display: flex; align-items: flex-start; gap: 1rem;">
                            <div style="font-size: 2.2rem; background: #f3f4f6; width: 64px; height: 64px; border-radius: 1rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1.5px solid #e5e7eb;">
                                ${this.getCategoryIcon(p.category)}
                            </div>
                            <div style="flex: 1; overflow: hidden; padding-top: 5px;">
                                <h3 style="margin: 0; color: #111827; font-size: 1.1rem; font-weight: 800; line-height: 1.3; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${safeHTML(p.name)}</h3>
                                <div style="font-size: 0.78rem; color: #9ca3af; margin-top: 0.25rem; font-family: monospace;">${safeHTML(p.barcode || '---')}</div>
                            </div>
                        </div>

                        <!-- Body: Precio y Stock -->
                        <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 0.75rem;">
                            <!-- Precio (Clickable for quick edit) -->
                            <div ${PermissionService.can('products.edit') || PermissionService.can('products.edit_price') ? `onclick="ProductsView.showProductForm(${p.id})" style="background: #f0fdf4; border-radius: 0.75rem; padding: 0.75rem; border: 1.5px solid #bbf7d0; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.transform='scale(1.02)'; this.style.backgroundColor='#dcfce7';" onmouseout="this.style.transform='scale(1)'; this.style.backgroundColor='#f0fdf4';"` : `style="background: #f0fdf4; border-radius: 0.75rem; padding: 0.75rem; border: 1.5px solid #bbf7d0;"`}>
                                <div style="font-size: 0.68rem; color: #16a34a; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; display: flex; justify-content: space-between;">
                                    <span>Precio Venta</span>
                                    ${PermissionService.can('products.edit_price') ? '<span>✏️</span>' : ''}
                                </div>
                                <div style="font-size: 1.5rem; font-weight: 900; color: #15803d;">${formatCLP(p.price)}</div>
                            </div>
                            <!-- Stock con Ajuste Rápido (+ / -) -->
                            <div style="background: ${stock <= 0 ? '#fef2f2' : (stock <= minStock ? '#fffbeb' : '#f9fafb')}; border-radius: 0.75rem; padding: 0.5rem 0.5rem; border: 2px solid ${stockLevelColor}; text-align: center; display: flex; flex-direction: column; justify-content: space-between;">
                                <div style="font-size: 0.68rem; color: ${stock <= minStock ? stockLevelColor : '#6b7280'}; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">Disponible</div>
                                <div style="display: flex; align-items: center; justify-content: center; gap: 0.35rem; margin-top: 0.2rem;">
                                    ${canEditStock ? `<button type="button" class="btn-stock-quick" title="Restar 1 al stock" onclick="event.stopPropagation(); ProductsView.quickAdjustStock(${p.id}, -1)">−</button>` : ''}
                                    <div id="stock-val-${p.id}" style="font-size: 1.3rem; font-weight: 950; color: ${stockLevelColor}; min-width: 44px; text-align: center;">
                                        ${formatStock(p.stock, p.type === 'weight' ? 3 : 0)}<span style="font-size: 0.75rem; font-weight: 700; color: ${stockLevelColor}; opacity: 0.6;">${p.type === 'weight' ? 'kg' : 'u'}</span>
                                    </div>
                                    ${canEditStock ? `<button type="button" class="btn-stock-quick" title="Sumar 1 al stock" onclick="event.stopPropagation(); ProductsView.quickAdjustStock(${p.id}, 1)">+</button>` : ''}
                                </div>
                            </div>
                        </div>

                        <!-- Footer Info: Proveedor y Botones Compactos -->
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 0.75rem; border-top: 1px solid #f3f4f6;">
                            <div id="sup-label-${p.id}" style="display: flex; align-items: center; gap: 0.5rem; color: #6b7280; font-size: 0.82rem; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                <span>🚚</span> ${safeHTML(sup)}
                            </div>
                            <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; justify-content: flex-end;">
                                <button class="btn btn-icon" style="width: 36px; height: 36px; padding: 0; background: #eff6ff; color: #3b82f6; border: 1.5px solid #bfdbfe; border-radius: 0.65rem; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.background='#dbeafe'" onmouseout="this.style.background='#eff6ff'" onclick="ProductsView.showProductHistory(${p.id})" title="Ver Historial">
                                    📊
                                </button>
                                <button class="btn btn-icon" style="width: 36px; height: 36px; padding: 0; background: #f5f3ff; color: #7c3aed; border: 1.5px solid #ddd6fe; border-radius: 0.65rem; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.background='#ede9fe'" onmouseout="this.style.background='#f5f3ff'" onclick="ProductsView.printBarcodeLabel(${p.id})" title="Imprimir Etiqueta Góndola / Precio">
                                    🏷️
                                </button>
                                ${PermissionService.can('products.create') ? `
                                <button class="btn btn-icon" style="width: 36px; height: 36px; padding: 0; background: #f0fdfa; color: #0d9488; border: 1.5px solid #99f6e4; border-radius: 0.65rem; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.background='#ccfbf1'" onmouseout="this.style.background='#f0fdfa'" onclick="ProductsView.duplicateProduct(${p.id})" title="Duplicar Producto">
                                    🔄
                                </button>` : ''}
                                ${(PermissionService.can('products.edit') || PermissionService.can('products.edit_price')) ? `
                                <button class="btn btn-icon" style="width: 36px; height: 36px; padding: 0; background: #f0fdf4; color: #16a34a; border: 1.5px solid #bbf7d0; border-radius: 0.65rem; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.background='#dcfce7'" onmouseout="this.style.background='#f0fdf4'" onclick="ProductsView.showProductForm(${p.id})" title="Editar">
                                    ✏️
                                </button>` : ''}
                                ${PermissionService.can('products.delete') ? `
                                <button class="btn btn-icon" style="width: 36px; height: 36px; padding: 0; background: #fef2f2; color: #dc2626; border: 1.5px solid #fecaca; border-radius: 0.65rem; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='#fef2f2'" onclick="ProductsView.deleteProduct(${p.id})" title="Desactivar">
                                    🗑️
                                </button>` : ''}
                            </div>
                        </div>
                    </div>
                `}).join('')}
            </div>
            ${paginationHtml}
        `;
    },

    async getLastSuppliers() {
        try {
            const suppliers = await Supplier.getAll();
            const supplierMap = {};
            suppliers.forEach(s => supplierMap[s.id] = s.name);

            // B1: Solo revisamos las últimas 500 compras para identificar proveedores recientes
            // Esto evita descargar miles de compras innecesariamente (Mejora de rendimiento)
            const purchases = await Purchase.getLatest(500);
            
            const productLastSupplier = {};
            purchases.forEach(pur => {
                const supplierName = supplierMap[pur.supplierId] || 'Desconocido';
                const items = Array.isArray(pur.items) ? pur.items : (typeof pur.items === 'string' ? JSON.parse(pur.items) : []);
                items.forEach(item => {
                    if (item && item.productId && !productLastSupplier[item.productId]) {
                        productLastSupplier[item.productId] = supplierName;
                    }
                });
            });
            return productLastSupplier;
        } catch (e) { 
            console.error('Error in getLastSuppliers:', e);
            return {}; 
        }
    },

    updateSupplierLabels() {
        const labels = document.querySelectorAll('[id^="sup-label-"]');
        labels.forEach(label => {
            const productId = label.id.replace('sup-label-', '');
            if (this.productSuppliers[productId]) {
                label.innerHTML = `<span>🚚</span> ${safeHTML(this.productSuppliers[productId])}`;
            }
        });
    },

    async refresh() {
        // Capturar estado actual antes de refrescar
        const searchInput = document.getElementById('searchProducts');
        const lastSearch = searchInput ? searchInput.value : '';
        const lastScrollY = window.scrollY;

        const content = await this.render();
        const container = document.getElementById('view-container');
        if (container) {
            container.innerHTML = content;
            await this.init();
        }

        // Restaurar valor de búsqueda y aplicar filtros
        if (lastSearch) {
            const newSearchInput = document.getElementById('searchProducts');
            if (newSearchInput) {
                newSearchInput.value = lastSearch;
            }
            await this.applyFilters(lastSearch);
        }

        // Restaurar la posición del scroll
        window.scrollTo(0, lastScrollY);
    },

    async showProductForm(id = null, cloneData = null) {
        let product = null;
        if (id) {
            product = await Product.getById(id);
        } else if (cloneData) {
            product = cloneData;
        }
        const categories = (typeof Category !== 'undefined') ? await Category.getUniqueNames() : [];
        if (!categories.includes('General')) categories.unshift('General');

        const canViewCost = PermissionService.can('products.view_cost');
        const canEditPrice = PermissionService.can('products.edit_price');
        const canEditStock = PermissionService.can('products.edit_stock');

        const content = `
    <form id="productForm">
        <div style="display: grid; grid-template-columns: 1.1fr 1fr; gap: 1.25rem; align-items: start;">
            
            <!-- Columna Izquierda: Información Básica e Inventario -->
            <div style="display: flex; flex-direction: column; gap: 0.85rem;">
                <div class="form-group" style="margin: 0;">
                    <label style="font-weight: 700; font-size: 0.85rem; color: #1e293b;">🔍 Código de Barras (Escanee ahora)</label>
                    <input type="text" name="barcode" class="form-control" value="${product?.barcode || ''}" placeholder="Escanee o escriba el código" autofocus style="height: 40px; font-weight: 700;">
                </div>

                <div class="form-group" style="margin: 0;">
                    <label style="font-weight: 700; font-size: 0.85rem; color: #1e293b;">📝 Nombre del Producto *</label>
                    <input type="text" name="name" class="form-control" value="${product?.name || ''}" required placeholder="Ej: Coca Cola 1.5L" style="height: 40px; font-weight: 700;">
                </div>
                
                <div style="display: grid; grid-template-columns: 1.3fr 1fr; gap: 0.75rem;">
                    <div class="form-group" style="margin: 0;">
                        <label style="font-weight: 700; font-size: 0.85rem; color: #1e293b;">📁 Categoría *</label>
                        <select name="category" class="form-control" style="font-weight: 700; font-size: 0.95rem; height: 42px; padding: 0.35rem 0.65rem; line-height: 1.4; border: 2px solid #cbd5e1; border-radius: 0.5rem; background: #ffffff;" required>
                            ${categories.map(cat => `<option value="${safeHTML(cat)}" ${CategoryHelper.areEqual(product?.category || 'General', cat) ? 'selected' : ''}>${safeHTML(cat)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label style="font-weight: 700; font-size: 0.85rem; color: #1e293b;">📦 Unidad</label>
                        <select name="type" class="form-control" style="font-weight: 700; font-size: 0.95rem; height: 42px; padding: 0.35rem 0.65rem; line-height: 1.4; border: 2px solid #cbd5e1; border-radius: 0.5rem; background: #ffffff;">
                            <option value="unit" ${product?.type === 'unit' ? 'selected' : ''}>Unidad (u)</option>
                            <option value="weight" ${product?.type === 'weight' ? 'selected' : ''}>Peso (kg)</option>
                        </select>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; background: #f8fafc; padding: 0.75rem; border-radius: 0.75rem; border: 1.5px solid #e2e8f0;">
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 0.8rem; font-weight: 700; color: #475569;">📦 Stock Actual</label>
                        <input type="number" name="stock" step="any" class="form-control" value="${product?.stock || 0}" ${!canEditStock ? 'readonly style="height: 38px; font-weight: 800; background: #f1f5f9; cursor: not-allowed;" title="Modificación manual de stock restringida"' : 'style="height: 38px; font-weight: 800;"'}>
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 0.8rem; font-weight: 700; color: #475569;">⚠️ Stock Mínimo</label>
                        <input type="number" name="minStock" step="any" class="form-control" value="${product?.minStock || 0}" ${!canEditStock ? 'readonly style="height: 38px; font-weight: 800; background: #f1f5f9; cursor: not-allowed;"' : 'style="height: 38px; font-weight: 800;"'}>
                    </div>
                    ${id ? `
                    <div class="form-group" style="margin: 0; grid-column: span 2; border-top: 1px dashed #cbd5e1; padding-top: 0.5rem;">
                        <label style="font-size: 0.75rem; font-weight: 700; color: #64748b;">📋 Motivo de Ajuste de Stock (Opcional)</label>
                        <input type="text" name="stockAdjustmentReason" class="form-control" placeholder="Ej: Conteo físico, corrección, merma..." style="height: 34px; font-size: 0.82rem;" ${!canEditStock ? 'readonly disabled' : ''}>
                    </div>
                    ` : ''}
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 0.8rem; font-weight: 700; color: #64748b;">📅 Vencimiento (Opcional)</label>
                        <input type="date" name="expiryDate" class="form-control" value="${product?.expiryDate || ''}" style="height: 38px;">
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 0.8rem; font-weight: 700; color: #64748b;">📝 Notas / Descripción</label>
                        <input type="text" name="description" class="form-control" placeholder="Opcional..." value="${product?.description || ''}" style="height: 38px;">
                    </div>
                </div>
            </div>

            <!-- Columna Derecha: Estructura de Precios -->
            ${canViewCost ? `
            <div style="background: linear-gradient(135deg, rgba(79,70,229,0.06) 0%, rgba(16,185,129,0.04) 100%); padding: 1rem 1.15rem; border-radius: 1rem; border: 1.5px solid rgba(79,70,229,0.15); display: flex; flex-direction: column; gap: 0.75rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 0.75rem; font-weight: 900; color: #6366f1; text-transform: uppercase; letter-spacing: 0.08em;">💲 Estructura de Precios</span>
                    <div style="display: flex; align-items: center; gap: 0.35rem;">
                        <label style="font-size: 0.75rem; color: #64748b; font-weight: 700; margin: 0;">IVA:</label>
                        <select id="form_ivaType" name="ivaType" class="form-control" onchange="ProductsView.calcFromNeto()" style="height: 32px; font-size: 0.8rem; font-weight: 700; padding: 0 0.5rem; width: auto;">
                            <option value="19%" ${product?.ivaType === '19%' ? 'selected' : ''}>IVA 19%</option>
                            <option value="Exento" ${product?.ivaType === 'Exento' ? 'selected' : ''}>Exento</option>
                        </select>
                    </div>
                </div>

                <!-- Neto | IVA monto | Bruto -->
                <div style="display: grid; grid-template-columns: 1fr 0.9fr 1fr; gap: 0.5rem;">
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 0.72rem; color: #6b7280; font-weight: 700;">Neto (S/IVA)</label>
                        <input type="number" id="form_costNeto" name="costNeto" step="any" class="form-control"
                               value="${product?.costNeto || 0}"
                               style="height: 38px; border-color: #818cf8; background: rgba(99,102,241,0.04); font-weight: 700;"
                               oninput="ProductsView.calcFromNeto()">
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 0.72rem; color: #6b7280; font-weight: 700;">IVA</label>
                        <div style="position: relative;">
                            <input type="text" id="form_ivaMonto" readonly
                                   class="form-control"
                                   value="${(()=>{ const n=parseFloat(product?.costNeto||0); const t=product?.ivaType==='Exento'?0:0.19; return Math.round(n*t); })()}"
                                   style="height: 38px; background: rgba(0,0,0,0.06); color: #94a3b8; cursor: not-allowed; font-weight: 600; font-size: 0.85rem;">
                            <span style="position:absolute; right: 8px; top: 50%; transform: translateY(-50%); font-size: 0.65rem; color: #94a3b8; pointer-events:none;">🔒</span>
                        </div>
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 0.72rem; color: #6b7280; font-weight: 700;">Bruto (C/IVA)</label>
                        <input type="number" id="form_cost" name="cost" step="any" class="form-control"
                               value="${product?.cost || 0}"
                               style="height: 38px; font-weight: 800; border-color: #f59e0b; background: rgba(245,158,11,0.04);"
                               oninput="ProductsView.calcFromBrutoPrecio()">
                    </div>
                </div>

                <div style="border-top: 1.5px dashed rgba(99,102,241,0.2); margin: 0.1rem 0;"></div>

                <!-- % Ganancia Deseado | Precio de Venta -->
                <div style="display: grid; grid-template-columns: 0.8fr 1.2fr; gap: 0.6rem; align-items: start;">
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 0.75rem; color: #6366f1; font-weight: 800;">📈 % Margen</label>
                        <input type="number" id="form_targetMargin" step="any" class="form-control" placeholder="30"
                               value="${product?.cost > 0 && product?.price > 0 ? (Math.round(((product.price / product.cost) - 1) * 10) / 10) : ''}"
                               style="height: 42px; font-size: 1.05rem; font-weight: 800; border-color: #6366f1; background: rgba(99,102,241,0.05);"
                               oninput="ProductsView.calcFromTargetMargin()">
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 0.75rem; color: #10b981; font-weight: 800;">🏷️ Precio Venta *</label>
                        <input type="number" id="form_price" name="price" step="any" class="form-control"
                               value="${product?.price || 0}" required
                               ${!canEditPrice ? 'readonly style="height: 42px; font-size: 1.15rem; font-weight: 900; border-color: #cbd5e1; background: #f1f5f9; cursor: not-allowed;" title="Modificación de precio de venta restringida"' : 'style="height: 42px; font-size: 1.15rem; font-weight: 900; border-color: #10b981; background: rgba(16,185,129,0.05);"' }
                               oninput="ProductsView.updateMarginInfo()">
                        ${!canEditPrice ? '<span style="font-size: 0.72rem; color: #94a3b8; font-weight: 600; margin-top: 0.25rem; display: block;">🔒 Modificación de precio restringida</span>' : ''}
                    </div>
                </div>
                
                <!-- Panel de información de margen -->
                <div id="form_marginPanel" style="background: rgba(0,0,0,0.04); border-radius: 0.65rem; padding: 0.6rem 0.75rem; display: flex; flex-direction: column; gap: 0.25rem;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.75rem;">
                        <span style="color: #64748b;">Mínimo sugerido (35%):</span>
                        <span id="form_minSalePrice" style="font-weight: 700; color: #f59e0b;">$0</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.75rem;">
                        <span style="color: #64748b;">Margen actual:</span>
                        <span id="form_currentMargin" style="font-weight: 800; color: #10b981;">0%</span>
                    </div>
                    <div id="form_marginAlert" style="display: none; padding: 0.3rem 0.5rem; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 0.4rem; font-size: 0.7rem; color: #ef4444; font-weight: 700;">
                        ⚠️ No alcanza el margen mínimo sugerido (35%)
                    </div>
                </div>
                <input type="hidden" id="form_markup" name="markupPercent" value="${product?.markupPercent || 0}">
            </div>
            ` : `
            <div style="background: #f8fafc; padding: 1.25rem; border-radius: 1rem; border: 1.5px solid #e2e8f0; display: flex; flex-direction: column; gap: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 0.75rem; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em;">💲 Precio de Venta</span>
                    <span class="badge" style="background: #e2e8f0; color: #475569; font-size: 0.7rem; font-weight: 700;">🔒 Costos Protegidos</span>
                </div>

                <div style="background: #ffffff; border: 1.5px dashed #cbd5e1; border-radius: 0.75rem; padding: 1.25rem; text-align: center;">
                    <div style="font-size: 1.6rem; margin-bottom: 0.35rem;">🔒</div>
                    <strong style="color: #334155; font-size: 0.85rem; display: block;">Costos y Márgenes Reservados</strong>
                    <p style="font-size: 0.75rem; margin: 0.35rem 0 0 0; color: #94a3b8; line-height: 1.4;">
                        Tu perfil no tiene autorización para visualizar los costos de adquisición ni márgenes de utilidad del producto.
                    </p>
                </div>

                <!-- Entradas ocultas para preservar la integridad de datos al guardar -->
                <input type="hidden" id="form_costNeto" name="costNeto" value="${product?.costNeto || 0}">
                <input type="hidden" id="form_cost" name="cost" value="${product?.cost || 0}">
                <input type="hidden" id="form_ivaType" name="ivaType" value="${product?.ivaType || '19%'}">
                <input type="hidden" id="form_targetMargin" value="${product?.cost > 0 && product?.price > 0 ? (Math.round(((product.price / product.cost) - 1) * 10) / 10) : ''}">
                <input type="hidden" id="form_markup" name="markupPercent" value="${product?.markupPercent || 0}">

                <div>
                    <label style="font-size: 0.75rem; color: #10b981; font-weight: 800; display: block; margin-bottom: 0.35rem;">🏷️ Precio de Venta Público *</label>
                    <input type="number" id="form_price" name="price" step="any" class="form-control"
                           value="${product?.price || 0}" required
                           ${!canEditPrice ? 'readonly style="height: 42px; font-size: 1.15rem; font-weight: 900; border-color: #cbd5e1; background: #f1f5f9; cursor: not-allowed;" title="Modificación de precio restringida"' : 'style="height: 42px; font-size: 1.15rem; font-weight: 900; border-color: #10b981; background: rgba(16,185,129,0.05);"'}>
                    ${!canEditPrice ? '<span style="font-size: 0.72rem; color: #94a3b8; font-weight: 600; margin-top: 0.25rem; display: block;">🔒 Modificación de precio no autorizada para tu rol</span>' : ''}
                </div>
            </div>
            `}

        </div>
    </form>
    `;
        const footer = `<button class="btn btn-secondary" onclick="closeModal()" style="font-weight: 700;">Cancelar</button> <button class="btn btn-primary" onclick="ProductsView.saveProduct(${id})" style="font-weight: 800;">[F2] Guardar Producto</button>`;
        window._focusSearchAfterClose = () => ProductsView.focusSearch();
        const modalTitle = id ? 'Editar Producto' : (cloneData ? 'Duplicar Producto' : 'Nuevo Producto');
        showModal(content, { title: modalTitle, footer, width: '920px' });

        // Setup form interactions
        setTimeout(() => {
            const form = document.getElementById('productForm');
            const input = document.getElementById('productCategoryInput');
            const dropdown = document.getElementById('productCategoryDropdown');

            // ponytail: algoritmo de distancia Levenshtein para búsqueda difusa sin librerías
            function levenshtein(a, b) {
                const m = a.length, n = b.length;
                const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
                for (let i = 1; i <= m; i++)
                    for (let j = 1; j <= n; j++)
                        dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
                return dp[m][n];
            }

            // Normaliza texto: sin tildes, minúsculas, sin espacios extra
            function normalize(str) {
                return str.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            }

            // Puntaje de relevancia: 0 = coincidencia exacta, menor = más relevante
            function fuzzyScore(query, target) {
                const q = normalize(query), t = normalize(target);
                if (t === q) return -2;               // coincidencia exacta
                if (t.startsWith(q)) return -1;       // empieza igual
                if (t.includes(q)) return 0;          // contiene el texto
                return levenshtein(q, t);              // distancia de edición
            }

            let selectedIndex = -1;

            function getVisibleOptions() {
                return Array.from(dropdown.querySelectorAll('.product-category-option'))
                    .filter(o => o.style.display !== 'none');
            }

            function highlightOption(opts, idx) {
                opts.forEach((o, i) => {
                    o.classList.toggle('category-option-active', i === idx);
                });
            }

            function closeCategoryDropdown() {
                dropdown.style.display = 'none';
                selectedIndex = -1;
                getVisibleOptions().forEach(o => o.classList.remove('category-option-active'));
            }

            if (input && dropdown) {
                // Filtrado difuso al escribir
                input.addEventListener('input', () => {
                    selectedIndex = -1;
                    const val = input.value;
                    if (!val.trim()) {
                        closeCategoryDropdown();
                        return;
                    }
                    const allOptions = Array.from(dropdown.querySelectorAll('.product-category-option'));
                    // Calcular puntaje para cada opción
                    const scored = allOptions.map(opt => ({
                        opt,
                        score: fuzzyScore(val, opt.textContent)
                    }));
                    // Mostrar solo las que tienen puntaje razonable (distancia <= 3 o contienen el texto)
                    let visible = 0;
                    scored.forEach(({ opt, score }) => {
                        const show = score <= 3;
                        opt.style.display = show ? 'block' : 'none';
                        opt.classList.remove('category-option-active');
                        if (show) visible++;
                    });
                    // Reordenar visualmente por relevancia
                    scored
                        .filter(s => s.score <= 3)
                        .sort((a, b) => a.score - b.score)
                        .forEach(({ opt }) => dropdown.appendChild(opt));
                    dropdown.style.display = visible > 0 ? 'block' : 'none';
                });

                // Navegación con flechas y selección con Enter desde el input
                input.addEventListener('keydown', (e) => {
                    const opts = getVisibleOptions();
                    if (dropdown.style.display !== 'block' || opts.length === 0) return;

                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        e.stopPropagation();
                        selectedIndex = Math.min(selectedIndex + 1, opts.length - 1);
                        highlightOption(opts, selectedIndex);
                        opts[selectedIndex]?.scrollIntoView({ block: 'nearest' });
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        e.stopPropagation();
                        selectedIndex = Math.max(selectedIndex - 1, 0);
                        highlightOption(opts, selectedIndex);
                        opts[selectedIndex]?.scrollIntoView({ block: 'nearest' });
                    } else if (e.key === 'Enter' && selectedIndex >= 0) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        opts[selectedIndex].click();
                    } else if (e.key === 'Escape') {
                        closeCategoryDropdown();
                    }
                }, true);

                // Cerrar al hacer clic fuera
                document.addEventListener('mousedown', (e) => {
                    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                        closeCategoryDropdown();
                    }
                }, { once: false });
            }

            if (form) {
                // Prevenir que el 'Enter' guarde el formulario (común con escáneres)
                form.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        // Si hay categoría activa seleccionada, ya fue manejado por el listener del input
                        if (document.activeElement === input && selectedIndex >= 0 && dropdown.style.display === 'block') return;

                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();

                        const inputs = Array.from(form.querySelectorAll('input, select, textarea'));
                        const index = inputs.indexOf(e.target);
                        if (index > -1 && index < inputs.length - 1) {
                            inputs[index + 1].focus();
                            if (inputs[index + 1].id === 'productCategoryInput') inputs[index + 1].select();
                        }
                    }
                }, true);
            }

            // Inicializar panel de margen con valores actuales del producto
            ProductsView.updateMarginInfo();
        }, 100);
    },

    selectCategoryOption(val) {
        const input = document.getElementById('productCategoryInput');
        if (input) {
            input.value = (typeof CategoryHelper !== 'undefined') ? CategoryHelper.sanitize(val) : val.trim();
        }
        const dropdown = document.getElementById('productCategoryDropdown');
        if (dropdown) {
            dropdown.style.display = 'none';
            dropdown.querySelectorAll('.product-category-option').forEach(o => o.classList.remove('category-option-active'));
        }
    },

    toggleCategoryDropdown() {
        const dropdown = document.getElementById('productCategoryDropdown');
        const input = document.getElementById('productCategoryInput');
        if (!dropdown) return;
        const isVisible = dropdown.style.display === 'block';
        if (isVisible) {
            dropdown.style.display = 'none';
        } else {
            dropdown.querySelectorAll('.product-category-option').forEach(o => o.style.display = 'block');
            dropdown.style.display = 'block';
            if (input) input.focus();
        }
    },

    async saveProduct(id) {
        if (this._isSavingProduct) return;
        const form = document.getElementById('productForm');
        if (!form.reportValidity()) return;
        this._isSavingProduct = true;

        const submitBtn = document.querySelector('button[onclick*="saveProduct"]') || document.querySelector('.modal-footer button.btn-primary');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Guardando...';
        }

        const data = Object.fromEntries(new FormData(form));

        // Normalizar categoría a Title Case usando CategoryHelper
        data.category = (typeof CategoryHelper !== 'undefined') ? CategoryHelper.sanitize(data.category) : (data.category ? data.category.trim() : 'General');

        if (id) data.id = id;
        try {
            await ProductController.saveProduct(data);
            closeModal();
            showNotification('Producto guardado exitosamente', 'success');
            await this.refresh();
        } catch (e) {
            showNotification(e.message, 'error');
        } finally {
            this._isSavingProduct = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = id ? 'Actualizar' : 'Crear';
            }
        }
    },

    async duplicateProduct(id) {
        try {
            const prod = await Product.getById(id);
            if (!prod) return;
            const clone = {
                ...prod,
                id: null,
                barcode: '',
                name: `${prod.name} (Copia)`,
                stock: 0
            };
            await this.showProductForm(null, clone);
        } catch (e) {
            console.error('Error al duplicar producto:', e);
            showNotification('Error al duplicar el producto', 'error');
        }
    },

    async printBarcodeLabel(id) {
        try {
            const product = await Product.getById(id);
            if (!product) return;

            const bizName = localStorage.getItem('BUSINESS_NAME') || 'Mi Negocio';
            const barcodeVal = (product.barcode || String(product.id || '')).trim();

            // ponytail: generador SVG nativo Code39 para etiquetas sin dependencias externas
            const CODE39 = {
                '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
                '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
                '8': '100100100', '9': '001100100', 'A': '100001001', 'B': '001001001',
                'C': '101001000', 'D': '000011001', 'E': '100011000', 'F': '001011000',
                'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
                'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011',
                'O': '100010010', 'P': '001010010', 'Q': '000000111', 'R': '100000110',
                'S': '001000110', 'T': '000010110', 'U': '110000001', 'V': '011000001',
                'W': '111000000', 'X': '010010001', 'Y': '110010000', 'Z': '011010000',
                '-': '010000101', '.': '110000100', ' ': '011000100', '$': '010101000',
                '/': '010100010', '+': '010001010', '%': '000101010', '*': '010010100'
            };

            const buildSvg = (text, height = 46) => {
                const clean = String(text || '').toUpperCase().replace(/[^0-9A-Z\-\.\ \$\/\+\%]/g, '') || '00000';
                const str = '*' + clean + '*';
                let x = 6;
                const narrow = 2;
                const wide = 5;
                const rects = [];
                for (let i = 0; i < str.length; i++) {
                    const pat = CODE39[str[i]] || CODE39['0'];
                    for (let b = 0; b < 9; b++) {
                        const isBar = (b % 2 === 0);
                        const w = pat[b] === '1' ? wide : narrow;
                        if (isBar) rects.push(`<rect x="${x}" y="0" width="${w}" height="${height}" fill="#000000"/>`);
                        x += w;
                    }
                    x += narrow;
                }
                const totalWidth = x + 6;
                return `<svg viewBox="0 0 ${totalWidth} ${height}" xmlns="http://www.w3.org/2000/svg" style="max-width: 100%; height: ${height}px; display: block; margin: 0 auto;">${rects.join('')}</svg>`;
            };

            const barcodeSvg = buildSvg(barcodeVal);

            const content = `
                <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                    <!-- Vista previa etiqueta góndola -->
                    <div style="background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 1rem; padding: 1.25rem; display: flex; justify-content: center;">
                        <div id="shelfTagPreview" style="background: #ffffff; border: 2px solid #0f172a; border-radius: 0.75rem; width: 280px; padding: 0.9rem; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.06); font-family: system-ui, sans-serif;">
                            <div style="font-size: 0.72rem; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 0.25rem;">
                                ${safeHTML(bizName)}
                            </div>
                            <div style="font-size: 1.05rem; font-weight: 900; color: #0f172a; line-height: 1.2; margin-bottom: 0.5rem; min-height: 2.4em; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                                ${safeHTML(product.name)}
                            </div>
                            <div style="background: #f1f5f9; border-radius: 0.5rem; padding: 0.4rem; margin-bottom: 0.6rem;">
                                <span style="font-size: 0.72rem; color: #475569; font-weight: 700; display: block;">PRECIO VENTA</span>
                                <strong style="font-size: 1.85rem; font-weight: 950; color: #0f172a;">${formatCLP(product.price)}</strong>
                            </div>
                            <div style="margin-top: 0.4rem;">
                                ${barcodeSvg}
                                <span style="font-size: 0.75rem; font-family: monospace; font-weight: 800; color: #334155; letter-spacing: 0.1em; display: block; margin-top: 0.25rem;">${safeHTML(barcodeVal)}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Controles de impresión -->
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 0.75rem; padding: 0.85rem 1rem;">
                        <label style="font-weight: 800; font-size: 0.9rem; color: #1e293b; margin: 0; display: flex; align-items: center; gap: 0.5rem;">
                            <span>🏷️ Copias a imprimir:</span>
                        </label>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <input type="number" id="labelCopiesCount" value="1" min="1" max="50" style="width: 70px; height: 38px; text-align: center; font-weight: 900; font-size: 1.1rem; border: 2px solid #cbd5e1; border-radius: 0.5rem;">
                        </div>
                    </div>
                </div>
            `;

            const footer = `
                <button class="btn btn-secondary" onclick="closeModal()" style="font-weight: 700;">Cerrar</button>
                <button class="btn btn-primary" onclick="ProductsView.executePrintLabel(${product.id})" style="font-weight: 900; background: #7c3aed; border-color: #6d28d9; display: flex; align-items: center; gap: 0.4rem;">
                    <span>🖨️</span> <span>Imprimir Etiqueta</span>
                </button>
            `;

            showModal(content, { title: '🏷️ Etiqueta de Precio y Góndola', footer, width: '480px' });
        } catch (e) {
            console.error('Error al generar etiqueta:', e);
            showNotification('Error al preparar etiqueta para impresión', 'error');
        }
    },

    async executePrintLabel(id) {
        try {
            const product = await Product.getById(id);
            if (!product) return;

            const copiesInput = document.getElementById('labelCopiesCount');
            const copies = Math.min(Math.max(parseInt(copiesInput?.value || 1, 10), 1), 50);

            const bizName = localStorage.getItem('BUSINESS_NAME') || 'Mi Negocio';
            const barcodeVal = (product.barcode || String(product.id || '')).trim();

            const CODE39 = {
                '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
                '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
                '8': '100100100', '9': '001100100', 'A': '100001001', 'B': '001001001',
                'C': '101001000', 'D': '000011001', 'E': '100011000', 'F': '001011000',
                'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
                'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011',
                'O': '100010010', 'P': '001010010', 'Q': '000000111', 'R': '100000110',
                'S': '001000110', 'T': '000010110', 'U': '110000001', 'V': '011000001',
                'W': '111000000', 'X': '010010001', 'Y': '110010000', 'Z': '011010000',
                '-': '010000101', '.': '110000100', ' ': '011000100', '$': '010101000',
                '/': '010100010', '+': '010001010', '%': '000101010', '*': '010010100'
            };

            const clean = barcodeVal.toUpperCase().replace(/[^0-9A-Z\-\.\ \$\/\+\%]/g, '') || '00000';
            const str = '*' + clean + '*';
            let x = 6;
            const narrow = 2;
            const wide = 5;
            const rects = [];
            for (let i = 0; i < str.length; i++) {
                const pat = CODE39[str[i]] || CODE39['0'];
                for (let b = 0; b < 9; b++) {
                    const isBar = (b % 2 === 0);
                    const w = pat[b] === '1' ? wide : narrow;
                    if (isBar) rects.push(`<rect x="${x}" y="0" width="${w}" height="42" fill="#000000"/>`);
                    x += w;
                }
                x += narrow;
            }
            const totalWidth = x + 6;
            const svgStr = `<svg viewBox="0 0 ${totalWidth} 42" xmlns="http://www.w3.org/2000/svg" style="width: 180px; height: 38px; display: block; margin: 0 auto;">${rects.join('')}</svg>`;

            const singleLabelHtml = `
                <div class="label-item">
                    <div class="label-header">${safeHTML(bizName)}</div>
                    <div class="label-title">${safeHTML(product.name)}</div>
                    <div class="label-price-box">
                        <span class="label-price-sub">PRECIO VENTA</span>
                        <div class="label-price">${formatCLP(product.price)}</div>
                    </div>
                    <div class="label-barcode">
                        ${svgStr}
                        <div class="label-code">${safeHTML(barcodeVal)}</div>
                    </div>
                </div>
            `;

            let labelsHtml = '';
            for (let i = 0; i < copies; i++) {
                labelsHtml += singleLabelHtml;
            }

            const printWindow = window.open('', '_blank', 'width=650,height=600');
            if (!printWindow) {
                showNotification('Por favor permite ventanas emergentes para imprimir la etiqueta', 'warning');
                return;
            }

            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>Etiquetas - ${safeHTML(product.name)}</title>
                    <style>
                        @page {
                            size: auto;
                            margin: 4mm;
                        }
                        body {
                            font-family: Arial, sans-serif;
                            margin: 0;
                            padding: 8px;
                            background: #ffffff;
                            color: #000000;
                            display: flex;
                            flex-wrap: wrap;
                            gap: 10px;
                        }
                        .label-item {
                            width: 58mm;
                            border: 1.5px solid #000000;
                            border-radius: 6px;
                            padding: 6px 8px;
                            box-sizing: border-box;
                            text-align: center;
                            page-break-inside: avoid;
                        }
                        .label-header {
                            font-size: 9px;
                            font-weight: bold;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                            color: #444444;
                            margin-bottom: 2px;
                        }
                        .label-title {
                            font-size: 13px;
                            font-weight: 900;
                            line-height: 1.15;
                            max-height: 2.4em;
                            overflow: hidden;
                            margin-bottom: 4px;
                        }
                        .label-price-box {
                            border: 1.5px solid #000000;
                            border-radius: 4px;
                            padding: 3px 0;
                            margin-bottom: 4px;
                            background: #f7f7f7;
                        }
                        .label-price-sub {
                            font-size: 8px;
                            font-weight: bold;
                            display: block;
                            letter-spacing: 0.5px;
                        }
                        .label-price {
                            font-size: 20px;
                            font-weight: 900;
                            line-height: 1;
                        }
                        .label-barcode {
                            margin-top: 3px;
                        }
                        .label-code {
                            font-family: monospace;
                            font-size: 10px;
                            font-weight: bold;
                            letter-spacing: 1px;
                            margin-top: 2px;
                        }
                    </style>
                </head>
                <body>
                    ${labelsHtml}
                    <script>
                        window.onload = function() {
                            window.print();
                            setTimeout(function() { window.close(); }, 500);
                        };
                    </script>
                </body>
                </html>
            `);
            printWindow.document.close();
            closeModal();
            showNotification(`Imprimiendo ${copies} etiqueta(s)...`, 'success');
        } catch (e) {
            console.error('Error al imprimir etiquetas:', e);
            showNotification('Error al abrir impresión de etiquetas', 'error');
        }
    },

    async deleteProduct(id) {
        showConfirm('¿Desactivar este producto? No se borrará de la base de datos pero no aparecerá en ventas. Podrás restaurarlo desde el botón "Desactivados".', async () => {
            try {
                await ProductController.deleteProduct(id);
                showNotification('Producto desactivado', 'success');
                await this.refresh();
            } catch (e) { showNotification(e.message, 'error'); }
        });
    },

    async showDeletedProducts() {
        let deleted = [];
        try {
            if (typeof Product !== 'undefined' && typeof Product.getDeleted === 'function') {
                deleted = await Product.getDeleted();
            }
        } catch (_) {}

        if (!deleted || deleted.length === 0) {
            const all = await Product.getAllIncludingDeleted();
            deleted = (all || []).filter(p => p.isActive === false || p.isActive === 0 || p.deleted || p.deletedAt);
        }

        if (deleted.length === 0) {
            window._focusSearchAfterClose = () => ProductsView.focusSearch();
            showModal(
                '<div class="empty-state"><div class="empty-state-icon">✅</div>No hay productos desactivados</div>',
                { title: 'Productos Desactivados', footer: '<button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>', width: '600px' }
            );
            return;
        }

        const content = `
            <p style="margin-bottom: 1rem; color: #94a3b8; font-size: 0.9rem;">
                Estos productos están desactivados. No aparecen en ventas ni en búsquedas de mostrador, pero sus registros históricos se mantienen intactos.
            </p>
            <div class="table-container" style="max-height: 450px; overflow-y: auto; border-radius: 0.5rem; border: 1px solid rgba(255,255,255,0.08);">
                <table class="table">
                    <thead style="background: rgba(0,0,0,0.3); position: sticky; top: 0; z-index: 1;">
                        <tr>
                            <th style="text-align: left; padding: 0.75rem 1rem;">Producto</th>
                            <th style="text-align: left; padding: 0.75rem 1rem;">Categoría</th>
                            <th style="text-align: right; padding: 0.75rem 1rem;">Costo</th>
                            <th style="text-align: center; padding: 0.75rem 1rem;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${deleted.map(p => `
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); opacity: 0.9;">
                                <td style="padding: 0.75rem 1rem;">
                                    <div style="font-weight: 700; color: #fff;">${safeHTML(p.name)}</div>
                                    <small style="color: #64748b; font-family: monospace;">${safeHTML(p.barcode || 'Sin código')}</small>
                                </td>
                                <td style="padding: 0.75rem 1rem; color: #94a3b8;">${safeHTML(p.category || 'General')}</td>
                                <td style="padding: 0.75rem 1rem; text-align: right; color: #fff; font-weight: 700;">${formatCLP(p.cost || 0)}</td>
                                <td style="padding: 0.75rem 1rem; text-align: center;">
                                    <button class="btn btn-sm btn-success" onclick="ProductsView.restoreProduct(${p.id})" style="font-weight: 800; border-radius: 0.4rem; padding: 0.35rem 0.75rem;">
                                        ↩️ Restaurar
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        window._focusSearchAfterClose = () => ProductsView.focusSearch();
        showModal(content, {
            title: `📋 Productos Desactivados (${deleted.length})`,
            footer: '<button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>',
            width: '650px'
        });
    },

    async restoreProduct(id) {
        try {
            await ProductController.restoreProduct(id);
            closeModal();
            await this.refresh();
            await this.showDeletedProducts();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    },

    // ===== CÁLCULOS DE PRECIOS =====

    // Calcula el monto IVA y actualiza el campo readonly
    _updateIvaMonto(neto, ivaType) {
        const tasa = ivaType === '19%' ? 0.19 : 0.0;
        const ivaMonto = Math.round(neto * tasa);
        const el = document.getElementById('form_ivaMonto');
        if (el) el.value = ivaMonto;
        return ivaMonto;
    },

    // Disparado al cambiar Precio Neto → recalcula IVA monto y Bruto
    calcFromNeto() {
        const neto = parseFloat(document.getElementById('form_costNeto').value) || 0;
        const ivaType = document.getElementById('form_ivaType').value;
        const tasa = ivaType === '19%' ? 0.19 : 0.0;
        const ivaMonto = this._updateIvaMonto(neto, ivaType);
        const bruto = Math.round(neto + ivaMonto);
        document.getElementById('form_cost').value = bruto;
        // Actualizar markup oculto y panel de margen (precio venta no se toca)
        this._syncMarkup();
        this.updateMarginInfo();
    },

    // Disparado al cambiar Precio Bruto → recalcula IVA monto y Neto
    calcFromBrutoPrecio() {
        const bruto = parseFloat(document.getElementById('form_cost').value) || 0;
        const ivaType = document.getElementById('form_ivaType').value;
        const tasa = ivaType === '19%' ? 0.19 : 0.0;
        // Neto = Bruto / (1 + tasa)
        const neto = tasa > 0 ? Math.round(bruto / (1 + tasa)) : bruto;
        const ivaMonto = Math.round(bruto - neto);
        document.getElementById('form_costNeto').value = neto;
        const el = document.getElementById('form_ivaMonto');
        if (el) el.value = ivaMonto;
        // Actualizar markup oculto y panel de margen
        this._syncMarkup();
        this.updateMarginInfo();
    },

    // Método legacy para compatibilidad (no se usa en nuevo flujo pero se mantiene)
    calcFromMarkup() {
        const cost = parseFloat(document.getElementById('form_cost').value) || 0;
        const markup = parseFloat(document.getElementById('form_markup').value) || 0;
        if (markup > 0) {
            const price = Math.round(cost * (1 + (markup / 100)));
            document.getElementById('form_price').value = price;
        }
        this.updateMarginInfo();
    },

    // Método legacy para compatibilidad
    calcFromBruto() {
        this._syncMarkup();
        this.updateMarginInfo();
    },

    // Sincroniza el campo oculto markupPercent
    _syncMarkup() {
        const price = parseFloat(document.getElementById('form_price').value) || 0;
        const cost = parseFloat(document.getElementById('form_cost').value) || 0;
        const markupEl = document.getElementById('form_markup');
        if (markupEl && cost > 0) {
            markupEl.value = Math.round(((price / cost) - 1) * 10000) / 100;
        }
    },

    calcFromTargetMargin() {
        const cost = parseFloat(document.getElementById('form_cost').value) || 0;
        const targetMargin = parseFloat(document.getElementById('form_targetMargin').value) || 0;
        if (cost > 0 && targetMargin > 0) {
            // LEY 20.956 / Estándar Chile: Redondear a la decena
            const rawPrice = cost * (1 + (targetMargin / 100));
            const suggestedPrice = Math.round(rawPrice / 10) * 10;
            const priceInput = document.getElementById('form_price');
            if (priceInput) priceInput.value = suggestedPrice;
        }
        this.updateMarginInfo();
    },

    // Actualiza el panel de información de margen en tiempo real
    updateMarginInfo() {
        const price = parseFloat(document.getElementById('form_price')?.value) || 0;
        const bruto = parseFloat(document.getElementById('form_cost')?.value) || 0;

        // Precio mínimo para alcanzar 35% de margen sobre el bruto
        const minSale = Math.round(bruto * 1.35);
        const currentMarginPct = bruto > 0 ? Math.round(((price / bruto) - 1) * 10000) / 100 : 0;

        const targetMarginInput = document.getElementById('form_targetMargin');
        // Si el usuario cambia manualmente el precio de venta, actualizamos el % de margen visualmente
        if (targetMarginInput && document.activeElement !== targetMarginInput && bruto > 0 && price > 0) {
            targetMarginInput.value = currentMarginPct.toFixed(1);
        }

        const minEl = document.getElementById('form_minSalePrice');
        const marginEl = document.getElementById('form_currentMargin');
        const alertEl = document.getElementById('form_marginAlert');

        if (minEl) minEl.textContent = formatCLP(minSale);

        if (marginEl) {
            marginEl.textContent = currentMarginPct.toFixed(1) + '%';
            if (bruto > 0 && price > 0) {
                if (currentMarginPct >= 35) {
                    marginEl.style.color = '#10b981'; // verde - ok
                } else if (currentMarginPct >= 20) {
                    marginEl.style.color = '#f59e0b'; // naranja - bajo
                } else {
                    marginEl.style.color = '#ef4444'; // rojo - crítico
                }
            } else {
                marginEl.style.color = '#94a3b8';
            }
        }

        if (alertEl) {
            const showAlert = bruto > 0 && price > 0 && price < minSale;
            alertEl.style.display = showAlert ? 'block' : 'none';
        }

        // Sincronizar markup oculto
        this._syncMarkup();
    },

    async restoreProduct(id) {
        try {
            await ProductController.restoreProduct(id);
            closeModal();
            showNotification('Producto restaurado correctamente', 'success');
            await this.refresh();
        } catch (e) {
            showNotification(e.message, 'error');
        }
    },

    async showProductHistory(id) {
        const product = await Product.getById(id);
        const movements = await StockMovement.getByProduct(id);
        const sorted = movements.sort((a, b) => new Date(b.date) - new Date(a.date));
        const unit = product.type === 'weight' ? 'kg' : 'un';

        // ponytail: calcular saldo resultante fila por fila desde el stock actual hacia atrás
        let runningStock = parseFloat(product.stock) || 0;
        const movementsWithBalance = sorted.map(m => {
            const balanceAfter = runningStock;
            const qty = parseFloat(m.quantity) || 0;
            runningStock -= qty;
            return { ...m, qty, balanceAfter };
        });

        const getBadge = (type) => {
            switch(type) {
                case 'sale':
                    return '<span class="badge" style="background: rgba(239, 68, 68, 0.1); color: #dc2626; border: 1px solid rgba(239, 68, 68, 0.2); font-weight: 800; padding: 0.2rem 0.55rem; border-radius: 99px;">🛒 Venta</span>';
                case 'purchase':
                    return '<span class="badge" style="background: rgba(16, 185, 129, 0.1); color: #047857; border: 1px solid rgba(16, 185, 129, 0.2); font-weight: 800; padding: 0.2rem 0.55rem; border-radius: 99px;">📥 Compra</span>';
                case 'consumption':
                    return '<span class="badge" style="background: rgba(245, 158, 11, 0.1); color: #b45309; border: 1px solid rgba(245, 158, 11, 0.2); font-weight: 800; padding: 0.2rem 0.55rem; border-radius: 99px;">🥣 Merma/Consumo</span>';
                case 'adjustment':
                    return '<span class="badge" style="background: rgba(59, 130, 246, 0.1); color: #2563eb; border: 1px solid rgba(59, 130, 246, 0.2); font-weight: 800; padding: 0.2rem 0.55rem; border-radius: 99px;">⚙️ Ajuste</span>';
                default:
                    return `<span class="badge badge-secondary" style="padding: 0.2rem 0.55rem; border-radius: 99px;">${type}</span>`;
            }
        };

        const content = `
            <div style="background: var(--surface); border: 1.5px solid var(--border); border-radius: 0.85rem; padding: 0.85rem 1.15rem; margin-bottom: 0.85rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
                <div>
                    <h3 style="margin: 0; font-size: 1.15rem; font-weight: 900; color: var(--text);">${safeHTML(product.name)}</h3>
                    <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.2rem;">
                        Código: <strong>${product.barcode || 'Sin código'}</strong> · Categoría: <strong>${product.category || 'General'}</strong>
                    </div>
                </div>
                <div style="background: #ecfdf5; border: 1.5px solid #a7f3d0; border-radius: 0.65rem; padding: 0.5rem 0.95rem; text-align: right; flex-shrink: 0;">
                    <div style="font-size: 0.65rem; font-weight: 800; color: #047857; text-transform: uppercase;">Stock Actual</div>
                    <div style="font-size: 1.25rem; font-weight: 950; color: #047857; line-height: 1.1;">${formatStock(product.stock)} ${unit}</div>
                </div>
            </div>

            <div class="table-container" style="max-height: 320px; overflow-y: auto; border: 1.5px solid var(--border); border-radius: 0.65rem;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead style="position: sticky; top: 0; background: var(--surface); z-index: 2;">
                        <tr>
                            <th style="padding: 0.6rem 0.75rem; font-size: 0.75rem;">Fecha y Hora</th>
                            <th style="padding: 0.6rem 0.75rem; font-size: 0.75rem;">Tipo</th>
                            <th style="padding: 0.6rem 0.75rem; font-size: 0.75rem; text-align: right;">Variación</th>
                            <th style="padding: 0.6rem 0.75rem; font-size: 0.75rem; text-align: right;">Stock Resultante</th>
                            <th style="padding: 0.6rem 0.75rem; font-size: 0.75rem;">Motivo / Detalle</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${movementsWithBalance.length === 0 ? '<tr><td colspan="5" style="text-align:center; padding: 1.5rem; color: var(--text-muted);">No hay movimientos registrados</td></tr>' : movementsWithBalance.map(m => `
                            <tr style="border-bottom: 1px solid var(--border);">
                                <td style="padding: 0.55rem 0.75rem; font-size: 0.8rem; white-space: nowrap;">${formatDateTime(m.date)}</td>
                                <td style="padding: 0.55rem 0.75rem;">${getBadge(m.type)}</td>
                                <td style="padding: 0.55rem 0.75rem; text-align: right; font-weight: 800; font-size: 0.88rem; color: ${m.qty > 0 ? 'var(--success, #059669)' : 'var(--danger, #dc2626)'};">
                                    ${m.qty > 0 ? '+' : ''}${formatStock(m.qty)} ${unit}
                                </td>
                                <td style="padding: 0.55rem 0.75rem; text-align: right; font-weight: 900; font-size: 0.9rem; color: var(--text);">
                                    ${formatStock(m.balanceAfter)} ${unit}
                                </td>
                                <td style="padding: 0.55rem 0.75rem; font-size: 0.8rem; color: var(--text-muted);">${safeHTML(m.reason || '-')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        window._focusSearchAfterClose = () => ProductsView.focusSearch();
        showModal(content, { title: 'Historial de Movimientos de Stock', footer: '<button class="btn btn-primary" onclick="closeModal()">Cerrar</button>', width: '760px' });
    },

    async showCategoryManagerModal() {
        const categories = (typeof Category !== 'undefined') ? await Category.getAll() : [];
        const products = await Product.getAll();

        const countMap = {};
        products.forEach(p => {
            const cat = (typeof CategoryHelper !== 'undefined') ? CategoryHelper.sanitize(p.category || 'General') : (p.category || 'General').trim();
            countMap[cat] = (countMap[cat] || 0) + 1;
        });

        // Asegurar que las categorías provienen de la lista oficial de categories
        const catNamesSet = new Set(categories.map(c => c.name));
        Object.keys(countMap).forEach(cName => catNamesSet.add(cName));
        const uniqueCatNames = Array.from(catNamesSet).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

        const content = `
            <div style="font-family: 'Inter', sans-serif;">
                <div style="display: flex; gap: 0.5rem; border-bottom: 2px solid #e2e8f0; margin-bottom: 1.25rem; padding-bottom: 0.75rem;">
                    <button id="catTabList" class="btn btn-sm btn-primary" style="font-weight: 800; border-radius: 8px; padding: 0.45rem 1rem;" onclick="ProductsView.switchCatTab('list')">📋 Lista de Categorías (${uniqueCatNames.length})</button>
                    <button id="catTabNew" class="btn btn-sm btn-secondary" style="font-weight: 800; border-radius: 8px; padding: 0.45rem 1rem;" onclick="ProductsView.switchCatTab('new')">➕ Crear Nueva Categoría</button>
                </div>

                <div id="catSectionList">
                    <div style="max-height: 420px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.65rem; padding: 0.25rem;">
                        ${uniqueCatNames.map(name => {
                            const count = countMap[name] || 0;
                            const catObj = categories.find(c => (typeof CategoryHelper !== 'undefined') ? CategoryHelper.areEqual(c.name, name) : c.name === name);
                            const catId = catObj ? catObj.id : '';
                            const catColor = catObj?.color || '#2563eb';
                            const isGeneral = (typeof CategoryHelper !== 'undefined') ? CategoryHelper.areEqual(name, 'General') : name.toLowerCase() === 'general';
                            const icon = ProductsView.getCategoryIcon(name);

                            return `
                                <div class="category-manager-item" 
                                     style="background: #ffffff; border: 1.5px solid #e2e8f0; border-left: 6px solid ${catColor}; border-radius: 14px; padding: 0.85rem 1rem; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; box-shadow: 0 2px 6px rgba(0,0,0,0.03); transition: all 0.2s;"
                                     onmouseover="this.style.boxShadow='0 4px 14px rgba(0,0,0,0.08), -2px 0 8px ${catColor}40'; this.style.borderColor='#cbd5e1'; this.style.borderLeftColor='${catColor}';"
                                     onmouseout="this.style.boxShadow='0 2px 6px rgba(0,0,0,0.03)'; this.style.borderColor='#e2e8f0'; this.style.borderLeftColor='${catColor}';">
                                    <div style="display: flex; align-items: center; gap: 0.85rem; min-width: 0; flex: 1;">
                                        <span style="font-size: 1.6rem; line-height: 1;">${icon}</span>
                                        <div style="min-width: 0;">
                                            <div style="font-weight: 800; font-size: 0.98rem; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                                ${safeHTML(name)}
                                            </div>
                                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem;">
                                                <span style="font-size: 0.75rem; font-weight: 800; padding: 0.15rem 0.6rem; border-radius: 20px; background: ${count > 0 ? catColor + '18' : '#f1f5f9'}; color: ${count > 0 ? catColor : '#64748b'}; border: 1px solid ${count > 0 ? catColor + '35' : '#e2e8f0'};">
                                                    ${count} ${count === 1 ? 'producto' : 'productos'}
                                                </span>
                                                <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${catColor};" title="Color de categoría: ${catColor}"></span>
                                            </div>
                                        </div>
                                    </div>
                                    <div style="display: flex; gap: 0.4rem; align-items: center; flex-shrink: 0;">
                                        ${!isGeneral ? `
                                            <button type="button" class="btn btn-sm" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; background: #f8fafc; color: #1e293b; border: 1.5px solid #cbd5e1; font-weight: 800; border-radius: 8px; display: flex; align-items: center; gap: 0.3rem; transition: all 0.15s; cursor: pointer;" 
                                                    onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f8fafc'"
                                                    onclick="ProductsView.openEditCategoryModal('${catId}', '${safeHTML(name).replace(/'/g, "\\'")}', '${catColor}')">
                                                ✏️ Editar
                                            </button>
                                            <button type="button" class="btn btn-sm btn-danger" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; font-weight: 800; border-radius: 8px; display: flex; align-items: center; gap: 0.3rem; cursor: pointer;"
                                                    onclick="ProductsView.handleDeleteCategoryClick('${catId}', '${safeHTML(name).replace(/'/g, "\\'")}', ${count})">
                                                🗑️ Eliminar
                                            </button>
                                        ` : `
                                            <span style="font-size: 0.75rem; font-weight: 800; color: #94a3b8; background: #f1f5f9; padding: 0.3rem 0.6rem; border-radius: 6px;">Categoría Sistema</span>
                                        `}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <div id="catSectionNew" style="display: none;">
                    <form id="createCategoryForm" onsubmit="event.preventDefault(); ProductsView.saveNewCategory();">
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="font-weight: 700; color: #1e293b; margin-bottom: 0.35rem; display: block;">Nombre de la Categoría *</label>
                            <input type="text" id="newCategoryName" class="form-control" placeholder="Ej: Bebidas Frías, Golosinas, Aseo..." required autofocus style="height: 44px; border: 2px solid #cbd5e1; font-weight: 750; font-size: 0.95rem; border-radius: 10px;">
                        </div>
                        <div class="form-group" style="margin-bottom: 1.25rem;">
                            <label style="font-weight: 700; color: #1e293b; margin-bottom: 0.5rem; display: block;">Color Distintivo *</label>
                            <input type="hidden" id="newCategoryColor" value="#2563eb">
                            <div id="categoryColorPalette" style="display: flex; flex-wrap: wrap; gap: 0.65rem; padding: 0.25rem 0;">
                                ${[
                                    '#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed',
                                    '#0891b2', '#ea580c', '#db2777', '#4f46e5', '#16a34a',
                                    '#ca8a04', '#9333ea', '#0284c7', '#65a30d', '#475569'
                                ].map((c, idx) => `
                                    <button type="button" 
                                            class="category-color-swatch" 
                                            data-color="${c}"
                                            onclick="ProductsView.selectCategoryColor('${c}', this)"
                                            style="width: 38px; height: 38px; border-radius: 50%; background: ${c}; border: 3px solid ${idx === 0 ? '#ffffff' : 'transparent'}; box-shadow: ${idx === 0 ? '0 0 0 2.5px ' + c + ', 0 2px 8px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.15)'}; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; outline: none;"
                                            title="Seleccionar color">
                                        <span class="swatch-check" style="color: #ffffff; font-weight: 900; font-size: 0.9rem; line-height: 1; display: ${idx === 0 ? 'block' : 'none'};">✓</span>
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                        <button type="submit" class="btn btn-primary" style="width: 100%; font-weight: 800; height: 44px; border-radius: 10px;">💾 Guardar Nueva Categoría</button>
                    </form>
                </div>
            </div>
        `;

        showModal(content, { title: '📂 Gestión de Categorías', width: '620px' });
    },

    selectCategoryColor(color, btnEl) {
        const input = document.getElementById('newCategoryColor');
        if (input) input.value = color;

        const swatches = document.querySelectorAll('.category-color-swatch');
        swatches.forEach(s => {
            s.style.border = '3px solid transparent';
            s.style.boxShadow = '0 1px 3px rgba(0,0,0,0.15)';
            const check = s.querySelector('.swatch-check');
            if (check) check.style.display = 'none';
        });

        if (btnEl) {
            btnEl.style.border = '3px solid #ffffff';
            btnEl.style.boxShadow = `0 0 0 2.5px ${color}, 0 2px 8px rgba(0,0,0,0.25)`;
            const check = btnEl.querySelector('.swatch-check');
            if (check) check.style.display = 'block';
        }
    },

    switchCatTab(tab) {
        const secList = document.getElementById('catSectionList');
        const secNew = document.getElementById('catSectionNew');
        if (secList) secList.style.display = tab === 'list' ? 'block' : 'none';
        if (secNew) secNew.style.display = tab === 'new' ? 'block' : 'none';

        const btnList = document.getElementById('catTabList');
        const btnNew = document.getElementById('catTabNew');

        if (btnList) btnList.className = tab === 'list' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary';
        if (btnNew) btnNew.className = tab === 'new' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary';
    },

    async saveNewCategory() {
        const input = document.getElementById('newCategoryName');
        const colorInput = document.getElementById('newCategoryColor');
        if (!input || !input.value.trim()) return;

        try {
            await Category.create(input.value.trim(), colorInput ? colorInput.value : '#3b82f6');
            showNotification('Categoría creada exitosamente', 'success');
            closeModal();
            await this.refresh();
        } catch (e) {
            showNotification(e.message, 'error');
        }
    },

    async handleDeleteCategoryClick(catId, catName, count) {
        if (count === 0) {
            showConfirm(`¿Eliminar la categoría vacía "${catName}"?`, async () => {
                try {
                    await Category.deleteAndReassign(catId, catName, 'General');
                    showNotification(`Categoría "${catName}" eliminada correctamente`, 'success');
                    closeModal();
                    await this.refresh();
                } catch (e) {
                    showNotification(e.message, 'error');
                }
            });
        } else {
            await this.showDeleteAndReassignModal(catId, catName, count);
        }
    },

    async showDeleteAndReassignModal(catId, catName, count) {
        const allCats = await Category.getUniqueNames();
        const availableTargets = allCats.filter(c => !CategoryHelper.areEqual(c, catName));

        const content = `
            <div style="font-family: 'Inter', sans-serif; padding: 0.5rem 0;">
                <div style="background: #fffbe6; border: 1.5px solid #fcd34d; border-radius: 0.75rem; padding: 1rem; margin-bottom: 1.25rem;">
                    <p style="margin: 0; color: #92400e; font-weight: 700; font-size: 0.95rem;">
                        ⚠️ La categoría <strong>"${safeHTML(catName)}"</strong> contiene <strong>${count} producto(s)</strong> asociados.
                    </p>
                    <p style="margin: 0.5rem 0 0 0; color: #b45309; font-size: 0.85rem;">
                        Antes de eliminarla, selecciona a qué categoría deseas mover esos productos:
                    </p>
                </div>

                <div class="form-group" style="margin-bottom: 1.5rem;">
                    <label style="font-weight: 800; color: #1e293b;">Categoría Destino para los Productos *</label>
                    <select id="reassignTargetCategorySelect" class="form-control" style="font-weight: 700; height: 44px; border: 2px solid #3b82f6;">
                        ${availableTargets.map(target => `<option value="${safeHTML(target)}" ${target === 'General' ? 'selected' : ''}>${safeHTML(target)}</option>`).join('')}
                    </select>
                </div>

                <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
                    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                    <button class="btn btn-danger" style="font-weight: 800;" onclick="ProductsView.executeDeleteAndReassign('${catId || ''}', '${safeHTML(catName)}')">
                        🔄 Mover Productos y Eliminar
                    </button>
                </div>
            </div>
        `;

        showModal(content, { title: `🗑️ Eliminar Categoría: ${safeHTML(catName)}`, width: '500px' });
    },

    async executeDeleteAndReassign(catId, catName) {
        const select = document.getElementById('reassignTargetCategorySelect');
        if (!select) return;
        const targetCategory = select.value;

        try {
            await Category.deleteAndReassign(catId, catName, targetCategory);
            showNotification(`Categoría "${catName}" eliminada y productos movidos a "${targetCategory}"`, 'success');
            closeModal();
            await this.refresh();
        } catch (e) {
            showNotification('Error al eliminar categoría: ' + e.message, 'error');
        }
    },

    openEditCategoryModal(catId, catName, currentColor = '#2563eb') {
        const palette = [
            '#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed',
            '#0891b2', '#ea580c', '#db2777', '#4f46e5', '#16a34a',
            '#ca8a04', '#9333ea', '#0284c7', '#65a30d', '#475569'
        ];

        const content = `
            <div style="font-family: 'Inter', sans-serif;">
                <form id="editCategoryForm" onsubmit="event.preventDefault(); ProductsView.saveEditedCategory('${catId || ''}', '${catName.replace(/'/g, "\\'")}');">
                    <div class="form-group" style="margin-bottom: 1.25rem;">
                        <label style="font-weight: 800; color: #1e293b; margin-bottom: 0.4rem; display: block;">Nombre de la Categoría *</label>
                        <input type="text" id="editCategoryName" class="form-control" value="${safeHTML(catName)}" required autofocus style="height: 44px; border: 2px solid #cbd5e1; font-weight: 750; font-size: 1rem; border-radius: 10px;">
                    </div>
                    <div class="form-group" style="margin-bottom: 1.5rem;">
                        <label style="font-weight: 800; color: #1e293b; margin-bottom: 0.5rem; display: block;">Color Representativo (Selecciona uno) *</label>
                        <input type="hidden" id="editCategoryColor" value="${currentColor}">
                        <div id="editCategoryPalette" style="display: flex; flex-wrap: wrap; gap: 0.65rem; padding: 0.25rem 0;">
                            ${palette.map(c => `
                                <button type="button" 
                                        class="edit-color-swatch" 
                                        data-color="${c}"
                                        onclick="ProductsView.selectEditColor('${c}', this)"
                                        style="width: 38px; height: 38px; border-radius: 50%; background: ${c}; border: 3px solid ${c.toLowerCase() === currentColor.toLowerCase() ? '#ffffff' : 'transparent'}; box-shadow: ${c.toLowerCase() === currentColor.toLowerCase() ? '0 0 0 2.5px ' + c + ', 0 2px 8px rgba(0,0,0,0.25)' : '0 1px 3px rgba(0,0,0,0.15)'}; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; outline: none;"
                                        title="Color ${c}">
                                    <span class="edit-swatch-check" style="color: #ffffff; font-weight: 900; font-size: 0.95rem; line-height: 1; display: ${c.toLowerCase() === currentColor.toLowerCase() ? 'block' : 'none'};">✓</span>
                                </button>
                            `).join('')}
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
                        <button type="button" class="btn btn-secondary" onclick="ProductsView.showCategoryManagerModal()" style="font-weight: 700; border-radius: 8px;">Volver</button>
                        <button type="submit" class="btn btn-primary" style="font-weight: 800; min-width: 140px; height: 42px; border-radius: 8px;">💾 Guardar Cambios</button>
                    </div>
                </form>
            </div>
        `;

        showModal(content, { title: `✏️ Editar Categoría: ${safeHTML(catName)}`, width: '540px' });
    },

    selectEditColor(color, btnEl) {
        const input = document.getElementById('editCategoryColor');
        if (input) input.value = color;

        const swatches = document.querySelectorAll('.edit-color-swatch');
        swatches.forEach(s => {
            s.style.border = '3px solid transparent';
            s.style.boxShadow = '0 1px 3px rgba(0,0,0,0.15)';
            const check = s.querySelector('.edit-swatch-check');
            if (check) check.style.display = 'none';
        });

        if (btnEl) {
            btnEl.style.border = '3px solid #ffffff';
            btnEl.style.boxShadow = `0 0 0 2.5px ${color}, 0 2px 8px rgba(0,0,0,0.25)`;
            const check = btnEl.querySelector('.edit-swatch-check');
            if (check) check.style.display = 'block';
        }
    },

    async saveEditedCategory(catId, oldName) {
        const nameInput = document.getElementById('editCategoryName');
        const colorInput = document.getElementById('editCategoryColor');
        if (!nameInput || !nameInput.value.trim()) return;

        const newName = nameInput.value.trim();
        const newColor = colorInput ? colorInput.value : '#2563eb';

        try {
            await Category.rename(catId, oldName, newName, newColor);
            showNotification(`Categoría "${newName}" actualizada correctamente`, 'success');
            await this.showCategoryManagerModal();
            await this.refresh();
        } catch (e) {
            showNotification('Error al editar categoría: ' + e.message, 'error');
        }
    },

    async exportToExcel() {
        if (typeof BackupManager !== 'undefined' && typeof BackupManager.exportProductsToExcel === 'function') {
            await BackupManager.exportProductsToExcel();
        } else {
            showNotification('Módulo de exportación no disponible', 'warning');
        }
    },

    showImportModal() {
        if (typeof SettingsView !== 'undefined' && typeof SettingsView.showImportProductsModal === 'function') {
            SettingsView.showImportProductsModal();
        } else {
            showNotification('Módulo de importación no disponible', 'warning');
        }
    }
};