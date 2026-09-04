// KROWN POS — Staff Session Management Service
import { getSql, queryWithRetry } from '@/lib/neon-server';
import { TenantContext, setTenantContext } from '@/lib/tenant';
import { generateId } from '@/lib/id';
import * as crypto from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────
export interface StaffSession {
  id: string;
  organization_id: string;
  staff_id: string;
  device_id?: string;
  token_hash: string;
  role: string;
  permissions: string[];
  status: 'active' | 'expired' | 'revoked' | 'replaced';
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  expires_at: string;
  last_active_at: string;
  revoked_at?: string;
  revoked_reason?: string;
}

// ── Service Methods ────────────────────────────────────────────────────────

export async function createSession(
  ctx: TenantContext,
  staffId: string,
  deviceId?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ session: StaffSession; rawToken: string }> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const rawToken = crypto.randomBytes(48).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const id = generateId();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await queryWithRetry(() => sql`
    INSERT INTO staff_sessions (id, organization_id, staff_id, device_id, token_hash, role, permissions, status, ip_address, user_agent, created_at, expires_at, last_active_at)
    VALUES (${id}, ${ctx.organizationId}, ${staffId}, ${deviceId || null}, ${tokenHash}, ${ctx.role}, ${JSON.stringify([])}, 'active', ${ipAddress || null}, ${userAgent || null}, NOW(), ${expiresAt}, NOW())
  `);

  const rows = await queryWithRetry(() => sql`SELECT * FROM staff_sessions WHERE id = ${id}`);
  return { session: rows[0] as StaffSession, rawToken };
}

export async function getSession(
  ctx: TenantContext,
  sessionId: string
): Promise<StaffSession | null> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const rows = await queryWithRetry(() =>
    sql`SELECT * FROM staff_sessions WHERE id = ${sessionId} AND organization_id = ${ctx.organizationId}`
  );
  return rows.length > 0 ? (rows[0] as StaffSession) : null;
}

export async function getActiveSessionsByStaff(
  ctx: TenantContext,
  staffId: string
): Promise<StaffSession[]> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const rows = await queryWithRetry(() =>
    sql`SELECT * FROM staff_sessions WHERE staff_id = ${staffId} AND organization_id = ${ctx.organizationId} AND status = 'active' ORDER BY created_at DESC`
  );
  return rows as StaffSession[];
}

export async function getActiveSessionsByOrg(
  ctx: TenantContext
): Promise<StaffSession[]> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const rows = await queryWithRetry(() =>
    sql`SELECT * FROM staff_sessions WHERE organization_id = ${ctx.organizationId} AND status = 'active' ORDER BY created_at DESC`
  );
  return rows as StaffSession[];
}

export async function refreshSession(
  ctx: TenantContext,
  sessionId: string
): Promise<StaffSession> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const existing = await queryWithRetry(() =>
    sql`SELECT * FROM staff_sessions WHERE id = ${sessionId} AND organization_id = ${ctx.organizationId}`
  );
  if (existing.length === 0) throw new Error('Session not found');

  await queryWithRetry(() => sql`
    UPDATE staff_sessions SET last_active_at = NOW()
    WHERE id = ${sessionId} AND organization_id = ${ctx.organizationId}
  `);

  const rows = await queryWithRetry(() => sql`SELECT * FROM staff_sessions WHERE id = ${sessionId}`);
  return rows[0] as StaffSession;
}

export async function revokeSession(
  ctx: TenantContext,
  sessionId: string,
  reason?: string
): Promise<StaffSession> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const existing = await queryWithRetry(() =>
    sql`SELECT * FROM staff_sessions WHERE id = ${sessionId} AND organization_id = ${ctx.organizationId}`
  );
  if (existing.length === 0) throw new Error('Session not found');

  await queryWithRetry(() => sql`
    UPDATE staff_sessions SET status = 'revoked', revoked_at = NOW(), revoked_reason = ${reason || null}
    WHERE id = ${sessionId} AND organization_id = ${ctx.organizationId}
  `);

  const rows = await queryWithRetry(() => sql`SELECT * FROM staff_sessions WHERE id = ${sessionId}`);
  return rows[0] as StaffSession;
}

export async function revokeAllStaffSessions(
  ctx: TenantContext,
  staffId: string,
  exceptSessionId?: string
): Promise<void> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  if (exceptSessionId) {
    await queryWithRetry(() => sql`
      UPDATE staff_sessions SET status = 'revoked', revoked_at = NOW(), revoked_reason = 'bulk_revoke'
      WHERE staff_id = ${staffId} AND organization_id = ${ctx.organizationId} AND status = 'active' AND id != ${exceptSessionId}
    `);
  } else {
    await queryWithRetry(() => sql`
      UPDATE staff_sessions SET status = 'revoked', revoked_at = NOW(), revoked_reason = 'bulk_revoke'
      WHERE staff_id = ${staffId} AND organization_id = ${ctx.organizationId} AND status = 'active'
    `);
  }
}

export async function revokeAllOrgSessions(
  ctx: TenantContext
): Promise<void> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  await queryWithRetry(() => sql`
    UPDATE staff_sessions SET status = 'revoked', revoked_at = NOW(), revoked_reason = 'org_bulk_revoke'
    WHERE organization_id = ${ctx.organizationId} AND status = 'active'
  `);
}

export async function getSessionsByDevice(
  ctx: TenantContext,
  deviceId: string
): Promise<StaffSession[]> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const rows = await queryWithRetry(() =>
    sql`SELECT * FROM staff_sessions WHERE device_id = ${deviceId} AND organization_id = ${ctx.organizationId} ORDER BY created_at DESC`
  );
  return rows as StaffSession[];
}

export async function cleanupExpiredSessions(): Promise<number> {
  const sql = getSql();

  const result = await queryWithRetry(() => sql`
    UPDATE staff_sessions SET status = 'expired'
    WHERE status = 'active' AND expires_at < NOW()
  `);

  return (result as any).rowCount || 0;
}

export async function getSessionStats(
  ctx: TenantContext
): Promise<{
  total: number;
  active: number;
  expired: number;
  revoked: number;
}> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const rows = await queryWithRetry(() =>
    sql`SELECT status, COUNT(*)::int as count FROM staff_sessions WHERE organization_id = ${ctx.organizationId} GROUP BY status`
  );

  const stats = { total: 0, active: 0, expired: 0, revoked: 0 };
  for (const row of rows) {
    const r = row as any;
    stats.total += r.count;
    if (r.status === 'active') stats.active = r.count;
    else if (r.status === 'expired') stats.expired = r.count;
    else if (r.status === 'revoked') stats.revoked = r.count;
  }

  return stats;
}
