import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { getSql } from '@/lib/neon-server';
import { hashPassword } from '@/lib/auth';
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
    const { pin } = await request.json();
    if (!pin || !/^\d{4,6}$/.test(pin)) {
      return NextResponse.json({ error: 'PIN must be 4 to 6 numeric digits' }, { status: 400 });
    }

    const staffRows = await sql`SELECT id, name, email, organization_id FROM staff WHERE id = ${userId} LIMIT 1`;
    if (staffRows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const staff = staffRows[0];

    const argon2Hash = await hashPassword(pin);

    await sql`
      UPDATE staff
      SET 
        pin_hash = ${argon2Hash},
        pin_argon2 = ${argon2Hash},
        updated_at = NOW()
      WHERE id = ${userId}
    `;

    await sql`DELETE FROM staff_pin_lockouts WHERE staff_id = ${userId}`;

    await logAuditEvent({
      organizationId: staff.organization_id,
      userId: ctx.userId,
      userEmail: ctx.userId,
      actorRole: 'super_admin',
      action: 'SUPER_ADMIN_PIN_RESET',
      targetType: 'staff',
      targetId: userId,
      details: { targetEmail: staff.email },
    });

    return NextResponse.json({ success: true, message: 'PIN reset successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to reset PIN' }, { status: 500 });
  }
}
