/**
 * Payment Validator
 * Centralizes all payment validation logic
 */
class PaymentValidator {
    /**
     * Validate payment amount
     * @param {number} amount - Payment amount
     * @param {Object} sale - Sale object
     * @returns {Object} - { valid: boolean, error?: string }
     */
    static validateAmount(amount, sale) {
        const paymentAmount = parseFloat(amount) || 0;
        
        if (paymentAmount <= 0) {
            return {
                valid: false,
                error: 'El monto del pago debe ser mayor a 0'
            };
        }
        
        const saleTotal = parseFloat(sale.total) || 0;
        const salePaidAmount = parseFloat(sale.paidAmount) || 0;
        const remaining = saleTotal - salePaidAmount;
        
        if (paymentAmount > remaining) {
            return {
                valid: false,
                error: `El monto del pago (${formatCLP(paymentAmount)}) no puede ser mayor a la deuda restante (${formatCLP(remaining)})`
            };
        }
        
        return { valid: true };
    }

    /**
     * Validate payment method
     * @param {string} method - Payment method
     * @returns {Object} - { valid: boolean, error?: string }
     */
    static validateMethod(method) {
        // 'discount' y 'credit' no mueven dinero: se usan para abonos por devolución o saldo a favor
        const validMethods = ['cash', 'card', 'qr', 'other', 'discount', 'credit'];
        
        if (!method) {
            return {
                valid: false,
                error: 'El método de pago es requerido'
            };
        }
        
        if (!validMethods.includes(method)) {
            return {
                valid: false,
                error: `Método de pago inválido. Debe ser uno de: ${validMethods.join(', ')}`
            };
        }
        
        return { valid: true };
    }

    /**
     * Validate payment data
     * @param {Object} paymentData - Payment data
     * @param {Object} sale - Sale object
     * @returns {Object} - { valid: boolean, errors?: Array<string> }
     */
    static validate(paymentData, sale) {
        const errors = [];
        
        if (!paymentData || !paymentData.saleId) {
            errors.push('Payment debe tener un saleId asociado');
        }
        
        if (paymentData.amount !== undefined) {
            const amountValidation = this.validateAmount(paymentData.amount, sale);
            if (!amountValidation.valid) {
                errors.push(amountValidation.error);
            }
        }
        
        if (paymentData.paymentMethod !== undefined) {
            const methodValidation = this.validateMethod(paymentData.paymentMethod);
            if (!methodValidation.valid) {
                errors.push(methodValidation.error);
            }
        }
        
        return {
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined
        };
    }
}
