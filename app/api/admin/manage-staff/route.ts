import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/neon-server';
import { extractTenantContext } from '@/lib/tenant';
import { hashPassword } from '@/lib/auth';
import { hasPermission, canManageRole, normalizeRole, isPlatformRole } from '@/lib/rbac';
import { logAudit } from '@/lib/audit';

function forbidden(message: string) { return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message } }, { status: 403 }); }

export async function POST(req: NextRequest) {
  const ctx = extractTenantContext(req);
  if (!ctx) return NextResponse.json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Unauthorized' } }, { status: 401 });

  try {
    const body = await req.json();
    const { action, staffId, password, pin, status, role } = body;
    if (!action || !staffId) return NextResponse.json({ success: false, error: { code: 'INVALID_INPUT', message: 'Both action and staffId are required' } }, { status: 400 });

    const sql = getSql();
    const rows = await sql`SELECT id, name, role, assigned_branch_id, organization_id FROM staff WHERE id=${staffId} AND organization_id=${ctx.organizationId} LIMIT 1`;
    if (!rows.length) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Staff member not found' } }, { status: 404 });
    const target = rows[0] as any;

    // Branch-scoped managers may only manage staff assigned to their own branch.
    if (!isPlatformRole(ctx.role) && normalizeRole(ctx.role) !== 'restaurant_admin' && target.assigned_branch_id !== ctx.branchId) {
      return forbidden('You cannot manage staff from another branch');
    }

    if (action === 'delete') {
      if (!hasPermission(ctx.role, 'staff:delete') || target.id === ctx.userId) return forbidden('You cannot delete this staff member');
      await sql`DELETE FROM staff WHERE id=${staffId} AND organization_id=${ctx.organizationId}`;
      await logAudit(ctx.userId, 'staff.delete', { staffId }, ctx.organizationId, ctx.branchId);
      return NextResponse.json({ success: true, data: { deleted: true } });
    }

    if (action === 'reset_password') {
      if (!hasPermission(ctx.role, 'staff:reset_password')) return forbidden('You do not have permission to reset passwords');
      if (typeof password !== 'string' || password.length < 6) return NextResponse.json({ success: false, error: { code: 'INVALID_INPUT', message: 'Password must be at least 6 characters' } }, { status: 400 });
      const hashedPassword = await hashPassword(password);
      await sql`UPDATE staff SET password_argon2=${hashedPassword}, password_hash=NULL, updated_at=NOW() WHERE id=${staffId} AND organization_id=${ctx.organizationId}`;
      if (pin !== undefined) {
        if (typeof pin !== 'string' || !/^\d{4,8}$/.test(pin)) return NextResponse.json({ success: false, error: { code: 'INVALID_INPUT', message: 'PIN must contain 4 to 8 digits' } }, { status: 400 });
        const hashedPin = await hashPassword(pin);
        await sql`UPDATE staff SET pin_argon2=${hashedPin}, pin_code=NULL, updated_at=NOW() WHERE id=${staffId} AND organization_id=${ctx.organizationId}`;
      }
      await logAudit(ctx.userId, 'staff.reset_credentials', { staffId, pinReset: pin !== undefined }, ctx.organizationId, ctx.branchId);
      return NextResponse.json({ success: true, data: { updated: true } });
    }

    if (action === 'update_status') {
      if (!hasPermission(ctx.role, 'staff:update_status')) return forbidden('You do not have permission to change staff status');
      const allowedStatuses = ['active', 'on_shift', 'off_shift', 'on_leave', 'paused', 'banned'];
      if (!allowedStatuses.includes(status)) return NextResponse.json({ success: false, error: { code: 'INVALID_INPUT', message: 'Invalid staff status' } }, { status: 400 });
      await sql`UPDATE staff SET status=${status}, updated_at=NOW() WHERE id=${staffId} AND organization_id=${ctx.organizationId}`;
      await logAudit(ctx.userId, 'staff.update_status', { staffId, status }, ctx.organizationId, ctx.branchId);
      return NextResponse.json({ success: true, data: { updated: true, status } });
    }

    if (action === 'update_role') {
      if (!hasPermission(ctx.role, 'staff:update')) return forbidden('You do not have permission to change roles');
      const normalized = normalizeRole(String(role || ''));
      if (!canManageRole(ctx.role, normalized)) return forbidden('You cannot assign this role');
      await sql`UPDATE staff SET role=${normalized}, updated_at=NOW() WHERE id=${staffId} AND organization_id=${ctx.organizationId}`;
      await logAudit(ctx.userId, 'staff.update_role', { staffId, role: normalized }, ctx.organizationId, ctx.branchId);
      return NextResponse.json({ success: true, data: { updated: true, role: normalized } });
    }

    if (action === 'promote_admin') {
      return forbidden('Super Admin promotion is disabled for tenant staff');
    }

    return NextResponse.json({ success: false, error: { code: 'UNKNOWN_ACTION', message: `Unknown action: ${action}` } }, { status: 400 });
  } catch (err: unknown) {
    console.error('[ManageStaff] Unexpected server error:', err instanceof Error ? err.message : 'unknown error');
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error managing staff member' } }, { status: 500 });
  }
}
