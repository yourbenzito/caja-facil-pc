const PurchasesView = {
    currentSection: 'list',
    selectedDailyDate: null,
    selectedMonthKey: null,
    currentStep: 1,
    get draftKey() {
        const businessId = localStorage.getItem('BUSINESS_ID') || '1';
        return `pending_purchase_draft_b${businessId}`;
    },
    supplierResults: [],
    supplierSelectedIndex: -1,
    offset: 0,
    limit: 50,
    hasMore: true,
    isLoadingMore: false,
    listFilter: 'today', // Por defecto compras de HOY
    showCalendar: false,
    searchTerm: '',
    dateFrom: null,
    dateTo: null,
    _calendarYear: null,
    _calendarMonth: null,
    _monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
    allPurchases: [], // Buffer para compras cargadas
    supplierNameMap: null,
    manualExtraTax: 0, // ponytail: Monto directo de impuesto adicional del detalle final (IABA, Harina, etc.)

    getDefaultPurchaseMargin() {
        const val = localStorage.getItem('CF_DEFAULT_PURCHASE_MARGIN');
        return (val !== null && !isNaN(parseFloat(val))) ? parseFloat(val) : 35;
    },

    openCalculatorModal(targetInputId) {
        const targetInput = document.getElementById(targetInputId);
        if (!targetInput) return;

        let initialVal = targetInput.value ? targetInput.value.trim() : '';

        const content = `
            <div style="padding: 0.5rem; display: flex; flex-direction: column; gap: 1rem; align-items: center; background: #f8fafc; border-radius: 1rem;">
                <!-- Pantalla del Calculador -->
                <input type="text" id="calcDisplay" value="${initialVal}" 
                       placeholder="0"
                       style="width: 100%; height: 60px; font-size: 2.2rem; font-weight: 950; text-align: right; padding: 0 1rem; border-radius: 0.75rem; border: 3px solid #cbd5e1; background: #ffffff; color: #0f172a; box-shadow: inset 0 2px 5px rgba(0,0,0,0.05);"
                       onkeydown="if(event.key === 'Enter') { event.preventDefault(); PurchasesView.evaluateCalculator(); }">
                
                <!-- Botonera -->
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; width: 100%;">
                    <!-- Fila 1 -->
                    <button type="button" class="btn btn-secondary" onclick="PurchasesView.pressCalcKey('7')" style="height: 55px; font-size: 1.4rem; font-weight: 900; border-radius: 0.5rem; background: #e2e8f0; border: 1.5px solid #cbd5e1; color: #000;">7</button>
                    <button type="button" class="btn btn-secondary" onclick="PurchasesView.pressCalcKey('8')" style="height: 55px; font-size: 1.4rem; font-weight: 900; border-radius: 0.5rem; background: #e2e8f0; border: 1.5px solid #cbd5e1; color: #000;">8</button>
                    <button type="button" class="btn btn-secondary" onclick="PurchasesView.pressCalcKey('9')" style="height: 55px; font-size: 1.4rem; font-weight: 900; border-radius: 0.5rem; background: #e2e8f0; border: 1.5px solid #cbd5e1; color: #000;">9</button>
                    <button type="button" class="btn btn-warning" onclick="PurchasesView.pressCalcKey('/')" style="height: 55px; font-size: 1.4rem; font-weight: 900; border-radius: 0.5rem; background: #f59e0b; color: #fff; border: none;">÷</button>
                    
                    <!-- Fila 2 -->
                    <button type="button" class="btn btn-secondary" onclick="PurchasesView.pressCalcKey('4')" style="height: 55px; font-size: 1.4rem; font-weight: 900; border-radius: 0.5rem; background: #e2e8f0; border: 1.5px solid #cbd5e1; color: #000;">4</button>
                    <button type="button" class="btn btn-secondary" onclick="PurchasesView.pressCalcKey('5')" style="height: 55px; font-size: 1.4rem; font-weight: 900; border-radius: 0.5rem; background: #e2e8f0; border: 1.5px solid #cbd5e1; color: #000;">5</button>
                    <button type="button" class="btn btn-secondary" onclick="PurchasesView.pressCalcKey('6')" style="height: 55px; font-size: 1.4rem; font-weight: 900; border-radius: 0.5rem; background: #e2e8f0; border: 1.5px solid #cbd5e1; color: #000;">6</button>
                    <button type="button" class="btn btn-warning" onclick="PurchasesView.pressCalcKey('*')" style="height: 55px; font-size: 1.4rem; font-weight: 900; border-radius: 0.5rem; background: #f59e0b; color: #fff; border: none;">×</button>
                    
                    <!-- Fila 3 -->
                    <button type="button" class="btn btn-secondary" onclick="PurchasesView.pressCalcKey('1')" style="height: 55px; font-size: 1.4rem; font-weight: 900; border-radius: 0.5rem; background: #e2e8f0; border: 1.5px solid #cbd5e1; color: #000;">1</button>
                    <button type="button" class="btn btn-secondary" onclick="PurchasesView.pressCalcKey('2')" style="height: 55px; font-size: 1.4rem; font-weight: 900; border-radius: 0.5rem; background: #e2e8f0; border: 1.5px solid #cbd5e1; color: #000;">2</button>
                    <button type="button" class="btn btn-secondary" onclick="PurchasesView.pressCalcKey('3')" style="height: 55px; font-size: 1.4rem; font-weight: 900; border-radius: 0.5rem; background: #e2e8f0; border: 1.5px solid #cbd5e1; color: #000;">3</button>
                    <button type="button" class="btn btn-warning" onclick="PurchasesView.pressCalcKey('-')" style="height: 55px; font-size: 1.4rem; font-weight: 900; border-radius: 0.5rem; background: #f59e0b; color: #fff; border: none;">-</button>
                    
                    <!-- Fila 4 -->
                    <button type="button" class="btn btn-secondary" onclick="PurchasesView.pressCalcKey('0')" style="height: 55px; font-size: 1.4rem; font-weight: 900; border-radius: 0.5rem; background: #e2e8f0; border: 1.5px solid #cbd5e1; color: #000;">0</button>
                    <button type="button" class="btn btn-secondary" onclick="PurchasesView.pressCalcKey('.')" style="height: 55px; font-size: 1.4rem; font-weight: 900; border-radius: 0.5rem; background: #e2e8f0; border: 1.5px solid #cbd5e1; color: #000;">.</button>
                    <button type="button" class="btn btn-danger" onclick="PurchasesView.clearCalculator()" style="height: 55px; font-size: 1.2rem; font-weight: 900; border-radius: 0.5rem; background: #ef4444; color: #fff; border: none;">C</button>
                    <button type="button" class="btn btn-warning" onclick="PurchasesView.pressCalcKey('+')" style="height: 55px; font-size: 1.4rem; font-weight: 900; border-radius: 0.5rem; background: #f59e0b; color: #fff; border: none;">+</button>
                </div>
            </div>
        `;

        const footer = `
            <div style="display: flex; gap: 1rem; width: 100%;">
                <button type="button" class="btn btn-success" onclick="PurchasesView.useCalculatorResult('${targetInputId}')" style="flex: 2; height: 50px; font-weight: 900; font-size: 1.1rem; border-radius: 0.75rem; background: #10b981; border: none; color: #fff;">
                    📥 APLICAR RESULTADO
                </button>
                <button type="button" class="btn btn-secondary" onclick="closeModal()" style="flex: 1; height: 50px; font-weight: 800; border-radius: 0.75rem; background: #cbd5e1; color: #1e293b; border: none;">
                    Cancelar
                </button>
            </div>
        `;

        showModal(content, { title: '🧮 Calculadora de Compra', footer, width: '400px' });
        
        setTimeout(() => {
            const disp = document.getElementById('calcDisplay');
            if (disp) { disp.focus(); disp.select(); }
        }, 150);
    },

    pressCalcKey(key) {
        const disp = document.getElementById('calcDisplay');
        if (disp) {
            disp.value += key;
            disp.focus();
        }
    },

    clearCalculator() {
        const disp = document.getElementById('calcDisplay');
        if (disp) {
            disp.value = '';
            disp.focus();
        }
    },

    evaluateCalculator() {
        const disp = document.getElementById('calcDisplay');
        if (!disp) return;
        const val = disp.value.trim();
        const solved = this.safeEvaluateMathExpression(val);
        if (solved !== null) {
            disp.value = solved.toFixed(4).replace(/\.?0+$/, '');
        } else {
            showNotification('Operación inválida', 'warning');
        }
    },

    useCalculatorResult(targetInputId) {
        const disp = document.getElementById('calcDisplay');
        const targetInput = document.getElementById(targetInputId);
        if (!disp || !targetInput) return;

        let val = disp.value.trim();
        const solved = this.safeEvaluateMathExpression(val);
        if (solved !== null) {
            val = solved;
        } else {
            val = parseFloat(val) || 0;
        }

        targetInput.value = val;
        targetInput.dispatchEvent(new Event('input', { bubbles: true }));
        closeModal();
    },

    safeEvaluateMathExpression(str) {
        const sanitized = str.replace(/[^0-9+\-*/().\s]/g, '');
        if (!sanitized) return null;
        try {
            const result = new Function(`return (${sanitized});`)();
            return (typeof result === 'number' && !isNaN(result) && isFinite(result)) ? result : null;
        } catch (e) {
            return null;
        }
    },

    async ensureSupplierNameMap() {
        if (this.supplierNameMap) return;
        const suppliers = await Supplier.getAllIncludingDeleted();
        this.supplierNameMap = new Map(suppliers.map(s => [s.id, s.name]));
    },

    // Helper: Obtener fecha en formato YYYY-MM-DD en hora local
    getLocalDateString(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    ensureCalendarState() {
        const baseKey = this.dateTo || this.dateFrom;
        let baseDate = null;

        if (baseKey) {
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

    parkPurchase() {
        const form = document.getElementById('purchaseForm');
        if (!form) return;

        const formData = new FormData(form);
        const data = Object.fromEntries(formData);

        const draft = {
            items: this.purchaseItems,
            supplierId: data.supplierId,
            documentType: data.documentType,
            invoiceNumber: data.invoiceNumber,
            invoiceDate: data.invoiceDate,
            vatMode: this.lastVatMode || 'net',
            manualExtraTax: this.manualExtraTax || 0,
            currentStep: this.currentStep,
            timestamp: new Date().getTime()
        };

        localStorage.setItem(this.draftKey, JSON.stringify(draft));
        closeModal();
        showNotification('Compra estacionada. Podrás retomarla cuando vuelvas a "Nueva Compra".', 'info');
        this.refresh(); // Actualizar vista para mostrar el botón de continuar
    },

    getDraft() {
        const saved = localStorage.getItem(this.draftKey);
        if (!saved) return null;
        try {
            return JSON.parse(saved);
        } catch (e) {
            return null;
        }
    },

    clearDraft() {
        localStorage.removeItem(this.draftKey);
        this.purchaseItems = [];
        this.extraTaxesList = [];
        this.manualExtraTax = 0;
        this.currentNewPurchaseStep = 1;
        this.currentStep = 1;
    },

    autosaveDraft() {
        const form = document.getElementById('purchaseForm');
        if (!form) return;

        // Solo autoguardar si es una compra nueva (no edición)
        const idInput = form.querySelector('[name="id"]');
        if (idInput && idInput.value) return;

        const formData = new FormData(form);
        const data = Object.fromEntries(formData);

        const draft = {
            items: this.purchaseItems,
            supplierId: data.supplierId,
            documentType: data.documentType,
            invoiceNumber: data.invoiceNumber,
            invoiceDate: data.invoiceDate,
            dueDate: data.dueDate,
            paymentMethod: data.paymentMethod,
            vatMode: this.lastVatMode || 'net',
            manualExtraTax: this.manualExtraTax || 0,
            extraTaxesList: this.extraTaxesList || [],
            currentNewPurchaseStep: this.currentNewPurchaseStep || 1,
            currentStep: this.currentStep,
            timestamp: new Date().getTime()
        };
        if (this.purchaseItems.length > 0) {
            localStorage.setItem(this.draftKey, JSON.stringify(draft));
        } else {
            // Si no hay items, eliminamos cualquier rastro de borrador antiguo
            localStorage.removeItem(this.draftKey);
        }
    },

    goToStep(step) {
        const docType = document.getElementById('purchaseDocumentType')?.value || 'factura_neto';
        const maxStep = 3;

        if (step > maxStep) return;

        if (step > this.currentStep) {
            // Validaciones antes de avanzar
            if (this.currentStep === 1) {
                const supplierId = document.querySelector('[name="supplierId"]').value;
                const docTypeVal = document.getElementById('purchaseDocumentType').value;
                const invoiceNumber = document.querySelector('[name="invoiceNumber"]').value;

                if (!supplierId) {
                    showNotification('Selecciona un proveedor para continuar', 'warning');
                    return;
                }

                if (docTypeVal.includes('factura') && !invoiceNumber) {
                    showNotification('El N° de Factura es obligatorio para facturas', 'warning');
                    return;
                }
            }
            if (this.currentStep === 2 && this.purchaseItems.length === 0) {
                showNotification('Debes agregar al menos un producto a la compra', 'warning');
                return;
            }
        }

        if (this.currentStep === 2 && step !== 2) {
            this.saveCartInputsFromDOM();
            this.cancelAddProduct();
        }

        this.currentStep = step;
        this.updateWizardUI();
    },

    nextStep() {
        this.goToStep(this.currentStep + 1);
    },

    prevStep() {
        if (this.currentStep > 1) {
            if (this.currentStep === 2) {
                this.saveCartInputsFromDOM();
            }
            this.currentStep--;
            this.updateWizardUI();
        }
    },

    updateWizardUI() {
        const docType = document.getElementById('purchaseDocumentType')?.value || 'factura_neto';
        const maxStep = 3;

        // Reset all steps
        document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.step-item').forEach(el => {
            el.classList.remove('active', 'completed', 'hidden-step');
            const stepNum = parseInt(el.id.replace('step-', ''));
            if (stepNum < this.currentStep) el.classList.add('completed');
            if (stepNum === this.currentStep) el.classList.add('active');
        });

        // Show current step content
        const currentContent = document.getElementById(`step-content-${this.currentStep}`);
        if (currentContent) currentContent.classList.add('active');

        // Nav buttons
        const btnPrev = document.getElementById('btn-prev');
        const btnNext = document.getElementById('btn-next');
        const btnPark = document.getElementById('btn-park');
        const btnSave = document.getElementById('btn-save');
        if (btnPrev) btnPrev.style.display = (this.currentStep > 1) ? 'block' : 'none';
        if (btnNext) btnNext.style.display = this.currentStep < maxStep ? 'block' : 'none';
        if (btnPark) btnPark.style.display = (!this.editingPurchase && this.currentStep < maxStep) ? 'inline-flex' : 'none';
        if (btnSave) btnSave.style.display = this.currentStep === maxStep ? 'block' : 'none';

        // Auto-focus logic & re-render items
        if (this.currentStep === 2) {
            this.updatePurchaseItems();
            setTimeout(() => document.getElementById('productSearchInput')?.focus(), 100);
        }
        
        if (this.currentStep === 3) {
            // Actualizar total destacado
            const totalDisplay = document.getElementById('step3TotalDisplay');
            if (totalDisplay) totalDisplay.textContent = formatCLP(this.calculateTotalForWizard());

            // Calcular margen promedio
            const { profit, margin } = this.calculateAveragePurchaseMargin();
            const marginBadge = document.getElementById('directAvgMarginBadge');
            if (marginBadge) {
                marginBadge.innerHTML = `<span style="font-size:0.8em; opacity:0.7; margin-right:0.3rem;">(${formatCLP(profit)})</span>${margin.toFixed(1)}%`;
                marginBadge.style.color = profit >= 0 ? '#6ee7b7' : '#fca5a5';
            }

            // Cargar deuda del proveedor en vivo
            const supplierId = parseInt(document.getElementById('purchaseSupplierId')?.value) || 0;
            const debtBadge = document.getElementById('directSupplierDebtBadge');
            if (debtBadge && supplierId > 0) {
                Supplier.getById(supplierId).then(supplier => {
                    const currentDebt = supplier?.currentDebt || 0;
                    if (debtBadge) debtBadge.textContent = formatCLP(currentDebt);
                }).catch(() => {
                    if (debtBadge) debtBadge.textContent = '$0';
                });
            }

            // Inicializar método de pago
            const payMethod = this._paymentMethod || 'credit';
            this.setPaymentMethod(payMethod);

            // ponytail: Renderizar el tablero de análisis de variación de precios en Step 3
            this.renderStep3PriceAnalysis();
        }
    },



    // ponytail: Cálculo contable unificado de margen y ganancia para Facturas y Boletas
    calculateItemMargin(item, isBoleta = false) {
        const qty = parseFloat(item.quantity) || 1;
        const price = parseFloat(item.price) || 0;
        const cost = parseFloat(item.cost) || 0;

        let extraTaxesUnit = 0;
        if (item.additionalTaxesConfig && item.additionalTaxesConfig.length > 0) {
            item.additionalTaxesConfig.forEach(tax => {
                const amt = (typeof tax.amount === 'number' && tax.amount > 0)
                    ? tax.amount
                    : Math.round(cost * qty * (parseFloat(tax.rate) / 100));
                extraTaxesUnit += amt / (qty || 1);
            });
        }

        if (isBoleta) {
            // Boletas de compra: no generan IVA crédito fiscal.
            // Al vender a público a precio bruto con IVA, el Débito Fiscal (19%) se paga al SII.
            // Ingreso neto del comercio = precio / 1.19.
            const netSalePrice = price > 0 ? (price / 1.19) : 0;
            const totalUnitCost = cost + extraTaxesUnit;
            const unitProfit = netSalePrice - totalUnitCost;
            const margin = totalUnitCost > 0 ? ((unitProfit / totalUnitCost) * 100) : 0;
            const lineProfit = unitProfit * qty;
            return {
                unitProfit,
                lineProfit,
                margin,
                unitCostReal: totalUnitCost,
                isLoss: price > 0 && unitProfit < 0
            };
        } else {
            // Facturas de compra: el IVA crédito se deduce del débito.
            // Costo bruto de adquisición = (costoNeto * 1.19) + impuestos especiales.
            const unitGrossCost = (cost * 1.19) + extraTaxesUnit;
            const unitProfit = price - unitGrossCost;
            const margin = unitGrossCost > 0 ? ((unitProfit / unitGrossCost) * 100) : 0;
            const lineProfit = unitProfit * qty;
            return {
                unitProfit,
                lineProfit,
                margin,
                unitCostReal: unitGrossCost,
                isLoss: price > 0 && unitProfit < 0
            };
        }
    },

    // ponytail: Sugerir precio de venta a partir de un porcentaje deseado redondeado a la decena
    suggestPriceFromMargin(cost, targetMarginPct, isBoleta = false, additionalTaxesConfig = [], qty = 1) {
        let extraTaxesUnit = 0;
        if (additionalTaxesConfig && additionalTaxesConfig.length > 0) {
            additionalTaxesConfig.forEach(tax => {
                const amt = (typeof tax.amount === 'number' && tax.amount > 0)
                    ? tax.amount
                    : Math.round(cost * qty * (parseFloat(tax.rate) / 100));
                extraTaxesUnit += amt / (qty || 1);
            });
        }

        let rawPrice = 0;
        if (isBoleta) {
            // Para obtener targetMarginPct neto sobre el costo de boleta:
            const targetNetSale = (cost + extraTaxesUnit) * (1 + (targetMarginPct / 100));
            rawPrice = targetNetSale * 1.19;
        } else {
            const unitGrossCost = (cost * 1.19) + extraTaxesUnit;
            rawPrice = unitGrossCost * (1 + (targetMarginPct / 100));
        }
        // Redondeo comercial a la decena (Ley 20.956)
        return Math.round(rawPrice / 10) * 10;
    },

    // ponytail: Aplica el margen seleccionado mediante botones rápidos al input de precio de venta
    applyQuickMargin(targetPct) {
        const pct = parseFloat(targetPct);
        if (isNaN(pct) || pct < 0) return;

        const costInput = document.getElementById('addCost');
        const priceInput = document.getElementById('addPrice');
        if (!priceInput) return;

        const enteredVal = parseFloat(costInput?.value) || 0;
        let cost = enteredVal;
        if (this.lastVatMode === 'gross') {
            cost = enteredVal > 0 ? parseFloat((enteredVal / 1.19).toFixed(4)) : 0;
        }

        if (cost <= 0) {
            showNotification('Primero ingresa el precio de costo del producto', 'warning');
            costInput?.focus();
            return;
        }

        const docType = document.getElementById('purchaseDocumentType')?.value || 'factura_neto';
        const isBoleta = docType.includes('boleta');
        const qty = parseFloat(document.getElementById('addQuantity')?.value) || 1;

        const suggestedPrice = this.suggestPriceFromMargin(cost, pct, isBoleta, this.tempProductTaxes || [], qty);
        priceInput.value = suggestedPrice;
        priceInput.dispatchEvent(new Event('input', { bubbles: true }));
    },

    promptReasonModal(title, message, defaultValue = '') {
        return new Promise((resolve) => {
            const content = `
                <div style="padding: 0.5rem 0;">
                    <p style="font-size: 0.92rem; color: #334155; margin-bottom: 0.75rem; line-height: 1.45;">${safeHTML(message)}</p>
                    <input type="text" id="customReasonInput" class="form-control" value="${safeHTML(defaultValue)}" 
                           placeholder="Escribe el motivo..."
                           style="height: 44px; font-weight: 700; font-size: 1rem; border-radius: 0.5rem; border: 2px solid #3b82f6;"
                           onkeydown="if(event.key === 'Enter') document.getElementById('btnConfirmCustomReason').click();">
                </div>
            `;
            const footer = `
                <div style="display: flex; gap: 0.75rem; width: 100%;">
                    <button type="button" class="btn btn-secondary" onclick="closeModal(); if(window._reasonResolver) window._reasonResolver(null);" style="flex: 1; height: 42px; font-weight: 800;">
                        Cancelar
                    </button>
                    <button type="button" id="btnConfirmCustomReason" class="btn btn-danger" onclick="const val = document.getElementById('customReasonInput')?.value.trim(); closeModal(); if(window._reasonResolver) window._reasonResolver(val || 'Anulación manual');" style="flex: 1.5; height: 42px; font-weight: 900; background: #ef4444; border: none; color: #fff;">
                        Anular Compra
                    </button>
                </div>
            `;
            window._reasonResolver = resolve;
            showModal(content, { title, footer, width: '450px' });
            setTimeout(() => {
                const el = document.getElementById('customReasonInput');
                if (el) { el.focus(); el.select(); }
            }, 150);
        });
    },

    calculateAveragePurchaseMargin() {
        const docType = document.getElementById('purchaseDocumentType')?.value || 'factura_neto';
        const isBoleta = docType.includes('boleta');

        let totalProfit = 0;
        let totalCostBase = 0;

        this.purchaseItems.forEach(item => {
            const qty = parseFloat(item.quantity) || 1;
            const res = this.calculateItemMargin(item, isBoleta);
            totalProfit += res.lineProfit;
            totalCostBase += res.unitCostReal * qty;
        });

        const margin = totalCostBase > 0 ? (totalProfit / totalCostBase * 100) : 0;
        return { profit: totalProfit, margin };
    },

    calculateTaxesSummary() {
        let groupedTaxes = {};
        for (const item of this.purchaseItems) {
            let lineCost = item.total || 0; 
            if (item.additionalTaxesConfig && item.additionalTaxesConfig.length > 0) {
                for (const tax of item.additionalTaxesConfig) {
                    const key = tax.name + '|' + tax.rate;
                    if (!groupedTaxes[key]) groupedTaxes[key] = { name: tax.name, rate: parseFloat(tax.rate), sumNet: 0, taxAmount: 0 };
                    groupedTaxes[key].sumNet += lineCost;
                }
            }
        }
        let taxesList = [];
        let totalExtraTaxes = 0;
        for (const key in groupedTaxes) {
            const group = groupedTaxes[key];
            const taxAmount = (Math.round(group.sumNet * (group.rate / 100) * 100) / 100);
            group.taxAmount = taxAmount;
            totalExtraTaxes += taxAmount;
            taxesList.push(group);
        }
        return { taxesList, totalExtraTaxes };
    },

    calculateTotalForWizard() {
        const docType = document.getElementById('purchaseDocumentType')?.value || 'factura_neto';
        const isFactura = docType.includes('factura');

        let netSubtotal = this.purchaseItems.reduce((sum, item) => sum + (item.total || 0), 0);
        let extraTaxesSum = 0;

        this.purchaseItems.forEach(item => {
            if (item.additionalTaxesConfig && item.additionalTaxesConfig.length > 0) {
                item.additionalTaxesConfig.forEach(tax => {
                    const amt = (typeof tax.amount === 'number' && tax.amount > 0) 
                        ? tax.amount 
                        : Math.round((item.total || 0) * (parseFloat(tax.rate) / 100));
                    extraTaxesSum += amt;
                });
            }
        });

        // ponytail: Incluir impuesto adicional ingresado directamente del pie de factura
        const directTaxInput = document.getElementById('purchaseExtraTaxInput');
        const directExtraTax = directTaxInput ? (parseFloat(directTaxInput.value) || 0) : (this.manualExtraTax || 0);
        const totalExtraTaxes = extraTaxesSum + directExtraTax;

        let ivaSum = 0;
        let grandTotal = 0;

        if (isFactura) {
            ivaSum = Math.round(netSubtotal * 0.19);
            grandTotal = netSubtotal + ivaSum + totalExtraTaxes;
        } else { // boleta o similar
            ivaSum = 0;
            grandTotal = netSubtotal + totalExtraTaxes;
        }

        return grandTotal;
    },

    async searchSuppliers(term) {
        const resultsDiv = document.getElementById('supplierSearchResults');
        if (!term || term.length < 1) {
            resultsDiv.style.display = 'none';
            this.supplierResults = [];
            this.supplierSelectedIndex = -1;
            return;
        }

        this.supplierResults = await Supplier.search(term);
        // By default, highlight the first one
        this.supplierSelectedIndex = this.supplierResults.length > 0 ? 0 : -1;

        if (this.supplierResults.length === 0) {
            resultsDiv.innerHTML = '<div class="supplier-search-item" style="padding: 1.5rem; text-align: center; opacity: 0.7; font-weight: 800; color: #1e293b;">❌ No se encontró ningún proveedor.</div>';
            resultsDiv.style.display = 'block';
            return;
        }

        this.renderSupplierResults();
    },

    renderSupplierResults() {
        const resultsDiv = document.getElementById('supplierSearchResults');
        if (!resultsDiv) return;

        resultsDiv.innerHTML = this.supplierResults.map((s, index) => {
            const isActive = index === this.supplierSelectedIndex;
            return `
                <div class="supplier-search-item ${isActive ? 'active' : ''}" 
                     data-id="${s.id}" 
                     data-name="${s.name}" 
                     onclick="PurchasesView.selectSupplier(${s.id}, '${s.name.replace(/'/g, "\\'")}')"
                     style="padding: 1.5rem; border-bottom: 3.5px solid #f1f5f9; cursor: pointer; transition: all 0.2s; background: ${isActive ? '#dcfce7 !important' : '#ffffff'}; border-left: ${isActive ? '12px solid #22c55e' : 'none'}; display: flex; flex-direction: column; gap: 4px;">
                    <span style="display: block; font-size: 1.25rem; font-weight: 950; color: #000;">${safeHTML(s.name)}</span>
                    <div style="display: flex; gap: 1rem; align-items: center;">
                        ${s.rut ? `<small style="font-weight: 800; color: #64748b; font-size: 0.8rem; background: #f1f5f9; padding: 2px 8px; border-radius: 4px;">RUT: ${s.rut}</small>` : ''}
                        <small style="opacity: 0.5; font-weight: 700; color: #1e293b; font-size: 0.75rem;">${isActive ? '↵ PRESIONA ENTER PARA SELECCIONAR' : 'CLIC PARA SELECCIONAR'}</small>
                    </div>
                </div>
            `;
        }).join('');
        resultsDiv.style.display = 'block';

        // Auto-scroll the active item into view if necessary
        if (this.supplierSelectedIndex >= 0) {
            const activeItem = resultsDiv.children[this.supplierSelectedIndex];
            if (activeItem) {
                activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    },

    handleSupplierKeydown(event) {
        if (!this.supplierResults || this.supplierResults.length === 0) return;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            this.supplierSelectedIndex = Math.min(this.supplierSelectedIndex + 1, this.supplierResults.length - 1);
            this.renderSupplierResults();
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            this.supplierSelectedIndex = Math.max(this.supplierSelectedIndex - 1, 0);
            this.renderSupplierResults();
        } else if (event.key === 'Enter') {
            event.preventDefault();
            if (this.supplierSelectedIndex >= 0) {
                const s = this.supplierResults[this.supplierSelectedIndex];
                this.selectSupplier(s.id, s.name);
            }
        }
    },

    selectSupplier(id, name) {
        const idInput = document.getElementById('purchaseSupplierId');
        const searchInput = document.getElementById('supplierSearchInput');
        const resultsDiv = document.getElementById('supplierSearchResults');
        const display = document.getElementById('selectedSupplierDisplay');
        const displayName = document.getElementById('selectedSupplierName');

        idInput.value = id;
        searchInput.value = '';
        resultsDiv.style.display = 'none';
        
        displayName.textContent = name;
        display.style.display = 'block';
        searchInput.parentElement.style.display = 'none';
        
        this.autosaveDraft();
    },

    async selectGenericSupplier() {
        try {
            const all = await Supplier.getAll();
            let genericSupplier = all.find(s => (s.name && (s.name.includes('Genérico') || s.name.includes('Varios')))) || all[0];
            if (genericSupplier) {
                this.selectSupplier(genericSupplier.id, genericSupplier.name);
            } else {
                this.selectSupplier(1, 'Proveedor Genérico / Varios');
            }
        } catch (e) {
            this.selectSupplier(1, 'Proveedor Genérico / Varios');
        }
    },

    clearSelectedSupplier() {
        const idInput = document.getElementById('purchaseSupplierId');
        const searchInput = document.getElementById('supplierSearchInput');
        const display = document.getElementById('selectedSupplierDisplay');
        
        idInput.value = '';
        display.style.display = 'none';
        searchInput.parentElement.style.display = 'block';
        setTimeout(() => searchInput.focus(), 100);
    },

    setDocType(type) {
        const idInput = document.getElementById('purchaseDocumentType');
        const btnFactura = document.getElementById('btnDocFactura');
        const btnBoleta = document.getElementById('btnDocBoleta');

        if (btnFactura) btnFactura.classList.remove('active');
        if (btnBoleta) btnBoleta.classList.remove('active');

        let newType;
        if (type === 'factura') {
            if (btnFactura) btnFactura.classList.add('active');
            newType = this.lastVatMode === 'gross' ? 'factura_bruto' : 'factura_neto';
        } else {
            if (btnBoleta) btnBoleta.classList.add('active');
            newType = 'boleta';
        }

        if (idInput) idInput.value = newType;
        this.handleDocumentTypeChange();
        this.autosaveDraft();
    },

    handleDocumentTypeChange() {
        const docType = document.getElementById('purchaseDocumentType')?.value || 'factura_neto';
        const vatSection = document.getElementById('vatModeSection');
        const invoiceGroup = document.getElementById('invoiceNumberGroup');

        if (docType.includes('factura')) {
            if (vatSection) vatSection.style.display = 'flex';
            if (invoiceGroup) invoiceGroup.style.display = 'block';
        } else { // boleta
            if (vatSection) vatSection.style.display = 'none';
            if (invoiceGroup) invoiceGroup.style.display = 'none';
            this.lastVatMode = 'net';
        }

        this.updatePurchaseItems();
        this.updateCostLabels();
        this.updateWizardUI();

        const activeCostInput = document.getElementById('addCost');
        if (activeCostInput) {
            activeCostInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
    },

    setVatMode(mode) {
        const idInput = document.getElementById('purchaseDocumentType');
        const btnNeto = document.getElementById('btnVatNeto');
        const btnBruto = document.getElementById('btnVatBruto');

        const prevVatMode = this.lastVatMode;
        const newVatMode = mode;
        this.lastVatMode = newVatMode;

        // Recálculo inteligente por error humano (Neta <-> IVA)
        if (this.purchaseItems.length > 0) {
            this.purchaseItems.forEach(item => {
                const hasEntered = (typeof item.enteredCost === 'number') && isFinite(item.enteredCost) && (item.enteredCostMode === 'net' || item.enteredCostMode === 'gross');

                if (hasEntered) {
                    if (newVatMode === 'gross' && item.enteredCostMode === 'net') {
                        // Cambió de neto a bruto: la cantidad neta ingresada se convierte en el nuevo bruto
                        item.enteredCost = item.cost;
                        item.cost = parseFloat((item.cost / 1.19).toFixed(4));
                        item.enteredCostMode = 'gross';
                    } else if (newVatMode === 'net' && item.enteredCostMode === 'gross') {
                        // Cambió de bruto a neto: la cantidad bruta ingresada se convierte en la nueva neta
                        item.cost = item.enteredCost;
                        item.enteredCost = item.cost;
                        item.enteredCostMode = 'net';
                    }
                } else {
                    item.enteredCostMode = newVatMode;
                    item.enteredCost = (newVatMode === 'gross') ? parseFloat(((item.cost || 0) * 1.19).toFixed(3)) : item.cost;
                }

                if (newVatMode === 'gross' && item.enteredCostMode === 'gross') {
                    const lineGross = Math.round((parseFloat(item.quantity) || 0) * item.enteredCost);
                    item.total = Math.round(lineGross / 1.19);
                } else {
                    item.total = Math.round((parseFloat(item.quantity) || 0) * (parseFloat(item.cost) || 0));
                }
            });
        }

        if (btnNeto) {
            btnNeto.classList.remove('btn-primary');
            btnNeto.classList.add('btn-secondary');
        }
        if (btnBruto) {
            btnBruto.classList.remove('btn-primary');
            btnBruto.classList.add('btn-secondary');
        }

        if (mode === 'net') {
            if (btnNeto) {
                btnNeto.classList.remove('btn-secondary');
                btnNeto.classList.add('btn-primary');
            }
            if (idInput) idInput.value = 'factura_neto';
        } else if (mode === 'gross') {
            if (btnBruto) {
                btnBruto.classList.remove('btn-secondary');
                btnBruto.classList.add('btn-primary');
            }
            if (idInput) idInput.value = 'factura_bruto';
        }

        // Si hay un producto activo siendo ingresado en el formulario de selección:
        const activeCostInput = document.getElementById('addCost');
        if (activeCostInput && activeCostInput.value && prevVatMode !== newVatMode) {
            const currentVal = parseFloat(activeCostInput.value) || 0;
            if (currentVal > 0) {
                if (newVatMode === 'gross') {
                    // Pasó de Neto a Bruto: convertir a bruto (multiplicar 1.19)
                    activeCostInput.value = parseFloat((currentVal * 1.19).toFixed(3));
                } else {
                    // Pasó de Bruto a Neto: convertir a neto (dividir 1.19)
                    activeCostInput.value = parseFloat((currentVal / 1.19).toFixed(3));
                }
            }
        }

        this.updatePurchaseItems();
        this.updateCostLabels();
        this.updateWizardUI();
        this.autosaveDraft();

        if (activeCostInput) {
            activeCostInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
    },

    updateCostLabels() {
        const costLabel = document.getElementById('costInputLabel');
        if (costLabel) {
            const isBoleta = (document.getElementById('purchaseDocumentType')?.value || '').includes('boleta');
            costLabel.textContent = this.lastVatMode === 'net' 
                ? (isBoleta ? '💰 Costo Real Neto' : '💰 Costo Neto')
                : '💰 Costo Bruto (con IVA)';
        }
    },

    calculateTotalForWizard() {
        const docType = document.getElementById('purchaseDocumentType')?.value || 'factura_neto';
        const isFactura = docType.includes('factura');

        let netSubtotal = this.purchaseItems.reduce((sum, item) => sum + (item.total || 0), 0);
        let extraTaxesSum = 0;

        this.purchaseItems.forEach(item => {
            if (item.additionalTaxesConfig && item.additionalTaxesConfig.length > 0) {
                item.additionalTaxesConfig.forEach(tax => {
                    const amt = (typeof tax.amount === 'number' && tax.amount > 0) 
                        ? tax.amount 
                        : Math.round((item.total || 0) * (parseFloat(tax.rate) / 100));
                    extraTaxesSum += amt;
                });
            }
        });

        let ivaSum = 0;
        let grandTotal = 0;

        if (isFactura) {
            if (this.lastVatMode === 'gross') {
                const totalGrossLines = this.purchaseItems.reduce((sum, item) => {
                    const grossUnit = (item.enteredCostMode === 'gross' && typeof item.enteredCost === 'number') 
                        ? item.enteredCost 
                        : (item.cost * 1.19);
                    return sum + Math.round((item.quantity || 0) * grossUnit);
                }, 0);
                grandTotal = Math.round(totalGrossLines + extraTaxesSum);
            } else {
                ivaSum = Math.round(netSubtotal * 0.19);
                grandTotal = Math.round(netSubtotal + ivaSum + extraTaxesSum);
            }
        } else { // boleta o similar
            ivaSum = 0;
            grandTotal = Math.round(netSubtotal + extraTaxesSum);
        }

        return grandTotal;
    },

    setQuickPayment(type) {
        const paidInput = document.getElementById('purchasePaidAmount');
        if (!paidInput || paidInput.disabled) return;

        if (type === 'credit') {
            paidInput.value = 0;
        } else if (type === 'full') {
            paidInput.value = Math.round(this.calculateTotalForWizard());
        }
        this.handlePaidAmountChange(paidInput.value);
    },

    setPaymentMethod(method) {
        this._paymentMethod = method;
        const methodInput = document.getElementById('purchasePaymentMethod');
        if (methodInput) methodInput.value = method;

        const paidSection = document.getElementById('paidAmountSection');
        const paidInput = document.getElementById('purchasePaidAmount');
        const infoDiv = document.getElementById('paymentMethodInfo');
        const deductCashGroup = document.getElementById('deductCashOptionGroup');
        const total = Math.round(this.calculateTotalForWizard());

        // Actualizar estado visual de los botones
        ['Credit', 'Cash', 'Card', 'Transfer'].forEach(m => {
            const btn = document.getElementById(`payMethod${m}`);
            if (!btn) return;
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-secondary');
        });
        const activeBtn = document.getElementById(`payMethod${method.charAt(0).toUpperCase() + method.slice(1)}`);
        if (activeBtn) { activeBtn.classList.remove('btn-secondary'); activeBtn.classList.add('btn-primary'); }

        const dueDateSection = document.getElementById('purchaseDueDateSection');
        const dueDateInput = document.getElementById('purchaseDueDateInput');

        // Mostrar/ocultar sección de monto y fecha según forma de pago
        if (method === 'credit') {
            if (paidSection) paidSection.style.display = 'none';
            if (deductCashGroup) deductCashGroup.style.display = 'none';
            if (dueDateSection) dueDateSection.style.display = 'flex';
            if (paidInput && !paidInput.disabled) paidInput.value = 0;
            if (infoDiv) {
                infoDiv.style.background = '#f0fdf4'; infoDiv.style.borderColor = '#10b981'; infoDiv.style.color = '#166534';
                infoDiv.innerHTML = '📋 <strong>100% a Crédito:</strong> Factura/Boleta por pagar a futuro. Sin movimiento de dinero hoy.';
            }
        } else if (method === 'cash') {
            if (paidSection) paidSection.style.display = 'block';
            if (deductCashGroup) deductCashGroup.style.display = 'block';
            if (dueDateSection) dueDateSection.style.display = 'none';
            if (dueDateInput) {
                dueDateInput.value = this._formatDateYMD(new Date());
                this.updateDueDateLabel(dueDateInput.value);
            }
            if (paidInput && !paidInput.disabled && (parseFloat(paidInput.value) === 0 || !paidInput.value)) {
                paidInput.value = total;
            }
            if (infoDiv) {
                infoDiv.style.background = '#fffbeb'; infoDiv.style.borderColor = '#f59e0b'; infoDiv.style.color = '#92400e';
                infoDiv.innerHTML = '💵 <strong>Pago en Efectivo:</strong> Registra el pago hoy en dinero en efectivo.';
            }
        } else if (method === 'card') {
            if (paidSection) paidSection.style.display = 'block';
            if (deductCashGroup) deductCashGroup.style.display = 'none';
            if (dueDateSection) dueDateSection.style.display = 'none';
            if (dueDateInput) {
                dueDateInput.value = this._formatDateYMD(new Date());
                this.updateDueDateLabel(dueDateInput.value);
            }
            if (paidInput && !paidInput.disabled && (parseFloat(paidInput.value) === 0 || !paidInput.value)) {
                paidInput.value = total;
            }
            if (infoDiv) {
                infoDiv.style.background = '#f5f3ff'; infoDiv.style.borderColor = '#8b5cf6'; infoDiv.style.color = '#5b21b6';
                infoDiv.innerHTML = '💳 <strong>Pago con Tarjeta:</strong> Débito o Crédito bancario (no toca la caja física).';
            }
        } else if (method === 'transfer') {
            if (paidSection) paidSection.style.display = 'block';
            if (deductCashGroup) deductCashGroup.style.display = 'none';
            if (dueDateSection) dueDateSection.style.display = 'none';
            if (dueDateInput) {
                dueDateInput.value = this._formatDateYMD(new Date());
                this.updateDueDateLabel(dueDateInput.value);
            }
            if (paidInput && !paidInput.disabled && (parseFloat(paidInput.value) === 0 || !paidInput.value)) {
                paidInput.value = total;
            }
            if (infoDiv) {
                infoDiv.style.background = '#eff6ff'; infoDiv.style.borderColor = '#3b82f6'; infoDiv.style.color = '#1e40af';
                infoDiv.innerHTML = '🏦 <strong>Transferencia Bancaria:</strong> Registra el pago por cuenta bancaria (no toca la caja física).';
            }
        }

        if (paidInput) this.handlePaidAmountChange(paidInput.value);
    },

    handlePaidAmountChange(val) {
        const paid = Math.round(parseFloat(val) || 0);
        const grandTotal = Math.round(this.calculateTotalForWizard());
        const remainingDebt = Math.max(0, grandTotal - paid);

        const debtWarning = document.getElementById('purchase-debt-warning');
        const debtAmountSpan = document.getElementById('purchase-debt-amount');
        if (debtWarning && debtAmountSpan) {
            if (remainingDebt > 0) {
                debtAmountSpan.textContent = formatCLP(remainingDebt);
                debtWarning.style.display = 'block';
            } else {
                debtWarning.style.display = 'none';
            }
        }
    },

    async render() {
        if (this.currentSection === 'new') {
            return await this.renderNewPurchaseScreen();
        }

        await this.ensureSupplierNameMap();
        this.ensureCalendarState();

        // C6: Optimización - Carga inicial según filtro y fechas
        if (this.offset === 0 && this.allPurchases.length === 0) {
            if (this.dateFrom || this.dateTo) {
                let from = this.dateFrom || this.dateTo;
                let to = this.dateTo || this.dateFrom;
                if (from > to) [from, to] = [to, from];

                // Usar T00:00:00 y T23:59:59 para asegurar rango local
                const start = new Date(from + 'T00:00:00');
                const end = new Date(to + 'T23:59:59');
                this.allPurchases = await Purchase.getByDateRange(start, end);
                this.hasMore = false;
            } else {
                switch (this.listFilter) {
                    case 'today':
                        this.allPurchases = await Purchase.getByDate(new Date());
                        this.hasMore = false;
                        break;
                    case 'week':
                        this.allPurchases = await Purchase.getThisWeek();
                        this.hasMore = false;
                        break;
                    case 'month':
                        this.allPurchases = await Purchase.getThisMonth();
                        this.hasMore = false;
                        break;
                    case 'all':
                    default:
                        this.allPurchases = await Purchase.getLatest(this.limit, this.offset);
                        this.hasMore = this.allPurchases.length === this.limit;
                        break;
                }
            }
        }

        let accountsPayable = 0;
        let currentMonthTotal = 0;
        let totalPurchasesCount = 0;
        let totalPendingCount = 0;

        try {
            const stats = await Purchase.getStatsSummary();
            if (stats && stats.summary) {
                accountsPayable = stats.summary.totalDebt || 0;
                currentMonthTotal = stats.summary.monthTotal || 0;
                totalPurchasesCount = stats.summary.totalCount || 0;
                totalPendingCount = stats.summary.pendingCount || 0;
            }
        } catch (error) {
            console.warn('Error cargando estadísticas de compras:', error);
        }

        const purchasesTableHtml = await this.renderPurchasesTable(this.allPurchases);

        return `
            <div class="view-header" style="margin-bottom: 1.25rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <h1 style="font-size: 1.85rem; font-weight: 900; color: var(--text-main); margin: 0; letter-spacing: -0.5px;">Compras a Proveedores</h1>
                        <p style="color: var(--secondary); margin-top: 0.25rem; font-size: 0.9rem; font-weight: 600;">Registra recepción de facturas, control de costos y cuentas por pagar</p>
                    </div>
                    <div style="display: flex; gap: 0.6rem; align-items: center;">
                        ${this.getDraft() ? `
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-warning" onclick="PurchasesView.restoreDraft()" style="font-weight: 900; border-radius: 0.75rem; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.25); display: flex; align-items: center; gap: 0.4rem;">
                                <span>📦</span>
                                <span>Continuar Borrador</span>
                            </button>
                            <button class="btn btn-outline-danger" onclick="if(confirm('¿Seguro que deseas descartar la compra pausada?')) { PurchasesView.clearDraft(); PurchasesView.refresh(); }" style="font-weight: 800; border-radius: 0.75rem;">
                                🗑️
                            </button>
                        </div>
                        ` : ''}
                        ${PermissionService.can('purchases.create') ? `
                        <button class="btn btn-primary" onclick="PurchasesView.showPurchaseForm()" style="font-weight: 900; font-size: 0.95rem; border-radius: 0.75rem; padding: 0.65rem 1.35rem; display: flex; align-items: center; gap: 0.45rem; box-shadow: 0 4px 15px rgba(79, 70, 229, 0.3);">
                            <span>📋</span>
                            <span>Nueva Compra</span>
                        </button>` : ''}
                    </div>
                </div>
            </div>
            
            <!-- 4 TARJETAS DE MÉTRICAS EJECUTIVAS -->
            <div class="grid grid-4" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.25rem;">
                <div class="stat-card" style="background: var(--surface); border: 2px solid var(--border); border-radius: 1rem; padding: 1.15rem 1.25rem; box-shadow: 0 4px 15px rgba(0,0,0,0.03); transition: all 0.2s;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                        <span style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Compras (Periodo)</span>
                        <span style="font-size: 1.3rem;">📦</span>
                    </div>
                    <div style="font-size: 1.75rem; font-weight: 950; color: var(--text-main); line-height: 1;">${totalPurchasesCount}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; margin-top: 0.35rem;">Facturas en el filtro actual</div>
                </div>

                <div class="stat-card" style="background: var(--surface); border: 2px solid var(--primary); border-radius: 1rem; padding: 1.15rem 1.25rem; box-shadow: 0 4px 15px rgba(79, 70, 229, 0.08); transition: all 0.2s;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                        <span style="font-size: 0.75rem; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: 0.5px;">Total del Mes</span>
                        <span style="font-size: 1.3rem;">📈</span>
                    </div>
                    <div style="font-size: 1.75rem; font-weight: 950; color: var(--primary); line-height: 1;">${formatCLP(currentMonthTotal)}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; margin-top: 0.35rem;">Gasto acumulado en mercadería</div>
                </div>

                <div class="stat-card" style="background: ${accountsPayable > 0 ? 'rgba(239, 68, 68, 0.04)' : 'var(--surface)'}; border: 2px solid ${accountsPayable > 0 ? 'var(--danger)' : 'var(--border)'}; border-radius: 1rem; padding: 1.15rem 1.25rem; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.06); transition: all 0.2s;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                        <span style="font-size: 0.75rem; font-weight: 800; color: var(--danger); text-transform: uppercase; letter-spacing: 0.5px;">Cuentas por Pagar</span>
                        <span style="font-size: 1.3rem;">⚠️</span>
                    </div>
                    <div style="font-size: 1.75rem; font-weight: 950; color: var(--danger); line-height: 1;">${formatCLP(accountsPayable)}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; margin-top: 0.35rem;">Deuda pendiente a distribuidores</div>
                </div>

                <div class="stat-card" style="background: var(--surface); border: 2px solid var(--border); border-radius: 1rem; padding: 1.15rem 1.25rem; box-shadow: 0 4px 15px rgba(0,0,0,0.03); transition: all 0.2s;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                        <span style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Facturas por Pagar</span>
                        <span style="font-size: 1.3rem;">📄</span>
                    </div>
                    <div style="font-size: 1.75rem; font-weight: 950; color: #64748b; line-height: 1;">${totalPendingCount}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; margin-top: 0.35rem;">Documentos pendientes de pago</div>
                </div>
            </div>

            <!-- BARRA DE CONTROL: FILTROS RÁPIDOS Y BUSCADOR EN TIEMPO REAL -->
            <div class="purchases-control-bar" style="background: var(--surface); border: 2px solid var(--border); border-radius: 1rem; padding: 0.75rem 1rem; margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 0.85rem; flex-wrap: wrap; box-shadow: 0 4px 15px rgba(0,0,0,0.02);">
                <!-- Filtros rápidos de fecha -->
                <div style="display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;">
                    <button type="button" class="btn btn-sm ${this.listFilter === 'today' ? 'btn-primary' : 'btn-outline-secondary'}" onclick="PurchasesView.setFilter('today')" style="font-weight: 800; border-radius: 0.6rem; padding: 0.45rem 0.85rem;">
                        📅 Hoy
                    </button>
                    <button type="button" class="btn btn-sm ${this.listFilter === 'week' ? 'btn-primary' : 'btn-outline-secondary'}" onclick="PurchasesView.setFilter('week')" style="font-weight: 800; border-radius: 0.6rem; padding: 0.45rem 0.85rem;">
                        📅 Esta Semana
                    </button>
                    <button type="button" class="btn btn-sm ${this.listFilter === 'month' ? 'btn-primary' : 'btn-outline-secondary'}" onclick="PurchasesView.setFilter('month')" style="font-weight: 800; border-radius: 0.6rem; padding: 0.45rem 0.85rem;">
                        📅 Este Mes
                    </button>
                    <button type="button" class="btn btn-sm ${this.listFilter === 'all' ? 'btn-primary' : 'btn-outline-secondary'}" onclick="PurchasesView.setFilter('all')" style="font-weight: 800; border-radius: 0.6rem; padding: 0.45rem 0.85rem;">
                        🔍 Ver Todas
                    </button>
                </div>

                <!-- Buscador en tiempo real por N° de Factura o Proveedor -->
                <div style="position: relative; min-width: 260px; flex: 1; max-width: 400px;">
                    <span style="position: absolute; left: 0.85rem; top: 50%; transform: translateY(-50%); font-size: 1rem; color: var(--text-muted); pointer-events: none;">🔍</span>
                    <input type="text" id="purchaseSearchQuery" 
                           placeholder="Buscar por N° Factura o Proveedor..." 
                           value="${safeHTML(this.searchTerm || '')}"
                           oninput="PurchasesView.onSearchInput(this.value)"
                           style="width: 100%; height: 40px; padding-left: 2.3rem; padding-right: 1rem; font-size: 0.9rem; font-weight: 700; border: 2px solid var(--border); border-radius: 0.65rem; background: var(--surface-content); box-sizing: border-box;">
                </div>
            </div>

            <div id="purchasesSectionContent">
                ${purchasesTableHtml}
            </div>
        `;
    },

    async loadMore() {
        if (this.isLoadingMore) return;
        this.isLoadingMore = true;

        const btn = document.getElementById('btnLoadMorePurchases');
        if (btn) btn.innerHTML = '<span class="spinner-inline"></span> Cargando...';

        this.offset += this.limit;

        let newPurchases = [];
        if (this.dateFrom || this.dateTo) {
            let from = this.dateFrom || this.dateTo;
            let to = this.dateTo || this.dateFrom;
            if (from > to) [from, to] = [to, from];
            newPurchases = await Purchase.getByDateRange(new Date(from + 'T00:00:00'), new Date(to + 'T23:59:59'), { limit: this.limit, offset: this.offset });
        } else {
            newPurchases = await Purchase.getLatest(this.limit, this.offset);
        }

        if (newPurchases.length < this.limit) {
            this.hasMore = false;
        }

        this.allPurchases = [...this.allPurchases, ...newPurchases];
        this.isLoadingMore = false;
        await this.refresh(false);
    },

    async refresh(reload = true) {
        if (reload) {
            this.allPurchases = [];
            this.offset = 0;
            this.hasMore = true;
        }
        // Save current scroll position to avoid aggressive page jumping
        const mainContent = document.querySelector('.main-content');
        const scrollContainer = mainContent ? mainContent : window;
        const scrollPos = scrollContainer === window ? window.scrollY : scrollContainer.scrollTop;

        const content = await this.render();
        const container = document.getElementById('view-container');
        if (container) {
            container.innerHTML = content;
            
            // Restore scroll position after a tiny delay to ensure DOM is updated
            setTimeout(() => {
                if (scrollContainer === window) {
                    window.scrollTo(0, scrollPos);
                } else {
                    scrollContainer.scrollTop = scrollPos;
                }
            }, 0);
        }
    },

    renderPurchaseHistoryDayGridButtons(year, monthIndex) {
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
                <button type="button" class="${cls}" onclick="PurchasesView.selectPurchaseCalendarDay(${day})">
                    <span>${day}</span>
                    <small>${monthName.slice(0, 3)}</small>
                </button>
            `;
        }
        return html;
    },

    refreshPurchaseHistoryDayGrid() {
        if (this._calendarYear === null || this._calendarMonth === null) this.ensureCalendarState();
        const gridEl = document.getElementById('purchaseHistoryDayGrid');
        const titleEl = document.getElementById('purchaseHistoryDayGridTitle');
        if (titleEl) titleEl.textContent = `${this._monthNames[this._calendarMonth]} ${this._calendarYear}`;
        if (gridEl) gridEl.innerHTML = this.renderPurchaseHistoryDayGridButtons(this._calendarYear, this._calendarMonth);
    },

    setPurchaseCalendarMonth(monthIndex) {
        this._calendarMonth = parseInt(monthIndex, 10);
        this.refreshPurchaseHistoryDayGrid();
    },

    setPurchaseCalendarYear(year) {
        this._calendarYear = parseInt(year, 10);
        this.refreshPurchaseHistoryDayGrid();
    },

    async selectPurchaseCalendarDay(day) {
        const year = this._calendarYear ?? new Date().getFullYear();
        const monthIndex = this._calendarMonth ?? new Date().getMonth();
        const dd = String(day).padStart(2, '0');
        const mm = String(monthIndex + 1).padStart(2, '0');
        const selectedKey = `${year}-${mm}-${dd}`;

        if (!this.dateFrom || (this.dateFrom && this.dateTo)) {
            this.dateFrom = selectedKey;
            this.dateTo = null;
        } else {
            this.dateTo = selectedKey;
            if (this.dateTo < this.dateFrom) [this.dateFrom, this.dateTo] = [this.dateTo, this.dateFrom];
        }

        this.listFilter = 'custom';
        this.offset = 0;
        this.allPurchases = [];
        this.hasMore = true;
        await this.refresh();
    },

    async selectToday() {
        const today = new Date();
        const todayStr = this.getLocalDateString(today);
        this.dateFrom = todayStr;
        this.dateTo = null;
        this._calendarYear = today.getFullYear();
        this._calendarMonth = today.getMonth();
        this.listFilter = 'today';
        this.offset = 0;
        this.allPurchases = [];
        this.hasMore = true;
        await this.refresh();
    },

    async clearDateFilter() {
        this.dateFrom = null;
        this.dateTo = null;
        this.listFilter = 'all';
        this.offset = 0;
        this.allPurchases = [];
        this.hasMore = true;
        const today = new Date();
        this._calendarYear = today.getFullYear();
        this._calendarMonth = today.getMonth();
        await this.refresh();
    },

    groupPurchasesByDay(purchases) {
        const byDay = {};
        for (const p of purchases) {
            const d = p.date ? new Date(p.date) : null;
            if (!d || Number.isNaN(d.getTime())) continue;
            const y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
            const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            if (!byDay[key]) {
                const label = d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
                byDay[key] = { dateKey: key, dateLabel: label, purchases: [], total: 0, count: 0 };
            }
            byDay[key].purchases.push(p);
            byDay[key].total += parseFloat(p.total) || 0;
            byDay[key].count += 1;
        }
        return Object.values(byDay).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
    },

    groupPurchasesByMonth(purchases) {
        const byMonth = {};
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        for (const p of purchases) {
            const d = p.date ? new Date(p.date) : null;
            if (!d || Number.isNaN(d.getTime())) continue;
            const y = d.getFullYear();
            const m = d.getMonth();
            const key = `${y}-${String(m + 1).padStart(2, '0')}`;
            if (!byMonth[key]) byMonth[key] = { key, label: `${monthNames[m]} ${y}`, purchases: [], total: 0, count: 0 };
            byMonth[key].purchases.push(p);
            byMonth[key].total += parseFloat(p.total) || 0;
            byMonth[key].count += 1;
        }
        return Object.values(byMonth).sort((a, b) => b.key.localeCompare(a.key));
    },

    renderPurchaseRow(p) {
        const isCancelled = p.status === 'cancelled';
        const diff = (parseFloat(p.total) || 0) - (parseFloat(p.paidAmount) || 0);
        const balance = isCancelled ? 0 : Math.max(0, diff >= 1.0 ? Math.round(diff) : 0);
        const supplierName = this.supplierNameMap && this.supplierNameMap.has(p.supplierId)
            ? this.supplierNameMap.get(p.supplierId)
            : `Proveedor #${p.supplierId}`;
        // Robustez: recalcular status visual si la diferencia es menor a 1 peso (CLP)
        const isPaid = p.status === 'paid' || (!isCancelled && diff < 1.0);
        
        let statusClass = 'pending';
        let statusText = 'Pendiente';
        let statusIcon = '⏳';

        if (isCancelled) {
            statusClass = 'cancelled';
            statusText = 'Anulada';
            statusIcon = '✕';
        } else if (isPaid) {
            statusClass = 'paid';
            statusText = 'Pagado';
            statusIcon = '✓';
        }

        const rawMethod = (p.paymentMethod || p.payment_method || '').toLowerCase();
        const methodLabels = {
            'cash': '💵 Efectivo',
            'transfer': '🏦 Transferencia',
            'debit': '💳 Débito',
            'credit': '📋 Crédito'
        };
        const paymentMethodLabel = methodLabels[rawMethod] || (rawMethod ? `💳 ${rawMethod}` : '');
        const itemsCount = (p.items || []).length;
        const textDecoration = isCancelled ? 'style="text-decoration: line-through;"' : '';

        return `
            <div class="purchase-card-premium ${isCancelled ? 'cancelled' : ''}">
                <!-- CABECERA -->
                <div class="purchase-card-header">
                    <div class="purchase-card-identity">
                        <div class="purchase-card-icon-bubble">📦</div>
                        <div class="purchase-card-title-group">
                            <h3 class="purchase-card-title" ${textDecoration}>
                                Compra #${p.purchaseNumber || p.id} &mdash; ${safeHTML(supplierName)}
                            </h3>
                            <div class="purchase-card-tags">
                                <span class="purchase-tag-date">📅 ${formatDate(p.date)}</span>
                                <span class="purchase-tag-invoice">📄 ${p.invoiceNumber ? `Factura Nº ${safeHTML(p.invoiceNumber)}` : 'Sin Correlativo'}</span>
                                ${isCancelled && p.cancelReason ? `<span style="color: #dc2626; font-weight: 700; background: #fee2e2; padding: 0.15rem 0.5rem; border-radius: 0.35rem; font-size: 0.75rem;">🚫 Motivo: ${safeHTML(p.cancelReason)}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div>
                        <span class="purchase-card-status-badge ${statusClass}">
                            ${statusIcon} ${statusText.toUpperCase()}
                        </span>
                    </div>
                </div>

                <!-- CAJA DE MÉTRICAS EN 2 NIVELES (CERO DESBORDES) -->
                <div class="purchase-metrics-container">
                    <div class="purchase-metrics-hero">
                        <div class="purchase-hero-total">
                            <span class="purchase-hero-label">Total Compra:</span>
                            <span class="purchase-hero-amount" ${textDecoration}>${formatCLP(p.total)}</span>
                        </div>
                        <span class="purchase-hero-badge">📦 ${itemsCount} Productos</span>
                    </div>

                    <div class="purchase-metrics-pills">
                        <div class="purchase-pill-stat">
                            <span class="purchase-pill-label">Total Neto</span>
                            <span class="purchase-pill-val" style="color: #64748b;" ${textDecoration}>${formatCLP(p.subtotal || 0)}</span>
                        </div>
                        <div class="purchase-pill-stat pill-paid">
                            <span class="purchase-pill-label" style="color: #059669;">Pagado</span>
                            <span class="purchase-pill-val" style="color: #059669;" ${textDecoration}>${formatCLP(p.paidAmount)}</span>
                        </div>
                        <div class="purchase-pill-stat ${balance > 0 ? 'pill-debt' : ''}">
                            <span class="purchase-pill-label" style="color: ${balance > 0 ? '#dc2626' : '#64748b'};">Por Pagar</span>
                            <span class="purchase-pill-val" style="color: ${balance > 0 ? '#dc2626' : '#64748b'};" ${textDecoration}>${formatCLP(balance)}</span>
                        </div>
                    </div>
                </div>

                <!-- FRANJA SECUNDARIA: MEDIO DE PAGO & ACCESO A PAGOS -->
                <div class="purchase-card-subbar">
                    <div>
                        ${paymentMethodLabel ? `<span class="purchase-payment-method-pill">${paymentMethodLabel}</span>` : '<span></span>'}
                    </div>
                    <div>
                        ${!isCancelled && parseFloat(p.paidAmount) > 0 ? `
                            <a href="javascript:void(0)" onclick="event.stopPropagation(); PurchasesView.viewPurchase(${p.id})" style="font-weight: 750; color: var(--primary); text-decoration: underline; font-size: 0.8rem; cursor: pointer;">
                                👁️ Ver desglose de pagos &rarr;
                            </a>
                        ` : ''}
                    </div>
                </div>

                <!-- BOTONERA DE ACCIÓN INTERACTIVA -->
                <div class="purchase-card-actions">
                    <button class="btn purchase-btn-detail" onclick="PurchasesView.viewPurchase(${p.id})" title="Ver detalle completo de la compra y sus productos">
                        👁️ Ver detalle
                    </button>
                    <button class="btn purchase-btn-prices" onclick="PurchasesView.openPriceChangesModal(${p.id})" title="Ver o imprimir lista de precios para estantería/góndola">
                        🏷️ Precios
                    </button>
                    ${!isCancelled && PermissionService.can('purchases.edit') ? `
                        <button class="btn purchase-btn-edit" onclick="PurchasesView.editPurchase(${p.id})" title="Editar datos o productos de la compra">
                            ✏️ Editar
                        </button>
                    ` : ''}
                    ${!isCancelled && !isPaid && PermissionService.can('purchases.pay') ? `
                        <button class="btn purchase-btn-pay" onclick="PurchasesView.showPaymentForm(${p.id})" title="Registrar abono o pago a proveedor">
                            💰 Pagar
                        </button>
                    ` : ''}
                    ${!isCancelled && PermissionService.can('purchases.delete') ? `
                        <button class="btn purchase-btn-delete" onclick="PurchasesView.deletePurchase(${p.id})" title="Anular esta compra">
                            🗑️ Anular
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    },

    async renderPurchasesTable(purchases) {
        let displayList = purchases || [];

        // Filtro en memoria por término de búsqueda (Factura o Proveedor)
        if (this.searchTerm && this.searchTerm.trim() !== '') {
            const query = this.searchTerm.toLowerCase().trim();
            displayList = displayList.filter(p => {
                const suppName = (this.supplierNameMap && this.supplierNameMap.get(p.supplierId)) || (p.supplierName || '');
                const invNum = (p.invoiceNumber || '').toString().toLowerCase();
                const pNum = (p.purchaseNumber || p.id || '').toString().toLowerCase();
                return suppName.toLowerCase().includes(query) || invNum.includes(query) || pNum.includes(query);
            });
        }

        if (displayList.length === 0) {
            return `
                <div class="card" style="padding: 3.5rem 2rem; text-align: center; background: var(--surface); border: 2px dashed var(--border); border-radius: 1.25rem;">
                    <div style="font-size: 3.5rem; margin-bottom: 1rem; opacity: 0.4;">📦</div>
                    <h3 style="color: var(--text-main); font-weight: 850; margin-bottom: 0.35rem; font-size: 1.25rem;">No se encontraron compras</h3>
                    <p style="color: var(--secondary); margin-bottom: 1.25rem; font-size: 0.9rem;">
                        ${this.searchTerm ? `No hay resultados para la búsqueda "${safeHTML(this.searchTerm)}".` : 'No hay compras registradas en este período de tiempo.'}
                    </p>
                    <div style="display: flex; justify-content: center; gap: 0.6rem;">
                        <button class="btn btn-primary" onclick="PurchasesView.selectToday()" style="font-weight: 800; border-radius: 0.65rem; padding: 0.5rem 1.15rem;">Ver compras de Hoy</button>
                        <button class="btn btn-outline-secondary" onclick="PurchasesView.clearDateFilter()" style="font-weight: 800; border-radius: 0.65rem; padding: 0.5rem 1.15rem;">Ver todas</button>
                    </div>
                </div>
            `;
        }

        let filterTitle = 'Historial General';
        if (this.listFilter === 'today') filterTitle = 'Compras de Hoy';
        if (this.listFilter === 'week') filterTitle = 'Compras de esta Semana';
        if (this.listFilter === 'month') filterTitle = 'Compras de este Mes';
        if (this.listFilter === 'custom' || this.dateFrom) filterTitle = `Rango: ${this.dateFrom} ${this.dateTo ? ' al ' + this.dateTo : ''}`;

        return `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
                <h2 style="margin: 0; font-weight: 900; color: var(--text-main); font-size: 1.2rem; display: flex; align-items: center; gap: 0.5rem;">
                    <span>📋</span>
                    <span>${filterTitle}</span>
                    <span style="background: var(--primary); color: #fff; padding: 0.1rem 0.5rem; border-radius: 0.4rem; font-size: 0.75rem; font-weight: 900;">${displayList.length}</span>
                </h2>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(480px, 1fr)); gap: 1.5rem;">
                ${displayList.map(p => this.renderPurchaseRow(p)).join('')}
            </div>

            ${this.hasMore && (!this.searchTerm || this.searchTerm.trim() === '') ? `
            <div style="text-align: center; padding: 2rem; margin-top: 1.5rem; background: var(--surface); border-radius: 1rem; border: 2px solid var(--border);">
                <button id="btnLoadMorePurchases" class="btn btn-secondary" onclick="PurchasesView.loadMore()" 
                        style="padding: 0.75rem 2.5rem; font-weight: 850; min-width: 220px; border-radius: 0.75rem; box-shadow: var(--shadow-sm);">
                    ⬇️ CARGAR MÁS COMPRAS
                </button>
            </div>
            ` : ''}
        `;
    },

    toggleCalendarView() {
        this.showCalendar = !this.showCalendar;
        const calSec = document.getElementById('purchaseCalendarSection');
        if (calSec) {
            calSec.style.display = this.showCalendar ? 'block' : 'none';
        }
    },

    onSearchInput(val) {
        this.searchTerm = val;
        // Debounce / instant render
        clearTimeout(this._searchDebounce);
        this._searchDebounce = setTimeout(() => {
            const tableDiv = document.getElementById('purchasesSectionContent');
            if (tableDiv) {
                this.renderPurchasesTable(this.allPurchases).then(html => {
                    tableDiv.innerHTML = html;
                });
            }
        }, 150);
    },

    async setFilter(filter) {
        this.listFilter = filter;
        this.dateFrom = null;
        this.dateTo = null;
        this.showCalendar = false;
        this.offset = 0;
        this.allPurchases = [];
        this.hasMore = true;
        await this.refresh();
    },

    async cleanupEmptyPurchases() {
        if (!confirm('¿Deseas eliminar permanentemente todos los registros de compra sin productos?')) return;

        try {
            const all = await Purchase.getAll();
            const emptyIds = all.filter(p => (p.items || []).length === 0).map(p => p.id);

            for (const id of emptyIds) {
                await Purchase.delete(id);
            }

            showNotification(`Se han eliminado ${emptyIds.length} registros vacíos.`, 'success');
            this.allPurchases = []; // Forzar recarga
            this.offset = 0;
            await this.refresh();
        } catch (error) {
            showNotification('Error al limpiar registros: ' + error.message, 'error');
        }
    },

    async init() {
        if (this.currentSection === 'new') {
            await this.initNewPurchaseScreen();
            return;
        }

        await this.ensureSupplierNameMap();

        // C6: Renderizar resumen de cuentas por pagar
        await this.renderAccountsPayableSummary();
    },

    async renderAccountsPayableSummary() {
        const container = document.getElementById('accountsPayableSummary');
        if (!container) {
            console.warn('C6: Contenedor accountsPayableSummary no encontrado en el DOM');
            return;
        }

        try {
            const summary = await SupplierPaymentService.getAccountsPayableSummary();
            const activeDebts = summary.filter(s => s.totalDebt > 0.01);

            if (activeDebts.length === 0) {
                container.innerHTML = '';
                return;
            }

            container.innerHTML = `
            <div class="card" style="border: 2px solid var(--danger); background: #fff1f2;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(239, 68, 68, 0.1);">
                    <h3 style="margin: 0; color: #991b1b; display: flex; align-items: center; gap: 0.75rem; font-weight: 800; font-size: 1.25rem;">
                        <span style="font-size: 1.5rem;">🚩</span> Cuentas por Pagar (${activeDebts.length} proveedores)
                    </h3>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.25rem;">
                    ${activeDebts.map(d => `
                        <div style="background: #334155; border: 2px solid #475569; padding: 1.25rem; border-radius: 1rem; display: flex; justify-content: space-between; align-items: center; box-shadow: var(--shadow-md);">
                            <div style="flex: 1;">
                                <div style="font-weight: 800; color: #ffffff; font-size: 1.1rem; margin-bottom: 0.25rem;">${d.supplier.name}</div>
                                <div style="font-size: 0.85rem; color: #cbd5e1; font-weight: 600;">${d.purchaseCount || 0} facturas pendientes</div>
                            </div>
                            <div style="text-align: right; min-width: 110px;">
                                <div style="color: #fca5a5; font-weight: 900; font-size: 1.25rem; margin-bottom: 0.5rem;">${formatCLP(d.totalDebt)}</div>
                                <button class="btn btn-sm btn-success" style="width: 100%; height: 32px; font-weight: 700;" 
                                        onclick="SuppliersView.showSupplierPaymentForm(${d.supplier.id})">
                                    💰 Pagar
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        } catch (error) {
            // Error silenciado para producción
        }
    },

    purchaseItems: [],

    async showPurchaseForm(editingPurchase = null) {
        // Si no estamos editando y no es una restauración de borrador, limpiar cualquier rastro previo
        if (!editingPurchase && !this._restoringDraft) {
            this.clearDraft();
        }

        const draft = (!editingPurchase && this._restoringDraft) ? this.getDraft() : null;
        this._restoringDraft = false; // Reset flag

        this.editingPurchase = editingPurchase;

        this.currentNewPurchaseStep = 1;

        // Inicialización de modo IVA e impuestos adicionales
        if (editingPurchase) {
            this.lastVatMode = editingPurchase.vatMode || (editingPurchase.documentType === 'factura_bruto' ? 'gross' : 'net');
            const amt = parseFloat(editingPurchase.extraTaxesAmount) || 0;
            if (amt > 0) {
                this.extraTaxesList = [{ id: 'edit-tax-1', name: 'Impuesto Adicional', amount: amt }];
                this.manualExtraTax = amt;
            } else {
                this.extraTaxesList = [];
                this.manualExtraTax = 0;
            }
        } else if (draft) {
            this.lastVatMode = draft.vatMode || (draft.documentType === 'factura_bruto' ? 'gross' : 'net');
            if (Array.isArray(draft.extraTaxesList) && draft.extraTaxesList.length > 0) {
                this.extraTaxesList = draft.extraTaxesList;
                this.manualExtraTax = this.extraTaxesList.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
            } else if (draft.manualExtraTax > 0) {
                this.extraTaxesList = [{ id: 'draft-tax-1', name: 'Impuesto Adicional', amount: parseFloat(draft.manualExtraTax) }];
                this.manualExtraTax = parseFloat(draft.manualExtraTax);
            } else {
                this.extraTaxesList = [];
                this.manualExtraTax = 0;
            }
        } else {
            this.extraTaxesList = [];
            this.manualExtraTax = 0;
            this.lastVatMode = 'net';
        }

        const rawItems = editingPurchase ? [...editingPurchase.items] : (draft ? [...draft.items] : []);
        this.purchaseItems = rawItems.map(item => {
            let costNet = parseFloat(item.cost) || 0;
            if (this.lastVatMode === 'gross') {
                costNet = parseFloat((costNet / 1.19).toFixed(2));
            }
            return {
                ...item,
                cost: costNet,
                enteredCost: item.enteredCost !== undefined ? item.enteredCost : (parseFloat(item.cost) || 0),
                enteredCostMode: item.enteredCostMode !== undefined ? item.enteredCostMode : (this.lastVatMode === 'gross' ? 'gross' : 'net')
            };
        });

        // Cargar costos históricos en segundo plano para indicadores de tendencia
        if (this.purchaseItems.length > 0) {
            Promise.all(this.purchaseItems.map(async item => {
                if (item.lastCostNeto === undefined) {
                    try {
                        let lastPurchaseCost = null;
                        if (db.mode === 'sqlite') {
                            lastPurchaseCost = await ApiClient.get(`products/${item.productId}/last-purchase-cost`);
                        }
                        item.lastCostNeto = lastPurchaseCost?.costNeto || null;
                        item.lastCostGross = lastPurchaseCost?.cost || null;
                    } catch (e) {
                        item.lastCostNeto = null;
                        item.lastCostGross = null;
                    }
                }
            })).then(() => {
                const list = document.getElementById('purchaseItemsList');
                if (list) {
                    list.innerHTML = this.renderPurchaseItems();
                }
            });
        }

        this.currentStep = 1;
        this.appliedTaxes = [];
        this.currentSection = 'new';
        await app.navigate('purchases');
    },

    closeNewPurchaseScreen() {
        if (this.purchaseItems.length > 0) {
            this.autosaveDraft();
            showNotification('Borrador de compra preservado.', 'info');
        }
        this.currentSection = 'list';
        this.editingPurchase = null;
        app.navigate('purchases');
    },

    parkPurchase() {
        this.autosaveDraft();
        showNotification('🅿️ Compra pausada y guardada como borrador.', 'success');
        this.currentSection = 'list';
        this.editingPurchase = null;
        app.navigate('purchases');
    },

    async renderNewPurchaseScreen() {
        const editingPurchase = this.editingPurchase;
        const draft = (!editingPurchase) ? this.getDraft() : null;

        const isFactura = editingPurchase ? editingPurchase.documentType.includes('factura') : (!draft || draft.documentType.includes('factura'));
        const initialDocType = editingPurchase ? editingPurchase.documentType : (draft ? draft.documentType : 'factura_neto');
        const initialSupplierId = editingPurchase ? editingPurchase.supplierId : (draft ? draft.supplierId : '');
        const initialInvoiceNumber = editingPurchase ? (editingPurchase.invoiceNumber || '') : (draft ? (draft.invoiceNumber || '') : '');
        const initialDate = editingPurchase && editingPurchase.invoiceDate ? editingPurchase.invoiceDate.split('T')[0] : (draft && draft.invoiceDate ? draft.invoiceDate.split('T')[0] : new Date().toISOString().split('T')[0]);
        const todayStr = new Date().toISOString().split('T')[0];
        const initialDueDate = editingPurchase && editingPurchase.dueDate ? editingPurchase.dueDate.split('T')[0] : (draft && draft.dueDate ? draft.dueDate.split('T')[0] : todayStr);

        return `
            <style>
                .new-purchase-screen {
                    display: flex;
                    flex-direction: column;
                    gap: 1.15rem;
                    padding-bottom: 2.5rem;
                    animation: fadeInPurchase 0.25s cubic-bezier(0.16, 1, 0.3, 1);
                }
                @keyframes fadeInPurchase {
                    from { opacity: 0; transform: translateY(6px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .doc-type-pill {
                    flex: 1;
                    height: 44px;
                    border-radius: 0.65rem;
                    border: 2px solid #cbd5e1;
                    background: #ffffff;
                    color: #475569;
                    font-weight: 900;
                    font-size: 0.9rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.45rem;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .doc-type-pill:hover {
                    border-color: #3b82f6;
                    color: #1e40af;
                    background: #f8fafc;
                }
                .doc-type-pill.active {
                    background: #3b82f6 !important;
                    color: #ffffff !important;
                    border-color: #2563eb !important;
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.35);
                }
                .supplier-search-results {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    background: #ffffff;
                    border-radius: 0.75rem;
                    box-shadow: 0 15px 35px rgba(0,0,0,0.25);
                    z-index: 1000;
                    max-height: 240px;
                    overflow-y: auto;
                    border: 2px solid #3b82f6;
                    display: none;
                    margin-top: 4px;
                }
                .supplier-search-item {
                    padding: 0.85rem 1rem;
                    cursor: pointer;
                    border-bottom: 1px solid #f1f5f9;
                    transition: all 0.15s;
                    color: #0f172a;
                    font-weight: 800;
                    font-size: 0.95rem;
                }
                .supplier-search-item:hover {
                    background: #3b82f6;
                    color: #ffffff;
                }
                .product-search-dropdown {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    background: #ffffff;
                    border-radius: 0.85rem;
                    box-shadow: 0 20px 45px rgba(0,0,0,0.3);
                    z-index: 1000;
                    max-height: 320px;
                    overflow-y: auto;
                    border: 2.5px solid #3b82f6;
                    display: none;
                    margin-top: 6px;
                }
                .search-result-item {
                    padding: 0.85rem 1.15rem;
                    cursor: pointer;
                    border-bottom: 1px solid #f1f5f9;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    transition: background 0.15s;
                }
                .search-result-item:hover, .search-result-item.selected {
                    background: #eff6ff;
                }
                .search-result-name {
                    font-size: 1rem;
                    font-weight: 900;
                    color: #0f172a;
                }
                .stock-ok { color: #059669; }
                .stock-low { color: #d97706; }
                .stock-none { color: #dc2626; }
            </style>

            <div class="new-purchase-screen">
                <!-- BARRA SUPERIOR DE ACCIONES -->
                <div style="display: flex; justify-content: space-between; align-items: center; background: #ffffff; padding: 0.85rem 1.25rem; border-radius: 1rem; border: 1.5px solid #cbd5e1; box-shadow: 0 4px 15px rgba(0,0,0,0.03); flex-wrap: wrap; gap: 0.75rem;">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <button type="button" class="btn btn-secondary" onclick="PurchasesView.closeNewPurchaseScreen()" style="font-weight: 850; border-radius: 0.65rem; padding: 0.5rem 1.15rem; display: flex; align-items: center; gap: 0.4rem; border: 1.5px solid #cbd5e1;">
                            <span>←</span>
                            <span>Volver al Historial</span>
                        </button>
                        <div>
                            <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
                                <h1 style="margin: 0; font-size: 1.45rem; font-weight: 950; color: #0f172a; line-height: 1.2;">
                                    ${editingPurchase ? `✏️ Editando Compra #${editingPurchase.id}` : '📦 Registrar Compra a Proveedor'}
                                </h1>
                                <span id="purchaseWizardStepBadge" class="badge" style="background: #eff6ff; color: #1d4ed8; border: 1.5px solid #bfdbfe; padding: 4px 10px; border-radius: 999px; font-weight: 900; font-size: 0.78rem;">
                                    PASO 1 DE 2: PRODUCTOS Y DETALLE
                                </span>
                            </div>
                            <span style="font-size: 0.82rem; color: #64748b; font-weight: 600;">Ingreso de facturas/boletas, control de costos y actualización de inventario</span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.6rem;">
                        <button type="button" class="btn btn-warning" onclick="PurchasesView.parkPurchase()" style="font-weight: 900; border-radius: 0.65rem; padding: 0.55rem 1.15rem; display: flex; align-items: center; gap: 0.4rem; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2);">
                            <span>🅿️</span>
                            <span>Pausar / Estacionar Compra</span>
                        </button>
                    </div>
                </div>

                <form id="purchaseForm" onsubmit="event.preventDefault(); PurchasesView.savePurchase();" style="display: flex; flex-direction: column; gap: 1.15rem;">
                    <input type="hidden" name="id" value="${editingPurchase ? editingPurchase.id : ''}">
                    <input type="hidden" name="supplierId" id="purchaseSupplierId" value="${initialSupplierId}" required>
                    <input type="hidden" name="documentType" id="purchaseDocumentType" value="${initialDocType}">
                    <input type="hidden" name="paymentMethod" id="purchasePaymentMethod" value="${editingPurchase ? (editingPurchase.paymentMethod || 'credit') : (draft && draft.paymentMethod ? draft.paymentMethod : 'credit')}">

                    <!-- ========================================== -->
                    <!-- FASE 1: PROVEEDOR, PRODUCTOS Y DETALLE    -->
                    <!-- ========================================== -->
                    <div id="purchaseStep1Container" style="display: flex; flex-direction: column; gap: 1.15rem;">
                        <!-- FILA 1: CABECERA DE DOCUMENTO Y PROVEEDOR (HORIZONTAL Y DESPEJADA) -->
                        <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 1rem; padding: 1.15rem 1.35rem; box-shadow: 0 4px 15px rgba(0,0,0,0.03); display: grid; grid-template-columns: 1.6fr 1.2fr 1fr 1fr; gap: 1.25rem; align-items: end;">
                            <!-- Selector de Proveedor -->
                            <div>
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                                    <label style="display: block; font-weight: 950; font-size: 0.78rem; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">🏢 PROVEEDOR *</label>
                                    <button type="button" class="btn btn-sm btn-outline-secondary" onclick="PurchasesView.selectGenericSupplier()" style="font-weight: 850; font-size: 0.72rem; border-radius: 4px; padding: 2px 8px;">🏷️ Proveedor Genérico</button>
                                </div>
                                <div style="position: relative;">
                                    <div id="selectedSupplierDisplay" style="display: none; background: #1e293b; border-radius: 0.65rem; padding: 0.5rem 0.85rem; justify-content: space-between; align-items: center; border: 2px solid #3b82f6;">
                                        <div style="display: flex; align-items: center; gap: 0.5rem; overflow: hidden;">
                                            <span style="font-size: 1.2rem;">🏢</span>
                                            <span id="selectedSupplierName" style="font-weight: 900; color: #ffffff; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">-</span>
                                        </div>
                                        <button type="button" class="btn btn-sm btn-danger" style="border-radius: 0.5rem; font-weight: 900; padding: 0.25rem 0.65rem; font-size: 0.75rem;" onclick="PurchasesView.clearSelectedSupplier()">CAMBIAR</button>
                                    </div>
                                    <div>
                                        <input type="text" id="supplierSearchInput" class="form-control" placeholder="Buscar proveedor por nombre o RUT..."
                                               style="height: 44px; font-weight: 800; font-size: 0.95rem; border-radius: 0.65rem; border: 2px solid #cbd5e1; background: #f8fafc;"
                                               autocomplete="off"
                                               oninput="PurchasesView.searchSuppliers(this.value)"
                                               onkeydown="PurchasesView.handleSupplierKeydown(event)">
                                        <div id="supplierSearchResults" class="supplier-search-results"></div>
                                    </div>
                                </div>
                            </div>

                            <!-- Tipo de Documento e IVA condicional -->
                            <div>
                                <label style="display: block; font-weight: 950; font-size: 0.78rem; color: #1e293b; text-transform: uppercase; margin-bottom: 0.35rem; letter-spacing: 0.5px;">📄 DOCUMENTO & IVA</label>
                                <div style="display: flex; gap: 0.5rem;">
                                    <button type="button" id="btnDocFactura" class="doc-type-pill ${isFactura ? 'active' : ''}" onclick="PurchasesView.setDocType('factura')">
                                        <span>📄</span><span>Factura</span>
                                    </button>
                                    <button type="button" id="btnDocBoleta" class="doc-type-pill ${!isFactura ? 'active' : ''}" onclick="PurchasesView.setDocType('boleta')">
                                        <span>🧾</span><span>Boleta</span>
                                    </button>
                                </div>
                                <!-- Selector Neto / Bruto (SOLO visible si es Factura) -->
                                <div id="vatModeSection" style="display: ${isFactura ? 'flex' : 'none'}; gap: 0.35rem; margin-top: 0.5rem;">
                                    <button type="button" id="btnVatNeto" class="btn btn-sm ${this.lastVatMode === 'net' ? 'btn-primary' : 'btn-secondary'}" onclick="PurchasesView.setVatMode('net')" style="flex: 1; height: 32px; font-size: 0.75rem; font-weight: 900; border-radius: 0.45rem;">
                                        SIN IVA (NETO)
                                    </button>
                                    <button type="button" id="btnVatBruto" class="btn btn-sm ${this.lastVatMode === 'gross' ? 'btn-primary' : 'btn-secondary'}" onclick="PurchasesView.setVatMode('gross')" style="flex: 1; height: 32px; font-size: 0.75rem; font-weight: 900; border-radius: 0.45rem;">
                                        CON IVA (BRUTO)
                                    </button>
                                </div>
                            </div>

                            <!-- N° Folio / Factura -->
                            <div id="invoiceNumberGroup" style="display: ${isFactura ? 'block' : 'none'};">
                                <label style="display: block; font-weight: 950; font-size: 0.78rem; color: #1e293b; text-transform: uppercase; margin-bottom: 0.35rem; letter-spacing: 0.5px;">🔢 N° FACTURA / FOLIO</label>
                                <input type="text" name="invoiceNumber" class="form-control" value="${safeHTML(initialInvoiceNumber)}" placeholder="Ej: 14820"
                                       style="height: 44px; font-weight: 900; font-size: 1.05rem; border-radius: 0.65rem; border: 2px solid #cbd5e1; background: #f8fafc; text-align: center;">
                            </div>

                            <!-- Fecha de Compra -->
                            <div>
                                <label style="display: block; font-weight: 950; font-size: 0.78rem; color: #1e293b; text-transform: uppercase; margin-bottom: 0.35rem; letter-spacing: 0.5px;">📅 FECHA DE EMISIÓN</label>
                                <input type="date" name="invoiceDate" class="form-control" value="${initialDate}" required
                                       style="height: 44px; font-weight: 900; font-size: 0.95rem; border-radius: 0.65rem; border: 2px solid #cbd5e1; background: #f8fafc; text-align: center;">
                            </div>
                        </div>

                        <!-- FILA 2: BUSCADOR DE PRODUCTOS Y FORMULARIO DE AGREGAR -->
                        <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 1rem; padding: 1.15rem 1.35rem; box-shadow: 0 4px 15px rgba(0,0,0,0.03);">
                            <div style="position: relative;">
                                <label style="display: block; font-weight: 950; font-size: 0.8rem; color: #1e293b; text-transform: uppercase; margin-bottom: 0.4rem; letter-spacing: 0.5px;">
                                    🔍 BUSCAR PRODUCTO POR NOMBRE O PISTOLEAR CÓDIGO DE BARRA
                                </label>
                                <div style="display: flex; gap: 0.5rem; position: relative;">
                                    <input type="text" id="productSearchInput" class="form-control" 
                                           placeholder="Escribe el nombre del producto o escanea su código de barras..." 
                                           style="height: 46px; font-size: 1.05rem; font-weight: 850; border-radius: 0.75rem; border: 2.5px solid #3b82f6; padding-left: 1rem; background: #f8fafc; flex: 1;"
                                           autocomplete="off">
                                    <button type="button" class="btn btn-secondary" onclick="PurchasesView.resetSearchInput(true)" style="font-weight: 850; border-radius: 0.75rem; padding: 0 1.25rem;">
                                        Limpiar
                                    </button>
                                </div>
                                <div id="purchaseProductSearchResults" class="product-search-dropdown"></div>
                            </div>

                            <!-- ÁREA DE PRODUCTO SELECCIONADO (CANTIDAD, COSTO, PRECIO VENTA Y MÉTRICAS) -->
                            <div id="productSelectionArea"></div>
                        </div>

                        <!-- FILA 3: LISTADO DE PRODUCTOS EN EL CARRO (TABLA ANCHA) -->
                        <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 1rem; padding: 1.15rem 1.35rem; box-shadow: 0 4px 15px rgba(0,0,0,0.03);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                                <h3 style="margin: 0; font-size: 1.1rem; font-weight: 950; color: #1e293b; display: flex; align-items: center; gap: 0.5rem;">
                                    <span>🛒</span>
                                    <span>Detalle de Productos en la Compra</span>
                                </h3>
                                <span style="font-size: 0.8rem; color: #64748b; font-weight: 700;">Puedes modificar cantidades, costos o precios directamente en la grilla</span>
                            </div>
                            <div id="purchaseItemsList" style="overflow-x: auto; min-height: 180px;">
                                ${this.renderPurchaseItems()}
                            </div>
                        </div>

                        <!-- GESTIÓN DE IMPUESTOS ADICIONALES (MULTI-IMPUESTOS EN FASE 1) -->
                        <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 1rem; padding: 1.15rem 1.35rem; box-shadow: 0 4px 15px rgba(0,0,0,0.03);">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
                                <div>
                                    <h3 style="margin: 0; font-size: 1.05rem; font-weight: 950; color: #1e293b; display: flex; align-items: center; gap: 0.5rem;">
                                        <span>➕</span>
                                        <span>Impuestos Adicionales de la Factura (IABA, Harina, Licores, Bebidas)</span>
                                    </h3>
                                    <span style="font-size: 0.8rem; color: #64748b; font-weight: 600;">
                                        Si tu factura incluye uno o más impuestos adicionales al IVA, agrégalos aquí con su valor en pesos:
                                    </span>
                                </div>
                            </div>

                            <!-- Fila de formulario para ingresar un impuesto adicional -->
                            <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 0.75rem; padding: 0.85rem 1rem; display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: flex-end;">
                                <div style="flex: 1.8; min-width: 220px;">
                                    <label style="display: block; font-weight: 900; font-size: 0.75rem; color: #334155; text-transform: uppercase; margin-bottom: 0.25rem;">Tipo de Impuesto</label>
                                    <select id="extraTaxTypeSelect" class="form-control" onchange="PurchasesView.handleExtraTaxTypeChange(this.value)"
                                            style="height: 42px; font-weight: 850; font-size: 0.88rem; border-radius: 0.55rem; border: 1.5px solid #cbd5e1; background: #ffffff;">
                                        <option value="IABA 10%">IABA 10% (Bebidas analcohólicas azúcar baja / sin azúcar)</option>
                                        <option value="IABA 18%">IABA 18% (Bebidas analcohólicas alto contenido de azúcar)</option>
                                        <option value="Harina 12%">Harina 12% (Harina de trigo)</option>
                                        <option value="Vinos y Chichas 20.5%">Vinos y Chichas 20.5%</option>
                                        <option value="Cervezas 20.5%">Cervezas 20.5%</option>
                                        <option value="Licores y Destilados 31.5%">Licores y Destilados 31.5%</option>
                                        <option value="Carnes Faenamiento 5%">Carnes Faenamiento 5%</option>
                                        <option value="OTRO">Otro Impuesto Personalizado...</option>
                                    </select>
                                </div>
                                <div id="extraTaxCustomNameContainer" style="display: none; flex: 1.2; min-width: 160px;">
                                    <label style="display: block; font-weight: 900; font-size: 0.75rem; color: #334155; text-transform: uppercase; margin-bottom: 0.25rem;">Nombre Personalizado</label>
                                    <input type="text" id="extraTaxCustomName" class="form-control" placeholder="Ej: Impuesto Específico"
                                           style="height: 42px; font-weight: 850; font-size: 0.9rem; border-radius: 0.55rem; border: 1.5px solid #cbd5e1; background: #ffffff;">
                                </div>
                                <div style="flex: 1.2; min-width: 150px;">
                                    <label style="display: block; font-weight: 900; font-size: 0.75rem; color: #334155; text-transform: uppercase; margin-bottom: 0.25rem;">Monto en Pesos ($)</label>
                                    <div style="position: relative;">
                                        <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #f59e0b; font-weight: 950; font-size: 0.95rem;">$</span>
                                        <input type="number" id="extraTaxAmountInput" class="form-control" placeholder="Ej: 14500" min="1" step="1"
                                               style="height: 42px; padding-left: 1.6rem; font-weight: 900; font-size: 0.95rem; border-radius: 0.55rem; border: 1.5px solid #cbd5e1; background: #ffffff; text-align: right;"
                                               onkeydown="if(event.key === 'Enter') { event.preventDefault(); PurchasesView.addExtraTaxFromInput(); }">
                                    </div>
                                </div>
                                <div>
                                    <button type="button" class="btn btn-warning" onclick="PurchasesView.addExtraTaxFromInput()"
                                            style="height: 42px; font-weight: 900; font-size: 0.88rem; border-radius: 0.55rem; padding: 0 1.25rem; display: flex; align-items: center; gap: 0.4rem; box-shadow: 0 2px 8px rgba(245, 158, 11, 0.25); white-space: nowrap;">
                                        <span>➕</span><span>Agregar Impuesto</span>
                                    </button>
                                </div>
                            </div>

                            <!-- Listado de Impuestos Creados: el botón Quitar solo aparece cuando se crea un impuesto -->
                            <div id="extraTaxesBadgesList" style="margin-top: 0.85rem;"></div>
                        </div>

                        <!-- BARRA INFERIOR DE NAVEGACIÓN DE FASE 1: RESUMEN + CONTINUAR AL PASO 2 -->
                        <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 1rem; padding: 1rem 1.35rem; box-shadow: 0 4px 15px rgba(0,0,0,0.03); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                            <div style="display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap;">
                                <div style="display: flex; align-items: center; gap: 0.55rem;">
                                    <span style="font-size: 1.4rem;">🛒</span>
                                    <div>
                                        <div style="font-size: 0.72rem; color: #64748b; font-weight: 850; text-transform: uppercase; letter-spacing: 0.5px;">Productos en el Carro</div>
                                        <div id="step1ItemCount" style="font-size: 1.15rem; font-weight: 950; color: #0f172a;">${this.purchaseItems.length} producto${this.purchaseItems.length === 1 ? '' : 's'}</div>
                                    </div>
                                </div>
                                <div style="height: 34px; width: 1.5px; background: #e2e8f0;"></div>
                                <div>
                                    <div style="font-size: 0.72rem; color: #64748b; font-weight: 850; text-transform: uppercase; letter-spacing: 0.5px;">Subtotal Neto</div>
                                    <div id="step1NetoSubtotal" style="font-size: 1.15rem; font-weight: 950; color: #2563eb;">$0</div>
                                </div>
                            </div>
                            <div>
                                <button type="button" class="btn btn-primary" onclick="PurchasesView.goToNewPurchaseStep(2)"
                                        style="height: 50px; padding: 0 2rem; font-size: 1.05rem; font-weight: 950; border-radius: 0.75rem; display: flex; align-items: center; gap: 0.65rem; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); border: none; box-shadow: 0 4px 15px rgba(37,99,235,0.35); cursor: pointer;">
                                    <span>Continuar al Pago y Cierre</span>
                                    <span style="font-size: 1.25rem;">➔</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- ========================================== -->
                    <!-- FASE 2: FORMA DE PAGO, TOTALES Y GÓNDOLA  -->
                    <!-- ========================================== -->
                    <div id="purchaseStep2Container" style="display: none; flex-direction: column; gap: 1.15rem;">
                        <!-- BARRA SUPERIOR DE FASE 2: BOTÓN RETROCEDER -->
                        <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 1rem; padding: 0.85rem 1.25rem; box-shadow: 0 4px 15px rgba(0,0,0,0.03); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
                            <button type="button" class="btn btn-secondary" onclick="PurchasesView.goToNewPurchaseStep(1)"
                                    style="height: 42px; font-weight: 900; font-size: 0.92rem; border-radius: 0.65rem; padding: 0 1.25rem; display: flex; align-items: center; gap: 0.5rem; border: 2px solid #cbd5e1; background: #f8fafc; color: #1e293b;">
                                <span style="font-size: 1.15rem;">←</span>
                                <span>Volver a Modificar Productos [Paso 1]</span>
                            </button>
                            <span class="badge" style="background: #eff6ff; color: #1d4ed8; border: 1.5px solid #bfdbfe; padding: 6px 14px; border-radius: 999px; font-weight: 900; font-size: 0.82rem;">
                                Paso 2 de 2: Forma de Pago, Totales y Cierre
                            </span>
                        </div>

                        <!-- PANEL DISTRIBUIDO EN 3 COLUMNAS -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1.2fr; gap: 1.25rem; align-items: start;">
                            <!-- COLUMNA 1: FORMA DE PAGO Y CALENDARIO REDISEÑADO -->
                            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 1rem; padding: 1.15rem; box-shadow: 0 4px 15px rgba(0,0,0,0.03); display: flex; flex-direction: column; gap: 0.75rem;">
                                <label style="display: block; font-weight: 950; color: #1e293b; text-transform: uppercase; font-size: 0.78rem; margin: 0; letter-spacing: 0.5px;">
                                    💳 FORMA DE PAGO
                                </label>
                                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.35rem;">
                                    <button type="button" id="payMethodCredit" class="btn btn-primary" onclick="PurchasesView.setPaymentMethod('credit')" style="height: 48px; font-weight: 950; font-size: 0.78rem; border-radius: 0.65rem; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.1; padding: 2px;">
                                        <span>📋</span>A Crédito
                                    </button>
                                    <button type="button" id="payMethodCash" class="btn btn-secondary" onclick="PurchasesView.setPaymentMethod('cash')" style="height: 48px; font-weight: 950; font-size: 0.78rem; border-radius: 0.65rem; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.1; padding: 2px;">
                                        <span>💵</span>Efectivo
                                    </button>
                                    <button type="button" id="payMethodCard" class="btn btn-secondary" onclick="PurchasesView.setPaymentMethod('card')" style="height: 48px; font-weight: 950; font-size: 0.78rem; border-radius: 0.65rem; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.1; padding: 2px;">
                                        <span>💳</span>Tarjeta
                                    </button>
                                    <button type="button" id="payMethodTransfer" class="btn btn-secondary" onclick="PurchasesView.setPaymentMethod('transfer')" style="height: 48px; font-weight: 950; font-size: 0.78rem; border-radius: 0.65rem; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.1; padding: 2px;">
                                        <span>🏦</span>Transfer.
                                    </button>
                                </div>

                                <!-- Monto Pagado hoy -->
                                <div id="paidAmountSection" style="display: none; background: #f0fdf4; border: 2px solid #10b981; border-radius: 0.75rem; padding: 0.75rem;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                                        <span style="font-size: 0.75rem; font-weight: 900; color: #166534; text-transform: uppercase;">MONTO PAGADO HOY</span>
                                        <button type="button" onclick="PurchasesView.setQuickPayment('full')" style="background: rgba(16,185,129,0.15); color: #059669; border: 1px solid #10b981; border-radius: 0.4rem; font-size: 0.7rem; font-weight: 900; padding: 2px 8px; cursor: pointer;">Pagar Todo</button>
                                    </div>
                                    <div style="position: relative;">
                                        <span style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); font-size: 1.2rem; color: #10b981; font-weight: 950;">$</span>
                                        <input type="number" name="paidAmount" id="purchasePaidAmount" class="form-control"
                                               style="height: 40px; padding-left: 1.8rem; font-size: 1.15rem; font-weight: 950; color: #000; text-align: right; border-radius: 0.5rem; background: #ffffff; border: 2px solid #10b981;"
                                               value="${editingPurchase ? editingPurchase.paidAmount : 0}" min="0"
                                               oninput="PurchasesView.handlePaidAmountChange(this.value)">
                                    </div>

                                    <!-- Casilla de descuento de caja -->
                                    <div id="deductCashOptionGroup" style="display: none; margin-top: 0.5rem;">
                                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 0.4rem 0.6rem; background: #fffbeb; border: 1.5px solid #f59e0b; border-radius: 0.5rem; font-weight: 800; font-size: 0.75rem; color: #92400e; margin: 0;">
                                            <input type="checkbox" name="deductFromCashRegister" id="deductFromCashRegisterInput" value="true" style="width: 17px; height: 17px; accent-color: #2563eb; cursor: pointer;">
                                            <span>📉 ¿Descontar este dinero de la <strong>Caja de Turno</strong> actual?</span>
                                        </label>
                                    </div>

                                    <div id="purchase-debt-warning" style="display: none; margin-top: 0.35rem; padding: 0.35rem 0.6rem; border-radius: 0.5rem; background: rgba(239,68,68,0.1); border: 1.5px solid #ef4444;">
                                        <span style="color: #dc2626; font-size: 0.75rem; font-weight: 950;">🚨 Saldo restante: <span id="purchase-debt-amount" style="background: #ef4444; color: #fff; padding: 1px 5px; border-radius: 0.35rem;">$0</span></span>
                                    </div>
                                </div>

                                <!-- CALENDARIO DE PAGO / VENCIMIENTO (SOLO PARA COMPRAS A CRÉDITO) -->
                                <div id="purchaseDueDateSection" style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 0.85rem; padding: 0.85rem; display: flex; flex-direction: column; gap: 0.55rem;">
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <label style="font-weight: 950; color: #1e293b; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.5px; margin: 0; display: flex; align-items: center; gap: 0.35rem;">
                                            <span>📅</span> FECHA DE PAGO / VENCIMIENTO
                                        </label>
                                        <span id="dueDateRelativeLabel" style="font-size: 0.72rem; font-weight: 850; color: #2563eb; background: #eff6ff; padding: 1px 6px; border-radius: 4px; border: 1px solid #bfdbfe;">
                                            (Hoy)
                                        </span>
                                    </div>

                                    <!-- Atajos rápidos para cambiar la fecha con un solo clic -->
                                    <div style="display: flex; flex-wrap: wrap; gap: 0.3rem;">
                                        <button type="button" class="btn btn-sm" onclick="PurchasesView.setDueDateQuick('yesterday')"
                                                style="flex: 1; min-width: 55px; height: 28px; padding: 0 4px; font-size: 0.72rem; font-weight: 900; border-radius: 0.4rem; background: #fff7ed; color: #c2410c; border: 1px solid #fdba74;" title="Para compras del día anterior ingresadas hoy">
                                            ⏪ Ayer
                                        </button>
                                        <button type="button" class="btn btn-sm" onclick="PurchasesView.setDueDateQuick('today')"
                                                style="flex: 1; min-width: 50px; height: 28px; padding: 0 4px; font-size: 0.72rem; font-weight: 900; border-radius: 0.4rem; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;">
                                            Hoy
                                        </button>
                                        <button type="button" class="btn btn-sm" onclick="PurchasesView.setDueDateQuick('+7')"
                                                style="flex: 1; min-width: 50px; height: 28px; padding: 0 4px; font-size: 0.72rem; font-weight: 850; border-radius: 0.4rem; background: #ffffff; color: #334155; border: 1px solid #cbd5e1;">
                                            +7d
                                        </button>
                                        <button type="button" class="btn btn-sm" onclick="PurchasesView.setDueDateQuick('+15')"
                                                style="flex: 1; min-width: 50px; height: 28px; padding: 0 4px; font-size: 0.72rem; font-weight: 850; border-radius: 0.4rem; background: #ffffff; color: #334155; border: 1px solid #cbd5e1;">
                                            +15d
                                        </button>
                                        <button type="button" class="btn btn-sm" onclick="PurchasesView.setDueDateQuick('+30')"
                                                style="flex: 1; min-width: 50px; height: 28px; padding: 0 4px; font-size: 0.72rem; font-weight: 850; border-radius: 0.4rem; background: #ffffff; color: #334155; border: 1px solid #cbd5e1;">
                                            +30d
                                        </button>
                                        <button type="button" class="btn btn-sm" onclick="PurchasesView.setDueDateQuick('endOfMonth')"
                                                style="flex: 1; min-width: 70px; height: 28px; padding: 0 4px; font-size: 0.72rem; font-weight: 850; border-radius: 0.4rem; background: #ffffff; color: #334155; border: 1px solid #cbd5e1;">
                                            Fin de Mes
                                        </button>
                                    </div>

                                    <!-- Input de fecha estilizado con valor actual por defecto -->
                                    <div style="position: relative;">
                                        <input type="date" name="dueDate" id="purchaseDueDateInput" class="form-control"
                                               value="${initialDueDate}" required
                                               style="height: 42px; font-size: 0.95rem; font-weight: 900; border-radius: 0.6rem; background: #ffffff; text-align: center; border: 2px solid #cbd5e1; color: #0f172a; width: 100%; box-shadow: inset 0 1px 3px rgba(0,0,0,0.05);"
                                               onchange="PurchasesView.updateDueDateLabel(this.value)">
                                    </div>
                                </div>
                            </div>

                            <!-- COLUMNA 2: RESUMEN FINANCIERO Y TOTALES REDISEÑADOS -->
                            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 1rem; padding: 1.15rem; box-shadow: 0 4px 15px rgba(0,0,0,0.03); display: flex; flex-direction: column; gap: 0.85rem;">
                                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem;">
                                    <div style="display: flex; align-items: center; gap: 0.4rem;">
                                        <span style="font-size: 1.05rem;">📊</span>
                                        <label style="font-weight: 950; color: #1e293b; text-transform: uppercase; font-size: 0.78rem; margin: 0; letter-spacing: 0.5px;">
                                            RESUMEN FINANCIERO
                                        </label>
                                    </div>
                                    <span style="font-size: 0.7rem; font-weight: 800; color: #64748b; background: #f1f5f9; padding: 2px 8px; border-radius: 999px;">
                                        Valores CLP
                                    </span>
                                </div>

                                <!-- Desglose de importes -->
                                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 0.75rem 0.9rem; display: flex; flex-direction: column; gap: 0.5rem;">
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <span style="color: #475569; font-size: 0.82rem; font-weight: 800;">Neto Subtotal:</span>
                                        <strong id="step2Neto" style="font-size: 1.15rem; font-weight: 950; color: #0f172a;">$0</strong>
                                    </div>
                                    <div id="step2IvaGroup" style="display: ${isFactura ? 'flex' : 'none'}; justify-content: space-between; align-items: center; border-top: 1px dashed #cbd5e1; padding-top: 0.4rem;">
                                        <span style="color: #475569; font-size: 0.82rem; font-weight: 800;">IVA (19%):</span>
                                        <strong id="step2Iva" style="font-size: 1.15rem; font-weight: 950; color: #0f172a;">$0</strong>
                                    </div>

                                    <!-- Desglose de Impuestos Adicionales configurados en Fase 1 -->
                                    <div id="step2ExtraTaxesList" style="display: none; flex-direction: column; gap: 0.35rem; border-top: 1px dashed #cbd5e1; padding-top: 0.4rem;"></div>
                                    <div id="step2ExtraTaxGroup" style="display: none; justify-content: space-between; align-items: center; border-top: 1px dashed #cbd5e1; padding-top: 0.4rem;">
                                        <span style="color: #d97706; font-size: 0.8rem; font-weight: 900; text-transform: uppercase;">Total Imp. Especiales:</span>
                                        <strong id="step2ExtraTax" style="font-size: 1.15rem; font-weight: 950; color: #b45309;">$0</strong>
                                    </div>
                                </div>

                                <!-- Gran Total a Pagar en caja verde moderna de alto impacto -->
                                <div style="background: linear-gradient(135deg, #065f46 0%, #047857 100%); padding: 1rem 1.15rem; border-radius: 0.85rem; box-shadow: 0 4px 12px rgba(4,120,87,0.2); display: flex; flex-direction: column; gap: 0.25rem;">
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <span style="color: #a7f3d0; font-size: 0.75rem; font-weight: 950; text-transform: uppercase; letter-spacing: 0.8px;">TOTAL A PAGAR</span>
                                        <span style="background: rgba(255,255,255,0.18); color: #ffffff; font-size: 0.68rem; font-weight: 900; padding: 2px 7px; border-radius: 4px;">FINAL</span>
                                    </div>
                                    <div id="purchaseTotal" style="font-size: 2.15rem; font-weight: 950; color: #ffffff; line-height: 1.1; letter-spacing: -0.5px;">$0</div>
                                    <div id="step3TotalDisplay" style="display: none;">$0</div>
                                </div>
                            </div>

                            <!-- COLUMNA 3: TABLERO DE PRECIOS EN GÓNDOLA Y BOTÓN GUARDAR -->
                            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 1rem; padding: 1.15rem; box-shadow: 0 4px 15px rgba(0,0,0,0.03); display: flex; flex-direction: column; justify-content: space-between; gap: 0.75rem;">
                                <div>
                                    <label style="display: block; font-weight: 950; color: #1e293b; text-transform: uppercase; font-size: 0.78rem; margin-bottom: 0.35rem; letter-spacing: 0.5px;">
                                        🏷️ ANÁLISIS DE PRECIOS PARA GÓNDOLA
                                    </label>
                                    <div id="step3PriceAnalysisContainer"></div>
                                </div>

                                <button type="button" class="btn btn-success" onclick="PurchasesView.savePurchase()" 
                                        style="height: 52px; font-size: 1.15rem; font-weight: 950; border-radius: 0.75rem; background: #10b981; border: none; color: #ffffff; display: flex; align-items: center; justify-content: center; gap: 0.5rem; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.35);">
                                    <span>✅</span>
                                    <span>${editingPurchase ? 'Actualizar Compra' : 'Confirmar y Guardar Compra'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        `;
    },

    async initNewPurchaseScreen() {
        const editingPurchase = this.editingPurchase;
        const draft = (!editingPurchase) ? this.getDraft() : null;

        // Inicializar nombre del proveedor seleccionado
        if (editingPurchase || (draft && draft.supplierId)) {
            const sid = editingPurchase ? editingPurchase.supplierId : draft.supplierId;
            Supplier.getById(parseInt(sid)).then(s => {
                if (s) {
                    const disp = document.getElementById('selectedSupplierDisplay');
                    const name = document.getElementById('selectedSupplierName');
                    const search = document.getElementById('supplierSearchInput');
                    if (disp && name) {
                        name.textContent = s.name;
                        disp.style.display = 'flex';
                        if (search && search.parentElement) search.parentElement.style.display = 'none';
                    }
                }
            });
        }

        // Listener del buscador de productos en tiempo real
        const searchInput = document.getElementById('productSearchInput');
        const resultsDiv = document.getElementById('purchaseProductSearchResults');
        let searchTimeout;

        if (searchInput) {
            searchInput.addEventListener('input', async (e) => {
                const term = e.target.value.trim();

                // Barcode auto-detection (8+ digits)
                if (term.length >= 8 && !isNaN(term)) {
                    clearTimeout(searchTimeout);
                    searchTimeout = null;
                    await this.searchAndShowProduct(term);
                    searchInput.value = '';
                    if (resultsDiv) resultsDiv.style.display = 'none';
                    return;
                }

                const selectionArea = document.getElementById('productSelectionArea');
                if (selectionArea && selectionArea.innerHTML.trim() !== '') {
                    if (resultsDiv) resultsDiv.style.display = 'none';
                    return;
                }

                if (term.length >= 2) {
                    clearTimeout(searchTimeout);
                    searchTimeout = setTimeout(async () => {
                        if (selectionArea && selectionArea.innerHTML.trim() !== '') return;
                        const products = await Product.search(term);
                        if (products.length > 0) {
                            this.productSelectedIndex = 0;
                            this.renderPurchaseSearchResults(products);
                            if (resultsDiv) resultsDiv.style.display = 'block';
                        } else {
                            if (resultsDiv) resultsDiv.style.display = 'none';
                        }
                    }, 250);
                } else {
                    if (resultsDiv) resultsDiv.style.display = 'none';
                }
            });

            this.productSelectedIndex = 0;
            searchInput.addEventListener('keydown', async (e) => {
                const items = resultsDiv ? resultsDiv.querySelectorAll('.search-result-item') : [];

                if (resultsDiv && resultsDiv.style.display === 'block' && items.length > 0) {
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        this.productSelectedIndex = (this.productSelectedIndex + 1) % items.length;
                        PurchasesView.highlightResult(this.productSelectedIndex);
                        return;
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        this.productSelectedIndex = (this.productSelectedIndex - 1 + items.length) % items.length;
                        PurchasesView.highlightResult(this.productSelectedIndex);
                        return;
                    }
                }

                if (e.key === 'Escape') {
                    e.preventDefault();
                    if (resultsDiv) resultsDiv.style.display = 'none';
                    searchInput.value = '';
                    searchInput.focus();
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (resultsDiv && resultsDiv.style.display === 'block' && items.length > 0) {
                        const chosenIndex = this.productSelectedIndex;
                        const productId = items[chosenIndex]?.getAttribute('data-product-id');
                        if (productId) {
                            PurchasesView.selectProductFromList(parseInt(productId, 10));
                        }
                    } else {
                        const term = searchInput.value.trim();
                        if (term) {
                            await this.searchAndShowProduct(term, false);
                            searchInput.value = '';
                            if (resultsDiv) resultsDiv.style.display = 'none';
                        }
                    }
                }
            });

            setTimeout(() => { searchInput.focus(); }, 100);
        }

        // Listener global de Enter para navegar entre fases o guardar compra
        const form = document.getElementById('purchaseForm');
        if (form) {
            form.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter') return;
                const activeId = document.activeElement ? document.activeElement.id : '';
                if (activeId === 'addQuantity' || activeId === 'addCost' || activeId === 'addGrossCost' || activeId === 'addPrice' || activeId === 'productSearchInput' || activeId === 'supplierSearchInput' || activeId === 'extraTaxAmountInput' || activeId === 'extraTaxCustomName') {
                    return; // Delegar en sus propios manejadores
                }
                e.preventDefault();
                if (this.currentNewPurchaseStep === 1) {
                    PurchasesView.goToNewPurchaseStep(2);
                } else {
                    PurchasesView.savePurchase();
                }
            });
        }

        this.handleDocumentTypeChange();
        this.renderExtraTaxesBadges();
        const dueDateEl = document.getElementById('purchaseDueDateInput');
        if (dueDateEl) {
            this.updateDueDateLabel(dueDateEl.value);
        }
        this.updatePurchaseItems();
        this.renderStep3PriceAnalysis();
    },


        renderPurchaseSearchResults(products) {
        const resultsDiv = document.getElementById('purchaseProductSearchResults');
        if (!resultsDiv) return;

        if (products.length === 0) {
            resultsDiv.innerHTML = '<div style="padding: 1.25rem; text-align: center; color: #64748b; font-weight: 700;">❌ No se encontraron productos</div>';
            resultsDiv.style.display = 'block';
            return;
        }

        resultsDiv.innerHTML = products.map((p, index) => {
            const isWeight = p.type === 'weight';
            const hasStock = (parseFloat(p.stock) || 0) > 0;
            const stockLimit = isWeight ? 1.0 : 5;

            let stockClass = 'stock-ok';
            let stockIcon = '✅';
            let stockStatus = 'En Stock';

            if (p.stock <= 0) {
                stockClass = 'stock-none';
                stockIcon = '❌';
                stockStatus = 'Agotado';
            } else if (p.stock <= stockLimit) {
                stockClass = 'stock-low';
                stockIcon = '⚠️';
                stockStatus = 'Bajo Stock';
            }

            return `
                <div class="search-result-item ${index === 0 ? 'selected' : ''}" 
                     data-index="${index}"
                     data-product-id="${p.id}"
                     onmousedown="PurchasesView.selectProductFromList(${p.id})">
                    
                    <div class="search-result-info">
                        <div class="search-result-name" style="font-size: 1.05rem; font-weight: 900; color: #0f172a;">${safeHTML(p.name)}</div>
                        <div class="search-result-meta" style="display: flex; gap: 0.5rem; align-items: center; margin-top: 0.25rem;">
                            <span class="search-result-badge" style="font-family: monospace; font-size: 0.75rem; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; color: #64748b;">CÓD: ${p.barcode || 'S/N'}</span>
                        </div>
                    </div>

                    <!-- En la lista de sugerencias aparece solo la cantidad / stock actual -->
                    <div style="text-align: right; min-width: 140px;">
                        <span class="search-result-stock ${stockClass}" style="display: inline-flex; align-items: center; gap: 4px; font-weight: 850; font-size: 0.95rem; padding: 4px 10px; border-radius: 6px; background: #f8fafc; border: 1px solid #e2e8f0;">
                            ${stockIcon} Stock: <strong>${formatStock(p.stock)} ${isWeight ? 'kg' : 'un'}</strong>
                        </span>
                    </div>
                </div>
            `;
        }).join('');
    },

    confirmAndAddProduct(productId) {
        this._costConfirmedForProduct = productId;
        this.addProductToPurchase(productId);
    },

        highlightResult(index) {
        const resultsDiv = document.getElementById('purchaseProductSearchResults');
        if (!resultsDiv) return;

        const items = resultsDiv.querySelectorAll('.search-result-item');
        items.forEach(item => {
            item.classList.remove('selected');
        });

        const target = resultsDiv.querySelector(`.search-result-item[data-index="${index}"]`);
        if (target) {
            target.classList.add('selected');
            // Ensure visible in scroll
            target.scrollIntoView({ block: 'nearest' });
        }
    },


    async searchAndShowProduct(term, addDirectly = false) {
        let product = await Product.getByBarcode(term);

        if (!product) {
            const results = await Product.search(term);
            if (results.length === 1) {
                product = results[0];
            } else if (results.length > 1) {
                // If multiple results from barcode scan or enter, show them in dropdown
                this.renderPurchaseSearchResults(results);
                document.getElementById('purchaseProductSearchResults').style.display = 'block';
                return;
            } else {
                this.openQuickCreateProductModal(term);
                return;
            }
        }

        const resDiv = document.getElementById('purchaseProductSearchResults');
        if (resDiv) resDiv.style.display = 'none';
        this.showAddProductForm(product);
    },

    // ponytail: Modal ágil para crear un producto nuevo en 3 segundos sin salir del wizard de compras
    async openQuickCreateProductModal(initialValue = '') {
        const val = String(initialValue || '').trim();
        const isBarcode = /^\d{4,}$/.test(val);
        const defaultBarcode = isBarcode ? val : '';
        const defaultName = !isBarcode ? val : '';

        let categories = [];
        try {
            if (typeof Category !== 'undefined' && Category.getAll) {
                categories = await Category.getAll();
            }
        } catch (_) {}

        const categoryOptions = (categories || []).map(c => `<option value="${safeHTML(c.name)}">${safeHTML(c.name)}</option>`).join('');

        const content = `
            <div style="padding: 0.5rem 0;">
                <div style="background: #eff6ff; border: 1.5px solid #3b82f6; border-radius: 0.75rem; padding: 0.75rem 1rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.75rem;">
                    <span style="font-size: 1.8rem;">⚡</span>
                    <div>
                        <strong style="color: #1e40af; font-size: 0.95rem; display: block;">Producto no encontrado en catálogo</strong>
                        <span style="color: #3b82f6; font-size: 0.82rem;">Créalo en 3 segundos para continuar agregándolo a tu compra sin perder tu avance.</span>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                    <div>
                        <label style="display: block; font-weight: 900; font-size: 0.8rem; color: #1e293b; text-transform: uppercase; margin-bottom: 0.25rem;">📦 Nombre del Producto *</label>
                        <input type="text" id="quickProdName" class="form-control" value="${safeHTML(defaultName)}" placeholder="Ej: Bebida Coca Cola 1.5L"
                               style="height: 42px; font-weight: 800; font-size: 1rem; border-radius: 0.5rem; border: 2px solid #3b82f6;"
                               onkeydown="if(event.key === 'Enter') { event.preventDefault(); document.getElementById('quickProdBarcode').focus(); }">
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                        <div>
                            <label style="display: block; font-weight: 900; font-size: 0.8rem; color: #1e293b; text-transform: uppercase; margin-bottom: 0.25rem;">🔍 Código de Barras</label>
                            <input type="text" id="quickProdBarcode" class="form-control" value="${safeHTML(defaultBarcode)}" placeholder="Código escaneado..."
                                   style="height: 40px; font-weight: 800; font-family: monospace; border-radius: 0.5rem; border: 1.5px solid #cbd5e1;"
                                   onkeydown="if(event.key === 'Enter') { event.preventDefault(); PurchasesView.saveQuickProduct(); }">
                        </div>
                        <div>
                            <label style="display: block; font-weight: 900; font-size: 0.8rem; color: #1e293b; text-transform: uppercase; margin-bottom: 0.25rem;">🏷️ Categoría</label>
                            <select id="quickProdCategory" class="form-control" style="height: 40px; font-weight: 800; border-radius: 0.5rem; border: 1.5px solid #cbd5e1;">
                                <option value="General">General</option>
                                ${categoryOptions}
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const footer = `
            <div style="display: flex; gap: 0.75rem; width: 100%;">
                <button type="button" class="btn btn-secondary" onclick="closeModal()" style="flex: 1; height: 44px; font-weight: 800;">
                    Cancelar
                </button>
                <button type="button" class="btn btn-success" onclick="PurchasesView.saveQuickProduct()" style="flex: 2; height: 44px; font-weight: 900; font-size: 0.95rem; background: #10b981; border: none; color: #fff;">
                    ⚡ Crear y Cargar a la Compra
                </button>
            </div>
        `;

        showModal(content, { title: '⚡ Nuevo Producto en Compra', footer, width: '480px' });

        setTimeout(() => {
            const input = defaultName ? document.getElementById('quickProdBarcode') : document.getElementById('quickProdName');
            if (input) { input.focus(); input.select(); }
        }, 150);
    },

    async saveQuickProduct() {
        const nameInput = document.getElementById('quickProdName');
        const barcodeInput = document.getElementById('quickProdBarcode');
        const catInput = document.getElementById('quickProdCategory');

        const name = nameInput ? nameInput.value.trim() : '';
        const barcode = barcodeInput ? barcodeInput.value.trim() : '';
        const category = catInput ? catInput.value : 'General';

        if (!name) {
            showNotification('El nombre del producto es obligatorio', 'warning');
            nameInput?.focus();
            return;
        }

        try {
            const newId = await Product.create({
                name,
                barcode,
                category,
                price: 0,
                cost: 0,
                costNeto: 0,
                stock: 0,
                type: 'unit'
            });

            closeModal();
            showNotification(`Producto "${name}" creado exitosamente`, 'success');

            const createdProduct = await Product.getById(newId);
            if (createdProduct) {
                this.showAddProductForm(createdProduct);
            }
        } catch (err) {
            showNotification('Error al crear producto: ' + err.message, 'error');
        }
    },

    async addProductFromSearch(productId) {
        try {
            const product = await Product.getById(productId);
            if (!product) {
                showNotification('Producto no encontrado', 'warning');
                return;
            }

            const cost = parseFloat(product.cost);
            const price = parseFloat(product.price);

            // If faltan precios, abrir formulario para completar
            if (!cost || cost <= 0 || !price || price <= 0) {
                this.showAddProductForm(product);
                return;
            }

            // Agregar directamente con cantidad 1 y precios del producto
            const existingItem = this.purchaseItems.find(item => item.productId === product.id);
            if (existingItem) {
                existingItem.quantity += 1;
                existingItem.cost = cost;
                existingItem.price = price;
                existingItem.total = existingItem.quantity * cost;
            } else {
                this.purchaseItems.push({
                    productId: product.id,
                    name: product.name,
                    barcode: product.barcode || '',
                    quantity: 1,
                    cost: cost,
                    price: price,
                    total: 1 * cost,
                    type: product.type
                });
            }

            this.cancelAddProduct();
            this.updatePurchaseItems();
            showNotification(`${product.name} agregado a la compra`, 'success');
        } catch (error) {
            console.error('Error al agregar producto a la compra:', error);
            showNotification('Error al agregar producto: ' + error.message, 'error');
        }
    },

    async selectProductFromList(productId) {
        const product = await Product.getById(productId);
        const resultsDiv = document.getElementById('purchaseProductSearchResults');
        const searchInput = document.getElementById('productSearchInput');

        if (resultsDiv) resultsDiv.style.display = 'none';
        if (searchInput) searchInput.value = '';

        this.showAddProductForm(product);
    },

    async showAddProductForm(product) {
        const docType = document.getElementById('purchaseDocumentType')?.value || 'factura_neto';
        const isBoleta = docType === 'boleta';

        const resultsDiv = document.getElementById('purchaseProductSearchResults');
        if (resultsDiv) {
            resultsDiv.style.display = 'none';
            resultsDiv.innerHTML = '';
        }
        const selectionArea = document.getElementById('productSelectionArea');
        
        // Obtener último costo de compra histórico
        let lastPurchaseCost = null;
        if (db.mode === 'sqlite') {
            try {
                lastPurchaseCost = await ApiClient.get(`products/${product.id}/last-purchase-cost`);
            } catch (e) {
                console.warn('Error al obtener último costo de compra:', e);
            }
        }
        
        this._currentLastPurchaseCost = lastPurchaseCost;
        const lastCostNeto = lastPurchaseCost?.costNeto || null;
        const lastCostGross = lastPurchaseCost?.cost || null;
        const lastCostDate = lastPurchaseCost?.date || null;

        // Buscar si ya está en el carro para precargar sus impuestos especiales
        const existingItem = this.purchaseItems.find(item => item.productId === product.id);
        this.tempProductTaxes = existingItem ? [...(existingItem.additionalTaxesConfig || [])] : [];
        
        const initialCostVal = this.lastVatMode === 'gross'
            ? (lastCostGross !== null ? parseFloat(Number(lastCostGross).toFixed(3)) : ((product.cost !== undefined && product.cost !== null && product.cost !== 0) ? parseFloat(Number(product.cost).toFixed(3)) : parseFloat(((product.costNeto || 0) * 1.19).toFixed(3))))
            : (lastCostNeto !== null ? parseFloat(Number(lastCostNeto).toFixed(3)) : ((product.costNeto !== undefined && product.costNeto !== null && product.costNeto !== 0) ? parseFloat(Number(product.costNeto).toFixed(3)) : parseFloat(((product.cost || 0) / 1.19).toFixed(3))));

        const costPlaceholder = this.lastVatMode === 'gross'
            ? (lastCostGross !== null ? `Último con IVA: ${formatCLP(lastCostGross, true)}` : '0')
            : (lastCostNeto !== null ? `Último neto: ${formatCLP(lastCostNeto, true)}` : '0');

        selectionArea.innerHTML = `
            <div class="purchase-add-card" style="background: #ffffff; border: 3px solid #3b82f6; border-radius: 0.85rem; padding: 0.75rem 1rem; margin-top: 0.35rem; margin-bottom: 0.5rem; position: relative; box-shadow: 0 4px 15px rgba(0,0,0,0.08);">
                <style>
                    .add-product-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.6rem; margin-bottom: 0.5rem; }
                    .add-summary-blocks { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.6rem; }
                    @media (max-width: 800px) {
                        .add-product-grid { grid-template-columns: 1fr; gap: 0.4rem; }
                        .add-summary-blocks { grid-template-columns: 1fr; gap: 0.5rem; }
                    }
                </style>
                <div style="position: absolute; top: -10px; right: 1rem; background: #3b82f6; color: #fff; padding: 0.15rem 0.7rem; border-radius: 1rem; font-size: 0.7rem; font-weight: 900; box-shadow: 0 2px 8px rgba(59,130,246,0.3); border: 1.5px solid #fff;">
                    ${product.type === 'weight' ? 'PESO / GRANEL' : 'UNITARIO'}
                </div>
                
                <h4 style="margin: 0 0 0.4rem 0; font-size: 1.05rem; color: #1e293b; font-weight: 950; text-transform: uppercase;">
                    ${product.name}
                </h4>
                
                ${lastCostNeto !== null ? `
                <div style="background: #fef3c7; border: 1.5px solid #f59e0b; border-radius: 0.5rem; padding: 0.35rem 0.75rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.35rem;">
                    <span style="color: #92400e; font-weight: 900; font-size: 0.75rem; text-transform: uppercase;">📊 Última Compra Registrada:</span>
                    <span style="color: #92400e; font-weight: 950; font-size: 0.82rem;">
                        Neto: ${formatCLP(lastCostNeto, true)} | Con IVA: ${formatCLP(lastCostGross, true)} ${lastCostDate ? `(${new Date(lastCostDate).toLocaleDateString()})` : ''}
                    </span>
                </div>
                ` : ''}
                
                <div class="add-product-grid">
                    <div class="form-group" style="margin: 0;">
                        <label style="display: block; font-weight: 950; color: #1e293b; text-transform: uppercase; font-size: 0.72rem; margin-bottom: 0.2rem;">🛒 Cantidad a Comprar</label>
                        <div style="display: flex; gap: 0.35rem; width: 100%;">
                            <input type="number" 
                                   id="addQuantity" 
                                   step="0.001"
                                   class="form-control" 
                                   placeholder="${product.type === 'weight' ? '0.000' : '1'}"
                                   onfocus="this.select()"
                                   style="height: 40px; font-size: 1.15rem; font-weight: 950; border-radius: 0.5rem; text-align: center; border: 2px solid #cbd5e1; background: #f8fafc; color: #000; width: 100%;">
                        </div>
                    </div>
                    
                    <div class="form-group" style="margin: 0;">
                        <label id="costInputLabel" style="display: block; font-weight: 950; color: #1e293b; text-transform: uppercase; font-size: 0.72rem; margin-bottom: 0.2rem;">
                            ${this.lastVatMode === 'net' ? (isBoleta ? '💰 Costo Real Neto' : '💰 Costo Neto') : '💰 Costo Bruto (con IVA)'}
                        </label>
                        <div style="display: flex; gap: 0.35rem; width: 100%;">
                            <input type="number" 
                                   id="addCost" 
                                   step="0.001"
                                   class="form-control" 
                                   value="${initialCostVal}"
                                   placeholder="${costPlaceholder}"
                                   onfocus="this.select()"
                                   style="height: 40px; font-size: 1.15rem; font-weight: 950; border-radius: 0.5rem; text-align: center; border: 2px solid #10b981; background: #f8fafc; color: #000; flex: 1;">
                            <button type="button" 
                                    class="btn btn-secondary" 
                                    onclick="PurchasesView.openCalculatorModal('addCost')" 
                                    style="width: 40px; height: 40px; font-size: 1.1rem; border-radius: 0.5rem; display: flex; align-items: center; justify-content: center; background: #e2e8f0; border: 2px solid #cbd5e1; color: #1e293b;" 
                                    title="Abrir Calculadora">🧮</button>
                        </div>
                        <div id="costConversionIndicator" style="font-size: 0.72rem; font-weight: 800; color: #475569; margin-top: 0.25rem; min-height: 16px;"></div>
                        <div id="costDiffIndicator" style="font-size: 0.72rem; font-weight: 900; margin-top: 0.15rem; display: none;"></div>
                    </div>
                    
                    <div class="form-group" style="margin: 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2rem; flex-wrap: wrap; gap: 0.2rem;">
                            <label style="font-weight: 950; color: #1e293b; text-transform: uppercase; font-size: 0.72rem; margin: 0;">🏷️ Precio Venta</label>
                            <div style="display: flex; align-items: center; gap: 0.2rem;">
                                <button type="button" onclick="PurchasesView.applyQuickMargin(25)" style="padding: 1px 5px; font-size: 0.68rem; font-weight: 800; background: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe; border-radius: 0.35rem; cursor: pointer;">+25%</button>
                                <button type="button" onclick="PurchasesView.applyQuickMargin(30)" style="padding: 1px 5px; font-size: 0.68rem; font-weight: 800; background: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe; border-radius: 0.35rem; cursor: pointer;">+30%</button>
                                <button type="button" onclick="PurchasesView.applyQuickMargin(35)" style="padding: 1px 5px; font-size: 0.68rem; font-weight: 800; background: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe; border-radius: 0.35rem; cursor: pointer;">+35%</button>
                                <button type="button" onclick="PurchasesView.applyQuickMargin(40)" style="padding: 1px 5px; font-size: 0.68rem; font-weight: 800; background: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe; border-radius: 0.35rem; cursor: pointer;">+40%</button>
                                <button type="button" onclick="PurchasesView.applyQuickMargin(50)" style="padding: 1px 5px; font-size: 0.68rem; font-weight: 800; background: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe; border-radius: 0.35rem; cursor: pointer;">+50%</button>
                                <div style="display: inline-flex; align-items: center; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 0.35rem; padding: 0 3px; height: 20px;">
                                    <input type="number" id="quickTargetMarginInput" placeholder="%" min="0" max="999" step="1" 
                                           style="width: 32px; border: none; outline: none; font-size: 0.68rem; font-weight: 900; text-align: center; padding: 0; background: transparent;"
                                           oninput="PurchasesView.applyQuickMargin(this.value)">
                                    <span style="font-size: 0.65rem; color: #64748b; font-weight: 800;">%</span>
                                </div>
                            </div>
                        </div>
                        <input type="number" 
                               id="addPrice" 
                               step="any"
                               class="form-control" 
                               value="${(parseFloat(product.price) > 0) ? product.price : (Math.round(((this.lastVatMode === 'gross' ? (lastCostGross || (product.cost || 0)) : ((lastCostNeto || (product.costNeto || 0)) * 1.19)) * (1 + this.getDefaultPurchaseMargin() / 100))) || 0)}"
                               onfocus="this.select()"
                               style="height: 40px; font-size: 1.15rem; font-weight: 950; border-radius: 0.5rem; text-align: center; border: 2px solid #6366f1; background: #f8fafc; color: #000;">
                    </div>
                </div>

                <!-- Resumen Estructurado en 2 Bloques: Factura vs Rentabilidad -->
                <div class="add-summary-blocks">
                    <!-- Bloque 1: Datos de Compra / Factura -->
                    <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 0.65rem; padding: 0.6rem 0.85rem; display: flex; flex-direction: column; justify-content: space-between;">
                        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.35rem; margin-bottom: 0.35rem;">
                            <span style="font-size: 0.75rem; font-weight: 900; color: #475569; text-transform: uppercase;">📄 Factura / Compra</span>
                            <span style="font-size: 0.7rem; font-weight: 800; color: #64748b;" id="previewVatModeBadge">${this.lastVatMode === 'net' ? 'Modo Neto' : 'Modo Con IVA'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.25rem;">
                            <span style="color: #64748b; font-weight: 700;">Subtotal Neto:</span>
                            <strong id="previewSubtotal" style="color: #0f172a; font-weight: 900;">$0</strong>
                        </div>
                        ${!isBoleta ? `
                        <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.25rem;">
                            <span style="color: #64748b; font-weight: 700;">IVA (19%):</span>
                            <strong id="previewIva" style="color: #0f172a; font-weight: 900;">$0</strong>
                        </div>
                        ` : ''}
                        <div style="display: flex; justify-content: space-between; align-items: baseline; border-top: 1.5px solid #cbd5e1; padding-top: 0.35rem; margin-top: 0.2rem;">
                            <span style="color: #1e3a8a; font-weight: 950; font-size: 0.85rem; text-transform: uppercase;">Total Línea:</span>
                            <strong id="previewBrutoTotal" style="color: #2563eb; font-weight: 950; font-size: 1.15rem;">$0</strong>
                        </div>
                    </div>

                    <!-- Bloque 2: Rentabilidad y Venta -->
                    <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 0.65rem; padding: 0.6rem 0.85rem; display: flex; flex-direction: column; justify-content: space-between;">
                        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #bbf7d0; padding-bottom: 0.35rem; margin-bottom: 0.35rem;">
                            <span style="font-size: 0.75rem; font-weight: 900; color: #166534; text-transform: uppercase;">📈 Rentabilidad / Venta</span>
                            <span id="previewMargin" style="font-size: 0.75rem; font-weight: 950; padding: 0.15rem 0.45rem; border-radius: 0.4rem; background: #dcfce7; color: #15803d; border: 1px solid #86efac;">0%</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.25rem;">
                            <span style="color: #166534; font-weight: 700;">Ganancia x Unidad:</span>
                            <strong id="previewUnitProfit" style="color: #15803d; font-weight: 900;">$0</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: baseline; border-top: 1.5px solid #86efac; padding-top: 0.35rem; margin-top: 0.2rem;">
                            <span style="color: #14532d; font-weight: 950; font-size: 0.85rem; text-transform: uppercase;">Ganancia Total:</span>
                            <strong id="previewProfit" style="color: #16a34a; font-weight: 950; font-size: 1.15rem;">$0</strong>
                        </div>
                    </div>
                </div>
                
                <!-- Banner de Advertencia de Costo Irreal (No Bloqueante) -->
                <div id="costUnusualWarning" style="display: none; background: #fffbeb; border: 2px solid #f59e0b; border-radius: 0.65rem; padding: 0.65rem 0.95rem; margin-bottom: 0.65rem; justify-content: space-between; align-items: center; gap: 0.75rem;">
                    <div style="display: flex; align-items: center; gap: 0.65rem;">
                        <span style="font-size: 1.5rem;">⚠️</span>
                        <div>
                            <strong style="color: #92400e; font-size: 0.88rem; display: block;">Posible error de digitación en el costo</strong>
                            <span id="costUnusualWarningText" style="color: #b45309; font-size: 0.78rem; font-weight: 700;">El costo ingresado difiere fuertemente del anterior.</span>
                        </div>
                    </div>
                    <button type="button" class="btn btn-sm" onclick="PurchasesView.confirmAndAddProduct(${product.id})" style="background: #d97706; color: #fff; font-weight: 900; border-radius: 0.5rem; white-space: nowrap; padding: 0.4rem 0.85rem; border: none; cursor: pointer; box-shadow: 0 2px 6px rgba(217,119,6,0.3);">
                        ✅ Sí, está correcto
                    </button>
                </div>

                <div style="display: flex; gap: 0.5rem;">
                    <button type="button" class="btn btn-primary" onclick="PurchasesView.addProductToPurchase(${product.id})" style="flex: 2; height: 42px; font-weight: 950; font-size: 0.95rem; border-radius: 0.5rem; border: 2px solid #fff; box-shadow: 0 4px 12px rgba(59,130,246,0.3);">
                        ✅ AGREGAR AL LISTADO DE COMPRA
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="PurchasesView.cancelAddProduct()" style="flex: 1; height: 42px; font-weight: 950; font-size: 0.9rem; border-radius: 0.5rem; background: #e2e8f0; color: #475569; border: 2px solid #cbd5e1;">
                        ❌ DESCARTAR
                    </button>
                </div>
            </div>
        `;

        const quantityInput = document.getElementById('addQuantity');
        const costInput = document.getElementById('addCost');
        const priceInput = document.getElementById('addPrice');

        // Renderizar los badges iniciales
        this.renderFormTaxesBadges();

        const updatePreview = () => {
            const quantity = parseFloat(quantityInput.value) || 0;
            const enteredCost = parseFloat(costInput.value) || 0;
            const price = parseFloat(priceInput.value) || 0;

            let costNeto = 0;
            let costGross = 0;

            if (this.lastVatMode === 'gross') {
                costGross = enteredCost;
                costNeto = costGross > 0 ? (costGross / 1.19) : 0;
            } else {
                costNeto = enteredCost;
                costGross = costNeto > 0 ? (costNeto * 1.19) : 0;
            }

            // Sumar impuestos especiales a nivel de preview
            let extraTaxesSum = 0;
            if (this.tempProductTaxes && this.tempProductTaxes.length > 0) {
                this.tempProductTaxes.forEach(tax => {
                    if (typeof tax.amount === 'number' && tax.amount > 0) {
                        extraTaxesSum += tax.amount;
                    } else {
                        extraTaxesSum += Math.round((quantity * costNeto) * (tax.rate / 100));
                    }
                });
            }

            // ponytail: Cálculo de línea exacto según modo sin duplicación de IVA
            let lineNet = 0;
            let lineIva = 0;
            let lineBrutoTotal = 0;

            if (this.lastVatMode === 'gross') {
                lineBrutoTotal = Math.round(quantity * costGross) + extraTaxesSum;
                lineNet = isBoleta ? lineBrutoTotal : Math.round(lineBrutoTotal / 1.19);
                lineIva = isBoleta ? 0 : (lineBrutoTotal - lineNet);
            } else {
                lineNet = Math.round(quantity * costNeto);
                lineIva = isBoleta ? 0 : Math.round(lineNet * 0.19);
                lineBrutoTotal = lineNet + lineIva + extraTaxesSum;
            }

            // ponytail: Margen contable usando costNeto
            const marginCalc = PurchasesView.calculateItemMargin({
                quantity,
                cost: costNeto,
                price,
                additionalTaxesConfig: this.tempProductTaxes || []
            }, isBoleta);

            // Actualizar textos en la visualización inmediata (skipRounding = true para no truncar a decenas)
            const subtotalEl = document.getElementById('previewSubtotal');
            if (subtotalEl) subtotalEl.textContent = formatCLP(lineNet, true);

            const ivaEl = document.getElementById('previewIva');
            if (ivaEl) ivaEl.textContent = formatCLP(lineIva, true);

            const totalEl = document.getElementById('previewBrutoTotal');
            if (totalEl) totalEl.textContent = formatCLP(lineBrutoTotal, true);

            const vatBadge = document.getElementById('previewVatModeBadge');
            if (vatBadge) {
                vatBadge.textContent = this.lastVatMode === 'net' ? 'Modo Neto' : 'Modo Con IVA';
            }

            const marginEl = document.getElementById('previewMargin');
            if (marginEl) {
                if (marginCalc.isLoss) {
                    marginEl.innerHTML = `🚨 PÉRDIDA (${marginCalc.margin.toFixed(1)}%)`;
                    marginEl.style.background = '#fee2e2';
                    marginEl.style.color = '#dc2626';
                    marginEl.style.borderColor = '#fca5a5';
                } else {
                    marginEl.innerHTML = `${marginCalc.margin.toFixed(1)}% margen`;
                    marginEl.style.background = marginCalc.margin > 0 ? '#dcfce7' : '#f1f5f9';
                    marginEl.style.color = marginCalc.margin > 0 ? '#15803d' : '#64748b';
                    marginEl.style.borderColor = marginCalc.margin > 0 ? '#86efac' : '#cbd5e1';
                }
            }

            const unitProfitEl = document.getElementById('previewUnitProfit');
            if (unitProfitEl) {
                unitProfitEl.textContent = formatCLP(marginCalc.unitProfit, true);
                unitProfitEl.style.color = marginCalc.unitProfit > 0 ? '#15803d' : (marginCalc.unitProfit < 0 ? '#dc2626' : '#64748b');
            }

            const profitEl = document.getElementById('previewProfit');
            if (profitEl) {
                profitEl.textContent = formatCLP(marginCalc.lineProfit, true);
                profitEl.style.color = marginCalc.lineProfit > 0 ? '#16a34a' : (marginCalc.lineProfit < 0 ? '#dc2626' : '#64748b');
            }

            // Indicador de conversión en vivo (Equivale a Neto / Con IVA)
            const convEl = document.getElementById('costConversionIndicator');
            if (convEl) {
                if (enteredCost > 0) {
                    if (this.lastVatMode === 'gross') {
                        convEl.innerHTML = `⇄ Equivale a: <strong style="color: #0f172a;">${formatCLP(costNeto, true)} Neto</strong> (sin IVA)`;
                    } else {
                        convEl.innerHTML = `⇄ Equivale a: <strong style="color: #0f172a;">${formatCLP(costGross, true)} Con IVA</strong> (Bruto)`;
                    }
                } else {
                    convEl.innerHTML = '';
                }
            }

            // Comparación de costo contra última compra (Homogénea: Bruto con Bruto, Neto con Neto)
            const diffEl = document.getElementById('costDiffIndicator');
            if (diffEl) {
                const targetLastCost = this.lastVatMode === 'gross' ? lastCostGross : lastCostNeto;
                if (targetLastCost !== null && targetLastCost > 0 && enteredCost > 0) {
                    const diff = enteredCost - targetLastCost;
                    const cleanDiff = Math.abs(diff);
                    const modeLabel = this.lastVatMode === 'gross' ? 'con IVA' : 'neto';
                    if (cleanDiff >= 0.5) {
                        if (diff > 0) {
                            diffEl.innerHTML = `<span style="color: #d97706; font-weight: 900;">⚠️ SUBIÓ: +${formatCLP(cleanDiff, true)} (Último: ${formatCLP(targetLastCost, true)} ${modeLabel})</span>`;
                        } else {
                            diffEl.innerHTML = `<span style="color: #10b981; font-weight: 900;">🟢 BAJÓ: -${formatCLP(cleanDiff, true)} (Último: ${formatCLP(targetLastCost, true)} ${modeLabel})</span>`;
                        }
                    } else {
                        diffEl.innerHTML = `<span style="color: #64748b; font-weight: 900;">⚖️ MISMO COSTO (${formatCLP(targetLastCost, true)} ${modeLabel})</span>`;
                    }
                    diffEl.style.display = 'block';
                } else {
                    diffEl.style.display = 'none';
                }
            }

            // Actualizar input de porcentaje rápido si el usuario editó el precio manualmente
            const quickMarginInput = document.getElementById('quickTargetMarginInput');
            if (quickMarginInput && document.activeElement !== quickMarginInput && costNeto > 0 && price > 0) {
                quickMarginInput.value = marginCalc.margin > 0 ? Math.round(marginCalc.margin) : '';
            }

            // ponytail: Verificación en vivo de costo desproporcionado (>50% de variación contra el último costo)
            const warningEl = document.getElementById('costUnusualWarning');
            const warningTextEl = document.getElementById('costUnusualWarningText');
            if (warningEl && warningTextEl) {
                const prevCostNetoVal = (lastCostNeto !== null && lastCostNeto > 0) ? lastCostNeto : ((product.costNeto && product.costNeto > 0) ? product.costNeto : (product.cost > 0 ? product.cost / 1.19 : 0));
                if (prevCostNetoVal > 0 && costNeto > 0) {
                    const ratio = costNeto / prevCostNetoVal;
                    if (ratio >= 1.50 || ratio <= 0.50) {
                        const pct = Math.round((ratio - 1) * 100);
                        const prevDisp = PurchasesView.lastVatMode === 'gross' ? formatCLP(prevCostNetoVal * 1.19, true) : formatCLP(prevCostNetoVal, true);
                        const newDisp = PurchasesView.lastVatMode === 'gross' ? formatCLP(costGross, true) : formatCLP(costNeto, true);
                        warningTextEl.textContent = `El costo difiere fuertemente del anterior (${prevDisp} ➔ ${newDisp}, ${pct > 0 ? '+' : ''}${pct}%). Puedes confirmarlo con el botón o corregirlo.`;
                        warningEl.style.display = 'flex';
                    } else {
                        warningEl.style.display = 'none';
                    }
                } else {
                    warningEl.style.display = 'none';
                }
            }
        };

        quantityInput.addEventListener('input', updatePreview);
        costInput.addEventListener('input', updatePreview);
        priceInput.addEventListener('input', updatePreview);

        quantityInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                costInput.focus();
                costInput.select();
            }
        });

        costInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                priceInput.focus();
                priceInput.select();
            }
        });

        priceInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                PurchasesView.addProductToPurchase(product.id);
            }
        });

        updatePreview();
        setTimeout(() => { quantityInput.focus(); quantityInput.select(); }, 150);
    },

    showCostAlertModal(productName, prevCostDisplay, newCostDisplay, percentChange, isHigher, vatLabel) {
        return new Promise((resolve) => {
            const html = `
                <div style="background: #0f172a; padding: 1.75rem; border-radius: 1.25rem; color: #f8fafc; text-align: center;">
                    <div style="font-size: 3.2rem; margin-bottom: 0.5rem; line-height: 1;">⚠️</div>
                    <h3 style="margin: 0 0 0.5rem 0; font-size: 1.35rem; font-weight: 900; color: #f59e0b; text-transform: uppercase; letter-spacing: 0.5px;">Alerta de Variación de Costo</h3>
                    <p style="margin: 0 0 1.25rem 0; font-size: 0.95rem; color: #94a3b8; line-height: 1.4;">
                        El costo <strong style="color: #ffffff;">${vatLabel}</strong> ingresado para <span style="color: #60a5fa; font-weight: 800;">${safeHTML(productName)}</span> presenta una variación superior al <strong>50%</strong> (posible error de digitación).
                    </p>

                    <div style="background: rgba(30, 41, 59, 0.75); border: 1.5px solid rgba(255,255,255,0.1); border-radius: 0.85rem; padding: 1.1rem; margin-bottom: 1.5rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; text-align: left;">
                        <div style="border-right: 1px solid rgba(255,255,255,0.1); padding-right: 0.5rem;">
                            <div style="font-size: 0.72rem; color: #94a3b8; font-weight: 800; text-transform: uppercase; margin-bottom: 0.2rem;">Costo Anterior Real</div>
                            <div style="font-size: 1.35rem; font-weight: 950; color: #e2e8f0;">$${prevCostDisplay}</div>
                            <small style="color: #64748b; font-size: 0.72rem; font-weight: 600;">Última compra registrada</small>
                        </div>
                        <div style="padding-left: 0.5rem;">
                            <div style="font-size: 0.72rem; color: #f59e0b; font-weight: 800; text-transform: uppercase; margin-bottom: 0.2rem;">Nuevo Costo Ingresado</div>
                            <div style="font-size: 1.35rem; font-weight: 950; color: #f59e0b;">$${newCostDisplay}</div>
                            <div style="font-size: 0.8rem; font-weight: 900; color: ${isHigher ? '#ef4444' : '#10b981'}; margin-top: 0.2rem;">
                                ${isHigher ? '▲ +' : '▼ '}${Math.abs(percentChange)}% de diferencia
                            </div>
                        </div>
                    </div>

                    <p style="margin: 0 0 1.5rem 0; font-size: 0.92rem; color: #cbd5e1; font-weight: 600;">
                        ¿El valor ingresado es correcto o deseas corregirlo?
                    </p>

                    <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
                        <button id="btnCostAlertCancel" type="button" class="btn" style="flex: 1; min-width: 130px; padding: 0.8rem 1rem; background: #334155; color: #f8fafc; border: 1.5px solid #475569; border-radius: 0.75rem; font-weight: 800; font-size: 0.92rem; cursor: pointer;">
                            ✏️ Corregir Costo
                        </button>
                        ${isHigher ? `
                        <button id="btnCostAlertAutoAdjust" type="button" class="btn" style="flex: 1.2; min-width: 160px; padding: 0.8rem 1rem; background: #059669; color: #ffffff; border: 1.5px solid #10b981; border-radius: 0.75rem; font-weight: 900; font-size: 0.92rem; cursor: pointer;">
                            ⚡ Ajustar Precio (Mantener Margen)
                        </button>
                        ` : ''}
                        <button id="btnCostAlertConfirm" type="button" class="btn" style="flex: 1; min-width: 130px; padding: 0.8rem 1rem; background: #2563eb; color: #ffffff; border: 1.5px solid #3b82f6; border-radius: 0.75rem; font-weight: 900; font-size: 0.92rem; cursor: pointer;">
                            ✅ Sí, está correcto
                        </button>
                    </div>
                </div>
            `;
            showModal(html, { title: '', width: '560px' });

            const btnCancel = document.getElementById('btnCostAlertCancel');
            const btnConfirm = document.getElementById('btnCostAlertConfirm');
            const btnAdjust = document.getElementById('btnCostAlertAutoAdjust');

            if (btnCancel) {
                btnCancel.onclick = () => {
                    closeModal();
                    resolve({ action: 'cancel' });
                };
            }
            if (btnAdjust) {
                btnAdjust.onclick = () => {
                    closeModal();
                    resolve({ action: 'adjust' });
                };
            }
            if (btnConfirm) {
                btnConfirm.onclick = () => {
                    closeModal();
                    resolve({ action: 'confirm' });
                };
            }
        });
    },

    async addProductToPurchase(productId) {
        const searchInput = document.getElementById('productSearchInput');
        const quantity = parseFloat(document.getElementById('addQuantity').value);
        const enteredCostInput = parseFloat(document.getElementById('addCost').value);
        let price = parseFloat(document.getElementById('addPrice').value);

        if (isNaN(quantity) || quantity <= 0) { showNotification('Ingresa una cantidad válida', 'warning'); return; }
        if (isNaN(enteredCostInput) || enteredCostInput < 0) { showNotification('Ingresa un precio de costo válido', 'warning'); return; }

        const product = await Product.getById(productId);
        const existingItem = this.purchaseItems.find(item => item.productId === product.id);

        let enteredCost = parseFloat(enteredCostInput.toFixed(3));
        let enteredCostMode = this.lastVatMode;
        let cost;
        let lineNetTotal;

        if (this.lastVatMode === 'gross') {
            cost = parseFloat((enteredCost / 1.19).toFixed(4));
            const lineGross = Math.round(quantity * enteredCost);
            lineNetTotal = Math.round(lineGross / 1.19);
        } else {
            cost = parseFloat(enteredCost.toFixed(4));
            lineNetTotal = Math.round(quantity * cost);
        }

        // ⚠️ ALERTA INTELIGENTE DE VARIACIÓN > 20% CONTRA ÚLTIMA COMPRA REAL
        const lastNet = this._currentLastPurchaseCost?.costNeto;
        const prevCostNet = (lastNet !== undefined && lastNet !== null && lastNet > 0)
            ? lastNet
            : ((product.costNeto !== undefined && product.costNeto !== null && product.costNeto > 0)
                ? product.costNeto
                : (product.cost > 0 ? product.cost / 1.19 : 0));
            
        if (prevCostNet > 0) {
            const ratio = cost / prevCostNet;
            if (ratio >= 1.20 || ratio <= 0.80) {
                const percentChange = Math.round((ratio - 1) * 100);
                const isHigher = percentChange > 0;
                const prevCostDisplay = this.lastVatMode === 'gross' ? formatCLP(prevCostNet * 1.19, true) : formatCLP(prevCostNet, true);
                const newCostDisplay = this.lastVatMode === 'gross' ? formatCLP(enteredCost, true) : formatCLP(cost, true);
                const vatLabel = this.lastVatMode === 'gross' ? 'Bruto (con IVA)' : 'Neto';
                
                const alertRes = await this.showCostAlertModal(
                    product.name,
                    prevCostDisplay,
                    newCostDisplay,
                    percentChange,
                    isHigher,
                    vatLabel
                );
                
                if (!alertRes || alertRes.action === 'cancel') {
                    const costEl = document.getElementById('addCost');
                    if (costEl) { costEl.focus(); costEl.select(); }
                    return; // Cancela el ingreso para que el usuario pueda corregir el valor
                }

                if (alertRes.action === 'adjust') {
                    const docType = document.getElementById('purchaseDocumentType')?.value || 'factura_neto';
                    const isBoleta = docType.includes('boleta');
                    const prevGross = prevCostNet * 1.19;
                    const prevPrice = parseFloat(product.price) || 0;
                    const prevMargin = prevGross > 0 ? (((prevPrice - prevGross) / prevGross) * 100) : 30;
                    price = this.suggestPriceFromMargin(cost, Math.max(15, prevMargin), isBoleta, this.tempProductTaxes || [], quantity);
                    showNotification(`Precio de venta recalculado a ${formatCLP(price)} para mantener tu margen habitual`, 'info');
                }
            }
        }

        if (existingItem) {
            existingItem.quantity = quantity; // Overwrite to prevent infinite accumulation when editing/clicking again
            existingItem.cost = cost;
            existingItem.enteredCost = enteredCost;
            existingItem.enteredCostMode = enteredCostMode;
            existingItem.price = price;
            existingItem.total = lineNetTotal;
            existingItem.additionalTaxesConfig = [...(this.tempProductTaxes || [])];
        } else {
            this.purchaseItems.push({
                productId: product.id,
                name: product.name,
                barcode: product.barcode || '',
                quantity: quantity,
                cost: cost,
                enteredCost: enteredCost,
                enteredCostMode: enteredCostMode,
                price: price,
                total: lineNetTotal,
                type: product.type,
                lastCostNeto: lastNet !== undefined ? lastNet : null,
                lastCostGross: this._currentLastPurchaseCost?.cost !== undefined ? this._currentLastPurchaseCost.cost : null,
                additionalTaxesConfig: [...(this.tempProductTaxes || [])]
            });
        }

        this.cancelAddProduct();
        this.updatePurchaseItems();
        showNotification(`${product.name} agregado`, 'success');
        if (searchInput) { searchInput.value = ''; searchInput.focus(); }
        this.autosaveDraft();
    },

    cancelAddProduct() {
        document.getElementById('productSelectionArea').innerHTML = '';
        const resultsDiv = document.getElementById('purchaseProductSearchResults');
        if (resultsDiv) resultsDiv.style.display = 'none';
        this.tempProductTaxes = [];
        this.resetSearchInput(false);
    },

    addManualTaxToProductForm() {
        const nameEl = document.getElementById('manualTaxName');
        const rateEl = document.getElementById('manualTaxRate');
        const amtEl = document.getElementById('manualTaxAmount');

        const name = (nameEl?.value || '').trim().toUpperCase();
        const rate = parseFloat(rateEl?.value) || 0;
        const amount = parseFloat(amtEl?.value) || 0;

        if (!name) {
            showNotification('Ingresa un nombre para el impuesto', 'warning');
            return;
        }

        const newTax = { name, rate, amount };
        if (!this.tempProductTaxes) this.tempProductTaxes = [];
        this.tempProductTaxes.push(newTax);

        if (nameEl) nameEl.value = '';
        if (rateEl) rateEl.value = '';
        if (amtEl) amtEl.value = '';

        const panel = document.getElementById('manualTaxFormGroup');
        if (panel) panel.style.display = 'none';

        this.renderFormTaxesBadges();
        
        const quantityInput = document.getElementById('addQuantity');
        if (quantityInput) {
            quantityInput.dispatchEvent(new Event('input'));
        }
    },

    renderFormTaxesBadges() {
        const listDiv = document.getElementById('addedFormTaxesList');
        if (!listDiv) return;

        if (!this.tempProductTaxes || this.tempProductTaxes.length === 0) {
            listDiv.innerHTML = `<span style="color: #94a3b8; font-size: 0.9rem; font-style: italic;">Sin impuestos especiales agregados.</span>`;
            return;
        }

        listDiv.innerHTML = this.tempProductTaxes.map((tax, i) => `
            <span class="badge" style="background: #fef3c7; color: #b45309; padding: 0.5rem 0.8rem; border-radius: 0.5rem; font-size: 0.85rem; border: 1px solid #f59e0b; display: inline-flex; align-items: center; gap: 0.5rem; font-weight: 800; margin-right: 5px; margin-bottom: 5px;">
                ${tax.name} (${tax.rate}%): +$${tax.amount.toLocaleString('es-CL')}
                <span style="cursor: pointer; color: #ef4444; font-weight: 900; font-size: 1.1rem; margin-left: 0.25rem;" onclick="PurchasesView.removeFormTax(${i})" title="Quitar">&times;</span>
            </span>
        `).join('');
    },

    removeFormTax(index) {
        if (this.tempProductTaxes) {
            this.tempProductTaxes.splice(index, 1);
            this.renderFormTaxesBadges();
            
            const quantityInput = document.getElementById('addQuantity');
            if (quantityInput) {
                quantityInput.dispatchEvent(new Event('input'));
            }
        }
    },

    removeItemTax(itemIndex, taxIndex) {
        if (this.purchaseItems[itemIndex] && this.purchaseItems[itemIndex].additionalTaxesConfig) {
            this.purchaseItems[itemIndex].additionalTaxesConfig.splice(taxIndex, 1);
            this.updatePurchaseItems();
            this.autosaveDraft();
        }
    },

    clearAllItemSpecialTaxes() {
        const hasTaxes = this.purchaseItems.some(item => item.additionalTaxesConfig && item.additionalTaxesConfig.length > 0);
        if (!hasTaxes) {
            showNotification('No hay impuestos especiales en el carro', 'info');
            return;
        }
        showConfirm(
            '¿Quitar todos los impuestos especiales?',
            'Esta acción eliminará todos los impuestos adicionales configurados en todos los productos del carro.',
            'SÍ, ELIMINAR TODOS',
            'CANCELAR'
        ).then(confirm => {
            if (confirm) {
                this.purchaseItems.forEach(item => {
                    item.additionalTaxesConfig = [];
                });
                this.updatePurchaseItems();
                this.autosaveDraft();
                showNotification('Todos los impuestos especiales fueron eliminados del carro', 'success');
            }
        });
    },


    updatePurchaseItems() {
        const list = document.getElementById('purchaseItemsList');
        if (list) {
            list.innerHTML = this.renderPurchaseItems();
        }

        const docType = document.getElementById('purchaseDocumentType')?.value || 'factura_neto';
        const isFactura = docType.includes('factura');
        const isBoleta = docType === 'boleta';

        let netSubtotal = 0;
        let extraTaxesSum = 0;

        // Sumar todos los netos y los impuestos especiales manuales por producto
        this.purchaseItems.forEach(item => {
            netSubtotal += (item.total || 0); // item.total siempre almacena el neto de la línea
            
            if (item.additionalTaxesConfig && item.additionalTaxesConfig.length > 0) {
                item.additionalTaxesConfig.forEach(tax => {
                    const amt = (typeof tax.amount === 'number' && tax.amount > 0) 
                        ? tax.amount 
                        : Math.round((item.total || 0) * (parseFloat(tax.rate) / 100));
                    extraTaxesSum += amt;
                });
            }
        });

        // Sincronizar y sumar el listado de impuestos adicionales de Fase 1
        this.syncExtraTaxes();
        const totalExtraTaxes = extraTaxesSum + (this.manualExtraTax || 0);

        let ivaSum = 0;
        let grandTotal = 0;

        if (docType.includes('factura')) {
            if (this.lastVatMode === 'gross') {
                // Modo Con IVA (Bruto): el total bruto es la suma exacta de los totales brutos de cada línea
                const totalGrossLines = this.purchaseItems.reduce((sum, item) => {
                    const grossUnit = (item.enteredCostMode === 'gross' && typeof item.enteredCost === 'number') 
                        ? item.enteredCost 
                        : (item.cost * 1.19);
                    return sum + Math.round((item.quantity || 0) * grossUnit);
                }, 0);
                grandTotal = Math.round(totalGrossLines + totalExtraTaxes);
                netSubtotal = Math.round(totalGrossLines / 1.19);
                ivaSum = totalGrossLines - netSubtotal;
            } else {
                ivaSum = Math.round(netSubtotal * 0.19);
                grandTotal = Math.round(netSubtotal + ivaSum + totalExtraTaxes);
            }
        } else { // boleta o cualquier otro
            ivaSum = 0;
            grandTotal = Math.round(netSubtotal + totalExtraTaxes);
        }

        // Actualizar barra de resumen de Fase 1
        const s1Items = document.getElementById('step1ItemCount');
        const s1Neto = document.getElementById('step1NetoSubtotal');
        if (s1Items) s1Items.textContent = `${this.purchaseItems.length} producto${this.purchaseItems.length === 1 ? '' : 's'}`;
        if (s1Neto) s1Neto.textContent = formatCLP(netSubtotal, true);

        // Actualizar elementos visuales en Paso 2 (skipRounding = true para no truncar a decenas)
        const netoSpan = document.getElementById('step2Neto');
        const ivaSpan = document.getElementById('step2Iva');
        const ivaGroup = document.getElementById('step2IvaGroup');
        const extraSpan = document.getElementById('step2ExtraTax');
        const extraGroup = document.getElementById('step2ExtraTaxGroup');
        const extraListContainer = document.getElementById('step2ExtraTaxesList');
        const totalSpan = document.getElementById('purchaseTotal');

        if (netoSpan) netoSpan.textContent = formatCLP(netSubtotal, true);
        if (ivaSpan) ivaSpan.textContent = formatCLP(ivaSum, true);
        if (ivaGroup) ivaGroup.style.display = isBoleta ? 'none' : 'flex';

        if (extraListContainer) {
            if (this.extraTaxesList && this.extraTaxesList.length > 0) {
                extraListContainer.style.display = 'flex';
                extraListContainer.innerHTML = `
                    ${this.extraTaxesList.map(t => `
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #f59e0b; font-size: 0.74rem; font-weight: 850;">➕ ${safeHTML(t.name)}:</span>
                            <strong style="font-size: 0.95rem; font-weight: 900; color: #f59e0b;">+${formatCLP(t.amount, true)}</strong>
                        </div>
                    `).join('')}
                `;
            } else {
                extraListContainer.style.display = 'none';
                extraListContainer.innerHTML = '';
            }
        }

        if (extraSpan && extraGroup) {
            if (totalExtraTaxes > 0) {
                extraSpan.textContent = formatCLP(totalExtraTaxes, true);
                extraGroup.style.display = 'flex';
            } else {
                extraGroup.style.display = 'none';
            }
        }

        if (totalSpan) totalSpan.textContent = formatCLP(grandTotal, true);

        // Actualizar resumen en Paso 2 / Cierre
        const paidInput = document.getElementById('purchasePaidAmount');
        if (paidInput) {
            this.handlePaidAmountChange(paidInput.value);
        }
        // ponytail: Actualizar tablero de variación de precios en columna 3 en vivo
        this.renderStep3PriceAnalysis();
    },

    extraTaxesList: [],
    currentNewPurchaseStep: 1,

    syncExtraTaxes() {
        if (!Array.isArray(this.extraTaxesList)) {
            this.extraTaxesList = [];
        }
        this.manualExtraTax = this.extraTaxesList.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    },

    handleExtraTaxTypeChange(value) {
        const customContainer = document.getElementById('extraTaxCustomNameContainer');
        const customInput = document.getElementById('extraTaxCustomName');
        if (customContainer) {
            customContainer.style.display = (value === 'OTRO') ? 'block' : 'none';
            if (value === 'OTRO' && customInput) customInput.focus();
        }
    },

    addExtraTaxFromInput() {
        const typeSelect = document.getElementById('extraTaxTypeSelect');
        const customInput = document.getElementById('extraTaxCustomName');
        const amountInput = document.getElementById('extraTaxAmountInput');
        if (!typeSelect || !amountInput) return;

        let name = typeSelect.value;
        if (name === 'OTRO') {
            name = (customInput?.value || '').trim();
            if (!name) {
                showNotification('Ingresa el nombre del impuesto personalizado', 'warning');
                customInput?.focus();
                return;
            }
        }

        const amount = Math.round(parseFloat(amountInput.value) || 0);
        if (amount <= 0) {
            showNotification('Ingresa un monto válido en pesos mayor a $0', 'warning');
            amountInput.focus();
            return;
        }

        if (!Array.isArray(this.extraTaxesList)) {
            this.extraTaxesList = [];
        }

        this.extraTaxesList.push({
            id: Date.now() + Math.random().toString(36).substring(2, 7),
            name: name,
            amount: amount
        });

        amountInput.value = '';
        if (customInput) customInput.value = '';

        this.syncExtraTaxes();
        this.renderExtraTaxesBadges();
        this.updatePurchaseItems();
        this.autosaveDraft();
        showNotification(`Impuesto "${name}" de ${formatCLP(amount)} agregado`, 'success');
    },

    removeExtraTax(index) {
        if (!Array.isArray(this.extraTaxesList) || index < 0 || index >= this.extraTaxesList.length) return;
        const removed = this.extraTaxesList.splice(index, 1)[0];
        this.syncExtraTaxes();
        this.renderExtraTaxesBadges();
        this.updatePurchaseItems();
        this.autosaveDraft();
        showNotification(`Impuesto "${removed.name}" removido`, 'info');
    },

    renderExtraTaxesBadges() {
        const container = document.getElementById('extraTaxesBadgesList');
        if (!container) return;

        if (!this.extraTaxesList || this.extraTaxesList.length === 0) {
            // Sin botón Quitar cuando no hay impuestos
            container.innerHTML = `
                <div style="color: #64748b; font-size: 0.82rem; font-style: italic; padding: 0.4rem 0.2rem;">
                    Sin impuestos adicionales agregados. Si tu factura incluye IABA, Harinas o Licores, selecciónalo arriba y presiona Agregar.
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 0.45rem; width: 100%;">
                ${this.extraTaxesList.map((tax, index) => `
                    <div style="display: flex; align-items: center; justify-content: space-between; background: #fffbeb; border: 1.5px solid #f59e0b; padding: 0.5rem 0.85rem; border-radius: 0.65rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span style="font-size: 0.95rem;">🏷️</span>
                            <span style="font-weight: 850; color: #92400e; font-size: 0.88rem;">${safeHTML(tax.name)}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.85rem;">
                            <strong style="color: #b45309; font-size: 0.95rem; font-weight: 950;">+${formatCLP(tax.amount, true)}</strong>
                            <button type="button" class="btn btn-sm btn-danger" onclick="PurchasesView.removeExtraTax(${index})" 
                                    style="font-size: 0.72rem; font-weight: 900; padding: 2px 8px; border-radius: 0.4rem; height: 26px; display: flex; align-items: center; gap: 0.25rem;" title="Quitar este impuesto">
                                <span>❌</span><span>Quitar</span>
                            </button>
                        </div>
                    </div>
                `).join('')}
                <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.35rem; border-top: 1px dashed #cbd5e1;">
                    <span style="font-size: 0.78rem; font-weight: 900; color: #b45309; text-transform: uppercase;">Total Impuestos Adicionales:</span>
                    <strong style="font-size: 1.05rem; font-weight: 950; color: #b45309;">+${formatCLP(this.manualExtraTax, true)}</strong>
                </div>
            </div>
        `;
    },

    goToNewPurchaseStep(step) {
        const stepBadge = document.getElementById('purchaseWizardStepBadge');
        if (step === 2) {
            const supplierId = document.getElementById('purchaseSupplierId')?.value;
            if (!supplierId) {
                showNotification('Debes seleccionar un proveedor antes de continuar al Paso 2', 'warning');
                const searchSupplier = document.getElementById('supplierSearchInput');
                if (searchSupplier) searchSupplier.focus();
                return;
            }

            const docType = document.getElementById('purchaseDocumentType')?.value || '';
            const invoiceNumber = document.querySelector('[name="invoiceNumber"]')?.value?.trim();
            if (docType.includes('factura') && !invoiceNumber) {
                showNotification('El N° de Factura / Folio es obligatorio para continuar', 'warning');
                const invInput = document.querySelector('[name="invoiceNumber"]');
                if (invInput) invInput.focus();
                return;
            }

            if (this.purchaseItems.length === 0) {
                showNotification('Debes agregar al menos un producto al carro antes de continuar al Paso 2', 'warning');
                const searchProduct = document.getElementById('productSearchInput');
                if (searchProduct) searchProduct.focus();
                return;
            }

            this.saveCartInputsFromDOM();
            this.currentNewPurchaseStep = 2;

            const step1 = document.getElementById('purchaseStep1Container');
            const step2 = document.getElementById('purchaseStep2Container');
            if (step1) step1.style.display = 'none';
            if (step2) {
                step2.style.display = 'flex';
                step2.style.flexDirection = 'column';
                step2.style.gap = '1.15rem';
            }

            if (stepBadge) {
                stepBadge.textContent = 'PASO 2 DE 2: FORMA DE PAGO, TOTALES Y CIERRE';
                stepBadge.style.background = '#ecfdf5';
                stepBadge.style.color = '#047857';
                stepBadge.style.borderColor = '#a7f3d0';
            }

            this.updatePurchaseItems();
            this.renderStep3PriceAnalysis();
            this.setPaymentMethod(this._paymentMethod || 'credit');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            this.currentNewPurchaseStep = 1;
            const step1 = document.getElementById('purchaseStep1Container');
            const step2 = document.getElementById('purchaseStep2Container');
            if (step2) step2.style.display = 'none';
            if (step1) step1.style.display = 'flex';

            if (stepBadge) {
                stepBadge.textContent = 'PASO 1 DE 2: PRODUCTOS Y DETALLE';
                stepBadge.style.background = '#eff6ff';
                stepBadge.style.color = '#1d4ed8';
                stepBadge.style.borderColor = '#bfdbfe';
            }

            setTimeout(() => {
                document.getElementById('productSearchInput')?.focus();
            }, 100);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    },

    _formatDateYMD(dateObj) {
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    },

    setDueDateQuick(mode) {
        const input = document.getElementById('purchaseDueDateInput');
        if (!input) return;
        const now = new Date();
        let target = new Date();

        if (mode === 'yesterday') {
            target = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        } else if (mode === 'today') {
            target = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (mode === '+7') {
            target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
        } else if (mode === '+15') {
            target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 15);
        } else if (mode === '+30') {
            target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30);
        } else if (mode === 'endOfMonth') {
            target = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }

        const dateStr = this._formatDateYMD(target);
        input.value = dateStr;
        this.updateDueDateLabel(dateStr);
        this.autosaveDraft();
    },

    updateDueDateLabel(dateStr) {
        const label = document.getElementById('dueDateRelativeLabel');
        if (!label || !dateStr) return;
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const parts = dateStr.split('-');
        if (parts.length !== 3) return;
        const target = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        target.setHours(0, 0, 0, 0);

        const diffDays = Math.round((target - now) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) {
            label.textContent = '(Hoy)';
            label.style.color = '#1d4ed8';
            label.style.background = '#eff6ff';
            label.style.borderColor = '#bfdbfe';
        } else if (diffDays === -1) {
            label.textContent = '(Ayer - 1 día antes)';
            label.style.color = '#c2410c';
            label.style.background = '#fff7ed';
            label.style.borderColor = '#fdba74';
        } else if (diffDays < -1) {
            label.textContent = `(Hace ${Math.abs(diffDays)} días)`;
            label.style.color = '#dc2626';
            label.style.background = '#fef2f2';
            label.style.borderColor = '#fecaca';
        } else if (diffDays === 1) {
            label.textContent = '(Mañana)';
            label.style.color = '#059669';
            label.style.background = '#ecfdf5';
            label.style.borderColor = '#a7f3d0';
        } else {
            label.textContent = `(En ${diffDays} días)`;
            label.style.color = '#059669';
            label.style.background = '#ecfdf5';
            label.style.borderColor = '#a7f3d0';
        }
    },

    // ponytail: Manejador de cambio del impuesto adicional manual de detalle final (compatibilidad)
    handleManualExtraTaxChange(value) {
        this.manualExtraTax = Math.max(0, parseFloat(value) || 0);
        this.updatePurchaseItems();
        this.autosaveDraft();
    },

    // ponytail: Botón para limpiar/quitar el impuesto adicional manual con un solo clic (compatibilidad)
    clearManualExtraTax() {
        this.manualExtraTax = 0;
        this.extraTaxesList = [];
        this.renderExtraTaxesBadges();
        this.updatePurchaseItems();
        this.autosaveDraft();
        showNotification('Impuestos adicionales removidos (en $0)', 'info');
    },

    // ponytail: Calcula el análisis de variación de costos y precios de los productos en el carro
    calculatePriceChangesSummary() {
        const isGrossMode = (this.lastVatMode === 'gross');
        const summary = [];

        for (const item of this.purchaseItems) {
            const currentCostNet = parseFloat(item.cost) || 0;
            const currentCostGross = parseFloat((currentCostNet * 1.19).toFixed(2));
            const lastCostNet = (typeof item.lastCostNeto === 'number' && item.lastCostNeto > 0) ? item.lastCostNeto : null;
            const lastCostGross = (typeof item.lastCostGross === 'number' && item.lastCostGross > 0) ? item.lastCostGross : null;

            const oldCostCompare = isGrossMode ? (lastCostGross || (lastCostNet ? Math.round(lastCostNet * 1.19) : 0)) : (lastCostNet || 0);
            const newCostCompare = isGrossMode ? currentCostGross : currentCostNet;

            let diff = 0;
            let diffPct = 0;
            let status = 'same'; // 'up', 'down', 'same', 'new'

            if (oldCostCompare > 0) {
                diff = newCostCompare - oldCostCompare;
                diffPct = (diff / oldCostCompare) * 100;
                if (diff >= 0.5) status = 'up';
                else if (diff <= -0.5) status = 'down';
                else status = 'same';
            } else {
                status = 'new';
            }

            summary.push({
                productId: item.productId,
                name: item.name,
                barcode: item.barcode || '',
                oldCost: oldCostCompare,
                newCost: newCostCompare,
                diff: Math.round(diff),
                diffPct: parseFloat(diffPct.toFixed(1)),
                status,
                newPrice: parseFloat(item.price) || 0,
                quantity: parseFloat(item.quantity) || 0
            });
        }

        return summary;
    },

    // ponytail: Renderiza el tablero interactivo de análisis de precios en el Paso 3
    renderStep3PriceAnalysis() {
        const container = document.getElementById('step3PriceAnalysisContainer');
        if (!container) return;

        const changes = this.calculatePriceChangesSummary();
        const upItems = changes.filter(c => c.status === 'up');
        const downItems = changes.filter(c => c.status === 'down');
        const newItems = changes.filter(c => c.status === 'new');
        const sameItems = changes.filter(c => c.status === 'same');

        container.innerHTML = `
            <div style="background: #ffffff; border: 2px solid #cbd5e1; border-radius: 0.85rem; padding: 0.85rem; margin-top: 0.75rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem; flex-wrap: wrap; gap: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 1.1rem;">📊</span>
                        <strong style="font-size: 0.85rem; text-transform: uppercase; color: #1e293b; letter-spacing: 0.5px;">Control de Variación de Costos y Precios</strong>
                    </div>
                    <div style="display: flex; gap: 0.4rem; font-size: 0.75rem; font-weight: 800; flex-wrap: wrap;">
                        <span class="badge" style="background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; padding: 2px 8px; border-radius: 6px;">🔺 ${upItems.length} Subieron</span>
                        <span class="badge" style="background: #dcfce7; color: #166534; border: 1px solid #86efac; padding: 2px 8px; border-radius: 6px;">🔻 ${downItems.length} Bajaron</span>
                        ${newItems.length > 0 ? `<span class="badge" style="background: #dbeafe; color: #1d4ed8; border: 1px solid #93c5fd; padding: 2px 8px; border-radius: 6px;">⭐ ${newItems.length} Nuevos</span>` : ''}
                        <span class="badge" style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 2px 8px; border-radius: 6px;">⚪ ${sameItems.length} Sin cambio</span>
                    </div>
                </div>

                ${changes.length === 0 ? `
                    <div style="text-align: center; color: #94a3b8; padding: 0.75rem; font-size: 0.85rem;">No hay productos en la compra</div>
                ` : `
                    <div style="max-height: 160px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 0.5rem;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.78rem;">
                            <thead style="background: #f8fafc; color: #64748b; font-weight: 800; border-bottom: 1px solid #e2e8f0; position: sticky; top: 0; z-index: 2;">
                                <tr>
                                    <th style="padding: 5px 8px; text-align: left;">Producto</th>
                                    <th style="padding: 5px 8px; text-align: right;">Costo Anterior</th>
                                    <th style="padding: 5px 8px; text-align: right;">Nuevo Costo</th>
                                    <th style="padding: 5px 8px; text-align: center;">Variación</th>
                                    <th style="padding: 5px 8px; text-align: right; background: #e0e7ff; color: #3730a3;">Precio Venta</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${changes.map(c => {
                                    let badgeColor = '#64748b';
                                    let badgeBg = '#f1f5f9';
                                    let sign = '';
                                    if (c.status === 'up') { badgeColor = '#dc2626'; badgeBg = '#fee2e2'; sign = '+'; }
                                    else if (c.status === 'down') { badgeColor = '#166534'; badgeBg = '#dcfce7'; sign = ''; }
                                    else if (c.status === 'new') { badgeColor = '#2563eb'; badgeBg = '#dbeafe'; }

                                    return `
                                        <tr style="border-bottom: 1px solid #f1f5f9;">
                                            <td style="padding: 5px 8px; font-weight: 800; color: #1e293b;">${safeHTML(c.name)}</td>
                                            <td style="padding: 5px 8px; text-align: right; color: #64748b;">${c.oldCost > 0 ? formatCLP(c.oldCost) : '---'}</td>
                                            <td style="padding: 5px 8px; text-align: right; font-weight: 900; color: #0f172a;">${formatCLP(c.newCost)}</td>
                                            <td style="padding: 5px 8px; text-align: center;">
                                                <span style="display: inline-block; padding: 1px 6px; border-radius: 4px; font-weight: 900; font-size: 0.7rem; background: ${badgeBg}; color: ${badgeColor};">
                                                    ${c.status === 'new' ? 'NUEVO' : (c.status === 'same' ? '=' : `${sign}${c.diffPct}%`)}
                                                </span>
                                            </td>
                                            <td style="padding: 5px 8px; text-align: right; font-weight: 950; color: #4338ca; background: rgba(99, 102, 241, 0.05);">${formatCLP(c.newPrice)}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>
        `;
    },

    // ponytail: Modal para consultar e imprimir la lista de precios nuevos asociados a una compra
    async openPriceChangesModal(purchaseId) {
        let purchase = this.allPurchases.find(p => p.id === purchaseId);
        if (!purchase) {
            purchase = await Purchase.getById(purchaseId);
        }
        if (!purchase) {
            showNotification('Compra no encontrada', 'error');
            return;
        }

        let summary = [];
        if (purchase.priceChangesSummary) {
            try {
                summary = typeof purchase.priceChangesSummary === 'string' 
                    ? JSON.parse(purchase.priceChangesSummary) 
                    : purchase.priceChangesSummary;
            } catch (e) {
                summary = [];
            }
        }

        // Si la compra no tenía el resumen guardado, construirlo a partir de items
        if (!summary || summary.length === 0) {
            summary = (purchase.items || []).map(it => ({
                productId: it.productId,
                name: it.name,
                barcode: it.barcode || '',
                oldCost: it.lastCostNeto || 0,
                newCost: it.cost || 0,
                diff: 0,
                diffPct: 0,
                status: 'same',
                newPrice: it.price || 0,
                quantity: it.quantity || 0
            }));
        }

        let supplierName = 'Proveedor';
        if (this.supplierNameMap && this.supplierNameMap.has(purchase.supplierId)) {
            supplierName = this.supplierNameMap.get(purchase.supplierId);
        } else {
            const s = await Supplier.getById(purchase.supplierId);
            if (s) supplierName = s.name;
        }

        const content = `
            <div id="priceChangesPrintableArea" style="padding: 0.5rem 0;">
                <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 0.75rem; padding: 0.75rem 1rem; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                    <div>
                        <strong style="display: block; font-size: 1.05rem; color: #0f172a;">${safeHTML(supplierName)}</strong>
                        <span style="font-size: 0.8rem; color: #64748b; font-weight: 700;">Compra #${purchase.purchaseNumber || purchase.id} ${purchase.invoiceNumber ? `| Factura N° ${purchase.invoiceNumber}` : ''} | Fecha: ${formatDate(purchase.date)}</span>
                    </div>
                    <span class="badge" style="background: #3b82f6; color: #fff; font-size: 0.85rem; font-weight: 900; padding: 4px 10px; border-radius: 6px;">🏷️ ${summary.length} Productos</span>
                </div>

                <div style="max-height: 52vh; overflow-y: auto; border: 1.5px solid #cbd5e1; border-radius: 0.75rem;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                        <thead style="background: #1e293b; color: #ffffff; position: sticky; top: 0; z-index: 2;">
                            <tr>
                                <th style="padding: 8px 10px; text-align: left;">Producto</th>
                                <th style="padding: 8px 10px; text-align: center;">Código</th>
                                <th style="padding: 8px 10px; text-align: right;">Costo Anterior</th>
                                <th style="padding: 8px 10px; text-align: right;">Nuevo Costo</th>
                                <th style="padding: 8px 10px; text-align: center;">Variación</th>
                                <th style="padding: 8px 10px; text-align: right; background: #312e81; color: #ffffff;">PRECIO VENTA</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${summary.map(s => {
                                let badgeColor = '#64748b';
                                let badgeBg = '#f1f5f9';
                                let sign = '';
                                if (s.status === 'up') { badgeColor = '#dc2626'; badgeBg = '#fee2e2'; sign = '+'; }
                                else if (s.status === 'down') { badgeColor = '#166534'; badgeBg = '#dcfce7'; sign = ''; }
                                else if (s.status === 'new') { badgeColor = '#2563eb'; badgeBg = '#dbeafe'; }

                                return `
                                    <tr style="border-bottom: 1px solid #e2e8f0;">
                                        <td style="padding: 8px 10px; font-weight: 900; color: #0f172a;">${safeHTML(s.name)}</td>
                                        <td style="padding: 8px 10px; text-align: center; color: #64748b; font-family: monospace;">${safeHTML(s.barcode || '---')}</td>
                                        <td style="padding: 8px 10px; text-align: right; color: #64748b;">${s.oldCost > 0 ? formatCLP(s.oldCost) : '---'}</td>
                                        <td style="padding: 8px 10px; text-align: right; font-weight: 800; color: #1e293b;">${formatCLP(s.newCost)}</td>
                                        <td style="padding: 8px 10px; text-align: center;">
                                            <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 900; font-size: 0.72rem; background: ${badgeBg}; color: ${badgeColor};">
                                                ${s.status === 'new' ? 'NUEVO' : (s.status === 'same' ? 'IGUAL' : `${sign}${s.diffPct}%`)}
                                            </span>
                                        </td>
                                        <td style="padding: 8px 10px; text-align: right; font-weight: 950; font-size: 1.05rem; color: #4338ca; background: #eef2ff;">${formatCLP(s.newPrice)}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        const footer = `
            <div style="display: flex; justify-content: space-between; width: 100%; gap: 1rem;">
                <button type="button" class="btn btn-primary" onclick="PurchasesView.printPriceChangesList()" style="font-weight: 900; display: flex; align-items: center; gap: 0.5rem; border-radius: 0.65rem;">
                    🖨️ Imprimir Lista para Estantería
                </button>
                <button type="button" class="btn btn-secondary" onclick="closeModal()" style="border-radius: 0.65rem; font-weight: 800;">Cerrar</button>
            </div>
        `;

        showModal(content, { title: '🏷️ Lista de Precios — Actualización para Estantería', footer, width: 'min(95vw, 850px)' });
    },

    // ponytail: Imprime el listado limpio de nuevos precios listo para llevar a la góndola
    printPriceChangesList() {
        const printable = document.getElementById('priceChangesPrintableArea');
        if (!printable) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            window.print();
            return;
        }

        printWindow.document.write(`
            <html>
                <head>
                    <title>Lista de Nuevos Precios</title>
                    <style>
                        body { font-family: system-ui, -apple-system, sans-serif; padding: 1.5rem; color: #000; }
                        table { width: 100%; border-collapse: collapse; margin-top: 1rem; width: 100%; }
                        th, td { border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 12px; }
                        th { background: #f1f5f9; text-align: left; }
                        .badge { padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 11px; }
                        @media print {
                            body { padding: 0; }
                        }
                    </style>
                </head>
                <body>
                    <h2 style="margin: 0 0 0.5rem 0;">🏷️ Actualización de Precios para Góndola</h2>
                    ${printable.innerHTML}
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 300);
    },

    resetSearchInput(clearValue = false) {
        const searchInput = document.getElementById('productSearchInput');
        const resultsDiv = document.getElementById('purchaseProductSearchResults');
        if (!searchInput) return;

        if (clearValue) {
            searchInput.value = '';
        }
        searchInput.disabled = false;
        searchInput.readOnly = false;
        if (resultsDiv) {
            resultsDiv.style.display = 'none';
        }

        setTimeout(() => {
            searchInput.focus();
        }, 0);
    },

    renderPurchaseItems() {
        const isGrossMode = (this.lastVatMode === 'gross');
        return `
            <div class="table-responsive-wrapper">
                <table style="width: 100%; border-collapse: separate; border-spacing: 0 6px; margin-top: -5px;">
                <thead>
                    <tr style="background: #1e293b; box-shadow: 0 4px 15px rgba(0,0,0,0.15);">
                        <th style="background: #1e293b !important; color: #ffffff !important; padding: 0.75rem 1rem; text-align: left; font-weight: 900; font-size: 0.82rem; text-transform: uppercase; border-radius: 0.6rem 0 0 0.6rem; letter-spacing: 1px; border-bottom: 3px solid #3b82f6;">Producto</th>
                        <th style="background: #1e293b !important; color: #ffffff !important; padding: 0.75rem 6px; text-align: center; font-weight: 900; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 1px; width: 75px; border-bottom: 3px solid #3b82f6;">Cant.</th>
                        <th style="background: ${isGrossMode ? '#1e293b' : '#1e3a8a'} !important; color: ${isGrossMode ? '#94a3b8' : '#60a5fa'} !important; padding: 0.75rem 6px; text-align: center; font-weight: 900; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 1px; width: 110px; border-bottom: 3px solid ${isGrossMode ? '#3b82f6' : '#60a5fa'};">
                            Costo Neto
                        </th>
                        <th style="background: #1e293b !important; color: #ffffff !important; padding: 0.75rem 6px; text-align: center; font-weight: 900; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 1px; width: 85px; border-bottom: 3px solid #3b82f6;">IVA (19%)</th>
                        <th style="background: ${isGrossMode ? '#064e3b' : '#1e293b'} !important; color: ${isGrossMode ? '#34d399' : '#94a3b8'} !important; padding: 0.75rem 6px; text-align: center; font-weight: 900; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 1px; width: 110px; border-bottom: 3px solid ${isGrossMode ? '#10b981' : '#3b82f6'};">
                            Costo Bruto
                        </th>
                        <th style="background: #1e293b !important; color: #ffffff !important; padding: 0.75rem 6px; text-align: center; font-weight: 900; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 1px; width: 100px; border-bottom: 3px solid #3b82f6;">P. Venta</th>
                        <th style="background: #1e293b !important; color: #38bdf8 !important; padding: 0.75rem 6px; text-align: center; font-weight: 900; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 1px; width: 80px; border-bottom: 3px solid #3b82f6;">Margen</th>
                        <th style="background: #1e293b !important; color: #ffffff !important; padding: 0.75rem 1rem; text-align: right; font-weight: 900; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 1px; width: 120px; border-bottom: 3px solid #3b82f6;">
                            ${isGrossMode ? 'Total Bruto' : 'Total Neto'}
                        </th>
                        <th style="background: #1e293b !important; color: #ffffff !important; padding: 0.75rem; text-align: center; border-radius: 0 0.6rem 0.6rem 0; border-bottom: 3px solid #3b82f6; width: 45px;"></th>
                    </tr>
                </thead>
                <tbody style="background: transparent;">
                    ${this.purchaseItems.length === 0 ? `
                        <tr>
                            <td colspan="9" style="padding: 1.5rem 1rem; text-align: center; color: #64748b; font-weight: 900; font-size: 1rem; background: #ffffff; border-radius: 0.85rem; border: 2px dashed #cbd5e1;">
                                <div style="font-size: 2rem; margin-bottom: 0.35rem; filter: grayscale(1); opacity: 0.5;">🛒</div>
                                EL CARRO ESTÁ VACÍO.<br><span style="font-weight: 600; font-size: 0.82rem; opacity: 0.8;">Busca o escanea productos en el buscador superior para comenzar.</span>
                            </td>
                        </tr>
                    ` : this.purchaseItems.map((item, index) => {
            const displayNet = Number((item.cost || 0).toFixed(3));
            const grossUnit = (item.enteredCostMode === 'gross' && typeof item.enteredCost === 'number') 
                ? item.enteredCost 
                : ((item.cost || 0) * 1.19);
            const displayGross = Number(grossUnit.toFixed(3));
            const displayIva = Number((displayGross - displayNet).toFixed(3));
            const lineNetTotal = item.total || Math.round((item.quantity || 0) * (item.cost || 0));
            const lineGrossTotal = Math.round((item.quantity || 0) * grossUnit);
            const lineDisplayTotal = isGrossMode ? lineGrossTotal : lineNetTotal;
            const inputStyle = "height: 40px; border: 2px solid #cbd5e1; background: #ffffff; color: #000; font-size: 1rem; font-weight: 900; border-radius: 0.55rem; text-align: center; width: 100%; transition: all 0.2s; padding: 0 0.35rem; box-shadow: 0 2px 4px rgba(0,0,0,0.04);";

            // ponytail: Margen % unificado y exacto usando la regla contable según tipo de documento (Factura vs Boleta)
            const docType = document.getElementById('purchaseDocumentType')?.value || 'factura_neto';
            const isBoleta = docType.includes('boleta');
            const itemMargin = PurchasesView.calculateItemMargin(item, isBoleta);
            const margin = itemMargin.margin;
            const marginColor = itemMargin.isLoss ? '#ef4444' : (margin > 0 ? '#10b981' : '#64748b');
            const marginBadgeText = itemMargin.isLoss ? `🚨 ${margin.toFixed(1)}%` : `${margin.toFixed(1)}%`;

            // Trend Indicator calculations
            let trendNetHtml = '';
            let trendGrossHtml = '';
            
            if (typeof item.lastCostNeto === 'number' && item.lastCostNeto > 0) {
                const diff = item.cost - item.lastCostNeto;
                if (Math.abs(diff) >= 0.001) {
                    if (diff > 0) {
                        trendNetHtml = `<div style="color: #f59e0b; font-size: 0.7rem; font-weight: 900; margin-top: 2px; text-align: center; line-height: 1.1;">⚠️ +$${diff.toFixed(2)}</div>`;
                    } else {
                        trendNetHtml = `<div style="color: #10b981; font-size: 0.7rem; font-weight: 900; margin-top: 2px; text-align: center; line-height: 1.1;">🟢 -$${Math.abs(diff).toFixed(2)}</div>`;
                    }
                }
            }

            const itemGross = grossUnit;
            if (typeof item.lastCostGross === 'number' && item.lastCostGross > 0) {
                const diff = itemGross - item.lastCostGross;
                if (Math.abs(diff) >= 0.001) {
                    if (diff > 0) {
                        trendGrossHtml = `<div style="color: #f59e0b; font-size: 0.7rem; font-weight: 900; margin-top: 2px; text-align: center; line-height: 1.1;">⚠️ +$${diff.toFixed(2)}</div>`;
                    } else {
                        trendGrossHtml = `<div style="color: #10b981; font-size: 0.7rem; font-weight: 900; margin-top: 2px; text-align: center; line-height: 1.1;">🟢 -$${Math.abs(diff).toFixed(2)}</div>`;
                    }
                }
            }

            const costNetTrend = isGrossMode ? '' : trendNetHtml;
            const costGrossTrend = isGrossMode ? trendGrossHtml : '';

            return `
                        <tr style="background: #ffffff; box-shadow: 0 4px 10px -2px rgba(0,0,0,0.08); border-radius: 1rem;">
                            <td style="padding: 0.6rem 1rem; border-radius: 1rem 0 0 1rem; border-right: 1px solid #f1f5f9;">
                                <div style="font-weight: 900; color: #0f172a; font-size: 1.05rem; line-height: 1.1;">${safeHTML(item.name)}</div>
                                <div style="font-size: 0.75rem; color: #64748b; font-weight: 700; margin-top: 3px; opacity: 0.8; letter-spacing: 0.5px;">COD: ${safeHTML(item.barcode || '---')}</div>
                                ${item.additionalTaxesConfig && item.additionalTaxesConfig.length > 0 ? `
                                    <div style="display: flex; flex-wrap: wrap; gap: 0.25rem; margin-top: 4px;">
                                        ${item.additionalTaxesConfig.map((t, taxIdx) => `
                                            <span class="badge" style="background: #fef3c7; color: #b45309; padding: 0.2rem 0.4rem; border-radius: 0.4rem; font-size: 0.7rem; font-weight: 800; border: 1px solid #f59e0b; display: inline-flex; align-items: center; gap: 0.2rem;">
                                                ${safeHTML(t.name)} $${Math.round(t.amount || 0).toLocaleString('es-CL')} (${t.rate}%)
                                                <span style="cursor: pointer; color: #ef4444; font-weight: 900; font-size: 0.85rem; margin-left: 0.2rem;" onclick="event.stopPropagation(); PurchasesView.removeItemTax(${index}, ${taxIdx})" title="Quitar">&times;</span>
                                            </span>
                                        `).join('')}
                                    </div>
                                ` : ''}
                            </td>
                            <td style="padding: 0.4rem 4px; width: 75px;">
                                <input type="number" step="0.001" value="${item.quantity}" class="form-control" onfocus="this.select()" style="${inputStyle}" onchange="PurchasesView.updateItemQuantity(${index}, this.value)">
                            </td>
                            <td style="padding: 0.4rem 4px; width: 110px; ${!isGrossMode ? 'background: rgba(59,130,246,0.04);' : ''}">
                                <input type="number" step="0.001" value="${displayNet}" class="form-control" onfocus="this.select()" style="${inputStyle} text-align: right; ${!isGrossMode ? 'border-color: #3b82f6;' : ''}" onchange="PurchasesView.updateItemCost(${index}, this.value)">
                                ${costNetTrend}
                            </td>
                            <td style="padding: 0.4rem 4px; width: 85px;">
                                <input type="number" step="0.001" value="${displayIva}" class="form-control" disabled style="${inputStyle} text-align: right; background: #f8fafc; border-color: #e2e8f0; color: #64748b;">
                            </td>
                            <td style="padding: 0.4rem 4px; width: 110px; ${isGrossMode ? 'background: rgba(16,185,129,0.04);' : ''}">
                                <input type="number" step="0.001" value="${displayGross}" class="form-control" onfocus="this.select()" style="${inputStyle} text-align: right; ${isGrossMode ? 'border-color: #10b981;' : ''}" onchange="PurchasesView.updateItemGrossCost(${index}, this.value)">
                                ${costGrossTrend}
                            </td>
                            <td style="padding: 0.4rem 4px; width: 100px;">
                                <input type="number" step="any" value="${item.price}" class="form-control" onfocus="this.select()" style="${inputStyle} text-align: right; border-color: #6366f1; color: #4338ca;" onchange="PurchasesView.updateItemPrice(${index}, this.value)">
                            </td>
                            <td style="padding: 0.4rem 4px; width: 80px; text-align: center;">
                                <span style="display: inline-block; padding: 0.25rem 0.5rem; border-radius: 0.45rem; font-size: 0.85rem; font-weight: 950; color: ${marginColor}; background: #f8fafc; border: 1px solid #e2e8f0;" title="${itemMargin.isLoss ? 'Atención: Venta a pérdida' : 'Margen real'}">
                                    ${marginBadgeText}
                                </span>
                            </td>
                            <td style="padding: 0.6rem 1rem; text-align: right; font-weight: 950; color: #0f172a; font-size: 1.15rem; min-width: 120px; background: rgba(79, 70, 229, 0.03); border-left: 1px solid #f1f5f9;">
                                ${formatCLP(lineDisplayTotal, true)}
                            </td>
                            <td style="padding: 0.6rem; text-align: center; border-radius: 0 1rem 1rem 0; width: 45px;">
                                <button type="button" class="btn btn-danger" onclick="PurchasesView.removeItem(${index})" style="height: 38px; width: 38px; padding: 0; border-radius: 0.55rem; border: 2px solid #fff; font-weight: 950; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.3);" title="Eliminar">🗑️</button>
                            </td>
                        </tr>
                    `;
        }).join('')}
                </tbody>
                </table>
            </div>
        `;
    },

    openGlobalTaxesModal(base) {
        // ponytail: base viene del botón presionado ('pre_flete' = IABA/Harina, 'post_flete' = IVA)
        const esPreFlete = base === 'pre_flete';
        const baseLabel = esPreFlete
            ? '🟡 Sobre Subtotal sin Flete (IABA, Harina, Licores, etc.)'
            : '🟢 Sobre Neto Final con Flete (IVA 19%)';
        const baseColor = esPreFlete ? '#92400e' : '#166534';
        const baseBg    = esPreFlete ? '#fffbe6' : '#f0fdf4';
        const baseBorder= esPreFlete ? '#f59e0b' : '#22c55e';

        const content = `
            <div style="padding: 0.5rem 0;">
                <div style="background:${baseBg}; border: 2px solid ${baseBorder}; border-radius: 0.75rem; padding: 0.75rem 1.25rem; margin-bottom: 1rem;">
                    <strong style="font-size: 0.85rem; color: ${baseColor};">Base de cálculo: ${baseLabel}</strong>
                </div>

                <h6 style="font-weight: 800; color: #1e293b; margin-bottom: 0.75rem;">Impuestos Rápidos</h6>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1.25rem;">
                    ${esPreFlete ? `
                        <button type="button" class="btn btn-sm btn-warning" style="font-weight: 800; border-radius: 0.6rem;" onclick="PurchasesView.addTaxToPurchase('IABA 18%', 18, 'pre_flete'); closeModal();">🥤 IABA 18% (Bebidas)</button>
                        <button type="button" class="btn btn-sm btn-warning" style="font-weight: 800; border-radius: 0.6rem;" onclick="PurchasesView.addTaxToPurchase('IABA 10%', 10, 'pre_flete'); closeModal();">🧃 IABA 10% (Bajas Azúcar)</button>
                        <button type="button" class="btn btn-sm btn-warning" style="font-weight: 800; border-radius: 0.6rem;" onclick="PurchasesView.addTaxToPurchase('Harina 12%', 12, 'pre_flete'); closeModal();">🌾 Harina 12%</button>
                        <button type="button" class="btn btn-sm btn-warning" style="font-weight: 800; border-radius: 0.6rem;" onclick="PurchasesView.addTaxToPurchase('Cerveza 20.5%', 20.5, 'pre_flete'); closeModal();">🍺 Cerveza 20.5%</button>
                        <button type="button" class="btn btn-sm btn-warning" style="font-weight: 800; border-radius: 0.6rem;" onclick="PurchasesView.addTaxToPurchase('Licores 31.5%', 31.5, 'pre_flete'); closeModal();">🍾 Licores 31.5%</button>
                    ` : `
                        <button type="button" class="btn btn-sm btn-success" style="font-weight: 800; border-radius: 0.6rem;" onclick="PurchasesView.addTaxToPurchase('IVA 19%', 19, 'post_flete'); closeModal();">🟢 IVA 19%</button>
                    `}
                </div>

                <h6 style="font-weight: 800; color: #1e293b; margin-bottom: 0.5rem;">O ingresa uno personalizado</h6>
                <input type="hidden" id="gtaxBaseInput" value="${base || 'post_flete'}">
                <div style="display: grid; grid-template-columns: 1fr auto; gap: 0.75rem;">
                    <input type="text" id="gtaxNameInput" class="form-control" placeholder="Nombre del impuesto (Ej: Impuesto Específico)" style="border: 2px solid #cbd5e1; border-radius: 0.5rem; font-weight: 700;">
                    <input type="number" step="any" id="gtaxRateInput" class="form-control" placeholder="% (Ej: 15)" style="border: 2px solid #cbd5e1; border-radius: 0.5rem; font-weight: 800; width: 100px;">
                </div>
            </div>
        `;
        
        const footer = `
            <button type="button" class="btn btn-primary" onclick="PurchasesView.applyAndSaveGlobalTax()" style="font-weight: 800; border-radius: 0.75rem; padding: 0.75rem 2rem;">
                ✅ Agregar Impuesto Personalizado
            </button>
        `;
        
        showModal(content, { title: '➕ Agregar Impuesto a la Factura', footer, width: '550px' });
    },

    applyAndSaveGlobalTax() {
        const name = (document.getElementById('gtaxNameInput')?.value || '').trim();
        const rate = parseFloat(document.getElementById('gtaxRateInput')?.value);
        const base = document.getElementById('gtaxBaseInput')?.value || 'post_flete';
        
        if (name && !isNaN(rate)) {
            this.addTaxToPurchase(name, rate, base);
        } else {
            showNotification('Ingresa un nombre y porcentaje válido para el impuesto', 'warning');
            return;
        }
        closeModal();
    },

    removeTaxFromItem(itemIndex, taxIndex) {
        this.purchaseItems[itemIndex].additionalTaxesConfig.splice(taxIndex, 1);
        this.autosaveDraft();
        
        // Actualización dinámica sin cerrar el modal para no perder la posición
        const row = document.getElementById(`gtax-row-${itemIndex}`);
        if(row) {
            const badgeContainer = row.querySelector('.gtax-badges-container');
            if(badgeContainer) {
                const item = this.purchaseItems[itemIndex];
                badgeContainer.innerHTML = (item.additionalTaxesConfig || []).map((t, i) => `
                    <span class="badge" style="background: #e0e7ff; color: #3730a3; padding: 0.4rem 0.6rem; border-radius: 0.5rem; font-size: 0.8rem; border: 1px solid #c7d2fe; margin-right: 4px; pointer-events: auto;">
                        ${t.name} <span style="font-weight: 900;">${t.rate}%</span>
                        <span style="cursor:pointer; margin-left: 5px; color: #ef4444; font-weight: 900; padding: 0 4px;" onclick="event.stopPropagation(); PurchasesView.removeTaxFromItem(${itemIndex}, ${i})" title="Eliminar">&times;</span>
                    </span>
                `).join('');
            }
        }
    },

    saveCartInputsFromDOM() {
        const listContainer = document.getElementById('purchaseItemsList');
        if (!listContainer) return;

        const rows = listContainer.querySelectorAll('tbody tr');
        if (rows.length === 0 || this.purchaseItems.length === 0) return;

        rows.forEach((row, index) => {
            if (index >= this.purchaseItems.length) return;

            const inputs = row.querySelectorAll('input');
            // Input 0: Cantidad, Input 1: Costo Neto, Input 2: IVA (disabled), Input 3: Costo Bruto, Input 4: P. Venta
            if (inputs.length >= 5) {
                const qty = parseFloat(inputs[0].value) || 0;
                const net = parseFloat(inputs[1].value) || 0;
                const gross = parseFloat(inputs[3].value) || 0;
                const price = parseFloat(inputs[4].value) || 0;

                const item = this.purchaseItems[index];
                item.quantity = qty;
                item.price = price;

                if (this.lastVatMode === 'gross') {
                    item.cost = parseFloat((gross / 1.19).toFixed(4));
                    item.enteredCost = gross;
                    item.enteredCostMode = 'gross';
                    const lineGross = Math.round(qty * gross);
                    item.total = Math.round(lineGross / 1.19);
                } else {
                    item.cost = net;
                    item.enteredCost = net;
                    item.enteredCostMode = 'net';
                    item.total = Math.round(qty * item.cost);
                }
            }
        });
    },

    updateItemQuantity(index, quantity) {
        const q = parseFloat(quantity) || 0;
        this.purchaseItems[index].quantity = q;
        if (this.lastVatMode === 'gross') {
            const gross = (this.purchaseItems[index].enteredCostMode === 'gross' && typeof this.purchaseItems[index].enteredCost === 'number')
                ? this.purchaseItems[index].enteredCost
                : ((this.purchaseItems[index].cost || 0) * 1.19);
            const lineGross = Math.round(q * gross);
            this.purchaseItems[index].total = Math.round(lineGross / 1.19);
        } else {
            this.purchaseItems[index].total = Math.round(q * (this.purchaseItems[index].cost || 0));
        }
        this.updatePurchaseItems();
        this.autosaveDraft();
    },

    updateItemCost(index, value) {
        let val = parseFloat(value) || 0;
        // User edited NET cost
        this.purchaseItems[index].enteredCost = val;
        this.purchaseItems[index].enteredCostMode = 'net';
        this.purchaseItems[index].cost = val;
        this.purchaseItems[index].total = Math.round((this.purchaseItems[index].quantity || 0) * (this.purchaseItems[index].cost || 0));
        this.updatePurchaseItems();
        this.autosaveDraft();
    },

    updateItemGrossCost(index, value) {
        let val = parseFloat(value) || 0;
        // User edited BRUTO cost -> store as entered, keep NET internally
        this.purchaseItems[index].enteredCost = val;
        this.purchaseItems[index].enteredCostMode = 'gross';
        const netCost = parseFloat((val / 1.19).toFixed(4));
        this.purchaseItems[index].cost = netCost;
        const lineGross = Math.round((this.purchaseItems[index].quantity || 0) * val);
        this.purchaseItems[index].total = Math.round(lineGross / 1.19);
        this.updatePurchaseItems();
        this.autosaveDraft();
    },

    updateItemPrice(index, price) {
        const p = parseFloat(price) || 0;
        this.purchaseItems[index].price = p;
        this.updatePurchaseItems();
        this.autosaveDraft();
    },

    removeItem(index) {
        this.purchaseItems.splice(index, 1);
        this.updatePurchaseItems();
        this.resetSearchInput(true);
    },

    async deletePurchase(id) {
        await SupplierController.deletePurchase(id);
    },

    async savePurchase() {
        if (this.currentNewPurchaseStep === 1 || this.currentStep === 2) {
            this.saveCartInputsFromDOM();
        }
        const form = document.getElementById('purchaseForm');

        // HTML5 Validation for required fields
        if (!form.reportValidity()) {
            return;
        }

        const formData = new FormData(form);
        const purchaseId = formData.get('id'); // Get ID if editing

        if (this.purchaseItems.length === 0) {
            showNotification('Debes agregar al menos un producto', 'warning');
            if (this.currentSection === 'new') this.goToNewPurchaseStep(1);
            return;
        }

        const confirmSave = await showConfirm(
            "¿Deseas registrar esta compra y actualizar el inventario de productos?",
            "💼 Confirmar Compra",
            "SÍ, GUARDAR COMPRA",
            "REVISAR"
        );

        if (!confirmSave) return;

        const supplierId = parseInt(formData.get('supplierId'));
        if (!supplierId || isNaN(supplierId)) {
            showNotification('Debes seleccionar un proveedor antes de guardar', 'error');
            if (this.currentSection === 'new') this.goToNewPurchaseStep(1);
            else this.goToStep(1);
            const searchSupplier = document.getElementById('supplierSearchInput');
            if (searchSupplier) searchSupplier.focus();
            return;
        }

        let invoiceNumber = (formData.get('invoiceNumber') || '').trim();
        const invoiceDate = formData.get('invoiceDate');
        const documentType = formData.get('documentType');

        const vatMode = documentType.includes('factura') ? (documentType === 'factura_bruto' ? 'gross' : 'net') : 'net';
        const isFactura = documentType.includes('factura');

        if (isFactura && !invoiceNumber) {
            showNotification('El N° de Factura es obligatorio', 'warning');
            if (this.currentSection === 'new') this.goToNewPurchaseStep(1);
            else this.goToStep(1);
            const invInput = document.querySelector('[name="invoiceNumber"]');
            if (invInput) invInput.focus();
            return;
        }
        if (!invoiceDate) {
            showNotification('La fecha de documento es obligatoria', 'warning');
            if (this.currentSection === 'new') this.goToNewPurchaseStep(1);
            else this.goToStep(1);
            const dateInput = document.querySelector('[name="invoiceDate"]');
            if (dateInput) dateInput.focus();
            return;
        }
        if (!invoiceNumber) invoiceNumber = 'SIN CORRELATIVO';

        const subtotalItems = this.purchaseItems.reduce((sum, item) => sum + (item.total || 0), 0);
        const discountAmount = Math.round(parseFloat(formData.get('discountAmount')) || 0);
        const freightAmount = Math.round(parseFloat(formData.get('freightAmount')) || 0);
        
        const grandTotal = this.calculateTotalForWizard();

        const savedItems = this.purchaseItems.map(item => ({
            ...item,
            cost: (vatMode === 'gross') ? parseFloat((item.cost * 1.19).toFixed(2)) : item.cost
        }));

        const priceSummary = this.calculatePriceChangesSummary();

        const data = {
            id: purchaseId ? parseInt(purchaseId) : undefined,
            supplierId: supplierId,
            documentType: documentType || 'factura',
            vatMode: vatMode,
            invoiceNumber: invoiceNumber,
            invoiceDate: invoiceDate,
            items: savedItems,
            subtotal: subtotalItems,
            discountAmount: discountAmount,
            freightAmount: freightAmount,
            appliedTaxes: this.appliedTaxes || [],
            extraTaxesAmount: this.manualExtraTax || 0,
            priceChangesSummary: JSON.stringify(priceSummary),
            total: grandTotal,
            paidAmount: Math.round(parseFloat(formData.get('paidAmount')) || 0),
            paymentMethod: formData.get('paymentMethod') || 'credit',
            dueDate: formData.get('dueDate') || null,
            status: 'pending',
            // ponytail: deductFromCashRegister respeta la decisión del usuario en el checkbox
            deductFromCashRegister: formData.get('paymentMethod') === 'cash' && formData.get('deductFromCashRegister') === 'true'
        };

        console.log('📦 DATOS DE COMPRA A ENVIAR:', data);

        // ponytail: Tolerancia de $2 pesos para sincronización exacta de redondeos en facturas brutas
        if (Math.abs(data.total - data.paidAmount) <= 2) {
            data.status = 'paid';
            data.paidAmount = data.total;
        }

        try {
            console.log('🚀 Llamando a SupplierController.savePurchase...');
            const result = await SupplierController.savePurchase(data);
            console.log('✅ Resultado de savePurchase:', result);

            // ponytail: Verificar si esta compra cumple con la lista de orden de compra activa del proveedor
            try {
                const rawActiveOrder = localStorage.getItem('CF_ACTIVE_PURCHASE_ORDER');
                if (rawActiveOrder) {
                    const activeOrder = JSON.parse(rawActiveOrder);
                    const orderSupplierName = (activeOrder.supplierName || '').trim().toLowerCase();
                    const orderSupplierId = activeOrder.supplierId ? String(activeOrder.supplierId) : null;
                    
                    const purchaseSupplierId = data.supplierId ? String(data.supplierId) : null;
                    const purchaseSupplierName = (this.supplierNameMap && purchaseSupplierId ? (this.supplierNameMap[purchaseSupplierId] || '') : '').trim().toLowerCase();

                    const matchesSupplier = (orderSupplierId && purchaseSupplierId && orderSupplierId === purchaseSupplierId) ||
                                            (orderSupplierName && purchaseSupplierName && (orderSupplierName === purchaseSupplierName || purchaseSupplierName.includes(orderSupplierName) || orderSupplierName.includes(purchaseSupplierName)));

                    if (matchesSupplier && Array.isArray(activeOrder.items) && activeOrder.items.length > 0) {
                        const purchasedProductIds = new Set((data.items || []).map(i => String(i.productId || i.id)));
                        const purchasedNames = (data.items || []).map(i => (i.productName || i.name || '').trim().toLowerCase()).filter(Boolean);

                        let matchedItemsCount = 0;
                        activeOrder.items.forEach(orderItem => {
                            const oId = String(orderItem.productId || orderItem.id);
                            const oName = (orderItem.name || '').trim().toLowerCase();
                            if (purchasedProductIds.has(oId) || (oName && purchasedNames.some(pName => pName === oName || pName.includes(oName) || oName.includes(pName)))) {
                                matchedItemsCount++;
                            }
                        });

                        const matchRatio = matchedItemsCount / activeOrder.items.length;
                        // Si la mayoría (>= 50%) de los productos pedidos coinciden
                        if (matchRatio >= 0.5) {
                            localStorage.removeItem('CF_ACTIVE_PURCHASE_ORDER');
                            setTimeout(() => {
                                showNotification(`📋 Pedido a ${activeOrder.supplierName} cumplido y archivado automáticamente (${matchedItemsCount}/${activeOrder.items.length} productos recibidos).`, 'success');
                            }, 600);
                        }
                    }
                }
            } catch (orderCheckErr) {
                console.warn('Error verificando cumplimiento de orden de compra activa:', orderCheckErr);
            }

            this.clearDraft();
            this.extraTaxesList = [];
            this.manualExtraTax = 0;
            this.currentNewPurchaseStep = 1;
            this.allPurchases = [];
            this.offset = 0;
            this.hasMore = true;

            this.currentSection = 'list';
            this.editingPurchase = null;

            closeModal();
            showNotification(purchaseId ? 'Compra actualizada exitosamente' : 'Compra guardada', 'success');
            await app.navigate('purchases');
        } catch (error) {
            console.error('❌ ERROR AL GUARDAR COMPRA:', error);
            showNotification('Error al guardar la compra: ' + error.message, 'error');
        }
    },

    appliedTaxes: [],



    async editPurchase(id) {
        const purchase = await Purchase.getById(id);
        if (!purchase) {
            showNotification('Compra no encontrada', 'error');
            return;
        }
        this.showPurchaseForm(purchase);
    },

    async viewPurchase(id) {
        const purchase = await Purchase.getById(id);
        const supplier = await Supplier.getById(purchase.supplierId);

        // C6: Obtener pagos registrados para esta compra
        const payments = await SupplierPayment.getByPurchase(id);
        const registeredPaid = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
        const legacyPaid = parseFloat(purchase.paidAmount) || 0;
        const effectivePaid = Math.max(registeredPaid, legacyPaid);
        const balance = Math.max(0, (parseFloat(purchase.total) || 0) - effectivePaid);

        const methodLabel = (m) => m === 'cash' ? 'Efectivo' : m === 'transfer' ? 'Transferencia' : 'Otro';

        const paymentsHtml = payments.length > 0 ? `
            <div style="margin-top: 1.25rem;">
                <h4 style="margin: 0 0 0.5rem 0; font-size: 0.88rem; font-weight: 900; color: #334155; display: flex; align-items: center; gap: 0.4rem;">
                    <span>💳</span> Historial de Pagos Registrados (${payments.length})
                </h4>
                <div style="border: 1.5px solid #e2e8f0; border-radius: 0.65rem; overflow: hidden; background: #ffffff;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem; margin: 0;">
                        <thead>
                            <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                                <th style="padding: 0.45rem 0.75rem; font-weight: 850; color: #475569;">Fecha</th>
                                <th style="padding: 0.45rem 0.75rem; font-weight: 850; color: #475569;">Monto</th>
                                <th style="padding: 0.45rem 0.75rem; font-weight: 850; color: #475569;">Método</th>
                                <th style="padding: 0.45rem 0.75rem; font-weight: 850; color: #475569;">Referencia</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${payments.map(p => `
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 0.5rem 0.75rem; color: #334155;">${formatDate(p.date)}</td>
                                    <td style="padding: 0.5rem 0.75rem; font-weight: 900; color: #059669;">${formatCLP(p.amount)}</td>
                                    <td style="padding: 0.5rem 0.75rem;"><span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-weight: 750;">${methodLabel(p.method)}</span></td>
                                    <td style="padding: 0.5rem 0.75rem; color: #64748b;">${safeHTML(p.reference || '-')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        ` : '';

        let extraTaxesSum = 0;
        (purchase.items || []).forEach(item => {
            if (item.additionalTaxesConfig && item.additionalTaxesConfig.length > 0) {
                item.additionalTaxesConfig.forEach(tax => {
                    const amt = (typeof tax.amount === 'number' && tax.amount > 0)
                        ? tax.amount
                        : Math.round((item.total || 0) * (parseFloat(tax.rate) / 100));
                    extraTaxesSum += amt;
                });
            }
        });
        const manualExtra = parseFloat(purchase.extraTaxesAmount) || 0;
        const totalExtraTaxes = extraTaxesSum + manualExtra;

        const content = `
            <!-- ENCABEZADO HERO DEL PROVEEDOR Y FACTURA -->
            <div style="background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%); border: 1.5px solid #e2e8f0; border-radius: 1rem; padding: 1.15rem 1.35rem; margin-bottom: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; box-shadow: 0 2px 6px rgba(0,0,0,0.02);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div style="width: 44px; height: 44px; border-radius: 0.75rem; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); display: flex; align-items: center; justify-content: center; font-size: 1.35rem; color: #fff; box-shadow: 0 4px 10px rgba(37,99,235,0.25);">
                            🚚
                        </div>
                        <div>
                            <span style="font-size: 0.72rem; font-weight: 850; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">Proveedor</span>
                            <h3 style="margin: 0; font-size: 1.25rem; font-weight: 950; color: #0f172a; line-height: 1.2;">
                                ${safeHTML(supplier ? supplier.name : 'Proveedor Genérico / Varios')}
                            </h3>
                        </div>
                    </div>

                    <div>
                        ${balance <= 0 ? `
                            <span style="display: inline-flex; align-items: center; gap: 0.35rem; background: #ecfdf5; color: #059669; border: 1.5px solid #a7f3d0; padding: 0.35rem 0.85rem; border-radius: 999px; font-weight: 950; font-size: 0.82rem; box-shadow: 0 2px 6px rgba(5,150,105,0.12);">
                                <span style="width: 8px; height: 8px; border-radius: 50%; background: #10b981; display: inline-block;"></span> PAGADO
                            </span>
                        ` : `
                            <span style="display: inline-flex; align-items: center; gap: 0.35rem; background: #fef2f2; color: #dc2626; border: 1.5px solid #fecaca; padding: 0.35rem 0.85rem; border-radius: 999px; font-weight: 950; font-size: 0.82rem; box-shadow: 0 2px 6px rgba(220,38,38,0.12);">
                                <span style="width: 8px; height: 8px; border-radius: 50%; background: #ef4444; display: inline-block;"></span> SALDO PENDIENTE
                            </span>
                        `}
                    </div>
                </div>

                <!-- PÍLDORAS DE METADATOS -->
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; border-top: 1px solid rgba(226, 232, 240, 0.8); padding-top: 0.65rem;">
                    <span style="display: inline-flex; align-items: center; gap: 0.35rem; background: #ffffff; border: 1px solid #cbd5e1; padding: 0.25rem 0.65rem; border-radius: 0.5rem; font-size: 0.78rem; font-weight: 750; color: #334155;">
                        📅 Fech. Compra: <span style="font-weight: 900; color: #0f172a;">${formatDateTime(purchase.date)}</span>
                    </span>
                    <span style="display: inline-flex; align-items: center; gap: 0.35rem; background: #ffffff; border: 1px solid #cbd5e1; padding: 0.25rem 0.65rem; border-radius: 0.5rem; font-size: 0.78rem; font-weight: 750; color: #334155;">
                        📄 Factura #: <span style="font-weight: 900; color: #0f172a;">${safeHTML(purchase.invoiceNumber || 'SIN CORRELATIVO')}</span>
                    </span>
                    ${purchase.invoiceDate ? `
                    <span style="display: inline-flex; align-items: center; gap: 0.35rem; background: #ffffff; border: 1px solid #cbd5e1; padding: 0.25rem 0.65rem; border-radius: 0.5rem; font-size: 0.78rem; font-weight: 750; color: #334155;">
                        📆 Fecha Emisión: <span style="font-weight: 900; color: #0f172a;">${formatDate(purchase.invoiceDate)}</span>
                    </span>
                    ` : ''}
                </div>
            </div>
            
            <!-- TABLA DE PRODUCTOS ESTILIZADA -->
            <div style="border: 1.5px solid #e2e8f0; border-radius: 0.85rem; overflow: hidden; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                <table style="width: 100%; border-collapse: collapse; text-align: left; margin: 0;">
                    <thead>
                        <tr style="background: #f8fafc; border-bottom: 1.5px solid #e2e8f0;">
                            <th style="padding: 0.65rem 0.9rem; font-size: 0.74rem; font-weight: 900; color: #475569; text-transform: uppercase; letter-spacing: 0.04em;">Producto</th>
                            <th style="padding: 0.65rem 0.75rem; font-size: 0.74rem; font-weight: 900; color: #475569; text-transform: uppercase; letter-spacing: 0.04em; text-align: center;">Cantidad</th>
                            <th style="padding: 0.65rem 0.75rem; font-size: 0.74rem; font-weight: 900; color: #475569; text-transform: uppercase; letter-spacing: 0.04em; text-align: right;">Costo Neto</th>
                            <th style="padding: 0.65rem 0.75rem; font-size: 0.74rem; font-weight: 900; color: #475569; text-transform: uppercase; letter-spacing: 0.04em; text-align: right;">Precio Venta</th>
                            <th style="padding: 0.65rem 0.9rem; font-size: 0.74rem; font-weight: 900; color: #475569; text-transform: uppercase; letter-spacing: 0.04em; text-align: right;">Subtotal Neto</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(purchase.items || []).map(item => `
                            <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#ffffff'">
                                <td style="padding: 0.75rem 0.9rem; vertical-align: middle;">
                                    <div style="font-weight: 850; color: #0f172a; font-size: 0.92rem;">${safeHTML(item.name)}</div>
                                    ${item.additionalTaxesConfig && item.additionalTaxesConfig.length > 0 ? `
                                        <div style="font-size: 0.72rem; color: #b45309; font-weight: 800; margin-top: 2px;">
                                            ➕ ${item.additionalTaxesConfig.map(t => `${t.name} (${t.rate}%): +$${Math.round(t.amount || (item.total * t.rate / 100)).toLocaleString('es-CL')}`).join(', ')}
                                        </div>
                                    ` : ''}
                                </td>
                                <td style="padding: 0.75rem 0.75rem; text-align: center; vertical-align: middle;">
                                    <span style="background: #f1f5f9; color: #0f172a; font-weight: 900; font-size: 0.85rem; padding: 0.2rem 0.55rem; border-radius: 0.4rem; border: 1px solid #e2e8f0;">
                                        ${item.quantity}
                                    </span>
                                </td>
                                <td style="padding: 0.75rem 0.75rem; text-align: right; vertical-align: middle; font-weight: 750; color: #334155; font-size: 0.88rem;">
                                    ${formatCLP(item.cost)}
                                </td>
                                <td style="padding: 0.75rem 0.75rem; text-align: right; vertical-align: middle; color: #64748b; font-size: 0.88rem; font-weight: 700;">
                                    ${item.price ? formatCLP(item.price) : '-'}
                                </td>
                                <td style="padding: 0.75rem 0.9rem; text-align: right; vertical-align: middle; font-weight: 950; color: #0f172a; font-size: 0.95rem;">
                                    ${formatCLP(item.total)}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <!-- TARJETA DE LIQUIDACIÓN Y RESUMEN FINANCIERO -->
            <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1.5px solid #e2e8f0; border-radius: 0.9rem; padding: 1rem 1.25rem; margin-top: 1.25rem; box-shadow: 0 2px 6px rgba(0,0,0,0.02);">
                <!-- Fila de métricas en cuadrícula -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.85rem; text-align: center; margin-bottom: 0.85rem;">
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 0.65rem; padding: 0.55rem 0.75rem;">
                        <div style="font-size: 0.72rem; font-weight: 850; color: #64748b; text-transform: uppercase;">Total Neto</div>
                        <div style="font-size: 1rem; font-weight: 950; color: #0f172a; margin-top: 2px;">${formatCLP(purchase.subtotal || 0)}</div>
                    </div>
                    ${totalExtraTaxes > 0 ? `
                    <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 0.65rem; padding: 0.55rem 0.75rem;">
                        <div style="font-size: 0.72rem; font-weight: 850; color: #92400e; text-transform: uppercase;">Imp. Extra</div>
                        <div style="font-size: 1rem; font-weight: 950; color: #b45309; margin-top: 2px;">+${formatCLP(totalExtraTaxes)}</div>
                    </div>
                    ` : ''}
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 0.65rem; padding: 0.55rem 0.75rem;">
                        <div style="font-size: 0.72rem; font-weight: 850; color: #64748b; text-transform: uppercase;">IVA (19%)</div>
                        <div style="font-size: 1rem; font-weight: 950; color: #0f172a; margin-top: 2px;">${formatCLP(purchase.ivaAmount || 0)}</div>
                    </div>
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 0.65rem; padding: 0.55rem 0.75rem;">
                        <div style="font-size: 0.72rem; font-weight: 850; color: #64748b; text-transform: uppercase;">Pagado</div>
                        <div style="font-size: 1rem; font-weight: 950; color: #059669; margin-top: 2px;">${formatCLP(effectivePaid)}</div>
                    </div>
                </div>

                <!-- Barra de Gran Total y Saldo -->
                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1.5px dashed #cbd5e1; padding-top: 0.85rem; gap: 1rem; flex-wrap: wrap;">
                    <div>
                        <span style="font-size: 0.75rem; font-weight: 850; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">Total Factura</span>
                        <div style="font-size: 1.45rem; font-weight: 950; color: #1e1b4b; line-height: 1.1;">
                            ${formatCLP(purchase.total)}
                        </div>
                    </div>

                    <div style="text-align: right;">
                        <span style="font-size: 0.75rem; font-weight: 850; color: ${balance > 0 ? '#b91c1c' : '#047857'}; text-transform: uppercase; letter-spacing: 0.04em;">
                            ${balance > 0 ? '⚠️ Saldo Pendiente' : '✅ Saldo al Día'}
                        </span>
                        <div style="font-size: 1.45rem; font-weight: 950; color: ${balance > 0 ? '#dc2626' : '#059669'}; line-height: 1.1;">
                            ${formatCLP(balance)}
                        </div>
                    </div>
                </div>
            </div>

            ${paymentsHtml}
        `;

        const footer = `
            <div style="display: flex; justify-content: space-between; width: 100%; gap: 0.5rem; flex-wrap: wrap;">
                <button class="btn btn-secondary" style="background: #eef2ff; color: #4338ca; border: 1.5px solid #c7d2fe; font-weight: 800; border-radius: 0.6rem; padding: 0.5rem 1rem;" onclick="closeModal(); PurchasesView.openPriceChangesModal(${id})">
                    🏷️ Ver / Imprimir Precios
                </button>
                <div style="display: flex; gap: 0.5rem;">
                    ${balance > 0 ? `
                        <button class="btn btn-success" style="font-weight: 900; border-radius: 0.6rem; padding: 0.5rem 1.15rem; background: #059669; border-color: #059669;" onclick="closeModal(); PurchasesView.showPaymentForm(${id})">
                            💰 Registrar Pago
                        </button>
                    ` : ''}
                    <button class="btn btn-secondary" style="font-weight: 800; border-radius: 0.6rem; padding: 0.5rem 1.15rem;" onclick="closeModal()">Cerrar</button>
                </div>
            </div>
        `;

        showModal(content, { title: 'Detalle de Compra', footer, width: '760px' });
    },

    async showPaymentForm(id) {
        const purchase = await Purchase.getById(id);
        const supplier = await Supplier.getById(purchase.supplierId);

        // C6: Calcular saldo usando pagos registrados
        const registeredPaid = await SupplierPayment.getTotalPaidForPurchase(id);
        const legacyPaid = parseFloat(purchase.paidAmount) || 0;
        const effectivePaid = Math.max(registeredPaid, legacyPaid);
        const diff = (parseFloat(purchase.total) || 0) - effectivePaid;
        const balance = Math.max(0, diff >= 1.0 ? Math.round(diff) : 0);

        // C6: Obtener historial de pagos de esta compra
        const payments = await SupplierPayment.getByPurchase(id);

        const paymentHistoryHtml = payments.length > 0 ? `
            <div style="margin-bottom: 1rem;">
                <h4 style="margin-bottom: 0.5rem; font-size: 0.95rem;">Pagos registrados (${payments.length})</h4>
                <div style="max-height: 150px; overflow-y: auto; border: 1px solid var(--border); border-radius: 0.375rem;">
                    <table style="width: 100%; margin-bottom: 0;">
                        <thead>
                            <tr>
                                <th style="padding: 0.4rem 0.5rem; font-size: 0.8rem;">Fecha</th>
                                <th style="padding: 0.4rem 0.5rem; font-size: 0.8rem;">Monto</th>
                                <th style="padding: 0.4rem 0.5rem; font-size: 0.8rem;">Método</th>
                                <th style="padding: 0.4rem 0.5rem; font-size: 0.8rem;">Referencia</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${payments.map(p => `
                                <tr>
                                    <td style="padding: 0.3rem 0.5rem; font-size: 0.8rem;">${formatDate(p.date)}</td>
                                    <td style="padding: 0.3rem 0.5rem; font-size: 0.8rem;"><strong>${formatCLP(p.amount)}</strong></td>
                                    <td style="padding: 0.3rem 0.5rem; font-size: 0.8rem;">${p.method === 'cash' ? 'Efectivo' : p.method === 'transfer' ? 'Transferencia' : 'Otro'}</td>
                                    <td style="padding: 0.3rem 0.5rem; font-size: 0.8rem;">${p.reference || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        ` : '';

        const wasEdited = effectivePaid > 0 && balance > 0;
        
        const content = `
            ${wasEdited ? `
                <div style="background: #fffbeb; border: 1.5px solid #fcd34d; border-radius: 0.75rem; padding: 0.75rem 1rem; margin-bottom: 1.25rem; display: flex; align-items: center; gap: 0.75rem; box-shadow: 0 4px 6px -1px rgba(251, 191, 36, 0.05);">
                    <span style="font-size: 1.5rem;">⚠️</span>
                    <div>
                        <strong style="color: #b45309; font-size: 0.85rem; font-weight: 800; display: block; text-transform: uppercase;">Atención: Modificación Detectada</strong>
                        <span style="font-size: 0.75rem; color: #d97706; font-weight: 600;">Esta compra fue editada o tuvo abonos parciales. Paga la diferencia para saldarla.</span>
                    </div>
                </div>
            ` : ''}

            <div style="background: var(--surface); border: 1.5px solid var(--border); border-radius: 0.85rem; padding: 0.85rem 1rem; margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);">
                    <div>
                        <span style="font-size: 0.7rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Proveedor:</span>
                        <strong style="font-size: 1rem; font-weight: 900; color: var(--text); margin-left: 0.35rem;">${supplier ? supplier.name : 'N/A'}</strong>
                    </div>
                    <span style="font-size: 0.72rem; padding: 0.2rem 0.6rem; border-radius: 99px; background: rgba(239, 68, 68, 0.1); color: var(--danger); font-weight: 800;">
                        Pago Pendiente
                    </span>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr 1.2fr; gap: 0.65rem; align-items: stretch;">
                    <div style="background: var(--light); padding: 0.6rem; border-radius: 0.65rem; text-align: center;">
                        <div style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Total Compra</div>
                        <div style="font-size: 1.1rem; font-weight: 900; color: var(--text); margin-top: 0.2rem;">${formatCLP(purchase.total)}</div>
                    </div>
                    <div style="background: var(--light); padding: 0.6rem; border-radius: 0.65rem; text-align: center;">
                        <div style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Ya Abonado</div>
                        <div style="font-size: 1.1rem; font-weight: 900; color: #059669; margin-top: 0.2rem;">${formatCLP(effectivePaid)}</div>
                    </div>
                    <div style="background: #fef2f2; border: 1.5px solid #fecaca; padding: 0.6rem; border-radius: 0.65rem; text-align: center;">
                        <div style="font-size: 0.65rem; font-weight: 800; color: #dc2626; text-transform: uppercase;">Saldo a Pagar</div>
                        <div style="font-size: 1.3rem; font-weight: 950; color: #dc2626; margin-top: 0.15rem;">${formatCLP(balance)}</div>
                    </div>
                </div>
            </div>

            ${paymentHistoryHtml}
            
            <form id="paymentForm">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; margin-bottom: 0.75rem;">
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.78rem; font-weight: 800; color: var(--text);">Monto a Pagar (CLP) *</label>
                        <input type="number" 
                               id="paymentAmount" 
                               class="form-control" 
                               style="font-size: 1.15rem; font-weight: 900; height: 2.85rem;"
                               value="${balance}" 
                               min="1" 
                               max="${balance}" 
                               required>
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.78rem; font-weight: 800; color: var(--text);">Método de Pago</label>
                        <select id="paymentMethod" class="form-control" style="font-size: 0.95rem; font-weight: 700; height: 2.85rem;" onchange="
                            const cashBox = document.getElementById('purchaseCashDeductGroup');
                            const cb = document.getElementById('paymentDeductFromCash');
                            if(cashBox) { 
                                if(this.value === 'cash') {
                                    cashBox.style.display = 'block';
                                    cb.checked = false;
                                    cashBox.style.borderColor = 'var(--danger)';
                                    cashBox.style.background = 'var(--danger-bg)';
                                } else {
                                    cashBox.style.display = 'none';
                                    cb.checked = false;
                                }
                            }">
                            <option value="cash" selected>💵 Efectivo (Caja Fija)</option>
                            <option value="transfer">🏦 Transferencia / Tarjeta</option>
                            <option value="other">📝 Otro / Deuda Externa</option>
                        </select>
                    </div>
                </div>
                
                <div id="purchaseCashDeductGroup" style="display: block; margin-bottom: 0.75rem; background: var(--danger-bg); border: 1.5px solid var(--danger); border-radius: 0.65rem; padding: 0.65rem 0.85rem; transition: all 0.25s ease;">
                    <label style="display: flex; align-items: flex-start; gap: 0.75rem; cursor: pointer; margin: 0;">
                        <input type="checkbox" id="paymentDeductFromCash" value="true" style="width: 20px; height: 20px; margin-top: 0.15rem; accent-color: var(--danger);">
                        <div>
                            <div style="font-size: 0.88rem; font-weight: 900; color: var(--danger);">SACAR DINERO DE LA CAJA REGISTRADORA</div>
                            <div style="font-size: 0.72rem; color: var(--danger); font-weight: 600; opacity: 0.9; margin-top: 0.15rem; line-height: 1.3;">Si no lo marcas, significa que le pagarás al proveedor con dinero personal o de banco externo sin alterar la caja del turno.</div>
                        </div>
                    </label>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem;">
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted);">Referencia / Comprobante (opcional)</label>
                        <input type="text" id="paymentReference" class="form-control" placeholder="Ej: Nro. transferencia, recibo..." style="height: 2.6rem; font-size: 0.88rem;">
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted);">Notas (opcional)</label>
                        <input type="text" id="paymentNotes" class="form-control" placeholder="Notas adicionales..." style="height: 2.6rem; font-size: 0.88rem;">
                    </div>
                </div>
            </form>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-success" onclick="PurchasesView.registerPayment(${id})" id="btnRegisterPayment">
                💰 Registrar Pago
            </button>
        `;

        showModal(content, { title: 'Registrar Pago a Proveedor', footer, width: '620px' });
    },

    async registerPayment(id) {
        const amount = parseFloat(document.getElementById('paymentAmount').value);
        const method = document.getElementById('paymentMethod').value;
        const reference = document.getElementById('paymentReference').value.trim();
        const notes = document.getElementById('paymentNotes').value.trim();
        const deductFromCashElements = document.getElementById('paymentDeductFromCash');
        const deductFromCashRegister = deductFromCashElements ? deductFromCashElements.checked : false;

        if (!amount || amount <= 0) {
            showNotification('Monto inválido', 'error');
            return;
        }

        try {
            const purchase = await Purchase.getById(id);
            const registeredPaid = await SupplierPayment.getTotalPaidForPurchase(id);
            const legacyPaid = parseFloat(purchase.paidAmount) || 0;
            const effectivePaid = Math.max(registeredPaid, legacyPaid);
            const balance = Math.max(0, (parseFloat(purchase.total) || 0) - effectivePaid);

            if (amount > balance) {
                showNotification(`El monto no puede ser mayor a la deuda restante de ${formatCLP(balance)}`, 'error');
                return;
            }

            const btn = document.getElementById('btnRegisterPayment');
            if (btn) { btn.disabled = true; btn.textContent = 'Procesando...'; }

            // C6: Usar SupplierPaymentService en lugar de Purchase.registerPayment

            await SupplierPaymentService.registerPayment({
                supplierId: purchase.supplierId,
                purchaseId: id,
                amount: amount,
                method: method,
                reference: reference,
                notes: notes,
                deductFromCashRegister: deductFromCashRegister
            });
            closeModal();
            showNotification('Pago registrado exitosamente', 'success');
            this.allPurchases = [];
            this.offset = 0;
            this.hasMore = true;
            await this.refresh(true);
        } catch (error) {
            showNotification(error.message, 'error');
            if (btn) { btn.disabled = false; btn.textContent = '💰 Registrar Pago'; }
        }
    },

    async restoreDraft() {
        const draft = this.getDraft();
        if (!draft) return;

        if (!document.getElementById('purchaseForm')) {
            this._restoringDraft = true;
            await this.showPurchaseForm();
        }

        setTimeout(async () => {
            const form = document.getElementById('purchaseForm');
            if (!form) return;

            if (draft.supplierId) {
                try {
                    const s = await Supplier.getById(parseInt(draft.supplierId));
                    if (s) this.selectSupplier(s.id, s.name);
                } catch (e) {
                    console.warn('Proveedor de borrador no disponible:', e);
                }
            }

            if (draft.documentType) {
                const docType = draft.documentType;
                const isFactura = docType.includes('factura');
                this.setDocType(isFactura ? 'factura' : 'boleta');

                if (isFactura) {
                    this.setVatMode(docType === 'factura_bruto' ? 'gross' : 'net');
                }
            }

            if (draft.invoiceNumber) form.querySelector('[name="invoiceNumber"]').value = draft.invoiceNumber;
            if (draft.invoiceDate) form.querySelector('[name="invoiceDate"]').value = draft.invoiceDate;
            if (draft.dueDate) {
                const dueInput = form.querySelector('[name="dueDate"]');
                if (dueInput) {
                    dueInput.value = draft.dueDate;
                    this.updateDueDateLabel(draft.dueDate);
                }
            }

            this.purchaseItems = draft.items || [];
            if (Array.isArray(draft.extraTaxesList) && draft.extraTaxesList.length > 0) {
                this.extraTaxesList = draft.extraTaxesList;
                this.syncExtraTaxes();
                this.renderExtraTaxesBadges();
            }
            this.currentStep = 1;

            this.updatePurchaseItems();
            this.updateWizardUI();

            showNotification('Borrador recuperado correctamente.', 'success');
        }, 200);
    }
};
