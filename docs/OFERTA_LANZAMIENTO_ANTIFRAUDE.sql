-- =========================================================================================
-- CAJA FÁCIL POS — SISTEMA ANTI-FRAUDE: OFERTA DE LANZAMIENTO (50 PLAZAS)
-- =========================================================================================
-- Beneficio: 20% de descuento permanente en la suscripción + 1 semana gratis (trial 7 días).
-- Regla de Oro: Toda la validación, contador atómico, idempotencia y candados se ejecutan
-- server-side en PostgreSQL / Supabase y en el procesador de pagos.
-- =========================================================================================

-- Habilitar extensiones requeridas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================================================
-- 1. TABLA: PLAZAS NUMERADAS FIJAS (1 AL 50) — IMPOSIBLE MATEMÁTICAMENTE SUPERAR LAS 50
-- =========================================================================================
CREATE TABLE IF NOT EXISTS public.launch_promo_slots (
    slot_number INT PRIMARY KEY CHECK (slot_number BETWEEN 1 AND 50),
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'consumed', 'revoked')),
    reserved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reserved_until TIMESTAMPTZ,
    payment_id TEXT UNIQUE,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Insertar las 50 plazas fijas (idempotente)
INSERT INTO public.launch_promo_slots (slot_number)
SELECT generate_series(1, 50)
ON CONFLICT (slot_number) DO NOTHING;

-- =========================================================================================
-- 2. TABLA: REDENCIONES INMUTABLES CONFIRMADAS (UNA PERSONA NATURAL = UNA REDENCIÓN)
-- =========================================================================================
CREATE TABLE IF NOT EXISTS public.promo_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_number INT NOT NULL UNIQUE REFERENCES public.launch_promo_slots(slot_number),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
    email TEXT NOT NULL UNIQUE,
    rut TEXT NOT NULL UNIQUE,
    machine_hash TEXT NOT NULL UNIQUE,
    card_fingerprint TEXT NOT NULL, -- Hash de payer_id + últimos 4 dígitos
    payment_id TEXT NOT NULL UNIQUE,
    plan TEXT NOT NULL CHECK (plan IN ('PC_PRO', 'MOVIL_PRO', 'FULL_PRO')),
    discount_percent NUMERIC(5,2) NOT NULL DEFAULT 20.00,
    trial_ends_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    ip_address TEXT,
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_promo_card_fingerprint ON public.promo_redemptions(card_fingerprint);
CREATE INDEX IF NOT EXISTS idx_promo_machine_hash ON public.promo_redemptions(machine_hash);
CREATE INDEX IF NOT EXISTS idx_promo_rut ON public.promo_redemptions(rut);

-- =========================================================================================
-- 3. TABLA: BANDERAS DE FRAUDE Y AUDITORÍA INMUTABLE (FRAUD FLAGS)
-- =========================================================================================
CREATE TABLE IF NOT EXISTS public.fraud_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    flag_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fraud_flags_user ON public.fraud_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_flags_severity ON public.fraud_flags(severity);

-- =========================================================================================
-- 4. SEGURIDAD DE FILA (ROW LEVEL SECURITY - RLS)
-- =========================================================================================
ALTER TABLE public.launch_promo_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_flags ENABLE ROW LEVEL SECURITY;

-- Políticas
DROP POLICY IF EXISTS "Contador publico de plazas" ON public.launch_promo_slots;
CREATE POLICY "Contador publico de plazas" ON public.launch_promo_slots
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Usuarios ven su propia redencion" ON public.promo_redemptions;
CREATE POLICY "Usuarios ven su propia redencion" ON public.promo_redemptions
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Solo backend administrativo gestiona flags" ON public.fraud_flags;
CREATE POLICY "Solo backend administrativo gestiona flags" ON public.fraud_flags
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');


-- =========================================================================================
-- 5. FUNCIONES RPC ATÓMICAS (TRANSACCIONALES ACID)
-- =========================================================================================

-- A. Contador Público en Vivo (Solo Lectura, Cacheable por 60s)
CREATE OR REPLACE FUNCTION public.get_public_promo_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_consumed INT;
    v_reserved INT;
    v_available INT;
