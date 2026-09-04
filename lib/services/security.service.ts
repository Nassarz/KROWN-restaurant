// KROWN POS — Security Service
// Alerts, verification codes, MFA, trusted devices, password reset tokens

import { getSql, queryWithRetry } from '@/lib/neon-server';
import { TenantContext, setTenantContext } from '@/lib/tenant';
import { generateId } from '@/lib/id';
import { logAudit } from '@/lib/audit';
import crypto from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SecurityAlert {
  id: string;
  organization_id?: string;
  alert_type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description?: string;
  target_type?: string;
  target_id?: string;
  source_ip?: string;
  source_device_id?: string;
  status: 'open' | 'investigating' | 'resolved' | 'dismissed';
  resolved_by?: string;
  resolved_at?: string;
  resolution_notes?: string;
  metadata: any;
  created_at: string;
}

export interface VerificationCode {
  id: string;
  staff_id: string;
  organization_id?: string;
  code_hash: string;
  purpose: 'new_device' | 'password_reset' | 'pin_reset' | 'email_verify' | 'mfa_setup';
  used: boolean;
  used_at?: string;
  expires_at: string;
  attempts: number;
  max_attempts: number;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface PasswordResetToken {
  id: string;
  staff_id: string;
  organization_id?: string;
  token_hash: string;
  used: boolean;
  used_at?: string;
  expires_at: string;
  created_by_ip?: string;
  created_at: string;
}

export interface MFASecret {
  id: string;
  staff_id: string;
  totp_secret: string;
  totp_algorithm: string;
  totp_digits: number;
  totp_period: number;
  enabled: boolean;
  enabled_at?: string;
  backup_codes: any;
  created_at: string;
  updated_at: string;
}

export interface TrustedDevice {
  id: string;
  organization_id: string;
  staff_id: string;
  device_fingerprint: string;
  device_name?: string;
  browser?: string;
  operating_system?: string;
  ip_address?: string;
  status: string;
  verified_at: string;
  last_seen_at: string;
  revoked_at?: string;
  revoked_reason?: string;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function sha256Hash(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function generateRandomToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

function generateTOTP(secret: string, period: number = 30, digits: number = 6): string {
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / period);
  const counterBytes = Buffer.alloc(8);
  counterBytes.writeBigInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'base64'));
  hmac.update(counterBytes);
  const hash = hmac.digest();

  const offset = hash[hash.length - 1] & 0x0f;
  const code = (
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff)
  ) % Math.pow(10, digits);

  return code.toString().padStart(digits, '0');
}

// ── Security Alerts ────────────────────────────────────────────────────────

export async function createAlert(
  ctx: TenantContext | null,
  input: {
    organization_id?: string;
    alert_type: string;
    severity: SecurityAlert['severity'];
    title: string;
    description?: string;
    target_type?: string;
    target_id?: string;
    source_ip?: string;
    source_device_id?: string;
    metadata?: any;
  }
): Promise<SecurityAlert> {
  const sql = getSql();
  if (ctx) await setTenantContext(sql, ctx.organizationId);

  const id = generateId();
  const orgId = input.organization_id || ctx?.organizationId || null;

  await sql`
    INSERT INTO security_alerts (id, organization_id, alert_type, severity, title, description, target_type, target_id, source_ip, source_device_id, metadata)
    VALUES (${id}, ${orgId}, ${input.alert_type}, ${input.severity}, ${input.title}, ${input.description || null}, ${input.target_type || null}, ${input.target_id || null}, ${input.source_ip || null}, ${input.source_device_id || null}, ${JSON.stringify(input.metadata || {})})
  `;

  if (ctx) {
    await logAudit(ctx.userId, 'security.alert_create', { alertId: id, type: input.alert_type, severity: input.severity }, ctx.organizationId, ctx.branchId);
  }

  const rows = await sql`SELECT * FROM security_alerts WHERE id = ${id}`;
  return rows[0] as SecurityAlert;
}

