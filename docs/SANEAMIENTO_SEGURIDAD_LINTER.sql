-- =========================================================================================
-- CAJA FÁCIL POS — SANEAMIENTO Y BLINDAJE DE SEGURIDAD (SUPABASE LINTER 0 ERRORES)
-- =========================================================================================
-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase.
-- Resuelve todas las advertencias (WARN) de:
-- 1. function_search_path_mutable (Lint 0011)
-- 2. anon_security_definer_function_executable (Lint 0028)
-- 3. authenticated_security_definer_function_executable (Lint 0029)
-- =========================================================================================

-- -----------------------------------------------------------------------------------------
-- PARTE 1: FIJAR SEARCH_PATH ESTRICTO EN TODAS LAS FUNCIONES (LINT 0011)
-- -----------------------------------------------------------------------------------------
-- Previene que atacantes manipulen esquemas temporales para secuestro de ejecución.
ALTER FUNCTION public.generate_unique_join_code() SET search_path = public;
ALTER FUNCTION public.trg_assign_join_code() SET search_path = public;
ALTER FUNCTION public.get_public_promo_stats() SET search_path = public;
ALTER FUNCTION public.reserve_promo_slot(UUID, TEXT, TEXT, TEXT) SET search_path = public;
ALTER FUNCTION public.consume_promo_slot(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) SET search_path = public;
ALTER FUNCTION public.check_user_fraud_status() SET search_path = public;
ALTER FUNCTION public.revoke_promo_slot(TEXT, TEXT) SET search_path = public;
ALTER FUNCTION public.check_is_business_owner(UUID, UUID) SET search_path = public;
ALTER FUNCTION public.join_business_by_code(TEXT) SET search_path = public;
ALTER FUNCTION public.delete_user_account() SET search_path = public, auth;

-- -----------------------------------------------------------------------------------------
-- PARTE 2: BLINDAJE DE FUNCIONES CRÍTICAS (LINT 0028 Y 0029)
-- -----------------------------------------------------------------------------------------
-- Las funciones de dinero, pagos, reservas y promociones solo pueden ser ejecutadas
-- por el backend oficial usando la clave service_role. Nadie desde internet (anon o authenticated)
-- podrá invocarlas directamente por la API REST de Supabase.

-- A. Consumo de plaza de lanzamiento
REVOKE ALL ON FUNCTION public.consume_promo_slot(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_promo_slot(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- B. Revocación de plaza por reembolso/chargeback
REVOKE ALL ON FUNCTION public.revoke_promo_slot(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_promo_slot(TEXT, TEXT) TO service_role;

-- C. Reserva atómica de plaza
REVOKE ALL ON FUNCTION public.reserve_promo_slot(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_promo_slot(UUID, TEXT, TEXT, TEXT) TO service_role;

-- D. Estadísticas públicas de la promoción (nuestro servidor local las consulta internamente)
REVOKE ALL ON FUNCTION public.get_public_promo_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_promo_stats() TO service_role;

-- E. Eliminación de cuenta
REVOKE ALL ON FUNCTION public.delete_user_account() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO service_role;

-- F. Funciones auxiliares de negocio (exclusivas para service_role del backend)
REVOKE ALL ON FUNCTION public.check_is_business_owner(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_is_business_owner(UUID, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.join_business_by_code(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_business_by_code(TEXT) TO service_role;

-- -----------------------------------------------------------------------------------------
-- PARTE 3: VISTA SEGURA CON INVOCACIÓN DE PERMISOS DE USUARIO
-- -----------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_launch_promo_dashboard
WITH (security_invoker = true)
AS
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

-- Mensaje de confirmación en la consola SQL de Supabase
DO $$
BEGIN
    RAISE NOTICE '✅ SANEAMIENTO COMPLETADO: search_path fijado y funciones blindadas con service_role exitosamente.';
END $$;
