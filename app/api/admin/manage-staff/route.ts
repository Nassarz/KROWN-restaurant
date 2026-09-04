import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/neon-server';
import { extractTenantContext, setTenantContext } from '@/lib/tenant';
import { hashPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const ctx = extractTenantContext(req);
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Super Admin, Restaurant Admin, Branch Manager, or Manager can manage staff
  const allowedRoles = ['super_admin', 'restaurant_admin', 'branch_manager', 'manager'];
  if (!allowedRoles.includes(ctx.role)) {
    return NextResponse.json({ error: 'Forbidden: Insufficient permissions to manage staff' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { action, staffId, password, pin, status, role } = body;
    const sql = getSql();
    await setTenantContext(sql, ctx.organizationId);

    if (!action || !staffId) {
      return NextResponse.json({ error: 'Both action and staffId are required' }, { status: 400 });
    }

    if (action === 'delete') {
      await sql('DELETE FROM staff WHERE id = $1 AND organization_id = $2', [staffId, ctx.organizationId]);
      return NextResponse.json({ success: true, message: 'Staff member deleted successfully' });
    }

    if (action === 'reset_password') {
      if (!password || password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
      }
      const hashedPassword = await hashPassword(password);
      const updateParts: string[] = ['password_argon2 = $1'];
      const updateValues: any[] = [hashedPassword];
      let paramIdx = 2;
      if (pin) {
        const { hashPassword: hp } = await import('@/lib/auth');
        const hashedPin = await hp(pin);
        updateParts.push(`pin_argon2 = $${paramIdx}`);
        updateValues.push(hashedPin);
        paramIdx++;
      }
      updateValues.push(staffId, ctx.organizationId);
      await sql(`UPDATE staff SET ${updateParts.join(', ')} WHERE id = $${paramIdx} AND organization_id = $${paramIdx + 1}`, updateValues);
      return NextResponse.json({ success: true, message: 'Password and PIN updated successfully' });
    }

    if (action === 'update_status') {
      if (!status) {
        return NextResponse.json({ error: 'Status value is required' }, { status: 400 });
      }
      await sql('UPDATE staff SET status = $1 WHERE id = $2 AND organization_id = $3', [status, staffId, ctx.organizationId]);
      return NextResponse.json({ success: true, message: `Staff status updated to ${status}` });
    }

    if (action === 'update_role') {
      if (!role) {
        return NextResponse.json({ error: 'Role value is required' }, { status: 400 });
      }
      // Prevent self-role-escalation
      if (staffId === ctx.userId && role === 'super_admin') {
        return NextResponse.json({ error: 'Cannot self-promote to Super Admin' }, { status: 403 });
      }
      await sql('UPDATE staff SET role = $1 WHERE id = $2 AND organization_id = $3', [role, staffId, ctx.organizationId]);
      return NextResponse.json({ success: true, message: `Role updated to ${role}` });
    }

    if (action === 'promote_admin') {
      // Only existing Super Admins can promote
      if (ctx.role !== 'super_admin') {
        return NextResponse.json({ error: 'Only Super Admins can promote staff' }, { status: 403 });
      }
      await sql(
        "UPDATE staff SET role = 'super_admin', assigned_branch_id = NULL, branch = 'Global HQ' WHERE id = $1 AND organization_id = $2",
        [staffId, ctx.organizationId]
      );
      return NextResponse.json({ success: true, message: 'Staff promoted to Super Admin' });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('[ManageStaff] Unexpected server error:', err?.message || err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error managing staff member' },
      { status: 500 }
    );
  }
}
