const CashView = {
    openCalculatorModal(targetInputId) {
        const targetInput = document.getElementById(targetInputId);
        if (!targetInput) return;

        let initialVal = targetInput.value ? targetInput.value.trim() : '';

        const content = `
            <div style="padding: 0.5rem; display: flex; flex-direction: column; gap: 1rem; align-items: center; background: #f8fafc; border-radius: 1rem;">
                <input type="text" id="cashCalcDisplay" value="${initialVal}" 
                       placeholder="0"
                       style="width: 100%; height: 60px; font-size: 2.2rem; font-weight: 950; text-align: right; padding: 0 1rem; border-radius: 0.75rem; border: 3px solid #cbd5e1; background: #ffffff; color: #0f172a; box-shadow: inset 0 2px 5px rgba(0,0,0,0.05);"
                       onkeydown="if(event.key === 'Enter') { event.preventDefault(); CashView.evaluateCalculator(); }">
                
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; width: 100%;">
                    <button type="button" class="btn btn-secondary" onclick="CashView.pressCalcKey('7')" style="height: 55px; font-size: 1.4rem; font-weight: 900; border-radius: 0.5rem; background: #e2e8f0; border: 1.5px solid #cbd5e1; color: #000;">7</button>
                    <button type="button" class="btn btn-secondary" onclick="CashView.pressCalcKey('8')" style="height: 55px; font-size: 1.4rem; font-weight: 900; border-radius: 0.5rem; background: #e2e8f0; border: 1.5px solid #cbd5e1; color: #000;">8</button>
                    <button type="button" class="btn btn-secondary" onclick="CashView.pressCalcKey('9')" style="height: 55px; font-size: 1.4rem; font-weight: 900; border-radius: 0.5rem; background: #e2e8f0; border: 1.5px solid #cbd5e1; color: #000;">9</button>
                    <button type="button" class="btn btn-warning" onclick="CashView.pressCalcKey('/')" style="height: 55px; font-size: 1.4rem; font-weight: 900; border-radius: 0.5rem; background: #f59e0b; color: #fff; border: none;">÷</button>
                    
                    <button type="button" class="btn btn-secondary" onclick="CashView.pressCalcKey('4')" style="height: 55px; font-size: 1.4rem; font-weight: 900; border-radius: 0.5rem; background: #e2e8f0; border: 1.5px solid #cbd5e1; color: #000;">4</button>
                    <button type="button" class="btn btn-secondary" onclick="CashView.pressCalcKey('5')" style="height: 55px; font-size: 1.4rem; font-weight: 900; border-radius: 0.5rem; background: #e2e8f0; border: 1.5px solid #cbd5e1; color: #000;">5</button>
                    <button type="button" class="btn btn-secondary" onclick="CashView.pressCalcKey('6')" style="height: 55px; font-size: 1.4rem; font-weight: 900; border-radius: 0.5rem; background: #e2e8f0; border: 1.5px solid #cbd5e1; color: #000;">6</button>
                    <button type="button" class="btn btn-warning" onclick="CashView.pressCalcKey('*')" style="height: 55px; font-size: 1.4rem; font-weight: 900; border-radius: 0.5rem; background: #f59e0b; color: #fff; border: none;">×</button>
                    
                    <button type="button" class="btn btn-secondary" onclick="CashView.pressCalcKey('1')" style="height: 55px; font-size: 1.4rem; font-weight: 900; border-radius: 0.5rem; background: #e2e8f0; border: 1.5px solid #cbd5e1; color: #000;">1</button>
                    <button type="button" class="btn btn-secondary" onclick="CashView.pressCalcKey('2')" style="height: 55px; font-size: 1.4rem; font-weight: 900; border-radius: 0.5rem; background: #e2e8f0; border: 1.5px solid #cbd5e1; color: #000;">2</button>
                    <button type="button" class="btn btn-secondary" onclick="CashView.pressCalcKey('3')" style="height: 55px; font-size: 1.4rem; font-weight: 900; border-radius: 0.5rem; background: #e2e8f0; border: 1.5px solid #cbd5e1; color: #000;">3</button>
                    <button type="button" class="btn btn-warning" onclick="CashView.pressCalcKey('-')" style="height: 55px; font-size: 1.4rem; font-weight: 900; border-radius: 0.5rem; background: #f59e0b; color: #fff; border: none;">-</button>
                    
                    <button type="button" class="btn btn-secondary" onclick="CashView.pressCalcKey('0')" style="height: 55px; font-size: 1.4rem; font-weight: 900; border-radius: 0.5rem; background: #e2e8f0; border: 1.5px solid #cbd5e1; color: #000;">0</button>
                    <button type="button" class="btn btn-secondary" onclick="CashView.pressCalcKey('.')" style="height: 55px; font-size: 1.4rem; font-weight: 900; border-radius: 0.5rem; background: #e2e8f0; border: 1.5px solid #cbd5e1; color: #000;">.</button>
                    <button type="button" class="btn btn-danger" onclick="CashView.clearCalculator()" style="height: 55px; font-size: 1.2rem; font-weight: 900; border-radius: 0.5rem; background: #ef4444; color: #fff; border: none;">C</button>
                    <button type="button" class="btn btn-warning" onclick="CashView.pressCalcKey('+')" style="height: 55px; font-size: 1.4rem; font-weight: 900; border-radius: 0.5rem; background: #f59e0b; color: #fff; border: none;">+</button>
                </div>
            </div>
        `;

        const footer = `
            <div style="display: flex; gap: 1rem; width: 100%;">
                <button type="button" class="btn btn-success" onclick="CashView.useCalculatorResult('${targetInputId}')" style="flex: 2; height: 50px; font-weight: 900; font-size: 1.1rem; border-radius: 0.75rem; background: #10b981; border: none; color: #fff;">
                    📥 APLICAR RESULTADO
                </button>
                <button type="button" class="btn btn-secondary" onclick="closeModal()" style="flex: 1; height: 50px; font-weight: 800; border-radius: 0.75rem; background: #cbd5e1; color: #1e293b; border: none;">
                    Cancelar
                </button>
            </div>
        `;

        showModal(content, { title: '🧮 Calculadora de Caja', footer, width: '400px' });
        
        setTimeout(() => {
            const disp = document.getElementById('cashCalcDisplay');
            if (disp) { disp.focus(); disp.select(); }
        }, 100);
    },

    pressCalcKey(key) {
        const disp = document.getElementById('cashCalcDisplay');
        if (!disp) return;
        disp.value = (disp.value || '') + key;
    },

    clearCalculator() {
        const disp = document.getElementById('cashCalcDisplay');
        if (!disp) return;
        disp.value = '';
    },

    evaluateCalculator() {
        const disp = document.getElementById('cashCalcDisplay');
        if (!disp) return;
        try {
            const cleanExpr = disp.value.replace(/[^0-9+\-*/.]/g, '');
            if (cleanExpr) {
                const res = Function('"use strict";return (' + cleanExpr + ')')();
                disp.value = Math.round(res);
            }
        } catch (e) {
            showNotification('Operación matemática inválida', 'warning');
        }
    },

    useCalculatorResult(targetInputId) {
        this.evaluateCalculator();
        const disp = document.getElementById('cashCalcDisplay');
        const targetInput = document.getElementById(targetInputId);
        if (disp && targetInput) {
            targetInput.value = disp.value;
            targetInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        closeModal();
    },
    /**
     * Enrich open registers with getSummary so "Ventas" / total received are correct.
     * @param {Array} registers - From CashRegister.getAll()
     */
    async enrichHistoryWithSummaries(registers) {
        // Solo enriquecer los registros que están abiertos (normalmente solo uno)
        const openRegisters = registers.filter(r => r.status === 'open');
        if (openRegisters.length === 0) return;

        await Promise.all(openRegisters.map(async (r) => {
            const s = await CashRegister.getSummary(r.id);
            if (s) {
                r.paymentSummary = s.paymentSummary;
                r.expectedAmount = s.expectedCash;
            }
        }));
    },

    async render() {
        // Carga paralela de caja abierta e historial reciente (limitado a 20 para velocidad)
        const [openCash, history] = await Promise.all([
            CashRegister.getOpen(),
            CashRegister.getLatest(20)
        ]);
        
        let lastClosing = null;
        if (!openCash && history.length > 0) {
            // Buscar el último cierre en los registros cargados
            const last = history.find(r => r.status === 'closed');
            if (last) {
                lastClosing = await CashRegister.getSummary(last.id);
            }
        }

        // Enriquecer solo lo necesario de forma paralela
        await this.enrichHistoryWithSummaries(history);

        if (!openCash) {
            return this.renderOpenCashForm(history, lastClosing);
        } else {
            return this.renderCashSummary(openCash, history);
        }
    },

    historyDateFilter: '',
    _cashHistoryDataset: [],

    renderOpenCashForm(history, lastClosing = null) {
        const lastTotal = lastClosing ? lastClosing.finalAmount : 0;
        const lastDate = lastClosing ? formatDateTime(lastClosing.closeDate) : 'N/A';
        const lastDiff = lastClosing ? (lastClosing.difference || 0) : 0;
        const lastDiffColor = lastDiff === 0 ? '#10b981' : (lastDiff > 0 ? '#3b82f6' : '#ef4444');
        const lastDiffIcon = lastDiff === 0 ? '✅' : (lastDiff > 0 ? '📈' : '📉');
        const lastDiffLabel = lastDiff === 0 ? 'Cuadró perfecto' : (lastDiff > 0 ? 'Sobrante' : 'Faltante');

        return `
            <div class="view-header animate-fade-in">
                <h1 style="color: #111827;">Control de Caja</h1>
                <p style="color: #4b5563;">Apertura y cierre de caja</p>
            </div>
            
            <div class="grid grid-2 cash-open-grid animate-fade-in" style="gap: 2rem;">
                <!-- PANEL DE APERTURA (MIDNIGHT GLASS) -->
                <div class="card glass-card-midnight" style="background: #0f172a; border: none; padding: 2.5rem; position: relative; overflow: hidden; border-radius: 2rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
                    <!-- Decoración de fondo (Glow) -->
                    <div style="position: absolute; top: -50px; right: -50px; width: 200px; height: 200px; background: radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%); pointer-events: none;"></div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2.5rem; position: relative; z-index: 2;">
                        <div>
                            <h2 style="margin: 0; font-weight: 950; font-size: 2.2rem; color: #fff; letter-spacing: -1.5px;">Apertura</h2>
                            <p style="margin: 5px 0 0; color: #94a3b8; font-weight: 600; font-size: 0.95rem;">Inicia un nuevo turno de ventas</p>
                        </div>
                        <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.05); border-radius: 1.25rem; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; border: 1px solid rgba(255,255,255,0.1);">💰</div>
                    </div>
                    
                    <form id="openCashForm" onsubmit="CashView.openCash(event)" style="position: relative; z-index: 2;">
                        <div class="form-group" style="margin-bottom: 2.5rem;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem;">
                                <label style="margin: 0; font-weight: 800; color: #cbd5e1; text-transform: uppercase; letter-spacing: 2px; font-size: 0.8rem;">Monto inicial en efectivo</label>
                                <button type="button" class="btn btn-sm" onclick="CashView.showPartialSumsCalculator('quickAmount')" style="background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.4); font-weight:800; border-radius:0.75rem; padding:0.4rem 0.8rem; font-size:0.78rem; cursor:pointer;">🧮 Sumar Montos Separados</button>
                            </div>
                            <div style="position: relative;">
                                <span style="position: absolute; left: 1.5rem; top: 50%; transform: translateY(-50%); font-size: 2rem; font-weight: 900; color: #10b981;">$</span>
                                <input type="number" 
                                       id="quickAmount" 
                                       class="form-control" 
                                       placeholder="0" 
                                       min="0" 
                                       required
                                       onfocus="this.select()"
                                       style="padding-left: 3.5rem; font-size: 3.5rem; height: 6.5rem; width: 100%; border-radius: 1.5rem; background: rgba(255,255,255,0.03); border: 2.5px solid rgba(255,255,255,0.1); color: white; font-weight: 950; transition: all 0.3s; box-shadow: inset 0 4px 10px rgba(0,0,0,0.2); outline: none;">
                            </div>
                            <p style="margin-top: 1rem; color: #64748b; font-size: 0.85rem; font-weight: 600; text-align: center;">Ingresa el total de dinero físico disponible para dar vuelto.</p>
                        </div>
                        
                        <button type="submit" class="btn btn-lg" style="width: 100%; height: 5rem; font-size: 1.5rem; font-weight: 950; border-radius: 1.5rem; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; box-shadow: 0 15px 30px rgba(16, 185, 129, 0.3); transition: all 0.3s; cursor: pointer;" onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='0 20px 40px rgba(16, 185, 129, 0.4)'" onmouseout="this.style.transform='translateY(0)'">
                            ABRIR CAJA <span style="margin-left: 10px; opacity: 0.8;">→</span>
                        </button>
                    </form>
                </div>
                
                <!-- PANEL DE INFORMACIÓN (READ-ONLY SUMMARY) -->
                <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                    ${lastClosing ? `
                        <div class="card glass-card-info" style="background: rgba(255,255,255,0.02); border: 2.5px solid #e2e8f0; padding: 2.5rem; border-radius: 2rem; position: relative;">
                            <div style="position: absolute; top: 1.5rem; right: 1.5rem; padding: 0.5rem 1rem; background: #f1f5f9; border-radius: 2rem; font-size: 0.75rem; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Historial</div>
                            
                            <h3 style="margin-bottom: 2rem; display: flex; align-items: center; gap: 0.75rem; color: #1e293b; font-weight: 950; font-size: 1.4rem;">
                                📊 Último Cierre Registrado
                            </h3>
                            
                            <div style="display: grid; grid-template-columns: 1fr; gap: 2rem;">
                                <div style="padding: 1.5rem; background: #f8fafc; border-radius: 1.5rem; border: 1px solid #e2e8f0;">
                                    <span style="font-size: 0.75rem; font-weight: 950; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 0.5rem;">Saldo Final en Caja</span>
                                    <div style="font-size: 2.2rem; font-weight: 950; color: #0f172a; letter-spacing: -1px;">${formatCLP(lastTotal)}</div>
                                    <div style="margin-top: 5px; display: flex; align-items: center; gap: 6px;">
                                        <span style="width: 8px; height: 8px; background: #10b981; border-radius: 50%;"></span>
                                        <small style="color: #64748b; font-weight: 700;">Cerrado el ${lastDate}</small>
                                    </div>
                                </div>
                                
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                    <div style="padding: 1.25rem; background: ${lastDiff >= 0 ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)'}; border-radius: 1.25rem; border: 1.5px solid ${lastDiff >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'};">
                                        <span style="font-size: 0.7rem; font-weight: 900; color: ${lastDiff >= 0 ? '#059669' : '#b91c1c'}; text-transform: uppercase; display: block; margin-bottom: 4px;">Diferencia</span>
                                        <div style="font-size: 1.2rem; font-weight: 900; color: ${lastDiffColor};">
                                            ${lastDiffIcon} ${lastDiff === 0 ? 'Sin descuadre' : formatCLP(lastDiff)}
                                        </div>
                                    </div>
                                    <div style="padding: 1.25rem; background: #f8fafc; border-radius: 1.25rem; border: 1px solid #e2e8f0; display: flex; flex-direction: column; justify-content: center;">
                                        <span style="font-size: 0.7rem; font-weight: 900; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 4px;">Estado</span>
                                        <div style="font-weight: 800; color: ${lastDiffColor}; font-size: 1rem;">${lastDiffLabel}</div>
                                    </div>
                                </div>
                            </div>
                            
                            <p style="margin-top: 2rem; padding: 1.25rem; background: #fffbeb; border-radius: 1.25rem; border: 1.5px solid #fef3c7; color: #92400e; font-size: 0.85rem; font-weight: 700; line-height: 1.4;">
                                💡 <strong>Nota Informativa:</strong> Este saldo es solo una referencia del cierre anterior. No se arrastra automáticamente para evitar errores contables de turnos pasados.
                            </p>
                        </div>
                    ` : ''}

                    <div class="card" style="background: #1e293b; color: white; border-radius: 2rem; padding: 2.5rem; flex: 1; border: none; display: flex; flex-direction: column; justify-content: center;">
                        <h3 style="margin-bottom: 2rem; font-weight: 900; color: #60a5fa; letter-spacing: 2px; text-transform: uppercase; font-size: 0.9rem;">Recordatorios de Apertura</h3>
                        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                            <div style="display: flex; gap: 1.25rem; align-items: center;">
                                <div style="width: 48px; height: 48px; background: rgba(255,255,255,0.05); border-radius: 1rem; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; border: 1px solid rgba(255,255,255,0.1);">🔍</div>
                                <p style="font-size: 0.95rem; opacity: 0.85; font-weight: 600; margin: 0;">Verifica que el monto físico coincida con lo que ingresas.</p>
                            </div>
                            <div style="display: flex; gap: 1.25rem; align-items: center;">
                                <div style="width: 48px; height: 48px; background: rgba(255,255,255,0.05); border-radius: 1rem; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; border: 1px solid rgba(255,255,255,0.1);">🔐</div>
                                <p style="font-size: 0.95rem; opacity: 0.85; font-weight: 600; margin: 0;">Tu sesión de venta quedará registrada bajo tu usuario.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            ${history.length > 0 ? `
                <div class="card cash-history-panel" style="margin-top: 3rem; border-radius: 2rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                        <h3 style="margin: 0; font-weight: 900; font-size: 1.5rem; color: #1e293b;">Historial de Movimientos</h3>
                        <button class="btn btn-outline" onclick="CashView.showAllCashRegistersHistory()" style="background: #f1f5f9; color: #475569; font-weight: 800; border: none; padding: 0.75rem 1.25rem; border-radius: 1rem;">
                            📋 Ver Reporte Completo
                        </button>
                    </div>
                    ${this.renderCashHistory(history)}
                </div>
            ` : ''}
        `;
    },

    async renderCashSummary(cashRegister, history) {
        const summary = await CashRegister.getSummary(cashRegister.id);


        const dailyDetail = await CashController.getDailyDetail(cashRegister.id);
        this._dailyDetail = dailyDetail;
        this._activeSummary = summary;
        this._activeRegister = cashRegister;

        const todayKey = new Date().toLocaleDateString('es-CL');
        const todayDetail = dailyDetail.find(d => d.date === todayKey) || {
            sales: [], debtPayments: [], creditSales: [], cashMovementsOut: [], cashMovementsIn: []
        };

        let totalNetSales = 0;
        let totalCostNet = 0;
        let totalTodaySales = 0;
        let totalTodayDeudas = 0;

        if (todayDetail && todayDetail.sales) {
            todayDetail.sales.forEach(s => {
                if (s.status === 'cancelled') return;
                const total = parseFloat(s.total) || 0;
                totalTodaySales += total;
                // ponytail: Venta Neta descontando el 19% de IVA (salvo exentos explícitos)
                const isExento = (s.ivaType === 'Exento' || s.documentType === 'factura_exenta');
                const net = isExento ? total : Math.round(total / 1.19);
                totalNetSales += net;
                if (s.items && Array.isArray(s.items)) {
                    s.items.forEach(i => {
                        const qty = parseFloat(i.quantity) || 1;
                        const costNet = (i.costNeto !== undefined && i.costNeto !== null)
                            ? parseFloat(i.costNeto)
                            : ((parseFloat(i.cost) || 0) / 1.19);
                        totalCostNet += Math.round(costNet * qty);
                    });
                }
            });
        }

        if (todayDetail && todayDetail.creditSales) {
            todayDetail.creditSales.forEach(s => {
                if (s.status === 'cancelled') return;
                totalTodayDeudas += (parseFloat(s.total) || 0);
            });
        }

        let totalSessionAnotados = 0;
        if (summary && summary.totalCreditSalesAmount !== undefined) {
            totalSessionAnotados = parseFloat(summary.totalCreditSalesAmount) || 0;
        } else if (Array.isArray(dailyDetail)) {
            dailyDetail.forEach(d => {
                if (d.creditSales && Array.isArray(d.creditSales)) {
                    d.creditSales.forEach(s => {
                        if (s.status !== 'cancelled') {
                            totalSessionAnotados += (parseFloat(s.total) || 0);
                        }
                    });
                }
            });
        }

        // ponytail: Ganancia real del turno considerando Ventas sin IVA menos Costos Netos de compra
        const estimatedNetProfit = summary.netProfit !== undefined ? summary.netProfit : Math.round(totalNetSales - totalCostNet);

        // Límite de Efectivo Sugerido en Caja (Por defecto $150.000 CLP)
        const maxCashLimit = parseFloat(localStorage.getItem('cashRegisterMaxCashLimit') || '150000');
        const showCashLimitAlert = (summary.expectedCash >= maxCashLimit);

        const rawOpenDate = cashRegister.openDate || cashRegister.openedAt || cashRegister.created_at;
        const openDateObj = rawOpenDate ? new Date(rawOpenDate) : new Date();
        const diffMinutes = Math.max(0, Math.floor((new Date() - openDateObj) / 60000));
        const durationDisplay = isNaN(diffMinutes)
            ? 'Turno Activo'
            : (diffMinutes < 60 ? `${diffMinutes} min transcurridos` : `${Math.floor(diffMinutes / 60)}h ${diffMinutes % 60}m transcurridos`);

        return `
            <style>
                /* ── Caja: animaciones ── */
                @keyframes cxFadeUp {
                    from { opacity: 0; transform: translateY(18px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes cxBarIn {
                    from { width: 0; }
                }
                @keyframes cxPulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.35); }
                    50%       { box-shadow: 0 0 0 8px rgba(16,185,129,0); }
                }

                /* ── Header de estado ── */
                .cx-header {
                    background: #fff;
                    border-radius: 1.25rem;
                    padding: 1.5rem 2rem;
                    box-shadow: 0 4px 24px rgba(0,0,0,0.07);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    flex-wrap: wrap;
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                    border-left: 5px solid #10b981;
                    animation: cxFadeUp 0.35s ease both;
                }
                .cx-status-dot {
                    width: 11px; height: 11px; border-radius: 50%;
                    background: #10b981; flex-shrink: 0;
                    animation: cxPulse 2s infinite;
                }

                /* ── Botones de acción ── */
                .cx-action-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                    animation: cxFadeUp 0.38s ease both;
                }
                .cx-action-btn {
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    gap: 0.5rem; padding: 1.25rem 1rem; border-radius: 1rem;
                    border: none; cursor: pointer; font-weight: 700; font-size: 0.9rem;
                    transition: all 0.22s ease; text-align: center;
                    min-height: 90px;
                }
                .cx-action-btn:hover { transform: translateY(-4px); }
                .cx-action-btn .cx-btn-icon { font-size: 1.7rem; }

                /* ── KPI cards ── */
                .cx-kpi {
                    background: #fff;
                    border-radius: 1.15rem;
                    padding: 1.35rem 1.5rem;
                    box-shadow: 0 3px 20px rgba(0,0,0,0.07);
                    border-left: 4px solid transparent;
                    position: relative; overflow: hidden;
                    transition: transform 0.2s, box-shadow 0.2s;
                    animation: cxFadeUp 0.4s ease both;
                }
                .cx-kpi:hover { transform: translateY(-3px); box-shadow: 0 10px 32px rgba(0,0,0,0.12); }
                .cx-kpi-bg { position:absolute; right:-10px; bottom:-10px; font-size:4.5rem; opacity:0.06; pointer-events:none; user-select:none; }
                .cx-kpi-lbl { font-size:0.72rem; font-weight:800; text-transform:uppercase; letter-spacing:1px; margin-bottom:0.5rem; }
                .cx-kpi-val { font-size:1.7rem; font-weight:900; letter-spacing:-1px; line-height:1; }
                .cx-kpi-sub { font-size:0.75rem; margin-top:0.4rem; color:#64748b; }

                /* ── Sección ── */
                .cx-section {
                    background: #fff;
                    border-radius: 1.15rem;
                    padding: 1.5rem;
                    box-shadow: 0 3px 20px rgba(0,0,0,0.06);
                    animation: cxFadeUp 0.42s ease both;
                }
                .cx-section-title {
                    font-size: 0.88rem; font-weight: 800; color: #0f172a;
                    display: flex; align-items: center; gap: 0.5rem;
                    margin-bottom: 1.1rem; text-transform: uppercase; letter-spacing: 0.5px;
                }

                /* ── Fila de dato ── */
                .cx-row {
                    display: flex; justify-content: space-between; align-items: center;
                    padding: 0.625rem 0; border-bottom: 1px solid #f1f5f9;
                }
                .cx-row:last-child { border-bottom: none; }
                .cx-row-lbl { font-size:0.85rem; font-weight:600; color:#475569; }
                .cx-row-val { font-size:0.95rem; font-weight:800; color:#0f172a; }

                /* ── Tarjeta de totales sesión ── */
                .cx-total-card {
                    background: #fff; border-radius: 1rem;
                    border: 1.5px solid #e2e8f0; padding: 1.1rem 1.25rem;
                    cursor: pointer; transition: all 0.22s ease;
                    display: flex; gap: 0.875rem; align-items: flex-start;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
                }
                .cx-total-card:hover {
                    transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.1);
                    border-color: #cbd5e1;
                }
                .cx-total-icon {
                    width: 42px; height: 42px; border-radius: 0.75rem;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 1.25rem; flex-shrink: 0;
                }
                .cx-total-lbl { font-size:0.72rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; }
                .cx-total-val { font-size:1.3rem; font-weight:900; color:#0f172a; margin-top:0.15rem; }
                .cx-total-foot { font-size:0.72rem; color:#94a3b8; margin-top:0.25rem; }

                /* ── Barra de pago ── */
                .cx-pay-bar-wrap { height:6px; background:#e2e8f0; border-radius:99px; overflow:hidden; margin-top:0.5rem; }
                .cx-pay-bar { height:100%; border-radius:99px; animation: cxBarIn 0.8s ease; }
            </style>

            <!-- ===== HEADER ESTADO CAJA ===== -->
            <div class="cx-header">
                <div style="display:flex; align-items:center; gap:1rem;">
                    <div class="cx-status-dot"></div>
                    <div>
                        <div style="display:flex; align-items:center; gap:0.75rem;">
                            <h1 style="margin:0; color:#0f172a; font-size:1.5rem; font-weight:900;">Control de Caja</h1>
                            <span style="background:#dcfce7; color:#166534; border:1.5px solid #86efac; font-size:0.78rem; font-weight:800; padding:0.25rem 0.875rem; border-radius:99px;">
                                Caja #${cashRegister.id} • Abierta
                            </span>
                        </div>
                        <p style="margin:0.3rem 0 0; color:#64748b; font-size:0.83rem;">
                            Desde ${formatDateTime(cashRegister.openDate)} &nbsp;·&nbsp;
                            <span style="color:#10b981; font-weight:700;">${durationDisplay}</span>
                        </p>
                    </div>
                </div>
                <div style="display:flex; gap:0.625rem; flex-wrap:wrap;">
                    <button onclick="CashView.showAllCashRegistersHistory()"
                            style="background:#f1f5f9; color:#475569; border:1.5px solid #e2e8f0; padding:0.5rem 1rem; border-radius:0.625rem; font-size:0.8rem; font-weight:700; cursor:pointer; transition:all 0.18s;"
                            onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">
                        📚 Historial Cajas
                    </button>
                    <button onclick="CashView.showCashHistory(${cashRegister.id})"
                            style="background:#f1f5f9; color:#475569; border:1.5px solid #e2e8f0; padding:0.5rem 1rem; border-radius:0.625rem; font-size:0.8rem; font-weight:700; cursor:pointer; transition:all 0.18s;"
                            onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">
                        📋 Esta Sesión
                    </button>
                </div>
            </div>

            <!-- ===== ALERTA DE TOPE DE EFECTIVO EN CAJA ===== -->
            ${showCashLimitAlert ? `
                <div style="background:#fffbe6; border:2px solid #f59e0b; border-radius:1.25rem; padding:1.25rem 1.5rem; margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center; box-shadow:0 4px 15px rgba(245,158,11,0.15); animation: cxFadeUp 0.3s ease both;">
                    <div style="display:flex; align-items:center; gap:1rem;">
                        <span style="font-size:2.2rem;">⚠️</span>
                        <div>
                            <strong style="color:#92400e; font-size:1.05rem; display:block;">Alerta de Límite de Efectivo en Caja</strong>
                            <span style="color:#b45309; font-size:0.85rem; font-weight:600;">
                                El efectivo acumulado en caja (<strong>${formatCLP(summary.expectedCash)}</strong>) supera el límite sugerido de <strong>${formatCLP(maxCashLimit)}</strong>. Se recomienda realizar un retiro de seguridad a caja fuerte.
                            </span>
                        </div>
                    </div>
                    <button class="btn btn-warning" onclick="CashView.showWithdrawCashForm()" style="font-weight:900; border-radius:0.75rem; white-space:nowrap; padding:0.6rem 1.25rem;">
                        ➖ Retirar Dinero
                    </button>
                </div>
            ` : ''}

            <!-- ===== BOTONES DE ACCIÓN (3 botones, sin Gastos) ===== -->
            <div class="cx-action-grid">

                <button class="cx-action-btn" onclick="CashView.showAddCashForm()"
                        style="background:linear-gradient(135deg,#10b981,#059669); color:#fff; box-shadow:0 4px 16px rgba(16,185,129,0.3);"
                        onmouseover="this.style.boxShadow='0 8px 24px rgba(16,185,129,0.45)'"
                        onmouseout="this.style.boxShadow='0 4px 16px rgba(16,185,129,0.3)'">
                    <span class="cx-btn-icon">➕</span>
                    <span>Agregar Dinero</span>
                    <small style="opacity:0.8; font-weight:500; font-size:0.72rem;">Entrada de efectivo</small>
                </button>

                <button class="cx-action-btn" onclick="CashView.showWithdrawCashForm()"
                        style="background:linear-gradient(135deg,#f59e0b,#d97706); color:#fff; box-shadow:0 4px 16px rgba(245,158,11,0.3);"
                        onmouseover="this.style.boxShadow='0 8px 24px rgba(245,158,11,0.45)'"
                        onmouseout="this.style.boxShadow='0 4px 16px rgba(245,158,11,0.3)'">
                    <span class="cx-btn-icon">➖</span>
                    <span>Retirar Dinero</span>
                    <small style="opacity:0.8; font-weight:500; font-size:0.72rem;">Salida de efectivo</small>
                </button>

                <button class="cx-action-btn" onclick="CashView.showCloseCashForm()"
                        style="background:linear-gradient(135deg,#ef4444,#dc2626); color:#fff; box-shadow:0 4px 16px rgba(239,68,68,0.3);"
                        onmouseover="this.style.boxShadow='0 8px 24px rgba(239,68,68,0.45)'"
                        onmouseout="this.style.boxShadow='0 4px 16px rgba(239,68,68,0.3)'">
                    <span class="cx-btn-icon">🔒</span>
                    <span>Cerrar Caja</span>
                    <small style="opacity:0.8; font-weight:500; font-size:0.72rem;">Finalizar turno</small>
                </button>

            </div>

            <!-- ===== KPIs: VENTAS Y EFECTIVO (4 KPIs ÚNICOS) ===== -->
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px,1fr)); gap:1rem; margin-bottom:1.5rem;">

                <!-- Ventas del turno -->
                <div class="cx-kpi" style="border-left-color:#4f46e5; cursor:pointer; animation-delay:0s;" onclick="CashView.showHistorialVentasSesion()" title="Total vendido en el turno actual. Haz clic para ver todos los tickets.">
                    <div class="cx-kpi-bg">🛍️</div>
                    <div class="cx-kpi-lbl" style="color:#4f46e5;">Ventas Turno</div>
                    <div class="cx-kpi-val">${formatCLP(totalTodaySales)}</div>
                    <div class="cx-kpi-sub">${summary.totalSales || todayDetail.sales.length} tickets · click para ver</div>
                </div>

                <!-- Deudas / Fiados del turno -->
                <div class="cx-kpi" style="border-left-color:#ef4444; cursor:pointer; animation-delay:0.06s;" onclick="CashView.showDeudasHoy()" title="Ventas anotadas a crédito durante el turno.">
                    <div class="cx-kpi-bg">📝</div>
                    <div class="cx-kpi-lbl" style="color:#ef4444;">Fiados Turno</div>
                    <div class="cx-kpi-val" style="color:#dc2626;">${formatCLP(totalTodayDeudas)}</div>
                    <div class="cx-kpi-sub">${todayDetail.creditSales.length} anotados · click para ver</div>
                </div>

                <!-- Efectivo esperado -->
                <div class="cx-kpi" style="border-left-color:#10b981; animation-delay:0.10s;" title="Total de dinero físico que debe haber en la caja.">
                    <div class="cx-kpi-bg">💵</div>
                    <div class="cx-kpi-lbl" style="color:#10b981;">Efectivo Esperado</div>
                    <div class="cx-kpi-val" style="color:#059669;">${formatCLP(summary.expectedCash)}</div>
                    <div class="cx-kpi-sub">Inicial + ventas en efectivo</div>
                </div>

                <!-- Ganancia Neta Estimada -->
                <div class="cx-kpi" style="border-left-color:#8b5cf6; animation-delay:0.14s;" title="Ganancia neta estimada del turno = (Ventas Neto sin IVA 19%) - (Costo Neto de los Productos Vendidos).">
                    <div class="cx-kpi-bg">💎</div>
                    <div class="cx-kpi-lbl" style="color:#8b5cf6;">Ganancia Neta Turno</div>
                    <div class="cx-kpi-val" style="color:#7c3aed;">${formatCLP(estimatedNetProfit)}</div>
                    <div class="cx-kpi-sub">(Ventas Neto) - (Costo Vendido)</div>
                </div>

            </div>

            <!-- ===== FILA: EFECTIVO DETALLADO + MÉTODOS PAGO ===== -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.25rem; margin-bottom:1.25rem;">

                <!-- Desglose de efectivo -->
                <div class="cx-section" style="animation-delay:0.18s; border-left:4px solid #10b981;">
                    <div class="cx-section-title">💰 Resumen de Efectivo</div>
                    <div class="cx-row">
                        <span class="cx-row-lbl">Monto Inicial</span>
                        <span class="cx-row-val">${formatCLP(summary.initialAmount)}</span>
                    </div>
                    <div class="cx-row" style="cursor:pointer;" onclick="CashView.showPaymentMethods()" title="Ver desglose">
                        <span class="cx-row-lbl">Ingresos Netos (Efectivo)</span>
                        <span class="cx-row-val" style="color:#059669;">+${formatCLP(summary.cashForDisplay)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.875rem; padding-top:0.875rem; border-top:2px solid #e2e8f0;">
                        <span style="font-size:0.9rem; font-weight:800; color:#0f172a;">Efectivo Esperado Real</span>
                        <span style="font-size:1.8rem; font-weight:900; color:#059669; letter-spacing:-1px;">${formatCLP(summary.expectedCash)}</span>
                    </div>
                    <button onclick="CashView.showPaymentMethods()"
                            style="margin-top:0.875rem; width:100%; padding:0.6rem; background:#ecfdf5; color:#059669; border:1.5px solid #6ee7b7; border-radius:0.625rem; font-weight:700; font-size:0.82rem; cursor:pointer; transition:background 0.18s;"
                            onmouseover="this.style.background='#d1fae5'" onmouseout="this.style.background='#ecfdf5'">
                        📊 Ver Todos los Métodos de Pago
                    </button>
                </div>

                <!-- Métodos de pago no-efectivo -->
                <div class="cx-section" style="animation-delay:0.21s; border-left:4px solid #3b82f6;">
                    <div class="cx-section-title">💳 Métodos de Pago (No Efectivo)</div>

                    ${(() => {
                        const cardAmt  = summary.paymentSummary?.card  || 0;
                        const qrAmt   = summary.paymentSummary?.qr    || 0;
                        const othAmt  = summary.paymentSummary?.other  || 0;
                        const nonCashTotal = cardAmt + qrAmt + othAmt;
                        const pctCard = nonCashTotal > 0 ? (cardAmt / nonCashTotal * 100) : 0;
                        const pctQr   = nonCashTotal > 0 ? (qrAmt   / nonCashTotal * 100) : 0;
                        const pctOth  = nonCashTotal > 0 ? (othAmt  / nonCashTotal * 100) : 0;
                        return [
                            { icon:'💳', lbl:'Tarjeta',      amt:cardAmt, pct:pctCard, color:'#3b82f6' },
                            { icon:'📱', lbl:'QR / Digital', amt:qrAmt,   pct:pctQr,   color:'#8b5cf6' },
                            { icon:'🏦', lbl:'Otro/Transf.', amt:othAmt,  pct:pctOth,  color:'#64748b' }
                        ].map(m => `
                            <div style="margin-bottom:0.875rem;">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
                                    <span style="font-size:0.83rem; font-weight:700; color:#374151;">${m.icon} ${m.lbl}</span>
                                    <span style="font-size:0.9rem; font-weight:800; color:${m.color};">${formatCLP(m.amt)}</span>
                                </div>
                                <div class="cx-pay-bar-wrap">
                                    <div class="cx-pay-bar" style="width:${m.pct.toFixed(1)}%; background:${m.color};"></div>
                                </div>
                            </div>
                        `).join('');
                    })()}

                </div>
            </div>

            <!-- ===== OPERACIONES DE LA SESIÓN ===== -->
            <div style="font-size:0.88rem; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:1px; margin-bottom:0.875rem; display:flex; align-items:center; gap:0.5rem; animation: cxFadeUp 0.3s ease both; animation-delay:0.25s;">
                📋 Operaciones Complementarias del Turno
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(220px,1fr)); gap:1rem;">

                <div class="cx-total-card" onclick="CashView.showClientesPagaron()">
                    <div class="cx-total-icon" style="background:#ecfdf5;">💰</div>
                    <div style="flex:1;">
                        <div class="cx-total-lbl">Deudas Cobradas</div>
                        <div class="cx-total-val" style="color:#059669;">${formatCLP(summary.totalDebtPayments)}</div>
                        <div class="cx-total-foot">${summary.debtPayments.length} abonos recibidos</div>
                    </div>
                </div>

                <div class="cx-total-card" onclick="CashView.showMovimientosManuales()">
                    <div class="cx-total-icon" style="background:#fffbeb;">🔁</div>
                    <div style="flex:1;">
                        <div class="cx-total-lbl">Ingresos y Retiros</div>
                        <div style="display:flex; gap:0.75rem; margin-top:0.2rem;">
                            <span style="font-size:1rem; font-weight:800; color:#059669;">+${formatCLP(summary.totalCashIn)}</span>
                            <span style="font-size:1rem; font-weight:800; color:#dc2626;">-${formatCLP(summary.totalRetiros)}</span>
                        </div>
                        <div class="cx-total-foot">Gestión manual de efectivo</div>
                    </div>
                </div>

                <div class="cx-total-card" onclick="CashView.showHistorialVentasSesion()">
                    <div class="cx-total-icon" style="background:#eff6ff;">📜</div>
                    <div style="flex:1;">
                        <div class="cx-total-lbl">Historial de Tickets</div>
                        <div class="cx-total-val" style="color:#3b82f6;">${summary.totalSales} tickets</div>
                        <div class="cx-total-foot">Ver detalle completo</div>
                    </div>
                </div>

            </div>

                <div class="cx-total-card" onclick="CashView.showMovimientosManuales()">
                    <div class="cx-total-icon" style="background:#fffbeb;">🔁</div>
                    <div style="flex:1;">
                        <div class="cx-total-lbl">Ingresos y Retiros</div>
                        <div style="display:flex; gap:0.75rem; margin-top:0.2rem;">
                            <span style="font-size:1rem; font-weight:800; color:#059669;">+${formatCLP(summary.totalCashIn)}</span>
                            <span style="font-size:1rem; font-weight:800; color:#dc2626;">-${formatCLP(summary.totalRetiros)}</span>
                        </div>
                        <div class="cx-total-foot">Gestión manual de efectivo</div>
                    </div>
                </div>

            </div>
        `;
    },

    // --- DETALLE EN MODAL ---

    showVentasHoy() {
        const todayKey = new Date().toLocaleDateString('es-CL');
        const day = this._dailyDetail.find(d => d.date === todayKey);
        if (!day || day.sales.length === 0) {
            showNotification('No hay ventas registradas hoy', 'info');
            return;
        }

        const html = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr><th>Hora</th><th>Nº Venta</th><th>Total</th><th>Pago</th><th>Estado</th></tr>
                    </thead>
                    <tbody>
                        ${day.sales.map(s => `
                            <tr>
                                <td>${formatTime(s.date)}</td>
                                <td>#${s.saleNumber ?? s.id}</td>
                                <td><strong>${formatCLP(s.total)}</strong></td>
                                <td>${this.getPaymentMethodName(s.paymentMethod)}</td>
                                <td>${this.getStatusLabel(s.status)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        showModal(html, { title: 'Ventas de Hoy', width: '700px' });
    },

    showDeudasHoy() {
        const todayKey = new Date().toLocaleDateString('es-CL');
        const day = this._dailyDetail.find(d => d.date === todayKey);
        if (!day || day.creditSales.length === 0) {
            showNotification('No hay deudas generadas hoy', 'info');
            return;
        }

        const html = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr><th>Hora</th><th>Cliente</th><th>Total Venta</th><th>Abonado</th><th>Deuda Restante</th></tr>
                    </thead>
                    <tbody>
                        ${day.creditSales.map(d => `
                            <tr>
                                <td>${formatTime(d.date)}</td>
                                <td><strong>${d.customerName}</strong></td>
                                <td>${formatCLP(d.total)}</td>
                                <td>${formatCLP(d.paidAmount)}</td>
                                <td style="color: var(--danger);"><strong>${formatCLP(d.remaining)}</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        showModal(html, { title: 'Nuevas Deudas del Día (Fiados)', width: '750px' });
    },

    showHistorialVentasSesion() {
        // Agrupar todas las ventas de la sesión
        const allSales = (this._dailyDetail || []).flatMap(d => d.sales || []).sort((a, b) => new Date(b.date || b.created_at || 0) - new Date(a.date || a.created_at || 0));

        const html = `
            <div style="background: #0f172a; padding: 1.5rem; border-radius: 1.5rem; color: #f8fafc;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; background: rgba(30, 41, 59, 0.6); padding: 1.25rem 1.5rem; border-radius: 1rem; border: 1px solid rgba(255,255,255,0.08);">
                    <div>
                        <h3 style="margin: 0; color: #ffffff; font-size: 1.25rem; font-weight: 800;">🛍️ Todas las Ventas de la Sesión</h3>
                        <p style="margin: 0.25rem 0 0 0; color: #94a3b8; font-size: 0.82rem;">Listado completo de tickets emitidos en este turno</p>
                    </div>
                    <div style="text-align: right;">
                        <div style="color: #10b981; font-size: 1.5rem; font-weight: 900;">${formatCLP(this._activeSummary?.totalSalesAmount || 0)}</div>
                        <div style="color: #64748b; font-size: 0.72rem; font-weight: 800; text-transform: uppercase;">Total Acumulado</div>
                    </div>
                </div>
                
                <div style="max-height: 60vh; overflow-y: auto; overflow-x: hidden; padding-right: 0.25rem; scrollbar-width: thin;">
                    <table style="width: 100%; border-collapse: collapse; background: #0f172a;">
                        <thead style="position: sticky; top: 0; background: #1e293b; z-index: 10; border-radius: 0.5rem;">
                            <tr>
                                <th style="padding: 0.85rem 1rem; color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; font-weight: 900; text-align: left;">Fecha / Hora</th>
                                <th style="padding: 0.85rem 1rem; color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; font-weight: 900; text-align: center;">Nº Ticket</th>
                                <th style="padding: 0.85rem 1rem; color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; font-weight: 900; text-align: center;">Método</th>
                                <th style="padding: 0.85rem 1rem; color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; font-weight: 900; text-align: right;">Total</th>
                                <th style="padding: 0.85rem 1rem; color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; font-weight: 900; text-align: center;">Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${allSales.map((s, idx) => {
                                const rawDate = s.date || s.created_at;
                                const formatted = rawDate ? formatDateTime(rawDate) : '--';
                                const parts = formatted.includes(' ') ? formatted.split(' ') : [formatted, ''];
                                const timeStr = parts.length > 1 ? parts.slice(1).join(' ') : (parts[0] || '--:--');
                                const dateStr = parts[0] || '';
                                const ticketNum = (s.saleNumber !== undefined && s.saleNumber !== null && s.saleNumber !== '') ? `#${s.saleNumber}` : `#${s.id || idx + 1}`;
                                const isMixed = s.paymentMethod === 'mixed';
                                const methodLabel = isMixed ? '🔀 Mixto' : this.getPaymentMethodName(s.paymentMethod || 'cash');

                                return `
                                <tr style="background: ${idx % 2 === 0 ? 'rgba(30, 41, 59, 0.5)' : 'rgba(15, 23, 42, 0.7)'}; border-bottom: 1px solid rgba(255,255,255,0.06); transition: background 0.15s;">
                                    <td style="padding: 0.75rem 1rem; color: #f1f5f9; vertical-align: middle;">
                                        <div style="font-weight: 800; font-size: 0.95rem; color: #f8fafc;">${timeStr}</div>
                                        <div style="font-size: 0.72rem; color: #64748b; font-weight: 600;">${dateStr}</div>
                                    </td>
                                    <td style="padding: 0.75rem 1rem; text-align: center; color: #ffffff; font-weight: 900; font-size: 1rem; vertical-align: middle;">
                                        <span style="background: rgba(255,255,255,0.08); padding: 0.25rem 0.6rem; border-radius: 0.4rem; border: 1px solid rgba(255,255,255,0.1);">${ticketNum}</span>
                                    </td>
                                    <td style="padding: 0.75rem 1rem; text-align: center; vertical-align: middle;">
                                        <span style="background: ${isMixed ? 'rgba(245, 158, 11, 0.15)' : 'rgba(99, 102, 241, 0.15)'}; color: ${isMixed ? '#fbbf24' : '#a5b4fc'}; border: 1px solid ${isMixed ? 'rgba(245, 158, 11, 0.3)' : 'rgba(99, 102, 241, 0.3)'}; padding: 0.3rem 0.65rem; border-radius: 0.5rem; font-size: 0.78rem; font-weight: 800;">
                                            ${methodLabel}
                                        </span>
                                    </td>
                                    <td style="padding: 0.75rem 1rem; text-align: right; color: #10b981; font-weight: 950; font-size: 1.15rem; vertical-align: middle;">
                                        ${formatCLP(s.total)}
                                    </td>
                                    <td style="padding: 0.75rem 1rem; text-align: center; vertical-align: middle;">
                                        <button class="btn" style="background: rgba(99, 102, 241, 0.2); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.35); padding: 0.35rem 0.75rem; border-radius: 0.5rem; font-size: 0.75rem; font-weight: 800; cursor: pointer;" onclick="CashView.showSaleDetail(${s.id})">🔍 Detalle</button>
                                    </td>
                                </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        showModal(html, { title: '', footer: `<button class="btn" style="background: #1e293b; color: #94a3b8; border: 1px solid rgba(255,255,255,0.1); padding: 0.75rem 2rem; border-radius: 0.75rem; font-weight: 800; cursor: pointer;" onclick="closeModal()">Cerrar</button>`, width: '820px' });
    },

    showClientesPagaron() {
        const allPayments = this._dailyDetail.flatMap(d => d.debtPayments)
            .filter(p => (p.paymentMethod || 'cash') !== 'discount')
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        if (allPayments.length === 0) {
            showNotification('No hay abonos de deuda en esta sesión', 'info');
            return;
        }

        const customerMap = new Map();
        allPayments.forEach(p => {
            const key = p.customerId || p.customerName || 'Cliente General';
            const existing = customerMap.get(key) || {
                name: p.customerName || 'Cliente General',
                totalAmount: 0,
                count: 0,
                methods: new Set()
            };
            existing.totalAmount += parseFloat(p.amount) || 0;
            existing.count += 1;
            existing.methods.add(this.getPaymentMethodName(p.paymentMethod || 'cash'));
            customerMap.set(key, existing);
        });

        const groupedList = Array.from(customerMap.values());
        const totalCollected = groupedList.reduce((sum, c) => sum + c.totalAmount, 0);

        const html = `
            <div style="margin-bottom: 1rem; padding: 1.25rem; background: rgba(16, 185, 129, 0.08); border: 1.5px solid rgba(16, 185, 129, 0.3); border-radius: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <span style="font-size: 0.8rem; color: #059669; font-weight: 700; text-transform: uppercase;">Total Cobrado de Deudas</span>
                    <div style="color: #059669; font-size: 1.6rem; font-weight: 900;">${formatCLP(totalCollected)}</div>
                </div>
                <div style="font-size: 0.85rem; color: var(--secondary); text-align: right;">
                    <strong>${groupedList.length}</strong> cliente(s) pagaron o abonaron en este turno
                </div>
            </div>

            <div class="table-container" style="max-height: 450px; overflow-y: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--border); text-align: left; font-size: 0.8rem; color: var(--secondary); text-transform: uppercase;">
                            <th style="padding: 0.75rem;">Cliente</th>
                            <th style="padding: 0.75rem; text-align: center;">N° de Abonos</th>
                            <th style="padding: 0.75rem;">Método(s) Usado(s)</th>
                            <th style="padding: 0.75rem; text-align: right;">Total Abonado</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${groupedList.map(c => `
                            <tr style="border-bottom: 1px solid var(--border);">
                                <td style="padding: 0.75rem; font-weight: 800; color: var(--text-main);">${c.name}</td>
                                <td style="padding: 0.75rem; text-align: center;"><span class="badge badge-success">${c.count} abono(s)</span></td>
                                <td style="padding: 0.75rem; font-size: 0.85rem; color: var(--secondary);">${Array.from(c.methods).join(', ')}</td>
                                <td style="padding: 0.75rem; text-align: right; color: #10b981; font-weight: 900; font-size: 1.05rem;">+${formatCLP(c.totalAmount)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        showModal(html, { title: '🤝 Clientes que Pagaron Deuda (Resumen del Turno)', width: '720px' });
    },

    showAnotadosSesion() {
        const allCredits = this._dailyDetail.flatMap(d => d.creditSales).sort((a, b) => new Date(b.date) - new Date(a.date));
        if (allCredits.length === 0) {
            showNotification('No hay ventas a crédito en esta sesión', 'info');
            return;
        }

        const html = `
            <div class="table-container" style="max-height: 500px; overflow-y: auto;">
                <table>
                    <thead>
                        <tr><th>Fecha/Hora</th><th>Cliente</th><th>Total Venta</th><th>Anotado a Deuda</th></tr>
                    </thead>
                    <tbody>
                        ${allCredits.map(d => `
                            <tr>
                                <td>${formatDateTime(d.date)}</td>
                                <td><strong>${d.customerName}</strong></td>
                                <td>${formatCLP(d.total)}</td>
                                <td style="color: #f87171;"><strong>${formatCLP(d.remaining)}</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        showModal(html, { title: 'Historial de Ventas Fiadas (Anotados)', width: '750px' });
    },

    showMovimientosManuales() {
        const ins = this._dailyDetail.flatMap(d => d.cashMovementsIn);
        const outs = this._dailyDetail.flatMap(d => d.cashMovementsOut);

        const html = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div style="padding:1rem; background: rgba(52, 211, 153, 0.1); border-radius: 0.5rem; border: 1px solid rgba(52, 211, 153, 0.2);">
                    <small>Ingresos</small>
                    <div style="font-size: 1.5rem; font-weight: 800; color: #34d399;">+${formatCLP(this._activeSummary.totalCashIn || 0)}</div>
                </div>
                <div style="padding:1rem; background: rgba(248, 113, 113, 0.1); border-radius: 0.5rem; border: 1px solid rgba(248, 113, 113, 0.2);">
                    <small>Retiros</small>
                    <div style="font-size: 1.5rem; font-weight: 800; color: #f87171;">-${formatCLP(this._activeSummary.totalRetiros || 0)}</div>
                </div>
            </div>
            
            <h4 style="margin: 1.5rem 0 1rem 0;">Historial de Movimientos</h4>
            <div class="table-container" style="max-height: 400px; overflow-y: auto;">
                <table>
                    <thead>
                        <tr><th>Fecha/Hora</th><th>Tipo</th><th>Monto</th><th>Motivo</th></tr>
                    </thead>
                    <tbody>
                        ${[...ins, ...outs].sort((a, b) => new Date(b.date) - new Date(a.date)).map(m => {
            const isIn = ins.includes(m);
            return `
                                <tr>
                                    <td>${formatDateTime(m.date)}</td>
                                    <td><span class="badge ${isIn ? 'badge-success' : 'badge-warning'}">${isIn ? 'Ingreso' : 'Retiro'}</span></td>
                                    <td style="color: ${isIn ? '#34d399' : '#f87171'}; font-weight: 700;">
                                        ${isIn ? '+' : '-'}${formatCLP(m.amount)}
                                    </td>
                                    <td style="font-size: 0.9rem; opacity: 0.8;">${m.description || m.reason || '-'}</td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
        showModal(html, { title: 'Movimientos Manuales de Efectivo', width: '750px' });
    },

    showPaymentMethods() {
        const s = this._activeSummary;
        // cashDisplay es el NETO de operaciones (sin monto inicial)
        const cashDisplay = s.cashForDisplay ?? ((s.paymentSummary?.cash || 0) + (s.totalCashIn || 0) - (s.totalRetiros || 0));

        const html = `
            <div style="text-align: center; margin-bottom: 2rem;">
                <p style="color: var(--secondary); margin-bottom: 0.5rem;">Resumen de Efectivo Real en Caja</p>
                <div style="font-size: 2.5rem; font-weight: 900; color: #34d399;">${formatCLP(s.expectedCash)}</div>
                <small style="opacity: 0.7;">Efectivo total que debe haber físicamente</small>
            </div>

            <div class="table-container">
                <table>
                    <thead>
                        <tr><th>Componente de Efectivo</th><th style="text-align: right;">Monto</th></tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>💰 Monto de Apertura (Inicial)</td>
                            <td style="text-align: right;"><strong>${formatCLP(s.initialAmount)}</strong></td>
                        </tr>
                        <tr>
                            <td>🛍️ Ventas y Cobros en Efectivo</td>
                            <td style="text-align: right;"><strong>+${formatCLP(s.paymentSummary?.cash || 0)}</strong></td>
                        </tr>
                        <tr>
                            <td>📥 Ingresos Manuales de Dinero</td>
                            <td style="text-align: right; color: #34d399;"><strong>+${formatCLP(s.totalCashIn || 0)}</strong></td>
                        </tr>
                        <tr>
                            <td>📦 Compras Pagadas desde Caja</td>
                            <td style="text-align: right; color: #f87171;"><strong>-${formatCLP(s.totalCashPurchases || 0)}</strong></td>
                        </tr>
                        <tr>
                            <td>📤 Retiros Manuales y Gastos de Caja</td>
                            <td style="text-align: right; color: #f87171;"><strong>-${formatCLP((s.totalRetiros || 0) - (s.totalCashPurchases || 0))}</strong></td>
                        </tr>
                        <tr style="border-top: 2px solid var(--border); font-size: 1.1rem; background: rgba(255,255,255,0.02);">
                            <td><strong style="color: #6ee7b7;">SUBTOTAL OPERACIONES</strong></td>
                            <td style="text-align: right; color: #6ee7b7;"><strong>${formatCLP(cashDisplay)}</strong></td>
                        </tr>
                        <tr style="border-top: 2px solid var(--primary); font-size: 1.3rem;">
                            <td><strong>TOTAL ESPERADO</strong></td>
                            <td style="text-align: right; color: #34d399;"><strong>${formatCLP(s.expectedCash)}</strong></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <h4 style="margin: 2rem 0 1rem 0; opacity: 0.8;">Otros Métodos (No Efectivo)</h4>
            <div class="table-container">
                <table>
                    <thead>
                        <tr><th>Método</th><th style="text-align: right;">Total Recibido</th></tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>💳 Tarjeta</td>
                            <td style="text-align: right;"><strong>${formatCLP(s.paymentSummary?.card || 0)}</strong></td>
                        </tr>
                        <tr>
                            <td>📱 QR / Digital</td>
                            <td style="text-align: right;"><strong>${formatCLP(s.paymentSummary?.qr || 0)}</strong></td>
                        </tr>
                        <tr>
                            <td>➕ Otro / Transferencia</td>
                            <td style="text-align: right;"><strong>${formatCLP(s.paymentSummary?.other || 0)}</strong></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(52, 211, 153, 0.05); border: 1px dashed rgba(52, 211, 153, 0.2); border-radius: 0.5rem; font-size: 0.85rem; color: #6ee7b7;">
                ℹ️ <strong>Cuadratura:</strong> El Efectivo Esperado Real es la suma del Monto Inicial más el neto de todas las operaciones realizadas en efectivo durante la sesión.
            </div>
        `;
        showModal(html, { title: 'Desglose detallado de Caja', width: '600px' });
    }
    ,

    getStatusLabel(status) {
        return { completed: 'Completada', partial: 'Con abono', pending: 'Anotada' }[status] || status || '-';
    },

    renderRegistroMovimientos(dailyDetail) {
        if (!dailyDetail || dailyDetail.length === 0) {
            return '<div class="empty-state"><p>No hay movimientos en esta sesión</p></div>';
        }
        const todayDate = new Date().toLocaleDateString('es-CL');
        const paymentMethodLabel = (m) => ({ cash: 'Efectivo', card: 'Tarjeta', qr: 'QR', other: 'Otro', pending: 'Anotado' }[m] || m || '-');
        const salePaymentDisplay = (s) => {
            if (s.paymentDetails && typeof s.paymentDetails === 'object' && Object.keys(s.paymentDetails).length > 0) return 'Mixto';
            return paymentMethodLabel(s.paymentMethod);
        };
        const statusLabel = (s) => ({ completed: 'Completada', partial: 'Con abono', pending: 'Anotada' }[s.status] || s.status || '-');
        return dailyDetail.map(day => {
            const isToday = day.date === todayDate;
            const dayStyle = isToday ? 'border-left: 4px solid var(--success);' : '';
            const dayBadge = isToday ? ' <span class="badge badge-success" style="font-size: 0.75em;">HOY</span>' : '';
            let html = `
                <div style="margin-bottom: 2rem; padding: 1rem; background: var(--light); border-radius: 0.5rem; ${dayStyle}">
                    <h4 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">📅 ${day.date}${dayBadge}</h4>
            `;
            html += `
                    <div style="margin-bottom: 1.5rem;">
                        <h5 style="color: var(--success); margin-bottom: 0.5rem;">🛒 Ventas</h5>
                        ${day.sales.length === 0 ? '<p style="color: var(--secondary); font-size: 0.9rem;">Sin ventas este día</p>' : `
                        <div class="table-container" style="max-height: 200px; overflow-y: auto;">
                            <table style="font-size: 0.9rem;">
                                <thead><tr><th>Nº Venta</th><th>Total</th><th>Método de pago</th><th>Estado</th></tr></thead>
                                <tbody>
                                    ${day.sales.map(s => `<tr><td>#${s.saleNumber ?? s.id}</td><td>${formatCLP(s.total)}</td><td>${salePaymentDisplay(s)}</td><td>${statusLabel(s)}</td></tr>`).join('')}
                                </tbody>
                            </table>
                        </div>
                        `}
                    </div>
                    <div style="margin-bottom: 1.5rem;">
                        <h5 style="color: var(--primary); margin-bottom: 0.5rem;">💰 Pago de deudas</h5>
                        ${day.debtPayments.length === 0 ? '<p style="color: var(--secondary); font-size: 0.9rem;">Sin pagos de deuda este día</p>' : `
                        <div class="table-container" style="max-height: 200px; overflow-y: auto;">
                            <table style="font-size: 0.9rem;">
                                <thead><tr><th>Cliente</th><th>Monto</th><th>Método</th></tr></thead>
                                <tbody>
                                    ${day.debtPayments.map(p => `<tr><td>${p.customerName}</td><td>${formatCLP(p.amount)}</td><td>${paymentMethodLabel(p.paymentMethod)}</td></tr>`).join('')}
                                </tbody>
                            </table>
                        </div>
                        `}
                    </div>
                    <div style="margin-bottom: 1.5rem;">
                        <h5 style="color: #b45309; margin-bottom: 0.5rem;">📝 Deudas</h5>
                        ${day.creditSales.length === 0 ? '<p style="color: var(--secondary); font-size: 0.9rem;">Sin ventas a crédito este día</p>' : `
                        <div class="table-container" style="max-height: 200px; overflow-y: auto;">
                            <table style="font-size: 0.9rem;">
                                <thead><tr><th>Cliente</th><th>Total anotado</th><th>Deuda restante</th></tr></thead>
                                <tbody>
                                    ${day.creditSales.map(d => `<tr><td>${d.customerName}</td><td>${formatCLP(d.total)}</td><td><strong>${formatCLP(d.remaining)}</strong></td></tr>`).join('')}
                                </tbody>
                            </table>
                        </div>
                        `}
                    </div>
                    <div style="margin-bottom: 1.5rem;">
                        <h5 style="color: var(--warning); margin-bottom: 0.5rem;">⬇️ Retiro de dinero</h5>
                        ${day.cashMovementsOut.length === 0 ? '<p style="color: var(--secondary); font-size: 0.9rem;">Sin retiros este día</p>' : `
                        <div class="table-container" style="max-height: 200px; overflow-y: auto;">
                            <table style="font-size: 0.9rem;">
                                <thead><tr><th>Monto</th><th>Motivo</th><th>Fecha y hora</th></tr></thead>
                                <tbody>
                                    ${day.cashMovementsOut.map(m => `<tr><td><strong style="color: var(--warning);">-${formatCLP(m.amount)}</strong></td><td>${m.description || m.reason || '-'}</td><td>${formatDateTime(m.date)}</td></tr>`).join('')}
                                </tbody>
                            </table>
                        </div>
                        `}
                    </div>
                    <div style="margin-bottom: 0;">
                        <h5 style="color: var(--secondary); margin-bottom: 0.5rem;">⬆️ Ingreso de dinero</h5>
                        ${day.cashMovementsIn.length === 0 ? '<p style="color: var(--secondary); font-size: 0.9rem;">Sin ingresos este día</p>' : `
                        <div class="table-container" style="max-height: 200px; overflow-y: auto;">
                            <table style="font-size: 0.9rem;">
                                <thead><tr><th>Monto</th><th>Motivo</th><th>Fecha y hora</th></tr></thead>
                                <tbody>
                                    ${day.cashMovementsIn.map(m => `<tr><td><strong style="color: var(--success);">+${formatCLP(m.amount)}</strong></td><td>${m.description || m.reason || '-'}</td><td>${formatDateTime(m.date)}</td></tr>`).join('')}
                                </tbody>
                            </table>
                        </div>
                        `}
                    </div>
                </div>
            `;
            return html;
        }).join('');
    },

    filterRegistroByDate(dateStr) {
        const contentEl = document.getElementById('registro-movimientos-content');
        if (!contentEl) return;
        const detail = CashView._dailyDetail;
        if (!detail || !Array.isArray(detail)) {
            contentEl.innerHTML = '<div class="empty-state"><p>No hay datos de movimientos</p></div>';
            return;
        }
        const dateKey = dateStr ? new Date(dateStr + 'T12:00:00').toLocaleDateString('es-CL') : new Date().toLocaleDateString('es-CL');
        const day = detail.find(d => d.date === dateKey);
        const emptyDay = { date: dateKey, sales: [], debtPayments: [], creditSales: [], cashMovementsOut: [], cashMovementsIn: [] };
        const toShow = day ? [day] : [emptyDay];
        contentEl.innerHTML = this.renderRegistroMovimientos(toShow);
    },

    renderRecentSales(sales) {
        if (sales.length === 0) {
            return '<div class="empty-state">No hay ventas</div>';
        }

        return `
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Hora</th>
                        <th>Items</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${sales.map(s => `
                        <tr>
                            <td>${s.saleNumber}</td>
                            <td>${formatTime(s.date)}</td>
                            <td>${s.items.length}</td>
                            <td><strong>${formatCLP(s.total)}</strong></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    renderCashHistory(history) {
        if (history.length === 0) return '<div class="empty-state">No hay registros de caja previos</div>';

        const formatDT = (dateVal) => {
            const formatted = formatDateTime(dateVal);
            if (formatted.includes(',')) {
                const parts = formatted.split(',');
                return { date: parts[0].trim(), time: parts[1].trim() };
            }
            const lastSpaceIdx = formatted.lastIndexOf(' ');
            if (lastSpaceIdx !== -1) {
                return {
                    date: formatted.substring(0, lastSpaceIdx).trim(),
                    time: formatted.substring(lastSpaceIdx).trim()
                };
            }
            return { date: formatted, time: '' };
        };

        return `
            <div style="background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 1.5rem; overflow: hidden; margin-top: 1rem;">
                <table class="table-modern" style="width: 100%; border-collapse: separate; border-spacing: 0;">
                    <thead style="background: rgba(15, 23, 42, 0.6);">
                        <tr>
                            <th style="padding: 1.25rem 1rem; color: #94a3b8; font-size: 0.85rem; text-transform: uppercase; font-weight: 800; letter-spacing: 1px;">📅 Apertura (Fecha y Hora)</th>
                            <th style="padding: 1.25rem 1rem; color: #94a3b8; font-size: 0.85rem; text-transform: uppercase; font-weight: 800; letter-spacing: 1px;">🔒 Cierre (Fecha y Hora)</th>
                            <th style="padding: 1.25rem 1rem; color: #94a3b8; font-size: 0.85rem; text-transform: uppercase; font-weight: 800; letter-spacing: 1px;">💰 Inicial</th>
                            <th style="padding: 1.25rem 1rem; color: #94a3b8; font-size: 0.85rem; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; text-align: center;">Ventas</th>
                            <th style="padding: 1.25rem 1rem; color: #94a3b8; font-size: 0.85rem; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; text-align: center;">Estado</th>
                            <th style="padding: 1.25rem 1rem; color: #94a3b8; font-size: 0.85rem; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; text-align: right;">Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${history.slice(0, 10).map(c => {
                            const totalVentas = c.paymentSummary ? Object.values(c.paymentSummary).reduce((a, b) => a + b, 0) : 0;
                            const openInfo = formatDT(c.openDate);
                            const closeInfo = c.closeDate ? formatDT(c.closeDate) : null;
                            return `
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.03); transition: background 0.2s;">
                                <td style="padding: 1.25rem 1rem; color: #f1f5f9; vertical-align: middle;">
                                    <div style="font-size: 1.15rem; font-weight: 800; color: #ffffff;">${openInfo.date}</div>
                                    <div style="font-size: 1rem; font-weight: 700; color: #60a5fa; margin-top: 0.15rem;">⏰ ${openInfo.time}</div>
                                    <div style="font-size: 0.8rem; color: #94a3b8; font-weight: 600; margin-top: 0.25rem;">Turno #${c.id}</div>
                                </td>
                                <td style="padding: 1.25rem 1rem; color: #94a3b8; vertical-align: middle;">
                                    ${closeInfo ? `
                                        <div style="font-size: 1.15rem; font-weight: 800; color: #cbd5e1;">${closeInfo.date}</div>
                                        <div style="font-size: 1rem; font-weight: 700; color: #94a3b8; margin-top: 0.15rem;">⏰ ${closeInfo.time}</div>
                                    ` : `
                                        <span style="background: rgba(16, 185, 129, 0.15); color: #34d399; padding: 0.4rem 0.8rem; border-radius: 0.75rem; font-weight: 800; font-size: 0.95rem; border: 1px solid rgba(16, 185, 129, 0.3); display: inline-block;">
                                            🔓 Abierta (En curso)
                                        </span>
                                    `}
                                </td>
                                <td style="padding: 1.25rem 1rem; color: #f1f5f9; font-weight: 700; font-size: 1.1rem; vertical-align: middle;">
                                    ${formatCLP(c.initialAmount)}
                                </td>
                                <td style="padding: 1.25rem 1rem; text-align: center; vertical-align: middle;">
                                    <div style="color: #34d399; font-weight: 800; font-size: 1.1rem;">${totalVentas > 0 ? '+' : ''}${formatCLP(totalVentas)}</div>
                                </td>
                                <td style="padding: 1.25rem 1rem; text-align: center; vertical-align: middle;">
                                    <span class="badge ${c.status === 'open' ? 'badge-success' : 'badge-info'}" style="padding: 0.4rem 0.8rem; border-radius: 2rem; font-size: 0.85rem; font-weight: 800;">
                                        ${c.status === 'open' ? 'Activa' : 'Cerrada'}
                                    </span>
                                </td>
                                <td style="padding: 1.25rem 1rem; text-align: right; vertical-align: middle;">
                                    <button class="btn btn-sm" onclick="CashView.showCashHistory('${c.id}')" style="background: rgba(99, 102, 241, 0.15); color: #a5b4fc; border: 1.5px solid rgba(99, 102, 241, 0.3); font-weight: 800; border-radius: 0.75rem; padding: 0.5rem 1rem; font-size: 0.9rem; transition: all 0.2s;" onmouseover="this.style.background='rgba(99, 102, 241, 0.3)'" onmouseout="this.style.background='rgba(99, 102, 241, 0.15)'">
                                        📋 Historial
                                    </button>
                                </td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    async showCashHistory(cashRegisterId) {
        const cashRegister = await CashRegister.getById(cashRegisterId);
        if (!cashRegister) {
            showNotification('Caja no encontrada', 'error');
            return;
        }

        const summary = await CashRegister.getSummary(cashRegisterId);

        // Obtener todos los datos relacionados con la caja
        const sales = await Sale.getByCashRegister(cashRegisterId);
        const payments = await Payment.getByCashRegister(cashRegisterId);
        const cashMovements = await CashMovement.getByCashRegister(cashRegisterId);

        // Crear lista de eventos cronológica
        const events = [];

        // 1. Apertura de caja
        events.push({
            type: 'open',
            date: cashRegister.openDate,
            amount: 0,
            description: 'Apertura de caja',
            icon: '🔓',
            color: '#10b981'
        });

        // 2. Ventas
        sales.forEach(sale => {
            events.push({
                type: 'sale',
                date: sale.date,
                amount: sale.total,
                saleNumber: sale.saleNumber,
                description: `Venta #${sale.saleNumber}`,
                details: `${sale.items.length} items - ${this.getPaymentMethodName(sale.paymentMethod)}`,
                icon: '💰',
                color: '#6366f1',
                saleId: sale.id
            });
        });

        // 3. Pagos de deuda
        for (const payment of payments) {
            let customerName = 'Cliente';
            if (payment.customerId) {
                try {
                    const customer = await Customer.getById(payment.customerId);
                    customerName = customer ? customer.name : 'Cliente';
                } catch (e) {
                    console.error('Error obteniendo cliente:', e);
                }
            }

            events.push({
                type: 'payment',
                date: payment.date,
                amount: payment.amount,
                description: `Pago de deuda - ${customerName}`,
                details: `${this.getPaymentMethodName(payment.paymentMethod)}${payment.notes ? ' - ' + payment.notes : ''}`,
                icon: '💵',
                color: '#10b981',
                paymentId: payment.id
            });
        }

        // 5. Movimientos manuales
        cashMovements.forEach(movement => {
            if (!movement.saleId && !movement.paymentId && !movement.expenseId) {
                events.push({
                    type: movement.type === 'in' ? 'cash_in' : 'cash_out',
                    date: movement.date,
                    amount: movement.type === 'in' ? movement.amount : -movement.amount,
                    description: movement.description || movement.reason || (movement.type === 'in' ? 'Entrada de dinero' : 'Salida de dinero'),
                    details: movement.type === 'in' ? 'Agregado a caja' : 'Retirado de caja',
                    icon: movement.type === 'in' ? '➕' : '➖',
                    color: movement.type === 'in' ? '#10b981' : '#f59e0b',
                    movementId: movement.id
                });
            }
        });

        // 6. Cierre
        if (cashRegister.closeDate) {
            events.push({
                type: 'close',
                date: cashRegister.closeDate,
                amount: 0,
                description: 'Cierre de caja',
                details: `Esperado: ${formatCLP(cashRegister.expectedAmount)} | Diferencia: ${formatCLP(cashRegister.difference || 0)}`,
                icon: '🔒',
                color: '#94a3b8'
            });
        }

        // Ordenar: Apertura -> Otros eventos por hora -> Cierre (si existe)
        events.sort((a, b) => {
            if (a.type === 'open') return -1;
            if (b.type === 'open') return 1;
            if (a.type === 'close') return 1;
            if (b.type === 'close') return -1;
            return new Date(a.date) - new Date(b.date);
        });

        let runningBalance = cashRegister.initialAmount;
        events.forEach(event => {
            event.balanceBefore = runningBalance;
            if (event.type !== 'open' && event.type !== 'close') {
                runningBalance += event.amount;
            }
            event.balanceAfter = runningBalance;
        });

        const eventsHTML = events.map((event, idx) => {
            const styles = this.getEventStyles(event.type);
            const isLast = idx === events.length - 1;
            
            let amountHTML = '';
            if (event.amount !== 0 || event.type === 'sale') {
                const isNegative = event.amount < 0 || event.type === 'expense' || event.type === 'cash_out';
                const color = isNegative ? '#f87171' : '#34d399';
                const prefix = isNegative ? '' : '+';
                amountHTML = `<div style="font-weight: 800; color: ${color}; font-size: 1.2rem; font-family: 'JetBrains Mono', monospace;">${prefix}${formatCLP(event.amount)}</div>`;
            }

            let detailButton = '';
            if (event.type === 'sale' && event.saleId) {
                detailButton = `<button class="btn" onclick="CashView.showSaleDetail(${event.saleId})" style="margin-top: 0.75rem; padding: 0.5rem 1rem; font-size: 0.75rem; border-radius: 0.75rem; background: rgba(99, 102, 241, 0.1); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.2); font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;"><span>🔍</span> Ver Detalle Venta</button>`;
            }

            return `
                <div style="display: flex; gap: 1.5rem; position: relative; padding-bottom: ${isLast ? '0' : '2rem'};">
                    ${!isLast ? `<div style="position: absolute; left: 24px; top: 48px; bottom: 0; width: 2px; background: rgba(255,255,255,0.05);"></div>` : ''}
                    
                    <div style="width: 50px; height: 50px; border-radius: 50%; background: ${styles.bgColor}; color: ${styles.color}; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; flex-shrink: 0; box-shadow: 0 0 15px ${styles.bgColor}; z-index: 1;">
                        ${styles.icon}
                    </div>

                    <div style="flex: 1; background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 1.25rem; padding: 1.5rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
                            <div>
                                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.25rem;">
                                    <span style="font-weight: 800; color: #f8fafc; font-size: 1.1rem;">${event.description}</span>
                                    ${event.saleNumber ? `<span style="background: rgba(99, 102, 241, 0.1); color: #818cf8; padding: 0.2rem 0.5rem; border-radius: 0.4rem; font-size: 0.7rem; font-weight: 800;">#${event.saleNumber}</span>` : ''}
                                </div>
                                <div style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 0.5rem;">${event.details || ''}</div>
                                <div style="display: flex; align-items: center; gap: 1rem;">
                                    <span style="font-size: 0.75rem; color: #64748b; font-weight: 600; background: rgba(0,0,0,0.2); padding: 0.25rem 0.6rem; border-radius: 1rem;">⏰ ${formatDateTime(event.date).split(' ')[1]}</span>
                                    <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">Balance: <strong style="color: #94a3b8;">${formatCLP(event.balanceAfter)}</strong></span>
                                </div>
                                ${detailButton}
                            </div>
                            <div style="text-align: right;">
                                ${amountHTML}
                                <div style="font-size: 0.65rem; color: #64748b; margin-top: 0.4rem; text-transform: uppercase; letter-spacing: 1px; font-weight: 800; background: rgba(255,255,255,0.03); padding: 0.2rem 0.5rem; border-radius: 0.4rem; display: inline-block;">${styles.label}</div>
                            </div>
                        </div>
                    </div>
                </div>`;
        }).join('');

        const content = `
            <div style="padding: 1rem; background: #0f172a; border-radius: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; padding: 2.5rem; background: linear-gradient(135deg, #1e293b, #0f172a); border-radius: 1.5rem; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
                    <div>
                        <div style="color: #6366f1; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; font-size: 0.8rem; margin-bottom: 0.5rem;">Resumen de Transacciones</div>
                        <h2 style="margin: 0; font-size: 2.2rem; font-weight: 900; color: white;">Sesión de Caja #${cashRegister.id}</h2>
                        <div style="display: flex; align-items: center; gap: 1.5rem; margin-top: 1rem;">
                            <div style="display: flex; align-items: center; gap: 0.5rem; color: #94a3b8; font-size: 0.95rem;">
                                <span style="font-size: 1.2rem;">📅</span> <span>${formatDateTime(cashRegister.openDate).split(' ')[0]}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.5rem; color: #94a3b8; font-size: 0.95rem;">
                                <span style="font-size: 1.2rem;">👤</span> <span>${cashRegister.username || 'Admin'}</span>
                            </div>
                            <span class="badge ${cashRegister.status === 'open' ? 'badge-success' : 'badge-secondary'}" style="padding: 0.5rem 1rem; border-radius: 2rem; font-weight: 800;">
                                ${cashRegister.status === 'open' ? 'Abierta' : 'Cerrada'}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Fila 1: Cuadratura y Caja Físico -->
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem; padding: 1rem; background: rgba(30, 41, 59, 0.4); border-radius: 1rem; border: 1px solid rgba(255,255,255,0.03);">
                    <div style="text-align: center;">
                        <span style="font-size: 0.65rem; color: #94a3b8; display: block; font-weight: 700; text-transform: uppercase;">💵 Fondo Inicial</span>
                        <strong style="font-size: 1.1rem; color: white; font-weight: 800;">${formatCLP(summary.initialAmount || 0)}</strong>
                    </div>
                    <div style="text-align: center;">
                        <span style="font-size: 0.65rem; color: #94a3b8; display: block; font-weight: 700; text-transform: uppercase;">💸 Efectivo Esperado</span>
                        <strong style="font-size: 1.1rem; color: white; font-weight: 800;">${formatCLP(summary.expectedCash || 0)}</strong>
                    </div>
                    <div style="text-align: center;">
                        <span style="font-size: 0.65rem; color: #94a3b8; display: block; font-weight: 700; text-transform: uppercase;">📥 Efectivo Contado (Cierre)</span>
                        <strong style="font-size: 1.1rem; color: white; font-weight: 800;">${formatCLP(summary.finalAmount || 0)}</strong>
                    </div>
                    <div style="text-align: center;">
                        <span style="font-size: 0.65rem; color: #94a3b8; display: block; font-weight: 700; text-transform: uppercase;">⚖️ Diferencia</span>
                        <strong style="font-size: 1.1rem; color: ${(summary.difference || 0) === 0 ? '#10b981' : ((summary.difference || 0) > 0 ? '#fbbf24' : '#ef4444')}; font-weight: 800;">
                            ${(summary.difference || 0) === 0 ? 'Cuadra Exacto' : formatCLP(summary.difference)}
                        </strong>
                    </div>
                </div>

                <!-- Fila 2: Ventas, Impuestos y Ganancias -->
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr 1fr; gap: 0.75rem; margin-bottom: 2rem; padding: 1rem; background: rgba(30, 41, 59, 0.6); border-radius: 1rem; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="text-align: center;">
                        <span style="font-size: 0.65rem; color: #94a3b8; display: block; font-weight: 700; text-transform: uppercase;">💰 Total Vendido</span>
                        <strong style="font-size: 1.1rem; color: #60a5fa; font-weight: 800;">${formatCLP(summary.totalSalesAmount || 0)}</strong>
                    </div>
                    <div style="text-align: center;">
                        <span style="font-size: 0.65rem; color: #94a3b8; display: block; font-weight: 700; text-transform: uppercase;">🔴 IVA Débito (Ventas)</span>
                        <strong style="font-size: 1.1rem; color: #f87171; font-weight: 800;">${formatCLP(summary.ivaDebito || 0)}</strong>
                    </div>
                    <div style="text-align: center;">
                        <span style="font-size: 0.65rem; color: #94a3b8; display: block; font-weight: 700; text-transform: uppercase;">🟢 IVA Crédito (Compras)</span>
                        <strong style="font-size: 1.1rem; color: #34d399; font-weight: 800;">${formatCLP(summary.ivaCredito || 0)}</strong>
                    </div>
                    <div style="text-align: center;">
                        <span style="font-size: 0.65rem; color: #94a3b8; display: block; font-weight: 700; text-transform: uppercase;">💸 Gastos del Turno</span>
                        <strong style="font-size: 1.1rem; color: #ef4444; font-weight: 800;">-${formatCLP(summary.totalExpenses || 0)}</strong>
                    </div>
                    <div style="text-align: center; border-left: 1px solid rgba(255,255,255,0.1); padding-left: 0.5rem;">
                        <span style="font-size: 0.65rem; color: #10b981; display: block; font-weight: 800; text-transform: uppercase;">💎 Ganancia Neta</span>
                        <strong style="font-size: 1.1rem; color: #10b981; font-weight: 900;">${formatCLP(summary.netProfit || 0)}</strong>
                    </div>
                </div>

                <div style="padding: 0 1rem;">
                    <h3 style="color: #64748b; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 2px; font-weight: 800; margin-bottom: 2rem; display: flex; align-items: center; gap: 0.75rem;">
                        <span style="height: 1px; flex: 1; background: rgba(255,255,255,0.05);"></span>
                        Línea de Tiempo de Operaciones
                        <span style="height: 1px; flex: 1; background: rgba(255,255,255,0.05);"></span>
                    </h3>
                    <div style="max-height: 60vh; overflow-y: auto; padding: 0 1rem 2rem 0; scrollbar-width: thin; scrollbar-color: rgba(99, 102, 241, 0.3) transparent;">
                        ${eventsHTML}
                    </div>
                </div>
            </div>`;

        showModal(content, { title: '', footer: `<button class="btn" style="background: #1e293b; color: #94a3b8; border: 1px solid rgba(255,255,255,0.1); padding: 0.75rem 2rem; border-radius: 0.75rem; font-weight: 700;" onclick="closeModal()">Cerrar Historial</button>`, width: '900px' });
    },

    getEventStyles(type) {
        const styles = {
            open: { icon: '🔓', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.1)', label: 'Apertura' },
            sale: { icon: '💰', color: '#6366f1', bgColor: 'rgba(99, 102, 241, 0.1)', label: 'Venta' },
            payment: { icon: '💳', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.1)', label: 'Pago Deuda' },
            expense: { icon: '💸', color: '#f43f5e', bgColor: 'rgba(244, 63, 94, 0.1)', label: 'Gasto' },
            cash_in: { icon: '📥', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.1)', label: 'Ingreso Manual' },
            cash_out: { icon: '📤', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.1)', label: 'Retiro Manual' },
            close: { icon: '🔒', color: '#64748b', bgColor: 'rgba(100, 116, 139, 0.1)', label: 'Cierre' }
        };
        return styles[type] || { icon: '📝', color: '#94a3b8', bgColor: 'rgba(148, 163, 184, 0.1)', label: 'Evento' };
    },

    async showSaleDetail(saleId) {
        try {
            const sale = await Sale.getById(saleId);
            if (!sale) throw new Error('Venta no encontrada');
            let items = sale.items;
            if (typeof items === 'string') items = JSON.parse(items);
            const content = `
                <div style="padding: 0.5rem; color: #f1f5f9;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem;">
                        <div>
                            <h2 style="margin: 0; font-weight: 900; font-size: 1.5rem;">Detalle de Venta #${sale.saleNumber || sale.id}</h2>
                            <p style="color: #94a3b8; margin: 0.25rem 0 0 0;">${formatDateTime(sale.date)}</p>
                        </div>
                        <div style="text-align: right;">
                            <span class="badge ${sale.status === 'completed' ? 'badge-success' : 'badge-warning'}" style="padding: 0.5rem 1rem; border-radius: 2rem; font-size: 0.8rem;">${sale.status === 'completed' ? 'PAGADA' : 'PENDIENTE'}</span>
                            <div style="margin-top: 0.5rem; color: #94a3b8; font-size: 0.85rem;">Método: <strong>${this.getPaymentMethodName(sale.paymentMethod)}</strong></div>
                        </div>
                    </div>
                    <div style="background: rgba(255,255,255,0.02); border-radius: 1rem; border: 1px solid rgba(255,255,255,0.05); overflow: hidden; margin-bottom: 2rem;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: rgba(255,255,255,0.03); text-align: left;">
                                    <th style="padding: 1rem; color: #94a3b8; font-size: 0.75rem; text-transform: uppercase;">Producto</th>
                                    <th style="padding: 1rem; color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; text-align: center;">Cant.</th>
                                    <th style="padding: 1rem; color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; text-align: right;">Precio</th>
                                    <th style="padding: 1rem; color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; text-align: right;">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${items.map(item => `
                                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                                        <td style="padding: 1rem;"><div style="font-weight: 700;">${item.name}</div><small style="opacity: 0.5;">SKU: ${item.sku || 'N/A'}</small></td>
                                        <td style="padding: 1rem; text-align: center;">${item.quantity} ${item.type === 'weight' ? 'kg' : 'un'}</td>
                                        <td style="padding: 1rem; text-align: right;">${formatCLP(item.price)}</td>
                                        <td style="padding: 1rem; text-align: right; font-weight: 800;">${formatCLP(item.total)}</td>
                                    </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div style="display: flex; justify-content: flex-end;">
                        <div style="background: rgba(99, 102, 241, 0.1); padding: 1.5rem; border-radius: 1rem; border: 1px solid rgba(99, 102, 241, 0.2); min-width: 250px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; color: #94a3b8;"><span>Subtotal:</span><span>${formatCLP(sale.total)}</span></div>
                            <div style="display: flex; justify-content: space-between; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.1);"><strong style="font-size: 1.25rem;">Total Venta:</strong><strong style="color: #6366f1; font-size: 1.5rem;">${formatCLP(sale.total)}</strong></div>
                        </div>
                    </div>
                </div>`;
            showModal(content, {
                title: 'Detalle de Venta',
                width: '750px',
                footer: `<button class="btn btn-primary" onclick="closeModal()">Cerrar Detalle</button>`
            });
        } catch (error) {
            console.error('Error al cargar detalle de venta:', error);
            showNotification('Error al cargar el detalle: ' + error.message, 'error');
        }
    },


    getPaymentMethodName(method) {
        const names = {
            cash: 'Efectivo',
            card: 'Tarjeta',
            qr: 'QR',
            mixed: 'Pago Mixto',
            other: 'Otro',
            pending: 'Anotado',
            debt: 'Anotado',
            creditBalance: 'Saldo Favor'
        };
        return names[method] || method;
    },

    _allCashHistory: [],
    _showOnlyDiscrepancies: false,
    _historyFilter: {
        year: new Date().getFullYear(),
        month: new Date().getMonth(),
        day: null
    },
    _monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],

    async showAllCashRegistersHistory() {
        try {
            const allRegisters = await CashRegister.getAll();

            if (allRegisters.length === 0) {
                showModal(
                    '<div class="empty-state"><div class="empty-state-icon">💰</div>No hay registros de caja</div>',
                    { title: 'Historial de Cajas', width: '600px' }
                );
                return;
            }

            await this.enrichHistoryWithSummaries(allRegisters);

            // Ordenar por fecha de apertura (más recientes primero)
            const sortedRegisters = allRegisters.sort((a, b) => new Date(b.openDate) - new Date(a.openDate));
            this._allCashHistory = sortedRegisters;

            const openCount = allRegisters.filter(r => r.status === 'open').length;
            const closedCount = allRegisters.filter(r => r.status === 'closed').length;

            const years = Array.from(new Set(sortedRegisters.map(r => new Date(r.openDate).getFullYear())));
            years.sort((a, b) => b - a);
            if (years.length === 0) {
                years.push(new Date().getFullYear());
            }

            this._historyFilter.year = this._historyFilter.year && years.includes(this._historyFilter.year)
                ? this._historyFilter.year
                : years[0];
            this._historyFilter.month = typeof this._historyFilter.month === 'number'
                ? this._historyFilter.month
                : this._historyFilter.month = new Date().getMonth();
            this._historyFilter.day = null;

            const filterControls = this.renderCashHistoryFilterControls(years);

            const content = `
                <div class="cash-history-modal">
                    <div class="cash-history-modal-header">
                        <div>
                            <h3>Historial Completo de Cajas</h3>
                            <p>
                                Total de registros: <strong>${allRegisters.length}</strong> |
                                Abiertas: <strong>${openCount}</strong> |
                                Cerradas: <strong>${closedCount}</strong>
                            </p>
                        </div>
                    </div>
                    ${filterControls}
                    <div class="cash-history-list" id="cashHistoryList">
                        ${this.renderCashHistoryEntries(sortedRegisters)}
                    </div>
                </div>
            `;

            const footer = `
                <button class="btn btn-primary" onclick="closeModal()">Cerrar</button>
            `;

            showModal(content, {
                title: 'Historial Completo de Todas las Cajas',
                footer,
                width: '900px'
            });
        } catch (error) {
            console.error('Error al cargar historial de cajas:', error);
            showNotification('Error al cargar el historial: ' + error.message, 'error');
        }
    },


    filterCashHistoryByDate(dateStr) {
        const filterString = dateStr || this.getHistoryFilterDate();
        let filtered = !filterString ? this._allCashHistory : this._allCashHistory.filter(register => {
            const openDate = new Date(register.openDate);
            const target = new Date(`${filterString}T12:00:00`);
            return openDate.getFullYear() === target.getFullYear() &&
                openDate.getMonth() === target.getMonth() &&
                openDate.getDate() === target.getDate();
        });

        // ponytail: filtro de descuadres solo aplica en cajas cerradas con diferencia != 0
        if (this._showOnlyDiscrepancies) {
            filtered = filtered.filter(r => r.status === 'closed' && (r.difference || 0) !== 0);
        }

        const listEl = document.getElementById('cashHistoryList');
        if (listEl) {
            listEl.innerHTML = filtered.length > 0
                ? this.renderCashHistoryEntries(filtered)
                : `<div class="empty-state" style="padding:2rem; text-align:center; color:#94a3b8;"><div style="font-size:2rem;margin-bottom:0.5rem;">✅</div><p>No hay cajas con descuadres en este período.</p></div>`;
        }
    },

    toggleDiscrepancyFilter() {
        this._showOnlyDiscrepancies = !this._showOnlyDiscrepancies;
        const btn = document.getElementById('btnToggleDescuadre');
        if (btn) {
            if (this._showOnlyDiscrepancies) {
                btn.style.background = '#ef4444';
                btn.style.color = '#fff';
                btn.style.borderColor = '#ef4444';
                btn.textContent = '🔴 Solo Descuadres (ACTIVO)';
            } else {
                btn.style.background = 'transparent';
                btn.style.color = '#94a3b8';
                btn.style.borderColor = 'rgba(255,255,255,0.1)';
                btn.textContent = '⚪ Ver Solo Descuadres';
            }
        }
        this.filterCashHistoryByDate();
    },

    renderCashHistoryFilterControls(years) {
        const selectedYear = this._historyFilter.year;
        const selectedMonth = this._historyFilter.month;
        const isDescuadreActive = this._showOnlyDiscrepancies;
        return `
            <div class="cash-history-filter">
                <div class="cash-history-filter-selects" style="display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap;">
                    <label>Mes
                        <select onchange="CashView.setHistoryFilterMonth(this.value)" class="form-control">
                            ${this._monthNames.map((name, index) => `
                                <option value="${index}" ${index === selectedMonth ? 'selected' : ''}>${name}</option>
                            `).join('')}
                        </select>
                    </label>
                    <label>Año
                        <select onchange="CashView.setHistoryFilterYear(this.value)" class="form-control">
                            ${years.map(year => `
                                <option value="${year}" ${year === selectedYear ? 'selected' : ''}>${year}</option>
                            `).join('')}
                        </select>
                    </label>
                    <button id="btnToggleDescuadre" onclick="CashView.toggleDiscrepancyFilter()"
                            style="padding:0.5rem 1rem; border-radius:0.75rem; font-weight:800; font-size:0.82rem; cursor:pointer; transition:all 0.2s; border:1.5px solid ${isDescuadreActive ? '#ef4444' : 'rgba(255,255,255,0.1)'}; background:${isDescuadreActive ? '#ef4444' : 'transparent'}; color:${isDescuadreActive ? '#fff' : '#94a3b8'}; white-space:nowrap;">
                        ${isDescuadreActive ? '🔴 Solo Descuadres (ACTIVO)' : '⚪ Ver Solo Descuadres'}
                    </button>
                </div>
                <div class="cash-history-filter-grid" id="cashHistoryDayGrid">
                    ${this.renderHistoryDayGrid(selectedYear, selectedMonth)}
                </div>
            </div>
        `;
    },

    renderHistoryDayGrid(year, month) {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const monthName = this._monthNames[month] || '';
        const selectedDay = this._historyFilter.day;

        let grid = `
            <div class="cash-history-day-grid-title">
                ${monthName} ${year}
            </div>
            <div class="cash-history-day-grid-body">
        `;

        for (let day = 1; day <= daysInMonth; day++) {
            const isActive = selectedDay === day;
            grid += `
                <button type="button"
                        class="cash-history-day ${isActive ? 'active' : ''}"
                        onclick="CashView.setHistoryFilterDay(${day})">
                    <span>${day}</span>
                    <small>${monthName.slice(0, 3)}</small>
                </button>
            `;
        }

        grid += '</div>';
        return grid;
    },

    setHistoryFilterMonth(monthIndex) {
        this._historyFilter.month = parseInt(monthIndex, 10);
        this._historyFilter.day = null;
        this.refreshHistoryDayGrid();
        this.filterCashHistoryByDate();
    },

    setHistoryFilterYear(year) {
        this._historyFilter.year = parseInt(year, 10);
        this._historyFilter.day = null;
        this.refreshHistoryDayGrid();
        this.filterCashHistoryByDate();
    },

    setHistoryFilterDay(day) {
        this._historyFilter.day = parseInt(day, 10);
        this.refreshHistoryDayGrid();
        this.filterCashHistoryByDate();
    },

    refreshHistoryDayGrid() {
        const gridEl = document.getElementById('cashHistoryDayGrid');
        if (gridEl && this._historyFilter.year !== undefined && this._historyFilter.month !== undefined) {
            gridEl.innerHTML = this.renderHistoryDayGrid(this._historyFilter.year, this._historyFilter.month);
        }
    },

    getHistoryFilterDate() {
        const { year, month, day } = this._historyFilter;
        if (!year || month === undefined || !day) return null;
        const paddedMonth = String(month + 1).padStart(2, '0');
        const paddedDay = String(day).padStart(2, '0');
        return `${year}-${paddedMonth}-${paddedDay}`;
    },

    renderCashHistoryEntries(registers) {
        if (!registers || registers.length === 0) {
            return `
                <div class="empty-state" style="padding: 2rem; text-align: center;">
                    <div class="empty-state-icon">📦</div>
                    <p>No hay cajas que coincidan con la fecha seleccionada.</p>
                </div>
            `;
        }

        return registers.map(register => {
            const openDate = new Date(register.openDate);
            const closeDate = register.closeDate ? new Date(register.closeDate) : null;
            let duration = '-';
            if (closeDate && !isNaN(openDate.getTime()) && !isNaN(closeDate.getTime())) {
                const diffMs = closeDate - openDate;
                const hrs = Math.floor(diffMs / (1000 * 60 * 60));
                const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                duration = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
            }

            const totalVentas = register.paymentSummary ? Object.values(register.paymentSummary).reduce((a, b) => a + b, 0) : 0;
            const diff = register.difference || 0;
            const diffColor = diff === 0 ? '#10b981' : (diff > 0 ? '#f59e0b' : '#ef4444');

            return `
                <div class="cash-history-entry" style="background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 1.25rem; padding: 1.5rem; margin-bottom: 1rem; display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr 1.2fr; align-items: center; gap: 1.5rem; transition: transform 0.2s, background 0.2s;">
                    <div style="display: flex; gap: 1rem; align-items: center;">
                        <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(99, 102, 241, 0.1); color: #818cf8; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; font-weight: 900;">
                            #${register.id}
                        </div>
                        <div>
                            <div style="color: #f1f5f9; font-weight: 700; font-size: 1rem;">
                                ${formatDateTime(register.openDate).split(' ')[0] || 'Sin fecha'}
                            </div>
                            <div style="color: #64748b; font-size: 0.8rem; margin-top: 0.15rem;">
                                ${formatDateTime(register.openDate).split(' ')[1] || ''} - 
                                ${register.closeDate ? (formatDateTime(register.closeDate).split(' ')[1] || 'Sin hora') : 'En curso'}
                            </div>
                        </div>
                    </div>

                    <div>
                        <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 800; margin-bottom: 0.4rem;">Ventas Session</div>
                        <div style="font-weight: 800; color: #10b981; font-size: 1.1rem;">${formatCLP(totalVentas)}</div>
                    </div>

                    <div>
                        <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 800; margin-bottom: 0.4rem;">Final / Esperado</div>
                        <div style="color: #e2e8f0; font-weight: 600; font-size: 0.95rem;">
                            ${register.finalAmount ? formatCLP(register.finalAmount) : 'En curso'} 
                            <span style="color: #475569; font-size: 0.8rem;">/ ${formatCLP(register.expectedAmount || 0)}</span>
                        </div>
                    </div>

                    <div>
                        <div style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 800; margin-bottom: 0.4rem;">Cuadratura</div>
                        <div style="color: ${diffColor}; font-weight: 800; display: flex; align-items: center; gap: 0.4rem; font-size: 1rem;">
                            ${register.status === 'open' ? '<span style="color: #6366f1;">En proceso</span>' : (diff === 0 ? '✅ Cuadró' : `${diff > 0 ? '📈 +' : '📉 '}${formatCLP(diff)}`)}
                        </div>
                    </div>

                    <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                        <button class="btn" style="background: rgba(99, 102, 241, 0.1); color: #818cf8; padding: 0.6rem 1rem; border-radius: 0.75rem; font-size: 0.85rem; font-weight: 700; border: 1px solid rgba(99, 102, 241, 0.1);" onclick="CashView.showCashHistory(${register.id})">
                            📋 Ver Detalle
                        </button>
                        ${register.status === 'closed' ? `
                            <button class="btn" style="background: transparent; color: #64748b; padding: 0.6rem 0.8rem; border-radius: 0.75rem;" onclick="CashView.editClosedCash(${register.id})" title="Editar Cierre">
                                ⚙️
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    },

    async openCash(event) {
        event.preventDefault();
        const amount = parseFloat(document.getElementById('quickAmount')?.value) || 0;

        if (amount < 0) {
            return showNotification('El monto inicial no puede ser negativo', 'error');
        }

        try {
            await CashController.openCash(amount, null);
            showNotification('Caja abierta exitosamente', 'success');
            app.navigate('cash');
        } catch (error) {
            showNotification(error.message, 'error');
        }
    },

    async showCloseCashForm() {
        const openCash = await CashRegister.getOpen();
        const summary = await CashRegister.getSummary(openCash.id);
        const dailyBreakdown = await CashController.getDailySales(openCash.id);

        // Desglose de 4 métodos de pago solicitados
        const paymentMethods = ['cash', 'card', 'qr', 'other'];
        const methodLabels = {
            cash: 'Efectivo contado físico',
            card: 'Depositos Tarjetas (Banco)',
            qr: 'Pagos QR (Banco)',
            other: 'Transferencias / Otros'
        };

        const expectedPayments = {
            cash: summary.expectedCash || 0,
            card: summary.paymentSummary?.card || 0,
            qr: summary.paymentSummary?.qr || 0,
            other: summary.paymentSummary?.other || 0
        };

        const expectedTotal = Object.values(expectedPayments).reduce((sum, value) => sum + (parseFloat(value) || 0), 0);
        const totalSalesAmount = summary.totalSalesAmount ?? dailyBreakdown.reduce((sum, day) => sum + (day.sales.total || 0), 0);

        const methodRows = paymentMethods.map((method, index) => {
            const nextMethod = index < paymentMethods.length - 1 ? paymentMethods[index + 1] : null;
            const focusTarget = nextMethod ? `closeMethod-${nextMethod}` : 'btn-close-cash-final';
            
            return `
                <div class="close-cash-method-card" id="card-${method}">
                    <div class="method-info">
                        <span class="method-label">${methodLabels[method]}</span>
                        <div class="method-expected-box">
                            <span class="label-mini">ESPERADO EN SISTEMA</span>
                            <span class="value-expected" id="closeExpected-${method}">${formatCLP(expectedPayments[method])}</span>
                        </div>
                    </div>
                    <div class="method-input-area">
                        <div style="display: flex; gap: 0.4rem; align-items: stretch;">
                            <input type="number"
                                   id="closeMethod-${method}"
                                   class="form-control close-cash-method-input"
                                   min="0"
                                   step="1"
                                   placeholder="0"
                                   required
                                   onkeydown="if(event.key === 'Enter') { 
                                       event.preventDefault(); 
                                       const target = document.getElementById('${focusTarget}'); 
                                       if(target) target.focus(); 
                                   }"
                                   style="flex: 1; font-size: 1.5rem; height: 3.5rem; text-align: center; border: 2px solid #cbd5e1; border-radius: 0.75rem; font-weight: 800;">
                            ${method === 'cash' ? `
                            <button type="button" class="btn" onclick="CashView.openCalculatorModal('closeMethod-${method}')" title="Abrir Calculadora" style="font-size: 1.35rem; padding: 0 0.9rem; border-radius: 0.75rem; border: 2px solid #cbd5e1; background: #f1f5f9; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#e2e8f0';" onmouseout="this.style.background='#f1f5f9';">
                                🧮
                            </button>
                            ` : ''}
                        </div>
                        <div class="method-diff-status" id="closeDifference-${method}">Ingresa monto</div>
                    </div>
                </div>
            `;
        }).join('');

        const dailyList = dailyBreakdown.length > 0
            ? dailyBreakdown.map(day => `
                <div class="close-cash-day-row">
                    <span>${day.date}</span>
                    <strong style="color: #6366f1;">${formatCLP(day.sales.total)}</strong>
                </div>
            `).join('')
            : '<div class="empty-state" style="padding:1rem;">No hay ventas registradas aún.</div>';

        const content = `
            <style>
                .close-cash-modal-container { display: flex; gap: 1.5rem; background: #f8fafc; border-radius: 1.5rem; overflow: hidden; }
                .close-cash-sidebar { flex: 1.1; background: #1e293b; color: white; padding: 1.5rem; border-radius: 1.5rem; display: flex; flex-direction: column; }
                .close-cash-body { flex: 2; padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; }
                
                .close-cash-day-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem; margin: 1rem 0; padding-right: 0.5rem; max-height: 200px; }
                .close-cash-day-row { display: flex; justify-content: space-between; padding: 0.6rem 0.85rem; background: rgba(255,255,255,0.05); border-radius: 0.75rem; font-size: 0.9rem; }
                .close-cash-day-total { padding: 1rem; background: #334155; border-radius: 1rem; display: flex; justify-content: space-between; align-items: center; border-left: 5px solid #6366f1; }
                
                .close-cash-method-card { background: white; border: 1.5px solid #e2e8f0; border-radius: 1rem; padding: 1rem; display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; align-items: center; transition: all 0.2s; }
                .close-cash-method-card:focus-within { border-color: #6366f1; box-shadow: 0 4px 20px rgba(99, 102, 241, 0.1); transform: scale(1.01); }
                .method-label { display: block; font-weight: 800; color: #1e293b; margin-bottom: 0.35rem; }
                .method-expected-box { background: #f1f5f9; padding: 0.4rem 0.75rem; border-radius: 0.5rem; }
                .label-mini { display: block; font-size: 0.65rem; color: #64748b; font-weight: 900; letter-spacing: 0.5px; }
                .value-expected { font-size: 1.1rem; font-weight: 800; color: #334155; }
                
                .method-diff-status { font-size: 0.82rem; font-weight: 700; text-align: center; margin-top: 0.35rem; padding: 3px; border-radius: 6px; }
                .diff-cuadra { color: #059669; background: #ecfdf5; }
                .diff-falta { color: #dc2626; background: #fef2f2; }
                .diff-sobra { color: #2563eb; background: #eff6ff; }
                
                .close-cash-final-summary { background: #ffffff; border: 2.5px solid #1e293b; border-radius: 1rem; padding: 1rem 1.25rem; margin-top: 0.5rem; }
                .total-main-info { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; padding-bottom: 0.75rem; border-bottom: 2px dashed #e2e8f0; }
                .total-main-label { font-size: 0.95rem; font-weight: 900; color: #1e293b; }
                .total-main-val { font-size: 1.8rem; font-weight: 950; color: #1e293b; }
                
                .final-status-banner { padding: 0.75rem; border-radius: 0.75rem; text-align: center; font-weight: 900; font-size: 1rem; }
                .status-ok { background: #dcfce7; color: #166534; border: 2px solid #22c55e; }
                .status-warning { background: #fee2e2; color: #991b1b; border: 2px solid #ef4444; }
                .status-info { background: #dbeafe; color: #1e40af; border: 2px solid #3b82f6; }
            </style>

            <div class="close-cash-modal-container">
                <div class="close-cash-sidebar">
                    <h3 style="color: #94a3b8; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 1rem;">Cierre de Turno</h3>
                    <h2 style="font-size: 1.5rem; font-weight: 900; margin-bottom: 1rem;">Resumen de Ventas Netas</h2>
                    <div class="close-cash-day-list">
                        ${dailyList}
                    </div>
                    <div class="close-cash-day-total">
                        <div>
                            <span style="display:block; font-size: 0.75rem; opacity: 0.8; font-weight: 700;">TOTAL ACUMULADO</span>
                            <strong>Ticket Total</strong>
                        </div>
                        <span style="font-size: 1.5rem; font-weight: 950;">${formatCLP(totalSalesAmount)}</span>
                    </div>
                </div>

                <div class="close-cash-body">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <h2 style="margin:0; font-weight: 900; color: #1e293b; font-size: 1.3rem;">Cuadratura de Caja</h2>
                        <span style="font-size: 0.8rem; color: #64748b; font-weight: 700;">PASO FINAL</span>
                    </div>
                    <p style="color: #64748b; margin-bottom: 0.5rem; font-size: 0.85rem; font-weight: 600;">Compara los montos reales recibidos con lo reportado por el sistema.</p>

                    <div style="background: #1e293b; color: white; padding: 1rem; border-radius: 0.85rem; margin-bottom: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem;">
                        <h4 style="margin: 0; font-size: 0.8rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 800;">📈 Rendimiento de este Turno</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; text-align: center;">
                            <div style="background: rgba(255,255,255,0.03); padding: 0.5rem; border-radius: 0.5rem;">
                                <span style="font-size: 0.65rem; color: #94a3b8; display: block; font-weight: 700; text-transform: uppercase; margin-bottom: 0.2rem;">Ventas Netas (Sin IVA)</span>
                                <strong style="font-size: 1.05rem; color: #3b82f6; font-weight: 900;">${formatCLP(summary.totalSalesAmount - (summary.ivaDebito || 0))}</strong>
                            </div>
                            <div style="background: rgba(255,255,255,0.03); padding: 0.5rem; border-radius: 0.5rem;">
                                <span style="font-size: 0.65rem; color: #94a3b8; display: block; font-weight: 700; text-transform: uppercase; margin-bottom: 0.2rem;">Gastos del Turno</span>
                                <strong style="font-size: 1.05rem; color: #ef4444; font-weight: 900;">-${formatCLP(summary.totalExpenses || 0)}</strong>
                            </div>
                            <div style="background: rgba(255,255,255,0.03); padding: 0.5rem; border-radius: 0.5rem; border: 1px solid rgba(16, 185, 129, 0.2);">
                                <span style="font-size: 0.65rem; color: #10b981; display: block; font-weight: 800; text-transform: uppercase; margin-bottom: 0.2rem;">Ganancia Neta Turno</span>
                                <strong style="font-size: 1.05rem; color: #10b981; font-weight: 900;">${formatCLP(summary.netProfit || 0)}</strong>
                            </div>
                        </div>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        ${methodRows}
                    </div>

                    <div class="close-cash-final-summary">
                        <div class="total-main-info">
                            <div>
                                <span class="total-main-label">EFECTIVO CONTADO REAL</span>
                                <p style="margin:0; font-size: 0.75rem; color: #64748b; font-weight: 700;">Suma de todos los montos ingresados arriba</p>
                            </div>
                            <span class="total-main-val" id="closeCountedTotal">$0</span>
                        </div>
                        <div id="closeStatusBanner" class="final-status-banner status-info">Ingresa todos los montos para calcular</div>
                    </div>
                </div>
            </div>

            <form id="closeCashForm" onsubmit="event.preventDefault(); return false;">
                <input type="hidden" id="finalAmount" name="finalAmount" value="0">
            </form>
        `;

        const footer = `
            <button type="button" class="btn btn-secondary" onclick="closeModal()" style="border-radius: 0.75rem; padding: 0.6rem 1.5rem; font-weight: 700;">Omitir por ahora</button>
            <button type="button" id="btn-close-cash-final" class="btn btn-danger" onclick="CashView.confirmCloseCash(${openCash.id})" style="border-radius: 0.75rem; padding: 0.6rem 2.5rem; font-weight: 900; box-shadow: 0 8px 20px rgba(239, 68, 68, 0.3);">
                FINALIZAR Y CERRAR CAJA 🔒
            </button>
        `;

        showModal(content, { title: 'Cierre Definitivo de Caja', footer, width: '1080px' });

        // Lógica de actualización de diferencias
        setTimeout(() => {
            const updateDifferences = () => {
                const bannerEl = document.getElementById('closeStatusBanner');
                const totalCountedEl = document.getElementById('closeCountedTotal');
                const finalInput = document.getElementById('finalAmount');
                const btnSubmit = document.getElementById('btn-close-cash-final');

                let allFilled = true;
                const countedTotals = paymentMethods.reduce((acc, method) => {
                    const input = document.getElementById(`closeMethod-${method}`);
                    if (input.value === "") allFilled = false;
                    const value = parseFloat(input?.value) || 0;
                    acc[method] = value;
                    return acc;
                }, {});

                const countedTotal = paymentMethods.reduce((sum, method) => sum + countedTotals[method], 0);
                const totalDifference = paymentMethods.reduce((sum, method) => {
                    return sum + (countedTotals[method] - (expectedPayments[method] || 0));
                }, 0);

                if (finalInput) finalInput.value = countedTotals['cash']; // El efectivo físico es lo que va al DB
                if (totalCountedEl) totalCountedEl.textContent = formatCLP(countedTotal);

                paymentMethods.forEach(method => {
                    const diffEl = document.getElementById(`closeDifference-${method}`);
                    const val = document.getElementById(`closeMethod-${method}`).value;
                    if (val === "") {
                        diffEl.textContent = "Pendiente...";
                        diffEl.className = "method-diff-status";
                        return;
                    }

                    const diff = countedTotals[method] - (expectedPayments[method] || 0);
                    if (diff === 0) {
                        diffEl.textContent = "✅ CUADRA EXACTO";
                        diffEl.className = "method-diff-status diff-cuadra";
                    } else if (diff > 0) {
                        diffEl.textContent = `📈 SOBRANTE: ${formatCLP(diff)}`;
                        diffEl.className = "method-diff-status diff-sobra";
                    } else {
                        diffEl.textContent = `📉 FALTANTE: ${formatCLP(Math.abs(diff))}`;
                        diffEl.className = "method-diff-status diff-falta";
                    }
                });

                if (!allFilled) {
                    bannerEl.textContent = "⚠️ COMPLETA TODOS LOS CAMPOS PARA CERRAR";
                    bannerEl.className = "final-status-banner status-warning";
                    btnSubmit.disabled = true;
                    btnSubmit.style.opacity = "0.5";
                } else {
                    btnSubmit.disabled = false;
                    btnSubmit.style.opacity = "1";
                    if (totalDifference === 0) {
                        bannerEl.textContent = "🏁 TODO CUADRA PERFECTO. ¡BUEN TRABAJO!";
                        bannerEl.className = "final-status-banner status-ok";
                    } else if (totalDifference > 0) {
                        bannerEl.textContent = `💰 TIENES UN SOBRANTE TOTAL DE ${formatCLP(totalDifference)}`;
                        bannerEl.className = "final-status-banner status-info";
                    } else {
                        bannerEl.textContent = `🚨 TIENES UN FALTANTE TOTAL DE ${formatCLP(Math.abs(totalDifference))}`;
                        bannerEl.className = "final-status-banner status-warning";
                    }
                }
            };

            paymentMethods.forEach(method => {
                const input = document.getElementById(`closeMethod-${method}`);
                input?.addEventListener('input', updateDifferences);
            });

            // Foco inicial
            document.getElementById('closeMethod-cash').focus();
            updateDifferences();
        }, 100);
    },

    async confirmCloseCash(id) {
        const btn = document.getElementById('btn-close-cash-final');
        if (btn) {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.innerText = 'CERRANDO...';
        }

        const finalAmount = parseFloat(document.getElementById('finalAmount').value);

        // ponytail: guardamos el conteo de los 4 métodos para que el reporte pueda
        // comparar esperado vs contado; antes solo se persistía el efectivo.
        const countedByMethod = ['cash', 'card', 'qr', 'other'].reduce((acc, method) => {
            acc[method] = parseFloat(document.getElementById(`closeMethod-${method}`)?.value) || 0;
            return acc;
        }, {});
        
        // Validación de confirmación explícita solicitada
        const result = await showConfirm(
            'Una vez cerrada, no podrás registrar más ventas en este turno sin abrir una nueva caja.',
            '¿Confirmas el cierre de caja?',
            'Sí, Cerrar Caja Definitivamente',
            'No, Seguir Revisando'
        );

        if (result) {
            try {
                const summary = await CashController.closeCash(id, finalAmount, countedByMethod);

                // Generación y guardado automático de Reporte Z PDF en Escritorio
                try {
                    const closedReg = await CashRegister.getById(id);
                    const userStr = await this.getCashierName(closedReg);
                    const pdfRes = await CashReportPDF.generateAndSave(summary, closedReg, userStr);
                    if (pdfRes && pdfRes.success && pdfRes.isNative) {
                        showNotification(`📄 Reporte Z guardado en Escritorio (${pdfRes.path})`, 'success');
                    }
                } catch (pdfErr) {
                    console.warn("No se pudo guardar el PDF de cierre en Escritorio:", pdfErr);
                }

                // Cerrar el modal de resumen de cierre
                closeModal();

                showNotification('¡Caja cerrada exitosamente!', 'success');

                // ponytail: la caja ya está cerrada en la BD; refrescamos la vista antes de
                // cualquier paso opcional para que la pantalla nunca quede mostrando caja abierta.
                await app.navigate('cash');

                try {
                    await CashView.showShareReportModal(id, summary);
                } catch (shareError) {
                    console.error('Error al mostrar el reporte de cierre:', shareError);
                    showNotification('Caja cerrada, pero no se pudo abrir el reporte para compartir.', 'warning');
                }
            } catch (error) {
                // Si la caja ya está cerrada, significa que el proceso terminó con éxito previamente
                if (error.message.includes('ya está cerrada')) {
                    closeModal();
                    showNotification('La caja ya se encontraba cerrada.', 'info');
                    app.navigate('cash');
                } else {
                    showNotification(error.message, 'error');
                    // Restaurar botón si hay un error real (ej: red, bd)
                    if (btn) {
                        btn.disabled = false;
                        btn.style.opacity = '1';
                        btn.innerText = 'FINALIZAR Y CERRAR CAJA 🔒';
                    }
                }
            }
        } else {
            // El usuario canceló la confirmación, restauramos el botón
            if (btn) {
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.innerText = 'FINALIZAR Y CERRAR CAJA 🔒';
            }
        }
    },

    async showShareReportModal(registerId, summary) {
        const register = await db.get('cashRegisters', registerId) || {};

        // ponytail: guardamos el resumen en memoria en vez de serializarlo dentro de
        // atributos onclick (el JSON incrustado rompía el HTML del modal).
        this._lastCloseSummary = summary;
        
        const phoneKey = 'share_report_whatsapp_phone';
        const tgTokenKey = 'share_report_telegram_token';
        const tgChatIdKey = 'share_report_telegram_chat_id';
        
        const savedPhone = localStorage.getItem(phoneKey) || '';
        const savedToken = localStorage.getItem(tgTokenKey) || '';
        const savedChatId = localStorage.getItem(tgChatIdKey) || '';
        
        const content = `
            <div style="padding: 1rem 0;">
                <p style="margin-bottom: 1.25rem; font-size: 1rem; color: #475569; line-height: 1.5; font-weight: 500;">
                    La caja ha sido cerrada con éxito. Elige una de las siguientes opciones para compartir el reporte de cierre diario con el administrador o dueño del negocio:
                </p>
                
                <!-- SECCIÓN WHATSAPP -->
                <div style="background: rgba(34, 197, 94, 0.03); border: 1.5px solid #22c55e; border-radius: 1rem; padding: 1.25rem; margin-bottom: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem;">
                    <h4 style="margin: 0; color: #166534; display: flex; align-items: center; gap: 0.5rem; font-size: 1.05rem; font-weight: 800;">
                        <span>📱</span> Compartir por WhatsApp Web
                    </h4>
                    <div style="display: flex; gap: 0.5rem;">
                        <input type="text" id="sharePhone" class="form-control" placeholder="Ej: 56912345678" value="${savedPhone}" style="flex: 1;" />
                        <button class="btn btn-success" onclick="CashView.shareWhatsApp(${registerId})" style="border-radius: 0.75rem; font-weight: 700; white-space: nowrap; display: flex; align-items: center; gap: 0.35rem;">
                            <span>🚀</span> Enviar WhatsApp
                        </button>
                    </div>
                    <button class="btn" onclick="CashView.copyReportToClipboard(${registerId})" style="background: #f1f5f9; color: #334155; border: 1.5px solid #cbd5e1; border-radius: 0.75rem; font-weight: 700; width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.35rem; padding: 0.5rem 0;">
                        <span>📋</span> Copiar Reporte al Portapapeles (Pegar donde quieras)
                    </button>
                    <small style="color: #166534; opacity: 0.8; margin-top: -0.25rem; font-size: 0.75rem; font-weight: 500;">Ingresa el número con código de país (ej: 569 para Chile, sin el signo +).</small>
                </div>
                
                <!-- SECCIÓN TELEGRAM -->
                <div style="background: rgba(14, 165, 233, 0.03); border: 1.5px solid #0ea5e9; border-radius: 1rem; padding: 1.25rem; margin-bottom: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem;">
                    <h4 style="margin: 0; color: #0369a1; display: flex; align-items: center; gap: 0.5rem; font-size: 1.05rem; font-weight: 800;">
                        <span>🤖</span> Enviar vía Bot de Telegram (Silencioso)
                    </h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                        <div>
                            <label style="font-size: 0.75rem; color: #0369a1; font-weight: 700;">TOKEN DEL BOT:</label>
                            <input type="password" id="shareTgToken" class="form-control" placeholder="Bot Token" value="${savedToken}" />
                        </div>
                        <div>
                            <label style="font-size: 0.75rem; color: #0369a1; font-weight: 700;">CHAT ID DESTINATARIO:</label>
                            <input type="text" id="shareTgChatId" class="form-control" placeholder="Chat ID" value="${savedChatId}" />
                        </div>
                    </div>
                    <button class="btn" style="background: #0ea5e9; color: white; width: 100%; border-radius: 0.75rem; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 0.35rem; margin-top: 0.25rem;" onclick="CashView.shareTelegram(${registerId})">
                        <span>✈️</span> Enviar reporte automático
                    </button>
                </div>

                <!-- SECCIÓN REPORTE PDF "Z" -->
                <div style="background: rgba(139, 92, 246, 0.04); border: 1.5px solid #8b5cf6; border-radius: 1rem; padding: 1.25rem; margin-bottom: 0.5rem; display: flex; flex-direction: column; gap: 0.75rem;">
                    <h4 style="margin: 0; color: #6d28d9; display: flex; align-items: center; gap: 0.5rem; font-size: 1.05rem; font-weight: 800;">
                        <span>📄</span> Reporte Z en PDF (Escritorio)
                    </h4>
                    <p style="margin: 0; font-size: 0.85rem; color: #4c1d95; font-weight: 600;">
                        Guarda o vuelve a descargar el reporte oficial del turno en PDF dentro de tu carpeta <strong>Escritorio/registros e historial de arqueo de cajas</strong>.
                    </p>
                    <button class="btn" style="background: #7c3aed; color: white; border-radius: 0.75rem; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 0.35rem; padding: 0.6rem 0;" onclick="CashView.downloadPdfReport(${registerId})">
                        <span>📥</span> Descargar / Guardar PDF del Cierre Z
                    </button>
                </div>
            </div>
        `;
        
        const footer = `
            <button class="btn btn-secondary" onclick="closeModal(); app.navigate('cash');" style="border-radius: 0.75rem; padding: 0.75rem 2rem; font-weight: 700; width: 100%;">
                🏁 Finalizar y Salir
            </button>
        `;
        
        showModal(content, { title: 'Compartir Reporte Diario', footer, width: '550px' });
    },

    async getCashierName(register) {
        const userId = register.userId || register.openedBy;
        if (!userId) return 'Cajero';
        try {
            const user = await User.getById(userId);
            return (user && user.username) ? user.username : 'Cajero';
        } catch (e) {
            return 'Cajero';
        }
    },

    async getShareReportMessage(summary, register) {
        // ponytail: Telegram usa Markdown; quitamos los caracteres que rompen el envío
        // en vez de mantener dos plantillas distintas.
        const clean = (text) => String(text || '').replace(/[*_`\[\]]/g, '');

        const businessName = clean(localStorage.getItem('business_name') || 'Mi Almacén');
        const username = clean(await this.getCashierName(register));
        const fmtDate = (value) => value ? new Date(value).toLocaleString('es-CL') : '-';

        const methods = ['cash', 'card', 'qr', 'other'];
        const labels = {
            cash: 'Efectivo',
            card: 'Tarjetas',
            qr: 'Pagos QR',
            other: 'Transferencias/Otros'
        };
        const paymentSummary = summary.paymentSummary || {};
        // El efectivo esperado incluye el fondo inicial, los otros métodos no
        const expected = {
            cash: summary.expectedCash || 0,
            card: paymentSummary.card || 0,
            qr: paymentSummary.qr || 0,
            other: paymentSummary.other || 0
        };
        const counted = summary.countedByMethod || register.countedByMethod || { cash: summary.finalAmount || 0 };

        const diffLabel = (value) => value === 0
            ? '✅ cuadra'
            : (value > 0 ? `📈 sobra ${formatCLP(value)}` : `📉 falta ${formatCLP(Math.abs(value))}`);

        let totalExpected = 0;
        let totalCounted = 0;
        const methodLines = methods.map(method => {
            const exp = parseFloat(expected[method]) || 0;
            const cnt = parseFloat(counted[method]) || 0;
            totalExpected += exp;
            totalCounted += cnt;
            return `🔹 ${labels[method]}\n` +
                   `   Sistema: ${formatCLP(exp)} | Contado: ${formatCLP(cnt)}\n` +
                   `   ${diffLabel(cnt - exp)}`;
        }).join('\n');

        const totalDiff = totalCounted - totalExpected;
        const cashDiff = summary.difference !== undefined
            ? summary.difference
            : ((parseFloat(counted.cash) || 0) - (expected.cash || 0));

        return `📊 *CIERRE DE CAJA N° ${register.id || summary.id || '-'}*\n` +
               `🏪 ${businessName}\n` +
               `👤 Cajero: ${username}\n` +
               `🕒 Apertura: ${fmtDate(register.openDate || summary.openDate)}\n` +
               `🕒 Cierre: ${fmtDate(register.closeDate || summary.closeDate)}\n` +
               `----------------------------------\n` +
               `*MOVIMIENTO DEL TURNO*\n` +
               `💵 Fondo inicial: ${formatCLP(summary.initialAmount || 0)}\n` +
               `🧾 Ventas (${summary.totalSales || 0}): ${formatCLP(summary.totalSalesAmount || 0)}\n` +
               `🤝 Pagos de deudas: ${formatCLP(summary.totalDebtPayments || 0)}\n` +
               `➕ Ingresos a caja: ${formatCLP(summary.totalCashIn || 0)}\n` +
               `➖ Retiros de caja: ${formatCLP(summary.totalRetiros || 0)}\n` +
               `----------------------------------\n` +
               `*CUADRATURA POR MÉTODO*\n${methodLines}\n` +
               `----------------------------------\n` +
               `💰 Total sistema: ${formatCLP(totalExpected)}\n` +
               `📥 Total contado: ${formatCLP(totalCounted)}\n` +
               `📢 *Diferencia total: ${diffLabel(totalDiff)}*\n` +
               `💵 Solo efectivo: ${diffLabel(cashDiff)}\n` +
               `----------------------------------\n` +
               `*RESULTADO*\n` +
               `📈 Ganancia bruta: ${formatCLP(summary.grossProfit || 0)}\n` +
               `💸 Gastos del turno: ${formatCLP(summary.totalExpenses || 0)}\n` +
               `💎 Ganancia neta: ${formatCLP(summary.netProfit || 0)}\n` +
               `----------------------------------\n` +
               `⚡ CajaFácil POS`;
    },

    async shareWhatsApp(registerId, summary = this._lastCloseSummary || {}) {
        const phone = document.getElementById('sharePhone').value.trim().replace(/\+/g, '');
        if (!phone) {
            showNotification('Ingresa un número de celular de destino', 'warning');
            return;
        }
        
        localStorage.setItem('share_report_whatsapp_phone', phone);
        
        const register = await db.get('cashRegisters', registerId) || {};
        const message = await this.getShareReportMessage(summary, register);
        const encodedText = encodeURIComponent(message);
        
        // Redirigir directamente a la versión Web de WhatsApp en el navegador (no requiere app instalada)
        const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodedText}`;
        window.open(url, '_blank');
        showNotification('Abriendo WhatsApp Web en tu navegador...', 'success');
    },

    async copyReportToClipboard(registerId, summary = this._lastCloseSummary || {}) {
        try {
            const register = await db.get('cashRegisters', registerId) || {};
            const message = await this.getShareReportMessage(summary, register);
            
            await navigator.clipboard.writeText(message);
            showNotification('Reporte copiado al portapapeles. ¡Ya puedes pegarlo donde quieras!', 'success');
        } catch (err) {
            console.error('Error al copiar reporte:', err);
            showNotification('No se pudo copiar el reporte. Inténtalo de nuevo.', 'error');
        }
    },
    
    async shareTelegram(registerId, summary = this._lastCloseSummary || {}) {
        const token = document.getElementById('shareTgToken').value.trim();
        const chatId = document.getElementById('shareTgChatId').value.trim();
        
        if (!token || !chatId) {
            showNotification('Token y Chat ID son requeridos para Telegram', 'warning');
            return;
        }
        
        localStorage.setItem('share_report_telegram_token', token);
        localStorage.setItem('share_report_telegram_chat_id', chatId);
        
        const register = await db.get('cashRegisters', registerId) || {};
        const message = await this.getShareReportMessage(summary, register);
        
        try {
            const url = `https://api.telegram.org/bot${token}/sendMessage`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: message,
                    parse_mode: 'Markdown'
                })
            });
            
            const data = await response.json();
            if (data.ok) {
                showNotification('¡Reporte enviado exitosamente a Telegram! ✈️', 'success');
            } else {
                throw new Error(data.description || 'Error desconocido del servidor de Telegram');
            }
        } catch (error) {
            console.error('Telegram share error:', error);
            showNotification('Error al enviar a Telegram: ' + error.message, 'error');
        }
    },

    async showAddCashForm() {
        const content = `
            <form id="addCashForm" onsubmit="event.preventDefault(); CashView.addCash(); return false;">
                <div class="form-group">
                    <label>Monto a Agregar (CLP) *</label>
                    <input type="number" 
                           id="addAmount" 
                           class="form-control" 
                           placeholder="0" 
                           min="1" 
                           step="1"
                           required 
                           autofocus>
                </div>
                
                <div class="form-group">
                    <label>Motivo (opcional)</label>
                    <textarea id="addReason" 
                              class="form-control" 
                              rows="3" 
                              placeholder="Ej: Reposición de efectivo, cambio para ventas, etc."></textarea>
                </div>
            </form>
        `;

        const footer = `
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
            <button type="button" class="btn btn-success" onclick="CashView.addCash()">Agregar Dinero</button>
        `;

        showModal(content, { title: 'Agregar Dinero a la Caja', footer, width: '500px' });
    },

    async showWithdrawCashForm() {
        const openCash = await CashRegister.getOpen();
        const summary = await CashRegister.getSummary(openCash.id);

        const content = `
            <div style="margin-bottom: 1rem; padding: 1rem; background: var(--light); border-radius: 0.375rem;">
                <p style="margin-bottom: 0.5rem;"><strong>Efectivo Disponible:</strong> ${formatCLP(summary.expectedCash)}</p>
            </div>
            
            <form id="withdrawCashForm" onsubmit="event.preventDefault(); CashView.withdrawCash(); return false;">
                <div class="form-group">
                    <label>Monto a Retirar (CLP) *</label>
                    <input type="number" 
                           id="withdrawAmount" 
                           class="form-control" 
                           placeholder="0" 
                           min="1" 
                           step="1"
                           max="${summary.expectedCash}"
                           required 
                           autofocus>
                </div>
                
                <div class="form-group">
                    <label>Motivo (opcional)</label>
                    <textarea id="withdrawReason" 
                              class="form-control" 
                              rows="3" 
                              placeholder="Ej: Retiro para compras, pago a proveedor, etc."></textarea>
                </div>
            </form>
        `;

        const footer = `
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
            <button type="button" class="btn btn-warning" onclick="CashView.withdrawCash()">Retirar Dinero</button>
        `;

        showModal(content, { title: 'Retirar Dinero de la Caja', footer, width: '500px' });
    },

    async addCash() {
        const amount = parseFloat(document.getElementById('addAmount').value);
        const reason = document.getElementById('addReason').value.trim();

        if (!amount || amount <= 0) {
            showNotification('El monto debe ser mayor a 0', 'error');
            return;
        }

        try {
            await CashController.addCash(amount, reason);
            closeModal();
            await app.navigate('cash');
        } catch (error) {
            showNotification(error.message, 'error');
        }
    },

    async withdrawCash() {
        const amount = parseFloat(document.getElementById('withdrawAmount').value);
        const reason = document.getElementById('withdrawReason').value.trim();

        if (!amount || amount <= 0) {
            showNotification('El monto debe ser mayor a 0', 'error');
            return;
        }

        try {
            await CashController.withdrawCash(amount, reason);
            closeModal();
            await app.navigate('cash');
        } catch (error) {
            showNotification(error.message, 'error');
        }
    },

    async editClosedCash(id) {
        try {
            const register = await CashRegister.getById(id);
            if (!register) throw new Error('Caja no encontrada');
            const summary = await CashRegister.getSummary(id);
            const dailyBreakdown = await CashController.getDailySales(id);

            const paymentMethods = ['cash', 'card_qr', 'other'];
            const methodLabels = {
                cash: 'Efectivo esperado',
                card_qr: 'Tarjetas y QR esperados',
                other: 'Transferencia / Otro esperado'
            };

            const expectedPayments = {
                cash: summary.expectedCash || 0,
                card_qr: (summary.paymentSummary?.card || 0) + (summary.paymentSummary?.qr || 0),
                other: summary.paymentSummary?.other || 0
            };

            const expectedTotal = Object.values(expectedPayments).reduce((sum, value) => sum + (parseFloat(value) || 0), 0);
            
            // Reconstruir montos contados anteriormente si es posible
            // Si no tenemos el desglose, el finalAmount original es lo que pusimos en Cash
            const lastCounted = {
                cash: register.finalAmount || 0,
                card_qr: expectedPayments.card_qr, // Asumimos que cuadraba si no tenemos el dato
                other: expectedPayments.other
            };

            const methodRows = paymentMethods.map((method, index) => {
                const isLast = index === paymentMethods.length - 1;
                const nextMethod = isLast ? null : paymentMethods[index + 1];
                
                return `
                    <div class="close-cash-method-row">
                        <span class="close-cash-method-label">${methodLabels[method]}</span>
                        <span class="close-cash-method-expected" id="editExpected-${method}">${formatCLP(expectedPayments[method])}</span>
                        <input type="number"
                               id="editMethod-${method}"
                               class="form-control close-cash-method-input"
                               min="0"
                               step="1"
                               placeholder="0"
                               value="${lastCounted[method] || 0}"
                               onkeydown="if(event.key === 'Enter') { 
                                   event.preventDefault(); 
                                   event.stopPropagation();
                                   const next = document.getElementById('editMethod-${nextMethod}'); 
                                   if(next) next.focus(); 
                                   else document.querySelector('.btn-save-edit-final').focus();
                               }"
                               title="Ingrese el monto real contado para ${methodLabels[method]}">
                        <span class="close-cash-method-diff" id="editDifference-${method}"></span>
                    </div>
                `;
            }).join('');

            const content = `
                <div class="close-cash-grid">
                    <div class="close-cash-reconcile" style="width: 100%;">
                        <h4>Editar Cuadratura - Caja #${id}</h4>
                        <p class="close-cash-reconcile-hint">Modifique los montos contados para corregir errores de ingreso.</p>
                        ${methodRows}
                        <div class="close-cash-method-row close-cash-total-row">
                            <span class="close-cash-method-label"><strong>Total</strong></span>
                            <span class="close-cash-method-expected" id="editExpectedTotal"><strong>${formatCLP(expectedTotal)}</strong></span>
                            <span class="close-cash-method-total-counted" id="editCountedTotal" style="font-weight: bold; text-align: right; padding-right: 1.5rem;">${formatCLP(Object.values(lastCounted).reduce((a, b) => a + b, 0))}</span>
                            <span class="close-cash-method-diff" id="editDifferenceTotal"></span>
                        </div>
                        <div class="close-cash-difference-summary" id="editCashDifferenceSummary"></div>
                    </div>
                </div>
                <input type="hidden" id="editFinalAmount" value="${lastCounted.cash}">
            `;

            const footer = `
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                <button type="button" class="btn btn-warning btn-save-edit-final" onclick="CashView.updateClosedCash(${id})">Guardar Cambios</button>
            `;

            showModal(content, { title: 'Editar Cierre de Caja', footer, width: '600px' });

            setTimeout(() => {
                const updateEditDifferences = () => {
                    const listEl = document.getElementById('editCashDifferenceSummary');
                    const totalDiffEl = document.getElementById('editDifferenceTotal');
                    const finalInput = document.getElementById('editFinalAmount');
                    
                    const countedTotals = paymentMethods.reduce((acc, method) => {
                        const input = document.getElementById(`editMethod-${method}`);
                        acc[method] = parseFloat(input?.value) || 0;
                        return acc;
                    }, {});

                    const countedTotal = paymentMethods.reduce((sum, method) => sum + countedTotals[method], 0);
                    const totalDifference = paymentMethods.reduce((sum, method) => sum + (countedTotals[method] - (expectedPayments[method] || 0)), 0);
                    
                    if (finalInput) finalInput.value = countedTotals['cash'];
                    const countedTotalEl = document.getElementById('editCountedTotal');
                    if (countedTotalEl) countedTotalEl.textContent = formatCLP(countedTotal);

                    paymentMethods.forEach(method => {
                        const diffEl = document.getElementById(`editDifference-${method}`);
                        const diff = countedTotals[method] - (expectedPayments[method] || 0);
                        if (diffEl) {
                            if (diff === 0) {
                                diffEl.textContent = 'Cuadra';
                                diffEl.classList.remove('text-success', 'text-danger');
                            } else {
                                const label = diff > 0 ? 'Sobrante' : 'Faltante';
                                diffEl.textContent = `${label} ${formatCLP(Math.abs(diff))}`;
                                diffEl.classList.toggle('text-success', diff > 0);
                                diffEl.classList.toggle('text-danger', diff < 0);
                            }
                        }
                    });

                    if (totalDiffEl) {
                        const label = totalDifference === 0 ? 'Cuadra perfecto' : (totalDifference > 0 ? 'Sobrante' : 'Faltante');
                        totalDiffEl.textContent = totalDifference === 0 ? label : `${label}: ${formatCLP(Math.abs(totalDifference))}`;
                        totalDiffEl.classList.toggle('text-success', totalDifference > 0);
                        totalDiffEl.classList.toggle('text-danger', totalDifference < 0);
                    }

                    if (listEl) {
                        listEl.innerHTML = totalDifference === 0 
                            ? `<div class="close-cash-difference-success">Cuadra perfecto • Total contado: ${formatCLP(countedTotal)}</div>`
                            : `<div class="close-cash-difference-alert"><strong>${totalDifference > 0 ? 'Sobrante' : 'Faltante'} total: ${formatCLP(Math.abs(totalDifference))}</strong></div>`;
                    }
                };

                paymentMethods.forEach(method => {
                    document.getElementById(`editMethod-${method}`)?.addEventListener('input', updateEditDifferences);
                });
                updateEditDifferences();
            }, 0);

        } catch (error) {
            showNotification(error.message, 'error');
        }
    },

    async updateClosedCash(id) {
        const finalAmount = parseFloat(document.getElementById('editFinalAmount').value);
        
        try {
            const register = await CashRegister.getById(id);
            const summary = await CashRegister.getSummary(id);
            
            // Recalcular diferencia
            const difference = finalAmount - summary.expectedCash;
            
            const updated = {
                ...register,
                finalAmount: finalAmount,
                difference: difference,
                updatedAt: new Date().toISOString()
            };
            
            await CashRegister._repository.replace(updated);
            showNotification('Registro de caja actualizado correctamente', 'success');
            closeModal();
            // Recargar el historial si el modal de historial está abierto
            if (document.querySelector('.cash-history-modal')) {
                this.showAllCashRegistersHistory();
            } else {
                app.navigate('cash');
            }
        } catch (error) {
            showNotification(error.message, 'error');
        }
    },

    showExpenseForm() {
        const content = `
            <div style="padding: 1.5rem;">
                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: #374151;">Descripción del Gasto</label>
                    <input type="text" id="expenseDescription" class="form-control" placeholder="Ej: Luz, Agua, Suministros..." style="font-size: 1rem; padding: 0.75rem;">
                </div>
                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: #374151;">Monto</label>
                    <input type="number" id="expenseAmount" class="form-control" placeholder="0" min="0" style="font-size: 1rem; padding: 0.75rem;">
                </div>
                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: #374151;">Categoría</label>
                    <select id="expenseCategory" class="form-control" style="font-size: 1rem; padding: 0.75rem;">
                        <option value="servicios">Servicios (Luz, Agua, Internet)</option>
                        <option value="suministros">Suministros</option>
                        <option value="mantenimiento">Mantenimiento</option>
                        <option value="transporte">Transporte</option>
                        <option value="otros">Otros</option>
                    </select>
                </div>
                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: #374151;">Notas (opcional)</label>
                    <textarea id="expenseNotes" class="form-control" placeholder="Notas adicionales..." rows="3" style="font-size: 1rem; padding: 0.75rem;"></textarea>
                </div>
            </div>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="CashView.saveExpense()">💰 Registrar Gasto</button>
        `;

        showModal(content, { title: '💰 Registrar Gasto Operativo', footer, width: '500px' });

        // Enfocar en descripción
        setTimeout(() => {
            const input = document.getElementById('expenseDescription');
            if (input) input.focus();
        }, 100);
    },

    async saveExpense() {
        const description = document.getElementById('expenseDescription').value.trim();
        const amount = parseFloat(document.getElementById('expenseAmount').value) || 0;
        const category = document.getElementById('expenseCategory').value;
        const notes = document.getElementById('expenseNotes').value.trim();

        if (!description) {
            showNotification('Ingresa una descripción', 'error');
            return;
        }

        if (amount <= 0) {
            showNotification('Ingresa un monto válido', 'error');
            return;
        }

        try {
            const openCash = await CashRegister.getOpen();
            if (!openCash) {
                showNotification('No hay caja abierta', 'error');
                return;
            }

            // Registrar el gasto como movimiento de salida de caja
            await CashMovement.create({
                cashRegisterId: openCash.id,
                type: 'out',
                amount: amount,
                description: `Gasto: ${description} (${category})`,
                category: category,
                notes: notes,
                date: new Date().toISOString()
            });

            showNotification('Gasto registrado correctamente', 'success');
            closeModal();
            app.navigate('cash');

        } catch (error) {
            console.error('[Cash] Error registrando gasto:', error);
            showNotification('Error al registrar gasto', 'error');
        }
    },

    showDenominationCalculator(targetInputId) {
        const denominations = [20000, 10000, 5000, 2000, 1000, 500, 100, 50, 10];
        
        const content = `
            <div style="padding:0.5rem 0;">
                <p style="font-size:0.88rem; color:#475569; font-weight:600; margin-bottom:1.25rem; line-height:1.4;">
                    Ingresa el monto total contado para cada denominación de billete o moneda. El total se actualizará en vivo.
                </p>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; max-height:360px; overflow-y:auto; padding-right:0.25rem;">
                    ${denominations.map(denom => `
                        <div style="background:#f8fafc; border:1.5px solid #cbd5e1; border-radius:0.75rem; padding:0.75rem; display:flex; flex-direction:column; gap:0.25rem;">
                            <label style="font-size:0.75rem; font-weight:900; color:#1e293b;">
                                ${denom >= 1000 ? `💵 Billetes / Monedas de $${denom.toLocaleString('es-CL')}` : `🪙 Monedas de $${denom.toLocaleString('es-CL')}`}
                            </label>
                            <div style="position:relative;">
                                <span style="position:absolute; left:0.6rem; top:50%; transform:translateY(-50%); font-weight:800; color:#64748b;">$</span>
                                <input type="number" min="0" class="form-control denom-calc-input" data-denom="${denom}" placeholder="0" oninput="CashView.updateDenominationTotal()" style="padding-left:1.5rem; font-weight:900; font-size:1.1rem; text-align:right; border-radius:0.5rem;">
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div style="margin-top:1.25rem; padding:1.25rem; background:#0f172a; color:white; border-radius:1rem; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:0.85rem; font-weight:800; text-transform:uppercase; letter-spacing:1px;">TOTAL SUMADO EN CAJA</span>
                    <strong id="denomCalcGrandTotal" style="font-size:1.8rem; color:#10b981; font-weight:950;">$0</strong>
                </div>
            </div>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-success" onclick="CashView.applyDenominationTotal('${targetInputId}')" style="font-weight:900; border-radius:0.75rem;">
                ✅ Aplicar Total a la Caja
            </button>
        `;

        showModal(content, { title: '🧮 Calculadora por Denominación (CLP)', footer, width: '560px' });
    },

    updateDenominationTotal() {
        let total = 0;
        document.querySelectorAll('.denom-calc-input').forEach(input => {
            const val = parseFloat(input.value) || 0;
            total += val;
        });
        const grandEl = document.getElementById('denomCalcGrandTotal');
        if (grandEl) grandEl.textContent = '$' + Math.round(total).toLocaleString('es-CL');
        this._currentDenomTotal = total;
    },

    applyDenominationTotal(targetInputId) {
        const total = this._currentDenomTotal || 0;
        const input = document.getElementById(targetInputId);
        if (input) {
            input.value = Math.round(total);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        closeModal();
        showNotification(`Monto total $${Math.round(total).toLocaleString('es-CL')} aplicado correctamente`, 'success');
    },

    async downloadPdfReport(registerId) {
        try {
            const reg = await CashRegister.getById(registerId);
            if (!reg) { showNotification('Registro de caja no encontrado', 'error'); return; }
            const summary = await CashRegister.getSummary(registerId);
            const userStr = await this.getCashierName(reg);
            const res = await CashReportPDF.generateAndSave(summary, reg, userStr);
            if (res && res.success) {
                if (res.isNative) {
                    showNotification(`📄 Reporte Z guardado en Escritorio: ${res.path}`, 'success');
                } else {
                    showNotification('📄 Reporte Z descargado en PDF correctamente', 'success');
                }
            } else {
                showNotification(res.error || 'Error al generar PDF', 'error');
            }
        } catch (e) {
            showNotification(e.message, 'error');
        }
    },

    _partialSums: [],
    showPartialSumsCalculator(targetInputId) {
        this._partialSums = [];
        const renderSumsList = () => {
            const listEl = document.getElementById('partialSumsList');
            const totalEl = document.getElementById('partialSumsTotal');
            if (!listEl || !totalEl) return;
            const total = this._partialSums.reduce((a, b) => a + b, 0);
            totalEl.innerText = formatCLP(total);
            if (this._partialSums.length === 0) {
                listEl.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:1.5rem; font-weight:600;">No has agregado montos aún. Ingresa un valor abajo y haz clic en ➕ Agregar.</div>';
                return;
            }
            listEl.innerHTML = this._partialSums.map((amt, idx) => `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border:1.5px solid #e2e8f0; padding:0.6rem 1rem; border-radius:0.75rem; margin-bottom:0.5rem;">
                    <span style="font-weight:800; color:#1e293b; font-size:1.1rem;">#${idx + 1} &nbsp; ${formatCLP(amt)}</span>
                    <button type="button" class="btn btn-sm btn-danger" onclick="CashView.removePartialSum(${idx})" style="font-weight:900; font-size:0.75rem; padding:0.25rem 0.6rem; border-radius:0.5rem;">✕ Borrar</button>
                </div>
            `).join('');
        };

        const content = `
            <div style="background:#0f172a; padding:1.25rem; border-radius:1rem; color:#fff; text-align:center; margin-bottom:1.25rem;">
                <span style="color:#94a3b8; font-size:0.75rem; font-weight:900; text-transform:uppercase; letter-spacing:1px; display:block; margin-bottom:0.25rem;">Suma Total Acumulada</span>
                <div id="partialSumsTotal" style="font-size:2.4rem; font-weight:950; color:#10b981; letter-spacing:-1px;">$0</div>
            </div>

            <div style="margin-bottom:1rem;">
                <label style="font-weight:800; color:#475569; font-size:0.8rem; text-transform:uppercase; display:block; margin-bottom:0.4rem;">💡 Ingresa un Monto Contado (ej: 50000):</label>
                <div style="display:flex; gap:0.5rem;">
                    <input type="number" id="partialInput" class="form-control" placeholder="Monto parcial..." style="height:50px; font-size:1.4rem; font-weight:900; border-radius:0.75rem; border:2px solid #cbd5e1; flex:1;" onkeydown="if(event.key==='Enter'){ event.preventDefault(); CashView.addPartialSum();}">
                    <button type="button" class="btn btn-primary" onclick="CashView.addPartialSum()" style="height:50px; font-weight:900; padding:0 1.25rem; border-radius:0.75rem;">➕ Agregar</button>
                </div>
            </div>

            <div style="font-weight:800; color:#64748b; font-size:0.8rem; text-transform:uppercase; margin-bottom:0.5rem;">📋 Lista de Montos Agregados:</div>
            <div id="partialSumsList" style="max-height:200px; overflow-y:auto; padding-right:0.25rem;"></div>
        `;

        const footer = `
            <div style="display:flex; justify-content:space-between; gap:1rem; width:100%;">
                <button class="btn btn-secondary" onclick="closeModal()" style="font-weight:800; border-radius:0.75rem;">Cancelar</button>
                <button class="btn btn-success" onclick="CashView.applyPartialSumsTotal('${targetInputId}')" style="font-weight:900; font-size:1rem; padding:0.6rem 1.5rem; border-radius:0.75rem;">
                    ✅ Usar Cifra Total en Caja
                </button>
            </div>
        `;

        showModal(content, { title: '🧮 Calculadora de Sumas Parciales', footer, width: '480px' });
        setTimeout(() => {
            renderSumsList();
            const input = document.getElementById('partialInput');
            if (input) input.focus();
        }, 100);
    },

    addPartialSum() {
        const input = document.getElementById('partialInput');
        if (!input) return;
        const val = parseFloat(input.value) || 0;
        if (val > 0) {
            this._partialSums.push(val);
            input.value = '';
            input.focus();
            const listEl = document.getElementById('partialSumsList');
            const totalEl = document.getElementById('partialSumsTotal');
            if (listEl && totalEl) {
                const total = this._partialSums.reduce((a, b) => a + b, 0);
                totalEl.innerText = formatCLP(total);
                listEl.innerHTML = this._partialSums.map((amt, idx) => `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border:1.5px solid #e2e8f0; padding:0.6rem 1rem; border-radius:0.75rem; margin-bottom:0.5rem;">
                        <span style="font-weight:800; color:#1e293b; font-size:1.1rem;">#${idx + 1} &nbsp; ${formatCLP(amt)}</span>
                        <button type="button" class="btn btn-sm btn-danger" onclick="CashView.removePartialSum(${idx})" style="font-weight:900; font-size:0.75rem; padding:0.25rem 0.6rem; border-radius:0.5rem;">✕ Borrar</button>
                    </div>
                `).join('');
            }
        }
    },

    removePartialSum(idx) {
        this._partialSums.splice(idx, 1);
        const listEl = document.getElementById('partialSumsList');
        const totalEl = document.getElementById('partialSumsTotal');
        if (listEl && totalEl) {
            const total = this._partialSums.reduce((a, b) => a + b, 0);
            totalEl.innerText = formatCLP(total);
            if (this._partialSums.length === 0) {
                listEl.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:1.5rem; font-weight:600;">No has agregado montos aún. Ingresa un valor abajo y haz clic en ➕ Agregar.</div>';
                return;
            }
            listEl.innerHTML = this._partialSums.map((amt, idx) => `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border:1.5px solid #e2e8f0; padding:0.6rem 1rem; border-radius:0.75rem; margin-bottom:0.5rem;">
                    <span style="font-weight:800; color:#1e293b; font-size:1.1rem;">#${idx + 1} &nbsp; ${formatCLP(amt)}</span>
                    <button type="button" class="btn btn-sm btn-danger" onclick="CashView.removePartialSum(${idx})" style="font-weight:900; font-size:0.75rem; padding:0.25rem 0.6rem; border-radius:0.5rem;">✕ Borrar</button>
                </div>
            `).join('');
        }
    },

    applyPartialSumsTotal(targetInputId) {
        const total = this._partialSums.reduce((a, b) => a + b, 0);
        const input = document.getElementById(targetInputId);
        if (input) {
            input.value = total;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        closeModal();
    }
};
