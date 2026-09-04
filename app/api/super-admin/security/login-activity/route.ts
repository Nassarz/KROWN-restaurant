import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { getSql } from '@/lib/neon-server';

export async function GET(request: NextRequest) {
  const ctx = extractTenantContext(request);
  if (!ctx || ctx.role !== 'super_admin') {
    return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
  }

  const sql = getSql();
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const status = searchParams.get('status') || 'all'; // 'all', 'success', 'failure'

  try {
    const loginEvents = await sql`
      SELECT 
        al.id, al.user_email, al.action, al.ip_address, al.user_agent, al.result, al.reason, al.created_at,
        o.name as organization_name
      FROM audit_logs al
      LEFT JOIN organizations o ON o.id = al.organization_id
      WHERE al.action IN ('STAFF_LOGIN', 'PIN_LOGIN', 'SUPER_ADMIN_LOGIN', 'FAILED_LOGIN', 'FAILED_PIN_LOGIN')
        AND (${status} = 'all' OR al.result = ${status})
      ORDER BY al.created_at DESC
      LIMIT ${limit}
    `;

    return NextResponse.json({ data: loginEvents });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch login activity' }, { status: 500 });
  }
}
