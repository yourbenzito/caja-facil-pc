const ReportsView = {
    currentReport: 'daily',

    async render() {
        this.destroy(); // Limpiar antes de renderizar
        return `
            <div class="view-header">
                <h1 style="color: #111827;">Reportes</h1>
                <p style="color: #4b5563;">Análisis y estadísticas del negocio</p>
            </div>
            
            <div class="card" style="background: #ffffff; border: 1.5px solid #d1d5db; border-radius: 1rem; padding: 1.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.06);">
                <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; flex-wrap: wrap; background: #f9fafb; padding: 0.875rem; border-radius: 0.75rem; border: 1px solid #e5e7eb;">
                    <button class="btn ${this.currentReport === 'daily' ? 'btn-primary' : 'btn-secondary'}" 
                            onclick="ReportsView.showReport('daily')">
                        📅 Ventas del Día
                    </button>
                    <button class="btn ${this.currentReport === 'weekly' ? 'btn-primary' : 'btn-secondary'}" 
                            onclick="ReportsView.showReport('weekly')">
                        📈 Ventas de la Semana
                    </button>
                    <button class="btn ${this.currentReport === 'monthly' ? 'btn-primary' : 'btn-secondary'}" 
                            onclick="ReportsView.showReport('monthly')">
                        🗓️ Reporte Mensual
                    </button>
                    <button class="btn ${this.currentReport === 'products' ? 'btn-primary' : 'btn-secondary'}" 
                            onclick="ReportsView.showReport('products')">
                        📦 Vendido por Producto
                    </button>
                    <button class="btn ${this.currentReport === 'profitability' ? 'btn-primary' : 'btn-secondary'}" 
                            onclick="ReportsView.showReport('profitability')">
                        💰 Ganancias y Utilidad
                    </button>
                    <button class="btn ${this.currentReport === 'stock' ? 'btn-primary' : 'btn-secondary'}" 
                            onclick="ReportsView.showReport('stock')">
                        📋 Estado de Inventario
                    </button>
                    <button class="btn ${this.currentReport === 'stagnant' ? 'btn-primary' : 'btn-secondary'}" 
                            onclick="ReportsView.showReport('stagnant')">
                        ⏳ Productos sin Venta
                    </button>
                    <button class="btn ${this.currentReport === 'iva' ? 'btn-primary' : 'btn-secondary'}" 
                            onclick="ReportsView.showReport('iva')">
                        📑 Resumen de IVA (Fiscal)
                    </button>
                    <button class="btn ${this.currentReport === 'costAlerts' ? 'btn-primary' : 'btn-secondary'}" 
                            onclick="ReportsView.showReport('costAlerts')">
                        ⚠️ Cambios de Costos
                    </button>
                    <button class="btn ${this.currentReport === 'cierres' ? 'btn-primary' : 'btn-secondary'}" 
                            onclick="ReportsView.showReport('cierres')">
                        🔒 Historial de Cierres
                    </button>
                </div>
                
                <div id="reportContent">
                    ${await (async () => {
                        switch (this.currentReport) {
                            case 'daily': return await this.renderDailyReport();
                            case 'weekly': return await this.renderWeeklyReport();
                            case 'monthly': return await this.renderMonthlyReport();
                            case 'products': return await this.renderProductsReport();
                            case 'profitability': return await this.renderProfitabilityReport();
                            case 'stock': return await this.renderStockReport();
                            case 'stagnant': return await this.renderStagnantReport();
                            case 'iva': return await this.renderIVAReport();
                            case 'costAlerts': return await this.renderCostAlertsReport();
                            case 'cierres': return await this.renderCierresReport();
                            default: return await this.renderDailyReport();
                        }
                    })()}
                </div>
            </div>
        `;
    },

    async showReport(type, ...args) {
        if (this.activeCharts) {
            this.activeCharts.forEach(c => { try { c.destroy(); } catch (e) { } });
            this.activeCharts = [];
        }

        this.currentReport = type;

        let content = '';
        switch (type) {
            case 'daily':
                content = await this.renderDailyReport();
                break;
            case 'weekly':
                content = await this.renderWeeklyReport();
                break;
            case 'monthly':
                content = await this.renderMonthlyReport(...args);
                break;
            case 'products':
                content = await this.renderProductsReport();
                break;
            case 'profitability':
                content = await this.renderProfitabilityReport();
                break;
            case 'stock':
                content = await this.renderStockReport();
                break;
            case 'stagnant':
                content = await this.renderStagnantReport(...args);
                break;
            case 'iva':
                content = await this.renderIVAReport(...args);
                break;
            case 'costAlerts':
                content = await this.renderCostAlertsReport();
                break;
            case 'cierres':
                content = await this.renderCierresReport();
                break;
        }

        document.getElementById('reportContent').innerHTML = content;

        // ponytail: Vincular eventos clic de ayuda didáctica e informativa
        document.querySelectorAll('.info-help-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const helpKey = btn.getAttribute('data-help');
                if (window.ReportsExplanations) {
                    window.ReportsExplanations.showModal(helpKey);
                }
            };
        });

        // Renderizar gráficos si corresponde
        if (['daily', 'weekly', 'monthly', 'products', 'profitability'].includes(type)) {
            // Un pequeño delay asegura que el DOM se haya renderizado completamente
            setTimeout(() => this.renderCharts(type), 150);
        }

        const buttons = document.querySelectorAll('.card button');
        buttons.forEach(btn => {
            if (btn.onclick && btn.onclick.toString().includes(`showReport('${type}'`)) {
                btn.className = 'btn btn-primary';
            } else if (btn.onclick && btn.onclick.toString().includes(`showReport(`)) {
                if (!btn.onclick.toString().includes(`showReport('${type}',`)) {
                    btn.className = 'btn btn-secondary';
                }
            }
        });
    },

    async renderCharts(type) {
        // Se elimina la lógica de gráficos por solicitud del usuario
    },

    async renderDailyReport() {
        const today = new Date();
        const report = await ReportController.getDailySales(today);

        const paymentMethods = { cash: 0, card: 0, qr: 0, other: 0, pending: 0 };
        report.sales.forEach(sale => {
            // 1. Sumar lo que se pagó realmente a los métodos de pago
            if (sale.paymentDetails) {
                Object.entries(sale.paymentDetails).forEach(([method, amount]) => {
                    if (paymentMethods[method] !== undefined) {
                        paymentMethods[method] += parseFloat(amount) || 0;
                    }
                });
            } else {
                const method = sale.paymentMethod || 'cash';
                if (paymentMethods[method] !== undefined) {
                    paymentMethods[method] += parseFloat(sale.paidAmount !== undefined ? sale.paidAmount : sale.total) || 0;
                }
            }

            // 2. Sumar la deuda pendiente a la categoría 'pending'
            const total = parseFloat(sale.total) || 0;
            const paid = parseFloat(sale.paidAmount !== undefined ? sale.paidAmount : (sale.status === 'completed' ? total : 0)) || 0;
            const pending = Math.max(0, total - paid);
            if (pending > 0) {
                paymentMethods.pending += pending;
            }
        });

        return `
            <div class="flex-between-wrap">
                <h3>Ventas de Hoy - ${formatDate(today)}</h3>
                <button class="btn btn-secondary" onclick="ReportsView.exportToPDF('daily', ${JSON.stringify(report).replace(/"/g, '&quot;')})" style="background-color: #dc2626; color: white; border-color: #dc2626;">
                    📄 Exportar PDF
                </button>
            </div>
            
            <div class="grid grid-6 margin-y-medium">
                <div class="stat-card">
                    <h3>Ventas</h3>
                    <div class="value">${report.totalSales}</div>
                </div>
                <div class="stat-card" title="Total de ventas del DÍA CALENDARIO completo, sumando todos los turnos.">
                    <h3>Total Vendido</h3>
                    <div class="value">${formatCLP(report.totalAmount)}</div>
                </div>
                <div class="stat-card card-tax-accent">
                    <h3 style="display: flex; align-items: center; justify-content: center; gap: 0.35rem;">
                        📉 Dinero para Impuestos (IVA)
                        <span class="info-help-btn" data-help="ivaDebito" style="cursor: pointer; font-size: 0.95rem; opacity: 0.7; transition: opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7">ℹ️</span>
                    </h3>
                    <div class="value">${formatCLP(report.ivaDebito)}</div>
                    <small class="small-muted-text">Dinero que debes guardar para el SII.</small>
                </div>
                <div class="stat-card card-credit-accent">
                    <h3 style="display: flex; align-items: center; justify-content: center; gap: 0.35rem;">
                        📈 IVA a mi favor (Compras)
                        <span class="info-help-btn" data-help="ivaCredito" style="cursor: pointer; font-size: 0.95rem; opacity: 0.7; transition: opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7">ℹ️</span>
                    </h3>
                    <div class="value">${formatCLP(report.ivaCredito)}</div>
                    <small class="small-muted-text">Descuento por tus facturas de compra.</small>
                </div>
                <div class="stat-card card-net-accent">
                    <h3 style="display: flex; align-items: center; justify-content: center; gap: 0.35rem;">
                        💰 Venta Limpia (Sin IVA)
                        <span class="info-help-btn" data-help="ventaLimpia" style="cursor: pointer; font-size: 0.95rem; opacity: 0.7; transition: opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7">ℹ️</span>
                    </h3>
                    <div class="value" style="font-weight: 800;">
                        ${formatCLP(report.totalAmount - report.ivaDebito)}
                    </div>
                    <small class="small-muted-text">Total vendido quitando los impuestos.</small>
                </div>
                <div class="stat-card card-pocket-accent">
                    <h3 style="font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 0.35rem;">
                        💎 Mi Ganancia Real (Bolsillo)
                        <span class="info-help-btn" data-help="realProfit" style="cursor: pointer; font-size: 0.95rem; opacity: 0.7; transition: opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7">ℹ️</span>
                    </h3>
                    <div class="value" style="font-weight: 900;">
                        ${formatCLP(report.realProfit)}
                    </div>
                    <small class="small-muted-text" style="font-weight: 500;">¡Tu dinero libre tras recuperar costos!</small>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">
                <div class="card glass-panel" style="padding: 1.5rem;">
                    <h4 style="margin-bottom: 1rem;">Total por Método de Pago</h4>
                    <div class="grid grid-2">
                        <div style="text-align: center; padding: 0.75rem; background: var(--light); border-radius: 0.375rem;">
                            <div style="font-size: 0.85rem; color: var(--secondary);">💵 Efectivo</div>
                            <div style="font-size: 1.15rem; font-weight: bold; color: var(--primary);">${formatCLP(paymentMethods.cash)}</div>
                        </div>
                        <div style="text-align: center; padding: 0.75rem; background: var(--light); border-radius: 0.375rem;">
                            <div style="font-size: 0.85rem; color: var(--secondary);">💳 Tarjeta</div>
                            <div style="font-size: 1.15rem; font-weight: bold; color: var(--primary);">${formatCLP(paymentMethods.card)}</div>
                        </div>
                        <div style="text-align: center; padding: 0.75rem; background: var(--light); border-radius: 0.375rem;">
                            <div style="font-size: 0.85rem; color: var(--secondary);">📱 QR</div>
                            <div style="font-size: 1.15rem; font-weight: bold; color: var(--primary);">${formatCLP(paymentMethods.qr)}</div>
                        </div>
                        <div style="text-align: center; padding: 0.75rem; background: rgba(248, 113, 113, 0.1); border-radius: 0.375rem; border: 1px solid rgba(248, 113, 113, 0.2);">
                            <div style="font-size: 0.85rem; color: #ef4444;">📝 Anotado (Deuda)</div>
                            <div style="font-size: 1.15rem; font-weight: bold; color: #dc2626;">${formatCLP(paymentMethods.pending)}</div>
                        </div>
                    </div>
                </div>
            </div>
            
            ${this.renderSalesTable(report.sales)}
        `;
    }
    ,

    async renderWeeklyReport() {
        const report = await ReportController.getWeeklySales();

        const paymentMethods = { cash: 0, card: 0, qr: 0, other: 0, pending: 0 };
        report.sales.forEach(sale => {
            if (sale.paymentDetails) {
                Object.entries(sale.paymentDetails).forEach(([method, amount]) => {
                    if (paymentMethods[method] !== undefined) {
                        paymentMethods[method] += parseFloat(amount) || 0;
                    }
                });
            } else {
                const method = sale.paymentMethod || 'cash';
                if (paymentMethods[method] !== undefined) {
                    paymentMethods[method] += parseFloat(sale.paidAmount !== undefined ? sale.paidAmount : sale.total) || 0;
                }
            }
            const total = parseFloat(sale.total) || 0;
            const paid = parseFloat(sale.paidAmount !== undefined ? sale.paidAmount : (sale.status === 'completed' ? total : 0)) || 0;
            const pending = Math.max(0, total - paid);
            if (pending > 0) {
                paymentMethods.pending += pending;
            }
        });

        return `
            <div class="flex-between-wrap">
                <div>
                    <h3>Ventas Semanales</h3>
                    <p>${formatDate(report.startDate)} - ${formatDate(report.endDate)}</p>
                </div>
                <button class="btn btn-secondary" onclick="ReportsView.exportToPDF('weekly', ${JSON.stringify(report).replace(/"/g, '&quot;')})" style="background-color: #dc2626; color: white; border-color: #dc2626;">
                    📄 Exportar PDF
                </button>
            </div>
            
            <div class="grid grid-6 margin-y-medium">
                <div class="stat-card">
                    <h3>Ventas Totales</h3>
                    <div class="value">${report.totalSales}</div>
                </div>
                <div class="stat-card">
                    <h3>Total Vendido</h3>
                    <div class="value">${formatCLP(report.totalAmount)}</div>
                </div>
                <div class="stat-card card-tax-accent">
                    <h3>IVA Débito</h3>
                    <div class="value">${formatCLP(report.ivaDebito)}</div>
                </div>
                <div class="stat-card card-credit-accent">
                    <h3>IVA Crédito</h3>
                    <div class="value">${formatCLP(report.ivaCredito)}</div>
                </div>
                <div class="stat-card card-tax-accent">
                    <h3>IVA a Pagar (SII)</h3>
                    <div class="value">
                        ${formatCLP(Math.max(0, report.ivaDebito - report.ivaCredito))}
                    </div>
                </div>
                <div class="stat-card card-pocket-accent" title="Venta Neta Total - Costo Neto Total">
                    <h3 style="font-weight: bold;">Ganancia Bruta Real</h3>
                    <div class="value" style="font-weight: 900;">
                        ${formatCLP(report.realProfit)}
                    </div>
                    <small class="small-muted-text">Utilidad real sin impuestos.</small>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">
                <div class="card glass-panel" style="padding: 1.5rem;">
                    <h4 style="margin-bottom: 1rem;">Total por Método de Pago</h4>
                    <div class="grid grid-2">
                        <div style="text-align: center; padding: 0.75rem; background: var(--light); border-radius: 0.375rem;">
                            <div style="font-size: 0.85rem; color: var(--secondary);">💵 Efectivo</div>
                            <div style="font-size: 1.15rem; font-weight: bold; color: var(--primary);">${formatCLP(paymentMethods.cash)}</div>
                        </div>
                        <div style="text-align: center; padding: 0.75rem; background: var(--light); border-radius: 0.375rem;">
                            <div style="font-size: 0.85rem; color: var(--secondary);">💳 Tarjeta</div>
                            <div style="font-size: 1.15rem; font-weight: bold; color: var(--primary);">${formatCLP(paymentMethods.card)}</div>
                        </div>
                        <div style="text-align: center; padding: 0.75rem; background: var(--light); border-radius: 0.375rem;">
                            <div style="font-size: 0.85rem; color: var(--secondary);">📱 QR</div>
                            <div style="font-size: 1.15rem; font-weight: bold; color: var(--primary);">${formatCLP(paymentMethods.qr)}</div>
                        </div>
                        <div style="text-align: center; padding: 0.75rem; background: rgba(248, 113, 113, 0.1); border-radius: 0.375rem; border: 1px solid rgba(248, 113, 113, 0.2);">
                            <div style="font-size: 0.85rem; color: #ef4444;">📝 Anotado (Deuda)</div>
                            <div style="font-size: 1.15rem; font-weight: bold; color: #dc2626;">${formatCLP(paymentMethods.pending)}</div>
                        </div>
                    </div>
                </div>
            </div>
            
            ${this.renderSalesTable(report.sales)}
        `;
    }
    ,

    async renderMonthlyReport(selectedYear, selectedMonth) {
        const now = new Date();
        const currentYear = selectedYear !== undefined ? selectedYear : now.getFullYear();
        const currentMonth = selectedMonth !== undefined ? selectedMonth : now.getMonth();

        // C4: Optimización — No descargar miles de ventas para saber qué meses tienen ventas
        // En su lugar, asumimos el año actual y el anterior como válidos, o mejor, consultamos solo el rango necesario
        const monthsWithSales = new Set();
        const startHistory = new Date(currentYear - 1, 0, 1); // Último año
        const recentSales = await Sale.getByDateRange(startHistory.toISOString(), now.toISOString());

        recentSales.forEach(sale => {
            const saleDate = new Date(sale.date);
            monthsWithSales.add(`${saleDate.getFullYear()}-${saleDate.getMonth()}`);
        });

        const report = await ReportController.getMonthlySales(currentYear, currentMonth);

        const previousMonthsReports = [];
        for (let i = 1; i <= 3; i++) {
            const prevDate = new Date(currentYear, currentMonth - i, 1);
            const prevYear = prevDate.getFullYear();
            const prevMonth = prevDate.getMonth();
            const monthKey = `${prevYear}-${prevMonth}`;

            if (monthsWithSales.has(monthKey)) {
                const prevReport = await ReportController.getMonthlySales(prevYear, prevMonth);
                previousMonthsReports.push(prevReport);
            }
        }

        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        const startOfMonth = new Date(currentYear, currentMonth, 1);
        const endOfMonth = new Date(currentYear, currentMonth + 1, 0);
        const isCurrentMonth = currentYear === now.getFullYear() && currentMonth === now.getMonth();
        const periodEnd = isCurrentMonth ? now : endOfMonth;
        const daysInPeriod = Math.ceil((periodEnd - startOfMonth) / (1000 * 60 * 60 * 24)) + 1;
        const totalDaysInMonth = endOfMonth.getDate();

        const paymentMethods = { cash: 0, card: 0, qr: 0, other: 0, pending: 0 };
        report.sales.forEach(sale => {
            if (sale.paymentDetails) {
                Object.entries(sale.paymentDetails).forEach(([method, amount]) => {
                    if (paymentMethods[method] !== undefined) {
                        paymentMethods[method] += parseFloat(amount) || 0;
                    }
                });
            } else {
                const method = sale.paymentMethod || 'cash';
                if (paymentMethods[method] !== undefined) {
                    paymentMethods[method] += parseFloat(sale.paidAmount !== undefined ? sale.paidAmount : sale.total) || 0;
                }
            }
            const total = parseFloat(sale.total) || 0;
            const paid = parseFloat(sale.paidAmount !== undefined ? sale.paidAmount : (sale.status === 'completed' ? total : 0)) || 0;
            const pending = Math.max(0, total - paid);
            if (pending > 0) {
                paymentMethods.pending += pending;
            }
        });

        return `
            <div class="flex-between-wrap margin-bottom-large">
                <div>
                    <h3 style="margin: 0;">Ventas de ${monthNames[report.month]} ${report.year}</h3>
                    <p style="margin: 0.5rem 0 0 0; color: var(--secondary); font-size: 0.9rem;">
                        Período: ${formatDate(startOfMonth)} - ${formatDate(periodEnd)} 
                        ${isCurrentMonth ? `(${daysInPeriod} de ${totalDaysInMonth} días)` : `(${totalDaysInMonth} días completos)`}
                    </p>
                </div>
                <div class="flex-between-wrap" style="gap: 1rem;">
                    <button class="btn btn-primary" onclick="ReportsView.showReport('iva', ${currentYear}, ${currentMonth})">
                        🔍 Ver Detalle IVA
                    </button>
                    <div style="display: flex; align-items: center; gap: 0.5rem; background: var(--light); padding: 0.5rem 1rem; border-radius: 0.5rem;">
                        <label for="monthPicker" style="font-size: 0.85rem; font-weight: 600; color: var(--secondary);">Seleccionar Mes:</label>
                        <input type="month" id="monthPicker" class="form-control" 
                               value="${currentYear}-${String(currentMonth + 1).padStart(2, '0')}" 
                               onchange="ReportsView.handleMonthChange(this.value)"
                               style="padding: 0.25rem 0.5rem; height: auto; width: auto; background: transparent; border: 1px solid var(--border);">
                    </div>
                </div>
                <button class="btn btn-secondary" onclick="ReportsView.exportToPDF('monthly', ${JSON.stringify(report).replace(/"/g, '&quot;')})" style="background-color: #dc2626; color: white; border-color: #dc2626;">
                    📄 PDF
                </button>
            </div>
            
            <div class="grid grid-3 margin-y-medium">
                <!-- Ganancia de Bolsillo -->
                <div class="stat-card glass-panel panel-padding card-net-accent">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <h3 style="margin: 0; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8;">💰 Ganancia de Bolsillo</h3>
                        <span title="Dinero físico que queda tras vender. (Total Venta - Costo que pagaste)" style="cursor: help; background: rgba(255,255,255,0.1); border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem;">?</span>
                    </div>
                    <div class="value" >${formatCLP(report.pocketProfit)}</div>
                    <p style="font-size: 0.75rem; margin-top: 0.5rem; opacity: 0.6; line-height: 1.2;">
                        Cálculo: (Venta Total) - (Costo Bruto pagado al proveedor).<br>
                        <strong>Es el dinero real que entró a tu caja hoy.</strong>
                    </p>
                </div>

                <!-- Ganancia Real -->
                <div class="stat-card glass-panel panel-padding card-pocket-accent">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <h3 style="margin: 0; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8;">📈 Ganancia Bruta Real</h3>
                        <span title="Tu utilidad real considerando que las ventas internas son 100% tuyas y las boletas pagan IVA." style="cursor: help; background: rgba(255,255,255,0.1); border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem;">?</span>
                    </div>
                    <div class="value" >${formatCLP(report.realProfit)}</div>
                    <p style="font-size: 0.75rem; margin-top: 0.5rem; opacity: 0.6; line-height: 1.2;">
                        Cálculo: (Ventas Internas) + (Ventas Boleta Neta) - (Costos Netos).<br>
                        <strong>Es el pozo de dinero real que te pertenece legalmente.</strong>
                    </p>
                </div>

                <!-- Impuestos SII (Clickable for Modal Detail) -->
                <div class="stat-card glass-panel panel-padding card-tax-accent clickable" 
                     onclick="ReportsView.showIVADetailModal('debito', ${report.year}, ${report.month})">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <h3 style="margin: 0; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8;">⚖️ IVA a Declarar</h3>
                        <span title="Haz clic para ver el detalle de facturas y ventas." style="cursor: help; background: var(--primary); color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem;">i</span>
                    </div>
                    <div class="value">${formatCLP(Math.max(0, report.ivaDebito - report.ivaCredito))}</div>
                    <div style="font-size: 0.75rem; margin-top: 0.5rem; opacity: 0.6; line-height: 1.2;">
                        <span style="color: #f87171;">(-) IVA Débito Ventas: ${formatCLP(report.ivaDebito)}</span><br>
                        <span style="color: #34d399;">(+) IVA Crédito Compras: ${formatCLP(report.ivaCredito)}</span>
                        <div style="text-align: right; font-weight: bold; margin-top: 0.5rem; color: var(--primary);">Versión Detallada (Ver) →</div>
                    </div>
                </div>
            </div>

            <div class="grid grid-4 margin-y-medium">
                <div class="stat-card" style="padding: 1rem;">
                    <h3 style="font-size: 0.8rem; opacity: 0.7;">Venta Total</h3>
                    <div class="value" style="font-size: 1.4rem;">${formatCLP(report.totalAmount)}</div>
                </div>
                <div class="stat-card" style="padding: 1rem; cursor: pointer;" onclick="ReportsView.showIVADetailModal('credito', ${report.year}, ${report.month})">
                    <h3 style="font-size: 0.8rem; opacity: 0.7;">Costo Total Pagado (Ver Facturas)</h3>
                    <div class="value" style="font-size: 1.4rem; color: #94a3b8;">${formatCLP(report.totalCostGross)}</div>
                </div>
                <div class="stat-card" style="padding: 1rem;">
                    <h3 style="font-size: 0.8rem; opacity: 0.7;">Ventas del Mes</h3>
                    <div class="value" style="font-size: 1.4rem;">${report.totalSales}</div>
                </div>
                <div class="stat-card" style="padding: 1rem;">
                    <h3 style="font-size: 0.8rem; opacity: 0.7;">Promedio Diario</h3>
                    <div class="value" style="font-size: 1.4rem;">${formatCLP(report.totalSales > 0 ? report.totalAmount / daysInPeriod : 0)}</div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">
                <div class="card glass-panel" style="padding: 1.5rem;">
                    <h4 style="margin-bottom: 1rem;">Total por Método de Pago</h4>
                    <div class="grid grid-2">
                        <div style="text-align: center; padding: 0.75rem; background: var(--light); border-radius: 0.375rem;">
                            <div style="font-size: 0.85rem; color: var(--secondary);">💵 Efectivo</div>
                            <div style="font-size: 1.15rem; font-weight: bold; color: var(--primary);">${formatCLP(paymentMethods.cash)}</div>
                        </div>
                        <div style="text-align: center; padding: 0.75rem; background: var(--light); border-radius: 0.375rem;">
                            <div style="font-size: 0.85rem; color: var(--secondary);">💳 Tarjeta</div>
                            <div style="font-size: 1.15rem; font-weight: bold; color: var(--primary);">${formatCLP(paymentMethods.card)}</div>
                        </div>
                        <div style="text-align: center; padding: 0.75rem; background: var(--light); border-radius: 0.375rem;">
                            <div style="font-size: 0.85rem; color: var(--secondary);">📱 QR</div>
                            <div style="font-size: 1.15rem; font-weight: bold; color: var(--primary);">${formatCLP(paymentMethods.qr)}</div>
                        </div>
                        <div style="text-align: center; padding: 0.75rem; background: rgba(248, 113, 113, 0.1); border-radius: 0.375rem; border: 1px solid rgba(248, 113, 113, 0.2);">
                            <div style="font-size: 0.85rem; color: #ef4444;">📝 Anotado (Deuda)</div>
                            <div style="font-size: 1.15rem; font-weight: bold; color: #dc2626;">${formatCLP(paymentMethods.pending)}</div>
                        </div>
                    </div>
                </div>
            </div>
            
            ${previousMonthsReports.length > 0 ? `
                <div class="card" style="margin-bottom: 1.5rem;">
                    <h4 style="margin-bottom: 1rem;">📈 Evolución Mes a Mes</h4>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Mes</th>
                                    <th>Período</th>
                                    <th>Ventas</th>
                                    <th>Total Vendido</th>
                                    <th>Promedio Diario</th>
                                    <th>Variación</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style="background: rgba(99, 102, 241, 0.1); font-weight: bold;">
                                    <td><strong>${monthNames[report.month]} ${report.year}</strong> (Actual)</td>
                                    <td>${formatDate(startOfMonth)} - ${formatDate(periodEnd)}</td>
                                    <td>${report.totalSales}</td>
                                    <td><strong>${formatCLP(report.totalAmount)}</strong></td>
                                    <td>${formatCLP(report.totalSales > 0 ? report.totalAmount / daysInPeriod : 0)}</td>
                                    <td>-</td>
                                </tr>
                                ${previousMonthsReports.map((prevReport, idx) => {
            const prevStartDate = new Date(prevReport.year, prevReport.month, 1);
            const prevEndDate = new Date(prevReport.year, prevReport.month + 1, 0);
            const prevDaysInMonth = prevEndDate.getDate();
            const prevAvgDaily = prevReport.totalSales > 0 ? prevReport.totalAmount / prevDaysInMonth : 0;
            const currentAvgDaily = report.totalSales > 0 ? report.totalAmount / daysInPeriod : 0;
            const variation = prevAvgDaily > 0 ? ((currentAvgDaily - prevAvgDaily) / prevAvgDaily * 100) : 0;
            const variationColor = variation >= 0 ? 'var(--success)' : 'var(--danger)';
            const variationIcon = variation >= 0 ? '↑' : '↓';

            return `
                                        <tr>
                                            <td>${monthNames[prevReport.month]} ${prevReport.year}</td>
                                            <td>${formatDate(prevStartDate)} - ${formatDate(prevEndDate)} (${prevDaysInMonth} días)</td>
                                            <td>${prevReport.totalSales}</td>
                                            <td>${formatCLP(prevReport.totalAmount)}</td>
                                            <td>${formatCLP(prevAvgDaily)}</td>
                                            <td style="color: ${variationColor};">
                                                ${variationIcon} ${Math.abs(variation).toFixed(1)}%
                                            </td>
                                        </tr>
                                    `;
        }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : ''}
            
            ${this.renderSalesTable(report.sales)}
        `;
    }
    ,

    async renderIVAReport(selectedYear, selectedMonth) {
        const now = new Date();
        const year = selectedYear !== undefined ? selectedYear : now.getFullYear();
        const month = selectedMonth !== undefined ? selectedMonth : now.getMonth();
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        const report = await ReportController.getMonthlySales(year, month);

        // Separar compras con factura para el detalle (incluyendo factura_neto y factura_bruto)
        const purchasesWithInvoice = (report.purchases || []).filter(p => p.documentType && p.documentType.includes('factura'));
        const netDifference = report.ivaDebito - report.ivaCredito;

        return `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <div>
                    <h3>Detalle de IVA - ${monthNames[month]} ${year}</h3>
                    <p style="color: var(--secondary); margin: 0;">Resumen fiscal de impuestos generados y créditos acumulados.</p>
                </div>
                <div style="display: flex; gap: 1rem; align-items: center;">
                    <div style="background: var(--light); padding: 0.5rem 1rem; border-radius: 0.5rem;">
                        <input type="month" value="${year}-${String(month + 1).padStart(2, '0')}" 
                               onchange="ReportsView.showReport('iva', ...this.value.split('-').map(v => parseInt(v)).map((v, i) => i === 1 ? v-1 : v))"
                               style="background: transparent; border: none; font-weight: bold; color: var(--primary);">
                    </div>
                </div>
            </div>

            <div class="grid grid-3" style="margin-bottom: 2rem;">
                <!-- IVA DÉBITO -->
                <div class="card clickable" 
                     onclick="ReportsView.showIVADetailModal('debito', ${year}, ${month})"
                     style="border-left: 5px solid #f87171; padding: 1.5rem; cursor: pointer; transition: transform 0.2s;"
                     onmouseover="this.style.transform='translateY(-5px)'"
                     onmouseout="this.style.transform='translateY(0)'">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <span style="font-weight: 600; color: #f87171;">🔴 IVA DÉBITO (Ventas)</span>
                        <span class="badge badge-danger">19%</span>
                    </div>
                    <div style="font-size: 2rem; font-weight: 800; color: var(--text);">${formatCLP(report.ivaDebito)}</div>
                    <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem; opacity: 0.8;">Monto total cobrado en impuestos por tus ventas.</p>
                    <div style="text-align: right; margin-top: 1rem; color: var(--primary); font-size: 0.8rem; font-weight: bold;">Ver Detalle (Boletas) →</div>
                </div>

                <!-- IVA CRÉDITO -->
                <div class="card clickable" 
                     onclick="ReportsView.showIVADetailModal('credito', ${year}, ${month})"
                     style="border-left: 5px solid #34d399; padding: 1.5rem; cursor: pointer; transition: transform 0.2s;"
                     onmouseover="this.style.transform='translateY(-5px)'"
                     onmouseout="this.style.transform='translateY(0)'">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <span style="font-weight: 600; color: #34d399;">🟢 IVA CRÉDITO (Compras)</span>
                        <span class="badge badge-success">Facturas</span>
                    </div>
                    <div style="font-size: 2rem; font-weight: 800; color: var(--text);">${formatCLP(report.ivaCredito)}</div>
                    <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem; opacity: 0.8;">Impuesto a tu favor por compras con factura.</p>
                    <div style="text-align: right; margin-top: 1rem; color: var(--primary); font-size: 0.8rem; font-weight: bold;">Ver Detalle (Facturas) →</div>
                </div>

                <!-- DIFERENCIA -->
                <div class="card" style="border-left: 5px solid ${netDifference > 0 ? '#fbbf24' : '#6366f1'}; padding: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <span style="font-weight: 600; color: ${netDifference > 0 ? '#fbbf24' : '#6366f1'};">
                            ${netDifference > 0 ? '⚖️ TOTAL A PAGAR' : '💰 REMANENTE A FAVOR'}
                        </span>
                    </div>
                    <div style="font-size: 2rem; font-weight: 800; color: var(--text);">${formatCLP(Math.abs(netDifference))}</div>
                    <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem; opacity: 0.8;">
                        ${netDifference > 0
                ? 'Este es el monto aproximado que debes pagar al fisco.'
                : 'Este monto queda a tu favor para el próximo mes.'}
                    </p>
                </div>
            </div>

        `;
    },

    async renderProductsReport() {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        const products = await ReportController.getSalesByProduct(startDate, endDate);

        return `
            <h3>Ventas por Producto (Últimos 30 días)</h3>
            
            ${products.length === 0 ? '<div class="empty-state">No hay ventas en este período</div>' : `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr style="font-weight: 800;">
                                <th>Producto</th>
                                <th style="text-align: right;">Cantidad</th>
                                <th style="text-align: right;">Total Vendido</th>
                                <th style="text-align: right; color: #94a3b8; white-space: nowrap;">
                                    Costo Total
                                    <span class="info-help-btn" data-help="costTotal" style="cursor: pointer; font-size: 0.85rem; opacity: 0.7; transition: opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7">ℹ️</span>
                                </th>
                                <th style="text-align: right; color: #10b981; white-space: nowrap;">
                                    Ganancia
                                    <span class="info-help-btn" data-help="realProfit" style="cursor: pointer; font-size: 0.85rem; opacity: 0.7; transition: opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7">ℹ️</span>
                                </th>
                                <th style="text-align: right; color: #10b981; white-space: nowrap;">
                                    Margen
                                    <span class="info-help-btn" data-help="margen" style="cursor: pointer; font-size: 0.85rem; opacity: 0.7; transition: opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7">ℹ️</span>
                                </th>
                                <th>% del Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${products.map(p => {
                                const totalSum = products.reduce((sum, item) => sum + item.total, 0);
                                const percentage = totalSum > 0 ? (p.total / totalSum * 100).toFixed(1) : 0;
                                return `
                                    <tr>
                                        <td><strong>${p.name}</strong></td>
                                        <td style="text-align: right;">${formatNumber(p.quantity)}</td>
                                        <td style="text-align: right;"><strong>${formatCLP(p.total)}</strong></td>
                                        <td style="text-align: right; color: #94a3b8;">${formatCLP(p.costTotal)}</td>
                                        <td style="text-align: right; color: #10b981; font-weight: bold;">${formatCLP(p.grossProfit)}</td>
                                        <td style="text-align: right; color: #10b981; font-weight: bold;">${p.marginPercent}%</td>
                                        <td>
                                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                                <div style="width: 80px; height: 10px; background: var(--light); border-radius: 5px; overflow: hidden;">
                                                    <div style="width: ${percentage}%; height: 100%; background: var(--primary);"></div>
                                                </div>
                                                <span>${percentage}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `}
        `;
    },

    async renderProfitabilityReport() {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        const report = await ReportController.getProfitability(startDate, endDate);

        return `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h3>Rentabilidad Real (Últimos 30 días)</h3>
            <div style="background: rgba(59, 130, 246, 0.1); padding: 0.5rem 1rem; border-radius: 0.5rem; border: 1px solid rgba(59, 130, 246, 0.2); font-size: 0.85rem; color: #60a5fa;">
                ℹ️ Ventas Internas: <b>100% Ingreso</b> | Boletas: <b>Valor Neto (Sin IVA)</b>
            </div>
        </div>
        
        <div class="grid grid-5" style="margin: 1.5rem 0;">
            <div class="stat-card">
                <h3>Ingresos Reales</h3>
                <div class="value" style="color: #60a5fa;">${formatCLP(report.revenue)}</div>
                <small style="opacity: 0.7;">Venta Neta + Venta Interna</small>
            </div>
            <div class="stat-card">
                <h3>Costo de Ventas</h3>
                <div class="value" style="color: #94a3b8;">${formatCLP(report.costOfSales)}</div>
                <small style="opacity: 0.7;">Inversión Neta (Sin IVA)</small>
            </div>
            <div class="stat-card">
                <h3>Ganancia Bruta Real</h3>
                <div class="value" style="color: #34d399; font-weight: 800;">${formatCLP(report.grossProfit)}</div>
                <small style="opacity: 0.8; font-size: 0.75rem; display: block; margin-bottom: 0.2rem;">Utilidad neta sin IVA.</small>
                <small style="opacity: 0.6;">${report.grossMargin.toFixed(1)}% margen real</small>
            </div>
            <div class="stat-card">
                <h3>Gastos Operacionales</h3>
                <div class="value" style="color: #f87171;">${formatCLP(report.operationalExpenses)}</div>
                <small style="opacity: 0.7;">Gastos del período</small>
            </div>
            <div class="stat-card">
                <h3>Utilidad Final</h3>
                <div class="value" style="color: ${report.profit >= 0 ? '#34d399' : '#f87171'}; font-weight: 900;">
                    ${formatCLP(report.profit)}
                </div>
                <small style="opacity: 0.7;">${report.margin.toFixed(1)}% de éxito</small>
            </div>
        </div>
        
        <div style="padding: 1.5rem; background: rgba(17, 24, 39, 0.4); border: 1px solid rgba(255,255,255,0.05); border-radius: 1rem; margin-bottom: 1.5rem;">
            <h4 style="margin-bottom: 1rem; color: var(--secondary);">📊 Estado de Resultados Consolidado</h4>
            <div style="display: flex; flex-direction: column; gap: 0.85rem;">
                <div style="display: flex; justify-content: space-between;">
                    <span style="opacity: 0.8;">Ingresos Reales Acumulados:</span>
                    <strong style="color: #60a5fa;">${formatCLP(report.revenue)}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="opacity: 0.8;">Costo de Productos (Valor Neto):</span>
                    <strong style="color: #f87171;">-${formatCLP(report.costOfSales)}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.1);">
                    <strong style="color: var(--secondary);">Ganancia Bruta Real:</strong>
                    <strong style="color: #34d399; font-size: 1.1rem;">${formatCLP(report.grossProfit)}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="opacity: 0.8;">Descuento por Gastos Operacionales:</span>
                    <strong style="color: #f87171;">-${formatCLP(report.operationalExpenses)}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding-top: 1rem; border-top: 2px solid rgba(255,255,255,0.1); font-size: 1.3rem;">
                    <strong>Utilidad Final del Negocio:</strong>
                    <strong style="color: ${report.profit >= 0 ? '#34d399' : '#f87171'};">
                        ${formatCLP(report.profit)}
                    </strong>
                </div>
            </div>
        </div>
            
            ${report.byCategory && report.byCategory.length > 0 ? `
                <div class="card" style="margin-bottom: 1.5rem;">
                    <h4 style="margin-bottom: 1rem;">Rentabilidad por Categoría</h4>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Categoría</th>
                                    <th>Ingresos</th>
                                    <th>Costos</th>
                                    <th>Ganancia</th>
                                    <th>Margen %</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${report.byCategory.map(cat => `
                                    <tr>
                                        <td><strong>${cat.name}</strong></td>
                                        <td>${formatCLP(cat.revenue)}</td>
                                        <td style="color: var(--danger);">${formatCLP(cat.cost)}</td>
                                        <td style="color: ${cat.profit >= 0 ? 'var(--primary)' : 'var(--danger)'};">
                                            <strong>${formatCLP(cat.profit)}</strong>
                                        </td>
                                        <td>
                                            <span style="color: ${cat.margin >= 0 ? 'var(--primary)' : 'var(--danger)'};">
                                                ${cat.margin.toFixed(1)}%
                                            </span>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : ''}
        `;
    },

    async renderStockReport() {
        const report = await ReportController.getStockReport();

        return `
            <h3>Reporte de Stock e Inventario</h3>
            
            <div class="grid grid-4" style="margin: 1.5rem 0;">
                <div class="stat-card">
                    <h3>Productos Totales</h3>
                    <div class="value">${report.totalProducts}</div>
                </div>
                <div class="stat-card">
                    <h3>Stock Bajo</h3>
                    <div class="value" style="color: var(--warning);">${report.lowStock.length}</div>
                </div>
                <div class="stat-card">
                    <h3>Sin Stock</h3>
                    <div class="value" style="color: var(--danger);">${report.outOfStock.length}</div>
                </div>
                <div class="stat-card">
                    <h3>Valor Inventario</h3>
                    <div class="value" style="color: var(--primary);">${formatCLP(report.totalValue)}</div>
                </div>
            </div>
            
            ${report.lowStock.length > 0 ? `
                <div style="margin-top: 1.5rem;">
                    <h4 style="margin-bottom: 1rem;">Productos con Stock Bajo</h4>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Producto</th>
                                    <th>Stock Actual</th>
                                    <th>Stock Mínimo</th>
                                    <th>Valor Stock</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${report.lowStock.map(p => `
                                    <tr>
                                        <td><strong>${p.name}</strong></td>
                                        <td>
                                            <span class="badge ${p.stock === 0 ? 'badge-danger' : 'badge-warning'}">
                                                ${p.stock} ${p.type === 'weight' ? 'kg' : 'un'}
                                            </span>
                                        </td>
                                        <td>${p.minStock} ${p.type === 'weight' ? 'kg' : 'un'}</td>
                                        <td>${formatCLP(p.stock * p.cost)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : '<div class="empty-state">✓ Todos los productos tienen stock adecuado</div>'}
        `;
    },

    async renderStagnantReport(days = 14) {
        const report = await ReportController.getStagnantProducts(days);
        const topStagnant = report.slice(0, 100);

        return `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem;">
                <div>
                    <h3>Productos Estancados</h3>
                    <p style="color: var(--secondary); margin: 0;">Productos con stock que hace tiempo no se venden. Última venta o fecha de creación > ${days} días.</p>
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <span>Umbral Inactividad:</span>
                    <select class="form-control" style="width: auto;" onchange="ReportsView.showReport('stagnant', this.value)">
                        <option value="7" ${days == 7 ? 'selected' : ''}>7 días</option>
                        <option value="14" ${days == 14 ? 'selected' : ''}>14 días</option>
                        <option value="30" ${days == 30 ? 'selected' : ''}>30 días</option>
                        <option value="60" ${days == 60 ? 'selected' : ''}>60 días</option>
                        <option value="90" ${days == 90 ? 'selected' : ''}>90 días</option>
                    </select>
                </div>
            </div>
            
            <div class="grid grid-3" style="margin-bottom: 1.5rem;">
                <div class="stat-card">
                    <h3>Crítico (>30d)</h3>
                    <div class="value" style="color: var(--danger);">${report.filter(i => i.daysInactive > 30).length}</div>
                    <small>Productos muy estancados</small>
                </div>
                <div class="stat-card">
                    <h3>Total Estancados</h3>
                    <div class="value">${report.length}</div>
                    <small>Bajo umbral de ${days} días</small>
                </div>
                <div class="stat-card">
                    <h3>Valor Inmovilizado</h3>
                    <div class="value" style="color: var(--warning);">${formatCLP(report.reduce((sum, item) => sum + item.costValue, 0))}</div>
                    <small>Costo total aproximado</small>
                </div>
            </div>
            
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th>Última Venta</th>
                            <th>Inactivo Hace</th>
                            <th>Stock</th>
                            <th>Valor Stock</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${topStagnant.map(item => `
                            <tr>
                                <td><strong>${item.name}</strong></td>
                                <td>${item.lastSoldAt ? formatDateTime(item.lastSoldAt).slice(0, 10) : '<span style="opacity: 0.5;">Nunca vendido</span>'}</td>
                                <td>
                                    <span class="badge ${item.daysInactive > 30 ? 'badge-danger' : (item.daysInactive > 14 ? 'badge-warning' : 'badge-info')}">
                                        ${item.daysInactive} días
                                    </span>
                                </td>
                                <td>${item.stock}</td>
                                <td>${formatCLP(item.costValue)}</td>
                            </tr>
                        `).join('')}
                        ${report.length === 0 ? '<tr><td colspan="5" style="text-align:center; padding: 2rem; opacity: 0.5;">No hay productos estancados en este umbral</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        `;
    },

    async renderCostAlertsReport() {
        const alerts = await ReportController.getCostAlerts();

        const fieldMap = {
            'cost': 'Costo',
            'price': 'Precio Venta',
            'name': 'Nombre',
            'barcode': 'Código de Barras',
            'category': 'Categoría',
            'minStock': 'Stock Mínimo',
            'maxStock': 'Stock Máximo',
            'expiryDate': 'Vencimiento',
            'image': 'Imagen',
            'type': 'Tipo Unidad',
            'description': 'Descripción',
            'updatedBy': 'Modificado por'
        };

        return `
            <div class="pos-section">
                <div style="margin-bottom: 2rem; border-left: 4px solid #fbbf24; padding-left: 1rem;">
                    <h3 style="margin: 0;">⚠️ Alertas de Auditoría: Cambios de Costo</h3>
                    <p style="color: var(--secondary); margin: 0.5rem 0 0 0; font-size: 0.9rem;">
                        Este listado detecta modificaciones manuales en el <strong>Costo</strong> del catálogo.
                    </p>
                </div>

                <div class="table-container card glass-panel">
                    <table style="width: 100%; border-collapse: separate; border-spacing: 0 0.5rem;">
                        <thead>
                            <tr style="background: rgba(255,255,255,0.05);">
                                <th style="padding: 1rem; border-radius: 0.5rem 0 0 0.5rem;">Fecha</th>
                                <th style="padding: 1rem;">Responsable</th>
                                <th style="padding: 1rem;">Producto</th>
                                <th style="padding: 1rem; border-radius: 0 0.5rem 0.5rem 0;">Cambio Realizado</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${alerts.length === 0 ? `
                                <tr><td colspan="4" style="text-align:center; padding: 4rem; opacity: 0.5;">
                                    <div style="font-size: 3rem; margin-bottom: 1rem;">✅</div>
                                    Sin cambios manuales sospechosos detectados.
                                </td></tr>
                            ` : alerts.map(a => {
            const changes = a.metadata.changes || {};
            const costChange = changes.cost || changes.costBruto || changes.costNeto;

            // Fallback inteligente para el nombre del producto
            let productName = a.metadata.productName;
            if (!productName) {
                if (a.summary && a.summary.includes('Producto #')) {
                    const match = a.summary.match(/Producto #\d+/);
                    productName = match ? match[0] : 'Producto #' + a.productId;
                } else if (a.summary && a.summary.includes(':')) {
                    productName = a.summary.split(':').pop().trim();
                } else {
                    productName = 'Producto #' + a.productId;
                }
            }

            let detailHTML = '';
            if (costChange) {
                detailHTML = `
                                    <div style="display: flex; flex-direction: column; gap: 0.2rem;">
                                        <div style="font-size: 0.95rem; color: #fbbf24; font-weight: bold;">
                                            ${formatCLP(costChange.old)} ➔ ${formatCLP(costChange.new)}
                                        </div>
                                        ${Object.keys(changes).length > 1 ? `
                                            <div style="font-size: 0.75rem; opacity: 0.6; font-style: italic;">
                                                También se cambió: ${Object.keys(changes).filter(k => k !== 'cost' && k !== 'costBruto' && k !== 'costNeto').map(k => changes[k].label || k).join(', ')}
                                            </div>
                                        ` : ''}
                                    </div>
                                `;
            } else {
                // Fallback para logs antiguos (sin objeto de cambios old/new)
                const fields = a.metadata.changedFields || ['cost'];
                const isOnlyCost = fields.length === 1 && fields[0] === 'cost';

                detailHTML = `
                    <div style="font-size: 0.9rem; color: #fbbf24; font-weight: 600;">
                        ${isOnlyCost ? 'Ajuste de Costo' : 'Ajuste de Costo y más'}
                    </div>
                `;
            }

            return `
                                <tr style="background: rgba(255,255,255,0.02); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='rgba(255,255,255,0.02)'">
                                    <td style="padding: 1rem; border-radius: 0.5rem 0 0 0.5rem; font-size: 0.85rem; color: var(--secondary); white-space: nowrap;">
                                        ${formatDateTime(a.date)}
                                    </td>
                                    <td style="padding: 1rem;">
                                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                                            <div style="width: 28px; height: 28px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.75rem;">
                                                ${a.username.charAt(0).toUpperCase()}
                                            </div>
                                            <span style="font-size: 0.9rem;">${a.username}</span>
                                        </div>
                                    </td>
                                    <td style="padding: 1rem; font-weight: 600; font-size: 0.95rem;">
                                        ${productName}
                                    </td>
                                    <td style="padding: 1rem; border-radius: 0 0.5rem 0.5rem 0;">
                                        ${detailHTML}
                                    </td>
                                </tr>
                            `;
        }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    async renderCategoryChartFromReport(type) {
        const canvas = document.getElementById('categoryChart');
        if (!canvas) return;

        // Limpiar canvas anterior si existe
        const existingChart = Chart.getChart(canvas);
        if (existingChart) existingChart.destroy();

        let report;
        const now = new Date();
        if (type === 'daily') {
            report = await ReportController.getDailySales(now);
        } else if (type === 'weekly') {
            report = await ReportController.getWeeklySales(now);
        } else if (type === 'monthly') {
            const picker = document.getElementById('monthPicker');
            const [y, m] = (picker?.value || `${now.getFullYear()}-${now.getMonth() + 1}`).split('-');
            report = await ReportController.getMonthlySales(parseInt(y), parseInt(m) - 1);
        }

        if (!report || !report.sales || report.sales.length === 0) {
            canvas.parentElement.innerHTML = '<div style="text-align:center; padding: 2.5rem; opacity: 0.6; color: #94a3b8; font-size: 0.9rem;">No hay ventas registradas en este periodo</div>';
            return;
        }

        const categoryData = {};
        // Cargar productos de forma segura
        const allProducts = await Product.getAllIncludingDeleted().catch(() => []);
        const productMap = new Map();
        allProducts.forEach(p => {
            if (p && p.id) productMap.set(String(p.id), p);
        });

        report.sales.forEach(sale => {
            let items = sale.items;
            // Robustez: por si acaso los items vienen como string JSON
            if (typeof items === 'string') {
                try { items = JSON.parse(items); } catch (e) { items = []; }
            }

            (items || []).forEach(item => {
                if (!item) return;

                const productId = String(item.productId || '');
                const prod = productMap.get(productId);

                let cat = 'General';
                if (prod && prod.category && prod.category.trim()) {
                    cat = prod.category.trim();
                } else if (item.category && item.category.trim()) {
                    cat = item.category.trim();
                } else if (prod && prod.name) {
                    // Si no tiene categoría pero sí producto, dejamos en General o la categoría del prod si existiera
                    cat = prod.category || 'General';
                }

                const total = parseFloat(item.total) || 0;
                categoryData[cat] = (categoryData[cat] || 0) + total;
            });
        });

        // Ordenar categorías por monto
        const sortedEntries = Object.entries(categoryData)
            .sort((a, b) => b[1] - a[1]);

        const labels = sortedEntries.map(e => e[0]);
        const data = sortedEntries.map(e => e[1]);

        if (labels.length === 0) {
            canvas.parentElement.innerHTML = '<div style="text-align:center; padding: 2.5rem; opacity: 0.6; color: #94a3b8; font-size: 0.9rem;">Sin categorías detectadas en los productos vendidos</div>';
            return;
        }

        const colors = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#ef4444', '#06b6d4'];

        try {
            if (typeof Chart === 'undefined') throw new Error('Chart.js no cargado');

            // Prevenir Memory Leak: Destruir gráfico anterior si existe en la vista
            if (!this.activeCharts) this.activeCharts = [];

            const chart = new Chart(canvas, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Ventas ($)',
                        data: data,
                        backgroundColor: colors.map(c => c + 'BB'),
                        borderColor: colors,
                        borderWidth: 1,
                        borderRadius: 4,
                        barThickness: 26
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: { padding: { right: 40 } },
                    scales: {
                        x: { display: false },
                        y: {
                            grid: { display: false },
                            ticks: {
                                color: '#e2e8f0',
                                font: { size: 12, family: 'Outfit, sans-serif' }
                            }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.9)',
                            callbacks: {
                                label: (ctx) => ` Subtotal: ${formatCLP(ctx.raw)}`
                            }
                        }
                    }
                },
                plugins: [{
                    id: 'valueLabels',
                    afterDatasetsDraw(chart) {
                        const { ctx } = chart;
                        chart.data.datasets.forEach((dataset, i) => {
                            const meta = chart.getDatasetMeta(i);
                            meta.data.forEach((bar, index) => {
                                const val = dataset.data[index];
                                const text = formatCLP(val);
                                ctx.fillStyle = '#f1f5f9';
                                ctx.font = 'bold 10px Outfit, sans-serif';
                                ctx.textAlign = 'left';
                                ctx.textBaseline = 'middle';
                                ctx.fillText(text, bar.x + 8, bar.y);
                            });
                        });
                    }
                }]
            });

            this.activeCharts.push(chart);

        } catch (e) {
            console.error('Error rendering chart:', e);
            canvas.parentElement.innerHTML = `<div style="text-align:center; color: #ef4444; padding: 1rem;">Error visual: ${e.message}</div>`;
        }
    },

    renderSalesTable(sales) {
        if (sales.length === 0) return '<div class="empty-state">No hay ventas registradas hoy</div>';

        return `
        <div style="margin-top: 2rem;">
            <h4 style="margin-bottom: 1rem; color: var(--secondary); display: flex; align-items: center; gap: 0.5rem;">
                📒 Detalle de Transacciones del Día
            </h4>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Fecha</th>
                            <th>Items</th>
                            <th>Pago</th>
                            <th>Total</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sales.map(s => {
            const statusBadge = s.status === 'completed'
                ? '<span class="badge badge-success">Completada</span>'
                : s.status === 'partial'
                    ? '<span class="badge badge-warning">Parcial</span>'
                    : '<span class="badge badge-danger">Anotado</span>';

            const methodLabel = (s.status === 'pending' || s.status === 'partial')
                ? `${this.getPaymentMethodName(s.paymentMethod)} + Anotado`
                : this.getPaymentMethodName(s.paymentMethod);

            return `
                            <tr>
                                <td>${s.saleNumber}</td>
                                <td>${formatDateTime(s.date)}</td>
                                <td>${s.items.length}</td>
                                <td>${statusBadge} <small style="display:block; opacity: 0.7;">${methodLabel}</small></td>
                                <td><strong>${formatCLP(s.total)}</strong></td>
                                <td>
                                    <button class="btn btn-sm btn-secondary" onclick="ReportsView.updatePayment(${s.id})">✏️</button>
                                </td>
                            </tr>
                        `;
        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    },

    getPaymentMethodName(method) {
        const names = {
            cash: 'Efectivo',
            card: 'Tarjeta',
            qr: 'QR',
            other: 'Otro',
            pending: 'Anotado',
            mixed: 'Pago Mixto'
        };
        return names[method] || method;
    },

    async updatePayment(saleId) {
        const sale = await Sale.getById(saleId);
        const content = `
            <div class="modern-modal-info">
                <div class="info-icon">📒</div>
                <div class="info-content">
                    <h3>Venta #${sale.saleNumber}</h3>
                    <p>Total a Corregir: <strong>${formatCLP(sale.total)}</strong></p>
                </div>
            </div>

            <div class="form-group" style="margin-top: 2rem;">
                <label class="form-label">Seleccionar Nuevo Método de Pago</label>
                <div class="custom-select-wrapper">
                    <select id="newPaymentMethod" class="form-control premium-select">
                        <option value="cash" ${sale.paymentMethod === 'cash' ? 'selected' : ''}>💵 Efectivo</option>
                        <option value="card" ${sale.paymentMethod === 'card' ? 'selected' : ''}>💳 Tarjeta</option>
                        <option value="qr" ${sale.paymentMethod === 'qr' ? 'selected' : ''}>📱 QR / Transferencia</option>
                        <option value="other" ${sale.paymentMethod === 'other' ? 'selected' : ''}> Otras Formas</option>
                    </select>
                </div>
                <small class="form-hint">Esto cambiará el estado de la venta en tus reportes.</small>
            </div>
        `;
        const footer = `
            <div class="modal-actions-premium">
                <button class="btn btn-secondary glass-btn" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-primary premium-action-btn" onclick="ReportsView.savePaymentUpdate(${saleId})">
                    <span>Guardar Cambios</span>
                </button>
            </div>
        `;
        showModal(content, { title: 'Corregir Método de Pago', footer, width: '450px' });
    },

    async savePaymentUpdate(saleId) {
        const newMethod = document.getElementById('newPaymentMethod').value;
        try {
            await ReportController.updateSalePayment(saleId, newMethod);
            closeModal();
            showNotification('Pago actualizado', 'success');
            await this.showReport(this.currentReport);
        } catch (error) {
            showNotification(error.message, 'error');
        }
    },

    async handleMonthChange(value) {
        if (!value) return;
        const [year, month] = value.split('-').map(Number);
        this.showReport('monthly', year, month - 1);
    },

    exportToPDF(type, reportData) {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.setFontSize(18);
            doc.text(`Reporte de Ventas - ${type.toUpperCase()}`, 14, 20);
            doc.setFontSize(12);
            doc.text(`Total: ${formatCLP(reportData.totalAmount)}`, 14, 30);
            doc.text(`Ventas: ${reportData.totalSales}`, 14, 38);

            if (reportData.sales && reportData.sales.length > 0) {
                const cols = ["N°", "Fecha", "Método", "Total"];
                const rows = reportData.sales.map(s => [
                    s.saleNumber,
                    formatDateTime(s.date),
                    this.getPaymentMethodName(s.paymentMethod),
                    formatCLP(s.total)
                ]);
                doc.autoTable({ head: [cols], body: rows, startY: 50 });
            }
            doc.save(`reporte-${type}-${Date.now()}.pdf`);
        } catch (e) {
            console.error(e);
            showNotification('Error al generar PDF', 'error');
        }
    },

    async showIVADetailModal(type, year, month) {
        const report = await ReportController.getMonthlySales(year, month);
        let title = '';
        let content = '';

        if (type === 'debito') {
            title = `Detalle IVA Débito (Ventas) - ${month + 1}/${year}`;
            content = `
                <div class="table-container">
                    <table style="width: 100%;">
                        <thead>
                            <tr style="background: rgba(var(--primary-rgb), 0.1);">
                                <th>N° Venta</th>
                                <th>Fecha</th>
                                <th>Total</th>
                                <th>IVA (19%)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${report.sales.map(s => `
                                <tr>
                                    <td>${s.saleNumber || '#' + (s.id || '').toString().slice(-4)}</td>
                                    <td>${formatDateTime(s.date)}</td>
                                    <td>${formatCLP(s.total)}</td>
                                    <td style="color: #f87171; font-weight: bold;">${formatCLP(s.taxAmount || 0)}</td>
                                </tr>
                            `).join('')}
                            ${report.sales.length === 0 ? '<tr><td colspan="4" style="text-align:center; padding: 2rem; opacity: 0.5;">No hay ventas registradas</td></tr>' : ''}
                        </tbody>
                        <tfoot style="background: rgba(0,0,0,0.05); font-weight: bold;">
                            <tr>
                                <td colspan="2" style="text-align: right;">TOTAL:</td>
                                <td>${formatCLP(report.totalAmount)}</td>
                                <td style="color: #f87171;">${formatCLP(report.ivaDebito)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            `;
        } else {
            title = `Detalle de Compras y Crédito IVA - ${month + 1}/${year}`;
            content = `
                <div class="table-container">
                    <table style="width: 100%;">
                        <thead>
                            <tr style="background: rgba(52, 211, 153, 0.1);">
                                <th>Fecha</th>
                                <th>Proveedor</th>
                                <th>Tipo Doc.</th>
                                <th>Total Bruto</th>
                                <th>IVA Crédito</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${report.purchases.map(p => {
                const isInvoice = p.documentType === 'factura';
                return `
                                <tr style="${!isInvoice ? 'opacity: 0.7;' : ''}">
                                    <td>${formatDate(p.date)}</td>
                                    <td>${p.supplierName || 'S/N'}</td>
                                    <td><span class="badge ${isInvoice ? 'badge-success' : 'badge-secondary'}">${(p.documentType || 'S/D').toUpperCase()}</span></td>
                                    <td>${formatCLP(p.total)}</td>
                                    <td style="color: ${isInvoice ? '#34d399' : 'var(--secondary)'}; font-weight: ${isInvoice ? 'bold' : 'normal'};">
                                        ${formatCLP(p.ivaAmount || 0)}
                                    </td>
                                </tr>
                            `;
            }).join('')}
                            ${report.purchases.length === 0 ? '<tr><td colspan="5" style="text-align:center; padding: 2rem; opacity: 0.5;">No se registraron compras este mes</td></tr>' : ''}
                        </tbody>
                        <tfoot style="background: rgba(0,0,0,0.05); font-weight: bold;">
                            <tr>
                                <td colspan="3" style="text-align: right;">TOTAL CRÉDITO FACTURAS:</td>
                                <td colspan="2" style="color: #34d399; text-align: right; padding-right: 1.5rem;">${formatCLP(report.ivaCredito)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            `;
        }

        showModal(content, { title, width: '700px' });
    },

    destroy() {
        if (this.activeCharts) {
            this.activeCharts.forEach(c => {
                try { c.destroy(); } catch(e) {}
            });
            this.activeCharts = [];
        }
    },

    handleCierresMonthChange(value) {
        if (!value) return;
        const [y, m] = value.split('-').map(Number);
        ReportsView.cierresSelectedYear = y;
        ReportsView.cierresSelectedMonth = m - 1;
        ReportsView.showReport('cierres');
    },

    async renderCierresReport() {
        // Obtener todos los registros de caja históricos
        const allRegisters = await CashRegister.getAll();
        
        const now = new Date();
        let year = ReportsView.cierresSelectedYear !== undefined ? ReportsView.cierresSelectedYear : now.getFullYear();
        let month = ReportsView.cierresSelectedMonth !== undefined ? ReportsView.cierresSelectedMonth : now.getMonth();
        
        // Si es la primera vez que se carga y no hay filtros, usar el mes del registro más reciente
        if (ReportsView.cierresSelectedYear === undefined) {
            const closedRegistersOnly = allRegisters.filter(r => r.status === 'closed');
            if (closedRegistersOnly.length > 0) {
                const refDate = new Date(closedRegistersOnly[0].closeDate);
                year = refDate.getFullYear();
                month = refDate.getMonth();
            }
            ReportsView.cierresSelectedYear = year;
            ReportsView.cierresSelectedMonth = month;
        }

        // Filtrar cajas cerradas por año y mes de la fecha de cierre
        const closedRegisters = allRegisters.filter(r => {
            if (r.status !== 'closed') return false;
            const closeDate = new Date(r.closeDate);
            return closeDate.getFullYear() === year && closeDate.getMonth() === month;
        });

        // Ordenar cierres por fecha de cierre descendente
        closedRegisters.sort((a, b) => new Date(b.closeDate) - new Date(a.closeDate));

        if (closedRegisters.length === 0) {
            return `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <h3 style="color: #111827; margin: 0 0 0.25rem 0;">Historial de Cierres de Caja</h3>
                        <p style="color: #4b5563; margin: 0; font-size: 0.9rem;">Consulta la utilidad de los turnos cerrados filtrando por mes.</p>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem; background: #f3f4f6; padding: 0.5rem 1rem; border-radius: 0.5rem; border: 1px solid #e5e7eb;">
                        <label for="cierresMonthPicker" style="font-size: 0.85rem; font-weight: 700; color: #4b5563;">Seleccionar Mes:</label>
                        <input type="month" id="cierresMonthPicker" 
                               value="${year}-${String(month + 1).padStart(2, '0')}" 
                               onchange="ReportsView.handleCierresMonthChange(this.value)"
                               style="background: transparent; border: none; font-weight: bold; color: #10b981; font-size: 0.95rem; cursor: pointer;">
                    </div>
                </div>
                <div class="empty-state" style="padding: 3rem; text-align: center; background: white; border-radius: 1rem; border: 1.5px solid #d1d5db;">
                    <div class="empty-state-icon" style="font-size: 3rem; margin-bottom: 1rem;">🔒</div>
                    <h3 style="color: #4b5563; font-weight: 700;">Sin cierres de caja en este mes</h3>
                    <p style="color: #6b7280; font-size: 0.9rem; margin-top: 0.5rem;">Prueba seleccionando otro mes en el calendario de arriba.</p>
                </div>
            `;
        }

        // Obtener resúmenes de cada caja y calcular acumulados
        let totalSalesAccum = 0;
        let totalExpensesAccum = 0;
        let grossProfitAccum = 0;
        let netProfitAccum = 0;

        const enriched = [];
        for (const reg of closedRegisters) {
            try {
                const summary = await CashRegister.getSummary(reg.id);
                enriched.push(summary);
                
                totalSalesAccum += summary.totalSalesAmount || 0;
                totalExpensesAccum += summary.totalExpenses || 0;
                grossProfitAccum += summary.grossProfit || 0;
                netProfitAccum += summary.netProfit || 0;
            } catch (err) {
                console.error(`Error al cargar resumen de caja #${reg.id}:`, err);
                enriched.push({
                    ...reg,
                    totalSalesAmount: 0,
                    totalExpenses: 0,
                    grossProfit: 0,
                    netProfit: 0
                });
            }
        }

        const rows = enriched.map(summary => {
            const totalVentas = summary.totalSalesAmount || 0;
            const gastos = summary.totalExpenses || 0;
            const gBruta = summary.grossProfit || 0;
            const gNeta = summary.netProfit || 0;

            const netColor = gNeta >= 0 ? '#10b981' : '#ef4444';

            return `
                <tr style="border-bottom: 1px solid #e5e7eb; font-size: 0.875rem; color: #374151;">
                    <td style="padding: 1rem 0.75rem;">
                        <strong style="color: #111827;">#${summary.id}</strong>
                    </td>
                    <td style="padding: 1rem 0.75rem; line-height: 1.6;">
                        <div style="font-size: 0.95rem; color: #1e293b; font-weight: 700; display: flex; align-items: center; gap: 0.35rem;">
                            <span style="background: rgba(16, 185, 129, 0.12); color: #065f46; padding: 0.25rem 0.6rem; border-radius: 0.5rem; font-size: 0.7rem; font-weight: 800; border: 1px solid rgba(16, 185, 129, 0.2); letter-spacing: 0.5px;">🟢 APERTURA</span>
                            ${formatDateTime(summary.openDate)}
                        </div>
                        <div style="font-size: 0.95rem; color: #1e293b; font-weight: 700; margin-top: 0.5rem; display: flex; align-items: center; gap: 0.35rem;">
                            <span style="background: rgba(239, 68, 68, 0.12); color: #991b1b; padding: 0.25rem 0.6rem; border-radius: 0.5rem; font-size: 0.7rem; font-weight: 800; border: 1px solid rgba(239, 68, 68, 0.2); letter-spacing: 0.5px;">🔴 CIERRE</span>
                            ${formatDateTime(summary.closeDate)}
                        </div>
                    </td>
                    <td style="padding: 1rem 0.75rem; font-weight: 600; text-transform: capitalize;">${summary.username || 'Admin'}</td>
                    <td style="padding: 1rem 0.75rem; font-weight: 700; color: #2563eb;">${formatCLP(totalVentas)}</td>
                    <td style="padding: 1rem 0.75rem; font-weight: 700; color: #dc2626;">-${formatCLP(gastos)}</td>
                    <td style="padding: 1rem 0.75rem; font-weight: 700; color: #10b981;">${formatCLP(gBruta)}</td>
                    <td style="padding: 1rem 0.75rem; font-weight: 900; color: ${netColor}; font-size: 0.95rem;">${formatCLP(gNeta)}</td>
                    <td style="padding: 1rem 0.75rem; text-align: right;">
                        <button class="btn btn-sm btn-primary" onclick="CashView.showCashHistory(${summary.id})" style="border-radius: 0.5rem; font-weight: 700; padding: 0.4rem 0.75rem;">
                            📋 Detalle Ventas
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <!-- Filtro y Calendarios -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
                <div>
                    <h3 style="color: #111827; margin: 0 0 0.25rem 0;">Historial de Cierres de Caja</h3>
                    <p style="color: #4b5563; margin: 0; font-size: 0.9rem;">Consulta la utilidad de los turnos cerrados filtrando por mes.</p>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem; background: #f3f4f6; padding: 0.5rem 1rem; border-radius: 0.5rem; border: 1px solid #e5e7eb;">
                    <label for="cierresMonthPicker" style="font-size: 0.85rem; font-weight: 700; color: #4b5563;">Seleccionar Mes:</label>
                    <input type="month" id="cierresMonthPicker" 
                           value="${year}-${String(month + 1).padStart(2, '0')}" 
                           onchange="ReportsView.handleCierresMonthChange(this.value)"
                           style="background: transparent; border: none; font-weight: bold; color: #10b981; font-size: 0.95rem; cursor: pointer;">
                </div>
            </div>

            <!-- Tarjetas de Resumen Acumulado -->
            <div class="grid grid-4" style="margin-bottom: 2rem; gap: 1rem;">
                <div class="stat-card" style="background: white; border: 1.5px solid #d1d5db; padding: 1.25rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                    <h4 style="margin: 0 0 0.5rem 0; font-size: 0.75rem; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; font-weight: 800;">💰 Total Vendido (Bruto)</h4>
                    <div style="font-size: 1.5rem; font-weight: 900; color: #1e293b;">${formatCLP(totalSalesAccum)}</div>
                    <small style="color: #64748b; font-size: 0.75rem;">Suma total del periodo</small>
                </div>
                <div class="stat-card" style="background: white; border: 1.5px solid #d1d5db; padding: 1.25rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                    <h4 style="margin: 0 0 0.5rem 0; font-size: 0.75rem; text-transform: uppercase; color: #10b981; letter-spacing: 0.5px; font-weight: 800;">📈 Ganancia Bruta Acumulada</h4>
                    <div style="font-size: 1.5rem; font-weight: 900; color: #10b981;">${formatCLP(grossProfitAccum)}</div>
                    <small style="color: #64748b; font-size: 0.75rem;">Sin restar gastos operativos</small>
                </div>
                <div class="stat-card" style="background: white; border: 1.5px solid #d1d5db; padding: 1.25rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                    <h4 style="margin: 0 0 0.5rem 0; font-size: 0.75rem; text-transform: uppercase; color: #ef4444; letter-spacing: 0.5px; font-weight: 800;">💸 Gastos Operacionales Totales</h4>
                    <div style="font-size: 1.5rem; font-weight: 900; color: #ef4444;">-${formatCLP(totalExpensesAccum)}</div>
                    <small style="color: #64748b; font-size: 0.75rem;">Suma de egresos/gastos de cajas</small>
                </div>
                <div class="stat-card" style="background: white; border: 1.5px solid #d1d5db; padding: 1.25rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border-left: 4px solid #6366f1;">
                    <h4 style="margin: 0 0 0.5rem 0; font-size: 0.75rem; text-transform: uppercase; color: #6366f1; letter-spacing: 0.5px; font-weight: 900;">💎 Utilidad Real Final</h4>
                    <div style="font-size: 1.5rem; font-weight: 900; color: #6366f1;">${formatCLP(netProfitAccum)}</div>
                    <small style="color: #64748b; font-size: 0.75rem;">Ganancia bruta menos gastos</small>
                </div>
            </div>

            <div class="table-container card glass-panel" style="padding: 1rem; border-radius: 1.25rem;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="border-bottom: 2px solid #e5e7eb; text-align: left; font-size: 0.8rem; color: #4b5563; text-transform: uppercase; font-weight: 800;">
                            <th style="padding: 0.75rem;">Turno</th>
                            <th style="padding: 0.75rem;">Fecha y Horario</th>
                            <th style="padding: 0.75rem;">Cajero</th>
                            <th style="padding: 0.75rem;">Ventas (Bruto)</th>
                            <th style="padding: 0.75rem;">Gastos</th>
                            <th style="padding: 0.75rem;">Ganancia Bruta</th>
                            <th style="padding: 0.75rem; white-space: nowrap;">
                                Ganancia Neta
                                <span class="info-help-btn" data-help="cierres" style="cursor: pointer; font-size: 0.85rem; opacity: 0.7; transition: opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7">ℹ️</span>
                            </th>
                            <th style="padding: 0.75rem; text-align: right;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    }
};
