-- KROWN POS — Multi-Tenant SaaS Migration
-- Phase 2: Database Schema Changes
-- Run: psql $DATABASE_URL -f migrations/001_add_tenant_isolation.sql

BEGIN;

-- =============================================
-- 1. NEW TABLES
-- =============================================

-- Subscription Plans
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  monthly_price_ugx NUMERIC(12,2) DEFAULT 0,
  max_branches INT DEFAULT 1,
  max_staff INT DEFAULT 10,
  max_menu_items INT DEFAULT 50,
  max_orders_per_day INT DEFAULT 200,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organizations (Tenants)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  domain VARCHAR(255),
  logo_url TEXT,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  tax_id VARCHAR(100),
  address TEXT,
  status VARCHAR(20) DEFAULT 'active',
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tenant Subscriptions
CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status VARCHAR(20) DEFAULT 'active',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Super Admins
CREATE TABLE IF NOT EXISTS super_admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- =============================================
-- 2. ADD organization_id TO ALL BUSINESS TABLES
-- =============================================

ALTER TABLE branches ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE product_ingredients ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE company_staff ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE zones ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE print_jobs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE accounting_ledger ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- =============================================
-- 3. ADD idempotency_key TO ORDERS
-- =============================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255) UNIQUE;

-- =============================================
-- 4. ADD SECURITY COLUMNS
-- =============================================

-- password_hash columns (will be populated by migration script)
ALTER TABLE staff ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255);

-- =============================================
-- 5. CREATE DEFAULT ORGANIZATION FROM EXISTING DATA
-- =============================================

INSERT INTO organizations (id, name, slug, contact_email, contact_phone, tax_id, status)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Krown Restaurants',
  'krown-default',
  'admin@krown.ug',
  '+256 700 000 000',
  'URA-100293481',
  'active'
) ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- 6. ASSIGN ALL EXISTING DATA TO DEFAULT ORG
-- =============================================

UPDATE branches SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE staff SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE products SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE ingredients SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE product_ingredients SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE orders SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE companies SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE company_staff SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE zones SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE expenses SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE inventory_movements SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE audit_logs SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE print_jobs SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE accounting_ledger SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;

-- =============================================
-- 7. ASSIGN EXISTING STAFF TO DEFAULT ORG
-- =============================================

-- The existing Super Admin gets linked to the default org
UPDATE staff SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL OR role = 'super_admin';

-- =============================================
-- 8. CREATE DEFAULT SUBSCRIPTION
-- =============================================

INSERT INTO subscription_plans (name, display_name, monthly_price_ugx, max_branches, max_staff, max_menu_items, max_orders_per_day, features)
VALUES
  ('starter', 'Starter', 500000, 1, 10, 50, 200, '["pos", "reports"]'),
  ('professional', 'Professional', 1500000, 3, 50, 200, 1000, '["pos", "kitchen", "inventory", "accounting", "reports"]'),
  ('enterprise', 'Enterprise', 3500000, 999, 9999, 99999, 999999, '["pos", "kitchen", "inventory", "accounting", "reports", "api"]')
ON CONFLICT (name) DO NOTHING;

-- Assign Professional plan to default org
INSERT INTO tenant_subscriptions (organization_id, plan_id, status, started_at, current_period_start, current_period_end)
SELECT
  '00000000-0000-0000-0000-000000000001',
  id,
  'active',
  NOW(),
  NOW(),
  NOW() + INTERVAL '30 days'
FROM subscription_plans
WHERE name = 'professional'
ON CONFLICT DO NOTHING;

-- =============================================
-- 9. NEW INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_org_branches ON branches(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_staff ON staff(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_products ON products(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_ingredients ON ingredients(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_product_ingredients ON product_ingredients(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_orders ON orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_companies ON companies(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_company_staff ON company_staff(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_zones ON zones(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_expenses ON expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_inventory_movements ON inventory_movements(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_audit_logs ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_print_jobs ON print_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_accounting_ledger ON accounting_ledger(organization_id);
CREATE INDEX IF NOT EXISTS idx_orders_idempotency ON orders(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_super_admins_email ON super_admins(email);
CREATE INDEX IF NOT EXISTS idx_org_subscriptions ON tenant_subscriptions(organization_id);

-- =============================================
-- 10. ROW-LEVEL SECURITY
-- =============================================

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_ledger ENABLE ROW LEVEL SECURITY;

-- RLS Policies — enforce organization_id = current_setting('app.org')
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['branches','staff','products','ingredients','product_ingredients','orders','companies','company_staff','zones','expenses','inventory_movements','audit_logs','print_jobs','accounting_ledger']
  LOOP
    EXECUTE format('
      DROP POLICY IF EXISTS org_isolation_%s ON %s;
      CREATE POLICY org_isolation_%s ON %s
        USING (organization_id = current_setting(''app.org'')::UUID);
    ', t, t, t, t);
  END LOOP;
END $$;

-- =============================================
-- 11. CRYPTOGRAPHIC COLUMNS
-- =============================================

-- Add argon2 hash columns for password migration
ALTER TABLE staff ADD COLUMN IF NOT EXISTS password_argon2 VARCHAR(255);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS pin_argon2 VARCHAR(255);

-- =============================================
-- 12. UPDATE SEED DATA
-- =============================================

-- Update the seed Super Admin to use proper role
UPDATE staff SET role = 'super_admin' WHERE email = 'admin@krown.ug';

-- Link the seed Super Admin to the default org
UPDATE staff SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE email = 'admin@krown.ug';

COMMIT;
