import { getSql } from './neon-server';
import { normalizeRole, isPlatformRole } from './rbac';
import type { TenantContext } from './tenant';

/** Validate that a branch exists, belongs to the tenant, and is within the actor's scope. */
export async function assertBranchAccess(ctx: TenantContext, branchId: string): Promise<void> {
  if (!branchId) throw new Error('Branch is required');
  const sql = getSql();
  const rows = await sql`SELECT id, organization_id FROM branches WHERE id = ${branchId} LIMIT 1`;
  if (!rows.length) throw new Error('Branch not found');

  const branch = rows[0] as any;
  if (!isPlatformRole(ctx.role) && branch.organization_id !== ctx.organizationId) {
    throw new Error('Forbidden: branch does not belong to your organization');
  }

  const role = normalizeRole(ctx.role);
  if (!isPlatformRole(ctx.role) && role !== 'restaurant_admin' && ctx.branchId !== branchId) {
    throw new Error('Forbidden: you are not assigned to this branch');
  }
}

/** Same check with an HTTP-friendly status distinction. */
export async function branchIsAccessible(ctx: TenantContext, branchId: string): Promise<boolean> {
  try { await assertBranchAccess(ctx, branchId); return true; } catch { return false; }
}
