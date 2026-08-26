-- ── SUPABASE SCHEMAS & PERMISSIVE RLS MIGRATION ────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. BRANCHES TABLE
CREATE TABLE IF NOT EXISTS public.branches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    city TEXT DEFAULT 'Kampala',
    manager TEXT DEFAULT 'Branch Manager',
    phone TEXT DEFAULT '+256 700 000 000',
    email TEXT DEFAULT 'info@krownpos.com',
    tax_id TEXT DEFAULT 'URA-100293481',
    address TEXT,
    receipt_header_note TEXT,
    receipt_footer_note TEXT,
    tables_count INT DEFAULT 20,
    daily_revenue_ugx BIGINT DEFAULT 0,
    orders_today INT DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at BIGINT DEFAULT extract(epoch from now()) * 1000
);

-- 2. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    category TEXT,
    image TEXT,
    available BOOLEAN DEFAULT true,
    requires_kitchen BOOLEAN DEFAULT true,
    branch_id TEXT,
    branch_name TEXT,
    created_at BIGINT DEFAULT extract(epoch from now()) * 1000
);

-- 3. INGREDIENTS TABLE
CREATE TABLE IF NOT EXISTS public.ingredients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    stock_qty NUMERIC DEFAULT 0,
    unit TEXT,
    min_threshold NUMERIC DEFAULT 0,
    cost_per_unit_ugx NUMERIC DEFAULT 0,
    supplier TEXT,
    last_restocked BIGINT,
    status TEXT DEFAULT 'In Stock',
    branch_id TEXT,
    branch_name TEXT,
    created_at BIGINT DEFAULT extract(epoch from now()) * 1000
);

-- 4. ZONES TABLE
CREATE TABLE IF NOT EXISTS public.zones (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    description TEXT,
    branch_id TEXT,
    branch_name TEXT,
    tables JSONB DEFAULT '[]'::jsonb,
    created_at BIGINT DEFAULT extract(epoch from now()) * 1000
);

-- 5. COMPANIES TABLE
CREATE TABLE IF NOT EXISTS public.companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tax_id TEXT DEFAULT 'URA-000000',
    credit_limit_ugx BIGINT DEFAULT 10000000,
    current_balance_ugx BIGINT DEFAULT 0,
    status TEXT DEFAULT 'active',
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    created_at BIGINT DEFAULT extract(epoch from now()) * 1000
);

-- 6. COMPANY STAFF TABLE
CREATE TABLE IF NOT EXISTS public.company_staff (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    name TEXT NOT NULL,
    work_id TEXT,
    department TEXT,
    email TEXT,
    phone TEXT,
    status TEXT DEFAULT 'active',
    created_at BIGINT DEFAULT extract(epoch from now()) * 1000
);

-- 7. STAFF TABLE
CREATE TABLE IF NOT EXISTS public.staff (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    id_type TEXT,
    id_number TEXT,
    role TEXT DEFAULT 'Senior Waiter',
    branch TEXT DEFAULT 'Global HQ',
    assigned_branch_id TEXT,
    pin TEXT DEFAULT '1234',
    status TEXT DEFAULT 'active',
    avatar TEXT,
    created_at BIGINT DEFAULT extract(epoch from now()) * 1000
);

-- 8. ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    table_number TEXT,
    place TEXT,
    seat TEXT,
    type TEXT DEFAULT 'Dine In',
    status TEXT DEFAULT 'pending',
    payment_status TEXT DEFAULT 'unpaid',
    paid_amount BIGINT DEFAULT 0,
    split_payments JSONB DEFAULT '[]'::jsonb,
    items JSONB DEFAULT '[]'::jsonb,
    subtotal BIGINT DEFAULT 0,
    tax BIGINT DEFAULT 0,
    total BIGINT DEFAULT 0,
    payment_method TEXT,
    is_corporate_credit BOOLEAN DEFAULT false,
    company_id TEXT,
    company_name TEXT,
    company_staff_id TEXT,
    company_staff_name TEXT,
    work_id TEXT,
    prep_estimated_minutes INT DEFAULT 15,
    prep_started_at BIGINT,
    restaurant_id TEXT,
    branch_name TEXT,
    user_id TEXT,
    created_at BIGINT DEFAULT extract(epoch from now()) * 1000,
    updated_at BIGINT
);

