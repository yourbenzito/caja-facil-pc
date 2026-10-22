-- =========================================================================================
-- CAJA FÁCIL POS — ESQUEMA MAESTRO OFICIAL DE SUPABASE (CLOUD REPLICA & REALTIME)
-- =========================================================================================
-- Documentación y Esquema Unificado generado a partir de la radiografía real de producción.
-- Este archivo es la fuente de verdad definitiva del backend en la nube para agentes de IA,
-- desarrolladores y restauración de base de datos desde cero.
-- 
-- Compatible con: PostgreSQL 15+ / Supabase
-- Tablas activas: 23 tablas con RLS (Row Level Security) y publicación Realtime.
-- Funciones RPC: sync_sale_atomic, adjust_stock_delta, delete_user_account, join_business_by_code.
-- =========================================================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================================================
-- 1. TABLAS PRINCIPALES (CORE & VENTAS)
-- =========================================================================================

-- 1.1 Negocios / Sucursales
CREATE TABLE IF NOT EXISTS public.businesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    local_id TEXT NOT NULL DEFAULT '1',
    name TEXT NOT NULL DEFAULT 'Mi Negocio',
    business_code TEXT,
    join_code TEXT,
    rut TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    address TEXT DEFAULT '',
    currency TEXT DEFAULT '$',
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_businesses_business_code ON public.businesses(business_code);
CREATE INDEX IF NOT EXISTS idx_businesses_join_code ON public.businesses(join_code);

-- 1.2 Ajustes del Negocio (Ticket, Datos Bancarios)
CREATE TABLE IF NOT EXISTS public.business_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    biz_name TEXT,
    biz_rut TEXT,
    biz_phone TEXT,
    biz_address TEXT,
    bank_info JSONB DEFAULT '{}'::jsonb,
    ticket_footer TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1.3 Personal / Cajeros
CREATE TABLE IF NOT EXISTS public.staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    local_id TEXT NOT NULL,
    name TEXT NOT NULL,
    pin TEXT NOT NULL DEFAULT '0000',
    role TEXT NOT NULL DEFAULT 'cashier',
    permissions JSONB DEFAULT '{"posSales":true,"discounts":true,"voidSales":false,"modifyCatalog":false,"purchases":false,"expenses":true,"credits":false,"reportsProfit":false}'::jsonb,
    branch_code TEXT,
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    business_id TEXT DEFAULT '1'
);

-- 1.4 Categorías de Productos
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    local_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#2563eb',
    icon TEXT DEFAULT 'tag',
    is_deleted BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT now(),
    business_id TEXT DEFAULT '1'
);

-- 1.5 Catálogo de Productos
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    local_id TEXT NOT NULL,
    code TEXT,
    name TEXT NOT NULL,
    category TEXT,
    cost_price NUMERIC DEFAULT 0,
    cost_neto NUMERIC DEFAULT 0,
    sale_price NUMERIC DEFAULT 0,
    stock NUMERIC DEFAULT 0,
    min_stock NUMERIC DEFAULT 0,
    max_stock NUMERIC DEFAULT 0,
    type TEXT DEFAULT 'unit',
    additional_taxes_config JSONB DEFAULT '[]'::jsonb,
    expiry_date TEXT,
    is_favorite BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT now(),
    is_deleted BOOLEAN DEFAULT false,
    image TEXT,
    description TEXT,
    business_id TEXT DEFAULT '1',
    uuid TEXT
);

-- 1.6 Clientes y Cuentas Corrientes
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    local_id TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    debt NUMERIC DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now(),
    is_deleted BOOLEAN DEFAULT false,
    rut TEXT,
    address TEXT,
    credit_limit NUMERIC DEFAULT 0,
    business_id TEXT DEFAULT '1',
    balance_credit NUMERIC DEFAULT 0,
    uuid TEXT
);

