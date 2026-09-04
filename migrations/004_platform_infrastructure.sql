-- ============================================================================
-- KROWN RESTAURANT SAAS — PLATFORM INFRASTRUCTURE MIGRATION
-- Migration 004: Devices, Sessions, Security, Support, Notifications, Feature Flags
-- ============================================================================

-- Enable UUID generation if not already
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. DEVICE REGISTRATION
-- ============================================================================
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Device identity
  device_fingerprint VARCHAR(255) NOT NULL,  -- Client-generated unique device ID
  device_name VARCHAR(128) NOT NULL,         -- User-assigned name (e.g., "POS-01", "Kitchen Tab")
  device_type VARCHAR(32) NOT NULL CHECK (device_type IN (
    'pos', 'kitchen', 'waiter_tablet', 'manager_desk', 'admin_desk', 'general'
  )),
  
  -- Enrollment
  enrollment_token_hash VARCHAR(255),        -- Hash of enrollment token (for QR-based enrollment)
  enrolled_at TIMESTAMPTZ,
  enrolled_by UUID REFERENCES staff(id),
  
  -- Status
  status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN (
    'pending', 'active', 'suspended', 'revoked'
  )),
  
  -- Trust
  trust_status VARCHAR(32) NOT NULL DEFAULT 'trusted' CHECK (trust_status IN (
    'untrusted', 'pending', 'trusted', 'revoked'
  )),
  
  -- Metadata
  browser VARCHAR(128),
  operating_system VARCHAR(128),
  ip_address VARCHAR(45),
  user_agent TEXT,
  
  -- Allowed staff roles on this device
  allowed_roles JSONB DEFAULT '["waiter","cashier","kitchen_staff"]',
  
  -- Tracking
  last_seen_at TIMESTAMPTZ,
  last_staff_id UUID REFERENCES staff(id),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_org ON devices(organization_id);
