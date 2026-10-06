/**
 * Centralized Keyboard Navigation Utility
 * Handles all keyboard navigation logic without business logic
 */
const KeyboardManager = {
    // Registered navigation handlers
    _navigationHandlers: new Map(),
    
    /**
     * Initialize global keyboard shortcuts
     */
    init() {
        document.addEventListener('keydown', (e) => {
            // Handle Alt shortcuts for navigation
            if (e.altKey && !e.ctrlKey && !e.shiftKey) {
                e.preventDefault();
                this.handleAltShortcut(e.key);
                return;
            }
            
            // Handle Ctrl shortcuts
            if (e.ctrlKey && !e.altKey) {
                this.handleCtrlShortcut(e);
                return;
            }
            
            // Handle Escape to close modals
            if (e.key === 'Escape') {
                closeModal();
                return;
            }

            // Handle Enter for modal primary buttons (only if no specific handler)
            if (e.key === 'Enter' && !e.defaultPrevented) {
                this.handleGlobalEnter(e);
                return;
            }
            // Handle F2 shortcut: guardar venta en edición o guardar producto en modal activo
            if (e.key === 'F2') {
                const modal = document.querySelector('.modal');
                if (modal) {
                    // Prioridad 1: guardar edición de venta
                    const saveEditSaleBtn = modal.querySelector('.btn-primary[onclick*="saveEditSale"]');
                    if (saveEditSaleBtn) { e.preventDefault(); saveEditSaleBtn.click(); return; }
                    // Prioridad 2: guardar producto (nuevo o edición)
                    const saveProductBtn = modal.querySelector('.btn-primary[onclick*="saveProduct"]');
                    if (saveProductBtn) { e.preventDefault(); saveProductBtn.click(); return; }
                }
                // Si está en otra vista, F2 no debe forzar navegación al POS.
                // Si está en el POS, posGlobalKeydown se encarga de procesar el pago.
                return;
            }
            // Handle F4 shortcut: pasar la diferencia a deuda del cliente en la pantalla de cobro
            if (e.key === 'F4') {
                e.preventDefault();
                const fillDebtBtn = document.getElementById('btn_fill_debt');
                if (fillDebtBtn) { fillDebtBtn.click(); return; }
                return;
            }
        });
    },
    
    /**
     * Handle global Enter key for modal primary buttons
     * Only triggers if no specific navigation handler is active
     */
    handleGlobalEnter(e) {
        // Don't interfere if a navigation handler is active
        if (this._navigationHandlers.size > 0) {
            return;
        }
        
        const modal = document.querySelector('.modal');
        if (!modal) return;
        
        const activeTag = document.activeElement ? document.activeElement.tagName.toUpperCase() : '';
        // ponytail: No interferir si el usuario está escribiendo o interactuando con un campo de formulario
        if (['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(activeTag)) {
            return;
        }
        
        // Find primary button in modal footer
        const footerBtn = modal.querySelector('.modal-footer .btn-primary, .modal-footer .btn-success, .modal-footer .btn-danger');
        if (footerBtn && !footerBtn.disabled) {
            e.preventDefault();
            footerBtn.click();
        }
    },
    
    /**
     * Handle Alt shortcuts
     */
    handleAltShortcut(key) {
        const shortcuts = {
            '1': 'pos',
            '2': 'products',
            '3': 'customers',
            '4': 'suppliers',
            '5': 'purchases',
            '6': 'cash',
            '7': 'inventory',
            '8': 'reports',
            '9': 'settings'
        };
        
        if (shortcuts[key]) {
            app.navigate(shortcuts[key]);
        }
    },
    
    /**
     * Handle Ctrl shortcuts
     */
    handleCtrlShortcut(e) {
        if (e.key === 'b' || e.key === 'B') {
            e.preventDefault();
            if (app.currentView === 'settings') {
                BackupManager.exportAllData();
            }
        }
        
        if (e.key === 'k' || e.key === 'K') {
            e.preventDefault();
            const searchInput = document.getElementById('productSearch') || 
                              document.getElementById('searchProducts');
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        }
    },
    
    /**
     * Register a product list navigation handler
     * @param {string} handlerId - Unique identifier for this handler
     * @param {Object} config - Configuration object
     * @param {HTMLElement} config.searchInput - Input element to attach listener
     * @param {string} config.resultsContainerId - ID of results container
     * @param {Function} config.onSelect - Callback when product is selected (receives productId)
     * @param {Function} config.onEnterWithoutSelection - Callback when Enter is pressed without selection (receives searchTerm)
     * @param {string} config.itemSelector - CSS selector for result items (default: '.search-result-item')
     */
    registerProductListNavigation(handlerId, config) {
        const {
            searchInput,
            resultsContainerId,
            onSelect,
            onEnterWithoutSelection,
            itemSelector = '.search-result-item'
        } = config;
        
        if (!searchInput || !resultsContainerId) {
            console.error('KeyboardManager: searchInput and resultsContainerId are required');
            return;
        }
        
        // Store handler config
        this._navigationHandlers.set(handlerId, {
            searchInput,
            resultsContainerId,
            onSelect,
            onEnterWithoutSelection,
            itemSelector
        });
        
        // Attach keydown listener to search input
        searchInput.addEventListener('keydown', (e) => {
            this.handleProductListNavigation(handlerId, e);
        });
    },
    
    /**
     * Unregister a product list navigation handler
     * @param {string} handlerId - Handler identifier
     */
    unregisterProductListNavigation(handlerId) {
        this._navigationHandlers.delete(handlerId);
    },
    
    /**
     * Handle product list navigation (Arrow keys and Enter)
     * @param {string} handlerId - Handler identifier
     * @param {KeyboardEvent} e - Keyboard event
     */
    handleProductListNavigation(handlerId, e) {
        const handler = this._navigationHandlers.get(handlerId);
        if (!handler) return;
        
        const { searchInput, resultsContainerId, onSelect, onEnterWithoutSelection, itemSelector } = handler;
        const resultsDiv = document.getElementById(resultsContainerId);
        
        if (!resultsDiv) return;
        
        // Get all result items within the results container
        const items = resultsDiv.querySelectorAll(itemSelector);
        let selectedIndex = -1;
        
        // Find currently selected item
        items.forEach((item, index) => {
            if (item.classList.contains('selected')) {
                selectedIndex = index;
            }
        });
        
        // Handle Arrow Down
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (items.length > 0) {
                const nextIndex = (selectedIndex + 1) % items.length;
                this.highlightResult(resultsContainerId, itemSelector, nextIndex);
            }
            return;
        }
        
        // Handle Arrow Up
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (items.length > 0) {
                const prevIndex = (selectedIndex - 1 + items.length) % items.length;
                this.highlightResult(resultsContainerId, itemSelector, prevIndex);
            }
            return;
        }
        
        // Handle Enter
        if (e.key === 'Enter') {
            e.preventDefault();
            
            // Check if dropdown has visible items (more reliable check)
            // Check computed style to handle both inline and CSS class-based visibility
            const computedStyle = window.getComputedStyle(resultsDiv);
            const isDropdownVisible = computedStyle.display !== 'none' && 
                                      computedStyle.visibility !== 'hidden' &&
                                      resultsDiv.offsetParent !== null &&
                                      items.length > 0;
            
            // If dropdown is visible and has items, try to select the highlighted item
            if (isDropdownVisible) {
                let productId = null;
                let selectedItem = null;
                
                // First, try to find the item with 'selected' class (most reliable)
                for (let i = 0; i < items.length; i++) {
                    if (items[i].classList.contains('selected')) {
                        selectedItem = items[i];
                        break;
                    }
                }
                
                // If found selected item, use it
                if (selectedItem) {
                    // Try multiple ways to get productId to ensure we get it
                    productId = selectedItem.dataset.productId || 
                               selectedItem.getAttribute('data-product-id') ||
                               selectedItem.getAttribute('data-productId');
                    // Convert to number if it's a numeric string (IDs are typically numbers)
                    if (productId && !isNaN(productId) && productId !== '') {
                        productId = parseInt(productId, 10);
                    }
                } else if (selectedIndex !== -1 && selectedIndex < items.length) {
                    // Fallback: use selectedIndex if valid
                    selectedItem = items[selectedIndex];
                    productId = selectedItem.dataset.productId || 
                               selectedItem.getAttribute('data-product-id') ||
                               selectedItem.getAttribute('data-productId');
                    if (productId && !isNaN(productId) && productId !== '') {
                        productId = parseInt(productId, 10);
                    }
                } else if (items.length > 0) {
                    // Last resort: use first item if nothing is explicitly selected
                    // This ensures that if dropdown is visible, Enter always selects something
                    selectedItem = items[0];
                    productId = selectedItem.dataset.productId || 
                               selectedItem.getAttribute('data-product-id') ||
                               selectedItem.getAttribute('data-productId');
                    if (productId && !isNaN(productId) && productId !== '') {
                        productId = parseInt(productId, 10);
                    }
                }
                
                // Call onSelect callback if productId found
                if (productId && onSelect) {
                    onSelect(productId);
                    return;
                }
            }
            
            // No dropdown visible, no results, or no selection - call onEnterWithoutSelection
            const searchTerm = searchInput.value.trim();
            if (searchTerm && onEnterWithoutSelection) {
                onEnterWithoutSelection(searchTerm);
            }
        }
    },
    
    /**
     * Highlight a result item by index
     * @param {string} resultsContainerId - ID of results container
     * @param {string} itemSelector - CSS selector for result items
     * @param {number} index - Index to highlight
     */
    highlightResult(resultsContainerId, itemSelector, index) {
        const resultsDiv = document.getElementById(resultsContainerId);
        if (!resultsDiv) return;
        
        const items = resultsDiv.querySelectorAll(itemSelector);
        if (items.length === 0) return;
        
        // Validate index
        if (index < 0 || index >= items.length) {
            index = 0; // Default to first item if index is invalid
        }
        
        // Remove selection from all items and reset styles
        items.forEach((item) => {
            item.classList.remove('selected');
            // Reset background to white (default)
            item.style.background = 'white';
            item.style.fontWeight = 'normal';
        });
        
        // Find target item by index (try data-index attribute first, then by position)
        let target = resultsDiv.querySelector(`${itemSelector}[data-index="${index}"]`);
        
        // Fallback: if not found by data-index, try by position in NodeList
        if (!target && index >= 0 && index < items.length) {
            target = items[index];
        }
        
        // Highlight target item
        if (target) {
            target.classList.add('selected');
            // Use a visible highlight color - gray background with darker text
            target.style.background = '#e5e7eb'; // Light gray background
            target.style.fontWeight = '600'; // Semi-bold for better visibility
            // Scroll into view if needed
            target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    },
    
    /**
     * Set selected index programmatically
     * @param {string} resultsContainerId - ID of results container
     * @param {string} itemSelector - CSS selector for result items
     * @param {number} index - Index to select
     */
    setSelectedIndex(resultsContainerId, itemSelector, index) {
        this.highlightResult(resultsContainerId, itemSelector, index);
    },
    
    /**
     * Clear all navigation handlers (useful for cleanup)
     */
    clearAllHandlers() {
        this._navigationHandlers.clear();
    }
};

