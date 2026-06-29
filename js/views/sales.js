const SalesView = {
    currentFilter: 'all', // 'all', 'cash', 'card', 'qr', 'other', 'pending', 'mixed'
    dateFrom: null,
    dateTo: null,
    offset: 0,
    limit: 50,
    hasMore: true,
    isLoadingMore: false,
    allSales: [],
    currentSearchQuery: '',

    // Estado del selector tipo calendario (rango o día único)
    _calendarYear: null,
    _calendarMonth: null, // 0-11
    _monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],

    async loadInitialSales() {
        if (this.currentFilter === 'returns') {
            try {
                if (db.mode === 'sqlite') {
                    const params = { limit: this.limit, offset: 0 };
                    if (this.dateFrom || this.dateTo) {
                        let from = this.dateFrom || this.dateTo;
                        let to = this.dateTo || this.dateFrom;
                        if (from > to) {
                            const tmp = from;
                            from = to;
                            to = tmp;
                        }
                        params.dateFrom = from;
                        params.dateTo = to;
                    }
                    this.allSales = await ApiClient.get('sale-returns/list/latest', params);
                } else {
                    this.allSales = await db.getAll('saleReturns');
                    this.allSales.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
                }
            } catch (e) {
                console.error('Error al cargar notas de crédito:', e);
                this.allSales = [];
            }
        } else {
            if (this.dateFrom || this.dateTo) {
                let from = this.dateFrom || this.dateTo;
                let to = this.dateTo || this.dateFrom;
                if (from > to) {
                    const tmp = from;
                    from = to;
                    to = tmp;
                }

                this.allSales = await Sale.getByDateRange(from + 'T00:00:00', to + 'T23:59:59', { limit: this.limit, offset: 0 });
            } else {
                this.allSales = await Sale.getLatest(this.limit, 0);
            }
        }
        this.hasMore = this.allSales.length === this.limit;
        this.offset = 0;
    },

    async render() {
        if (this.offset === 0 && this.allSales.length === 0) {
            await this.loadInitialSales();
        }

        this.ensureCalendarState();

        // Calcular KPIs en base a las ventas cargadas
        let kpisHtml = '';
        if (this.currentFilter === 'returns') {
            const totalReturned = this.allSales.reduce((sum, r) => sum + (parseFloat(r.totalReturned) || 0), 0);
            const returnCount = this.allSales.length;
            kpisHtml = `
                <div class="sales-kpi-container animate-fade-in">
                    <div class="sales-kpi-card" style="border-color: rgba(239, 68, 68, 0.3);">
                        <div>
                            <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted, #64748b); text-transform: uppercase; letter-spacing: 0.5px;">Total Devuelto (Notas de Crédito)</span>
                            <h2 style="margin: 0.35rem 0 0 0; font-size: 1.75rem; font-weight: 800; color: #ef4444;">${formatCLP(totalReturned)}</h2>
                            <small style="color: var(--text-muted, #64748b); font-weight: 600; display: block; margin-top: 0.25rem;">↩️ ${returnCount} devoluciones registradas</small>
                        </div>
                        <div class="sales-kpi-card-icon" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border-color: rgba(239, 68, 68, 0.15);">↩️</div>
                    </div>
                </div>
            `;
        } else {
            const activeSales = this.allSales.filter(s => s.status !== 'cancelled');
            const totalVentas = activeSales.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
            const totalCobrado = activeSales.reduce((sum, s) => sum + (parseFloat(s.paidAmount) || 0), 0);
            const totalPendiente = Math.max(0, totalVentas - totalCobrado);
            const totalCount = activeSales.length;
            
            kpisHtml = `
                <div class="sales-kpi-container animate-fade-in">
                    <div class="sales-kpi-card">
                        <div>
                            <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted, #64748b); text-transform: uppercase; letter-spacing: 0.5px;">Ventas Totales</span>
                            <h2 style="margin: 0.35rem 0 0 0; font-size: 1.75rem; font-weight: 800; color: var(--text-color, #0f172a);">${formatCLP(totalVentas)}</h2>
                            <small style="color: var(--primary, #10b981); font-weight: 600; display: block; margin-top: 0.25rem;">🟢 ${totalCount} ventas activas</small>
                        </div>
                        <div class="sales-kpi-card-icon">📊</div>
                    </div>
                    
                    <div class="sales-kpi-card">
                        <div>
                            <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted, #64748b); text-transform: uppercase; letter-spacing: 0.5px;">Total Cobrado</span>
                            <h2 style="margin: 0.35rem 0 0 0; font-size: 1.75rem; font-weight: 800; color: var(--primary, #10b981);">${formatCLP(totalCobrado)}</h2>
                            <small style="color: var(--text-muted, #64748b); font-weight: 600; display: block; margin-top: 0.25rem;">💵 Efectivo + Tarjeta + QR</small>
                        </div>
                        <div class="sales-kpi-card-icon">💰</div>
                    </div>

                    <div class="sales-kpi-card" style="border-color: rgba(245, 158, 11, 0.4);">
                        <div>
                            <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted, #64748b); text-transform: uppercase; letter-spacing: 0.5px;">Por Cobrar (Anotado)</span>
                            <h2 style="margin: 0.35rem 0 0 0; font-size: 1.75rem; font-weight: 800; color: #f59e0b;">${formatCLP(totalPendiente)}</h2>
                            <small style="color: #f59e0b; font-weight: 600; display: block; margin-top: 0.25rem;">📝 Deuda de clientes</small>
                        </div>
                        <div class="sales-kpi-card-icon" style="background: rgba(245, 158, 11, 0.1); color: #f59e0b; border-color: rgba(245, 158, 11, 0.15);">📝</div>
                    </div>
                </div>
            `;
        }

        const salesTableHtml = await this.renderSalesTable(this.allSales);

        return `
            <div class="view-header" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
                <div>
                    <h1 style="margin: 0; font-size: 1.75rem; font-weight: 900; color: var(--text-color, #0f172a);">Historial de Ventas</h1>
                    <p style="margin: 0.35rem 0 0 0; color: var(--text-muted, #64748b); font-size: 0.95rem;">Consulta y gestiona todas las ventas del negocio</p>
                </div>
            </div>

            ${kpisHtml}
            
            <div class="sales-history-filters" style="background: var(--bg-card, #ffffff); border: 1px solid var(--border-color, #e2e8f0); border-radius: 1rem; padding: 1.25rem; margin-bottom: 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
                
                <!-- Buscador e Info de Búsqueda -->
                <div style="display: flex; gap: 1rem; align-items: flex-end; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 280px; display: flex; flex-direction: column; gap: 0.35rem;">
                        <label style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted, #64748b); text-transform: uppercase; letter-spacing: 0.5px;">Búsqueda Rápida</label>
                        <div style="position: relative; display: flex; align-items: center; width: 100%;">
                            <span style="position: absolute; left: 0.75rem; color: var(--text-muted, #64748b); font-size: 1.1rem;">🔍</span>
                            <input type="text" id="salesSearchInput" class="form-control" placeholder="Buscar por número de folio o nombre del cliente..." 
                                   value="${this.currentSearchQuery || ''}"
                                   oninput="SalesView.handleSearch(this.value)"
                                   style="padding-left: 2.25rem; height: 42px; border-radius: 0.5rem; width: 100%; border: 1px solid var(--border-color, #cbd5e1); font-size: 0.95rem;">
                        </div>
                    </div>

                    <!-- Botones Rápidos de Fecha -->
                    <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                        <button class="btn btn-secondary" onclick="SalesView.selectToday()" style="height: 42px; border-radius: 0.5rem; font-weight: 600; padding: 0 1rem; display: flex; align-items: center; gap: 0.35rem;">Hoy</button>
                        <button class="btn btn-secondary" onclick="SalesView.clearDateFilter()" style="height: 42px; border-radius: 0.5rem; font-weight: 600; padding: 0 1rem; display: flex; align-items: center; gap: 0.35rem;">Limpiar</button>
                    </div>
                </div>

                <!-- Acordeón / Colapsable de Rango de Fecha Personalizado -->
                <details style="border-top: 1px solid var(--border-color, rgba(0,0,0,0.05)); padding-top: 0.75rem;" ${this.dateFrom || this.dateTo ? 'open' : ''}>
                    <summary style="font-size: 0.85rem; font-weight: 700; color: var(--text-muted, #64748b); cursor: pointer; text-transform: uppercase; letter-spacing: 0.5px; user-select: none;">
                        📅 Rango de fecha detallado (Calendario)
                    </summary>
                    <div style="margin-top: 0.75rem;">
                        <div class="cash-history-filter" style="margin-bottom: 0;">
                            <div class="cash-history-filter-selects">
                                <label>
                                    Mes
                                    <select id="salesHistoryMonthSelect" class="form-control"
                                            onchange="SalesView.setSalesCalendarMonth(this.value)">
                                        ${this._monthNames.map((name, index) => `
                                            <option value="${index}" ${index === this._calendarMonth ? 'selected' : ''}>${name}</option>
                                        `).join('')}
                                    </select>
                                </label>
                                <label>
                                    Año
                                    <select id="salesHistoryYearSelect" class="form-control"
                                            onchange="SalesView.setSalesCalendarYear(this.value)">
                                        ${this.getCalendarYears().map(year => `
                                            <option value="${year}" ${year === this._calendarYear ? 'selected' : ''}>${year}</option>
                                        `).join('')}
                                    </select>
                                </label>
                            </div>

                            <div class="cash-history-filter-grid">
                                <div class="cash-history-day-grid-title" id="salesHistoryDayGridTitle">
                                    ${this._monthNames[this._calendarMonth]} ${this._calendarYear}
                                </div>
                                <div class="cash-history-day-grid-body" id="salesHistoryDayGrid">
                                    ${this.renderSalesHistoryDayGridButtons(this._calendarYear, this._calendarMonth)}
                                </div>
                            </div>
                        </div>
                    </div>
                </details>

                <!-- Método de Pago Chips -->
                <div style="border-top: 1px solid var(--border-color, rgba(0,0,0,0.05)); padding-top: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem;">
                    <label style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted, #64748b); text-transform: uppercase; letter-spacing: 0.5px;">Filtrar por Método de Pago</label>
                    <div class="sales-filter-chips">
                        <button class="sales-chip ${this.currentFilter === 'all' ? 'active' : ''}" onclick="SalesView.filterByPaymentMethod('all')">Todas</button>
                        <button class="sales-chip ${this.currentFilter === 'mixed' ? 'active' : ''}" onclick="SalesView.filterByPaymentMethod('mixed')">🔀 Pagos Mixtos</button>
                        <button class="sales-chip ${this.currentFilter === 'cash' ? 'active' : ''}" onclick="SalesView.filterByPaymentMethod('cash')">💵 Efectivo</button>
                        <button class="sales-chip ${this.currentFilter === 'card' ? 'active' : ''}" onclick="SalesView.filterByPaymentMethod('card')">💳 Tarjeta</button>
                        <button class="sales-chip ${this.currentFilter === 'qr' ? 'active' : ''}" onclick="SalesView.filterByPaymentMethod('qr')">📱 QR</button>
                        <button class="sales-chip ${this.currentFilter === 'other' ? 'active' : ''}" onclick="SalesView.filterByPaymentMethod('other')">➕ Otro</button>
                        <button class="sales-chip ${this.currentFilter === 'pending' ? 'active' : ''}" onclick="SalesView.filterByPaymentMethod('pending')">📝 Anotado</button>
                        <button class="sales-chip ${this.currentFilter === 'returns' ? 'active' : ''}" onclick="SalesView.filterByPaymentMethod('returns')">↩️ Notas de Crédito</button>
                    </div>
                </div>
            </div>
            
            <div class="sales-history-card">
                <div id="salesTable">${salesTableHtml}</div>
                ${this.hasMore ? `
                <div class="sales-load-more">
                    <button id="btnLoadMore" class="btn btn-secondary" onclick="SalesView.loadMore()">
                        Cargar más
                    </button>
                    <span>${this.allSales.length} ${this.currentFilter === 'returns' ? 'devoluciones' : 'ventas'}</span>
                </div>
                ` : ''}
            </div>
        `;
    },

    async loadMore() {
        if (this.isLoadingMore) return;
        this.isLoadingMore = true;
        
        const btn = document.getElementById('btnLoadMore');
        if (btn) btn.innerHTML = '<span class="spinner-inline"></span> Cargando...';

        this.offset += this.limit;
        
        let newSales = [];
        if (this.currentFilter === 'returns') {
            try {
                if (db.mode === 'sqlite') {
                    const params = { limit: this.limit, offset: this.offset };
                    if (this.dateFrom || this.dateTo) {
                        let from = this.dateFrom || this.dateTo;
                        let to = this.dateTo || this.dateFrom;
                        if (from > to) {
                            const tmp = from;
                            from = to;
                            to = tmp;
                        }
                        params.dateFrom = from;
                        params.dateTo = to;
                    }
                    newSales = await ApiClient.get('sale-returns/list/latest', params);
                }
            } catch (e) {
                console.error(e);
            }
        } else {
            if (this.dateFrom || this.dateTo) {
                let from = this.dateFrom || this.dateTo;
                let to = this.dateTo || this.dateFrom;
                if (from > to) {
                    const tmp = from;
                    from = to;
                    to = tmp;
                }

                newSales = await Sale.getByDateRange(from + 'T00:00:00', to + 'T23:59:59', {
                    limit: this.limit,
                    offset: this.offset
                });
            } else {
                newSales = await Sale.getLatest(this.limit, this.offset);
            }
        }

        if (newSales.length < this.limit) {
            this.hasMore = false;
        }

        this.allSales = [...this.allSales, ...newSales];
        this.isLoadingMore = false;
        await this.refresh();
    },

    async refresh() {
        const content = await this.render();
        const container = document.getElementById('view-container');
        if (container) container.innerHTML = content;
    },

    async init() {
        // No init needed for now
    },

    // Helper: Obtener fecha en formato YYYY-MM-DD en hora local
    getLocalDateString(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    // Helper: Comparar solo fechas (sin hora) en hora local
    compareDatesOnly(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);

        const d1Local = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
        const d2Local = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());

        if (d1Local < d2Local) return -1;
        if (d1Local > d2Local) return 1;
        return 0;
    },

    async filterByPaymentMethod(method) {
        this.currentFilter = method;
        this.offset = 0;
        this.allSales = [];
        await this.refresh();
    },

    ensureCalendarState() {
        // Cuando existe rango, mostrar el mes del "fin" para que el usuario vea el segundo clic.
        const baseKey = this.dateTo || this.dateFrom;
        let baseDate = null;

        if (baseKey) {
            // 12:00 para minimizar problemas de zona horaria al convertir desde string
            baseDate = new Date(`${baseKey}T12:00:00`);
        }

        if (!baseDate || Number.isNaN(baseDate.getTime())) {
            baseDate = new Date();
        }

        this._calendarYear = baseDate.getFullYear();
        this._calendarMonth = baseDate.getMonth();
    },

    getCalendarYears() {
        const now = new Date();
        const currentYear = now.getFullYear();
        const years = [];
        // Rango amplio para permitir navegar meses/años
        for (let y = currentYear - 3; y <= currentYear + 2; y++) years.push(y);
        return years;
    },

    getDateLocalTime(dateKey) {
        if (!dateKey) return null;
        const parts = String(dateKey).split('-');
        if (parts.length !== 3) return null;
        const [y, m, d] = parts.map(n => parseInt(n, 10));
        if ([y, m, d].some(Number.isNaN)) return null;
        return new Date(y, m - 1, d).getTime();
    },

    renderSalesHistoryDayGridButtons(year, monthIndex) {
        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
        const monthName = this._monthNames[monthIndex] || '';

        const fromTs = this.getDateLocalTime(this.dateFrom);
        const hasEnd = !!this.dateTo;
        const toTs = this.getDateLocalTime(hasEnd ? this.dateTo : this.dateFrom);

        const fromKey = this.dateFrom;
        const toKey = hasEnd ? this.dateTo : this.dateFrom;

        let html = '';
        for (let day = 1; day <= daysInMonth; day++) {
            const dd = String(day).padStart(2, '0');
            const mm = String(monthIndex + 1).padStart(2, '0');
            const dayKey = `${year}-${mm}-${dd}`;

            const dayTs = new Date(year, monthIndex, day).getTime();

            let cls = 'cash-history-day';
            const isFrom = fromKey === dayKey;
            const isTo = hasEnd && toKey === dayKey;

            if (isFrom || isTo) {
                cls += ' active';
            } else if (hasEnd && fromTs !== null && toTs !== null && dayTs >= fromTs && dayTs <= toTs) {
                cls += ' range';
            }

            html += `
                <button type="button"
                        class="${cls}"
                        onclick="SalesView.selectSalesCalendarDay(${day})">
                    <span>${day}</span>
                    <small>${monthName.slice(0, 3)}</small>
                </button>
            `;
        }

        return html;
    },

    refreshSalesHistoryDayGrid() {
        if (this._calendarYear === null || this._calendarMonth === null) {
            this.ensureCalendarState();
        }
        const gridEl = document.getElementById('salesHistoryDayGrid');
        const titleEl = document.getElementById('salesHistoryDayGridTitle');

        if (titleEl) titleEl.textContent = `${this._monthNames[this._calendarMonth]} ${this._calendarYear}`;
        if (gridEl) gridEl.innerHTML = this.renderSalesHistoryDayGridButtons(this._calendarYear, this._calendarMonth);
    },

    setSalesCalendarMonth(monthIndex) {
        this._calendarMonth = parseInt(monthIndex, 10);
        this.refreshSalesHistoryDayGrid();
    },

    setSalesCalendarYear(year) {
        this._calendarYear = parseInt(year, 10);
        this.refreshSalesHistoryDayGrid();
    },

    async selectSalesCalendarDay(day) {
        const year = this._calendarYear ?? new Date().getFullYear();
        const monthIndex = this._calendarMonth ?? new Date().getMonth();
        const dd = String(day).padStart(2, '0');
        const mm = String(monthIndex + 1).padStart(2, '0');
        const selectedKey = `${year}-${mm}-${dd}`;

        // 1er click: define inicio (día único)
        // 2do click: define fin del rango
        // 3er click (o más): reinicia el rango
        if (!this.dateFrom || (this.dateFrom && this.dateTo)) {
            this.dateFrom = selectedKey;
            this.dateTo = null;
        } else if (this.dateFrom && !this.dateTo) {
            this.dateTo = selectedKey;
            if (this.dateTo < this.dateFrom) {
                const tmp = this.dateFrom;
                this.dateFrom = this.dateTo;
                this.dateTo = tmp;
            }
        }

        this.offset = 0;
        this.allSales = [];
        this.hasMore = true;
        await this.refresh();
    },

    async applyDateFilter() {
        const fromInput = document.getElementById('dateFromFilter');
        const toInput = document.getElementById('dateToFilter');

        const fromVal = fromInput ? (fromInput.value || null) : null;
        const toVal = toInput ? (toInput.value || null) : null;

        let from = fromVal;
        let to = toVal;

        // Si el usuario seleccionó solo una fecha, se usa como inicio y fin del rango.
        if (from && !to) to = from;
        if (to && !from) from = to;

        if (from && to) {
            if (from > to) {
                const tmp = from;
                from = to;
                to = tmp;
                // Mantener inputs consistentes con el rango normalizado.
                if (fromInput) fromInput.value = from;
                if (toInput) toInput.value = to;
            }

            this.dateFrom = from;
            this.dateTo = to;
            this.offset = 0;
            this.allSales = await Sale.getByDateRange(from + 'T00:00:00', to + 'T23:59:59', { limit: this.limit, offset: 0 });
            this.hasMore = this.allSales.length === this.limit;
        } else {
            this.dateFrom = null;
            this.dateTo = null;
            this.offset = 0;
            this.allSales = await Sale.getLatest(this.limit, 0);
            this.hasMore = this.allSales.length === this.limit;
        }

        await this.refresh();
    },

    async selectToday() {
        const today = new Date();
        const todayStr = this.getLocalDateString(today);
        this.dateFrom = todayStr;
        // Un día solamente: dateTo se mantiene null hasta que selecciones un segundo día.
        this.dateTo = null;
        this._calendarYear = today.getFullYear();
        this._calendarMonth = today.getMonth();

        this.offset = 0;
        this.allSales = [];
        this.hasMore = true;
        await this.refresh();
    },

    async clearDateFilter() {
        this.dateFrom = null;
        this.dateTo = null;
        this.offset = 0;
        this.allSales = [];
        this.hasMore = true;
        const today = new Date();
        this._calendarYear = today.getFullYear();
        this._calendarMonth = today.getMonth();
        await this.refresh();
    },

    filterSalesByDate(sales) {
        // Si no hay filtro de fecha, mostrar todas las ventas
        if (!this.dateFrom && !this.dateTo) {
            return sales;
        }

        let from = this.dateFrom || this.dateTo;
        let to = this.dateTo || this.dateFrom;
        if (!from || !to) return sales;
        if (from > to) {
            const tmp = from;
            from = to;
            to = tmp;
        }

        // Parsear fecha del filtro (YYYY-MM-DD) y convertir a fecha local sin hora
        const fromParts = from.split('-');
        const toParts = to.split('-');
        const fromLocal = new Date(parseInt(fromParts[0]), parseInt(fromParts[1]) - 1, parseInt(fromParts[2])).getTime();
        const toLocal = new Date(parseInt(toParts[0]), parseInt(toParts[1]) - 1, parseInt(toParts[2])).getTime();

        // Filtrar por rango (inclusive)
        return sales.filter(sale => {
            const saleDate = new Date(sale.date);
            const saleDateLocal = new Date(saleDate.getFullYear(), saleDate.getMonth(), saleDate.getDate()).getTime();
            return saleDateLocal >= fromLocal && saleDateLocal <= toLocal;
        });
    },

    customerCache: {},

    async getCustomerName(customerId) {
        if (!customerId || customerId === 'null' || customerId === '0' || customerId === 0) return 'Público General';
        if (this.customerCache[customerId]) return this.customerCache[customerId];
        
        try {
            const customer = await Customer.getById(customerId);
            const name = customer ? customer.name : 'Público General';
            this.customerCache[customerId] = name;
            return name;
        } catch (error) {
            console.error(`Error obteniendo cliente ${customerId}:`, error);
            return 'Público General';
        }
    },

    async renderSalesTable(sales) {
        // 1. Filtrar por fecha
        let filtered = this.filterSalesByDate(sales);

        // 2. Filtrar por búsqueda si hay consulta activa
        if (this.currentSearchQuery) {
            const query = this.currentSearchQuery.toLowerCase().trim();
            filtered = filtered.filter(s => {
                let customerName = '';
                let saleNumStr = '';
                
                if (this.currentFilter === 'returns') {
                    customerName = (s.clientName || 'Público General').toLowerCase();
                    saleNumStr = String(s.saleNumber || s.saleId || s.id).toLowerCase();
                } else {
                    customerName = (this.customerCache[s.customerId] || 'Público General').toLowerCase();
                    saleNumStr = String(s.saleNumber || s.id).toLowerCase();
                }
                
                return customerName.includes(query) || saleNumStr.includes(query);
            });
        }

        if (this.currentFilter === 'returns') {
            if (filtered.length === 0) {
                return `<div class="empty-state animate-fade-in"><div class="empty-state-icon">↩️</div>No hay Notas de Crédito registradas</div>`;
            }
            return await this.renderReturnsTable(filtered);
        }

        // OPTIMIZACIÓN FASE 5: Precargar todos los clientes únicos para evitar N+1
        const uniqueCustomerIds = [...new Set(filtered.map(s => s.customerId).filter(id => id && id !== 'null' && id !== '0' && id !== 0))];
        if (uniqueCustomerIds.length > 0) {
            try {
                // Si hay muchos, esto es mucho más rápido que ir uno por uno
                const customers = await Promise.all(uniqueCustomerIds.map(id => Customer.getById(id)));
                customers.forEach(c => {
                    if (c) this.customerCache[c.id] = c.name;
                });
            } catch (e) {
                console.warn('Error precargando clientes:', e);
            }
        }
        
        const dateFilteredSales = filtered;

        if (dateFilteredSales.length === 0) {
            let dateText = '';
            if (this.dateFrom || this.dateTo) {
                const from = this.dateFrom || this.dateTo;
                const to = this.dateTo || this.dateFrom;
                const fromObj = new Date(from + 'T00:00:00');
                const toObj = new Date(to + 'T00:00:00');
                dateText = from === to
                    ? ` del ${formatDate(fromObj.toISOString())}`
                    : ` del ${formatDate(fromObj.toISOString())} al ${formatDate(toObj.toISOString())}`;
            }
            return `<div class="empty-state animate-fade-in"><div class="empty-state-icon">📋</div>No hay ventas registradas${dateText}</div>`;
        }

        if (this.currentFilter !== 'all') {
            const filteredSales = dateFilteredSales.filter(s => {
                if (this.currentFilter === 'pending') {
                    return s.status !== 'cancelled' && (s.status === 'pending' || s.status === 'partial' || s.paymentMethod === 'pending');
                }
                if (this.currentFilter === 'mixed') {
                    return s.status !== 'cancelled' && s.paymentDetails && typeof s.paymentDetails === 'object' &&
                        Object.entries(s.paymentDetails).filter(([, amt]) => parseFloat(amt) > 0).length > 1;
                }
                if (s.status === 'cancelled' && this.currentFilter !== 'all') return false;
                if (s.paymentDetails && typeof s.paymentDetails === 'object') {
                    return s.paymentDetails[this.currentFilter] !== undefined && parseFloat(s.paymentDetails[this.currentFilter]) > 0;
                }
                return s.paymentMethod === this.currentFilter;
            });

            if (filteredSales.length === 0) {
                const filterName = this.getPaymentMethodName(this.currentFilter);
                let dateText = '';
                if (this.dateFrom || this.dateTo) {
                    const from = this.dateFrom || this.dateTo;
                    const to = this.dateTo || this.dateFrom;
                    const fromObj = new Date(from + 'T00:00:00');
                    const toObj = new Date(to + 'T00:00:00');
                    dateText = from === to
                        ? ` del ${formatDate(fromObj.toISOString())}`
                        : ` del ${formatDate(fromObj.toISOString())} al ${formatDate(toObj.toISOString())}`;
                }
                return `<div class="empty-state animate-fade-in"><div class="empty-state-icon">📋</div>No hay ventas en ${filterName}${dateText}</div>`;
            }

            return await this.renderGroupedSalesTable(filteredSales, [this.currentFilter]);
        }

        return await this.renderGroupedSalesTable(dateFilteredSales);
    },

    getAmountPaidByMethodSync(sale, targetMethod) {
        if (sale._payments && Array.isArray(sale._payments)) {
            return sale._payments
                .filter(p => (p.paymentMethod || 'cash') === targetMethod)
                .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        }

        if (sale.paymentDetails && typeof sale.paymentDetails === 'object') {
            return parseFloat(sale.paymentDetails[targetMethod]) || 0;
        }

        if (sale.paymentMethod === targetMethod) {
            return sale.status === 'completed'
                ? (parseFloat(sale.total) || 0)
                : (parseFloat(sale.paidAmount) || 0);
        }

        return 0;
    },

    async renderGroupedSalesTable(sales, filterMethods = null) {
        const groupedSales = {
            cash: [], card: [], qr: [], other: [], pending: [], mixed: []
        };

        sales.forEach(sale => {
            if (filterMethods && filterMethods.length === 1) {
                const method = filterMethods[0];
                if (groupedSales[method]) {
                    groupedSales[method].push(sale);
                    return;
                }
            }

            if (sale.paymentMethod === 'pending' || sale.status === 'pending' || sale.status === 'partial') {
                groupedSales.pending.push(sale);
            }
            else if (sale.paymentDetails && typeof sale.paymentDetails === 'object' && Object.keys(sale.paymentDetails).length > 0) {
                groupedSales.mixed.push(sale);
            }
            else {
                const method = sale.paymentMethod || 'cash';
                if (groupedSales[method]) {
                    groupedSales[method].push(sale);
                } else {
                    groupedSales.other.push(sale);
                }
            }
        });

        const order = ['cash', 'card', 'qr', 'other', 'pending', 'mixed'];
        const methodsToShow = filterMethods || order;
        const grandTotal = sales.reduce((sum, sale) => sum + (parseFloat(sale.paidAmount) || 0), 0);
        const grandCount = sales.length;

        let dateText = '';
        if (this.dateFrom || this.dateTo) {
            const selectedDate = this.dateFrom || this.dateTo;
            const dateObj = new Date(selectedDate + 'T00:00:00');
            dateText = ` (${formatDate(dateObj.toISOString())})`;
        }

        let html = '';
        if (!filterMethods || filterMethods.length === order.length) {
            html += `
                <div style="margin-bottom: 1.5rem; padding: 1rem; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border-radius: 0.5rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                        <div>
                            <h3 style="margin: 0; font-size: 1.1rem; font-weight: 600; opacity: 0.9;">📊 Resumen General${dateText}</h3>
                            <p style="margin: 0.25rem 0 0 0; font-size: 0.9rem; opacity: 0.8;">${grandCount} venta${grandCount !== 1 ? 's' : ''} en total</p>
                        </div>
                        <div style="font-size: 1.5rem; font-weight: 700; background: rgba(255,255,255,0.2); padding: 0.5rem 1rem; border-radius: 0.375rem;">Total Pagado: ${formatCLP(grandTotal)}</div>
                    </div>
                </div>
            `;
        }

        for (const method of methodsToShow) {
            const methodSales = groupedSales[method];
            if (methodSales.length === 0) continue;

            const methodName = method === 'mixed' ? 'Pago Mixto' : this.getPaymentMethodName(method);

            const total = methodSales.reduce((sum, sale) => {
                if (method === 'mixed') {
                    if (sale.paymentDetails && typeof sale.paymentDetails === 'object') {
                        return sum + Object.values(sale.paymentDetails).reduce((s, a) => s + (parseFloat(a) || 0), 0);
                    }
                    if (sale._payments) {
                        return sum + sale._payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
                    }
                    return sum + (parseFloat(sale.paidAmount) || 0);
                }
                return sum + this.getAmountPaidByMethodSync(sale, method);
            }, 0);
            
            const count = methodSales.length;
            const icons = { cash: '💵', card: '💳', qr: '📱', other: '➕', pending: '📝', mixed: '🔀' };

            const saleRows = await Promise.all(methodSales.map(s => this.renderSaleRow(s)));

            html += `
                <div class="sales-history-card">
                    <div class="sales-history-card-header">
                        <h3>
                            <span>${icons[method] || '📋'}</span>
                            <span>${methodName}</span>
                        </h3>
                        <div style="display: flex; gap: 1.5rem; align-items: center;">
                            <span style="font-size: 0.95rem; opacity: 0.9;">${count} venta${count !== 1 ? 's' : ''}</span>
                            <div class="sales-history-summary-pill">Total: ${formatCLP(total)}</div>
                        </div>
                    </div>
                    <div class="table-container">
                        <table class="sales-table">
                            <thead>
                                <tr>
                                    <th style="width: 80px;" data-label="#">#</th>
                                    <th style="width: 150px;" data-label="Fecha y Hora">Fecha y Hora</th>
                                    <th style="width: 70px;" data-label="Items">Items</th>
                                    <th style="width: 180px;" data-label="Cliente">Cliente</th>
                                    <th style="width: 200px;" data-label="Método de Pago">Método de Pago</th>
                                    <th style="width: 120px;" data-label="Total">Total</th>
                                    <th style="width: 100px;" data-label="Estado">Estado</th>
                                    <th style="width: 140px;" data-label="Acciones">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${saleRows.join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        return html || `<div class="empty-state"><div class="empty-state-icon">📋</div>No hay ventas registradas</div>`;
    },

    async renderSaleRow(s) {
        const customerName = await this.getCustomerName(s.customerId);

        let paymentMethodDisplay = '';
        if (s._payments && s._payments.length > 0) {
            const paymentsByMethod = {};
            s._payments.forEach(payment => {
                const method = payment.paymentMethod || 'cash';
                if (!paymentsByMethod[method]) {
                    paymentsByMethod[method] = 0;
                }
                paymentsByMethod[method] += parseFloat(payment.amount) || 0;
            });

            paymentMethodDisplay = Object.entries(paymentsByMethod).map(([method, amount]) => {
                return `${formatCLP(amount)} ${this.getPaymentMethodName(method)}`;
            }).join(' + ');
        } else if (s.paymentDetails && typeof s.paymentDetails === 'object' && Object.keys(s.paymentDetails).length > 0) {
            paymentMethodDisplay = Object.entries(s.paymentDetails)
                .filter(([m, amount]) => parseFloat(amount) > 0)
                .map(([m, amount]) => `${formatCLP(parseFloat(amount))} ${this.getPaymentMethodName(m)}`)
                .join(' + ');
        } else {
            paymentMethodDisplay = this.getPaymentMethodName(s.paymentMethod);
        }

        if (s.status === 'pending' || s.status === 'partial') {
            const pendingText = this.getPaymentMethodName('pending');
            if (paymentMethodDisplay && !paymentMethodDisplay.includes(pendingText)) {
                paymentMethodDisplay += ` + ${pendingText}`;
            } else if (!paymentMethodDisplay) {
                paymentMethodDisplay = pendingText;
            }
        }

        const statusBadge = s.status === 'completed'
            ? '<span class="status-badge status-completed">Completada</span>'
            : s.status === 'partial'
                ? '<span class="status-badge status-partial">Parcial</span>'
                : s.status === 'cancelled'
                    ? '<span class="status-badge status-cancelled" style="background: #94a3b8; color: white;">Anulada</span>'
                    : '<span class="status-badge status-pending">Pendiente</span>';

        // Categorizar método para el tag
        let methodClass = 'method-tag-other';
        if (s.paymentDetails && typeof s.paymentDetails === 'object' && Object.keys(s.paymentDetails).filter(k=>parseFloat(s.paymentDetails[k])>0).length > 1) methodClass = 'method-tag-mixed';
        else if (s.paymentMethod === 'cash') methodClass = 'method-tag-cash';
        else if (s.paymentMethod === 'card') methodClass = 'method-tag-card';
        else if (s.paymentMethod === 'qr') methodClass = 'method-tag-qr';
        else if (s.paymentMethod === 'cancelled' || s.status === 'cancelled') methodClass = 'method-tag-cancelled';
        else if (s.paymentMethod === 'pending' || s.status === 'pending') methodClass = 'method-tag-pending';

        const isDebt = s.status === 'pending' || s.status === 'partial';
        const avatarBg = isDebt ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)';
        const avatarBorder = isDebt ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)';
        const avatarColor = isDebt ? '#d97706' : 'var(--primary, #10b981)';

        return `
            <tr class="animate-fade-in">
                <td data-label="Folio"><span class="sale-number" style="font-weight: 700; color: var(--primary, #10b981);">#${s.saleNumber}</span></td>
                <td data-label="Fecha y Hora"><span class="sale-date" style="font-family: 'Inter', sans-serif;">${formatDateTime(s.date)}</span></td>
                <td data-label="Items"><span style="background: rgba(0,0,0,0.04); padding: 0.2rem 0.5rem; border-radius: 0.25rem; font-weight: 600; font-family: 'Inter', sans-serif;">${s.items.length}</span></td>
                <td data-label="Cliente">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="width: 32px; height: 32px; background: ${avatarBg}; border: 1px solid ${avatarBorder}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; color: ${avatarColor}; flex-shrink: 0;">
                            ${customerName.slice(0, 2).toUpperCase()}
                        </div>
                        <span class="sale-customer" style="${isDebt ? 'color: #d97706; font-weight: 700;' : ''}">${safeHTML(customerName)}</span>
                    </div>
                </td>
                <td data-label="Pago">
                    <span class="method-tag ${methodClass}">
                        ${paymentMethodDisplay}
                    </span>
                </td>
                <td data-label="Total"><strong style="color: var(--text-color, #0f172a); font-family: 'Inter', sans-serif;">${formatCLP(s.total)}</strong></td>
                <td data-label="Estado">${statusBadge}</td>
                <td data-label="Acciones">
                    <div style="display: flex; gap: 0.35rem; justify-content: flex-end;">
                        <button class="action-btn btn-view" onclick="SalesView.viewSale(${s.id})" title="Ver detalles">
                            👁️
                        </button>
                        ${PermissionService.can('sales.edit') ? `
                        <button class="action-btn btn-edit" onclick="SalesView.editSale(${s.id})" title="Editar venta">
                            ✏️
                        </button>` : ''}
                        ${PermissionService.can('sales.return') ? `
                        <button class="action-btn btn-return" onclick="SalesView.showReturnModal(${s.id})" title="Devolver productos">
                            ↩️
                        </button>` : ''}
                        ${PermissionService.can('sales.delete') ? `
                        <button class="action-btn btn-delete" onclick="SalesView.deleteSale(${s.id})" title="Eliminar venta">
                            🗑️
                        </button>` : ''}
                    </div>
                </td>
            </tr>
        `;
    },

    getPaymentMethodName(method) {
        const names = {
            cash: 'Efectivo',
            card: 'Tarjeta',
            qr: 'QR',
            other: 'Otro',
            pending: 'Anotado',
            debt: 'Anotado',
            creditBalance: 'Saldo Favor',
            cancelled: 'Venta Anulada',
            returns: 'Notas de Crédito'
        };
        return names[method] || method;
    },

    async viewSale(saleId) {
        const sale = await Sale.getById(saleId);
        if (!sale) {
            showNotification('Venta no encontrada', 'error');
            return;
        }

        const customer = sale.customerId ? await Customer.getById(sale.customerId) : null;
        const payments = await Payment.getBySale(saleId);

        // Calcular total pagado
        const totalPaid = parseFloat(sale.paidAmount) || 0;
        const totalSale = parseFloat(sale.total) || 0;
        const pendingAmount = totalSale - totalPaid;

        let paymentInfoHtml = '';

        // Construir lista de todos los pagos (iniciales y posteriores)
        const allPayments = [];

        // 1. Agregar pago inicial desde paymentDetails (si existe y no está en Payment records)
        if (sale.paymentDetails && typeof sale.paymentDetails === 'object' && Object.keys(sale.paymentDetails).length > 0) {
            const initialPaymentAmount = Object.values(sale.paymentDetails).reduce((sum, amount) => sum + (parseFloat(amount) || 0), 0);

            // Verificar si este pago inicial ya está registrado en Payment records
            const initialPaymentsTotal = payments
                .filter(p => {
                    const paymentDate = new Date(p.date);
                    const saleDate = new Date(sale.date);
                    // Considerar pagos del mismo día como pago inicial
                    return paymentDate.toDateString() === saleDate.toDateString();
                })
                .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

            // Si el monto inicial no coincide con los Payment records, mostrar paymentDetails
            if (Math.abs(initialPaymentAmount - initialPaymentsTotal) > 0.01) {
                Object.entries(sale.paymentDetails).forEach(([method, amount]) => {
                    const amountNum = parseFloat(amount) || 0;
                    if (amountNum > 0) {
                        allPayments.push({
                            type: 'initial',
                            method: method,
                            amount: amountNum,
                            date: sale.date,
                            notes: 'Pago inicial de la venta'
                        });
                    }
                });
            }
        }

        // 2. Agregar todos los Payment records (pagos posteriores)
        payments.forEach(payment => {
            allPayments.push({
                type: 'subsequent',
                method: payment.paymentMethod || 'cash',
                amount: parseFloat(payment.amount) || 0,
                date: payment.date,
                notes: payment.notes || 'Pago de deuda'
            });
        });

        // Ordenar pagos por fecha
        allPayments.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Generar HTML de pagos
        if (allPayments.length > 0) {
            // Agrupar por método para resumen
            const paymentsByMethod = {};
            allPayments.forEach(payment => {
                const method = payment.method || 'cash';
                if (!paymentsByMethod[method]) {
                    paymentsByMethod[method] = 0;
                }
                paymentsByMethod[method] += payment.amount;
            });

            paymentInfoHtml = `
                <div style="margin-top: 1rem; padding: 1rem; background: var(--light); border-radius: 0.375rem;">
                    <h4 style="margin-bottom: 0.75rem; font-size: 1rem;">💳 Pagos Realizados:</h4>
                    
                    <!-- Lista detallada de pagos -->
                    <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
                        ${allPayments.map((payment, index) => {
                const isInitial = payment.type === 'initial';
                const paymentDate = new Date(payment.date);
                return `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: white; border-radius: 0.25rem; border-left: 3px solid ${isInitial ? 'var(--primary)' : 'var(--success)'};">
                                    <div style="flex: 1;">
                                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                                            <span style="font-weight: 600; color: var(--primary);">
                                                ${isInitial ? '💰' : '💵'} ${this.getPaymentMethodName(payment.method)}
                                            </span>
                                            ${isInitial ? '<span style="font-size: 0.75rem; color: var(--secondary); background: var(--light); padding: 0.125rem 0.5rem; border-radius: 0.25rem;">Inicial</span>' : ''}
                                        </div>
                                        <div style="font-size: 0.85rem; color: var(--secondary);">
                                            ${formatDateTime(payment.date)}
                                            ${payment.notes ? ` • ${safeHTML(payment.notes)}` : ''}
                                        </div>
                                    </div>
                                    <div style="font-weight: 700; font-size: 1.1rem; color: var(--success); margin-left: 1rem;">
                                        ${formatCLP(payment.amount)}
                                    </div>
                                </div>
                            `;
            }).join('')}
                    </div>
                    
                    <!-- Resumen por método -->
                    <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 2px solid var(--border);">
                        <h5 style="margin-bottom: 0.5rem; font-size: 0.9rem; color: var(--secondary);">Resumen por Método:</h5>
                        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                            ${Object.entries(paymentsByMethod).map(([method, totalByMethod]) => `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: white; border-radius: 0.25rem;">
                                    <span><strong>${this.getPaymentMethodName(method)}:</strong></span>
                                    <span style="font-weight: 600; color: var(--primary);">${formatCLP(totalByMethod)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <!-- Totales -->
                    <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 2px solid var(--border);">
                        <div style="display: flex; justify-content: space-between; font-weight: 600; font-size: 1.1rem; margin-bottom: 0.5rem;">
                            <span>Total Pagado:</span>
                            <span style="color: var(--success);">${formatCLP(totalPaid)}</span>
                        </div>
                        ${pendingAmount > 0 ? `
                            <div style="display: flex; justify-content: space-between; color: var(--warning); font-weight: 600;">
                                <span>💰 Pendiente:</span>
                                <span>${formatCLP(pendingAmount)}</span>
                            </div>
                        ` : `
                            <div style="display: flex; justify-content: space-between; color: var(--success); font-weight: 600;">
                                <span>✅ Venta Completada</span>
                            </div>
                        `}
                    </div>
                </div>
            `;
        } else {
            // Si no hay pagos registrados pero hay deuda pendiente
            if (sale.status === 'pending' || sale.status === 'partial') {
                paymentInfoHtml = `
                    <div style="margin-top: 1rem; padding: 1rem; background: var(--light); border-radius: 0.375rem;">
                        <div style="display: flex; justify-content: space-between; font-weight: 600; font-size: 1.1rem;">
                            <span>Total de la Venta:</span>
                            <span>${formatCLP(totalSale)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; color: var(--warning); font-weight: 600; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--border);">
                            <span>💰 Pendiente:</span>
                            <span>${formatCLP(pendingAmount)}</span>
                        </div>
                    </div>
                `;
            }
        }

        const content = `
            <div style="margin-bottom: 1.5rem; padding: 1rem; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 0.5rem; border-left: 4px solid var(--primary);">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
                    <div>
                        <h3 style="margin: 0 0 0.5rem 0; font-size: 1.3rem; color: var(--primary);">Venta #${sale.saleNumber}</h3>
                        <p style="margin: 0; color: var(--secondary); font-size: 0.9rem;"><strong>Fecha:</strong> ${formatDateTime(sale.date)}</p>
                    </div>
                    <div>
                        ${sale.status === 'completed'
                ? '<span class="badge badge-success" style="font-size: 0.9rem;">✅ Completada</span>'
                : sale.status === 'partial'
                    ? '<span class="badge badge-warning" style="font-size: 0.9rem;">⚠️ Parcial</span>'
                    : '<span class="badge badge-danger" style="font-size: 0.9rem;">📝 Pendiente</span>'}
                    </div>
                </div>
                ${customer ? `
                    <div style="padding: 0.75rem; background: white; border-radius: 0.375rem; border: 1px solid var(--border);">
                        <div style="font-size: 0.85rem; color: var(--secondary); margin-bottom: 0.25rem;">Cliente:</div>
                        <div style="font-size: 1.1rem; font-weight: 700; color: var(--primary);">👤 ${safeHTML(customer.name)}</div>
                    </div>
                ` : ''}
            </div>
            
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th>Cantidad</th>
                            <th>Precio Unitario</th>
                            <th>Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sale.items.map(item => `
                            <tr>
                                <td>${safeHTML(item.name)}</td>
                                <td>${item.quantity}</td>
                                <td>${formatCLP(item.unitPrice ?? item.price ?? 0)}</td>
                                <td><strong>${formatCLP(item.total)}</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            ${paymentInfoHtml}
            
            <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border);">
                <div style="display: flex; justify-content: space-between; font-size: 1.1rem;">
                    <strong>Total de la Venta:</strong>
                    <strong>${formatCLP(sale.total)}</strong>
                </div>
            </div>
        `;

        // C5: Obtener resumen de devoluciones para esta venta
        let returnsHtml = '';
        try {
            const returnSummary = await SaleReturnService.getReturnSummary(sale.id);
            if (returnSummary.returns.length > 0) {
                returnsHtml = `
                    <div style="margin-top: 1.5rem; padding: 1rem; background: #fef3c7; border-radius: 0.375rem; border-left: 4px solid #f59e0b;">
                        <h4 style="margin: 0 0 0.75rem 0; color: #92400e;">↩️ Devoluciones Registradas (${returnSummary.returns.length})</h4>
                        ${returnSummary.returns.map(ret => `
                            <div style="padding: 0.5rem; margin-bottom: 0.5rem; background: white; border-radius: 0.25rem; border: 1px solid #fde68a;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <strong style="color: #92400e;">Dev #${ret.id}</strong>
                                        <span style="font-size: 0.85rem; color: var(--secondary); margin-left: 0.5rem;">${formatDateTime(ret.date)}</span>
                                    </div>
                                    <strong style="color: #dc2626;">-${formatCLP(ret.totalReturned)}</strong>
                                </div>
                                <div style="font-size: 0.85rem; color: var(--secondary); margin-top: 0.25rem;">
                                    ${(ret.items || []).map(i => `${safeHTML(i.name)} x${i.quantity}`).join(', ')}
                                    ${ret.reason ? ` — <em>${safeHTML(ret.reason)}</em>` : ''}
                                </div>
                            </div>
                        `).join('')}
                        <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #fde68a; display: flex; justify-content: space-between; font-weight: 600;">
                            <span>Total Devuelto:</span>
                            <span style="color: #dc2626;">-${formatCLP(returnSummary.totalReturned)}</span>
                        </div>
                    </div>
                `;
            }
        } catch (e) {
            // Silencio
        }

        const fullContent = content + returnsHtml;

        const footer = `
            <button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>
            ${PermissionService.can('sales.return') ? `<button class="btn btn-warning" onclick="SalesView.showReturnModal(${sale.id})" style="margin-left: 0.5rem;">↩️ Devolver</button>` : ''}
            ${PermissionService.can('sales.edit') ? `<button class="btn btn-primary" onclick="SalesView.editSale(${sale.id})" style="margin-left: 0.5rem;">✏️ Editar Venta</button>` : ''}
        `;

        showModal(fullContent, { title: `Venta #${sale.saleNumber}`, footer, width: '700px' });
    },

    async handleSearch(value) {
        this.currentSearchQuery = value;
        const salesTableEl = document.getElementById('salesTable');
        if (salesTableEl) {
            salesTableEl.innerHTML = await this.renderSalesTable(this.allSales);
        }
    },

    _tempEditingSale: null,

    async editSale(saleId) {
        const sale = await Sale.getById(saleId);
        if (!sale) {
            showNotification('Venta no encontrada', 'error');
            return;
        }

        // Clonar la venta para editar localmente
        this._tempEditingSale = JSON.parse(JSON.stringify(sale));
        const allCustomers = await Customer.getAll();

        const renderForm = () => {
            const s = this._tempEditingSale;
            const subtotal = s.items.reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0);
            s.total = roundPrice(subtotal);

            // Asegurarse de que paymentDetails existe para pagos mixtos
            if (!s.paymentDetails || typeof s.paymentDetails !== 'object') {
                s.paymentDetails = { cash: 0, card: 0, qr: 0 };
                // Si la venta ya estaba pagada por un método, asignarlo
                if (s.paymentMethod && s.paymentMethod !== 'mixed' && s.paymentMethod !== 'pending') {
                    s.paymentDetails[s.paymentMethod] = s.paidAmount || s.total;
                }
            }

            const currentPaid = Object.values(s.paymentDetails).reduce((sum, a) => sum + (parseFloat(a) || 0), 0);
            const pendingAmount = s.total - currentPaid;

            return `
                <div class="edit-sale-container" style="background: var(--bg-color); border-radius: 0.5rem; overflow: hidden;">
                    
                    <!-- Top Section: Info -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; padding: 1.5rem; background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <div class="form-group" style="margin: 0;">
                            <label style="color: var(--secondary); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em;">Cliente Asignado</label>
                            <select id="editSaleCustomer" class="form-control" style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: var(--text-color); margin-top: 0.25rem;" onchange="SalesView._tempEditingSale.customerId = this.value ? parseInt(this.value) : null">
                                <option value="">Sin cliente (Público General)</option>
                                ${allCustomers.map(c => `
                                    <option value="${c.id}" ${s.customerId === c.id ? 'selected' : ''}>${safeHTML(c.name)}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-group" style="margin: 0;">
                            <label style="color: var(--secondary); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em;">Fecha y Hora</label>
                            <input type="datetime-local" class="form-control" style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: var(--text-color); margin-top: 0.25rem;" value="${s.date.slice(0, 19)}" onchange="SalesView._tempEditingSale.date = this.value">
                        </div>
                    </div>

                    <!-- Middle Section: Cart Items -->
                    <div style="padding: 1.5rem;">
                        <h4 style="margin-top: 0; margin-bottom: 1rem; color: var(--text-color); font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem;">
                            🛒 Productos en esta Venta
                        </h4>
                        
                        <div id="editSaleItems" style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 350px; overflow-y: auto; padding-right: 0.5rem;">
                            ${s.items.map((item, index) => `
                                <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 0.75rem 1rem; border-radius: 0.5rem; transition: all 0.2s;">
                                    
                                    <div style="flex: 1; min-width: 0;">
                                        <div style="font-weight: 600; color: var(--text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${safeHTML(item.name)}</div>
                                        <div style="font-size: 0.8rem; color: var(--secondary); margin-top: 0.2rem;">
                                            Precio Unitario: ${formatCLP(item.unitPrice)}
                                        </div>
                                    </div>
                                    
                                    <div style="display: flex; align-items: center; gap: 1.5rem; margin-left: 1rem;">
                                        <!-- Quantity Controls -->
                                        <div style="display: flex; align-items: center; background: rgba(0,0,0,0.3); border-radius: 0.375rem; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
                                            <button class="action-btn" onclick="SalesView.adjustEditQuantity(${index}, -1)" style="padding: 0.4rem 0.6rem; border: none; background: transparent; color: var(--text-color); cursor: pointer; border-right: 1px solid rgba(255,255,255,0.1);">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                            </button>
                                            <input type="number" value="${item.quantity}" min="0.001" step="${item.type === 'weight' ? '0.001' : '1'}" 
                                                   style="width: 50px; text-align: center; background: transparent; border: none; color: var(--text-color); font-weight: 600; padding: 0.4rem 0;"
                                                   onchange="SalesView.updateEditItem(${index}, 'quantity', this.value)">
                                            <button class="action-btn" onclick="SalesView.adjustEditQuantity(${index}, 1)" style="padding: 0.4rem 0.6rem; border: none; background: transparent; color: var(--text-color); cursor: pointer; border-left: 1px solid rgba(255,255,255,0.1);">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                            </button>
                                        </div>
                                        
                                        <!-- Item Total -->
                                        <div style="width: 90px; text-align: right; font-weight: 700; color: var(--primary);">
                                            ${formatCLP(item.total)}
                                        </div>
                                        
                                        <!-- Delete Button -->
                                        <button onclick="SalesView.removeEditItem(${index})" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); width: 32px; height: 32px; border-radius: 0.375rem; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(239, 68, 68, 0.2)'" onmouseout="this.style.background='rgba(239, 68, 68, 0.1)'" title="Eliminar producto">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        
                        <!-- Add Product Search -->
                        <div style="margin-top: 1rem; position: relative;">
                            <div style="display: flex; align-items: center; background: rgba(0,0,0,0.2); border: 1px dashed rgba(255,255,255,0.2); border-radius: 0.5rem; padding: 0.25rem;">
                                <span style="padding: 0 0.75rem; opacity: 0.5;">🔍</span>
                                <input type="text" id="editProductSearch" style="flex: 1; background: transparent; border: none; color: var(--text-color); padding: 0.75rem 0; outline: none;" placeholder="Buscar producto para agregar a esta venta..." 
                                       oninput="SalesView.searchEditProducts(this.value)" autocomplete="off">
                            </div>
                            <div id="editProductResults" class="pos-search-results" style="display: none; position: absolute; top: 100%; left: 0; right: 0; z-index: 100; margin-top: 0.25rem; background: var(--bg-color); border: 1px solid var(--border); border-radius: 0.5rem; box-shadow: 0 10px 25px rgba(0,0,0,0.5);"></div>
                        </div>
                    </div>

                    <!-- Bottom Section: Payments -->
                    <div style="padding: 1.5rem; background: rgba(255,255,255,0.02); border-top: 1px solid rgba(255,255,255,0.05);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h4 style="margin: 0; color: var(--text-color); font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem;">
                                💳 Ajuste de Pagos
                            </h4>
                            <div style="text-align: right;">
                                <div style="font-size: 0.85rem; color: var(--secondary); text-transform: uppercase; letter-spacing: 0.05em;">Total Venta</div>
                                <div style="font-size: 1.5rem; font-weight: 700; color: var(--text-color);">${formatCLP(s.total)}</div>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
                            <!-- Efectivo -->
                            <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.5rem; padding: 1rem; position: relative;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                    <label style="color: var(--secondary); font-size: 0.85rem; font-weight: 600;">💵 Efectivo</label>
                                    <button onclick="SalesView.assignFullPayment('cash')" style="background: none; border: none; color: var(--primary); font-size: 0.75rem; cursor: pointer; padding: 0;">Asignar Resto</button>
                                </div>
                                <div style="position: relative;">
                                    <span style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: var(--secondary);">$</span>
                                    <input type="number" value="${s.paymentDetails.cash || 0}" min="0" onchange="SalesView.updateEditPayment('cash', this.value)" style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: var(--success); font-weight: 700; font-size: 1.1rem; padding: 0.5rem 0.5rem 0.5rem 1.75rem; border-radius: 0.375rem; outline: none;">
                                </div>
                            </div>
                            <!-- Tarjeta -->
                            <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.5rem; padding: 1rem; position: relative;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                    <label style="color: var(--secondary); font-size: 0.85rem; font-weight: 600;">💳 Tarjeta</label>
                                    <button onclick="SalesView.assignFullPayment('card')" style="background: none; border: none; color: var(--primary); font-size: 0.75rem; cursor: pointer; padding: 0;">Asignar Resto</button>
                                </div>
                                <div style="position: relative;">
                                    <span style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: var(--secondary);">$</span>
                                    <input type="number" value="${s.paymentDetails.card || 0}" min="0" onchange="SalesView.updateEditPayment('card', this.value)" style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: var(--success); font-weight: 700; font-size: 1.1rem; padding: 0.5rem 0.5rem 0.5rem 1.75rem; border-radius: 0.375rem; outline: none;">
                                </div>
                            </div>
                            <!-- QR -->
                            <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.5rem; padding: 1rem; position: relative;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                    <label style="color: var(--secondary); font-size: 0.85rem; font-weight: 600;">📱 Transfer / QR</label>
                                    <button onclick="SalesView.assignFullPayment('qr')" style="background: none; border: none; color: var(--primary); font-size: 0.75rem; cursor: pointer; padding: 0;">Asignar Resto</button>
                                </div>
                                <div style="position: relative;">
                                    <span style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: var(--secondary);">$</span>
                                    <input type="number" value="${s.paymentDetails.qr || 0}" min="0" onchange="SalesView.updateEditPayment('qr', this.value)" style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: var(--success); font-weight: 700; font-size: 1.1rem; padding: 0.5rem 0.5rem 0.5rem 1.75rem; border-radius: 0.375rem; outline: none;">
                                </div>
                            </div>
                        </div>
                        
                        ${Math.abs(pendingAmount) > 0.01 ? `
                            <div style="margin-top: 1rem; padding: 0.75rem; background: ${pendingAmount > 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; border: 1px solid ${pendingAmount > 0 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)'}; border-radius: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                                <div style="color: ${pendingAmount > 0 ? '#f59e0b' : '#ef4444'}; font-weight: 600; display: flex; align-items: center; gap: 0.5rem;">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                                    ${pendingAmount > 0 ? 'Falta dinero por asignar' : 'Hay dinero sobrante en los pagos'}
                                </div>
                                <div style="color: ${pendingAmount > 0 ? '#f59e0b' : '#ef4444'}; font-weight: 700; font-size: 1.1rem;">
                                    Diferencia: ${formatCLP(Math.abs(pendingAmount))}
                                </div>
                            </div>
                        ` : `
                            <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 0.5rem; display: flex; align-items: center; gap: 0.5rem; color: #10b981; font-weight: 600;">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                Pagos cuadrados correctamente
                            </div>
                        `}
                    </div>
                </div>
            `;
        };

        const footer = `
            <button class="btn btn-secondary" onclick="SalesView.viewSale(${saleId})">Cancelar</button>
            <button class="btn btn-primary" onclick="SalesView.saveEditSale()">💾 Guardar Cambios</button>
        `;

        showModal(renderForm(), { title: `Refactorizando Venta #${sale.saleNumber}`, footer, width: '850px' });
        
        // Re-referenciar el objeto global para que las funciones de update lo encuentren
        this._currentModalRefresh = () => {
            const modalBody = document.querySelector('.modal-body');
            if (modalBody) modalBody.innerHTML = renderForm();
        };
    },

    async searchEditProducts(query) {
        const resultsEl = document.getElementById('editProductResults');
        if (!query || query.length < 2) {
            resultsEl.style.display = 'none';
            return;
        }

        const results = await Product.search(query);
        if (results.length === 0) {
            resultsEl.style.display = 'none';
            return;
        }

        resultsEl.innerHTML = results.slice(0, 5).map(p => `
            <div class="search-result-item" onclick="SalesView.addEditProduct(${p.id})">
                <div class="result-info">
                    <span class="result-name">${safeHTML(p.name)}</span>
                    <span class="result-stock">Stock: ${p.stock}</span>
                </div>
                <span class="result-price">${formatCLP(p.price)}</span>
            </div>
        `).join('');
        resultsEl.style.display = 'block';
    },

    async addEditProduct(productId) {
        const product = await Product.getById(productId);
        if (!product) return;

        this._tempEditingSale.items.push({
            productId: product.id,
            name: product.name,
            quantity: 1,
            unitPrice: product.price,
            total: product.price,
            type: product.type || 'unit'
        });

        document.getElementById('editProductResults').style.display = 'none';
        
        // Asignar el nuevo total faltante a efectivo de manera predeterminada para que el usuario no tenga que hacerlo manualmente si no quiere
        const newTotal = this._tempEditingSale.items.reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0);
        const currentPaid = Object.values(this._tempEditingSale.paymentDetails).reduce((sum, a) => sum + (parseFloat(a) || 0), 0);
        if (newTotal > currentPaid) {
             const diff = newTotal - currentPaid;
             this._tempEditingSale.paymentDetails.cash = (this._tempEditingSale.paymentDetails.cash || 0) + diff;
        }

        this._currentModalRefresh();
    },

    adjustEditQuantity(index, delta) {
        const item = this._tempEditingSale.items[index];
        const step = item.type === 'weight' ? 0.05 : 1;
        let newQty = parseFloat(item.quantity) + (delta * step);
        if (newQty < 0.001) newQty = 0.001; // No dejar que baje de 0
        
        this.updateEditItem(index, 'quantity', newQty);
    },

    assignFullPayment(targetMethod) {
        const s = this._tempEditingSale;
        const subtotal = s.items.reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0);
        const total = roundPrice(subtotal);
        
        // Sumar todos los demas metodos
        let otherPayments = 0;
        Object.keys(s.paymentDetails).forEach(m => {
            if (m !== targetMethod) {
                otherPayments += (parseFloat(s.paymentDetails[m]) || 0);
            }
        });
        
        let newAmount = total - otherPayments;
        if (newAmount < 0) newAmount = 0;
        
        s.paymentDetails[targetMethod] = newAmount;
        this._currentModalRefresh();
    },

    updateEditItem(index, field, value) {
        const item = this._tempEditingSale.items[index];
        const num = parseFloat(value) || 0;
        
        if (field === 'quantity') {
            item.quantity = num;
            item.total = roundPrice(item.quantity * item.unitPrice);
        } else if (field === 'unitPrice') {
            item.unitPrice = num;
            item.total = roundPrice(item.quantity * item.unitPrice);
        } else if (field === 'total') {
            item.total = num;
            if (item.quantity > 0) item.unitPrice = roundPrice(item.total / item.quantity);
        }
        
        this._currentModalRefresh();
    },

    removeEditItem(index) {
        if (this._tempEditingSale.items.length <= 1) {
            showNotification('La venta debe tener al menos un producto', 'warning');
            return;
        }
        this._tempEditingSale.items.splice(index, 1);
        this._currentModalRefresh();
    },

    updateEditPayment(method, value) {
        this._tempEditingSale.paymentDetails[method] = parseFloat(value) || 0;
        this._currentModalRefresh();
    },

    async saveEditSale() {
        const s = this._tempEditingSale;
        const total = s.total;
        const paidAmount = Object.values(s.paymentDetails).reduce((sum, a) => sum + (parseFloat(a) || 0), 0);
        
        // Determinar estado final
        let status = 'completed';
        if (paidAmount === 0) status = 'pending';
        else if (paidAmount < total) status = 'partial';
        
        // Determinar paymentMethod principal (si es mixto, card o cash)
        const methodsWithMoney = Object.keys(s.paymentDetails).filter(m => s.paymentDetails[m] > 0);
        let finalMethod = methodsWithMoney.length > 1 ? 'mixed' : (methodsWithMoney[0] || 'cash');

        // Si el estado es pendiente total, el método es 'pending'
        if (status === 'pending') finalMethod = 'pending';

        // Calcular cambio en el pago total para ajustar caja
        const oldSale = await Sale.getById(s.id);
        const diff = paidAmount - (oldSale.paidAmount || 0);

        const updateData = {
            customerId: s.customerId,
            date: s.date,
            items: s.items,
            subtotal: s.total, // asumiendo sin impuestos por ahora
            total: s.total,
            paidAmount: paidAmount,
            paymentMethod: finalMethod,
            paymentDetails: s.paymentDetails,
            status: status,
            paymentChange: { diff }
        };

        try {
            await Sale.updateSale(s.id, updateData);
            showNotification('Venta actualizada correctamente', 'success');
            closeModal();
            this.offset = 0;
            this.allSales = [];
            await this.refresh();
        } catch (error) {
            showNotification('Error: ' + error.message, 'error');
        }
    },

    async refresh() {
        const content = await this.render();
        const container = document.getElementById('view-container');
        if (container) container.innerHTML = content;
    },

    // ===================== C5: DEVOLUCIONES =====================

    /**
     * C5: Muestra modal para crear una devolución de venta.
     * Calcula cantidades máximas devolvibles (vendidas - ya devueltas).
     */

    async showReturnModal(saleId) {
        const sale = await Sale.getById(saleId);
        if (!sale) {
            showNotification('Venta no encontrada', 'error');
            return;
        }

        // Obtener cantidades ya devueltas
        const alreadyReturned = await SaleReturn.getReturnedQuantitiesBySale(saleId);

        // Construir lista de ítems con cantidades devolvibles
        const returnableItems = [];
        for (const item of (sale.items || [])) {
            const pid = Number(item.productId);
            const sold = parseFloat(item.quantity) || 0;
            const returned = alreadyReturned[pid] || 0;
            const maxReturnable = Math.max(0, sold - returned);
            if (maxReturnable > 0) {
                returnableItems.push({
                    productId: pid,
                    name: item.name || `Producto #${pid} `,
                    unitPrice: parseFloat(item.unitPrice || item.price) || 0,
                    sold: sold,
                    returned: returned,
                    maxReturnable: maxReturnable,
                    type: item.type || 'unit'
                });
            }
        }

        if (returnableItems.length === 0) {
            showNotification('Todos los productos de esta venta ya han sido devueltos', 'warning');
            return;
        }

        const openCash = await CashRegister.getOpen();

        const content = `
    <div style = "margin-bottom: 1rem; padding: 1rem; background: #fef3c7; border-radius: 0.375rem; border-left: 4px solid #f59e0b;" >
        <p style="margin: 0; font-size: 0.9rem; color: #92400e;">
            <strong>↩️ Devolución para Venta #${sale.saleNumber || saleId}</strong><br>
                Seleccione las cantidades a devolver por producto. El stock será restaurado automáticamente.
        </p>
            </div >

            <div id="returnItemsList">
                ${returnableItems.map((item, index) => `
                    <div style="padding: 0.75rem; margin-bottom: 0.5rem; border: 1px solid var(--border); border-radius: 0.25rem; background: white;">
                        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 0.5rem; align-items: center;">
                            <div>
                                <strong>${safeHTML(item.name)}</strong>
                                <br><small style="color: var(--secondary);">Precio unit.: ${formatCLP(item.unitPrice)} | Vendidas: ${item.sold} | Devueltas: ${item.returned}</small>
                            </div>
                            <div>
                                <label style="font-size: 0.85rem;">Máx: ${item.maxReturnable}</label>
                                <input type="number" 
                                       class="form-control return-qty-input"
                                       id="returnQty_${index}"
                                       data-product-id="${item.productId}"
                                       data-unit-price="${item.unitPrice}"
                                       data-max="${item.maxReturnable}"
                                       value="0" min="0" max="${item.maxReturnable}" 
                                       step="${item.type === 'weight' ? '0.001' : '1'}"
                                       style="padding: 0.25rem; font-size: 0.9rem;"
                                       onchange="SalesView.updateReturnTotal()">
                            </div>
                            <div style="text-align: center;">
                                <button class="btn btn-sm btn-secondary" onclick="document.getElementById('returnQty_${index}').value = ${item.maxReturnable}; SalesView.updateReturnTotal();" title="Devolver todo">
                                    Todo
                                </button>
                            </div>
                            <div id="returnItemTotal_${index}" style="text-align: right; font-weight: 600;">
                                ${formatCLP(0)}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>

            <div class="form-group" style="margin-top: 1rem;">
                <label>Motivo de la devolución</label>
                <input type="text" id="returnReason" class="form-control" placeholder="Ej: Producto defectuoso, error de cantidad, etc." maxlength="200">
            </div>

            ${openCash ? `
            <div class="form-group" style="margin-top: 1rem;">
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; background: var(--light); padding: 0.75rem; border-radius: 4px; border: 1px solid var(--border);">
                    <input type="checkbox" id="returnDeductFromCash" value="true" checked>
                    <span>📉 Reembolsar dinero desde la Caja Activa</span>
                </label>
                <small style="margin-left: 2rem; display: block; margin-top: 0.25rem;">Si marcas esto, el monto se descontará de la caja para entregárselo al cliente en efectivo.</small>
            </div>` : ''
            }

<div style="margin-top: 1rem; padding: 1rem; background: #fee2e2; border-radius: 0.375rem; border: 1px solid #fecaca;">
    <div style="display: flex; justify-content: space-between; font-size: 1.2rem; font-weight: 700; color: #dc2626;">
        <span>Total a Devolver:</span>
        <span id="returnGrandTotal">${formatCLP(0)}</span>
    </div>
</div>
`;

        const footer = `
    <button class="btn btn-secondary" onclick= "closeModal()" > Cancelar</button >
        <button class="btn btn-warning" onclick="SalesView.processReturn(${saleId})" id="btnProcessReturn">
            ↩️ Confirmar Devolución
        </button>
`;

        showModal(content, { title: `↩️ Devolución — Venta #${sale.saleNumber || saleId} `, footer, width: '750px' });
    },

    /**
     * C5: Actualiza el total de devolución en tiempo real.
     */
    updateReturnTotal() {
        const inputs = document.querySelectorAll('.return-qty-input');
        let grandTotal = 0;
        inputs.forEach((input, index) => {
            const qty = parseFloat(input.value) || 0;
            const max = parseFloat(input.dataset.max) || 0;
            const unitPrice = parseFloat(input.dataset.unitPrice) || 0;

            // Capear al máximo
            if (qty > max) {
                input.value = max;
            }
            if (qty < 0) {
                input.value = 0;
            }

            const effectiveQty = parseFloat(input.value) || 0;
            const itemTotal = roundPrice(effectiveQty * unitPrice);
            grandTotal += itemTotal;

            const itemTotalEl = document.getElementById(`returnItemTotal_${index} `);
            if (itemTotalEl) {
                itemTotalEl.textContent = formatCLP(itemTotal);
            }
        });

        const grandTotalEl = document.getElementById('returnGrandTotal');
        if (grandTotalEl) {
            grandTotalEl.textContent = formatCLP(grandTotal);
        }
    },

    /**
     * C5: Procesa la devolución llamando a SaleReturnService.
     */
    async processReturn(saleId) {
        const inputs = document.querySelectorAll('.return-qty-input');
        const returnItems = [];

        inputs.forEach(input => {
            const qty = parseFloat(input.value) || 0;
            if (qty > 0) {
                returnItems.push({
                    productId: Number(input.dataset.productId),
                    quantity: qty
                });
            }
        });

        if (returnItems.length === 0) {
            showNotification('Debe seleccionar al menos un producto con cantidad mayor a 0', 'warning');
            return;
        }

        const reason = (document.getElementById('returnReason')?.value || '').trim();

        // Calcular total para confirmación
        let totalToReturn = 0;
        inputs.forEach(input => {
            const qty = parseFloat(input.value) || 0;
            const unitPrice = parseFloat(input.dataset.unitPrice) || 0;
            totalToReturn += roundPrice(qty * unitPrice);
        });

        const deductFromCashElements = document.getElementById('returnDeductFromCash');
        const deductFromCashRegister = deductFromCashElements ? deductFromCashElements.checked : false;

        showConfirm(
            `¿Confirmar devolución por ${formatCLP(totalToReturn)}?\n\n` +
            `Se restaurará el stock de ${returnItems.length} producto(s).\n` +
            `La venta original NO se modifica.\n\n` +
            `${deductFromCashRegister ? `Monto se RETIRARÁ de la caja para el cliente.\n\n` : ''} ` +
            `${reason ? `Motivo: ${reason}` : ''} `,
            async () => {
                const btn = document.getElementById('btnProcessReturn');
                if (btn) {
                    btn.disabled = true;
                    btn.textContent = 'Procesando...';
                }

                try {
                    const result = await SaleReturnService.processReturn(saleId, returnItems, reason, deductFromCashRegister);

                    closeModal();
                    showNotification(
                        `Devolución #${result.returnId} registrada exitosamente por ${formatCLP(result.totalReturned)}. Stock restaurado.`,
                        'success'
                    );
                    this.offset = 0;
                    this.allSales = [];
                    this.hasMore = true;
                    await this.refresh();
                } catch (error) {
                    showNotification(`Error al procesar devolución: ${error.message} `, 'error');
                    console.error('Error en devolución:', error);
                    if (btn) {
                        btn.disabled = false;
                        btn.textContent = '↩️ Confirmar Devolución';
                    }
                }
            }
        );
    },

    // ===================== FIN C5 =====================

    async renderReturnsTable(returns) {
        const grandTotal = returns.reduce((sum, r) => sum + (parseFloat(r.totalReturned) || 0), 0);
        const count = returns.length;

        let dateText = '';
        if (this.dateFrom || this.dateTo) {
            const selectedDate = this.dateFrom || this.dateTo;
            const dateObj = new Date(selectedDate + 'T00:00:00');
            dateText = ` (${formatDate(dateObj.toISOString())})`;
        }

        let html = `
            <div style="margin-bottom: 1.5rem; padding: 1rem; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; border-radius: 0.5rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <h3 style="margin: 0; font-size: 1.1rem; font-weight: 600; opacity: 0.9;">↩️ Notas de Crédito (Devoluciones)${dateText}</h3>
                        <p style="margin: 0.25rem 0 0 0; font-size: 0.9rem; opacity: 0.8;">${count} devolución${count !== 1 ? 'es' : ''} en total</p>
                    </div>
                    <div style="font-size: 1.5rem; font-weight: 700; background: rgba(255,255,255,0.2); padding: 0.5rem 1rem; border-radius: 0.375rem;">Total Devuelto: ${formatCLP(grandTotal)}</div>
                </div>
            </div>
            
            <div class="sales-history-card">
                <div class="sales-history-card-header">
                    <h3>
                        <span>↩️</span>
                        <span>Listado de Notas de Crédito</span>
                    </h3>
                </div>
                <div class="table-container">
                    <table class="sales-table">
                        <thead>
                            <tr>
                                <th style="width: 80px;">Folio NC</th>
                                <th style="width: 150px;">Fecha y Hora</th>
                                <th style="width: 150px;">Venta Origen</th>
                                <th style="width: 180px;">Cliente</th>
                                <th style="width: 250px;">Productos Devueltos</th>
                                <th style="width: 120px;">Monto Devuelto</th>
                                <th style="width: 150px;">Motivo</th>
                                <th style="width: 100px;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        for (const ret of returns) {
            const clientName = ret.clientName || 'Público General';
            const items = ret.items || [];
            const itemsSummary = items.map(i => `${safeHTML(i.name)} (x${i.quantity})`).join(', ');

            html += `
                <tr>
                    <td data-label="Folio NC"><span class="sale-number">#${ret.id}</span></td>
                    <td data-label="Fecha">${formatDateTime(ret.date || ret.createdAt)}</td>
                    <td data-label="Venta Origen">
                        <span style="font-weight: 700; color: var(--primary); cursor: pointer; text-decoration: underline;" onclick="SalesView.viewSale(${ret.saleId})">
                            Venta #${ret.saleNumber || ret.saleId}
                        </span>
                    </td>
                    <td data-label="Cliente">${safeHTML(clientName)}</td>
                    <td data-label="Productos Devueltos">
                        <div style="max-height: 50px; overflow-y: auto; font-size: 0.85rem; color: #475569;" title="${safeHTML(itemsSummary)}">
                            ${safeHTML(itemsSummary)}
                        </div>
                    </td>
                    <td data-label="Monto Devuelto"><strong style="color: #dc2626;">-${formatCLP(ret.totalReturned)}</strong></td>
                    <td data-label="Motivo"><span style="font-size: 0.85rem; font-style: italic; color: #64748b;">${safeHTML(ret.reason || 'Sin motivo')}</span></td>
                    <td data-label="Acciones">
                        <button class="btn btn-sm btn-secondary" onclick="SalesView.viewSale(${ret.saleId})">👁️ Ver Venta</button>
                    </td>
                </tr>
            `;
        }

        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        return html;
    },

    async deleteSale(saleId) {
        if (!PermissionService.can('sales.delete')) {
            return showNotification('No tienes permiso para eliminar ventas', 'error');
        }
        const sale = await Sale.getById(saleId);
        if (!sale) {
            showNotification('Venta no encontrada', 'error');
            return;
        }

        const saleInfo = `Venta #${sale.saleNumber || saleId} - ${formatCLP(sale.total)} - ${formatDateTime(sale.date)} `;

        showConfirm(
            `¿Estás seguro de eliminar esta venta ?\n\n${saleInfo} \n\n⚠️ Esta acción eliminará: \n` +
            `• La venta del historial\n` +
            `• Todos los pagos asociados\n` +
            `• Los movimientos de caja relacionados\n` +
            `• Se restaurará el stock de los productos\n\n` +
            `Esta acción NO se puede deshacer.`,
            async () => {
                try {
                    await Sale.delete(saleId);

                    showNotification(`Venta #${sale.saleNumber || saleId} eliminada correctamente.Stock y caja actualizados.`, 'success');

                    this.offset = 0;
                    this.allSales = [];
                    this.hasMore = true;
                    await this.refresh();

                    // Actualizar vista de caja si está visible para reflejar el cambio en ventas del día
                    if (typeof CashView !== 'undefined' && CashView._dailyDetail) {
                        try {
                            // Recargar datos de ventas del día
                            const openCash = await CashRegister.getOpen();
                            if (openCash) {
                                const dailyDetail = await CashController.getDailyDetail(openCash.id);
                                CashView._dailyDetail = dailyDetail;
                                
                                // Actualizar el DOM si estamos en la vista de caja
                                const todayKey = new Date().toLocaleDateString('es-CL');
                                const todayDetail = dailyDetail.find(d => d.date === todayKey) || {
                                    sales: [], debtPayments: [], creditSales: [], cashMovementsOut: [], cashMovementsIn: []
                                };
                                const totalTodaySales = todayDetail.sales.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
                                
                                // Actualizar el elemento del DOM si existe
                                const salesTodayElement = document.querySelector('[onclick="CashView.showVentasHoy()"]');
                                if (salesTodayElement) {
                                    const valueElement = salesTodayElement.querySelector('div[style*="font-size: 1.65rem"]');
                                    if (valueElement) {
                                        valueElement.textContent = formatCLP(totalTodaySales);
                                    }
                                    const countElement = salesTodayElement.querySelector('small');
                                    if (countElement) {
                                        countElement.textContent = `${todayDetail.sales.length} ventas ejecutadas`;
                                    }
                                }
                            }
                        } catch (error) {
                            console.warn('No se pudo actualizar la vista de caja:', error);
                        }
                    }
                } catch (error) {
                    console.error('Error eliminando venta:', error);
                    showNotification(`Error al eliminar la venta: ${error.message} `, 'error');
                }
            }
        );
    }
};