-- 1.7 Ventas Realizadas (Tickets)
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    local_id TEXT NOT NULL,
    sale_number BIGINT,
    sale_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    subtotal NUMERIC DEFAULT 0,
    tax_amount NUMERIC DEFAULT 0,
    commission_amount NUMERIC DEFAULT 0,
    total NUMERIC NOT NULL DEFAULT 0,
    payment_method TEXT DEFAULT 'EFECTIVO',
    customer_id TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    synced_at TIMESTAMPTZ DEFAULT now(),
    business_id TEXT DEFAULT '1',
    cash_register_id TEXT,
    status TEXT DEFAULT 'completed',
    payment_details JSONB DEFAULT '{}'::jsonb,
    paid_amount NUMERIC DEFAULT 0,
    discount_amount NUMERIC DEFAULT 0,
    paid_at TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT false,
    terminal_id TEXT DEFAULT 'PC-1',
    uuid TEXT
);

-- 1.8 Devoluciones y Notas de Crédito
CREATE TABLE IF NOT EXISTS public.sale_returns (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL,
    local_id BIGINT,
    sale_id BIGINT,
    sale_number BIGINT,
    date TIMESTAMPTZ DEFAULT now(),
    items JSONB DEFAULT '[]'::jsonb,
    total_returned NUMERIC DEFAULT 0,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by BIGINT,
    business_id BIGINT DEFAULT 1
);

-- 1.9 Abonos / Pagos de Deudas de Clientes
CREATE TABLE IF NOT EXISTS public.debt_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    local_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    payment_method TEXT DEFAULT 'cash',
    notes TEXT,
    payment_date TIMESTAMPTZ DEFAULT now(),
    cash_register_id TEXT,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    business_id TEXT DEFAULT '1'
);

-- 1.10 Depósitos a Favor de Clientes (Saldo a Favor)
CREATE TABLE IF NOT EXISTS public.customer_credit_deposits (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL,
    local_id BIGINT,
    customer_id BIGINT,
    amount NUMERIC DEFAULT 0,
    payment_method TEXT DEFAULT 'cash',
    cash_register_id BIGINT,
    date TIMESTAMPTZ DEFAULT now(),
    notes TEXT,
    business_id BIGINT DEFAULT 1
);

-- 1.11 Sesiones de Cobro Masivo de Deudas de Clientes
CREATE TABLE IF NOT EXISTS public.debt_payment_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    local_id TEXT,
    customer_id TEXT NOT NULL,
    date TIMESTAMPTZ NOT NULL DEFAULT now(),
    total_paid NUMERIC DEFAULT 0,
    total_debt NUMERIC DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    methods JSONB DEFAULT '[]'::jsonb,
    sales_data JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    cash_register_id TEXT,
    business_id TEXT DEFAULT '1',
    uuid TEXT,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debt_payment_sessions_user_biz ON public.debt_payment_sessions(user_id, business_id);
CREATE INDEX IF NOT EXISTS idx_debt_payment_sessions_customer ON public.debt_payment_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_debt_payment_sessions_date ON public.debt_payment_sessions(date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_debt_payment_sessions_upsert ON public.debt_payment_sessions (user_id, business_id, local_id);

-- 1.12 Pizarra de Mostrador, Envases Retornables y Encargos (Multicaja y Multinegocio)
CREATE TABLE IF NOT EXISTS public.counter_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    local_id BIGINT,
    business_id TEXT DEFAULT '1',
    category TEXT NOT NULL DEFAULT 'general', -- 'bottle', 'reservation', 'task', 'general'
    text TEXT,
    client_name TEXT,
    client_phone TEXT,
    customer_id TEXT,
    bottle_detail TEXT,
    bottle_count INTEGER DEFAULT 1,
    reservation_detail TEXT,
    reservation_deposit NUMERIC DEFAULT 0,
    due_date TEXT,
    due_time TEXT,
    assigned_to TEXT DEFAULT 'Todos',
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    completed_by TEXT,
    created_by TEXT,
    terminal_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_counter_notes_user_biz ON public.counter_notes(user_id, business_id);
CREATE INDEX IF NOT EXISTS idx_counter_notes_category ON public.counter_notes(category);
CREATE INDEX IF NOT EXISTS idx_counter_notes_is_completed ON public.counter_notes(is_completed);
CREATE UNIQUE INDEX IF NOT EXISTS idx_counter_notes_upsert ON public.counter_notes (user_id, business_id, local_id);

-- =========================================================================================
-- 2. CAJA Y FLUJO DE EFECTIVO
-- =========================================================================================

-- 2.1 Sesiones de Caja / Turnos (Arqueos)
CREATE TABLE IF NOT EXISTS public.cash_registers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    local_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    open_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    close_date TIMESTAMPTZ,
    initial_amount NUMERIC DEFAULT 0,
    final_amount NUMERIC DEFAULT 0,
    expected_amount NUMERIC DEFAULT 0,
    difference NUMERIC DEFAULT 0,
    payment_summary JSONB DEFAULT '{"qr": 0, "card": 0, "cash": 0, "other": 0}'::jsonb,
    opened_by TEXT,
    closed_by TEXT,
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT now(),
    business_id TEXT DEFAULT '1',
    denominations JSONB DEFAULT '{}'::jsonb,
    counted_by_method JSONB DEFAULT '{}'::jsonb,
    is_deleted BOOLEAN DEFAULT false,
    terminal_id TEXT DEFAULT 'PC-1',
    uuid TEXT
);

