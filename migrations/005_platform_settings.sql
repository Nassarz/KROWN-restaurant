CREATE TABLE IF NOT EXISTS platform_settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  key varchar(128) NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}',
  description text,
  updated_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_settings_key ON platform_settings(key);
