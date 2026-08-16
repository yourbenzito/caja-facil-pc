/**
 * POS Lakurva Móvil - Lógica Principal (100% Offline & PWA)
 * Soporta las 6 funciones primordiales: POS, Productos, Caja, Reportes, Compras, Proveedores y Clientes.
 */

const MobileApp = {
    serverUrl: '',
    token: '',
    products: [],
    categories: [],
    customers: [],
    suppliers: [],
    purchases: [],
    sales: [],
    cart: [],
    discountType: 'none', // 'none' | 'amount' | 'percent'
    discountValue: 0,
    selectedMethod: 'cash',
    selectedCustomerId: null,
    selectedCategory: 'all',
    activeCashRegister: { open: true, openingBalance: 50000, cashSales: 0, cardSales: 0, transferSales: 0, creditSales: 0, expectedBalance: 50000 },
    html5QrcodeScanner: null,

    init() {
        console.log('📱 Inicializando POS Lakurva Móvil PWA (Modo 100% Offline)...');
        
        // 1. Cargar dirección del servidor y token si existen
        this.serverUrl = localStorage.getItem('API_BASE_URL') || 
                        (window.location.protocol.startsWith('http') ? window.location.origin : '');
        this.token = localStorage.getItem('AUTH_TOKEN') || '';

        const loginServerInput = document.getElementById('login-server');
        if (loginServerInput) loginServerInput.value = this.serverUrl;
        
        const savedBiz = localStorage.getItem('LAST_LOGIN_BUSINESS') || 'Mi Negocio';
        const loginBizInput = document.getElementById('login-business');
        if (loginBizInput) loginBizInput.value = savedBiz;

        // 2. Cargar datos guardados localmente (Offline IndexedDB / LocalStorage)
        this.loadOfflineData();

        // 3. Restaurar carrito guardado
        try {
            const savedCart = localStorage.getItem('MOBILE_CART');
            if (savedCart) this.cart = JSON.parse(savedCart);
        } catch (e) {
            this.cart = [];
        }

        // 4. Iniciar sesión automática o mostrar login
        if (localStorage.getItem('MOBILE_SESSION_ACTIVE') === 'true') {
            this.showAppScreen();
        } else {
            this.showLoginScreen();
        }

        // 5. Asignar eventos de escucha
        const loginForm = document.getElementById('login-form');
        if (loginForm) loginForm.addEventListener('submit', (e) => this.handleLogin(e));

        const searchInput = document.getElementById('mobile-search');
        if (searchInput) searchInput.addEventListener('input', () => this.filterProducts());

        // Actualizar indicador visual de conexión
        window.addEventListener('online', () => this.updateOnlineStatus());
        window.addEventListener('offline', () => this.updateOnlineStatus());
        this.updateOnlineStatus();
    },

    updateOnlineStatus() {
        const badge = document.getElementById('offline-badge');
        if (!badge) return;
        if (navigator.onLine) {
            badge.textContent = 'ONLINE';
            badge.style.background = 'var(--success-soft)';
            badge.style.color = 'var(--success)';
        } else {
            badge.textContent = 'OFFLINE';
            badge.style.background = 'var(--warning)';
            badge.style.color = '#78350f';
        }
    },

    loadOfflineData() {
        // Cargar o inicializar datos por defecto
        this.products = JSON.parse(localStorage.getItem('OFFLINE_PRODUCTS')) || [
            { id: 1, name: 'Bebida Coca-Cola 1.5L', price: 1800, cost: 1200, stock: 24, categoryId: 1, barcode: '780123456789' },
            { id: 2, name: 'Pan de Molde 500g', price: 2200, cost: 1500, stock: 10, categoryId: 1, barcode: '780987654321' },
            { id: 3, name: 'Queso Mantecoso (Kg)', price: 8500, cost: 6000, stock: 5.5, categoryId: 2, barcode: '780111222333' },
            { id: 4, name: 'Aceite Maravilla 1L', price: 2800, cost: 2100, stock: 3, categoryId: 1, barcode: '780444555666' }
        ];

        this.categories = JSON.parse(localStorage.getItem('OFFLINE_CATEGORIES')) || [
            { id: 1, name: 'Abarrotes' },
            { id: 2, name: 'Lácteos' },
            { id: 3, name: 'Bebidas' }
        ];

        this.customers = JSON.parse(localStorage.getItem('OFFLINE_CUSTOMERS')) || [
            { id: 1, name: 'Juan Pérez (Vecino)', rut: '15.432.111-9', phone: '+56987654321', totalDebt: 4500, creditLimit: 50000 },
            { id: 2, name: 'María González', rut: '18.999.888-2', phone: '+56911223344', totalDebt: 0, creditLimit: 30000 }
        ];

        this.suppliers = JSON.parse(localStorage.getItem('OFFLINE_SUPPLIERS')) || [
            { id: 1, name: 'Distribuidora El Sol', phone: '+56955443322', contact: 'Carlos Ventas' },
            { id: 2, name: 'Embonor Coca-Cola', phone: '+56999887766', contact: 'Ruta 12' }
        ];

        this.sales = JSON.parse(localStorage.getItem('OFFLINE_SALES')) || [];
        this.purchases = JSON.parse(localStorage.getItem('OFFLINE_PURCHASES')) || [];
        this.activeCashRegister = JSON.parse(localStorage.getItem('OFFLINE_CASH')) || this.activeCashRegister;
    },

    saveOfflineData() {
        localStorage.setItem('OFFLINE_PRODUCTS', JSON.stringify(this.products));
        localStorage.setItem('OFFLINE_CATEGORIES', JSON.stringify(this.categories));
        localStorage.setItem('OFFLINE_CUSTOMERS', JSON.stringify(this.customers));
        localStorage.setItem('OFFLINE_SUPPLIERS', JSON.stringify(this.suppliers));
        localStorage.setItem('OFFLINE_SALES', JSON.stringify(this.sales));
        localStorage.setItem('OFFLINE_PURCHASES', JSON.stringify(this.purchases));
        localStorage.setItem('OFFLINE_CASH', JSON.stringify(this.activeCashRegister));
    },

    showLoginScreen() {
        document.getElementById('app-screen').classList.remove('active');
        document.getElementById('login-screen').classList.add('active');
    },

    showAppScreen() {
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('app-screen').classList.add('active');

        const activeServerLabel = document.getElementById('active-server-url');
        if (activeServerLabel) {
            activeServerLabel.textContent = this.serverUrl ? this.serverUrl : 'Modo Local (Offline IndexedDB)';
        }

        const biz = localStorage.getItem('CURRENT_BUSINESS_NAME') || 'Mi Negocio';
        const user = localStorage.getItem('USER_NAME') || 'Cajero Móvil';
        
        document.getElementById('app-biz-name').textContent = biz;
        document.getElementById('app-user-name').textContent = user;

        localStorage.setItem('MOBILE_SESSION_ACTIVE', 'true');

        this.renderCategories();
        this.renderProducts(this.products);
        this.updateCartUI();
    },

    handleLogin(e) {
        e.preventDefault();
        const business = document.getElementById('login-business').value || 'Mi Negocio';
        const username = document.getElementById('login-username').value || 'Cajero';

        localStorage.setItem('CURRENT_BUSINESS_NAME', business);
        localStorage.setItem('USER_NAME', username);

        this.showAppScreen();
    },

    // --- MÓDULO 1: PUNTO DE VENTA (POS) Y CARRITO ---
    renderCategories() {
        const container = document.getElementById('mobile-categories');
        if (!container) return;
        let html = `<div class="cat-pill ${this.selectedCategory === 'all' ? 'active' : ''}" onclick="MobileApp.filterByCategory('all')">Todos</div>`;
        this.categories.forEach(c => {
            html += `<div class="cat-pill ${this.selectedCategory === c.id ? 'active' : ''}" onclick="MobileApp.filterByCategory(${c.id})">${c.name}</div>`;
        });
        container.innerHTML = html;
    },

    filterByCategory(catId) {
        this.selectedCategory = catId;
        this.renderCategories();
        this.filterProducts();
    },

    filterProducts() {
        const q = (document.getElementById('mobile-search').value || '').toLowerCase().trim();
        let filtered = this.products;

        if (this.selectedCategory !== 'all') {
            filtered = filtered.filter(p => p.categoryId === this.selectedCategory);
        }

        if (q) {
            filtered = filtered.filter(p => 
                (p.name && p.name.toLowerCase().includes(q)) || 
                (p.barcode && p.barcode.includes(q))
            );
        }
        this.renderProducts(filtered);
    },

    renderProducts(list) {
        const container = document.getElementById('mobile-products-list');
        if (!container) return;
        if (list.length === 0) {
            container.innerHTML = `<div style="grid-column: span 2; text-align: center; color: var(--text-muted); padding: 2rem;">No se encontraron productos</div>`;
            return;
        }

        let html = '';
        list.forEach(p => {
            const lowStockBadge = p.stock <= 5 ? `<span style="color: var(--danger); font-weight: 800; font-size: 0.65rem; background: rgba(239,68,68,0.1); padding: 0.1rem 0.4rem; border-radius: 4px; display: inline-block; margin-top: 0.2rem;">Stock: ${p.stock}</span>` : '';
            html += `
                <div class="prod-card">
                    <div class="prod-name">${p.name}</div>
                    ${lowStockBadge}
                    <div class="prod-footer">
                        <div class="prod-price">${this.formatCLP(p.price)}</div>
                        <button class="btn-add-prod" onclick="MobileApp.addToCart(${p.id})">+</button>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    },

    addToCart(prodId) {
        const product = this.products.find(p => p.id === prodId);
        if (!product) return;

        const cartItem = this.cart.find(item => item.productId === prodId);
        if (cartItem) {
            cartItem.qty += 1;
        } else {
            this.cart.push({
                productId: product.id,
                name: product.name,
                price: product.price,
                qty: 1
            });
        }
        this.updateCartUI();
        this.showNotification(`Añadido: ${product.name}`);
    },

    updateCartUI() {
        localStorage.setItem('MOBILE_CART', JSON.stringify(this.cart));
        const totalItems = this.cart.reduce((sum, item) => sum + item.qty, 0);
        
        const cartBadge = document.getElementById('mobile-cart-badge');
        if (cartBadge) cartBadge.textContent = totalItems;

        const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const finalTotal = this.calculateFinalTotal(subtotal);

        const checkoutBar = document.getElementById('checkout-bar');
        if (totalItems > 0 && document.getElementById('view-sell').classList.contains('active')) {
            checkoutBar.style.display = 'flex';
            document.getElementById('checkout-total-val').textContent = this.formatCLP(finalTotal);
        } else {
            if (checkoutBar) checkoutBar.style.display = 'none';
        }

        this.renderCartItems();
    },

    recalculateCartTotals() {
        const typeSelect = document.getElementById('discount-type');
        const valInput = document.getElementById('discount-value');

        if (typeSelect) this.discountType = typeSelect.value;
        if (valInput) this.discountValue = parseFloat(valInput.value) || 0;

        this.updateCartUI();
    },

    calculateFinalTotal(subtotal) {
        let discount = 0;
        if (this.discountType === 'amount') {
            discount = this.discountValue;
        } else if (this.discountType === 'percent') {
            discount = subtotal * (this.discountValue / 100);
        }
        return Math.max(0, subtotal - discount);
    },

    renderCartItems() {
        const container = document.getElementById('mobile-cart-items');
        const emptyDiv = document.getElementById('mobile-cart-empty');
        if (!container || !emptyDiv) return;

        if (this.cart.length === 0) {
            container.innerHTML = '';
            emptyDiv.style.display = 'flex';
            return;
        }

        emptyDiv.style.display = 'none';
        let html = '';
        this.cart.forEach(item => {
            html += `
                <div class="cart-item">
                    <div class="item-info">
                        <div class="item-title">${item.name}</div>
                        <div class="item-price">${this.formatCLP(item.price)} x unidad</div>
                    </div>
                    <div class="item-controls">
                        <button class="btn-qty" onclick="MobileApp.updateQty(${item.productId}, -0.5)">-</button>
                        <input type="number" step="any" class="item-qty-input" value="${item.qty}" onchange="MobileApp.setQty(${item.productId}, this.value)">
                        <button class="btn-qty" onclick="MobileApp.updateQty(${item.productId}, 1)">+</button>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    },

    updateQty(prodId, delta) {
        const item = this.cart.find(i => i.productId === prodId);
        if (!item) return;
        item.qty = Math.max(0, item.qty + delta);
        if (item.qty === 0) {
            this.cart = this.cart.filter(i => i.productId !== prodId);
        }
        this.updateCartUI();
    },

    setQty(prodId, val) {
        const item = this.cart.find(i => i.productId === prodId);
        if (!item) return;
        const newQty = parseFloat(val) || 0;
        if (newQty <= 0) {
            this.cart = this.cart.filter(i => i.productId !== prodId);
        } else {
            item.qty = newQty;
        }
        this.updateCartUI();
    },

    clearCart() {
        if (confirm('¿Limpiar todo el carrito?')) {
            this.cart = [];
            this.discountType = 'none';
            this.discountValue = 0;
            this.updateCartUI();
        }
    },

    // --- ESCÁNER DE CÁMARA ---
    startCameraScanner() {
        document.getElementById('scanner-modal').classList.add('active');
        if (!this.html5QrcodeScanner) {
            this.html5QrcodeScanner = new Html5Qrcode("camera-reader");
        }
        this.html5QrcodeScanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 150 } },
            (decodedText) => {
                console.log(`Código detectado: ${decodedText}`);
                this.stopCameraScanner();
                document.getElementById('mobile-search').value = decodedText;
                this.filterProducts();
                
                // Si el producto coincide de inmediato, añadirlo
                const found = this.products.find(p => p.barcode === decodedText);
                if (found) {
                    this.addToCart(found.id);
                } else {
                    this.showNotification(`Buscando código: ${decodedText}`);
                }
            },
            () => {}
        ).catch(err => {
            console.warn('Error al abrir cámara:', err);
            alert('⚠️ No se pudo iniciar la cámara: ' + err.message);
            this.stopCameraScanner();
        });
    },

    stopCameraScanner() {
        if (this.html5QrcodeScanner) {
            this.html5QrcodeScanner.stop().then(() => {
                document.getElementById('scanner-modal').classList.remove('active');
            }).catch(() => {
                document.getElementById('scanner-modal').classList.remove('active');
            });
        } else {
            document.getElementById('scanner-modal').classList.remove('active');
        }
    },

    // --- CAMBIO DE VISTAS ---
    switchView(viewName) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));

        const targetView = document.getElementById(`view-${viewName}`);
        const targetNav = document.getElementById(`nav-${viewName}`);
        if (targetView) targetView.classList.add('active');
        if (targetNav) targetNav.classList.add('active');

        if (viewName === 'products') this.renderProductManagerList();
        else if (viewName === 'customers') this.loadCustomersData();
        else if (viewName === 'cash') this.loadCashRegisterData();
        else if (viewName === 'reports') this.loadReportsData();
        else if (viewName === 'purchases') this.loadPurchasesData();
        else if (viewName === 'suppliers') this.loadSuppliersData();

        const checkoutBar = document.getElementById('checkout-bar');
        if (checkoutBar) {
            checkoutBar.style.display = (this.cart.length > 0 && viewName === 'sell') ? 'flex' : 'none';
        }
    },

    // --- COBRO DE VENTA ---
    openPaymentModal() {
        if (!this.activeCashRegister.open) {
            alert('⚠️ La caja está cerrada. Debes realizar la apertura de caja primero.');
            return;
        }

        const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const finalTotal = this.calculateFinalTotal(subtotal);

        document.getElementById('modal-total-amount').textContent = this.formatCLP(finalTotal);
        document.getElementById('cash-received').value = '';
        document.getElementById('modal-change-amount').textContent = this.formatCLP(0);

        // Poblar selector de clientes para Crédito
        const select = document.getElementById('modal-credit-customer-select');
        if (select) {
            select.innerHTML = this.customers.map(c => `<option value="${c.id}">${c.name} (Deuda: ${this.formatCLP(c.totalDebt)})</option>`).join('');
        }

        this.selectPaymentMethod('cash');
        document.getElementById('payment-modal').classList.add('active');
    },

    closePaymentModal() {
        document.getElementById('payment-modal').classList.remove('active');
    },

    selectPaymentMethod(method) {
        this.selectedMethod = method;
        document.querySelectorAll('.btn-method').forEach(b => b.classList.remove('active'));
        const btn = document.getElementById(`method-${method}`);
        if (btn) btn.classList.add('active');

        const receivedGroup = document.getElementById('cash-received-group');
        const changeGroup = document.getElementById('change-display-group');
        const creditGroup = document.getElementById('credit-customer-group');

        if (method === 'cash') {
            receivedGroup.style.display = 'flex';
            changeGroup.style.display = 'flex';
            creditGroup.style.display = 'none';
        } else if (method === 'credit') {
            receivedGroup.style.display = 'none';
            changeGroup.style.display = 'none';
            creditGroup.style.display = 'flex';
        } else {
            receivedGroup.style.display = 'none';
            changeGroup.style.display = 'none';
            creditGroup.style.display = 'none';
        }
    },

    calculateChange() {
        const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const totalAmount = this.calculateFinalTotal(subtotal);
        const received = parseFloat(document.getElementById('cash-received').value) || 0;
        const change = Math.max(0, received - totalAmount);
        document.getElementById('modal-change-amount').textContent = this.formatCLP(change);
    },

    submitSale() {
        const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const totalAmount = this.calculateFinalTotal(subtotal);
        const received = parseFloat(document.getElementById('cash-received').value) || 0;

        if (this.selectedMethod === 'cash' && received < totalAmount) {
            alert('⚠️ El efectivo recibido es menor al total a pagar.');
            return;
        }

        let customerName = document.getElementById('selected-customer-name').textContent;
        let customerId = null;

        if (this.selectedMethod === 'credit') {
            const select = document.getElementById('modal-credit-customer-select');
            customerId = parseInt(select.value);
            const cust = this.customers.find(c => c.id === customerId);
            if (cust) {
                cust.totalDebt += totalAmount;
                customerName = cust.name;
            }
        }

        // Descontar stock
        this.cart.forEach(item => {
            const prod = this.products.find(p => p.id === item.productId);
            if (prod) prod.stock = Math.max(0, prod.stock - item.qty);
        });

        // Actualizar datos de caja
        if (this.selectedMethod === 'cash') this.activeCashRegister.cashSales += totalAmount;
        else if (this.selectedMethod === 'card') this.activeCashRegister.cardSales += totalAmount;
        else if (this.selectedMethod === 'transfer') this.activeCashRegister.transferSales += totalAmount;
        else if (this.selectedMethod === 'credit') this.activeCashRegister.creditSales += totalAmount;

        const saleRecord = {
            id: Date.now(),
            saleNumber: (this.sales.length + 1001),
            date: new Date().toISOString(),
            customerName: customerName,
            customerId: customerId,
            items: [...this.cart],
            subtotal: subtotal,
            discount: subtotal - totalAmount,
            total: totalAmount,
            paymentMethod: this.selectedMethod,
            status: this.selectedMethod === 'credit' ? 'pending' : 'completed'
        };

        this.sales.unshift(saleRecord);
        this.saveOfflineData();

        // Descargar ticket en PDF
        this.downloadTicketPDF(saleRecord);

        alert('✅ ¡Venta registrada y comprobante PDF descargado!');
        this.cart = [];
        this.discountType = 'none';
        this.discountValue = 0;
        this.updateCartUI();
        this.closePaymentModal();
        this.switchView('sell');
    },

    // --- GENERADOR DE TICKETS PDF (OFFLINE) ---
    downloadTicketPDF(sale) {
        if (!window.jspdf) {
            console.warn('jsPDF no disponible, omitiendo PDF.');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'mm', format: [80, 150] });

        const bizName = localStorage.getItem('CURRENT_BUSINESS_NAME') || 'Mi Negocio';
        doc.setFontSize(12);
        doc.text(bizName, 40, 10, { align: 'center' });
        doc.setFontSize(9);
        doc.text(`TICKET DE VENTA #${sale.saleNumber}`, 40, 16, { align: 'center' });
        doc.text(`Fecha: ${new Date(sale.date).toLocaleString()}`, 40, 21, { align: 'center' });
        doc.text(`Cliente: ${sale.customerName}`, 40, 26, { align: 'center' });
        doc.text('------------------------------------------------', 40, 31, { align: 'center' });

        let y = 37;
        sale.items.forEach(item => {
            doc.text(`${item.name}`, 5, y);
            y += 4;
            doc.text(`${item.qty} x ${this.formatCLP(item.price)} = ${this.formatCLP(item.qty * item.price)}`, 5, y);
            y += 6;
        });

        doc.text('------------------------------------------------', 40, y, { align: 'center' });
        y += 6;
        doc.setFontSize(10);
        doc.text(`TOTAL: ${this.formatCLP(sale.total)}`, 5, y);
        y += 5;
        doc.setFontSize(8);
        doc.text(`Pago: ${sale.paymentMethod.toUpperCase()}`, 5, y);
        y += 10;
        doc.text('¡Gracias por su compra!', 40, y, { align: 'center' });

        doc.save(`Ticket_Venta_${sale.saleNumber}.pdf`);
    },

    // --- MÓDULO 2: PRODUCTOS Y AJUSTE DE STOCK ---
    renderProductManagerList() {
        const container = document.getElementById('mobile-products-mgr-list');
        if (!container) return;

        let html = '';
        this.products.forEach(p => {
            html += `
                <div style="background: white; border: 1.5px solid var(--border); border-radius: var(--radius-md); padding: 0.875rem;">
                    <div style="display: flex; justify-content: space-between; font-weight: 800;">
                        <span>${p.name}</span>
                        <span style="color: var(--primary);">${this.formatCLP(p.price)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 0.5rem; font-size: 0.8rem; color: var(--text-muted);">
                        <span>Costo: ${this.formatCLP(p.cost)}</span>
                        <span>Stock: <strong style="color: ${p.stock <= 5 ? 'var(--danger)' : 'var(--success)'};">${p.stock}</strong></span>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    },

    filterProductManager() {
        const q = (document.getElementById('mobile-product-mgr-search').value || '').toLowerCase();
        const container = document.getElementById('mobile-products-mgr-list');
        if (!container) return;

        const filtered = this.products.filter(p => p.name.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(q)));
        let html = '';
        filtered.forEach(p => {
            html += `
                <div style="background: white; border: 1.5px solid var(--border); border-radius: var(--radius-md); padding: 0.875rem;">
                    <div style="display: flex; justify-content: space-between; font-weight: 800;">
                        <span>${p.name}</span>
                        <span style="color: var(--primary);">${this.formatCLP(p.price)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 0.5rem; font-size: 0.8rem; color: var(--text-muted);">
                        <span>Costo: ${this.formatCLP(p.cost)}</span>
                        <span>Stock: <strong style="color: ${p.stock <= 5 ? 'var(--danger)' : 'var(--success)'};">${p.stock}</strong></span>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    },

    openStockAdjustModal() {
        const select = document.getElementById('adjust-prod-select');
        if (select) {
            select.innerHTML = this.products.map(p => `<option value="${p.id}">${p.name} (Stock Actual: ${p.stock})</option>`).join('');
        }
        document.getElementById('stock-adjust-modal').classList.add('active');
    },

    closeStockAdjustModal() {
        document.getElementById('stock-adjust-modal').classList.remove('active');
    },

    submitStockAdjust(e) {
        e.preventDefault();
        const prodId = parseInt(document.getElementById('adjust-prod-select').value);
        const newStock = parseFloat(document.getElementById('adjust-new-stock').value) || 0;
        const reason = document.getElementById('adjust-reason').value;

        const prod = this.products.find(p => p.id === prodId);
        if (prod) {
            prod.stock = newStock;
            this.saveOfflineData();
            alert(`✅ Stock de "${prod.name}" actualizado a ${newStock} por motivo: ${reason}`);
            this.closeStockAdjustModal();
            this.renderProductManagerList();
            this.renderProducts(this.products);
        }
    },

    // --- MÓDULO 3: CAJA Y CUADRATURA RÁPIDA ---
    loadCashRegisterData() {
        const container = document.getElementById('mobile-cash-container');
        if (!container) return;

        const c = this.activeCashRegister;
        const expectedTotal = (c.openingBalance + c.cashSales);

        container.innerHTML = `
            <div style="background: white; border: 1.5px solid var(--border); border-radius: var(--radius-lg); padding: 1.25rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
                    <span style="font-weight: 800; font-size: 0.8rem; color: var(--text-muted);">ESTADO DE CAJA</span>
                    <span style="background: ${c.open ? 'var(--success-soft)' : '#f1f5f9'}; color: ${c.open ? 'var(--success)' : 'var(--text-muted)'}; padding: 0.2rem 0.6rem; border-radius: 12px; font-weight: 800; font-size: 0.75rem;">
                        ${c.open ? '● ABIERTA' : 'CERRADA'}
                    </span>
                </div>
                <div style="margin-bottom: 0.75rem;">
                    <span style="font-size: 0.8rem; color: var(--text-muted);">Monto de Apertura:</span>
                    <strong style="display: block; font-size: 1.1rem;">${this.formatCLP(c.openingBalance)}</strong>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; border-top: 1px solid var(--border); padding-top: 0.75rem; margin-bottom: 0.75rem;">
                    <div><span style="font-size: 0.75rem; color: var(--text-muted);">Ventas Efectivo:</span><strong style="display: block;">${this.formatCLP(c.cashSales)}</strong></div>
                    <div><span style="font-size: 0.75rem; color: var(--text-muted);">Ventas Tarjeta:</span><strong style="display: block;">${this.formatCLP(c.cardSales)}</strong></div>
                    <div><span style="font-size: 0.75rem; color: var(--text-muted);">Transferencias:</span><strong style="display: block;">${this.formatCLP(c.transferSales)}</strong></div>
                    <div><span style="font-size: 0.75rem; color: var(--text-muted);">Fiados:</span><strong style="display: block; color: var(--warning);">${this.formatCLP(c.creditSales)}</strong></div>
                </div>
                <div style="border-top: 1.5px solid var(--border); padding-top: 0.75rem;">
                    <span style="font-size: 0.8rem; color: var(--text-muted);">Efectivo Esperado en Caja:</span>
                    <strong style="display: block; font-size: 1.4rem; color: var(--primary);">${this.formatCLP(expectedTotal)}</strong>
                </div>
            </div>
        `;
    },

    openCashModal() {
        const modalBody = document.getElementById('cash-modal-body');
        if (!modalBody) return;

        const c = this.activeCashRegister;
        if (c.open) {
            const expectedTotal = (c.openingBalance + c.cashSales);
            modalBody.innerHTML = `
                <h3>Realizar Cierre de Caja</h3>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">Ingresa el efectivo contado en la caja física:</p>
                <div class="form-group">
                    <label>Efectivo Real Contado ($)</label>
                    <input type="number" id="cash-real-amount" class="input-lg" placeholder="$0" value="${expectedTotal}">
                </div>
                <button class="btn-primary btn-lg" onclick="MobileApp.submitCashClose()">Cerrar Caja y Calcular Cuadratura 🔒</button>
            `;
        } else {
            modalBody.innerHTML = `
                <h3>Abrir Turno de Caja</h3>
                <div class="form-group">
                    <label>Monto Inicial de Efectivo ($)</label>
                    <input type="number" id="cash-open-amount" class="input-lg" placeholder="$50000" value="50000">
                </div>
                <button class="btn-primary btn-lg" onclick="MobileApp.submitCashOpen()">Abrir Caja 🔓</button>
            `;
        }
        document.getElementById('cash-modal').classList.add('active');
    },

    closeCashModal() {
        document.getElementById('cash-modal').classList.remove('active');
    },

    submitCashOpen() {
        const val = parseFloat(document.getElementById('cash-open-amount').value) || 0;
        this.activeCashRegister = {
            open: true,
            openingBalance: val,
            cashSales: 0,
            cardSales: 0,
            transferSales: 0,
            creditSales: 0,
            expectedBalance: val
        };
        this.saveOfflineData();
        alert('✅ Caja abierta con éxito.');
        this.closeCashModal();
        this.loadCashRegisterData();
    },

    submitCashClose() {
        const realVal = parseFloat(document.getElementById('cash-real-amount').value) || 0;
        const expected = (this.activeCashRegister.openingBalance + this.activeCashRegister.cashSales);
        const diff = realVal - expected;

        let msg = `Caja Cerrada.\nEfectivo Esperado: ${this.formatCLP(expected)}\nEfectivo Contado: ${this.formatCLP(realVal)}\n`;
        if (diff === 0) msg += '✅ Cuadratura Perfecta (Sin diferencias).';
        else if (diff > 0) msg += `⚠️ Sobrante de Efectivo: +${this.formatCLP(diff)}`;
        else msg += `❌ Faltante de Efectivo: -${this.formatCLP(Math.abs(diff))}`;

        alert(msg);
        this.activeCashRegister.open = false;
        this.saveOfflineData();
        this.closeCashModal();
        this.loadCashRegisterData();
    },

    // --- MÓDULO 4: REPORTES Y EXPORTACIÓN ---
    loadReportsData() {
        const totalSalesCount = this.sales.length;
        const totalAmount = this.sales.reduce((sum, s) => sum + s.total, 0);
        const pendingAmount = this.customers.reduce((sum, c) => sum + c.totalDebt, 0);

        document.getElementById('kpi-sales-count').textContent = totalSalesCount;
        document.getElementById('kpi-sales-amount').textContent = this.formatCLP(totalAmount);
        document.getElementById('kpi-sales-pending').textContent = this.formatCLP(pendingAmount);

        const container = document.getElementById('mobile-recent-sales-list');
        if (!container) return;

        if (this.sales.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No hay ventas registradas</div>';
            return;
        }

        container.innerHTML = this.sales.map(s => `
            <div style="background: white; border: 1.5px solid var(--border); border-radius: var(--radius-md); padding: 0.875rem; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="font-size: 0.9rem; color: var(--text);">Venta #${s.saleNumber}</strong>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${new Date(s.date).toLocaleDateString()} - ${s.customerName}</div>
                </div>
                <div style="text-align: right;">
                    <strong style="font-size: 1rem; color: var(--text);">${this.formatCLP(s.total)}</strong>
                    <button class="btn-outline-sm" style="display: block; margin-top: 0.2rem;" onclick="MobileApp.downloadTicketPDF(${JSON.stringify(s).replace(/"/g, '&quot;')})">PDF 📄</button>
                </div>
            </div>
        `).join('');
    },

    exportReportsExcel() {
        let csv = 'Numero,Fecha,Cliente,Total,Metodo,Estado\n';
        this.sales.forEach(s => {
            csv += `${s.saleNumber},"${s.date}","${s.customerName}",${s.total},${s.paymentMethod},${s.status}\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Reporte_Ventas_${Date.now()}.csv`;
        link.click();
    },

    exportReportsPDF() {
        if (!window.jspdf) return;
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFontSize(16);
        doc.text('REPORTE GENERAL DE VENTAS', 15, 15);
        doc.setFontSize(10);
        doc.text(`Total Ventas: ${this.sales.length}`, 15, 25);
        doc.text(`Monto Acumulado: ${this.formatCLP(this.sales.reduce((s, x) => s + x.total, 0))}`, 15, 30);

        let y = 40;
        this.sales.forEach((s, idx) => {
            if (y > 270) { doc.addPage(); y = 20; }
            doc.text(`${idx + 1}. Venta #${s.saleNumber} - ${s.customerName} - Total: ${this.formatCLP(s.total)} (${s.paymentMethod})`, 15, y);
            y += 7;
        });

        doc.save(`Reporte_Ventas_${Date.now()}.pdf`);
    },

    // --- MÓDULO 5: COMPRAS (INGRESO DE MERCADERÍA) ---
    loadPurchasesData() {
        const container = document.getElementById('mobile-purchases-list');
        if (!container) return;

        if (this.purchases.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No hay compras registradas</div>';
            return;
        }

        container.innerHTML = this.purchases.map(p => `
            <div style="background: white; border: 1.5px solid var(--border); border-radius: var(--radius-md); padding: 0.875rem;">
                <div style="display: flex; justify-content: space-between; font-weight: 800;">
                    <span>${p.productName}</span>
                    <span style="color: var(--success);">${this.formatCLP(p.totalCost)}</span>
                </div>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.3rem;">
                    Proveedor: ${p.supplierName} | Cantidad Recibida: +${p.qty}
                </div>
            </div>
        `).join('');
    },

    openPurchaseModal() {
        const suppSelect = document.getElementById('purchase-supplier-select');
        const prodSelect = document.getElementById('purchase-product-select');

        if (suppSelect) suppSelect.innerHTML = this.suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        if (prodSelect) prodSelect.innerHTML = this.products.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

        document.getElementById('purchase-modal').classList.add('active');
    },

    closePurchaseModal() {
        document.getElementById('purchase-modal').classList.remove('active');
    },

    submitPurchase(e) {
        e.preventDefault();
        const suppId = parseInt(document.getElementById('purchase-supplier-select').value);
        const prodId = parseInt(document.getElementById('purchase-product-select').value);
        const qty = parseFloat(document.getElementById('purchase-qty').value) || 0;
        const totalCost = parseFloat(document.getElementById('purchase-cost').value) || 0;

        const supp = this.suppliers.find(s => s.id === suppId);
        const prod = this.products.find(p => p.id === prodId);

        if (prod) {
            prod.stock += qty;
            prod.cost = Math.round(totalCost / qty);

            const purchaseRec = {
                id: Date.now(),
                supplierName: supp ? supp.name : 'General',
                productName: prod.name,
                qty: qty,
                totalCost: totalCost,
                date: new Date().toISOString()
            };
            this.purchases.unshift(purchaseRec);
            this.saveOfflineData();

            alert(`✅ Mercadería ingresada: +${qty} unidades de "${prod.name}". Stock actualizado a ${prod.stock}.`);
            this.closePurchaseModal();
            this.loadPurchasesData();
        }
    },

    // --- MÓDULO 6: PROVEEDORES ---
    loadSuppliersData() {
        const container = document.getElementById('mobile-suppliers-list');
        if (!container) return;

        container.innerHTML = this.suppliers.map(s => `
            <div style="background: white; border: 1.5px solid var(--border); border-radius: var(--radius-md); padding: 0.875rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong style="font-size: 1rem;">${s.name}</strong>
                    <a href="https://wa.me/${s.phone.replace(/[^0-9]/g, '')}" target="_blank" style="background: #25D366; color: white; padding: 0.25rem 0.5rem; border-radius: 6px; text-decoration: none; font-size: 0.75rem; font-weight: 800;">WhatsApp 📲</a>
                </div>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.3rem;">Contacto: ${s.contact} | Tel: ${s.phone}</div>
            </div>
        `).join('');
    },

    openSupplierModal() {
        document.getElementById('supplier-modal').classList.add('active');
    },

    closeSupplierModal() {
        document.getElementById('supplier-modal').classList.remove('active');
    },

    saveSupplier(e) {
        e.preventDefault();
        const name = document.getElementById('supp-name').value;
        const phone = document.getElementById('supp-phone').value;
        const contact = document.getElementById('supp-contact').value || 'Contacto';

        this.suppliers.push({
            id: Date.now(),
            name, phone, contact
        });
        this.saveOfflineData();
        alert('✅ Proveedor guardado con éxito.');
        this.closeSupplierModal();
        this.loadSuppliersData();
    },

    // --- MÓDULO 7: CLIENTES HABITUALES Y ABONOS ---
    loadCustomersData() {
        this.renderCustomers(this.customers);
    },

    renderCustomers(list) {
        const container = document.getElementById('mobile-customers-list');
        if (!container) return;

        if (list.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No hay clientes registrados</div>';
            return;
        }

        container.innerHTML = list.map((c, idx) => `
            <div style="background: white; border: 1.5px solid var(--border); border-radius: var(--radius-md); padding: 0.875rem;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <strong style="font-size: 1rem; color: var(--text);">${c.name}</strong>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">${c.rut || ''}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
                    <div>
                        <span style="font-size: 0.75rem; color: var(--text-muted); display: block;">Deuda Fiado:</span>
                        <strong style="font-size: 1.1rem; color: ${c.totalDebt > 0 ? 'var(--danger)' : 'var(--success)'};">${this.formatCLP(c.totalDebt)}</strong>
                    </div>
                    ${c.totalDebt > 0 ? `
                        <button class="btn-primary-sm" onclick="MobileApp.openAbonoModal(${idx})">Registrar Abono 💵</button>
                    ` : '<span style="font-size: 0.75rem; color: var(--success); font-weight: 800;">AL DÍA ✅</span>'}
                </div>
            </div>
        `).join('');
    },

    filterMobileCustomers() {
        const q = (document.getElementById('mobile-customer-search').value || '').toLowerCase();
        const filtered = this.customers.filter(c => c.name.toLowerCase().includes(q) || (c.rut && c.rut.toLowerCase().includes(q)));
        this.renderCustomers(filtered);
    },

    openNewCustomerModal() {
        document.getElementById('customer-modal').classList.add('active');
    },

    closeCustomerModal() {
        document.getElementById('customer-modal').classList.remove('active');
    },

    saveCustomer(e) {
        e.preventDefault();
        const name = document.getElementById('cust-name').value;
        const phone = document.getElementById('cust-phone').value;
        const rut = document.getElementById('cust-rut').value;
        const limit = parseFloat(document.getElementById('cust-credit-limit').value) || 100000;

        this.customers.push({
            id: Date.now(),
            name, phone, rut,
            totalDebt: 0,
            creditLimit: limit
        });
        this.saveOfflineData();
        alert('✅ Cliente habitual registrado con éxito.');
        this.closeCustomerModal();
        this.loadCustomersData();
    },

    openSelectCustomerModal() {
        const name = prompt("Nombre del cliente para esta venta:", "");
        if (name && name.trim()) {
            document.getElementById('selected-customer-name').textContent = name.trim();
        } else {
            document.getElementById('selected-customer-name').textContent = "Cliente General";
        }
    },

    openAbonoModal(custIndex) {
        const cust = this.customers[custIndex];
        if (!cust) return;
        this.activeAbonoCustIndex = custIndex;

        document.getElementById('abono-cust-name').textContent = cust.name;
        document.getElementById('abono-cust-debt').textContent = this.formatCLP(cust.totalDebt);
        document.getElementById('abono-amount').value = cust.totalDebt;

        document.getElementById('abono-modal').classList.add('active');
    },

    closeAbonoModal() {
        document.getElementById('abono-modal').classList.remove('active');
    },

    submitAbono(e) {
        e.preventDefault();
        const cust = this.customers[this.activeAbonoCustIndex];
        const abonoVal = parseFloat(document.getElementById('abono-amount').value) || 0;

        if (!cust || abonoVal <= 0) return;

        cust.totalDebt = Math.max(0, cust.totalDebt - abonoVal);
        this.activeCashRegister.cashSales += abonoVal;
        this.saveOfflineData();

        // Generar comprobante PDF de abono
        this.downloadAbonoPDF(cust.name, abonoVal, cust.totalDebt);

        alert(`✅ Abono de ${this.formatCLP(abonoVal)} procesado. Deuda restante: ${this.formatCLP(cust.totalDebt)}`);
        this.closeAbonoModal();
        this.loadCustomersData();
    },

    downloadAbonoPDF(custName, amount, remainingDebt) {
        if (!window.jspdf) return;
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'mm', format: [80, 120] });

        const bizName = localStorage.getItem('CURRENT_BUSINESS_NAME') || 'Mi Negocio';
        doc.setFontSize(12);
        doc.text(bizName, 40, 10, { align: 'center' });
        doc.setFontSize(9);
        doc.text('COMPROBANTE DE ABONO A DEUDA', 40, 16, { align: 'center' });
        doc.text(`Fecha: ${new Date().toLocaleString()}`, 40, 21, { align: 'center' });
        doc.text(`Cliente: ${custName}`, 40, 26, { align: 'center' });
        doc.text('------------------------------------------------', 40, 31, { align: 'center' });
        doc.setFontSize(10);
        doc.text(`MONTO ABONADO: ${this.formatCLP(amount)}`, 5, 38);
        doc.text(`DEUDA RESTANTE: ${this.formatCLP(remainingDebt)}`, 5, 45);
        doc.text('------------------------------------------------', 40, 52, { align: 'center' });
        doc.setFontSize(8);
        doc.text('¡Gracias por su pago!', 40, 60, { align: 'center' });

        doc.save(`Abono_${custName.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
    },

    // --- UTILIDADES ---
    formatCLP(amount) {
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            minimumFractionDigits: 0
        }).format(amount);
    },

    showNotification(msg) {
        const toast = document.createElement('div');
        toast.style.position = 'fixed';
        toast.style.top = '10px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.background = 'rgba(30, 41, 59, 0.95)';
        toast.style.color = 'white';
        toast.style.padding = '0.5rem 1rem';
        toast.style.borderRadius = '20px';
        toast.style.fontSize = '0.8rem';
        toast.style.fontWeight = '700';
        toast.style.zIndex = '3000';
        toast.textContent = msg;
        
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 1500);
    },

    changeServer() {
        if (confirm('¿Deseas volver a la pantalla de inicio de sesión?')) {
            this.logout();
        }
    },

    logout() {
        localStorage.removeItem('MOBILE_SESSION_ACTIVE');
        this.showLoginScreen();
    }
};

window.onload = () => MobileApp.init();
