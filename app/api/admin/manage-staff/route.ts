import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/neon-server';
import { extractVerifiedTenantContext } from '@/lib/tenant';
import { hashPassword } from '@/lib/auth';
import { hasPermission, canManageRole, normalizeRole, isPlatformRole } from '@/lib/rbac';
import { logAudit } from '@/lib/audit';
import { assertBranchAccess } from '@/lib/access-control';

function forbidden(message: string) { return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message } }, { status: 403 }); }

export async function POST(req: NextRequest) {
  const ctx = await extractVerifiedTenantContext(req);
  if (!ctx) return NextResponse.json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Unauthorized' } }, { status: 401 });

  try {
    const body = await req.json();
    const { action, staffId, password, pin, status, role } = body;
    if (!action || !staffId) return NextResponse.json({ success: false, error: { code: 'INVALID_INPUT', message: 'Both action and staffId are required' } }, { status: 400 });

    const sql = getSql();
    // Platform Super Admins operate across tenants, so their lookup must not be
    // restricted by the Super Admin's own organization context.
    const rows = isPlatformRole(ctx.role)
      ? await sql`SELECT id, name, role, assigned_branch_id, organization_id, email FROM staff WHERE id=${staffId} LIMIT 1`
      : await sql`SELECT id, name, role, assigned_branch_id, organization_id, email FROM staff WHERE id=${staffId} AND organization_id=${ctx.organizationId} LIMIT 1`;
    if (!rows.length) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Staff member not found' } }, { status: 404 });
    const target = rows[0] as any;

    if (!isPlatformRole(ctx.role) && normalizeRole(ctx.role) !== 'restaurant_admin') {
      if (!ctx.branchId || target.assigned_branch_id !== ctx.branchId) return forbidden('You cannot manage staff from another branch');
      await assertBranchAccess(ctx, target.assigned_branch_id);
    }

    if (action === 'delete') {
      if (!hasPermission(ctx.role, 'staff:delete') || target.id === ctx.userId) return forbidden('You cannot delete this staff member');
      await sql`UPDATE staff SET status='deleted', updated_at=NOW() WHERE id=${staffId}${isPlatformRole(ctx.role) ? sql`` : sql` AND organization_id=${ctx.organizationId}`}`;
      await logAudit(ctx.userId, 'staff.delete', { staffId, organizationId: target.organization_id }, target.organization_id, ctx.branchId);
      return NextResponse.json({ success: true, data: { deleted: true } });
    }

    if (action === 'reset_password') {
      if (!isPlatformRole(ctx.role) && !hasPermission(ctx.role, 'staff:reset_password')) return forbidden('You do not have permission to reset passwords');
      if (typeof password !== 'string' || password.length < 8) return NextResponse.json({ success: false, error: { code: 'INVALID_INPUT', message: 'Password must be at least 8 characters' } }, { status: 400 });
      const hashedPassword = await hashPassword(password);
      if (isPlatformRole(ctx.role)) {
        await sql`UPDATE staff SET password_argon2=${hashedPassword}, password_hash=NULL, updated_at=NOW() WHERE id=${staffId}`;
      } else {
        await sql`UPDATE staff SET password_argon2=${hashedPassword}, password_hash=NULL, updated_at=NOW() WHERE id=${staffId} AND organization_id=${ctx.organizationId}`;
      }
      if (pin !== undefined) {
        if (typeof pin !== 'string' || !/^\d{4,8}$/.test(pin)) return NextResponse.json({ success: false, error: { code: 'INVALID_INPUT', message: 'PIN must contain 4 to 8 digits' } }, { status: 400 });
        const hashedPin = await hashPassword(pin);
        if (isPlatformRole(ctx.role)) {
          await sql`UPDATE staff SET pin_argon2=${hashedPin}, pin_code=NULL, updated_at=NOW() WHERE id=${staffId}`;
        } else {
          await sql`UPDATE staff SET pin_argon2=${hashedPin}, pin_code=NULL, updated_at=NOW() WHERE id=${staffId} AND organization_id=${ctx.organizationId}`;
        }
      }
      await sql`UPDATE staff_sessions SET status='revoked', revoked_at=NOW(), revoked_reason='credentials_reset' WHERE staff_id=${staffId} AND status='active'`;
      await logAudit(ctx.userId, 'staff.reset_credentials', { staffId, organizationId: target.organization_id, pinReset: pin !== undefined }, target.organization_id, ctx.branchId);
      return NextResponse.json({ success: true, data: { updated: true } });
    }

    if (action === 'update_status') {
      if (!hasPermission(ctx.role, 'staff:update_status') && !isPlatformRole(ctx.role)) return forbidden('You do not have permission to change staff status');
      const allowedStatuses = ['active', 'on_shift', 'off_shift', 'on_leave', 'paused', 'suspended', 'banned', 'deleted'];
      if (!allowedStatuses.includes(status)) return NextResponse.json({ success: false, error: { code: 'INVALID_INPUT', message: 'Invalid staff status' } }, { status: 400 });
      if (isPlatformRole(ctx.role)) await sql`UPDATE staff SET status=${status}, updated_at=NOW() WHERE id=${staffId}`;
      else await sql`UPDATE staff SET status=${status}, updated_at=NOW() WHERE id=${staffId} AND organization_id=${ctx.organizationId}`;
      if (['suspended', 'banned', 'deleted'].includes(status)) await sql`UPDATE staff_sessions SET status='revoked', revoked_at=NOW(), revoked_reason=${status} WHERE staff_id=${staffId} AND status='active'`;
      await logAudit(ctx.userId, 'staff.update_status', { staffId, status, organizationId: target.organization_id }, target.organization_id, ctx.branchId);
      return NextResponse.json({ success: true, data: { updated: true, status } });
    }

    if (action === 'update_role') {
      if (!hasPermission(ctx.role, 'staff:update') && !isPlatformRole(ctx.role)) return forbidden('You do not have permission to change roles');
      const normalized = normalizeRole(String(role || ''));
      if (!isPlatformRole(ctx.role) && !canManageRole(ctx.role, normalized)) return forbidden('You cannot assign this role');
      if (isPlatformRole(ctx.role)) await sql`UPDATE staff SET role=${normalized}, updated_at=NOW() WHERE id=${staffId}`;
      else await sql`UPDATE staff SET role=${normalized}, updated_at=NOW() WHERE id=${staffId} AND organization_id=${ctx.organizationId}`;
      await logAudit(ctx.userId, 'staff.update_role', { staffId, role: normalized, organizationId: target.organization_id }, target.organization_id, ctx.branchId);
      return NextResponse.json({ success: true, data: { updated: true, role: normalized } });
    }

    if (action === 'promote_admin') return forbidden('Super Admin promotion is disabled for tenant staff');

    return NextResponse.json({ success: false, error: { code: 'UNKNOWN_ACTION', message: `Unknown action: ${action}` } }, { status: 400 });
  } catch (err: unknown) {
    console.error('[ManageStaff] Unexpected server error:', err instanceof Error ? err.message : 'unknown error');
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error managing staff member' } }, { status: 500 });
  }
}
