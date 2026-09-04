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
  const search = searchParams.get('search')?.trim() || '';
  const role = searchParams.get('role')?.trim() || 'all';
  const status = searchParams.get('status')?.trim() || 'all';
  const orgId = searchParams.get('organizationId')?.trim() || 'all';
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const offset = (page - 1) * limit;

  try {
    const searchPattern = search ? `%${search}%` : null;

    const users = await sql`
      SELECT 
        s.id, s.name, s.email, s.phone, s.role, s.status, s.assigned_branch_id, s.organization_id,
        s.created_at, s.last_login_at,
        o.name as organization_name,
        b.name as branch_name
      FROM staff s
      LEFT JOIN organizations o ON o.id = s.organization_id
      LEFT JOIN branches b ON b.id = s.assigned_branch_id
      WHERE 
        (${searchPattern}::text IS NULL OR s.name ILIKE ${searchPattern} OR s.email ILIKE ${searchPattern} OR s.phone ILIKE ${searchPattern})
        AND (${role} = 'all' OR s.role = ${role})
        AND (${status} = 'all' OR s.status = ${status})
        AND (${orgId} = 'all' OR s.organization_id = ${orgId})
      ORDER BY s.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const countResult = await sql`
      SELECT COUNT(*)::int as total
      FROM staff s
      WHERE 
        (${searchPattern}::text IS NULL OR s.name ILIKE ${searchPattern} OR s.email ILIKE ${searchPattern} OR s.phone ILIKE ${searchPattern})
        AND (${role} = 'all' OR s.role = ${role})
        AND (${status} = 'all' OR s.status = ${status})
        AND (${orgId} = 'all' OR s.organization_id = ${orgId})
    `;

    return NextResponse.json({
      data: users,
      meta: {
        total: Number(countResult[0]?.total ?? 0),
        page,
        limit,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch users' }, { status: 500 });
  }
}
