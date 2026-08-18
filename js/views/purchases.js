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
    listFilter: 'all', // Cambiado a 'all' por defecto para nueva lógica
    dateFrom: null,
    dateTo: null,
    _calendarYear: null,
    _calendarMonth: null,
    _monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
    allPurchases: [], // Buffer para compras cargadas
    supplierNameMap: null,

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
            vatMode: this.lastVatMode || 'net',
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
            // Calcular margen promedio en vivo en el cierre directo
            const { profit, margin } = this.calculateAveragePurchaseMargin();
            const marginBadge = document.getElementById('directAvgMarginBadge');
            if (marginBadge) {
                marginBadge.innerHTML = `<span style="font-size:0.85em; opacity: 0.6; margin-right: 0.5rem;">(${formatCLP(profit)})</span> ${margin.toFixed(1)}%`;
                marginBadge.style.color = profit >= 0 ? '#10b981' : '#ef4444';
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

            // Cargar estimación ROI
            const roiBadge = document.getElementById('directRoiBadge');
            if (roiBadge) {
                roiBadge.innerHTML = `<span style="color:#3b82f6; font-weight:900;">~15 a 30 días</span>`;
            }

            // Autocompletar el monto de pago si es 0
            const paidInput = document.getElementById('purchasePaidAmount');
            const isNew = paidInput && !paidInput.disabled;
            if (isNew && (parseFloat(paidInput.value) === 0)) {
                const total = this.calculateTotalForWizard();
                paidInput.value = total;
                this.handlePaidAmountChange(total);
            }
            setTimeout(() => document.getElementById('purchasePaidAmount')?.focus(), 100);
        }
    },

    handlePaidAmountChange(val) {
        const amount = parseFloat(val) || 0;
        const total = this.calculateTotalForWizard();
        const debt = total - amount;

        const deductGroup = document.getElementById('purchaseInitialCashDeductGroup');
        const noPayMsg = document.getElementById('no-payment-needed');
        const debtMsg = document.getElementById('purchase-debt-warning');
        const debtAmountSpan = document.getElementById('purchase-debt-amount');

        if (deductGroup) deductGroup.style.display = amount > 0 ? 'block' : 'none';
        if (noPayMsg) noPayMsg.style.display = amount > 0 ? 'none' : 'block';

        const configBox = document.getElementById('step-3-config-box');
        if (configBox && amount > 0) {
            configBox.style.background = 'rgba(59, 130, 246, 0.15)';
            configBox.style.borderColor = 'rgba(59, 130, 246, 0.5)';
            configBox.style.boxShadow = '0 0 25px rgba(59, 130, 246, 0.2)';
            configBox.style.transform = 'scale(1.02)';
            configBox.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        } else if (configBox) {
            configBox.style.background = 'rgba(59, 130, 246, 0.05)';
            configBox.style.borderColor = 'rgba(59, 130, 246, 0.2)';
            configBox.style.boxShadow = 'none';
            configBox.style.transform = 'scale(1)';
        }

        if (debtMsg) {
            debtMsg.style.display = debt > 0 ? 'block' : 'none';
            if (debtAmountSpan) debtAmountSpan.textContent = formatCLP(debt);
        }
    },

    calculateAveragePurchaseMargin() {
        let totalRetailSales = 0;
        let totalGrossCost = 0;

        const docType = document.getElementById('purchaseDocumentType')?.value || 'factura_neto';
        const isFactura = docType.includes('factura');

        this.purchaseItems.forEach(item => {
            const qty = parseFloat(item.quantity) || 0;
            const price = parseFloat(item.price) || 0;
            const costNet = parseFloat(item.cost) || 0;
            
            // Impuestos especiales por producto
            let specialTaxesUnit = 0;
            if (item.additionalTaxesConfig && item.additionalTaxesConfig.length > 0) {
                item.additionalTaxesConfig.forEach(tax => {
                    const amt = (typeof tax.amount === 'number' && tax.amount > 0) 
                        ? tax.amount 
                        : Math.round(costNet * qty * (parseFloat(tax.rate) / 100));
                    specialTaxesUnit += amt / (qty || 1);
                });
            }

            const costBruto = isFactura ? Math.round(costNet * 1.19) : costNet;
            const unitGrossCost = costBruto + specialTaxesUnit;

            totalRetailSales += price * qty;
            totalGrossCost += unitGrossCost * qty;
        });

        const profit = totalRetailSales - totalGrossCost;
        const margin = totalGrossCost > 0 ? (profit / totalGrossCost * 100) : 0;

        return { profit, margin };
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

        let ivaSum = 0;
        let grandTotal = 0;

        if (isFactura) {
            ivaSum = Math.round(netSubtotal * 0.19);
            grandTotal = netSubtotal + ivaSum + extraTaxesSum;
        } else { // boleta o similar
            ivaSum = 0;
            grandTotal = netSubtotal + extraTaxesSum;
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
            let genericSupplier = await Supplier.getById(1);
            if (!genericSupplier) {
                const all = await Supplier.getAll();
                genericSupplier = all.find(s => (s.name && (s.name.includes('Genérico') || s.name.includes('Varios')))) || all[0];
            }
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
            if (vatSection) vatSection.style.display = 'block';
            if (invoiceGroup) invoiceGroup.style.display = 'block';
        } else { // boleta
            if (vatSection) vatSection.style.display = 'none';
            if (invoiceGroup) invoiceGroup.style.display = 'none';
            this.lastVatMode = 'net';
        }

        this.updatePurchaseItems();
        this.updateCostLabels();
        this.updateWizardUI();
    },

    setVatMode(mode) {
        const idInput = document.getElementById('purchaseDocumentType');
        const btnNeto = document.getElementById('btnVatNeto');
        const btnBruto = document.getElementById('btnVatBruto');

        const newVatMode = mode;
        this.lastVatMode = newVatMode;

        // Recálculo inteligente por error humano (Neta <-> IVA)
        if (this.purchaseItems.length > 0) {
            this.purchaseItems.forEach(item => {
                const hasEntered = (typeof item.enteredCost === 'number') && isFinite(item.enteredCost) && (item.enteredCostMode === 'net' || item.enteredCostMode === 'gross');

                if (hasEntered) {
                    if (newVatMode === 'gross' && item.enteredCostMode === 'net') {
                        // Cambió de neto a bruto: la cantidad neta ingresada se convierte en la nueva bruto
                        // Neto real = Costo Neto anterior / 1.19. Bruto real = Costo Neto anterior.
                        item.cost = parseFloat((item.cost / 1.19).toFixed(2));
                        item.enteredCost = parseFloat((item.cost * 1.19).toFixed(2));
                        item.enteredCostMode = 'gross';
                    } else if (newVatMode === 'net' && item.enteredCostMode === 'gross') {
                        // Cambió de bruto a neto: la cantidad bruta ingresada se convierte en la nueva neta
                        // Neto real = Costo Neto anterior * 1.19. Neto real = Costo Neto anterior * 1.19.
                        item.cost = parseFloat((item.cost * 1.19).toFixed(2));
                        item.enteredCost = item.cost;
                        item.enteredCostMode = 'net';
                    }
                } else {
                    item.enteredCostMode = newVatMode;
                    item.enteredCost = (newVatMode === 'gross') ? parseFloat((item.cost * 1.19).toFixed(2)) : item.cost;
                }

                item.total = Math.round((parseFloat(item.quantity) || 0) * (parseFloat(item.cost) || 0));
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

        this.updatePurchaseItems();
        this.updateCostLabels();
        this.updateWizardUI();
        this.autosaveDraft();
    },

    updateCostLabels() {
        const costLabel = document.getElementById('costInputLabel');
        if (costLabel) {
            costLabel.textContent = `PRECIO COSTO (${this.lastVatMode === 'net' ? 'NETO' : 'BRUTO'})`;
        }
    },

    setQuickPayment(type) {
        const paidInput = document.getElementById('purchasePaidAmount');
        if (!paidInput || paidInput.disabled) return;

        if (type === 'credit') {
            paidInput.value = 0;
        } else if (type === 'full') {
            paidInput.value = this.calculateTotalForWizard();
        }
        this.handlePaidAmountChange(paidInput.value);
    },

    handlePaidAmountChange(val) {
        const paid = parseFloat(val) || 0;
        const grandTotal = this.calculateTotalForWizard();
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

        const cashDeductGroup = document.getElementById('purchaseInitialCashDeductGroup');
        const noPaymentNeeded = document.getElementById('no-payment-needed');
        if (cashDeductGroup) {
            if (paid > 0) {
                cashDeductGroup.style.display = 'block';
                if (noPaymentNeeded) noPaymentNeeded.style.display = 'none';
            } else {
                cashDeductGroup.style.display = 'none';
                if (noPaymentNeeded) noPaymentNeeded.style.display = 'block';
            }
        }
    },
    async render() {
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
            <div class="view-header">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <h1>Compras a Proveedores</h1>
                        <p>Registra compras y administra documentos tributarios</p>
                    </div>
                     <div style="display: flex; gap: 0.5rem;">
                        ${this.getDraft() ? `
                        <div style="display: flex; gap: 0.75rem;">
                            <button class="btn" onclick="PurchasesView.restoreDraft()" style="background: var(--warning); color: #000; font-weight: 800; border: none; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.25);">
                                📦 Continuar Compra
                            </button>
                            <button class="btn btn-outline-danger" onclick="if(confirm('¿Seguro que quieres borrar la compra pausada?')) { PurchasesView.clearDraft(); PurchasesView.refresh(); }" style="font-weight: 700;">
                                🗑️ Cancelar Borrador
                            </button>
                        </div>
                        ` : ''}
                        ${PermissionService.can('purchases.create') ? `
                        <button class="btn btn-primary" onclick="PurchasesView.showPurchaseForm()">
                            📋 Nueva Compra
                        </button>` : ''}
                    </div>
                </div>
            </div>
            
            <div class="grid grid-4" style="margin-bottom: 2rem;">
                <div class="stat-card">
                    <h3>Total Compras</h3>
                    <div class="value">${totalPurchasesCount}</div>
                </div>
                <div class="stat-card">
                    <h3>Total del Mes</h3>
                    <div class="value" style="color: var(--primary);">${formatCLP(currentMonthTotal)}</div>
                </div>
                <div class="stat-card">
                    <h3>Cuentas por Pagar</h3>
                    <div class="value" style="color: var(--danger);">${formatCLP(accountsPayable)}</div>
                </div>
                <div class="stat-card">
                    <h3>Facturas por Pagar</h3>
                    <div class="value" style="color: #64748b;">${totalPendingCount}</div>
                </div>
            </div>

            <div id="accountsPayableSummary"></div>

            <div class="sales-history-filters" style="margin-bottom: 1.5rem; background: #fff; border-radius: 1rem; border: 1px solid var(--border); overflow: hidden;">
                <div class="sales-filter-row" style="padding: 1.5rem; border-bottom: 1px solid var(--border);">
                    <label style="font-weight: 800; color: var(--text-main); margin-bottom: 1rem; display: block; font-size: 1.1rem;">📅 Filtrar por Fecha / Calendario Histórico</label>
                    <div class="cash-history-filter" style="margin-bottom: 0;">
                        <div class="cash-history-filter-selects">
                            <label>
                                Mes
                                <select id="purchaseHistoryMonthSelect" class="form-control"
                                        onchange="PurchasesView.setPurchaseCalendarMonth(this.value)">
                                    ${this._monthNames.map((name, index) => `
                                        <option value="${index}" ${index === this._calendarMonth ? 'selected' : ''}>${name}</option>
                                    `).join('')}
                                </select>
                            </label>
                            <label>
                                Año
                                <select id="purchaseHistoryYearSelect" class="form-control"
                                        onchange="PurchasesView.setPurchaseCalendarYear(this.value)">
                                    ${this.getCalendarYears().map(year => `
                                        <option value="${year}" ${year === this._calendarYear ? 'selected' : ''}>${year}</option>
                                    `).join('')}
                                </select>
                            </label>
                        </div>

                        <div class="cash-history-filter-grid">
                            <div class="cash-history-day-grid-title" id="purchaseHistoryDayGridTitle">
                                ${this._monthNames[this._calendarMonth]} ${this._calendarYear}
                            </div>
                            <div class="cash-history-day-grid-body" id="purchaseHistoryDayGrid">
                                ${this.renderPurchaseHistoryDayGridButtons(this._calendarYear, this._calendarMonth)}
                            </div>
                        </div>

                        <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.75rem;">
                            <button class="btn btn-sm btn-primary" onclick="PurchasesView.selectToday()">Hoy</button>
                            <button class="btn btn-sm btn-secondary" onclick="PurchasesView.clearDateFilter()">Limpiar Filtros</button>
                        </div>
                    </div>
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
        await this.refresh();
    },

    async refresh() {
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
        
        let statusColor = '#f59e0b';
        let statusBg = 'rgba(245, 158, 11, 0.1)';
        let statusText = 'Pendiente';
        let statusIcon = '⏳';

        if (isCancelled) {
            statusColor = '#ef4444';
            statusBg = 'rgba(239, 68, 68, 0.1)';
            statusText = 'Anulada';
            statusIcon = '❌';
        } else if (isPaid) {
            statusColor = '#10b981';
            statusBg = 'rgba(16, 185, 129, 0.1)';
            statusText = 'Pagado';
            statusIcon = '✅';
        }

        const opacityStyle = isCancelled ? 'opacity: 0.7; filter: grayscale(0.3);' : '';
        const textDecoration = isCancelled ? 'text-decoration: line-through;' : '';

        return `
            <div class="white-panel" style="display: flex; flex-direction: column; gap: 1rem; position: relative; transition: all 0.2s; border: 1px solid var(--border); box-shadow: var(--shadow-md); ${opacityStyle}" onmouseover="this.style.transform='translateY(-4px)'; this.style.borderColor='var(--primary)';" onmouseout="this.style.transform='translateY(0)'; this.style.borderColor='var(--border)';">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">
                    <div>
                        <div style="font-size: 0.8rem; color: var(--secondary); margin-bottom: 0.25rem; font-weight: 700;">${formatDate(p.date)}</div>
                        <h3 style="margin: 0; font-size: 1.1rem; color: var(--text-main); font-weight: 800; ${textDecoration}">Compra #${p.purchaseNumber || p.id} - ${supplierName}</h3>
                        ${p.invoiceNumber ? `<div style="font-size: 0.85rem; color: var(--primary); font-weight: 600; margin-top: 0.25rem;">📄 Factura Nº: ${p.invoiceNumber}</div>` : ''}
                        ${isCancelled && p.cancelReason ? `<div style="font-size: 0.8rem; color: var(--danger); font-weight: 700; margin-top: 0.25rem; background: rgba(239, 68, 68, 0.05); padding: 0.25rem 0.5rem; border-radius: 0.25rem; border-left: 2px solid var(--danger);">🚫 Motivo: ${p.cancelReason}</div>` : ''}
                    </div>
                    <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
                        <span style="background: ${isCancelled ? 'rgba(239, 68, 68, 0.2)' : (isPaid ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)')}; 
                                     color: ${isCancelled ? '#ef4444' : (isPaid ? '#34d399' : '#fca5a5')}; 
                                     padding: 0.5rem 1rem; 
                                     border-radius: 0.75rem; 
                                     font-size: 0.9rem; 
                                     font-weight: 800; 
                                     border: 2px solid ${statusColor}; 
                                     display: flex; 
                                     align-items: center; 
                                     gap: 0.5rem;
                                     box-shadow: ${isCancelled ? '0 0 10px rgba(239,68,68,0.2)' : (isPaid ? '0 0 10px rgba(16,185,129,0.2)' : '0 0 15px rgba(245,158,11,0.3)')};">
                            ${statusIcon} ${statusText.toUpperCase()}
                        </span>
                        <div style="font-size: 0.85rem; color: #94a3b8; font-weight: 600;">📦 ${(p.items || []).length} Productos</div>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; text-align: center; background: #f8fafc; border-radius: 0.75rem; padding: 1rem; border: 1px solid var(--border);">
                    <div style="display: flex; flex-direction: column; justify-content: center;">
                        <div style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 0.25rem;">Total Neto</div>
                        <div style="font-weight: 900; color: #475569; font-size: 1.2rem; line-height: 1; ${textDecoration}">${formatCLP(p.subtotal || 0)}</div>
                    </div>
                    <div style="border-left: 1px solid var(--border); display: flex; flex-direction: column; justify-content: center;">
                        <div style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 0.25rem;">Total Compra</div>
                        <div style="font-weight: 900; color: var(--text-main); font-size: 1.2rem; line-height: 1; ${textDecoration}">${formatCLP(p.total)}</div>
                    </div>
                    <div style="border-left: 1px solid var(--border); border-right: 1px solid var(--border); display: flex; flex-direction: column; justify-content: center;">
                        <div style="font-size: 0.65rem; color: var(--success); text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 0.25rem;">Pagado</div>
                        <div style="font-weight: 900; color: #059669; font-size: 1.2rem; line-height: 1; ${textDecoration}">${formatCLP(p.paidAmount)}</div>
                        ${!isCancelled && parseFloat(p.paidAmount) > 0 ? `<div style="font-size: 0.6rem; color: var(--primary); font-weight: 700; cursor: pointer; margin-top: 0.3rem; text-decoration: underline;" onclick="event.stopPropagation(); PurchasesView.viewPurchase(${p.id})">Ver pagos</div>` : ''}
                    </div>
                    <div style="display: flex; flex-direction: column; justify-content: center;">
                        <div style="font-size: 0.65rem; color: var(--danger); text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 0.25rem;">Por Pagar</div>
                        <div style="font-weight: 900; color: #dc2626; font-size: 1.2rem; line-height: 1; ${textDecoration}">${formatCLP(balance)}</div>
                    </div>
                </div>


                <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: auto;">
                    <button class="btn btn-sm btn-secondary" onclick="PurchasesView.viewPurchase(${p.id})">👁️ Ver</button>
                    ${!isCancelled && PermissionService.can('purchases.edit') ? `<button class="btn btn-sm btn-outline-primary" style="flex: 1;" onclick="PurchasesView.editPurchase(${p.id})">✏️ Editar</button>` : ''}
                    ${!isCancelled && !isPaid && PermissionService.can('purchases.pay') ? `<button class="btn btn-sm btn-success" style="flex: 1;" onclick="PurchasesView.showPaymentForm(${p.id})">💰 Pagar</button>` : ''}
                    ${!isCancelled && PermissionService.can('purchases.delete') ? `<button class="btn btn-sm btn-outline-danger" style="flex: 1;" onclick="PurchasesView.deletePurchase(${p.id})">🗑️ Anular</button>` : ''}
                </div>
            </div>
        `;
    },

    async renderPurchasesTable(purchases) {
        if (!purchases || purchases.length === 0) {
            return `
                <div class="card" style="padding: 4rem 2rem; text-align: center; background: #fff; border: 2px dashed var(--border); border-radius: 1.5rem;">
                    <div style="font-size: 4rem; margin-bottom: 1.5rem; opacity: 0.3;">🛒</div>
                    <h3 style="color: var(--text-main); font-weight: 800; margin-bottom: 0.5rem;">No se encontraron compras</h3>
                    <p style="color: var(--secondary); margin-bottom: 1.5rem;">Prueba ajustando los filtros o el rango de fechas para ver otros resultados.</p>
                    <div style="display: flex; justify-content: center; gap: 0.75rem;">
                        <button class="btn btn-primary" onclick="PurchasesView.selectToday()">Ver hoy</button>
                        <button class="btn btn-secondary" onclick="PurchasesView.clearDateFilter()">Ver todas</button>
                    </div>
                    
                    <div class="purchase-filter-chips" style="display: flex; gap: 0.75rem; justify-content: center; margin-top: 2rem; flex-wrap: wrap;">
                        <button class="filter-chip ${this.listFilter === 'today' ? 'active' : ''}" onclick="PurchasesView.selectToday()">Hoy</button>
                        <button class="filter-chip ${this.listFilter === 'week' ? 'active' : ''}" onclick="PurchasesView.setFilter('week')">Semana</button>
                        <button class="filter-chip ${this.listFilter === 'month' ? 'active' : ''}" onclick="PurchasesView.setFilter('month')">Mes</button>
                        <button class="filter-chip ${this.listFilter === 'all' ? 'active' : ''}" onclick="PurchasesView.setFilter('all')">Todo</button>
                    </div>
                </div>
            `;
        }

        const isFiltered = this.dateFrom || this.dateTo;
        let filterTitle = 'Historial General';
        if (this.listFilter === 'today') filterTitle = 'Compras de Hoy';
        if (this.listFilter === 'week') filterTitle = 'Compras de esta Semana';
        if (this.listFilter === 'month') filterTitle = 'Compras de este Mes';
        if (this.listFilter === 'custom') filterTitle = `Rango: ${this.dateFrom} ${this.dateTo ? ' al ' + this.dateTo : ''}`;

        return `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
                <h2 style="margin: 0; font-weight: 850; color: var(--text-main); font-size: 1.4rem;">${filterTitle}</h2>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 1.5rem;">
                ${purchases.map(p => this.renderPurchaseRow(p)).join('')}
            </div>

            ${this.hasMore ? `
            <div style="text-align: center; padding: 2.5rem; margin-top: 2rem; background: #f8fafc; border-radius: 1rem; border: 1px solid var(--border);">
                <button id="btnLoadMorePurchases" class="btn btn-secondary" onclick="PurchasesView.loadMore()" 
                        style="padding: 0.75rem 2.5rem; font-weight: 800; min-width: 240px; border-radius: 0.75rem; box-shadow: var(--shadow-sm);">
                    ⬇️ CARGAR MÁS COMPRAS
                </button>
                <p style="margin-top: 0.75rem; font-size: 0.85rem; color: var(--secondary); font-weight: 600;">
                    Viendo ${this.allPurchases.length} compras en este filtro
                </p>
            </div>
            ` : ''}
        `;
    },

    async setFilter(filter) {
        this.listFilter = filter;
        this.dateFrom = null;
        this.dateTo = null;
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

        // VAT mode initialization
        if (editingPurchase) {
            this.lastVatMode = editingPurchase.vatMode || (editingPurchase.documentType === 'factura_bruto' ? 'gross' : 'net');
        } else if (draft) {
            this.lastVatMode = draft.vatMode || (draft.documentType === 'factura_bruto' ? 'gross' : 'net');
        } else {
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
        this.appliedTaxes = []; // Siempre iniciar sin impuestos al abrir el formulario

        const content = `
            <style>
                /* Force modal window to fit perfectly on screen without outer scrollbar */
                .modal {
                    height: 95vh !important;
                    max-height: 95vh !important;
                    display: flex !important;
                    flex-direction: column !important;
                    overflow: hidden !important;
                }
                .modal-body {
                    flex: 1 !important;
                    overflow: hidden !important;
                    display: flex !important;
                    flex-direction: column !important;
                    padding: 0.75rem 1.25rem !important;
                }
                .purchase-wizard {
                    display: flex !important;
                    flex-direction: column !important;
                    flex: 1 !important;
                    height: 100% !important;
                    overflow: hidden !important;
                }
                .purchase-stepper { display: flex; justify-content: space-around; align-items: center; background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 0.85rem; padding: 0.4rem 0.75rem; margin-bottom: 0.65rem; flex-shrink: 0; }
                .step-item { display: flex; align-items: center; gap: 0.45rem; cursor: pointer; padding: 0.3rem 0.85rem; border-radius: 0.6rem; transition: all 0.2s; border: 1.5px solid transparent; }
                .step-dot { width: 26px; height: 26px; border-radius: 50%; background: #cbd5e1; border: 2px solid #94a3b8; display: flex; align-items: center; justify-content: center; font-weight: 950; font-size: 0.85rem; color: #1e293b; position: relative; }
                .step-item.active { background: #eff6ff; border-color: #3b82f6; box-shadow: 0 2px 8px rgba(59,130,246,0.15); }
                .step-item.active .step-dot { background: #3b82f6; border-color: #2563eb; color: #ffffff; }
                .step-item.active .step-label { color: #1e3a8a; font-weight: 950; }
                .step-item.completed { background: #f0fdf4; border-color: #10b981; }
                .step-item.completed .step-dot { background: #10b981; border-color: #059669; color: #ffffff; }
                .step-item.completed .step-label { color: #065f46; font-weight: 900; }
                .step-label { font-size: 0.85rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
                
                .step-content { display: none; animation: slideVertical 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; overflow: hidden; flex: 1; min-height: 0; }
                .step-content.active { display: flex !important; flex-direction: column !important; flex: 1 !important; min-height: 0 !important; height: 100% !important; overflow: hidden !important; }
                @keyframes slideVertical { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

                /* Forzar visualización tipo tabla en todas las resoluciones para evitar deformación por reglas móviles */
                #purchaseItemsList table {
                    display: table !important;
                    width: 100% !important;
                    border-collapse: separate !important;
                    border-spacing: 0 12px !important;
                }
                #purchaseItemsList thead {
                    display: table-header-group !important;
                }
                #purchaseItemsList tbody {
                    display: table-row-group !important;
                }
                #purchaseItemsList tr {
                    display: table-row !important;
                    border: none !important;
                    padding: 0 !important;
                    margin-bottom: 0 !important;
                }
                #purchaseItemsList th, #purchaseItemsList td {
                    display: table-cell !important;
                    padding: 0.5rem 5px !important;
                    border: none !important;
                    justify-content: unset !important;
                    align-items: unset !important;
                    border-bottom: 1px solid #e2e8f0 !important;
                }
                #purchaseItemsList td::before {
                    content: none !important;
                }

                .doc-type-card { background: rgba(255, 255, 255, 0.08); border: 2.5px solid rgba(255, 255, 255, 0.2); border-radius: 1.25rem; padding: 1.5rem; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
                .doc-type-card:hover { background: rgba(255, 255, 255, 0.12); transform: translateY(-4px); border-color: rgba(255, 255, 255, 0.3); }
                .doc-type-card.active { background: #3b82f6 !important; border-color: #ffffff; box-shadow: 0 0 25px rgba(59, 130, 246, 0.4); }
                .doc-type-card .doc-icon { font-size: 2.5rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2)); }
                .doc-type-card .doc-label { font-weight: 950; font-size: 1.1rem; letter-spacing: 2px; color: #cbd5e1; text-shadow: 0 1px 2px rgba(0,0,0,0.3); }
                .doc-type-card.active .doc-label { color: #ffffff; text-shadow: 0 2px 4px rgba(0,0,0,0.5); }

                .supplier-search-results { position: absolute; top: 100%; left: 0; right: 0; background: #ffffff; border-radius: 1rem; box-shadow: 0 20px 50px rgba(0,0,0,0.8); z-index: 1000; max-height: 280px; overflow-y: auto; border: 2px solid #3b82f6; display: none; margin-top: 8px; }
                .supplier-search-item { padding: 1.25rem 1.5rem; cursor: pointer; border-bottom: 1px solid rgba(0,0,0,0.1); transition: all 0.2s; color: #000000; font-weight: 800; font-size: 1.1rem; }
                .supplier-search-item:hover { background: #3b82f6; color: #ffffff; }

                .purchase-total-fixed { background: #064e3b; border: 3px solid #10b981; border-radius: 1.5rem; padding: 1.25rem 2rem; display: flex; justify-content: space-between; align-items: center; margin-top: auto; box-shadow: 0 15px 30px rgba(0,0,0,0.4); }
                .purchase-total-label { color: #6ee7b7; font-size: 1rem; text-transform: uppercase; font-weight: 900; letter-spacing: 2px; }
                .purchase-total-value { font-size: 2.8rem; font-weight: 950; color: #ffffff; text-shadow: 0 2px 4px rgba(0,0,0,0.3); }
                .purchase-footer-nav { display: flex; justify-content: space-between; gap: 1.5rem; margin-top: 1.5rem; padding-top: 2rem; border-top: 2px solid rgba(255,255,255,0.05); }
                .grow { transition: transform 0.2s; } .grow:hover { transform: scale(1.02); }

                /* RESPONSIVE CLASSES */
                .wizard-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 2.5rem; }
                .wizard-inner-card { background: #ffffff; border: 4px solid #1e293b; border-radius: 1.5rem; padding: 2rem; display: flex; flex-direction: column; gap: 2rem; box-shadow: 0 10px 30px rgba(0,0,0,0.15); }
                .doc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
                
                @media (max-width: 900px) {
                    .purchase-stepper { padding: 0 1rem; }
                    .wizard-grid-2 { grid-template-columns: 1fr; gap: 1.5rem; }
                    .purchase-total-value { font-size: 2rem; }
                    .purchase-total-fixed { padding: 1rem; flex-direction: column; text-align: center; }
                }
                
                @media (max-width: 600px) {
                    .doc-grid { grid-template-columns: 1fr; }
                    .wizard-inner-card { padding: 1.25rem; gap: 1.5rem; }
                    .doc-type-card { height: 110px !important; }
                    .doc-type-card .doc-icon { font-size: 2.5rem !important; }
                    .doc-type-card .doc-label { font-size: 1.1rem !important; }
                    .form-control { height: 60px !important; font-size: 1.4rem !important; }
                    input[name="invoiceNumber"] { font-size: 1.8rem !important; height: 60px !important; }
                    input[name="invoiceDate"] { font-size: 1.5rem !important; height: 60px !important; }
                }

                .mobile-scroll-container { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; border-radius: 1.5rem; }
                
                @media (max-width: 768px) {
                    .total-cell { padding: 1rem !important; font-size: 1.1rem !important; }
                    .total-value-grand { font-size: 1.5rem !important; padding: 1.5rem 1rem !important; }
                    .total-label-cell { padding: 1rem !important; font-size: 0.9rem !important; }
                }
            </style>

            <form id="purchaseForm" class="purchase-wizard">
                ${editingPurchase ? `<input type="hidden" name="id" value="${editingPurchase.id}">` : ''}
                
                <div class="purchase-stepper">
                    <div class="step-item active" id="step-1" onclick="PurchasesView.goToStep(1)">
                        <div class="step-dot"><span>1</span></div>
                        <span class="step-label">Cabecera</span>
                    </div>
                    <div class="step-item" id="step-2" onclick="PurchasesView.goToStep(2)">
                        <div class="step-dot"><span>2</span></div>
                        <span class="step-label">Productos</span>
                    </div>
                    <div class="step-item" id="step-3" onclick="PurchasesView.goToStep(3)">
                        <div class="step-dot"><span>3</span></div>
                        <span class="step-label">Pago y Cierre</span>
                    </div>
                </div>

                <!-- PASO 1: DATOS GENERALES -->
                <div id="step-content-1" class="step-content active" style="overflow: hidden; flex: 1;">
                    <div class="wizard-grid-2" style="gap: 1.25rem; flex: 1;">
                        
                        <!-- Columna Izquierda -->
                        <div style="display: flex; flex-direction: column; gap: 1rem;">
                            <!-- Proveedor -->
                            <div style="position: relative;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                    <label style="font-weight: 900; color: #1e293b; background: #f1f5f9; padding: 2px 10px; border-radius: 4px; text-transform: uppercase; font-size: 0.75rem; border: 1px solid #cbd5e1; margin: 0;">1. Proveedor</label>
                                    <button type="button" class="btn btn-sm btn-outline-secondary" onclick="PurchasesView.selectGenericSupplier()" style="font-weight: 800; font-size: 0.75rem; border-radius: 4px; padding: 2px 8px;">🏷️ Proveedor Genérico</button>
                                </div>
                                <div style="position: relative; ${editingPurchase || (draft && draft.supplierId) ? 'display: none;' : ''}">
                                    <input type="text" 
                                           id="supplierSearchInput" 
                                           class="form-control" 
                                           placeholder="ESCRIBE NOMBRE DEL PROVEEDOR..." 
                                           style="height: 52px; padding-left: 1.25rem; font-size: 1.15rem; font-weight: 950; border-radius: 0.75rem; border: 3px solid #3b82f6; background: #ffffff; color: #000000;" 
                                           autocomplete="off" 
                                           oninput="PurchasesView.searchSuppliers(this.value)"
                                           onkeydown="PurchasesView.handleSupplierKeydown(event)">
                                    <div id="supplierSearchResults" class="supplier-search-results"></div>
                                </div>
                                <input type="hidden" name="supplierId" id="purchaseSupplierId" value="${editingPurchase ? editingPurchase.supplierId : (draft ? draft.supplierId : '')}" required>
                                
                                <div id="selectedSupplierDisplay" style="${editingPurchase || (draft && draft.supplierId) ? 'display: block;' : 'display: none;'}">
                                    <div style="background: #1e293b; border: 3px solid #3b82f6; padding: 1rem; border-radius: 1rem; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
                                        <div style="flex: 1;">
                                           <span style="color: #60a5fa; font-size: 0.8rem; font-weight: 950; text-transform: uppercase;">PROVEEDOR:</span>
                                           <strong id="selectedSupplierName" style="display: block; font-size: 1.4rem; color: #ffffff; margin-top: 2px;">${editingPurchase ? 'Cargando...' : (draft ? 'Cargando...' : '')}</strong>
                                        </div>
                                        <button type="button" class="btn btn-danger" style="border-radius: 0.75rem; font-weight: 900; border: 2px solid #fff; padding: 0.5rem 1.25rem;" onclick="PurchasesView.clearSelectedSupplier()">CAMBIAR</button>
                                    </div>
                                </div>
                            </div>

                            <!-- Tipo Documento -->
                            <div>
                                <label style="display: block; font-weight: 900; color: #1e293b; background: #f1f5f9; padding: 2px 10px; border-radius: 4px; width: fit-content; text-transform: uppercase; font-size: 0.75rem; margin-bottom: 0.5rem; border: 1px solid #cbd5e1;">2. Tipo Documento</label>
                                <div class="doc-grid">
                                    <div id="btnDocFactura" class="doc-type-card ${editingPurchase && editingPurchase.documentType.includes('factura') ? 'active' : (!editingPurchase && (!draft || (draft && draft.documentType.includes('factura'))) ? 'active' : '')}" onclick="PurchasesView.setDocType('factura')" style="height: 95px; justify-content: center; padding: 0.75rem;">
                                        <span class="doc-icon" style="font-size: 2.2rem;">📄</span>
                                        <span class="doc-label" style="font-size: 1.05rem;">FACTURA</span>
                                    </div>
                                    <div id="btnDocBoleta" class="doc-type-card ${editingPurchase && editingPurchase.documentType === 'boleta' ? 'active' : (!editingPurchase && draft && draft.documentType === 'boleta' ? 'active' : '')}" onclick="PurchasesView.setDocType('boleta')" style="height: 95px; justify-content: center; padding: 0.75rem;">
                                        <span class="doc-icon" style="font-size: 2.2rem;">🧾</span>
                                        <span class="doc-label" style="font-size: 1.05rem;">BOLETA</span>
                                    </div>
                                </div>
                                <input type="hidden" name="documentType" id="purchaseDocumentType" value="${editingPurchase ? editingPurchase.documentType : (draft ? draft.documentType : 'factura_neto')}">
                            </div>
                        </div>

                        <!-- Columna Derecha -->
                        <div style="display: flex; flex-direction: column; gap: 1rem;">
                            <!-- Modo Factura -->
                            <div id="vatModeSection" style="display: ${editingPurchase && editingPurchase.documentType.includes('factura') ? 'block' : (!editingPurchase && (!draft || (draft && draft.documentType.includes('factura'))) ? 'block' : 'none')}">
                                <div style="display: flex; gap: 0.5rem; background: #0f172a; padding: 0.5rem; border-radius: 1rem; border: 2px solid #334155;">
                                    <button type="button" id="btnVatNeto" class="btn grow ${(!editingPurchase && (!draft || (this.lastVatMode === 'net' && (!draft.documentType || draft.documentType === 'factura_neto')))) || (editingPurchase && this.lastVatMode === 'net' && (!editingPurchase.documentType || editingPurchase.documentType === 'factura_neto')) ? 'btn-primary' : 'btn-secondary'}" onclick="PurchasesView.setVatMode('net')" style="flex: 1; height: 48px; font-size: 0.9rem; font-weight: 950; border-radius: 0.75rem;">SIN IVA (NETO)</button>
                                    <button type="button" id="btnVatBruto" class="btn grow ${(!editingPurchase && draft && draft.documentType === 'factura_bruto') || (editingPurchase && editingPurchase.documentType === 'factura_bruto') ? 'btn-primary' : 'btn-secondary'}" onclick="PurchasesView.setVatMode('gross')" style="flex: 1; height: 48px; font-size: 0.9rem; font-weight: 950; border-radius: 0.75rem;">CON IVA (BRUTO)</button>
                                </div>
                            </div>

                             <!-- Datos Folio y Fecha -->
                            <div class="wizard-inner-card" style="padding: 1.25rem; gap: 1rem; border: 3px solid #1e293b;">
                                <div id="invoiceNumberGroup" style="display: ${editingPurchase && editingPurchase.documentType.includes('factura') ? 'block' : (!editingPurchase && (!draft || (draft && draft.documentType.includes('factura'))) ? 'block' : 'none')}">
                                    <label style="display: block; font-weight: 950; color: #000; text-transform: uppercase; font-size: 0.85rem; margin-bottom: 0.4rem;">Nº DE FACTURA (FOLIO)</label>
                                    <input type="text" name="invoiceNumber" class="form-control" placeholder="EJ: 12345" value="${editingPurchase ? editingPurchase.invoiceNumber : (draft ? (draft.invoiceNumber || '') : '')}" style="height: 52px; font-size: 1.4rem; font-weight: 950; border-radius: 0.75rem; background: #f8fafc; color: #000; text-align: center; border: 3px solid #6366f1;">
                                </div>
                                <div>
                                    <label style="display: block; font-weight: 950; color: #000; text-transform: uppercase; font-size: 0.85rem; margin-bottom: 0.4rem;">FECHA DE LA COMPRA</label>
                                    <input type="date" name="invoiceDate" class="form-control" value="${editingPurchase ? (editingPurchase.invoiceDate ? editingPurchase.invoiceDate.split('T')[0] : '') : (draft ? (draft.invoiceDate || new Date().toISOString().split('T')[0]) : new Date().toISOString().split('T')[0])}" style="height: 52px; font-size: 1.2rem; font-weight: 950; border-radius: 0.75rem; background: #f8fafc; color: #000; text-align: center; border: 3px solid #3b82f6;">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- PASO 2: PRODUCTOS -->
                <div id="step-content-2" class="step-content" style="max-height: calc(85vh - 120px); overflow-y: auto; padding-right: 0.3rem;">
                    <div style="background: #ffffff; border: 3px solid #3b82f6; border-radius: 1.25rem; padding: 1rem; margin-bottom: 0.75rem; box-shadow: 0 4px 15px rgba(0,0,0,0.05); flex-shrink: 0;">
                        <label style="font-size: 1rem; color: #1e293b; font-weight: 950; margin-bottom: 0.4rem; display: block; text-transform: uppercase; letter-spacing: 0.5px;">🔍 BUSCAR O ESCANEAR PRODUCTO</label>
                        <div class="search-box" style="position: relative;">
                            <input type="text" 
                                   id="productSearchInput" 
                                   class="form-control" 
                                   placeholder="ESCANEA EL CÓDIGO O ESCRIBE EL NOMBRE AQUÍ..."
                                   style="height: 54px; border: 3px solid #1e293b; background: #f8fafc; font-size: 1.2rem; font-weight: 900; color: #000; padding-left: 1.25rem; border-radius: 0.75rem;"
                                   autocomplete="off">
                            <div id="purchaseProductSearchResults" class="pos-search-results"></div>
                        </div>
                    </div>

                    <div id="productSelectionArea"></div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; gap: 1rem; flex-wrap: wrap;">
                        <h5 style="margin: 0; font-weight: 950; color: #1e293b; text-transform: uppercase; font-size: 0.95rem; letter-spacing: 0.5px;">📋 Productos en el Carro</h5>
                        <button type="button" class="btn btn-danger" onclick="PurchasesView.clearAllItemSpecialTaxes()" style="font-weight: 900; font-size: 0.8rem; padding: 0.4rem 1rem; border-radius: 0.5rem; border: 2px solid #fff; box-shadow: 0 4px 10px rgba(239,68,68,0.2);">
                            ❌ QUITAR IMPUESTOS ESPECIALES
                        </button>
                    </div>
                    
                    <div id="purchaseItemsList" class="mobile-scroll-container" style="background: #ffffff; border-radius: 1.25rem; border: 3px solid #1e293b; box-shadow: 0 10px 25px rgba(0,0,0,0.1); overflow-y: auto; min-height: 220px; max-height: 380px; flex: 1;">
                        ${this.renderPurchaseItems()}
                    </div>

                    <!-- RESUMEN INLINE DE TOTALES PARA PASO 2 -->
                    <div id="inlineTotalsContainerPaso2" style="background: #0f172a; border: 3px solid #1e293b; border-radius: 1rem; padding: 0.75rem 1.25rem; display: flex; justify-content: space-between; align-items: center; gap: 1.5rem; margin-top: 0.5rem; flex-shrink: 0; flex-wrap: wrap; box-shadow: 0 5px 15px rgba(0,0,0,0.15);">
                        <div style="display: flex; gap: 1.5rem; flex-wrap: wrap; align-items: center;">
                            <div>
                                <span style="color: #94a3b8; font-size: 0.7rem; font-weight: 900; text-transform: uppercase; display: block; letter-spacing: 0.5px;">Neto Total:</span>
                                <strong id="step2Neto" style="font-size: 1.15rem; font-weight: 950; color: #ffffff;">$0</strong>
                            </div>
                            <div id="step2IvaGroup">
                                <span style="color: #94a3b8; font-size: 0.7rem; font-weight: 900; text-transform: uppercase; display: block; letter-spacing: 0.5px;">IVA (19%):</span>
                                <strong id="step2Iva" style="font-size: 1.15rem; font-weight: 950; color: #ffffff;">$0</strong>
                            </div>
                            <div id="step2ExtraTaxGroup" style="display: none;">
                                <span style="color: #f59e0b; font-size: 0.7rem; font-weight: 900; text-transform: uppercase; display: block; letter-spacing: 0.5px;">Imp. Especiales:</span>
                                <strong id="step2ExtraTax" style="font-size: 1.15rem; font-weight: 950; color: #f59e0b;">$0</strong>
                            </div>
                        </div>
                        <div style="text-align: right; background: #064e3b; padding: 0.4rem 1.25rem; border-radius: 0.75rem; border: 2px solid #10b981;">
                            <span style="color: #6ee7b7; font-size: 0.75rem; font-weight: 950; text-transform: uppercase; display: block; letter-spacing: 0.5px;">Total a Pagar:</span>
                            <strong id="purchaseTotal" style="font-size: 1.5rem; font-weight: 950; color: #ffffff;">$0</strong>
                        </div>
                    </div>
                </div>

                <!-- PASO 3: PAGO Y CIERRE -->
                <div id="step-content-3" class="step-content" s                    <!-- Contenedor de Pago Destacado -->
                    <div id="sharedPaymentContainer" style="display: flex; flex-direction: column; gap: 0.75rem; width: 100%;">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0.75rem; flex-shrink: 0;">
                            <!-- MONTO PAGADO HOY -->
                            <div class="form-group" style="background: #ffffff; padding: 1rem; border-radius: 1rem; border: 3px solid #10b981; box-shadow: 0 4px 15px rgba(16,185,129,0.1); margin-bottom: 0;">
                                <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                                    <button type="button" class="btn btn-sm btn-outline-primary" style="flex: 1; font-weight: 800; border-radius: 0.5rem; font-size: 0.75rem;" onclick="PurchasesView.setQuickPayment('credit')">
                                        💳 100% A Crédito
                                    </button>
                                    <button type="button" class="btn btn-sm btn-outline-success" style="flex: 1; font-weight: 800; border-radius: 0.5rem; font-size: 0.75rem;" onclick="PurchasesView.setQuickPayment('full')">
                                        💵 Pagado Hoy
                                    </button>
                                </div>
                                <label style="display: block; font-weight: 950; color: #1e293b; text-transform: uppercase; font-size: 0.8rem; margin-bottom: 0.4rem;">💰 MONTO PAGADO HOY (CLP)</label>
                                <div style="position: relative;">
                                    <span style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); font-size: 1.6rem; color: #10b981; font-weight: 950;">$</span>
                                    <input type="number"
                                           name="paidAmount"
                                           id="purchasePaidAmount"
                                           class="form-control"
                                           style="height: 48px; padding-left: 2.2rem; font-size: 1.5rem; font-weight: 950; color: #000; text-align: right; border-radius: 0.5rem; background: #f8fafc; border: 2px solid #cbd5e1;"
                                           value="${editingPurchase ? editingPurchase.paidAmount : 0}"
                                           min="0"
                                           ${editingPurchase ? 'disabled' : ''}
                                           oninput="PurchasesView.handlePaidAmountChange(this.value)">
                                </div>
                            </div>

                            <!-- FECHA VENCIMIENTO -->
                            <div class="form-group" style="background: #ffffff; padding: 1rem; border-radius: 1rem; border: 3px solid #cbd5e1; margin-bottom: 0; display: flex; flex-direction: column; justify-content: center;">
                                <label style="font-weight: 950; color: #1e293b; text-transform: uppercase; font-size: 0.8rem; margin-bottom: 0.4rem;">📅 FECHA DE VENCIMIENTO:</label>
                                <input type="date" name="dueDate" class="form-control" value="${editingPurchase && editingPurchase.dueDate ? editingPurchase.dueDate.split('T')[0] : ''}" style="height: 44px; font-size: 1rem; font-weight: 900; border-radius: 0.5rem; background: #f8fafc; text-align: center; border: 2px solid #cbd5e1; color: #000; width: 100%; padding: 0.25rem;">
                            </div>
                        </div>

                        <!-- TARJETA DESTACADA DE ACCIÓN DE CAJA REGISTRADORA -->
                        <div id="step-3-config-box" style="background: rgba(59, 130, 246, 0.06); border-radius: 1rem; padding: 1rem; border: 2px dashed #3b82f6; transition: all 0.3s ease;">
                            ${!editingPurchase ? `
                                <div id="purchaseInitialCashDeductGroup" style="display: none; width: 100%;">
                                    <label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer; margin: 0; background: #ffffff; padding: 0.85rem 1.25rem; border-radius: 0.75rem; border: 2px solid #3b82f6; box-shadow: 0 4px 12px rgba(59,130,246,0.15);">
                                        <input type="checkbox" name="deductFromCashRegister" value="true" style="width: 24px; height: 24px; accent-color: #2563eb; cursor: pointer; flex-shrink: 0;">
                                        <div>
                                            <span style="color: #1e3a8a; font-size: 0.95rem; font-weight: 950; display: block;">📉 ¿DESCONTAR ESTE MONTO DE LA CAJA REGISTRADORA?</span>
                                            <small style="color: #475569; font-size: 0.78rem; font-weight: 700; display: block; margin-top: 2px;">
                                                Al marcar esta casilla, se registrará un egreso / retiro automático de dinero en la caja activa del turno actual.
                                            </small>
                                        </div>
                                    </label>
                                </div>
                                <div id="no-payment-needed" style="text-align: center; font-weight: 900; color: #64748b; font-size: 0.85rem;">
                                    ℹ️ Sin pago inicial hoy — Compra 100% a Crédito / Factura por Pagar (Sin movimiento de caja).
                                </div>
                            ` : `<div style="text-align: center; font-weight: 900; color: #64748b; font-size: 0.85rem;">MODO EDICIÓN: El pago inicial registrado no es modificable.</div>`}
                        </div>

                        <!-- Aviso de deuda -->
                        <div id="purchase-debt-warning" style="display: none; padding: 0.75rem 1.25rem; border-radius: 0.85rem; background: rgba(239, 68, 68, 0.12); border: 2px solid #ef4444; flex-shrink: 0;">
                            <span style="color: #dc2626; font-size: 0.9rem; font-weight: 950;">🚨 SALDO PENDIENTE CON PROVEEDOR (A CRÉDITO): <span id="purchase-debt-amount" style="color: #ffffff; font-weight: 950; background: #ef4444; padding: 3px 8px; border-radius: 0.4rem;">$0</span></span>
                        </div>
                    </div>
                    
                    <!-- Panel de Widgets Colapsables -->
                    <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 0.5rem; width: 100%;">
                        <!-- Widget 1: Margen Promedio de la Factura -->
                        <details style="background: #ffffff; border: 2px solid #e2e8f0; border-radius: 0.75rem; padding: 0.75rem 1rem;" open>
                            <summary style="font-weight: 950; color: #1e293b; cursor: pointer; font-size: 0.9rem; text-transform: uppercase; outline: none; list-style: none;">📈 Rentabilidad Promedio de esta Compra</summary>
                            <div style="padding-top: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-size: 0.85rem; color: #64748b; font-weight: 700;">Margen promedio en base a tus precios de venta:</span>
                                <strong id="directAvgMarginBadge" style="font-size: 1.3rem; font-weight: 950; color: #10b981;">0%</strong>
                            </div>
                        </details>

                        <!-- Widget 2: Historial de Deuda con Proveedor -->
                        <details style="background: #ffffff; border: 2px solid #e2e8f0; border-radius: 0.75rem; padding: 0.75rem 1rem;">
                            <summary style="font-weight: 950; color: #1e293b; cursor: pointer; font-size: 0.9rem; text-transform: uppercase; outline: none; list-style: none;">🤝 Deuda Acumulada con Proveedor</summary>
                            <div style="padding-top: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-size: 0.85rem; color: #64748b; font-weight: 700;">Saldo pendiente histórico:</span>
                                <strong id="directSupplierDebtBadge" style="font-size: 1.25rem; font-weight: 950; color: #ef4444;">$0</strong>
                            </div>
                        </details>

                        <!-- Widget 3: Estimador de Venta (Tiempo de Retorno / ROI) -->
                        <details style="background: #ffffff; border: 2px solid #e2e8f0; border-radius: 0.75rem; padding: 0.75rem 1rem;">
                            <summary style="font-weight: 950; color: #1e293b; cursor: pointer; font-size: 0.9rem; text-transform: uppercase; outline: none; list-style: none;">🕒 Estimación de Retorno (ROI)</summary>
                            <div style="padding-top: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-size: 0.85rem; color: #64748b; font-weight: 700;">Tiempo estimado para vender este stock:</span>
                                <strong id="directRoiBadge" style="font-size: 1.15rem; font-weight: 950; color: #3b82f6;">Sin datos suficientes</strong>
                            </div>
                        </details>

                        <!-- Widget 4: Notas Internas de la Compra -->
                        </details>
                    </div>
                </div>

                <!-- BOTONES DE NAVEGACIÓN -->
                <div class="purchase-footer-nav" id="wizard-footer" style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-top: 0.5rem; flex-shrink: 0; padding-top: 0.75rem; border-top: 2px solid #e2e8f0;">
                    <div style="display: flex; gap: 0.5rem;">
                        <button type="button" class="btn btn-secondary" onclick="closeModal()" id="btn-cancel-modal">Cancelar</button>
                        ${!editingPurchase ? `
                            <button type="button" class="btn" id="btn-park" onclick="PurchasesView.parkPurchase()" title="Estacionar compra (Pausar para atender clientes)" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; font-size: 0.9rem;">
                                🅿️ Estacionar
                            </button>
                        ` : ''}
                    </div>
                    <div style="display: flex; gap: 1rem;">
                        <button type="button" class="btn btn-secondary" id="btn-prev" style="display: none;" onclick="PurchasesView.prevStep()">← Anterior</button>
                        <button type="button" class="btn btn-primary" id="btn-next" onclick="PurchasesView.nextStep()">Siguiente →</button>
                        <button type="button" class="btn btn-success" id="btn-save" style="display: none;" onclick="PurchasesView.savePurchase()">
                            ✅ ${editingPurchase ? 'Actualizar Compra' : 'Confirmar y Guardar'}
                        </button>
                    </div>
                </div>
            </form>
        `;

        showModal(content, {
            title: editingPurchase ? '✏️ Editando Compra' : '💼 Nueva Transacción de Compra',
            width: 'min(98vw, 1100px)'
        });

        // Initialize display if editing or draft exists
        if (editingPurchase || (draft && draft.supplierId)) {
            const sid = editingPurchase ? editingPurchase.supplierId : draft.supplierId;
            Supplier.getById(parseInt(sid)).then(s => {
                if (s) document.getElementById('selectedSupplierName').textContent = s.name;
            });
        }

        // Configurar navegación inicial
        this.updateWizardUI();

        // Add Enter key support for the entire purchase form
        const form = document.getElementById('purchaseForm');
        form.addEventListener('keypress', (e) => {
            if (e.key !== 'Enter') return;

            const target = e.target;
            const activeId = document.activeElement ? document.activeElement.id : '';

            // Never advance or submit on Enter when adding products or scanning
            if (activeId === 'addQuantity' || activeId === 'addCost' || activeId === 'addPrice' || activeId === 'productSearchInput') {
                return; // Let their specific listeners handle it
            }

            // Pasos 1, 2, 3: Avanzar al siguiente paso al presionar Enter
            if (PurchasesView.currentStep < 4) {
                e.preventDefault();
                PurchasesView.nextStep();
                return;
            }

            // Paso 4: Finalizar y guardar la compra al presionar Enter
            if (PurchasesView.currentStep === 4) {
                e.preventDefault();
                PurchasesView.savePurchase();
                return;
            }

            // Por defecto, bloquear Enter para evitar cierre accidental del modal
            e.preventDefault();
            e.stopPropagation();
        });

        const searchInput = document.getElementById('productSearchInput');
        const resultsDiv = document.getElementById('purchaseProductSearchResults');

        let searchTimeout;

        // Live search logic
        searchInput.addEventListener('input', async (e) => {
            const term = e.target.value.trim();

            // Barcode auto-detection (8+ digits): cerrar listado y no ejecutar búsqueda por texto
            if (term.length >= 8 && !isNaN(term)) {
                clearTimeout(searchTimeout);
                searchTimeout = null;
                await this.searchAndShowProduct(term);
                searchInput.value = '';
                if (resultsDiv) resultsDiv.style.display = 'none';
                return;
            }

            // No mostrar listado si ya hay un producto en pantalla (formulario Agregar visible)
            const selectionArea = document.getElementById('productSelectionArea');
            if (selectionArea && selectionArea.innerHTML.trim() !== '') {
                resultsDiv.style.display = 'none';
                return;
            }
            // Text search with debounce
            if (term.length >= 3) {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(async () => {
                    if (selectionArea && selectionArea.innerHTML.trim() !== '') return;
                    const products = await Product.search(term);
                    if (products.length > 0) {
                        this.productSelectedIndex = 0; // RESET INDEX ON NEW SEARCH
                        this.renderPurchaseSearchResults(products);
                        resultsDiv.style.display = 'block';
                    } else {
                        resultsDiv.style.display = 'none';
                    }
                }, 300);
            } else {
                resultsDiv.style.display = 'none';
            }
        });

        // Handle Keyboard Navigation (Arrows & Enter)
        this.productSelectedIndex = 0; // Reset index
        searchInput.addEventListener('keydown', async (e) => {
            const resultsDiv = document.getElementById('purchaseProductSearchResults');
            const items = resultsDiv.querySelectorAll('.search-result-item');

            if (resultsDiv.style.display === 'block' && items.length > 0) {
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
                e.stopPropagation();
                if (resultsDiv.style.display !== 'none') {
                    resultsDiv.style.display = 'none';
                }
                searchInput.value = '';
                searchInput.focus();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();

                if (resultsDiv.style.display === 'block' && items.length > 0) {
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
                        resultsDiv.style.display = 'none';
                    }
                }
            }
        });

        // Trigger initial mode adjustment
        setTimeout(() => this.handleDocumentTypeChange(), 50);
    },

    renderPurchaseSearchResults(products) {
        const resultsDiv = document.getElementById('purchaseProductSearchResults');
        if (!resultsDiv) return;

        if (products.length === 0) {
            resultsDiv.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: #64748b; font-weight: 600;">❌ No se encontraron productos</div>';
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

            const rawCost = parseFloat(p.cost) || 0;
            const rawCostNeto = parseFloat(p.costNeto) || 0;
            let displayCost = 0;
            if (this.lastVatMode === 'gross') {
                displayCost = rawCost > 0 ? rawCost : (rawCostNeto > 0 ? Math.round(rawCostNeto * 1.19) : 0);
            } else {
                displayCost = rawCostNeto > 0 ? rawCostNeto : (rawCost > 0 ? (rawCost / 1.19) : 0);
            }

            return `
                <div class="search-result-item ${index === 0 ? 'selected' : ''}" 
                     data-index="${index}"
                     data-product-id="${p.id}"
                     onmousedown="PurchasesView.selectProductFromList(${p.id})">
                    
                    <div class="search-result-info">
                        <div class="search-result-name">${safeHTML(p.name)}</div>
                        <div class="search-result-meta">
                            <span class="search-result-badge">CÓD: ${p.barcode || 'S/N'}</span>
                            <span class="search-result-stock ${stockClass}" style="display: flex; align-items: center; gap: 4px;">
                                ${stockIcon} ${stockStatus}: <strong>${formatStock(p.stock)} ${isWeight ? 'kg' : 'un'}</strong>
                            </span>
                        </div>
                    </div>

                    <div style="display: flex; gap: 1.5rem; align-items: center;">
                        <div class="search-result-price-box" style="text-align: right; border-right: 1px solid rgba(0,0,0,0.1); padding-right: 1.5rem; min-width: 120px;">
                            <div class="search-result-price search-cost-value">${formatCLP(displayCost, true, 2)}</div>
                            <div class="search-result-price-label">Costo ${this.lastVatMode === 'gross' ? 'Bruto' : 'Neto'}</div>
                        </div>
                        <div class="search-result-price-box" style="text-align: right; min-width: 120px;">
                            <div class="search-result-price search-sale-value">${formatCLP(p.price)}</div>
                            <div class="search-result-price-label">P. Venta</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
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
                showNotification('Producto no encontrado', 'warning');
                return;
            }
        }

        const resDiv = document.getElementById('purchaseProductSearchResults');
        if (resDiv) resDiv.style.display = 'none';
        this.showAddProductForm(product);
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
        
        const lastCostNeto = lastPurchaseCost?.costNeto || null;
        const lastCostGross = lastPurchaseCost?.cost || null;
        const lastCostDate = lastPurchaseCost?.date || null;

        // Buscar si ya está en el carro para precargar sus impuestos especiales
        const existingItem = this.purchaseItems.find(item => item.productId === product.id);
        this.tempProductTaxes = existingItem ? [...(existingItem.additionalTaxesConfig || [])] : [];
        
        selectionArea.innerHTML = `
            <div class="purchase-add-card" style="background: #ffffff; border: 4px solid #3b82f6; border-radius: 1.5rem; padding: clamp(1rem, 5vw, 2.5rem); margin-top: 1.5rem; position: relative; box-shadow: 0 15px 35px rgba(0,0,0,0.25);">
                <style>
                    .add-product-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 2rem; margin-bottom: 1.5rem; }
                    @media (max-width: 800px) {
                        .add-product-grid { grid-template-columns: 1fr; gap: 1rem; }
                        .purchase-add-card h4 { font-size: 1.3rem !important; }
                    }
                </style>
                <div style="position: absolute; top: -15px; right: 2rem; background: #3b82f6; color: #fff; padding: 0.5rem 1.5rem; border-radius: 2rem; font-size: 0.85rem; font-weight: 900; box-shadow: 0 5px 15px rgba(59,130,246,0.4); border: 2px solid #fff;">
                    ${product.type === 'weight' ? 'ESCALABLE (PESO / GRANEL)' : 'UNITARIO (UNIDAD)'}
                </div>
                
                <h4 style="margin: 0 0 2rem 0; font-size: 1.8rem; color: #1e293b; font-weight: 950; text-transform: uppercase;">
                    ${product.name}
                </h4>
                
                ${lastCostNeto !== null ? `
                <div style="background: #fef3c7; border: 2px solid #f59e0b; border-radius: 0.75rem; padding: 1rem; margin-bottom: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
                        <span style="color: #92400e; font-weight: 950; font-size: 0.95rem; text-transform: uppercase;">📊 Última Compra:</span>
                        <div style="text-align: right;">
                            <div style="color: #92400e; font-weight: 950; font-size: 1.1rem;">
                                Neto: $${lastCostNeto.toFixed(2)} | Bruto: $${lastCostGross.toFixed(2)}
                            </div>
                            ${lastCostDate ? `<div style="color: #92400e; font-size: 0.8rem; font-weight: 700;">${new Date(lastCostDate).toLocaleDateString()}</div>` : ''}
                        </div>
                    </div>
                </div>
                ` : ''}
                
                <div class="add-product-grid">
                    <div class="form-group">
                        <label style="display: block; font-weight: 950; color: #1e293b; text-transform: uppercase; font-size: 0.85rem; margin-bottom: 0.8rem; letter-spacing: 1px;">🛒 Cantidad a Comprar</label>
                        <div style="display: flex; gap: 0.5rem; width: 100%;">
                            <input type="number" 
                                   id="addQuantity" 
                                   step="any"
                                   class="form-control" 
                                   placeholder="${product.type === 'weight' ? '0.000' : '1'}"
                                   onfocus="this.select()"
                                   style="height: 70px; font-size: 2rem; font-weight: 950; border-radius: 1rem; text-align: center; border: 3px solid #cbd5e1; background: #f8fafc; color: #000; width: 100%;">
                        </div>
                    </div>
                    
                    <div class="form-group" style="${this.lastVatMode === 'gross' ? 'display:none;' : ''}">
                        <label id="costInputLabel" style="display: block; font-weight: 950; color: #1e293b; text-transform: uppercase; font-size: 0.85rem; margin-bottom: 0.8rem; letter-spacing: 1px;">
                            ${isBoleta ? '💰 Costo Real Neto' : '💰 Costo Neto'}
                        </label>
                        <div style="display: flex; gap: 0.5rem; width: 100%;">
                            <input type="number" 
                                   id="addCost" 
                                   step="any"
                                   class="form-control" 
                                   value="${lastCostNeto !== null ? lastCostNeto : ((product.costNeto !== undefined && product.costNeto !== null && product.costNeto !== 0) ? product.costNeto : ((product.cost || 0) / 1.19).toFixed(2))}"
                                   placeholder="${lastCostNeto !== null ? `Último: ${lastCostNeto.toFixed(2)}` : ''}"
                                   onfocus="this.select()"
                                   style="height: 70px; font-size: 2rem; font-weight: 950; border-radius: 1rem; text-align: center; border: 3px solid #10b981; background: #f8fafc; color: #000; flex: 1;">
                            <button type="button" 
                                    class="btn btn-secondary" 
                                    onclick="PurchasesView.openCalculatorModal('addCost')" 
                                    style="width: 70px; height: 70px; font-size: 1.8rem; border-radius: 1rem; display: flex; align-items: center; justify-content: center; background: #e2e8f0; border: 3px solid #cbd5e1; color: #1e293b;" 
                                    title="Abrir Calculadora">🧮</button>
                        </div>
                        <div id="costDiffIndicatorNet" style="font-size: 0.85rem; font-weight: 900; margin-top: 0.4rem; display: none;"></div>
                    </div>

                    <div class="form-group" style="${this.lastVatMode === 'net' ? 'display:none;' : ''}">
                        <label id="grossCostInputLabel" style="display: block; font-weight: 950; color: #1e293b; text-transform: uppercase; font-size: 0.85rem; margin-bottom: 0.8rem; letter-spacing: 1px;">
                            💰 Costo Bruto
                        </label>
                        <div style="display: flex; gap: 0.5rem; width: 100%;">
                            <input type="number" 
                                   id="addGrossCost" 
                                   step="any"
                                   class="form-control" 
                                   value="${lastCostGross !== null ? lastCostGross : ((product.cost !== undefined && product.cost !== null && product.cost !== 0) ? product.cost : parseFloat((product.costNeto || 0) * 1.19).toFixed(2))}"
                                   placeholder="${lastCostGross !== null ? `Último: ${lastCostGross.toFixed(2)}` : ''}"
                                   onfocus="this.select()"
                                   style="height: 70px; font-size: 2rem; font-weight: 950; border-radius: 1rem; text-align: center; border: 3px solid #10b981; background: #f8fafc; color: #000; flex: 1;">
                            <button type="button" 
                                    class="btn btn-secondary" 
                                    onclick="PurchasesView.openCalculatorModal('addGrossCost')" 
                                    style="width: 70px; height: 70px; font-size: 1.8rem; border-radius: 1rem; display: flex; align-items: center; justify-content: center; background: #e2e8f0; border: 3px solid #cbd5e1; color: #1e293b;" 
                                    title="Abrir Calculadora">🧮</button>
                        </div>
                        <div id="costDiffIndicatorGross" style="font-size: 0.85rem; font-weight: 900; margin-top: 0.4rem; display: none;"></div>
                    </div>
                    
                    <div class="form-group">
                        <label style="display: block; font-weight: 950; color: #1e293b; text-transform: uppercase; font-size: 0.85rem; margin-bottom: 0.8rem; letter-spacing: 1px;">🏷️ Precio Venta</label>
                        <input type="number" 
                               id="addPrice" 
                               step="any"
                               class="form-control" 
                               value="${product.price || 0}"
                               onfocus="this.select()"
                               style="height: 70px; font-size: 2rem; font-weight: 950; border-radius: 1rem; text-align: center; border: 3px solid #6366f1; background: #f8fafc; color: #000;">
                    </div>
                </div>

                <div id="pricePreview" style="background: #f1f5f9; padding: 1.5rem 2.5rem; border-radius: 1.25rem; margin-bottom: 2rem; border: 3px solid #e2e8f0; display: flex; flex-direction: column; gap: 0.75rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #475569; font-weight: 950; font-size: 1rem; text-transform: uppercase;">🛒 Neto de la Línea:</span>
                        <strong id="previewSubtotal" style="font-size: 1.8rem; color: #0f172a;">$0</strong>
                    </div>
                    ${!isBoleta ? `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #475569; font-weight: 950; font-size: 1rem; text-transform: uppercase;">📈 IVA de la Línea (19%):</span>
                        <strong id="previewIva" style="font-size: 1.6rem; color: #0f172a;">$0</strong>
                    </div>
                    ` : ''}
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #475569; font-weight: 950; font-size: 1rem; text-transform: uppercase;">💰 Bruto de la Línea:</span>
                        <strong id="previewBrutoTotal" style="font-size: 1.8rem; color: #0f172a;">$0</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 2px solid #cbd5e1; padding-top: 0.5rem;">
                        <span style="color: #475569; font-weight: 950; font-size: 1rem; text-transform: uppercase;">Margen Real (%) :</span>
                        <strong id="previewMargin" style="font-size: 1.8rem; font-weight: 950;">0%</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #475569; font-weight: 950; font-size: 1rem; text-transform: uppercase;">Ganancia por Unidad:</span>
                        <strong id="previewUnitProfit" style="font-size: 1.6rem; color: #10b981;">$0</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #475569; font-weight: 950; font-size: 1rem; text-transform: uppercase;">Ganancia Total Esperada:</span>
                        <strong id="previewProfit" style="font-size: 1.8rem; color: #10b981;">$0</strong>
                    </div>
                </div>
                
                <div style="display: flex; gap: 1.5rem;">
                    <button type="button" class="btn btn-xl btn-primary" onclick="PurchasesView.addProductToPurchase(${product.id})" style="flex: 2; height: 75px; font-weight: 950; font-size: 1.3rem; border-radius: 1.25rem; border: 3px solid #fff; box-shadow: 0 10px 20px rgba(59,130,246,0.3);">
                        ✅ AGREGAR AL LISTADO DE COMPRA
                    </button>
                    <button type="button" class="btn btn-xl btn-secondary" onclick="PurchasesView.cancelAddProduct()" style="flex: 1; height: 75px; font-weight: 950; border-radius: 1.25rem; background: #e2e8f0; color: #475569; border: 3px solid #cbd5e1;">
                        ❌ DESCARCARTAR
                    </button>
                </div>
            </div>
        `;

        const quantityInput = document.getElementById('addQuantity');
        const costInput = document.getElementById('addCost');
        const priceInput = document.getElementById('addPrice');
        const grossCostInput = document.getElementById('addGrossCost');

        // Renderizar los badges iniciales
        this.renderFormTaxesBadges();

        const updatePreview = (e) => {
            const quantity = parseFloat(quantityInput.value) || 0;
            let cost = parseFloat(costInput.value) || 0;
            let grossCost = parseFloat(grossCostInput?.value) || 0;
            const price = parseFloat(priceInput.value) || 0;

            if (e && e.target.id === 'addCost') {
                grossCost = parseFloat((cost * 1.19).toFixed(2));
                if (grossCostInput) grossCostInput.value = grossCost;
            } else if (e && e.target.id === 'addGrossCost') {
                cost = parseFloat((grossCost / 1.19).toFixed(2));
                costInput.value = cost.toFixed(2);
            } else {
                if (this.lastVatMode === 'gross') {
                    cost = parseFloat((grossCost / 1.19).toFixed(2));
                    costInput.value = cost.toFixed(2);
                } else {
                    grossCost = parseFloat((cost * 1.19).toFixed(2));
                    if (grossCostInput) grossCostInput.value = grossCost;
                }
            }

            // Sumar impuestos especiales a nivel de preview
            let extraTaxesSum = 0;
            if (this.tempProductTaxes && this.tempProductTaxes.length > 0) {
                this.tempProductTaxes.forEach(tax => {
                    if (typeof tax.amount === 'number' && tax.amount > 0) {
                        extraTaxesSum += tax.amount;
                    } else {
                        extraTaxesSum += Math.round((quantity * cost) * (tax.rate / 100));
                    }
                });
            }

            const lineNet = parseFloat((quantity * cost).toFixed(2));
            const lineIva = isBoleta ? 0 : Math.round(lineNet * 0.19);
            const lineBrutoTotal = lineNet + lineIva + extraTaxesSum;

            // Costo real unitario de adquisición (con todos los impuestos incluidos)
            const unitGrossCost = quantity > 0 ? (lineBrutoTotal / quantity) : (grossCost + (extraTaxesSum / (quantity || 1)));
            const unitProfit = price - unitGrossCost;
            const lineProfit = unitProfit * quantity;
            const margin = unitGrossCost > 0 ? (unitProfit / unitGrossCost * 100) : 0;

            // Actualizar textos en la visualización inmediata
            document.getElementById('previewSubtotal').textContent = formatCLP(lineNet);
            if (document.getElementById('previewIva')) {
                document.getElementById('previewIva').textContent = formatCLP(lineIva);
            }
            document.getElementById('previewBrutoTotal').textContent = formatCLP(lineBrutoTotal);

            const marginEl = document.getElementById('previewMargin');
            marginEl.innerHTML = `${margin.toFixed(1)}%`;
            marginEl.style.color = margin > 0 ? '#10b981' : (margin < 0 ? '#ef4444' : '#64748b');

            const unitProfitEl = document.getElementById('previewUnitProfit');
            unitProfitEl.textContent = formatCLP(unitProfit);
            unitProfitEl.style.color = unitProfit > 0 ? '#10b981' : (unitProfit < 0 ? '#ef4444' : '#64748b');

            const profitEl = document.getElementById('previewProfit');
            profitEl.textContent = formatCLP(lineProfit);
            profitEl.style.color = lineProfit > 0 ? '#10b981' : (lineProfit < 0 ? '#ef4444' : '#64748b');

            // Comparación en vivo de costo contra última compra
            const diffNetEl = document.getElementById('costDiffIndicatorNet');
            const diffGrossEl = document.getElementById('costDiffIndicatorGross');

            const updateDiffEl = (el, lastCost, currentCost) => {
                if (!el) return;
                if (lastCost !== null && lastCost > 0 && currentCost > 0) {
                    const diff = currentCost - lastCost;
                    if (Math.abs(diff) >= 0.01) {
                        if (diff > 0) {
                            el.innerHTML = `<span style="color: #10b981; font-weight: 900;">🟢 SUBIÓ COSTO: +$${diff.toFixed(2)} (Último: $${lastCost.toFixed(2)})</span>`;
                        } else {
                            el.innerHTML = `<span style="color: #ef4444; font-weight: 900;">🔴 BAJÓ COSTO: -$${Math.abs(diff).toFixed(2)} (Último: $${lastCost.toFixed(2)})</span>`;
                        }
                    } else {
                        el.innerHTML = `<span style="color: #64748b; font-weight: 900;">⚖️ MISMO COSTO (Último: $${lastCost.toFixed(2)})</span>`;
                    }
                    el.style.display = 'block';
                } else {
                    el.style.display = 'none';
                }
            };

            updateDiffEl(diffNetEl, lastCostNeto, cost);
            updateDiffEl(diffGrossEl, lastCostGross, grossCost);
        };

        quantityInput.addEventListener('input', updatePreview);
        costInput.addEventListener('input', updatePreview);
        if (grossCostInput) grossCostInput.addEventListener('input', updatePreview);
        priceInput.addEventListener('input', updatePreview);

        quantityInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const next = this.lastVatMode === 'net' ? costInput : grossCostInput;
                next.focus();
                next.select();
            }
        });

        costInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                priceInput.focus();
                priceInput.select();
            }
        });

        if (grossCostInput) {
            grossCostInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    priceInput.focus();
                    priceInput.select();
                }
            });
        }

        priceInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                PurchasesView.addProductToPurchase(product.id);
            }
        });

        updatePreview();
        setTimeout(() => { quantityInput.focus(); quantityInput.select(); }, 150);
    },

    async addProductToPurchase(productId) {
        const searchInput = document.getElementById('productSearchInput');
        const quantity = parseFloat(document.getElementById('addQuantity').value);
        const netCostInput = parseFloat(document.getElementById('addCost').value); // NET (synced)
        const grossCostInput = parseFloat(document.getElementById('addGrossCost')?.value); // BRUTO (optional)
        const price = parseFloat(document.getElementById('addPrice').value);

        if (isNaN(quantity) || quantity <= 0) { showNotification('Ingresa una cantidad válida', 'warning'); return; }
        if (isNaN(netCostInput) || netCostInput < 0) { showNotification('Ingresa un precio de costo válido', 'warning'); return; }

        const product = await Product.getById(productId);
        const existingItem = this.purchaseItems.find(item => item.productId === product.id);

        // Store what user typed + keep NET internally
        let enteredCost;
        let enteredCostMode;
        let cost;
        if (this.lastVatMode === 'gross') {
            enteredCostMode = 'gross';
            enteredCost = isNaN(grossCostInput) ? parseFloat((netCostInput * 1.19).toFixed(2)) : grossCostInput;
            cost = parseFloat((enteredCost / 1.19).toFixed(2));
        } else {
            enteredCostMode = 'net';
            enteredCost = parseFloat(netCostInput.toFixed(2));
            cost = parseFloat(enteredCost.toFixed(2));
        }

        // ⚠️ ALERTA INTELIGENTE DE COSTO IRREAL O EXAGERADO
        const prevCostNet = (product.costNeto !== undefined && product.costNeto !== null && product.costNeto > 0)
            ? product.costNeto
            : (product.cost > 0 ? product.cost / 1.19 : 0);
            
        if (prevCostNet > 0) {
            const ratio = cost / prevCostNet;
            if (ratio >= 2.0 || ratio <= 0.5) {
                const percentChange = Math.round((ratio - 1) * 100);
                const isHigher = percentChange > 0;
                const prevCostDisplay = this.lastVatMode === 'gross' ? (prevCostNet * 1.19).toFixed(2) : prevCostNet.toFixed(2);
                const newCostDisplay = this.lastVatMode === 'gross' ? (cost * 1.19).toFixed(2) : cost.toFixed(2);
                const vatLabel = this.lastVatMode === 'gross' ? 'Bruto' : 'Neto';
                
                const confirmed = confirm(
                    `⚠️ ALERTA DE COSTO IRREAL O EXAGERADO\n\n` +
                    `El costo ${vatLabel} ingresado ($${newCostDisplay}) es ${isHigher ? 'un ' + percentChange + '% MAYOR' : 'un ' + Math.abs(percentChange) + '% MENOR'} que el costo anterior ($${prevCostDisplay}).\n\n` +
                    `¿El costo de este producto es correcto o deseas corregirlo? Presiona ACEPTAR para confirmar o CANCELAR para volver.`
                );
                
                if (!confirmed) {
                    return; // Cancela el ingreso para que el usuario pueda corregir el valor
                }
            }
        }

        if (existingItem) {
            existingItem.quantity = quantity; // Overwrite to prevent infinite accumulation when editing/clicking again
            existingItem.cost = cost;
            existingItem.enteredCost = enteredCost;
            existingItem.enteredCostMode = enteredCostMode;
            existingItem.price = price;
            existingItem.total = parseFloat((existingItem.quantity * cost).toFixed(2));
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
                total: parseFloat((quantity * cost).toFixed(2)),
                type: product.type,
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

        let ivaSum = 0;
        let grandTotal = 0;

        if (docType.includes('factura')) {
            ivaSum = Math.round(netSubtotal * 0.19);
            grandTotal = netSubtotal + ivaSum + extraTaxesSum;
        } else { // boleta o cualquier otro
            ivaSum = 0;
            grandTotal = netSubtotal + extraTaxesSum;
        }

        // Actualizar elementos visuales en Paso 2
        const netoSpan = document.getElementById('step2Neto');
        const ivaSpan = document.getElementById('step2Iva');
        const ivaGroup = document.getElementById('step2IvaGroup');
        const extraSpan = document.getElementById('step2ExtraTax');
        const extraGroup = document.getElementById('step2ExtraTaxGroup');
        const totalSpan = document.getElementById('purchaseTotal');

        if (netoSpan) netoSpan.textContent = formatCLP(netSubtotal);
        if (ivaSpan) ivaSpan.textContent = formatCLP(ivaSum);
        if (ivaGroup) ivaGroup.style.display = isBoleta ? 'none' : 'block';

        if (extraSpan && extraGroup) {
            extraSpan.textContent = formatCLP(extraTaxesSum);
            extraGroup.style.display = extraTaxesSum > 0 ? 'block' : 'none';
        }

        if (totalSpan) totalSpan.textContent = formatCLP(grandTotal);

        // Actualizar resumen en Paso 3 / Cierre
        const paidInput = document.getElementById('purchasePaidAmount');
        if (paidInput) {
            this.handlePaidAmountChange(paidInput.value);
        }
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
        return `
            <div class="table-responsive-wrapper">
                <table style="width: 100%; border-collapse: separate; border-spacing: 0 8px; margin-top: -5px;">
                <thead>
                    <tr style="background: #1e293b; box-shadow: 0 4px 15px rgba(0,0,0,0.15);">
                        <th style="background: #1e293b !important; color: #ffffff !important; padding: 0.85rem 1rem; text-align: left; font-weight: 900; font-size: 0.85rem; text-transform: uppercase; border-radius: 0.75rem 0 0 0.75rem; letter-spacing: 1px; border-bottom: 3px solid #3b82f6;">Producto</th>
                        <th style="background: #1e293b !important; color: #ffffff !important; padding: 0.85rem 6px; text-align: center; font-weight: 900; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; width: 85px; border-bottom: 3px solid #3b82f6;">Cant.</th>
                        <th style="background: #1e293b !important; color: #ffffff !important; padding: 0.85rem 6px; text-align: center; font-weight: 900; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; width: 120px; border-bottom: 3px solid #3b82f6;">Costo Neto</th>
                        <th style="background: #1e293b !important; color: #ffffff !important; padding: 0.85rem 6px; text-align: center; font-weight: 900; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; width: 95px; border-bottom: 3px solid #3b82f6;">IVA (19%)</th>
                        <th style="background: #1e293b !important; color: #ffffff !important; padding: 0.85rem 6px; text-align: center; font-weight: 900; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; width: 120px; border-bottom: 3px solid #3b82f6;">Costo Bruto</th>
                        <th style="background: #1e293b !important; color: #ffffff !important; padding: 0.85rem 6px; text-align: center; font-weight: 900; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; width: 110px; border-bottom: 3px solid #3b82f6;">P. Venta</th>
                        <th style="background: #1e293b !important; color: #ffffff !important; padding: 0.85rem 1rem; text-align: right; font-weight: 900; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; width: 130px; border-bottom: 3px solid #3b82f6;">Total Neto</th>
                        <th style="background: #1e293b !important; color: #ffffff !important; padding: 0.85rem; text-align: center; border-radius: 0 0.75rem 0.75rem 0; border-bottom: 3px solid #3b82f6; width: 50px;"></th>
                    </tr>
                </thead>
                <tbody style="background: transparent;">
                    ${this.purchaseItems.length === 0 ? `
                        <tr>
                            <td colspan="8" style="padding: 4rem 2rem; text-align: center; color: #64748b; font-weight: 900; font-size: 1.2rem; background: #ffffff; border-radius: 1.25rem; border: 3px dashed #cbd5e1; box-shadow: inset 0 2px 10px rgba(0,0,0,0.05);">
                                <div style="font-size: 3.5rem; margin-bottom: 1rem; filter: grayscale(1); opacity: 0.5;">🛒</div>
                                EL CARRO ESTÁ VACÍO.<br><span style="font-weight: 500; font-size: 0.95rem; opacity: 0.7;">Busca productos en el buscador superior para comenzar.</span>
                            </td>
                        </tr>
                    ` : this.purchaseItems.map((item, index) => {
            const displayNet = Number((item.cost || 0).toFixed(2));
            const displayIva = Number((item.cost * 0.19).toFixed(2));
            const displayGross = Number((item.cost * 1.19).toFixed(2));
            const lineNetTotal = item.total || 0;
            const inputStyle = "height: 44px; border: 2px solid #cbd5e1; background: #ffffff; color: #000; font-size: 1.05rem; font-weight: 900; border-radius: 0.65rem; text-align: center; width: 100%; transition: all 0.2s; padding: 0 0.4rem; box-shadow: 0 2px 4px rgba(0,0,0,0.05);";

            // Trend Indicator calculations
            let trendNetHtml = '';
            let trendGrossHtml = '';
            
            if (typeof item.lastCostNeto === 'number' && item.lastCostNeto > 0) {
                const diff = item.cost - item.lastCostNeto;
                if (Math.abs(diff) >= 0.01) {
                    if (diff > 0) {
                        trendNetHtml = `<div style="color: #10b981; font-size: 0.7rem; font-weight: 900; margin-top: 2px; text-align: center; line-height: 1.1;">🟢 +$${diff.toFixed(1)}</div>`;
                    } else {
                        trendNetHtml = `<div style="color: #ef4444; font-size: 0.7rem; font-weight: 900; margin-top: 2px; text-align: center; line-height: 1.1;">🔴 -$${Math.abs(diff).toFixed(1)}</div>`;
                    }
                }
            }

            const itemGross = item.cost * 1.19;
            if (typeof item.lastCostGross === 'number' && item.lastCostGross > 0) {
                const diff = itemGross - item.lastCostGross;
                if (Math.abs(diff) >= 0.01) {
                    if (diff > 0) {
                        trendGrossHtml = `<div style="color: #10b981; font-size: 0.7rem; font-weight: 900; margin-top: 2px; text-align: center; line-height: 1.1;">🟢 +$${diff.toFixed(1)}</div>`;
                    } else {
                        trendGrossHtml = `<div style="color: #ef4444; font-size: 0.7rem; font-weight: 900; margin-top: 2px; text-align: center; line-height: 1.1;">🔴 -$${Math.abs(diff).toFixed(1)}</div>`;
                    }
                }
            }

            const isGrossMode = (this.lastVatMode === 'gross');
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
                            <td style="padding: 0.4rem 4px; width: 85px;">
                                <input type="number" step="any" value="${item.quantity}" class="form-control" onfocus="this.select()" style="${inputStyle}" onchange="PurchasesView.updateItemQuantity(${index}, this.value)">
                            </td>
                            <td style="padding: 0.4rem 4px; width: 120px;">
                                <input type="number" step="any" value="${displayNet}" class="form-control" onfocus="this.select()" style="${inputStyle} text-align: right;" onchange="PurchasesView.updateItemCost(${index}, this.value)">
                                ${costNetTrend}
                            </td>
                            <td style="padding: 0.4rem 4px; width: 95px;">
                                <input type="number" step="any" value="${displayIva}" class="form-control" disabled style="${inputStyle} text-align: right; background: #f8fafc; border-color: #e2e8f0; color: #64748b;">
                            </td>
                            <td style="padding: 0.4rem 4px; width: 120px;">
                                <input type="number" step="any" value="${displayGross}" class="form-control" onfocus="this.select()" style="${inputStyle} text-align: right;" onchange="PurchasesView.updateItemGrossCost(${index}, this.value)">
                                ${costGrossTrend}
                            </td>
                            <td style="padding: 0.4rem 4px; width: 110px;">
                                <input type="number" step="any" value="${item.price}" class="form-control" onfocus="this.select()" style="${inputStyle} text-align: right; border-color: #6366f1; color: #4338ca;" onchange="PurchasesView.updateItemPrice(${index}, this.value)">
                            </td>
                            <td style="padding: 0.6rem 1rem; text-align: right; font-weight: 950; color: #0f172a; font-size: 1.2rem; min-width: 130px; background: rgba(79, 70, 229, 0.03); border-left: 1px solid #f1f5f9;">
                                ${formatCLP(lineNetTotal)}
                            </td>
                            <td style="padding: 0.6rem; text-align: center; border-radius: 0 1rem 1rem 0; width: 50px;">
                                <button type="button" class="btn btn-danger" onclick="PurchasesView.removeItem(${index})" style="height: 42px; width: 42px; padding: 0; border-radius: 0.65rem; border: 2px solid #fff; font-weight: 950; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.3);" title="Eliminar">🗑️</button>
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
                    item.cost = parseFloat((gross / 1.19).toFixed(2));
                    item.enteredCost = gross;
                    item.enteredCostMode = 'gross';
                } else {
                    item.cost = net;
                    item.enteredCost = net;
                    item.enteredCostMode = 'net';
                }
                item.total = parseFloat((qty * item.cost).toFixed(2));
            }
        });
    },

    updateItemQuantity(index, quantity) {
        const q = parseFloat(quantity) || 0;
        this.purchaseItems[index].quantity = q;
        this.purchaseItems[index].total = parseFloat((q * this.purchaseItems[index].cost).toFixed(2));
        this.updatePurchaseItems();
        this.autosaveDraft();
    },

    updateItemCost(index, value) {
        let val = parseFloat(value) || 0;
        // User edited NET cost
        this.purchaseItems[index].enteredCost = val;
        this.purchaseItems[index].enteredCostMode = 'net';
        this.purchaseItems[index].cost = val;
        this.purchaseItems[index].total = parseFloat((this.purchaseItems[index].quantity * (this.purchaseItems[index].cost || 0)).toFixed(2));
        this.updatePurchaseItems();
        this.autosaveDraft();
    },

    updateItemGrossCost(index, value) {
        let val = parseFloat(value) || 0;
        // User edited BRUTO cost -> store as entered, keep NET internally
        this.purchaseItems[index].enteredCost = val;
        this.purchaseItems[index].enteredCostMode = 'gross';
        const netCost = parseFloat((val / 1.19).toFixed(2));
        this.purchaseItems[index].cost = netCost;
        this.purchaseItems[index].total = parseFloat((this.purchaseItems[index].quantity * (this.purchaseItems[index].cost || 0)).toFixed(2));
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
        if (this.currentStep === 2) {
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
            return;
        }

        const confirmSave = await showConfirm(
            "¿ESTÁS SEGURO QUE LA COMPRA ESTÁ BIEN HECHA?",
            "Revisa los montos finales, el IVA y la deuda antes de confirmar. Esta acción registrará el inventario y movimientos de caja.",
            "SÍ, GUARDAR TODO",
            "REVISAR NUEVAMENTE"
        );

        if (!confirmSave) return;

        const supplierId = parseInt(formData.get('supplierId'));
        if (!supplierId || isNaN(supplierId)) {
            showNotification('Debes seleccionar un proveedor antes de guardar', 'error');
            this.goToStep(1);
            return;
        }

        let invoiceNumber = (formData.get('invoiceNumber') || '').trim();
        const invoiceDate = formData.get('invoiceDate');
        const documentType = formData.get('documentType');

        const vatMode = documentType.includes('factura') ? (documentType === 'factura_bruto' ? 'gross' : 'net') : 'net';
        const isFactura = documentType.includes('factura');

        if (isFactura && !invoiceNumber) {
            showNotification('El N° de Factura es obligatorio', 'warning');
            this.goToStep(1);
            return;
        }
        if (!invoiceDate) {
            showNotification('La fecha de documento es obligatoria', 'warning');
            this.goToStep(1);
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
            total: grandTotal,
            paidAmount: parseFloat(formData.get('paidAmount')) || 0,
            dueDate: formData.get('dueDate') || null,
            status: 'pending',
            deductFromCashRegister: formData.get('deductFromCashRegister') === 'true'
        };

        console.log('📦 DATOS DE COMPRA A ENVIAR:', data);

        if ((data.total - data.paidAmount) < 1.0) {
            data.status = 'paid';
            data.paidAmount = data.total;
        }

        try {
            console.log('🚀 Llamando a SupplierController.savePurchase...');
            const result = await SupplierController.savePurchase(data);
            console.log('✅ Resultado de savePurchase:', result);

            this.clearDraft();
            this.allPurchases = [];
            this.offset = 0;
            this.hasMore = true;

            closeModal();
            showNotification(purchaseId ? 'Compra actualizada exitosamente' : 'Compra guardada', 'success');
            await this.refresh();
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
            <div style="margin-top: 1.5rem;">
                <h4 style="margin-bottom: 0.5rem;">Pagos registrados (${payments.length})</h4>
                <div class="table-container" style="max-height: 200px; overflow-y: auto;">
                    <table style="margin-bottom: 0;">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Monto</th>
                                <th>Método</th>
                                <th>Referencia</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${payments.map(p => `
                                <tr>
                                    <td>${formatDate(p.date)}</td>
                                    <td><strong>${formatCLP(p.amount)}</strong></td>
                                    <td>${methodLabel(p.method)}</td>
                                    <td>${p.reference || '-'}</td>
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

        const content = `
            <div style="margin-bottom: 1.5rem;">
                <p><strong>Proveedor:</strong> ${supplier ? supplier.name : 'N/A'}</p>
                <p><strong>Fecha de Compra original:</strong> ${formatDateTime(purchase.date)}</p>
                ${purchase.invoiceNumber ? `<p><strong>N° Factura:</strong> ${purchase.invoiceNumber}</p>` : ''}
                ${purchase.invoiceDate ? `<p><strong>Fecha Factura:</strong> ${formatDate(purchase.invoiceDate)}</p>` : ''}
                <p><strong>Estado:</strong> 
                    <span class="badge ${balance <= 0 ? 'badge-success' : 'badge-warning'}">
                        ${balance <= 0 ? 'Pagado' : 'Pendiente'}
                    </span>
                </p>
            </div>
            
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th>Cantidad</th>
                            <th>Precio Neto</th>
                            <th>Precio Venta</th>
                            <th>Subtotal Neto</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${purchase.items.map(item => `
                            <tr>
                                <td>
                                    <strong>${safeHTML(item.name)}</strong>
                                    ${item.additionalTaxesConfig && item.additionalTaxesConfig.length > 0 ? `
                                        <div style="font-size: 0.75rem; color: #b45309; font-weight: 800; margin-top: 3px;">
                                            ➕ ${item.additionalTaxesConfig.map(t => `${t.name} (${t.rate}%): +$${Math.round(t.amount || (item.total * t.rate / 100)).toLocaleString('es-CL')}`).join(', ')}
                                        </div>
                                    ` : ''}
                                </td>
                                <td>${item.quantity}</td>
                                <td>${formatCLP(item.cost)}</td>
                                <td>${item.price ? formatCLP(item.price) : '-'}</td>
                                <td><strong>${formatCLP(item.total)}</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 2px solid var(--border);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span>Total Neto:</span>
                    <strong>${formatCLP(purchase.subtotal || 0)}</strong>
                </div>
                ${extraTaxesSum > 0 ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; color: #b45309; font-weight: 700;">
                    <span>Impuestos Especiales (IABA / Harina / Licores):</span>
                    <strong>+${formatCLP(extraTaxesSum)}</strong>
                </div>
                ` : ''}
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span>IVA (19%):</span>
                    <strong>${formatCLP(purchase.ivaAmount || 0)}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 1.1rem; border-top: 1px dashed #cbd5e1; padding-top: 0.4rem;">
                    <span>Total Factura:</span>
                    <strong>${formatCLP(purchase.total)}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span>Pagado:</span>
                    <strong>${formatCLP(effectivePaid)}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 1.25rem; color: ${balance > 0 ? 'var(--danger)' : 'var(--success)'};">
                    <strong>Saldo Pendiente:</strong>
                    <strong>${formatCLP(balance)}</strong>
                </div>
            </div>

            ${paymentsHtml}
        `;

        const footer = balance > 0 ? `
            <button class="btn btn-success" onclick="closeModal(); PurchasesView.showPaymentForm(${id})">
                💰 Registrar Pago
            </button>
            <button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>
        ` : '<button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>';

        showModal(content, { title: 'Detalle de Compra', footer, width: '700px' });
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

            <div style="background: var(--surface); border: 2px solid var(--border); border-radius: 1rem; padding: 1.25rem; margin-bottom: 1.5rem;">
                <div style="text-align: center; margin-bottom: 1.25rem;">
                    <div style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Proveedor</div>
                    <div style="font-size: 1.2rem; font-weight: 900; color: var(--text);">${supplier ? supplier.name : 'N/A'}</div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div style="background: var(--light); padding: 0.85rem; border-radius: 0.75rem; text-align: center;">
                        <div style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.25rem;">NUEVO TOTAL COMPRA</div>
                        <div style="font-size: 1.25rem; font-weight: 900; color: var(--text); line-height: 1;">${formatCLP(purchase.total)}</div>
                    </div>
                    <div style="background: var(--light); padding: 0.85rem; border-radius: 0.75rem; text-align: center;">
                        <div style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.25rem;">YA ENTREGADO</div>
                        <div style="font-size: 1.25rem; font-weight: 900; color: var(--text); line-height: 1;">${formatCLP(effectivePaid)}</div>
                    </div>
                </div>

                <div style="background: var(--danger-bg); border: 2px dashed var(--danger); padding: 1rem; border-radius: 0.75rem; text-align: center;">
                    <div style="font-size: 0.75rem; font-weight: 800; color: var(--danger); text-transform: uppercase; margin-bottom: 0.25rem;">DIFERENCIA A PAGAR HOY</div>
                    <div style="font-size: 2.25rem; font-weight: 950; color: var(--danger); line-height: 1;">${formatCLP(balance)}</div>
                </div>
            </div>

            ${paymentHistoryHtml}
            
            <form id="paymentForm">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group">
                        <label style="font-size: 0.8rem; font-weight: 800;">Monto a Pagar (CLP) *</label>
                        <input type="number" 
                               id="paymentAmount" 
                               class="form-control" 
                               style="font-size: 1.25rem; font-weight: 900; height: 3rem;"
                               value="${balance}" 
                               min="1" 
                               max="${balance}" 
                               required>
                    </div>
                    <div class="form-group">
                        <label style="font-size: 0.8rem; font-weight: 800;">Método de Pago</label>
                        <select id="paymentMethod" class="form-control" style="font-size: 1rem; font-weight: 700; height: 3rem;" onchange="
                            const cashBox = document.getElementById('purchaseCashDeductGroup');
                            const cb = document.getElementById('paymentDeductFromCash');
                            if(cashBox) { 
                                if(this.value === 'cash') {
                                    cashBox.style.display = 'block';
                                    cb.checked = false; // No se marca por defecto
                                    cashBox.style.borderColor = 'var(--danger)';
                                    cashBox.style.background = 'var(--danger-bg)';
                                } else {
                                    cashBox.style.display = 'none';
                                    cb.checked = false;
                                }
                            }">
                            <option value="cash" selected>Efectivo (Caja Fija)</option>
                            <option value="transfer">Transferencia / Tarjeta</option>
                            <option value="other">Otro / Deuda Externa</option>
                        </select>
                    </div>
                </div>
                
                <div id="purchaseCashDeductGroup" style="display: block; margin-top: 1rem; margin-bottom: 1.5rem; background: var(--danger-bg); border: 2px solid var(--danger); border-radius: 0.75rem; padding: 1rem; transition: all 0.3s ease;">
                    <label style="display: flex; align-items: flex-start; gap: 1rem; cursor: pointer; margin: 0;">
                        <input type="checkbox" id="paymentDeductFromCash" value="true" style="width: 24px; height: 24px; margin-top: 0.2rem; accent-color: var(--danger);">
                        <div>
                            <div style="font-size: 0.95rem; font-weight: 900; color: var(--danger);">SACAR DINERO DE LA CAJA REGISTRADORA</div>
                            <div style="font-size: 0.75rem; color: var(--danger); font-weight: 600; opacity: 0.9; margin-top: 0.25rem; line-height: 1.4;">Atención: Si desmarcas esto, significa que le pagarás al proveedor con plata de tu bolsillo o banco, no de la caja física del negocio.</div>
                        </div>
                    </label>
                </div>

                <div class="form-group">
                    <label>Referencia / Comprobante (opcional)</label>
                    <input type="text" id="paymentReference" class="form-control" placeholder="Ej: Nro. transferencia, recibo...">
                </div>
                <div class="form-group">
                    <label>Notas (opcional)</label>
                    <input type="text" id="paymentNotes" class="form-control" placeholder="Notas adicionales...">
                </div>
            </form>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-success" onclick="PurchasesView.registerPayment(${id})" id="btnRegisterPayment">
                💰 Registrar Pago
            </button>
        `;

        showModal(content, { title: 'Registrar Pago a Proveedor', footer, width: '400px' });
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
            app.navigate('purchases');
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
                const s = await Supplier.getById(parseInt(draft.supplierId));
                if (s) this.selectSupplier(s.id, s.name);
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

            this.purchaseItems = draft.items || [];
            this.currentStep = 1;

            this.updatePurchaseItems();
            this.updateWizardUI();

            showNotification('Borrador recuperado correctamente.', 'success');
        }, 200);
    }
};