/**
 * Shortcut Helper - Display keyboard shortcuts help
 */
const ShortcutHelper = {
    show() {
        const content = `
            <div style="display: grid; gap: 1rem;">
                <h4>Atajos de Navegación</h4>
                <table>
                    <tr>
                        <td style="padding: 0.5rem;"><kbd>Alt + 1</kbd></td>
                        <td>Punto de Venta</td>
                    </tr>
                    <tr>
                        <td style="padding: 0.5rem;"><kbd>Alt + 2</kbd></td>
                        <td>Productos</td>
                    </tr>
                    <tr>
                        <td style="padding: 0.5rem;"><kbd>Alt + 3</kbd></td>
                        <td>Clientes</td>
                    </tr>
                    <tr>
                        <td style="padding: 0.5rem;"><kbd>Alt + 4</kbd></td>
                        <td>Proveedores</td>
                    </tr>
                    <tr>
                        <td style="padding: 0.5rem;"><kbd>Alt + 5</kbd></td>
                        <td>Compras</td>
                    </tr>
                    <tr>
                        <td style="padding: 0.5rem;"><kbd>Alt + 6</kbd></td>
                        <td>Caja</td>
                    </tr>
                    <tr>
                        <td style="padding: 0.5rem;"><kbd>Alt + 7</kbd></td>
                        <td>Inventario</td>
                    </tr>
                    <tr>
                        <td style="padding: 0.5rem;"><kbd>Alt + 8</kbd></td>
                        <td>Reportes</td>
                    </tr>
                    <tr>
                        <td style="padding: 0.5rem;"><kbd>Alt + 9</kbd></td>
                        <td>Configuración</td>
                    </tr>
                </table>
                
                <h4 style="margin-top: 1rem;">Atajos de Acción</h4>
                <table>
                    <tr>
                        <td style="padding: 0.5rem;"><kbd>Ctrl + K</kbd></td>
                        <td>Buscar producto</td>
                    </tr>
                    <tr>
                        <td style="padding: 0.5rem;"><kbd>Ctrl + B</kbd></td>
                        <td>Crear backup (en Configuración)</td>
                    </tr>
                    <tr>
                        <td style="padding: 0.5rem;"><kbd>Esc</kbd></td>
                        <td>Cerrar modal</td>
                    </tr>
                    <tr>
                        <td style="padding: 0.5rem;"><kbd>F2</kbd></td>
                        <td>Ir a Punto de Venta</td>
                    </tr>
                </table>
                
                <h4 style="margin-top: 1rem;">Navegación en Listas</h4>
                <table>
                    <tr>
                        <td style="padding: 0.5rem;"><kbd>↑</kbd> / <kbd>↓</kbd></td>
                        <td>Navegar lista de productos</td>
                    </tr>
                    <tr>
                        <td style="padding: 0.5rem;"><kbd>Enter</kbd></td>
                        <td>Seleccionar producto (no cierra la venta)</td>
                    </tr>
                </table>
            </div>
            
            <style>
                kbd {
                    background: var(--dark);
                    color: white;
                    padding: 0.25rem 0.5rem;
                    border-radius: 0.25rem;
                    font-size: 0.875rem;
                    font-family: monospace;
                }
            </style>
        `;
        
        showModal(content, { title: 'Atajos de Teclado', width: '500px' });
    }
};
