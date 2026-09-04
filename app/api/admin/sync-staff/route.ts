import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/neon-server';
import { extractTenantContext, setTenantContext } from '@/lib/tenant';

export async function POST(req: NextRequest) {
  const ctx = extractTenantContext(req);
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Super Admin, Restaurant Admin, Branch Manager, or Manager can sync staff
  const allowedRoles = ['super_admin', 'restaurant_admin', 'branch_manager', 'manager'];
  if (!allowedRoles.includes(ctx.role)) {
    return NextResponse.json({ error: 'Forbidden: Insufficient permissions to sync staff' }, { status: 403 });
  }

  try {
    const sql = getSql();
    await setTenantContext(sql, ctx.organizationId);

    // Return staff from this organization, scoped to branch for non-super-admins
    let allStaff;
    if (ctx.role === 'super_admin' || ctx.role === 'restaurant_admin') {
      allStaff = await sql(
        'SELECT id, name, email, role, branch, assigned_branch_id, status, avatar, phone, id_type, id_number FROM staff WHERE organization_id = $1 ORDER BY created_at DESC',
        [ctx.organizationId]
      );
    } else if (ctx.branchId) {
      allStaff = await sql(
        'SELECT id, name, email, role, branch, assigned_branch_id, status, avatar, phone, id_type, id_number FROM staff WHERE organization_id = $1 AND assigned_branch_id = $2 ORDER BY created_at DESC',
        [ctx.organizationId, ctx.branchId]
      );
    } else {
      allStaff = await sql(
        'SELECT id, name, email, role, branch, assigned_branch_id, status, avatar, phone, id_type, id_number FROM staff WHERE organization_id = $1 ORDER BY created_at DESC',
        [ctx.organizationId]
      );
    }

    return NextResponse.json({
      success: true,
      message: `Staff synced successfully. Total staff members: ${allStaff.length}`,
      staff: allStaff.map((row: any) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role || 'Senior Waiter',
        branch: row.branch || 'Global HQ',
        assignedBranchId: row.assigned_branch_id || null,
        status: row.status || 'active',
        avatar: row.avatar,
        phone: row.phone,
        idType: row.id_type,
        idNumber: row.id_number,
      }))
    });
  } catch (err: any) {
    console.error('[SyncStaff API] Error:', err);
    return NextResponse.json({ error: err?.message || 'Server error syncing staff' }, { status: 500 });
  }
}
