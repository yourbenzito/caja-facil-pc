const mercadopago = require('mercadopago');

// Configurar MercadoPago con las credenciales del .env
if (process.env.MERCADOPAGO_ACCESS_TOKEN) {
    mercadopago.configure({
        access_token: process.env.MERCADOPAGO_ACCESS_TOKEN
    });
} else {
    console.warn('[MercadoPago] No se configuró ACCESS_TOKEN. La integración no funcionará sin credenciales.');
}

/**
 * Crear una preferencia de pago en MercadoPago
 * @param {Object} paymentData - Datos del pago
 * @param {number} paymentData.amount - Monto a cobrar
 * @param {string} paymentData.description - Descripción del pago
 * @param {string} paymentData.external_reference - Referencia externa (ID de venta)
 * @returns {Promise<Object>} Preferencia de pago creada
 */
async function createPaymentPreference(paymentData) {
    try {
        const preference = {
            items: [
                {
                    title: paymentData.description || 'Venta POS',
                    quantity: 1,
                    currency_id: 'CLP',
                    unit_price: paymentData.amount
                }
            ],
            external_reference: paymentData.external_reference,
            back_urls: {
                success: `${process.env.APP_URL}/api/payments/mercadopago/success`,
                failure: `${process.env.APP_URL}/api/payments/mercadopago/failure`,
                pending: `${process.env.APP_URL}/api/payments/mercadopago/pending`
            },
            auto_return: 'approved',
            payment_methods: {
                excluded_payment_types: [
                    { id: 'ticket' } // Excluir pagos en efectivo
                ],
                installments: 1 // Una sola cuota
            }
        };

        const result = await mercadopago.preferences.create(preference);
        return result;
    } catch (error) {
        console.error('[MercadoPago] Error creando preferencia:', error);
        throw new Error('Error al crear preferencia de pago: ' + error.message);
    }
}

/**
 * Enviar monto al terminal Point (MercadoPago Point)
 * Esta función requiere integración con el SDK de Point
 * @param {Object} paymentData - Datos del pago
 * @param {number} paymentData.amount - Monto a cobrar
 * @param {string} paymentData.deviceId - ID del dispositivo Point
 * @returns {Promise<Object>} Resultado del pago
 */
async function sendToTerminal(paymentData) {
    try {
        // NOTA: Esta función requiere el SDK específico de MercadoPago Point
        // Por ahora, simulamos la integración
        // Para integración real, necesitas:
        // 1. SDK de MercadoPago Point
        // 2. DEVICE_ID de tu terminal
        // 3. Certificación del terminal

        console.log('[MercadoPago] Enviando pago a terminal Point:', {
            amount: paymentData.amount,
            deviceId: paymentData.deviceId || process.env.MERCADOPAGO_DEVICE_ID
        });

        // Simulación de respuesta
        return {
            status: 'pending',
            message: 'Integración con terminal Point requiere SDK específico',
            deviceId: paymentData.deviceId || process.env.MERCADOPAGO_DEVICE_ID,
            amount: paymentData.amount
        };
    } catch (error) {
        console.error('[MercadoPago] Error enviando a terminal:', error);
        throw new Error('Error al enviar pago a terminal: ' + error.message);
    }
}

/**
 * Verificar estado de un pago en MercadoPago
 * @param {string} paymentId - ID del pago en MercadoPago
 * @returns {Promise<Object>} Estado del pago
 */
async function getPaymentStatus(paymentId) {
    try {
        const payment = await mercadopago.payment.get(paymentId);
        return payment.body;
    } catch (error) {
        console.error('[MercadoPago] Error obteniendo estado del pago:', error);
        throw new Error('Error al obtener estado del pago: ' + error.message);
    }
}

/**
 * Crear un pago QR (para integración manual)
 * @param {Object} paymentData - Datos del pago
 * @returns {Promise<Object>} Código QR generado
 */
async function createQRPayment(paymentData) {
    try {
        const preference = await createPaymentPreference(paymentData);
        return {
            qr_code: preference.body.sandbox_init_point || preference.body.init_point,
            preference_id: preference.body.id,
            amount: paymentData.amount
        };
    } catch (error) {
        console.error('[MercadoPago] Error creando pago QR:', error);
        throw new Error('Error al crear pago QR: ' + error.message);
    }
}

module.exports = {
    createPaymentPreference,
    sendToTerminal,
    getPaymentStatus,
    createQRPayment
};
