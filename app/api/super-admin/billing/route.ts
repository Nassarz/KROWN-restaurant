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
    const [plans, subscriptions, revenue] = await Promise.all([
      sql`SELECT id, name, display_name, monthly_price_ugx, max_branches, max_staff, max_menu_items, max_orders_per_day, features
        FROM subscription_plans WHERE is_active = true ORDER BY monthly_price_ugx ASC`,

      sql`SELECT
        ts.id,
        ts.organization_id,
        o.name as org_name,
        ts.plan_id,
        sp.name as plan_name,
        sp.display_name as plan_display_name,
        ts.status,
        ts.started_at,
        ts.current_period_end,
        ts.created_at
      FROM tenant_subscriptions ts
      JOIN organizations o ON o.id = ts.organization_id
      LEFT JOIN subscription_plans sp ON sp.id = ts.plan_id
      ORDER BY ts.created_at DESC`,

      sql`SELECT
        COALESCE(SUM(sp.monthly_price_ugx), 0) as mrr,
        COUNT(*) FILTER (WHERE ts.status = 'active') as active_count,
        COUNT(*) FILTER (WHERE ts.status = 'past_due') as past_due_count,
        COUNT(*) FILTER (WHERE ts.status = 'canceled') as canceled_count
      FROM tenant_subscriptions ts
      JOIN subscription_plans sp ON sp.id = ts.plan_id
      WHERE ts.status IN ('active', 'past_due', 'canceled')`,
    ]);

    return NextResponse.json({
      data: {
        plans,
        subscriptions,
        summary: {
          mrr: Number(revenue[0]?.mrr ?? 0),
          activeCount: Number(revenue[0]?.active_count ?? 0),
          pastDueCount: Number(revenue[0]?.past_due_count ?? 0),
          canceledCount: Number(revenue[0]?.canceled_count ?? 0),
        }
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch billing' }, { status: 500 });
  }
}
