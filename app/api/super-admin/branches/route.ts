import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { getSql } from '@/lib/neon-server';

/**
 * Super Admin branch picker data source.
 * Always scopes the result to the requested restaurant so a branch from
 * another tenant can never be selected accidentally by the UI.
 */
export async function GET(request: NextRequest) {
  const ctx = await extractTenantContext(request);
  if (!ctx || ctx.role !== 'super_admin') {
    return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
  }

  const organizationId = request.nextUrl.searchParams.get('organizationId')?.trim();
  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
  }

  try {
    const sql = getSql();
    const rows = await sql`
      SELECT id, organization_id, name, location, city, status
      FROM branches
      WHERE organization_id = ${organizationId}
      ORDER BY name ASC
    `;

    return NextResponse.json({ data: rows });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to load restaurant branches' },
      { status: 500 }
    );
  }
}
