import { randomBytes, createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { extractVerifiedTenantContext } from '@/lib/tenant';
import { getSql } from '@/lib/neon-server';
import { assertBranchAccess } from '@/lib/access-control';
import { hasPermission } from '@/lib/rbac';

const ALLOWED_DEVICE_TYPES = new Set(['pos', 'kitchen', 'waiter_tablet', 'manager_desk', 'admin_desk', 'general']);

export async function POST(request: NextRequest) {
  try {
    const ctx = await extractVerifiedTenantContext(request);
    if (!ctx) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(ctx.role, 'devices:create')) return NextResponse.json({ data: null, error: 'Insufficient permissions' }, { status: 403 });

    const body = await request.json();
    const branchId = String(body.branchId || ctx.branchId || '').trim();
    const deviceType = String(body.deviceType || '').trim();
    const deviceName = String(body.deviceName || '').trim();
    const allowedRoles = Array.isArray(body.allowedRoles) ? body.allowedRoles.map((r: unknown) => String(r).trim()).filter(Boolean).slice(0, 20) : [];

    if (!branchId || !deviceType || !deviceName) return NextResponse.json({ data: null, error: 'branchId, deviceType and deviceName are required' }, { status: 400 });
    if (!ALLOWED_DEVICE_TYPES.has(deviceType)) return NextResponse.json({ data: null, error: 'Unsupported device type' }, { status: 400 });
    if (deviceName.length > 120) return NextResponse.json({ data: null, error: 'Device name is too long' }, { status: 400 });
    await assertBranchAccess(ctx, branchId);

    const sql = getSql();
    const branch = await sql`SELECT id,organization_id FROM branches WHERE id=${branchId} LIMIT 1`;
    if (!branch.length || (!ctx.isSuperAdmin && (branch[0] as any).organization_id !== ctx.organizationId)) return NextResponse.json({ data: null, error: 'Branch not found' }, { status: 404 });
    const organizationId = (branch[0] as any).organization_id;
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await sql`INSERT INTO device_enrollment_tokens (organization_id, branch_id, token_hash, device_type, device_name, allowed_roles, used, expires_at, created_by, created_at) VALUES (${organizationId},${branchId},${tokenHash},${deviceType},${deviceName},${JSON.stringify(allowedRoles)}::jsonb,false,${expiresAt},${ctx.userId},NOW())`;

    return NextResponse.json({ data: { token, branchId, deviceType, deviceName, expiresAt, expiresInSeconds: 600 } }, { status: 201 });
  } catch (e: any) {
    const message = e?.message || 'Unable to create enrollment token';
    const status = /Forbidden|insufficient/i.test(message) ? 403 : 400;
    return NextResponse.json({ data: null, error: message }, { status });
  }
}