export async function listAlerts(
  ctx: TenantContext,
  filters?: { severity?: string; status?: string; limit?: number; offset?: number }
): Promise<SecurityAlert[]> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  let rows;
  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;

  if (filters?.severity && filters?.status) {
    rows = await sql`SELECT * FROM security_alerts WHERE organization_id = ${ctx.organizationId} AND severity = ${filters.severity} AND status = ${filters.status} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  } else if (filters?.severity) {
    rows = await sql`SELECT * FROM security_alerts WHERE organization_id = ${ctx.organizationId} AND severity = ${filters.severity} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  } else if (filters?.status) {
    rows = await sql`SELECT * FROM security_alerts WHERE organization_id = ${ctx.organizationId} AND status = ${filters.status} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  } else {
    rows = await sql`SELECT * FROM security_alerts WHERE organization_id = ${ctx.organizationId} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  }

  return rows as SecurityAlert[];
}

export async function getAlert(ctx: TenantContext, alertId: string): Promise<SecurityAlert | null> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const rows = await sql`SELECT * FROM security_alerts WHERE id = ${alertId} AND organization_id = ${ctx.organizationId}`;
  return rows.length > 0 ? (rows[0] as SecurityAlert) : null;
}

export async function resolveAlert(
  ctx: TenantContext,
  alertId: string,
  notes?: string
): Promise<SecurityAlert> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const existing = await sql`SELECT * FROM security_alerts WHERE id = ${alertId} AND organization_id = ${ctx.organizationId}`;
  if (existing.length === 0) throw new Error('Alert not found');

  await sql`
    UPDATE security_alerts
    SET status = 'resolved', resolved_by = ${ctx.userId}, resolved_at = NOW(), resolution_notes = ${notes || null}
    WHERE id = ${alertId} AND organization_id = ${ctx.organizationId}
  `;

  await logAudit(ctx.userId, 'security.alert_resolve', { alertId }, ctx.organizationId, ctx.branchId);

  const rows = await sql`SELECT * FROM security_alerts WHERE id = ${alertId}`;
  return rows[0] as SecurityAlert;
}

export async function dismissAlert(ctx: TenantContext, alertId: string): Promise<SecurityAlert> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const existing = await sql`SELECT * FROM security_alerts WHERE id = ${alertId} AND organization_id = ${ctx.organizationId}`;
  if (existing.length === 0) throw new Error('Alert not found');

  await sql`
    UPDATE security_alerts SET status = 'dismissed' WHERE id = ${alertId} AND organization_id = ${ctx.organizationId}
  `;

  await logAudit(ctx.userId, 'security.alert_dismiss', { alertId }, ctx.organizationId, ctx.branchId);

  const rows = await sql`SELECT * FROM security_alerts WHERE id = ${alertId}`;
  return rows[0] as SecurityAlert;
}

export async function getAlertStats(ctx: TenantContext): Promise<{
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  total: number;
}> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const severityRows = await sql`
    SELECT severity, COUNT(*)::int as count FROM security_alerts WHERE organization_id = ${ctx.organizationId} GROUP BY severity
  `;
  const statusRows = await sql`
    SELECT status, COUNT(*)::int as count FROM security_alerts WHERE organization_id = ${ctx.organizationId} GROUP BY status
  `;
  const totalRows = await sql`
    SELECT COUNT(*)::int as count FROM security_alerts WHERE organization_id = ${ctx.organizationId}
  `;

  const bySeverity: Record<string, number> = {};
  for (const row of severityRows as any[]) {
    bySeverity[row.severity] = row.count;
  }

  const byStatus: Record<string, number> = {};
  for (const row of statusRows as any[]) {
    byStatus[row.status] = row.count;
  }

  return { bySeverity, byStatus, total: (totalRows[0] as any).count };
}

// ── Verification Codes ─────────────────────────────────────────────────────

export async function generateVerificationCode(
  staffId: string,
  purpose: VerificationCode['purpose'],
  orgId?: string,
  ip?: string,
  ua?: string
): Promise<string> {
  const sql = getSql();
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const codeHash = sha256Hash(code);
  const id = generateId();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await sql`
    INSERT INTO verification_codes (id, staff_id, organization_id, code_hash, purpose, expires_at, ip_address, user_agent)
    VALUES (${id}, ${staffId}, ${orgId || null}, ${codeHash}, ${purpose}, ${expiresAt}, ${ip || null}, ${ua || null})
  `;

  return code;
}

