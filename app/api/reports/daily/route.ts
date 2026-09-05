import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { getSql } from '@/lib/neon-server';
import { hasPermission } from '@/lib/rbac';

export async function GET(request: NextRequest) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(ctx.role, 'reports:view')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const sql = getSql();
    const date = request.nextUrl.searchParams.get('date') || new Date().toISOString().split('T')[0];
    const branchId = request.nextUrl.searchParams.get('branch_id') || ctx.branchId;

    let rows: any[];
    if (branchId) {
      rows = await sql`
        SELECT DATE(created_at) as date, COUNT(*)::int as total_orders,
               COALESCE(SUM(total), 0)::numeric as total_revenue,
               COUNT(CASE WHEN status = 'completed' THEN 1 END)::int as completed,
               COUNT(CASE WHEN status = 'cancelled' THEN 1 END)::int as cancelled,
               COUNT(CASE WHEN status = 'pending' THEN 1 END)::int as pending
        FROM orders WHERE organization_id = ${ctx.organizationId}
          AND DATE(created_at) = ${date} AND restaurant_id = ${branchId}
        GROUP BY DATE(created_at)`;
    } else {
      rows = await sql`
        SELECT DATE(created_at) as date, COUNT(*)::int as total_orders,
               COALESCE(SUM(total), 0)::numeric as total_revenue,
               COUNT(CASE WHEN status = 'completed' THEN 1 END)::int as completed,
               COUNT(CASE WHEN status = 'cancelled' THEN 1 END)::int as cancelled,
               COUNT(CASE WHEN status = 'pending' THEN 1 END)::int as pending
        FROM orders WHERE organization_id = ${ctx.organizationId}
          AND DATE(created_at) = ${date}
        GROUP BY DATE(created_at)`;
    }

    return NextResponse.json({ data: rows[0] || { date, total_orders: 0, total_revenue: 0 } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}