-- 9. EXPENSES TABLE
CREATE TABLE IF NOT EXISTS public.expenses (
    id TEXT PRIMARY KEY,
    branch_id TEXT,
    branch_name TEXT,
    title TEXT NOT NULL,
    category TEXT,
    amount_ugx BIGINT NOT NULL,
    vat_amount_ugx BIGINT DEFAULT 0,
    receipt_url TEXT,
    notes TEXT,
    created_at BIGINT DEFAULT extract(epoch from now()) * 1000
);

-- 10. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    timestamp BIGINT DEFAULT extract(epoch from now()) * 1000,
    actor TEXT,
    action TEXT,
    details JSONB,
    ip TEXT,
    created_at BIGINT DEFAULT extract(epoch from now()) * 1000
);

-- 11. STAFF PIN LOCKOUTS TABLE
CREATE TABLE IF NOT EXISTS public.staff_pin_lockouts (
    staff_id TEXT PRIMARY KEY,
    failed_attempts INT DEFAULT 0,
    locked_until BIGINT DEFAULT 0
);

-- ENABLE ROW LEVEL SECURITY AND CREATE PERMISSIVE POLICIES FOR ALL TABLES
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY['branches', 'products', 'ingredients', 'zones', 'companies', 'company_staff', 'staff', 'orders', 'expenses', 'audit_logs', 'staff_pin_lockouts'])
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
        EXECUTE format('DROP POLICY IF EXISTS "Allow full access to all users" ON public.%I;', t);
        EXECUTE format('CREATE POLICY "Allow full access to all users" ON public.%I FOR ALL USING (true) WITH CHECK (true);', t);
    END LOOP;
END $$;

-- VERIFY STAFF PIN RPC FUNCTION WITH RATE LIMITING
CREATE OR REPLACE FUNCTION verify_staff_pin(
  staff_id TEXT,
  pin_attempt TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stored_pin TEXT;
  v_attempts INT := 0;
  v_locked_until BIGINT := 0;
  v_now BIGINT := (extract(epoch from now()) * 1000)::BIGINT;
BEGIN
  SELECT failed_attempts, locked_until 
    INTO v_attempts, v_locked_until
    FROM public.staff_pin_lockouts
   WHERE public.staff_pin_lockouts.staff_id = verify_staff_pin.staff_id;

  IF v_locked_until > v_now THEN
    RAISE EXCEPTION 'Account temporarily locked due to failed PIN attempts. Try again in 60 seconds.';
  END IF;

  SELECT pin INTO v_stored_pin
    FROM public.staff
   WHERE id = verify_staff_pin.staff_id;

  IF v_stored_pin IS NULL OR v_stored_pin <> pin_attempt THEN
    v_attempts := v_attempts + 1;
    IF v_attempts >= 5 THEN
      v_locked_until := v_now + 60000;
    END IF;

    INSERT INTO public.staff_pin_lockouts (staff_id, failed_attempts, locked_until)
    VALUES (verify_staff_pin.staff_id, v_attempts, v_locked_until)
    ON CONFLICT (staff_id) DO UPDATE
      SET failed_attempts = EXCLUDED.failed_attempts,
          locked_until = EXCLUDED.locked_until;

    RETURN FALSE;
  ELSE
    DELETE FROM public.staff_pin_lockouts WHERE public.staff_pin_lockouts.staff_id = verify_staff_pin.staff_id;
    RETURN TRUE;
  END IF;
END;
$$;
