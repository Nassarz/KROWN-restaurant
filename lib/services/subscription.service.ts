import type { TenantContext } from '@/lib/tenant';

/**
 * KROWN Restaurant is currently an unlimited-access platform.
 * Subscription records are intentionally not required for tenant access.
 * These interfaces remain for backwards compatibility with older API callers.
 */

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

/** No plans are offered because KROWN access is unlimited. */
export async function getPlans(): Promise<SubscriptionPlan[]> {
  return [];
}

/** Tenants do not require a subscription to operate. */
export async function getOrgSubscription(_ctx: TenantContext): Promise<OrgSubscription | null> {
  return null;
}

/** Subscription changes are intentionally disabled. */
export async function updateSubscription(
  _ctx: TenantContext,
  _planId: string
): Promise<OrgSubscription | null> {
  throw new Error('Subscriptions are disabled. KROWN Restaurant access is unlimited.');
}

/**
 * Every tenant resource is unlimited. Keep this API so existing callers remain
 * compatible while removing all subscription-based caps.
 */
export async function checkLimit(
  _ctx: TenantContext,
  _resource: 'branches' | 'staff' | 'menu_items' | 'orders',
  currentCount: number
): Promise<{ allowed: boolean; limit: number; current: number }> {
  return {
    allowed: true,
    limit: Number.POSITIVE_INFINITY,
    current: currentCount,
  };
}

/** Usage is still reported for operational analytics, not billing. */
export async function getUsage(ctx: TenantContext): Promise<UsageCounts> {
  const { getSql } = await import('@/lib/neon-server');
  const sql = getSql();

  const [branches, staff, menuItems, ordersToday] = await Promise.all([
    sql`SELECT COUNT(*)::int as count FROM branches WHERE organization_id = ${ctx.organizationId}`,
    sql`SELECT COUNT(*)::int as count FROM staff WHERE organization_id = ${ctx.organizationId} AND role != 'super_admin'`,
    sql`SELECT COUNT(*)::int as count FROM products WHERE organization_id = ${ctx.organizationId}`,
    sql`SELECT COUNT(*)::int as count FROM orders WHERE organization_id = ${ctx.organizationId} AND created_at >= CURRENT_DATE AND created_at < CURRENT_DATE + INTERVAL '1 day'`,
  ]) as { count: number }[][];

  return {
    branches: branches[0]?.count ?? 0,
    staff: staff[0]?.count ?? 0,
    menu_items: menuItems[0]?.count ?? 0,
    orders_today: ordersToday[0]?.count ?? 0,
  };
}
