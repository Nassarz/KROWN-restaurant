import { getSql } from '@/lib/neon-server';
import type { TenantContext } from '@/lib/tenant';
import { setTenantContext } from '@/lib/tenant';
import { generateId } from '@/lib/id';

export interface AuditLog {
  id: string;
  user_email: string | null;
  action: string;
  details: any;
  ip_address: string | null;
  staff_id: string | null;
  user_id: string | null;
  branch_id: string | null;
  branch_name: string | null;
  organization_id: string;
  created_at: any;
}

export async function log(
  ctx: TenantContext,
  action: string,
  details: Record<string, any>,
  userEmail?: string
): Promise<AuditLog> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const id = generateId();

  const rows = await sql`
    INSERT INTO audit_logs (
      id, user_email, action, details,
      staff_id, user_id, branch_id,
      organization_id, created_at
    )
    VALUES (
      ${id},
      ${userEmail ?? null},
      ${action},
      ${JSON.stringify(details)}::jsonb,
      ${ctx.userId},
      ${ctx.userId},
      ${ctx.branchId ?? null},
      ${ctx.organizationId},
      NOW()
    )
    RETURNING *
  ` as AuditLog[];

  return rows[0];
}

export async function listAuditLogs(
  ctx: TenantContext,
  branchId?: string,
  limit: number = 100
): Promise<AuditLog[]> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  if (branchId) {
    const rows = await sql`
      SELECT * FROM audit_logs
      WHERE branch_id = ${branchId} AND organization_id = ${ctx.organizationId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    ` as AuditLog[];
    return rows;
  }

  const rows = await sql`
    SELECT * FROM audit_logs
    WHERE organization_id = ${ctx.organizationId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  ` as AuditLog[];
  return rows;
}
