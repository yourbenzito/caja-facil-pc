const express = require('express');
const router = express.Router();
const mercadopagoService = require('../mercadopago');
const { roundPrice } = require('../helpers/utils');

// Crear preferencia de pago (para integración web)
router.post('/api/payments/mercadopago/create-preference', async (req, res) => {
    const { amount, description, external_reference } = req.body;
    const businessId = req.business_id;

    if (!amount) {
        return res.status(400).json({ error: 'Falta el monto del pago' });
    }

    const roundedAmount = roundPrice(amount);

    try {
        const preference = await mercadopagoService.createPaymentPreference({
            amount: roundedAmount,
            description: description || `Venta POS - Negocio ${businessId}`,
            external_reference: external_reference || `sale_${Date.now()}`
        });

        res.json({
            success: true,
            preference_id: preference.body.id,
            init_point: preference.body.init_point,
            sandbox_init_point: preference.body.sandbox_init_point,
            rounded_amount: roundedAmount
        });
    } catch (err) {
        console.error('[MercadoPago] Error creando preferencia:', err);
        res.status(500).json({ error: err.message });
    }
});

// Enviar pago a terminal Point (integración con terminal físico)
router.post('/api/payments/mercadopago/send-to-terminal', async (req, res) => {
    const { amount, deviceId } = req.body;
    const businessId = req.business_id;

    if (!amount) {
        return res.status(400).json({ error: 'Falta el monto del pago' });
    }

    const roundedAmount = roundPrice(amount);

    try {
        const result = await mercadopagoService.sendToTerminal({
            amount: roundedAmount,
            deviceId: deviceId || process.env.MERCADOPAGO_DEVICE_ID
        });

        res.json({
            success: true,
            result,
            rounded_amount: roundedAmount
        });
    } catch (err) {
        console.error('[MercadoPago] Error enviando a terminal:', err);
        res.status(500).json({ error: err.message });
    }
});

// Verificar estado de pago
router.get('/api/payments/mercadopago/status/:paymentId', async (req, res) => {
    const { paymentId } = req.params;

    try {
        const status = await mercadopagoService.getPaymentStatus(paymentId);
        res.json({
            success: true,
            status
        });
    } catch (err) {
        console.error('[MercadoPago] Error obteniendo estado:', err);
        res.status(500).json({ error: err.message });
    }
});

// Crear pago QR (para integración manual)
router.post('/api/payments/mercadopago/create-qr', async (req, res) => {
    const { amount, description, external_reference } = req.body;
    const businessId = req.business_id;

    if (!amount) {
        return res.status(400).json({ error: 'Falta el monto del pago' });
    }

    const roundedAmount = roundPrice(amount);

    try {
        const qrPayment = await mercadopagoService.createQRPayment({
            amount: roundedAmount,
            description: description || `Venta POS - Negocio ${businessId}`,
            external_reference: external_reference || `sale_${Date.now()}`
        });

        res.json({
            success: true,
            qr_code: qrPayment.qr_code,
            preference_id: qrPayment.preference_id,
            amount: qrPayment.amount,
            rounded_amount: roundedAmount
        });
    } catch (err) {
        console.error('[MercadoPago] Error creando pago QR:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
