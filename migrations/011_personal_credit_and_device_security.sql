-- KROWN production hardening: personal credit + stronger device identity.
-- Data-preserving migration. No existing rows are deleted.

CREATE TABLE IF NOT EXISTS personal_credit_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  public_reference varchar(32) NOT NULL UNIQUE,
  full_name varchar(160) NOT NULL,
  phone varchar(40),
  email varchar(254),
  credit_limit_ugx numeric(14,2) NOT NULL DEFAULT 0 CHECK (credit_limit_ugx >= 0),
  current_balance_ugx numeric(14,2) NOT NULL DEFAULT 0 CHECK (current_balance_ugx >= 0),
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','closed')),
  notes text,
  created_by uuid NOT NULL REFERENCES staff(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_personal_credit_identity ON personal_credit_profiles (organization_id, branch_id, lower(full_name), COALESCE(phone, ''));
CREATE INDEX IF NOT EXISTS idx_personal_credit_org_branch ON personal_credit_profiles (organization_id, branch_id, status);

CREATE TABLE IF NOT EXISTS personal_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  profile_id uuid NOT NULL REFERENCES personal_credit_profiles(id) ON DELETE RESTRICT,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  entry_type varchar(20) NOT NULL CHECK (entry_type IN ('charge','payment','adjustment','reversal')),
  amount_ugx numeric(14,2) NOT NULL CHECK (amount_ugx > 0),
  balance_after_ugx numeric(14,2) NOT NULL CHECK (balance_after_ugx >= 0),
  description varchar(500),
  created_by uuid NOT NULL REFERENCES staff(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_personal_credit_ledger_profile_time ON personal_credit_ledger (profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_personal_credit_ledger_org_branch_time ON personal_credit_ledger (organization_id, branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_personal_credit_ledger_order ON personal_credit_ledger (order_id) WHERE order_id IS NOT NULL;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS personal_credit_profile_id uuid;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_personal_credit boolean NOT NULL DEFAULT false;
ALTER TABLE orders ADD CONSTRAINT orders_personal_credit_profile_fkey FOREIGN KEY (personal_credit_profile_id) REFERENCES personal_credit_profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_personal_credit ON orders (organization_id, restaurant_id, personal_credit_profile_id, created_at DESC);

ALTER TABLE devices ADD COLUMN IF NOT EXISTS branch_id uuid;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS public_reference varchar(32);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS credential_id varchar(128);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS credential_public_key text;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS credential_version integer NOT NULL DEFAULT 1;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_authenticated_at timestamptz;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS auth_challenge text;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS auth_challenge_expires_at timestamptz;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS decommissioned_at timestamptz;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS decommissioned_by uuid;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS decommissioned_reason text;
ALTER TABLE devices ADD CONSTRAINT devices_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT;
ALTER TABLE devices ADD CONSTRAINT devices_decommissioned_by_fkey FOREIGN KEY (decommissioned_by) REFERENCES staff(id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_devices_public_reference ON devices (public_reference) WHERE public_reference IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_devices_credential_id ON devices (credential_id) WHERE credential_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_devices_org_branch_status ON devices (organization_id, branch_id, status);
UPDATE devices SET public_reference='DEV-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)) WHERE public_reference IS NULL;

ALTER TABLE device_enrollment_tokens ADD COLUMN IF NOT EXISTS branch_id uuid;
ALTER TABLE device_enrollment_tokens ADD COLUMN IF NOT EXISTS credential_challenge text;
CREATE INDEX IF NOT EXISTS idx_enrollment_tokens_branch ON device_enrollment_tokens (organization_id, branch_id, expires_at);