BEGIN
    -- Limpieza pasiva de reservas expiradas (+30 minutos sin pagar)
    UPDATE public.launch_promo_slots
    SET status = 'available', reserved_by = NULL, reserved_until = NULL
    WHERE status = 'reserved' AND reserved_until < now();

    SELECT count(*) INTO v_consumed FROM public.launch_promo_slots WHERE status = 'consumed';
    SELECT count(*) INTO v_reserved FROM public.launch_promo_slots WHERE status = 'reserved';
    v_available := 50 - v_consumed - v_reserved;

    RETURN jsonb_build_object(
        'total', 50,
        'consumed', v_consumed,
        'reserved', v_reserved,
        'available', GREATEST(0, v_available),
        'is_active', (v_consumed < 50)
    );
END;
$$;

-- B. Reservar Plaza por 30 Minutos (Anti-Carrera con SELECT ... FOR UPDATE SKIP LOCKED)
CREATE OR REPLACE FUNCTION public.reserve_promo_slot(
    p_user_id UUID,
    p_email TEXT,
    p_rut TEXT,
    p_machine_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_slot INT;
    v_conflict_reason TEXT;
    v_user_email_confirmed BOOLEAN;
BEGIN
    -- 1. Validar verificación obligatoria de correo
    SELECT (email_confirmed_at IS NOT NULL) INTO v_user_email_confirmed
    FROM auth.users WHERE id = p_user_id;

    IF v_user_email_confirmed IS NOT TRUE THEN
        RETURN jsonb_build_object(
            'success', false, 
            'code', 'EMAIL_NOT_VERIFIED', 
            'message', 'Debes confirmar tu correo electrónico antes de poder acceder a la oferta de lanzamiento.'
        );
    END IF;

    -- 2. Limpieza de reservas expiradas
    UPDATE public.launch_promo_slots
    SET status = 'available', reserved_by = NULL, reserved_until = NULL
    WHERE status = 'reserved' AND reserved_until < now();

    -- 3. Si el usuario ya tiene una reserva activa válida, conservarla
    SELECT slot_number INTO v_slot
    FROM public.launch_promo_slots
    WHERE reserved_by = p_user_id AND status = 'reserved' AND reserved_until >= now()
    LIMIT 1;

    IF v_slot IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true, 
            'slot_number', v_slot, 
            'reserved_until', (SELECT reserved_until FROM public.launch_promo_slots WHERE slot_number = v_slot),
            'message', 'Plaza reservada previamente activa.'
        );
    END IF;

    -- 4. Validar unicidad (RUT, Máquina, Correo, Usuario) contra fraudes previos
    IF EXISTS (SELECT 1 FROM public.promo_redemptions WHERE user_id = p_user_id) THEN
        v_conflict_reason := 'USER_ALREADY_REDEEMED';
    ELSIF EXISTS (SELECT 1 FROM public.promo_redemptions WHERE rut = p_rut) THEN
        v_conflict_reason := 'RUT_ALREADY_USED';
    ELSIF EXISTS (SELECT 1 FROM public.promo_redemptions WHERE email = p_email) THEN
        v_conflict_reason := 'EMAIL_ALREADY_USED';
    ELSIF EXISTS (SELECT 1 FROM public.promo_redemptions WHERE machine_hash = p_machine_hash) THEN
        v_conflict_reason := 'MACHINE_ALREADY_USED';
    END IF;

    IF v_conflict_reason IS NOT NULL THEN
        -- Registrar intento de fraude en auditoría
        INSERT INTO public.fraud_flags (user_id, flag_type, severity, details)
        VALUES (p_user_id, v_conflict_reason, 'HIGH', jsonb_build_object('rut', p_rut, 'machine_hash', p_machine_hash, 'email', p_email));

        RETURN jsonb_build_object(
            'success', false, 
            'code', v_conflict_reason, 
            'message', 'Esta promoción es exclusiva de una sola vez por persona natural y equipo físico.'
        );
    END IF;

    -- 5. Tomar la plaza más baja disponible con bloqueo atómico de fila
    SELECT slot_number INTO v_slot
    FROM public.launch_promo_slots
    WHERE status = 'available'
    ORDER BY slot_number ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_slot IS NULL THEN
        RETURN jsonb_build_object(
            'success', false, 
            'code', 'PROMO_EXHAUSTED', 
            'message', 'Lo sentimos, las 50 plazas de la oferta de lanzamiento ya han sido ocupadas.'
        );
    END IF;

    -- 6. Bloquear la plaza por 30 minutos para el pago
    UPDATE public.launch_promo_slots
    SET status = 'reserved',
        reserved_by = p_user_id,
        reserved_until = now() + INTERVAL '30 minutes'
    WHERE slot_number = v_slot;

    RETURN jsonb_build_object(
        'success', true, 
        'slot_number', v_slot, 
        'reserved_until', (now() + INTERVAL '30 minutes')
    );