CREATE INDEX IF NOT EXISTS idx_devices_fingerprint ON devices(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_org_status ON devices(organization_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_org_fingerprint ON devices(organization_id, device_fingerprint);

-- ============================================================================
-- 2. DEVICE ENROLLMENT TOKENS (for QR-code based enrollment)
-- ============================================================================
CREATE TABLE IF NOT EXISTS device_enrollment_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  token_hash VARCHAR(255) NOT NULL,          -- Hashed enrollment token
  device_type VARCHAR(32) NOT NULL,
  device_name VARCHAR(128),
  allowed_roles JSONB DEFAULT '["waiter","cashier","kitchen_staff"]',
  
  -- Usage
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  used_by_device_id UUID REFERENCES devices(id),
  
  -- Expiry
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Creator
  created_by UUID NOT NULL REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enrollment_tokens_org ON device_enrollment_tokens(organization_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_tokens_hash ON device_enrollment_tokens(token_hash);

-- ============================================================================
-- 3. STAFF SESSIONS (device-bound, revocable)
-- ============================================================================
CREATE TABLE IF NOT EXISTS staff_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  
  -- Token
  token_hash VARCHAR(255) NOT NULL,
  
  -- Session info
  role VARCHAR(64) NOT NULL,
  permissions JSONB DEFAULT '[]',
  
  -- Status
  status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'expired', 'revoked', 'replaced'
  )),
  
  -- Metadata
  ip_address VARCHAR(45),
  user_agent TEXT,
  
  -- Lifecycle
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_staff_sessions_staff ON staff_sessions(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_sessions_org ON staff_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_staff_sessions_device ON staff_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_staff_sessions_token ON staff_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_staff_sessions_status ON staff_sessions(status);

-- ============================================================================
-- 4. TRUSTED DEVICES (for Admin/Manager email+password login)
-- ============================================================================
CREATE TABLE IF NOT EXISTS trusted_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  
  -- Device identity
  device_fingerprint VARCHAR(255) NOT NULL,
  device_name VARCHAR(128),
  browser VARCHAR(128),
  operating_system VARCHAR(128),
  ip_address VARCHAR(45),
  
  -- Status
  status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'revoked'
  )),
  
  -- Lifecycle
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_staff ON trusted_devices(staff_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_org ON trusted_devices(organization_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_fingerprint ON trusted_devices(device_fingerprint);
CREATE UNIQUE INDEX IF NOT EXISTS idx_trusted_devices_staff_fingerprint ON trusted_devices(staff_id, device_fingerprint);

-- ============================================================================
-- 5. VERIFICATION CODES (for new device verification, password reset)
-- ============================================================================
CREATE TABLE IF NOT EXISTS verification_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Target
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Code
  code_hash VARCHAR(255) NOT NULL,
  purpose VARCHAR(64) NOT NULL CHECK (purpose IN (
    'new_device', 'password_reset', 'pin_reset', 'email_verify', 'mfa_setup'
  )),
  
  -- Status
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  
  -- Expiry
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Attempts
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 5,
  
  -- Metadata
  ip_address VARCHAR(45),
  user_agent TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_codes_staff ON verification_codes(staff_id);
CREATE INDEX IF NOT EXISTS idx_verification_codes_hash ON verification_codes(code_hash);
CREATE INDEX IF NOT EXISTS idx_verification_codes_purpose ON verification_codes(purpose);

-- ============================================================================
-- 6. SECURITY ALERTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS security_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,  -- NULL = platform-wide
  
  -- Alert info
  alert_type VARCHAR(64) NOT NULL,
  severity VARCHAR(16) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Target
  target_type VARCHAR(32),  -- 'staff', 'device', 'organization', 'system'
  target_id UUID,
  
  -- Source
  source_ip VARCHAR(45),
  source_device_id UUID,
  
  -- Status
  status VARCHAR(32) NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'investigating', 'resolved', 'dismissed'
  )),
  
  -- Resolution
  resolved_by UUID REFERENCES staff(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_alerts_org ON security_alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON security_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_security_alerts_status ON security_alerts(status);
CREATE INDEX IF NOT EXISTS idx_security_alerts_type ON security_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_security_alerts_created ON security_alerts(created_at DESC);

-- ============================================================================
-- 7. NOTIFICATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Target
  recipient_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  
  -- Content
  type VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  
  -- Status
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  
  -- Link
  link_url VARCHAR(512),
  link_type VARCHAR(32),  -- 'restaurant', 'staff', 'device', 'support', 'security'
  
  -- Priority
  priority VARCHAR(16) NOT NULL DEFAULT 'normal' CHECK (priority IN (
    'urgent', 'high', 'normal', 'low'
  )),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(recipient_id, read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- ============================================================================
-- 8. SUPPORT CONVERSATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS support_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Participants
  customer_staff_id UUID NOT NULL REFERENCES staff(id),
  assigned_agent_id UUID REFERENCES staff(id),
  
  -- Category
  category VARCHAR(64) NOT NULL DEFAULT 'general' CHECK (category IN (
    'general', 'technical', 'billing', 'security', 'feature_request', 'bug_report'
  )),
  
  -- Status
  status VARCHAR(32) NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'waiting_for_support', 'waiting_for_customer', 'in_progress', 'resolved', 'closed'
  )),
  
  -- Priority
  priority VARCHAR(16) NOT NULL DEFAULT 'normal' CHECK (priority IN (
    'urgent', 'high', 'normal', 'low'
  )),
  
  -- Subject
  subject VARCHAR(255) NOT NULL,
  
  -- Context
  device_id UUID,
  app_version VARCHAR(32),
  context JSONB DEFAULT '{}',
  
  -- Resolution
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  
  -- SLA
  first_response_at TIMESTAMPTZ,
  last_customer_message_at TIMESTAMPTZ,
  last_agent_message_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_conv_org ON support_conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_support_conv_customer ON support_conversations(customer_staff_id);