-- 2.2 Movimientos de Caja (Entradas / Salidas Manuales)
CREATE TABLE IF NOT EXISTS public.cash_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    local_id TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    movement_type TEXT NOT NULL DEFAULT 'in',
    concept TEXT NOT NULL DEFAULT '',
    movement_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by TEXT,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    business_id TEXT DEFAULT '1',
    cash_register_id TEXT,
    reason TEXT,
    terminal_id TEXT DEFAULT 'PC-1',
    uuid TEXT
);

-- 2.3 Gastos Operativos
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    local_id TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    category TEXT DEFAULT 'General',
    description TEXT NOT NULL DEFAULT '',
    document_type TEXT DEFAULT 'comprobante_interno',
    document_number TEXT,
    payment_method TEXT DEFAULT 'cash',
    supplier_id TEXT,
    product_id TEXT,
    product_name TEXT,
    quantity NUMERIC,
    cost_value NUMERIC,
    sale_value NUMERIC,
    expense_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    from_cash BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    business_id TEXT DEFAULT '1',
    terminal_id TEXT DEFAULT 'PC-1',
    uuid TEXT
);

-- =========================================================================================
-- 3. PROVEEDORES Y COMPRAS
-- =========================================================================================

-- 3.1 Proveedores
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    local_id TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    rut TEXT DEFAULT '',
    contact_name TEXT DEFAULT '',
    address TEXT DEFAULT '',
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    business_id TEXT DEFAULT '1',
    uuid TEXT
);

-- 3.2 Compras a Proveedores
CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    local_id TEXT NOT NULL,
    supplier_id TEXT,
    supplier_name TEXT,
    invoice_number TEXT,
    document_type TEXT DEFAULT 'boleta',
    purchase_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    subtotal NUMERIC DEFAULT 0,
    iva_amount NUMERIC DEFAULT 0,
    extra_taxes_amount NUMERIC DEFAULT 0,
    total NUMERIC NOT NULL DEFAULT 0,
    paid_amount NUMERIC DEFAULT 0,
    due_date TIMESTAMPTZ,
    vat_mode TEXT DEFAULT 'net',
    status TEXT DEFAULT 'paid',
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    cancelled_at TIMESTAMPTZ,
    cancel_reason TEXT,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    business_id TEXT DEFAULT '1',
    terminal_id TEXT DEFAULT 'PC-1',
    uuid TEXT
);

-- 3.3 Pagos a Proveedores
CREATE TABLE IF NOT EXISTS public.supplier_payments (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL,
    local_id BIGINT,
    supplier_id BIGINT,
    purchase_id BIGINT,
    amount NUMERIC DEFAULT 0,
    method TEXT DEFAULT 'cash',
    date TIMESTAMPTZ DEFAULT now(),
    reference TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by BIGINT,
    updated_by BIGINT,
    business_id BIGINT DEFAULT 1
);

-- =========================================================================================
-- 4. INVENTARIO, KÁRDEX Y AUDITORÍA
-- =========================================================================================

