import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { getSql } from '@/lib/neon-server';

export async function GET(request: NextRequest) {
  const ctx = extractTenantContext(request);
  if (!ctx || ctx.role !== 'super_admin') {
    return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
  }

  const sql = getSql();

  try {
    const [
      orgCounts,
      staffCounts,
      orderCounts,
      revenueResult,
      revenueByDay,
      ordersByDay,
      topRestaurants,
      staffByRole,
    ] = await Promise.all([
      sql`SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active
      FROM organizations`,

      sql`SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active
      FROM staff`,

      sql`SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE payment_status = 'paid') as paid,
        COUNT(*) FILTER (WHERE payment_status = 'pending') as pending,
        COALESCE(SUM(total), 0) as total_revenue
      FROM orders`,

      sql`SELECT COALESCE(SUM(total), 0) as revenue FROM orders WHERE payment_status = 'paid'`,

      sql`SELECT
        DATE(created_at) as date,
        COUNT(*) as orders,
        COALESCE(SUM(total), 0) as revenue
      FROM orders
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC`,

      sql`SELECT
        DATE(created_at) as date,
        COUNT(*) as count
      FROM orders
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC`,

      sql`SELECT
        o.organization_id,
        COALESCE(om.name, 'Unknown') as name,
        COUNT(o.id) as order_count,
        COALESCE(SUM(o.total), 0) as revenue
      FROM orders o
      LEFT JOIN organizations om ON om.id = o.organization_id
      WHERE o.payment_status = 'paid'
      GROUP BY o.organization_id, om.name
      ORDER BY revenue DESC
      LIMIT 10`,

      sql`SELECT role, COUNT(*) as count FROM staff GROUP BY role ORDER BY count DESC`,
    ]);

    return NextResponse.json({
      data: {
        totalRestaurants: Number(orgCounts[0]?.total ?? 0),
        activeRestaurants: Number(orgCounts[0]?.active ?? 0),
        totalStaff: Number(staffCounts[0]?.total ?? 0),
        activeStaff: Number(staffCounts[0]?.active ?? 0),
        totalOrders: Number(orderCounts[0]?.total ?? 0),
        paidOrders: Number(orderCounts[0]?.paid ?? 0),
        pendingOrders: Number(orderCounts[0]?.pending ?? 0),
        totalRevenue: Number(revenueResult[0]?.revenue ?? 0),
        revenueByDay: revenueByDay,
        ordersByDay: ordersByDay,
        topRestaurants,
        staffByRole,
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch analytics' }, { status: 500 });
  }
}
