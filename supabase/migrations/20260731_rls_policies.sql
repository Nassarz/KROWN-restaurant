-- ============================================================================
-- SUPABASE ROW-LEVEL SECURITY (RLS) POLICIES FOR KROWN ERP
-- Migration Script: 20260731_rls_policies.sql
-- ============================================================================

-- 1. ENABLE RLS ON ALL TABLES
ALTER TABLE IF EXISTS orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS companies ENABLE ROW LEVEL SECURITY;

-- 2. STAFF TABLE RLS POLICIES
-- Super Admin: Full CRUD access to all staff records
CREATE POLICY "Super Admin full access to staff"
  ON staff
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'Super Admin' OR auth.jwt() ->> 'email' = 'admin@krown.ug');

-- Branch Manager: Access staff assigned to their branch
CREATE POLICY "Branch Manager view branch staff"
  ON staff
  FOR SELECT
  USING (
    assigned_branch_id = (SELECT assigned_branch_id FROM staff WHERE id = auth.uid())
    OR auth.jwt() ->> 'role' = 'Branch Manager'
  );

-- Individual Staff: Read own record
CREATE POLICY "Staff read own record"
  ON staff
  FOR SELECT
  USING (id = auth.uid());

-- 3. ORDERS TABLE RLS POLICIES
-- Super Admin: Read & Write all orders
CREATE POLICY "Super Admin manage all orders"
  ON orders
  FOR ALL
  USING (true);

-- Staff: Access orders for their assigned branch
CREATE POLICY "Staff manage branch orders"
  ON orders
  FOR ALL
  USING (
    branch_id = (SELECT assigned_branch_id FROM staff WHERE id = auth.uid())
    OR restaurant_id = (SELECT assigned_branch_id FROM staff WHERE id = auth.uid())
  );

-- 4. PRODUCTS & MENU RLS POLICIES
-- All authenticated staff can view available menu products
CREATE POLICY "Staff read menu products"
  ON products
  FOR SELECT
  USING (true);

-- Super Admin & Branch Managers: Create & Update menu items
CREATE POLICY "Managers modify menu products"
  ON products
  FOR ALL
  USING (
    auth.jwt() ->> 'role' IN ('Super Admin', 'Branch Manager')
  );

-- 5. INVENTORY & INGREDIENTS RLS POLICIES
-- Staff: Read inventory for assigned branch
CREATE POLICY "Staff read branch inventory"
  ON ingredients
  FOR SELECT
  USING (true);

-- Managers: Update inventory quantities for assigned branch
CREATE POLICY "Managers update branch inventory"
  ON ingredients
  FOR ALL
  USING (
    auth.jwt() ->> 'role' IN ('Super Admin', 'Branch Manager')
  );

-- 6. EXPENSES RLS POLICIES
-- Super Admin & Branch Managers: View & Add branch operating expenses
CREATE POLICY "Managers access branch expenses"
  ON expenses
  FOR ALL
  USING (
    auth.jwt() ->> 'role' IN ('Super Admin', 'Branch Manager')
  );

-- 7. BRANCHES RLS POLICIES
-- Super Admin: Full control over all branches
CREATE POLICY "Super Admin manage branches"
  ON branches
  FOR ALL
  USING (true);

-- Staff: Read branch details
CREATE POLICY "Staff read branch details"
  ON branches
  FOR SELECT
  USING (true);

-- 8. INITIAL SEEDING: SUPER ADMIN ACCOUNT (ID: cd91de98-cfc5-4246-a44a-fc09af98a23d)
INSERT INTO staff (id, name, email, password, pin, role, branch, assigned_branch_id, status)
VALUES (
  'cd91de98-cfc5-4246-a44a-fc09af98a23d',
  'Nassar Walusansa (Super Admin)',
  'admin@krown.ug',
  'admin123',
  '1234',
  'Super Admin',
  'Global HQ',
  'all',
  'active'
)
ON CONFLICT (id) DO UPDATE SET
  role = 'Super Admin',
  assigned_branch_id = 'all',
  branch = 'Global HQ',
  status = 'active';

-- ============================================================================
-- END OF RLS SECURITY POLICIES & INITIAL SEEDING
-- ============================================================================