-- 4.1 Movimientos de Stock (Kárdex / Ajustes / Mermas)
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    product_id BIGINT,
    product_code VARCHAR,
    product_name VARCHAR,
    type VARCHAR NOT NULL,
    quantity NUMERIC NOT NULL,
    reference VARCHAR,
    reason VARCHAR,
    notes TEXT,
    cost_value NUMERIC DEFAULT 0,
    sale_value NUMERIC DEFAULT 0,
    date TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    business_id TEXT DEFAULT '1',
    is_deleted BOOLEAN DEFAULT false,
    local_id TEXT,
    movement_date TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'completed',
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT DEFAULT '',
    cancelled_by TEXT DEFAULT '',
    cancel_reason TEXT
);

-- 4.2 Historial de Precios de Venta
CREATE TABLE IF NOT EXISTS public.product_price_history (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL,
    local_id BIGINT,
    product_id BIGINT,
    old_price NUMERIC DEFAULT 0,
    new_price NUMERIC DEFAULT 0,
    date TIMESTAMPTZ DEFAULT now(),
    caja_user_id BIGINT,
    business_id BIGINT DEFAULT 1
);

-- 4.3 Historial de Costos de Compra
CREATE TABLE IF NOT EXISTS public.product_cost_history (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL,
    local_id BIGINT,
    product_id BIGINT,
    old_cost NUMERIC DEFAULT 0,
    new_cost NUMERIC DEFAULT 0,
    reason TEXT,
    reference_id BIGINT,
    current_price NUMERIC DEFAULT 0,
    date TIMESTAMPTZ DEFAULT now(),
    business_id BIGINT DEFAULT 1
);

-- 4.4 Registro de Auditoría de Acciones
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL,
    local_id BIGINT,
    entity TEXT,
    entity_id BIGINT,
    action TEXT,
    summary TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ DEFAULT now(),
    caja_user_id BIGINT,
    username TEXT,
    business_id BIGINT DEFAULT 1
);

-- =========================================================================================
-- 5. LICENCIAS Y PLANES
-- =========================================================================================

-- 5.1 Catálogo Global de Licencias
CREATE TABLE IF NOT EXISTS public.licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'PRO',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    device_id TEXT,
    activated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5.2 Licencias Asignadas por Usuario
CREATE TABLE IF NOT EXISTS public.user_licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    email TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'FREE',
    is_trial BOOLEAN DEFAULT false,
    activated_code TEXT,
    activated_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ,
    device_id TEXT,
    is_owner BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =========================================================================================
-- 6. SEGURIDAD DE FILA (ROW LEVEL SECURITY - RLS)
-- =========================================================================================

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_credit_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_cost_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_payment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counter_notes ENABLE ROW LEVEL SECURITY;

-- Políticas de aislamiento por usuario autenticado (auth.uid() = user_id)
DO $$
BEGIN
    -- Negocios y configuración
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso a Negocios Propios') THEN
        CREATE POLICY "Acceso a Negocios Propios" ON public.businesses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso a Ajustes Propios') THEN
        CREATE POLICY "Acceso a Ajustes Propios" ON public.business_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso a Personal Propio') THEN
        CREATE POLICY "Acceso a Personal Propio" ON public.staff FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso a Categorias Propias') THEN
        CREATE POLICY "Acceso a Categorias Propias" ON public.categories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso a Productos Propios') THEN
        CREATE POLICY "Acceso a Productos Propios" ON public.products FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso a Clientes Propios') THEN
        CREATE POLICY "Acceso a Clientes Propios" ON public.customers FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso a Ventas Propias') THEN
        CREATE POLICY "Acceso a Ventas Propias" ON public.sales FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'sale_returns_user_policy') THEN
        CREATE POLICY "sale_returns_user_policy" ON public.sale_returns FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso a Abonos Propios') THEN
        CREATE POLICY "Acceso a Abonos Propios" ON public.debt_payments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'debt_payment_sessions_user_policy') THEN
        CREATE POLICY "debt_payment_sessions_user_policy" ON public.debt_payment_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'counter_notes_user_policy') THEN
        CREATE POLICY "counter_notes_user_policy" ON public.counter_notes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'customer_credit_deposits_user_policy') THEN
        CREATE POLICY "customer_credit_deposits_user_policy" ON public.customer_credit_deposits FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso a Cajas Propias') THEN
        CREATE POLICY "Acceso a Cajas Propias" ON public.cash_registers FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso a Movimientos Caja Propios') THEN
        CREATE POLICY "Acceso a Movimientos Caja Propios" ON public.cash_movements FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso a Gastos Propios') THEN
        CREATE POLICY "Acceso a Gastos Propios" ON public.expenses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso a Proveedores Propios') THEN
        CREATE POLICY "Acceso a Proveedores Propios" ON public.suppliers FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso a Compras Propias') THEN
        CREATE POLICY "Acceso a Compras Propias" ON public.purchases FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'supplier_payments_user_policy') THEN
        CREATE POLICY "supplier_payments_user_policy" ON public.supplier_payments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso a Movimientos Stock Propios') THEN
        CREATE POLICY "Acceso a Movimientos Stock Propios" ON public.stock_movements FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'product_price_history_user_policy') THEN
        CREATE POLICY "product_price_history_user_policy" ON public.product_price_history FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'product_cost_history_user_policy') THEN
        CREATE POLICY "product_cost_history_user_policy" ON public.product_cost_history FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'audit_logs_user_policy') THEN
        CREATE POLICY "audit_logs_user_policy" ON public.audit_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso a Licencia Propia') THEN
        CREATE POLICY "Acceso a Licencia Propia" ON public.user_licenses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir lectura de licencias') THEN
        CREATE POLICY "Permitir lectura de licencias" ON public.licenses FOR SELECT USING (true);
    END IF;
