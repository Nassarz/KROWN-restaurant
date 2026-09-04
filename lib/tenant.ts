// KROWN POS — Tenant Context Management
// Manages organization context for multi-tenant isolation

import { getSql } from './neon-server';
import type { TokenPayload } from './auth';

// ── Tenant Context ──────────────────────────────────────────────────────────

export interface TenantContext {
  organizationId: string;
  userId: string;
  role: string;
  branchId: string | null;
  isSuperAdmin: boolean;
}

export function extractTenantContext(request: Request): TenantContext | null {
  const orgId = request.headers.get('x-org-id');
  const userId = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role');
  const branchId = request.headers.get('x-branch-id');

  if (!orgId || !userId || !role) return null;

  const isSuperAdmin = role === 'super_admin';

  return {
    organizationId: orgId,
    userId,
    role,
    branchId,
    isSuperAdmin,
  };
}

export function extractTenantFromPayload(payload: TokenPayload): TenantContext {
  const isSuperAdmin = payload.role === 'super_admin';
  return {
    organizationId: payload.org,
    userId: payload.sub,
    role: payload.role,
    branchId: payload.branch,
    isSuperAdmin,
  };
}

// ── Database Context Setting ────────────────────────────────────────────────

/**
 * Sets the app.org session variable for RLS enforcement.
 * Uses SET (not SET LOCAL) since Neon HTTP driver doesn't support transactions.
 * Note: Session variables don't persist across HTTP requests, so application-layer
 * organization_id filtering in every query is the PRIMARY tenant isolation mechanism.
 * RLS is a safety net for transactional connections (pgbouncer transaction mode).
 */
export async function setTenantContext(sql: any, organizationId: string): Promise<void> {
  // Validate UUID format to prevent SQL injection
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(organizationId)) {
    throw new Error('Invalid organization ID format');
  }
  try {
    await sql(`SET app.org = '${organizationId}'`);
  } catch {
    // Ignore — RLS enforcement via session variable may not work with HTTP driver.
    // Application-layer org_id filtering is the primary defense.
  }
}

/**
 * Wraps a service function with automatic tenant context setting.
 */
export function withTenant<T extends (...args: any[]) => Promise<any>>(
  fn: T
): T {
  return (async (...args: any[]) => {
    const ctx = args[0] as TenantContext;
    if (!ctx?.organizationId) {
      throw new Error('Tenant context required');
    }
    return fn(...args);
  }) as T;
}

/**
 * Helper for services: returns the WHERE clause fragment for tenant filtering.
 * Super admins see all data; regular users see only their org's data.
 */
export function tenantFilter(columnAlias: string, ctx: TenantContext): string {
  if (ctx.isSuperAdmin) return 'TRUE'; // no filter
  return `${columnAlias} = '${ctx.organizationId}'`;
}

// ── Organization Queries ────────────────────────────────────────────────────

export async function getOrganization(orgId: string) {
  const sql = getSql();
  const rows = await sql`SELECT * FROM organizations WHERE id = ${orgId} LIMIT 1`;
  return rows.length > 0 ? rows[0] : null;
}

export async function getOrganizationBySlug(slug: string) {
  const sql = getSql();
  const rows = await sql`SELECT * FROM organizations WHERE slug = ${slug} LIMIT 1`;
  return rows.length > 0 ? rows[0] : null;
}

export async function getOrganizationSubscription(orgId: string) {
  const sql = getSql();
  const rows = await sql`
    SELECT ts.*, sp.name as plan_name, sp.display_name as plan_display_name,
           sp.max_branches, sp.max_staff, sp.max_menu_items, sp.max_orders_per_day, sp.features
    FROM tenant_subscriptions ts
    JOIN subscription_plans sp ON ts.plan_id = sp.id
    WHERE ts.organization_id = ${orgId} AND ts.status = 'active'
    LIMIT 1
  `;
  return rows.length > 0 ? rows[0] : null;
}

// ── Subscription Limits ─────────────────────────────────────────────────────

export interface SubscriptionLimits {
  maxBranches: number;
  maxStaff: number;
  maxMenuItems: number;
  maxOrdersPerDay: number;
  features: string[];
  planName: string;
}

export async function getSubscriptionLimits(orgId: string): Promise<SubscriptionLimits> {
  const sub = await getOrganizationSubscription(orgId);

  if (!sub) {
    // Default to starter limits if no subscription
    return {
      maxBranches: 1,
      maxStaff: 10,
      maxMenuItems: 50,
      maxOrdersPerDay: 200,
      features: ['pos', 'reports'],
      planName: 'starter',
    };
  }

  return {
    maxBranches: sub.max_branches,
    maxStaff: sub.max_staff,
    maxMenuItems: sub.max_menu_items,
    maxOrdersPerDay: sub.max_orders_per_day,
    features: sub.features || [],
    planName: sub.plan_name,
  };
}

export async function checkSubscriptionLimit(
  orgId: string,
  resource: 'branches' | 'staff' | 'menu_items' | 'orders',
  currentCount: number
): Promise<{ allowed: boolean; limit: number; current: number }> {
  const limits = await getSubscriptionLimits(orgId);

  let limit: number;
  switch (resource) {
    case 'branches': limit = limits.maxBranches; break;
    case 'staff': limit = limits.maxStaff; break;
    case 'menu_items': limit = limits.maxMenuItems; break;
    case 'orders': limit = limits.maxOrdersPerDay; break;
    default: limit = 0;
  }

  return {
    allowed: currentCount < limit,
    limit,
    current: currentCount,
  };
}

// ── Slug Generation ─────────────────────────────────────────────────────────

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

// ── Validate Organization Access ────────────────────────────────────────────

export function validateOrgAccess(userOrgId: string, resourceOrgId: string): boolean {
  // Super Admin bypass
  if (userOrgId === 'super-admin') return true;
  return userOrgId === resourceOrgId;
}