export async function verifyCode(
  staffId: string,
  code: string,
  purpose: VerificationCode['purpose']
): Promise<{ success: boolean; error?: string }> {
  const sql = getSql();
  const codeHash = sha256Hash(code);

  const rows = await sql`
    SELECT * FROM verification_codes
    WHERE staff_id = ${staffId} AND purpose = ${purpose} AND code_hash = ${codeHash}
    ORDER BY created_at DESC LIMIT 1
  `;

  if (rows.length === 0) {
    // Increment attempts on any matching unused code
    await sql`
      UPDATE verification_codes SET attempts = attempts + 1
      WHERE staff_id = ${staffId} AND purpose = ${purpose} AND used = FALSE AND attempts < max_attempts
    `;
    return { success: false, error: 'Invalid code' };
  }

  const record = rows[0] as VerificationCode;

  if (record.used) {
    return { success: false, error: 'Code already used' };
  }

  if (new Date(record.expires_at) < new Date()) {
    return { success: false, error: 'Code expired' };
  }

  if (record.attempts >= record.max_attempts) {
    return { success: false, error: 'Too many attempts' };
  }

  await sql`
    UPDATE verification_codes SET used = TRUE, used_at = NOW() WHERE id = ${record.id}
  `;

  return { success: true };
}

export async function cleanupExpiredCodes(): Promise<number> {
  const sql = getSql();
  const result = await sql`DELETE FROM verification_codes WHERE expires_at < NOW() AND used = FALSE`;
  return (result as any).length || 0;
}

// ── Password Reset Tokens ──────────────────────────────────────────────────

export async function createPasswordResetToken(
  staffId: string,
  orgId?: string,
  ip?: string
): Promise<string> {
  const sql = getSql();
  const token = generateRandomToken(32);
  const tokenHash = sha256Hash(token);
  const id = generateId();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await sql`
    INSERT INTO password_reset_tokens (id, staff_id, organization_id, token_hash, expires_at, created_by_ip)
    VALUES (${id}, ${staffId}, ${orgId || null}, ${tokenHash}, ${expiresAt}, ${ip || null})
  `;

  return token;
}

export async function verifyPasswordResetToken(
  token: string
): Promise<{ valid: boolean; staff_id?: string; organization_id?: string; error?: string }> {
  const sql = getSql();
  const tokenHash = sha256Hash(token);

  const rows = await sql`
    SELECT * FROM password_reset_tokens WHERE token_hash = ${tokenHash} ORDER BY created_at DESC LIMIT 1
  `;

  if (rows.length === 0) {
    return { valid: false, error: 'Invalid token' };
  }

  const record = rows[0] as PasswordResetToken;

  if (record.used) {
    return { valid: false, error: 'Token already used' };
  }

  if (new Date(record.expires_at) < new Date()) {
    return { valid: false, error: 'Token expired' };
  }

  await sql`UPDATE password_reset_tokens SET used = TRUE, used_at = NOW() WHERE id = ${record.id}`;

  return { valid: true, staff_id: record.staff_id, organization_id: record.organization_id };
}

// ── MFA / TOTP ─────────────────────────────────────────────────────────────

export async function createMFASecret(staffId: string): Promise<{ secret: string; id: string }> {
  const sql = getSql();
  const secret = crypto.randomBytes(20).toString('base64');
  const id = generateId();

  await sql`
    INSERT INTO mfa_secrets (id, staff_id, totp_secret) VALUES (${id}, ${staffId}, ${secret})
    ON CONFLICT (staff_id) DO UPDATE SET totp_secret = ${secret}, enabled = FALSE, updated_at = NOW()
  `;

  return { secret, id };
}

export async function enableMFA(staffId: string, totpCode: string): Promise<boolean> {
  const sql = getSql();

  const rows = await sql`SELECT * FROM mfa_secrets WHERE staff_id = ${staffId}`;
  if (rows.length === 0) throw new Error('MFA not set up. Call createMFASecret first.');

  const mfa = rows[0] as MFASecret;

  // Verify current TOTP code
  const expected = generateTOTP(mfa.totp_secret, mfa.totp_period, mfa.totp_digits);
  if (totpCode !== expected) {
    // Check previous window (within 30s)
    const prevExpected = generateTOTP(mfa.totp_secret, mfa.totp_period, mfa.totp_digits);
    if (totpCode !== prevExpected) {
      return false;
    }
  }

  await sql`
    UPDATE mfa_secrets SET enabled = TRUE, enabled_at = NOW(), updated_at = NOW() WHERE staff_id = ${staffId}
  `;

  await sql`UPDATE staff SET mfa_enabled = TRUE WHERE id = ${staffId}`;

  return true;
}