END $$;

-- =========================================================================================
-- 7. FUNCIONES ALMACENADAS RPC (OPERACIONES ATÓMICAS)
-- =========================================================================================

-- 7.1 sync_sale_atomic: Guarda la venta y descuenta stock en una sola transacción atómica
CREATE OR REPLACE FUNCTION public.sync_sale_atomic(
    p_user_id UUID,
    p_local_id TEXT,
    p_sale_date TIMESTAMPTZ,
    p_total NUMERIC,
    p_payment_method TEXT,
    p_customer_id TEXT,
    p_items JSONB,
    p_business_id TEXT DEFAULT '1'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_item JSONB;
    v_item_code TEXT;
    v_item_prod_id TEXT;
    v_qty NUMERIC;
    v_existing_sale_id UUID;
    v_target_prod_id UUID;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'No autorizado para este negocio');
    END IF;

    -- Idempotencia: evitar duplicar ventas
    SELECT id INTO v_existing_sale_id
    FROM public.sales
    WHERE user_id = p_user_id AND local_id = p_local_id;

    IF v_existing_sale_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'status', 'already_exists', 'sale_id', v_existing_sale_id);
    END IF;

    -- Insertar venta
    INSERT INTO public.sales (
        user_id, local_id, sale_date, total, payment_method, customer_id, items, synced_at, business_id
    ) VALUES (
        p_user_id, p_local_id, COALESCE(p_sale_date, NOW()), COALESCE(p_total, 0),
        COALESCE(p_payment_method, 'EFECTIVO'), p_customer_id, COALESCE(p_items, '[]'::jsonb), NOW(), p_business_id
    )
    RETURNING id INTO v_existing_sale_id;

    -- Descontar inventario relativo de productos
    IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            v_qty := COALESCE((v_item->>'quantity')::numeric, (v_item->>'qty')::numeric, 0);
            v_item_code := TRIM(COALESCE(v_item->>'barcode', v_item->>'code', ''));
            v_item_prod_id := TRIM(COALESCE(v_item->>'productId', v_item->>'id', ''));

            IF v_qty > 0 THEN
                v_target_prod_id := NULL;
                IF v_item_prod_id <> '' THEN
                    SELECT id INTO v_target_prod_id
                    FROM public.products
                    WHERE user_id = p_user_id AND local_id = v_item_prod_id AND is_deleted = false
                    LIMIT 1;
                END IF;

                IF v_target_prod_id IS NULL AND v_item_code <> '' THEN
                    SELECT id INTO v_target_prod_id
                    FROM public.products
                    WHERE user_id = p_user_id AND code = v_item_code AND is_deleted = false
                    LIMIT 1;
                END IF;

                IF v_target_prod_id IS NOT NULL THEN
                    UPDATE public.products
                    SET stock = GREATEST(0, stock - v_qty),
                        updated_at = NOW()
                    WHERE id = v_target_prod_id;
                END IF;
            END IF;
        END LOOP;
    END IF;

    RETURN jsonb_build_object('success', true, 'status', 'created', 'sale_id', v_existing_sale_id);
