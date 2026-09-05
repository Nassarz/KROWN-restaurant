-- KROWN security hardening. Review/apply through the normal migration process.
-- Categories fail closed when no tenant context is present.
DROP POLICY IF EXISTS categories_tenant_isolation ON categories;
CREATE POLICY categories_tenant_isolation ON categories
  USING (organization_id = NULLIF(current_setting('app.org', true), '')::uuid)
  WITH CHECK (organization_id = NULLIF(current_setting('app.org', true), '')::uuid);

-- Every branch-scoped staff record is indexed by tenant + assigned branch.
CREATE INDEX IF NOT EXISTS idx_staff_org_branch ON staff (organization_id, assigned_branch_id);

-- Prevent duplicate staff identities within a tenant.
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_org_email_lower ON staff (organization_id, lower(email));

-- Orders currently store their branch identifier in restaurant_id; preserve that schema contract.
CREATE INDEX IF NOT EXISTS idx_orders_org_restaurant ON orders (organization_id, restaurant_id);
CREATE INDEX IF NOT EXISTS idx_products_org_branch ON products (organization_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_org_branch ON inventory_movements (organization_id, branch_id);

-- Add a stable identifier to the lockout table while retaining its existing staff_id primary key.
ALTER TABLE staff_pin_lockouts ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_pin_lockouts_id ON staff_pin_lockouts(id);
