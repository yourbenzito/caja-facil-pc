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
                    <button class="btn ${this.currentReport === 'decisionMatrix' ? 'btn-primary' : 'btn-secondary'}" 
                            onclick="ReportsView.showReport('decisionMatrix')">
                        📊 Matriz de Decisión
                    </button>
                    <button class="btn ${this.currentReport === 'cierres' ? 'btn-primary' : 'btn-secondary'}" 
                            onclick="ReportsView.showReport('cierres')">
                        🔒 Historial de Cierres
                    </button>
                </div>
                
                <div id="reportContent">
                    ${await (async () => {
                        switch (this.currentReport) {
                            case 'decisionMatrix': return await this.renderDecisionMatrix();
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
            case 'decisionMatrix':
                content = await this.renderDecisionMatrix();
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

    async renderDailyReport(targetDateStr = null) {
        const dateStr = targetDateStr || this.selectedDailyDate || new Date().toISOString().slice(0, 10);
        this.selectedDailyDate = dateStr;
        const targetDate = new Date(`${dateStr}T12:00:00`);

        const report = await ReportController.getDailySales(targetDate);
        const startOfDay = new Date(`${dateStr}T00:00:00`);
        const endOfDay = new Date(`${dateStr}T23:59:59`);

        // Guardar referencia para exportación CSV
        this._lastDailyReportSales = report.sales || [];
        this._lastDailyDateStr = dateStr;

        // 1. Comparativa vs Ayer (sin error visual de doble signo)
        const yesterdayDate = new Date(targetDate.getTime() - 86400000);
        let yesterdayReport = { totalAmount: 0 };
        try {
            yesterdayReport = await ReportController.getDailySales(yesterdayDate);
        } catch (_) { }
        
        const diffAmount = report.totalAmount - yesterdayReport.totalAmount;
        let percBadgeHtml = '';
        if (yesterdayReport.totalAmount > 0) {
            const rawPerc = ((diffAmount / yesterdayReport.totalAmount) * 100);
            const absPerc = Math.abs(rawPerc).toFixed(1);
            if (rawPerc >= 0) {
                percBadgeHtml = `<span class="badge badge-success" style="font-size: 0.75rem; padding: 0.25rem 0.6rem;">▲ +${absPerc}% vs Ayer (${formatCLP(yesterdayReport.totalAmount)})</span>`;
            } else {
                percBadgeHtml = `<span class="badge badge-danger" style="font-size: 0.75rem; padding: 0.25rem 0.6rem;">▼ -${absPerc}% vs Ayer (${formatCLP(yesterdayReport.totalAmount)})</span>`;
            }
        } else {
            percBadgeHtml = `<span class="badge badge-secondary" style="font-size: 0.75rem; padding: 0.25rem 0.6rem;">${report.totalAmount > 0 ? 'Primer día con ventas' : 'Sin ventas ayer'}</span>`;
        }

        // 2. Abonos/Cobros de deudas recibidos hoy
        let paymentsReceivedToday = [];
        let totalDebtPaymentsToday = 0;
        try {
            paymentsReceivedToday = await Payment.getByDateRange(startOfDay, endOfDay) || [];
            totalDebtPaymentsToday = paymentsReceivedToday.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        } catch (_) { }

        // 3. Descuentos, Anulaciones y Acumuladores
        let totalDiscountsToday = 0;
        let cancelledCount = 0;
        let cancelledAmount = 0;
        let totalUnitsSold = 0;

        const productMap = new Map();
        const categoryMap = new Map();
        const paymentMethods = { cash: 0, card: 0, qr: 0, other: 0, pending: 0 };
        const hourlyMap = new Array(24).fill(0);

        report.sales.forEach(sale => {
            const total = parseFloat(sale.total) || 0;
            const discountVal = parseFloat(sale.discountAmount || sale.discount) || 0;
            totalDiscountsToday += discountVal;

            if (sale.status === 'cancelled') {
                cancelledCount += 1;
                cancelledAmount += total;
                return;
            }

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

            const paid = parseFloat(sale.paidAmount !== undefined ? sale.paidAmount : (sale.status === 'completed' ? total : 0)) || 0;
            const pending = Math.max(0, total - paid);
            if (pending >= 1.0) {
                paymentMethods.pending += pending;
            }

            // Horas
            if (sale.createdAt || sale.date) {
                const h = new Date(sale.createdAt || sale.date).getHours();
                if (h >= 0 && h < 24) hourlyMap[h] += total;
            }

            // Items vendidos y márgenes por producto
            (sale.items || []).forEach(item => {
                const prodId = item.productId || item.id;
                const prodKey = prodId || item.name || 'Producto';
                const qty = parseFloat(item.quantity) || 0;
                const price = parseFloat(item.unitPrice || item.price) || 0;
                const unitCost = parseFloat(item.costAtSale) || 0;
                const lineTotal = price * qty;
                const lineProfit = lineTotal - (unitCost * qty);

                totalUnitsSold += qty;

                const existingP = productMap.get(prodKey) || { id: prodId, name: item.name || 'Producto', quantity: 0, total: 0, profit: 0 };
                existingP.quantity += qty;
                existingP.total += lineTotal;
                existingP.profit += lineProfit;
                productMap.set(prodKey, existingP);

                const catName = item.categoryName || item.category || 'General';
                const existingC = categoryMap.get(catName) || 0;
                categoryMap.set(catName, existingC + lineTotal);
            });
        });

        // 4. Cálculos ejecutivos de valor
        const avgTicket = report.totalSales > 0 ? Math.round(report.totalAmount / report.totalSales) : 0;
        const avgBasket = report.totalSales > 0 ? (totalUnitsSold / report.totalSales).toFixed(1) : '0';

        // Ganancia comercial pura en ventas (sin restar arriendos/gastos mensuales)
        const commercialProfit = report.grossCommercialProfit !== undefined 
            ? report.grossCommercialProfit 
            : (report.totalNeto - report.totalCostNet);
        const commercialMargin = report.totalNeto > 0 
            ? Math.round((commercialProfit / report.totalNeto) * 100) 
            : 0;

        // Flujo real de dinero cobrado (Ventas cobradas hoy + Abonos de fiados recibidos hoy)
        const totalCashInflow = paymentMethods.cash + paymentMethods.card + paymentMethods.qr + paymentMethods.other + totalDebtPaymentsToday;
        const netCashBalance = totalCashInflow - (report.operationalExpenses || 0);

        // Hora Pico
        let peakHour = -1;
        let peakAmount = 0;
        hourlyMap.forEach((amt, hr) => {
            if (amt > peakAmount) {
                peakAmount = amt;
                peakHour = hr;
            }
        });
        const peakHourText = peakHour !== -1 && peakAmount > 0 
            ? `${String(peakHour).padStart(2, '0')}:00 a ${String(peakHour + 1).padStart(2, '0')}:00 hrs (${formatCLP(peakAmount)})`
            : 'Sin concentración marcada';

        // Top 5 Productos por Venta & Top Ganadores
        const topProducts = Array.from(productMap.values()).sort((a, b) => b.total - a.total).slice(0, 5);
        const categoryList = Array.from(categoryMap.entries())
            .map(([name, amount]) => ({ name, amount }))
            .sort((a, b) => b.amount - a.amount);
        const totalCategorySales = categoryList.reduce((sum, c) => sum + c.amount, 0);

        // Alerta de stock para productos vendidos hoy
        let lowStockAlerts = [];
        try {
            const allProducts = await Product.getAll();
            const prodStockMap = new Map(allProducts.map(p => [p.id, p]));
            productMap.forEach(item => {
                if (item.id) {
                    const p = prodStockMap.get(item.id);
                    if (p && (p.stock <= (p.minStock || 5))) {
                        lowStockAlerts.push({ name: p.name, currentStock: p.stock, minStock: p.minStock || 5, isWeight: p.type === 'weight' });
                    }
                }
            });
        } catch (_) {}

        const todayStr = new Date().toISOString().slice(0, 10);
        const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

        return `
            <!-- CABECERA CON SELECTOR DE FECHA Y BOTONES DE EXPORTACIÓN -->
            <div class="flex-between-wrap" style="margin-bottom: 1.25rem; gap: 1rem; align-items: center;">
                <div>
                    <h3 style="margin: 0; font-size: 1.4rem; color: var(--text-main); display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                        📅 Ventas del Día: ${formatDate(targetDate)}
                        ${percBadgeHtml}
                    </h3>
                    <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: var(--secondary);">Resumen comercial, financiero y fiscal puro del día seleccionado.</p>
                </div>
                
                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                    <div style="display: flex; gap: 0.35rem; align-items: center;">
                        <button class="btn btn-sm btn-secondary" onclick="ReportsView.navigateDailyDate(-1)" title="Día Anterior" style="font-size: 0.9rem; padding: 0.3rem 0.65rem; border-radius: 0.5rem; font-weight: 900; background: #e2e8f0; border: 1.5px solid #cbd5e1; color: #1e293b; cursor: pointer;">◀</button>
                        <button class="btn btn-sm ${dateStr === todayStr ? 'btn-primary' : 'btn-secondary'}" 
                                onclick="ReportsView.handleDailyDateChange('${todayStr}')">Hoy</button>
                        <button class="btn btn-sm ${dateStr === yesterdayStr ? 'btn-primary' : 'btn-secondary'}" 
                                onclick="ReportsView.handleDailyDateChange('${yesterdayStr}')">Ayer</button>
                        <button class="btn btn-sm btn-secondary" onclick="ReportsView.navigateDailyDate(1)" title="Día Siguiente" style="font-size: 0.9rem; padding: 0.3rem 0.65rem; border-radius: 0.5rem; font-weight: 900; background: #e2e8f0; border: 1.5px solid #cbd5e1; color: #1e293b; cursor: pointer;">▶</button>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem; background: var(--surface-content); padding: 0.4rem 0.85rem; border-radius: 0.75rem; border: 1px solid var(--border);">
                        <label for="dailyDatePicker" style="font-size: 0.8rem; font-weight: 700; color: var(--secondary); white-space: nowrap;">Fecha:</label>
                        <input type="date" id="dailyDatePicker" value="${dateStr}" 
                               onchange="ReportsView.handleDailyDateChange(this.value)"
                                style="border: none; background: transparent; font-weight: 800; color: var(--primary); cursor: pointer; font-size: 0.9rem;">
                    </div>
                    <button class="btn btn-success" onclick="ReportsView.exportDailyToCSV()" style="font-weight: 700;">
                        📊 Exportar Excel (CSV)
                    </button>
                    <button class="btn btn-secondary" onclick="ReportsView.exportToPDF('daily', ${JSON.stringify(report).replace(/"/g, '&quot;')})" style="background-color: #dc2626; color: white; border-color: #dc2626; font-weight: 700;">
                        📄 PDF
                    </button>
                </div>
            </div>

            <!-- FILA 1: TARJETAS PRINCIPALES DEL NEGOCIO -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem;">
                <!-- Total Vendido -->
                <div style="padding: 0.85rem 1rem; background: rgba(59, 130, 246, 0.08); border: 1.5px solid rgba(59, 130, 246, 0.3); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: #2563eb; font-weight: 800; text-transform: uppercase;">Total Vendido (Bruto)</div>
                    <div style="font-size: 1.4rem; font-weight: 900; color: #2563eb; margin: 0.2rem 0;">${formatCLP(report.totalAmount)}</div>
                    <div style="font-size: 0.72rem; color: var(--secondary); font-weight: 600;">${report.totalSales} ventas | Avg ${formatCLP(avgTicket)}</div>
                </div>

                <!-- Ganancia Comercial en Ventas -->
                <div style="padding: 0.85rem 1rem; background: rgba(16, 185, 129, 0.08); border: 1.5px solid rgba(16, 185, 129, 0.3); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: #059669; font-weight: 800; text-transform: uppercase;">💎 Ganancia en Ventas</div>
                    <div style="font-size: 1.4rem; font-weight: 900; color: #059669; margin: 0.2rem 0;">${formatCLP(commercialProfit)}</div>
                    <div style="font-size: 0.72rem; color: #059669; font-weight: 700;">Margen comercial: ${commercialMargin}%</div>
                </div>

                <!-- Gastos del Día -->
                <div style="padding: 0.85rem 1rem; background: rgba(239, 68, 68, 0.08); border: 1.5px solid rgba(239, 68, 68, 0.3); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: #dc2626; font-weight: 800; text-transform: uppercase;">💸 Gastos Pagados Hoy</div>
                    <div style="font-size: 1.4rem; font-weight: 900; color: #dc2626; margin: 0.2rem 0;">${formatCLP(report.operationalExpenses || 0)}</div>
                    <div style="font-size: 0.72rem; color: var(--secondary); font-weight: 600;">Egresos operativos</div>
                </div>

                <!-- Flujo Neto de Caja -->
                <div style="padding: 0.85rem 1rem; background: rgba(139, 92, 246, 0.08); border: 1.5px solid rgba(139, 92, 246, 0.3); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: #7c3aed; font-weight: 800; text-transform: uppercase;">💵 Flujo Neto en Caja</div>
                    <div style="font-size: 1.4rem; font-weight: 900; color: #7c3aed; margin: 0.2rem 0;">${formatCLP(netCashBalance)}</div>
                    <div style="font-size: 0.72rem; color: var(--secondary); font-weight: 600;">Cobrado - Gastos</div>
                </div>

                <!-- Resumen Fiscal Compacto -->
                <div style="padding: 0.85rem 1rem; background: var(--surface-content); border: 1px solid var(--border); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: var(--secondary); font-weight: 800; text-transform: uppercase;">📑 Resumen Fiscal</div>
                    <div style="font-size: 0.9rem; font-weight: 800; color: var(--text-main); margin-top: 0.25rem;">Neto: <strong>${formatCLP(report.totalNeto || (report.totalAmount - report.ivaDebito))}</strong></div>
                    <div style="font-size: 0.85rem; font-weight: 800; color: #d97706;">IVA (19%): <strong>${formatCLP(report.ivaDebito)}</strong></div>
                </div>

                <!-- Canasta Promedio y Descuentos -->
                <div style="padding: 0.85rem 1rem; background: var(--surface-content); border: 1px solid var(--border); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: var(--secondary); font-weight: 800; text-transform: uppercase;">🛒 Canasta Promedio</div>
                    <div style="font-size: 1.2rem; font-weight: 900; color: var(--text-main); margin: 0.2rem 0;">${avgBasket} un/ticket</div>
                    <div style="font-size: 0.72rem; color: #db2777; font-weight: 700;">Desc: ${formatCLP(totalDiscountsToday)}</div>
                </div>
            </div>

            <!-- FILA 2: RECAUDACIÓN REAL POR MEDIO DE PAGO -->
            <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem; margin-bottom: 1.25rem;">
                <h4 style="margin: 0 0 0.85rem 0; font-size: 0.95rem; color: var(--text-main); display: flex; align-items: center; gap: 0.5rem;">
                    💳 ¿Cómo entró el dinero hoy? (Recaudación Real de la Jornada)
                </h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem;">
                    <!-- Efectivo -->
                    <div style="padding: 0.75rem 1rem; background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.25); border-radius: 0.65rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 0.8rem; font-weight: 800; color: #15803d;">💵 EFECTIVO</span>
                        </div>
                        <div style="font-size: 1.25rem; font-weight: 900; color: #15803d; margin-top: 0.2rem;">${formatCLP(paymentMethods.cash)}</div>
                        <small style="font-size: 0.7rem; color: var(--secondary);">Dinero en cajón</small>
                    </div>

                    <!-- Tarjetas -->
                    <div style="padding: 0.75rem 1rem; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 0.65rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 0.8rem; font-weight: 800; color: #1d4ed8;">💳 TARJETAS / POS</span>
                        </div>
                        <div style="font-size: 1.25rem; font-weight: 900; color: #1d4ed8; margin-top: 0.2rem;">${formatCLP(paymentMethods.card)}</div>
                        <small style="font-size: 0.7rem; color: var(--secondary);">Transbank / MercadoPago</small>
                    </div>

                    <!-- Transferencias -->
                    <div style="padding: 0.75rem 1rem; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 0.65rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 0.8rem; font-weight: 800; color: #b45309;">🏦 TRANSFERENCIAS / QR</span>
                        </div>
                        <div style="font-size: 1.25rem; font-weight: 900; color: #b45309; margin-top: 0.2rem;">${formatCLP(paymentMethods.other + paymentMethods.qr)}</div>
                        <small style="font-size: 0.7rem; color: var(--secondary);">Cuenta Bancaria</small>
                    </div>

                    <!-- Fiados otorgados -->
                    <div style="padding: 0.75rem 1rem; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 0.65rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 0.8rem; font-weight: 800; color: #b91c1c;">📓 FIADOS DEL DÍA</span>
                        </div>
                        <div style="font-size: 1.25rem; font-weight: 900; color: #b91c1c; margin-top: 0.2rem;">${formatCLP(paymentMethods.pending)}</div>
                        <small style="font-size: 0.7rem; color: var(--secondary);">Ventas a crédito por cobrar</small>
                    </div>

                    <!-- Abonos cobrados -->
                    <div style="padding: 0.75rem 1rem; background: rgba(16, 185, 129, 0.12); border: 1.5px solid rgba(16, 185, 129, 0.4); border-radius: 0.65rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 0.8rem; font-weight: 800; color: #047857;">🤝 ABONOS RECIBIDOS</span>
                        </div>
                        <div style="font-size: 1.25rem; font-weight: 900; color: #047857; margin-top: 0.2rem;">+${formatCLP(totalDebtPaymentsToday)}</div>
                        <small style="font-size: 0.7rem; color: var(--secondary);">Cobro de deudas viejas</small>
                    </div>
                </div>
            </div>

            <!-- FILA 3: CRÉDITOS, DEVOLUCIONES Y ALERTAS DE REPOSICIÓN -->
            <div style="margin-bottom: 1.25rem;">
                <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem;">
                    <h4 style="margin: 0 0 0.85rem 0; font-size: 0.95rem;">🤝 Movimientos Financieros Especiales & Alertas</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.85rem;">
                        <!-- Clickeable: Fiados anotados hoy -->
                        <div style="padding: 0.85rem 1rem; background: rgba(239, 68, 68, 0.08); border-radius: 0.75rem; border: 1.5px solid rgba(239, 68, 68, 0.25); cursor: pointer; display: flex; justify-content: space-between; align-items: center;" 
                             onclick="ReportsView.showDailyFiadosModal('${dateStr}')" title="Ver deudas otorgadas hoy">
                            <div>
                                <div style="font-weight: 800; color: #dc2626; font-size: 0.85rem;">📝 Fiados Otorgados Hoy 🔍</div>
                                <div style="font-size: 0.75rem; color: var(--secondary);">Ver qué clientes fiaron</div>
                            </div>
                            <div style="font-size: 1.25rem; font-weight: 900; color: #dc2626;">${formatCLP(paymentMethods.pending)}</div>
                        </div>

                        <!-- Clickeable: Abonos recibidos hoy -->
                        <div style="padding: 0.85rem 1rem; background: rgba(16, 185, 129, 0.08); border: 1.5px solid rgba(16, 185, 129, 0.3); border-radius: 0.75rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center;"
                             onclick="ReportsView.showDailyPaymentsModal('${dateStr}')"
                             title="Haz clic para ver qué clientes abonaron/pagaron deudas hoy">
                            <div>
                                <div style="font-weight: 800; color: #059669; font-size: 0.85rem;">🤝 Deudas Cobradas Hoy (${paymentsReceivedToday.length}) 🔍</div>
                                <div style="font-size: 0.75rem; color: var(--secondary);">Ver quién vino a abonar</div>
                            </div>
                            <div style="font-size: 1.25rem; font-weight: 900; color: #059669;">+${formatCLP(totalDebtPaymentsToday)}</div>
                        </div>

                        <!-- Devoluciones y Anulaciones -->
                        <div style="padding: 0.85rem 1rem; background: rgba(239, 68, 68, 0.05); border: 1px dashed rgba(239, 68, 68, 0.3); border-radius: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-weight: 800; color: #dc2626; font-size: 0.85rem;">🔄 Ventas Anuladas (${cancelledCount})</div>
                                <div style="font-size: 0.75rem; color: var(--secondary);">Cancelaciones en el día</div>
                            </div>
                            <div style="font-size: 1.25rem; font-weight: 900; color: #dc2626;">-${formatCLP(cancelledAmount)}</div>
                        </div>

                        <!-- Alertas de Reposición (Stock Bajo) -->
                        <div style="padding: 0.85rem 1rem; background: ${lowStockAlerts.length > 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(100, 116, 139, 0.05)'}; border: 1.5px solid ${lowStockAlerts.length > 0 ? 'var(--warning)' : 'var(--border)'}; border-radius: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-weight: 800; color: ${lowStockAlerts.length > 0 ? '#d97706' : 'var(--text-main)'}; font-size: 0.85rem;">
                                    ${lowStockAlerts.length > 0 ? '⚠️ Alerta de Reposición' : '📦 Stock en Buen Estado'}
                                </div>
                                <div style="font-size: 0.75rem; color: var(--secondary);">
                                    ${lowStockAlerts.length > 0 ? `${lowStockAlerts.length} productos vendidos con bajo stock` : 'Sin quiebres de stock hoy'}
                                </div>
                            </div>
                            <div style="font-size: 1.2rem; font-weight: 900; color: ${lowStockAlerts.length > 0 ? '#d97706' : 'var(--secondary)'};">
                                ${lowStockAlerts.length > 0 ? `🚨 ${lowStockAlerts.length}` : '✅ OK'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- FILA 4: TOP 5 PRODUCTOS Y VENTAS POR CATEGORÍA -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin-bottom: 1.5rem;">
                <!-- TOP 5 PRODUCTOS ESTRELLA CON GANANCIA -->
                <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem;">
                    <h4 style="margin-bottom: 1rem; font-size: 0.95rem; color: var(--text-main);">🏆 Top 5 Productos del Día (Ventas & Ganancia)</h4>
                    ${topProducts.length === 0 ? '<p style="color:var(--secondary); font-size:0.85rem;">Sin productos vendidos hoy</p>' : `
                        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                            ${topProducts.map((p, idx) => {
                                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                                return `
                                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.55rem 0.75rem; background: var(--surface-content); border-radius: 0.5rem; border: 1px solid var(--border);">
                                        <div style="display: flex; align-items: center; gap: 0.6rem;">
                                            <span style="font-size: 1.1rem; width: 24px; text-align: center;">${medal}</span>
                                            <div>
                                                <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-main);">${safeHTML(p.name)}</div>
                                                <small style="color: var(--secondary); font-size: 0.75rem;">${p.quantity} un vendidas | Ganancia: <strong style="color:#059669;">+${formatCLP(p.profit)}</strong></small>
                                            </div>
                                        </div>
                                        <div style="font-weight: 900; color: var(--primary); font-size: 0.95rem;">${formatCLP(p.total)}</div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>

                <!-- VENTAS POR CATEGORÍA -->
                <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem;">
                    <h4 style="margin-bottom: 1rem; font-size: 0.95rem; color: var(--text-main);">📂 Ventas del Día por Categoría</h4>
                    ${categoryList.length === 0 ? '<p style="color:var(--secondary); font-size:0.85rem;">Sin ventas registradas</p>' : `
                        <div style="display: flex; flex-direction: column; gap: 0.65rem;">
                            ${categoryList.slice(0, 5).map(c => {
                                const percent = totalCategorySales > 0 ? Math.round((c.amount / totalCategorySales) * 100) : 0;
                                return `
                                    <div>
                                        <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 0.2rem;">
                                            <span style="font-weight: 700; color: var(--text-main);">${safeHTML(c.name)}</span>
                                            <span style="font-weight: 800; color: var(--primary);">${formatCLP(c.amount)} (${percent}%)</span>
                                        </div>
                                        <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden;">
                                            <div style="width: ${percent}%; height: 100%; background: var(--primary); border-radius: 3px;"></div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>
            </div>

            <!-- GRÁFICO DE EVOLUCIÓN POR HORA CON HORA PICO -->
            <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem; margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
                    <h4 style="margin: 0; font-size: 0.95rem;">📈 Evolución de Ventas por Tramo Horario</h4>
                    <span class="badge badge-warning" style="font-size: 0.8rem; font-weight: 800; padding: 0.35rem 0.75rem;">
                        🔥 Hora Pico: ${peakHourText}
                    </span>
                </div>
                ${this._renderHourlyChart(report.sales)}
            </div>

            <!-- TABLA DE DETALLE DE TRANSACCIONES DEL DÍA -->
            ${this.renderSalesTable(report.sales)}
        `;
    },

    async handleDailyDateChange(dateStr) {
        if (!dateStr) return;
        this.selectedDailyDate = dateStr;
        const content = await this.renderDailyReport(dateStr);
        const container = document.getElementById('reportContent');
        if (container) container.innerHTML = content;
    },

    async showDailyFiadosModal(dateStr) {
        try {
            const startOfDay = new Date(`${dateStr}T00:00:00`);
            const endOfDay = new Date(`${dateStr}T23:59:59`);
            const sales = await Sale.getByDateRange(startOfDay, endOfDay) || [];
            const customers = await Customer.getAll();
            const customerMap = new Map(customers.map(c => [String(c.id), c.name]));

            const pendingSales = sales.filter(s => s.status !== 'cancelled' && ((s.total || 0) - (s.paidAmount || 0)) >= 1.0);

            if (pendingSales.length === 0) {
                showModal('<div style="text-align:center; padding:1.5rem; color:var(--secondary); font-weight:700;">No hay fiados registrados en esta fecha 🎉</div>', { title: '📝 Fiados Anotados Hoy' });
                return;
            }

            const rows = pendingSales.map(s => {
                const custName = customerMap.get(String(s.customerId)) || 'Cliente No Identificado';
                const pendingAmount = Math.max(0, (s.total || 0) - (s.paidAmount || 0));
                const itemsText = (s.items || []).map(i => `${i.quantity || 1}x ${i.name || 'Producto'}`).join(', ');
                return `
                    <tr style="border-bottom: 1px solid var(--border);">
                        <td style="padding: 0.75rem; font-weight: 700;">${custName}</td>
                        <td style="padding: 0.75rem;">Venta #${s.saleNumber || s.id}</td>
                        <td style="padding: 0.75rem; font-size: 0.8rem; color: var(--secondary); max-width: 250px;">${itemsText}</td>
                        <td style="padding: 0.75rem; text-align: right; font-weight: 900; color: #dc2626;">${formatCLP(pendingAmount)}</td>
                    </tr>
                `;
            }).join('');

            const content = `
                <div style="max-height: 400px; overflow-y: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--border); text-align: left; font-size: 0.8rem; color: var(--secondary); text-transform: uppercase;">
                                <th style="padding: 0.5rem;">Cliente</th>
                                <th style="padding: 0.5rem;">Venta</th>
                                <th style="padding: 0.5rem;">Detalle de Productos</th>
                                <th style="padding: 0.5rem; text-align: right;">Monto Fiado</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `;
            showModal(content, { title: `📝 Fiados del ${formatDate(new Date(dateStr + 'T12:00:00'))}`, width: '680px' });
        } catch (e) {
            console.error('Error en modal de fiados:', e);
            showNotification('Error al cargar detalle de fiados', 'error');
        }
    },

    async showDailyPaymentsModal(dateStr) {
        try {
            const startOfDay = new Date(`${dateStr}T00:00:00`);
            const endOfDay = new Date(`${dateStr}T23:59:59`);
            const payments = await Payment.getByDateRange(startOfDay, endOfDay) || [];
            const customers = await Customer.getAll();
            const customerMap = new Map(customers.map(c => [String(c.id), c.name]));

            if (payments.length === 0) {
                showModal('<div style="text-align:center; padding:1.5rem; color:var(--secondary); font-weight:700;">No hay cobros ni abonos de deuda registrados en esta fecha</div>', { title: '🤝 Cobros de Deuda' });
                return;
            }

            const rows = payments.map(p => {
                const custName = customerMap.get(String(p.customerId)) || 'Cliente';
                const method = this.getPaymentMethodName(p.paymentMethod || 'cash');
                return `
                    <tr style="border-bottom: 1px solid var(--border);">
                        <td style="padding: 0.75rem; font-weight: 700;">${custName}</td>
                        <td style="padding: 0.75rem; font-size: 0.8rem; color: var(--secondary);">${formatDateTime(p.date)}</td>
                        <td style="padding: 0.75rem;">${method}</td>
                        <td style="padding: 0.75rem; text-align: right; font-weight: 900; color: #10b981;">+${formatCLP(p.amount)}</td>
                    </tr>
                `;
            }).join('');

            const content = `
                <div style="max-height: 400px; overflow-y: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--border); text-align: left; font-size: 0.8rem; color: var(--secondary); text-transform: uppercase;">
                                <th style="padding: 0.5rem;">Cliente</th>
                                <th style="padding: 0.5rem;">Fecha y Hora</th>
                                <th style="padding: 0.5rem;">Método de Pago</th>
                                <th style="padding: 0.5rem; text-align: right;">Monto Cobrado</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `;
            showModal(content, { title: `🤝 Cobros de Deuda el ${formatDate(new Date(dateStr + 'T12:00:00'))}`, width: '600px' });
        } catch (e) {
            console.error('Error en modal de cobros:', e);
            showNotification('Error al cargar detalle de cobros', 'error');
        }
    },

    _renderHourlyChart(sales) {
        const hourlyData = Array(24).fill(0);
        (sales || []).forEach(s => {
            if (s.status === 'cancelled') return;
            const d = s.date ? new Date(s.date) : null;
            if (d && !isNaN(d.getTime())) {
                const hour = d.getHours();
                hourlyData[hour] += parseFloat(s.total) || 0;
            }
        });

        const hours = [];
        for (let h = 8; h <= 22; h++) {
            hours.push({ hour: `${String(h).padStart(2, '0')}:00`, total: hourlyData[h] || 0 });
        }
        const maxVal = Math.max(...hours.map(h => h.total), 1);

        return `
            <div style="display: flex; align-items: flex-end; justify-content: space-between; gap: 0.5rem; height: 130px; padding-top: 1rem;">
                ${hours.map(h => {
                    const heightPct = Math.max(6, Math.round((h.total / maxVal) * 100));
                    const barBg = h.total > 0 ? 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)' : 'var(--light)';
                    return `
                        <div style="flex:1; display:flex; flex-direction:column; align-items:center; height:100%; justify-content:flex-end;">
                            <div style="font-size:0.65rem; font-weight:800; color:var(--text-main); margin-bottom:0.25rem; text-align:center;">
                                ${h.total > 0 ? formatCLP(h.total, true) : ''}
                            </div>
                            <div style="width:100%; max-width:32px; height:${heightPct}%; background:${barBg}; border-radius:0.35rem 0.35rem 0 0; transition:all 0.3s; cursor:pointer;"
                                 title="Tramo ${h.hour}: ${formatCLP(h.total)}">
                            </div>
                            <div style="font-size:0.68rem; font-weight:600; color:var(--secondary); margin-top:0.35rem;">
                                ${h.hour}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    async navigateWeeklyDate(offsetWeeks) {
        const currentDate = this.selectedWeeklyDate ? new Date(`${this.selectedWeeklyDate}T12:00:00`) : new Date();
        currentDate.setDate(currentDate.getDate() + (offsetWeeks * 7));
        const newDateStr = currentDate.toISOString().slice(0, 10);
        await this.handleWeeklyDateChange(newDateStr);
    },

    async renderWeeklyReport(targetDateStr = null) {
        const dateStr = targetDateStr || this.selectedWeeklyDate || new Date().toISOString().slice(0, 10);
        this.selectedWeeklyDate = dateStr;
        const targetDate = new Date(`${dateStr}T12:00:00`);

        const report = await ReportController.getWeeklySales(targetDate);
        this._lastWeeklyReportSales = report.sales || [];
        this._lastWeeklyDateStr = dateStr;

        // 1. Comparativa vs Semana Anterior
        const prevWeekDate = new Date(targetDate.getTime() - (7 * 86400000));
        let prevWeekReport = { totalAmount: 0 };
        try {
            prevWeekReport = await ReportController.getWeeklySales(prevWeekDate);
        } catch (_) { }

        const diffAmount = report.totalAmount - prevWeekReport.totalAmount;
        let percBadgeHtml = '';
        if (prevWeekReport.totalAmount > 0) {
            const rawPerc = ((diffAmount / prevWeekReport.totalAmount) * 100);
            const absPerc = Math.abs(rawPerc).toFixed(1);
            if (rawPerc >= 0) {
                percBadgeHtml = `<span class="badge badge-success" style="font-size: 0.75rem; padding: 0.25rem 0.6rem;">▲ +${absPerc}% vs Semana Anterior (${formatCLP(prevWeekReport.totalAmount)})</span>`;
            } else {
                percBadgeHtml = `<span class="badge badge-danger" style="font-size: 0.75rem; padding: 0.25rem 0.6rem;">▼ -${absPerc}% vs Semana Anterior (${formatCLP(prevWeekReport.totalAmount)})</span>`;
            }
        } else {
            percBadgeHtml = `<span class="badge badge-secondary" style="font-size: 0.75rem; padding: 0.25rem 0.6rem;">${report.totalAmount > 0 ? 'Primera semana registrada' : 'Sin ventas en semana anterior'}</span>`;
        }

        // 2. Abonos de deudas cobrados durante esta semana
        let paymentsReceivedWeek = [];
        let totalDebtPaymentsWeek = 0;
        try {
            paymentsReceivedWeek = await Payment.getByDateRange(report.startDate, report.endDate) || [];
            totalDebtPaymentsWeek = paymentsReceivedWeek.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        } catch (_) { }

        // 3. Desglose diario (Lunes a Domingo) + Detección de Mejor y Peor Día
        const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        let peakDayName = '-';
        let peakDayTotal = 0;
        let lowestDayName = '-';
        let lowestDayTotal = Infinity;

        const dailyList = Object.entries(report.dailyBreakdown || {}).map(([key, data]) => {
            const d = new Date(key + 'T12:00:00');
            const dayName = dayNames[d.getDay()];
            if (data.total > peakDayTotal) {
                peakDayTotal = data.total;
                peakDayName = dayName;
            }
            if (data.total < lowestDayTotal && data.count > 0) {
                lowestDayTotal = data.total;
                lowestDayName = dayName;
            }
            return {
                key,
                dayName,
                dateFormatted: `${d.getDate()}/${d.getMonth() + 1}`,
                ...data
            };
        });

        if (lowestDayTotal === Infinity) {
            lowestDayTotal = 0;
            lowestDayName = 'Sin datos';
        }

        // 4. Métodos de Pago, Top Productos y Ganancias
        const productMap = new Map();
        let totalDiscountsWeek = 0;
        let totalUnitsSold = 0;
        const paymentMethods = { cash: 0, card: 0, qr: 0, other: 0, pending: 0 };

        report.sales.forEach(sale => {
            totalDiscountsWeek += parseFloat(sale.discountAmount || sale.discount) || 0;

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
            if (pending >= 1.0) paymentMethods.pending += pending;

            (sale.items || []).forEach(item => {
                const prodId = item.productId || item.id;
                const prodKey = prodId || item.name || 'Producto';
                const qty = parseFloat(item.quantity) || 0;
                const price = parseFloat(item.unitPrice || item.price) || 0;
                const unitCost = parseFloat(item.costAtSale) || 0;
                const lineTotal = price * qty;
                const lineProfit = lineTotal - (unitCost * qty);

                totalUnitsSold += qty;

                const existingP = productMap.get(prodKey) || { id: prodId, name: item.name || 'Producto', quantity: 0, total: 0, profit: 0 };
                existingP.quantity += qty;
                existingP.total += lineTotal;
                existingP.profit += lineProfit;
                productMap.set(prodKey, existingP);
            });
        });

        const topProducts = Array.from(productMap.values()).sort((a, b) => b.total - a.total).slice(0, 5);
        const avgTicket = report.totalSales > 0 ? Math.round(report.totalAmount / report.totalSales) : 0;
        const avgBasket = report.totalSales > 0 ? (totalUnitsSold / report.totalSales).toFixed(1) : '0';

        // Ganancia comercial pura en ventas
        const commercialProfit = report.grossCommercialProfit !== undefined 
            ? report.grossCommercialProfit 
            : (report.totalNeto - report.totalCostNet);
        const commercialMargin = report.totalNeto > 0 
            ? Math.round((commercialProfit / report.totalNeto) * 100) 
            : 0;

        // Flujo neto real de dinero semanal
        const totalCashInflow = paymentMethods.cash + paymentMethods.card + paymentMethods.qr + paymentMethods.other + totalDebtPaymentsWeek;
        const netCashBalance = totalCashInflow - (report.operationalExpenses || 0);

        const currentWeekMondayStr = new Date().toISOString().slice(0, 10);

        return `
            <!-- CABECERA Y NAVEGACIÓN DE SEMANA -->
            <div class="flex-between-wrap" style="margin-bottom: 1.25rem; gap: 1rem; align-items: center;">
                <div>
                    <h3 style="margin: 0; font-size: 1.4rem; color: var(--text-main); display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                        📅 Ventas Semanales
                        ${percBadgeHtml}
                    </h3>
                    <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: var(--secondary);">
                        Semana del ${formatDate(report.startDate)} al ${formatDate(report.endDate)} (Lunes a Domingo)
                    </p>
                </div>

                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                    <div style="display: flex; gap: 0.35rem; align-items: center;">
                        <button class="btn btn-sm btn-secondary" onclick="ReportsView.navigateWeeklyDate(-1)" title="Semana Anterior" style="font-size: 0.9rem; padding: 0.3rem 0.65rem; border-radius: 0.5rem; font-weight: 900; background: #e2e8f0; border: 1.5px solid #cbd5e1; color: #1e293b; cursor: pointer;">◀</button>
                        <button class="btn btn-sm btn-primary" onclick="ReportsView.handleWeeklyDateChange('${currentWeekMondayStr}')">Esta Semana</button>
                        <button class="btn btn-sm btn-secondary" onclick="ReportsView.navigateWeeklyDate(1)" title="Semana Siguiente" style="font-size: 0.9rem; padding: 0.3rem 0.65rem; border-radius: 0.5rem; font-weight: 900; background: #e2e8f0; border: 1.5px solid #cbd5e1; color: #1e293b; cursor: pointer;">▶</button>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem; background: var(--surface-content); padding: 0.4rem 0.85rem; border-radius: 0.75rem; border: 1px solid var(--border);">
                        <label for="weeklyDatePicker" style="font-size: 0.8rem; font-weight: 700; color: var(--secondary); white-space: nowrap;">Fecha:</label>
                        <input type="date" id="weeklyDatePicker" value="${dateStr}" 
                               onchange="ReportsView.handleWeeklyDateChange(this.value)"
                               style="border: none; background: transparent; font-weight: 800; color: var(--primary); cursor: pointer; font-size: 0.9rem;">
                    </div>
                    <button class="btn btn-success" onclick="ReportsView.exportWeeklyToCSV()" style="font-weight: 700;">
                        📊 Exportar Excel (CSV)
                    </button>
                    <button class="btn btn-secondary" onclick="ReportsView.exportToPDF('weekly', ${JSON.stringify(report).replace(/"/g, '&quot;')})" style="background-color: #dc2626; color: white; border-color: #dc2626; font-weight: 700;">
                        📄 PDF
                    </button>
                </div>
            </div>

            <!-- FILA 1: TARJETAS PRINCIPALES SEMANALES -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem;">
                <!-- Total Vendido Semanal -->
                <div style="padding: 0.85rem 1rem; background: rgba(59, 130, 246, 0.08); border: 1.5px solid rgba(59, 130, 246, 0.3); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: #2563eb; font-weight: 800; text-transform: uppercase;">Total Vendido Semanal</div>
                    <div style="font-size: 1.4rem; font-weight: 900; color: #2563eb; margin: 0.2rem 0;">${formatCLP(report.totalAmount)}</div>
                    <div style="font-size: 0.72rem; color: var(--secondary); font-weight: 600;">${report.totalSales} ventas | Avg ${formatCLP(avgTicket)}</div>
                </div>

                <!-- Ganancia Comercial Semanal -->
                <div style="padding: 0.85rem 1rem; background: rgba(16, 185, 129, 0.08); border: 1.5px solid rgba(16, 185, 129, 0.3); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: #059669; font-weight: 800; text-transform: uppercase;">💎 Ganancia Comercial</div>
                    <div style="font-size: 1.4rem; font-weight: 900; color: #059669; margin: 0.2rem 0;">${formatCLP(commercialProfit)}</div>
                    <div style="font-size: 0.72rem; color: #059669; font-weight: 700;">Margen 7 días: ${commercialMargin}%</div>
                </div>

                <!-- Gastos Semanales -->
                <div style="padding: 0.85rem 1rem; background: rgba(239, 68, 68, 0.08); border: 1.5px solid rgba(239, 68, 68, 0.3); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: #dc2626; font-weight: 800; text-transform: uppercase;">💸 Gastos de la Semana</div>
                    <div style="font-size: 1.4rem; font-weight: 900; color: #dc2626; margin: 0.2rem 0;">${formatCLP(report.operationalExpenses || 0)}</div>
                    <div style="font-size: 0.72rem; color: var(--secondary); font-weight: 600;">Egresos 7 días</div>
                </div>

                <!-- Flujo Neto Semanal -->
                <div style="padding: 0.85rem 1rem; background: rgba(139, 92, 246, 0.08); border: 1.5px solid rgba(139, 92, 246, 0.3); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: #7c3aed; font-weight: 800; text-transform: uppercase;">💵 Flujo Neto en Caja</div>
                    <div style="font-size: 1.4rem; font-weight: 900; color: #7c3aed; margin: 0.2rem 0;">${formatCLP(netCashBalance)}</div>
                    <div style="font-size: 0.72rem; color: var(--secondary); font-weight: 600;">Cobrado - Gastos</div>
                </div>

                <!-- Resumen Fiscal Semanal -->
                <div style="padding: 0.85rem 1rem; background: var(--surface-content); border: 1px solid var(--border); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: var(--secondary); font-weight: 800; text-transform: uppercase;">📑 Fiscal Semanal</div>
                    <div style="font-size: 0.85rem; font-weight: 800; color: #d97706; margin-top: 0.25rem;">IVA Débito: <strong>${formatCLP(report.ivaDebito)}</strong></div>
                    <div style="font-size: 0.85rem; font-weight: 800; color: #059669;">IVA Crédito: <strong>${formatCLP(report.ivaCredito)}</strong></div>
                </div>

                <!-- Canasta y Descuentos -->
                <div style="padding: 0.85rem 1rem; background: var(--surface-content); border: 1px solid var(--border); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: var(--secondary); font-weight: 800; text-transform: uppercase;">🛒 Canasta Semanal</div>
                    <div style="font-size: 1.2rem; font-weight: 900; color: var(--text-main); margin: 0.2rem 0;">${avgBasket} un/ticket</div>
                    <div style="font-size: 0.72rem; color: #db2777; font-weight: 700;">Desc: ${formatCLP(totalDiscountsWeek)}</div>
                </div>
            </div>

            <!-- FILA 2: DÍA PICO VS DÍA MÁS BAJO & MEDIOS DE PAGO -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin-bottom: 1.25rem;">
                <!-- Rendimiento de Días (Mejor vs Peor) -->
                <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem; display: flex; flex-direction: column; justify-content: space-between;">
                    <h4 style="margin: 0 0 0.75rem 0; font-size: 0.95rem; color: var(--text-main);">⚡ Extremos de la Semana</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                        <div style="padding: 1rem; background: rgba(16, 185, 129, 0.08); border: 1.5px solid rgba(16, 185, 129, 0.3); border-radius: 0.75rem; text-align: center;">
                            <span style="font-size: 0.75rem; color: #059669; font-weight: 800; text-transform: uppercase;">🏆 Mejor Día</span>
                            <div style="font-size: 1.3rem; font-weight: 900; color: #059669; margin: 0.2rem 0;">${peakDayName}</div>
                            <div style="font-size: 0.9rem; font-weight: 800; color: var(--text-main);">${formatCLP(peakDayTotal)}</div>
                        </div>

                        <div style="padding: 1rem; background: rgba(245, 158, 11, 0.08); border: 1.5px solid rgba(245, 158, 11, 0.3); border-radius: 0.75rem; text-align: center;">
                            <span style="font-size: 0.75rem; color: #d97706; font-weight: 800; text-transform: uppercase;">📉 Día Más Flojo</span>
                            <div style="font-size: 1.3rem; font-weight: 900; color: #d97706; margin: 0.2rem 0;">${lowestDayName}</div>
                            <div style="font-size: 0.9rem; font-weight: 800; color: var(--text-main);">${formatCLP(lowestDayTotal)}</div>
                        </div>
                    </div>
                </div>

                <!-- Métodos de Pago Semanales -->
                <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem;">
                    <h4 style="margin-bottom: 0.75rem; font-size: 0.95rem; color: var(--text-main);">💳 ¿Cómo entró el dinero en la semana?</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.6rem;">
                        <div style="text-align: center; padding: 0.6rem; background: rgba(16, 185, 129, 0.08); border-radius: 0.65rem; border: 1px solid rgba(16, 185, 129, 0.2);">
                            <div style="font-size: 0.72rem; color: #059669; font-weight: 800;">💵 Efectivo</div>
                            <div style="font-size: 1rem; font-weight: 900; color: #059669;">${formatCLP(paymentMethods.cash)}</div>
                        </div>
                        <div style="text-align: center; padding: 0.6rem; background: rgba(59, 130, 246, 0.08); border-radius: 0.65rem; border: 1px solid rgba(59, 130, 246, 0.2);">
                            <div style="font-size: 0.72rem; color: #2563eb; font-weight: 800;">💳 Tarjetas</div>
                            <div style="font-size: 1rem; font-weight: 900; color: #2563eb;">${formatCLP(paymentMethods.card)}</div>
                        </div>
                        <div style="text-align: center; padding: 0.6rem; background: rgba(245, 158, 11, 0.08); border-radius: 0.65rem; border: 1px solid rgba(245, 158, 11, 0.2);">
                            <div style="font-size: 0.72rem; color: #b45309; font-weight: 800;">🏦 Transferencia</div>
                            <div style="font-size: 1rem; font-weight: 900; color: #b45309;">${formatCLP(paymentMethods.other + paymentMethods.qr)}</div>
                        </div>
                        <div style="text-align: center; padding: 0.6rem; background: rgba(239, 68, 68, 0.08); border-radius: 0.65rem; border: 1px solid rgba(239, 68, 68, 0.25);">
                            <div style="font-size: 0.72rem; color: #dc2626; font-weight: 800;">📓 Fiados Semanales</div>
                            <div style="font-size: 1rem; font-weight: 900; color: #dc2626;">${formatCLP(paymentMethods.pending)}</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- DESGLOSE COMPARATIVO DÍA POR DÍA (LUNES A DOMINGO) -->
            <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem; margin-bottom: 1.25rem;">
                <h4 style="margin-bottom: 1rem; font-size: 0.95rem; color: var(--text-main);">📅 Comparativo Diario de la Semana (Lunes a Domingo)</h4>
                <div class="table-container">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--border); font-size: 0.8rem; color: var(--secondary); text-transform: uppercase;">
                                <th style="padding: 0.75rem; text-align: left;">Día</th>
                                <th style="padding: 0.75rem; text-align: center;">Fecha</th>
                                <th style="padding: 0.75rem; text-align: center;">Boletas</th>
                                <th style="padding: 0.75rem; text-align: right;">Total Vendido</th>
                                <th style="padding: 0.75rem; text-align: right;">Venta Limpia (Neto)</th>
                                <th style="padding: 0.75rem; text-align: center;">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${dailyList.map(d => {
                                const isPeak = d.dayName === peakDayName && peakDayTotal > 0;
                                const isLow = d.dayName === lowestDayName && lowestDayTotal > 0 && !isPeak;
                                const rowBg = isPeak ? 'rgba(16, 185, 129, 0.05)' : (isLow ? 'rgba(245, 158, 11, 0.05)' : 'transparent');
                                const statusBadge = isPeak 
                                    ? '<span class="badge badge-success" style="font-size: 0.7rem; font-weight: 800;">🏆 Mejor Día</span>' 
                                    : (isLow ? '<span class="badge badge-warning" style="font-size: 0.7rem; font-weight: 800;">📉 Día Flojo</span>' : '-');
                                
                                return `
                                    <tr style="border-bottom: 1px solid var(--border); background: ${rowBg};">
                                        <td style="padding: 0.75rem; font-weight: 800; color: var(--text-main);">${d.dayName}</td>
                                        <td style="padding: 0.75rem; text-align: center; color: var(--secondary);">${d.dateFormatted}</td>
                                        <td style="padding: 0.75rem; text-align: center;"><span class="badge badge-primary">${d.count} ticket(s)</span></td>
                                        <td style="padding: 0.75rem; text-align: right; font-weight: 900; color: #2563eb;">${formatCLP(d.total)}</td>
                                        <td style="padding: 0.75rem; text-align: right; font-weight: 800; color: #059669;">${formatCLP(d.neto)}</td>
                                        <td style="padding: 0.75rem; text-align: center;">${statusBadge}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- TOP 5 PRODUCTOS DE LA SEMANA CON GANANCIA -->
            <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem; margin-bottom: 1.5rem;">
                <h4 style="margin-bottom: 1rem; font-size: 0.95rem; color: var(--text-main);">🏆 Top 5 Productos Estrella de la Semana (Ventas & Ganancia)</h4>
                ${topProducts.length === 0 ? '<p style="color:var(--secondary); font-size:0.85rem;">Sin productos vendidos esta semana</p>' : `
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75rem;">
                        ${topProducts.map((p, idx) => {
                            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                            return `
                                <div style="padding: 0.75rem 1rem; background: var(--surface-content); border-radius: 0.75rem; border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                                    <div style="display: flex; align-items: center; gap: 0.6rem;">
                                        <span style="font-size: 1.2rem;">${medal}</span>
                                        <div>
                                            <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-main);">${safeHTML(p.name)}</div>
                                            <small style="color: var(--secondary); font-size: 0.75rem;">${p.quantity} unid. | Ganancia: <strong style="color:#059669;">+${formatCLP(p.profit)}</strong></small>
                                        </div>
                                    </div>
                                    <div style="font-weight: 900; color: var(--primary); font-size: 0.95rem;">${formatCLP(p.total)}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `}
            </div>

            <!-- TABLA COMPLETA DE TRANSACCIONES SEMANALES -->
            ${this.renderSalesTable(report.sales)}
        `;
    },

    async handleWeeklyDateChange(dateStr) {
        if (!dateStr) return;
        this.selectedWeeklyDate = dateStr;
        const content = await this.renderWeeklyReport(dateStr);
        const container = document.getElementById('reportContent');
        if (container) container.innerHTML = content;
    },

    exportWeeklyToCSV() {
        const sales = this._lastWeeklyReportSales || [];
        const dateStr = this._lastWeeklyDateStr || new Date().toISOString().slice(0, 10);
        if (sales.length === 0) {
            showNotification('No hay ventas registradas para exportar en esta semana', 'warning');
            return;
        }
        const headers = ['Nº Ticket', 'Fecha / Hora', 'Método de Pago', 'Estado', 'Items', 'Subtotal ($)', 'Descuento ($)', 'Total Vendido ($)'];
        const rows = sales.map(s => [
            `"#${s.saleNumber || s.id}"`,
            `"${s.date ? new Date(s.date).toLocaleString('es-CL') : ''}"`,
            `"${s.paymentMethod || 'cash'}"`,
            `"${s.status || 'completed'}"`,
            (s.items || []).length,
            s.subtotal || s.total || 0,
            s.discountAmount || s.discount || 0,
            s.total || 0
        ]);
        const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `reporte_ventas_semana_${dateStr}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification('📊 Reporte de Ventas Semanales descargado en Excel (CSV)', 'success');
    },

    async navigateMonthlyDate(offsetMonths) {
        const now = new Date();
        const curYear = this.selectedMonthlyYear !== undefined ? this.selectedMonthlyYear : now.getFullYear();
        const curMonth = this.selectedMonthlyMonth !== undefined ? this.selectedMonthlyMonth : now.getMonth();
        const targetDate = new Date(curYear, curMonth + offsetMonths, 1);
        await this.handleMonthChange(`${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`);
    },

    async renderMonthlyReport(selectedYear, selectedMonth) {
        const now = new Date();
        const currentYear = selectedYear !== undefined ? selectedYear : now.getFullYear();
        const currentMonth = selectedMonth !== undefined ? selectedMonth : now.getMonth();
        this.selectedMonthlyYear = currentYear;
        this.selectedMonthlyMonth = currentMonth;

        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        const monthsWithSales = new Set();
        const startHistory = new Date(currentYear - 1, 0, 1);
        const recentSales = await Sale.getByDateRange(startHistory.toISOString(), now.toISOString());

        recentSales.forEach(sale => {
            const saleDate = new Date(sale.date);
            monthsWithSales.add(`${saleDate.getFullYear()}-${saleDate.getMonth()}`);
        });

        const report = await ReportController.getMonthlySales(currentYear, currentMonth);
        this._lastMonthlyReportSales = report.sales || [];
        this._lastMonthlyDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

        const startOfMonth = new Date(currentYear, currentMonth, 1);
        const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
        const isCurrentMonth = currentYear === now.getFullYear() && currentMonth === now.getMonth();
        const periodEnd = isCurrentMonth ? now : endOfMonth;
        const daysInPeriod = Math.max(1, Math.ceil((periodEnd - startOfMonth) / (1000 * 60 * 60 * 24)) + (isCurrentMonth ? 0 : 1));
        const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

        // 1. Comparativa vs Mes Anterior
        const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
        let prevMonthReport = { totalAmount: 0 };
        try {
            prevMonthReport = await ReportController.getMonthlySales(prevMonthDate.getFullYear(), prevMonthDate.getMonth());
        } catch (_) { }

        const diffAmount = report.totalAmount - prevMonthReport.totalAmount;
        let percBadgeHtml = '';
        if (prevMonthReport.totalAmount > 0) {
            const rawPerc = ((diffAmount / prevMonthReport.totalAmount) * 100);
            const absPerc = Math.abs(rawPerc).toFixed(1);
            if (rawPerc >= 0) {
                percBadgeHtml = `<span class="badge badge-success" style="font-size: 0.75rem; padding: 0.25rem 0.6rem;">▲ +${absPerc}% vs Mes Anterior (${formatCLP(prevMonthReport.totalAmount)})</span>`;
            } else {
                percBadgeHtml = `<span class="badge badge-danger" style="font-size: 0.75rem; padding: 0.25rem 0.6rem;">▼ -${absPerc}% vs Mes Anterior (${formatCLP(prevMonthReport.totalAmount)})</span>`;
            }
        } else {
            percBadgeHtml = `<span class="badge badge-secondary" style="font-size: 0.75rem; padding: 0.25rem 0.6rem;">${report.totalAmount > 0 ? 'Primer mes registrado' : 'Sin ventas en mes anterior'}</span>`;
        }

        // 2. Abonos de deudas recibidos en el mes
        let paymentsReceivedMonth = [];
        let totalDebtPaymentsMonth = 0;
        try {
            paymentsReceivedMonth = await Payment.getByDateRange(startOfMonth, endOfMonth) || [];
            totalDebtPaymentsMonth = paymentsReceivedMonth.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        } catch (_) { }

        // 3. Proyección Comercial
        const dailyAvg = report.totalSales > 0 ? (report.totalAmount / daysInPeriod) : 0;
        const monthProjection = Math.round(dailyAvg * totalDaysInMonth);

        // 4. Métodos de Pago, Top Productos y Ganancias
        const productMap = new Map();
        let totalDiscountsMonth = 0;
        let totalUnitsSold = 0;
        const paymentMethods = { cash: 0, card: 0, qr: 0, other: 0, pending: 0 };

        report.sales.forEach(sale => {
            totalDiscountsMonth += parseFloat(sale.discountAmount || sale.discount) || 0;

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
            if (pending >= 1.0) paymentMethods.pending += pending;

            (sale.items || []).forEach(item => {
                const prodId = item.productId || item.id;
                const prodKey = prodId || item.name || 'Producto';
                const qty = parseFloat(item.quantity) || 0;
                const price = parseFloat(item.unitPrice || item.price) || 0;
                const unitCost = parseFloat(item.costAtSale) || 0;
                const lineTotal = price * qty;
                const lineProfit = lineTotal - (unitCost * qty);

                totalUnitsSold += qty;

                const existingP = productMap.get(prodKey) || { id: prodId, name: item.name || 'Producto', quantity: 0, total: 0, profit: 0 };
                existingP.quantity += qty;
                existingP.total += lineTotal;
                existingP.profit += lineProfit;
                productMap.set(prodKey, existingP);
            });
        });

        const topProducts = Array.from(productMap.values()).sort((a, b) => b.total - a.total).slice(0, 5);
        const avgTicket = report.totalSales > 0 ? Math.round(report.totalAmount / report.totalSales) : 0;
        const avgBasket = report.totalSales > 0 ? (totalUnitsSold / report.totalSales).toFixed(1) : '0';

        // Ganancia comercial pura en ventas
        const commercialProfit = report.grossCommercialProfit !== undefined 
            ? report.grossCommercialProfit 
            : (report.totalNeto - report.totalCostNet);
        const commercialMargin = report.totalNeto > 0 
            ? Math.round((commercialProfit / report.totalNeto) * 100) 
            : 0;

        // Utilidad real de bolsillo (Cobrado neto tras gastos)
        const pocketProfit = report.pocketProfit !== undefined ? report.pocketProfit : (report.totalAmount - report.totalCostGross - (report.operationalExpenses || 0));

        // Flujo neto real de dinero en caja y banco mensual
        const totalCashInflow = paymentMethods.cash + paymentMethods.card + paymentMethods.qr + paymentMethods.other + totalDebtPaymentsMonth;
        const netCashBalance = totalCashInflow - (report.operationalExpenses || 0);

        // Historial últimos 3 meses para comparativa
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

        const currentMonthInputStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        return `
            <!-- CABECERA Y NAVEGACIÓN MES -->
            <div class="flex-between-wrap" style="margin-bottom: 1.25rem; gap: 1rem; align-items: center;">
                <div>
                    <h3 style="margin: 0; font-size: 1.4rem; color: var(--text-main); display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                        🗓️ Ventas de ${monthNames[currentMonth]} ${currentYear}
                        ${percBadgeHtml}
                    </h3>
                    <p style="margin: 0.25rem 0 0 0; color: var(--secondary); font-size: 0.85rem;">
                        Período: ${formatDate(startOfMonth)} - ${formatDate(periodEnd)} 
                        ${isCurrentMonth ? `(${daysInPeriod} de ${totalDaysInMonth} días transcurridos)` : `(${totalDaysInMonth} días completos)`}
                    </p>
                </div>

                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                    <div style="display: flex; gap: 0.35rem; align-items: center;">
                        <button class="btn btn-sm btn-secondary" onclick="ReportsView.navigateMonthlyDate(-1)" title="Mes Anterior" style="font-size: 0.9rem; padding: 0.3rem 0.65rem; border-radius: 0.5rem; font-weight: 900; background: #e2e8f0; border: 1.5px solid #cbd5e1; color: #1e293b; cursor: pointer;">◀</button>
                        <button class="btn btn-sm btn-primary" onclick="ReportsView.handleMonthChange('${currentMonthInputStr}')">Mes Actual</button>
                        <button class="btn btn-sm btn-secondary" onclick="ReportsView.navigateMonthlyDate(1)" title="Mes Siguiente" style="font-size: 0.9rem; padding: 0.3rem 0.65rem; border-radius: 0.5rem; font-weight: 900; background: #e2e8f0; border: 1.5px solid #cbd5e1; color: #1e293b; cursor: pointer;">▶</button>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem; background: var(--surface-content); padding: 0.4rem 0.85rem; border-radius: 0.75rem; border: 1px solid var(--border);">
                        <label for="monthPicker" style="font-size: 0.8rem; font-weight: 700; color: var(--secondary); white-space: nowrap;">Mes:</label>
                        <input type="month" id="monthPicker" value="${currentYear}-${String(currentMonth + 1).padStart(2, '0')}" 
                               onchange="ReportsView.handleMonthChange(this.value)"
                               style="border: none; background: transparent; font-weight: 800; color: var(--primary); cursor: pointer; font-size: 0.9rem;">
                    </div>
                    <button class="btn btn-primary" onclick="ReportsView.showReport('iva', ${currentYear}, ${currentMonth})" style="font-weight: 700;">
                        🔍 Detalle IVA (F29)
                    </button>
                    <button class="btn btn-success" onclick="ReportsView.exportMonthlyToCSV()" style="font-weight: 700;">
                        📊 Exportar Excel (CSV)
                    </button>
                    <button class="btn btn-secondary" onclick="ReportsView.exportToPDF('monthly', ${JSON.stringify(report).replace(/"/g, '&quot;')})" style="background-color: #dc2626; color: white; border-color: #dc2626; font-weight: 700;">
                        📄 PDF
                    </button>
                </div>
            </div>

            <!-- FILA 1: TARJETAS PRINCIPALES DEL MES -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem;">
                <!-- Total Vendido Mes -->
                <div style="padding: 0.85rem 1rem; background: rgba(59, 130, 246, 0.08); border: 1.5px solid rgba(59, 130, 246, 0.3); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: #2563eb; font-weight: 800; text-transform: uppercase;">Total Vendido Mes</div>
                    <div style="font-size: 1.4rem; font-weight: 900; color: #2563eb; margin: 0.2rem 0;">${formatCLP(report.totalAmount)}</div>
                    <div style="font-size: 0.72rem; color: var(--secondary); font-weight: 600;">${report.totalSales} ventas | Prom ${formatCLP(dailyAvg)}/día</div>
                </div>

                <!-- Ganancia Comercial en Ventas -->
                <div style="padding: 0.85rem 1rem; background: rgba(16, 185, 129, 0.08); border: 1.5px solid rgba(16, 185, 129, 0.3); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: #059669; font-weight: 800; text-transform: uppercase;">💎 Ganancia en Ventas</div>
                    <div style="font-size: 1.4rem; font-weight: 900; color: #059669; margin: 0.2rem 0;">${formatCLP(commercialProfit)}</div>
                    <div style="font-size: 0.72rem; color: #059669; font-weight: 700;">Margen comercial: ${commercialMargin}%</div>
                </div>

                <!-- Gastos del Mes -->
                <div style="padding: 0.85rem 1rem; background: rgba(239, 68, 68, 0.08); border: 1.5px solid rgba(239, 68, 68, 0.3); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: #dc2626; font-weight: 800; text-transform: uppercase;">💸 Gastos Totales Mes</div>
                    <div style="font-size: 1.4rem; font-weight: 900; color: #dc2626; margin: 0.2rem 0;">${formatCLP(report.operationalExpenses || 0)}</div>
                    <div style="font-size: 0.72rem; color: var(--secondary); font-weight: 600;">Egresos y costos fijos</div>
                </div>

                <!-- Utilidad Neta Real -->
                <div style="padding: 0.85rem 1rem; background: rgba(139, 92, 246, 0.08); border: 1.5px solid rgba(139, 92, 246, 0.3); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: #7c3aed; font-weight: 800; text-transform: uppercase;">💰 Utilidad Neta Real</div>
                    <div style="font-size: 1.4rem; font-weight: 900; color: #7c3aed; margin: 0.2rem 0;">${formatCLP(pocketProfit)}</div>
                    <div style="font-size: 0.72rem; color: var(--secondary); font-weight: 600;">Ganancia menos gastos</div>
                </div>

                <!-- Pérdidas y Mermas -->
                <div style="padding: 0.85rem 1rem; background: ${report.monthlyLoss > 0 ? 'rgba(245, 158, 11, 0.1)' : 'var(--surface-content)'}; border: 1.5px solid ${report.monthlyLoss > 0 ? 'var(--warning)' : 'var(--border)'}; border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: ${report.monthlyLoss > 0 ? '#d97706' : 'var(--secondary)'}; font-weight: 800; text-transform: uppercase;">📦 Mermas / Pérdidas</div>
                    <div style="font-size: 1.4rem; font-weight: 900; color: ${report.monthlyLoss > 0 ? '#d97706' : 'var(--text-main)'}; margin: 0.2rem 0;">${formatCLP(report.monthlyLoss || 0)}</div>
                    <div style="font-size: 0.72rem; color: var(--secondary); font-weight: 600;">Consumo: ${formatCLP(report.monthlyConsumption || 0)}</div>
                </div>

                <!-- Proyección de Cierre de Mes -->
                <div style="padding: 0.85rem 1rem; background: var(--surface-content); border: 1px solid var(--border); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: var(--secondary); font-weight: 800; text-transform: uppercase;">🔮 Proyección Cierre</div>
                    <div style="font-size: 1.4rem; font-weight: 900; color: var(--primary); margin: 0.2rem 0;">${formatCLP(monthProjection)}</div>
                    <div style="font-size: 0.72rem; color: var(--secondary); font-weight: 600;">Estimado al día ${totalDaysInMonth}</div>
                </div>
            </div>

            <!-- FILA 2: RECAUDACIÓN POR MEDIO DE PAGO EN EL MES -->
            <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem; margin-bottom: 1.25rem;">
                <h4 style="margin: 0 0 0.85rem 0; font-size: 0.95rem; color: var(--text-main);">
                    💳 ¿Cómo entró el dinero en el mes? (Recaudación Real Mensual)
                </h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0.75rem;">
                    <div style="padding: 0.75rem 1rem; background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.25); border-radius: 0.65rem;">
                        <span style="font-size: 0.75rem; font-weight: 800; color: #15803d;">💵 EFECTIVO</span>
                        <div style="font-size: 1.2rem; font-weight: 900; color: #15803d; margin-top: 0.2rem;">${formatCLP(paymentMethods.cash)}</div>
                    </div>
                    <div style="padding: 0.75rem 1rem; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 0.65rem;">
                        <span style="font-size: 0.75rem; font-weight: 800; color: #1d4ed8;">💳 TARJETAS / POS</span>
                        <div style="font-size: 1.2rem; font-weight: 900; color: #1d4ed8; margin-top: 0.2rem;">${formatCLP(paymentMethods.card)}</div>
                    </div>
                    <div style="padding: 0.75rem 1rem; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 0.65rem;">
                        <span style="font-size: 0.75rem; font-weight: 800; color: #b45309;">🏦 TRANSFERENCIAS / QR</span>
                        <div style="font-size: 1.2rem; font-weight: 900; color: #b45309; margin-top: 0.2rem;">${formatCLP(paymentMethods.other + paymentMethods.qr)}</div>
                    </div>
                    <div style="padding: 0.75rem 1rem; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 0.65rem;">
                        <span style="font-size: 0.75rem; font-weight: 800; color: #b91c1c;">📓 FIADOS DEL MES</span>
                        <div style="font-size: 1.2rem; font-weight: 900; color: #b91c1c; margin-top: 0.2rem;">${formatCLP(paymentMethods.pending)}</div>
                    </div>
                    <div style="padding: 0.75rem 1rem; background: rgba(16, 185, 129, 0.12); border: 1.5px solid rgba(16, 185, 129, 0.4); border-radius: 0.65rem;">
                        <span style="font-size: 0.75rem; font-weight: 800; color: #047857;">🤝 ABONOS COBRADOS</span>
                        <div style="font-size: 1.2rem; font-weight: 900; color: #047857; margin-top: 0.2rem;">+${formatCLP(totalDebtPaymentsMonth)}</div>
                    </div>
                </div>
            </div>

            <!-- TOP 5 PRODUCTOS ESTRELLA DEL MES CON GANANCIA -->
            <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem; margin-bottom: 1.25rem;">
                <h4 style="margin-bottom: 1rem; font-size: 0.95rem; color: var(--text-main);">🏆 Top 5 Productos Estrella del Mes (Ventas & Ganancia)</h4>
                ${topProducts.length === 0 ? '<p style="color:var(--secondary); font-size:0.85rem;">Sin productos vendidos este mes</p>' : `
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75rem;">
                        ${topProducts.map((p, idx) => {
                            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                            return `
                                <div style="padding: 0.75rem 1rem; background: var(--surface-content); border-radius: 0.75rem; border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                                    <div style="display: flex; align-items: center; gap: 0.6rem;">
                                        <span style="font-size: 1.2rem;">${medal}</span>
                                        <div>
                                            <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-main);">${safeHTML(p.name)}</div>
                                            <small style="color: var(--secondary); font-size: 0.75rem;">${p.quantity} unid. | Ganancia: <strong style="color:#059669;">+${formatCLP(p.profit)}</strong></small>
                                        </div>
                                    </div>
                                    <div style="font-weight: 900; color: var(--primary); font-size: 0.95rem;">${formatCLP(p.total)}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `}
            </div>

            <!-- EVOLUCIÓN HISTÓRICA MES A MES -->
            ${previousMonthsReports.length > 0 ? `
                <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem; margin-bottom: 1.5rem;">
                    <h4 style="margin-bottom: 1rem; font-size: 0.95rem; color: var(--text-main);">📈 Comparativo Histórico Mes a Mes</h4>
                    <div class="table-container">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="border-bottom: 2px solid var(--border); font-size: 0.8rem; color: var(--secondary); text-transform: uppercase;">
                                    <th style="padding: 0.75rem; text-align: left;">Mes</th>
                                    <th style="padding: 0.75rem; text-align: center;">Período</th>
                                    <th style="padding: 0.75rem; text-align: center;">Boletas</th>
                                    <th style="padding: 0.75rem; text-align: right;">Total Vendido</th>
                                    <th style="padding: 0.75rem; text-align: right;">Promedio Diario</th>
                                    <th style="padding: 0.75rem; text-align: center;">Variación %</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style="border-bottom: 1px solid var(--border); background: rgba(59, 130, 246, 0.05); font-weight: bold;">
                                    <td style="padding: 0.75rem; color: var(--text-main);"><strong>${monthNames[report.month]} ${report.year}</strong> (Actual)</td>
                                    <td style="padding: 0.75rem; text-align: center; color: var(--secondary);">${formatDate(startOfMonth)} - ${formatDate(periodEnd)}</td>
                                    <td style="padding: 0.75rem; text-align: center;"><span class="badge badge-primary">${report.totalSales} ticket(s)</span></td>
                                    <td style="padding: 0.75rem; text-align: right; color: #2563eb;"><strong>${formatCLP(report.totalAmount)}</strong></td>
                                    <td style="padding: 0.75rem; text-align: right;">${formatCLP(dailyAvg)}</td>
                                    <td style="padding: 0.75rem; text-align: center;">-</td>
                                </tr>
                                ${previousMonthsReports.map((prevReport) => {
                                    const prevStartDate = new Date(prevReport.year, prevReport.month, 1);
                                    const prevEndDate = new Date(prevReport.year, prevReport.month + 1, 0);
                                    const prevDaysInMonth = prevEndDate.getDate();
                                    const prevAvgDaily = prevReport.totalSales > 0 ? prevReport.totalAmount / prevDaysInMonth : 0;
                                    const variation = prevAvgDaily > 0 ? ((dailyAvg - prevAvgDaily) / prevAvgDaily * 100) : 0;
                                    const variationColor = variation >= 0 ? '#10b981' : '#ef4444';
                                    const variationIcon = variation >= 0 ? '▲ +' : '▼ ';

                                    return `
                                        <tr style="border-bottom: 1px solid var(--border);">
                                            <td style="padding: 0.75rem; color: var(--text-main);">${monthNames[prevReport.month]} ${prevReport.year}</td>
                                            <td style="padding: 0.75rem; text-align: center; color: var(--secondary);">${formatDate(prevStartDate)} - ${formatDate(prevEndDate)} (${prevDaysInMonth}d)</td>
                                            <td style="padding: 0.75rem; text-align: center;">${prevReport.totalSales} ticket(s)</td>
                                            <td style="padding: 0.75rem; text-align: right; font-weight: 700;">${formatCLP(prevReport.totalAmount)}</td>
                                            <td style="padding: 0.75rem; text-align: right;">${formatCLP(prevAvgDaily)}</td>
                                            <td style="padding: 0.75rem; text-align: center; font-weight: 800; color: ${variationColor};">
                                                ${variationIcon}${Math.abs(variation).toFixed(1)}%
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : ''}

            <!-- TABLA COMPLETA DE TRANSACCIONES DEL MES -->
            ${this.renderSalesTable(report.sales)}
        `;
    },

    exportMonthlyToCSV() {
        const sales = this._lastMonthlyReportSales || [];
        const dateStr = this._lastMonthlyDateStr || new Date().toISOString().slice(0, 7);
        if (sales.length === 0) {
            showNotification('No hay ventas registradas para exportar en este mes', 'warning');
            return;
        }
        const headers = ['Nº Ticket', 'Fecha / Hora', 'Método de Pago', 'Estado', 'Items', 'Subtotal ($)', 'Descuento ($)', 'Total Vendido ($)'];
        const rows = sales.map(s => [
            `"#${s.saleNumber || s.id}"`,
            `"${s.date ? new Date(s.date).toLocaleString('es-CL') : ''}"`,
            `"${s.paymentMethod || 'cash'}"`,
            `"${s.status || 'completed'}"`,
            (s.items || []).length,
            s.subtotal || s.total || 0,
            s.discountAmount || s.discount || 0,
            s.total || 0
        ]);
        const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `reporte_ventas_mes_${dateStr}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification('📊 Reporte de Ventas Mensuales descargado en Excel (CSV)', 'success');
    },

    getF29Declaration(year, month) {
        try {
            const key = `F29_DECLARATION_${year}_${month}`;
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    },

    saveF29Declaration(year, month, data) {
        const key = `F29_DECLARATION_${year}_${month}`;
        localStorage.setItem(key, JSON.stringify({
            ...data,
            year,
            month,
            updatedAt: new Date().toISOString()
        }));
    },

    async navigateIVAMonth(offset) {
        const currentYear = this._lastIVAYear !== undefined ? this._lastIVAYear : new Date().getFullYear();
        const currentMonth = this._lastIVAMonth !== undefined ? this._lastIVAMonth : new Date().getMonth();
        let targetMonth = currentMonth + offset;
        let targetYear = currentYear;
        if (targetMonth < 0) {
            targetMonth = 11;
            targetYear--;
        } else if (targetMonth > 11) {
            targetMonth = 0;
            targetYear++;
        }
        await this.showReport('iva', targetYear, targetMonth);
    },

    async renderIVAReport(selectedYear, selectedMonth) {
        const now = new Date();
        const year = selectedYear !== undefined ? selectedYear : now.getFullYear();
        const month = selectedMonth !== undefined ? selectedMonth : now.getMonth();
        this._lastIVAYear = year;
        this._lastIVAMonth = month;

        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        const report = await ReportController.getMonthlySales(year, month);
        this._lastIVAReport = report;

        // Compras con factura vs compras sin factura
        const allPurchases = report.purchases || [];
        const purchasesWithInvoice = allPurchases.filter(p => p.documentType && p.documentType.includes('factura'));
        const purchasesWithoutInvoice = allPurchases.filter(p => !p.documentType || !p.documentType.includes('factura'));
        
        const unInvoicedTotal = purchasesWithoutInvoice.reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0);
        const lostIvaCredit = Math.round(unInvoicedTotal - (unInvoicedTotal / 1.19));

        // Registro F29 del contador guardado para este mes
        const f29Declared = this.getF29Declaration(year, month);
        const prevRemanente = f29Declared ? (parseFloat(f29Declared.prevRemanente) || 0) : 0;

        // Cálculos Fiscales del POS
        const totalTaxCreditAvailable = report.ivaCredito + prevRemanente;
        const netDifference = report.ivaDebito - totalTaxCreditAvailable;
        const toPay = netDifference > 0 ? netDifference : 0;
        const newRemanente = netDifference < 0 ? Math.abs(netDifference) : 0;

        // Estimación de PPM (1% de ventas netas con boleta)
        const ppmEstimate = Math.round(report.totalNeto * 0.01);
        const totalEstimatedF29Provision = toPay + ppmEstimate;

        const isCurrentMonth = (now.getFullYear() === year && now.getMonth() === month);

        return `
            <!-- CABECERA Y NAVEGACIÓN MENSUAL -->
            <div class="flex-between-wrap" style="margin-bottom: 1.25rem; gap: 1rem; align-items: center;">
                <div>
                    <h3 style="margin: 0; font-size: 1.4rem; color: var(--text-main); display: flex; align-items: center; gap: 0.75rem;">
                        📑 Resumen de IVA y Auditoría F29 (SII)
                    </h3>
                    <p style="margin: 0.25rem 0 0 0; color: var(--secondary); font-size: 0.85rem;">
                        ${monthNames[month]} ${year} · Control de Débito, Crédito Fiscal y Validación del Contador
                    </p>
                </div>

                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                    <!-- Botones de Navegación Rápida -->
                    <div style="display: flex; gap: 0.25rem; background: var(--surface-content); padding: 0.25rem; border-radius: 0.75rem; border: 1px solid var(--border);">
                        <button class="btn btn-sm btn-ghost" onclick="ReportsView.navigateIVAMonth(-1)">◀ Mes Anterior</button>
                        <button class="btn btn-sm ${isCurrentMonth ? 'btn-primary' : 'btn-ghost'}" onclick="ReportsView.showReport('iva', ${now.getFullYear()}, ${now.getMonth()})">Mes Actual</button>
                        <button class="btn btn-sm btn-ghost" onclick="ReportsView.navigateIVAMonth(1)">Mes Siguiente ▶</button>
                    </div>

                    <div style="background: var(--surface-content); padding: 0.35rem 0.75rem; border-radius: 0.75rem; border: 1px solid var(--border);">
                        <input type="month" value="${year}-${String(month + 1).padStart(2, '0')}" 
                               onchange="ReportsView.showReport('iva', ...this.value.split('-').map(v => parseInt(v)).map((v, i) => i === 1 ? v-1 : v))"
                               style="background: transparent; border: none; font-weight: 700; color: var(--text-main); font-size: 0.85rem; cursor: pointer;">
                    </div>

                    <button class="btn btn-success" onclick="ReportsView.exportIVAToCSV()" style="font-weight: 700;">
                        📊 Exportar para Contador (Excel)
                    </button>
                </div>
            </div>

            <!-- TARJETAS DE BALANCE FISCAL Y ESTIMACIÓN F29 -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem;">
                <!-- IVA DÉBITO -->
                <div class="card clickable" onclick="ReportsView.showIVADetailModal('debito', ${year}, ${month})"
                     style="padding: 0.85rem 1rem; background: rgba(239, 68, 68, 0.08); border: 1.5px solid rgba(239, 68, 68, 0.3); border-radius: 0.75rem; text-align: center; cursor: pointer;">
                    <div style="font-size: 0.72rem; color: #dc2626; font-weight: 800; text-transform: uppercase;">🔴 IVA Débito (Ventas)</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: #dc2626; margin: 0.2rem 0;">${formatCLP(report.ivaDebito)}</div>
                    <small style="font-size: 0.72rem; color: #dc2626;">Ver ${report.sales.length} boletas/ventas →</small>
                </div>

                <!-- IVA CRÉDITO + REMANENTE -->
                <div class="card clickable" onclick="ReportsView.showIVADetailModal('credito', ${year}, ${month})"
                     style="padding: 0.85rem 1rem; background: rgba(16, 185, 129, 0.08); border: 1.5px solid rgba(16, 185, 129, 0.3); border-radius: 0.75rem; text-align: center; cursor: pointer;">
                    <div style="font-size: 0.72rem; color: #059669; font-weight: 800; text-transform: uppercase;">🟢 IVA Crédito (Compras)</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: #059669; margin: 0.2rem 0;">${formatCLP(report.ivaCredito)}</div>
                    <small style="font-size: 0.72rem; color: #059669;">${purchasesWithInvoice.length} facturas registradas →</small>
                </div>

                <!-- REMANENTE ANTERIOR -->
                <div style="padding: 0.85rem 1rem; background: var(--surface-content); border: 1px solid var(--border); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: var(--secondary); font-weight: 800; text-transform: uppercase;">Remanente Mes Anterior</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: var(--text-main); margin: 0.2rem 0;">${formatCLP(prevRemanente)}</div>
                    <small style="font-size: 0.72rem; color: var(--secondary);">Crédito a favor traído</small>
                </div>

                <!-- RESULTADO FISCAL -->
                <div style="padding: 0.85rem 1rem; background: ${toPay > 0 ? 'rgba(245, 158, 11, 0.08)' : 'rgba(99, 102, 241, 0.08)'}; border: 1.5px solid ${toPay > 0 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(99, 102, 241, 0.3)'}; border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: ${toPay > 0 ? '#d97706' : '#4f46e5'}; font-weight: 800; text-transform: uppercase;">
                        ${toPay > 0 ? '⚖️ IVA Neto a Pagar' : '💰 Nuevo Remanente a Favor'}
                    </div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: ${toPay > 0 ? '#d97706' : '#4f46e5'}; margin: 0.2rem 0;">
                        ${toPay > 0 ? formatCLP(toPay) : formatCLP(newRemanente)}
                    </div>
                    <small style="font-size: 0.72rem; color: ${toPay > 0 ? '#d97706' : '#4f46e5'};">
                        ${toPay > 0 ? 'Impuesto neto al SII' : 'Pasa al mes siguiente'}
                    </small>
                </div>

                <!-- PROVISIÓN TOTAL F29 -->
                <div style="padding: 0.85rem 1rem; background: rgba(139, 92, 246, 0.08); border: 1.5px solid rgba(139, 92, 246, 0.3); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: #7c3aed; font-weight: 800; text-transform: uppercase;">🏦 Provisión F29 (IVA + PPM)</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: #7c3aed; margin: 0.2rem 0;">${formatCLP(totalEstimatedF29Provision)}</div>
                    <small style="font-size: 0.72rem; color: #7c3aed;">Incluye PPM (~1%: ${formatCLP(ppmEstimate)})</small>
                </div>
            </div>

            <!-- ALERTA DE FUGA DE IVA EN COMPRAS SIN FACTURA -->
            ${unInvoicedTotal > 0 ? `
                <div style="background: rgba(239, 68, 68, 0.08); border: 1.5px solid rgba(239, 68, 68, 0.3); border-radius: 0.75rem; padding: 0.85rem 1.25rem; margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <span style="font-size: 1.6rem;">🛡️</span>
                        <div>
                            <strong style="color: #dc2626; font-size: 0.95rem;">Alerta de Fuga de Crédito Fiscal en Compras</strong>
                            <p style="margin: 0.2rem 0 0 0; font-size: 0.82rem; color: var(--text-main);">
                                Registraste <strong>${formatCLP(unInvoicedTotal)}</strong> en compras sin factura (${purchasesWithoutInvoice.length} compras). Si hubieses pedido factura con RUT de tu negocio, <strong>te habrías ahorrado ${formatCLP(lostIvaCredit)} en el pago de IVA de este mes</strong>.
                            </p>
                        </div>
                    </div>
                </div>
            ` : ''}

            <!-- PANEL DE CONCILIACIÓN Y AUDITORÍA: POS VS LO QUE DECLARÓ EL CONTADOR (F29) -->
            <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem; margin-bottom: 1.25rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
                    <div>
                        <h4 style="margin: 0; font-size: 1.05rem; color: var(--text-main); display: flex; align-items: center; gap: 0.5rem;">
                            ⚖️ Auditoría de F29: Tu Sistema vs Lo que declaró tu Contador
                        </h4>
                        <p style="margin: 0.2rem 0 0 0; color: var(--secondary); font-size: 0.8rem;">
                            Compara la realidad de tu caja contra el formulario F29 que te entregó el contador ante el SII
                        </p>
                    </div>

                    <button class="btn btn-primary" onclick="ReportsView.showF29Modal(${year}, ${month})" style="font-weight: 800; font-size: 0.85rem;">
                        📝 ${f29Declared ? 'Editar / Actualizar F29 Declarado' : 'Registrar F29 del Contador'}
                    </button>
                </div>

                ${f29Declared ? `
                    <div class="table-container">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="border-bottom: 2px solid var(--border); font-size: 0.8rem; color: var(--secondary); text-transform: uppercase;">
                                    <th style="padding: 0.75rem; text-align: left;">Concepto Tributario</th>
                                    <th style="padding: 0.75rem; text-align: right;">Tu Sistema (Caja Real)</th>
                                    <th style="padding: 0.75rem; text-align: right; color: #2563eb;">Declarado por Contador (F29)</th>
                                    <th style="padding: 0.75rem; text-align: center;">Diferencia / Descuadre</th>
                                </tr>
                            </thead>
                            <tbody>
                                <!-- IVA DÉBITO -->
                                ${(() => {
                                    const diffDebito = (f29Declared.ivaDebito || 0) - report.ivaDebito;
                                    const diffClass = Math.abs(diffDebito) < 100 ? 'badge-success' : (diffDebito < 0 ? 'badge-danger' : 'badge-warning');
                                    const diffText = Math.abs(diffDebito) < 100 ? '✅ Coincide' : (diffDebito < 0 ? `⚠️ Contador declaró -${formatCLP(Math.abs(diffDebito))} menos` : `⚠️ Contador declaró +${formatCLP(diffDebito)} más`);
                                    return `
                                        <tr style="border-bottom: 1px solid var(--border);">
                                            <td style="padding: 0.75rem; font-weight: 800;">🔴 IVA Débito (Ventas)</td>
                                            <td style="padding: 0.75rem; text-align: right; font-weight: 800;">${formatCLP(report.ivaDebito)}</td>
                                            <td style="padding: 0.75rem; text-align: right; font-weight: 900; color: #2563eb;">${formatCLP(f29Declared.ivaDebito || 0)}</td>
                                            <td style="padding: 0.75rem; text-align: center;"><span class="badge ${diffClass}" style="font-size: 0.75rem;">${diffText}</span></td>
                                        </tr>
                                    `;
                                })()}

                                <!-- IVA CRÉDITO -->
                                ${(() => {
                                    const diffCredito = (f29Declared.ivaCredito || 0) - report.ivaCredito;
                                    const diffClass = Math.abs(diffCredito) < 100 ? 'badge-success' : (diffCredito < 0 ? 'badge-danger' : 'badge-warning');
                                    const diffText = Math.abs(diffCredito) < 100 ? '✅ Coincide' : (diffCredito < 0 ? `⚠️ Contador omitió ${formatCLP(Math.abs(diffCredito))} en facturas` : `⚠️ Contador incluyó +${formatCLP(diffCredito)} crédito extra`);
                                    return `
                                        <tr style="border-bottom: 1px solid var(--border);">
                                            <td style="padding: 0.75rem; font-weight: 800;">🟢 IVA Crédito (Compras Factura)</td>
                                            <td style="padding: 0.75rem; text-align: right; font-weight: 800;">${formatCLP(report.ivaCredito)}</td>
                                            <td style="padding: 0.75rem; text-align: right; font-weight: 900; color: #2563eb;">${formatCLP(f29Declared.ivaCredito || 0)}</td>
                                            <td style="padding: 0.75rem; text-align: center;"><span class="badge ${diffClass}" style="font-size: 0.75rem;">${diffText}</span></td>
                                        </tr>
                                    `;
                                })()}

                                <!-- REMANENTE ANTERIOR -->
                                <tr style="border-bottom: 1px solid var(--border);">
                                    <td style="padding: 0.75rem; font-weight: 800;">💰 Remanente Mes Anterior Usado</td>
                                    <td style="padding: 0.75rem; text-align: right;">${formatCLP(prevRemanente)}</td>
                                    <td style="padding: 0.75rem; text-align: right; font-weight: 800; color: #2563eb;">${formatCLP(f29Declared.prevRemanente || 0)}</td>
                                    <td style="padding: 0.75rem; text-align: center;"><span class="badge badge-info" style="font-size: 0.75rem;">Aplicado en F29</span></td>
                                </tr>

                                <!-- TOTAL PAGADO EN F29 -->
                                <tr style="background: rgba(0,0,0,0.02); font-weight: 900;">
                                    <td style="padding: 0.75rem; font-size: 0.95rem;">🏦 Total Pagado en F29 al SII</td>
                                    <td style="padding: 0.75rem; text-align: right; font-size: 1.05rem; color: #059669;">${formatCLP(totalEstimatedF29Provision)}</td>
                                    <td style="padding: 0.75rem; text-align: right; font-size: 1.15rem; color: #2563eb;">${formatCLP(f29Declared.totalPaid || 0)}</td>
                                    <td style="padding: 0.75rem; text-align: center;">
                                        ${(() => {
                                            const diffTotal = (f29Declared.totalPaid || 0) - totalEstimatedF29Provision;
                                            if (Math.abs(diffTotal) < 1000) return '<span class="badge badge-success">✅ Pago Cuadrado</span>';
                                            if (diffTotal > 0) return `<span class="badge badge-warning">Pagaste +${formatCLP(diffTotal)} extra</span>`;
                                            return `<span class="badge badge-danger">Diferencia de ${formatCLP(Math.abs(diffTotal))}</span>`;
                                        })()}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        ${f29Declared.notes ? `
                            <div style="margin-top: 0.75rem; padding: 0.6rem 0.85rem; background: var(--surface-content); border-radius: 0.5rem; font-size: 0.82rem; color: var(--secondary);">
                                <strong>📝 Notas del Contador / F29:</strong> ${safeHTML(f29Declared.notes)}
                            </div>
                        ` : ''}
                    </div>
                ` : `
                    <div style="padding: 1.5rem; text-align: center; background: var(--surface-content); border-radius: 0.75rem; border: 1px dashed var(--border);">
                        <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">📄</div>
                        <strong style="color: var(--text-main); font-size: 0.95rem;">Aún no has registrado el F29 de este mes</strong>
                        <p style="margin: 0.35rem auto 1rem auto; color: var(--secondary); font-size: 0.82rem; max-width: 500px;">
                            Cuando tu contador te entregue el formulario F29 (incluso si es con semanas de retraso), regístralo aquí para auditar si los números que él declaró coinciden con las ventas de tu caja.
                        </p>
                        <button class="btn btn-primary" onclick="ReportsView.showF29Modal(${year}, ${month})" style="font-weight: 800;">
                            ➕ Registrar F29 Declarado para ${monthNames[month]} ${year}
                        </button>
                    </div>
                `}
            </div>
        `;
    },

    showF29Modal(year, month) {
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const report = this._lastIVAReport || { ivaDebito: 0, ivaCredito: 0, totalNeto: 0 };
        const currentF29 = this.getF29Declaration(year, month) || {};

        const defaultPrevRemanente = currentF29.prevRemanente !== undefined ? currentF29.prevRemanente : 0;
        const defaultDebito = currentF29.ivaDebito !== undefined ? currentF29.ivaDebito : report.ivaDebito;
        const defaultCredito = currentF29.ivaCredito !== undefined ? currentF29.ivaCredito : report.ivaCredito;
        const defaultPpm = currentF29.ppmAmount !== undefined ? currentF29.ppmAmount : Math.round(report.totalNeto * 0.01);
        const defaultPaid = currentF29.totalPaid !== undefined ? currentF29.totalPaid : Math.max(0, defaultDebito - defaultCredito - defaultPrevRemanente) + defaultPpm;
        const defaultNotes = currentF29.notes || '';

        const modalHtml = `
            <div style="display: flex; flex-direction: column; gap: 1rem; font-size: 0.88rem;">
                <p style="margin: 0; color: var(--secondary);">
                    Ingresa los valores exactos que aparecen en el papel o PDF del Formulario 29 que te entregó tu contador para <strong>${monthNames[month]} ${year}</strong>:
                </p>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                    <div>
                        <label style="font-weight: 700; font-size: 0.8rem; display: block; margin-bottom: 0.25rem;">
                            Remanente Mes Anterior ($)
                        </label>
                        <input type="number" id="f29_prevRemanente" value="${defaultPrevRemanente}" class="form-control" placeholder="0">
                        <small style="color: var(--secondary); font-size: 0.72rem;">Crédito a favor traído del mes previo</small>
                    </div>

                    <div>
                        <label style="font-weight: 700; font-size: 0.8rem; display: block; margin-bottom: 0.25rem;">
                            IVA Débito Declarado ($)
                        </label>
                        <input type="number" id="f29_debito" value="${defaultDebito}" class="form-control" placeholder="0">
                        <small style="color: var(--secondary); font-size: 0.72rem;">Monto de ventas con boleta en F29</small>
                    </div>

                    <div>
                        <label style="font-weight: 700; font-size: 0.8rem; display: block; margin-bottom: 0.25rem;">
                            IVA Crédito Declarado ($)
                        </label>
                        <input type="number" id="f29_credito" value="${defaultCredito}" class="form-control" placeholder="0">
                        <small style="color: var(--secondary); font-size: 0.72rem;">Crédito por facturas de compra en F29</small>
                    </div>

                    <div>
                        <label style="font-weight: 700; font-size: 0.8rem; display: block; margin-bottom: 0.25rem;">
                            PPM Declarado ($)
                        </label>
                        <input type="number" id="f29_ppm" value="${defaultPpm}" class="form-control" placeholder="0">
                        <small style="color: var(--secondary); font-size: 0.72rem;">Pago Provisional Mensual (~1%)</small>
                    </div>
                </div>

                <div>
                    <label style="font-weight: 800; font-size: 0.85rem; display: block; margin-bottom: 0.25rem; color: #2563eb;">
                        Total Pagado en Banco / F29 ($)
                    </label>
                    <input type="number" id="f29_totalPaid" value="${defaultPaid}" class="form-control" style="font-weight: 900; font-size: 1.1rem;" placeholder="0">
                    <small style="color: var(--secondary); font-size: 0.72rem;">El monto total que te cobraron o debitaron de tu cuenta corriente</small>
                </div>

                <div>
                    <label style="font-weight: 700; font-size: 0.8rem; display: block; margin-bottom: 0.25rem;">
                        Observaciones / Notas del Contador
                    </label>
                    <textarea id="f29_notes" class="form-control" rows="2" placeholder="Ej: Declarado el 18/08 con folio 123456...">${defaultNotes}</textarea>
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem;">
                    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                    <button class="btn btn-success" onclick="ReportsView.saveF29ModalData(${year}, ${month})" style="font-weight: 800;">
                        💾 Guardar y Auditar
                    </button>
                </div>
            </div>
        `;

        showModal(modalHtml, {
            title: `📝 Registro de F29 - ${monthNames[month]} ${year}`,
            width: '600px'
        });
    },

    saveF29ModalData(year, month) {
        const prevRemanente = parseFloat(document.getElementById('f29_prevRemanente')?.value) || 0;
        const ivaDebito = parseFloat(document.getElementById('f29_debito')?.value) || 0;
        const ivaCredito = parseFloat(document.getElementById('f29_credito')?.value) || 0;
        const ppmAmount = parseFloat(document.getElementById('f29_ppm')?.value) || 0;
        const totalPaid = parseFloat(document.getElementById('f29_totalPaid')?.value) || 0;
        const notes = (document.getElementById('f29_notes')?.value || '').trim();

        this.saveF29Declaration(year, month, {
            prevRemanente,
            ivaDebito,
            ivaCredito,
            ppmAmount,
            totalPaid,
            notes
        });

        closeModal();
        showNotification('✅ F29 guardado y conciliado exitosamente', 'success');
        this.showReport('iva', year, month);
    },

    exportIVAToCSV() {
        const report = this._lastIVAReport;
        const year = this._lastIVAYear || new Date().getFullYear();
        const month = this._lastIVAMonth !== undefined ? this._lastIVAMonth : new Date().getMonth();
        if (!report) {
            showNotification('No hay datos fiscales para exportar', 'warning');
            return;
        }

        const f29 = this.getF29Declaration(year, month);
        const prevRemanente = f29 ? (f29.prevRemanente || 0) : 0;
        const netDiff = report.ivaDebito - report.ivaCredito - prevRemanente;
        const ppm = Math.round(report.totalNeto * 0.01);

        const rows = [
            ['Resumen Fiscal de IVA y F29 - Mes: ' + (month + 1) + '/' + year],
            [],
            ['Concepto', 'Monto ($)'],
            ['Ventas Totales Netas (Sin IVA)', report.totalNeto || 0],
            ['IVA Débito (19% Ventas)', report.ivaDebito || 0],
            ['Compras con Factura (Costo)', report.purchases ? report.purchases.filter(p => p.documentType && p.documentType.includes('factura')).reduce((s, p) => s + (p.total || 0), 0) : 0],
            ['IVA Crédito (19% Compras)', report.ivaCredito || 0],
            ['Remanente Mes Anterior Aplicado', prevRemanente],
            ['Diferencia Neta de IVA', netDiff > 0 ? `A Pagar: ${netDiff}` : `Remanente a Favor: ${Math.abs(netDiff)}`],
            ['PPM Estimado (1% Ventas Netas)', ppm],
            ['Provisión Total Estimada F29', (netDiff > 0 ? netDiff : 0) + ppm],
            []
        ];

        if (f29) {
            rows.push(
                ['Datos Declarados por Contador en F29'],
                ['IVA Débito Declarado', f29.ivaDebito || 0],
                ['IVA Crédito Declarado', f29.ivaCredito || 0],
                ['Remanente Anterior Usado', f29.prevRemanente || 0],
                ['PPM Pagado', f29.ppmAmount || 0],
                ['Total Pagado en F29', f29.totalPaid || 0],
                ['Notas', `"${(f29.notes || '').replace(/"/g, '""')}"`]
            );
        }

        const csvContent = '\uFEFF' + rows.map(e => e.join(';')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `resumen_fiscal_iva_${year}_${String(month + 1).padStart(2, '0')}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification('📊 Resumen Fiscal descargado en Excel (CSV)', 'success');
    },

    async renderProductsReport(daysOrStart = 30, endParam = null) {
        let startDate, endDate;
        let periodLabel = '';
        let isCustom = false;

        if (endParam) {
            startDate = new Date(`${daysOrStart}T00:00:00`);
            endDate = new Date(`${endParam}T23:59:59`);
            this.selectedProductsStart = daysOrStart;
            this.selectedProductsEnd = endParam;
            this.selectedProductsDays = 'custom';
            periodLabel = `Del ${formatDate(startDate)} al ${formatDate(endDate)}`;
            isCustom = true;
        } else {
            const days = parseInt(daysOrStart) || 30;
            this.selectedProductsDays = days;
            endDate = new Date();
            startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            this.selectedProductsStart = startDate.toISOString().slice(0, 10);
            this.selectedProductsEnd = endDate.toISOString().slice(0, 10);
            periodLabel = `Últimos ${days} días`;
        }

        const products = await ReportController.getSalesByProduct(startDate, endDate) || [];
        this._lastProductsReportData = products;
        this._currentProductSort = this._currentProductSort || { key: 'quantity', dir: 'desc' };

        // Aplicar ordenamiento
        this._sortProductDataList(products, this._currentProductSort.key, this._currentProductSort.dir);

        const totalVariety = products.length;
        const totalUnits = products.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0);
        const grandTotalRevenue = products.reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0);
        const grandTotalProfit = products.reduce((sum, p) => sum + (parseFloat(p.grossProfit) || 0), 0);

        // Rey de Volumen y Rey de Ganancia
        const topByQty = [...products].sort((a, b) => b.quantity - a.quantity)[0] || { name: '-', quantity: 0 };
        const topByProfit = [...products].sort((a, b) => b.grossProfit - a.grossProfit)[0] || { name: '-', grossProfit: 0 };

        return `
            <!-- CABECERA Y FILTROS DE RANGO -->
            <div class="flex-between-wrap" style="margin-bottom: 1.25rem; gap: 1rem; align-items: center;">
                <div>
                    <h3 style="margin: 0; font-size: 1.4rem; color: var(--text-main); display: flex; align-items: center; gap: 0.75rem;">
                        📦 Desempeño por Producto
                    </h3>
                    <p style="margin: 0.25rem 0 0 0; color: var(--secondary); font-size: 0.85rem;">
                        Ranking de rotación comercial y rentabilidad (${periodLabel})
                    </p>
                </div>

                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                    <!-- Botones Rápidos -->
                    <div style="display: flex; gap: 0.25rem; background: var(--surface-content); padding: 0.25rem; border-radius: 0.75rem; border: 1px solid var(--border);">
                        <button class="btn btn-sm ${this.selectedProductsDays === 7 ? 'btn-primary' : 'btn-ghost'}" onclick="ReportsView.handleProductsPeriodChange(7)">7 Días</button>
                        <button class="btn btn-sm ${this.selectedProductsDays === 30 ? 'btn-primary' : 'btn-ghost'}" onclick="ReportsView.handleProductsPeriodChange(30)">30 Días</button>
                        <button class="btn btn-sm ${this.selectedProductsDays === 90 ? 'btn-primary' : 'btn-ghost'}" onclick="ReportsView.handleProductsPeriodChange(90)">90 Días</button>
                    </div>

                    <!-- Selector Personalizado Desde / Hasta -->
                    <div style="display: flex; align-items: center; gap: 0.35rem; background: var(--surface-content); padding: 0.35rem 0.75rem; border-radius: 0.75rem; border: 1px solid var(--border);">
                        <input type="date" id="prodDateFrom" value="${this.selectedProductsStart}" style="border: none; background: transparent; font-size: 0.8rem; font-weight: 700; color: var(--text-main); cursor: pointer;">
                        <span style="color: var(--secondary); font-size: 0.8rem;">a</span>
                        <input type="date" id="prodDateTo" value="${this.selectedProductsEnd}" style="border: none; background: transparent; font-size: 0.8rem; font-weight: 700; color: var(--text-main); cursor: pointer;">
                        <button class="btn btn-xs btn-primary" onclick="ReportsView.applyProductsCustomDate()" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; font-weight: 800;">Filtrar</button>
                    </div>

                    <!-- Buscador -->
                    <input type="text" id="reportProductFilter" placeholder="🔍 Buscar producto o código..." 
                           onkeyup="ReportsView.filterProductsReport(this.value)" class="form-control" 
                           style="width: 210px; padding: 0.4rem 0.75rem; border-radius: 0.75rem;">

                    <button class="btn btn-success" onclick="ReportsView.exportProductsToCSV()" style="font-weight: 700;">
                        📊 Exportar Excel
                    </button>
                </div>
            </div>

            <!-- TARJETAS DE RESUMEN PROFESIONAL -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem;">
                <div style="padding: 0.85rem 1rem; background: var(--surface-content); border: 1px solid var(--border); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: var(--secondary); font-weight: 800; text-transform: uppercase;">Variedad Vendida</div>
                    <div style="font-size: 1.4rem; font-weight: 900; color: var(--text-main); margin: 0.2rem 0;">${totalVariety} productos</div>
                    <small style="font-size: 0.72rem; color: var(--secondary);">Artículos con venta</small>
                </div>

                <div style="padding: 0.85rem 1rem; background: rgba(59, 130, 246, 0.08); border: 1.5px solid rgba(59, 130, 246, 0.3); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: #2563eb; font-weight: 800; text-transform: uppercase;">Unidades Despachadas</div>
                    <div style="font-size: 1.4rem; font-weight: 900; color: #2563eb; margin: 0.2rem 0;">${formatNumber(totalUnits)}</div>
                    <small style="font-size: 0.72rem; color: #2563eb;">Total ítems entregados</small>
                </div>

                <div style="padding: 0.85rem 1rem; background: rgba(245, 158, 11, 0.08); border: 1.5px solid rgba(245, 158, 11, 0.3); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: #d97706; font-weight: 800; text-transform: uppercase;">👑 Más Vendido (Volumen)</div>
                    <div style="font-size: 1rem; font-weight: 900; color: #d97706; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0.2rem 0;" title="${topByQty.name}">${topByQty.name}</div>
                    <small style="font-size: 0.72rem; color: #d97706;">${formatNumber(topByQty.quantity)} unidades</small>
                </div>

                <div style="padding: 0.85rem 1rem; background: rgba(16, 185, 129, 0.08); border: 1.5px solid rgba(16, 185, 129, 0.3); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: #059669; font-weight: 800; text-transform: uppercase;">💎 Más Rentable (Ganancia)</div>
                    <div style="font-size: 1rem; font-weight: 900; color: #059669; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0.2rem 0;" title="${topByProfit.name}">${topByProfit.name}</div>
                    <small style="font-size: 0.72rem; color: #059669;">+${formatCLP(topByProfit.grossProfit)} ganancia</small>
                </div>

                <div style="padding: 0.85rem 1rem; background: rgba(139, 92, 246, 0.08); border: 1.5px solid rgba(139, 92, 246, 0.3); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: #7c3aed; font-weight: 800; text-transform: uppercase;">Utilidad Total en Ventas</div>
                    <div style="font-size: 1.4rem; font-weight: 900; color: #7c3aed; margin: 0.2rem 0;">${formatCLP(grandTotalProfit)}</div>
                    <small style="font-size: 0.72rem; color: #7c3aed;">Ganancia neta total</small>
                </div>
            </div>
            
            ${products.length === 0 ? '<div class="card glass-panel" style="padding: 2.5rem; text-align: center; color: var(--secondary); font-weight: 700;">No hay ventas registradas en el período seleccionado</div>' : `
                <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; flex-wrap: wrap; gap: 0.5rem;">
                        <span style="font-size: 0.85rem; color: var(--secondary); font-weight: 600;">
                            💡 Puedes hacer clic en los encabezados de la tabla para ordenar por Ventas, Ganancia o Stock.
                        </span>
                    </div>
                    <div class="table-container">
                        <table id="reportProductsTable" style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="border-bottom: 2px solid var(--border); font-size: 0.8rem; color: var(--secondary); text-transform: uppercase;">
                                    <th style="padding: 0.75rem; text-align: left; cursor: pointer;" onclick="ReportsView.sortProductsReportTable('name')">
                                        Producto ↕
                                    </th>
                                    <th style="padding: 0.75rem; text-align: center; cursor: pointer;" onclick="ReportsView.sortProductsReportTable('currentStock')">
                                        Stock en Tienda ↕
                                    </th>
                                    <th style="padding: 0.75rem; text-align: right; cursor: pointer;" onclick="ReportsView.sortProductsReportTable('quantity')">
                                        Cant. Vendida ↕
                                    </th>
                                    <th style="padding: 0.75rem; text-align: right; cursor: pointer;" onclick="ReportsView.sortProductsReportTable('total')">
                                        Total Vendido ↕
                                    </th>
                                    <th style="padding: 0.75rem; text-align: right; color: var(--secondary);">
                                        Costo Total
                                    </th>
                                    <th style="padding: 0.75rem; text-align: right; color: #059669; cursor: pointer;" onclick="ReportsView.sortProductsReportTable('grossProfit')">
                                        Ganancia Real ↕
                                    </th>
                                    <th style="padding: 0.75rem; text-align: right; color: #059669; cursor: pointer;" onclick="ReportsView.sortProductsReportTable('marginPercent')">
                                        Margen % ↕
                                    </th>
                                    <th style="padding: 0.75rem; text-align: left; width: 130px;">% de Ingresos</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${products.map(p => {
                                    const percentage = grandTotalRevenue > 0 ? (p.total / grandTotalRevenue * 100).toFixed(1) : 0;
                                    
                                    // Estado del Stock
                                    let stockBadge = '-';
                                    if (p.currentStock !== null && p.currentStock !== undefined) {
                                        const stockVal = parseFloat(p.currentStock) || 0;
                                        const unitText = p.type === 'weight' ? 'kg' : 'un';
                                        if (stockVal <= 0) {
                                            stockBadge = `<span class="badge badge-danger" style="font-size: 0.72rem; font-weight: 800;">🚨 Agotado (${stockVal})</span>`;
                                        } else if (stockVal <= (p.minStock || 5)) {
                                            stockBadge = `<span class="badge badge-warning" style="font-size: 0.72rem; font-weight: 800;">⚠️ Bajo (${stockVal} ${unitText})</span>`;
                                        } else {
                                            stockBadge = `<span class="badge badge-success" style="font-size: 0.72rem; font-weight: 700;">✅ ${stockVal} ${unitText}</span>`;
                                        }
                                    }

                                    return `
                                        <tr style="border-bottom: 1px solid var(--border);">
                                            <td style="padding: 0.75rem;">
                                                <div style="font-weight: 800; color: var(--text-main);">${safeHTML(p.name)}</div>
                                                ${p.barcode ? `<small style="color: var(--secondary); font-size: 0.72rem;">Código: ${safeHTML(p.barcode)}</small>` : ''}
                                            </td>
                                            <td style="padding: 0.75rem; text-align: center;">${stockBadge}</td>
                                            <td style="padding: 0.75rem; text-align: right; font-weight: 800;">${formatNumber(p.quantity)}</td>
                                            <td style="padding: 0.75rem; text-align: right; font-weight: 900; color: #2563eb;">${formatCLP(p.total)}</td>
                                            <td style="padding: 0.75rem; text-align: right; color: var(--secondary); font-weight: 600;">${formatCLP(p.costTotal)}</td>
                                            <td style="padding: 0.75rem; text-align: right; font-weight: 900; color: #059669;">+${formatCLP(p.grossProfit)}</td>
                                            <td style="padding: 0.75rem; text-align: right; font-weight: 800; color: #059669;">
                                                <span class="badge badge-success" style="font-size: 0.75rem;">${p.marginPercent}%</span>
                                            </td>
                                            <td style="padding: 0.75rem;">
                                                <div style="display: flex; align-items: center; gap: 0.4rem;">
                                                    <div style="flex: 1; height: 7px; background: rgba(0,0,0,0.06); border-radius: 4px; overflow: hidden;">
                                                        <div style="width: ${percentage}%; height: 100%; background: var(--primary); border-radius: 4px;"></div>
                                                    </div>
                                                    <span style="font-size: 0.72rem; font-weight: 800; color: var(--secondary); min-width: 35px;">${percentage}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `}
        `;
    },

    _sortProductDataList(list, key, dir) {
        list.sort((a, b) => {
            let valA = a[key];
            let valB = b[key];
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            if (valA === null || valA === undefined) valA = -999999;
            if (valB === null || valB === undefined) valB = -999999;
            if (valA < valB) return dir === 'asc' ? -1 : 1;
            if (valA > valB) return dir === 'asc' ? 1 : -1;
            return 0;
        });
    },

    async sortProductsReportTable(key) {
        if (!this._currentProductSort) this._currentProductSort = { key: 'quantity', dir: 'desc' };
        if (this._currentProductSort.key === key) {
            this._currentProductSort.dir = this._currentProductSort.dir === 'desc' ? 'asc' : 'desc';
        } else {
            this._currentProductSort.key = key;
            this._currentProductSort.dir = 'desc';
        }
        const content = await this.renderProductsReport(this.selectedProductsStart, this.selectedProductsEnd);
        const container = document.getElementById('reportContent');
        if (container) container.innerHTML = content;
    },

    async applyProductsCustomDate() {
        const fromVal = document.getElementById('prodDateFrom')?.value;
        const toVal = document.getElementById('prodDateTo')?.value;
        if (!fromVal || !toVal) {
            showNotification('Selecciona ambas fechas para filtrar', 'warning');
            return;
        }
        const content = await this.renderProductsReport(fromVal, toVal);
        const container = document.getElementById('reportContent');
        if (container) container.innerHTML = content;
    },

    async handleProductsPeriodChange(days) {
        const content = await this.renderProductsReport(days);
        const container = document.getElementById('reportContent');
        if (container) container.innerHTML = content;
    },

    filterProductsReport(query) {
        const term = (query || '').toLowerCase().trim();
        const rows = document.querySelectorAll('#reportProductsTable tbody tr');
        rows.forEach(row => {
            const text = row.innerText.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
        });
    },

    exportProductsToCSV() {
        const products = this._lastProductsReportData || [];
        if (products.length === 0) {
            showNotification('No hay datos para exportar', 'warning');
            return;
        }
        const headers = ['Producto', 'Stock Actual', 'Cantidad Vendida', 'Total Vendido ($)', 'Costo Total ($)', 'Ganancia ($)', 'Margen (%)'];
        const rows = products.map(p => [
            `"${(p.name || '').replace(/"/g, '""')}"`,
            p.currentStock !== null ? p.currentStock : 'N/A',
            p.quantity || 0,
            p.total || 0,
            p.costTotal || 0,
            p.grossProfit || 0,
            `${p.marginPercent || 0}%`
        ]);
        const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `reporte_desempeno_productos_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification('📄 Reporte descargado en CSV (Excel)', 'success');
    },

    exportDailyToCSV() {
        const sales = this._lastDailyReportSales || [];
        const dateStr = this._lastDailyDateStr || new Date().toISOString().slice(0, 10);
        if (sales.length === 0) {
            showNotification('No hay ventas registradas para exportar en esta fecha', 'warning');
            return;
        }
        const headers = ['Nº Ticket', 'Hora', 'Método de Pago', 'Estado', 'Items', 'Subtotal ($)', 'Descuento ($)', 'Total Vendido ($)'];
        const rows = sales.map(s => [
            `"#${s.saleNumber || s.id}"`,
            `"${s.date ? new Date(s.date).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : ''}"`,
            `"${s.paymentMethod || 'cash'}"`,
            `"${s.status || 'completed'}"`,
            (s.items || []).length,
            s.subtotal || s.total || 0,
            s.discountAmount || s.discount || 0,
            s.total || 0
        ]);
        const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `reporte_ventas_dia_${dateStr}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification('📊 Reporte de Ventas del Día descargado en Excel (CSV)', 'success');
    },

    async renderProfitabilityReport(daysOrStart = 30, endParam = null) {
        let startDate, endDate;
        let periodLabel = '';

        if (endParam) {
            startDate = new Date(`${daysOrStart}T00:00:00`);
            endDate = new Date(`${endParam}T23:59:59`);
            this.selectedProfitabilityStart = daysOrStart;
            this.selectedProfitabilityEnd = endParam;
            this.selectedProfitabilityDays = 'custom';
            periodLabel = `Del ${formatDate(startDate)} al ${formatDate(endDate)}`;
        } else {
            const days = parseInt(daysOrStart) || 30;
            this.selectedProfitabilityDays = days;
            endDate = new Date();
            startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            this.selectedProfitabilityStart = startDate.toISOString().slice(0, 10);
            this.selectedProfitabilityEnd = endDate.toISOString().slice(0, 10);
            periodLabel = `Últimos ${days} días`;
        }

        const report = await ReportController.getProfitability(startDate, endDate);
        this._lastProfitabilityReport = report;

        const netMarginPerc = report.margin || 0;
        const grossMarginPerc = report.grossMargin || 0;

        // Cálculo de retorno real por cada $200, $500 y $1.000
        const profitPer200 = Math.round(200 * (netMarginPerc / 100));
        const profitPer500 = Math.round(500 * (netMarginPerc / 100));
        const profitPer1000 = Math.round(1000 * (netMarginPerc / 100));

        const categories = report.byCategory || [];
        const topCat = categories.length > 0 ? categories[0] : null;
        const lowestCat = categories.length > 1 ? [...categories].sort((a, b) => a.margin - b.margin)[0] : null;

        return `
            <!-- CABECERA Y FILTROS DE PERÍODO -->
            <div class="flex-between-wrap" style="margin-bottom: 1.25rem; gap: 1rem; align-items: center;">
                <div>
                    <h3 style="margin: 0; font-size: 1.4rem; color: var(--text-main); display: flex; align-items: center; gap: 0.75rem;">
                        💰 Ganancias y Utilidad Real
                    </h3>
                    <p style="margin: 0.25rem 0 0 0; color: var(--secondary); font-size: 0.85rem;">
                        Estado de Resultados Financiero y Margen de Utilidad (${periodLabel})
                    </p>
                </div>

                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                    <!-- Botones Rápidos -->
                    <div style="display: flex; gap: 0.25rem; background: var(--surface-content); padding: 0.25rem; border-radius: 0.75rem; border: 1px solid var(--border);">
                        <button class="btn btn-sm ${this.selectedProfitabilityDays === 7 ? 'btn-primary' : 'btn-ghost'}" onclick="ReportsView.handleProfitabilityPeriodChange(7)">7 Días</button>
                        <button class="btn btn-sm ${this.selectedProfitabilityDays === 30 ? 'btn-primary' : 'btn-ghost'}" onclick="ReportsView.handleProfitabilityPeriodChange(30)">30 Días</button>
                        <button class="btn btn-sm ${this.selectedProfitabilityDays === 90 ? 'btn-primary' : 'btn-ghost'}" onclick="ReportsView.handleProfitabilityPeriodChange(90)">90 Días</button>
                    </div>

                    <!-- Selector Personalizado Desde / Hasta -->
                    <div style="display: flex; align-items: center; gap: 0.35rem; background: var(--surface-content); padding: 0.35rem 0.75rem; border-radius: 0.75rem; border: 1px solid var(--border);">
                        <input type="date" id="profDateFrom" value="${this.selectedProfitabilityStart}" style="border: none; background: transparent; font-size: 0.8rem; font-weight: 700; color: var(--text-main); cursor: pointer;">
                        <span style="color: var(--secondary); font-size: 0.8rem;">a</span>
                        <input type="date" id="profDateTo" value="${this.selectedProfitabilityEnd}" style="border: none; background: transparent; font-size: 0.8rem; font-weight: 700; color: var(--text-main); cursor: pointer;">
                        <button class="btn btn-xs btn-primary" onclick="ReportsView.applyProfitabilityCustomDate()" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; font-weight: 800;">Filtrar</button>
                    </div>

                    <button class="btn btn-success" onclick="ReportsView.exportProfitabilityToCSV()" style="font-weight: 700;">
                        📊 Exportar Excel
                    </button>
                </div>
            </div>

            <!-- TARJETAS DE BALANCE FINANCIERO -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem;">
                <div style="padding: 0.85rem 1rem; background: rgba(59, 130, 246, 0.08); border: 1.5px solid rgba(59, 130, 246, 0.3); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: #2563eb; font-weight: 800; text-transform: uppercase;">Ventas Limpias (Sin IVA)</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: #2563eb; margin: 0.2rem 0;">${formatCLP(report.revenue)}</div>
                    <small style="font-size: 0.72rem; color: #2563eb;">Ingreso real del negocio</small>
                </div>

                <div style="padding: 0.85rem 1rem; background: var(--surface-content); border: 1px solid var(--border); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: var(--secondary); font-weight: 800; text-transform: uppercase;">Costo de Proveedores</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: var(--text-main); margin: 0.2rem 0;">${formatCLP(report.costOfSales)}</div>
                    <small style="font-size: 0.72rem; color: var(--secondary);">Costo de la mercadería</small>
                </div>

                <div style="padding: 0.85rem 1rem; background: rgba(16, 185, 129, 0.08); border: 1.5px solid rgba(16, 185, 129, 0.3); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: #059669; font-weight: 800; text-transform: uppercase;">Ganancia en Mercadería</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: #059669; margin: 0.2rem 0;">${formatCLP(report.grossProfit)}</div>
                    <small style="font-size: 0.72rem; color: #059669; font-weight: 700;">Margen comercial: ${grossMarginPerc.toFixed(1)}%</small>
                </div>

                <div style="padding: 0.85rem 1rem; background: rgba(239, 68, 68, 0.08); border: 1.5px solid rgba(239, 68, 68, 0.3); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: #dc2626; font-weight: 800; text-transform: uppercase;">Gastos de Operación</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: #dc2626; margin: 0.2rem 0;">-${formatCLP(report.operationalExpenses)}</div>
                    <small style="font-size: 0.72rem; color: #dc2626;">Arriendo, cuentas, etc.</small>
                </div>

                <div style="padding: 0.85rem 1rem; background: rgba(139, 92, 246, 0.08); border: 1.5px solid rgba(139, 92, 246, 0.3); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: #7c3aed; font-weight: 800; text-transform: uppercase;">💎 Utilidad Limpia Final</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: ${report.profit >= 0 ? '#7c3aed' : '#dc2626'}; margin: 0.2rem 0;">${formatCLP(report.profit)}</div>
                    <small style="font-size: 0.72rem; color: #7c3aed; font-weight: 700;">Rendimiento: ${netMarginPerc.toFixed(1)}% neto</small>
                </div>
            </div>

            <!-- PANEL DIDÁCTICO: RETORNO REAL POR CADA VENTA EN MOSTRADOR -->
            <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem; margin-bottom: 1.25rem; border-left: 5px solid #7c3aed;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
                    <div>
                        <h4 style="margin: 0; font-size: 1rem; color: var(--text-main); display: flex; align-items: center; gap: 0.5rem;">
                            💵 Rendimiento de Bolsillo por cada Venta en Mostrador
                        </h4>
                        <p style="margin: 0.2rem 0 0 0; color: var(--secondary); font-size: 0.8rem;">
                            ¿Cuánta plata limpia te queda para ti por cada venta cobrada en caja? (Margen neto actual: <strong>${netMarginPerc.toFixed(1)}%</strong>)
                        </p>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem;">
                    <!-- Cada $200 -->
                    <div style="padding: 0.85rem 1rem; background: var(--surface-content); border: 1px solid var(--border); border-radius: 0.75rem;">
                        <div style="font-size: 0.8rem; font-weight: 700; color: var(--secondary);">Por cada $200 vendidos:</div>
                        <div style="font-size: 1.3rem; font-weight: 900; color: ${profitPer200 >= 0 ? '#059669' : '#dc2626'}; margin: 0.2rem 0;">
                            ${profitPer200 >= 0 ? '+' : ''}${formatCLP(profitPer200)} limpios
                        </div>
                        <small style="font-size: 0.72rem; color: var(--secondary);">$${Math.max(0, 200 - profitPer200)} cubren costo y gastos</small>
                    </div>

                    <!-- Cada $500 -->
                    <div style="padding: 0.85rem 1rem; background: var(--surface-content); border: 1px solid var(--border); border-radius: 0.75rem;">
                        <div style="font-size: 0.8rem; font-weight: 700; color: var(--secondary);">Por cada $500 vendidos:</div>
                        <div style="font-size: 1.3rem; font-weight: 900; color: ${profitPer500 >= 0 ? '#059669' : '#dc2626'}; margin: 0.2rem 0;">
                            ${profitPer500 >= 0 ? '+' : ''}${formatCLP(profitPer500)} limpios
                        </div>
                        <small style="font-size: 0.72rem; color: var(--secondary);">$${Math.max(0, 500 - profitPer500)} cubren costo y gastos</small>
                    </div>

                    <!-- Cada $1.000 -->
                    <div style="padding: 0.85rem 1rem; background: var(--surface-content); border: 1px solid var(--border); border-radius: 0.75rem;">
                        <div style="font-size: 0.8rem; font-weight: 700; color: var(--secondary);">Por cada $1.000 vendidos:</div>
                        <div style="font-size: 1.3rem; font-weight: 900; color: ${profitPer1000 >= 0 ? '#059669' : '#dc2626'}; margin: 0.2rem 0;">
                            ${profitPer1000 >= 0 ? '+' : ''}${formatCLP(profitPer1000)} limpios
                        </div>
                        <small style="font-size: 0.72rem; color: var(--secondary);">$${Math.max(0, 1000 - profitPer1000)} cubren costo y gastos</small>
                    </div>
                </div>
            </div>

            <!-- ESTADO DE RESULTADOS CLARO Y ORDENADO (P&L) -->
            <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem; margin-bottom: 1.25rem;">
                <h4 style="margin: 0 0 0.85rem 0; font-size: 0.95rem; color: var(--text-main);">
                    📊 Estado de Resultados Consolidado
                </h4>
                <div style="display: flex; flex-direction: column; gap: 0.65rem; font-size: 0.9rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: var(--secondary);">(+) Ventas Limpias Realizadas:</span>
                        <strong style="color: #2563eb; font-size: 1.05rem;">${formatCLP(report.revenue)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: var(--secondary);">(-) Costo de Productos Pagado a Proveedores:</span>
                        <strong style="color: #dc2626;">-${formatCLP(report.costOfSales)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-top: 1px dashed var(--border); border-bottom: 1px dashed var(--border);">
                        <span style="font-weight: 800; color: var(--text-main);">(=) Ganancia por Venta de Mercadería:</span>
                        <strong style="color: #059669; font-size: 1.15rem;">+${formatCLP(report.grossProfit)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: var(--secondary);">(-) Gastos del Negocio (Cuentas, Arriendos, Insumos):</span>
                        <strong style="color: #dc2626;">-${formatCLP(report.operationalExpenses)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.75rem; border-top: 2px solid var(--border);">
                        <div>
                            <strong style="color: var(--text-main); font-size: 1.05rem;">🏆 Ganancia Limpia Final para tu Bolsillo:</strong>
                            <div style="font-size: 0.75rem; color: var(--secondary);">Dinero libre después de cubrir todo</div>
                        </div>
                        <strong style="color: ${report.profit >= 0 ? '#059669' : '#dc2626'}; font-size: 1.4rem;">
                            ${report.profit >= 0 ? '+' : ''}${formatCLP(report.profit)}
                        </strong>
                    </div>
                </div>
            </div>

            <!-- RENTABILIDAD POR CATEGORÍA -->
            ${categories.length > 0 ? `
                <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; flex-wrap: wrap; gap: 0.5rem;">
                        <div>
                            <h4 style="margin: 0; font-size: 0.95rem; color: var(--text-main);">📂 Rentabilidad por Categoría</h4>
                            <p style="margin: 0.2rem 0 0 0; color: var(--secondary); font-size: 0.8rem;">Desempeño de cada departamento de tu tienda</p>
                        </div>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            ${topCat ? `<span class="badge badge-success" style="font-size: 0.75rem; font-weight: 700;">🏆 Más Rentable: ${safeHTML(topCat.name)}</span>` : ''}
                            ${lowestCat ? `<span class="badge badge-warning" style="font-size: 0.75rem; font-weight: 700;">⚠️ Menor Margen: ${safeHTML(lowestCat.name)} (${(lowestCat.margin || 0).toFixed(1)}%)</span>` : ''}
                        </div>
                    </div>
                    <div class="table-container">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="border-bottom: 2px solid var(--border); font-size: 0.8rem; color: var(--secondary); text-transform: uppercase;">
                                    <th style="padding: 0.75rem; text-align: left;">Categoría</th>
                                    <th style="padding: 0.75rem; text-align: right;">Ventas Limpias</th>
                                    <th style="padding: 0.75rem; text-align: right; color: var(--secondary);">Costo Proveedor</th>
                                    <th style="padding: 0.75rem; text-align: right; color: #059669;">Ganancia</th>
                                    <th style="padding: 0.75rem; text-align: center;">Margen %</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${categories.map(cat => `
                                    <tr style="border-bottom: 1px solid var(--border);">
                                        <td style="padding: 0.75rem; font-weight: 800; color: var(--text-main);">${safeHTML(cat.name)}</td>
                                        <td style="padding: 0.75rem; text-align: right; font-weight: 700; color: #2563eb;">${formatCLP(cat.revenue)}</td>
                                        <td style="padding: 0.75rem; text-align: right; color: var(--secondary); font-weight: 600;">${formatCLP(cat.cost)}</td>
                                        <td style="padding: 0.75rem; text-align: right; font-weight: 900; color: ${cat.profit >= 0 ? '#059669' : '#dc2626'};">
                                            ${cat.profit >= 0 ? '+' : ''}${formatCLP(cat.profit)}
                                        </td>
                                        <td style="padding: 0.75rem; text-align: center;">
                                            <span class="badge ${cat.margin >= 25 ? 'badge-success' : (cat.margin >= 15 ? 'badge-warning' : 'badge-danger')}" style="font-size: 0.75rem; font-weight: 800;">
                                                ${(cat.margin || 0).toFixed(1)}%
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

    async applyProfitabilityCustomDate() {
        const fromVal = document.getElementById('profDateFrom')?.value;
        const toVal = document.getElementById('profDateTo')?.value;
        if (!fromVal || !toVal) {
            showNotification('Selecciona ambas fechas para filtrar', 'warning');
            return;
        }
        const content = await this.renderProfitabilityReport(fromVal, toVal);
        const container = document.getElementById('reportContent');
        if (container) container.innerHTML = content;
    },

    async handleProfitabilityPeriodChange(days) {
        const content = await this.renderProfitabilityReport(days);
        const container = document.getElementById('reportContent');
        if (container) container.innerHTML = content;
    },

    exportProfitabilityToCSV() {
        const report = this._lastProfitabilityReport;
        const startStr = this.selectedProfitabilityStart || new Date().toISOString().slice(0, 10);
        const endStr = this.selectedProfitabilityEnd || new Date().toISOString().slice(0, 10);
        if (!report) {
            showNotification('No hay datos de rentabilidad para exportar', 'warning');
            return;
        }

        const headers = ['Categoría', 'Ventas Limpias ($)', 'Costo de Ventas ($)', 'Ganancia ($)', 'Margen (%)'];
        const rows = (report.byCategory || []).map(c => [
            `"${(c.name || '').replace(/"/g, '""')}"`,
            c.revenue || 0,
            c.cost || 0,
            c.profit || 0,
            `${(c.margin || 0).toFixed(1)}%`
        ]);

        const summaryRows = [
            [],
            ['Resumen de Ganancias y Utilidad'],
            ['Ventas Limpias (Sin IVA)', report.revenue || 0],
            ['Costo de Proveedores', report.costOfSales || 0],
            ['Ganancia en Mercadería', report.grossProfit || 0],
            ['Gastos de Operación', report.operationalExpenses || 0],
            ['Ganancia Limpia Final para el Bolsillo', report.profit || 0]
        ];

        const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';')), ...summaryRows.map(e => e.join(';'))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `reporte_ganancias_utilidad_${startStr}_al_${endStr}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification('📊 Reporte de Ganancias descargado en Excel (CSV)', 'success');
    },

    async renderStockReport(filterType = 'all') {
        const report = await ReportController.getStockReport();
        const allProducts = report.products || [];
        this._lastStockReportData = allProducts;
        this.selectedStockFilter = filterType;

        const totalProducts = allProducts.length;
        const lowStockCount = (report.lowStock || []).length;
        const outOfStockCount = (report.outOfStock || []).length;
        const dormantCount = (report.dormantStock || []).length;
        const reorderList = allProducts.filter(p => p.suggestedOrder > 0);
        const reorderCount = reorderList.length;

        const totalCostValue = report.totalCostValue || 0;
        const totalRetailValue = report.totalRetailValue || 0;
        const projectedProfit = report.projectedProfit || 0;
        const dormantCapitalTotal = report.dormantCapitalTotal || 0;
        const potentialMargin = totalRetailValue > 0 ? ((projectedProfit / totalRetailValue) * 100).toFixed(1) : 0;

        let filteredProducts = allProducts;
        if (filterType === 'low') {
            filteredProducts = report.lowStock;
        } else if (filterType === 'out') {
            filteredProducts = report.outOfStock;
        } else if (filterType === 'dormant') {
            filteredProducts = report.dormantStock;
        } else if (filterType === 'reorder') {
            filteredProducts = reorderList;
        }

        // Ordenamiento
        this._currentStockSort = this._currentStockSort || { key: 'stock', dir: 'asc' };
        this._sortStockDataList(filteredProducts, this._currentStockSort.key, this._currentStockSort.dir);

        return `
            <!-- CABECERA Y ACCIONES -->
            <div class="flex-between-wrap" style="margin-bottom: 1.25rem; gap: 1rem; align-items: center;">
                <div>
                    <h3 style="margin: 0; font-size: 1.4rem; color: var(--text-main); display: flex; align-items: center; gap: 0.75rem;">
                        📦 Estado de Inventario y Salud del Stock
                    </h3>
                    <p style="margin: 0.25rem 0 0 0; color: var(--secondary); font-size: 0.85rem;">
                        Valorización de bodega, días de autonomía y sugerencia inteligente de compras
                    </p>
                </div>

                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                    <input type="text" id="reportStockSearchFilter" placeholder="🔍 Buscar producto o código..." 
                           onkeyup="ReportsView.filterStockReportTable(this.value)" class="form-control" 
                           style="width: 240px; padding: 0.4rem 0.75rem; border-radius: 0.75rem;">

                    <button class="btn btn-success" onclick="ReportsView.exportStockToCSV()" style="font-weight: 700;">
                        📊 Exportar Excel
                    </button>
                </div>
            </div>

            <!-- TARJETAS DE VALORIZACIÓN Y SALUD DE BODEGA -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem;">
                <div style="padding: 0.85rem 1rem; background: var(--surface-content); border: 1px solid var(--border); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: var(--secondary); font-weight: 800; text-transform: uppercase;">Catálogo Activo</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: var(--text-main); margin: 0.2rem 0;">${totalProducts} productos</div>
                    <small style="font-size: 0.72rem; color: var(--secondary);">Total artículos registrados</small>
                </div>

                <div style="padding: 0.85rem 1rem; background: rgba(59, 130, 246, 0.08); border: 1.5px solid rgba(59, 130, 246, 0.3); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: #2563eb; font-weight: 800; text-transform: uppercase;">Capital Invertido a Costo</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: #2563eb; margin: 0.2rem 0;">${formatCLP(totalCostValue)}</div>
                    <small style="font-size: 0.72rem; color: #2563eb;">Plata en mercadería</small>
                </div>

                <div style="padding: 0.85rem 1rem; background: rgba(16, 185, 129, 0.08); border: 1.5px solid rgba(16, 185, 129, 0.3); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: #059669; font-weight: 800; text-transform: uppercase;">Recaudación Esperada</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: #059669; margin: 0.2rem 0;">${formatCLP(totalRetailValue)}</div>
                    <small style="font-size: 0.72rem; color: #059669;">Si vendes todo tu stock</small>
                </div>

                <div style="padding: 0.85rem 1rem; background: rgba(139, 92, 246, 0.08); border: 1.5px solid rgba(139, 92, 246, 0.3); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: #7c3aed; font-weight: 800; text-transform: uppercase;">💎 Ganancia Potencial</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: #7c3aed; margin: 0.2rem 0;">+${formatCLP(projectedProfit)}</div>
                    <small style="font-size: 0.72rem; color: #7c3aed; font-weight: 700;">Margen bodega: ${potentialMargin}%</small>
                </div>

                <div style="padding: 0.85rem 1rem; background: rgba(245, 158, 11, 0.08); border: 1.5px solid rgba(245, 158, 11, 0.3); border-radius: 0.75rem; text-align: center; cursor: pointer;"
                     onclick="ReportsView.handleStockFilterChange('dormant')">
                    <div style="font-size: 0.72rem; color: #d97706; font-weight: 800; text-transform: uppercase;">💤 Capital Inmovilizado</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: #d97706; margin: 0.2rem 0;">${formatCLP(dormantCapitalTotal)}</div>
                    <small style="font-size: 0.72rem; color: #d97706; font-weight: 700;">${dormantCount} productos sin venta</small>
                </div>
            </div>

            <!-- PESTAÑAS DE FILTRADO INTERACTIVO -->
            <div style="display: flex; gap: 0.4rem; margin-bottom: 1rem; flex-wrap: wrap;">
                <button class="btn btn-sm ${filterType === 'all' ? 'btn-primary' : 'btn-ghost'}" onclick="ReportsView.handleStockFilterChange('all')">
                    📦 Todos los Productos (${totalProducts})
                </button>
                <button class="btn btn-sm ${filterType === 'low' ? 'btn-warning' : 'btn-ghost'}" onclick="ReportsView.handleStockFilterChange('low')">
                    ⚠️ Stock Bajo (${lowStockCount})
                </button>
                <button class="btn btn-sm ${filterType === 'out' ? 'btn-danger' : 'btn-ghost'}" onclick="ReportsView.handleStockFilterChange('out')">
                    🛑 Agotados (${outOfStockCount})
                </button>
                <button class="btn btn-sm ${filterType === 'reorder' ? 'btn-primary' : 'btn-ghost'}" style="${filterType === 'reorder' ? 'background: #059669;' : ''}" onclick="ReportsView.handleStockFilterChange('reorder')">
                    🛒 Pedido Sugerido (${reorderCount})
                </button>
                <button class="btn btn-sm ${filterType === 'dormant' ? 'btn-warning' : 'btn-ghost'}" onclick="ReportsView.handleStockFilterChange('dormant')">
                    💤 Sin Venta en 30 Días (${dormantCount})
                </button>
            </div>

            <!-- TABLA DE DETALLE DE INVENTARIO -->
            <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; flex-wrap: wrap; gap: 0.5rem;">
                    <span style="font-size: 0.85rem; color: var(--secondary); font-weight: 600;">
                        💡 Puedes hacer clic en los encabezados para ordenar por Stock, Días de Autonomía o Valor en Dinero.
                    </span>
                </div>
                <div class="table-container">
                    <table id="reportStockTable" style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--border); font-size: 0.8rem; color: var(--secondary); text-transform: uppercase;">
                                <th style="padding: 0.75rem; text-align: left; cursor: pointer;" onclick="ReportsView.sortStockReportTable('name')">
                                    Producto ↕
                                </th>
                                <th style="padding: 0.75rem; text-align: center; cursor: pointer;" onclick="ReportsView.sortStockReportTable('stock')">
                                    Stock Actual ↕
                                </th>
                                <th style="padding: 0.75rem; text-align: center; cursor: pointer;" onclick="ReportsView.sortStockReportTable('stockDays')">
                                    Autonomía (Días) ↕
                                </th>
                                <th style="padding: 0.75rem; text-align: center; color: #059669; cursor: pointer;" onclick="ReportsView.sortStockReportTable('suggestedOrder')">
                                    Sugerencia Pedido ↕
                                </th>
                                <th style="padding: 0.75rem; text-align: right; color: var(--secondary); cursor: pointer;" onclick="ReportsView.sortStockReportTable('costVal')">
                                    Valor a Costo ↕
                                </th>
                                <th style="padding: 0.75rem; text-align: right; color: #2563eb; cursor: pointer;" onclick="ReportsView.sortStockReportTable('retailVal')">
                                    Valor a Venta ↕
                                </th>
                                <th style="padding: 0.75rem; text-align: center;">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredProducts.map(p => {
                                const stock = parseFloat(p.stock) || 0;
                                const minStock = parseFloat(p.minStock) || 0;
                                const unitText = p.type === 'weight' ? 'kg' : 'un';
                                const costVal = p.costVal || 0;
                                const retailVal = p.retailVal || 0;

                                // Badge de Estado
                                let badge = '<span class="badge badge-success" style="font-size: 0.72rem; font-weight: 700;">✅ Normal</span>';
                                if (stock <= 0) {
                                    badge = '<span class="badge badge-danger" style="font-size: 0.72rem; font-weight: 800;">🚨 Agotado</span>';
                                } else if (stock <= minStock) {
                                    badge = '<span class="badge badge-warning" style="font-size: 0.72rem; font-weight: 800;">⚠️ Stock Bajo</span>';
                                }

                                // Autonomía en días
                                let autonomyBadge = '-';
                                if (stock <= 0) {
                                    autonomyBadge = '<span style="color: #dc2626; font-weight: 800; font-size: 0.8rem;">0 días (Agotado)</span>';
                                } else if (p.stockDays === 999) {
                                    autonomyBadge = '<span style="color: #d97706; font-size: 0.78rem; font-weight: 600;">💤 Sin venta (30d)</span>';
                                } else if (p.stockDays <= 3) {
                                    autonomyBadge = `<span style="color: #dc2626; font-weight: 900; font-size: 0.82rem;">🚨 ${p.stockDays} días</span>`;
                                } else if (p.stockDays <= 7) {
                                    autonomyBadge = `<span style="color: #d97706; font-weight: 800; font-size: 0.82rem;">⚠️ ${p.stockDays} días</span>`;
                                } else {
                                    autonomyBadge = `<span style="color: #059669; font-weight: 700; font-size: 0.82rem;">✅ ${p.stockDays} días</span>`;
                                }

                                // Pedido Sugerido
                                let suggestedBadge = '<span style="color: var(--secondary); font-size: 0.78rem;">-</span>';
                                if (p.suggestedOrder > 0) {
                                    suggestedBadge = `<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #059669; font-weight: 800; font-size: 0.75rem; border: 1px solid rgba(16, 185, 129, 0.3);">+${p.suggestedOrder} ${unitText}</span>`;
                                }

                                return `
                                    <tr style="border-bottom: 1px solid var(--border);">
                                        <td style="padding: 0.75rem;">
                                            <div style="font-weight: 800; color: var(--text-main);">${safeHTML(p.name)}</div>
                                            ${p.barcode ? `<small style="color: var(--secondary); font-size: 0.72rem;">Código: ${safeHTML(p.barcode)}</small>` : ''}
                                        </td>
                                        <td style="padding: 0.75rem; text-align: center; font-weight: 800; color: ${stock <= 0 ? '#dc2626' : 'var(--text-main)'};">
                                            ${stock} ${unitText}
                                            <div style="font-size: 0.7rem; color: var(--secondary); font-weight: 600;">Mín: ${minStock} ${unitText}</div>
                                        </td>
                                        <td style="padding: 0.75rem; text-align: center;">${autonomyBadge}</td>
                                        <td style="padding: 0.75rem; text-align: center;">${suggestedBadge}</td>
                                        <td style="padding: 0.75rem; text-align: right; color: var(--secondary); font-weight: 600;">${formatCLP(costVal)}</td>
                                        <td style="padding: 0.75rem; text-align: right; font-weight: 900; color: #2563eb;">${formatCLP(retailVal)}</td>
                                        <td style="padding: 0.75rem; text-align: center;">${badge}</td>
                                    </tr>
                                `;
                            }).join('')}
                            ${filteredProducts.length === 0 ? '<tr><td colspan="7" style="text-align:center; padding: 2.5rem; color: var(--secondary); font-weight:700;">No hay productos en este filtro</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    _sortStockDataList(list, key, dir) {
        list.sort((a, b) => {
            let valA = a[key];
            let valB = b[key];
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            if (valA === null || valA === undefined) valA = -999999;
            if (valB === null || valB === undefined) valB = -999999;
            if (valA < valB) return dir === 'asc' ? -1 : 1;
            if (valA > valB) return dir === 'asc' ? 1 : -1;
            return 0;
        });
    },

    async sortStockReportTable(key) {
        if (!this._currentStockSort) this._currentStockSort = { key: 'stock', dir: 'asc' };
        if (this._currentStockSort.key === key) {
            this._currentStockSort.dir = this._currentStockSort.dir === 'desc' ? 'asc' : 'desc';
        } else {
            this._currentStockSort.key = key;
            this._currentStockSort.dir = 'asc';
        }
        const content = await this.renderStockReport(this.selectedStockFilter || 'all');
        const container = document.getElementById('reportContent');
        if (container) container.innerHTML = content;
    },

    async handleStockFilterChange(filterType) {
        const content = await this.renderStockReport(filterType);
        const container = document.getElementById('reportContent');
        if (container) container.innerHTML = content;
    },

    filterStockReportTable(query) {
        const term = (query || '').toLowerCase().trim();
        const rows = document.querySelectorAll('#reportStockTable tbody tr');
        rows.forEach(row => {
            const text = row.innerText.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
        });
    },

    exportStockToCSV() {
        const products = this._lastStockReportData || [];
        if (products.length === 0) {
            showNotification('No hay datos de stock para exportar', 'warning');
            return;
        }

        const headers = ['Producto', 'Código de Barra', 'Stock Actual', 'Stock Mínimo', 'Días de Autonomía', 'Pedido Sugerido', 'Costo Unitario ($)', 'Precio Venta ($)', 'Valor Total Costo ($)', 'Valor Total Venta ($)', 'Estado'];
        const rows = products.map(p => {
            const stock = parseFloat(p.stock) || 0;
            const minStock = parseFloat(p.minStock) || 0;
            const cost = parseFloat(p.cost) || 0;
            const price = parseFloat(p.price) || 0;
            let status = 'Normal';
            if (stock <= 0) status = 'Agotado';
            else if (stock <= minStock) status = 'Stock Bajo';

            const daysText = p.stockDays === 999 ? 'Sin venta (30d)' : (p.stockDays !== null ? `${p.stockDays} días` : '-');

            return [
                `"${(p.name || '').replace(/"/g, '""')}"`,
                `"${p.barcode || ''}"`,
                stock,
                minStock,
                `"${daysText}"`,
                p.suggestedOrder || 0,
                cost,
                price,
                stock * cost,
                stock * price,
                `"${status}"`
            ];
        });

        const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `reporte_inventario_stock_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification('📊 Reporte de Inventario descargado en Excel (CSV)', 'success');
    },

    async renderStagnantReport(daysParam = 14) {
        const days = parseInt(daysParam) || 14;
        const report = await ReportController.getStagnantProducts(days) || [];
        this._lastStagnantReportData = report;
        this.selectedStagnantDays = days;

        const totalStagnantCount = report.length;
        const criticalCount = report.filter(i => i.daysInactive > 30).length;
        const totalCapitalStagnant = report.reduce((sum, item) => sum + (parseFloat(item.costValue) || 0), 0);
        const totalRetailStagnant = report.reduce((sum, item) => sum + (parseFloat(item.retailValue) || 0), 0);
        const topCat = report._topStagnantCategory;

        // Ordenamiento
        this._currentStagnantSort = this._currentStagnantSort || { key: 'costValue', dir: 'desc' };
        this._sortStagnantDataList(report, this._currentStagnantSort.key, this._currentStagnantSort.dir);

        return `
            <!-- CABECERA Y FILTROS -->
            <div class="flex-between-wrap" style="margin-bottom: 1.25rem; gap: 1rem; align-items: center;">
                <div>
                    <h3 style="margin: 0; font-size: 1.4rem; color: var(--text-main); display: flex; align-items: center; gap: 0.75rem;">
                        ⏳ Productos sin Venta (Capital Inmovilizado)
                    </h3>
                    <p style="margin: 0.25rem 0 0 0; color: var(--secondary); font-size: 0.85rem;">
                        Mercadería en estantería sin rotación reciente y sugerencias de remate
                    </p>
                </div>

                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                    <div style="display: flex; gap: 0.35rem; align-items: center; background: var(--surface-content); padding: 0.35rem 0.75rem; border-radius: 0.75rem; border: 1px solid var(--border);">
                        <span style="font-size: 0.8rem; color: var(--secondary); font-weight: 700;">Sin venta hace:</span>
                        <select class="form-control" style="width: auto; padding: 0.25rem 0.5rem; border-radius: 0.5rem; font-weight: 700; font-size: 0.82rem;" onchange="ReportsView.handleStagnantDaysChange(this.value)">
                            <option value="7" ${days == 7 ? 'selected' : ''}>7 días</option>
                            <option value="14" ${days == 14 ? 'selected' : ''}>14 días</option>
                            <option value="30" ${days == 30 ? 'selected' : ''}>30 días</option>
                            <option value="60" ${days == 60 ? 'selected' : ''}>60 días</option>
                            <option value="90" ${days == 90 ? 'selected' : ''}>90 días</option>
                        </select>
                    </div>

                    <input type="text" placeholder="🔍 Buscar producto o código..." 
                           onkeyup="ReportsView.filterStagnantTable(this.value)" class="form-control" 
                           style="width: 220px; padding: 0.4rem 0.75rem; border-radius: 0.75rem;">

                    <button class="btn btn-success" onclick="ReportsView.exportStagnantToCSV()" style="font-weight: 700;">
                        📊 Exportar Excel
                    </button>
                </div>
            </div>

            <!-- TARJETAS DE RESUMEN EJECUTIVO -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem;">
                <div style="padding: 0.85rem 1rem; background: var(--surface-content); border: 1px solid var(--border); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: var(--secondary); font-weight: 800; text-transform: uppercase;">Total sin Rotación</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: var(--text-main); margin: 0.2rem 0;">${totalStagnantCount} productos</div>
                    <small style="font-size: 0.72rem; color: var(--secondary);">> ${days} días sin vender</small>
                </div>

                <div style="padding: 0.85rem 1rem; background: rgba(239, 68, 68, 0.08); border: 1.5px solid rgba(239, 68, 68, 0.3); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: #dc2626; font-weight: 800; text-transform: uppercase;">🔴 Nivel Crítico</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: #dc2626; margin: 0.2rem 0;">${criticalCount} productos</div>
                    <small style="font-size: 0.72rem; color: #dc2626;">> 30 días inactivos</small>
                </div>

                <div style="padding: 0.85rem 1rem; background: rgba(245, 158, 11, 0.08); border: 1.5px solid rgba(245, 158, 11, 0.3); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: #d97706; font-weight: 800; text-transform: uppercase;">💸 Capital Inmovilizado</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: #d97706; margin: 0.2rem 0;">${formatCLP(totalCapitalStagnant)}</div>
                    <small style="font-size: 0.72rem; color: #d97706;">Costo total atrapado</small>
                </div>

                <div style="padding: 0.85rem 1rem; background: rgba(139, 92, 246, 0.08); border: 1.5px solid rgba(139, 92, 246, 0.3); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: #7c3aed; font-weight: 800; text-transform: uppercase;">📂 Rubro Más Afectado</div>
                    <div style="font-size: 1rem; font-weight: 900; color: #7c3aed; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0.2rem 0;" title="${topCat ? topCat.name : '-'}">
                        ${topCat ? safeHTML(topCat.name) : '-'}
                    </div>
                    <small style="font-size: 0.72rem; color: #7c3aed;">${topCat ? formatCLP(topCat.amount) + ' atrapados' : '-'}</small>
                </div>

                <div style="padding: 0.85rem 1rem; background: rgba(59, 130, 246, 0.08); border: 1.5px solid rgba(59, 130, 246, 0.3); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: #2563eb; font-weight: 800; text-transform: uppercase;">Recaudación Esperada</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: #2563eb; margin: 0.2rem 0;">${formatCLP(totalRetailStagnant)}</div>
                    <small style="font-size: 0.72rem; color: #2563eb;">Si se remata todo</small>
                </div>
            </div>

            <!-- SUGERENCIA DIDÁCTICA DE LIQUIDACIÓN -->
            ${totalCapitalStagnant > 0 ? `
                <div style="background: rgba(245, 158, 11, 0.08); border: 1.5px solid rgba(245, 158, 11, 0.3); border-radius: 0.75rem; padding: 0.85rem 1.25rem; margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <span style="font-size: 1.6rem;">💡</span>
                        <div>
                            <strong style="color: #d97706; font-size: 0.95rem;">Estrategia de Descongelamiento de Efectivo</strong>
                            <p style="margin: 0.2rem 0 0 0; font-size: 0.82rem; color: var(--text-main);">
                                Tienes <strong>${formatCLP(totalCapitalStagnant)}</strong> durmiendo en estos productos. La columna <strong>"Remate Mínimo"</strong> te indica el precio más bajo al que puedes venderlos para recuperar tu dinero de inmediato sin vender a pérdida.
                            </p>
                        </div>
                    </div>
                </div>
            ` : ''}

            <!-- TABLA DE PRODUCTOS ESTANCADOS -->
            <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; flex-wrap: wrap; gap: 0.5rem;">
                    <span style="font-size: 0.85rem; color: var(--secondary); font-weight: 600;">
                        💡 Haz clic en los encabezados para ordenar por Días Inactivo, Capital Atrapado o Stock.
                    </span>
                </div>
                <div class="table-container">
                    <table id="reportStagnantTable" style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--border); font-size: 0.8rem; color: var(--secondary); text-transform: uppercase;">
                                <th style="padding: 0.75rem; text-align: left; cursor: pointer;" onclick="ReportsView.sortStagnantReportTable('name')">
                                    Producto ↕
                                </th>
                                <th style="padding: 0.75rem; text-align: left;">Categoría</th>
                                <th style="padding: 0.75rem; text-align: center; cursor: pointer;" onclick="ReportsView.sortStagnantReportTable('daysInactive')">
                                    Inactivo Hace ↕
                                </th>
                                <th style="padding: 0.75rem; text-align: center; cursor: pointer;" onclick="ReportsView.sortStagnantReportTable('stock')">
                                    Stock ↕
                                </th>
                                <th style="padding: 0.75rem; text-align: right;">Precio Actual (Margen)</th>
                                <th style="padding: 0.75rem; text-align: right; color: #059669;">Remate Mínimo</th>
                                <th style="padding: 0.75rem; text-align: right; color: #d97706; cursor: pointer;" onclick="ReportsView.sortStagnantReportTable('costValue')">
                                    Capital Atrapado ↕
                                </th>
                                <th style="padding: 0.75rem; text-align: center;">Acción Recomendada</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${report.map(item => {
                                const unitText = item.type === 'weight' ? 'kg' : 'un';
                                let badgeClass = 'badge-info';
                                if (item.daysInactive > 60) badgeClass = 'badge-danger';
                                else if (item.daysInactive > 30) badgeClass = 'badge-warning';

                                return `
                                    <tr style="border-bottom: 1px solid var(--border);">
                                        <td style="padding: 0.75rem;">
                                            <div style="font-weight: 800; color: var(--text-main);">${safeHTML(item.name)}</div>
                                            ${item.barcode ? `<small style="color: var(--secondary); font-size: 0.72rem;">Código: ${safeHTML(item.barcode)}</small>` : ''}
                                        </td>
                                        <td style="padding: 0.75rem; color: var(--secondary); font-weight: 600; font-size: 0.85rem;">
                                            ${safeHTML(item.category)}
                                        </td>
                                        <td style="padding: 0.75rem; text-align: center;">
                                            <span class="badge ${badgeClass}" style="font-size: 0.75rem; font-weight: 800;">
                                                ${item.daysInactive} días
                                            </span>
                                            <div style="font-size: 0.68rem; color: var(--secondary); margin-top: 0.15rem;">
                                                ${item.lastSoldAt ? new Date(item.lastSoldAt).toLocaleDateString('es-CL') : 'Nunca vendido'}
                                            </div>
                                        </td>
                                        <td style="padding: 0.75rem; text-align: center; font-weight: 800;">
                                            ${item.stock} ${unitText}
                                        </td>
                                        <td style="padding: 0.75rem; text-align: right;">
                                            <div style="font-weight: 800; color: #2563eb;">${formatCLP(item.price)}</div>
                                            <small style="color: var(--secondary); font-size: 0.72rem;">Margen: ${item.currentMargin}%</small>
                                        </td>
                                        <td style="padding: 0.75rem; text-align: right; font-weight: 900; color: #059669;">
                                            ${formatCLP(item.minClearancePrice)}
                                            <div style="font-size: 0.68rem; color: var(--secondary);">Costo: ${formatCLP(item.cost)}</div>
                                        </td>
                                        <td style="padding: 0.75rem; text-align: right; font-weight: 900; color: #d97706; font-size: 0.95rem;">
                                            ${formatCLP(item.costValue)}
                                        </td>
                                        <td style="padding: 0.75rem; text-align: center;">
                                            <span class="badge ${item.actionLevel === 'red' ? 'badge-danger' : (item.actionLevel === 'orange' ? 'badge-warning' : 'badge-info')}" style="font-size: 0.72rem; font-weight: 700;">
                                                ${item.suggestedAction}
                                            </span>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                            ${report.length === 0 ? '<tr><td colspan="8" style="text-align:center; padding: 2.5rem; color: #10b981; font-weight:700;">✅ ¡Excelente! No tienes productos estancados en este umbral de ' + days + ' días.</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    _sortStagnantDataList(list, key, dir) {
        list.sort((a, b) => {
            let valA = a[key];
            let valB = b[key];
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            if (valA === null || valA === undefined) valA = -999999;
            if (valB === null || valB === undefined) valB = -999999;
            if (valA < valB) return dir === 'asc' ? -1 : 1;
            if (valA > valB) return dir === 'asc' ? 1 : -1;
            return 0;
        });
    },

    async sortStagnantReportTable(key) {
        if (!this._currentStagnantSort) this._currentStagnantSort = { key: 'costValue', dir: 'desc' };
        if (this._currentStagnantSort.key === key) {
            this._currentStagnantSort.dir = this._currentStagnantSort.dir === 'desc' ? 'asc' : 'desc';
        } else {
            this._currentStagnantSort.key = key;
            this._currentStagnantSort.dir = 'desc';
        }
        const content = await this.renderStagnantReport(this.selectedStagnantDays || 14);
        const container = document.getElementById('reportContent');
        if (container) container.innerHTML = content;
    },

    async handleStagnantDaysChange(days) {
        const content = await this.renderStagnantReport(days);
        const container = document.getElementById('reportContent');
        if (container) container.innerHTML = content;
    },

    filterStagnantTable(query) {
        const term = (query || '').toLowerCase().trim();
        const rows = document.querySelectorAll('#reportStagnantTable tbody tr');
        rows.forEach(row => {
            const text = row.innerText.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
        });
    },

    exportStagnantToCSV() {
        const products = this._lastStagnantReportData || [];
        const days = this.selectedStagnantDays || 14;
        if (products.length === 0) {
            showNotification('No hay productos estancados para exportar', 'warning');
            return;
        }

        const headers = ['Producto', 'Código', 'Categoría', 'Última Venta', 'Días Inactivo', 'Stock Actual', 'Costo ($)', 'Precio ($)', 'Remate Mínimo ($)', 'Capital Atrapado ($)', 'Acción'];
        const rows = products.map(p => [
            `"${(p.name || '').replace(/"/g, '""')}"`,
            `"${p.barcode || ''}"`,
            `"${p.category || 'General'}"`,
            `"${p.lastSoldAt ? new Date(p.lastSoldAt).toLocaleDateString('es-CL') : 'Nunca'}"`,
            p.daysInactive || 0,
            p.stock || 0,
            p.cost || 0,
            p.price || 0,
            p.minClearancePrice || 0,
            p.costValue || 0,
            `"${p.suggestedAction || ''}"`
        ]);

        const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `reporte_productos_estancados_${days}dias_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification('📊 Reporte de Productos Estancados descargado en Excel (CSV)', 'success');
    },

    getCostAlertThreshold() {
        const val = localStorage.getItem('COST_ALERT_MARGIN_THRESHOLD');
        return val ? parseInt(val) : 5;
    },

    setCostAlertThreshold(val) {
        const threshold = Math.max(1, parseInt(val) || 5);
        localStorage.setItem('COST_ALERT_MARGIN_THRESHOLD', threshold);
        showNotification(`⚙️ Umbral de alerta de margen ajustado al ${threshold}%`, 'info');
        this.handleCostAlertsFilterChange(this._costAlertActiveTab || 'critical');
    },

    async handleCostAlertsFilterChange(tab) {
        this._costAlertActiveTab = tab;
        const content = await this.renderCostAlertsReport();
        const container = document.getElementById('reportContent');
        if (container) container.innerHTML = content;
    },

    async renderCostAlertsReport() {
        const allAlerts = await ReportController.getCostAlerts() || [];
        this._lastCostAlertsData = allAlerts;

        const threshold = this.getCostAlertThreshold();
        const activeTab = this._costAlertActiveTab || 'critical';

        // Filtrar según la pestaña activa
        let filteredAlerts = allAlerts;
        if (activeTab === 'critical') {
            filteredAlerts = allAlerts.filter(a => a.marginDiff <= -threshold);
        } else if (activeTab === 'reduced') {
            filteredAlerts = allAlerts.filter(a => a.isMarginReduced);
        }

        const totalAlerts = allAlerts.length;
        const criticalAlerts = allAlerts.filter(a => a.marginDiff <= -threshold);
        const criticalCount = criticalAlerts.length;
        const totalStockLoss = criticalAlerts.reduce((sum, a) => sum + (a.stockImpact || 0), 0);
        const usersInvolved = Array.from(new Set(allAlerts.map(a => a.username || 'Sistema'))).length;

        return `
            <!-- CABECERA Y ACCIONES -->
            <div class="flex-between-wrap" style="margin-bottom: 1.25rem; gap: 1rem; align-items: center;">
                <div>
                    <h3 style="margin: 0; font-size: 1.4rem; color: var(--text-main); display: flex; align-items: center; gap: 0.75rem;">
                        ⚠️ Alertas de Auditoría: Cambios de Costo y Margen
                    </h3>
                    <p style="margin: 0.25rem 0 0 0; color: var(--secondary); font-size: 0.85rem;">
                        Monitoreo de modificaciones manuales de costos que comprometen tus márgenes de ganancia
                    </p>
                </div>

                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                    <!-- Configuración de Umbral -->
                    <div style="display: flex; gap: 0.35rem; align-items: center; background: var(--surface-content); padding: 0.35rem 0.75rem; border-radius: 0.75rem; border: 1px solid var(--border);">
                        <span style="font-size: 0.8rem; color: var(--secondary); font-weight: 700;">⚙️ Alertar si margen cae ≥</span>
                        <select class="form-control" style="width: auto; padding: 0.2rem 0.5rem; border-radius: 0.5rem; font-weight: 800; font-size: 0.82rem;" onchange="ReportsView.setCostAlertThreshold(this.value)">
                            <option value="3" ${threshold === 3 ? 'selected' : ''}>3%</option>
                            <option value="5" ${threshold === 5 ? 'selected' : ''}>5% (Recomendado)</option>
                            <option value="10" ${threshold === 10 ? 'selected' : ''}>10%</option>
                            <option value="15" ${threshold === 15 ? 'selected' : ''}>15%</option>
                            <option value="20" ${threshold === 20 ? 'selected' : ''}>20%</option>
                        </select>
                    </div>

                    <input type="text" placeholder="🔍 Buscar por usuario o producto..." 
                           onkeyup="ReportsView.filterCostAlertsTable(this.value)" class="form-control" 
                           style="width: 220px; padding: 0.4rem 0.75rem; border-radius: 0.75rem;">

                    <button class="btn btn-success" onclick="ReportsView.exportCostAlertsToCSV()" style="font-weight: 700;">
                        📊 Exportar Excel
                    </button>
                </div>
            </div>

            <!-- TARJETAS DE AUDITORÍA Y CONTROL -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem;">
                <div style="padding: 0.85rem 1rem; background: ${criticalCount > 0 ? 'rgba(239, 68, 68, 0.08)' : 'var(--surface-content)'}; border: 1.5px solid ${criticalCount > 0 ? 'rgba(239, 68, 68, 0.3)' : 'var(--border)'}; border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: ${criticalCount > 0 ? '#dc2626' : 'var(--secondary)'}; font-weight: 800; text-transform: uppercase;">🚨 Márgenes Comprometidos</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: ${criticalCount > 0 ? '#dc2626' : 'var(--text-main)'}; margin: 0.2rem 0;">${criticalCount} productos</div>
                    <small style="font-size: 0.72rem; color: ${criticalCount > 0 ? '#dc2626' : 'var(--secondary)'};">Caída de margen ≥ ${threshold}%</small>
                </div>

                <div style="padding: 0.85rem 1rem; background: rgba(245, 158, 11, 0.08); border: 1.5px solid rgba(245, 158, 11, 0.3); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: #d97706; font-weight: 800; text-transform: uppercase;">💸 Riesgo de Pérdida en Stock</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: #d97706; margin: 0.2rem 0;">${formatCLP(totalStockLoss)}</div>
                    <small style="font-size: 0.72rem; color: #d97706;">Si no se ajusta el precio de venta</small>
                </div>

                <div style="padding: 0.85rem 1rem; background: var(--surface-content); border: 1px solid var(--border); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: var(--secondary); font-weight: 800; text-transform: uppercase;">Total Modificaciones Reales</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: var(--text-main); margin: 0.2rem 0;">${totalAlerts} cambios</div>
                    <small style="font-size: 0.72rem; color: var(--secondary);">Sin cambios falsos ($0)</small>
                </div>

                <div style="padding: 0.85rem 1rem; background: rgba(59, 130, 246, 0.08); border: 1.5px solid rgba(59, 130, 246, 0.3); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: #2563eb; font-weight: 800; text-transform: uppercase;">Operadores Auditados</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: #2563eb; margin: 0.2rem 0;">${usersInvolved} usuario(s)</div>
                    <small style="font-size: 0.72rem; color: #2563eb;">Responsables detectados</small>
                </div>
            </div>

            <!-- PESTAÑAS INTERACTIVAS DE FILTRO -->
            <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; flex-wrap: wrap;">
                <button class="btn btn-sm ${activeTab === 'critical' ? 'btn-danger' : 'btn-ghost'}" 
                        onclick="ReportsView.handleCostAlertsFilterChange('critical')" style="font-weight: 800;">
                    🚨 Margen en Peligro (≥ ${threshold}%) (${criticalCount})
                </button>
                <button class="btn btn-sm ${activeTab === 'reduced' ? 'btn-warning' : 'btn-ghost'}" 
                        onclick="ReportsView.handleCostAlertsFilterChange('reduced')" style="font-weight: 700;">
                    🔻 Todas las Caídas de Margen (${allAlerts.filter(a => a.isMarginReduced).length})
                </button>
                <button class="btn btn-sm ${activeTab === 'all' ? 'btn-primary' : 'btn-ghost'}" 
                        onclick="ReportsView.handleCostAlertsFilterChange('all')" style="font-weight: 700;">
                    📋 Historial Completo (${totalAlerts})
                </button>
            </div>

            <!-- TABLA DE AUDITORÍA -->
            <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem;">
                <div class="table-container">
                    <table id="reportCostAlertsTable" style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--border); font-size: 0.8rem; color: var(--secondary); text-transform: uppercase;">
                                <th style="padding: 0.75rem; text-align: left;">Fecha y Hora</th>
                                <th style="padding: 0.75rem; text-align: left;">Responsable</th>
                                <th style="padding: 0.75rem; text-align: left;">Producto Afectado</th>
                                <th style="padding: 0.75rem; text-align: right;">Costo Modificado</th>
                                <th style="padding: 0.75rem; text-align: center;">Impacto en Margen</th>
                                <th style="padding: 0.75rem; text-align: right; color: #059669;">Precio Venta Sugerido</th>
                                <th style="padding: 0.75rem; text-align: right;">Riesgo en Stock</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredAlerts.length === 0 ? `
                                <tr><td colspan="7" style="text-align:center; padding: 3rem; color: #10b981; font-weight:700;">
                                    <div style="font-size: 2rem; margin-bottom: 0.5rem;">✅</div>
                                    ¡Excelente! No hay alertas de costos en esta sección.
                                </td></tr>
                            ` : filteredAlerts.map(a => {
                                const isCritical = a.marginDiff <= -threshold;
                                const costDiffSign = a.costDiffAmount > 0 ? '+' : '';
                                const marginDiffSign = a.marginDiff > 0 ? '+' : '';

                                return `
                                    <tr style="border-bottom: 1px solid var(--border); ${isCritical ? 'background: rgba(239, 68, 68, 0.03);' : ''}">
                                        <td style="padding: 0.75rem; font-size: 0.82rem; color: var(--secondary); white-space: nowrap;">
                                            ${formatDateTime(a.date)}
                                        </td>
                                        <td style="padding: 0.75rem;">
                                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                                <div style="width: 24px; height: 24px; border-radius: 50%; background: var(--primary); color:#fff; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.7rem;">
                                                    ${(a.username || 'U').charAt(0).toUpperCase()}
                                                </div>
                                                <span style="font-weight: 700; color: var(--text-main); font-size: 0.85rem;">${safeHTML(a.username || 'Sistema')}</span>
                                            </div>
                                        </td>
                                        <td style="padding: 0.75rem;">
                                            <div style="font-weight: 800; color: var(--text-main); font-size: 0.88rem;">${safeHTML(a.productName)}</div>
                                            ${a.barcode ? `<small style="color: var(--secondary); font-size: 0.72rem;">Código: ${safeHTML(a.barcode)}</small>` : ''}
                                        </td>
                                        <td style="padding: 0.75rem; text-align: right;">
                                            <div style="font-weight: 800; color: #d97706;">
                                                ${formatCLP(a.oldCost)} ➔ ${formatCLP(a.newCost)}
                                            </div>
                                            <small style="font-size: 0.72rem; color: ${a.costDiffAmount > 0 ? '#dc2626' : '#059669'}; font-weight: 700;">
                                                ${costDiffSign}${formatCLP(a.costDiffAmount)} (${costDiffSign}${a.costDiffPerc}%)
                                            </small>
                                        </td>
                                        <td style="padding: 0.75rem; text-align: center;">
                                            <div style="font-weight: 800; font-size: 0.85rem; color: var(--text-main);">
                                                ${a.oldMargin}% ➔ ${a.newMargin}%
                                            </div>
                                            <span class="badge ${isCritical ? 'badge-danger' : (a.marginDiff < 0 ? 'badge-warning' : 'badge-success')}" style="font-size: 0.72rem; font-weight: 800; margin-top: 0.15rem;">
                                                ${marginDiffSign}${a.marginDiff}% Margen
                                            </span>
                                        </td>
                                        <td style="padding: 0.75rem; text-align: right;">
                                            <div style="font-weight: 900; color: #059669; font-size: 0.9rem;">
                                                ${formatCLP(a.suggestedNewPrice)}
                                            </div>
                                            <small style="color: var(--secondary); font-size: 0.72rem;">Actual: ${formatCLP(a.price)}</small>
                                        </td>
                                        <td style="padding: 0.75rem; text-align: right;">
                                            ${a.stockImpact > 0 ? `
                                                <div style="font-weight: 900; color: #dc2626; font-size: 0.9rem;">
                                                    -${formatCLP(a.stockImpact)}
                                                </div>
                                                <small style="color: var(--secondary); font-size: 0.72rem;">en ${a.stock} un. stock</small>
                                            ` : `
                                                <span style="color: var(--secondary); font-size: 0.82rem;">-</span>
                                            `}
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

    filterCostAlertsTable(query) {
        const term = (query || '').toLowerCase().trim();
        const rows = document.querySelectorAll('#reportCostAlertsTable tbody tr');
        rows.forEach(row => {
            const text = row.innerText.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
        });
    },

    exportCostAlertsToCSV() {
        const alerts = this._lastCostAlertsData || [];
        if (alerts.length === 0) {
            showNotification('No hay alertas de costo para exportar', 'warning');
            return;
        }

        const headers = ['Fecha y Hora', 'Usuario', 'Producto', 'Código', 'Costo Antiguo ($)', 'Costo Nuevo ($)', 'Variación Costo ($)', 'Margen Antiguo (%)', 'Margen Nuevo (%)', 'Impacto Margen (%)', 'Precio Actual ($)', 'Precio Sugerido ($)', 'Stock Actual', 'Riesgo en Stock ($)'];
        const rows = alerts.map(a => [
            `"${formatDateTime(a.date)}"`,
            `"${(a.username || 'Sistema').replace(/"/g, '""')}"`,
            `"${(a.productName || '').replace(/"/g, '""')}"`,
            `"${a.barcode || ''}"`,
            a.oldCost || 0,
            a.newCost || 0,
            a.costDiffAmount || 0,
            a.oldMargin || 0,
            a.newMargin || 0,
            a.marginDiff || 0,
            a.price || 0,
            a.suggestedNewPrice || 0,
            a.stock || 0,
            a.stockImpact || 0
        ]);

        const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `reporte_alertas_costos_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification('📊 Alertas de Costo descargadas en Excel (CSV)', 'success');
    },

    async handleDecisionMatrixTabChange(tab) {
        this._decisionMatrixActiveTab = tab;
        const content = await this.renderDecisionMatrix();
        const container = document.getElementById('reportContent');
        if (container) container.innerHTML = content;
    },

    async sortDecisionMatrixTable(key) {
        if (!this._currentDecisionMatrixSort) this._currentDecisionMatrixSort = { key: 'dailyProfit', dir: 'desc' };
        if (this._currentDecisionMatrixSort.key === key) {
            this._currentDecisionMatrixSort.dir = this._currentDecisionMatrixSort.dir === 'desc' ? 'asc' : 'desc';
        } else {
            this._currentDecisionMatrixSort.key = key;
            this._currentDecisionMatrixSort.dir = 'desc';
        }
        const content = await this.renderDecisionMatrix();
        const container = document.getElementById('reportContent');
        if (container) container.innerHTML = content;
    },

    _sortDecisionMatrixList(list, key, dir) {
        list.sort((a, b) => {
            let valA = a[key];
            let valB = b[key];
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            if (valA === null || valA === undefined) valA = -999999;
            if (valB === null || valB === undefined) valB = -999999;
            if (valA < valB) return dir === 'asc' ? -1 : 1;
            if (valA > valB) return dir === 'asc' ? 1 : -1;
            return 0;
        });
    },

    async renderDecisionMatrix() {
        try {
            const token = localStorage.getItem('AUTH_TOKEN') || localStorage.getItem('token');
            const res = await fetch('/api/analytics/decision-matrix', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Error al cargar la matriz');
            const rawData = await res.json() || [];

            // Enriquecer datos con acciones tácticas
            const enrichedData = rawData.map(p => {
                let suggestedAction = '';
                if (p.matrixCategory === 'estrella') {
                    suggestedAction = '⭐ Prioridad 1: Mantener siempre stock y frente de tienda';
                } else if (p.matrixCategory === 'caballo') {
                    suggestedAction = '🐎 Motor de flujo: Subir $50-$100 o negociar costo';
                } else if (p.matrixCategory === 'lento_rentable') {
                    suggestedAction = '🐢 Joya oculta: Exhibir en cabecera o armar combo';
                } else {
                    suggestedAction = '💀 Liquidar: Rematar al costo y descatalogar';
                }

                return {
                    ...p,
                    suggestedAction: suggestedAction
                };
            });

            this._lastDecisionMatrixData = enrichedData;

            const totalEstrella = enrichedData.filter(p => p.matrixCategory === 'estrella').length;
            const totalCaballo = enrichedData.filter(p => p.matrixCategory === 'caballo').length;
            const totalLento = enrichedData.filter(p => p.matrixCategory === 'lento_rentable').length;
            const totalPesoMuerto = enrichedData.filter(p => p.matrixCategory === 'peso_muerto' || (!['estrella','caballo','lento_rentable'].includes(p.matrixCategory))).length;
            const totalDailyProfit = enrichedData.reduce((sum, p) => sum + (parseFloat(p.dailyProfit) || 0), 0);

            const activeTab = this._decisionMatrixActiveTab || 'all';
            let filteredData = enrichedData;
            if (activeTab === 'estrella') filteredData = enrichedData.filter(p => p.matrixCategory === 'estrella');
            else if (activeTab === 'caballo') filteredData = enrichedData.filter(p => p.matrixCategory === 'caballo');
            else if (activeTab === 'lento_rentable') filteredData = enrichedData.filter(p => p.matrixCategory === 'lento_rentable');
            else if (activeTab === 'peso_muerto') filteredData = enrichedData.filter(p => p.matrixCategory === 'peso_muerto' || (!['estrella','caballo','lento_rentable'].includes(p.matrixCategory)));

            // Ordenamiento
            this._currentDecisionMatrixSort = this._currentDecisionMatrixSort || { key: 'dailyProfit', dir: 'desc' };
            this._sortDecisionMatrixList(filteredData, this._currentDecisionMatrixSort.key, this._currentDecisionMatrixSort.dir);

            return `
                <!-- CABECERA Y ACCIONES -->
                <div class="flex-between-wrap" style="margin-bottom: 1.25rem; gap: 1rem; align-items: center;">
                    <div>
                        <h3 style="margin: 0; font-size: 1.4rem; color: var(--text-main); display: flex; align-items: center; gap: 0.75rem;">
                            📊 Matriz de Decisión Comercial (Estrategia de Ventas)
                        </h3>
                        <p style="margin: 0.25rem 0 0 0; color: var(--secondary); font-size: 0.85rem;">
                            Clasificación estratégica por velocidad de rotación, margen unitario y aporte diario a la caja
                        </p>
                    </div>

                    <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                        <input type="text" placeholder="🔍 Buscar producto o categoría..." 
                               onkeyup="ReportsView.filterDecisionMatrixTable(this.value)" class="form-control" 
                               style="width: 220px; padding: 0.4rem 0.75rem; border-radius: 0.75rem;">

                        <button class="btn btn-success" onclick="ReportsView.exportDecisionMatrixToCSV()" style="font-weight: 700;">
                            📊 Exportar Excel
                        </button>
                    </div>
                </div>

                <!-- TARJETAS DE CUADRANTES ESTRATÉGICOS -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem;">
                    <div style="padding: 0.85rem 1rem; background: rgba(16, 185, 129, 0.08); border: 1.5px solid rgba(16, 185, 129, 0.3); border-radius: 0.75rem; text-align: center;">
                        <div style="font-size: 0.72rem; color: #059669; font-weight: 800; text-transform: uppercase;">⭐ Estrellas</div>
                        <div style="font-size: 1.35rem; font-weight: 900; color: #059669; margin: 0.2rem 0;">${totalEstrella} productos</div>
                        <small style="font-size: 0.72rem; color: #059669;">Alta rotación y alta ganancia</small>
                    </div>

                    <div style="padding: 0.85rem 1rem; background: rgba(59, 130, 246, 0.08); border: 1.5px solid rgba(59, 130, 246, 0.3); border-radius: 0.75rem; text-align: center;">
                        <div style="font-size: 0.72rem; color: #2563eb; font-weight: 800; text-transform: uppercase;">🐎 Caballos de Batalla</div>
                        <div style="font-size: 1.35rem; font-weight: 900; color: #2563eb; margin: 0.2rem 0;">${totalCaballo} productos</div>
                        <small style="font-size: 0.72rem; color: #2563eb;">Alta venta / bajo margen</small>
                    </div>

                    <div style="padding: 0.85rem 1rem; background: rgba(245, 158, 11, 0.08); border: 1.5px solid rgba(245, 158, 11, 0.3); border-radius: 0.75rem; text-align: center;">
                        <div style="font-size: 0.72rem; color: #d97706; font-weight: 800; text-transform: uppercase;">🐢 Lentos Rentables</div>
                        <div style="font-size: 1.35rem; font-weight: 900; color: #d97706; margin: 0.2rem 0;">${totalLento} productos</div>
                        <small style="font-size: 0.72rem; color: #d97706;">Baja venta / alto margen</small>
                    </div>

                    <div style="padding: 0.85rem 1rem; background: rgba(239, 68, 68, 0.08); border: 1.5px solid rgba(239, 68, 68, 0.3); border-radius: 0.75rem; text-align: center;">
                        <div style="font-size: 0.72rem; color: #dc2626; font-weight: 800; text-transform: uppercase;">💀 Pesos Muertos</div>
                        <div style="font-size: 1.35rem; font-weight: 900; color: #dc2626; margin: 0.2rem 0;">${totalPesoMuerto} productos</div>
                        <small style="font-size: 0.72rem; color: #dc2626;">Baja venta / baja ganancia</small>
                    </div>

                    <div style="padding: 0.85rem 1rem; background: rgba(139, 92, 246, 0.08); border: 1.5px solid rgba(139, 92, 246, 0.3); border-radius: 0.75rem; text-align: center;">
                        <div style="font-size: 0.72rem; color: #7c3aed; font-weight: 800; text-transform: uppercase;">💎 Ganancia Total Diaria</div>
                        <div style="font-size: 1.35rem; font-weight: 900; color: #7c3aed; margin: 0.2rem 0;">${formatCLP(totalDailyProfit)}</div>
                        <small style="font-size: 0.72rem; color: #7c3aed;">Aporte diario al negocio</small>
                    </div>
                </div>

                <!-- PESTAÑAS DE FILTRO INTERACTIVO -->
                <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; flex-wrap: wrap;">
                    <button class="btn btn-sm ${activeTab === 'all' ? 'btn-primary' : 'btn-ghost'}" 
                            onclick="ReportsView.handleDecisionMatrixTabChange('all')" style="font-weight: 700;">
                        🌟 Todos (${enrichedData.length})
                    </button>
                    <button class="btn btn-sm ${activeTab === 'estrella' ? 'btn-success' : 'btn-ghost'}" 
                            onclick="ReportsView.handleDecisionMatrixTabChange('estrella')" style="font-weight: 800;">
                        ⭐ Estrellas (${totalEstrella})
                    </button>
                    <button class="btn btn-sm ${activeTab === 'caballo' ? 'btn-info' : 'btn-ghost'}" 
                            onclick="ReportsView.handleDecisionMatrixTabChange('caballo')" style="font-weight: 700;">
                        🐎 Caballos de Batalla (${totalCaballo})
                    </button>
                    <button class="btn btn-sm ${activeTab === 'lento_rentable' ? 'btn-warning' : 'btn-ghost'}" 
                            onclick="ReportsView.handleDecisionMatrixTabChange('lento_rentable')" style="font-weight: 700;">
                        🐢 Lentos Rentables (${totalLento})
                    </button>
                    <button class="btn btn-sm ${activeTab === 'peso_muerto' ? 'btn-danger' : 'btn-ghost'}" 
                            onclick="ReportsView.handleDecisionMatrixTabChange('peso_muerto')" style="font-weight: 700;">
                        💀 Pesos Muertos (${totalPesoMuerto})
                    </button>
                </div>

                <!-- TABLA DE MATRIZ DE DECISIÓN -->
                <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; flex-wrap: wrap; gap: 0.5rem;">
                        <span style="font-size: 0.85rem; color: var(--secondary); font-weight: 600;">
                            💡 Haz clic en los encabezados para ordenar por Ganancia Diaria, Velocidad o Margen.
                        </span>
                    </div>
                    <div class="table-container">
                        <table id="reportDecisionMatrixTable" style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="border-bottom: 2px solid var(--border); font-size: 0.8rem; color: var(--secondary); text-transform: uppercase;">
                                    <th style="padding: 0.75rem; text-align: left; cursor: pointer;" onclick="ReportsView.sortDecisionMatrixTable('name')">
                                        Producto ↕
                                    </th>
                                    <th style="padding: 0.75rem; text-align: center;">Cuadrante</th>
                                    <th style="padding: 0.75rem; text-align: right; cursor: pointer;" onclick="ReportsView.sortDecisionMatrixTable('velocity')">
                                        Velocidad (un/día) ↕
                                    </th>
                                    <th style="padding: 0.75rem; text-align: right; color: #10b981; cursor: pointer;" onclick="ReportsView.sortDecisionMatrixTable('marginUnit')">
                                        Margen Unitario ↕
                                    </th>
                                    <th style="padding: 0.75rem; text-align: right; color: #7c3aed; cursor: pointer;" onclick="ReportsView.sortDecisionMatrixTable('dailyProfit')">
                                        Aporte Diario a Caja ↕
                                    </th>
                                    <th style="padding: 0.75rem; text-align: center;">Stock / Reposición</th>
                                    <th style="padding: 0.75rem; text-align: left;">Acción Estratégica Recomendada</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filteredData.map(p => {
                                    let badge = '';
                                    if (p.matrixCategory === 'estrella') badge = '<span class="badge badge-success" style="font-weight: 800;">⭐ Estrella</span>';
                                    else if (p.matrixCategory === 'caballo') badge = '<span class="badge badge-info" style="font-weight: 800;">🐎 Caballo</span>';
                                    else if (p.matrixCategory === 'lento_rentable') badge = '<span class="badge badge-warning" style="font-weight: 800;">🐢 Lento Rentable</span>';
                                    else badge = '<span class="badge badge-danger" style="font-weight: 800;">💀 Peso Muerto</span>';

                                    return `
                                        <tr style="border-bottom: 1px solid var(--border);">
                                            <td style="padding: 0.75rem;">
                                                <div style="font-weight: 800; color: var(--text-main); font-size: 0.88rem;">${safeHTML(p.name)}</div>
                                                <small style="color: var(--secondary); font-size: 0.72rem;">${safeHTML(p.category || 'General')}</small>
                                            </td>
                                            <td style="padding: 0.75rem; text-align: center;">${badge}</td>
                                            <td style="padding: 0.75rem; text-align: right; font-weight: 800; font-size: 0.85rem;">
                                                ${p.velocity} un/día
                                            </td>
                                            <td style="padding: 0.75rem; text-align: right; font-weight: 900; color: #10b981; font-size: 0.9rem;">
                                                ${formatCLP(p.marginUnit)}
                                            </td>
                                            <td style="padding: 0.75rem; text-align: right; font-weight: 900; color: #7c3aed; font-size: 0.95rem;">
                                                ${formatCLP(p.dailyProfit)}/día
                                            </td>
                                            <td style="padding: 0.75rem; text-align: center; font-size: 0.82rem;">
                                                <span style="font-weight: 800; color: ${p.stock <= p.reorderPoint ? '#dc2626' : 'var(--text-main)'};">
                                                    ${p.stock} un.
                                                </span>
                                                <div style="font-size: 0.68rem; color: var(--secondary);">Reponer a: ${p.reorderPoint} un.</div>
                                            </td>
                                            <td style="padding: 0.75rem; font-size: 0.8rem; color: var(--text-main); font-weight: 600;">
                                                ${p.suggestedAction}
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                                ${filteredData.length === 0 ? '<tr><td colspan="7" style="text-align:center; padding: 2.5rem; color: var(--secondary); font-weight: 700;">No se encontraron productos en este cuadrante.</td></tr>' : ''}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } catch (e) {
            console.error('Error al renderizar matriz de decisión:', e);
            return '<div class="card glass-panel" style="padding: 2rem; text-align: center; color: #ef4444; font-weight: 700;">No se pudo cargar la Matriz de Decisión.</div>';
        }
    },

    filterDecisionMatrixTable(query) {
        const term = (query || '').toLowerCase().trim();
        const rows = document.querySelectorAll('#reportDecisionMatrixTable tbody tr');
        rows.forEach(row => {
            const text = row.innerText.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
        });
    },

    exportDecisionMatrixToCSV() {
        const data = this._lastDecisionMatrixData || [];
        if (data.length === 0) {
            showNotification('No hay datos en la matriz para exportar', 'warning');
            return;
        }

        const headers = ['Producto', 'Categoría', 'Stock Actual', 'Cuadrante Matriz', 'Velocidad (un/día)', 'Margen Unitario ($)', 'Aporte Diario ($/día)', 'Punto Reposición (un)', 'Acción Recomendada'];
        const rows = data.map(p => [
            `"${(p.name || '').replace(/"/g, '""')}"`,
            `"${(p.category || 'General').replace(/"/g, '""')}"`,
            p.stock || 0,
            `"${p.matrixCategory || 'general'}"`,
            p.velocity || 0,
            p.marginUnit || 0,
            p.dailyProfit || 0,
            p.reorderPoint || 0,
            `"${(p.suggestedAction || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `matriz_decision_estrategica_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification('📊 Matriz de Decisión descargada en Excel (CSV)', 'success');
    },

    async handleCierresFilterChange(filterType, period = null) {
        if (filterType !== undefined && filterType !== null) this.selectedCierresFilter = filterType;
        if (period !== undefined && period !== null) this.selectedCierresPeriod = period;
        const content = await this.renderCierresReport(this.selectedCierresFilter || 'all', this.selectedCierresPeriod || 'thisMonth');
        const container = document.getElementById('reportContent');
        if (container) container.innerHTML = content;
    },

    async renderCierresReport(filterType = 'all', period = 'thisMonth') {
        let allRegisters = [];
        try {
            allRegisters = await CashRegister.getAll() || [];
        } catch (e) {
            console.warn('Error al cargar cajas:', e);
        }
        this._lastCierresReportData = allRegisters;
        this.selectedCierresFilter = filterType;
        this.selectedCierresPeriod = period;

        // Filtrado por Período
        const now = new Date();
        let dateFiltered = allRegisters;
        if (period === 'thisMonth') {
            const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            dateFiltered = allRegisters.filter(r => new Date(r.openDate || r.createdAt) >= startMonth);
        } else if (period === 'lastMonth') {
            const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const endLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
            dateFiltered = allRegisters.filter(r => {
                const d = new Date(r.openDate || r.createdAt);
                return d >= startLastMonth && d <= endLastMonth;
            });
        }

        const totalCierres = dateFiltered.length;
        const closedRegisters = dateFiltered.filter(r => r.status === 'closed');
        const closedCount = closedRegisters.length;
        const discrepancyRegisters = closedRegisters.filter(r => (r.difference || 0) !== 0);
        const discrepancyCount = discrepancyRegisters.length;
        const cleanCount = closedCount - discrepancyCount;

        const totalMissingMoney = Math.abs(closedRegisters.filter(r => (r.difference || 0) < 0).reduce((sum, r) => sum + (r.difference || 0), 0));
        const totalSurplusMoney = closedRegisters.filter(r => (r.difference || 0) > 0).reduce((sum, r) => sum + (r.difference || 0), 0);
        const totalCollectedSales = dateFiltered.reduce((sum, r) => {
            const ps = r.paymentSummary || {};
            return sum + ((parseFloat(ps.cash) || 0) + (parseFloat(ps.card) || 0) + (parseFloat(ps.qr) || 0) + (parseFloat(ps.other) || 0));
        }, 0);

        let filtered = dateFiltered;
        if (filterType === 'discrepancy') {
            filtered = dateFiltered.filter(r => r.status === 'closed' && (r.difference || 0) !== 0);
        } else if (filterType === 'clean') {
            filtered = dateFiltered.filter(r => r.status === 'closed' && (r.difference || 0) === 0);
        }

        // Ordenar más recientes primero
        filtered.sort((a, b) => new Date(b.openDate || b.createdAt) - new Date(a.openDate || a.createdAt));

        return `
            <!-- CABECERA Y ACCIONES -->
            <div class="flex-between-wrap" style="margin-bottom: 1.25rem; gap: 1rem; align-items: center;">
                <div>
                    <h3 style="margin: 0; font-size: 1.4rem; color: var(--text-main); display: flex; align-items: center; gap: 0.75rem;">
                        🔒 Historial de Cierres de Caja (Cierres Z y Arqueos)
                    </h3>
                    <p style="margin: 0.25rem 0 0 0; color: var(--secondary); font-size: 0.85rem;">
                        Auditoría de aperturas, cierres de turno, dinero en efectivo, ventas por medio de pago y descuadres
                    </p>
                </div>

                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                    <!-- Selector de Período -->
                    <div style="display: flex; gap: 0.25rem; background: var(--surface-content); padding: 0.25rem; border-radius: 0.75rem; border: 1px solid var(--border);">
                        <button class="btn btn-sm ${period === 'thisMonth' ? 'btn-primary' : 'btn-ghost'}" 
                                onclick="ReportsView.handleCierresFilterChange(null, 'thisMonth')">Este Mes</button>
                        <button class="btn btn-sm ${period === 'lastMonth' ? 'btn-primary' : 'btn-ghost'}" 
                                onclick="ReportsView.handleCierresFilterChange(null, 'lastMonth')">Mes Anterior</button>
                        <button class="btn btn-sm ${period === 'all' ? 'btn-primary' : 'btn-ghost'}" 
                                onclick="ReportsView.handleCierresFilterChange(null, 'all')">Histórico Completo</button>
                    </div>

                    <input type="text" placeholder="🔍 Buscar por cajero..." 
                           onkeyup="ReportsView.filterCierresTable(this.value)" class="form-control" 
                           style="width: 180px; padding: 0.4rem 0.75rem; border-radius: 0.75rem;">

                    <button class="btn btn-success" onclick="ReportsView.exportCierresToCSV()" style="font-weight: 700;">
                        📊 Exportar Excel
                    </button>
                </div>
            </div>

            <!-- TARJETAS FINANCIERAS DE AUDITORÍA DE CAJA -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem;">
                <div style="padding: 0.85rem 1rem; background: var(--surface-content); border: 1px solid var(--border); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: var(--secondary); font-weight: 800; text-transform: uppercase;">Total Cierres</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: var(--text-main); margin: 0.2rem 0;">${totalCierres} turnos</div>
                    <small style="font-size: 0.72rem; color: var(--secondary);">${closedCount} cerrados / ${totalCierres - closedCount} abiertos</small>
                </div>

                <div style="padding: 0.85rem 1rem; background: rgba(16, 185, 129, 0.08); border: 1.5px solid rgba(16, 185, 129, 0.3); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: #059669; font-weight: 800; text-transform: uppercase;">🟢 Cierres Cuadrados</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: #059669; margin: 0.2rem 0;">${cleanCount} turnos</div>
                    <small style="font-size: 0.72rem; color: #059669;">Sin descuadre ($0)</small>
                </div>

                <div style="padding: 0.85rem 1rem; background: ${totalMissingMoney > 0 ? 'rgba(239, 68, 68, 0.08)' : 'var(--surface-content)'}; border: 1.5px solid ${totalMissingMoney > 0 ? 'rgba(239, 68, 68, 0.3)' : 'var(--border)'}; border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: #dc2626; font-weight: 800; text-transform: uppercase;">🔴 Pérdida en Faltantes</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: #dc2626; margin: 0.2rem 0;">-${formatCLP(totalMissingMoney)}</div>
                    <small style="font-size: 0.72rem; color: #dc2626;">Dinero que faltó en caja</small>
                </div>

                <div style="padding: 0.85rem 1rem; background: rgba(245, 158, 11, 0.08); border: 1.5px solid rgba(245, 158, 11, 0.3); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: #d97706; font-weight: 800; text-transform: uppercase;">🟡 Sobrantes de Caja</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: #d97706; margin: 0.2rem 0;">+${formatCLP(totalSurplusMoney)}</div>
                    <small style="font-size: 0.72rem; color: #d97706;">Dinero sobrante detectado</small>
                </div>

                <div style="padding: 0.85rem 1rem; background: rgba(59, 130, 246, 0.08); border: 1.5px solid rgba(59, 130, 246, 0.3); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.72rem; color: #2563eb; font-weight: 800; text-transform: uppercase;">💳 Ventas Recaudadas</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: #2563eb; margin: 0.2rem 0;">${formatCLP(totalCollectedSales)}</div>
                    <small style="font-size: 0.72rem; color: #2563eb;">Efectivo + Tarjetas + QR</small>
                </div>
            </div>

            <!-- PESTAÑAS DE FILTRO INTERACTIVO -->
            <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; flex-wrap: wrap;">
                <button class="btn btn-sm ${filterType === 'all' ? 'btn-primary' : 'btn-ghost'}" 
                        onclick="ReportsView.handleCierresFilterChange('all')" style="font-weight: 700;">
                    📋 Todas las Cajas (${totalCierres})
                </button>
                <button class="btn btn-sm ${filterType === 'discrepancy' ? 'btn-danger' : 'btn-ghost'}" 
                        onclick="ReportsView.handleCierresFilterChange('discrepancy')" style="font-weight: 800;">
                    🔴 Solo Descuadres (${discrepancyCount})
                </button>
                <button class="btn btn-sm ${filterType === 'clean' ? 'btn-success' : 'btn-ghost'}" 
                        onclick="ReportsView.handleCierresFilterChange('clean')" style="font-weight: 700;">
                    🟢 Solo Cierres Cuadrados ($0) (${cleanCount})
                </button>
            </div>

            <!-- TABLA DE HISTORIAL DE CIERRES -->
            <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; flex-wrap: wrap; gap: 0.5rem;">
                    <span style="font-size: 0.85rem; color: var(--secondary); font-weight: 600;">
                        💡 Haz clic en el botón "Ver Detalle" de cualquier turno para auditar su comprobante Z completo.
                    </span>
                </div>
                <div class="table-container">
                    <table id="reportCierresTable" style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--border); font-size: 0.8rem; color: var(--secondary); text-transform: uppercase;">
                                <th style="padding: 0.75rem; text-align: left;">Apertura</th>
                                <th style="padding: 0.75rem; text-align: left;">Cierre</th>
                                <th style="padding: 0.75rem; text-align: left;">Cajero / Usuario</th>
                                <th style="padding: 0.75rem; text-align: right;">Fondo Inicial</th>
                                <th style="padding: 0.75rem; text-align: right; color: #2563eb;">Ventas del Turno</th>
                                <th style="padding: 0.75rem; text-align: right;">Efectivo Esperado</th>
                                <th style="padding: 0.75rem; text-align: right; font-weight: 900;">Efectivo Contado</th>
                                <th style="padding: 0.75rem; text-align: center;">Diferencia</th>
                                <th style="padding: 0.75rem; text-align: center;">Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtered.map(r => {
                                const diff = r.difference || 0;
                                const actualAmount = r.finalAmount !== undefined ? r.finalAmount : (r.actualAmount || 0);
                                const expectedAmount = r.expectedAmount || 0;
                                const initialAmount = r.initialAmount || 0;
                                const ps = r.paymentSummary || {};
                                const turnTotalSales = (parseFloat(ps.cash) || 0) + (parseFloat(ps.card) || 0) + (parseFloat(ps.qr) || 0) + (parseFloat(ps.other) || 0);

                                let diffBadge = '<span class="badge badge-success" style="font-weight: 800;">✅ Cuadrado ($0)</span>';
                                if (r.status === 'open') {
                                    diffBadge = '<span class="badge badge-info" style="font-weight: 800;">🟡 Turno Abierto</span>';
                                } else if (diff > 0) {
                                    diffBadge = `<span class="badge badge-warning" style="font-weight: 800;">+${formatCLP(diff)} Sobrante</span>`;
                                } else if (diff < 0) {
                                    diffBadge = `<span class="badge badge-danger" style="font-weight: 800;">-${formatCLP(Math.abs(diff))} Faltante</span>`;
                                }

                                return `
                                    <tr style="border-bottom: 1px solid var(--border);">
                                        <td style="padding: 0.75rem; font-size: 0.82rem; color: var(--secondary); white-space: nowrap;">
                                            ${formatDateTime(r.openDate || r.createdAt)}
                                        </td>
                                        <td style="padding: 0.75rem; font-size: 0.82rem; color: var(--secondary); white-space: nowrap;">
                                            ${r.closeDate ? formatDateTime(r.closeDate) : '<span style="color: #2563eb; font-weight: 800;">En curso...</span>'}
                                        </td>
                                        <td style="padding: 0.75rem;">
                                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                                <div style="width: 24px; height: 24px; border-radius: 50%; background: var(--primary); color:#fff; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.7rem;">
                                                    ${(r.userName || r.user || 'C').charAt(0).toUpperCase()}
                                                </div>
                                                <span style="font-weight: 800; color: var(--text-main); font-size: 0.85rem;">${safeHTML(r.userName || r.user || 'Cajero')}</span>
                                            </div>
                                        </td>
                                        <td style="padding: 0.75rem; text-align: right; color: var(--secondary); font-size: 0.85rem;">
                                            ${formatCLP(initialAmount)}
                                        </td>
                                        <td style="padding: 0.75rem; text-align: right; font-weight: 800; color: #2563eb; font-size: 0.88rem;">
                                            ${formatCLP(turnTotalSales)}
                                        </td>
                                        <td style="padding: 0.75rem; text-align: right; font-weight: 700; color: var(--secondary); font-size: 0.85rem;">
                                            ${formatCLP(expectedAmount)}
                                        </td>
                                        <td style="padding: 0.75rem; text-align: right; font-weight: 900; color: var(--text-main); font-size: 0.95rem;">
                                            ${formatCLP(actualAmount)}
                                        </td>
                                        <td style="padding: 0.75rem; text-align: center;">
                                            ${diffBadge}
                                        </td>
                                        <td style="padding: 0.75rem; text-align: center;">
                                            <button class="btn btn-sm btn-ghost" onclick="ReportsView.showCierreDetailModal(${r.id})" style="font-weight: 700; font-size: 0.78rem;">
                                                🔍 Ver Z
                                            </button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                            ${filtered.length === 0 ? '<tr><td colspan="9" style="text-align:center; padding: 2.5rem; color: var(--secondary); font-weight: 700;">No se encontraron registros de caja en este filtro.</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    async showCierreDetailModal(registerId) {
        const registers = this._lastCierresReportData || [];
        const r = registers.find(item => item.id == registerId);
        if (!r) {
            showNotification('No se encontró el detalle de la caja', 'error');
            return;
        }

        const ps = r.paymentSummary || {};
        const cashSales = parseFloat(ps.cash) || 0;
        const cardSales = parseFloat(ps.card) || 0;
        const qrSales = parseFloat(ps.qr) || 0;
        const otherSales = parseFloat(ps.other) || 0;
        const totalSales = cashSales + cardSales + qrSales + otherSales;

        const initialAmount = parseFloat(r.initialAmount) || 0;
        const expectedAmount = parseFloat(r.expectedAmount) || 0;
        const actualAmount = r.finalAmount !== undefined ? parseFloat(r.finalAmount) : (parseFloat(r.actualAmount) || 0);
        const diff = parseFloat(r.difference) || 0;

        let diffBanner = '';
        if (r.status === 'open') {
            diffBanner = `<div style="background: rgba(59, 130, 246, 0.1); border: 1.5px solid #2563eb; color: #2563eb; padding: 0.75rem; border-radius: 0.75rem; font-weight: 800; text-align: center;">🟡 ESTA CAJA SE ENCUENTRA ABIERTA Y EN CURSO</div>`;
        } else if (diff === 0) {
            diffBanner = `<div style="background: rgba(16, 185, 129, 0.1); border: 1.5px solid #059669; color: #059669; padding: 0.75rem; border-radius: 0.75rem; font-weight: 800; text-align: center;">✅ CIERRE PERFECTO: Dinero contado coincide exactamente con el sistema ($0)</div>`;
        } else if (diff < 0) {
            diffBanner = `<div style="background: rgba(239, 68, 68, 0.1); border: 1.5px solid #dc2626; color: #dc2626; padding: 0.75rem; border-radius: 0.75rem; font-weight: 800; text-align: center;">🔴 FALTANTE EN CAJA: Faltaron ${formatCLP(Math.abs(diff))} en el conteo de efectivo</div>`;
        } else {
            diffBanner = `<div style="background: rgba(245, 158, 11, 0.1); border: 1.5px solid #d97706; color: #d97706; padding: 0.75rem; border-radius: 0.75rem; font-weight: 800; text-align: center;">🟡 SOBRANTE EN CAJA: Sobraron +${formatCLP(diff)} en el conteo de efectivo</div>`;
        }

        const modalHtml = `
            <div style="display: flex; flex-direction: column; gap: 1rem; font-size: 0.88rem;">
                ${diffBanner}

                <!-- DATOS GENERALES -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; background: var(--surface-content); padding: 0.85rem; border-radius: 0.75rem; border: 1px solid var(--border);">
                    <div>
                        <span style="color: var(--secondary); font-size: 0.75rem; font-weight: 700; text-transform: uppercase;">Cajero Responsable:</span>
                        <div style="font-weight: 800; color: var(--text-main); font-size: 0.95rem;">${safeHTML(r.userName || r.user || 'Cajero')}</div>
                    </div>
                    <div>
                        <span style="color: var(--secondary); font-size: 0.75rem; font-weight: 700; text-transform: uppercase;">Estado del Turno:</span>
                        <div style="font-weight: 800; color: ${r.status === 'open' ? '#2563eb' : '#059669'};">${r.status === 'open' ? 'Abierto' : 'Cerrado'}</div>
                    </div>
                    <div>
                        <span style="color: var(--secondary); font-size: 0.75rem; font-weight: 700;">Apertura:</span>
                        <div style="font-weight: 700; color: var(--text-main); font-size: 0.82rem;">${formatDateTime(r.openDate || r.createdAt)}</div>
                    </div>
                    <div>
                        <span style="color: var(--secondary); font-size: 0.75rem; font-weight: 700;">Cierre:</span>
                        <div style="font-weight: 700; color: var(--text-main); font-size: 0.82rem;">${r.closeDate ? formatDateTime(r.closeDate) : 'En curso...'}</div>
                    </div>
                </div>

                <!-- DESGLOSE DE VENTAS POR MÉTODO DE PAGO -->
                <div style="background: var(--surface-content); padding: 0.85rem; border-radius: 0.75rem; border: 1px solid var(--border);">
                    <div style="font-weight: 800; color: var(--text-main); margin-bottom: 0.5rem; font-size: 0.88rem;">💳 Ventas Recaudadas en el Turno</div>
                    <div style="display: flex; justify-content: space-between; padding: 0.25rem 0; border-bottom: 1px solid var(--border);">
                        <span>💵 Efectivo:</span>
                        <strong>${formatCLP(cashSales)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 0.25rem 0; border-bottom: 1px solid var(--border);">
                        <span>💳 Tarjeta (Débito / Crédito):</span>
                        <strong>${formatCLP(cardSales)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 0.25rem 0; border-bottom: 1px solid var(--border);">
                        <span>📱 Transferencia / QR:</span>
                        <strong>${formatCLP(qrSales)}</strong>
                    </div>
                    ${otherSales > 0 ? `
                        <div style="display: flex; justify-content: space-between; padding: 0.25rem 0; border-bottom: 1px solid var(--border);">
                            <span>Otros Medios:</span>
                            <strong>${formatCLP(otherSales)}</strong>
                        </div>
                    ` : ''}
                    <div style="display: flex; justify-content: space-between; padding: 0.4rem 0 0 0; font-weight: 900; color: #2563eb; font-size: 0.95rem;">
                        <span>Total Ventas Turno:</span>
                        <span>${formatCLP(totalSales)}</span>
                    </div>
                </div>

                <!-- ARQUEO DE EFECTIVO -->
                <div style="background: var(--surface-content); padding: 0.85rem; border-radius: 0.75rem; border: 1px solid var(--border);">
                    <div style="font-weight: 800; color: var(--text-main); margin-bottom: 0.5rem; font-size: 0.88rem;">🧮 Conciliación y Arqueo de Efectivo</div>
                    <div style="display: flex; justify-content: space-between; padding: 0.25rem 0;">
                        <span>Fondo Inicial de Caja:</span>
                        <strong>+${formatCLP(initialAmount)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 0.25rem 0;">
                        <span>Ventas Cobradas en Efectivo:</span>
                        <strong>+${formatCLP(cashSales)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 0.35rem 0; border-top: 1px solid var(--border); font-weight: 800;">
                        <span>Efectivo Esperado en Gaveta:</span>
                        <span>${formatCLP(expectedAmount)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 0.35rem 0; font-weight: 900; color: #059669; font-size: 1rem;">
                        <span>Efectivo Real Contado por Cajero:</span>
                        <span>${formatCLP(actualAmount)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 0.4rem 0; border-top: 2px solid var(--border); font-weight: 900; font-size: 1.05rem; color: ${diff < 0 ? '#dc2626' : (diff > 0 ? '#d97706' : '#059669')};">
                        <span>Diferencia / Descuadre Final:</span>
                        <span>${diff < 0 ? '-' + formatCLP(Math.abs(diff)) : (diff > 0 ? '+' + formatCLP(diff) : '$0')}</span>
                    </div>
                </div>

                <div style="display: flex; justify-content: flex-end; margin-top: 0.5rem;">
                    <button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>
                </div>
            </div>
        `;

        showModal(modalHtml, {
            title: `🔒 Comprobante Cierre Z - Turno #${registerId}`,
            width: '550px'
        });
    },

    filterCierresTable(query) {
        const term = (query || '').toLowerCase().trim();
        const rows = document.querySelectorAll('#reportCierresTable tbody tr');
        rows.forEach(row => {
            const text = row.innerText.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
        });
    },

    exportCierresToCSV() {
        const registers = this._lastCierresReportData || [];
        if (registers.length === 0) {
            showNotification('No hay cierres para exportar', 'warning');
            return;
        }

        const headers = ['Apertura', 'Cierre', 'Cajero', 'Fondo Inicial ($)', 'Ventas Efectivo ($)', 'Ventas Tarjetas ($)', 'Ventas QR ($)', 'Efectivo Esperado ($)', 'Efectivo Contado ($)', 'Diferencia ($)', 'Estado'];
        const rows = registers.map(r => {
            const ps = r.paymentSummary || {};
            const actualAmount = r.finalAmount !== undefined ? r.finalAmount : (r.actualAmount || 0);
            return [
                `"${formatDateTime(r.openDate || r.createdAt)}"`,
                `"${r.closeDate ? formatDateTime(r.closeDate) : 'En curso'}"`,
                `"${(r.userName || r.user || 'Cajero').replace(/"/g, '""')}"`,
                r.initialAmount || 0,
                ps.cash || 0,
                ps.card || 0,
                ps.qr || 0,
                r.expectedAmount || 0,
                actualAmount,
                r.difference || 0,
                `"${r.status || 'closed'}"`
            ];
        });

        const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `reporte_historial_cierres_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification('📊 Historial de Cierres descargado en Excel (CSV)', 'success');
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

    handleDailyDateChange(dateStr) {
        if (!dateStr) return;
        this.selectedDailyDate = dateStr;
        this.showReport('daily');
    },

    navigateDailyDate(offsetDays) {
        const currentDateStr = this.selectedDailyDate || new Date().toISOString().slice(0, 10);
        const d = new Date(`${currentDateStr}T12:00:00`);
        d.setDate(d.getDate() + offsetDays);
        const newDateStr = d.toISOString().slice(0, 10);
        this.handleDailyDateChange(newDateStr);
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
