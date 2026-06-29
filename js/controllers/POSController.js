class POSController {
    constructor() {
        this.cart = [];
        this.currentCustomer = null;
        this.currentCashRegister = null;
        this.discountAmount = 0;
        this.creditBalanceToUse = 0;
        this.heldSales = []; // To store paused sales
    }

    _createHeldSaleSnapshot(name = '') {
        const defaultName = name || (this.currentCustomer && this.currentCustomer.name)
            ? `${(this.currentCustomer && this.currentCustomer.name) ? this.currentCustomer.name : 'Cliente'} ${new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`
            : `Venta ${new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`;

        return {
            id: Date.now() + Math.floor(Math.random() * 1000),
            cart: [...this.cart],
            customer: this.currentCustomer ? { ...this.currentCustomer } : null,
            discountAmount: this.discountAmount,
            creditBalanceToUse: this.creditBalanceToUse,
            timestamp: new Date(),
            name: defaultName
        };
    }

    holdSale(name = '') {
        if (this.cart.length === 0) {
            throw new Error('No hay productos en el carrito para poner en espera');
        }

        const heldSale = this._createHeldSaleSnapshot(name || '');

        this.heldSales.push(heldSale);
        this.clearCart();
        return heldSale;
    }

    /**
     * Delegates to Sale.computeFiscalFromTotal which properly handles documentType.
     * @param {number} total 
     * @param {string} documentType - 'boleta' or 'sin_boleta'
     */
    computeFiscalFromTotal(total, documentType = 'boleta') {
        return Sale.computeFiscalFromTotal(total, documentType);
    }

    resumeSale(heldSaleId) {
        const index = this.heldSales.findIndex(s => s.id === heldSaleId);
        if (index === -1) throw new Error('Venta en espera no encontrada');

        const held = this.heldSales[index];

        // FIX: Si ya hay una venta en curso (carrito con productos), NO debe perderse.
        // En vez de reemplazar y "desaparecer" esa venta, la volvemos a guardar en espera automáticamente.
        if (this.cart.length > 0) {
            const snapshot = this._createHeldSaleSnapshot('');
            this.heldSales.push(snapshot);
        }

        // Reemplazar la venta actual por la seleccionada
        this.cart = [...held.cart];
        this.currentCustomer = held.customer ? { ...held.customer } : null;
        this.discountAmount = held.discountAmount;
        this.creditBalanceToUse = held.creditBalanceToUse || 0; // Restore it

        // Remove from held list
        this.heldSales.splice(index, 1);

        return this.getCartSummary();
    }

    deleteHeldSale(heldSaleId) {
        this.heldSales = this.heldSales.filter(s => s.id !== heldSaleId);
    }

    async init() {
        this.currentCashRegister = await CashRegister.getOpen();
        return this.currentCashRegister !== null;
    }

    async searchProduct(term) {
        // Soporte para códigos de balanza (Chile: Prefijo 28 o 20)
        // Formato estándar: 28XXXXXWWWWWK (28 + 5 dígitos código + 5 dígitos peso en gramos + dígito verificador)
        if (term.length === 13 && (term.startsWith('28') || term.startsWith('20'))) {
            const productCode = term.substring(2, 7);
            const weightValue = parseInt(term.substring(7, 12), 10);
            
            // Buscamos el producto usando el código de 5 dígitos (debe estar registrado así en la base de datos)
            let product = await Product.getByBarcode(productCode);
            if (product) {
                if (product.type === 'weight') {
                    const weight = weightValue / 1000; // Convertir gramos a kg
                    return { product, weight };
                }
            }
        }

        let product = await Product.getByBarcode(term);

        if (!product) {
            const results = await Product.search(term);
            if (results.length === 1) {
                product = results[0];
            } else if (results.length > 1) {
                return { multiple: true, products: results };
            }
        }

        return product ? { product } : { notFound: true };
    }

    addToCart(product, quantity = 1, customPrice = null) {
        this._idempotencyKeyForCurrentSale = null;
        
        let unitPrice = customPrice !== null ? parseNumber(customPrice) : parseNumber(product.price);
        const qty = parseNumber(quantity);

        // Redondeo preventivo a nivel de ítem (Ley 20.956)
        // Para productos pesables, redondeamos el total de la línea a la decena inmediatamente
        const isWeight = product.type === 'weight' || (product.sellByWeight);
        const rawTotal = qty * unitPrice;
        
        // C10: Forzamos redondeo de Ley 20.956 (a la decena) para productos por peso o con decimales
        // Esto asegura consistencia con el preview del modal
        const itemTotal = (isWeight || qty % 1 !== 0) ? roundPrice(rawTotal) : Math.round(rawTotal);

        const existingItem = this.cart.find(item => item.productId === product.id);

        if (existingItem) {
            existingItem.quantity += qty;
            // Actualizar stock en caso de que haya cambiado
            existingItem.stock = product.stock !== undefined ? product.stock : existingItem.stock;
            // Recalcular total acumulado y volver a redondear
            const newRawTotal = existingItem.quantity * existingItem.unitPrice;
            existingItem.total = (isWeight || existingItem.quantity % 1 !== 0) ? roundPrice(newRawTotal) : Math.round(newRawTotal);
        } else {
            this.cart.push({
                productId: product.id,
                name: product.name,
                type: product.type,
                quantity: qty,
                unitPrice: unitPrice,
                cost: product.cost || 0,
                stock: product.stock !== undefined ? product.stock : 0,
                total: itemTotal,
                sellByWeight: isWeight
            });
        }

        return this.getCartSummary();
    }

    calculateExactSubtotal() {
        return this.cart.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);
    }

    setDiscount(amount) {
        this._idempotencyKeyForCurrentSale = null;
        if (typeof amount !== 'number' || isNaN(amount) || amount < 0) {
            this.discountAmount = 0;
            return this.getCartSummary();
        }

        const subtotal = this.calculateExactSubtotal();
        this.discountAmount = Math.min(amount, subtotal);
        return this.getCartSummary();
    }

    clearDiscount() {
        this._idempotencyKeyForCurrentSale = null;
        this.discountAmount = 0;
        return this.getCartSummary();
    }

    setCreditBalance(amount) {
        this._idempotencyKeyForCurrentSale = null;
        if (typeof amount !== 'number' || isNaN(amount) || amount < 0) {
            this.creditBalanceToUse = 0;
            return this.getCartSummary();
        }

        const subtotal = this.calculateExactSubtotal();
        const discountTotal = Math.max(0, subtotal - this.discountAmount);
        this.creditBalanceToUse = Math.min(amount, discountTotal);
        return this.getCartSummary();
    }

    clearCreditBalance() {
        this._idempotencyKeyForCurrentSale = null;
        this.creditBalanceToUse = 0;
        return this.getCartSummary();
    }

    removeFromCart(productId) {
        this._idempotencyKeyForCurrentSale = null;
        this.cart = this.cart.filter(item => item.productId !== productId);
        return this.getCartSummary();
    }

    updateCartItem(productId, quantity, customPrice = null) {
        this._idempotencyKeyForCurrentSale = null;
        const item = this.cart.find(i => i.productId === productId);
        if (item) {
            if (customPrice !== null) {
                item.unitPrice = parseNumber(customPrice);
            }
            item.quantity = parseNumber(quantity);
            const isWeight = item.type === 'weight' || item.sellByWeight;
            item.total = (isWeight || item.quantity % 1 !== 0) ? roundPrice(item.quantity * item.unitPrice) : Math.round(item.quantity * item.unitPrice); 
        }
        return this.getCartSummary();
    }

    getCartSummary() {
        const subtotal = this.calculateExactSubtotal();
        const discount = Math.min(this.discountAmount, subtotal);
        const afterDiscount = Math.max(0, subtotal - discount);
        const creditBalanceUsed = Math.min(this.creditBalanceToUse, afterDiscount);
        const exactTotal = Math.max(0, afterDiscount - creditBalanceUsed);

        return {
            items: this.cart,
            itemCount: this.cart.length,
            totalItems: this.cart.reduce((sum, item) => sum + item.quantity, 0),
            subtotal: subtotal,
            discount: discount,
            creditBalanceUsed: creditBalanceUsed,
            total: exactTotal, // Exact total for Card/Digital
            roundedTotal: roundPrice(exactTotal), // Rounded total for Cash
            actualTotalSale: afterDiscount 
        };
    }

    clearCart(keepCustomer = false) {
        this.cart = [];
        this.discountAmount = 0;
        this.creditBalanceToUse = 0;
        this._idempotencyKeyForCurrentSale = null;
        // Don't clear customer if keepCustomer is true (for consecutive credit sales)
        if (!keepCustomer) {
            this.currentCustomer = null;
        }
        return this.getCartSummary();
    }

    setCustomer(customer) {
        this.currentCustomer = customer;
    }

    async completeSale(paymentMethod, isPending = false, paymentDetails = null, documentType = 'boleta', forcedTotal = null) {
        if (this.cart.length === 0) {
            throw new Error('El carrito está vacío');
        }

        if (!this.currentCashRegister) {
            throw new Error('No hay caja abierta');
        }

        const summary = this.getCartSummary();
        const totalToPay = forcedTotal !== null ? forcedTotal : summary.total;

        // Validation for items stock
        for (const item of this.cart) {
            const check = await this.validateStock(item.productId, item.quantity);
            if (!check.valid) throw new Error(check.error);
        }

        // Calculate actual paid amount from paymentDetails
        let paidAmount = 0;
        if (paymentDetails) {
            // Sum all payment methods except 'debt' (which is implicit)
            paidAmount = Object.entries(paymentDetails)
                .filter(([key]) => key !== 'debt')
                .reduce((sum, [, val]) => sum + (parseFloat(val) || 0), 0);
        } else {
            // If no details, it's a single method payment
            paidAmount = isPending ? 0 : totalToPay;
        }

        // Determinar si es una venta con deuda (parcial o pendiente)
        const isDebtSale = isPending || (paidAmount < totalToPay);
        
        if (isDebtSale && !this.currentCustomer) {
            throw new Error('Debes seleccionar un cliente para dejar montos pendientes o ventas anotadas');
        }

        // Dinero a favor: validar que el cliente tenga saldo suficiente
        const creditBalanceUsed = paymentDetails && (paymentDetails.creditBalance != null) ? parseFloat(paymentDetails.creditBalance) || 0 : 0;
        if (creditBalanceUsed > 0) {
            if (!this.currentCustomer) throw new Error('Debes seleccionar un cliente para usar dinero a favor');
            const customer = await Customer.getById(this.currentCustomer.id);
            const currentCredit = (customer && customer.balanceCredit != null) ? parseFloat(customer.balanceCredit) || 0 : 0;
            if (currentCredit < creditBalanceUsed) throw new Error(`El cliente tiene ${formatCLP(currentCredit)} a favor; no alcanza para ${formatCLP(creditBalanceUsed)}`);
        }

        // CRITICAL: Historical cost and rounding
        const itemsWithHistoricalCost = await Promise.all(this.cart.map(async (item) => {
            const product = await Product.getById(item.productId);
            return {
                ...item,
                costAtSale: product ? (parseFloat(product.cost) || 0) : 0
            };
        }));

        const itemsWithRoundedTotals = itemsWithHistoricalCost.map((item) => ({
            ...item,
            total: Math.round(parseFloat(item.total) || 0)
        }));

        const saleData = {
            customerId: this.currentCustomer ? this.currentCustomer.id : null,
            items: itemsWithRoundedTotals,
            subtotal: summary.subtotal,
            total: totalToPay,
            discount: summary.discount,
            ...this.computeFiscalFromTotal(totalToPay, documentType),
            paymentMethod: paymentMethod === 'mixed' ? 'mixed' : (isDebtSale && paidAmount === 0 ? 'pending' : paymentMethod),
            paymentDetails: paymentDetails,
            cashRegisterId: this.currentCashRegister.id,
            status: paidAmount >= totalToPay ? 'completed' : (paidAmount > 0 ? 'partial' : 'pending'),
            paidAmount: Math.min(paidAmount, totalToPay),
            documentType: documentType || 'boleta',
            transferName: paymentDetails ? paymentDetails.transferName : null,
            transferBank: paymentDetails ? paymentDetails.transferBank : null
        };

        if (!this._idempotencyKeyForCurrentSale) {
            this._idempotencyKeyForCurrentSale = 'idem_' + Date.now() + '_' + Math.random().toString(36).slice(2, 14);
        }
        saleData.idempotencyKey = this._idempotencyKeyForCurrentSale;

        const customerId = this.currentCustomer ? this.currentCustomer.id : null;

        const createResult = await Sale.create(saleData);
        const saleId = (typeof createResult === 'object' && createResult && createResult.saleId !== undefined)
            ? createResult.saleId
            : createResult;

        const fromIdempotency = (typeof createResult === 'object' && createResult && createResult.fromIdempotency === true);
        if (fromIdempotency) {
            const sale = await Sale.getById(saleId);
            this.clearCart(false);
            showNotification('Venta ya registrada (evitado duplicado).', 'success');
            return sale;
        }

        const sale = await Sale.getById(saleId);
        
        // Descontar dinero a favor del cliente (Solo en IndexedDB, en SQLite lo hace el backend atómicamente)
        if (db.mode !== 'sqlite' && creditBalanceUsed > 0 && customerId) {
            const customer = await Customer.getById(customerId);
            const currentCredit = (customer && customer.balanceCredit != null) ? parseFloat(customer.balanceCredit) || 0 : 0;
            const newCredit = Math.max(0, currentCredit - creditBalanceUsed);
            await Customer.update(customerId, { balanceCredit: newCredit });
            
            if (sale) {
                await CustomerCreditUse.create({
                    customerId,
                    amount: creditBalanceUsed,
                    saleId: sale.id,
                    saleNumber: sale.saleNumber
                });
            }
        }

        if (!sale) {
            throw new Error('Error: La venta no se pudo crear correctamente');
        }

        if (isPending && sale.customerId != customerId) {
            sale.customerId = customerId;
            await db.put('sales', sale);
        }

        this.clearCart(false);
        this._idempotencyKeyForCurrentSale = null;

        const remainingDebt = Math.max(0, (sale.total || 0) - (sale.paidAmount || 0));
        const message = isPending
            ? `Venta #${sale.saleNumber} anotada. Deuda: ${formatCLP(remainingDebt)}`
            : `Venta #${sale.saleNumber} completada`;
        showNotification(message, 'success');

        // Notebook Feature: Actualizar fecha de última venta para reporte de rotación lenta
        try {
            const date = new Date().toISOString();
            for (const item of itemsWithRoundedTotals) {
                await Product.updateLastSoldAt(item.productId, date);
            }
        } catch (e) {
            console.warn('No se pudo actualizar lastSoldAt:', e);
        }

        return sale;
    }

    async validateStock(productId, quantity) {
        const product = await Product.getById(productId);
        if (!product) return { valid: false, error: 'Producto no encontrado' };
        
        let allowNegative = true;
        try {
            const config = await db.get('settings', 'allowNegativeStock');
            allowNegative = config == null ? true : !!config.value;
        } catch (e) {
            console.warn('Error recuperando allowNegativeStock:', e.message);
        }

        return ProductValidator.validateStock(product, quantity, allowNegative);
    }
}

const posController = new POSController();