export async function verifyMFACode(staffId: string, code: string): Promise<boolean> {
  const sql = getSql();

  const rows = await sql`SELECT * FROM mfa_secrets WHERE staff_id = ${staffId} AND enabled = TRUE`;
  if (rows.length === 0) return false;

  const mfa = rows[0] as MFASecret;
  const expected = generateTOTP(mfa.totp_secret, mfa.totp_period, mfa.totp_digits);
  return code === expected;
}

export async function disableMFA(staffId: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM mfa_secrets WHERE staff_id = ${staffId}`;
  await sql`UPDATE staff SET mfa_enabled = FALSE WHERE id = ${staffId}`;
}

export async function getMFAStatus(staffId: string): Promise<{ enabled: boolean; created_at?: string }> {
  const sql = getSql();
  const rows = await sql`SELECT enabled, created_at FROM mfa_secrets WHERE staff_id = ${staffId}`;
  if (rows.length === 0) return { enabled: false };
  const mfa = rows[0] as MFASecret;
  return { enabled: mfa.enabled, created_at: mfa.created_at };
}

// ── Trusted Devices ────────────────────────────────────────────────────────

export async function createTrustedDevice(
  ctx: TenantContext,
  staffId: string,
  fingerprint: string,
  name?: string,
  browser?: string,
  os?: string,
  ip?: string
): Promise<TrustedDevice> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const id = generateId();

  await sql`
    INSERT INTO trusted_devices (id, organization_id, staff_id, device_fingerprint, device_name, browser, operating_system, ip_address)
    VALUES (${id}, ${ctx.organizationId}, ${staffId}, ${fingerprint}, ${name || null}, ${browser || null}, ${os || null}, ${ip || null})
    ON CONFLICT (staff_id, device_fingerprint) DO UPDATE SET
      device_name = COALESCE(${name || null}, trusted_devices.device_name),
      last_seen_at = NOW()
  `;

  await logAudit(ctx.userId, 'security.device_trusted', { staffId, fingerprint, name }, ctx.organizationId, ctx.branchId);

  const rows = await sql`SELECT * FROM trusted_devices WHERE staff_id = ${staffId} AND device_fingerprint = ${fingerprint}`;
  return rows[0] as TrustedDevice;
}

export async function listTrustedDevices(ctx: TenantContext, staffId: string): Promise<TrustedDevice[]> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const rows = await sql`
    SELECT * FROM trusted_devices WHERE staff_id = ${staffId} AND organization_id = ${ctx.organizationId} ORDER BY created_at DESC
  `;
  return rows as TrustedDevice[];
}

export async function isTrustedDevice(staffId: string, fingerprint: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    SELECT id FROM trusted_devices WHERE staff_id = ${staffId} AND device_fingerprint = ${fingerprint} AND status = 'active'
  `;
  return rows.length > 0;
}

export async function revokeTrustedDevice(
  ctx: TenantContext,
  deviceId: string,
  reason?: string
): Promise<void> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  await sql`
    UPDATE trusted_devices SET status = 'revoked', revoked_at = NOW(), revoked_reason = ${reason || null}
    WHERE id = ${deviceId} AND organization_id = ${ctx.organizationId}
  `;

  await logAudit(ctx.userId, 'security.device_revoke', { deviceId, reason }, ctx.organizationId, ctx.branchId);
}

export async function revokeAllTrustedDevices(ctx: TenantContext, staffId: string): Promise<void> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  await sql`
    UPDATE trusted_devices SET status = 'revoked', revoked_at = NOW(), revoked_reason = 'Bulk revoke'
    WHERE staff_id = ${staffId} AND organization_id = ${ctx.organizationId} AND status = 'active'
  `;

  await logAudit(ctx.userId, 'security.device_revoke_all', { staffId }, ctx.organizationId, ctx.branchId);
}