CREATE INDEX IF NOT EXISTS idx_support_conv_agent ON support_conversations(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_support_conv_status ON support_conversations(status);
CREATE INDEX IF NOT EXISTS idx_support_conv_created ON support_conversations(created_at DESC);

-- ============================================================================
-- 9. SUPPORT MESSAGES
-- ============================================================================
CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
  
  -- Sender
  sender_id UUID NOT NULL REFERENCES staff(id),
  sender_type VARCHAR(16) NOT NULL CHECK (sender_type IN ('customer', 'agent', 'system', 'ai')),
  
  -- Content
  content TEXT NOT NULL,
  message_type VARCHAR(16) NOT NULL DEFAULT 'text' CHECK (message_type IN (
    'text', 'image', 'file', 'system', 'note'
  )),
  
  -- Internal notes (visible only to agents)
  is_internal_note BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_conv ON support_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_sender ON support_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_created ON support_messages(created_at);

-- ============================================================================
-- 10. FEATURE FLAGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Flag
  key VARCHAR(128) NOT NULL UNIQUE,
  name VARCHAR(128) NOT NULL,
  description TEXT,
  
  -- Scope
  scope VARCHAR(16) NOT NULL DEFAULT 'global' CHECK (scope IN (
    'global', 'organization', 'plan'
  )),
  
  -- State
  enabled BOOLEAN DEFAULT FALSE,
  
  -- Conditions
  allowed_plans JSONB,       -- Which subscription plans get this feature
  allowed_orgs JSONB,        -- Which specific orgs get this feature
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(key);

-- ============================================================================
-- 11. PASSWORD RESET TOKENS
-- ============================================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  token_hash VARCHAR(255) NOT NULL,
  
  -- Status
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  
  -- Expiry
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Metadata
  created_by_ip VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_staff ON password_reset_tokens(staff_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON password_reset_tokens(token_hash);

-- ============================================================================
-- 12. MFA / TOTP SECRETS (for Super Admin MFA)
-- ============================================================================
CREATE TABLE IF NOT EXISTS mfa_secrets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  
  -- TOTP
  totp_secret VARCHAR(255) NOT NULL,
  totp_algorithm VARCHAR(16) DEFAULT 'SHA1',
  totp_digits INT DEFAULT 6,
  totp_period INT DEFAULT 30,
  
  -- Status
  enabled BOOLEAN DEFAULT FALSE,
  enabled_at TIMESTAMPTZ,
  
  -- Backup codes (hashed)
  backup_codes JSONB DEFAULT '[]',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mfa_secrets_staff ON mfa_secrets(staff_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mfa_secrets_staff_unique ON mfa_secrets(staff_id);

-- ============================================================================
-- 13. ENHANCE AUDIT LOGS
-- ============================================================================
DO $$ BEGIN
  -- Add new columns if they don't exist
  ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS device_id UUID;
  ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
  ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_role VARCHAR(64);
  ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS result VARCHAR(16) DEFAULT 'success';
  ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS reason TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_logs_device ON audit_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_role ON audit_logs(actor_role);
CREATE INDEX IF NOT EXISTS idx_audit_logs_result ON audit_logs(result);

-- ============================================================================
-- 14. ENHANCE STAFF TABLE
-- ============================================================================
DO $$ BEGIN
  ALTER TABLE staff ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
  ALTER TABLE staff ADD COLUMN IF NOT EXISTS last_failed_login_at TIMESTAMPTZ;
  ALTER TABLE staff ADD COLUMN IF NOT EXISTS failed_login_count INT DEFAULT 0;
  ALTER TABLE staff ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
  ALTER TABLE staff ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT FALSE;
  ALTER TABLE staff ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
  ALTER TABLE staff ADD COLUMN IF NOT EXISTS device_bound BOOLEAN DEFAULT FALSE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ============================================================================
-- 15. INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_staff_org_role ON staff(organization_id, role);
CREATE INDEX IF NOT EXISTS idx_staff_status ON staff(status);
CREATE INDEX IF NOT EXISTS idx_staff_last_login ON staff(last_login_at DESC NULLS LAST);

-- ============================================================================
-- SEED DEFAULT FEATURE FLAGS
-- ============================================================================
INSERT INTO feature_flags (key, name, description, scope, enabled, allowed_plans) VALUES
  ('pos', 'Point of Sale', 'Core POS functionality', 'global', true, '["starter","professional","enterprise"]'),
  ('inventory', 'Inventory Management', 'Track ingredients and stock', 'global', true, '["professional","enterprise"]'),
  ('kitchen', 'Kitchen Display', 'Kitchen order management', 'global', true, '["professional","enterprise"]'),
  ('advanced_analytics', 'Advanced Analytics', 'Detailed reporting and analytics', 'global', false, '["enterprise"]'),
  ('ai_support', 'AI Support', 'AI-powered support chatbot', 'global', true, '["starter","professional","enterprise"]'),
  ('device_management', 'Device Management', 'Register and manage devices', 'global', true, '["professional","enterprise"]'),
  ('multi_branch', 'Multi-Branch', 'Manage multiple branches', 'global', false, '["enterprise"]'),
  ('print_support', 'Print Support', 'Receipt and order printing', 'global', true, '["starter","professional","enterprise"]')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- SEED DEFAULT SUPER ADMIN (if not exists)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM staff WHERE email = 'superadmin@krown.ug') THEN
    INSERT INTO staff (id, organization_id, name, email, role, branch, status, password_argon2)
    VALUES (
      uuid_generate_v4(),
      '00000000-0000-0000-0000-000000000001',
      'Krown Super Admin',
      'superadmin@krown.ug',
      'super_admin',
      'Head Office',
      'active',
      '$argon2id$v=19$m=65536,t=3,p=4$placeholder'
    );
  END IF;
END $$;

-- ============================================================================
-- DONE
-- ============================================================================
