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
      orgStats,
      staffStats,
      deviceStats,
      orderStats,
      revenueMonth,
      subStats,
      supportStats,
      alertStats,
      recentActivity,
    ] = await Promise.all([
      sql`SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'suspended') as suspended
      FROM organizations`,

      sql`SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active' OR status = 'on_shift') as active
      FROM staff`,

      sql`SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'pending') as pending
      FROM devices`,

      sql`SELECT
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today,
        COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)) as month
      FROM orders`,

      sql`SELECT COALESCE(SUM(total), 0) as revenue
      FROM orders
      WHERE payment_status = 'paid' AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`,

      sql`SELECT
        COUNT(*) FILTER (WHERE status = 'active') as active_subs,
        COUNT(*) FILTER (WHERE status = 'trial') as trial_subs,
        COUNT(*) FILTER (WHERE status = 'past_due') as failed_payments
      FROM tenant_subscriptions`,

      sql`SELECT COUNT(*) FILTER (WHERE status = 'open' OR status = 'waiting') as open_conversations
      FROM support_conversations`,

      sql`SELECT COUNT(*) FILTER (WHERE status = 'open' AND severity = 'critical') as critical_alerts
      FROM security_alerts`,

      sql`SELECT id, user_email, action, details, created_at
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 10`,
    ]);

    return NextResponse.json({
      data: {
        kpis: {
          totalRestaurants: Number(orgStats[0]?.total ?? 0),
          activeRestaurants: Number(orgStats[0]?.active ?? 0),
          suspendedRestaurants: Number(orgStats[0]?.suspended ?? 0),
          totalUsers: Number(staffStats[0]?.total ?? 0),
          activeUsers: Number(staffStats[0]?.active ?? 0),
          totalDevices: Number(deviceStats[0]?.total ?? 0),
          activeDevices: Number(deviceStats[0]?.active ?? 0),
          pendingDevices: Number(deviceStats[0]?.pending ?? 0),
          ordersToday: Number(orderStats[0]?.today ?? 0),
          ordersThisMonth: Number(orderStats[0]?.month ?? 0),
          revenueThisMonth: Number(revenueMonth[0]?.revenue ?? 0),
          activeSubscriptions: Number(subStats[0]?.active_subs ?? 0),
          trialRestaurants: Number(subStats[0]?.trial_subs ?? 0),
          failedPayments: Number(subStats[0]?.failed_payments ?? 0),
          openSupportConversations: Number(supportStats[0]?.open_conversations ?? 0),
          criticalSecurityAlerts: Number(alertStats[0]?.critical_alerts ?? 0),
        },
        recentActivity,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load dashboard metrics' }, { status: 500 });
  }
}
