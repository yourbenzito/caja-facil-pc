/**
 * Product Service
 * Centraliza la lógica de negocio de productos. Toda creación/actualización pasa por validación.
 */
class ProductService {
    /**
     * Valida datos de producto y crea (usa ProductValidator).
     * @param {Object} data - Datos del producto
     * @returns {Promise<number>} - ID del producto creado
     */
    static async createProduct(data) {
        const validation = ProductValidator.validate(data);
        if (!validation.valid) {
            throw new Error(validation.error);
        }
        if (data.barcode && String(data.barcode).trim() !== '') {
            const existing = await Product.getByBarcode(data.barcode.trim());
            if (existing) {
                throw new Error(`El código de barras "${data.barcode}" ya está asignado a otro producto`);
            }
        }
        const expiryDate = data.expiryDate && String(data.expiryDate).trim() ? String(data.expiryDate).trim().slice(0, 10) : null;
        const payload = { ...data, expiryDate };
        return await Product.create(payload);
    }

    /**
     * Valida datos y actualiza producto (usa ProductValidator).
     * Si el stock cambia, aplica un ajuste con trazabilidad vía StockService.
     * @param {number} id - ID del producto
     * @param {Object} data - Datos a actualizar
     * @returns {Promise<void>}
     */
    static async updateProduct(id, data) {
        const validation = ProductValidator.validate(data);
        if (!validation.valid) {
            throw new Error(validation.error);
        }
        // A2 FIX: Validar unicidad de barcode al actualizar (antes solo se validaba al crear)
        if (data.barcode && String(data.barcode).trim() !== '') {
            const trimmedBarcode = String(data.barcode).trim();
            const existing = await Product.getByBarcode(trimmedBarcode);
            if (existing && existing.id !== parseInt(id)) {
                throw new Error(`El código de barras "${trimmedBarcode}" ya está asignado al producto "${existing.name}"`);
            }
        }
        const { stock, ...rest } = data;
        const expiryDate = rest.expiryDate != null && String(rest.expiryDate).trim() !== '' ? String(rest.expiryDate).trim().slice(0, 10) : null;
        await Product.update(id, { ...rest, expiryDate });

        // Si el usuario modificó el stock desde el formulario, aplicar ajuste con trazabilidad
        // ATOMIC FIX: Uses setStock which calculates the difference WITHIN the transaction,
        // preventing race conditions if stock changes between reading and writing.
        if (stock !== undefined && stock !== null && stock !== '') {
            const newStock = parseFloat(stock);
            if (!isNaN(newStock)) {
                await StockService.setStock(
                    id,
                    newStock,
                    'Ajuste manual desde edición de producto'
                );
            }
        }
    }
}
