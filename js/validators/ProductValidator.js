/**
 * Product Validator
 * Centralizes all product validation logic
 */
class ProductValidator {
    /**
     * Validate product data
     * @param {Object} productData - Product data
     * @returns {Object} - { valid: boolean, error?: string }
     */
    static validate(productData) {
        if (!productData || !productData.name || productData.name.trim() === '') {
            return {
                valid: false,
                error: 'El nombre del producto es requerido'
            };
        }
        
        const price = parseFloat(productData.price) || 0;
        if (price < 0) {
            return {
                valid: false,
                error: 'El precio no puede ser negativo'
            };
        }
        
        const cost = parseFloat(productData.cost) || 0;
        if (cost < 0) {
            return {
                valid: false,
                error: 'El costo no puede ser negativo'
            };
        }
        
        /* 
        Permitimos stock negativo temporalmente según solicitud del usuario 
        para mantener operatividad hasta auditoría total.
        */
        const stock = parseFloat(productData.stock);
        if (isNaN(stock)) {
             // Si el campo stock está presente pero no es un número, podrías validar si es requerido
        }
        
        // Validate type
        const validTypes = ['unit', 'weight'];
        if (productData.type && !validTypes.includes(productData.type)) {
            return {
                valid: false,
                error: `Tipo de producto inválido. Debe ser uno de: ${validTypes.join(', ')}`
            };
        }
        
        // Validate expiryDate if provided (optional; format YYYY-MM-DD)
        if (productData.expiryDate != null && String(productData.expiryDate).trim() !== '') {
            const d = String(productData.expiryDate).trim().slice(0, 10);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(Date.parse(d))) {
                return {
                    valid: false,
                    error: 'Fecha de vencimiento debe ser una fecha válida (AAAA-MM-DD)'
                };
            }
        }
        
        return { valid: true };
    }

    /**
     * Validate stock availability
     * @param {Object} product - Product object
     * @param {number} quantity - Required quantity
     * @returns {Object} - { valid: boolean, error?: string }
     */
    static validateStock(product, quantity, allowNegative = true) {
        if (!product) {
            return {
                valid: false,
                error: 'Producto no encontrado'
            };
        }
        
        const stock = parseFloat(product.stock) || 0;
        const qty = parseFloat(quantity) || 0;
        if (isNaN(qty) || qty <= 0) {
            return { valid: false, error: 'Cantidad inválida' };
        }
        
        // Permitir ventas sin stock (solo advertencia en consola) o bloquear si no está permitido
        if (stock < qty) {
            if (!allowNegative) {
                return {
                    valid: false,
                    error: `Stock insuficiente para "${product.name}". Disponible: ${stock} un.`
                };
            }
            console.warn(`⚠️ Venta con stock insuficiente: ${product.name} (stock: ${stock}, vendido: ${qty})`);
        }
        
        return { valid: true };
    }
}
