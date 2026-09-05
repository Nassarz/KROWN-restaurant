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
    const branchId = request.nextUrl.searchParams.get('branch_id') || ctx.branchId;

    let revenue: any[], expenses: any[];

    if (branchId) {
      revenue = await sql`
        SELECT COALESCE(SUM(o.total), 0)::numeric as total_revenue,
               COALESCE(SUM(o.tax), 0)::numeric as total_tax,
               COALESCE(SUM(o.subtotal), 0)::numeric as total_subtotal,
               COUNT(*)::int as total_orders
        FROM orders o WHERE o.organization_id = ${ctx.organizationId}
          AND o.status = 'completed' AND o.restaurant_id = ${branchId}`;

      expenses = await sql`
        SELECT COALESCE(SUM(amount_ugx), 0)::numeric as total_expenses, COUNT(*)::int as expense_count
        FROM expenses WHERE organization_id = ${ctx.organizationId} AND branch_id = ${branchId}`;
    } else {
      revenue = await sql`
        SELECT COALESCE(SUM(o.total), 0)::numeric as total_revenue,
               COALESCE(SUM(o.tax), 0)::numeric as total_tax,
               COALESCE(SUM(o.subtotal), 0)::numeric as total_subtotal,
               COUNT(*)::int as total_orders
        FROM orders o WHERE o.organization_id = ${ctx.organizationId}
          AND o.status = 'completed'`;

      expenses = await sql`
        SELECT COALESCE(SUM(amount_ugx), 0)::numeric as total_expenses, COUNT(*)::int as expense_count
        FROM expenses WHERE organization_id = ${ctx.organizationId}`;
    }

    return NextResponse.json({
      data: {
        revenue: revenue[0] || { total_revenue: 0, total_tax: 0, total_subtotal: 0, total_orders: 0 },
        expenses: expenses[0] || { total_expenses: 0, expense_count: 0 },
      }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}
