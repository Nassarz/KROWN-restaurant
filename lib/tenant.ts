// KROWN POS — Tenant Context Management
// Identity is derived from a cryptographically verified JWT/cookie, never client-controlled headers.
import { getSql } from './neon-server';
import type { TokenPayload } from './auth';
import { getUserFromRequest, verifyTokenSync } from './auth';

export interface TenantContext { organizationId: string; userId: string; role: string; branchId: string | null; isSuperAdmin: boolean; }
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function extractTenantContext(request: Request): TenantContext | null {
  const authorization = request.headers.get('authorization');
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const cookie = request.headers.get('cookie')?.match(/(?:^|;\s*)krown_session=([^;]+)/)?.[1];
  const token = bearer || cookie;
  if (!token) return null;
  const payload = verifyTokenSync(decodeURIComponent(token));
  return payload ? extractTenantFromPayload(payload) : null;
}

export async function extractVerifiedTenantContext(request: Request): Promise<TenantContext | null> {
  const payload = await getUserFromRequest(request);
  return payload ? extractTenantFromPayload(payload) : null;
}

export function extractTenantFromPayload(payload: TokenPayload): TenantContext {
  return { organizationId: payload.org, userId: payload.sub, role: payload.role, branchId: payload.branch || null, isSuperAdmin: payload.role === 'super_admin' };
}

export async function setTenantContext(sql: any, organizationId: string): Promise<void> {
  if (!UUID_RE.test(organizationId)) throw new Error('Invalid organization ID format');
  await sql`SELECT set_config('app.org', ${organizationId}, false)`;
}

export function withTenant<T extends (...args: any[]) => Promise<any>>(fn: T): T { return (async (...args: any[]) => { const ctx = args[0] as TenantContext; if (!ctx?.organizationId) throw new Error('Tenant context required'); return fn(...args); }) as T; }

/**
 * Legacy SQL-fragment helper retained for compatibility. The organization ID
 * is accepted only after strict UUID validation; new code should prefer
 * parameterized tagged SQL (`WHERE organization_id = ${ctx.organizationId}`).
 */
export function tenantFilter(columnAlias: string, ctx: TenantContext): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(columnAlias)) throw new Error('Invalid SQL column alias');
  if (ctx.isSuperAdmin) return 'TRUE';
  if (!UUID_RE.test(ctx.organizationId)) throw new Error('Invalid organization ID format');
  return `${columnAlias} = '${ctx.organizationId}'`;
}

export async function getOrganization(orgId: string) { const sql = getSql(); const rows = await sql`SELECT * FROM organizations WHERE id=${orgId} LIMIT 1`; return rows[0] || null; }
export async function getOrganizationBySlug(slug: string) { const sql = getSql(); const rows = await sql`SELECT * FROM organizations WHERE slug=${slug} LIMIT 1`; return rows[0] || null; }
export async function getOrganizationSubscription(orgId: string) { const sql = getSql(); const rows = await sql`SELECT ts.*,sp.name as plan_name,sp.display_name as plan_display_name,sp.max_branches,sp.max_staff,sp.max_menu_items,sp.max_orders_per_day,sp.features FROM tenant_subscriptions ts JOIN subscription_plans sp ON ts.plan_id=sp.id WHERE ts.organization_id=${orgId} AND ts.status='active' LIMIT 1`; return rows[0] || null; }
export interface SubscriptionLimits { maxBranches:number; maxStaff:number; maxMenuItems:number; maxOrdersPerDay:number; features:string[]; planName:string; }
export async function getSubscriptionLimits(orgId:string):Promise<SubscriptionLimits>{ const sub=await getOrganizationSubscription(orgId); if(!sub)return{maxBranches:1,maxStaff:10,maxMenuItems:50,maxOrdersPerDay:200,features:['pos','reports'],planName:'starter'}; return{maxBranches:sub.max_branches,maxStaff:sub.max_staff,maxMenuItems:sub.max_menu_items,maxOrdersPerDay:sub.max_orders_per_day,features:sub.features||[],planName:sub.plan_name}; }
export async function checkSubscriptionLimit(orgId:string,resource:'branches'|'staff'|'menu_items'|'orders',currentCount:number){const l=await getSubscriptionLimits(orgId);const limit=resource==='branches'?l.maxBranches:resource==='staff'?l.maxStaff:resource==='menu_items'?l.maxMenuItems:l.maxOrdersPerDay;return{allowed:currentCount<limit,limit,current:currentCount};}
export function generateSlug(name:string){return name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').substring(0,100);}
export function validateOrgAccess(userOrgId:string,resourceOrgId:string){return userOrgId==='super-admin'||userOrgId===resourceOrgId;}
