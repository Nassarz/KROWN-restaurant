import { NextRequest, NextResponse } from 'next/server';
import { extractVerifiedTenantContext } from '@/lib/tenant';
import { getSql } from '@/lib/neon-server';

export async function GET(request: NextRequest) {
  try {
    const ctx = await extractVerifiedTenantContext(request);
    if (!ctx || !ctx.isSuperAdmin) return NextResponse.json({ data: null, error: 'Super Admin access required' }, { status: 403 });

    const sql = getSql();
    const organizations = await sql`
      SELECT id, name, status
      FROM organizations
      WHERE status IS NULL OR status NOT IN ('deleted')
      ORDER BY name ASC
    `;
    const branches = await sql`
      SELECT id, organization_id, name, location, status
      FROM branches
      WHERE status IS NULL OR status NOT IN ('deleted')
      ORDER BY name ASC
    `;

    return NextResponse.json({ data: { organizations, branches } });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message || 'Unable to load device setup options' }, { status: 500 });
  }
}
