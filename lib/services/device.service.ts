// KROWN POS — Device Management Service
import { getSql, queryWithRetry } from '@/lib/neon-server';
import { TenantContext, setTenantContext } from '@/lib/tenant';
import { generateId } from '@/lib/id';
import { logAudit } from '@/lib/audit';
import * as crypto from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────
export interface Device {
  id: string;
  organization_id: string;
  device_fingerprint: string;
  device_name: string;
  device_type: 'pos' | 'kitchen' | 'waiter_tablet' | 'manager_desk' | 'admin_desk' | 'general';
  enrollment_token_hash?: string;
  enrolled_at?: string;
  enrolled_by?: string;
  status: 'pending' | 'active' | 'suspended' | 'revoked';
  trust_status: 'untrusted' | 'pending' | 'trusted' | 'revoked';
  browser?: string;
  operating_system?: string;
  ip_address?: string;
  user_agent?: string;
  allowed_roles: string[];
  last_seen_at?: string;
  last_staff_id?: string;
  revoked_at?: string;
  revoked_by?: string;
  created_at: string;
  updated_at: string;
}

export interface DeviceFilters {
  status?: Device['status'];
  deviceType?: Device['device_type'];
  search?: string;
}

// ── Service Methods ────────────────────────────────────────────────────────

export async function listDevices(
  ctx: TenantContext,
  filters?: DeviceFilters
): Promise<Device[]> {
  const sql = getSql();
  if (!ctx.isSuperAdmin) {
    await setTenantContext(sql, ctx.organizationId);
  }

  let rows;
  if (ctx.isSuperAdmin) {
    if (filters?.status && filters?.deviceType) {
      rows = await queryWithRetry(() =>
        sql`SELECT d.*, o.name as organization_name FROM devices d LEFT JOIN organizations o ON o.id = d.organization_id WHERE d.status = ${filters.status} AND d.device_type = ${filters.deviceType} ORDER BY d.created_at DESC`
      );
    } else if (filters?.status) {
      rows = await queryWithRetry(() =>
        sql`SELECT d.*, o.name as organization_name FROM devices d LEFT JOIN organizations o ON o.id = d.organization_id WHERE d.status = ${filters.status} ORDER BY d.created_at DESC`
      );
    } else if (filters?.deviceType) {
      rows = await queryWithRetry(() =>
        sql`SELECT d.*, o.name as organization_name FROM devices d LEFT JOIN organizations o ON o.id = d.organization_id WHERE d.device_type = ${filters.deviceType} ORDER BY d.created_at DESC`
      );
    } else {
      rows = await queryWithRetry(() =>
        sql`SELECT d.*, o.name as organization_name FROM devices d LEFT JOIN organizations o ON o.id = d.organization_id ORDER BY d.created_at DESC`
      );
    }
  } else {
    if (filters?.status && filters?.deviceType) {
      rows = await queryWithRetry(() =>
        sql`SELECT * FROM devices WHERE organization_id = ${ctx.organizationId} AND status = ${filters.status} AND device_type = ${filters.deviceType} ORDER BY created_at DESC`
      );
    } else if (filters?.status) {
      rows = await queryWithRetry(() =>
        sql`SELECT * FROM devices WHERE organization_id = ${ctx.organizationId} AND status = ${filters.status} ORDER BY created_at DESC`
      );
    } else if (filters?.deviceType) {
      rows = await queryWithRetry(() =>
        sql`SELECT * FROM devices WHERE organization_id = ${ctx.organizationId} AND device_type = ${filters.deviceType} ORDER BY created_at DESC`
      );
    } else {
      rows = await queryWithRetry(() =>
        sql`SELECT * FROM devices WHERE organization_id = ${ctx.organizationId} ORDER BY created_at DESC`
      );
    }
  }

  return rows as Device[];
}

export async function getDevice(
  ctx: TenantContext,
  deviceId: string
): Promise<Device | null> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const rows = await queryWithRetry(() =>
    sql`SELECT * FROM devices WHERE id = ${deviceId} AND organization_id = ${ctx.organizationId}`
  );
  return rows.length > 0 ? (rows[0] as Device) : null;
}