END;
$$;

-- C. Consumir Plaza Definitivamente tras Confirmación de Pago (Idempotente)
CREATE OR REPLACE FUNCTION public.consume_promo_slot(
    p_user_id UUID,
    p_payment_id TEXT,
    p_payer_id TEXT,
    p_card_fingerprint TEXT,
    p_plan TEXT,
    p_ip TEXT,
    p_user_agent TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_slot INT;
    v_email TEXT;
    v_rut TEXT;
    v_machine_hash TEXT;
    v_trial_end TIMESTAMPTZ := now() + INTERVAL '7 days';
    v_sub_end TIMESTAMPTZ := now() + INTERVAL '37 days'; -- 7 días gratis + 30 días pagados
BEGIN
    -- 1. Idempotencia: si el webhook ya procesó este payment_id, no hacer nada y devolver éxito
    IF EXISTS (SELECT 1 FROM public.promo_redemptions WHERE payment_id = p_payment_id) THEN
        RETURN jsonb_build_object(
            'success', true, 
            'code', 'ALREADY_PROCESSED', 
            'message', 'Pago ya procesado anteriormente con éxito.'
        );
    END IF;

    -- 2. Detección de tarjeta compartida entre múltiples cuentas
    IF EXISTS (SELECT 1 FROM public.promo_redemptions WHERE card_fingerprint = p_card_fingerprint AND user_id != p_user_id) THEN
        INSERT INTO public.fraud_flags (user_id, flag_type, severity, details)
        VALUES (p_user_id, 'CARD_REUSED_ACROSS_ACCOUNTS', 'HIGH', jsonb_build_object('card_fingerprint', p_card_fingerprint, 'payment_id', p_payment_id));

        RETURN jsonb_build_object(
            'success', false, 
            'code', 'CARD_REUSED', 
            'message', 'Este método de pago ya fue utilizado para canjear la promoción en otra cuenta.'
        );
    END IF;

    -- 3. Obtener la plaza reservada del usuario
    SELECT slot_number INTO v_slot
    FROM public.launch_promo_slots
    WHERE reserved_by = p_user_id AND status = 'reserved'
    FOR UPDATE;

    IF v_slot IS NULL THEN
        -- Si la reserva expiró pero aún hay cupo libre, tomar uno atómicamente
        SELECT slot_number INTO v_slot
        FROM public.launch_promo_slots
        WHERE status = 'available'
        ORDER BY slot_number ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED;

        IF v_slot IS NULL THEN
            RETURN jsonb_build_object(
                'success', false, 
                'code', 'PROMO_EXHAUSTED', 
                'message', 'Pago recibido, pero las 50 plazas se completaron antes de la confirmación.'
            );
        END IF;
    END IF;

    -- 4. Recuperar datos vinculados
    SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
    SELECT rut INTO v_rut FROM public.businesses WHERE user_id = p_user_id LIMIT 1;
    SELECT device_id INTO v_machine_hash FROM public.user_licenses WHERE user_id = p_user_id LIMIT 1;

    -- 5. Marcar plaza como consumida de forma definitiva
    UPDATE public.launch_promo_slots
    SET status = 'consumed',
        payment_id = p_payment_id,
        consumed_at = now()
    WHERE slot_number = v_slot;

    -- 6. Insertar en registro inmutable de ganadores
    INSERT INTO public.promo_redemptions (
        slot_number, user_id, email, rut, machine_hash, card_fingerprint,
        payment_id, plan, discount_percent, trial_ends_at, ip_address, user_agent
    ) VALUES (
        v_slot, p_user_id, v_email, COALESCE(v_rut, 'SIN_RUT'), COALESCE(v_machine_hash, 'WEB_APP'),
        p_card_fingerprint, p_payment_id, p_plan, 20.00, v_trial_end, p_ip, p_user_agent
    );

    -- 7. Actualizar la licencia del usuario en Supabase Cloud con 20% perpetuo y trial
    UPDATE public.user_licenses
    SET plan = p_plan,
        is_trial = true,
        expires_at = v_sub_end,
        updated_at = now()
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
        'success', true, 
        'slot_number', v_slot, 
        'discount_percent', 20.00, 
        'trial_ends_at', v_trial_end, 
        'expires_at', v_sub_end
    );
