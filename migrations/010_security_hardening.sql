-- KROWN security hardening. Non-destructive; review/apply through the normal migration process.
-- 1) Categories must fail closed when no tenant context is present.
DROP POLICY IF EXISTS categories_tenant_isolation ON categories;
CREATE POLICY categories_tenant_isolation ON categories
  USING (organization_id = NULLIF(current_setting('app.org', true), '')::uuid)
  WITH CHECK (organization_id = NULLIF(current_setting('app.org', true), '')::uuid);

-- 2) Add database-level tenant/branch consistency checks where the columns exist.
-- Branch-scoped staff must belong to the same organization as their branch.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='assigned_branch_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='branches' AND column_name='organization_id') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_staff_org_branch') THEN
      CREATE INDEX idx_staff_org_branch ON staff (organization_id, assigned_branch_id);
    END IF;
  END IF;
END $$;

-- 3) Prevent duplicate staff identities within a tenant (case-insensitive).
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_org_email_lower ON staff (organization_id, lower(email));

-- 4) Helpful integrity indexes for tenant isolation and branch-scoped reads.
CREATE INDEX IF NOT EXISTS idx_orders_org_branch ON orders (organization_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_products_org_branch ON products (organization_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_org_branch ON inventory_movements (organization_id, branch_id);
