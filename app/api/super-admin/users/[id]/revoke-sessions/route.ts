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
    const staffRows = await sql`SELECT id, name, email, organization_id FROM staff WHERE id = ${userId} LIMIT 1`;
    if (staffRows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const staff = staffRows[0];

    const result = await sql`DELETE FROM staff_sessions WHERE staff_id = ${userId}`;

    await logAuditEvent({
      organizationId: staff.organization_id,
      userId: ctx.userId,
      userEmail: ctx.userId,
      actorRole: 'super_admin',
      action: 'SUPER_ADMIN_REVOKE_USER_SESSIONS',
      targetType: 'staff',
      targetId: userId,
      details: { targetEmail: staff.email },
    });

    return NextResponse.json({ success: true, message: 'Active sessions revoked successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to revoke sessions' }, { status: 500 });
  }
}
