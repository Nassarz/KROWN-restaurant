-- ============================================================================
-- KROWN POS: STAFF PIN VERIFICATION RPC & RATE-LIMIT LOCKOUT MIGRATION
-- Migration Script: 20260802_reconcile_schema_rpc.sql
-- ============================================================================

-- 1. Create staff PIN attempt and lockout tracking table
CREATE TABLE IF NOT EXISTS staff_pin_lockouts (
  staff_id TEXT PRIMARY KEY REFERENCES staff(id) ON DELETE CASCADE,
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until BIGINT NOT NULL DEFAULT 0,
  updated_at BIGINT DEFAULT extract(epoch from now()) * 1000
);

-- Enable RLS on lockout table
ALTER TABLE staff_pin_lockouts ENABLE ROW LEVEL SECURITY;

-- 2. Create verify_staff_pin SECURITY DEFINER RPC function
CREATE OR REPLACE FUNCTION verify_staff_pin(
  staff_id TEXT,
  pin_attempt TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stored_pin TEXT;
  v_failed_attempts INT := 0;
  v_locked_until BIGINT := 0;
  v_now BIGINT := (extract(epoch from now()) * 1000)::BIGINT;
BEGIN
  -- Fetch current lockout status for this staff member
  SELECT failed_attempts, locked_until 
  INTO v_failed_attempts, v_locked_until
  FROM staff_pin_lockouts
  WHERE staff_pin_lockouts.staff_id = verify_staff_pin.staff_id;

  -- Check if currently locked out (e.g. 60 seconds lockout after 5 failed attempts)
  IF v_locked_until > v_now THEN
    RETURN FALSE;
  END IF;

  -- Fetch stored PIN from public.staff table
  SELECT pin INTO v_stored_pin
  FROM staff
  WHERE id = verify_staff_pin.staff_id;

  -- Check if staff member exists and PIN matches
  IF v_stored_pin IS NOT NULL AND v_stored_pin = pin_attempt THEN
    -- Reset failed attempts on success
    INSERT INTO staff_pin_lockouts (staff_id, failed_attempts, locked_until, updated_at)
    VALUES (verify_staff_pin.staff_id, 0, 0, v_now)
    ON CONFLICT (staff_id) DO UPDATE
      SET failed_attempts = 0, locked_until = 0, updated_at = v_now;

    RETURN TRUE;
  ELSE
    -- Increment failed attempts
    v_failed_attempts := COALESCE(v_failed_attempts, 0) + 1;

    -- Lock for 60,000 milliseconds (60 seconds) if 5 consecutive failed attempts reached
    IF v_failed_attempts >= 5 THEN
      v_locked_until := v_now + 60000;
    END IF;

    INSERT INTO staff_pin_lockouts (staff_id, failed_attempts, locked_until, updated_at)
    VALUES (verify_staff_pin.staff_id, v_failed_attempts, v_locked_until, v_now)
    ON CONFLICT (staff_id) DO UPDATE
      SET failed_attempts = v_failed_attempts,
          locked_until = v_locked_until,
          updated_at = v_now;

    RETURN FALSE;
  END IF;
END;
$$;

-- Grant EXECUTE permission on function to anon and authenticated roles
GRANT EXECUTE ON FUNCTION verify_staff_pin(TEXT, TEXT) TO anon, authenticated, service_role;
