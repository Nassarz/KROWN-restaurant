-- ============================================================================
-- SUPABASE POSTGRESQL SCHEMA WITH STRICT FOREIGN KEYS & REALTIME
-- Migration Script: 20260801_schema_foreign_keys_realtime.sql
-- ============================================================================

-- 1. BRANCHES TABLE
CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  city TEXT DEFAULT 'Kampala',
  manager TEXT,
  phone TEXT,
  email TEXT,
  tax_id TEXT,
  address TEXT,
  receipt_header_note TEXT,
  receipt_footer_note TEXT,
  tables_count INT DEFAULT 20,
  daily_revenue_ugx NUMERIC DEFAULT 0,
  orders_today INT DEFAULT 0,
  status TEXT DEFAULT 'online',
  created_at BIGINT DEFAULT extract(epoch from now()) * 1000
);

-- 2. STAFF TABLE
CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT,
  pin TEXT DEFAULT '1234',
  phone TEXT,
  id_type TEXT,
  id_number TEXT,
  role TEXT NOT NULL DEFAULT 'Senior Waiter',
  branch TEXT DEFAULT 'Global HQ',
  assigned_branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL ON UPDATE CASCADE,
  status TEXT DEFAULT 'active',
  avatar TEXT,
  created_at BIGINT DEFAULT extract(epoch from now()) * 1000
);

-- 3. COMPANIES TABLE (CORPORATE CREDIT ACCOUNTS)
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tax_id TEXT,
  credit_limit_ugx NUMERIC DEFAULT 10000000,
  current_balance_ugx NUMERIC DEFAULT 0,
  contact_person TEXT,
  phone TEXT,
  status TEXT DEFAULT 'active',
  created_at BIGINT DEFAULT extract(epoch from now()) * 1000
);

-- 4. COMPANY STAFF TABLE
CREATE TABLE IF NOT EXISTS company_staff (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE ON UPDATE CASCADE,
  name TEXT NOT NULL,
  work_id TEXT NOT NULL,
  department TEXT,
  phone TEXT,
  allowance_limit_ugx NUMERIC DEFAULT 500000,
  status TEXT DEFAULT 'active',
  created_at BIGINT DEFAULT extract(epoch from now()) * 1000
);

-- 5. ZONES & SEATING PLACES TABLE
CREATE TABLE IF NOT EXISTS zones (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '🍽️',
  tables JSONB DEFAULT '[]'::jsonb,
  branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE ON UPDATE CASCADE,
  branch_name TEXT,
  created_at BIGINT DEFAULT extract(epoch from now()) * 1000
);

-- 6. PRODUCTS MENU TABLE
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  category TEXT DEFAULT 'mains',
  image TEXT,
  available BOOLEAN DEFAULT true,
  requires_kitchen BOOLEAN DEFAULT true,
  branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL ON UPDATE CASCADE,
  branch_name TEXT,
  created_at BIGINT DEFAULT extract(epoch from now()) * 1000
);

-- 7. INVENTORY INGREDIENTS TABLE
CREATE TABLE IF NOT EXISTS ingredients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'Units',
  min_threshold NUMERIC DEFAULT 5,
  category TEXT DEFAULT 'Pantry',
  cost_per_unit_ugx NUMERIC DEFAULT 15000,
  supplier TEXT,
  branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE ON UPDATE CASCADE,
  branch_name TEXT,
  created_at BIGINT DEFAULT extract(epoch from now()) * 1000
);

-- 8. ORDERS TABLE WITH STRICT FOREIGN KEYS
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  table_number TEXT NOT NULL,
  place TEXT DEFAULT 'Main Dining',
  seat TEXT DEFAULT 'Whole Table',
  type TEXT DEFAULT 'Dine In',
  status TEXT DEFAULT 'pending',
  payment_status TEXT DEFAULT 'unpaid',
  paid_amount NUMERIC DEFAULT 0,
  split_payments JSONB DEFAULT '[]'::jsonb,
  items JSONB DEFAULT '[]'::jsonb,
  subtotal NUMERIC NOT NULL,
  tax NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  payment_method TEXT DEFAULT 'Cash',
  is_corporate_credit BOOLEAN DEFAULT false,
  company_id TEXT REFERENCES companies(id) ON DELETE SET NULL ON UPDATE CASCADE,
  company_name TEXT,
  company_staff_id TEXT REFERENCES company_staff(id) ON DELETE SET NULL ON UPDATE CASCADE,
  company_staff_name TEXT,
  work_id TEXT,
  prep_estimated_minutes INT DEFAULT 15,
  prep_started_at BIGINT,
  restaurant_id TEXT REFERENCES branches(id) ON DELETE CASCADE ON UPDATE CASCADE,
  branch_name TEXT,
  user_id TEXT REFERENCES staff(id) ON DELETE SET NULL ON UPDATE CASCADE,
  created_at BIGINT DEFAULT extract(epoch from now()) * 1000,
  updated_at BIGINT DEFAULT extract(epoch from now()) * 1000
);

-- 9. EXPENSES TABLE
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE ON UPDATE CASCADE,
  branch_name TEXT,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  amount_ugx NUMERIC NOT NULL,
  vat_amount_ugx NUMERIC DEFAULT 0,
  receipt_url TEXT,
  notes TEXT,
  created_at BIGINT DEFAULT extract(epoch from now()) * 1000
);

-- 10. ENABLE SUPABASE REALTIME PUBLICATION FOR ALL TABLES
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE 
    branches, staff, companies, company_staff, zones, products, ingredients, orders, expenses;
COMMIT;

-- ============================================================================
-- END OF POSTGRESQL FOREIGN KEYS & REALTIME MIGRATION
-- ============================================================================
