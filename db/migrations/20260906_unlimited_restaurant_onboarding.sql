-- KROWN Restaurant: unlimited restaurant onboarding
-- Safe/idempotent migration. Creates no subscription rows and never stores plaintext passwords.

CREATE OR REPLACE FUNCTION onboard_restaurant(
  p_name text,
  p_contact_email text,
  p_contact_phone text,
  p_tax_id text,
  p_address text,
  p_branch_name text,
  p_branch_location text,
  p_admin_name text,
  p_admin_email text,
  p_admin_password_argon2 text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid := uuid_generate_v4();
  v_branch_id uuid := uuid_generate_v4();
  v_admin_id uuid := uuid_generate_v4();
  v_slug text;
  v_base_slug text;
  v_email text;
BEGIN
  IF NULLIF(trim(p_name), '') IS NULL THEN RAISE EXCEPTION 'Restaurant name is required'; END IF;
  IF NULLIF(trim(p_admin_name), '') IS NULL THEN RAISE EXCEPTION 'Restaurant Admin name is required'; END IF;
  v_email := lower(trim(coalesce(p_admin_email, '')));
  IF v_email = '' OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'A valid Restaurant Admin email is required'; END IF;
  IF NULLIF(trim(p_admin_password_argon2), '') IS NULL THEN RAISE EXCEPTION 'Restaurant Admin password is required'; END IF;
  IF EXISTS (SELECT 1 FROM staff WHERE lower(email) = v_email) OR EXISTS (SELECT 1 FROM super_admins WHERE lower(email) = v_email) THEN RAISE EXCEPTION 'That email address is already in use'; END IF;

  v_base_slug := regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g');
  v_base_slug := trim(both '-' from v_base_slug);
  IF v_base_slug = '' THEN v_base_slug := 'restaurant'; END IF;
  v_slug := left(v_base_slug, 80);
  IF EXISTS (SELECT 1 FROM organizations WHERE slug = v_slug) THEN
    v_slug := left(v_base_slug, 68) || '-' || substring(replace(v_org_id::text, '-', '') from 1 for 11);
  END IF;

  INSERT INTO organizations (id, name, slug, contact_email, contact_phone, tax_id, address, status, settings)
  VALUES (v_org_id, trim(p_name), v_slug, NULLIF(trim(p_contact_email), ''), NULLIF(trim(p_contact_phone), ''), NULLIF(trim(p_tax_id), ''), NULLIF(trim(p_address), ''), 'active', jsonb_build_object('unlimited_access', true));

  INSERT INTO branches (id, name, location, manager, manager_name, phone, email, tax_id, organization_id, status)
  VALUES (v_branch_id, COALESCE(NULLIF(trim(p_branch_name), ''), 'Main Branch'), COALESCE(NULLIF(trim(p_branch_location), ''), NULLIF(trim(p_address), ''), 'Kampala, Uganda'), trim(p_admin_name), trim(p_admin_name), NULLIF(trim(p_contact_phone), ''), NULLIF(trim(p_contact_email), ''), NULLIF(trim(p_tax_id), ''), v_org_id, 'active');

  INSERT INTO categories (id, name, icon, organization_id, branch_id)
  VALUES (uuid_generate_v4(), 'Food', 'UtensilsCrossed', v_org_id, v_branch_id), (uuid_generate_v4(), 'Drinks', 'Wine', v_org_id, v_branch_id), (uuid_generate_v4(), 'Desserts', 'Cake', v_org_id, v_branch_id), (uuid_generate_v4(), 'Snacks', 'Cookie', v_org_id, v_branch_id), (uuid_generate_v4(), 'Combos', 'Package', v_org_id, v_branch_id);

  INSERT INTO staff (id, name, email, role, branch, assigned_branch_id, organization_id, status, password_argon2, password_hash, email_verified, device_bound)
  VALUES (v_admin_id, trim(p_admin_name), v_email, 'restaurant_admin', COALESCE(NULLIF(trim(p_branch_name), ''), 'Main Branch'), v_branch_id, v_org_id, 'active', p_admin_password_argon2, NULL, true, false);

  RETURN jsonb_build_object('organization', jsonb_build_object('id', v_org_id, 'name', trim(p_name), 'slug', v_slug), 'branch', jsonb_build_object('id', v_branch_id, 'name', COALESCE(NULLIF(trim(p_branch_name), ''), 'Main Branch')), 'admin', jsonb_build_object('id', v_admin_id, 'name', trim(p_admin_name), 'email', v_email, 'role', 'restaurant_admin'), 'unlimited', true);
END;
$$;

REVOKE ALL ON FUNCTION onboard_restaurant(text,text,text,text,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION onboard_restaurant(text,text,text,text,text,text,text,text,text,text) TO neondb_owner;