export async function registerDevice(
  ctx: TenantContext,
  input: {
    deviceFingerprint: string;
    deviceName: string;
    deviceType: Device['device_type'];
    browser?: string;
    operatingSystem?: string;
    ipAddress?: string;
    userAgent?: string;
    allowedRoles?: string[];
  }
): Promise<Device> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const id = generateId();

  await queryWithRetry(() => sql`
    INSERT INTO devices (id, organization_id, device_fingerprint, device_name, device_type, status, trust_status, browser, operating_system, ip_address, user_agent, allowed_roles, created_at, updated_at)
    VALUES (${id}, ${ctx.organizationId}, ${input.deviceFingerprint}, ${input.deviceName}, ${input.deviceType}, 'pending', 'untrusted', ${input.browser || null}, ${input.operatingSystem || null}, ${input.ipAddress || null}, ${input.userAgent || null}, ${JSON.stringify(input.allowedRoles || [])}, NOW(), NOW())
  `);

  await logAudit(ctx.userId, 'device.register', { deviceId: id, deviceName: input.deviceName, deviceType: input.deviceType }, ctx.organizationId, ctx.branchId);

  const rows = await queryWithRetry(() => sql`SELECT * FROM devices WHERE id = ${id}`);
  return rows[0] as Device;
}

export async function activateDevice(
  ctx: TenantContext,
  deviceId: string
): Promise<Device> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const existing = await queryWithRetry(() =>
    sql`SELECT * FROM devices WHERE id = ${deviceId} AND organization_id = ${ctx.organizationId}`
  );
  if (existing.length === 0) throw new Error('Device not found');

  await queryWithRetry(() => sql`
    UPDATE devices SET status = 'active', trust_status = 'pending', updated_at = NOW()
    WHERE id = ${deviceId} AND organization_id = ${ctx.organizationId}
  `);

  await logAudit(ctx.userId, 'device.activate', { deviceId }, ctx.organizationId, ctx.branchId);

  const rows = await queryWithRetry(() => sql`SELECT * FROM devices WHERE id = ${deviceId}`);
  return rows[0] as Device;
}

export async function suspendDevice(
  ctx: TenantContext,
  deviceId: string
): Promise<Device> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const existing = await queryWithRetry(() =>
    sql`SELECT * FROM devices WHERE id = ${deviceId} AND organization_id = ${ctx.organizationId}`
  );
  if (existing.length === 0) throw new Error('Device not found');

  await queryWithRetry(() => sql`
    UPDATE devices SET status = 'suspended', updated_at = NOW()
    WHERE id = ${deviceId} AND organization_id = ${ctx.organizationId}
  `);

  await logAudit(ctx.userId, 'device.suspend', { deviceId }, ctx.organizationId, ctx.branchId);

  const rows = await queryWithRetry(() => sql`SELECT * FROM devices WHERE id = ${deviceId}`);
  return rows[0] as Device;
}

export async function revokeDevice(
  ctx: TenantContext,
  deviceId: string,
  reason?: string
): Promise<Device> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const existing = await queryWithRetry(() =>
    sql`SELECT * FROM devices WHERE id = ${deviceId} AND organization_id = ${ctx.organizationId}`
  );
  if (existing.length === 0) throw new Error('Device not found');

  await queryWithRetry(() => sql`
    UPDATE devices SET status = 'revoked', trust_status = 'revoked', revoked_at = NOW(), revoked_by = ${ctx.userId}, updated_at = NOW()
    WHERE id = ${deviceId} AND organization_id = ${ctx.organizationId}
  `);

  await logAudit(ctx.userId, 'device.revoke', { deviceId, reason }, ctx.organizationId, ctx.branchId);

  const rows = await queryWithRetry(() => sql`SELECT * FROM devices WHERE id = ${deviceId}`);
  return rows[0] as Device;
}

export async function updateDevice(
  ctx: TenantContext,
  deviceId: string,
  updates: Partial<Pick<Device, 'device_name' | 'device_type' | 'allowed_roles'>>
): Promise<Device> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const existing = await queryWithRetry(() =>
    sql`SELECT * FROM devices WHERE id = ${deviceId} AND organization_id = ${ctx.organizationId}`
  );
  if (existing.length === 0) throw new Error('Device not found');

  const fields: string[] = [];
  const values: any[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      fields.push(key);
      values.push(key === 'allowed_roles' ? JSON.stringify(value) : value);
    }
  }

  if (fields.length === 0) return existing[0] as Device;

  const setClauses = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  values.push(deviceId, ctx.organizationId);

  await queryWithRetry(() =>
    sql(`UPDATE devices SET ${setClauses}, updated_at = NOW() WHERE id = $${fields.length + 1} AND organization_id = $${fields.length + 2}`, values)
  );

  await logAudit(ctx.userId, 'device.update', { deviceId, fields }, ctx.organizationId, ctx.branchId);

  const rows = await queryWithRetry(() => sql`SELECT * FROM devices WHERE id = ${deviceId}`);
  return rows[0] as Device;
}

