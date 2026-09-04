-- KROWN RESTAURANT POS - Neon Database Schema
-- Fresh design for Neon PostgreSQL

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- BRANCHES
-- =============================================
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  city VARCHAR(255),
  manager VARCHAR(255),
  manager_name VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  tax_id VARCHAR(100),
  address TEXT,
  receipt_header_note TEXT,
  receipt_footer_note TEXT,
  tables_count INTEGER DEFAULT 0,
  daily_revenue_ugx NUMERIC(15,2) DEFAULT 0,
  orders_today INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- STAFF
-- =============================================
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(50),
  id_type VARCHAR(50),
  id_number VARCHAR(100),
  role VARCHAR(50) NOT NULL DEFAULT 'waiter',
  branch VARCHAR(255),
  assigned_branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'active',
  avatar TEXT,
  pin_code VARCHAR(10),
  password_hash VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CATEGORIES (menu categories)
-- =============================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  icon VARCHAR(50),
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PRODUCTS (menu items)
-- =============================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  category VARCHAR(255),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  image TEXT,
  available BOOLEAN DEFAULT true,
  requires_kitchen BOOLEAN DEFAULT false,
  description TEXT,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  branch_name VARCHAR(255),
  linked_ingredient_id UUID,
  deduct_from_inventory BOOLEAN DEFAULT false,
  inventory_deduct_amount NUMERIC(10,2) DEFAULT 0,
  add_ons JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INGREDIENTS
-- =============================================
CREATE TABLE IF NOT EXISTS ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  quantity NUMERIC(12,2) DEFAULT 0,
  unit VARCHAR(50) DEFAULT 'kg',
  min_threshold NUMERIC(12,2) DEFAULT 0,
  category VARCHAR(255),
  cost_per_unit_ugx NUMERIC(12,2) DEFAULT 0,
  supplier VARCHAR(255),
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  branch_name VARCHAR(255),
  deduct_from_sales BOOLEAN DEFAULT false,
  linked_product_id UUID,
  deduct_amount_per_sale NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PRODUCT_INGREDIENTS (recipe mapping)
-- =============================================
CREATE TABLE IF NOT EXISTS product_ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity_per_unit NUMERIC(10,2) DEFAULT 0,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ZONES (table management)
-- =============================================
CREATE TABLE IF NOT EXISTS zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  icon VARCHAR(50),
  description TEXT,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  branch_name VARCHAR(255),
  tables JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ORDERS
-- =============================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_number VARCHAR(50),
  place VARCHAR(255),
  seat VARCHAR(50),
  type VARCHAR(20) DEFAULT 'dine_in',
  status VARCHAR(20) DEFAULT 'pending',
  payment_status VARCHAR(20) DEFAULT 'unpaid',
  paid_amount NUMERIC(12,2) DEFAULT 0,
  split_payments JSONB DEFAULT '[]'::jsonb,
  items JSONB DEFAULT '[]'::jsonb,
  subtotal NUMERIC(12,2) DEFAULT 0,
  tax NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  payment_method VARCHAR(50),
  is_corporate_credit BOOLEAN DEFAULT false,
  company_id UUID,
  company_name VARCHAR(255),
  company_staff_id UUID,
  company_staff_name VARCHAR(255),
  work_id VARCHAR(100),
  prep_estimated_minutes INTEGER,
  prep_started_at TIMESTAMPTZ,
  restaurant_id UUID,
  branch_name VARCHAR(255),
  user_id UUID,
  tin_number VARCHAR(100),
  notes TEXT,
  amount_received NUMERIC(12,2) DEFAULT 0,
  change_amount NUMERIC(12,2) DEFAULT 0,
  synced BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- COMPANIES (corporate accounts)
