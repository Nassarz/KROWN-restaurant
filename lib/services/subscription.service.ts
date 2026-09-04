import { getSql } from '@/lib/neon-server';
import type { TenantContext } from '@/lib/tenant';
import { setTenantContext } from '@/lib/tenant';

export interface SubscriptionPlan {
  id: string;
  name: string;
  display_name: string;
  monthly_price_ugx: number;
  max_branches: number;
  max_staff: number;
  max_menu_items: number;
  max_orders_per_day: number;
  features: string[];
  is_active: boolean;
  created_at: any;
}

export interface OrgSubscription {
  id: string;
  organization_id: string;
  plan_id: string;
  status: string;
  started_at: any;
  current_period_start: any;
  current_period_end: any;
  trial_ends_at: any;
  cancel_at: any;
  created_at: any;
  plan_name: string;
  plan_display_name: string;
  max_branches: number;
  max_staff: number;
  max_menu_items: number;
  max_orders_per_day: number;
  features: string[];
}

export interface UsageCounts {
  branches: number;
  staff: number;
  menu_items: number;
  orders_today: number;
}

export async function getPlans(): Promise<SubscriptionPlan[]> {
  const sql = getSql();

  const rows = await sql`
    SELECT * FROM subscription_plans
    WHERE is_active = true
    ORDER BY monthly_price_ugx ASC
  ` as SubscriptionPlan[];
  return rows;
}

export async function getOrgSubscription(ctx: TenantContext): Promise<OrgSubscription | null> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const rows = await sql`
    SELECT ts.*, sp.name as plan_name, sp.display_name as plan_display_name,
           sp.max_branches, sp.max_staff, sp.max_menu_items,
           sp.max_orders_per_day, sp.features
    FROM tenant_subscriptions ts
    JOIN subscription_plans sp ON ts.plan_id = sp.id
    WHERE ts.organization_id = ${ctx.organizationId}
      AND ts.status = 'active'
    LIMIT 1
  ` as OrgSubscription[];
  return rows.length > 0 ? rows[0] : null;
}

export async function updateSubscription(
  ctx: TenantContext,
  planId: string
): Promise<OrgSubscription | null> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  // Deactivate current subscription
  await sql`
    UPDATE tenant_subscriptions
    SET status = 'inactive'
    WHERE organization_id = ${ctx.organizationId}
      AND status = 'active'
  `;

  // Create new subscription
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  await sql`
    INSERT INTO tenant_subscriptions (
      organization_id, plan_id, status, started_at,
      current_period_start, current_period_end
    )
    VALUES (
      ${ctx.organizationId},
      ${planId},
      'active',
      ${now},
      ${now},
      ${periodEnd}
    )
  `;

  return getOrgSubscription(ctx);
}

export async function checkLimit(
  ctx: TenantContext,
  resource: 'branches' | 'staff' | 'menu_items' | 'orders',
  currentCount: number
): Promise<{ allowed: boolean; limit: number; current: number }> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  // Get subscription limits
  const sub = await getOrgSubscription(ctx);

  const defaultLimits: Record<string, number> = {
    branches: 1,
    staff: 10,
    menu_items: 50,
    orders: 200,
  };

  const limitMap: Record<string, string> = {
    branches: 'max_branches',
    staff: 'max_staff',
    menu_items: 'max_menu_items',
    orders: 'max_orders_per_day',
  };

  let limit: number;
  if (sub) {
    const col = limitMap[resource];
    limit = (sub as any)[col] ?? defaultLimits[resource];
  } else {
    limit = defaultLimits[resource];
  }

  return {
    allowed: currentCount < limit,
    limit,
    current: currentCount,
  };
}

export async function getUsage(ctx: TenantContext): Promise<UsageCounts> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const [branches, staff, menuItems, ordersToday] = await Promise.all([
    sql`SELECT COUNT(*)::int as count FROM branches WHERE organization_id = ${ctx.organizationId}`,
    sql`SELECT COUNT(*)::int as count FROM staff WHERE organization_id = ${ctx.organizationId} AND role != 'super_admin'`,
    sql`SELECT COUNT(*)::int as count FROM products WHERE organization_id = ${ctx.organizationId}`,
    sql`
      SELECT COUNT(*)::int as count FROM orders
      WHERE organization_id = ${ctx.organizationId}
        AND created_at >= CURRENT_DATE
        AND created_at < CURRENT_DATE + INTERVAL '1 day'
    `,
  ]) as { count: number }[][];

  return {
    branches: branches[0]?.count ?? 0,
    staff: staff[0]?.count ?? 0,
    menu_items: menuItems[0]?.count ?? 0,
    orders_today: ordersToday[0]?.count ?? 0,
  };
}
