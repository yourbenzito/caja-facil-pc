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

// =========================================================================================
// OFERTA DE LANZAMIENTO (50 PLAZAS - 20% OFF PERPETUO + 7 DÍAS GRATIS)
// =========================================================================================
const { getMachineFingerprint, validateRut, formatCleanRut } = require('../helpers/fingerprint');
const { supabaseAdmin, supabase } = require('../supabase');

const PROMO_PLAN_PRICES = {
    'PC_PRO': 19990,
    'MOVIL_PRO': 14990,
    'FULL_PRO': 24990
};

// 1. Contador público en vivo (plazas restantes)
router.get('/api/payments/promo/stats', async (req, res) => {
    try {
        const client = supabaseAdmin || supabase;
        const { data, error } = await client.rpc('get_public_promo_stats');
        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.warn('[Promo] Error obteniendo estadísticas de plazas:', err.message);
        res.status(500).json({ error: 'Error al consultar plazas disponibles' });
    }
});

// 2. Reserva atómica y creación de preferencia con 20% de descuento
router.post('/api/payments/promo/reserve-preference', async (req, res) => {
    const { plan, rut, email } = req.body;
    const userId = req.userId || req.supabaseUserId;

    if (!userId) {
        return res.status(401).json({ error: 'Debes iniciar sesión para acceder a la promoción' });
    }

    const cleanPlan = (plan || 'PC_PRO').toUpperCase();
    if (!PROMO_PLAN_PRICES[cleanPlan]) {
        return res.status(400).json({ error: 'Plan seleccionado inválido' });
    }

    if (!rut || !validateRut(rut)) {
        return res.status(400).json({ error: 'RUT chileno inválido. Verifica el número y el dígito verificador.' });
    }

    const formattedRut = formatCleanRut(rut);
    const machineHash = getMachineFingerprint();
    const client = supabaseAdmin || supabase;

    try {
        // Reservar atómicamente la plaza por 30 minutos (PostgreSQL FOR UPDATE SKIP LOCKED)
        const { data: reserveResult, error: reserveErr } = await client.rpc('reserve_promo_slot', {
            p_user_id: userId,
            p_email: email || req.username || 'usuario@cajafacil.cl',
            p_rut: formattedRut,
            p_machine_hash: machineHash
        });

        if (reserveErr) throw reserveErr;
        if (!reserveResult || !reserveResult.success) {
            return res.status(409).json({
                error: reserveResult?.message || 'No fue posible reservar la plaza de promoción',
                code: reserveResult?.code || 'PROMO_ERROR'
            });
        }

        const basePrice = PROMO_PLAN_PRICES[cleanPlan];
        const finalPrice = Math.round(basePrice * 0.80); // 20% calculado exclusivamente server-side

        // Crear la preferencia en Mercado Pago con metadatos inmutables
        const preference = await mercadopagoService.createPaymentPreference({
            amount: finalPrice,
            description: `Caja Fácil ${cleanPlan} - Oferta Lanzamiento (20% OFF de por vida)`,
            external_reference: `promo_${reserveResult.slot_number}_${userId}_${Date.now()}`
        });

        res.json({
            success: true,
            slot_number: reserveResult.slot_number,
            reserved_until: reserveResult.reserved_until,
            original_price: basePrice,
            discounted_price: finalPrice,
            preference_id: preference.body.id,
            init_point: preference.body.init_point
        });
    } catch (err) {
        console.error('[Promo] Error reservando plaza de promoción:', err);
        res.status(500).json({ error: err.message || 'Error procesando la oferta de lanzamiento' });
    }
});

// 3. Webhook de Mercado Pago para consumo atómico e idempotente
router.post('/api/payments/mercadopago/webhook', async (req, res) => {
    // Responder inmediatamente 200 OK a Mercado Pago para evitar reintentos en bucle
    res.status(200).send('OK');

    const { type, action, data } = req.body || {};
    const paymentId = data?.id || req.query['data.id'] || req.query.id;

    if (!paymentId || (type !== 'payment' && action !== 'payment.created' && action !== 'payment.updated')) {
        return;
    }

    try {
        const paymentInfo = await mercadopagoService.getPaymentStatus(paymentId);
        if (!paymentInfo || !paymentInfo.body) return;

        const payment = paymentInfo.body;
        const status = payment.status;
        const externalRef = payment.external_reference || '';

        // Solo procesamos pagos relacionados a la promoción de lanzamiento
        if (!externalRef.startsWith('promo_')) return;

        const parts = externalRef.split('_');
        const slotNumber = parseInt(parts[1], 10);
        const userId = parts[2];

        const client = supabaseAdmin || supabase;
        if (!client) return;

        if (status === 'approved') {
            // Huella de la tarjeta (payer_id + últimos 4 dígitos)
            const payerId = payment.payer?.id || payment.payer?.email || 'anon_payer';
            const lastFour = payment.card?.last_four_digits || '0000';
            const crypto = require('crypto');
            const cardFingerprint = crypto.createHash('sha256').update(`${payerId}_${lastFour}`).digest('hex');

            console.log(`[Promo Webhook] Confirmando plaza ${slotNumber} para usuario [${userId}] (Payment: ${paymentId})`);

            const { data: consumeResult, error: consumeErr } = await client.rpc('consume_promo_slot', {
                p_user_id: userId,
                p_payment_id: String(paymentId),
                p_payer_id: String(payerId),
                p_card_fingerprint: cardFingerprint,
                p_plan: 'PC_PRO',
                p_ip: req.ip || '127.0.0.1',
                p_user_agent: req.headers['user-agent'] || 'MercadoPago Webhook'
            });

            if (consumeErr) {
                console.error('[Promo Webhook] Error consumiendo slot en Supabase:', consumeErr);
            } else {
                console.log('[Promo Webhook] ✅ Plaza consumida exitosamente:', consumeResult);
            }
        } else if (status === 'refunded' || status === 'charged_back') {
            console.warn(`[Promo Webhook] ⚠️ Revocando plaza por reembolso/chargeback (Payment: ${paymentId})`);
            await client.rpc('revoke_promo_slot', {
                p_payment_id: String(paymentId),
                p_reason: `Estado Mercado Pago: ${status}`
            });
        }
    } catch (err) {
        console.error('[Promo Webhook] Error procesando notificación de pago:', err);
    }
});

module.exports = router;