END;
$$;

-- D. Revocación Inmediata por Devolución / Reembolso / Chargeback
CREATE OR REPLACE FUNCTION public.revoke_promo_slot(
    p_payment_id TEXT,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_slot INT;
BEGIN
    SELECT user_id, slot_number INTO v_user_id, v_slot
    FROM public.promo_redemptions
    WHERE payment_id = p_payment_id;

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Pago no encontrado en promociones.');
    END IF;

    -- Marcar plaza como revocada (no se reasigna a extraños para preservar auditoría contable)
    UPDATE public.launch_promo_slots
    SET status = 'revoked'
    WHERE slot_number = v_slot;

    -- Desactivar licencia del usuario
    UPDATE public.user_licenses
    SET plan = 'REVOKED', expires_at = now()
    WHERE user_id = v_user_id;

    -- Registrar bandera de fraude crítica
    INSERT INTO public.fraud_flags (user_id, flag_type, severity, details)
    VALUES (v_user_id, 'CHARGEBACK_OR_REFUND', 'CRITICAL', jsonb_build_object('payment_id', p_payment_id, 'reason', p_reason));

    RETURN jsonb_build_object('success', true, 'message', 'Promoción y licencia revocadas exitosamente.');
END;
$$;

-- E. Trigger de Baneo Automático: 3 Flags Graves o 1 Crítico = Banned
CREATE OR REPLACE FUNCTION public.check_user_fraud_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_high_flags INT;
BEGIN
    SELECT count(*) INTO v_high_flags
    FROM public.fraud_flags
    WHERE user_id = NEW.user_id AND severity IN ('HIGH', 'CRITICAL');

    IF v_high_flags >= 3 OR NEW.severity = 'CRITICAL' THEN
        -- Baneo a nivel de usuario en auth.users
        UPDATE auth.users
        SET raw_app_meta_data = raw_app_meta_data || '{"banned": true}'::jsonb
        WHERE id = NEW.user_id;

        -- Revocación de licencias
        UPDATE public.user_licenses
        SET plan = 'BANNED', expires_at = now()
        WHERE user_id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_fraud_ban ON public.fraud_flags;
CREATE TRIGGER trg_check_fraud_ban
AFTER INSERT ON public.fraud_flags
FOR EACH ROW EXECUTE FUNCTION public.check_user_fraud_status();

-- =========================================================================================
-- 6. VISTA DASHBOARD EN VIVO PARA EL ADMINISTRADOR / DUEÑO
-- =========================================================================================
CREATE OR REPLACE VIEW public.vw_launch_promo_dashboard AS
SELECT 
    r.slot_number AS "Plaza",
    r.email AS "Correo",
    CONCAT(SUBSTRING(r.rut, 1, 3), '.***.***-', RIGHT(r.rut, 1)) AS "RUT Enmascarado",
    r.plan AS "Plan",
    r.discount_percent AS "% Descuento",
    to_char(r.created_at, 'YYYY-MM-DD HH24:MI') AS "Fecha de Canje",
    to_char(r.trial_ends_at, 'YYYY-MM-DD') AS "Fin de Trial (7 días)",
    r.payment_id AS "ID Pago MP"
FROM public.promo_redemptions r
ORDER BY r.slot_number ASC;
