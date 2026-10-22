const POSView = {
    currentSection: 'pos',
    lastScanTerm: null,
    lastScanAt: 0,
    selectedDocType: 'boleta', // Valor por defecto
    _scannerBuffer: '',
    _scannerLastTime: 0,
    _scannerThreshold: 50,
    customerResults: [],
    customerSelectedIndex: -1,
    customerPrivacyMode: true,
    async render() {
        const cashOpen = await posController.init();
        const pendingNotesCount = (typeof NotesService !== 'undefined') ? NotesService.getPendingCount() : 0;

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
            <div class="pos-screen-layout" style="display: flex; flex-direction: column; height: calc(100vh - 65px); overflow: hidden; padding: 0.5rem 0.85rem 0; box-sizing: border-box; gap: 0.45rem;">
                
                <!-- 1. CABECERA SUPERIOR DE CONTROL UNIFICADA (FIJA Y COMPACTA) -->
                <div class="pos-top-control-bar" style="background: var(--surface); border: 1.5px solid var(--border); border-radius: 0.85rem; padding: 0.5rem 0.75rem; box-shadow: 0 4px 15px rgba(0,0,0,0.04); display: flex; flex-direction: column; gap: 0.45rem; z-index: 50; flex-shrink: 0;">
                    
                    <!-- Fila 1 Superior: Total a Pagar + Buscador Central + Finalizar Cobro -->
                    <div style="display: flex; align-items: stretch; gap: 0.65rem; width: 100%;">
                        
                        <!-- 1. Total Gigante Destacado (Visor de Alto Impacto para Clientes) -->
                        <div style="background: linear-gradient(135deg, rgba(79, 70, 229, 0.12) 0%, rgba(99, 102, 241, 0.22) 100%); border: 2.5px solid var(--primary); border-radius: 0.85rem; padding: 0.35rem 1.15rem; display: flex; flex-direction: column; justify-content: center; min-width: 235px; flex-shrink: 0; box-shadow: 0 4px 15px rgba(79, 70, 229, 0.18);">
                            <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.4rem;">
                                <span style="font-size: 0.72rem; font-weight: 950; color: var(--primary); text-transform: uppercase; letter-spacing: 1px; line-height: 1;">TOTAL A PAGAR</span>
                                <span style="font-size: 0.65rem; background: var(--primary); color: #fff; font-weight: 900; padding: 0.1rem 0.4rem; border-radius: 0.3rem; letter-spacing: 0.5px;">CLP</span>
                            </div>
                            <strong id="cartTotal" style="font-size: 2.35rem; font-weight: 950; color: var(--primary); line-height: 1.05; margin-top: 0.15rem; letter-spacing: -0.5px; text-shadow: 0 1px 2px rgba(79, 70, 229, 0.15);">$0</strong>
                        </div>

                        <!-- 2. Buscador de Productos / Escáner -->
                        <div style="flex: 1; position: relative; min-width: 180px; display: flex;">
                            <div style="position: relative; display: flex; align-items: center; width: 100%;">
                                <span style="position: absolute; left: 0.85rem; font-size: 1.15rem; color: var(--primary); pointer-events: none;">🔍</span>
                                <input type="text" id="productSearch" class="form-control" 
                                       placeholder="Escanear código de barra o buscar por nombre (F1)..." 
                                       autofocus autocomplete="off"
                                       style="width: 100%; height: 50px; padding-left: 2.5rem; padding-right: 1rem; font-size: 1.05rem; font-weight: 800; border: 2px solid #6366f1; border-radius: 0.75rem; background: #ffffff; box-shadow: 0 2px 10px rgba(99, 102, 241, 0.1); transition: all 0.2s;">
                            </div>
                            <div id="searchResults" class="pos-search-results" style="position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 1000; max-height: 350px; overflow-y: auto; background: var(--surface); border: 2px solid var(--primary); border-radius: 0.75rem; box-shadow: 0 12px 30px rgba(0,0,0,0.18); display: none;"></div>
                        </div>

                        <!-- 3. Botón Principal [F2] FINALIZAR -->
                        <button type="button" class="btn btn-primary" onclick="POSView.showPaymentModal()" title="Finalizar Cobro [F2]"
                                style="height: 50px; min-width: 160px; padding: 0 1.25rem; font-weight: 950; font-size: 0.98rem; border-radius: 0.75rem; display: flex; align-items: center; justify-content: center; gap: 0.45rem; white-space: nowrap; background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%); border: 2px solid #312e81; box-shadow: 0 4px 15px rgba(79, 70, 229, 0.35); letter-spacing: 0.5px; transition: all 0.2s; cursor: pointer; flex-shrink: 0;">
                            <span style="font-size: 1.15rem;">💸</span>
                            <span>[F2] FINALIZAR</span>
                        </button>
                    </div>

                    <!-- Fila 2 Inferior: Espera / Clientes / Métodos Express / Herramientas -->
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; border-top: 1.5px solid var(--border); padding-top: 0.4rem; overflow-x: auto; scrollbar-width: none;">
                        
                        <!-- Bloque Izquierdo: Pestañas y Control de Espera -->
                        <div id="heldSalesTabBar" style="display: flex; gap: 0.35rem; align-items: center; flex-shrink: 0; min-width: 0;"></div>
                        
                        <!-- Bloque Derecho: Botones de Gestión Operativa Táctil (Ergonómicos) -->
                        <div style="display: flex; align-items: center; gap: 0.35rem; flex-shrink: 0; flex-wrap: nowrap;">
                            <!-- Indicador de Turno Compacto -->
                            <div id="posCashStatusBadge" title="Estado de la Caja Registradora" 
                                 style="display: inline-flex; align-items: center; gap: 0.3rem; padding: 0 0.65rem; height: 40px; border-radius: 0.65rem; background: rgba(16, 185, 129, 0.08); border: 1.5px solid #10b981; color: #047857; font-size: 0.78rem; font-weight: 850; white-space: nowrap;">
                                <span style="font-size: 0.6rem;">🟢</span>
                                <span>Caja Abierta</span>
                            </div>

                            <div id="customerInfo">
                                <button type="button" class="btn btn-outline-primary btn-customer-select" onclick="POSView.selectCustomer()" 
                                        style="height: 40px; padding: 0 0.75rem; font-weight: 800; font-size: 0.8rem; border-radius: 0.65rem; border: 2px solid var(--primary); display: flex; align-items: center; gap: 0.35rem; white-space: nowrap; transition: all 0.2s; cursor: pointer;">
                                    <span>👤</span>
                                    <span>(F3) CLIENTE</span>
                                </button>
                            </div>

                            <button type="button" class="btn btn-success" onclick="POSView.quickPayExactCash()" title="Cobro instantáneo en efectivo exacto [F9]"
                                    style="height: 40px; padding: 0 0.75rem; font-weight: 900; font-size: 0.8rem; border-radius: 0.65rem; display: flex; align-items: center; gap: 0.35rem; white-space: nowrap; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.2); transition: all 0.2s; cursor: pointer;">
                                <span>⚡</span>
                                <span>[F9] EFECTIVO</span>
                            </button>

                            <button type="button" class="btn btn-outline-primary" onclick="POSView.quickPayCard()" title="Cobro instantáneo con tarjeta [F10]"
                                    style="height: 40px; padding: 0 0.75rem; font-weight: 900; font-size: 0.8rem; border-radius: 0.65rem; border: 2px solid var(--primary); background: var(--surface); display: flex; align-items: center; gap: 0.35rem; white-space: nowrap; transition: all 0.2s; cursor: pointer;">
                                <span>💳</span>
                                <span>[F10] TARJETA</span>
                            </button>

                            <div style="width: 1px; height: 26px; background: var(--border); margin: 0 0.2rem; flex-shrink: 0;"></div>

                            <button type="button" class="btn btn-xs btn-outline-warning" onclick="POSView.showDiscountModal()" title="Aplicar Descuento [Alt+D]" style="height: 40px; font-weight: 800; border-radius: 0.6rem; padding: 0 0.6rem; font-size: 0.78rem; white-space: nowrap; display: flex; align-items: center; gap: 0.25rem; cursor: pointer;">
                                <span>🏷️</span>
                                <span>[Alt+D] DESC</span>
                            </button>

                            <button type="button" class="btn btn-xs btn-outline-danger" onclick="POSView.clearCart()" title="Limpiar Carrito [F8]" style="height: 40px; font-weight: 800; border-radius: 0.6rem; padding: 0 0.6rem; font-size: 0.78rem; white-space: nowrap; display: flex; align-items: center; gap: 0.25rem; cursor: pointer;">
                                <span>🗑️</span>
                                <span>[F8]</span>
                            </button>

                            <button type="button" class="btn btn-xs btn-outline-secondary" onclick="POSView.showShortcutsHelpModal()" title="Ver Guía de Atajos de Teclado [F12]"
                                    style="height: 40px; padding: 0 0.55rem; font-weight: 800; font-size: 0.78rem; border-radius: 0.6rem; border: 1.5px solid #cbd5e1; background: #ffffff; color: #475569; display: flex; align-items: center; gap: 0.25rem; white-space: nowrap; cursor: pointer; transition: all 0.2s;">
                                <span>⌨️</span>
                                <span>[F12]</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- 2. VISTA PRINCIPAL DEL CARRITO (OCUPA TODO EL ALTO Y ANCHO RESTANTE) -->
                <div class="pos-cart-panel" style="flex: 1; background: var(--surface); border: 2px solid var(--border); border-radius: 1rem; padding: 0.5rem 0.75rem; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.03);">
                    <div class="pos-cart-header" style="display: flex; justify-content: space-between; align-items: center; padding: 0.45rem 0.85rem; border-bottom: 1.5px solid var(--border); background: var(--surface-content) !important; border-radius: 0.75rem 0.75rem 0 0; margin-bottom: 0.25rem;">
                        <div style="display: flex; align-items: center; gap: 0.55rem;">
                            <span style="font-size: 1.15rem;">🛒</span>
                            <h3 class="pos-cart-title" style="margin: 0; font-size: 0.9rem; font-weight: 950; color: var(--text-main); letter-spacing: 0.5px; text-transform: uppercase;">
                                LISTA DE PRODUCTOS
                            </h3>
                            <span id="cartItemsCountBadge" style="display: none; background: rgba(79, 70, 229, 0.08); color: var(--primary); font-size: 0.72rem; font-weight: 900; padding: 0.12rem 0.5rem; border-radius: 999px; border: 1px solid rgba(79, 70, 229, 0.2);">
                                0 productos
                            </span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 1rem; font-size: 0.82rem; font-weight: 800; color: var(--text-muted);">
                            <span id="cartDiscountSection" style="display: none; color: var(--danger); background: rgba(239, 68, 68, 0.08); padding: 0.15rem 0.5rem; border-radius: 0.4rem; border: 1px solid rgba(239, 68, 68, 0.2);">Desc: <strong id="cartDiscountAmount">$0</strong></span>
                            <span id="fiscalBreakdown" style="display: none; color: var(--primary); background: rgba(79, 70, 229, 0.08); padding: 0.15rem 0.5rem; border-radius: 0.4rem; border: 1px solid rgba(79, 70, 229, 0.2);">IVA: <strong id="fiscalIVA">$0</strong></span>
                            <div style="display: flex; align-items: baseline; gap: 0.35rem;">
                                <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 800;">Subtotal:</span>
                                <strong id="cartSubtotal" style="color: var(--text-main); font-size: 1.1rem; font-weight: 950;">$0</strong>
                            </div>
                        </div>
                    </div>

                    <div id="cartItems" class="pos-cart-items-container" style="flex: 1; overflow-y: auto; padding-right: 0.25rem;"></div>
                </div>
            </div>
        `;
    },

    // Módulo de cámara web removido en PC (se utiliza lector de código de barras USB)

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

            if (term.length >= 2) {
                searchResults.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--primary); font-weight: 700;"><span class="spinner-border spinner-border-sm me-2"></span> Buscando...</div>';
                searchResults.style.display = 'block';

                clearTimeout(this._searchTimeout);
                const searchId = Date.now();
                this._lastSearchId = searchId;

                this._searchTimeout = setTimeout(async () => {
                    try {
                        const products = await Product.search(term);
                        if (this._lastSearchId === searchId) {
                            this.showSearchDropdown(products);
                        }
                    } catch (error) {
                        console.error('Error en búsqueda:', error);
                        searchResults.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--danger);">❌ Error al buscar</div>';
                    }
                }, 200);
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
                    const currentModule = rawTitle.replace(/[^\w\sáéíóúÁÉÍÓÚñÑ]/g, '').trim();

                    // Si el modal activo es el recibo de venta, un aviso o se conmuta entre F2, F3 o F6
                    const isReceiptOrAlert = currentModule.toLowerCase().includes('recibo') || currentModule.toLowerCase().includes('éxito') || currentModule.toLowerCase().includes('confirmación');
                    
                    if (isReceiptOrAlert || e.key === 'F2' || e.key === 'F3' || e.key === 'F6') {
                        if (POSView._receiptTimer) {
                            clearInterval(POSView._receiptTimer);
                            POSView._receiptTimer = null;
                        }
                        // Si ya está exactamente en el modal pedido, no reabrir
                        if (currentModule.toLowerCase().includes(requestedModule.toLowerCase())) {
                            return;
                        }
                        closeModal();
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
            
            const isModalActive = !!(
                document.querySelector('.modal') || 
                document.body.classList.contains('modal-open') || 
                (document.getElementById('modal-overlay') && document.getElementById('modal-overlay').classList.contains('active'))
            );

            // 1. Tecla ESC (Cerrar modales o limpiar búsqueda de inmediato)
            if (e.key === 'Escape') {
                e.preventDefault();
                if (POSView._receiptTimer) {
                    clearInterval(POSView._receiptTimer);
                    POSView._receiptTimer = null;
                }
                if (isModalActive) {
                    if (typeof closeModal === 'function') closeModal();
                } else if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') {
                    activeElem.blur();
                }
                if (!isModalActive && searchInput) searchInput.focus();
                return;
            }

            // Hardware Scanner Sentinel: Captura ráfaga rápida de lector USB/Bluetooth
            const nowTime = Date.now();
            const deltaMs = nowTime - (POSView._scannerLastTime || 0);
            POSView._scannerLastTime = nowTime;

            if (e.key === 'Enter') {
                // Si el usuario está escribiendo directamente en el buscador principal, no interceptar como escáner huérfano
                if (activeElem === searchInput) {
                    POSView._scannerBuffer = '';
                    // Deja que fluya al listener dedicado de searchInput
                } else if (POSView._scannerBuffer && POSView._scannerBuffer.length >= 3 && deltaMs < 100) {
                    e.preventDefault();
                    e.stopPropagation();
                    const barcode = POSView._scannerBuffer;
                    POSView._scannerBuffer = '';
                    POSView.handleBarcodeScan(barcode);
                    if (searchInput) searchInput.value = '';
                    return;
                } else if (!isModalActive && activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
                    // Prevenir que un Enter huérfano fuera de inputs dispare clics accidentales
                    e.preventDefault();
                    return;
                }
            } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                if (deltaMs < POSView._scannerThreshold) {
                    POSView._scannerBuffer += e.key;
                } else {
                    POSView._scannerBuffer = e.key;
                }
            }

            // F2: Finalizar / Confirmar Venta (Funciona en vista principal y en modal de cobro)
            if (e.key === 'F2') {
                e.preventDefault();
                const paymentSummaryBox = document.getElementById('paymentSummaryBox');
                if (paymentSummaryBox) {
                    const btn = document.getElementById('btn_process_payment');
                    if (btn && !btn.disabled) {
                        POSView.processUnifiedSale();
                    } else {
                        const cashInput = document.getElementById('cashReceivedInput');
                        if (cashInput) {
                            cashInput.focus();
                            cashInput.select();
                        } else {
                            showNotification('Completa la forma de pago para confirmar la venta.', 'warning');
                        }
                    }
                } else if (!isModalActive) {
                    POSView.showPaymentModal();
                }
                return;
            }

            // SI HAY UN MODAL ABIERTO, BLOQUEAMOS LOS ATAJOS PRINCIPALES DE FONDO PARA EVITAR CONFLICTOS
            if (isModalActive) {
                return;
            }

            // F3: Seleccionar cliente
            if (e.key === 'F3') { e.preventDefault(); POSView.selectCustomer(); return; }
            
            // F6: Clientes en espera / pausar venta
            if (e.key === 'F6') { e.preventDefault(); POSView.openHeldSalesMenu(); return; }

            // F7: Pizarra de Notas, Encargos y Envases
            if (e.key === 'F7') {
                e.preventDefault();
                if (typeof app !== 'undefined' && typeof app.openNotesModal === 'function') {
                    app.openNotesModal();
                } else if (typeof NotesModal !== 'undefined') {
                    NotesModal.open();
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

            // F9: Cobro express en efectivo exacto
            if (e.key === 'F9') { e.preventDefault(); POSView.quickPayExactCash(); return; }

            // F10: Cobro express con tarjeta
            if (e.key === 'F10') { e.preventDefault(); POSView.quickPayCard(); return; }

            // F12 o ?: Guía de atajos de teclado
            if (e.key === 'F12' || (e.key === '?' && !['INPUT', 'TEXTAREA'].includes(activeTag))) {
                e.preventDefault();
                POSView.showShortcutsHelpModal();
                return;
            }

            // Alt+D: Descuento
            if (e.altKey && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); POSView.showDiscountModal(); return; }
            
            // Autofoco: si no hay modal abierto, no estamos en un input y es una tecla alfanumérica, forzar foco al buscador
            if (!isModalActive && activeTag !== 'INPUT' && activeTag !== 'TEXTAREA' && activeTag !== 'SELECT') {
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
                if (!term) return;

                // 1. PRIORIDAD: Buscar primero si existe como código de barras exacto (incluso códigos cortos o con letras)
                let barcodeMatch = await Product.getByBarcode(term);
                
                // Soporte para códigos de balanza (Chile: Prefijo 28 o 20)
                if (!barcodeMatch && term.length === 13 && (term.startsWith('28') || term.startsWith('20'))) {
                    const productCode = term.substring(2, 7);
                    barcodeMatch = await Product.getByBarcode(productCode);
                }

                if (barcodeMatch) {
                    await this.handleBarcodeScan(term);
                    searchInput.value = '';
                    searchResults.style.display = 'none';
                    return;
                }

                // 2. Si no es un código de barras exacto, navegar por las sugerencias de la lista
                if (searchResults.style.display !== 'none' && items.length > 0) {
                    const selected = searchResults.querySelector('.selected') || items[0];
                    if (selected) {
                        searchInput.value = '';
                        searchResults.style.display = 'none';
                        await this.addProductFromSearch(parseInt(selected.dataset.productId));
                    }
                } else if (term.length >= 2) {
                    const products = await Product.search(term);
                    if (products.length === 1) {
                        searchInput.value = '';
                        searchResults.style.display = 'none';
                        await this.addProductFromSearch(products[0].id);
                    } else if (products.length > 1) {
                        this.showSearchDropdown(products);
                    } else {
                        showNotification('Producto no encontrado', 'warning');
                        this.focusSearch();
                    }
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

        // Sincronizar estado de cliente limpio al entrar al POS si no hay venta en curso
        if (typeof posController !== 'undefined') {
            if (posController.cart.length === 0 && !posController.currentCustomer) {
                this.removeCustomer();
            } else if (posController.currentCustomer) {
                this.setCustomer(posController.currentCustomer.id);
            }
        }

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
        // PREVENCIÓN DE DUPLICADOS O SUMA RÁPIDA CON PISTOLA:
        // Si el modal ya está abierto y se escanea el MISMO producto, sumar +1 a la cantidad
        const existingQtyInput = document.getElementById('productQuantity');
        if (existingQtyInput && this._activeModalProductId === product.id) {
            const isWeight = product.type === 'weight';
            if (!isWeight) {
                const currentVal = parseFloat(existingQtyInput.value) || 0;
                existingQtyInput.value = (currentVal + 1);
                existingQtyInput.dispatchEvent(new Event('input', { bubbles: true }));
                showNotification(`+1 ${product.name}`, 'info');
                return;
            }
        }
        if (existingQtyInput) {
            console.warn('⚠️ Modal de producto ya está abierto con otro producto.');
            return;
        }

        this._activeModalProductId = product.id;

        if (this._receiptTimer) {
            clearInterval(this._receiptTimer);
            this._receiptTimer = null;
        }

        closeModal();

        const isWeight = product.type === 'weight';
        const isOutOfStock = (parseFloat(product.stock) || 0) <= 0;
        const unitPriceRounded = Math.round(product.price / 10) * 10;
        const initialQty = isWeight ? '' : '1';
        const modalOpenedAt = Date.now();

        const content = `
            <div class="modal-form-header" style="margin-bottom: 0.75rem; text-align: center;">
                <h2 style="font-size: 1.35rem; margin: 0 0 0.25rem 0; color: #4338ca; font-weight: 900;">${safeHTML(product.name)}</h2>
                <div style="display: flex; justify-content: center; gap: 0.75rem; font-size: 0.85rem; color: #64748b; font-weight: 700;">
                    <span>Precio: <strong>${formatCLP(unitPriceRounded)}${isWeight ? '/kg' : ''}</strong></span>
                    <span>•</span>
                    <span>Disponible: <strong style="${isOutOfStock ? 'color: #dc2626;' : ''}">${formatStock(product.stock)} ${isWeight ? 'kg' : 'un'}</strong></span>
                </div>
            </div>

            ${isOutOfStock ? `
            <div style="background: #fffbeb; border: 1.5px solid #fcd34d; border-radius: 0.65rem; padding: 0.45rem 0.65rem; margin-bottom: 0.65rem; display: flex; align-items: center; gap: 0.45rem; color: #92400e; font-size: 0.82rem; font-weight: 800;">
                <span style="font-size: 1.1rem;">⚠️</span>
                <span>Producto sin stock en sistema. ¿Deseas venderlo de todas formas?</span>
            </div>
            ` : ''}
            
            <div class="form-group" style="margin-bottom: 0.65rem;">
                <label style="font-weight: 800; color: #475569; font-size: 0.8rem; margin-bottom: 0.25rem; display: block;">${isWeight ? '⚖️ PESO (KG):' : '📦 CANTIDAD:'}</label>
                <input type="number" id="productQuantity" class="form-control" step="any" min="0.001" value="${initialQty}" placeholder="${isWeight ? '0.000' : '1'}" style="font-size: 1.8rem; height: 50px; font-weight: 900; text-align: center; border: 2.5px solid #4f46e5; border-radius: 0.75rem; color: #1e1b4b;" autofocus>
            </div>

            <div class="form-group" style="margin-bottom: 0.75rem;">
                <label style="font-weight: 800; color: #475569; font-size: 0.8rem; margin-bottom: 0.25rem; display: block;">💰 AJUSTAR PRECIO:</label>
                <input type="number" id="productPrice" class="form-control" step="any" value="${unitPriceRounded}" style="font-size: 1.25rem; text-align: center; height: 42px; font-weight: 800; border: 2px solid #6366f1; border-radius: 0.6rem; color: #1e293b;">
            </div>

            <div id="pricePreview" style="background: #0f172a; color: white; padding: 0.6rem 1rem; border-radius: 0.75rem; text-align: center; box-shadow: 0 4px 12px rgba(15,23,42,0.15);">
                <div style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; font-weight: 800;">Subtotal a Sumar</div>
                <div id="calculatedTotal" style="font-size: 1.6rem; font-weight: 950; color: #fbbf24; margin-top: 0.1rem;">${formatCLP(unitPriceRounded)}</div>
            </div>

            <p style="text-align: center; margin: 0.5rem 0 0 0; font-size: 0.78rem; font-weight: 700; color: #64748b;">
                💡 Presiona <span style="color: #4f46e5; font-weight: 900;">ENTER</span> para agregar al carro
            </p>
        `;

        const footer = `
            <div style="display: flex; gap: 0.75rem; width: 100%;">
                <button class="btn btn-secondary" style="flex: 1; height: 44px; font-weight: 700; border-radius: 0.6rem;" onclick="POSView._activeModalProductId = null; closeModal()">CANCELAR</button>
                <button class="btn ${isOutOfStock ? 'btn-warning' : 'btn-primary'}" style="flex: 2; height: 44px; font-size: 1.02rem; font-weight: 800; border-radius: 0.6rem; ${isOutOfStock ? 'background: #f59e0b; color: #fff; border: 1px solid #d97706;' : ''}" onclick="POSView.addProductFromModal(${product.id})">
                    ${isOutOfStock ? '⚠️ VENDER DE TODAS FORMAS' : '✓ AGREGAR'}
                </button>
            </div>
        `;

        showModal(content, { title: 'Agregar Producto', footer, width: '460px' });

        const qInput = document.getElementById('productQuantity');
        const pInput = document.getElementById('productPrice');
        const update = () => {
            const rawVal = qInput.value;
            // Usamos parseNumber para que acepte comas y puntos por igual
            const q = (rawVal === '' && !isWeight) ? 1 : (parseNumber(rawVal) || 0);
            const p = parseNumber(pInput.value) || 0;
            
            // LEY 20.956: Redondeo a la decena para TODOS los productos en la vista previa
            const calculatedVal = roundPrice(q * p);
            document.getElementById('calculatedTotal').textContent = formatCLP(calculatedVal, true);
        };
        qInput.addEventListener('input', update);
        pInput.addEventListener('input', update);

        const handleEnter = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                // ponytail: Cooldown de 250ms para evitar que el Enter de selección de búsqueda autoconfirme el modal
                if (Date.now() - modalOpenedAt < 250) {
                    return;
                }
                const qValue = qInput.value.trim();
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

        setTimeout(() => {
            const input = document.getElementById('productQuantity');
            if (input) {
                input.focus();
                input.select();
            }
        }, 150);
    },

    async addProductFromModal(productId) {
        if (this._isAddingProduct) return;
        this._isAddingProduct = true;

        try {
            const product = await Product.getById(productId);
            if (!product) return;

            const isWeight = product.type === 'weight';
            const qInput = document.getElementById('productQuantity');
            if (!qInput) return;
            const qStr = qInput.value;

            // Si el campo está vacío y es por unidad, el valor por defecto es 1
            let q = parseNumber(qStr);
            if ((qStr === '' || isNaN(q)) && !isWeight) {
                q = 1;
            }

            const pInput = document.getElementById('productPrice');
            const p = pInput ? parseNumber(pInput.value) : product.price;

            if (!q || q <= 0) { showNotification('Cantidad inválida', 'warning'); return; }

            const check = await posController.validateStock(productId, q);
            if (!check.valid) { showNotification(check.error, 'warning'); return; }

            // ponytail: Notificar sutilmente al centro de notificaciones si se vende sin stock
            const curStock = parseFloat(product.stock) || 0;
            if (curStock <= 0 || q > curStock) {
                if (typeof NotificationCenter !== 'undefined' && typeof NotificationCenter.addNotification === 'function') {
                    NotificationCenter.addNotification({
                        title: 'Venta con stock insuficiente',
                        message: `"${product.name}" agregado al carro (${q} ${isWeight ? 'kg' : 'un'}) con stock registrado: ${formatStock(curStock)}.`,
                        type: 'warning'
                    });
                }
            }

            posController.addToCart(product, q, p);
            this.updateCart();
            this._activeModalProductId = null;
            closeModal();
            
            // Solo limpiamos el buscador si el producto se agregó exitosamente
            const searchInput = document.getElementById('productSearch');
            if (searchInput) {
                searchInput.value = '';
                const results = document.getElementById('searchResults');
                if (results) results.style.display = 'none';
                searchInput.focus();
            }
            
            showNotification(`${product.name} agregado`, 'success');
        } finally {
            setTimeout(() => { this._isAddingProduct = false; }, 200);
        }
    },

    updateCart() {
        const summary = posController.getCartSummary();
        const subEl = document.getElementById('cartSubtotal');
        const totEl = document.getElementById('cartTotal');
        if (subEl) subEl.textContent = formatCLP(summary.subtotal, true);
        if (totEl) totEl.textContent = formatCLP(summary.total, true);
        
        const sumTotEl = document.getElementById('cartSummaryTotal');
        if (sumTotEl) sumTotEl.textContent = formatCLP(summary.total, true);

        const countBadge = document.getElementById('cartItemsCountBadge');
        if (countBadge) {
            countBadge.textContent = `${summary.items.length} ${summary.items.length === 1 ? 'producto' : 'productos'}`;
            countBadge.style.display = summary.items.length > 0 ? 'inline-block' : 'none';
        }

        // ACTUALIZAR INFORMACIÓN DEL CLIENTE (FIX: Limpiar inmediatamente al terminar venta)
        const infoEl = document.getElementById('customerInfo');
        if (infoEl) {
            const customer = posController.currentCustomer;
            if (!customer) {
                infoEl.innerHTML = `
                    <button type="button" class="btn btn-outline-primary btn-customer-select" onclick="POSView.selectCustomer()"
                            style="height: 36px; padding: 0 0.75rem; font-weight: 800; font-size: 0.8rem; border-radius: 0.65rem; border: 2px solid var(--primary); display: flex; align-items: center; gap: 0.35rem; white-space: nowrap; transition: all 0.2s;">
                        <span>👤</span>
                        <span>(F3) CLIENTE</span>
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

        // Renderizar barra de pestañas de clientes en espera
        this.renderHeldSalesTabs();

        const cartDiv = document.getElementById('cartItems');
        if (!cartDiv) return;

        if (summary.items.length === 0) {
            const held = posController.heldSales || [];
            if (held.length > 0) {
                const nextSale = held[held.length - 1];
                const totalNext = nextSale.cart.reduce((sum, item) => sum + item.total, 0);
                cartDiv.innerHTML = `
                    <div class="cart-empty-state" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.85rem; padding: 2.5rem 1rem;">
                        <div style="width: 64px; height: 64px; border-radius: 50%; background: rgba(79, 70, 229, 0.08); border: 2px dashed rgba(79, 70, 229, 0.25); display: flex; align-items: center; justify-content: center; font-size: 2rem;">🛒</div>
                        <div style="font-size: 1.05rem; font-weight: 850; color: var(--text-main);">Carrito disponible para venta</div>
                        <div style="background: rgba(245, 158, 11, 0.1); border: 2px solid #f59e0b; border-radius: 0.85rem; padding: 0.85rem 1.25rem; display: flex; align-items: center; gap: 1rem; max-width: 480px; width: 100%; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.12); margin-top: 0.5rem;">
                            <div style="font-size: 1.8rem;">⏳</div>
                            <div style="flex: 1; text-align: left; min-width: 0;">
                                <div style="font-size: 0.72rem; font-weight: 900; color: #d97706; text-transform: uppercase; letter-spacing: 0.5px;">Cliente en espera pendiente</div>
                                <div style="font-size: 1.05rem; font-weight: 950; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${safeHTML(nextSale.name)}</div>
                                <div style="font-size: 0.82rem; color: #d97706; font-weight: 800;">${nextSale.cart.length} productos • ${formatCLP(totalNext)}</div>
                            </div>
                            <button type="button" class="btn btn-warning" onclick="POSView.resumeHeldSale(${nextSale.id})" style="font-weight: 950; font-size: 0.85rem; padding: 0.6rem 1.1rem; border-radius: 0.65rem; white-space: nowrap; box-shadow: 0 2px 8px rgba(245, 158, 11, 0.35); cursor: pointer;">
                                Reanudar ↩️
                            </button>
                        </div>
                    </div>
                `;
            } else {
                cartDiv.innerHTML = `
                    <div class="cart-empty-state" style="height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem; padding: 3rem 1rem; text-align: center;">
                        <div style="width: 72px; height: 72px; border-radius: 50%; background: rgba(79, 70, 229, 0.06); border: 2px dashed rgba(79, 70, 229, 0.25); display: flex; align-items: center; justify-content: center; font-size: 2.2rem;">
                            🛒
                        </div>
                        <div style="font-size: 1.15rem; font-weight: 900; color: var(--text-main);">
                            Carrito listo para venta
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600; max-width: 360px; line-height: 1.4;">
                            Escanea un código con el lector USB o presiona <kbd style="background: var(--surface); border: 1.5px solid var(--border); border-radius: 6px; padding: 2px 7px; font-weight: 800; color: var(--text-main); font-size: 0.78rem;">F1</kbd> para buscar por nombre
                        </div>
                    </div>
                `;
            }
        } else {
            const hasLoss = summary.items.some(item => (parseFloat(item.cost) || 0) > 0 && parseFloat(item.unitPrice) < parseFloat(item.cost));
            const lossBanner = hasLoss ? `
                <div style="background: rgba(239, 68, 68, 0.1); border: 1.5px solid #dc2626; color: #dc2626; padding: 0.4rem 0.75rem; border-radius: 0.6rem; font-size: 0.75rem; font-weight: 800; margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.4rem;">
                    <span>⚠️</span>
                    <span>AVISO PREVENTIVO: Hay producto(s) vendiéndose por debajo de su costo de compra</span>
                </div>
            ` : '';

            cartDiv.innerHTML = `
                ${lossBanner}
                <!-- Cabecera de columnas para alineación compacta tipo POS -->
                <div class="pos-cart-col-headers" style="display: flex; align-items: center; gap: 0.65rem; padding: 0.35rem 0.65rem; font-size: 0.7rem; font-weight: 900; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1.5px solid var(--border); margin-bottom: 0.35rem; background: rgba(0,0,0,0.02); border-radius: 0.4rem;">
                    <div style="width: 28px; text-align: center; flex-shrink: 0;">#</div>
                    <div style="flex: 1; min-width: 0;">Descripción del Producto</div>
                    <div style="width: 120px; text-align: center; flex-shrink: 0;">Cantidad</div>
                    <div style="width: 95px; text-align: right; flex-shrink: 0;">Precio Unit.</div>
                    <div style="width: 110px; text-align: right; flex-shrink: 0;">Total</div>
                    <div style="width: 32px; text-align: center; flex-shrink: 0;"></div>
                </div>

                <div class="pos-cart-list" style="display: flex; flex-direction: column; gap: 0.35rem;">
                ${summary.items.map((item, index) => {
                    const isLoss = (parseFloat(item.cost) || 0) > 0 && parseFloat(item.unitPrice) < parseFloat(item.cost);
                    const stockWarn = (item.stock !== undefined) && (item.quantity > item.stock);
                    const stockNeg  = (item.stock !== undefined) && (item.stock <= 0);
                    const isWeight  = item.type === 'weight';
                    return `
                        <div class="pos-cart-item pos-cart-row ${isLoss ? 'is-loss' : ''} ${stockWarn ? 'stock-warn' : ''}">
                            <!-- 1. N° de Orden -->
                            <div style="width: 28px; height: 28px; border-radius: 6px; background: rgba(79, 70, 229, 0.08); color: var(--primary); font-size: 0.78rem; font-weight: 900; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                ${index + 1}
                            </div>

                            <!-- 2. Descripción + Badges -->
                            <div style="flex: 1; min-width: 0; display: flex; align-items: center; gap: 0.4rem; overflow: hidden;">
                                <strong style="font-size: 0.95rem; font-weight: 900; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${safeHTML(item.name)}">
                                    ${safeHTML(item.name)}
                                </strong>
                                ${isLoss ? '<span style="background: #ef4444; color: #fff; font-weight: 900; font-size: 0.62rem; padding: 0.1rem 0.35rem; border-radius: 0.3rem; flex-shrink: 0; white-space: nowrap;">⚠️ BAJO COSTO</span>' : ''}
                                ${stockNeg ? '<span style="background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; font-size: 0.62rem; font-weight: 900; padding: 0.1rem 0.35rem; border-radius: 0.3rem; flex-shrink: 0; white-space: nowrap;">📦 SIN STOCK</span>' : (stockWarn ? '<span style="background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; font-size: 0.62rem; font-weight: 900; padding: 0.1rem 0.35rem; border-radius: 0.3rem; flex-shrink: 0; white-space: nowrap;">📦 STOCK INSUF.</span>' : '')}
                            </div>

                            <!-- 3. Stepper de Cantidad -->
                            <div style="display: flex; align-items: center; gap: 0.2rem; width: 120px; justify-content: center; flex-shrink: 0;">
                                <button type="button" class="pos-cart-stepper-btn" onclick="POSView.stepQuantity(${item.productId}, -1)" title="Restar cantidad">-</button>
                                <input type="number" class="stepper-input" value="${item.quantity}" step="${isWeight ? '0.001' : '1'}" 
                                       onchange="POSView.updateQuantity(${item.productId}, this.value)" 
                                       onfocus="this.select()" inputmode="decimal"
                                       onkeydown="if(event.key==='Enter') { event.preventDefault(); this.blur(); }"
                                       style="width: ${isWeight ? '58px' : '48px'}; height: 28px; text-align: center; font-weight: 900; font-size: 0.92rem; border: 1.5px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text-main); padding: 0 3px;">
                                <button type="button" class="pos-cart-stepper-btn" onclick="POSView.stepQuantity(${item.productId}, 1)" title="Sumar cantidad">+</button>
                                ${isWeight ? '<span style="font-size: 0.68rem; font-weight: 800; color: var(--text-muted); margin-left: 1px;">kg</span>' : ''}
                            </div>

                            <!-- 4. Precio Unitario Editable -->
                            <div style="display: flex; align-items: center; gap: 0.15rem; width: 95px; justify-content: flex-end; flex-shrink: 0;">
                                <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 800;">$</span>
                                <input type="number" value="${item.unitPrice}" step="10" 
                                       onchange="POSView.updatePrice(${item.productId}, this.value)" 
                                       onfocus="this.select()" inputmode="numeric"
                                       onkeydown="if(event.key==='Enter') { event.preventDefault(); this.blur(); }" 
                                       style="width: 82px; height: 28px; text-align: right; font-weight: 850; font-size: 0.9rem; border: 1.5px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text-main); padding: 0 5px;">
                            </div>

                            <!-- 5. Total de la Línea -->
                            <div style="width: 110px; text-align: right; font-size: 1.15rem; font-weight: 950; color: var(--primary); flex-shrink: 0; letter-spacing: -0.2px;">
                                ${formatCLP(item.total, true)}
                            </div>

                            <!-- 6. Botón Quitar Producto -->
                            <div style="width: 32px; display: flex; justify-content: center; flex-shrink: 0;">
                                <button type="button" class="pos-cart-remove-btn" onclick="POSView.removeItem(${item.productId})" title="Quitar producto del carrito">
                                    🗑️
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
                </div>
            `;
        }
    },

    stepQuantity(id, delta) {
        const item = posController.cart.find(i => i.productId === id);
        if (!item) return;
        const isWeight = item.type === 'weight';
        const currentQty = parseFloat(item.quantity) || 1;
        let newQty = currentQty + (isWeight ? delta * 0.25 : delta);
        if (isWeight) {
            newQty = Math.max(0.05, Math.round(newQty * 1000) / 1000);
        } else {
            // Protección: mantener mínimo en 1 para no borrar por error; el borrado se hace con la papelera
            newQty = Math.max(1, Math.round(newQty));
        }
        posController.updateCartItem(id, newQty);
        this.updateCart();
    },

    openNumpadForQuantity(id, inputEl, type) {
        const isWeight = type === 'weight';
        if (window.TouchNumpad) {
            TouchNumpad.open(inputEl, {
                title: isWeight ? 'Ingresar Peso / Cantidad (kg)' : 'Ingresar Cantidad',
                mode: isWeight ? 'decimal' : 'integer',
                onConfirm: (val) => {
                    const q = parseFloat(val);
                    if (q > 0) this.updateQuantity(id, q);
                }
            });
        }
    },

    openNumpadForPrice(id, inputEl) {
        if (window.TouchNumpad) {
            TouchNumpad.open(inputEl, {
                title: 'Modificar Precio Unitario (CLP)',
                mode: 'currency',
                onConfirm: (val) => {
                    const p = parseFloat(val);
                    if (p >= 0) this.updatePrice(id, p);
                }
            });
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
            if (this._receiptTimer) {
                clearInterval(this._receiptTimer);
                this._receiptTimer = null;
            }
            posController.clearCart();
            this.removeCustomer();
            this.updateCart();
            this.focusSearch();
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

    showShortcutsHelpModal() {
        const content = `
            <div style="font-family: 'Outfit', sans-serif;">
                <p style="margin: 0 0 1rem 0; font-size: 0.88rem; color: #64748b; font-weight: 500;">
                    Atajos de teclado configurados para vender y cobrar a máxima velocidad:
                </p>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                    <!-- Columna 1: Cobro y Pagos -->
                    <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 0.75rem; padding: 0.85rem;">
                        <h4 style="margin: 0 0 0.6rem 0; font-size: 0.88rem; color: #1e293b; font-weight: 850; display: flex; align-items: center; gap: 0.35rem;">
                            💸 Cobro y Pagos
                        </h4>
                        <div style="display: flex; flex-direction: column; gap: 0.45rem; font-size: 0.82rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight: 900; color: #4338ca; background: #e0e7ff; padding: 0.15rem 0.45rem; border-radius: 0.35rem;">[F2]</span>
                                <span style="color: #334155; font-weight: 600;">Cobro Normal (vuelto)</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight: 900; color: #065f46; background: #d1fae5; padding: 0.15rem 0.45rem; border-radius: 0.35rem;">[F9]</span>
                                <span style="color: #334155; font-weight: 600;">Express Efectivo Exacto</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight: 900; color: #1e40af; background: #dbeafe; padding: 0.15rem 0.45rem; border-radius: 0.35rem;">[F10]</span>
                                <span style="color: #334155; font-weight: 600;">Express Tarjeta</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight: 900; color: #854d0e; background: #fef9c3; padding: 0.15rem 0.45rem; border-radius: 0.35rem;">[F4]</span>
                                <span style="color: #334155; font-weight: 600;">Pasar a Deuda (Fiado)</span>
                            </div>
                        </div>
                    </div>

                    <!-- Columna 2: Operaciones de Carrito -->
                    <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 0.75rem; padding: 0.85rem;">
                        <h4 style="margin: 0 0 0.6rem 0; font-size: 0.88rem; color: #1e293b; font-weight: 850; display: flex; align-items: center; gap: 0.35rem;">
                            🛒 Carrito y Operaciones
                        </h4>
                        <div style="display: flex; flex-direction: column; gap: 0.45rem; font-size: 0.82rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight: 900; color: #4338ca; background: #e0e7ff; padding: 0.15rem 0.45rem; border-radius: 0.35rem;">[F1]</span>
                                <span style="color: #334155; font-weight: 600;">Buscador / Escáner</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight: 900; color: #4338ca; background: #e0e7ff; padding: 0.15rem 0.45rem; border-radius: 0.35rem;">[F3]</span>
                                <span style="color: #334155; font-weight: 600;">Asignar Cliente</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight: 900; color: #4338ca; background: #e0e7ff; padding: 0.15rem 0.45rem; border-radius: 0.35rem;">[F6]</span>
                                <span style="color: #334155; font-weight: 600;">Ventas en Espera</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight: 900; color: #b45309; background: #fef3c7; padding: 0.15rem 0.45rem; border-radius: 0.35rem;">[F7]</span>
                                <span style="color: #334155; font-weight: 600;">Notas / Envases / Reservas</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight: 900; color: #991b1b; background: #fee2e2; padding: 0.15rem 0.45rem; border-radius: 0.35rem;">[F8]</span>
                                <span style="color: #334155; font-weight: 600;">Limpiar Carrito</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight: 900; color: #854d0e; background: #fef9c3; padding: 0.15rem 0.45rem; border-radius: 0.35rem;">[Alt+D]</span>
                                <span style="color: #334155; font-weight: 600;">Descuento</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight: 900; color: #475569; background: #f1f5f9; padding: 0.15rem 0.45rem; border-radius: 0.35rem;">[Esc]</span>
                                <span style="color: #334155; font-weight: 600;">Cerrar Ventana</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        const footer = `
            <div style="display: flex; justify-content: flex-end; width: 100%;">
                <button class="btn btn-primary" onclick="closeModal()" style="font-weight: 850; padding: 0.5rem 1.5rem; border-radius: 0.65rem;">Entendido (Esc)</button>
            </div>
        `;
        showModal(content, { title: '⌨️ Guía de Atajos de Teclado del POS', footer });
    },

    async applyDiscount(amount) {
        if (amount < 0 || isNaN(amount)) return;
        const summary = posController.getCartSummary();
        const subtotal = summary.subtotal || 0;
        const discountPercent = subtotal > 0 ? (amount / subtotal) * 100 : 0;

        // Falla #31 / Etapa 2: Descuentos superiores al umbral configurado (default 10%) exigen PIN de supervisor
        const currentRole = (typeof AuthManager !== 'undefined' && AuthManager.getCurrentUserRole) 
            ? AuthManager.getCurrentUserRole() 
            : (localStorage.getItem('USER_ROLE') || 'cashier');

        const maxAllowedDiscount = parseFloat(localStorage.getItem('MAX_EMPLOYEE_DISCOUNT_PERCENT') || '10');

        if (discountPercent > maxAllowedDiscount && currentRole === 'cashier') {
            const authorized = await this.requestSupervisorPinModal(
                `Autorización Requerida: Descuento del ${discountPercent.toFixed(1)}%`,
                `El descuento (${formatCLP(amount)}) supera el umbral permitido del ${maxAllowedDiscount}%. Ingrese el PIN de Administrador/Dueño para autorizar.`
            );
            if (!authorized) {
                showNotification('❌ Descuento no autorizado. Operación cancelada.', 'error');
                return;
            }
        }

        posController.setDiscount(amount);
        this.updateCart();
        closeModal();
        showNotification(`✅ Descuento de ${formatCLP(amount)} aplicado correctamente`, 'success');
    },

    async requestSupervisorPinModal(title, message) {
        if (typeof SupervisorAuth !== 'undefined') {
            const res = await SupervisorAuth.requireAuth({ title, message, forcePin: true });
            return res.authorized;
        }
        return false;
    },

    async verifySupervisorPin() {
        if (typeof SupervisorAuth !== 'undefined') {
            return SupervisorAuth.verifyPin();
        }
    },

    /**
     * Apertura manual de gaveta de dinero con auditoría (No-Sale Drawer Kick - Falla #32)
     */
    async openDrawerManual() {
        const currentRole = (typeof AuthManager !== 'undefined' && AuthManager.getCurrentUserRole) 
            ? AuthManager.getCurrentUserRole() 
            : (localStorage.getItem('USER_ROLE') || 'cashier');

        if (currentRole === 'cashier') {
            const authorized = await this.requestSupervisorPinModal(
                'Apertura Manual de Gaveta',
                'La apertura de gaveta sin venta requiere autorización de un Supervisor.'
            );
            if (!authorized) return;
        }

        try {
            // 1. Enviar comando ESC/POS de apertura de gaveta a la impresora térmica
            if (typeof BluetoothPrinter !== 'undefined' && BluetoothPrinter.openDrawer) {
                BluetoothPrinter.openDrawer();
            }

            // 2. Registrar evento inmutable en auditLogs del backend
            await fetch('/api/complex/drawer-kick-audit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reason: 'Apertura manual desde POS',
                    terminalId: localStorage.getItem('TERMINAL_ID') || 'PC-1',
                    authorizedBy: currentRole === 'cashier' ? 'Supervisor PIN' : 'Titular'
                })
            });

            showNotification('🔓 Gaveta de dinero abierta y registrada en auditoría', 'success');
        } catch (e) {
            console.warn('Advertencia en apertura de gaveta:', e.message);
            showNotification('🔓 Pulso enviado a gaveta', 'info');
        }
    },

    removeDiscount() {
        posController.clearDiscount();
        this.updateCart();
    },

    showTransferDataModal() {
        const bank = localStorage.getItem('BANK_NAME') || '';
        const type = localStorage.getItem('BANK_ACCOUNT_TYPE') || 'Cuenta RUT';
        const accNum = localStorage.getItem('BANK_ACCOUNT_NUMBER') || '';
        const rut = localStorage.getItem('BANK_RUT') || '';
        const name = localStorage.getItem('BANK_BENEFICIARY') || localStorage.getItem('PMV_BIZ') || 'Mi Negocio';
        const email = localStorage.getItem('BANK_EMAIL') || '';

        if (!bank && !accNum && !rut) {
            showNotification('⚠️ No hay cuenta bancaria configurada. Puedes configurarla en Ajustes > Ventas.', 'warning');
            return;
        }

        const lines = [];
        if (bank) lines.push(`Banco: ${bank}`);
        if (type) lines.push(`Tipo: ${type}`);
        if (accNum) lines.push(`N° Cuenta: ${accNum}`);
        if (rut) lines.push(`RUT: ${rut}`);
        if (name) lines.push(`Titular: ${name}`);
        if (email) lines.push(`Email: ${email}`);
        const textToCopy = lines.join('\n');

        const content = `
            <div style="padding: 0.5rem 0.25rem;">
                <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 0.85rem; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem;">
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem;">
                        <span style="color: #64748b; font-size: 0.85rem; font-weight: 600;">Banco:</span>
                        <strong style="color: #0f172a; font-size: 0.95rem;">${safeHTML(bank || 'No especificado')}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem;">
                        <span style="color: #64748b; font-size: 0.85rem; font-weight: 600;">Tipo de Cuenta:</span>
                        <strong style="color: #0f172a; font-size: 0.95rem;">${safeHTML(type)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem;">
                        <span style="color: #64748b; font-size: 0.85rem; font-weight: 600;">N° de Cuenta:</span>
                        <strong style="color: #047857; font-size: 1.15rem; letter-spacing: 0.5px; font-weight: 900;">${safeHTML(accNum || '---')}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem;">
                        <span style="color: #64748b; font-size: 0.85rem; font-weight: 600;">RUT Titular:</span>
                        <strong style="color: #0f172a; font-size: 0.95rem;">${safeHTML(rut || '---')}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem;">
                        <span style="color: #64748b; font-size: 0.85rem; font-weight: 600;">Titular:</span>
                        <strong style="color: #0f172a; font-size: 0.95rem;">${safeHTML(name)}</strong>
                    </div>
                    ${email ? `
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #64748b; font-size: 0.85rem; font-weight: 600;">Correo Comprobante:</span>
                        <strong style="color: #2563eb; font-size: 0.9rem;">${safeHTML(email)}</strong>
                    </div>
                    ` : ''}
                </div>
                <div style="margin-top: 1.25rem; display: flex; gap: 0.75rem;">
                    <button type="button" class="btn btn-primary" onclick='navigator.clipboard.writeText(${JSON.stringify(textToCopy)}).then(() => showNotification("📋 Datos bancarios copiados", "success"));' style="flex: 1; padding: 0.75rem; font-weight: 800; border-radius: 0.6rem; background: #059669; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                        📋 Copiar Datos
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="closeModal()" style="padding: 0.75rem 1.25rem; font-weight: 700; border-radius: 0.6rem;">
                        Cerrar
                    </button>
                </div>
            </div>
        `;
        showModal(content, { title: '🏦 Cuenta para Transferencia' });
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
            <div class="payment-modal-pro" style="display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 1.25rem; align-items: stretch; max-height: 80vh;">
                <!-- Columna Izquierda: Entradas de Dinero -->
                <div class="payment-methods-list" style="display: flex; flex-direction: column; gap: 0.75rem;">
                    
                    <!-- SELECTOR DE DOCUMENTO (BOLETA / INTERNO) -->
                    <div class="payment-doc-type-selector" style="border: 2px solid var(--border); border-radius: 0.85rem; padding: 0.5rem 0.75rem; background: var(--surface-content);">
                        <div class="payment-mini-label" style="font-size: 0.7rem; font-weight: 800; color: var(--secondary); text-transform: uppercase; margin-bottom: 0.35rem;">TIPO DE VENTA</div>
                        <div class="pos-doc-toggle" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                            <button id="docBoletaBtn" class="btn btn-sm btn-doc-toggle" style="${this.selectedDocType === 'boleta' ? 'background: var(--primary); color: white; font-weight: 900; box-shadow: 0 4px 15px rgba(79, 70, 229, 0.4);' : 'background: transparent; color: var(--text-muted); font-weight: 700; border: 1.5px solid var(--border);'}" onclick="POSView.setDocType('boleta')">📄 BOLETA (CON IVA)</button>
                            <button id="docInternoBtn" class="btn btn-sm btn-doc-toggle" style="${this.selectedDocType === 'sin_boleta' || this.selectedDocType === 'interno' ? 'background: var(--warning); color: white; font-weight: 900; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.4);' : 'background: transparent; color: var(--text-muted); font-weight: 700; border: 1.5px solid var(--border);'}" onclick="POSView.setDocType('sin_boleta')">🏠 INTERNO (SIN IVA)</button>
                        </div>
                    </div>

                    ${isCustomerSelected ? `
                    <div class="payment-customer-badge" style="padding: 0.75rem 1rem; display: flex; align-items: flex-start; gap: 0.75rem; border: 2px solid var(--primary); border-radius: 0.85rem; background: rgba(79, 70, 229, 0.05);">
                        <div class="payment-customer-icon" style="font-size: 1.5rem;">👤</div>
                        <div class="payment-customer-info" style="flex: 1;">
                            <div class="payment-customer-label" style="font-size: 0.68rem; font-weight: 800; color: var(--primary); text-transform: uppercase;">Cliente Seleccionado</div>
                            <div class="payment-customer-name" style="font-size: 1.05rem; font-weight: 900; color: var(--text-color);">${safeHTML(customer.name)}</div>
                            ${(parseFloat(customer.totalDebt) || 0) > 0 ? `
                            <div id="payment-customer-debt-toggle" style="margin-top: 0.4rem; display: flex; align-items: center; gap: 0.5rem; background: rgba(100, 116, 139, 0.05); padding: 0.4rem 0.75rem; border-radius: 0.5rem; border: 1.5px solid #cbd5e1; cursor: pointer;" onclick="const chk = document.getElementById('include_previous_debt'); if (event.target !== chk && event.target.tagName !== 'LABEL') { chk.checked = !chk.checked; chk.dispatchEvent(new Event('change')); }">
                                <input type="checkbox" id="include_previous_debt" style="width: 16px; height: 16px; cursor: pointer; margin: 0;" onchange="if(typeof POSView._updateModalUI === 'function') POSView._updateModalUI();">
                                <label for="include_previous_debt" id="include_previous_debt_label" style="font-weight: 800; color: #64748b; cursor: pointer; font-size: 0.8rem; margin: 0; user-select: none; flex: 1; display: flex; justify-content: space-between; align-items: center;">
                                    <span>Incluir deuda anterior</span>
                                    <strong style="font-size: 0.9rem; margin-left: 0.5rem; color: var(--danger); font-weight: 900;">+ ${formatCLP(customer.totalDebt)}</strong>
                                </label>
                            </div>
                            ` : ''}
                            ${(parseFloat(customer.balanceCredit) || 0) > 0 ? `
                            <div id="payment-customer-credit-toggle" style="margin-top: 0.4rem; display: flex; align-items: center; gap: 0.5rem; background: rgba(100, 116, 139, 0.05); padding: 0.4rem 0.75rem; border-radius: 0.5rem; border: 1.5px solid #cbd5e1; cursor: pointer;" onclick="const chk = document.getElementById('use_credit_balance'); if (event.target !== chk && event.target.tagName !== 'LABEL') { chk.checked = !chk.checked; POSView.onToggleCreditBalance(); }">
                                <input type="checkbox" id="use_credit_balance" style="width: 16px; height: 16px; cursor: pointer; margin: 0; accent-color: #10b981;" onchange="POSView.onToggleCreditBalance();">
                                <label for="use_credit_balance" id="use_credit_balance_label" style="font-weight: 800; color: #64748b; cursor: pointer; font-size: 0.8rem; margin: 0; user-select: none; flex: 1; display: flex; justify-content: space-between; align-items: center;">
                                    <span>Usar dinero a favor</span>
                                    <strong style="font-size: 0.9rem; margin-left: 0.5rem; color: #059669; font-weight: 900;">- ${formatCLP(customer.balanceCredit)}</strong>
                                </label>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    ` : ''}

                    <!-- 💵 EFECTIVO -->
                    <div class="payment-method-card" id="card_cash" style="border: 2px solid var(--border); border-radius: 0.85rem; padding: 0.65rem 0.85rem; background: var(--surface-content); transition: all 0.2s;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
                            <div style="display: flex; align-items: center; gap: 0.4rem;">
                                <span style="font-size: 1.15rem;">💵</span>
                                <strong style="font-size: 0.88rem; color: var(--text-main); text-transform: uppercase; font-weight: 800;">Efectivo</strong>
                            </div>
                        </div>
                        <!-- Barra de monto con botón TODO para cobro rápido -->
                        <div style="display: flex; gap: 0.5rem; align-items: stretch;">
                            <div style="position: relative; flex: 1;">
                                <span style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); font-weight: 800; color: var(--secondary); font-size: 1.15rem;">$</span>
                                <input type="number" id="pay_cash" class="pay-input-pro pay-input" placeholder="0" data-rounding="true" 
                                       value="${initialMethod === 'cash' ? roundedTotal : ''}" 
                                       inputmode="numeric" onfocus="this.select()"
                                       style="width: 100%; height: 48px; padding: 0.5rem 0.6rem 0.5rem 2rem; font-size: 1.3rem; font-weight: 900; border: 2px solid var(--border); border-radius: 0.6rem; background: var(--surface); box-sizing: border-box;">
                            </div>
                            <button type="button" class="btn btn-primary" onclick="POSView.fillAmount('pay_cash')" 
                                    style="padding: 0 1.5rem; height: 48px; font-weight: 900; font-size: 1rem; border-radius: 0.6rem; letter-spacing: 0.5px; box-shadow: 0 2px 8px rgba(79, 70, 229, 0.25); cursor: pointer;">
                                TODO
                            </button>
                        </div>
                    </div>

                    <!-- 💳 TARJETA / QR -->
                    <div class="payment-method-card" id="card_card" style="border: 2px solid var(--border); border-radius: 0.85rem; padding: 0.65rem 0.85rem; background: var(--surface-content); transition: all 0.2s;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
                            <div style="display: flex; align-items: center; gap: 0.4rem;">
                                <span style="font-size: 1.15rem;">💳</span>
                                <strong style="font-size: 0.88rem; color: var(--text-main); text-transform: uppercase; font-weight: 800;">Tarjeta / Transbank</strong>
                            </div>
                        </div>
                        <div style="display: flex; gap: 0.5rem; align-items: stretch;">
                            <div style="position: relative; flex: 1;">
                                <span style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); font-weight: 800; color: var(--secondary); font-size: 1.15rem;">$</span>
                                <input type="number" id="pay_card" class="pay-input-pro pay-input" placeholder="0" 
                                       value="${initialMethod === 'card' ? total : ''}" 
                                       inputmode="numeric" onfocus="this.select()"
                                       style="width: 100%; height: 48px; padding: 0.5rem 0.6rem 0.5rem 2rem; font-size: 1.3rem; font-weight: 900; border: 2px solid var(--border); border-radius: 0.6rem; background: var(--surface); box-sizing: border-box;">
                            </div>
                            <button type="button" class="btn btn-success" onclick="POSView.fillAmount('pay_card')" 
                                    style="padding: 0 1.5rem; height: 48px; font-weight: 900; font-size: 1rem; border-radius: 0.6rem; letter-spacing: 0.5px; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25); cursor: pointer;">
                                TODO
                            </button>
                        </div>
                    </div>

                    <!-- 🏦 TRANSFERENCIA -->
                    <div class="payment-method-card" id="card_other" style="border: 2px solid var(--border); border-radius: 0.85rem; padding: 0.65rem 0.85rem; background: var(--surface-content); transition: all 0.2s;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
                            <div style="display: flex; align-items: center; gap: 0.4rem;">
                                <span style="font-size: 1.15rem;">🏦</span>
                                <strong style="font-size: 0.88rem; color: var(--text-main); text-transform: uppercase; font-weight: 800;">Transferencia / QR</strong>
                            </div>
                            <button type="button" class="btn btn-xs" onclick="POSView.showTransferDataModal()" title="Ver datos de la cuenta para transferir" style="background: #e0e7ff; color: #4338ca; border: 1px solid #c7d2fe; border-radius: 0.4rem; font-weight: 800; font-size: 0.75rem; padding: 0.2rem 0.55rem; cursor: pointer; display: flex; align-items: center; gap: 0.25rem;">
                                📋 Ver Datos Cuenta
                            </button>
                        </div>
                        <div style="display: flex; gap: 0.5rem; align-items: stretch;">
                            <div style="position: relative; flex: 1;">
                                <span style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); font-weight: 800; color: var(--secondary); font-size: 1.15rem;">$</span>
                                <input type="number" id="pay_other" class="pay-input-pro pay-input" placeholder="0" 
                                       value="${initialMethod === 'other' ? total : ''}" 
                                       inputmode="numeric" onfocus="this.select()"
                                       style="width: 100%; height: 48px; padding: 0.5rem 0.6rem 0.5rem 2rem; font-size: 1.3rem; font-weight: 900; border: 2px solid var(--border); border-radius: 0.6rem; background: var(--surface); box-sizing: border-box;">
                            </div>
                            <button type="button" class="btn btn-warning" onclick="POSView.fillAmount('pay_other')" 
                                    style="padding: 0 1.5rem; height: 48px; font-weight: 900; font-size: 1rem; border-radius: 0.6rem; letter-spacing: 0.5px; cursor: pointer;">
                                TODO
                            </button>
                        </div>
                    </div>

                    ${isCustomerSelected ? `
                    <div class="payment-method-card" id="card_debt" style="border: 2px solid var(--danger); border-radius: 0.85rem; padding: 0.65rem 0.85rem; background: var(--danger-bg);">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
                            <div style="display: flex; align-items: center; gap: 0.4rem;">
                                <span style="font-size: 1.15rem;">📓</span>
                                <strong style="font-size: 0.88rem; color: var(--danger-text); text-transform: uppercase; font-weight: 800;">Anotar Deuda (Fiado)</strong>
                            </div>
                        </div>
                        <div style="display: flex; gap: 0.5rem; align-items: stretch;">
                            <div style="position: relative; flex: 1;">
                                <span style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); font-weight: 800; color: var(--danger); font-size: 1.15rem;">$</span>
                                <input type="number" id="pay_debt" class="pay-input-pro pay-input" style="width: 100%; height: 48px; padding: 0.5rem 0.6rem 0.5rem 2rem; font-size: 1.3rem; font-weight: 900; border: 2px solid var(--danger); border-radius: 0.6rem; background: #fff; color: var(--danger) !important; box-sizing: border-box;" 
                                       placeholder="0" value="${initialMethod === 'debt' ? total : ''}"
                                       inputmode="numeric" onfocus="this.select()">
                            </div>
                            <button type="button" class="btn btn-danger" onclick="POSView.fillAmount('pay_debt')" id="btn_fill_debt" style="padding: 0 1.5rem; height: 48px; font-weight: 900; font-size: 0.95rem; border-radius: 0.6rem; cursor: pointer;">
                                [F4] RESTO
                            </button>
                        </div>
                    </div>
                    
                    ${(parseFloat(customer.balanceCredit) || 0) > 0 ? `
                    <div class="payment-method-card" id="card_credit" style="border: 2px solid #10b981; border-radius: 0.85rem; padding: 0.65rem 0.85rem; background: #f0fdf4;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
                            <div style="display: flex; align-items: center; gap: 0.4rem;">
                                <span style="font-size: 1.15rem;">💰</span>
                                <strong style="font-size: 0.88rem; color: #166534; text-transform: uppercase; font-weight: 800;">Saldo a Favor (${formatCLP(customer.balanceCredit)})</strong>
                            </div>
                            <span style="font-size: 0.72rem; color: #047857; font-weight: 700;">¿Desea usarlo en esta venta?</span>
                        </div>
                        <div style="display: flex; gap: 0.4rem; align-items: stretch;">
                            <div style="position: relative; flex: 1;">
                                <span style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); font-weight: 800; color: #166534; font-size: 1.15rem;">$</span>
                                <input type="number" id="pay_credit" class="pay-input-pro pay-input" style="width: 100%; height: 48px; padding: 0.5rem 0.6rem 0.5rem 2rem; font-size: 1.3rem; font-weight: 900; border: 2px solid #10b981; border-radius: 0.6rem; background: #fff; color: #166534 !important; box-sizing: border-box;" 
                                       placeholder="0" inputmode="numeric" onfocus="this.select()">
                            </div>
                            <button type="button" class="btn btn-success" onclick="POSView.fillRemainingCredit(${total})" style="padding: 0 0.9rem; height: 48px; font-weight: 900; font-size: 0.82rem; border-radius: 0.6rem; background: #10b981; border: none; cursor: pointer; white-space: nowrap;">
                                USAR SALDO
                            </button>
                            <button type="button" class="btn btn-outline-secondary" onclick="const pc = document.getElementById('pay_credit'); if(pc) { pc.value = ''; pc.dispatchEvent(new Event('input')); }" style="padding: 0 0.75rem; height: 48px; font-weight: 800; font-size: 0.8rem; border-radius: 0.6rem; background: #fff; cursor: pointer; white-space: nowrap;" title="No usar saldo a favor en esta venta">
                                NO USAR
                            </button>
                        </div>
                    </div>
                    ` : ''}
                    ` : ''}
                </div>

                <!-- Columna Derecha: Resumen Azul y Confirmar -->
                <div class="payment-summary-card" id="paymentSummaryBox" style="border-radius: 1rem; padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 8px 30px rgba(79, 70, 229, 0.3);">
                    <div class="payment-summary-content">
                        <div class="payment-total-header" style="text-align: center; margin-bottom: 0.75rem;">
                            <div class="payment-total-label" style="font-size: 0.78rem; font-weight: 800; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 1px;">TOTAL A COBRAR</div>
                            <div id="modalTotalToPay" class="payment-total-value-huge" style="font-size: 2.3rem; font-weight: 900; color: #fff; margin-top: 0.25rem; line-height: 1;">${formatCLP(total, true)}</div>
                        </div>

                        <div class="payment-summary-details" style="display: flex; flex-direction: column; gap: 0.5rem;">
                            <!-- DESGLOSE FISCAL DINÁMICO -->
                            <div id="modalFiscalBreakdown" class="modal-fiscal-breakdown" style="background: rgba(255,255,255,0.1); padding: 0.5rem 0.75rem; border-radius: 0.5rem; font-size: 0.82rem; color: #fff;">
                                <div class="fiscal-row" style="display: flex; justify-content: space-between;">
                                    <span>Neto:</span>
                                    <strong id="modalNeto">$0</strong>
                                </div>
                                <div class="fiscal-row" style="display: flex; justify-content: space-between;">
                                    <span>IVA (19%):</span>
                                    <strong id="modalIVA">$0</strong>
                                </div>
                            </div>

                            <div class="payment-status-section" style="text-align: center; padding: 0.4rem; background: rgba(0,0,0,0.15); border-radius: 0.5rem;">
                                <div class="payment-status-label" style="font-size: 0.7rem; color: rgba(255,255,255,0.7); text-transform: uppercase; font-weight: 700;">Estado del Pago</div>
                                <div id="payment_status_text" class="payment-status-value" style="font-size: 1.1rem; font-weight: 900; color: #fbbf24;">PENDIENTE</div>
                            </div>

                            <div class="payment-summary-row" style="display: flex; justify-content: space-between; color: #fff; font-size: 0.95rem; font-weight: 700;">
                                <span class="summary-label">Recibido:</span>
                                <strong id="sum_paid" class="summary-value">${formatCLP(0, true)}</strong>
                            </div>

                            <div class="payment-summary-row" style="display: flex; justify-content: space-between; color: #fff; font-size: 1.25rem; font-weight: 900; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 0.4rem;">
                                <span id="diff_label" class="summary-label-big">Resta:</span>
                                <strong id="sum_diff" class="summary-value-huge">${formatCLP(total, true)}</strong>
                            </div>

                            <!-- Cálculo de vuelto automático -->
                            <div id="changeSection" style="display: none; margin-top: 0.5rem; padding: 0.6rem 0.75rem; background: #dcfce7; border: 2px solid #22c55e; border-radius: 0.6rem; text-align: center;">
                                <div style="font-size: 0.78rem; font-weight: 800; color: #166534;">💵 VUELTO A ENTREGAR</div>
                                <div id="changeAmount" style="font-size: 1.5rem; font-weight: 900; color: #15803d; line-height: 1.1;">$0</div>
                            </div>
                        </div>
                    </div>

                    <div class="payment-actions" style="margin-top: 0.75rem;">
                        <button id="btn_process_payment" class="btn btn-primary btn-process-payment" disabled onclick="POSView.processUnifiedSale()" 
                                style="width: 100%; height: 50px; font-size: 1.1rem; font-weight: 900; border-radius: 0.75rem; border: 2px solid #fff; box-shadow: 0 4px 15px rgba(0,0,0,0.2); letter-spacing: 0.5px;">
                            CONFIRMAR VENTA
                        </button>
                    </div>
                </div>
            </div>
        `;

        const footer = `<button class="btn btn-outline-secondary" onclick="closeModal()" style="font-weight: 700; padding: 0.4rem 1.25rem; border-radius: 0.5rem;">Cancelar</button>`;
        showModal(content, { title: '💰 Proceso de Pago', footer, width: '960px' });

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

            // Cambiar estilos del toggle de dinero a favor dinámicamente
            const creditToggleContainer = document.getElementById('payment-customer-credit-toggle');
            const creditToggleLabel = document.getElementById('use_credit_balance_label');
            const useCreditChk = document.getElementById('use_credit_balance');
            if (creditToggleContainer && useCreditChk) {
                const creditVal = parseFloat(document.getElementById('pay_credit')?.value) || 0;
                if (document.activeElement && document.activeElement.id === 'pay_credit') {
                    useCreditChk.checked = (creditVal > 0);
                }
                if (useCreditChk.checked || creditVal > 0) {
                    creditToggleContainer.style.background = 'rgba(16, 185, 129, 0.08)';
                    creditToggleContainer.style.borderColor = '#10b981';
                    if (creditToggleLabel) creditToggleLabel.style.color = '#065f46';
                } else {
                    creditToggleContainer.style.background = 'rgba(100, 116, 139, 0.05)';
                    creditToggleContainer.style.borderColor = '#cbd5e1';
                    if (creditToggleLabel) creditToggleLabel.style.color = '#64748b';
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

        // REGLA DE FIADO: Si el usuario escribe directamente en pay_debt, desmarcar 'Sumar deuda previa'
        const payDebtInput = document.getElementById('pay_debt');
        if (payDebtInput) {
            payDebtInput.addEventListener('input', () => {
                const val = parseFloat(payDebtInput.value) || 0;
                if (val > 0 && includeDebtChk && includeDebtChk.checked) {
                    includeDebtChk.checked = false;
                    showNotification('ℹ️ Se desmarcó "Sumar deuda previa" para no duplicar la deuda anterior.', 'info');
                    update();
                }
            });
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
        
        // REGLA CRÍTICA DE FIADO (Audio 3): Si el usuario pulsa [F4] RESTO para anotar a deuda,
        // JAMÁS se debe sumar la deuda previa a la casilla de deuda, porque la deuda previa YA está registrada.
        // Si la casilla 'Sumar deuda previa' estaba marcada, se desmarca automáticamente y se actualiza la UI.
        if (targetId === 'pay_debt' && includeDebtChk && includeDebtChk.checked) {
            includeDebtChk.checked = false;
            if (typeof this._updateModalUI === 'function') {
                this._updateModalUI();
            }
            showNotification('ℹ️ Se desmarcó "Sumar deuda previa" para no duplicar el saldo anterior.', 'info');
        }

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

    setCashAmount(amount) {
        const payCashInput = document.getElementById('pay_cash');
        if (payCashInput) {
            payCashInput.value = amount;
            payCashInput.dispatchEvent(new Event('input'));
            const btn = document.getElementById('btn_process_payment');
            if (btn && !btn.disabled) btn.focus();
        }
    },

    openNumpadForPayment(inputId, title) {
        const input = document.getElementById(inputId);
        if (!input) return;
        if (window.TouchNumpad) {
            TouchNumpad.open(input, {
                title: title || 'Monto a Cobrar',
                mode: 'currency',
                onConfirm: (val) => {
                    input.value = Math.round(val);
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
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
            const chk = document.getElementById('use_credit_balance');
            if (chk) chk.checked = true;
            creditInput.dispatchEvent(new Event('input'));
        }
    },

    onToggleCreditBalance() {
        const chk = document.getElementById('use_credit_balance');
        const creditInput = document.getElementById('pay_credit');
        if (!chk) return;

        const customer = posController.currentCustomer;
        const availableCredit = customer ? (parseFloat(customer.balanceCredit) || 0) : 0;

        if (chk.checked) {
            const summary = posController.getCartSummary();
            const includeDebtChk = document.getElementById('include_previous_debt');
            const isPreviousDebtIncluded = includeDebtChk ? includeDebtChk.checked : false;
            const previousDebtAmount = isPreviousDebtIncluded && customer ? (parseFloat(customer.totalDebt) || 0) : 0;
            const currentTotal = summary.roundedTotal + previousDebtAmount;

            const cash = parseFloat(document.getElementById('pay_cash')?.value) || 0;
            const card = parseFloat(document.getElementById('pay_card')?.value) || 0;
            const other = parseFloat(document.getElementById('pay_other')?.value) || 0;
            const debt = parseFloat(document.getElementById('pay_debt')?.value) || 0;

            const remaining = Math.max(0, currentTotal - (cash + card + other + debt));
            const toApply = Math.min(availableCredit, remaining > 0 ? remaining : currentTotal);

            if (creditInput) {
                creditInput.value = toApply > 0 ? toApply : availableCredit;
                creditInput.dispatchEvent(new Event('input'));
            }
        } else {
            if (creditInput) {
                creditInput.value = '';
                creditInput.dispatchEvent(new Event('input'));
            }
        }
    },

    async processUnifiedSale() {
        if (this._isProcessingSale) return;
        this._isProcessingSale = true;

        const btn = document.getElementById('btn_process_payment');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> PROCESANDO...';
        }

        try {
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
            let docType = this.selectedDocType;
            if (card > 0 && docType !== 'sin_boleta') docType = 'boleta';

            const isDebtOnly = salePaidDetails.debt > 0 && (scash + scard + sother + scred) === 0;

            // Validación de Ventas Fiadas y Límites de Crédito:
            // Si quien cobra es un cajero/empleado y el cliente tiene saldo pendiente o supera el cupo,
            // se requiere autorización obligatoria por PIN Maestro del Dueño.
            let creditLimitOverridden = false;
            if (salePaidDetails.debt > 0 && customer) {
                const userRole = (typeof AuthManager !== 'undefined' && AuthManager.getCurrentUserRole) 
                    ? AuthManager.getCurrentUserRole() 
                    : (localStorage.getItem('USER_ROLE') || 'cashier');
                const roleNormalized = String(userRole || '').toLowerCase().trim();
                const isOwnerOrAdmin = ['owner', 'admin', 'partner', 'propietario', 'administrador'].includes(roleNormalized);

                const currentDebt = parseFloat(customer.totalDebt) || 0;
                const limit = parseFloat(customer.creditLimit) || 0;
                const newTotalDebt = currentDebt + salePaidDetails.debt;
                const isOverLimit = (limit > 0 && newTotalDebt > limit);
                const hasPendingDebt = (currentDebt > 0);

                // Si es cajero y (el cliente ya debe plata o supera el límite de crédito):
                if (!isOwnerOrAdmin && (hasPendingDebt || isOverLimit)) {
                    let pinTitle = '⚠️ AUTORIZACIÓN DE FIADO REQUERIDA';
                    let pinMessage = `El cliente "${customer.name}" tiene saldo pendiente de ${formatCLP(currentDebt)}.\n`;
                    if (isOverLimit) {
                        pinTitle = '⚠️ LÍMITE DE CRÉDITO EXCEDIDO';
                        pinMessage += `Con este fiado alcanzará ${formatCLP(newTotalDebt)} (supera su límite de ${formatCLP(limit)}).\n\n`;
                    } else {
                        pinMessage += `Con este nuevo fiado alcanzará una deuda acumulada de ${formatCLP(newTotalDebt)}.\n\n`;
                    }
                    pinMessage += `Se requiere el PIN Maestro del Dueño o Administrador para autorizar el fiado:`;

                    const authResult = await SupervisorAuth.requirePin(pinTitle, pinMessage);

                    if (!authResult || !authResult.authorized) {
                        showNotification('⛔ Venta fiada cancelada: requiere autorización del Dueño / Administrador.', 'warning');
                        if (btn) {
                            btn.disabled = false;
                            btn.textContent = 'CONFIRMAR VENTA';
                        }
                        this._isProcessingSale = false;
                        return;
                    }

                    creditLimitOverridden = isOverLimit;
                    try {
                        AuditLogService.log({
                            entity: 'customer',
                            entityId: customer.id,
                            action: 'credit_debt_override',
                            summary: `Dueño (${authResult.supervisorName || 'Autorizado'}) autorizó venta fiada a ${customer.name} (Deuda previa: ${formatCLP(currentDebt)}, Venta: ${formatCLP(salePaidDetails.debt)})`,
                            metadata: { customerId: customer.id, previousDebt: currentDebt, newTotalDebt, supervisor: authResult.supervisorName }
                        });
                    } catch (_) {}
                } else if (isOverLimit) {
                    creditLimitOverridden = true;
                }
            }
            
            const sale = await posController.completeSale(mainMethod, isDebtOnly, salePaidDetails, docType, finalSaleTotal, creditLimitOverridden);
            
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
            this.startNewSale();
            this.updateRecentSalesUI();
            closeModal();
            
            // Si hubo fiado (deuda), consultar compromiso de pago al cliente
            if (salePaidDetails.debt > 0 && customer) {
                this.showDebtPromiseModal(customer, sale, salePaidDetails.debt, totalIn, calculatedChange);
            } else {
                // Mostrar recibo con el monto total entregado y el vuelto calculado
                this.showSaleReceipt(sale, false, totalIn, calculatedChange);
            }
        } catch (e) {
            showNotification(e.message, 'error');
        } finally {
            this._isProcessingSale = false;
            const currentBtn = document.getElementById('btn_process_payment');
            if (currentBtn && document.getElementById('paymentSummaryBox')) {
                currentBtn.disabled = false;
                currentBtn.textContent = 'CONFIRMAR VENTA';
            }
        }
    },

    async quickPayExactCash() {
        if (this._isProcessingSale) return;
        const summary = posController.getCartSummary();
        if (summary.items.length === 0) {
            showNotification('El carrito está vacío', 'warning');
            return;
        }

        const salePaidDetails = {
            cash: summary.roundedTotal,
            card: 0,
            other: 0,
            debt: 0,
            creditBalance: 0
        };

        await this._executeSaleDirectly(salePaidDetails, summary.roundedTotal, 0, this.selectedDocType || 'boleta');
    },

    async quickPayCard() {
        if (this._isProcessingSale) return;
        const summary = posController.getCartSummary();
        if (summary.items.length === 0) {
            showNotification('El carrito está vacío', 'warning');
            return;
        }

        const salePaidDetails = {
            cash: 0,
            card: summary.total,
            other: 0,
            debt: 0,
            creditBalance: 0
        };

        await this._executeSaleDirectly(salePaidDetails, summary.total, 0, this.selectedDocType || 'boleta');
    },

    async _executeSaleDirectly(salePaidDetails, finalSaleTotal, calculatedChange = 0, forcedDocType = 'boleta') {
        if (this._isProcessingSale) return;
        this._isProcessingSale = true;

        try {
            let mainMethod = salePaidDetails.cash > 0 ? 'cash' : (salePaidDetails.card > 0 ? 'card' : 'other');
            const sale = await posController.completeSale(mainMethod, false, salePaidDetails, forcedDocType, finalSaleTotal);
            
            this.startNewSale();
            this.updateRecentSalesUI();
            
            showNotification(`✅ Venta #${sale.terminal_id ? sale.terminal_id + '-' : 'PC-1-'}${sale.saleNumber || ''} procesada al instante`, 'success');
            this.showSaleReceipt(sale, false, finalSaleTotal, calculatedChange);
        } catch (e) {
            showNotification(e.message || 'Error al procesar cobro rápido', 'error');
        } finally {
            this._isProcessingSale = false;
        }
    },

    renderHeldSalesTabs() {
        const tabBar = document.getElementById('heldSalesTabBar');
        if (!tabBar) return;

        const sales = posController.heldSales || [];
        const count = sales.length;

        let html = '';

        if (count === 0) {
            html += `
                <button type="button" class="btn btn-outline-secondary" onclick="POSView.openHeldSalesMenu()" title="Ventas en espera [F6]" 
                        style="height: 40px; padding: 0 0.8rem; border-radius: 0.65rem; border: 1.5px solid var(--border); background: var(--surface); color: var(--text-muted); font-weight: 800; font-size: 0.8rem; white-space: nowrap; display: flex; align-items: center; gap: 0.35rem; transition: all 0.2s; cursor: pointer;">
                    <span style="font-size: 0.95rem;">⏸️</span>
                    <span>[F6] EN ESPERA</span>
                    <span style="background: rgba(0,0,0,0.06); color: var(--text-muted); padding: 0.1rem 0.45rem; border-radius: 9999px; font-size: 0.72rem; font-weight: 900;">0</span>
                </button>
            `;
        } else {
            const lastSale = sales[sales.length - 1];
            html += `
                <button type="button" class="btn btn-warning" onclick="POSView.openHeldSalesMenu()" title="Abrir lista de clientes en espera [F6]" 
                        style="height: 40px; padding: 0 0.85rem; border-radius: 0.65rem; border: 2px solid #d97706; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; font-weight: 950; font-size: 0.84rem; white-space: nowrap; display: flex; align-items: center; gap: 0.45rem; box-shadow: 0 2px 10px rgba(245, 158, 11, 0.35); cursor: pointer; transition: all 0.2s;">
                    <span style="font-size: 1rem;">⏸️</span>
                    <span>[F6] EN ESPERA</span>
                    <span style="background: #ffffff; color: #b45309; padding: 0.12rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 950;">${count}</span>
                </button>

                <button type="button" class="btn btn-outline-warning" onclick="POSView.quickSwapHeldSale()" title="Alternar rápido con ${safeHTML(lastSale.name)}"
                        style="height: 40px; padding: 0 0.75rem; border-radius: 0.65rem; border: 2px solid #f59e0b; background: rgba(245, 158, 11, 0.12); color: #d97706; font-weight: 900; font-size: 0.8rem; white-space: nowrap; display: flex; align-items: center; gap: 0.35rem; cursor: pointer; max-width: 220px; transition: all 0.2s;">
                    <span style="font-size: 0.95rem;">🔄</span>
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Volver a: <strong>${safeHTML(lastSale.name)}</strong></span>
                </button>
            `;
        }

        tabBar.innerHTML = html;
    },

    quickSwapHeldSale() {
        const last = posController.getLastHeldSale();
        if (!last) {
            showNotification('No hay clientes en espera para alternar', 'info');
            return;
        }
        this.resumeHeldSale(last.id);
    },

    discardHeldSale(id) {
        if (confirm('¿Deseas descartar esta venta en espera?')) {
            posController.deleteHeldSale(id);
            this.updateCart();
            showNotification('Venta en espera descartada', 'info');
            const modalTitle = document.querySelector('.modal-header h3, .modal-title');
            if (modalTitle && modalTitle.textContent.includes('Espera')) {
                this.openHeldSalesMenu();
            }
        }
    },

    showSaleReceipt(sale, isPending = false, tendered = null, change = null) {
        // Guardar referencia para copias
        this.lastSale = sale;
        this.lastTendered = tendered;
        this.lastChange = change;

        // Imprimir automáticamente o abrir gaveta si está configurado (con aislamiento de hardware)
        try {
            const printerPort = localStorage.getItem('printerPort') || 'USB';
            const autoPrintTicket = localStorage.getItem('autoPrintTicket') === 'true';
            const autoOpenDrawer = localStorage.getItem('AUTO_OPEN_CASH_DRAWER') === 'true';
            const isCash = sale.paymentMethod === 'cash' || (sale.payment_methods && sale.payment_methods.some(m => m.method === 'cash'));

            if (autoOpenDrawer && isCash) {
                if (typeof SettingsView !== 'undefined' && SettingsView.testCashDrawer) {
                    SettingsView.testCashDrawer();
                }
            }

            if (printerPort === 'bluetooth' && autoPrintTicket) {
                this.printBluetoothSale(sale, tendered, change).catch(err => {
                    console.warn('Aviso hardware impresora Bluetooth:', err);
                    showNotification('⚠️ Venta registrada. Verifique papel o batería de impresora.', 'warning');
                });
            }
        } catch (errPrint) {
            console.warn('Fallo no bloqueante en periférico de impresión:', errPrint);
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
                    <div class="receipt-folio">Folio #${sale.terminal_id ? sale.terminal_id + '-' : 'PC-1-'}${sale.saleNumber}</div>
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

        if (this._receiptTimer) {
            clearInterval(this._receiptTimer);
            this._receiptTimer = null;
        }

        let sec = 5;
        this._receiptTimer = setInterval(() => {
            sec--;
            const timerEl = document.getElementById('timer');
            if (timerEl) timerEl.textContent = sec;
            if (sec <= 0) { 
                if (this._receiptTimer) {
                    clearInterval(this._receiptTimer);
                    this._receiptTimer = null;
                }
                // Solo cerrar si el modal activo que está en pantalla es efectivamente el Recibo de Venta
                const activeModal = document.querySelector('.modal');
                const title = activeModal ? activeModal.querySelector('.modal-header h3')?.textContent : '';
                if (title && title.includes('Recibo de Venta')) {
                    closeModal(); 
                    const searchInput = document.getElementById('productSearch');
                    if (searchInput) searchInput.focus();
                }
            }
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
        this._topVolumeIds = topVolumeIds;

        const content = `
            <div class="customer-modal-container">
                <div class="customer-search-wrapper" style="display: flex; gap: 0.5rem; align-items: center;">
                    <span class="customer-search-icon">🔍</span>
                    <input type="text" id="cSearch" class="customer-search-input" placeholder="Escribir nombre del cliente..." autofocus style="flex: 1;">
                    <button type="button" id="btnToggleCustomerPrivacy" class="btn btn-sm btn-outline-secondary" onclick="POSView.toggleCustomerPrivacy()" style="height: 40px; white-space: nowrap; font-weight: 800; border-radius: 0.65rem; padding: 0 0.85rem; display: flex; align-items: center; gap: 0.35rem; border: 1.5px solid var(--border);" title="${this.customerPrivacyMode ? 'Mostrar saldos reales en pantalla' : 'Ocultar saldos por privacidad'}">
                        <span>${this.customerPrivacyMode ? '👁️' : '🔒'}</span>
                        <span>${this.customerPrivacyMode ? 'Ver Saldos' : 'Ocultar'}</span>
                    </button>
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

    toggleCustomerPrivacy() {
        this.customerPrivacyMode = !this.customerPrivacyMode;
        const btn = document.getElementById('btnToggleCustomerPrivacy');
        if (btn) {
            btn.innerHTML = `<span>${this.customerPrivacyMode ? '👁️' : '🔒'}</span> <span>${this.customerPrivacyMode ? 'Ver Saldos' : 'Ocultar'}</span>`;
            btn.title = this.customerPrivacyMode ? 'Mostrar saldos reales en pantalla' : 'Ocultar saldos por privacidad';
        }
        const cList = document.getElementById('cList');
        if (cList && this.customerResults) {
            cList.innerHTML = this.renderCustomerList(this.customerResults, this._topVolumeIds || [], this.customerSelectedIndex);
        }
    },

    renderCustomerList(list, topIds = [], selectedIndex = -1) {
        if (list.length === 0) return `<div style="padding: 3rem; text-align: center; opacity: 0.5;">No hay resultados</div>`;

        return list.map((c, index) => {
            const debt = Number(c.totalDebt || 0);
            const credit = Number(c.balanceCredit || 0);
            const netDebt = Math.max(0, debt - credit);
            const netCredit = Math.max(0, credit - debt);
            const isTop = topIds.includes(c.id);
            const isSelected = index === selectedIndex;

            let statusClass = 'badge-clean';
            let statusText = 'Al Día';
            let cardClass = '';

            if (netDebt > 0) {
                statusClass = 'badge-debt';
                statusText = 'Con Deuda';
                cardClass = 'has-debt';
            } else if (netCredit > 0) {
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
                        <div class="customer-avatar">${netDebt > 0 ? '📉' : (netCredit > 0 ? '💰' : '👤')}</div>
                        <div>
                            <div style="font-weight: 800; font-size: 1.15rem; color: #1e293b;">${safeHTML(c.name)}</div>
                            <span class="customer-badge ${statusClass}">${statusText}</span>
                        </div>
                    </div>

                    <div style="text-align: right;">
                        ${debt > 0 ? (
                            this.customerPrivacyMode
                                ? `<div style="font-size: 1.15rem; font-weight: 950; letter-spacing: 2px; color: var(--danger);">••••••</div><small style="opacity:0.8; font-weight:800; text-transform:uppercase; font-size: 0.65rem; color: var(--danger);">SALDO PENDIENTE</small>`
                                : `<div style="font-size: 1.25rem; font-weight: 950; color: var(--danger);">${formatCLP(debt)}</div><small style="opacity:0.6; font-weight:800; text-transform:uppercase; font-size: 0.65rem; color: var(--danger);">DEUDA</small>`
                        ) : ''}
                        ${credit > 0 ? (
                            this.customerPrivacyMode
                                ? `<div style="font-size: 1.15rem; font-weight: 950; letter-spacing: 2px; color: var(--success);">••••••</div><small style="opacity:0.8; font-weight:800; text-transform:uppercase; font-size: 0.65rem; color: var(--success);">SALDO A FAVOR</small>`
                                : `<div style="font-size: 1.25rem; font-weight: 950; color: var(--success);">${formatCLP(credit)}</div><small style="opacity:0.6; font-weight:800; text-transform:uppercase; font-size: 0.65rem; color: var(--success);">SALDO A FAVOR</small>`
                        ) : ''}
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

        let promiseBadge = '';
        if (customer.promiseDate) {
            const pDate = new Date(customer.promiseDate + 'T00:00:00');
            const dateStr = !isNaN(pDate.getTime()) 
                ? pDate.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' }) 
                : customer.promiseDate;
            promiseBadge = `<span style="color: #4f46e5; font-size: 0.7rem; font-weight: 900; background: rgba(79,70,229,0.12); padding: 0.05rem 0.35rem; border-radius: 0.4rem; border: 1px solid #6366f1; white-space: nowrap;" title="Compromiso de pago agendado para: ${customer.promiseDate}">🗓️ Paga: ${dateStr}</span>`;
        }

        const infoEl = document.getElementById('customerInfo');
        if (infoEl) {
            infoEl.innerHTML = `
                <div style="background: var(--primary-soft); border: 2px solid var(--primary); padding: 0.2rem 0.65rem; border-radius: 0.65rem; display: flex; justify-content: space-between; align-items: center; height: 36px; max-width: 260px; box-shadow: var(--shadow-sm); gap: 0.4rem;">
                    <div style="overflow: hidden; flex: 1; display: flex; align-items: center; gap: 0.35rem;">
                        <strong style="color: var(--primary); font-size: 0.82rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 900;" title="${safeHTML(customer.name)}">👤 ${safeHTML(customer.name)}</strong>
                        ${(customer.totalDebt > 0) ? `<span style="color: var(--danger); font-size: 0.7rem; font-weight: 900; background: var(--danger-bg); padding: 0.05rem 0.35rem; border-radius: 0.4rem; border: 1px solid var(--danger); white-space: nowrap;">-${formatCLP(customer.totalDebt)}</span>` : ''}
                        ${(customer.balanceCredit > 0) ? `<span style="color: #065f46; font-size: 0.7rem; font-weight: 900; background: #dcfce7; padding: 0.05rem 0.35rem; border-radius: 0.4rem; border: 1px solid #22c55e; white-space: nowrap;" title="Saldo a favor disponible">💰 +${formatCLP(customer.balanceCredit)}</span>` : ''}
                        ${(!customer.totalDebt && !customer.balanceCredit) ? '<span style="color: var(--success); font-size: 0.7rem; font-weight: 900;">✅</span>' : ''}
                        ${promiseBadge}
                    </div>
                    <button class="btn btn-sm btn-outline-danger" style="padding: 0.15rem 0.35rem; font-size: 0.75rem; border: none; line-height: 1; cursor: pointer;" onclick="POSView.removeCustomer()" title="Quitar Cliente">✕</button>
                </div>
            `;
        }
        this.toggleFiarButton(true);
        closeModal();
    },

    showDebtPromiseModal(customer, sale, debtAmount, totalIn, calculatedChange) {
        const today = new Date();
        const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        // Generar botones de días de la semana (próximos 6 días)
        let weekDaysHtml = '';
        for (let i = 1; i <= 6; i++) {
            const d = new Date();
            d.setDate(today.getDate() + i);
            const name = dayNames[d.getDay()];
            const dayNum = String(d.getDate()).padStart(2, '0');
            const monthNum = String(d.getMonth() + 1).padStart(2, '0');
            const iso = d.toISOString().split('T')[0];
            const isTomorrow = i === 1;
            weekDaysHtml += `
                <button type="button" class="btn btn-sm btn-outline-primary btn-quick-promise" data-iso="${iso}" style="font-weight: 700; border-radius: 0.5rem; padding: 0.35rem 0.45rem; font-size: 0.78rem; display: flex; flex-direction: column; align-items: center; line-height: 1.1;">
                    <span>${isTomorrow ? 'Mañana' : name}</span>
                    <span style="font-size: 0.68rem; opacity: 0.75;">${dayNum}/${monthNum}</span>
                </button>
            `;
        }

        // Fin de mes
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const endOfMonthIso = endOfMonth.toISOString().split('T')[0];

        const content = `
            <div style="padding: 0.5rem 0.25rem;">
                <div style="background: #eff6ff; border: 1.5px solid #60a5fa; border-radius: 0.85rem; padding: 0.85rem 1rem; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: 800; font-size: 1.05rem; color: #1e3a8a;">👤 ${safeHTML(customer.name)}</div>
                        <div style="font-size: 0.82rem; color: #3b82f6; font-weight: 600;">Venta #${sale.terminal_id ? sale.terminal_id + '-' : 'PC-1-'}${sale.saleNumber || sale.id} registrada a crédito (fiada)</div>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-size: 0.72rem; font-weight: 800; color: #ef4444; text-transform: uppercase;">Monto Fiado</span>
                        <div style="font-size: 1.3rem; font-weight: 950; color: #ef4444;">${formatCLP(debtAmount)}</div>
                    </div>
                </div>

                <div style="margin-bottom: 1.25rem;">
                    <label style="font-weight: 800; font-size: 0.9rem; color: #1e293b; display: block; margin-bottom: 0.5rem;">
                        🗓️ ¿Cuándo se compromete a pagar el cliente?
                    </label>
                    
                    <!-- Días relativos rápidos -->
                    <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.75rem;">
                        <button type="button" class="btn btn-sm btn-outline-secondary btn-quick-promise" data-days="1" style="font-weight: 700; border-radius: 0.5rem;">+1 Día</button>
                        <button type="button" class="btn btn-sm btn-outline-secondary btn-quick-promise" data-days="2" style="font-weight: 700; border-radius: 0.5rem;">+2 Días</button>
                        <button type="button" class="btn btn-sm btn-outline-secondary btn-quick-promise" data-days="3" style="font-weight: 700; border-radius: 0.5rem;">+3 Días</button>
                        <button type="button" class="btn btn-sm btn-outline-secondary btn-quick-promise" data-days="4" style="font-weight: 700; border-radius: 0.5rem;">+4 Días</button>
                        <button type="button" class="btn btn-sm btn-outline-secondary btn-quick-promise" data-days="5" style="font-weight: 700; border-radius: 0.5rem;">+5 Días</button>
                        <button type="button" class="btn btn-sm btn-outline-secondary btn-quick-promise" data-days="7" style="font-weight: 700; border-radius: 0.5rem;">+7 Días (1 Sem)</button>
                        <button type="button" class="btn btn-sm btn-outline-secondary btn-quick-promise" data-days="15" style="font-weight: 700; border-radius: 0.5rem;">+15 Días</button>
                        <button type="button" class="btn btn-sm btn-outline-secondary btn-quick-promise" data-iso="${endOfMonthIso}" style="font-weight: 700; border-radius: 0.5rem;">Fin de Mes (${endOfMonth.getDate()}/${endOfMonth.getMonth()+1})</button>
                    </div>

                    <!-- Días de la semana -->
                    <div style="margin-bottom: 0.85rem;">
                        <small style="font-weight: 800; color: #64748b; text-transform: uppercase; font-size: 0.7rem; display: block; margin-bottom: 0.35rem;">Próximos días:</small>
                        <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.35rem;">
                            ${weekDaysHtml}
                        </div>
                    </div>

                    <!-- Input manual de días o selector de calendario -->
                    <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 0.75rem; padding: 0.85rem; display: flex; flex-direction: column; gap: 0.65rem;">
                        <div style="display: flex; gap: 0.75rem; align-items: center;">
                            <div style="flex: 1;">
                                <label style="font-size: 0.75rem; font-weight: 800; color: #475569; display: block; margin-bottom: 0.2rem;">En cantidad de días (ej: 4):</label>
                                <input type="number" id="inputPromiseDays" class="form-control" min="1" max="365" placeholder="Escribe días..." style="height: 40px; font-weight: 800; font-size: 1rem;">
                            </div>
                            <div style="flex: 1.2;">
                                <label style="font-size: 0.75rem; font-weight: 800; color: #475569; display: block; margin-bottom: 0.2rem;">O elige fecha exacta:</label>
                                <input type="date" id="inputPromiseDate" class="form-control" style="height: 40px; font-weight: 800;">
                            </div>
                        </div>

                        <div id="promisePreviewBox" style="background: #ffffff; border: 1.5px dashed #cbd5e1; border-radius: 0.5rem; padding: 0.5rem 0.75rem; text-align: center; color: #64748b; font-size: 0.85rem; font-weight: 700;">
                            Selecciona o escribe los días para calcular la fecha
                        </div>
                    </div>
                </div>

                <div style="display: flex; gap: 0.75rem; align-items: center; border-top: 1.5px solid var(--border); padding-top: 1rem;">
                    <button type="button" id="btnSaveDebtPromise" class="btn btn-primary btn-lg" style="flex: 2; height: 48px; font-weight: 900; font-size: 0.95rem; display: flex; align-items: center; justify-content: center; gap: 0.45rem;">
                        <span>💾</span>
                        <span>GUARDAR COMPROMISO [Enter]</span>
                    </button>
                    <button type="button" id="btnSkipDebtPromise" class="btn btn-outline-secondary btn-lg" style="flex: 1; height: 48px; font-weight: 800; font-size: 0.9rem;">
                        OMITIR [ESC]
                    </button>
                </div>
            </div>
        `;

        showModal(content, { title: 'Compromiso de Pago', width: '560px' });

        const inputDays = document.getElementById('inputPromiseDays');
        const inputDate = document.getElementById('inputPromiseDate');
        const previewBox = document.getElementById('promisePreviewBox');
        const btnSave = document.getElementById('btnSaveDebtPromise');
        const btnSkip = document.getElementById('btnSkipDebtPromise');

        let selectedIso = '';

        const updatePreview = (isoStr) => {
            selectedIso = isoStr;
            if (!isoStr) {
                previewBox.innerHTML = 'Selecciona o escribe los días para calcular la fecha';
                previewBox.style.borderColor = '#cbd5e1';
                previewBox.style.background = '#ffffff';
                previewBox.style.color = '#64748b';
                return;
            }
            const parts = isoStr.split('-');
            const targetDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            const dayName = dayNames[targetDate.getDay()];
            const dayNum = targetDate.getDate();
            const monthName = monthNames[targetDate.getMonth()];
            const year = targetDate.getFullYear();

            previewBox.innerHTML = `📅 Fecha acordada: <strong style="color: #4f46e5; font-size: 1rem;">${dayName} ${dayNum} de ${monthName}, ${year}</strong>`;
            previewBox.style.borderColor = '#6366f1';
            previewBox.style.background = '#f5f3ff';
            previewBox.style.color = '#4338ca';
        };

        // Escuchar clics en botones rápidos
        document.querySelectorAll('.btn-quick-promise').forEach(btn => {
            btn.addEventListener('click', () => {
                let targetIso = '';
                if (btn.dataset.iso) {
                    targetIso = btn.dataset.iso;
                } else if (btn.dataset.days) {
                    const days = parseInt(btn.dataset.days);
                    const d = new Date();
                    d.setDate(d.getDate() + days);
                    targetIso = d.toISOString().split('T')[0];
                    if (inputDays) inputDays.value = days;
                }
                if (inputDate) inputDate.value = targetIso;
                updatePreview(targetIso);
            });
        });

        if (inputDays) {
            inputDays.addEventListener('input', (e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val) && val > 0) {
                    const d = new Date();
                    d.setDate(d.getDate() + val);
                    const iso = d.toISOString().split('T')[0];
                    if (inputDate) inputDate.value = iso;
                    updatePreview(iso);
                } else {
                    updatePreview('');
                }
            });
        }

        if (inputDate) {
            inputDate.addEventListener('input', (e) => {
                const val = e.target.value;
                if (val) {
                    updatePreview(val);
                    const d = new Date(val + 'T00:00:00');
                    const diffTime = d.getTime() - new Date().setHours(0,0,0,0);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (inputDays && diffDays > 0) inputDays.value = diffDays;
                } else {
                    updatePreview('');
                }
            });
        }

        let finished = false;
        const finishPromise = async (save) => {
            if (finished) return;
            finished = true;
            document.removeEventListener('keydown', modalKeyHandler);
            if (save && selectedIso) {
                try {
                    await Customer.update(customer.id, { promiseDate: selectedIso });
                    showNotification('Compromiso de pago agendado con éxito', 'success');
                } catch (err) {
                    console.error('Error al guardar compromiso:', err);
                    showNotification('No se pudo guardar la fecha de compromiso', 'warning');
                }
            }
            closeModal();
            POSView.showSaleReceipt(sale, true, totalIn, calculatedChange);
        };

        const modalKeyHandler = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                finishPromise(true);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                finishPromise(false);
            }
        };
        document.addEventListener('keydown', modalKeyHandler);

        if (btnSave) {
            btnSave.addEventListener('click', () => finishPromise(true));
        }
        if (btnSkip) {
            btnSkip.addEventListener('click', () => finishPromise(false));
        }
    },

    removeCustomer() {
        if (typeof posController !== 'undefined') {
            posController.setCustomer(null);
            posController.currentCustomer = null;
        }
        this.selectedCustomer = null;
        const infoEl = document.getElementById('customerInfo');
        if (infoEl) {
            infoEl.innerHTML = `
                <button type="button" class="btn btn-outline-primary btn-customer-select" onclick="POSView.selectCustomer()"
                        style="height: 40px; padding: 0 0.75rem; font-weight: 800; font-size: 0.8rem; border-radius: 0.65rem; border: 2px solid var(--primary); display: flex; align-items: center; gap: 0.35rem; white-space: nowrap; transition: all 0.2s; cursor: pointer;">
                    <span>👤</span>
                    <span>(F3) CLIENTE</span>
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
        if (this._receiptTimer) {
            clearInterval(this._receiptTimer);
            this._receiptTimer = null;
        }
        if (typeof posController !== 'undefined') {
            if (typeof posController.clearCart === 'function') posController.clearCart();
            else if (typeof posController.resetCart === 'function') posController.resetCart();
            posController.currentCustomer = null;
        }
        this.removeCustomer();
        this.selectedCustomer = null;
        this.customerResults = [];
        this.selectedDocType = 'boleta';
        this.updateCart();
        if (typeof this.updateRecentSalesUI === 'function') {
            this.updateRecentSalesUI();
        }
        const searchInput = document.getElementById('productSearch');
        if (searchInput) {
            searchInput.value = '';
            setTimeout(() => { searchInput.focus(); }, 150);
        } else if (typeof this.focusSearch === 'function') {
            setTimeout(() => this.focusSearch(), 150);
        }
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
        this.openHeldSalesMenu();
    },

    openHeldSalesMenu() {
        const sales = posController.heldSales || [];
        const hasCart = posController.cart.length > 0;

        // Si no hay productos en caja y tampoco hay clientes en espera
        if (!hasCart && sales.length === 0) {
            showNotification('No hay productos en el carrito ni ventas en espera', 'info');
            return;
        }

        const currentCustomer = posController.currentCustomer;
        const defaultName = currentCustomer ? currentCustomer.name : '';
        const cartTotal = posController.cart.reduce((sum, item) => sum + item.total, 0);

        let pauseCurrentCard = '';
        if (hasCart) {
            pauseCurrentCard = `
                <div style="background: rgba(245, 158, 11, 0.08); border: 2px solid #f59e0b; border-radius: 0.85rem; padding: 1rem; margin-bottom: 1.25rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
                        <span style="font-size: 0.85rem; font-weight: 900; color: #b45309; text-transform: uppercase;">⏸️ Venta Actual en Caja</span>
                        <strong style="font-size: 0.95rem; color: var(--primary); font-weight: 950;">${posController.cart.length} productos • ${formatCLP(cartTotal)}</strong>
                    </div>
                    <div style="display: flex; gap: 0.6rem; align-items: center;">
                        <input type="text" id="heldSaleName" class="form-control" placeholder="Nombre de cliente o mesa (Ej: Mesa 5, Don Carlos)..." value="${safeHTML(defaultName)}" style="flex: 1; height: 42px; font-weight: 700; border: 1.5px solid #d97706; border-radius: 0.65rem;" autofocus>
                        <button type="button" class="btn btn-warning" onclick="POSView.processHoldSale(document.getElementById('heldSaleName').value)" style="height: 42px; padding: 0 1.15rem; font-weight: 900; font-size: 0.85rem; border-radius: 0.65rem; white-space: nowrap; box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3); cursor: pointer;">
                            Poner en Espera
                        </button>
                    </div>
                </div>
            `;
        }

        let salesListHtml = '';
        if (sales.length === 0) {
            salesListHtml = `
                <div style="text-align: center; padding: 2.5rem 1rem; background: var(--surface-content); border-radius: 0.85rem; border: 1.5px dashed var(--border); color: var(--text-muted);">
                    <div style="font-size: 2.2rem; margin-bottom: 0.4rem;">☕</div>
                    <div style="font-weight: 800; font-size: 1rem; color: var(--text-main);">No hay otros clientes en espera</div>
                    <div style="font-size: 0.82rem; margin-top: 0.25rem;">Los clientes que pongas en pausa aparecerán organizados aquí</div>
                </div>
            `;
        } else {
            // Mostrar los más recientes primero
            const reversedSales = [...sales].reverse();
            salesListHtml = `
                <div style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 420px; overflow-y: auto; padding-right: 0.25rem;">
                    ${reversedSales.map(s => {
                        const total = s.cart.reduce((sum, item) => sum + item.total, 0);
                        const itemsCount = s.cart.length;
                        const timeStr = formatTime(s.timestamp);
                        const relTime = this._getRelativeTime(s.timestamp);
                        return `
                            <div style="background: var(--surface); border: 2px solid var(--border); border-radius: 0.85rem; padding: 0.9rem 1.1rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; transition: all 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                                <div style="flex: 1; min-width: 0;">
                                    <div style="font-size: 1.12rem; font-weight: 950; color: var(--text-main); margin-bottom: 0.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                        👤 ${safeHTML(s.name)}
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 0.85rem; font-size: 0.8rem; color: var(--text-muted); font-weight: 700; flex-wrap: wrap;">
                                        <span>🕒 ${timeStr} (${relTime})</span>
                                        <span>📦 ${itemsCount} productos</span>
                                        <strong style="color: var(--primary); font-size: 1rem; font-weight: 950;">${formatCLP(total)}</strong>
                                    </div>
                                    ${s.customer ? `<div style="font-size: 0.75rem; color: var(--primary); margin-top: 0.25rem; font-weight: 800;">Cliente asignado: ${safeHTML(s.customer.name)}</div>` : ''}
                                </div>
                                <div style="display: flex; gap: 0.5rem; align-items: center; flex-shrink: 0;">
                                    <button type="button" class="btn btn-sm btn-outline-danger" onclick="POSView.discardHeldSale(${s.id})" title="Descartar esta venta" style="height: 40px; padding: 0 0.8rem; border-radius: 0.65rem; font-weight: 900; border: 1.5px solid var(--danger); cursor: pointer;">
                                        🗑️
                                    </button>
                                    <button type="button" class="btn btn-sm btn-success" onclick="POSView.resumeHeldSale(${s.id})" style="height: 40px; padding: 0 1.25rem; border-radius: 0.65rem; font-weight: 950; font-size: 0.88rem; white-space: nowrap; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25); cursor: pointer;">
                                        ${hasCart ? '🔄 Alternar / Cargar' : 'Reanudar ↩️'}
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        const content = `
            <div style="display: flex; flex-direction: column;">
                ${pauseCurrentCard}
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem;">
                    <strong style="font-size: 0.88rem; font-weight: 900; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">
                        Clientes en Espera (${sales.length})
                    </strong>
                </div>
                ${salesListHtml}
            </div>
        `;

        const footer = `<button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>`;
        showModal(content, { title: 'Gestión de Clientes en Espera', footer, width: '600px' });

        const input = document.getElementById('heldSaleName');
        if (input) {
            setTimeout(() => {
                input.focus();
                input.select();
            }, 100);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.processHoldSale(input.value);
                }
            });
        }
    },

    _getRelativeTime(timestamp) {
        if (!timestamp) return 'Reciente';
        const diffMs = Date.now() - new Date(timestamp).getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'Hace un momento';
        if (diffMins === 1) return 'Hace 1 min';
        if (diffMins < 60) return `Hace ${diffMins} min`;
        const diffHours = Math.floor(diffMins / 60);
        return `Hace ${diffHours} h`;
    },

    processHoldSale(name) {
        try {
            let finalName = (typeof name === 'string') ? name.trim() : '';
            if (!finalName) {
                if (posController.currentCustomer && posController.currentCustomer.name) {
                    finalName = posController.currentCustomer.name;
                } else {
                    const timeStr = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
                    finalName = `Cliente ${timeStr}`;
                }
            }

            posController.holdSale(finalName);
            closeModal();
            this.startNewSale();
            showNotification(`Venta "${finalName}" puesta en espera`, 'info');
        } catch (e) {
            showNotification(e.message || 'Error al pausar venta', 'error');
        }
    },

    showHeldSales() {
        this.openHeldSalesMenu();
    },

    deleteHeldSale(id) {
        this.discardHeldSale(id);
    },

    resumeHeldSale(id) {
        try {
            const hadCart = posController.cart.length > 0;
            posController.resumeSale(id);
            this.updateCart();
            closeModal();
            if (posController.currentCustomer) {
                this.setCustomer(posController.currentCustomer.id);
            } else {
                this.removeCustomer();
            }
            showNotification(hadCart ? 'Ventas alternadas correctamente' : 'Venta reanudada en caja', 'success');
        } catch (e) {
            showNotification(e.message || 'Error al reanudar venta', 'error');
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
            const sugEl = document.getElementById('productSuggestions');
            if (cart.length === 0 || !sugEl) {
                if (sugEl) sugEl.style.display = 'none';
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
        const businessName = localStorage.getItem('ticketBusinessName') || localStorage.getItem('CURRENT_BUSINESS') || 'Caja Fácil POS';
        const address = localStorage.getItem('ticketAddress') || '';
        const phone = localStorage.getItem('ticketPhone') || '';
        const footerMsg = localStorage.getItem('ticketFooter') || '¡Gracias por su compra!';
        
        let text = `================================\n`;
        text += `${businessName.toUpperCase()}\n`;
        if (address) text += `${address}\n`;
        if (phone) text += `${phone}\n`;
        text += `================================\n`;
        text += `Folio: #${sale.terminal_id ? sale.terminal_id + '-' : 'PC-1-'}${sale.saleNumber}\n`;
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
                            <strong style="font-size: 0.85rem; color: var(--text-color);">Venta #${sale.terminal_id ? sale.terminal_id + '-' : 'PC-1-'}${sale.saleNumber}</strong>
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
