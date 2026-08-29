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
            const stats = await Product.getCategoryStats();
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
            <div class="view-header" style="margin-bottom: 1.25rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <h1 style="margin: 0; font-size: 1.75rem; font-weight: 900; color: #0f172a;">Productos</h1>
                        <p style="margin: 0; color: #64748b; font-size: 0.88rem; font-weight: 600;">Gestiona tu catálogo de productos y control de stock</p>
                    </div>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
                        <button class="btn btn-sm" onclick="ProductsView.setStockFilter(ProductsView.stockFilter === 'negative' ? 'all' : 'negative')" 
                                style="${this.stockFilter === 'negative' ? 'background: #dc2626; color: #ffffff; border: 2px solid #991b1b; box-shadow: 0 4px 12px rgba(220,38,38,0.35);' : 'background: #fef2f2; color: #dc2626; border: 2px solid #fca5a5;'} height: 42px; font-weight: 900; border-radius: 0.75rem; padding: 0 1rem; display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; transition: all 0.2s;"
                                title="Ver productos con stock menor a 0">
                            🔴 Stock Negativo
                        </button>

                        <button class="btn btn-sm" onclick="ProductsView.setStockFilter(ProductsView.stockFilter === 'low' ? 'all' : 'low')" 
                                style="${this.stockFilter === 'low' ? 'background: #d97706; color: #ffffff; border: 2px solid #92400e; box-shadow: 0 4px 12px rgba(217,119,6,0.35);' : 'background: #fffbe6; color: #d97706; border: 2px solid #fcd34d;'} height: 42px; font-weight: 900; border-radius: 0.75rem; padding: 0 1rem; display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; transition: all 0.2s;"
                                title="Ver productos con bajo stock">
                            ⚠️ Bajo Stock
                        </button>

                        ${PermissionService.can('products.delete') ? `
                        <button class="btn btn-sm" onclick="ProductsView.showDeletedProducts()" 
                                style="background: #f59e0b; color: #ffffff; height: 42px; font-weight: 900; border-radius: 0.75rem; padding: 0 1rem; display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; border: none; box-shadow: 0 4px 10px rgba(245,158,11,0.25);" title="Ver productos desactivados">
                            📋 Desactivados
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="ProductsView.deleteSelected()" id="btnDeleteSelected" style="display: none; height: 42px; font-weight: 900; border-radius: 0.75rem; padding: 0 1rem;">
                            🚫 Desactivar
                        </button>` : ''}

                        ${PermissionService.can('products.export') ? `
                        <button class="btn btn-sm" onclick="ProductsView.exportToExcel()" 
                                style="background: #475569; color: #ffffff; height: 42px; font-weight: 900; border-radius: 0.75rem; padding: 0 1rem; display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; border: none; box-shadow: 0 4px 10px rgba(71,85,105,0.25);">
                            📥 Exportar
                        </button>` : ''}

                        ${PermissionService.can('products.import') ? `
                        <button class="btn btn-sm" onclick="ProductsView.showImportModal()" 
                                style="background: #475569; color: #ffffff; height: 42px; font-weight: 900; border-radius: 0.75rem; padding: 0 1rem; display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; border: none; box-shadow: 0 4px 10px rgba(71,85,105,0.25);">
                            📤 Importar
                        </button>` : ''}

                        <button class="btn btn-sm" onclick="ProductsView.showCategoryManagerModal()" 
                                style="background: #8b5cf6; color: #ffffff; height: 42px; font-weight: 900; border-radius: 0.75rem; padding: 0 1rem; display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; border: none; box-shadow: 0 4px 10px rgba(139,92,246,0.25);">
                            📁 Categorías
                        </button>

                        ${PermissionService.can('products.create') ? `
                        <button class="btn btn-sm btn-primary" onclick="ProductsView.showProductForm()" 
                                style="background: #4f46e5; color: #ffffff; height: 42px; font-weight: 900; border-radius: 0.75rem; padding: 0 1.25rem; display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.88rem; border: none; box-shadow: 0 4px 12px rgba(79,70,229,0.35);">
                            ➕ Nuevo Producto
                        </button>` : ''}
                    </div>
                </div>
            </div>
            
            <div class="card" style="background: #f0f7ff; border: 2.5px solid #3b82f6; box-shadow: 0 10px 25px rgba(59, 130, 246, 0.1);">
                <div style="display: flex; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap; align-items: center;">
                    <div class="form-group pos-section" style="flex: 1; margin-bottom: 0;">
                        <input type="text" id="searchProducts" class="form-control" placeholder="🔍 Buscar productos aquí..." style="border: 2px solid #3b82f6; font-size: 1.1rem; height: 50px;">
                    </div>
                    <div id="productsReturnBtnContainer">
                        ${this.renderReturnButton()}
                    </div>
                </div>
                <div id="productsAlertContainer">${this.renderCategoryAlert()}</div>
                <div id="productsTable">${contentHtml}</div>
            </div>
        `;
    },

    renderReturnButton() {
        if (!this.selectedCategory && this.stockFilter === 'all') return '';
        return `<button class="btn btn-primary" onclick="ProductsView.clearCategoryFilter()">⬅ Volver a Categorías</button>`;
    },

    renderCategoryAlert() {
        if (!this.selectedCategory && this.stockFilter === 'all') return '';
        const filterName = this.stockFilter === 'negative' ? '🔴 Stock Negativo (<0)' : (this.stockFilter === 'low' ? '⚠️ Bajo Stock' : (this.stockFilter === 'out' ? '❌ Sin Stock (0)' : 'Todos'));
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; background: #ffffff; padding: 0.75rem 1.25rem; border-radius: 1rem; border: 2px solid #cbd5e1; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.75rem; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <div style="font-weight: 800; color: #1e293b; font-size: 0.95rem;">
                    ${this.selectedCategory ? `📁 <strong>Categoría:</strong> ${safeHTML(this.selectedCategory)}` : ''}
                    ${this.stockFilter !== 'all' ? `<span style="margin-left: 0.5rem; background: #f1f5f9; padding: 0.25rem 0.75rem; border-radius: 0.5rem; color: #0f172a;">Filtro: <strong>${filterName}</strong></span>` : ''}
                </div>
                <button class="btn btn-sm btn-secondary" style="font-weight: 800; border-radius: 0.5rem;" onclick="ProductsView.clearCategoryFilter()">Quitar Filtros</button>
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
            setTimeout(() => { searchInput.focus(); }, 100);
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => this.applyFilters(e.target.value.trim()), 200);
            });
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
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1.5rem; padding: 1rem 0;">
                ${categories.map(cat => {
            const s = stats[cat] || { total: 0, low: 0, out: 0, negative: 0 };
            const mainOnClick = this.stockFilter !== 'all' 
                ? `ProductsView.filterByCategoryWithStock('${safeHTML(cat)}', '${this.stockFilter}')` 
                : `ProductsView.filterByCategory('${safeHTML(cat)}')`;
            
            let subtext = `<p style="color: #6366f1; font-weight: 700; font-size: 0.9rem; margin-bottom: 0;">${s.total} PRODUCTOS</p>`;
            if (this.stockFilter === 'low') {
                subtext = `<p style="color: #d97706; font-weight: 800; font-size: 0.95rem; margin-bottom: 0;">⚠️ ${s.low} BAJO STOCK</p>`;
            } else if (this.stockFilter === 'negative') {
                subtext = `<p style="color: #dc2626; font-weight: 800; font-size: 0.95rem; margin-bottom: 0;">🔴 ${s.negative} NEGATIVOS</p>`;
            } else if (this.stockFilter === 'out') {
                subtext = `<p style="color: #ef4444; font-weight: 800; font-size: 0.95rem; margin-bottom: 0;">❌ ${s.out} SIN STOCK</p>`;
            }

            return `
                    <div
                         style="padding: 0; border-radius: 1.25rem; background: #ffffff; border: 1.5px solid #e5e7eb; text-align: center; overflow: hidden; display: flex; flex-direction: column; transition: transform 0.25s ease, box-shadow 0.25s ease; box-shadow: 0 2px 8px rgba(0,0,0,0.05);"
                         onmouseover="this.style.transform='translateY(-6px)'; this.style.boxShadow='0 12px 28px rgba(0,0,0,0.1)'; this.style.borderColor='#9ca3af';" 
                         onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.05)'; this.style.borderColor='#e5e7eb';">
                        
                        <div style="padding: 1.5rem; cursor: pointer; flex: 1;" onclick="${mainOnClick}">
                            <div style="font-size: 2.75rem; margin-bottom: 0.5rem;">
                                ${this.getCategoryIcon(cat)}
                            </div>
                            <h3 style="margin: 0.25rem 0; font-size: 1.1rem; font-weight: 800; color: #111827; letter-spacing: 0.5px; text-transform: uppercase;">${safeHTML(cat)}</h3>
                            ${subtext}
                        </div>
                        
                        <div style="display: flex; height: 60px; border-top: 1.5px solid #f3f4f6;">
                            <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; background: ${s.out > 0 ? '#ef4444' : '#f9fafb'}; cursor: ${s.out > 0 ? 'pointer' : 'default'}; border-right: 1px solid #f3f4f6; transition: all 0.2s;" 
                                 ${s.out > 0 ? `onclick="ProductsView.filterByCategoryWithStock('${safeHTML(cat)}', 'out')" onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='#ef4444'"` : ''}>
                                <div style="font-size: 1.1rem; color: ${s.out > 0 ? '#ffffff' : '#9ca3af'}; font-weight: 900;">${s.out}</div>
                                <div style="font-size: 0.65rem; color: ${s.out > 0 ? '#ffffff' : '#9ca3af'}; font-weight: 800; text-transform: uppercase;">SIN STOCK</div>
                            </div>
                            
                            <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; background: ${s.low > 0 ? '#f59e0b' : '#f9fafb'}; cursor: ${s.low > 0 ? 'pointer' : 'default'}; transition: all 0.2s;" 
                                 ${s.low > 0 ? `onclick="ProductsView.filterByCategoryWithStock('${safeHTML(cat)}', 'low')" onmouseover="this.style.background='#d97706'" onmouseout="this.style.background='#f59e0b'"` : ''}>
                                <div style="font-size: 1.1rem; color: ${s.low > 0 ? '#ffffff' : '#9ca3af'}; font-weight: 900;">${s.low}</div>
                                <div style="font-size: 0.65rem; color: ${s.low > 0 ? '#ffffff' : '#9ca3af'}; font-weight: 800; text-transform: uppercase;">BAJO STOCK</div>
                            </div>
                        </div>
                    </div>
                `}).join('')}
            </div>
        `;
    },

    getCategoryIcon(categoryName) {
        const name = (categoryName || '').toLowerCase();
        // Categorías sugeridas por el sistema
        if (name.includes('fresco') || name.includes('fruta') || name.includes('verdura')) return '🥦';
        if (name.includes('bebestible') || name.includes('bebida') || name.includes('jugo') || name.includes('liquido')) return '🥤';
        if (name.includes('snack') || name.includes('dulce') || name.includes('golosina') || name.includes('papas')) return '🍫';
        if (name.includes('aseo') || name.includes('limpieza')) return '🧼';
        if (name.includes('abarrote') || name.includes('pasta') || name.includes('arroz') || name.includes('aceite')) return '🍞';
        if (name.includes('venta') || name.includes('mas vendido') || name.includes('top')) return '⭐';

        // Otras categorías comunes
        if (name.includes('lacteo') || name.includes('leche')) return '🥛';
        if (name.includes('carne') || name.includes('parrilla')) return '🥩';
        if (name.includes('mascota')) return '🐾';
        if (name.includes('congelado')) return '🧊';
        if (name.includes('cigarro')) return '🚬';
        if (name.includes('alcohol') || name.includes('cerveza') || name.includes('vino')) return '🍺';
        if (name.includes('ferreteria')) return '🔨';
        if (name.includes('oficina') || name.includes('libreria')) return '📚';
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
                            <div onclick="ProductsView.showProductForm(${p.id})" 
                                 style="background: #f0fdf4; border-radius: 0.75rem; padding: 0.75rem; border: 1.5px solid #bbf7d0; cursor: pointer; transition: all 0.2s;"
                                 onmouseover="this.style.transform='scale(1.02)'; this.style.backgroundColor='#dcfce7';"
                                 onmouseout="this.style.transform='scale(1)'; this.style.backgroundColor='#f0fdf4';">
                                <div style="font-size: 0.68rem; color: #16a34a; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; display: flex; justify-content: space-between;">
                                    <span>Precio Venta</span>
                                    <span>✏️</span>
                                </div>
                                <div style="font-size: 1.5rem; font-weight: 900; color: #15803d;">${formatCLP(p.price)}</div>
                            </div>
                            <!-- Stock -->
                            <div style="background: ${stock <= 0 ? '#fef2f2' : (stock <= minStock ? '#fffbeb' : '#f9fafb')}; border-radius: 0.75rem; padding: 0.75rem; border: 2px solid ${stockLevelColor}; text-align: center;">
                                <div style="font-size: 0.68rem; color: ${stock <= minStock ? stockLevelColor : '#6b7280'}; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">Disponible</div>
                                <div style="font-size: 1.4rem; font-weight: 950; color: ${stockLevelColor};">
                                    ${formatStock(p.stock, p.type === 'weight' ? 3 : 0)}<span style="font-size: 0.8rem; font-weight: 700; color: ${stockLevelColor}; opacity: 0.6;">${p.type === 'weight' ? 'kg' : 'u'}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Footer Info: Proveedor y Botones Compactos -->
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 0.75rem; border-top: 1px solid #f3f4f6;">
                            <div id="sup-label-${p.id}" style="display: flex; align-items: center; gap: 0.5rem; color: #6b7280; font-size: 0.82rem; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                <span>🚚</span> ${safeHTML(sup)}
                            </div>
                            <div style="display: flex; gap: 0.5rem;">
                                <button class="btn btn-icon" style="width: 36px; height: 36px; padding: 0; background: #eff6ff; color: #3b82f6; border: 1.5px solid #bfdbfe; border-radius: 0.65rem; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.background='#dbeafe'" onmouseout="this.style.background='#eff6ff'" onclick="ProductsView.showProductHistory(${p.id})" title="Ver Historial">
                                    📊
                                </button>
                                <button class="btn btn-icon" style="width: 36px; height: 36px; padding: 0; background: #f0fdf4; color: #16a34a; border: 1.5px solid #bbf7d0; border-radius: 0.65rem; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.background='#dcfce7'" onmouseout="this.style.background='#f0fdf4'" onclick="ProductsView.showProductForm(${p.id})" title="Editar">
                                    ✏️
                                </button>
                                <button class="btn btn-icon" style="width: 36px; height: 36px; padding: 0; background: #fef2f2; color: #dc2626; border: 1.5px solid #fecaca; border-radius: 0.65rem; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='#fef2f2'" onclick="ProductsView.deleteProduct(${p.id})" title="Desactivar">
                                    🗑️
                                </button>
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

    async showProductForm(id = null) {
        const product = id ? await Product.getById(id) : null;
        const categories = (typeof Category !== 'undefined') ? await Category.getUniqueNames() : [];
        if (!categories.includes('General')) categories.unshift('General');

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
                        <input type="number" name="stock" step="any" class="form-control" value="${product?.stock || 0}" style="height: 38px; font-weight: 800;">
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 0.8rem; font-weight: 700; color: #475569;">⚠️ Stock Mínimo</label>
                        <input type="number" name="minStock" step="any" class="form-control" value="${product?.minStock || 0}" style="height: 38px; font-weight: 800;">
                    </div>
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
                               style="height: 42px; font-size: 1.15rem; font-weight: 900; border-color: #10b981; background: rgba(16,185,129,0.05);"
                               oninput="ProductsView.updateMarginInfo()">
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

        </div>
    </form>
    `;
        const footer = `<button class="btn btn-secondary" onclick="closeModal()" style="font-weight: 700;">Cancelar</button> <button class="btn btn-primary" onclick="ProductsView.saveProduct(${id})" style="font-weight: 800;">[F2] Guardar Producto</button>`;
        window._focusSearchAfterClose = () => ProductsView.focusSearch();
        showModal(content, { title: id ? 'Editar Producto' : 'Nuevo Producto', footer, width: '920px' });

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
        const form = document.getElementById('productForm');
        if (!form.reportValidity()) return;
        const data = Object.fromEntries(new FormData(form));

        // Normalizar categoría a Title Case usando CategoryHelper
        data.category = (typeof CategoryHelper !== 'undefined') ? CategoryHelper.sanitize(data.category) : (data.category ? data.category.trim() : 'General');

        if (id) data.id = id;
        try {
            await ProductController.saveProduct(data);
            closeModal();
            showNotification('Producto guardado exitosamente', 'success');
            await this.refresh();
        } catch (e) { showNotification(e.message, 'error'); }
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
        const products = await Product.getAllIncludingDeleted();
        const deleted = products.filter(p => p.deleted);

        if (deleted.length === 0) {
            window._focusSearchAfterClose = () => ProductsView.focusSearch();
            showModal(
                '<div class="empty-state"><div class="empty-state-icon">✅</div>No hay productos desactivados</div>',
                { title: 'Productos Desactivados', footer: '<button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>', width: '600px' }
            );
            return;
        }

        const content = `
    <p style="margin-bottom: 1rem; color: #94a3b8;">
        Estos productos están desactivados. No aparecerán en ventas ni en el buscador, pero sus registros históricos se mantienen.
            </p>
    <div class="table-container" style="max-height: 450px; overflow-y: auto; border-radius: 0.5rem; border: 1px solid rgba(255,255,255,0.05);">
        <table class="table">
            <thead style="background: rgba(0,0,0,0.2); position: sticky; top: 0; z-index: 1;">
                <tr>
                    <th style="text-align: left; padding: 0.75rem 1rem;">Producto</th>
                    <th style="text-align: left; padding: 0.75rem 1rem;">Categoría</th>
                    <th style="text-align: right; padding: 0.75rem 1rem;">Costo</th>
                    <th style="text-align: center; padding: 0.75rem 1rem;">Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${deleted.map(p => `
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); opacity: 0.85;">
                                <td style="padding: 0.75rem 1rem;">
                                    <div style="font-weight: 600; color: #fff;">${safeHTML(p.name)}</div>
                                    <small style="color: #64748b;">${safeHTML(p.barcode || 'Sin código')}</small>
                                </td>
                                <td style="padding: 0.75rem 1rem; color: #94a3b8;">${safeHTML(p.category || 'General')}</td>
                                <td style="padding: 0.75rem 1rem; text-align: right; color: #fff;">${formatCLP(p.cost || 0)}</td>
                                <td style="padding: 0.75rem 1rem; text-align: center;">
                                    <button class="btn btn-sm btn-success" onclick="ProductsView.restoreProduct(${p.id})">
                                        Restaurar
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
            title: `Productos Desactivados(${deleted.length})`,
            footer: '<button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>',
            width: '600px'
        });
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
        const price = parseFloat(document.getElementById('form_price').value) || 0;
        const bruto = parseFloat(document.getElementById('form_cost').value) || 0;

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
        const content = `
    <div style="margin-bottom: 1rem;">
                <h3>${safeHTML(product.name)}</h3>
                <p>Stock actual: <strong>${formatStock(product.stock)} ${product.type === 'weight' ? 'kg' : 'un'}</strong></p>
            </div>
    <div class="table-container" style="max-height: 400px; overflow-y: auto;">
        <table>
            <thead><tr><th>Fecha</th><th>Tipo</th><th>Cant.</th><th>Motivo</th></tr></thead>
            <tbody>
                ${sorted.length === 0 ? '<tr><td colspan="4" style="text-align:center;">No hay movimientos</td></tr>' : sorted.map(m => `
                            <tr>
                                <td>${formatDateTime(m.date)}</td>
                                <td><span class="badge badge-info">${m.type}</span></td>
                                <td style="color: ${m.quantity > 0 ? 'var(--success)' : 'var(--danger)'}; font-weight: bold;">${m.quantity > 0 ? '+' : ''}${formatStock(m.quantity)}</td>
                                <td>${safeHTML(m.reason || '-')}</td>
                            </tr>
                        `).join('')}
            </tbody>
        </table>
    </div>
`;
        window._focusSearchAfterClose = () => ProductsView.focusSearch();
        showModal(content, { title: 'Historial de Movimientos', footer: '<button class="btn btn-primary" onclick="closeModal()">Cerrar</button>', width: '700px' });
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
                <div style="display: flex; gap: 0.5rem; border-bottom: 2px solid #e2e8f0; margin-bottom: 1rem; padding-bottom: 0.5rem;">
                    <button id="catTabList" class="btn btn-sm btn-primary" onclick="ProductsView.switchCatTab('list')">📋 Lista de Categorías</button>
                    <button id="catTabNew" class="btn btn-sm btn-secondary" onclick="ProductsView.switchCatTab('new')">➕ Crear Nueva Categoría</button>
                </div>

                <div id="catSectionList">
                    <div style="max-height: 380px; overflow-y: auto;">
                        <table class="table" style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: #f8fafc; border-bottom: 2px solid #cbd5e1; text-align: left;">
                                    <th style="padding: 0.6rem 0.75rem;">Categoría</th>
                                    <th style="padding: 0.6rem 0.75rem;">Productos</th>
                                    <th style="padding: 0.6rem 0.75rem; text-align: right;">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${uniqueCatNames.map(name => {
                                    const count = countMap[name] || 0;
                                    const catObj = categories.find(c => (typeof CategoryHelper !== 'undefined') ? CategoryHelper.areEqual(c.name, name) : c.name === name);
                                    const catId = catObj ? catObj.id : null;
                                    const isGeneral = CategoryHelper.areEqual(name, 'General');

                                    return `
                                        <tr style="border-bottom: 1px solid #f1f5f9;">
                                            <td style="padding: 0.6rem 0.75rem; font-weight: 700; color: #1e293b;">
                                                🏷️ ${safeHTML(name)}
                                            </td>
                                            <td style="padding: 0.6rem 0.75rem;">
                                                <span class="badge ${count > 0 ? 'badge-primary' : 'badge-secondary'}" style="padding: 0.25rem 0.6rem; border-radius: 1rem;">
                                                    ${count} ${count === 1 ? 'producto' : 'productos'}
                                                </span>
                                            </td>
                                            <td style="padding: 0.6rem 0.75rem; text-align: right;">
                                                <div style="display: flex; gap: 0.35rem; justify-content: flex-end; align-items: center;">
                                                    ${!isGeneral ? `
                                                        <button class="btn btn-sm" style="padding: 0.25rem 0.6rem; font-size: 0.75rem; background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; font-weight: 700;" onclick="ProductsView.promptRenameCategory('${catId || ''}', '${safeHTML(name)}')">✏️ Renombrar</button>
                                                        <button class="btn btn-sm btn-danger" style="padding: 0.25rem 0.6rem; font-size: 0.75rem; font-weight: 700;" onclick="ProductsView.handleDeleteCategoryClick('${catId || ''}', '${safeHTML(name)}', ${count})">🗑️ Eliminar</button>
                                                    ` : '<span style="font-size: 0.75rem; color: #94a3b8; font-weight: 700;">(Sistema)</span>'}
                                                </div>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div id="catSectionNew" style="display: none;">
                    <form id="createCategoryForm" onsubmit="event.preventDefault(); ProductsView.saveNewCategory();">
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="font-weight: 700;">Nombre de la Categoría *</label>
                            <input type="text" id="newCategoryName" class="form-control" placeholder="Ej: Bebidas Frías, Golosinas, Aseo..." required autofocus style="height: 42px; border: 2px solid #cbd5e1; font-weight: 700;">
                        </div>
                        <div class="form-group" style="margin-bottom: 1.25rem;">
                            <label style="font-weight: 700;">Color Distintivo</label>
                            <input type="color" id="newCategoryColor" value="#3b82f6" style="width: 100px; height: 40px; border-radius: 0.5rem; border: 1px solid #cbd5e1; cursor: pointer;">
                        </div>
                        <button type="submit" class="btn btn-primary" style="width: 100%; font-weight: 800; height: 44px;">💾 Guardar Nueva Categoría</button>
                    </form>
                </div>
            </div>
        `;

        showModal(content, { title: '📂 Gestión de Categorías', width: '580px' });
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

    async promptRenameCategory(catId, oldName) {
        const newName = prompt(`Ingresa el nuevo nombre para la categoría "${oldName}":`, oldName);
        if (!newName || !newName.trim() || CategoryHelper.areEqual(newName.trim(), oldName)) return;

        try {
            await Category.rename(catId, oldName, newName.trim());
            showNotification(`Categoría renombrada a "${newName.trim()}"`, 'success');
            closeModal();
            await this.refresh();
        } catch (e) {
            showNotification('Error al renombrar categoría: ' + e.message, 'error');
        }
    }
};