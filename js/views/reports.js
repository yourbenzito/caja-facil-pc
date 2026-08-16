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

        // 1. Comparativa vs Ayer
        const yesterdayDate = new Date(targetDate.getTime() - 86400000);
        let yesterdayReport = { totalAmount: 0 };
        try {
            yesterdayReport = await ReportController.getDailySales(yesterdayDate);
        } catch (_) { }
        const diffAmount = report.totalAmount - yesterdayReport.totalAmount;
        const percChange = yesterdayReport.totalAmount > 0 
            ? ((diffAmount / yesterdayReport.totalAmount) * 100).toFixed(1) 
            : (report.totalAmount > 0 ? '+100' : '0');
        const isGrowth = diffAmount >= 0;

        // 2. Abonos/Cobros de deudas recibidos hoy
        let paymentsReceivedToday = [];
        let totalDebtPaymentsToday = 0;
        try {
            paymentsReceivedToday = await Payment.getByDateRange(startOfDay, endOfDay) || [];
            totalDebtPaymentsToday = paymentsReceivedToday.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        } catch (_) { }

        // 3. Descuentos y Devoluciones/Anulaciones del Día
        let totalDiscountsToday = 0;
        let cancelledCount = 0;
        let cancelledAmount = 0;

        // 4. Ranking Top 5 Productos y Ventas por Categoría
        const productMap = new Map();
        const categoryMap = new Map();
        const paymentMethods = { cash: 0, card: 0, qr: 0, other: 0, pending: 0 };

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

            // Mapeo de Productos y Categorías
            (sale.items || []).forEach(item => {
                const prodKey = item.productId || item.name || 'Producto';
                const qty = parseFloat(item.quantity) || 0;
                const price = parseFloat(item.unitPrice || item.price) || 0;
                const lineTotal = price * qty;

                // Producto
                const existingP = productMap.get(prodKey) || { name: item.name || 'Producto', quantity: 0, total: 0 };
                existingP.quantity += qty;
                existingP.total += lineTotal;
                productMap.set(prodKey, existingP);

                // Categoría
                const catName = item.categoryName || item.category || 'General';
                const existingC = categoryMap.get(catName) || 0;
                categoryMap.set(catName, existingC + lineTotal);
            });
        });

        const topProducts = Array.from(productMap.values()).sort((a, b) => b.total - a.total).slice(0, 5);
        const categoryList = Array.from(categoryMap.entries())
            .map(([name, amount]) => ({ name, amount }))
            .sort((a, b) => b.amount - a.amount);
        const totalCategorySales = categoryList.reduce((sum, c) => sum + c.amount, 0);

        const avgTicket = report.totalSales > 0 ? Math.round(report.totalAmount / report.totalSales) : 0;
        const todayStr = new Date().toISOString().slice(0, 10);
        const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

        return `
            <!-- CABECERA CON SELECTOR DE FECHA Y BOTONES DE EXPORTACIÓN -->
            <div class="flex-between-wrap" style="margin-bottom: 1.25rem; gap: 1rem; align-items: center;">
                <div>
                    <h3 style="margin: 0; font-size: 1.4rem; color: var(--text-main); display: flex; align-items: center; gap: 0.75rem;">
                        📅 Ventas del Día: ${formatDate(targetDate)}
                        <span class="badge ${isGrowth ? 'badge-success' : 'badge-danger'}" style="font-size: 0.75rem; padding: 0.25rem 0.6rem;">
                            ${isGrowth ? '▲ +' : '▼ '}${percChange}% vs Ayer (${formatCLP(yesterdayReport.totalAmount)})
                        </span>
                    </h3>
                    <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: var(--secondary);">Resumen comercial y financiero puro del día seleccionado.</p>
                </div>
                
                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                    <div style="display: flex; gap: 0.35rem;">
                        <button class="btn btn-sm ${dateStr === todayStr ? 'btn-primary' : 'btn-secondary'}" 
                                onclick="ReportsView.handleDailyDateChange('${todayStr}')">Hoy</button>
                        <button class="btn btn-sm ${dateStr === yesterdayStr ? 'btn-primary' : 'btn-secondary'}" 
                                onclick="ReportsView.handleDailyDateChange('${yesterdayStr}')">Ayer</button>
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

            <!-- FILA COMPACTA DE MÉTRICAS CLAVE -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem;">
                <div style="padding: 0.75rem 1rem; background: var(--surface-content); border: 1px solid var(--border); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: var(--secondary); font-weight: 700; text-transform: uppercase;">Ventas Emitidas</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: var(--text-main);">${report.totalSales}</div>
                    <small style="font-size: 0.7rem; opacity: 0.7;">Avg ${formatCLP(avgTicket)}/ticket</small>
                </div>

                <div style="padding: 0.75rem 1rem; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: #2563eb; font-weight: 700; text-transform: uppercase;">Total Vendido (Bruto)</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: #2563eb;">${formatCLP(report.totalAmount)}</div>
                    <small style="font-size: 0.7rem; color: #2563eb;">Monto bruto recaudado</small>
                </div>

                <div style="padding: 0.75rem 1rem; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: #059669; font-weight: 700; text-transform: uppercase;">Venta Limpia (Sin IVA)</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: #059669;">${formatCLP(report.totalAmount - report.ivaDebito)}</div>
                    <small style="font-size: 0.7rem; color: #059669;">Neto sin impuestos</small>
                </div>

                <div style="padding: 0.75rem 1rem; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: #d97706; font-weight: 700; text-transform: uppercase;">IVA Débito (SII 19%)</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: #d97706;">${formatCLP(report.ivaDebito)}</div>
                    <small style="font-size: 0.7rem; color: #d97706;">A guardar para fisco</small>
                </div>

                <div style="padding: 0.75rem 1rem; background: rgba(139, 92, 246, 0.08); border: 1px solid rgba(139, 92, 246, 0.25); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: #7c3aed; font-weight: 700; text-transform: uppercase;">💎 Mi Ganancia Real</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: #7c3aed;">${formatCLP(report.realProfit)}</div>
                    <small style="font-size: 0.7rem; color: #7c3aed;">Utilidad de productos</small>
                </div>

                <div style="padding: 0.75rem 1rem; background: rgba(236, 72, 153, 0.08); border: 1px solid rgba(236, 72, 153, 0.25); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: #db2777; font-weight: 700; text-transform: uppercase;">🏷️ Descuentos Hoy</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: #db2777;">${formatCLP(totalDiscountsToday)}</div>
                    <small style="font-size: 0.7rem; color: #db2777;">Rebajas aplicadas</small>
                </div>
            </div>

            <!-- FILA 2: MÉTODOS DE PAGO Y ANULACIONES + SECCIONES DE RELEVANCIA -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin-bottom: 1.5rem;">
                <!-- Desglose Métodos de Pago del Día -->
                <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem;">
                    <h4 style="margin-bottom: 1rem; font-size: 0.95rem; display: flex; justify-content: space-between; align-items: center;">
                        <span>💳 Métodos de Pago e Ingresos</span>
                        <span style="font-size: 0.75rem; color: var(--secondary);">Haz clic en Fiados o Cobros para ver detalles</span>
                    </h4>
                    <div class="grid grid-2" style="gap: 0.75rem;">
                        <div style="text-align: center; padding: 0.65rem; background: rgba(16, 185, 129, 0.08); border-radius: 0.75rem; border: 1px solid rgba(16, 185, 129, 0.2);">
                            <div style="font-size: 0.75rem; color: #059669; font-weight: 700;">💵 Efectivo Recibido</div>
                            <div style="font-size: 1.1rem; font-weight: 900; color: #059669;">${formatCLP(paymentMethods.cash)}</div>
                        </div>
                        <div style="text-align: center; padding: 0.65rem; background: rgba(59, 130, 246, 0.08); border-radius: 0.75rem; border: 1px solid rgba(59, 130, 246, 0.2);">
                            <div style="font-size: 0.75rem; color: #2563eb; font-weight: 700;">💳 Tarjeta Recibida</div>
                            <div style="font-size: 1.1rem; font-weight: 900; color: #2563eb;">${formatCLP(paymentMethods.card)}</div>
                        </div>
                        <div style="text-align: center; padding: 0.65rem; background: rgba(139, 92, 246, 0.08); border-radius: 0.75rem; border: 1px solid rgba(139, 92, 246, 0.2);">
                            <div style="font-size: 0.75rem; color: #7c3aed; font-weight: 700;">📱 QR / Digital</div>
                            <div style="font-size: 1.1rem; font-weight: 900; color: #7c3aed;">${formatCLP(paymentMethods.qr)}</div>
                        </div>
                        <!-- Clickeable: Fiados anotados hoy -->
                        <div style="text-align: center; padding: 0.65rem; background: rgba(239, 68, 68, 0.08); border-radius: 0.75rem; border: 1px solid rgba(239, 68, 68, 0.25); cursor: pointer;" 
                             onclick="ReportsView.showDailyFiadosModal('${dateStr}')" title="Ver deudas otorgadas hoy">
                            <div style="font-size: 0.75rem; color: #dc2626; font-weight: 800;">📝 Fiados Anotados Hoy 🔍</div>
                            <div style="font-size: 1.1rem; font-weight: 900; color: #dc2626;">${formatCLP(paymentMethods.pending)}</div>
                        </div>
                    </div>
                </div>

                <!-- Cobros de Deudas + Devoluciones y Anulaciones -->
                <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem; display: flex; flex-direction: column; justify-content: space-between;">
                    <div>
                        <h4 style="margin-bottom: 1rem; font-size: 0.95rem;">🤝 Cobros y Devoluciones</h4>
                        
                        <!-- Clickeable: Abonos recibidos hoy -->
                        <div style="padding: 0.75rem 1rem; background: rgba(16, 185, 129, 0.08); border: 1.5px solid rgba(16, 185, 129, 0.3); border-radius: 0.75rem; margin-bottom: 0.75rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center;"
                             onclick="ReportsView.showDailyPaymentsModal('${dateStr}')"
                             title="Haz clic para ver qué clientes abonaron/pagaron deudas hoy">
                            <div>
                                <div style="font-weight: 800; color: #059669; font-size: 0.85rem;">🤝 Deudas Cobradas Hoy (${paymentsReceivedToday.length}) 🔍</div>
                                <div style="font-size: 0.75rem; color: var(--secondary);">Abonos recuperados hoy</div>
                            </div>
                            <div style="font-size: 1.15rem; font-weight: 900; color: #059669;">+${formatCLP(totalDebtPaymentsToday)}</div>
                        </div>

                        <!-- Devoluciones y Anulaciones -->
                        <div style="padding: 0.75rem 1rem; background: rgba(239, 68, 68, 0.05); border: 1px dashed rgba(239, 68, 68, 0.3); border-radius: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-weight: 800; color: #dc2626; font-size: 0.85rem;">🔄 Ventas Anuladas / Devoluciones (${cancelledCount})</div>
                                <div style="font-size: 0.75rem; color: var(--secondary);">Ventas canceladas en el día</div>
                            </div>
                            <div style="font-size: 1.15rem; font-weight: 900; color: #dc2626;">-${formatCLP(cancelledAmount)}</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- FILA 3: TOP 5 PRODUCTOS Y VENTAS POR CATEGORÍA -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin-bottom: 1.5rem;">
                <!-- TOP 5 PRODUCTOS ESTRELLA -->
                <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem;">
                    <h4 style="margin-bottom: 1rem; font-size: 0.95rem; color: var(--text-main);">🏆 Top 5 Productos Estrella del Día</h4>
                    ${topProducts.length === 0 ? '<p style="color:var(--secondary); font-size:0.85rem;">Sin productos vendidos hoy</p>' : `
                        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                            ${topProducts.map((p, idx) => {
                                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                                return `
                                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.75rem; background: var(--surface-content); border-radius: 0.5rem; border: 1px solid var(--border);">
                                        <div style="display: flex; align-items: center; gap: 0.6rem;">
                                            <span style="font-size: 1.1rem; width: 24px; text-align: center;">${medal}</span>
                                            <div>
                                                <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-main);">${p.name}</div>
                                                <small style="color: var(--secondary); font-size: 0.75rem;">${p.quantity} unidad(es) vendida(s)</small>
                                            </div>
                                        </div>
                                        <div style="font-weight: 800; color: #10b981; font-size: 0.95rem;">${formatCLP(p.total)}</div>
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
                                            <span style="font-weight: 700; color: var(--text-main);">${c.name}</span>
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

            <!-- GRÁFICO DE EVOLUCIÓN POR HORA (HORAS PICO) -->
            <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem; margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <h4 style="margin: 0; font-size: 0.95rem;">📈 Evolución de Ventas por Tramo Horario (Horas Pico)</h4>
                    <span style="font-size: 0.75rem; color: var(--secondary);">Ventas acumuladas de 08:00 a 22:00 hrs</span>
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

    async renderWeeklyReport(targetDateStr = null) {
        const dateStr = targetDateStr || this.selectedWeeklyDate || new Date().toISOString().slice(0, 10);
        this.selectedWeeklyDate = dateStr;
        const targetDate = new Date(`${dateStr}T12:00:00`);

        const report = await ReportController.getWeeklySales(targetDate);
        this._lastWeeklyReportSales = report.sales || [];
        this._lastWeeklyDateStr = dateStr;

        // Día Pico de Ventas de la Semana
        let peakDayName = '-';
        let peakDayTotal = 0;
        const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

        const dailyList = Object.entries(report.dailyBreakdown || {}).map(([key, data]) => {
            const d = new Date(key + 'T12:00:00');
            const dayName = dayNames[d.getDay()];
            if (data.total > peakDayTotal) {
                peakDayTotal = data.total;
                peakDayName = dayName;
            }
            return {
                key,
                dayName,
                dateFormatted: `${d.getDate()}/${d.getMonth() + 1}`,
                ...data
            };
        });

        // Top 5 Productos de la Semana y Descuentos
        const productMap = new Map();
        let totalDiscountsWeek = 0;

        report.sales.forEach(sale => {
            totalDiscountsWeek += parseFloat(sale.discountAmount || sale.discount) || 0;
            (sale.items || []).forEach(item => {
                const prodKey = item.productId || item.name || 'Producto';
                const qty = parseFloat(item.quantity) || 0;
                const price = parseFloat(item.unitPrice || item.price) || 0;
                const lineTotal = price * qty;

                const existingP = productMap.get(prodKey) || { name: item.name || 'Producto', quantity: 0, total: 0 };
                existingP.quantity += qty;
                existingP.total += lineTotal;
                productMap.set(prodKey, existingP);
            });
        });

        const topProducts = Array.from(productMap.values()).sort((a, b) => b.total - a.total).slice(0, 5);

        // Desglose Métodos de Pago
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
            if (pending >= 1.0) paymentMethods.pending += pending;
        });

        const avgTicket = report.totalSales > 0 ? Math.round(report.totalAmount / report.totalSales) : 0;

        return `
            <!-- CABECERA Y NAVEGACIÓN DE SEMANA -->
            <div class="flex-between-wrap" style="margin-bottom: 1.25rem; gap: 1rem; align-items: center;">
                <div>
                    <h3 style="margin: 0; font-size: 1.4rem; color: var(--text-main); display: flex; align-items: center; gap: 0.75rem;">
                        📅 Ventas Semanales
                    </h3>
                    <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: var(--secondary);">
                        Período del ${formatDate(report.startDate)} al ${formatDate(report.endDate)}
                    </p>
                </div>

                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; background: var(--surface-content); padding: 0.4rem 0.85rem; border-radius: 0.75rem; border: 1px solid var(--border);">
                        <label for="weeklyDatePicker" style="font-size: 0.8rem; font-weight: 700; color: var(--secondary); white-space: nowrap;">Seleccionar Fecha:</label>
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

            <!-- TARJETAS COMPACTAS SEMANALES -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem;">
                <div style="padding: 0.75rem 1rem; background: var(--surface-content); border: 1px solid var(--border); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: var(--secondary); font-weight: 700; text-transform: uppercase;">Ventas Emitidas</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: var(--text-main);">${report.totalSales}</div>
                    <small style="font-size: 0.7rem; opacity: 0.7;">Avg ${formatCLP(avgTicket)}/ticket</small>
                </div>

                <div style="padding: 0.75rem 1rem; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: #2563eb; font-weight: 700; text-transform: uppercase;">Total Vendido Semanal</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: #2563eb;">${formatCLP(report.totalAmount)}</div>
                    <small style="font-size: 0.7rem; color: #2563eb;">Recaudación bruta 7 días</small>
                </div>

                <div style="padding: 0.75rem 1rem; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: #d97706; font-weight: 700; text-transform: uppercase;">IVA Débito (SII 19%)</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: #d97706;">${formatCLP(report.ivaDebito)}</div>
                    <small style="font-size: 0.7rem; color: #d97706;">A guardar para impuestos</small>
                </div>

                <div style="padding: 0.75rem 1rem; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: #059669; font-weight: 700; text-transform: uppercase;">IVA Crédito (Compras)</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: #059669;">${formatCLP(report.ivaCredito)}</div>
                    <small style="font-size: 0.7rem; color: #059669;">Impuesto recuperable</small>
                </div>

                <div style="padding: 0.75rem 1rem; background: rgba(139, 92, 246, 0.08); border: 1px solid rgba(139, 92, 246, 0.25); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: #7c3aed; font-weight: 700; text-transform: uppercase;">💎 Ganancia Real Semanal</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: #7c3aed;">${formatCLP(report.realProfit)}</div>
                    <small style="font-size: 0.7rem; color: #7c3aed;">Utilidad neta 7 días</small>
                </div>

                <div style="padding: 0.75rem 1rem; background: rgba(236, 72, 153, 0.08); border: 1px solid rgba(236, 72, 153, 0.25); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: #db2777; font-weight: 700; text-transform: uppercase;">🏷️ Descuentos Semanales</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: #db2777;">${formatCLP(totalDiscountsWeek)}</div>
                    <small style="font-size: 0.7rem; color: #db2777;">Suma de rebajas 7 días</small>
                </div>
            </div>

            <!-- HIGHLIGHT: DÍA PICO DE LA SEMANA + MÉTODOS DE PAGO -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin-bottom: 1.5rem;">
                <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem; display: flex; flex-direction: column; justify-content: space-between;">
                    <h4 style="margin: 0 0 0.75rem 0; font-size: 0.95rem;">🏆 Día de Mayor Venta de la Semana</h4>
                    <div style="padding: 1.25rem; background: rgba(245, 158, 11, 0.08); border: 1.5px solid rgba(245, 158, 11, 0.3); border-radius: 0.75rem; text-align: center;">
                        <span style="font-size: 0.8rem; color: #d97706; font-weight: 800; text-transform: uppercase;">Día Pico Registrado</span>
                        <div style="font-size: 1.6rem; font-weight: 900; color: #d97706; margin: 0.25rem 0;">${peakDayName}</div>
                        <div style="font-size: 1.2rem; font-weight: 800; color: var(--text-main);">${formatCLP(peakDayTotal)} vendidos</div>
                    </div>
                </div>

                <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem;">
                    <h4 style="margin-bottom: 1rem; font-size: 0.95rem;">💳 Métodos de Pago Semanales</h4>
                    <div class="grid grid-2" style="gap: 0.75rem;">
                        <div style="text-align: center; padding: 0.65rem; background: rgba(16, 185, 129, 0.08); border-radius: 0.75rem; border: 1px solid rgba(16, 185, 129, 0.2);">
                            <div style="font-size: 0.75rem; color: #059669; font-weight: 700;">💵 Efectivo</div>
                            <div style="font-size: 1.1rem; font-weight: 900; color: #059669;">${formatCLP(paymentMethods.cash)}</div>
                        </div>
                        <div style="text-align: center; padding: 0.65rem; background: rgba(59, 130, 246, 0.08); border-radius: 0.75rem; border: 1px solid rgba(59, 130, 246, 0.2);">
                            <div style="font-size: 0.75rem; color: #2563eb; font-weight: 700;">💳 Tarjeta</div>
                            <div style="font-size: 1.1rem; font-weight: 900; color: #2563eb;">${formatCLP(paymentMethods.card)}</div>
                        </div>
                        <div style="text-align: center; padding: 0.65rem; background: rgba(139, 92, 246, 0.08); border-radius: 0.75rem; border: 1px solid rgba(139, 92, 246, 0.2);">
                            <div style="font-size: 0.75rem; color: #7c3aed; font-weight: 700;">📱 QR / Digital</div>
                            <div style="font-size: 1.1rem; font-weight: 900; color: #7c3aed;">${formatCLP(paymentMethods.qr)}</div>
                        </div>
                        <div style="text-align: center; padding: 0.65rem; background: rgba(239, 68, 68, 0.08); border-radius: 0.75rem; border: 1px solid rgba(239, 68, 68, 0.25);">
                            <div style="font-size: 0.75rem; color: #dc2626; font-weight: 800;">📝 Anotado (Deuda)</div>
                            <div style="font-size: 1.1rem; font-weight: 900; color: #dc2626;">${formatCLP(paymentMethods.pending)}</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- DESGLOSE COMPARATIVO DÍA POR DÍA (LUNES A DOMINGO) -->
            <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem; margin-bottom: 1.5rem;">
                <h4 style="margin-bottom: 1rem; font-size: 0.95rem;">📅 Comparativo Día por Día (Lunes a Domingo)</h4>
                <div class="table-container">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--border); font-size: 0.8rem; color: var(--secondary); text-transform: uppercase;">
                                <th style="padding: 0.75rem; text-align: left;">Día</th>
                                <th style="padding: 0.75rem; text-align: center;">Fecha</th>
                                <th style="padding: 0.75rem; text-align: center;">Boletas</th>
                                <th style="padding: 0.75rem; text-align: right;">Total Vendido</th>
                                <th style="padding: 0.75rem; text-align: right;">Venta Limpia (Sin IVA)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${dailyList.map(d => `
                                <tr style="border-bottom: 1px solid var(--border);">
                                    <td style="padding: 0.75rem; font-weight: 800; color: var(--text-main);">${d.dayName}</td>
                                    <td style="padding: 0.75rem; text-align: center; color: var(--secondary);">${d.dateFormatted}</td>
                                    <td style="padding: 0.75rem; text-align: center;"><span class="badge badge-primary">${d.count} ticket(s)</span></td>
                                    <td style="padding: 0.75rem; text-align: right; font-weight: 800; color: #2563eb;">${formatCLP(d.total)}</td>
                                    <td style="padding: 0.75rem; text-align: right; font-weight: 800; color: #059669;">${formatCLP(d.neto)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- TOP 5 PRODUCTOS DE LA SEMANA -->
            <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem; margin-bottom: 1.5rem;">
                <h4 style="margin-bottom: 1rem; font-size: 0.95rem; color: var(--text-main);">🏆 Top 5 Productos Estrella de la Semana</h4>
                ${topProducts.length === 0 ? '<p style="color:var(--secondary); font-size:0.85rem;">Sin productos vendidos esta semana</p>' : `
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem;">
                        ${topProducts.map((p, idx) => {
                            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                            return `
                                <div style="padding: 0.75rem 1rem; background: var(--surface-content); border-radius: 0.75rem; border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                                    <div style="display: flex; align-items: center; gap: 0.6rem;">
                                        <span style="font-size: 1.2rem;">${medal}</span>
                                        <div>
                                            <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-main);">${p.name}</div>
                                            <small style="color: var(--secondary); font-size: 0.75rem;">${p.quantity} unid.</small>
                                        </div>
                                    </div>
                                    <div style="font-weight: 800; color: #10b981; font-size: 0.95rem;">${formatCLP(p.total)}</div>
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

    async renderMonthlyReport(selectedYear, selectedMonth) {
        const now = new Date();
        const currentYear = selectedYear !== undefined ? selectedYear : now.getFullYear();
        const currentMonth = selectedMonth !== undefined ? selectedMonth : now.getMonth();

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

        const startOfMonth = new Date(currentYear, currentMonth, 1);
        const endOfMonth = new Date(currentYear, currentMonth + 1, 0);
        const isCurrentMonth = currentYear === now.getFullYear() && currentMonth === now.getMonth();
        const periodEnd = isCurrentMonth ? now : endOfMonth;
        const daysInPeriod = Math.max(1, Math.ceil((periodEnd - startOfMonth) / (1000 * 60 * 60 * 24)) + (isCurrentMonth ? 0 : 1));
        const totalDaysInMonth = endOfMonth.getDate();

        // Proyección Comercial
        const dailyAvg = report.totalSales > 0 ? (report.totalAmount / daysInPeriod) : 0;
        const monthProjection = Math.round(dailyAvg * totalDaysInMonth);

        // Top 5 Productos del Mes y Descuentos Totales
        const productMap = new Map();
        let totalDiscountsMonth = 0;

        report.sales.forEach(sale => {
            totalDiscountsMonth += parseFloat(sale.discountAmount || sale.discount) || 0;
            (sale.items || []).forEach(item => {
                const prodKey = item.productId || item.name || 'Producto';
                const qty = parseFloat(item.quantity) || 0;
                const price = parseFloat(item.unitPrice || item.price) || 0;
                const lineTotal = price * qty;

                const existingP = productMap.get(prodKey) || { name: item.name || 'Producto', quantity: 0, total: 0 };
                existingP.quantity += qty;
                existingP.total += lineTotal;
                productMap.set(prodKey, existingP);
            });
        });

        const topProducts = Array.from(productMap.values()).sort((a, b) => b.total - a.total).slice(0, 5);

        // Desglose Métodos de Pago
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
            if (pending >= 1.0) paymentMethods.pending += pending;
        });

        return `
            <!-- CABECERA Y NAVEGACIÓN MES -->
            <div class="flex-between-wrap" style="margin-bottom: 1.25rem; gap: 1rem; align-items: center;">
                <div>
                    <h3 style="margin: 0; font-size: 1.4rem; color: var(--text-main); display: flex; align-items: center; gap: 0.75rem;">
                        🗓️ Ventas de ${monthNames[currentMonth]} ${currentYear}
                    </h3>
                    <p style="margin: 0.25rem 0 0 0; color: var(--secondary); font-size: 0.85rem;">
                        Período: ${formatDate(startOfMonth)} - ${formatDate(periodEnd)} 
                        ${isCurrentMonth ? `(${daysInPeriod} de ${totalDaysInMonth} días transcurridos)` : `(${totalDaysInMonth} días completos)`}
                    </p>
                </div>

                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; background: var(--surface-content); padding: 0.4rem 0.85rem; border-radius: 0.75rem; border: 1px solid var(--border);">
                        <label for="monthPicker" style="font-size: 0.8rem; font-weight: 700; color: var(--secondary); white-space: nowrap;">Seleccionar Mes:</label>
                        <input type="month" id="monthPicker" value="${currentYear}-${String(currentMonth + 1).padStart(2, '0')}" 
                               onchange="ReportsView.handleMonthChange(this.value)"
                               style="border: none; background: transparent; font-weight: 800; color: var(--primary); cursor: pointer; font-size: 0.9rem;">
                    </div>
                    <button class="btn btn-primary" onclick="ReportsView.showReport('iva', ${currentYear}, ${currentMonth})" style="font-weight: 700;">
                        🔍 Detalle IVA
                    </button>
                    <button class="btn btn-success" onclick="ReportsView.exportMonthlyToCSV()" style="font-weight: 700;">
                        📊 Exportar Excel (CSV)
                    </button>
                    <button class="btn btn-secondary" onclick="ReportsView.exportToPDF('monthly', ${JSON.stringify(report).replace(/"/g, '&quot;')})" style="background-color: #dc2626; color: white; border-color: #dc2626; font-weight: 700;">
                        📄 PDF
                    </button>
                </div>
            </div>

            <!-- TARJETAS COMPACTAS DEL MES -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem;">
                <div style="padding: 0.75rem 1rem; background: var(--surface-content); border: 1px solid var(--border); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: var(--secondary); font-weight: 700; text-transform: uppercase;">Boletas Emitidas</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: var(--text-main);">${report.totalSales}</div>
                    <small style="font-size: 0.7rem; opacity: 0.7;">Prom. ${formatCLP(dailyAvg)}/día</small>
                </div>

                <div style="padding: 0.75rem 1rem; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: #2563eb; font-weight: 700; text-transform: uppercase;">Total Vendido Mes</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: #2563eb;">${formatCLP(report.totalAmount)}</div>
                    <small style="font-size: 0.7rem; color: #2563eb;">Recaudación bruta mensual</small>
                </div>

                <div style="padding: 0.75rem 1rem; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: #d97706; font-weight: 700; text-transform: uppercase;">IVA Débito (Ventas)</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: #d97706;">${formatCLP(report.ivaDebito)}</div>
                    <small style="font-size: 0.7rem; color: #d97706;">Impuesto por ventas</small>
                </div>

                <div style="padding: 0.75rem 1rem; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: #059669; font-weight: 700; text-transform: uppercase;">IVA Crédito (Facturas)</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: #059669;">${formatCLP(report.ivaCredito)}</div>
                    <small style="font-size: 0.7rem; color: #059669;">Impuesto en compras</small>
                </div>

                <div style="padding: 0.75rem 1rem; background: rgba(139, 92, 246, 0.08); border: 1px solid rgba(139, 92, 246, 0.25); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: #7c3aed; font-weight: 700; text-transform: uppercase;">💎 Ganancia Real Mes</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: #7c3aed;">${formatCLP(report.realProfit)}</div>
                    <small style="font-size: 0.7rem; color: #7c3aed;">Utilidad neta mensual</small>
                </div>

                <div style="padding: 0.75rem 1rem; background: rgba(236, 72, 153, 0.08); border: 1px solid rgba(236, 72, 153, 0.25); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: #db2777; font-weight: 700; text-transform: uppercase;">🏷️ Descuentos Totales</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: #db2777;">${formatCLP(totalDiscountsMonth)}</div>
                    <small style="font-size: 0.7rem; color: #db2777;">Rebajas en el mes</small>
                </div>
            </div>

            <!-- PROYECCIÓN COMERCIAL DEL MES + MÉTODOS DE PAGO -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin-bottom: 1.5rem;">
                <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem; display: flex; flex-direction: column; justify-content: space-between;">
                    <h4 style="margin: 0 0 0.75rem 0; font-size: 0.95rem;">📈 Proyección Comercial del Mes</h4>
                    <div style="padding: 1.25rem; background: rgba(59, 130, 246, 0.08); border: 1.5px solid rgba(59, 130, 246, 0.3); border-radius: 0.75rem; text-align: center;">
                        <span style="font-size: 0.8rem; color: #2563eb; font-weight: 800; text-transform: uppercase;">Estimación de Cierre de Mes</span>
                        <div style="font-size: 1.6rem; font-weight: 900; color: #2563eb; margin: 0.25rem 0;">${formatCLP(monthProjection)}</div>
                        <small style="font-size: 0.75rem; color: var(--secondary);">Basado en ritmo promedio de ${formatCLP(dailyAvg)}/día</small>
                    </div>
                </div>

                <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem;">
                    <h4 style="margin-bottom: 1rem; font-size: 0.95rem;">💳 Métodos de Pago del Mes</h4>
                    <div class="grid grid-2" style="gap: 0.75rem;">
                        <div style="text-align: center; padding: 0.65rem; background: rgba(16, 185, 129, 0.08); border-radius: 0.75rem; border: 1px solid rgba(16, 185, 129, 0.2);">
                            <div style="font-size: 0.75rem; color: #059669; font-weight: 700;">💵 Efectivo</div>
                            <div style="font-size: 1.1rem; font-weight: 900; color: #059669;">${formatCLP(paymentMethods.cash)}</div>
                        </div>
                        <div style="text-align: center; padding: 0.65rem; background: rgba(59, 130, 246, 0.08); border-radius: 0.75rem; border: 1px solid rgba(59, 130, 246, 0.2);">
                            <div style="font-size: 0.75rem; color: #2563eb; font-weight: 700;">💳 Tarjeta</div>
                            <div style="font-size: 1.1rem; font-weight: 900; color: #2563eb;">${formatCLP(paymentMethods.card)}</div>
                        </div>
                        <div style="text-align: center; padding: 0.65rem; background: rgba(139, 92, 246, 0.08); border-radius: 0.75rem; border: 1px solid rgba(139, 92, 246, 0.2);">
                            <div style="font-size: 0.75rem; color: #7c3aed; font-weight: 700;">📱 QR / Digital</div>
                            <div style="font-size: 1.1rem; font-weight: 900; color: #7c3aed;">${formatCLP(paymentMethods.qr)}</div>
                        </div>
                        <div style="text-align: center; padding: 0.65rem; background: rgba(239, 68, 68, 0.08); border-radius: 0.75rem; border: 1px solid rgba(239, 68, 68, 0.25);">
                            <div style="font-size: 0.75rem; color: #dc2626; font-weight: 800;">📝 Anotado (Deuda)</div>
                            <div style="font-size: 1.1rem; font-weight: 900; color: #dc2626;">${formatCLP(paymentMethods.pending)}</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- TOP 5 PRODUCTOS ESTRELLA DEL MES -->
            <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem; margin-bottom: 1.5rem;">
                <h4 style="margin-bottom: 1rem; font-size: 0.95rem; color: var(--text-main);">🏆 Top 5 Productos Estrella del Mes</h4>
                ${topProducts.length === 0 ? '<p style="color:var(--secondary); font-size:0.85rem;">Sin productos vendidos este mes</p>' : `
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem;">
                        ${topProducts.map((p, idx) => {
                            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                            return `
                                <div style="padding: 0.75rem 1rem; background: var(--surface-content); border-radius: 0.75rem; border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                                    <div style="display: flex; align-items: center; gap: 0.6rem;">
                                        <span style="font-size: 1.2rem;">${medal}</span>
                                        <div>
                                            <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-main);">${p.name}</div>
                                            <small style="color: var(--secondary); font-size: 0.75rem;">${p.quantity} unid.</small>
                                        </div>
                                    </div>
                                    <div style="font-weight: 800; color: #10b981; font-size: 0.95rem;">${formatCLP(p.total)}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `}
            </div>

            <!-- EVOLUCIÓN MES A MES -->
            ${previousMonthsReports.length > 0 ? `
                <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem; margin-bottom: 1.5rem;">
                    <h4 style="margin-bottom: 1rem; font-size: 0.95rem;">📈 Comparativo Mes a Mes (Últimos Meses)</h4>
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

    async renderProductsReport(daysParam = 30) {
        const days = parseInt(daysParam) || 30;
        this.selectedProductsDays = days;

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const products = await ReportController.getSalesByProduct(startDate, endDate) || [];
        this._lastProductsReportData = products;

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
                        📦 Vendido por Producto
                    </h3>
                    <p style="margin: 0.25rem 0 0 0; color: var(--secondary); font-size: 0.85rem;">
                        Ranking de rotación y rentabilidad (Últimos ${days} días)
                    </p>
                </div>

                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                    <div style="display: flex; gap: 0.25rem; background: var(--surface-content); padding: 0.25rem; border-radius: 0.75rem; border: 1px solid var(--border);">
                        <button class="btn btn-sm ${days === 7 ? 'btn-primary' : 'btn-ghost'}" onclick="ReportsView.handleProductsPeriodChange(7)">7 Días</button>
                        <button class="btn btn-sm ${days === 30 ? 'btn-primary' : 'btn-ghost'}" onclick="ReportsView.handleProductsPeriodChange(30)">30 Días</button>
                        <button class="btn btn-sm ${days === 90 ? 'btn-primary' : 'btn-ghost'}" onclick="ReportsView.handleProductsPeriodChange(90)">90 Días</button>
                    </div>

                    <input type="text" id="reportProductFilter" placeholder="🔍 Buscar producto..." 
                           onkeyup="ReportsView.filterProductsReport(this.value)" class="form-control" 
                           style="width: 220px; padding: 0.4rem 0.75rem; border-radius: 0.75rem;">

                    <button class="btn btn-success" onclick="ReportsView.exportProductsToCSV()" style="font-weight: 700;">
                        📊 Exportar Excel (CSV)
                    </button>
                </div>
            </div>

            <!-- TARJETAS COMPACTAS DE RESUMEN DE PRODUCTOS -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem;">
                <div style="padding: 0.75rem 1rem; background: var(--surface-content); border: 1px solid var(--border); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: var(--secondary); font-weight: 700; text-transform: uppercase;">Variedad Vendida</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: var(--text-main);">${totalVariety} SKUs</div>
                    <small style="font-size: 0.7rem; opacity: 0.7;">Productos distintos</small>
                </div>

                <div style="padding: 0.75rem 1rem; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: #2563eb; font-weight: 700; text-transform: uppercase;">Unidades Despachadas</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: #2563eb;">${formatNumber(totalUnits)}</div>
                    <small style="font-size: 0.7rem; color: #2563eb;">Total ítems vendidos</small>
                </div>

                <div style="padding: 0.75rem 1rem; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: #d97706; font-weight: 700; text-transform: uppercase;">👑 Rey de Volumen</div>
                    <div style="font-size: 1rem; font-weight: 900; color: #d97706; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${topByQty.name}">${topByQty.name}</div>
                    <small style="font-size: 0.7rem; color: #d97706;">${formatNumber(topByQty.quantity)} unid.</small>
                </div>

                <div style="padding: 0.75rem 1rem; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: #059669; font-weight: 700; text-transform: uppercase;">💎 Rey de Ganancia</div>
                    <div style="font-size: 1rem; font-weight: 900; color: #059669; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${topByProfit.name}">${topByProfit.name}</div>
                    <small style="font-size: 0.7rem; color: #059669;">+${formatCLP(topByProfit.grossProfit)} ganancia</small>
                </div>

                <div style="padding: 0.75rem 1rem; background: rgba(139, 92, 246, 0.08); border: 1px solid rgba(139, 92, 246, 0.25); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: #7c3aed; font-weight: 700; text-transform: uppercase;">Utilidad Total Periodo</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: #7c3aed;">${formatCLP(grandTotalProfit)}</div>
                    <small style="font-size: 0.7rem; color: #7c3aed;">Ganancia limpia</small>
                </div>
            </div>
            
            ${products.length === 0 ? '<div class="card glass-panel" style="padding: 2rem; text-align: center; color: var(--secondary); font-weight: 700;">No hay ventas registradas en los últimos ' + days + ' días</div>' : `
                <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem;">
                    <div class="table-container">
                        <table id="reportProductsTable" style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="border-bottom: 2px solid var(--border); font-size: 0.8rem; color: var(--secondary); text-transform: uppercase;">
                                    <th style="padding: 0.75rem; text-align: left;">Producto</th>
                                    <th style="padding: 0.75rem; text-align: right;">Cantidad Vendida</th>
                                    <th style="padding: 0.75rem; text-align: right;">Total Vendido</th>
                                    <th style="padding: 0.75rem; text-align: right; color: var(--secondary);">Costo Total</th>
                                    <th style="padding: 0.75rem; text-align: right; color: #10b981;">Ganancia Real</th>
                                    <th style="padding: 0.75rem; text-align: right; color: #10b981;">Margen %</th>
                                    <th style="padding: 0.75rem; text-align: left; width: 140px;">% de Ingresos</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${products.map(p => {
                                    const percentage = grandTotalRevenue > 0 ? (p.total / grandTotalRevenue * 100).toFixed(1) : 0;
                                    return `
                                        <tr style="border-bottom: 1px solid var(--border);">
                                            <td style="padding: 0.75rem; font-weight: 800; color: var(--text-main);">${p.name}</td>
                                            <td style="padding: 0.75rem; text-align: right; font-weight: 700;">${formatNumber(p.quantity)} unid.</td>
                                            <td style="padding: 0.75rem; text-align: right; font-weight: 900; color: #2563eb;">${formatCLP(p.total)}</td>
                                            <td style="padding: 0.75rem; text-align: right; color: var(--secondary);">${formatCLP(p.costTotal)}</td>
                                            <td style="padding: 0.75rem; text-align: right; font-weight: 900; color: #10b981;">${formatCLP(p.grossProfit)}</td>
                                            <td style="padding: 0.75rem; text-align: right; font-weight: 800; color: #10b981;"><span class="badge badge-success">${p.marginPercent}%</span></td>
                                            <td style="padding: 0.75rem;">
                                                <div style="display: flex; align-items: center; gap: 0.5rem;">
                                                    <div style="flex: 1; height: 8px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden;">
                                                        <div style="width: ${percentage}%; height: 100%; background: var(--primary); border-radius: 4px;"></div>
                                                    </div>
                                                    <span style="font-size: 0.75rem; font-weight: 700; color: var(--secondary);">${percentage}%</span>
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
        const headers = ['Producto', 'Cantidad Vendida', 'Total Vendido ($)', 'Costo Total ($)', 'Ganancia ($)', 'Margen (%)'];
        const rows = products.map(p => [
            `"${(p.name || '').replace(/"/g, '""')}"`,
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
        link.download = `reporte_productos_vendidos_${new Date().toISOString().slice(0, 10)}.csv`;
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

    async renderProfitabilityReport(daysParam = 30) {
        const days = parseInt(daysParam) || 30;
        this.selectedProfitabilityDays = days;

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const report = await ReportController.getProfitability(startDate, endDate);
        this._lastProfitabilityReport = report;
        this._lastProfitabilityDays = days;

        return `
            <!-- CABECERA Y FILTROS DE PERÍODO -->
            <div class="flex-between-wrap" style="margin-bottom: 1.25rem; gap: 1rem; align-items: center;">
                <div>
                    <h3 style="margin: 0; font-size: 1.4rem; color: var(--text-main); display: flex; align-items: center; gap: 0.75rem;">
                        💰 Ganancias y Utilidad Real
                    </h3>
                    <p style="margin: 0.25rem 0 0 0; color: var(--secondary); font-size: 0.85rem;">
                        Estado de Resultados y Margen de Utilidad (${days} días)
                    </p>
                </div>

                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                    <div style="display: flex; gap: 0.25rem; background: var(--surface-content); padding: 0.25rem; border-radius: 0.75rem; border: 1px solid var(--border);">
                        <button class="btn btn-sm ${days === 7 ? 'btn-primary' : 'btn-ghost'}" onclick="ReportsView.handleProfitabilityPeriodChange(7)">7 Días</button>
                        <button class="btn btn-sm ${days === 30 ? 'btn-primary' : 'btn-ghost'}" onclick="ReportsView.handleProfitabilityPeriodChange(30)">30 Días</button>
                        <button class="btn btn-sm ${days === 90 ? 'btn-primary' : 'btn-ghost'}" onclick="ReportsView.handleProfitabilityPeriodChange(90)">90 Días</button>
                    </div>

                    <button class="btn btn-success" onclick="ReportsView.exportProfitabilityToCSV()" style="font-weight: 700;">
                        📊 Exportar Excel (CSV)
                    </button>
                </div>
            </div>

            <!-- TARJETAS COMPACTAS DE RENTABILIDAD -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem;">
                <div style="padding: 0.75rem 1rem; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: #2563eb; font-weight: 700; text-transform: uppercase;">Ingresos Reales</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: #2563eb;">${formatCLP(report.revenue)}</div>
                    <small style="font-size: 0.7rem; color: #2563eb;">Venta Neta + Interna</small>
                </div>

                <div style="padding: 0.75rem 1rem; background: var(--surface-content); border: 1px solid var(--border); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: var(--secondary); font-weight: 700; text-transform: uppercase;">Costo de Ventas</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: var(--text-main);">${formatCLP(report.costOfSales)}</div>
                    <small style="font-size: 0.7rem; opacity: 0.7;">Costo Neto Proveedor</small>
                </div>

                <div style="padding: 0.75rem 1rem; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: #059669; font-weight: 700; text-transform: uppercase;">Ganancia Bruta Real</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: #059669;">${formatCLP(report.grossProfit)}</div>
                    <small style="font-size: 0.7rem; color: #059669;">Margen: ${(report.grossMargin || 0).toFixed(1)}%</small>
                </div>

                <div style="padding: 0.75rem 1rem; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: #dc2626; font-weight: 700; text-transform: uppercase;">Gastos Operativos</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: #dc2626;">-${formatCLP(report.operationalExpenses)}</div>
                    <small style="font-size: 0.7rem; color: #dc2626;">Gastos de caja/servicios</small>
                </div>

                <div style="padding: 0.75rem 1rem; background: rgba(139, 92, 246, 0.08); border: 1px solid rgba(139, 92, 246, 0.25); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: #7c3aed; font-weight: 700; text-transform: uppercase;">💎 Utilidad Final</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: ${report.profit >= 0 ? '#7c3aed' : '#dc2626'};">${formatCLP(report.profit)}</div>
                    <small style="font-size: 0.7rem; color: #7c3aed;">${(report.margin || 0).toFixed(1)}% de éxito neto</small>
                </div>
            </div>

            <!-- ESTADO DE RESULTADOS CONSOLIDADO (P&L) -->
            <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem; margin-bottom: 1.5rem;">
                <h4 style="margin: 0 0 1rem 0; font-size: 0.95rem; color: var(--text-main);">📊 Estado de Resultados Consolidado (P&L)</h4>
                <div style="display: flex; flex-direction: column; gap: 0.65rem; font-size: 0.88rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: var(--secondary);">(+) Ingresos Reales Acumulados:</span>
                        <strong style="color: #2563eb; font-size: 1rem;">${formatCLP(report.revenue)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: var(--secondary);">(-) Costo de Productos (Valor Neto):</span>
                        <strong style="color: #dc2626;">-${formatCLP(report.costOfSales)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-top: 1px dashed var(--border); border-bottom: 1px dashed var(--border);">
                        <span style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">(=) Ganancia Bruta Real:</span>
                        <strong style="color: #059669; font-size: 1.1rem;">${formatCLP(report.grossProfit)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: var(--secondary);">(-) Gastos Operativos y de Caja:</span>
                        <strong style="color: #dc2626;">-${formatCLP(report.operationalExpenses)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.75rem; border-top: 2px solid var(--border); font-size: 1.15rem;">
                        <strong style="color: var(--text-main);">🏆 Utilidad Final Limpia del Negocio:</strong>
                        <strong style="color: ${report.profit >= 0 ? '#10b981' : '#dc2626'}; font-size: 1.3rem;">${formatCLP(report.profit)}</strong>
                    </div>
                </div>
            </div>

            <!-- RENTABILIDAD POR CATEGORÍA -->
            ${report.byCategory && report.byCategory.length > 0 ? `
                <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem;">
                    <h4 style="margin-bottom: 1rem; font-size: 0.95rem;">📂 Rentabilidad por Categoría</h4>
                    <div class="table-container">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="border-bottom: 2px solid var(--border); font-size: 0.8rem; color: var(--secondary); text-transform: uppercase;">
                                    <th style="padding: 0.75rem; text-align: left;">Categoría</th>
                                    <th style="padding: 0.75rem; text-align: right;">Ingresos</th>
                                    <th style="padding: 0.75rem; text-align: right;">Costos</th>
                                    <th style="padding: 0.75rem; text-align: right; color: #10b981;">Ganancia</th>
                                    <th style="padding: 0.75rem; text-align: center;">Margen %</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${report.byCategory.map(cat => `
                                    <tr style="border-bottom: 1px solid var(--border);">
                                        <td style="padding: 0.75rem; font-weight: 800; color: var(--text-main);">${cat.name}</td>
                                        <td style="padding: 0.75rem; text-align: right; font-weight: 700; color: #2563eb;">${formatCLP(cat.revenue)}</td>
                                        <td style="padding: 0.75rem; text-align: right; color: var(--secondary);">${formatCLP(cat.cost)}</td>
                                        <td style="padding: 0.75rem; text-align: right; font-weight: 900; color: ${cat.profit >= 0 ? '#10b981' : '#dc2626'};">
                                            ${formatCLP(cat.profit)}
                                        </td>
                                        <td style="padding: 0.75rem; text-align: center;">
                                            <span class="badge ${cat.margin >= 0 ? 'badge-success' : 'badge-danger'}">
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

    async handleProfitabilityPeriodChange(days) {
        const content = await this.renderProfitabilityReport(days);
        const container = document.getElementById('reportContent');
        if (container) container.innerHTML = content;
    },

    exportProfitabilityToCSV() {
        const report = this._lastProfitabilityReport;
        const days = this._lastProfitabilityDays || 30;
        if (!report) {
            showNotification('No hay datos de rentabilidad para exportar', 'warning');
            return;
        }

        const headers = ['Categoría', 'Ingresos Reales ($)', 'Costo de Ventas ($)', 'Ganancia ($)', 'Margen (%)'];
        const rows = (report.byCategory || []).map(c => [
            `"${(c.name || '').replace(/"/g, '""')}"`,
            c.revenue || 0,
            c.cost || 0,
            c.profit || 0,
            `${(c.margin || 0).toFixed(1)}%`
        ]);

        const summaryRows = [
            [],
            ['Resumen Consolidado'],
            ['Ingresos Reales', report.revenue || 0],
            ['Costo de Ventas', report.costOfSales || 0],
            ['Ganancia Bruta Real', report.grossProfit || 0],
            ['Gastos Operativos', report.operationalExpenses || 0],
            ['Utilidad Final del Negocio', report.profit || 0]
        ];

        const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';')), ...summaryRows.map(e => e.join(';'))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `reporte_rentabilidad_${days}dias_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification('📊 Reporte de Rentabilidad descargado en Excel (CSV)', 'success');
    },

    async renderStockReport(filterType = 'all') {
        const report = await ReportController.getStockReport();
        const allProducts = report.products || [];
        this._lastStockReportData = allProducts;
        this.selectedStockFilter = filterType;

        const totalProducts = allProducts.length;
        const lowStockCount = report.lowStock.length;
        const outOfStockCount = report.outOfStock.length;
        const totalCostValue = report.totalValue || 0;

        const totalRetailValue = allProducts.reduce((sum, p) => {
            const stock = parseFloat(p.stock) || 0;
            const price = parseFloat(p.price) || 0;
            return sum + (stock > 0 && price > 0 ? stock * price : 0);
        }, 0);

        let filteredProducts = allProducts;
        if (filterType === 'low') {
            filteredProducts = report.lowStock;
        } else if (filterType === 'out') {
            filteredProducts = report.outOfStock;
        }

        return `
            <!-- CABECERA Y ACCIONES -->
            <div class="flex-between-wrap" style="margin-bottom: 1.25rem; gap: 1rem; align-items: center;">
                <div>
                    <h3 style="margin: 0; font-size: 1.4rem; color: var(--text-main); display: flex; align-items: center; gap: 0.75rem;">
                        📦 Estado de Inventario y Stock
                    </h3>
                    <p style="margin: 0.25rem 0 0 0; color: var(--secondary); font-size: 0.85rem;">
                        Valorización total de mercadería y alertas de reposición
                    </p>
                </div>

                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                    <input type="text" id="reportStockSearchFilter" placeholder="🔍 Buscar producto o código..." 
                           onkeyup="ReportsView.filterStockReportTable(this.value)" class="form-control" 
                           style="width: 230px; padding: 0.4rem 0.75rem; border-radius: 0.75rem;">

                    <button class="btn btn-success" onclick="ReportsView.exportStockToCSV()" style="font-weight: 700;">
                        📊 Exportar Excel (CSV)
                    </button>
                </div>
            </div>

            <!-- TARJETAS COMPACTAS DE RESUMEN DE INVENTARIO -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem;">
                <div style="padding: 0.75rem 1rem; background: var(--surface-content); border: 1px solid var(--border); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: var(--secondary); font-weight: 700; text-transform: uppercase;">SKUs Registrados</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: var(--text-main);">${totalProducts}</div>
                    <small style="font-size: 0.7rem; opacity: 0.7;">Catálogo activo</small>
                </div>

                <div style="padding: 0.75rem 1rem; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: #2563eb; font-weight: 700; text-transform: uppercase;">Valor a Costo Neto</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: #2563eb;">${formatCLP(totalCostValue)}</div>
                    <small style="font-size: 0.7rem; color: #2563eb;">Capital Invertido</small>
                </div>

                <div style="padding: 0.75rem 1rem; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: #059669; font-weight: 700; text-transform: uppercase;">Valor a Venta Bruta</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: #059669;">${formatCLP(totalRetailValue)}</div>
                    <small style="font-size: 0.7rem; color: #059669;">Recaudación Esperada</small>
                </div>

                <div style="padding: 0.75rem 1rem; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 0.75rem; text-align: center; cursor: pointer;"
                     onclick="ReportsView.handleStockFilterChange('low')">
                    <div style="font-size: 0.75rem; color: #d97706; font-weight: 700; text-transform: uppercase;">⚠️ Stock Bajo</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: #d97706;">${lowStockCount}</div>
                    <small style="font-size: 0.7rem; color: #d97706;">Próximos a agotar</small>
                </div>

                <div style="padding: 0.75rem 1rem; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 0.75rem; text-align: center; cursor: pointer;"
                     onclick="ReportsView.handleStockFilterChange('out')">
                    <div style="font-size: 0.75rem; color: #dc2626; font-weight: 700; text-transform: uppercase;">🛑 Agotados</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: #dc2626;">${outOfStockCount}</div>
                    <small style="font-size: 0.7rem; color: #dc2626;">Sin stock (0 unid.)</small>
                </div>
            </div>

            <!-- PESTAÑAS DE FILTRADO -->
            <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
                <button class="btn btn-sm ${filterType === 'all' ? 'btn-primary' : 'btn-ghost'}" onclick="ReportsView.handleStockFilterChange('all')">
                    📦 Todos los Productos (${totalProducts})
                </button>
                <button class="btn btn-sm ${filterType === 'low' ? 'btn-warning' : 'btn-ghost'}" onclick="ReportsView.handleStockFilterChange('low')">
                    ⚠️ Stock Bajo (${lowStockCount})
                </button>
                <button class="btn btn-sm ${filterType === 'out' ? 'btn-danger' : 'btn-ghost'}" onclick="ReportsView.handleStockFilterChange('out')">
                    🛑 Agotados (${outOfStockCount})
                </button>
            </div>

            <!-- TABLA DE DETALLE DE INVENTARIO -->
            <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem;">
                <div class="table-container">
                    <table id="reportStockTable" style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--border); font-size: 0.8rem; color: var(--secondary); text-transform: uppercase;">
                                <th style="padding: 0.75rem; text-align: left;">Producto</th>
                                <th style="padding: 0.75rem; text-align: center;">Stock Actual</th>
                                <th style="padding: 0.75rem; text-align: center;">Stock Mínimo</th>
                                <th style="padding: 0.75rem; text-align: right;">Valor a Costo</th>
                                <th style="padding: 0.75rem; text-align: right;">Valor a Venta</th>
                                <th style="padding: 0.75rem; text-align: center;">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredProducts.map(p => {
                                const stock = parseFloat(p.stock) || 0;
                                const minStock = parseFloat(p.minStock) || 0;
                                const cost = parseFloat(p.cost) || 0;
                                const price = parseFloat(p.price) || 0;
                                const costVal = stock * cost;
                                const saleVal = stock * price;

                                let badge = '<span class="badge badge-success">Normal</span>';
                                if (stock === 0) {
                                    badge = '<span class="badge badge-danger">Agotado</span>';
                                } else if (stock <= minStock) {
                                    badge = '<span class="badge badge-warning">Stock Bajo</span>';
                                }

                                return `
                                    <tr style="border-bottom: 1px solid var(--border);">
                                        <td style="padding: 0.75rem; font-weight: 800; color: var(--text-main);">${p.name}</td>
                                        <td style="padding: 0.75rem; text-align: center; font-weight: 800;">${stock} ${p.type === 'weight' ? 'kg' : 'un'}</td>
                                        <td style="padding: 0.75rem; text-align: center; color: var(--secondary);">${minStock} ${p.type === 'weight' ? 'kg' : 'un'}</td>
                                        <td style="padding: 0.75rem; text-align: right; color: var(--secondary);">${formatCLP(costVal)}</td>
                                        <td style="padding: 0.75rem; text-align: right; font-weight: 900; color: #2563eb;">${formatCLP(saleVal)}</td>
                                        <td style="padding: 0.75rem; text-align: center;">${badge}</td>
                                    </tr>
                                `;
                            }).join('')}
                            ${filteredProducts.length === 0 ? '<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--secondary); font-weight:700;">No hay productos en esta categoría</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
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

        const headers = ['Producto', 'Stock Actual', 'Stock Mínimo', 'Costo Unitario ($)', 'Precio Venta ($)', 'Valor Total Costo ($)', 'Valor Total Venta ($)', 'Estado'];
        const rows = products.map(p => {
            const stock = parseFloat(p.stock) || 0;
            const minStock = parseFloat(p.minStock) || 0;
            const cost = parseFloat(p.cost) || 0;
            const price = parseFloat(p.price) || 0;
            let status = 'Normal';
            if (stock === 0) status = 'Agotado';
            else if (stock <= minStock) status = 'Stock Bajo';

            return [
                `"${(p.name || '').replace(/"/g, '""')}"`,
                stock,
                minStock,
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
        const totalRetailStagnant = report.reduce((sum, item) => sum + ((parseFloat(item.stock) || 0) * (parseFloat(item.price) || 0)), 0);

        return `
            <!-- CABECERA Y FILTROS -->
            <div class="flex-between-wrap" style="margin-bottom: 1.25rem; gap: 1rem; align-items: center;">
                <div>
                    <h3 style="margin: 0; font-size: 1.4rem; color: var(--text-main); display: flex; align-items: center; gap: 0.75rem;">
                        😴 Productos Estancados (Sin Venta)
                    </h3>
                    <p style="margin: 0.25rem 0 0 0; color: var(--secondary); font-size: 0.85rem;">
                        Artículos en stock sin rotación reciente (Capital Inmovilizado)
                    </p>
                </div>

                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                    <div style="display: flex; gap: 0.35rem; align-items: center;">
                        <span style="font-size: 0.85rem; color: var(--secondary); font-weight: 700;">Inactivos hace:</span>
                        <select class="form-control" style="width: auto; padding: 0.4rem 0.75rem; border-radius: 0.75rem;" onchange="ReportsView.handleStagnantDaysChange(this.value)">
                            <option value="7" ${days == 7 ? 'selected' : ''}>7 días</option>
                            <option value="14" ${days == 14 ? 'selected' : ''}>14 días</option>
                            <option value="30" ${days == 30 ? 'selected' : ''}>30 días</option>
                            <option value="60" ${days == 60 ? 'selected' : ''}>60 días</option>
                            <option value="90" ${days == 90 ? 'selected' : ''}>90 días</option>
                        </select>
                    </div>

                    <input type="text" placeholder="🔍 Buscar producto..." 
                           onkeyup="ReportsView.filterStagnantTable(this.value)" class="form-control" 
                           style="width: 200px; padding: 0.4rem 0.75rem; border-radius: 0.75rem;">

                    <button class="btn btn-success" onclick="ReportsView.exportStagnantToCSV()" style="font-weight: 700;">
                        📊 Exportar Excel (CSV)
                    </button>
                </div>
            </div>

            <!-- TARJETAS COMPACTAS DE RESUMEN -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem;">
                <div style="padding: 0.75rem 1rem; background: var(--surface-content); border: 1px solid var(--border); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: var(--secondary); font-weight: 700; text-transform: uppercase;">Total Estancados</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: var(--text-main);">${totalStagnantCount} SKUs</div>
                    <small style="font-size: 0.7rem; opacity: 0.7;">> ${days} días sin venta</small>
                </div>

                <div style="padding: 0.75rem 1rem; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: #dc2626; font-weight: 700; text-transform: uppercase;">🔴 Nivel Crítico</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: #dc2626;">${criticalCount} SKUs</div>
                    <small style="font-size: 0.7rem; color: #dc2626;">> 30 días inactivos</small>
                </div>

                <div style="padding: 0.75rem 1rem; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: #d97706; font-weight: 700; text-transform: uppercase;">💸 Capital Inmovilizado</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: #d97706;">${formatCLP(totalCapitalStagnant)}</div>
                    <small style="font-size: 0.7rem; color: #d97706;">Costo total atrapado</small>
                </div>

                <div style="padding: 0.75rem 1rem; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: #2563eb; font-weight: 700; text-transform: uppercase;">Valor Venta Estancada</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: #2563eb;">${formatCLP(totalRetailStagnant)}</div>
                    <small style="font-size: 0.7rem; color: #2563eb;">Recaudación potencial</small>
                </div>
            </div>

            <!-- SUGERENCIA INTELIGENTE DE LIQUIDACIÓN -->
            ${totalCapitalStagnant > 0 ? `
                <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 0.75rem; padding: 0.85rem 1.25rem; margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <span style="font-size: 1.5rem;">💡</span>
                        <div>
                            <strong style="color: #d97706; font-size: 0.95rem;">Recomendación de Liquidación Rápida</strong>
                            <p style="margin: 0; font-size: 0.82rem; color: var(--text-main);">
                                Tienes <strong>${formatCLP(totalCapitalStagnant)}</strong> atrapados en estos productos. Aplicar un 15% de descuento te permitiría recuperar rápidamente hasta <strong>${formatCLP(Math.round(totalRetailStagnant * 0.85))}</strong> para reinvertir en stock de alta rotación.
                            </p>
                        </div>
                    </div>
                </div>
            ` : ''}

            <!-- TABLA DE PRODUCTOS ESTANCADOS -->
            <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem;">
                <div class="table-container">
                    <table id="reportStagnantTable" style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--border); font-size: 0.8rem; color: var(--secondary); text-transform: uppercase;">
                                <th style="padding: 0.75rem; text-align: left;">Producto</th>
                                <th style="padding: 0.75rem; text-align: center;">Última Venta</th>
                                <th style="padding: 0.75rem; text-align: center;">Inactivo Hace</th>
                                <th style="padding: 0.75rem; text-align: center;">Stock Bodega</th>
                                <th style="padding: 0.75rem; text-align: right;">Capital Atrapado</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${report.map(item => {
                                let badgeClass = 'badge-info';
                                if (item.daysInactive > 30) badgeClass = 'badge-danger';
                                else if (item.daysInactive > 14) badgeClass = 'badge-warning';

                                return `
                                    <tr style="border-bottom: 1px solid var(--border);">
                                        <td style="padding: 0.75rem; font-weight: 800; color: var(--text-main);">${item.name}</td>
                                        <td style="padding: 0.75rem; text-align: center; color: var(--secondary);">
                                            ${item.lastSoldAt ? new Date(item.lastSoldAt).toLocaleDateString('es-CL') : '<span style="opacity: 0.5;">Nunca vendido</span>'}
                                        </td>
                                        <td style="padding: 0.75rem; text-align: center;">
                                            <span class="badge ${badgeClass}">${item.daysInactive} días</span>
                                        </td>
                                        <td style="padding: 0.75rem; text-align: center; font-weight: 800;">${item.stock} un.</td>
                                        <td style="padding: 0.75rem; text-align: right; font-weight: 900; color: #d97706;">${formatCLP(item.costValue)}</td>
                                    </tr>
                                `;
                            }).join('')}
                            ${report.length === 0 ? '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: #10b981; font-weight:700;">✅ ¡Excelente! No tienes productos estancados en este umbral de ' + days + ' días.</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
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

        const headers = ['Producto', 'Última Venta', 'Días Inactivo', 'Stock Bodega', 'Costo Unitario ($)', 'Capital Atrapado ($)'];
        const rows = products.map(p => [
            `"${(p.name || '').replace(/"/g, '""')}"`,
            `"${p.lastSoldAt ? new Date(p.lastSoldAt).toLocaleDateString('es-CL') : 'Nunca'}"`,
            p.daysInactive || 0,
            p.stock || 0,
            p.cost || 0,
            p.costValue || 0
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

    async renderCostAlertsReport() {
        const alerts = await ReportController.getCostAlerts() || [];
        this._lastCostAlertsData = alerts;

        const totalAlerts = alerts.length;
        const usersInvolved = Array.from(new Set(alerts.map(a => a.username || 'Sistema'))).length;

        return `
            <!-- CABECERA Y ACCIONES -->
            <div class="flex-between-wrap" style="margin-bottom: 1.25rem; gap: 1rem; align-items: center;">
                <div>
                    <h3 style="margin: 0; font-size: 1.4rem; color: var(--text-main); display: flex; align-items: center; gap: 0.75rem;">
                        ⚠️ Alertas de Auditoría: Cambios de Costo
                    </h3>
                    <p style="margin: 0.25rem 0 0 0; color: var(--secondary); font-size: 0.85rem;">
                        Monitoreo de modificaciones manuales de costos que afectan los márgenes de ganancia
                    </p>
                </div>

                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                    <input type="text" placeholder="🔍 Buscar por usuario o producto..." 
                           onkeyup="ReportsView.filterCostAlertsTable(this.value)" class="form-control" 
                           style="width: 230px; padding: 0.4rem 0.75rem; border-radius: 0.75rem;">

                    <button class="btn btn-success" onclick="ReportsView.exportCostAlertsToCSV()" style="font-weight: 700;">
                        📊 Exportar Excel (CSV)
                    </button>
                </div>
            </div>

            <!-- TARJETAS COMPACTAS DE AUDITORÍA -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem;">
                <div style="padding: 0.75rem 1rem; background: var(--surface-content); border: 1px solid var(--border); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: var(--secondary); font-weight: 700; text-transform: uppercase;">Modificaciones Auditadas</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: var(--text-main);">${totalAlerts} cambios</div>
                    <small style="font-size: 0.7rem; opacity: 0.7;">Registros en sistema</small>
                </div>

                <div style="padding: 0.75rem 1rem; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: #d97706; font-weight: 700; text-transform: uppercase;">Usuarios Responsables</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: #d97706;">${usersInvolved} usuario(s)</div>
                    <small style="font-size: 0.7rem; color: #d97706;">Operadores detectados</small>
                </div>
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
                                <th style="padding: 0.75rem; text-align: left;">Modificación de Costo</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${alerts.length === 0 ? `
                                <tr><td colspan="4" style="text-align:center; padding: 3rem; color: #10b981; font-weight:700;">
                                    <div style="font-size: 2rem; margin-bottom: 0.5rem;">✅</div>
                                    Sin modificaciones manuales de costos registradas.
                                </td></tr>
                            ` : alerts.map(a => {
                                const changes = a.metadata?.changes || {};
                                const costChange = changes.cost || changes.costBruto || changes.costNeto;

                                let productName = a.metadata?.productName;
                                if (!productName) {
                                    if (a.summary && a.summary.includes('Producto #')) {
                                        const match = a.summary.match(/Producto #\d+/);
                                        productName = match ? match[0] : 'Producto #' + a.productId;
                                    } else {
                                        productName = 'Producto #' + a.productId;
                                    }
                                }

                                let detailHTML = '';
                                if (costChange) {
                                    detailHTML = `
                                        <div style="font-weight: 800; color: #d97706;">
                                            ${formatCLP(costChange.old)} ➔ ${formatCLP(costChange.new)}
                                        </div>
                                    `;
                                } else {
                                    detailHTML = `<span class="badge badge-warning">Ajuste de Costo</span>`;
                                }

                                return `
                                    <tr style="border-bottom: 1px solid var(--border);">
                                        <td style="padding: 0.75rem; font-size: 0.85rem; color: var(--secondary); white-space: nowrap;">
                                            ${formatDateTime(a.date)}
                                        </td>
                                        <td style="padding: 0.75rem;">
                                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                                <div style="width: 24px; height: 24px; border-radius: 50%; background: var(--primary); color:#fff; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.7rem;">
                                                    ${(a.username || 'U').charAt(0).toUpperCase()}
                                                </div>
                                                <span style="font-weight: 700; color: var(--text-main);">${a.username || 'Sistema'}</span>
                                            </div>
                                        </td>
                                        <td style="padding: 0.75rem; font-weight: 800; color: var(--text-main);">${productName}</td>
                                        <td style="padding: 0.75rem;">${detailHTML}</td>
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

        const headers = ['Fecha y Hora', 'Usuario', 'Producto', 'Detalle Cambio'];
        const rows = alerts.map(a => [
            `"${formatDateTime(a.date)}"`,
            `"${a.username || 'Sistema'}"`,
            `"${a.metadata?.productName || 'Producto #' + a.productId}"`,
            `"${a.summary || 'Ajuste de costo'}"`
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

    async renderDecisionMatrix() {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/analytics/decision-matrix', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Error al cargar la matriz');
            const data = await res.json() || [];
            this._lastDecisionMatrixData = data;

            const totalEstrella = data.filter(p => p.matrixCategory === 'estrella').length;
            const totalCaballo = data.filter(p => p.matrixCategory === 'caballo').length;
            const totalLento = data.filter(p => p.matrixCategory === 'lento_rentable').length;
            const totalPesoMuerto = data.filter(p => p.matrixCategory === 'peso_muerto' || (!['estrella','caballo','lento_rentable'].includes(p.matrixCategory))).length;

            return `
                <!-- CABECERA Y ACCIONES -->
                <div class="flex-between-wrap" style="margin-bottom: 1.25rem; gap: 1rem; align-items: center;">
                    <div>
                        <h3 style="margin: 0; font-size: 1.4rem; color: var(--text-main); display: flex; align-items: center; gap: 0.75rem;">
                            📊 Matriz de Decisión Comercial (ABC / BCG)
                        </h3>
                        <p style="margin: 0.25rem 0 0 0; color: var(--secondary); font-size: 0.85rem;">
                            Clasificación estratégica de productos por velocidad de venta y margen de utilidad
                        </p>
                    </div>

                    <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                        <input type="text" placeholder="🔍 Buscar producto..." 
                               onkeyup="ReportsView.filterDecisionMatrixTable(this.value)" class="form-control" 
                               style="width: 220px; padding: 0.4rem 0.75rem; border-radius: 0.75rem;">

                        <button class="btn btn-success" onclick="ReportsView.exportDecisionMatrixToCSV()" style="font-weight: 700;">
                            📊 Exportar Excel (CSV)
                        </button>
                    </div>
                </div>

                <!-- TARJETAS COMPACTAS CLASIFICACIÓN BCG -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem;">
                    <div style="padding: 0.75rem 1rem; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 0.75rem; text-align: center;">
                        <div style="font-size: 0.75rem; color: #059669; font-weight: 700; text-transform: uppercase;">⭐ Estrellas</div>
                        <div style="font-size: 1.3rem; font-weight: 900; color: #059669;">${totalEstrella} SKUs</div>
                        <small style="font-size: 0.7rem; color: #059669;">Alta rotación y ganancia</small>
                    </div>

                    <div style="padding: 0.75rem 1rem; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 0.75rem; text-align: center;">
                        <div style="font-size: 0.75rem; color: #2563eb; font-weight: 700; text-transform: uppercase;">🐎 Caballos de Batalla</div>
                        <div style="font-size: 1.3rem; font-weight: 900; color: #2563eb;">${totalCaballo} SKUs</div>
                        <small style="font-size: 0.7rem; color: #2563eb;">Alta venta / bajo margen</small>
                    </div>

                    <div style="padding: 0.75rem 1rem; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 0.75rem; text-align: center;">
                        <div style="font-size: 0.75rem; color: #d97706; font-weight: 700; text-transform: uppercase;">🐢 Lentos Rentables</div>
                        <div style="font-size: 1.3rem; font-weight: 900; color: #d97706;">${totalLento} SKUs</div>
                        <small style="font-size: 0.7rem; color: #d97706;">Baja venta / alto margen</small>
                    </div>

                    <div style="padding: 0.75rem 1rem; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 0.75rem; text-align: center;">
                        <div style="font-size: 0.75rem; color: #dc2626; font-weight: 700; text-transform: uppercase;">💀 Pesos Muertos</div>
                        <div style="font-size: 1.3rem; font-weight: 900; color: #dc2626;">${totalPesoMuerto} SKUs</div>
                        <small style="font-size: 0.7rem; color: #dc2626;">Sugerencia descatalogar</small>
                    </div>
                </div>

                <!-- TABLA DE MATRIZ DE DECISIÓN -->
                <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem;">
                    <div class="table-container">
                        <table id="reportDecisionMatrixTable" style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="border-bottom: 2px solid var(--border); font-size: 0.8rem; color: var(--secondary); text-transform: uppercase;">
                                    <th style="padding: 0.75rem; text-align: left;">Producto</th>
                                    <th style="padding: 0.75rem; text-align: center;">Categoría Matriz</th>
                                    <th style="padding: 0.75rem; text-align: right;">Velocidad (unid/día)</th>
                                    <th style="padding: 0.75rem; text-align: right; color: #10b981;">Margen Neto Unitario</th>
                                    <th style="padding: 0.75rem; text-align: right;">Punto Pedido Sugerido</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.map(p => {
                                    let badge = '';
                                    if (p.matrixCategory === 'estrella') badge = '<span class="badge badge-success">⭐ Estrella</span>';
                                    else if (p.matrixCategory === 'caballo') badge = '<span class="badge badge-info">🐎 Caballo de Batalla</span>';
                                    else if (p.matrixCategory === 'lento_rentable') badge = '<span class="badge badge-warning">🐢 Lento Rentable</span>';
                                    else badge = '<span class="badge badge-danger">💀 Peso Muerto</span>';

                                    return `
                                        <tr style="border-bottom: 1px solid var(--border);">
                                            <td style="padding: 0.75rem;">
                                                <div style="font-weight: 800; color: var(--text-main);">${p.name}</div>
                                                <small style="color: var(--secondary);">Stock Actual: ${p.stock} un.</small>
                                            </td>
                                            <td style="padding: 0.75rem; text-align: center;">${badge}</td>
                                            <td style="padding: 0.75rem; text-align: right; font-weight: 700;">${p.velocity}</td>
                                            <td style="padding: 0.75rem; text-align: right; font-weight: 900; color: #10b981;">${formatCLP(p.marginUnit)}</td>
                                            <td style="padding: 0.75rem; text-align: right; font-weight: 800; color: var(--text-main);">${p.reorderPoint} un.</td>
                                        </tr>
                                    `;
                                }).join('')}
                                ${data.length === 0 ? '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--secondary);">No se encontraron datos para la matriz de decisión</td></tr>' : ''}
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

        const headers = ['Producto', 'Stock Actual', 'Categoría Matriz', 'Velocidad (unid/día)', 'Margen Unitario ($)', 'Punto Pedido Sugerido'];
        const rows = data.map(p => [
            `"${(p.name || '').replace(/"/g, '""')}"`,
            p.stock || 0,
            `"${p.matrixCategory || 'general'}"`,
            p.velocity || 0,
            p.marginUnit || 0,
            p.reorderPoint || 0
        ]);

        const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `matriz_decision_comercial_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification('📊 Matriz de Decisión descargada en Excel (CSV)', 'success');
    },

    async renderCierresReport(filterType = 'all') {
        let allRegisters = [];
        try {
            allRegisters = await CashRegister.getAll() || [];
        } catch (e) {
            console.warn('Error al cargar cajas:', e);
        }
        this._lastCierresReportData = allRegisters;
        this.selectedCierresFilter = filterType;

        const totalCierres = allRegisters.length;
        const closedCount = allRegisters.filter(r => r.status === 'closed').length;
        const discrepancyCount = allRegisters.filter(r => r.status === 'closed' && (r.difference || 0) !== 0).length;
        const cleanCount = closedCount - discrepancyCount;

        let filtered = allRegisters;
        if (filterType === 'discrepancy') {
            filtered = allRegisters.filter(r => r.status === 'closed' && (r.difference || 0) !== 0);
        }

        return `
            <!-- CABECERA Y ACCIONES -->
            <div class="flex-between-wrap" style="margin-bottom: 1.25rem; gap: 1rem; align-items: center;">
                <div>
                    <h3 style="margin: 0; font-size: 1.4rem; color: var(--text-main); display: flex; align-items: center; gap: 0.75rem;">
                        🔒 Historial de Cierres de Caja (Cierres Z)
                    </h3>
                    <p style="margin: 0.25rem 0 0 0; color: var(--secondary); font-size: 0.85rem;">
                        Auditoría de apertura, cierre, arqueo de efectivo y descuadres por turno
                    </p>
                </div>

                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                    <div style="display: flex; gap: 0.25rem; background: var(--surface-content); padding: 0.25rem; border-radius: 0.75rem; border: 1px solid var(--border);">
                        <button class="btn btn-sm ${filterType === 'all' ? 'btn-primary' : 'btn-ghost'}" onclick="ReportsView.handleCierresFilterChange('all')">Todas (${totalCierres})</button>
                        <button class="btn btn-sm ${filterType === 'discrepancy' ? 'btn-danger' : 'btn-ghost'}" onclick="ReportsView.handleCierresFilterChange('discrepancy')">🔴 Solo Descuadres (${discrepancyCount})</button>
                    </div>

                    <input type="text" placeholder="🔍 Buscar por cajero..." 
                           onkeyup="ReportsView.filterCierresTable(this.value)" class="form-control" 
                           style="width: 180px; padding: 0.4rem 0.75rem; border-radius: 0.75rem;">

                    <button class="btn btn-success" onclick="ReportsView.exportCierresToCSV()" style="font-weight: 700;">
                        📊 Exportar Excel (CSV)
                    </button>
                </div>
            </div>

            <!-- TARJETAS COMPACTAS DE RESUMEN DE CIERRES -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem;">
                <div style="padding: 0.75rem 1rem; background: var(--surface-content); border: 1px solid var(--border); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: var(--secondary); font-weight: 700; text-transform: uppercase;">Total Registros</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: var(--text-main);">${totalCierres} cajas</div>
                    <small style="font-size: 0.7rem; opacity: 0.7;">Histórico acumulado</small>
                </div>

                <div style="padding: 0.75rem 1rem; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; color: #059669; font-weight: 700; text-transform: uppercase;">🟢 Cierres Limpios</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: #059669;">${cleanCount} turnos</div>
                    <small style="font-size: 0.7rem; color: #059669;">Sin descuadre de efectivo</small>
                </div>

                <div style="padding: 0.75rem 1rem; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 0.75rem; text-align: center; cursor: pointer;"
                     onclick="ReportsView.handleCierresFilterChange('discrepancy')">
                    <div style="font-size: 0.75rem; color: #dc2626; font-weight: 700; text-transform: uppercase;">🔴 Cierres con Descuadre</div>
                    <div style="font-size: 1.3rem; font-weight: 900; color: #dc2626;">${discrepancyCount} turnos</div>
                    <small style="font-size: 0.7rem; color: #dc2626;">Sobrante o faltante</small>
                </div>
            </div>

            <!-- TABLA DE HISTORIAL DE CIERRES -->
            <div class="card glass-panel" style="padding: 1.25rem; border-radius: 1rem;">
                <div class="table-container">
                    <table id="reportCierresTable" style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--border); font-size: 0.8rem; color: var(--secondary); text-transform: uppercase;">
                                <th style="padding: 0.75rem; text-align: left;">Apertura</th>
                                <th style="padding: 0.75rem; text-align: left;">Cierre</th>
                                <th style="padding: 0.75rem; text-align: left;">Cajero</th>
                                <th style="padding: 0.75rem; text-align: right;">Fondo Inicial</th>
                                <th style="padding: 0.75rem; text-align: right;">Efectivo Esperado</th>
                                <th style="padding: 0.75rem; text-align: right;">Efectivo Contado</th>
                                <th style="padding: 0.75rem; text-align: center;">Diferencia</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtered.map(r => {
                                const diff = r.difference || 0;
                                let diffBadge = '<span class="badge badge-success">Exacto ($0)</span>';
                                if (r.status === 'open') {
                                    diffBadge = '<span class="badge badge-info">Turno En Curso</span>';
                                } else if (diff > 0) {
                                    diffBadge = `<span class="badge badge-warning">+$${diff} Sobrante</span>`;
                                } else if (diff < 0) {
                                    diffBadge = `<span class="badge badge-danger">-$${Math.abs(diff)} Faltante</span>`;
                                }

                                return `
                                    <tr style="border-bottom: 1px solid var(--border);">
                                        <td style="padding: 0.75rem; font-size: 0.85rem; color: var(--secondary); white-space: nowrap;">
                                            ${formatDateTime(r.openDate)}
                                        </td>
                                        <td style="padding: 0.75rem; font-size: 0.85rem; color: var(--secondary); white-space: nowrap;">
                                            ${r.closeDate ? formatDateTime(r.closeDate) : 'En curso'}
                                        </td>
                                        <td style="padding: 0.75rem; font-weight: 800; color: var(--text-main);">${r.userName || r.user || 'Cajero'}</td>
                                        <td style="padding: 0.75rem; text-align: right; color: var(--secondary);">${formatCLP(r.initialAmount || 0)}</td>
                                        <td style="padding: 0.75rem; text-align: right; font-weight: 700; color: #2563eb;">${formatCLP(r.expectedAmount || 0)}</td>
                                        <td style="padding: 0.75rem; text-align: right; font-weight: 900; color: var(--text-main);">${formatCLP(r.actualAmount || 0)}</td>
                                        <td style="padding: 0.75rem; text-align: center;">${diffBadge}</td>
                                    </tr>
                                `;
                            }).join('')}
                            ${filtered.length === 0 ? '<tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--secondary);">No se encontraron cierres de caja</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    async handleCierresFilterChange(filterType) {
        const content = await this.renderCierresReport(filterType);
        const container = document.getElementById('reportContent');
        if (container) container.innerHTML = content;
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

        const headers = ['Apertura', 'Cierre', 'Cajero', 'Fondo Inicial ($)', 'Efectivo Esperado ($)', 'Efectivo Contado ($)', 'Diferencia ($)', 'Estado'];
        const rows = registers.map(r => [
            `"${formatDateTime(r.openDate)}"`,
            `"${r.closeDate ? formatDateTime(r.closeDate) : 'En curso'}"`,
            `"${r.userName || r.user || 'Cajero'}"`,
            r.initialAmount || 0,
            r.expectedAmount || 0,
            r.actualAmount || 0,
            r.difference || 0,
            `"${r.status || 'closed'}"`
        ]);

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
