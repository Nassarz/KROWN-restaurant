import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { getSql } from '@/lib/neon-server';
import { logAuditEvent } from '@/lib/audit';

export async function GET(request: NextRequest) {
  const ctx = extractTenantContext(request);
  if (!ctx || ctx.role !== 'super_admin') {
    return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
  }

  const sql = getSql();

  try {
    const activeSessions = await sql`
      SELECT 
        ss.id, ss.staff_id, ss.device_info, ss.ip_address, ss.created_at, ss.expires_at,
        s.name as staff_name, s.email as staff_email, s.role as staff_role,
        o.name as organization_name
      FROM staff_sessions ss
      JOIN staff s ON s.id = ss.staff_id
      LEFT JOIN organizations o ON o.id = s.organization_id
      WHERE ss.expires_at > NOW()
      ORDER BY ss.created_at DESC
      LIMIT 100
    `;

    return NextResponse.json({ data: activeSessions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch active sessions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = extractTenantContext(request);
  if (!ctx || ctx.role !== 'super_admin') {
    return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
  }

  const sql = getSql();

  try {
    const { sessionId, staffId } = await request.json();

    if (sessionId) {
      await sql`DELETE FROM staff_sessions WHERE id = ${sessionId}`;
    } else if (staffId) {
      await sql`DELETE FROM staff_sessions WHERE staff_id = ${staffId}`;
    } else {
      return NextResponse.json({ error: 'Session ID or Staff ID required' }, { status: 400 });
    }

    await logAuditEvent({
      userId: ctx.userId,
      userEmail: ctx.userId,
      actorRole: 'super_admin',
      action: 'SUPER_ADMIN_REVOKE_SESSION',
      details: { sessionId, staffId },
    });

    return NextResponse.json({ success: true, message: 'Session revoked successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to revoke session' }, { status: 500 });
  }
}
