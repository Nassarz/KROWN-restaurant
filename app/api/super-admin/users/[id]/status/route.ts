import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { getSql } from '@/lib/neon-server';
import { logAuditEvent } from '@/lib/audit';

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const ctx = extractTenantContext(request);
  if (!ctx || ctx.role !== 'super_admin') {
    return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
  }

  const sql = getSql();
  const userId = params.id;

  try {
    const { status } = await request.json();
    if (!['active', 'suspended', 'inactive', 'on_leave'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const staffRows = await sql`SELECT id, name, email, organization_id, status FROM staff WHERE id = ${userId} LIMIT 1`;
    if (staffRows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const staff = staffRows[0];

    await sql`UPDATE staff SET status = ${status}, updated_at = NOW() WHERE id = ${userId}`;

    if (status === 'suspended') {
      await sql`DELETE FROM staff_sessions WHERE staff_id = ${userId}`;
      await sql`DELETE FROM staff_pin_lockouts WHERE staff_id = ${userId}`;
    } else if (status === 'active') {
      await sql`DELETE FROM staff_pin_lockouts WHERE staff_id = ${userId}`;
    }

    await logAuditEvent({
      organizationId: staff.organization_id,
      userId: ctx.userId,
      userEmail: ctx.userId,
      actorRole: 'super_admin',
      action: `SUPER_ADMIN_USER_STATUS_${status.toUpperCase()}`,
      targetType: 'staff',
      targetId: userId,
      details: { previousStatus: staff.status, newStatus: status, userEmail: staff.email },
    });

    return NextResponse.json({ success: true, status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update user status' }, { status: 500 });
  }
}