END;
$$;

-- 7.2 adjust_stock_delta: Suma o resta stock relativo evitando carreras de concurrencia
CREATE OR REPLACE FUNCTION public.adjust_stock_delta(
    p_user_id UUID,
    p_local_id TEXT,
    p_delta NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_new_stock NUMERIC;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'No autorizado');
    END IF;

    UPDATE public.products
    SET stock = GREATEST(0, stock + p_delta),
        updated_at = NOW()
    WHERE user_id = p_user_id AND local_id = p_local_id
    RETURNING stock INTO v_new_stock;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Producto no encontrado');
    END IF;

    RETURN jsonb_build_object('success', true, 'new_stock', v_new_stock);
END;
$$;

-- 7.3 delete_user_account: Permite al usuario eliminar su propia cuenta de forma segura
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No hay sesión autenticada activa');
    END IF;

    DELETE FROM auth.users WHERE id = v_user_id;
    RETURN jsonb_build_object('success', true, 'message', 'Cuenta eliminada exitosamente');
END;
$$;

REVOKE ALL ON FUNCTION public.sync_sale_atomic(UUID, TEXT, TIMESTAMPTZ, NUMERIC, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_sale_atomic(UUID, TEXT, TIMESTAMPTZ, NUMERIC, TEXT, TEXT, JSONB, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.adjust_stock_delta(UUID, TEXT, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_stock_delta(UUID, TEXT, NUMERIC) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_user_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

-- 7.4 join_business_by_code: Permite vincular una caja o sucursal por código
CREATE OR REPLACE FUNCTION public.join_business_by_code(p_join_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_code TEXT;
    v_biz RECORD;
    v_staff JSONB;
BEGIN
    v_clean_code := UPPER(TRIM(COALESCE(p_join_code, '')));

    IF v_clean_code = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'El código no puede estar vacío');
    END IF;

    -- 1. Buscar negocio activo que coincida con el join_code o business_code
    SELECT * INTO v_biz
    FROM public.businesses
    WHERE (UPPER(join_code) = v_clean_code OR UPPER(business_code) = v_clean_code)
      AND is_active = true
      AND is_deleted = false
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_biz.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Código de negocio no encontrado o inactivo');
    END IF;

    -- 2. Obtener personal / cajeros autorizados para esa sucursal
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', s.id,
            'name', s.name,
            'pin', s.pin,
            'role', s.role,
            'permissions', s.permissions,
            'branch_code', s.branch_code
        )
    ) INTO v_staff
    FROM public.staff s
    WHERE s.user_id = v_biz.user_id
      AND s.is_active = true
      AND s.is_deleted = false;

    -- 3. Retornar información para configurar la caja local
    RETURN jsonb_build_object(
        'success', true,
        'business_id', COALESCE(v_biz.local_id, '1'),
        'business_name', v_biz.name,
        'currency', COALESCE(v_biz.currency, '$'),
        'staff', COALESCE(v_staff, '[]'::jsonb)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_business_by_code(TEXT) TO authenticated, anon;

-- =========================================================================================
-- 8. PUBLICACIÓN SUPABASE REALTIME (22 TABLAS MULTI-TERMINAL ACTIVAS)
-- =========================================================================================

-- Publicación Supabase Realtime Blindada y Optimizada (Solo 4 tablas esenciales para evitar agotar cuota)
DO $
DECLARE
    tbl text;
    tbls text[] := ARRAY['sales', 'products', 'customers', 'cash_registers'];
BEGIN
    -- Vaciar tablas no esenciales
    ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS 
        public.audit_logs, public.business_settings, public.businesses, public.cash_movements,
        public.categories, public.customer_credit_deposits, public.debt_payments, public.expenses,
        public.licenses, public.product_cost_history, public.product_price_history, public.purchases,
        public.sale_returns, public.staff, public.stock_movements, public.supplier_payments,
        public.suppliers, public.user_licenses;

    -- Agregar únicamente las 4 tablas esenciales
    FOREACH tbl IN ARRAY tbls LOOP
        BEGIN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
        EXCEPTION WHEN duplicate_object THEN
            NULL;
        END;
    END LOOP;
END $;
