import { randomInt, createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { extractVerifiedTenantContext } from '@/lib/tenant';
import { getSql } from '@/lib/neon-server';
import { assertBranchAccess } from '@/lib/access-control';
import { hasPermission } from '@/lib/rbac';

const ALLOWED_DEVICE_TYPES = new Set(['pos', 'kitchen', 'waiter_tablet', 'manager_desk', 'admin_desk', 'tablet', 'mobile', 'general']);
const ALLOWED_ROLES = new Set([
  'cashier', 'waiter', 'senior_waiter', 'head_chef', 'chef', 'kitchen_staff',
  'branch_manager', 'manager', 'restaurant_admin', 'admin', 'super_admin',
]);

function activationPin() {
  return String(randomInt(10_000_000, 100_000_000));
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await extractVerifiedTenantContext(request);
    if (!ctx) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(ctx.role, 'devices:create')) return NextResponse.json({ data: null, error: 'Insufficient permissions' }, { status: 403 });

    const body = await request.json();
    const branchId = String(body.branchId || ctx.branchId || '').trim();
    const deviceType = String(body.deviceType || '').trim();
    const deviceName = String(body.deviceName || '').trim();
    const allowedRoles = Array.isArray(body.allowedRoles)
      ? body.allowedRoles.map((r: unknown) => String(r).trim()).filter((r: string) => ALLOWED_ROLES.has(r)).slice(0, 20)
      : [];

    if (!branchId || !deviceType || !deviceName) return NextResponse.json({ data: null, error: 'Restaurant branch, device type and device name are required' }, { status: 400 });
    if (!ALLOWED_DEVICE_TYPES.has(deviceType)) return NextResponse.json({ data: null, error: 'Unsupported device type' }, { status: 400 });
    if (deviceName.length > 120) return NextResponse.json({ data: null, error: 'Device name is too long' }, { status: 400 });
    if (allowedRoles.length === 0) return NextResponse.json({ data: null, error: 'Select at least one staff role for this device' }, { status: 400 });

    await assertBranchAccess(ctx, branchId);
    const sql = getSql();
    const branch = await sql`SELECT id,organization_id,name FROM branches WHERE id=${branchId} LIMIT 1`;
    if (!branch.length || (!ctx.isSuperAdmin && (branch[0] as any).organization_id !== ctx.organizationId)) {
      return NextResponse.json({ data: null, error: 'Branch not found' }, { status: 404 });
    }

    const organizationId = (branch[0] as any).organization_id;
    // The activation PIN is the one-time enrollment secret. Only its SHA-256
    // digest is stored in Neon. It expires after 10 minutes and is atomically consumed.
    const token = activationPin();
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await sql`
      INSERT INTO device_enrollment_tokens
        (organization_id, branch_id, token_hash, device_type, device_name, allowed_roles, used, expires_at, created_by, created_at)
      VALUES
        (${organizationId}, ${branchId}, ${tokenHash}, ${deviceType}, ${deviceName},
         ${JSON.stringify(allowedRoles)}::jsonb, false, ${expiresAt}, ${ctx.userId}, NOW())
    `;

    return NextResponse.json({
      data: {
        activationPin: token,
        token,
        branchId,
        organizationId,
        branchName: (branch[0] as any).name,
        deviceType,
        deviceName,
        allowedRoles,
        expiresAt,
        expiresInSeconds: 600,
        qrPayload: `KROWN-ACTIVATE:${token}`,
      },
    }, { status: 201 });
  } catch (e: any) {
    const message = e?.message || 'Unable to create device activation';
    const status = /Forbidden|insufficient/i.test(message) ? 403 : 400;
    return NextResponse.json({ data: null, error: message }, { status });
  }
}