-- =============================================
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  tax_id VARCHAR(100),
  credit_limit_ugx NUMERIC(15,2) DEFAULT 0,
  current_balance_ugx NUMERIC(15,2) DEFAULT 0,
  contact_person VARCHAR(255),
  phone VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active',
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  branch_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- COMPANY_STAFF
-- =============================================
CREATE TABLE IF NOT EXISTS company_staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  work_id VARCHAR(100),
  email VARCHAR(255),
  department VARCHAR(255),
  credit_limit_ugx NUMERIC(15,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- EXPENSES
-- =============================================
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  branch_name VARCHAR(255),
  title VARCHAR(255) NOT NULL,
  category VARCHAR(255),
  amount_ugx NUMERIC(12,2) DEFAULT 0,
  vat_amount_ugx NUMERIC(12,2) DEFAULT 0,
  receipt_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INVENTORY_MOVEMENTS
-- =============================================
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ingredient_id UUID NOT NULL,
  ingredient_name VARCHAR(255),
  type VARCHAR(50),
  quantity_change NUMERIC(12,2),
  quantity_before NUMERIC(12,2),
  quantity_after NUMERIC(12,2),
  order_id UUID,
  product_name VARCHAR(255),
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  branch_name VARCHAR(255),
  performed_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- AUDIT_LOGS
-- =============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email VARCHAR(255),
  action VARCHAR(255) NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address VARCHAR(50),
  staff_id UUID,
  user_id UUID,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  branch_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PRINT_JOBS
-- =============================================
CREATE TABLE IF NOT EXISTS print_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID,
  type VARCHAR(50),
  destination VARCHAR(255),
  printer_id VARCHAR(100),
  payload JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(20) DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  printed_at TIMESTAMPTZ,
  branch_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ACCOUNTING_LEDGER
-- =============================================
CREATE TABLE IF NOT EXISTS accounting_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID,
  restaurant_id UUID,
  type VARCHAR(50),
  amount NUMERIC(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- SESSIONS (auth)
-- =============================================
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- STAFF_PIN_LOCKOUTS
-- =============================================
CREATE TABLE IF NOT EXISTS staff_pin_lockouts (
  staff_id UUID PRIMARY KEY REFERENCES staff(id) ON DELETE CASCADE,
  failed_attempts INTEGER DEFAULT 0,
  locked_until BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_branch ON products(branch_id);
CREATE INDEX IF NOT EXISTS idx_products_available ON products(available);
CREATE INDEX IF NOT EXISTS idx_ingredients_branch ON ingredients(branch_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_category ON ingredients(category);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders(branch_name);
CREATE INDEX IF NOT EXISTS idx_staff_role ON staff(role);
CREATE INDEX IF NOT EXISTS idx_staff_branch ON staff(assigned_branch_id);
CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);
CREATE INDEX IF NOT EXISTS idx_staff_pin ON staff(pin_code);
CREATE INDEX IF NOT EXISTS idx_zones_branch ON zones(branch_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_created ON expenses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_ingredient ON inventory_movements(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created ON inventory_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status);
CREATE INDEX IF NOT EXISTS idx_print_jobs_order ON print_jobs(order_id);
CREATE INDEX IF NOT EXISTS idx_product_ingredients_product ON product_ingredients(product_id);
CREATE INDEX IF NOT EXISTS idx_product_ingredients_ingredient ON product_ingredients(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_company_staff_company ON company_staff(company_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_accounting_ledger_order ON accounting_ledger(order_id);

-- =============================================
-- SEED DATA: Super Admin
-- =============================================
INSERT INTO staff (id, name, email, role, pin_code, status, password_hash)
VALUES (
  uuid_generate_v4(),
  'Super Admin',
  'admin@krown.ug',
  'super_admin',
  '1234',
  'active',
  'admin123'
) ON CONFLICT (email) DO NOTHING;

-- =============================================
-- SEED DATA: Default categories
-- =============================================
INSERT INTO categories (name, icon, sort_order) VALUES
  ('Food', 'UtensilsCrossed', 1),
  ('Drinks', 'Wine', 2),
  ('Desserts', 'Cake', 3),
  ('Snacks', 'Cookie', 4)
ON CONFLICT DO NOTHING;
