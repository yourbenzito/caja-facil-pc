const POSView = {
    currentSection: 'pos',
    lastScanTerm: null,
    lastScanAt: 0,
    selectedDocType: 'boleta', // Valor por defecto
    customerResults: [],
    customerSelectedIndex: -1,
    async render() {
        const cashOpen = await posController.init();

        if (!cashOpen) {
            return `
                <div class="view-header">
                    <h1>Punto de Venta</h1>
                </div>
                <div class="card" style="text-align: center; padding: 3rem;">
                    <div class="empty-state">
                        <div class="empty-state-icon">⚠️</div>
                        <h2>Caja Cerrada</h2>
                        <p>Debes abrir la caja para realizar ventas</p>
                        <button class="btn btn-primary btn-lg" style="margin-top: 1rem;" onclick="app.navigate('cash')">
                            Ir a Caja
                        </button>
                    </div>
                </div>
            `;
        }

        return `
            <!-- TOP BAR (STICKY) -->
            <div class="pos-header">
                <div class="pos-header-panel">
                    
                    <!-- THE DISPLAY -->
                    <div class="pos-display-card">
                        <span class="pos-display-label">Total a Pagar</span>
                        <div id="cartTotal" class="pos-display-value">${formatCLP(0, true)}</div>
                    </div>

                    <!-- ACTIONS -->
                    <div class="pos-header-actions">
                        <div id="customerInfo" class="pos-customer-selector">
                        <button type="button" class="btn btn-outline-primary btn-customer-select" onclick="POSView.selectCustomer()">
                                (F3) 👤 SELECCIONAR CLIENTE
                        </button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="pos-container">
                <!-- COL LEFT: SEARCH & CART -->
                <div class="pos-main">
                    
                    <!-- Search Container -->
                    <div class="white-panel pos-search-bar">
                        <div class="pos-search-flex">
                            <div class="pos-search-input-wrap">
                                <span class="pos-search-icon">🔍</span>
                                <input type="text" id="productSearch" class="form-control pos-search-input" placeholder="Escanear código o buscar por nombre..." autofocus autocomplete="off">
                                <div id="searchResults" class="pos-search-results"></div>
                            </div>
                            <button type="button" class="btn btn-primary btn-scanner-open" onclick="POSView.openScanner()" title="Escáner">📷</button>
                        </div>
                        
                        <!-- Teclado numérico -->
                        <div id="numericKeypad" style="display: none; margin-top: 1rem; padding: 1rem; background: #f9fafb; border: 2px solid #d1d5db; border-radius: 0.75rem;">
                            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem;">
                                <button type="button" class="btn btn-secondary" style="padding: 1rem; font-size: 1.2rem; font-weight: 700;" onclick="POSView.numericKeypadInput('7')">7</button>
                                <button type="button" class="btn btn-secondary" style="padding: 1rem; font-size: 1.2rem; font-weight: 700;" onclick="POSView.numericKeypadInput('8')">8</button>
                                <button type="button" class="btn btn-secondary" style="padding: 1rem; font-size: 1.2rem; font-weight: 700;" onclick="POSView.numericKeypadInput('9')">9</button>
                                <button type="button" class="btn btn-secondary" style="padding: 1rem; font-size: 1.2rem; font-weight: 700;" onclick="POSView.numericKeypadInput('4')">4</button>
                                <button type="button" class="btn btn-secondary" style="padding: 1rem; font-size: 1.2rem; font-weight: 700;" onclick="POSView.numericKeypadInput('5')">5</button>
                                <button type="button" class="btn btn-secondary" style="padding: 1rem; font-size: 1.2rem; font-weight: 700;" onclick="POSView.numericKeypadInput('6')">6</button>
                                <button type="button" class="btn btn-secondary" style="padding: 1rem; font-size: 1.2rem; font-weight: 700;" onclick="POSView.numericKeypadInput('1')">1</button>
                                <button type="button" class="btn btn-secondary" style="padding: 1rem; font-size: 1.2rem; font-weight: 700;" onclick="POSView.numericKeypadInput('2')">2</button>
                                <button type="button" class="btn btn-secondary" style="padding: 1rem; font-size: 1.2rem; font-weight: 700;" onclick="POSView.numericKeypadInput('3')">3</button>
                                <button type="button" class="btn btn-secondary" style="padding: 1rem; font-size: 1.2rem; font-weight: 700;" onclick="POSView.numericKeypadInput('0')">0</button>
                                <button type="button" class="btn btn-secondary" style="padding: 1rem; font-size: 1.2rem; font-weight: 700;" onclick="POSView.numericKeypadInput('.')">.</button>
                                <button type="button" class="btn btn-danger" style="padding: 1rem; font-size: 1.2rem; font-weight: 700;" onclick="POSView.numericKeypadInput('backspace')">⌫</button>
                            </div>
                            <button type="button" class="btn btn-outline-secondary" style="width: 100%; margin-top: 0.5rem;" onclick="POSView.toggleNumericKeypad()">Ocultar Teclado</button>
                        </div>
                    </div>

                    <!-- Cart -->
                    <div class="white-panel pos-cart-panel">
                        <div class="pos-cart-header">
                            <div class="pos-cart-header-main">
                                <h3 class="pos-cart-title">LISTA DE PRODUCTOS</h3>
                                <div class="pos-cart-actions-group">
                                    <button type="button" class="btn btn-xs btn-outline-warning" onclick="POSView.showDiscountModal()">[Alt+D] 🏷️ DESC</button>
                                    <button type="button" class="btn btn-xs btn-outline-info" onclick="POSView.toggleFiscal()">[Alt+I] 📊 IVA</button>
                                    <button type="button" class="btn btn-xs btn-outline-danger" onclick="POSView.clearCart()">[F8] LIMPIAR</button>
                                </div>
                            </div>
                        </div>
                        <div id="cartItems" class="pos-cart-items-container"></div>
                        
                        <!-- Sugerencias de productos -->
                        <div id="productSuggestions" style="display: none; padding: 1rem; background: #f0f9ff; border-top: 2px solid #3b82f6; margin-top: 1rem;">
                            <h4 style="margin: 0 0 0.75rem 0; color: #1e40af; font-size: 0.9rem; font-weight: 700;">💡 Sugerencias</h4>
                            <div id="suggestionsList" style="display: flex; flex-direction: column; gap: 0.5rem;"></div>
                        </div>
                    </div>
                </div>

                <!-- COL RIGHT: SIDEBAR -->
                <div class="pos-sidebar">
                    
                    <div class="pos-summary-panel">
                        <h4 style="margin: 0; font-size: 0.95rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1.5px;">Resumen</h4>
                        
                        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                            <div style="display: flex; justify-content: space-between; font-size: 1.15rem; font-weight: 600;">
                                <span>Subtotal</span>
                                <strong id="cartSubtotal">$0</strong>
                            </div>
                            <div id="cartDiscountSection" style="display:none; justify-content: space-between; color: var(--danger); font-weight: 700;">
                                <span>Descuento</span>
                                <strong id="cartDiscountAmount">$0</strong>
                            </div>
                            <div id="fiscalBreakdown" style="display:none; justify-content: space-between; color: var(--text-muted); font-size: 0.9rem;">
                                <span>IVA (19%)</span>
                                <strong id="fiscalIVA">$0</strong>
                            </div>
                        </div>

                        <hr style="border: 0; border-top: 1px solid var(--border); margin: 0;">

                        <div class="pos-summary-total-display">
                            <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;" class="only-mobile">Total a Pagar</span>
                            <strong id="cartSummaryTotal" style="font-size: 1.8rem; color: var(--primary); font-weight: 900; line-height: 1;">$0</strong>
                        </div>

                        <button type="button" class="btn btn-primary pos-total-btn" onclick="POSView.showPaymentModal()">
                            <span>💸</span>
                            <span>[F2] FINALIZAR</span>
                        </button>
                    </div>

                    <div class="white-panel" style="padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem;">
                        <button type="button" class="btn btn-warning" style="width: 100%; height: 54px; border-radius: 0.75rem; border-width: 2px; display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-weight: 900; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2);" onclick="POSView.holdCurrentSale()">
                            <span style="font-size: 1.2rem;">⏸️</span>
                            <span>[F6] PAUSAR VENTA</span>
                        </button>

                        <div id="heldSalesListContainer" style="display: none; border-top: 1px dashed var(--border); padding-top: 1rem;">
                            <div style="font-size: 0.75rem; font-weight: 950; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
                                <span>Ventas en Pausa</span>
                                <span id="heldSalesBadge" style="background: var(--warning); color: white; padding: 1px 8px; border-radius: 10px; font-size: 0.7rem;">0</span>
                            </div>
                            <div id="heldSalesListItems" style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 250px; overflow-y: auto;"></div>
                        </div>

                        <!-- PANEL DE VENTAS RECIENTES (CORRECCIÓN RÁPIDA) -->
                        <div id="recentSalesPanel" style="display: none; border-top: 1px dashed var(--border); padding-top: 1rem; margin-top: auto;">
                            <div style="font-size: 0.75rem; font-weight: 950; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
                                <span>Últimas Ventas (Turno Actual)</span>
                            </div>
                            <div id="recentSalesListItems" style="display: flex; flex-direction: column; gap: 0.5rem;">
                                <!-- Se llenará dinámicamente -->
                            </div>
                        </div>
                        
                    </div>
                </div>
            </div>

        `;
    },

    // Abrir Modal de Escáner Portátil
    async openScanner() {
        // ASEGURAR QUE LA LIBRERÍA ESTÁ CARGADA (Crucial para móviles)
        try {
            if (typeof _loadQrScanner === 'function') {
                await _loadQrScanner();
            }
        } catch (e) {
            console.error("Error cargando librería de escáner:", e);
            showNotification("No se pudo cargar el escáner", 'error');
            return;
        }

        const content = `
            <div style="width: 100%; max-width: 500px; margin: 0 auto; overflow: hidden; border-radius: 12px; background: #000;">
                <div id="reader" style="width: 100%;"></div>
            </div>
            <div id="cameraStatus" style="text-align: center; margin-top: 1rem; color: #94a3b8; font-size: 0.9rem;">
                ⏳ Iniciando cámara...
            </div>
        `;
        const footer = `<button class="btn btn-secondary" onclick="POSView.closeScanner()">Cerrar Cámara</button>`;

        showModal(content, { title: '📸 Escanear con Cámara', footer });

        setTimeout(() => {
            // Usar window.Html5Qrcode para asegurar acceso global
            const scannerClass = window.Html5Qrcode || Html5Qrcode;
            if (!scannerClass) {
                console.error("Librería Html5Qrcode no encontrada tras carga");
                showNotification("Error: No se encontró el motor de escaneo", 'error');
                return;
            }

            const html5QrCode = new scannerClass("reader");
            this.html5QrCode = html5QrCode;

            // Configuración optimizada para VELOCIDAD y CÓDIGOS DE BARRAS (1D)
            const config = {
                fps: 25,                    // Aumentar FPS para detección inmediata
                qrbox: { width: 350, height: 180 }, // Caja rectangular ideal para barras
                aspectRatio: 1.0,           // Ratio cuadrado para la cámara pero procesado en la caja
                disableFlip: true           // Evita procesamiento espejo innecesario
            };

            html5QrCode.start(
                { facingMode: "environment" },
                config,
                async (decodedText) => {
                    // Éxito: vibrar y procesar instantáneamente
                    if (navigator.vibrate) navigator.vibrate(100);
                    // Detener cámara antes de mostrar el modal de cantidad
                    this.closeScanner();
                    await this.handleBarcodeScan(decodedText);
                },
                (errorMessage) => {
                    // Solo errores menores durante el escaneo continuado
                }
            ).then(() => {
                const status = document.getElementById('cameraStatus');
                if (status) status.innerHTML = "🎯 Apunta al código de barras";
            }).catch((err) => {
                console.error("Error al iniciar cámara:", err);
                showNotification("No se pudo acceder a la cámara", 'error');
                closeModal();
            });
        }, 300);
    },

    closeScanner() {
        if (this.html5QrCode) {
            this.html5QrCode.stop().then(() => {
                this.html5QrCode = null;
                closeModal();
            }).catch(err => {
                console.warn("Error al detener cámara:", err);
                closeModal();
            });
        } else {
            closeModal();
        }
    },

    setDocType(type) {
        this.selectedDocType = type;
        this.updateCart(); // Para refrescar la UI y el cálculo fiscal
        this.updateDocTypeUI();
        // Si el modal de pago está abierto, forzamos su actualización visual inmediata
        if (typeof this._updateModalUI === 'function') {
            this._updateModalUI();
        }
    },

    updateDocTypeUI() {
        const docBoletaBtn = document.getElementById('docBoletaBtn');
        const docInternoBtn = document.getElementById('docInternoBtn');

        if (docBoletaBtn && docInternoBtn) {
            if (this.selectedDocType === 'boleta') {
                docBoletaBtn.style.background = 'var(--primary)';
                docBoletaBtn.style.color = 'white';
                docBoletaBtn.style.boxShadow = '0 4px 15px rgba(79, 70, 229, 0.4)';
                docBoletaBtn.style.transform = 'scale(1.02)';
                docBoletaBtn.style.opacity = '1';

                docInternoBtn.style.background = 'transparent';
                docInternoBtn.style.color = 'var(--text-muted)';
                docInternoBtn.style.boxShadow = 'none';
                docInternoBtn.style.transform = 'scale(1)';
                docInternoBtn.style.opacity = '0.5';
            } else {
                docInternoBtn.style.background = 'var(--warning)';
                docInternoBtn.style.color = 'white';
                docInternoBtn.style.boxShadow = '0 4px 15px rgba(245, 158, 11, 0.4)';
                docInternoBtn.style.transform = 'scale(1.02)';
                docInternoBtn.style.opacity = '1';

                docBoletaBtn.style.background = 'transparent';
                docBoletaBtn.style.color = 'var(--text-muted)';
                docBoletaBtn.style.boxShadow = 'none';
                docBoletaBtn.style.transform = 'scale(1)';
                docBoletaBtn.style.opacity = '0.5';
            }
        }

        const payCardBtn = document.getElementById('payCardBtn');
        const payQRBtn = document.getElementById('payQRBtn');
        if (payCardBtn) payCardBtn.style.display = 'flex'; // Siempre visibles ahora
        if (payQRBtn) payQRBtn.style.display = 'flex';     // Siempre visibles ahora
    },

    focusSearch() {
        const el = document.getElementById('productSearch');
        if (el) {
            el.focus();
            // Ya no limpiamos el input automáticamente para evitar que el usuario pierda su búsqueda
            // si el modal se cierra o se abre accidentalmente.
        }
    },

    async init() {
        let searchInput = document.getElementById('productSearch');
        const searchResults = document.getElementById('searchResults');

        if (!searchInput) return;

        // Eliminar listeners previos clonando el input
        const freshInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(freshInput, searchInput);
        searchInput = freshInput;

        this._searchTimeout = null;
        this._barcodeTimeout = null;
        
        searchInput.addEventListener('input', async (e) => {
            const term = e.target.value.trim();
            
            // Detección de código de barras con pequeño retardo (debounce)
            // para asegurar que capturamos la secuencia completa del escáner
            if (term.length >= 8 && !isNaN(term)) {
                clearTimeout(this._barcodeTimeout);
                this._barcodeTimeout = setTimeout(async () => {
                    const finalTerm = searchInput.value.trim();
                    if (finalTerm.length >= 8) {
                        // Limpiar y quitar foco inmediatamente para descartar caracteres sobrantes
                        searchInput.value = '';
                        searchInput.blur(); 
                        
                        await this.handleBarcodeScan(finalTerm);
                        searchResults.style.display = 'none';
                    }
                }, 60); // 60ms es suficiente para la mayoría de los escáneres
                return;
            }

            if (term.length >= 2) {
                // Indicador visual de búsqueda (opcional pero recomendado)
                searchResults.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--primary); font-weight: 700;"><span class="spinner-border spinner-border-sm me-2"></span> Buscando...</div>';
                searchResults.style.display = 'block';

                clearTimeout(this._searchTimeout);
                const searchId = Date.now();
                this._lastSearchId = searchId;

                this._searchTimeout = setTimeout(async () => {
                    try {
                        const products = await Product.search(term);
                        // Solo procesamos si esta sigue siendo la búsqueda más reciente
                        if (this._lastSearchId === searchId) {
                            this.showSearchDropdown(products);
                        }
                    } catch (error) {
                        console.error('Error en búsqueda:', error);
                        searchResults.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--danger);">❌ Error al buscar</div>';
                    }
                }, 250); // Reducido a 250ms para mayor agilidad
            } else {
                clearTimeout(this._searchTimeout);
                searchResults.style.display = 'none';
            }
        });

        // Autofocus y atajos globales del POS
        const posGlobalKeydown = (e) => {
            if (app.currentView !== 'pos') return;
            
            const searchInput = document.getElementById('productSearch');
            const activeElem = document.activeElement;
            const activeTag = activeElem ? activeElem.tagName.toUpperCase() : '';
            
            // Determinar si se presionó uno de los atajos que abren módulos/modales
            let requestedModule = null;
            if (e.key === 'F3') {
                requestedModule = 'Selección de Clientes';
            } else if (e.key === 'F4') {
                requestedModule = 'Escanear con Cámara';
            } else if (e.key === 'F6') {
                requestedModule = 'Pausar Venta';
            } else if (e.key === 'F2') {
                requestedModule = 'Proceso de Pago';
            } else if (e.key === 'F8') {
                requestedModule = 'Limpiar Carrito';
            } else if (e.altKey && (e.key === 'd' || e.key === 'D')) {
                requestedModule = 'Descuento a la Venta';
            }

            if (requestedModule) {
                const activeModal = document.querySelector('.modal');
                if (activeModal) {
                    const rawTitle = activeModal.querySelector('.modal-header h3') ? activeModal.querySelector('.modal-header h3').textContent : '';
                    // Limpiar emojis de la cabecera del modal para comparar de forma segura
                    const currentModule = rawTitle.replace(/[^\w\sáéíóúÁÉÍÓÚñÑ]/g, '').trim();

                    // CASO ESPECIAL: Si es F2 para procesar el pago y el módulo de pago ya está abierto, permitir que continúe
                    if (e.key === 'F2' && (currentModule.includes('Proceso de Pago') || document.getElementById('paymentSummaryBox'))) {
                        // Permitir continuar con la confirmación del pago
                    } else {
                        e.preventDefault();
                        if (currentModule.toLowerCase().includes(requestedModule.toLowerCase()) || 
                            requestedModule.toLowerCase().includes(currentModule.toLowerCase())) {
                            showNotification(`El módulo "${requestedModule}" ya está abierto.`, 'warning');
                        } else {
                            showNotification(`No se puede abrir ${requestedModule} porque ya hay otro módulo abierto (${currentModule}). Por favor, cierra el módulo actual primero.`, 'warning');
                        }
                        return;
                    }
                }
            }
            
            // F3: Seleccionar cliente
            if (e.key === 'F3') { e.preventDefault(); POSView.selectCustomer(); return; }
            // F4: Escáner

            // F6: Pausar venta
            if (e.key === 'F6') { e.preventDefault(); POSView.holdCurrentSale(); return; }
            // F2: Finalizar / Confirmar Venta
            if (e.key === 'F2') {
                e.preventDefault();
                const paymentModal = document.getElementById('paymentSummaryBox');
                if (paymentModal) {
                    const btn = document.getElementById('btn_process_payment');
                    if (btn && !btn.disabled) {
                        POSView.processUnifiedSale();
                    } else {
                        showNotification('Falta completar el pago para confirmar', 'warning');
                    }
                } else {
                    POSView.showPaymentModal();
                }
                return;
            }
            // 3. Tecla ESC (Cerrar modales o limpiar búsqueda)
            if (e.key === 'Escape') {
                // Si estamos en un input, solo quitamos el foco
                if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') {
                    activeElem.blur();
                } else {
                    // Si no, cerramos modales
                    const modal = document.querySelector('.modal.show');
                    if (modal) {
                        const closeBtn = modal.querySelector('.btn-close, [data-bs-dismiss="modal"]');
                        if (closeBtn) closeBtn.click();
                        else modal.classList.remove('show');
                    }
                }
                return;
            }
            // F8: Limpiar carrito
            if (e.key === 'F8') {
                e.preventDefault();
                if (document.querySelectorAll('#cartItems .pos-cart-item').length > 0) {
                    POSView.clearCart();
                }
                return;
            }
            // Alt+D: Descuento
            if (e.altKey && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); POSView.showDiscountModal(); return; }
            // Alt+I: IVA
            if (e.altKey && (e.key === 'i' || e.key === 'I')) { e.preventDefault(); if(typeof POSView.toggleFiscal === 'function') POSView.toggleFiscal(); return; }
            
            // Autofoco: si no estamos en un input y es una tecla alfanumérica, forzar foco al buscador
            if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA' && activeTag !== 'SELECT') {
                 if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                     if (searchInput && activeElem !== searchInput) {
                         searchInput.focus();
                     }
                 }
            }
        };

        if (document._posGlobalKeydown) document.removeEventListener('keydown', document._posGlobalKeydown);
        document._posGlobalKeydown = posGlobalKeydown;
        document.addEventListener('keydown', posGlobalKeydown);

        // Track keyboard vs mouse navigation
        this._isKeyboardNav = false;
        this._lastMousePos = { x: -1, y: -1 };

        // Real mouse movement detector on the dropdown
        searchResults.addEventListener('mousemove', (e) => {
            const dx = Math.abs(e.clientX - this._lastMousePos.x);
            const dy = Math.abs(e.clientY - this._lastMousePos.y);
            if (dx > 2 || dy > 2) {
                this._isKeyboardNav = false;
            }
            this._lastMousePos = { x: e.clientX, y: e.clientY };
        });

        searchInput.addEventListener('keydown', async (e) => {
            const items = searchResults.querySelectorAll('.search-result-item');
            let selectedIndex = -1;
            items.forEach((item, index) => { if (item.classList.contains('selected')) selectedIndex = index; });

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this._isKeyboardNav = true;
                this.highlightResult((selectedIndex + 1) % items.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this._isKeyboardNav = true;
                this.highlightResult((selectedIndex - 1 + items.length) % items.length);
            } else if (e.key === 'Escape') {
                if (document.querySelectorAll('.modal').length > 0) return; // Dejar que el modal se cierre
                e.preventDefault();
                e.stopPropagation();
                // Escape solo limpia el buscador, NUNCA el carrito
                if (searchResults.style.display !== 'none' || searchInput.value.length > 0) {
                    searchResults.style.display = 'none';
                    searchInput.value = '';
                    searchInput.focus();
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const term = searchInput.value.trim();
                const isBarcode = term.length >= 8 && !isNaN(term);

                if (isBarcode) {
                    await this.handleBarcodeScan(term);
                    searchInput.value = '';
                    searchResults.style.display = 'none';
                } else if (searchResults.style.display !== 'none' && items.length > 0) {
                    const selected = searchResults.querySelector('.selected') || items[0];
                    if (selected) await this.addProductFromSearch(parseInt(selected.dataset.productId));
                } else if (term.length >= 3) {
                    const products = await Product.search(term);
                    if (products.length === 1) await this.addProductFromSearch(products[0].id);
                    else if (products.length > 1) this.showSearchDropdown(products);
                }
            }
        });

        const posCloseSearch = (e) => {
            if (searchInput && searchResults && !searchInput.contains(e.target) && !searchResults.contains(e.target)) {
                searchResults.style.display = 'none';
            }
        };
        document.removeEventListener('click', document._posCloseSearch);
        document._posCloseSearch = posCloseSearch;
        document.addEventListener('click', posCloseSearch);

        this.updateCart();
    },

    highlightResult(index, isMouse = false) {
        // If mouse tries to highlight while keyboard is navigating, IGNORE
        if (isMouse && this._isKeyboardNav) return;

        const items = document.querySelectorAll('#searchResults .search-result-item');
        items.forEach(item => item.classList.remove('selected'));
        const target = document.querySelector(`#searchResults .search-result-item[data-index="${index}"]`);
        if (target) {
            target.classList.add('selected');
            target.scrollIntoView({ block: 'nearest' });
        }
    },

    showProductSelection(products) {
        this.showSearchDropdown(products);
        const el = document.getElementById('productSearch');
        if (el) { el.value = ''; el.focus(); }
    },

    showSearchDropdown(products) {
        const searchResults = document.getElementById('searchResults');
        if (!products || products.length === 0) {
            searchResults.style.display = 'none';
            return;
        }
        this.renderSearchResults(products);
    },

    renderSearchResults(products) {
        const searchResults = document.getElementById('searchResults');
        
        // Botón de cerrar para vista móvil (full screen)
        const closeBtn = `<div class="only-mobile" style="position: sticky; top: 0; background: #f8fafc; padding: 1rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; z-index: 10;">
            <span style="font-weight: 800; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase;">Resultados (${products.length})</span>
            <button class="btn btn-secondary btn-sm" onclick="document.getElementById('searchResults').style.display='none'">CERRAR ✕</button>
        </div>`;

        if (products.length === 0) {
            searchResults.innerHTML = closeBtn + '<div style="padding: 3rem 1.5rem; text-align: center; color: #64748b;"><div style="font-size: 3rem; margin-bottom: 1rem;">🔍</div><div style="font-weight: 700; font-size: 1.1rem;">No se encontraron productos</div><p style="font-size: 0.9rem; margin-top: 0.5rem;">Intenta con otras palabras o revisa que el producto esté activo.</p></div>';
            searchResults.style.display = 'block';
            return;
        }

        const itemsHtml = products.slice(0, 50).map((p, index) => {
            const isWeight = p.type === 'weight';
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
                     onclick="POSView.selectSearchResult(${p.id})">
                    
                    <div class="search-result-info">
                        <div class="search-result-name">${safeHTML(p.name)}</div>
                        <div class="search-result-meta">
                            <span class="search-result-badge">CÓD: ${p.barcode || 'S/N'}</span>
                            <span class="search-result-stock ${stockClass}" style="display: flex; align-items: center; gap: 4px;">
                                ${stockIcon} ${stockStatus}: <strong>${formatStock(p.stock)} ${isWeight ? 'kg' : 'un'}</strong>
                            </span>
                        </div>
                    </div>

                    <div class="search-result-price-box">
                        <div class="search-result-price">${formatCLP(p.price)}${isWeight ? '/kg' : ''}</div>
                        <div class="search-result-price-label">Precio</div>
                    </div>
                </div>
            `;
        }).join('');

        searchResults.innerHTML = closeBtn + itemsHtml;
        searchResults.style.display = 'block';
    },

    async selectSearchResult(productId) {
        if (this._selectingProduct) return;
        this._selectingProduct = true;
        try {
            const product = await Product.getById(productId);
            if (product) {
                const searchResults = document.getElementById('searchResults');
                const searchInput = document.getElementById('productSearch');
                if (searchResults) searchResults.style.display = 'none';
                if (searchInput) searchInput.value = '';
                this.showProductModal(product);
            }
        } finally {
            setTimeout(() => { this._selectingProduct = false; }, 300);
        }
    },

    async addProductFromSearch(productId) {
        await this.selectSearchResult(productId);
    },

    async handleBarcodeScan(term) {
        const now = Date.now();
        if (this.lastScanTerm === term && now - this.lastScanAt < 800) return;
        this.lastScanTerm = term;
        this.lastScanAt = now;

        const result = await posController.searchProduct(term);
        if (result.product) {
            if (result.weight) {
                // Si viene peso (etiqueta de balanza), agregar directo al carrito
                posController.addToCart(result.product, result.weight);
                this.updateCart();
                showNotification(`${result.product.name} (${result.weight} kg) agregado`, 'success');
                this.focusSearch();
            } else {
                this.showProductModal(result.product);
            }
        }
        else if (result.multiple) this.showProductSelection(result.products);
        else {
            showNotification('Producto no encontrado', 'warning');
            setTimeout(() => this.focusSearch(), 100);
        }
    },

    showProductModal(product) {
        // PREVENCIÓN DE DUPLICADOS: Si ya hay un modal de producto abierto, no abrir otro
        if (document.getElementById('productQuantity')) {
            console.warn('⚠️ Modal de producto ya está abierto. Ignorando llamada duplicada.');
            return;
        }

        closeModal();


        const isWeight = product.type === 'weight';
        const unitPriceRounded = Math.round(product.price / 10) * 10;

        const content = `
            <div class="modal-form-header">
                <h2>${safeHTML(product.name)}</h2>
                <p>Precio Unitario: ${formatCLP(unitPriceRounded)}${isWeight ? '/kg' : ''}</p>
                <p style="opacity: 0.7;">Disponibilidad: ${formatStock(product.stock)} ${isWeight ? 'kg' : 'un'}</p>
            </div>
            <div class="form-group">
                <label style="font-weight: 800; color: var(--text-muted); margin-bottom: 0.5rem; display: block;">${isWeight ? '⚖️ PESO (KG):' : '📦 CANTIDAD:'}</label>
                <input type="number" id="productQuantity" class="form-control huge-input" step="any" min="0.001" value="" placeholder="${isWeight ? '0.000' : '1'}" autofocus>
            </div>
            <div class="form-group" style="margin-top: 1.5rem;">
                <label style="font-weight: 800; color: var(--text-muted); margin-bottom: 0.5rem; display: block;">💰 AJUSTAR PRECIO:</label>
                <input type="number" id="productPrice" class="form-control" step="any" value="${unitPriceRounded}" style="font-size: 1.5rem; text-align: center; height: 60px; font-weight: 800; border: 3px solid var(--primary); border-radius: 1rem;">
            </div>
            <div id="pricePreview" class="modal-preview-box">
                <div class="modal-preview-label">Subtotal a Sumar</div>
                <div id="calculatedTotal" class="modal-preview-value">${formatCLP(unitPriceRounded)}</div>
            </div>
            <p style="text-align: center; margin-top: 1.25rem; font-size: 0.85rem; font-weight: 700; color: var(--text-muted);">
                💡 PRESIONA <span style="color: var(--primary);">ENTER</span> PARA AGREGAR
            </p>
        `;

        const footer = `
            <div style="display: flex; gap: 1rem; width: 100%;">
                <button class="btn btn-xl btn-secondary" style="flex: 1;" onclick="closeModal()">CANCELAR</button>
                <button class="btn btn-xl btn-primary" style="flex: 2; font-size: 1.2rem;" onclick="POSView.addProductFromModal(${product.id})">✓ AGREGAR</button>
            </div>
        `;

        showModal(content, { title: 'Agregar Producto', footer, width: '450px' });

        const qInput = document.getElementById('productQuantity');
        const pInput = document.getElementById('productPrice');
        const update = () => {
            const rawVal = qInput.value;
            // Usamos parseNumber para que acepte comas y puntos por igual
            const q = (rawVal === '' && !isWeight) ? 1 : (parseNumber(rawVal) || 0);
            const p = parseNumber(pInput.value) || 0;
            
            // LEY 20.956: Redondeo a la decena para TODOS los productos en la vista previa
            // Esto asegura que el usuario vea el precio final exacto que se cobrará
            const calculatedVal = roundPrice(q * p);
            document.getElementById('calculatedTotal').textContent = formatCLP(calculatedVal, true);
        };
        qInput.addEventListener('input', update);
        pInput.addEventListener('input', update);

        const handleEnter = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                const qValue = qInput.value.trim();
                // Si el campo de cantidad está vacío y es por unidad, o ya tiene valor, procesar.
                // Si es pesable y está vacío, quizás el usuario quiera ir al precio o completar.
                if (qValue !== '' || !isWeight) {
                    this.addProductFromModal(product.id);
                } else {
                    pInput.focus();
                    pInput.select();
                }
            }
        };

        qInput.addEventListener('keydown', handleEnter);
        pInput.addEventListener('keydown', handleEnter);

        // CRITICAL FIX: Retardo para evitar que el escáner "filtre" dígitos en la cantidad
        setTimeout(() => {
            if (document.getElementById('productQuantity')) {
                qInput.focus();
                // Opcional: seleccionar texto por si acaso
                qInput.select();
            }
        }, 150);
    },

    async addProductFromModal(productId) {
        const product = await Product.getById(productId);
        const isWeight = product.type === 'weight';
        const qStr = document.getElementById('productQuantity').value;

        // Si el campo está vacío y es por unidad, el valor por defecto es 1
        let q = parseNumber(qStr);
        if (qStr === '' && !isWeight) {
            q = 1;
        }

        const p = parseNumber(document.getElementById('productPrice').value);

        if (!q || q <= 0) { showNotification('Cantidad inválida', 'warning'); return; }

        const check = await posController.validateStock(productId, q);
        if (!check.valid) { showNotification(check.error, 'warning'); return; }

        posController.addToCart(product, q, p);
        this.updateCart();
        closeModal();
        
        // Solo limpiamos el buscador si el producto se agregó exitosamente
        const searchInput = document.getElementById('productSearch');
        if (searchInput) {
            searchInput.value = '';
            const results = document.getElementById('searchResults');
            if (results) results.style.display = 'none';
        }
        
        showNotification(`${product.name} agregado`, 'success');
    },

    updateCart() {
        const summary = posController.getCartSummary();
        const subEl = document.getElementById('cartSubtotal');
        const totEl = document.getElementById('cartTotal');
        if (subEl) subEl.textContent = formatCLP(summary.subtotal, true);
        if (totEl) totEl.textContent = formatCLP(summary.total, true);
        
        const sumTotEl = document.getElementById('cartSummaryTotal');
        if (sumTotEl) sumTotEl.textContent = formatCLP(summary.total, true);

        // ACTUALIZAR INFORMACIÓN DEL CLIENTE (FIX: Limpiar inmediatamente al terminar venta)
        const infoEl = document.getElementById('customerInfo');
        if (infoEl) {
            const customer = posController.currentCustomer;
            if (!customer) {
                infoEl.innerHTML = `
                    <button type="button" class="btn btn-outline-primary btn-customer-select" onclick="POSView.selectCustomer()">
                        (F3) 👤 SELECCIONAR CLIENTE
                    </button>
                `;
            }
        }

        // Actualizar desglose fiscal (Legal Chile)
        const fiscal = posController.computeFiscalFromTotal(summary.total, this.selectedDocType);
        const fIVA = document.getElementById('fiscalIVA');
        if (fIVA) fIVA.textContent = formatCLP(fiscal.tax_amount, true);
        const breakdown = document.getElementById('fiscalBreakdown');
        if (breakdown) {
            breakdown.style.display = (this.selectedDocType === 'boleta' && fiscal.tax_amount > 0) ? 'inline' : 'none';
        }

        const dSec = document.getElementById('cartDiscountSection');
        if (summary.discount > 0) {
            document.getElementById('cartDiscountAmount').textContent = '- ' + formatCLP(summary.discount, true);
            if (dSec) dSec.style.display = 'inline';
        } else if (dSec) dSec.style.display = 'none';

        const cSec = document.getElementById('cartCreditSection');
        if (summary.creditBalanceUsed > 0) {
            document.getElementById('cartCreditAmount').textContent = '- ' + formatCLP(summary.creditBalanceUsed, true);
            if (cSec) cSec.style.display = 'inline';
        } else if (cSec) cSec.style.display = 'none';

        const heldContainer = document.getElementById('heldSalesListContainer');
        const heldList = document.getElementById('heldSalesListItems');
        const heldBadge = document.getElementById('heldSalesBadge');

        // Cargar sugerencias de productos
        this.loadProductSuggestions();


        if (heldContainer && heldList && heldBadge) {
            const sales = posController.heldSales;
            heldBadge.textContent = sales.length;

            if (sales.length > 0) {
                heldContainer.style.display = 'block';
                heldList.innerHTML = sales.map(s => {
                    const total = s.cart.reduce((sum, item) => sum + item.total, 0);
                    return `
                        <div class="held-sale-compact-item" onclick="POSView.resumeHeldSale(${s.id})" style="background: white; border: 1.5px solid var(--border); border-radius: 0.6rem; padding: 0.6rem 0.8rem; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; gap: 0.2rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <strong style="font-size: 0.85rem; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;">${safeHTML(s.name)}</strong>
                                <span style="font-size: 0.75rem; color: var(--primary); font-weight: 900;">${formatCLP(total)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--text-muted); font-weight: 600;">
                                <span>🕒 ${formatTime(s.timestamp)}</span>
                                <span>📦 ${s.cart.length} pos.</span>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                heldContainer.style.display = 'none';
            }
        }

        const cartDiv = document.getElementById('cartItems');
        if (!cartDiv) return;

        if (summary.items.length === 0) {
            cartDiv.innerHTML = `<div class="cart-empty-state">🛒 Carrito vacío</div>`;
        } else {
            cartDiv.innerHTML = `<div class="pos-cart-list">
                ${summary.items.map((item, index) => {
                const isLoss = item.unitPrice < item.cost;
                const stockWarn = (item.stock !== undefined) && (item.quantity > item.stock);
                const stockNeg  = (item.stock !== undefined) && (item.stock <= 0);
                return `
                        <div class="pos-cart-item ${isLoss ? 'is-loss' : ''} ${stockWarn ? 'stock-warn' : ''}">
                            <div class="pos-cart-item-info">
                                <strong class="pos-cart-item-title">${safeHTML(item.name)}</strong>
                                ${isLoss ? '<span class="badge-loss">⚠️ PÉRDIDA</span>' : ''}
                                ${stockNeg ? '<span class="badge-stock-critical">📦 SIN STOCK</span>' : (stockWarn ? '<span class="badge-stock-warn">📦 STOCK INSUF.</span>' : '')}
                                <div class="pos-cart-item-controls">
                                    <div class="pos-cart-item-control-group">
                                        <span class="pos-cart-item-label">CANT:</span>
                                        <input type="number" value="${item.quantity}" step="${item.type === 'weight' ? '0.001' : '1'}" onchange="POSView.updateQuantity(${item.productId}, this.value)" onkeydown="if(event.key==='Enter') { event.preventDefault(); this.blur(); }" class="pos-cart-item-input">
                                    </div>
                                    <div class="pos-cart-item-control-group">
                                        <span class="pos-cart-item-label">PRECIO:</span>
                                        <input type="number" value="${item.unitPrice}" step="10" onchange="POSView.updatePrice(${item.productId}, this.value)" onkeydown="if(event.key==='Enter') { event.preventDefault(); this.blur(); }" class="pos-cart-item-input" style="width: 100px;">
                                    </div>
                                </div>
                            </div>
                            <div class="pos-cart-item-totals">
                                <div class="pos-cart-item-price-total">${formatCLP(item.total, true)}</div>
                                <button type="button" class="btn btn-sm btn-outline-danger btn-remove-item" onclick="POSView.removeItem(${item.productId})">🗑️</button>
                            </div>
                        </div>
                    `;
            }).join('')}
            </div>`;
        }
    },

    updateQuantity(id, val) {
        const q = parseFloat(val);
        if (q > 0) {
            posController.updateCartItem(id, q);
            this.updateCart();
        }
    },

    updatePrice(id, val) {
        const p = parseFloat(val);
        if (p >= 0) {
            const item = posController.cart.find(i => i.productId === id);
            posController.updateCartItem(id, item.quantity, p);
            this.updateCart();
        }
    },

    removeItem(id) {
        posController.removeFromCart(id);
        this.updateCart();
        this.focusSearch();
    },

    clearCart() {
        showConfirm('¿Limpiar todo el carrito?', () => {
            posController.clearCart();
            this.updateCart();
        });
    },

    showDiscountModal() {
        const summary = posController.getCartSummary();
        const content = `
            <div class="modal-form-header">
                <h2>Aplicar Descuento</h2>
                <p>Monto a descontar del total de la venta</p>
            </div>
            <div class="form-group">
                <label style="margin-bottom: 0.75rem; display: block; font-weight: 700; color: var(--text-muted);">MONTO CLP:</label>
                <input type="number" id="discAmount" class="form-control huge-input" 
                       value="" 
                       placeholder="${summary.discount || 0}" 
                       autofocus>
                <p style="margin-top: 1rem; font-size: 0.85rem; color: var(--text-muted); font-weight: 600; text-align: center;">
                    💡 Deja vacío para mantener (${formatCLP(summary.discount)}).<br>
                    Ingresa 0 para eliminar.
                </p>
            </div>
        `;
        const footer = `
            <div style="display: flex; gap: 1rem; width: 100%;">
                <button class="btn btn-xl btn-secondary" style="flex: 1;" onclick="POSView.removeDiscount(); closeModal();">🗑 LIMPIAR</button>
                <button class="btn btn-xl btn-primary" style="flex: 2;" onclick="const val = document.getElementById('discAmount').value; if(val !== '') POSView.applyDiscount(parseFloat(val)); else { closeModal(); }">✔ APLICAR</button>
            </div>
        `;
        showModal(content, { title: '🏷 Descuento a la Venta', footer });
    },

    applyDiscount(amount) {
        if (amount >= 0) {
            posController.setDiscount(amount);
            this.updateCart();
            closeModal();
        }
    },

    removeDiscount() {
        posController.clearDiscount();
        this.updateCart();
    },

    /**
     * MODAL DE PAGO UNIFICADO
     */
    showPaymentModal(initialMethod = null) {
        const summary = posController.getCartSummary();
        let total = summary.total;
        let roundedTotal = summary.roundedTotal;

        if (summary.items.length === 0) {
            showNotification('El carrito está vacío', 'warning');
            return;
        }

        const customer = posController.currentCustomer;
        const isCustomerSelected = !!customer;

        const content = `
            <div class="payment-modal-pro">
                <!-- Columna Izquierda: Entradas de Dinero -->
                <div class="payment-methods-list">
                    
                    <!-- SELECTOR DE DOCUMENTO (BOLETA / INTERNO) -->
                    <div class="payment-doc-type-selector">
                        <div class="payment-mini-label">TIPO DE VENTA</div>
                        <div class="pos-doc-toggle">
                            <button id="docBoletaBtn" class="btn btn-sm btn-doc-toggle" style="${this.selectedDocType === 'boleta' ? 'background: var(--primary); color: white; box-shadow: 0 4px 15px rgba(79, 70, 229, 0.4);' : 'background: transparent; color: var(--text-muted);'}" onclick="POSView.setDocType('boleta')">📄 BOLETA (CON IVA)</button>
                            <button id="docInternoBtn" class="btn btn-sm btn-doc-toggle" style="${this.selectedDocType === 'sin_boleta' || this.selectedDocType === 'interno' ? 'background: var(--warning); color: white; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.4);' : 'background: transparent; color: var(--text-muted);'}" onclick="POSView.setDocType('sin_boleta')">🏠 INTERNO (SIN IVA)</button>
                        </div>
                    </div>

                    ${isCustomerSelected ? `
                    <div class="payment-customer-badge" style="height: auto; min-height: 60px; padding: 1rem 1.25rem; display: flex; align-items: flex-start; gap: 1rem; margin-bottom: 1rem;">
                        <div class="payment-customer-icon" style="margin-top: 0.15rem; font-size: 1.6rem;">👤</div>
                        <div class="payment-customer-info">
                            <div class="payment-customer-label" style="font-size: 0.7rem; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.2rem;">Cliente Seleccionado</div>
                            <div class="payment-customer-name" style="font-size: 1.15rem; font-weight: 900; color: var(--text-color);">${safeHTML(customer.name)}</div>
                            ${(parseFloat(customer.totalDebt) || 0) > 0 ? `
                            <div id="payment-customer-debt-toggle" style="margin-top: 0.75rem; display: flex; align-items: center; gap: 0.75rem; background: rgba(100, 116, 139, 0.05); padding: 0.6rem 1rem; border-radius: 0.6rem; border: 1px solid #cbd5e1; cursor: pointer; transition: all 0.2s; width: 100%; box-sizing: border-box;" onclick="const chk = document.getElementById('include_previous_debt'); if (event.target !== chk && event.target.tagName !== 'LABEL') { chk.checked = !chk.checked; chk.dispatchEvent(new Event('change')); }">
                                <input type="checkbox" id="include_previous_debt" style="width: 18px; height: 18px; cursor: pointer; margin: 0;" onchange="if(typeof POSView._updateModalUI === 'function') POSView._updateModalUI();">
                                <label for="include_previous_debt" id="include_previous_debt_label" style="font-weight: 800; color: #64748b; cursor: pointer; font-size: 0.85rem; margin: 0; user-select: none; flex: 1; display: flex; justify-content: space-between; align-items: center;">
                                    <span>Incluir deuda anterior</span>
                                    <strong style="font-size: 1rem; margin-left: 0.5rem; color: var(--danger); font-weight: 900;">+ ${formatCLP(customer.totalDebt)}</strong>
                                </label>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    ` : ''}

                    <div class="payment-method-card" id="card_cash">
                        <div class="payment-icon" style="background: var(--info-bg); color: var(--info-text);">💵</div>
                        <div class="payment-method-body">
                            <div class="payment-method-header">
                                <div class="payment-method-label">EFECTIVO</div>
                                <button class="btn-fill-diff" onclick="POSView.fillAmount('pay_cash')">TODO</button>
                            </div>
                            <input type="number" id="pay_cash" class="pay-input-pro pay-input" placeholder="0" data-rounding="true" value="${initialMethod === 'cash' ? roundedTotal : ''}">
                        </div>
                    </div>

                    <div class="payment-method-card" id="card_card">
                        <div class="payment-icon" style="background: var(--success-bg); color: var(--success-text);">💳</div>
                        <div class="payment-method-body">
                            <div class="payment-method-header">
                                <div class="payment-method-label">TARJETA / QR</div>
                                <button class="btn-fill-diff" onclick="POSView.fillAmount('pay_card')">TODO</button>
                            </div>
                            <input type="number" id="pay_card" class="pay-input-pro pay-input" placeholder="0" value="${initialMethod === 'card' ? total : ''}">
                        </div>
                    </div>

                    <div class="payment-method-card" id="card_other">
                        <div class="payment-icon" style="background: var(--warning-bg); color: var(--warning-text);">🏦</div>
                        <div class="payment-method-body">
                            <div class="payment-method-header">
                                <div class="payment-method-label">TRANSFERENCIA</div>
                                <button class="btn-fill-diff" onclick="POSView.fillAmount('pay_other')">TODO</button>
                            </div>
                            <input type="number" id="pay_other" class="pay-input-pro pay-input" placeholder="0" value="${initialMethod === 'other' ? total : ''}">
                        </div>
                    </div>

                    ${isCustomerSelected ? `
                    <div class="payment-method-card" id="card_debt" style="border-color: var(--danger); background: var(--danger-bg);">
                        <div class="payment-icon" style="background: white; color: var(--danger);">📓</div>
                        <div class="payment-method-body">
                            <div class="payment-method-header">
                                <div class="payment-method-label" style="color: var(--danger-text);">ANOTAR DEUDA</div>
                                <button class="btn-fill-diff" onclick="POSView.fillAmount('pay_debt')" id="btn_fill_debt">[F4] DIFERENCIA</button>
                            </div>
                            <input type="number" id="pay_debt" class="pay-input-pro pay-input" style="color: var(--danger) !important;" placeholder="0" value="${initialMethod === 'debt' ? total : ''}">
                        </div>
                    </div>
                    
                    ${(parseFloat(customer.balanceCredit) || 0) > 0 && (parseFloat(customer.totalDebt) || 0) <= 0 ? `
                    <div class="payment-method-card" id="card_credit" style="border-color: var(--accent); background: var(--success-bg);">
                        <div class="payment-icon" style="background: white; color: var(--accent);">💰</div>
                        <div class="payment-method-body">
                            <div class="payment-method-header">
                                <div class="payment-method-label" style="color: var(--success-text);">USAR SALDO A FAVOR (${formatCLP(customer.balanceCredit)})</div>
                                <button class="btn-fill-diff" onclick="POSView.fillAmount('pay_credit')">TODO</button>
                            </div>
                            <input type="number" id="pay_credit" class="pay-input-pro pay-input" style="color: var(--success-text) !important;" placeholder="0">
                        </div>
                    </div>
                    ` : ''}
                    ` : ''}
                </div>

                <!-- Columna Derecha: Resumen y Acción -->
                <div class="payment-summary-card" id="paymentSummaryBox">
                    <div class="payment-summary-content">
                        <div class="payment-total-header">
                            <div class="payment-total-label">TOTAL A COBRAR</div>
                            <div id="modalTotalToPay" class="payment-total-value-huge">${formatCLP(total, true)}</div>
                        </div>

                        <div class="payment-summary-details">
                            <!-- DESGLOSE FISCAL DINÁMICO -->
                            <div id="modalFiscalBreakdown" class="modal-fiscal-breakdown">
                                <div class="fiscal-row">
                                    <span>Neto:</span>
                                    <strong id="modalNeto">$0</strong>
                                </div>
                                <div class="fiscal-row">
                                    <span>IVA (19%):</span>
                                    <strong id="modalIVA">$0</strong>
                                </div>
                            </div>

                            <div class="payment-status-section">
                                <div class="payment-status-label">Estado del Pago</div>
                                <div id="payment_status_text" class="payment-status-value">PENDIENTE</div>
                            </div>
                            
                            <hr class="payment-divider">

                            <div class="payment-summary-row">
                                <span class="summary-label">Recibido:</span>
                                <strong id="sum_paid" class="summary-value">${formatCLP(0, true)}</strong>
                            </div>

                            <div class="payment-summary-row">
                                <span id="diff_label" class="summary-label-big">Resta:</span>
                                <strong id="sum_diff" class="summary-value-huge">${formatCLP(total, true)}</strong>
                            </div>

                            <!-- Cálculo de vuelto automático -->
                            <div id="changeSection" style="display: none; margin-top: 1rem; padding: 1rem; background: #dcfce7; border: 2px solid #22c55e; border-radius: 0.75rem;">
                                <div style="font-size: 0.85rem; font-weight: 700; color: #166534; margin-bottom: 0.5rem;">💵 Vuelto a Entregar</div>
                                <div id="changeAmount" style="font-size: 1.5rem; font-weight: 800; color: #15803d;">$0</div>
                            </div>
                        </div>
                    </div>

                    <div class="payment-actions">
                        <button id="btn_process_payment" class="btn btn-primary btn-process-payment" disabled onclick="POSView.processUnifiedSale()">
                            CONFIRMAR VENTA
                        </button>
                    </div>
                </div>
            </div>
        `;

        const footer = `<button class="btn btn-outline-secondary" onclick="closeModal()">Cancelar</button>`;
        showModal(content, { title: '💰 Proceso de Pago', footer, width: '850px' });

        const inputs = document.querySelectorAll('.pay-input');
        const update = () => {
            // Verificamos si el modal sigue existiendo antes de intentar actualizar
            if (!document.getElementById('paymentSummaryBox')) {
                this._updateModalUI = null;
                return;
            }

            // Redefinir total y roundedTotal si se selecciona incluir deuda anterior
            const includeDebtChk = document.getElementById('include_previous_debt');
            const isPreviousDebtIncluded = includeDebtChk ? includeDebtChk.checked : false;
            const previousDebtAmount = isPreviousDebtIncluded && customer ? (parseFloat(customer.totalDebt) || 0) : 0;
            total = summary.total + previousDebtAmount;
            roundedTotal = summary.roundedTotal + previousDebtAmount;

            // Cambiar estilos del toggle de deuda dinámicamente para feedback visual premium
            const toggleContainer = document.getElementById('payment-customer-debt-toggle');
            const toggleLabel = document.getElementById('include_previous_debt_label');
            if (toggleContainer && includeDebtChk) {
                if (includeDebtChk.checked) {
                    toggleContainer.style.background = 'rgba(239, 68, 68, 0.08)';
                    toggleContainer.style.borderColor = 'var(--danger)';
                    if (toggleLabel) toggleLabel.style.color = 'var(--danger-text)';
                } else {
                    toggleContainer.style.background = 'rgba(100, 116, 139, 0.05)';
                    toggleContainer.style.borderColor = '#cbd5e1';
                    if (toggleLabel) toggleLabel.style.color = '#64748b';
                }
            }

            let totalIn = 0;
            let cash = 0, card = 0, other = 0, debt = 0, creditBalance = 0;
            let usedCard = false;
            let usedTransfer = false;

            inputs.forEach(input => {
                const val = parseFloat(input.value) || 0;
                totalIn += val;
                
                if (input.id === 'pay_cash') cash = val;
                if (input.id === 'pay_card') card = val;
                if (input.id === 'pay_other') other = val;
                if (input.id === 'pay_debt') debt = val;
                if (input.id === 'pay_credit') creditBalance = val;

                if (val > 0) {
                    if (input.id === 'pay_card') usedCard = true;
                    if (input.id === 'pay_other') usedTransfer = true;
                }
            });

            // AUTO-TOGGLE LOGIC
            // Si usa tarjeta -> Forzar Boleta (si no está ya)
            if (usedCard && this.selectedDocType !== 'boleta') {
                this.setDocType('boleta');
            } 
            // Si usa transferencia -> Forzar Interno (si no está ya Y no está usando tarjeta simultaneamente)
            else if (usedTransfer && !usedCard && this.selectedDocType === 'boleta') {
                this.setDocType('sin_boleta');
            }

            const diff = total - totalIn;
            const diffAbs = Math.abs(diff);

            const sumPaid = document.getElementById('sum_paid');
            const sumDiff = document.getElementById('sum_diff');
            const diffLabel = document.getElementById('diff_label');
            const statusText = document.getElementById('payment_status_text');
            const btn = document.getElementById('btn_process_payment');
            const summaryBox = document.getElementById('paymentSummaryBox');

            // UPDATE FISCAL BREAKDOWN
            const fiscal = posController.computeFiscalFromTotal(total, this.selectedDocType);
            const modalNeto = document.getElementById('modalNeto');
            const modalIVA = document.getElementById('modalIVA');
            const fiscalBox = document.getElementById('modalFiscalBreakdown');

            if (modalNeto) modalNeto.textContent = formatCLP(fiscal.base_amount);
            if (modalIVA) modalIVA.textContent = formatCLP(fiscal.tax_amount);
            
            if (this.selectedDocType === 'boleta') {
                if (fiscalBox) fiscalBox.style.display = 'block';
                if (summaryBox) summaryBox.style.background = 'linear-gradient(135deg, var(--primary) 0%, #4338ca 100%)';
            } else {
                if (fiscalBox) fiscalBox.style.display = 'none';
                if (summaryBox) summaryBox.style.background = 'linear-gradient(135deg, var(--warning) 0%, #d97706 100%)';
            }

            // Visual feedback on methods
            document.getElementById('card_card').style.opacity = (this.selectedDocType === 'sin_boleta') ? '0.5' : '1';
            document.getElementById('card_other').style.opacity = (this.selectedDocType === 'boleta') ? '0.5' : '1';

            if (sumPaid) sumPaid.textContent = formatCLP(totalIn, true);
            
            // LÓGICA DE REDONDEO (LEY 20.956)
            // Si hay efectivo, permitimos una diferencia de hasta 5 pesos (redondeo legal)
            const isCashOnly = cash > 0 && card === 0 && other === 0 && debt === 0 && creditBalance === 0;
            const currentTotalToMatch = isCashOnly ? roundedTotal : total;
            
            const diffMatch = currentTotalToMatch - totalIn;
            const diffAbsMatch = Math.abs(diffMatch);

            if (sumDiff) sumDiff.textContent = formatCLP(diffAbsMatch, true);

            // Cálculo de vuelto automático
            const changeSection = document.getElementById('changeSection');
            const changeAmount = document.getElementById('changeAmount');
            
            if (cash > 0 && totalIn > currentTotalToMatch) {
                const change = totalIn - currentTotalToMatch;
                if (changeSection) changeSection.style.display = 'block';
                if (changeAmount) changeAmount.textContent = formatCLP(change, true);
            } else {
                if (changeSection) changeSection.style.display = 'none';
            }

            const modalTotalDisplay = document.getElementById('modalTotalToPay');
            if (modalTotalDisplay) {
                modalTotalDisplay.textContent = formatCLP(currentTotalToMatch, true);
            }

            if (diff > 4.99 && diffAbsMatch > 0.99) {
                diffLabel.textContent = "Falta:";
                sumDiff.style.color = "var(--danger)";
                statusText.textContent = "PENDIENTE";
                statusText.style.color = "var(--danger)";
                btn.disabled = true;
            } else if (diff < -0.99) {
                diffLabel.textContent = "Vuelto:";
                sumDiff.style.color = "#000"; 
                statusText.textContent = "ENTREGAR VUELTO";
                statusText.style.color = "#fff";
                btn.disabled = false;
            } else {
                diffLabel.textContent = "Saldo:";
                sumDiff.style.color = "#fff";
                statusText.textContent = "LISTO PARA COBRAR";
                statusText.style.color = "#fff";
                btn.disabled = false;
            }
        };

        this._updateModalUI = update;
        inputs.forEach((input, index) => {
            input.addEventListener('input', update);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const totalIn = Array.from(inputs).reduce((sum, inv) => sum + (parseFloat(inv.value) || 0), 0);
                    const diff = total - totalIn;

                    if (Math.abs(diff) < 0.99) {
                        document.getElementById('btn_process_payment').focus();
                        // Opcional: auto-clic si el usuario prefiere velocidad extrema
                        // document.getElementById('btn_process_payment').click();
                    } else {
                        const next = inputs[index + 1];
                        if (next) {
                            next.focus();
                            next.select();
                        } else {
                            const btn = document.getElementById('btn_process_payment');
                            if (btn) btn.focus();
                        }
                    }
                }
            });
        });

        const includeDebtChk = document.getElementById('include_previous_debt');
        if (includeDebtChk) {
            includeDebtChk.addEventListener('change', update);
        }

        if (initialMethod) update();

        setTimeout(() => {
            const firstInput = document.getElementById(initialMethod ? `pay_${initialMethod}` : 'pay_cash');
            if (firstInput) {
                firstInput.focus();
                firstInput.select();
            }
        }, 150);
    },

    fillAmount(targetId) {
        const summary = posController.getCartSummary();
        const customer = posController.currentCustomer;
        
        const includeDebtChk = document.getElementById('include_previous_debt');
        const isPreviousDebtIncluded = includeDebtChk ? includeDebtChk.checked : false;
        const previousDebtAmount = isPreviousDebtIncluded && customer ? (parseFloat(customer.totalDebt) || 0) : 0;
        
        const total = summary.total + previousDebtAmount;
        const roundedTotal = summary.roundedTotal + previousDebtAmount;

        const inputIds = ['pay_cash', 'pay_card', 'pay_other', 'pay_debt', 'pay_credit'];
        let alreadyPaid = 0;

        inputIds.forEach(id => {
            if (id !== targetId) {
                const el = document.getElementById(id);
                if (el) alreadyPaid += parseFloat(el.value) || 0;
            }
        });

        const isCash = targetId === 'pay_cash';
        const targetTotal = isCash ? roundedTotal : total;
        const remaining = targetTotal - alreadyPaid;
        const target = document.getElementById(targetId);

        if (target) {
            if (remaining <= 0.01) {
                inputIds.forEach(id => {
                    if (id !== targetId) {
                        const el = document.getElementById(id);
                        if (el) el.value = '';
                    }
                });
                target.value = targetTotal;
            } else {
                target.value = remaining > 0 ? remaining : '';
            }
            target.dispatchEvent(new Event('input'));
            const btn = document.getElementById('btn_process_payment');
            if (btn) btn.focus();
        }
    },

    fillRemainingDebt(total) {
        const cash = parseFloat(document.getElementById('pay_cash').value) || 0;
        const card = parseFloat(document.getElementById('pay_card').value) || 0;
        const other = parseFloat(document.getElementById('pay_other').value) || 0;
        const credit = document.getElementById('pay_credit') ? (parseFloat(document.getElementById('pay_credit').value) || 0) : 0;
        const remaining = Math.max(0, total - (cash + card + other + credit));
        const debtInput = document.getElementById('pay_debt');
        if (debtInput) {
            debtInput.value = remaining;
            debtInput.dispatchEvent(new Event('input'));
        }
    },

    fillRemainingCredit(total) {
        const cash = parseFloat(document.getElementById('pay_cash').value) || 0;
        const card = parseFloat(document.getElementById('pay_card').value) || 0;
        const other = parseFloat(document.getElementById('pay_other').value) || 0;
        const debt = document.getElementById('pay_debt') ? (parseFloat(document.getElementById('pay_debt').value) || 0) : 0;
        const available = parseFloat(posController.currentCustomer.balanceCredit) || 0;
        const needed = Math.max(0, total - (cash + card + other + debt));
        const creditInput = document.getElementById('pay_credit');
        if (creditInput) {
            creditInput.value = Math.min(available, needed);
            creditInput.dispatchEvent(new Event('input'));
        }
    },

    async processUnifiedSale() {
        const summary = posController.getCartSummary();
        const total = summary.total;

        const cash = parseFloat(document.getElementById('pay_cash').value) || 0;
        const card = parseFloat(document.getElementById('pay_card').value) || 0;
        const other = parseFloat(document.getElementById('pay_other').value) || 0;
        const debt = document.getElementById('pay_debt') ? (parseFloat(document.getElementById('pay_debt').value) || 0) : 0;
        const creditBalance = document.getElementById('pay_credit') ? (parseFloat(document.getElementById('pay_credit').value) || 0) : 0;

        const totalIn = cash + card + other + debt + creditBalance;
        
        const includeDebtChk = document.getElementById('include_previous_debt');
        const isPreviousDebtIncluded = includeDebtChk ? includeDebtChk.checked : false;
        const customer = posController.currentCustomer;
        const oldDebt = isPreviousDebtIncluded && customer ? (parseFloat(customer.totalDebt) || 0) : 0;

        let salePaidDetails = { cash: 0, card: 0, other: 0, debt: 0, creditBalance: 0 };
        let paymentsToCreate = [];
        let calculatedChange = 0;
        let finalSaleTotal = summary.roundedTotal;

        if (isPreviousDebtIncluded && oldDebt > 0) {
            const remainingPayment = { cash, card, other, creditBalance };

            // 1. Pagar la venta actual primero
            let saleRemaining = summary.roundedTotal;
            const methodsOrder = ['creditBalance', 'cash', 'card', 'other'];
            for (const method of methodsOrder) {
                if (saleRemaining <= 0) break;
                const amount = Math.min(remainingPayment[method], saleRemaining);
                if (amount > 0) {
                    salePaidDetails[method] = amount;
                    remainingPayment[method] -= amount;
                    saleRemaining -= amount;
                }
            }
            if (saleRemaining > 0) {
                salePaidDetails.debt = saleRemaining;
            }

            // 2. Distribuir el excedente a las ventas pendientes anteriores
            const balance = await CustomerAccountService.getCustomerBalance(customer.id);
            const pendingSales = balance.pendingSales || [];
            
            const excessPayments = [];
            for (const method of methodsOrder) {
                const amt = remainingPayment[method];
                if (amt > 0) {
                    excessPayments.push({ method, amount: amt });
                }
            }

            for (const excess of excessPayments) {
                let remainingExcess = excess.amount;
                for (const pendingSale of pendingSales) {
                    if (remainingExcess <= 0) break;
                    const pendingRemaining = parseFloat(pendingSale.remaining) || 0;
                    if (pendingRemaining <= 0) continue;

                    const payAmt = Math.min(pendingRemaining, remainingExcess);
                    if (payAmt > 0) {
                        paymentsToCreate.push({
                            saleId: pendingSale.saleId,
                            amount: payAmt,
                            paymentMethod: excess.method === 'creditBalance' ? 'credit' : (excess.method === 'other' ? 'other' : excess.method)
                        });
                        pendingSale.remaining = pendingRemaining - payAmt;
                        remainingExcess -= payAmt;
                    }
                }
                if (remainingExcess > 0) {
                    calculatedChange += remainingExcess;
                }
            }

            const totalInForNewSale = salePaidDetails.cash + salePaidDetails.card + salePaidDetails.other + salePaidDetails.creditBalance + salePaidDetails.debt;
            finalSaleTotal = (totalInForNewSale > summary.roundedTotal) ? summary.roundedTotal : totalInForNewSale;
        } else {
            salePaidDetails = { cash, card, other, debt, creditBalance };
            calculatedChange = Math.max(0, totalIn - summary.roundedTotal);
            finalSaleTotal = (totalIn > summary.roundedTotal) ? summary.roundedTotal : totalIn;
            
            if (calculatedChange > 0 && cash > 0) {
                salePaidDetails.cash = Math.max(0, cash - calculatedChange);
            }
        }

        // Determine method name for history based on salePaidDetails
        let mainMethod = 'mixed';
        const scash = salePaidDetails.cash;
        const scard = salePaidDetails.card;
        const sother = salePaidDetails.other;
        const sdebt = salePaidDetails.debt;
        const scred = salePaidDetails.creditBalance;
        
        if (scash > 0 && scard === 0 && sother === 0 && sdebt === 0 && scred === 0) mainMethod = 'cash';
        else if (scard > 0 && scash === 0 && sother === 0 && sdebt === 0 && scred === 0) mainMethod = 'card';
        else if (sdebt > 0 && scash === 0 && scard === 0 && sother === 0 && scred === 0) mainMethod = 'pending';

        // Boleta forzada si hay tarjeta (opcional, según requerimiento de usuario)
        // El usuario pidió separar ventas, pero legalmente la tarjeta suele implicar boleta.
        // Lo mantendremos para consistencia a menos que se elija expresamente Interno.
        let docType = this.selectedDocType;
        if (card > 0 && docType !== 'sin_boleta') docType = 'boleta';

        try {
            const isDebtOnly = salePaidDetails.debt > 0 && (scash + scard + sother + scred) === 0;
            
            const sale = await posController.completeSale(mainMethod, isDebtOnly, salePaidDetails, docType, finalSaleTotal);
            
            // Registrar los pagos de abono a deuda anterior en la base de datos
            if (paymentsToCreate.length > 0) {
                try {
                    for (const p of paymentsToCreate) {
                        await Payment.create({
                            saleId: p.saleId,
                            customerId: customer.id,
                            amount: p.amount,
                            paymentMethod: p.paymentMethod,
                            notes: `Abono de deuda junto con Venta #${sale.saleNumber}`
                        });
                    }
                    if (typeof db !== 'undefined' && db.clearCache) {
                        db.clearCache('customers');
                        db.clearCache('sales');
                        db.clearCache('payments');
                    }
                } catch (paymentErr) {
                    console.error('Error registrando abonos de deuda:', paymentErr);
                    showNotification('Venta registrada, pero ocurrió un error al abonar la deuda anterior: ' + paymentErr.message, 'warning');
                }
            }

            // C10: Limpiar la pantalla INMEDIATAMENTE después de la venta exitosa
            // No esperamos a que el recibo se cierre para dejar el POS listo para el siguiente.
            this.startNewSale();
            this.updateRecentSalesUI();
            closeModal();
            
            // Mostrar recibo con el monto total entregado y el vuelto calculado
            this.showSaleReceipt(sale, salePaidDetails.debt > 0, totalIn, calculatedChange);
        } catch (e) {
            showNotification(e.message, 'error');
        }
    },

    // Note: showMixedPaymentModal and completeSalePending were replaced by showPaymentModal

    showSaleReceipt(sale, isPending = false, tendered = null, change = null) {
        // Guardar referencia para copias
        this.lastSale = sale;
        this.lastTendered = tendered;
        this.lastChange = change;

        // Imprimir automáticamente por Bluetooth si está configurado
        const printerPort = localStorage.getItem('printerPort') || 'USB';
        const autoPrintTicket = localStorage.getItem('autoPrintTicket') === 'true';
        if (printerPort === 'bluetooth' && autoPrintTicket) {
            this.printBluetoothSale(sale, tendered, change);
        }

        // Usar los datos fiscales ya guardados en la venta (que consideran el docType)
        const fiscal = {
            base_amount: sale.base_amount,
            tax_amount: sale.tax_amount,
            commission_amount: sale.commission_amount
        };
        const content = `
            <div class="receipt-pro">
                <div class="receipt-header">
                    <h2>COMPROBANTE</h2>
                    <div class="receipt-folio">Folio #${sale.saleNumber}</div>
                    <p class="receipt-date">${formatDateTime(sale.date)}</p>
                </div>
                
                <div class="receipt-body">
                    <div class="receipt-total-row">
                        <span>Total:</span>
                        <span class="receipt-total-val">${formatCLP(sale.total)}</span>
                    </div>

                    <hr class="receipt-divider">
                    
                    <div class="receipt-details">
                        <div class="receipt-detail-item">
                            <span>Neto:</span>
                            <span>${formatCLP(fiscal.base_amount)}</span>
                        </div>
                        <div class="receipt-detail-item">
                            <span>IVA (19%):</span>
                            <span>${formatCLP(fiscal.tax_amount)}</span>
                        </div>
                    </div>
                </div>

                <div class="receipt-payment-info">
                    <div class="receipt-payment-method">
                        <span>Pago:</span>
                        <strong>${this.getPaymentMethodName(sale.paymentMethod)}</strong>
                    </div>
                    
                    ${sale.paymentDetails ? `
                        <div class="receipt-payment-breakdown">
                            ${Object.entries(sale.paymentDetails).filter(([, v]) => parseFloat(v) > 0).map(([k, v]) => `
                                <div class="breakdown-item">
                                    <span>${this.getPaymentMethodName(k)}:</span>
                                    <span>${formatCLP(v)}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}

                    ${tendered && (tendered > sale.total) ? `
                    <div class="receipt-payment-method">
                        <span>Entregado:</span>
                        <strong class="text-success">${formatCLP(tendered)}</strong>
                    </div>` : ''}
                    
                    ${change && change > 0 ? `
                    <div class="receipt-payment-method">
                        <span>Vuelto:</span>
                        <strong class="text-danger">${formatCLP(change)}</strong>
                    </div>` : ''}
                </div>
                
                <div class="receipt-footer">
                    <div class="receipt-thanks">✨ ¡Gracias por su compra!</div>
                    <div class="receipt-auto-close">
                        Cerrando en <span id="timer">5</span>s...
                    </div>
                </div>

                <div style="margin-top: 1.5rem;">
                    <button class="btn btn-sm btn-outline-secondary w-100" onclick="POSView.printReceiptCopy()">🖨️ IMPRIMIR COPIA</button>
                </div>
            </div>
        `;
        showModal(content, { title: 'Recibo de Venta', width: '400px' });

        let sec = 5;
        const intrvl = setInterval(() => {
            sec--;
            if (document.getElementById('timer')) document.getElementById('timer').textContent = sec;
            if (sec <= 0) { clearInterval(intrvl); closeModal(); }
        }, 1000);
    },

    async selectCustomer() {
        showNotification('Cargando clientes...', 'info');
        
        // C10: Limpiar caché local de clientes para asegurar que vemos los saldos reales
        if (typeof db !== 'undefined' && db.clearCache) db.clearCache('customers');
        
        // RENDIMIENTO: Usar nuevo endpoint optimizado que trae todo en una sola query del servidor
        // Reemplaza Customer.getAll + N getCustomerBalance + Sale.getByDateRange(90d)
        // RENDIMIENTO: Usar nuevo endpoint optimizado con cache-buster para evitar datos viejos
        const listWithBalances = await window.ApiClient.get(`customers/pos/summary?_=${Date.now()}`);
        
        if (!Array.isArray(listWithBalances)) {
            console.error('Error al cargar resumen de clientes:', listWithBalances);
            showNotification('Error al cargar clientes del servidor', 'error');
            return;
        }

        // Obtener IDs de clientes top basados en el volumen que ya trajo el servidor
        const topVolumeIds = [...listWithBalances]
            .sort((a, b) => (b.volume90d || 0) - (a.volume90d || 0))
            .slice(0, 5)
            .map(c => c.id);

        const content = `
            <div class="customer-modal-container">
                <div class="customer-search-wrapper">
                    <span class="customer-search-icon">🔍</span>
                    <input type="text" id="cSearch" class="customer-search-input" placeholder="Escribir nombre del cliente..." autofocus>
                </div>

                <div id="cList" class="customer-list-pro">
                    ${this.renderCustomerList(listWithBalances, topVolumeIds)}
                </div>

                <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                    <button class="btn btn-xl btn-primary" style="flex: 2;" onclick="POSView.showCreateCustomerForm()">
                        ➕ NUEVO CLIENTE
                    </button>
                    <button class="btn btn-xl btn-outline-secondary" style="flex: 1;" onclick="closeModal()">
                        CERRAR
                    </button>
                </div>
            </div>
        `;
        showModal(content, { title: 'Selección de Clientes', width: '650px' });

        this.customerResults = listWithBalances;
        this.customerSelectedIndex = this.customerResults.length > 0 ? 0 : -1;

        const cSearch = document.getElementById('cSearch');
        if (cSearch) {
            setTimeout(() => {
                cSearch.focus();
                cSearch.select();
            }, 100);
        }
        const cList = document.getElementById('cList');
        const renderAndFocusSelected = () => {
            if (!cList) return;
            cList.innerHTML = this.renderCustomerList(this.customerResults, topVolumeIds, this.customerSelectedIndex);
            const active = cList.querySelector('.customer-card-pro.selected');
            if (active) active.scrollIntoView({ block: 'nearest' });
        };

        renderAndFocusSelected();

        cSearch.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            this.customerResults = listWithBalances.filter(c => c.name.toLowerCase().includes(term));
            this.customerSelectedIndex = this.customerResults.length > 0 ? 0 : -1;
            renderAndFocusSelected();
        });

        cSearch.addEventListener('keydown', (e) => {
            if (!this.customerResults || this.customerResults.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.customerSelectedIndex = Math.min(this.customerSelectedIndex + 1, this.customerResults.length - 1);
                renderAndFocusSelected();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.customerSelectedIndex = Math.max(this.customerSelectedIndex - 1, 0);
                renderAndFocusSelected();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (this.customerSelectedIndex >= 0) {
                    const selected = this.customerResults[this.customerSelectedIndex];
                    if (selected) this.setCustomer(selected.id);
                }
            }
        });
    },

    renderCustomerList(list, topIds = [], selectedIndex = -1) {
        if (list.length === 0) return `<div style="padding: 3rem; text-align: center; opacity: 0.5;">No hay resultados</div>`;

        return list.map((c, index) => {
            const debt = c.totalDebt || 0;
            const credit = c.balanceCredit || 0;
            const balance = c.displayBalance || 0;
            const isTop = topIds.includes(c.id);
            const isSelected = index === selectedIndex;

            let statusClass = 'badge-clean';
            let statusText = 'Al Día';
            let cardClass = '';

            if (balance > 0) {
                statusClass = 'badge-debt';
                statusText = 'Con Deuda';
                cardClass = 'has-debt';
            } else if (balance < 0) {
                statusClass = 'badge-credit';
                statusText = 'Con Saldo';
                cardClass = 'has-credit';
            }

            return `
                <div class="customer-card-pro ${cardClass} ${isTop ? 'is-top' : ''} ${isSelected ? 'selected' : ''}" 
                     data-customer-id="${c.id}"
                     onclick="POSView.setCustomer('${c.id}')">
                    ${isTop ? `<div class="badge-top">⭐️ TOP</div>` : ''}
                    
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <div class="customer-avatar">${balance > 0 ? '📉' : '👤'}</div>
                        <div>
                            <div style="font-weight: 800; font-size: 1.15rem; color: #1e293b;">${safeHTML(c.name)}</div>
                            <span class="customer-badge ${statusClass}">${statusText}</span>
                        </div>
                    </div>

                    <div style="text-align: right;">
                        ${debt > 0 ? `<div style="font-size: 1.25rem; font-weight: 950; color: var(--danger);">${formatCLP(debt)}</div><small style="opacity:0.6; font-weight:800; text-transform:uppercase; font-size: 0.65rem; color: var(--danger);">DEUDA</small>` : ''}
                        ${credit > 0 ? `<div style="font-size: 1.25rem; font-weight: 950; color: var(--success);">${formatCLP(credit)}</div><small style="opacity:0.6; font-weight:800; text-transform:uppercase; font-size: 0.65rem; color: var(--success);">SALDO A FAVOR</small>` : ''}
                        ${debt === 0 && credit === 0 ? `<div style="font-weight: 700; color: var(--text-muted);">$0</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    },

    async setCustomer(id) {
        // Forzar obtención de datos frescos del servidor, no de la caché local
        const customer = await Customer.getById(id);
        const bal = await CustomerAccountService.getCustomerBalance(id);
        
        // Sincronizar el objeto customer con el balance real calculado
        customer.totalDebt = bal.totalDebt;
        customer.balanceCredit = bal.balanceCredit;
        
        posController.setCustomer(customer);
        const debt = bal.displayBalance || 0;

        const infoEl = document.getElementById('customerInfo');
        if (infoEl) {
            infoEl.innerHTML = `
                <div style="background: var(--primary-soft); border: 2.5px solid var(--primary); padding: 0.5rem 1.25rem; border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center; height: 60px; min-width: 250px; box-shadow: var(--shadow-sm);">
                    <div style="overflow: hidden; flex: 1;">
                        <strong style="color: var(--primary); font-size: 1rem; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 900;">👤 ${safeHTML(customer.name)}</strong>
                        <div style="display: flex; gap: 0.5rem; align-items: center;">
                            ${(customer.totalDebt > 0) 
                                ? `<span style="color: var(--danger); font-size: 0.75rem; font-weight: 900; background: var(--danger-bg); padding: 0.1rem 0.5rem; border-radius: 0.5rem; border: 1.5px solid var(--danger);">DEUDA: ${formatCLP(customer.totalDebt)}</span>` 
                                : (customer.balanceCredit > 0)
                                    ? `<span style="color: var(--success); font-size: 0.75rem; font-weight: 900; background: var(--success-bg); padding: 0.1rem 0.5rem; border-radius: 0.5rem; border: 1.5px solid var(--success);">SALDO A FAVOR: ${formatCLP(customer.balanceCredit)}</span>`
                                    : '<span style="color: var(--success); font-size: 0.75rem; font-weight: 900; background: var(--success-bg); padding: 0.1rem 0.5rem; border-radius: 0.5rem; border: 1.5px solid var(--success);">AL DÍA ✅</span>'
                            }
                        </div>
                    </div>
                    <button class="btn btn-sm btn-outline-danger" style="padding: 0.4rem; margin-left: 0.75rem;" onclick="POSView.removeCustomer()" title="Quitar Cliente">✕</button>
                </div>
            `;
        }
        this.toggleFiarButton(true);
        closeModal();
    },

    removeCustomer() {
        posController.setCustomer(null);
        const infoEl = document.getElementById('customerInfo');
        if (infoEl) {
            infoEl.innerHTML = `
                <button class="btn btn-outline-primary" style="height: 48px; min-width: 240px; font-size: 0.9rem; font-weight: 800; border-radius: 0.75rem; border-width: 2px;" onclick="POSView.selectCustomer()">
                    (F3) 👤 SELECCIONAR CLIENTE
                </button>
            `;
        }
        this.toggleFiarButton(false);
    },

    toggleFiarButton(enable) {
        const btn = document.getElementById('fiarButton');
        if (btn) {
            // Ya no lo deshabilitamos para poder mostrar el mensaje de "Seleccionar Cliente" al hacer clic
            btn.disabled = false;

            if (enable) {
                btn.style.background = 'rgba(245, 158, 11, 0.25)';
                btn.style.borderColor = '#fbbf24';
                btn.style.color = '#fff';
                btn.style.boxShadow = '0 0 15px rgba(245, 158, 11, 0.3)';
                btn.style.opacity = '1';
                btn.style.transform = 'scale(1.02)';
            } else {
                btn.style.background = 'rgba(245, 158, 11, 0.05)';
                btn.style.borderColor = 'rgba(245, 158, 11, 0.2)';
                btn.style.color = 'rgba(251, 191, 36, 1)'; // Más visible para que se note que se puede clickear
                btn.style.boxShadow = 'none';
                btn.style.opacity = '0.7';
                btn.style.transform = 'scale(1)';
            }
        }
    },

    startNewSale() {
        posController.clearCart();
        this.removeCustomer();
        this.updateCart();
        this.updateRecentSalesUI();
        setTimeout(() => this.focusSearch(), 150);
    },

    showCreateCustomerForm() {
        const content = `
            <div class="modal-form-header">
                <h2>Nuevo Cliente</h2>
                <p>Ingresa los datos del cliente para su registro</p>
            </div>
            <div class="form-group" style="margin-bottom: 1rem;">
                <label style="font-weight: 700; color: var(--text-muted); margin-bottom: 0.25rem; display: block;">Nombre Completo:</label>
                <input type="text" id="nCust" class="form-control" placeholder="Ej: Juan Pérez" autofocus>
            </div>
            <div class="form-group">
                <label style="font-weight: 700; color: var(--text-muted); margin-bottom: 0.25rem; display: block;">Teléfono / WhatsApp:</label>
                <input type="tel" id="pCust" class="form-control" placeholder="+56 9 ...">
            </div>
        `;
        const footer = `<button class="btn btn-primary" onclick="POSView.saveNewCustomer()">Crear</button>`;
        showModal(content, { title: 'Nuevo Cliente', footer });
    },

    async saveNewCustomer() {
        const name = document.getElementById('nCust').value;
        if (!name) return;
        const id = await Customer.create({ name, phone: document.getElementById('pCust').value });
        this.setCustomer(id);
    },

    async useCreditBalance() {
        const bal = await Customer.getAccountBalance(posController.currentCustomer.id);
        const cred = Math.max(0, -(bal.displayBalance || 0));
        if (cred > 0) {
            posController.setCreditBalance(cred);
            this.updateCart();
        }
    },

    holdCurrentSale() {
        if (posController.cart.length === 0) {
            showNotification('El carrito está vacío', 'warning');
            return;
        }

        const currentCustomer = posController.currentCustomer;
        const defaultName = currentCustomer ? currentCustomer.name : '';

        const content = `
            <div class="form-group">
                <label>Identificador de la Venta:</label>
                <input type="text" id="heldSaleName" class="form-control" placeholder="Ej: Mesa 5, Juan Perez, Pedido llevar..." value="${defaultName}" autofocus>
            </div>
        `;


        const footer = `
            <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-warning" onclick="POSView.processHoldSale(document.getElementById('heldSaleName').value)">⏸️ Poner en Espera</button>
        `;

        showModal(content, { title: 'Pausar Venta', footer, width: '400px' });

        const input = document.getElementById('heldSaleName');
        setTimeout(() => input.focus(), 100);

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.processHoldSale(input.value);
            }
        });
    },

    processHoldSale(name) {
        try {
            // Si el nombre viene vacío, generamos el automático (Cliente X + Hora)
            let finalName = name.trim();
            if (!finalName) {
                let customerBaseName = 'Cliente';
                if (posController.currentCustomer) {
                    customerBaseName = posController.currentCustomer.name;
                }

                // Contar cuántas ventas ya existen en heldSales con ese nombre base para asignar el siguiente número
                // Solo si es un cliente genérico "Cliente", buscamos el número correlativo
                if (!posController.currentCustomer) {
                    const clientPattern = /^Cliente (\d+)/;
                    let maxNum = 0;

                    posController.heldSales.forEach(sale => {
                        const match = sale.name.match(clientPattern);
                        if (match) {
                            const num = parseInt(match[1]);
                            if (num > maxNum) maxNum = num;
                        }
                    });

                    customerBaseName = `Cliente ${maxNum + 1}`;
                }

                const currentTime = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
                finalName = `${customerBaseName} ${currentTime}`;
            }

            posController.holdSale(finalName);
            closeModal();
            this.startNewSale();
            showNotification(`Venta "${finalName}" puesta en espera`, 'info');
        } catch (e) {
            showNotification(e.message, 'error');
        }
    },

    showHeldSales() {
        if (posController.heldSales.length === 0) {
            showNotification('No hay ventas en espera', 'info');
            return;
        }

        const content = `
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                ${posController.heldSales.map(s => {
            const total = s.cart.reduce((sum, item) => sum + item.total, 0);
            const itemsCount = s.cart.length;
            return `
                        <div style="background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(255,255,255,0.05); border-radius: 0.75rem; padding: 1rem; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s;" onmouseover="this.style.background='rgba(51, 65, 85, 0.4)'" onmouseout="this.style.background='rgba(30, 41, 59, 0.4)'">
                            <div style="flex: 1;">
                                <div style="font-size: 1.1rem; font-weight: bold; color: #fff; margin-bottom: 0.25rem;">${safeHTML(s.name)}</div>
                                <div style="font-size: 0.85rem; color: #94a3b8; display: flex; gap: 1rem;">
                                    <span>🕒 ${formatTime(s.timestamp)}</span>
                                    <span>📦 ${itemsCount} items</span>
                                    <span style="color: #6ee7b7; font-weight: bold;">${formatCLP(total)}</span>
                                </div>
                                ${s.customer ? `<div style="font-size: 0.8rem; color: #60a5fa; margin-top: 0.25rem;">👤 Cliente: ${safeHTML(s.customer.name)}</div>` : ''}
                            </div>
                            <div style="display: flex; gap: 0.5rem;">
                                <button class="btn btn-sm btn-danger" onclick="POSView.deleteHeldSale(${s.id})" title="Eliminar definitivamente">🗑️</button>
                                <button class="btn btn-sm btn-primary" onclick="POSView.resumeHeldSale(${s.id})" style="padding: 0.5rem 1rem;">Recuperar</button>
                            </div>
                        </div>
                    `;
        }).join('')}
            </div>
        `;
        showModal(content, { title: 'Ventas en Espera', width: '600px' });
    },

    deleteHeldSale(id) {
        showConfirm('¿Estás seguro de eliminar esta venta en espera?', () => {
            posController.deleteHeldSale(id);
            this.updateCart(); // Para actualizar el badge
            this.showHeldSales(); // Refrescar modal
        });
    },

    resumeHeldSale(id) {
        posController.resumeSale(id);
        this.updateCart();
        closeModal();
        // Restore customer UI if the held sale had a customer
        if (posController.currentCustomer) {
            this.setCustomer(posController.currentCustomer.id);
        } else {
            this.removeCustomer();
        }
    },

    toggleFiscal() {
        const panel = document.getElementById('fiscalBreakdown');
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
    },

    getPaymentMethodName(method) {
        const names = {
            'cash': 'Efectivo',
            'card': 'Tarjeta',
            'qr': 'QR',
            'pending': 'Pendiente (Fiar)',
            'mixed': 'Pago Mixto',
            'other': 'Transferencia',
            'debt': 'A Cuenta (Deuda)',
            'creditBalance': 'Saldo a Favor'
        };
        return names[method] || method;
    },

    toggleQuickMode() {
        this.isQuickMode = !this.isQuickMode;
        const btn = document.getElementById('quickModeBtn');
        const searchContainer = document.querySelector('.pos-search-bar');
        const cartPanel = document.querySelector('.pos-cart-panel');

        if (this.isQuickMode) {
            // Activar modo caja rápida
            if (btn) {
                btn.textContent = '⚡ Caja Rápida (ON)';
                btn.classList.remove('btn-outline-success');
                btn.classList.add('btn-success');
            }
            
            // Ocultar búsqueda de productos
            if (searchContainer) searchContainer.style.display = 'none';
            
            // Mostrar formulario de venta rápida
            this.showQuickSaleForm();
        } else {
            // Desactivar modo caja rápida
            if (btn) {
                btn.textContent = '⚡ Caja Rápida';
                btn.classList.remove('btn-success');
                btn.classList.add('btn-outline-success');
            }
            
            // Mostrar búsqueda de productos
            if (searchContainer) searchContainer.style.display = 'block';
            
            // Ocultar formulario de venta rápida
            this.hideQuickSaleForm();
        }
    },

    showQuickSaleForm() {
        const cartPanel = document.querySelector('.pos-cart-panel');
        if (!cartPanel) return;

        const quickFormHTML = `
            <div id="quickSaleForm" style="padding: 1.5rem; background: #f9fafb; border: 2px solid #10b981; border-radius: 0.75rem; margin-bottom: 1rem;">
                <h4 style="margin: 0 0 1rem 0; color: #065f46; font-size: 1rem; font-weight: 700;">⚡ Venta Rápida (Sin Inventario)</h4>
                <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 0.75rem;">
                    <div>
                        <label style="font-size: 0.85rem; font-weight: 600; color: #374151; margin-bottom: 0.25rem; display: block;">Descripción</label>
                        <input type="text" id="quickDescription" class="form-control" placeholder="Ej: Pan, Clavos, Servicio..." style="font-size: 0.95rem;">
                    </div>
                    <div>
                        <label style="font-size: 0.85rem; font-weight: 600; color: #374151; margin-bottom: 0.25rem; display: block;">Cantidad</label>
                        <input type="number" id="quickQuantity" class="form-control" value="1" min="1" style="font-size: 0.95rem;">
                    </div>
                    <div>
                        <label style="font-size: 0.85rem; font-weight: 600; color: #374151; margin-bottom: 0.25rem; display: block;">Precio</label>
                        <input type="number" id="quickPrice" class="form-control" placeholder="0" min="0" style="font-size: 0.95rem;">
                    </div>
                </div>
                <button type="button" class="btn btn-success" style="margin-top: 1rem; width: 100%; padding: 0.75rem; font-weight: 600; font-size: 0.95rem;" onclick="POSView.addQuickSaleItem()">
                    ➕ Agregar al Carrito
                </button>
            </div>
        `;

        cartPanel.insertAdjacentHTML('beforebegin', quickFormHTML);
        
        // Enfocar en descripción
        setTimeout(() => {
            const input = document.getElementById('quickDescription');
            if (input) input.focus();
        }, 100);
    },

    hideQuickSaleForm() {
        const quickForm = document.getElementById('quickSaleForm');
        if (quickForm) quickForm.remove();
    },

    addQuickSaleItem() {
        const description = document.getElementById('quickDescription').value.trim();
        const quantity = parseFloat(document.getElementById('quickQuantity').value) || 1;
        const price = parseFloat(document.getElementById('quickPrice').value) || 0;

        if (!description) {
            showNotification('Ingresa una descripción', 'error');
            return;
        }

        if (price <= 0) {
            showNotification('Ingresa un precio válido', 'error');
            return;
        }

        // Crear item de venta rápida (sin ID de producto)
        const quickItem = {
            id: null, // Sin ID de producto (no afecta inventario)
            name: description,
            quantity: quantity,
            price: price,
            total: quantity * price,
            isQuickSale: true // Marcador para identificar venta rápida
        };

        posController.addToCart(quickItem);
        showNotification('Producto agregado', 'success');

        // Limpiar formulario
        document.getElementById('quickDescription').value = '';
        document.getElementById('quickQuantity').value = '1';
        document.getElementById('quickPrice').value = '';
        document.getElementById('quickDescription').focus();
    },

    async loadProductSuggestions() {
        try {
            const cart = posController.cart || [];
            if (cart.length === 0) {
                document.getElementById('productSuggestions').style.display = 'none';
                return;
            }

            // Obtener IDs de productos en el carrito
            const cartProductIds = cart.map(item => item.id).filter(id => id !== null);
            
            if (cartProductIds.length === 0) {
                document.getElementById('productSuggestions').style.display = 'none';
                return;
            }

            // Obtener historial de ventas para encontrar productos comprados juntos
            const allSales = await Sale.getAll();
            const productPairs = {};

            allSales.forEach(sale => {
                if (sale.items && Array.isArray(sale.items)) {
                    const saleProductIds = sale.items.map(item => item.id).filter(id => id !== null);
                    
                    // Para cada producto en el carrito, encontrar qué otros productos se compraron con él
                    cartProductIds.forEach(cartId => {
                        if (saleProductIds.includes(cartId)) {
                            saleProductIds.forEach(saleId => {
                                if (saleId !== cartId) {
                                    const key = `${cartId}-${saleId}`;
                                    productPairs[key] = (productPairs[key] || 0) + 1;
                                }
                            });
                        }
                    });
                }
            });

            // Obtener los productos más frecuentemente comprados juntos
            const sortedPairs = Object.entries(productPairs)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3); // Top 3 sugerencias

            if (sortedPairs.length === 0) {
                document.getElementById('productSuggestions').style.display = 'none';
                return;
            }

            // Obtener detalles de los productos sugeridos
            const suggestedProductIds = sortedPairs.map(([key]) => parseInt(key.split('-')[1]));
            const allProducts = await Product.getAll();
            const suggestedProducts = allProducts.filter(p => 
                suggestedProductIds.includes(p.id) && 
                !cart.some(item => item.id === p.id) && // No sugerir productos ya en el carrito
                (p.stock || 0) > 0 // Solo sugerir productos con stock
            );

            if (suggestedProducts.length === 0) {
                document.getElementById('productSuggestions').style.display = 'none';
                return;
            }

            // Mostrar sugerencias
            const suggestionsList = document.getElementById('suggestionsList');
            suggestionsList.innerHTML = suggestedProducts.map(product => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: white; border: 1px solid #bfdbfe; border-radius: 0.5rem;">
                    <div>
                        <span style="font-weight: 600; color: #1e40af; font-size: 0.9rem;">${product.name}</span>
                        <span style="color: #64748b; font-size: 0.85rem; margin-left: 0.5rem;">${formatCLP(product.price)}</span>
                    </div>
                    <button type="button" class="btn btn-xs btn-primary" onclick="POSView.addSuggestedProduct(${product.id})">
                        ➕ Agregar
                    </button>
                </div>
            `).join('');

            document.getElementById('productSuggestions').style.display = 'block';

        } catch (error) {
            console.error('[POS] Error cargando sugerencias:', error);
        }
    },

    async addSuggestedProduct(productId) {
        try {
            const product = await Product.getById(productId);
            if (!product) return;

            posController.addToCart({
                id: product.id,
                name: product.name,
                quantity: 1,
                price: product.price,
                total: product.price
            });

            showNotification(`${product.name} agregado`, 'success');
            this.loadProductSuggestions(); // Recargar sugerencias
            this.updateCart();

        } catch (error) {
            console.error('[POS] Error agregando producto sugerido:', error);
            showNotification('Error al agregar producto', 'error');
        }
    },

    toggleNumericKeypad() {
        const keypad = document.getElementById('numericKeypad');
        if (keypad) {
            keypad.style.display = keypad.style.display === 'none' ? 'block' : 'none';
        }
    },

    numericKeypadInput(value) {
        const searchInput = document.getElementById('productSearch');
        if (!searchInput) return;

        if (value === 'backspace') {
            searchInput.value = searchInput.value.slice(0, -1);
        } else {
            searchInput.value += value;
        }

        // Trigger search event
        searchInput.dispatchEvent(new Event('input'));
        searchInput.focus();
    },

    async suggestProduct() {
        showNotification('Escribe el nombre del producto para buscar sugerencias', 'info');
        const searchInput = document.getElementById('productSearch');
        if (searchInput) {
            searchInput.focus();
        }
    },

    async printBluetoothSale(sale, tendered = null, change = null) {
        const businessName = localStorage.getItem('ticketBusinessName') || 'POS LAKURVA';
        const address = localStorage.getItem('ticketAddress') || '';
        const phone = localStorage.getItem('ticketPhone') || '';
        const footerMsg = localStorage.getItem('ticketFooter') || '¡Gracias por su compra!';
        
        let text = `================================\n`;
        text += `${businessName.toUpperCase()}\n`;
        if (address) text += `${address}\n`;
        if (phone) text += `${phone}\n`;
        text += `================================\n`;
        text += `Folio: #${sale.saleNumber}\n`;
        text += `Fecha: ${formatDateTime(sale.date)}\n`;
        text += `--------------------------------\n`;
        text += `Total Neto:       ${formatCLP(sale.base_amount).padStart(14)}\n`;
        text += `IVA (19%):        ${formatCLP(sale.tax_amount).padStart(14)}\n`;
        text += `--------------------------------\n`;
        text += `TOTAL:            ${formatCLP(sale.total).padStart(14)}\n`;
        text += `--------------------------------\n`;
        text += `Pago: ${this.getPaymentMethodName(sale.paymentMethod)}\n`;
        if (tendered) text += `Entregado:        ${formatCLP(tendered).padStart(14)}\n`;
        if (change) text += `Vuelto:           ${formatCLP(change).padStart(14)}\n`;
        text += `================================\n`;
        text += `${footerMsg}\n`;
        text += `================================\n`;
        
        try {
            await BluetoothPrinter.print(text, { cut: true });
            showNotification('Ticket impreso por Bluetooth', 'success');
        } catch (err) {
            console.error(err);
            showNotification('Error al imprimir por Bluetooth: ' + err.message, 'error');
        }
    },

    printReceiptCopy() {
        if (!this.lastSale) return;
        const printerPort = localStorage.getItem('printerPort') || 'USB';
        if (printerPort === 'bluetooth') {
            this.printBluetoothSale(this.lastSale, this.lastTendered, this.lastChange);
        } else {
            window.print();
        }
    },

    destroy() {
        if (this.html5QrCode) {
            this.html5QrCode.stop().catch(() => {}).finally(() => { this.html5QrCode = null; });
        }
    },

    // --- CORRECCIÓN RÁPIDA DE PAGOS (Últimas Ventas) ---
    async updateRecentSalesUI() {
        const container = document.getElementById('recentSalesPanel');
        const listItems = document.getElementById('recentSalesListItems');
        if (!container || !listItems) return;

        if (!posController.currentCashRegister) {
            container.style.display = 'none';
            return;
        }

        try {
            // Obtener ventas asociadas a la caja actual
            let recentSales = [];
            if (db.mode === 'sqlite') {
                recentSales = await ApiClient.get('sales', { 
                    cashRegisterId: posController.currentCashRegister.id,
                    _sort: 'id', 
                    _order: 'DESC', 
                    _limit: 2 
                });
            } else {
                const all = await db.getAll('sales');
                recentSales = all
                    .filter(s => s.cashRegisterId === posController.currentCashRegister.id)
                    .sort((a, b) => b.id - a.id)
                    .slice(0, 2);
            }

            if (!recentSales || recentSales.length === 0) {
                container.style.display = 'none';
                return;
            }

            container.style.display = 'block';
            listItems.innerHTML = recentSales.map(sale => {
                let badgeStyle = 'var(--text-muted)';
                let badgeText = 'ANULADA';
                if (sale.status === 'completed') { badgeStyle = 'var(--success)'; badgeText = 'PAGADA'; }
                else if (sale.status === 'pending') { badgeStyle = 'var(--danger)'; badgeText = 'DEUDA'; }
                else if (sale.status === 'partial') { badgeStyle = 'var(--warning)'; badgeText = 'PARCIAL'; }

                return `
                    <div style="background: white; border: 1px solid var(--border); border-radius: 0.5rem; padding: 0.75rem; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border)'" onclick="POSView.openQuickPaymentCorrection(${sale.id})">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.25rem;">
                            <strong style="font-size: 0.85rem; color: var(--text-color);">Venta #${sale.saleNumber}</strong>
                            <span style="font-size: 0.65rem; font-weight: 800; color: ${badgeStyle}; background: ${badgeStyle}20; padding: 2px 6px; border-radius: 4px;">${badgeText}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">${this.getPaymentMethodName(sale.paymentMethod)}</span>
                            <strong style="font-size: 1rem; color: var(--text-color);">${formatCLP(sale.total)}</strong>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (e) {
            console.error('Error al actualizar ventas recientes UI:', e);
        }
    },

    async openQuickPaymentCorrection(saleId) {
        // Redirigir a la vista completa de edición de ventas que ya tiene toda la lógica probada y robusta.
        if (typeof app !== 'undefined' && app.navigate) {
            app.navigate('sales');
            setTimeout(() => {
                if (typeof SalesView !== 'undefined' && SalesView.editSale) {
                    SalesView.editSale(saleId);
                } else {
                    showNotification('No se pudo abrir el editor de ventas.', 'error');
                }
            }, 300);
        }
    }
};
