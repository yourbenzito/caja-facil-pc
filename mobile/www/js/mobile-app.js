const MobileApp = {
    serverUrl: '',
    token: '',
    products: [],
    categories: [],
    cart: [],
    selectedMethod: 'cash',
    selectedCustomerId: null,
    selectedCategory: 'all',
    customers: [],

    init() {
        console.log('📱 Inicializando POS Móvil...');
        
        // 1. Cargar dirección del servidor y token (autodetectando origen si es navegador)
        this.serverUrl = localStorage.getItem('API_BASE_URL') || 
                        (window.location.protocol.startsWith('http') ? window.location.origin : '');
        this.token = localStorage.getItem('AUTH_TOKEN') || '';
        
        document.getElementById('login-server').value = this.serverUrl;
        const savedBiz = localStorage.getItem('LAST_LOGIN_BUSINESS');
        if (savedBiz) document.getElementById('login-business').value = savedBiz;

        // 2. Intentar recuperar carrito guardado de localStorage
        try {
            const savedCart = localStorage.getItem('MOBILE_CART');
            if (savedCart) {
                this.cart = JSON.parse(savedCart);
            }
        } catch (e) {
            console.error('Error restaurando carrito:', e);
            this.cart = [];
        }

        // 3. Verificar estado de autenticación
        if (this.serverUrl && this.token) {
            this.showAppScreen();
        } else {
            this.showLoginScreen();
        }

        // 4. Registrar eventos
        document.getElementById('login-form').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('mobile-search').addEventListener('input', () => this.filterProducts());
    },

    showLoginScreen() {
        document.getElementById('app-screen').classList.remove('active');
        document.getElementById('login-screen').classList.add('active');
    },

    showAppScreen() {
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('app-screen').classList.add('active');
        
        // Mostrar servidor activo en ajustes
        document.getElementById('active-server-url').textContent = this.serverUrl;
        
        // Mostrar datos de sesión guardados
        document.getElementById('app-biz-name').textContent = localStorage.getItem('CURRENT_BUSINESS_NAME') || 'Mi Negocio';
        document.getElementById('app-user-name').textContent = localStorage.getItem('USER_NAME') || 'Sesión Móvil';

        // Aplicar permisos de rol en barra de navegación
        this.applyRolePermissions();

        // Cargar catálogo de datos
        this.loadCatalogData();

        // Renderizar el carrito guardado
        this.updateCartUI();
    },

    async handleLogin(e) {
        e.preventDefault();
        // Limpiar URL eliminando barra final y la ruta /mobile si fue ingresada
        const server = document.getElementById('login-server').value.trim()
            .replace(/\/$/, '')
            .replace(/\/mobile$/, '');
        const business = document.getElementById('login-business').value;
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        const errorDiv = document.getElementById('login-error');

        errorDiv.style.display = 'none';

        try {
            console.log(`Intentando conectar a servidor en: ${server}/api/auth/login`);
            const res = await fetch(`${server}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, businessName: business })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Credenciales incorrectas');
            }

            // Guardar credenciales, rol y servidor
            this.serverUrl = server;
            this.token = data.token;
            localStorage.setItem('API_BASE_URL', server);
            localStorage.setItem('AUTH_TOKEN', data.token);
            localStorage.setItem('BUSINESS_ID', data.user.business_id);
            localStorage.setItem('CURRENT_BUSINESS_NAME', business);
            localStorage.setItem('LAST_LOGIN_BUSINESS', business);
            localStorage.setItem('USER_ROLE', data.user.role || 'seller');
            localStorage.setItem('USER_NAME', data.user.name || 'Sesión Móvil');

            this.showAppScreen();
        } catch (err) {
            console.error(err);
            errorDiv.textContent = '❌ Error de inicio: ' + err.message;
            errorDiv.style.display = 'block';
        }
    },

    async loadCatalogData() {
        try {
            const headers = {
                'Authorization': `Bearer ${this.token}`,
                'x-business-id': localStorage.getItem('BUSINESS_ID')
            };

            // 1. Obtener categorías
            const catRes = await fetch(`${this.serverUrl}/api/categories`, { headers });
            if (catRes.ok) {
                this.categories = await catRes.json();
                this.renderCategories();
            }

            // 2. Obtener productos
            const prodRes = await fetch(`${this.serverUrl}/api/products`, { headers });
            if (prodRes.ok) {
                this.products = await prodRes.json();
                this.renderProducts(this.products);
            }
        } catch (err) {
            console.error('Error cargando catálogo:', err);
            alert('⚠️ Error al conectar con el servidor: ' + err.message);
        }
    },

    renderCategories() {
        const container = document.getElementById('mobile-categories');
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
        const q = document.getElementById('mobile-search').value.toLowerCase().trim();
        let filtered = this.products;

        // Filtrar por categoría
        if (this.selectedCategory !== 'all') {
            filtered = filtered.filter(p => p.categoryId === this.selectedCategory);
        }

        // Filtrar por texto
        if (q) {
            filtered = filtered.filter(p => 
                (p.name && p.name.toLowerCase().includes(q)) || 
                (p.barcode && p.barcode.includes(q)) ||
                (p.description && p.description.toLowerCase().includes(q))
            );
        }

        this.renderProducts(filtered);
    },

    renderProducts(list) {
        const container = document.getElementById('mobile-products-list');
        if (list.length === 0) {
            container.innerHTML = `<div style="grid-column: span 2; text-align: center; color: var(--text-muted); padding: 2rem;">No se encontraron productos</div>`;
            return;
        }

        let html = '';
        list.forEach(p => {
            html += `
                <div class="prod-card">
                    <div class="prod-name">${p.name}</div>
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
        
        // Efecto visual rápido
        this.showNotification(`Añadido: ${product.name}`);
    },

    updateCartUI() {
        // Guardar carrito en localStorage en tiempo real
        localStorage.setItem('MOBILE_CART', JSON.stringify(this.cart));

        // Actualizar contador de carrito
        const totalItems = this.cart.reduce((sum, item) => sum + item.qty, 0);
        document.getElementById('mobile-cart-badge').textContent = totalItems;

        // Calcular total a pagar
        const totalAmount = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        
        // Actualizar barra de cobro flotante
        const checkoutBar = document.getElementById('checkout-bar');
        if (totalItems > 0 && document.getElementById('view-sell').classList.contains('active')) {
            checkoutBar.style.display = 'flex';
            document.getElementById('checkout-total-val').textContent = this.formatCLP(totalAmount);
        } else {
            checkoutBar.style.display = 'none';
        }

        // Renderizar items del carrito en la Pestaña 2
        this.renderCartItems();
    },

    renderCartItems() {
        const container = document.getElementById('mobile-cart-items');
        const emptyDiv = document.getElementById('mobile-cart-empty');
        
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
                        <button class="btn-qty" onclick="MobileApp.updateQty(${item.productId}, -1)">-</button>
                        <input type="text" readonly class="item-qty-input" value="${item.qty}">
                        <button class="btn-qty" onclick="MobileApp.updateQty(${item.productId}, 1)">+</button>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    },

    updateQty(prodId, delta) {
        const itemIndex = this.cart.findIndex(item => item.productId === prodId);
        if (itemIndex === -1) return;

        this.cart[itemIndex].qty += delta;
        if (this.cart[itemIndex].qty <= 0) {
            this.cart.splice(itemIndex, 1);
        }
        
        this.updateCartUI();
    },

    clearCart() {
        if (confirm('¿Seguro que deseas limpiar el carrito?')) {
            this.cart = [];
            this.updateCartUI();
        }
    },

    switchView(viewName) {
        // Remover clase activa de todos los botones y vistas
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));

        // Activar vista y botón seleccionado
        document.getElementById(`view-${viewName}`).classList.add('active');
        document.getElementById(`nav-${viewName}`).classList.add('active');

        // Cargar datos correspondientes al cambiar de pestaña
        if (viewName === 'customers') {
            this.loadCustomersData();
        } else if (viewName === 'cash') {
            this.loadCashRegisterData();
        } else if (viewName === 'reports') {
            this.loadReportsData();
        }

        // Mostrar o ocultar la barra de cobro flotante según la vista
        const totalItems = this.cart.reduce((sum, item) => sum + item.qty, 0);
        const checkoutBar = document.getElementById('checkout-bar');
        
        if (totalItems > 0 && viewName === 'sell') {
            checkoutBar.style.display = 'flex';
        } else {
            checkoutBar.style.display = 'none';
        }
    },

    async loadCustomersData() {
        try {
            const headers = {
                'Authorization': `Bearer ${this.token}`,
                'x-business-id': localStorage.getItem('BUSINESS_ID')
            };
            const res = await fetch(`${this.serverUrl}/api/customers/pos/summary`, { headers });
            if (res.ok) {
                this.customers = await res.json();
                this.renderCustomers(this.customers);
            }
        } catch (e) {
            console.error(e);
        }
    },

    renderCustomers(list) {
        const container = document.getElementById('mobile-customers-list');
        if (!container) return;

        if (list.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 2rem;">No hay clientes registrados</div>';
            return;
        }

        container.innerHTML = list.map(c => `
            <div style="background: white; border: 1.5px solid var(--border); border-radius: var(--radius-md); padding: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.01);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                    <strong style="font-size: 1rem; color: var(--text);">${c.name}</strong>
                    <span style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">${c.rut || 'Sin RUT'}</span>
                </div>
                <div style="display: flex; gap: 1rem; font-size: 0.85rem;">
                    <div>
                        <span style="color: var(--text-muted);">A Favor:</span>
                        <strong style="color: var(--success);">${this.formatCLP(c.balanceCredit || 0)}</strong>
                    </div>
                    <div>
                        <span style="color: var(--text-muted);">Deuda Total:</span>
                        <strong style="color: ${c.totalDebt > 0 ? 'var(--danger)' : 'var(--text-muted)'};">${this.formatCLP(c.totalDebt || 0)}</strong>
                    </div>
                </div>
            </div>
        `).join('');
    },

    filterMobileCustomers() {
        const q = document.getElementById('mobile-customer-search').value.toLowerCase().trim();
        if (!q) {
            this.renderCustomers(this.customers);
            return;
        }
        const filtered = this.customers.filter(c => 
            (c.name && c.name.toLowerCase().includes(q)) || 
            (c.rut && c.rut.toLowerCase().includes(q))
        );
        this.renderCustomers(filtered);
    },

    async loadCashRegisterData() {
        try {
            const headers = {
                'Authorization': `Bearer ${this.token}`,
                'x-business-id': localStorage.getItem('BUSINESS_ID')
            };
            const res = await fetch(`${this.serverUrl}/api/cashRegisters?_limit=1&_order=DESC`, { headers });
            const container = document.getElementById('mobile-cash-container');
            if (!container) return;

            if (res.ok) {
                const registers = await res.json();
                if (registers.length === 0) {
                    container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 2rem;">No hay cajas registradas</div>';
                    return;
                }
                const reg = registers[0];
                const isOpen = reg.status === 'open';

                container.innerHTML = `
                    <div style="background: white; border: 1.5px solid var(--border); border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); margin-bottom: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Estado de Caja</span>
                            <span style="background: ${isOpen ? 'var(--success-soft)' : '#f1f5f9'}; color: ${isOpen ? 'var(--success)' : 'var(--text-muted)'}; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.75rem; font-weight: 800;">
                                ${isOpen ? '● ABIERTA' : 'CERRADA'}
                            </span>
                        </div>

                        <div style="margin-bottom: 1.25rem;">
                            <div style="font-size: 0.8rem; color: var(--text-muted);">Monto de Apertura:</div>
                            <strong style="font-size: 1.2rem; color: var(--text);">${this.formatCLP(reg.openingBalance || 0)}</strong>
                        </div>

                        ${isOpen ? `
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; border-top: 1.5px solid var(--border); padding-top: 1rem; margin-bottom: 1.25rem;">
                                <div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted);">Ventas Efectivo:</div>
                                    <strong style="color: var(--text); font-size: 0.95rem;">${this.formatCLP(reg.cashSales || 0)}</strong>
                                </div>
                                <div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted);">Ventas Tarjeta:</div>
                                    <strong style="color: var(--text); font-size: 0.95rem;">${this.formatCLP(reg.cardSales || 0)}</strong>
                                </div>
                                <div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted);">Ventas Transferencia:</div>
                                    <strong style="color: var(--text); font-size: 0.95rem;">${this.formatCLP(reg.transferSales || 0)}</strong>
                                </div>
                                <div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted);">Deudas Cobradas:</div>
                                    <strong style="color: var(--success); font-size: 0.95rem;">${this.formatCLP(reg.debtsPaid || 0)}</strong>
                                </div>
                            </div>

                            <div style="border-top: 1.5px solid var(--border); padding-top: 1rem;">
                                <div style="font-size: 0.8rem; color: var(--text-muted);">Efectivo Esperado en Caja:</div>
                                <strong style="font-size: 1.5rem; color: var(--primary); font-weight: 800;">${this.formatCLP(reg.expectedBalance || 0)}</strong>
                            </div>
                        ` : `
                            <div style="border-top: 1.5px solid var(--border); padding-top: 1rem;">
                                <div style="font-size: 0.8rem; color: var(--text-muted);">Cerrada el:</div>
                                <strong style="font-size: 0.95rem; color: var(--text);">${new Date(reg.closingDate).toLocaleString()}</strong>
                                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.75rem;">Monto Real de Cierre:</div>
                                <strong style="font-size: 1.3rem; color: var(--text);">${this.formatCLP(reg.actualBalance || 0)}</strong>
                            </div>
                        `}
                    </div>
                `;
            }
        } catch (e) {
            console.error(e);
        }
    },

    async loadReportsData() {
        try {
            const headers = {
                'Authorization': `Bearer ${this.token}`,
                'x-business-id': localStorage.getItem('BUSINESS_ID')
            };

            // 1. Obtener KPIs de ventas
            const summaryRes = await fetch(`${this.serverUrl}/api/sales/stats/summary`, { headers });
            if (summaryRes.ok) {
                const summary = await summaryRes.json();
                document.getElementById('kpi-sales-count').textContent = summary.totalSales || '0';
                document.getElementById('kpi-sales-amount').textContent = this.formatCLP(summary.totalAmount || 0);
                document.getElementById('kpi-sales-pending').textContent = this.formatCLP(summary.pendingAmount || 0);
            }

            // 2. Obtener lista de últimas 20 ventas
            const salesRes = await fetch(`${this.serverUrl}/api/sales/list/latest?limit=20`, { headers });
            const listContainer = document.getElementById('mobile-recent-sales-list');
            if (listContainer && salesRes.ok) {
                const sales = await salesRes.json();
                if (sales.length === 0) {
                    listContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No hay ventas registradas</div>';
                    return;
                }

                listContainer.innerHTML = sales.map(s => {
                    const dateStr = new Date(s.date).toLocaleDateString() + ' ' + new Date(s.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    let statusLabel = 'Completada';
                    let statusColor = 'var(--success)';
                    let statusBg = 'var(--success-soft)';
                    
                    if (s.status === 'pending') {
                        statusLabel = 'Pendiente';
                        statusColor = 'var(--danger)';
                        statusBg = 'rgba(239, 68, 68, 0.08)';
                    } else if (s.status === 'partial') {
                        statusLabel = 'Parcial';
                        statusColor = 'var(--warning)';
                        statusBg = 'rgba(245, 158, 11, 0.08)';
                    } else if (s.status === 'cancelled') {
                        statusLabel = 'Anulada';
                        statusColor = 'var(--text-muted)';
                        statusBg = '#f1f5f9';
                    }

                    return `
                        <div style="background: white; border: 1.5px solid var(--border); border-radius: var(--radius-md); padding: 1rem; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.01);">
                            <div>
                                <div style="font-weight: 700; color: var(--text); font-size: 0.95rem;">Venta #${s.saleNumber}</div>
                                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.15rem;">${dateStr}</div>
                                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">Método: <strong style="text-transform: capitalize;">${s.paymentMethod}</strong></div>
                            </div>
                            <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 0.35rem;">
                                <strong style="font-size: 1.1rem; color: var(--text);">${this.formatCLP(s.total)}</strong>
                                <span style="background: ${statusBg}; color: ${statusColor}; font-size: 0.7rem; font-weight: 800; padding: 0.15rem 0.5rem; border-radius: 10px;">
                                    ${statusLabel}
                                </span>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        } catch (e) {
            console.error(e);
        }
    },

    selectCustomer() {
        const name = prompt("Ingrese nombre del cliente (opcional):", "");
        const label = document.getElementById('selected-customer-name');
        if (name && name.trim()) {
            label.textContent = name.trim();
        } else {
            label.textContent = "Cliente General";
        }
    },

    async openPaymentModal() {
        // Verificar si la caja está activa y abierta antes de cobrar
        const cashStatus = await this.checkActiveCashRegister();
        if (!cashStatus.open) {
            alert('⚠️ La caja está CERRADA. Por favor, abre la caja en la computadora principal para registrar ventas.');
            return;
        }

        // Guardar el id de la caja activa
        this.activeCashRegisterId = cashStatus.id;

        const totalAmount = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        document.getElementById('modal-total-amount').textContent = this.formatCLP(totalAmount);
        
        // Reset inputs
        document.getElementById('cash-received').value = '';
        document.getElementById('modal-change-amount').textContent = this.formatCLP(0);
        
        this.selectPaymentMethod('cash');
        document.getElementById('payment-modal').classList.add('active');
    },

    closePaymentModal() {
        document.getElementById('payment-modal').classList.remove('active');
    },

    selectPaymentMethod(method) {
        this.selectedMethod = method;
        document.querySelectorAll('.btn-method').forEach(b => b.classList.remove('active'));
        document.getElementById(`method-${method}`).classList.add('active');

        const receivedGroup = document.getElementById('cash-received-group');
        const changeGroup = document.getElementById('change-display-group');

        if (method === 'cash') {
            receivedGroup.style.display = 'flex';
            changeGroup.style.display = 'flex';
        } else {
            receivedGroup.style.display = 'none';
            changeGroup.style.display = 'none';
        }
    },

    calculateChange() {
        const totalAmount = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const received = parseFloat(document.getElementById('cash-received').value) || 0;
        const change = Math.max(0, received - totalAmount);
        document.getElementById('modal-change-amount').textContent = this.formatCLP(change);
    },

    async submitSale() {
        const totalAmount = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const customerName = document.getElementById('selected-customer-name').textContent;
        const received = parseFloat(document.getElementById('cash-received').value) || 0;

        if (this.selectedMethod === 'cash' && received < totalAmount) {
            alert('⚠️ El efectivo recibido es menor al total a pagar.');
            return;
        }

        const validItems = this.cart.map(i => ({
            productId: i.productId,
            qty: i.qty,
            price: i.price
        }));

        const payload = {
            sale: {
                customerId: null,
                customerName: customerName !== 'Cliente General' ? customerName : null,
                date: new Date().toISOString(),
                subtotal: totalAmount,
                discount: 0,
                total: totalAmount,
                paidAmount: this.selectedMethod === 'cash' ? totalAmount : totalAmount,
                status: 'completed',
                paymentMethod: this.selectedMethod,
                documentType: 'boleta',
                cashRegisterId: this.activeCashRegisterId, // Vinculada a la caja abierta activa
                idempotencyKey: 'mobile_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
            },
            validItems
        };

        const submitBtn = document.querySelector('#payment-modal .btn-primary');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Procesando venta... ⏳';
        }

        try {
            const res = await fetch(`${this.serverUrl}/api/complex/sale`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`,
                    'x-business-id': localStorage.getItem('BUSINESS_ID')
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al procesar la venta');

            alert('✅ ¡Venta completada con éxito!');
            this.cart = [];
            this.updateCartUI();
            this.closePaymentModal();
            this.switchView('sell');
        } catch (err) {
            console.error(err);
            alert('❌ Fallo al realizar venta: ' + err.message);
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Confirmar Venta ✅';
            }
        }
    },

    changeServer() {
        if (confirm('¿Deseas desconectarte y volver al inicio de sesión?')) {
            this.logout();
        }
    },

    logout() {
        localStorage.removeItem('AUTH_TOKEN');
        localStorage.removeItem('USER_ROLE');
        localStorage.removeItem('MOBILE_CART');
        this.token = '';
        this.cart = [];
        this.updateCartUI();
        this.showLoginScreen();
    },

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
        toast.style.background = 'rgba(30, 41, 59, 0.9)';
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

    // --- HÉLPER DE VERIFICACIÓN DE CAJA ACTIVA EN EL SERVIDOR ---
    async checkActiveCashRegister() {
        try {
            const headers = {
                'Authorization': `Bearer ${this.token}`,
                'x-business-id': localStorage.getItem('BUSINESS_ID')
            };
            const res = await fetch(`${this.serverUrl}/api/cashRegisters?_limit=1&_order=DESC`, { headers });
            if (res.ok) {
                const registers = await res.json();
                if (registers.length > 0 && registers[0].status === 'open') {
                    return { open: true, id: registers[0].id };
                }
            }
            return { open: false, id: null };
        } catch (e) {
            console.error('Error al verificar caja activa:', e);
            return { open: false, id: null };
        }
    },

    // --- HÉLPER DE CONTROL DE PERMISOS POR ROL ---
    applyRolePermissions() {
        const role = localStorage.getItem('USER_ROLE') || 'seller';
        
        // Cajero/Vendedor no debe ver ni Cajas ni Reportes en el celular
        const isManager = (role === 'owner' || role === 'admin');
        const displayStyle = isManager ? 'flex' : 'none';

        const navCash = document.getElementById('nav-cash');
        const navReports = document.getElementById('nav-reports');

        if (navCash) navCash.style.display = displayStyle;
        if (navReports) navReports.style.display = displayStyle;
    }
};

window.onload = () => MobileApp.init();
