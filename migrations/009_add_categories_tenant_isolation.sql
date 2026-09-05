-- Add organization_id to categories for multi-tenant isolation
-- Categories were originally global; this migration scopes them per-tenant

ALTER TABLE categories ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);

-- Backfill from products that reference categories
UPDATE categories c
SET organization_id = p.organization_id
FROM products p
WHERE c.id = p.category_id AND c.organization_id IS NULL;

-- Create index for tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_categories_org ON categories(organization_id);

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'categories_tenant_isolation' AND tablename = 'categories') THEN
    CREATE POLICY categories_tenant_isolation ON categories
      USING (organization_id = current_setting('app.org')::uuid OR current_setting('app.org') IS NULL);
  END IF;
END $$;