export async function heartbeatDevice(
  ctx: TenantContext,
  deviceId: string,
  staffId?: string
): Promise<Device> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const existing = await queryWithRetry(() =>
    sql`SELECT * FROM devices WHERE id = ${deviceId} AND organization_id = ${ctx.organizationId}`
  );
  if (existing.length === 0) throw new Error('Device not found');

  await queryWithRetry(() => sql`
    UPDATE devices SET last_seen_at = NOW(), last_staff_id = ${staffId || null}, updated_at = NOW()
    WHERE id = ${deviceId} AND organization_id = ${ctx.organizationId}
  `);

  const rows = await queryWithRetry(() => sql`SELECT * FROM devices WHERE id = ${deviceId}`);
  return rows[0] as Device;
}

export async function generateEnrollmentToken(
  ctx: TenantContext,
  deviceType: Device['device_type'],
  deviceName: string,
  allowedRoles: string[]
): Promise<{ token: string; deviceId: string }> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const id = generateId();

  await queryWithRetry(() => sql`
    INSERT INTO devices (id, organization_id, device_fingerprint, device_name, device_type, enrollment_token_hash, status, trust_status, allowed_roles, created_at, updated_at)
    VALUES (${id}, ${ctx.organizationId}, '', ${deviceName}, ${deviceType}, ${tokenHash}, 'pending', 'untrusted', ${JSON.stringify(allowedRoles)}, NOW(), NOW())
  `);

  await logAudit(ctx.userId, 'device.generate_enrollment_token', { deviceId: id, deviceType, deviceName }, ctx.organizationId, ctx.branchId);

  return { token, deviceId: id };
}

export async function enrollDevice(
  ctx: TenantContext,
  token: string,
  deviceFingerprint: string,
  metadata: {
    browser?: string;
    operatingSystem?: string;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<Device> {
  const sql = getSql();

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const rows = await queryWithRetry(() =>
    sql`SELECT * FROM devices WHERE enrollment_token_hash = ${tokenHash} AND status = 'pending' LIMIT 1`
  );

  if (rows.length === 0) throw new Error('Invalid or expired enrollment token');

  const device = rows[0] as Device;

  await queryWithRetry(() => sql`
    UPDATE devices SET
      device_fingerprint = ${deviceFingerprint},
      status = 'active',
      trust_status = 'pending',
      enrolled_at = NOW(),
      enrolled_by = ${ctx.userId},
      browser = ${metadata.browser || null},
      operating_system = ${metadata.operatingSystem || null},
      ip_address = ${metadata.ipAddress || null},
      user_agent = ${metadata.userAgent || null},
      updated_at = NOW()
    WHERE id = ${device.id} AND organization_id = ${ctx.organizationId}
  `);

  await logAudit(ctx.userId, 'device.enroll', { deviceId: device.id, deviceFingerprint }, ctx.organizationId, ctx.branchId);

  const updated = await queryWithRetry(() => sql`SELECT * FROM devices WHERE id = ${device.id}`);
  return updated[0] as Device;
}

export async function getDeviceStats(
  ctx: TenantContext
): Promise<{
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
}> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const totalRows = await queryWithRetry(() =>
    sql`SELECT COUNT(*)::int as count FROM devices WHERE organization_id = ${ctx.organizationId}`
  );
  const total = (totalRows[0] as any).count;

  const statusRows = await queryWithRetry(() =>
    sql`SELECT status, COUNT(*)::int as count FROM devices WHERE organization_id = ${ctx.organizationId} GROUP BY status`
  );
  const byStatus: Record<string, number> = {};
  for (const row of statusRows) {
    byStatus[(row as any).status] = (row as any).count;
  }

  const typeRows = await queryWithRetry(() =>
    sql`SELECT device_type, COUNT(*)::int as count FROM devices WHERE organization_id = ${ctx.organizationId} GROUP BY device_type`
  );
  const byType: Record<string, number> = {};
  for (const row of typeRows) {
    byType[(row as any).device_type] = (row as any).count;
  }

  return { total, byStatus, byType };
}

export async function lookupDeviceByFingerprint(
  ctx: TenantContext,
  fingerprint: string
): Promise<Device | null> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const rows = await queryWithRetry(() =>
    sql`SELECT * FROM devices WHERE device_fingerprint = ${fingerprint} AND organization_id = ${ctx.organizationId} AND status = 'active' LIMIT 1`
  );
  return rows.length > 0 ? (rows[0] as Device) : null;
}
