/**
 * Sale Validator
 * Centralizes all sale validation logic
 */
class SaleValidator {
    /**
     * Validate sale data
     * @param {Object} saleData - Sale data
     * @returns {Object} - { valid: boolean, error?: string }
     */
    static validate(saleData) {
        if (!saleData || !saleData.items || saleData.items.length === 0) {
            return {
                valid: false,
                error: 'La venta debe contener al menos un item'
            };
        }
        
        if (!saleData.cashRegisterId) {
            return {
                valid: false,
                error: 'La venta debe estar asociada a una caja registradora'
            };
        }
        
        // Validate pending and partial sales have customer
        const needsCustomer = saleData.status === 'pending' || saleData.status === 'partial';
        if (needsCustomer && !saleData.customerId) {
            return {
                valid: false,
                error: 'Las ventas pendientes o parciales deben tener un cliente asociado'
            };
        }
        
        // Validate items
        for (const item of saleData.items) {
            if (!item || !item.productId || item.quantity === undefined) {
                return {
                    valid: false,
                    error: 'Todos los items deben tener productId y quantity válidos'
                };
            }
            
            if (parseFloat(item.quantity) <= 0) {
                return {
                    valid: false,
                    error: 'La cantidad de cada item debe ser mayor a 0'
                };
            }
        }
        
        // Validate total: POS uses roundPrice(subtotal - discount) to nearest 10, so total may not equal raw sum
        const sumOfItems = saleData.items.reduce((sum, item) => {
            const itemTotal = parseFloat(item.total) || 0;
            return sum + itemTotal;
        }, 0);
        const discount = parseFloat(saleData.discount) || 0;
        const toNearestTen = (v) => {
            const val = parseFloat(v);
            if (Number.isNaN(val)) return 0;
            const n = Math.floor(val);
            const lastDigit = n % 10;
            if (lastDigit >= 1 && lastDigit <= 5) return Math.floor(n / 10) * 10;
            if (lastDigit >= 6 && lastDigit <= 9) return Math.ceil(n / 10) * 10;
            return n;
        };
        const expectedTotal = toNearestTen(Math.max(0, sumOfItems - discount));
        const providedTotal = parseFloat(saleData.total) || 0;
        const tolerance = 0.01;

        if (Math.abs(providedTotal - expectedTotal) > tolerance && Math.abs(providedTotal - sumOfItems) > tolerance) {
            return {
                valid: false,
                error: `El total de la venta (${providedTotal.toFixed(2)}) no coincide con la suma de ítems (${sumOfItems.toFixed(2)}). Verifica los montos.`
            };
        }
        
        return { valid: true };
    }

    /**
     * Validate sale items
     * @param {Array} items - Sale items
     * @returns {Object} - { valid: boolean, error?: string }
     */
    static validateItems(items) {
        if (!Array.isArray(items) || items.length === 0) {
            return {
                valid: false,
                error: 'La venta debe contener al menos un item'
            };
        }
        
        for (const item of items) {
            if (!item || !item.productId || item.quantity === undefined) {
                return {
                    valid: false,
                    error: 'Todos los items deben tener productId y quantity válidos'
                };
            }
            
            if (parseFloat(item.quantity) <= 0) {
                return {
                    valid: false,
                    error: 'La cantidad de cada item debe ser mayor a 0'
                };
            }
        }
        
        return { valid: true };
    }
}
