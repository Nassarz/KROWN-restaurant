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
    const period = request.nextUrl.searchParams.get('period') || 'today';
    const branchId = request.nextUrl.searchParams.get('branch_id') || ctx.branchId;

    let rows: any[];
    if (branchId) {
      if (period === 'week') {
        rows = await sql`
          SELECT COUNT(*)::int as total_orders, COALESCE(SUM(total), 0)::numeric as total_revenue,
                 COALESCE(AVG(total), 0)::numeric as avg_order_value,
                 COUNT(CASE WHEN status = 'completed' THEN 1 END)::int as completed_orders,
                 COUNT(CASE WHEN status = 'cancelled' THEN 1 END)::int as cancelled_orders
          FROM orders WHERE organization_id = ${ctx.organizationId}
            AND created_at >= NOW() - INTERVAL '7 days' AND restaurant_id = ${branchId}`;
      } else if (period === 'month') {
        rows = await sql`
          SELECT COUNT(*)::int as total_orders, COALESCE(SUM(total), 0)::numeric as total_revenue,
                 COALESCE(AVG(total), 0)::numeric as avg_order_value,
                 COUNT(CASE WHEN status = 'completed' THEN 1 END)::int as completed_orders,
                 COUNT(CASE WHEN status = 'cancelled' THEN 1 END)::int as cancelled_orders
          FROM orders WHERE organization_id = ${ctx.organizationId}
            AND created_at >= NOW() - INTERVAL '30 days' AND restaurant_id = ${branchId}`;
      } else {
        rows = await sql`
          SELECT COUNT(*)::int as total_orders, COALESCE(SUM(total), 0)::numeric as total_revenue,
                 COALESCE(AVG(total), 0)::numeric as avg_order_value,
                 COUNT(CASE WHEN status = 'completed' THEN 1 END)::int as completed_orders,
                 COUNT(CASE WHEN status = 'cancelled' THEN 1 END)::int as cancelled_orders
          FROM orders WHERE organization_id = ${ctx.organizationId}
            AND DATE(created_at) = CURRENT_DATE AND restaurant_id = ${branchId}`;
      }
    } else {
      if (period === 'week') {
        rows = await sql`
          SELECT COUNT(*)::int as total_orders, COALESCE(SUM(total), 0)::numeric as total_revenue,
                 COALESCE(AVG(total), 0)::numeric as avg_order_value,
                 COUNT(CASE WHEN status = 'completed' THEN 1 END)::int as completed_orders,
                 COUNT(CASE WHEN status = 'cancelled' THEN 1 END)::int as cancelled_orders
          FROM orders WHERE organization_id = ${ctx.organizationId}
            AND created_at >= NOW() - INTERVAL '7 days'`;
      } else if (period === 'month') {
        rows = await sql`
          SELECT COUNT(*)::int as total_orders, COALESCE(SUM(total), 0)::numeric as total_revenue,
                 COALESCE(AVG(total), 0)::numeric as avg_order_value,
                 COUNT(CASE WHEN status = 'completed' THEN 1 END)::int as completed_orders,
                 COUNT(CASE WHEN status = 'cancelled' THEN 1 END)::int as cancelled_orders
          FROM orders WHERE organization_id = ${ctx.organizationId}
            AND created_at >= NOW() - INTERVAL '30 days'`;
      } else {
        rows = await sql`
          SELECT COUNT(*)::int as total_orders, COALESCE(SUM(total), 0)::numeric as total_revenue,
                 COALESCE(AVG(total), 0)::numeric as avg_order_value,
                 COUNT(CASE WHEN status = 'completed' THEN 1 END)::int as completed_orders,
                 COUNT(CASE WHEN status = 'cancelled' THEN 1 END)::int as cancelled_orders
          FROM orders WHERE organization_id = ${ctx.organizationId}
            AND DATE(created_at) = CURRENT_DATE`;
      }
    }

    return NextResponse.json({ data: rows[0] || {} });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}
