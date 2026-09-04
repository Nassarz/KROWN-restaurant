import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/neon-server';
import { extractTenantContext, setTenantContext } from '@/lib/tenant';
import { hasPermission } from '@/lib/rbac';

export async function GET(request: NextRequest) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPermission(ctx.role, 'inventory:view') && !hasPermission(ctx.role, 'inventory:read')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const sql = getSql();
    await setTenantContext(sql, ctx.organizationId);

    const branchId = request.nextUrl.searchParams.get('branchId');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '100', 10);

    let rows;
    if (branchId) {
      rows = await sql`
        SELECT * FROM inventory_movements
        WHERE branch_id = ${branchId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    } else {
      rows = await sql`
        SELECT * FROM inventory_movements
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    }

    return NextResponse.json({ data: rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to list inventory movements' }, { status: 500 });
  }
}
