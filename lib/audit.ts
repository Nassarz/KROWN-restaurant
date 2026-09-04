import { generateId } from './id';
import { getSql } from './neon-server';

/**
 * Server-side audit log writer (legacy).
 * Writes directly to the database via the Neon SQL client.
 * On the client, this is a no-op (audit logs should only be written server-side).
 */
export const logAudit = async (userIdOrEmail: string, action: string, details: any, organizationId?: string | null, branchId?: string | null) => {
  // Only run server-side (no fetch available in server context, or use direct SQL)
  if (typeof window !== 'undefined') return; // Client-side: no-op

  try {
    const sql = getSql();
    // Use provided org, or fall back to the platform org for super admin actions
    const orgId = organizationId || '97830527-8b2d-45d8-b8d4-e3f83196fb4a';
    const branch = branchId || null;

    await sql`
      INSERT INTO audit_logs (id, organization_id, branch_id, user_email, action, details, created_at)
      VALUES (${generateId()}, ${orgId}, ${branch}, ${userIdOrEmail}, ${action}, ${JSON.stringify(details)}, NOW())
    `;
  } catch (e) {
    console.warn('[Audit] Failed to write audit log:', e);
  }
};

// ── Enhanced Audit Logging ───────────────────────────────────────────────────

export async function logAuditEvent(params: {
  organizationId?: string;
  userId?: string;
  staffId?: string;
  userEmail?: string;
  actorRole?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: any;
  ipAddress?: string;
  deviceId?: string;
  userAgent?: string;
  branchId?: string;
  branchName?: string;
  result?: 'success' | 'failure' | 'warning';
  reason?: string;
}): Promise<void> {
  if (typeof window !== 'undefined') return;

  try {
    const sql = getSql();
    const id = generateId();

    await sql`
      INSERT INTO audit_logs (
        id, organization_id, user_id, staff_id, user_email, actor_role,
        action, target_type, target_id, details,
        ip_address, device_id, user_agent,
        branch_id, branch_name, result, reason, created_at
      ) VALUES (
        ${id},
        ${params.organizationId ?? null},
        ${params.userId ?? null},
        ${params.staffId ?? null},
        ${params.userEmail ?? null},
        ${params.actorRole ?? null},
        ${params.action},
        ${params.targetType ?? null},
        ${params.targetId ?? null},
        ${params.details ? JSON.stringify(params.details) : null}::jsonb,
        ${params.ipAddress ?? null},
        ${params.deviceId ?? null},
        ${params.userAgent ?? null},
        ${params.branchId ?? null},
        ${params.branchName ?? null},
        ${params.result ?? 'success'},
        ${params.reason ?? null},
        NOW()
      )
    `;
  } catch (e) {
    console.warn('[Audit] Failed to write enhanced audit log:', e);
  }
}

// ── Query Audit Logs ─────────────────────────────────────────────────────────

export async function queryAuditLogs(params: {
  organizationId?: string;
  action?: string;
  actorRole?: string;
  result?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ logs: any[]; total: number }> {
  const sql = getSql();
  const limit = params.limit ?? 100;
  const offset = params.offset ?? 0;

  // Build dynamic WHERE clauses
  const conditions: string[] = [];
  const values: any[] = [];
  let paramIdx = 1;

  if (params.organizationId) {
    conditions.push(`organization_id = $${paramIdx++}`);
    values.push(params.organizationId);
  }
  if (params.action) {
    conditions.push(`action = $${paramIdx++}`);
    values.push(params.action);
  }
  if (params.actorRole) {
    conditions.push(`actor_role = $${paramIdx++}`);
    values.push(params.actorRole);
  }
  if (params.result) {
    conditions.push(`result = $${paramIdx++}`);
    values.push(params.result);
  }
  if (params.startDate) {
    conditions.push(`created_at >= $${paramIdx++}`);
    values.push(params.startDate);
  }
  if (params.endDate) {
    conditions.push(`created_at <= $${paramIdx++}`);
    values.push(params.endDate);
  }
  if (params.search) {
    conditions.push(`(user_email ILIKE $${paramIdx} OR action ILIKE $${paramIdx} OR details::text ILIKE $${paramIdx})`);
    values.push(`%${params.search}%`);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total
  const countResult = await sql(
    `SELECT COUNT(*)::int as total FROM audit_logs ${whereClause}`,
    values
  );
  const total = (countResult as any[])[0]?.total ?? 0;

  // Fetch page
  const logs = await sql(
    `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    values
  );

  return { logs: logs as any[], total };
}

// ── Audit Stats ──────────────────────────────────────────────────────────────

export async function getAuditStats(organizationId?: string): Promise<{
  total: number;
  today: number;
  failed: number;
  byAction: Record<string, number>;
  byRole: Record<string, number>;
}> {
  const sql = getSql();

  const orgFilter = organizationId ? `WHERE organization_id = $1` : '';
  const orgValue = organizationId ? [organizationId] : [];

  // Total count
  const totalResult = await sql(
    `SELECT COUNT(*)::int as total FROM audit_logs ${orgFilter}`,
    orgValue
  );
  const total = (totalResult as any[])[0]?.total ?? 0;

  // Today count
  const todayWhere = organizationId
    ? `WHERE organization_id = $1 AND created_at >= CURRENT_DATE`
    : `WHERE created_at >= CURRENT_DATE`;
  const todayResult = await sql(
    `SELECT COUNT(*)::int as today FROM audit_logs ${todayWhere}`,
    orgValue
  );
  const today = (todayResult as any[])[0]?.today ?? 0;

  // Failed count
  const failedWhere = organizationId
    ? `WHERE organization_id = $1 AND result = 'failure'`
    : `WHERE result = 'failure'`;
  const failedResult = await sql(
    `SELECT COUNT(*)::int as failed FROM audit_logs ${failedWhere}`,
    orgValue
  );
  const failed = (failedResult as any[])[0]?.failed ?? 0;

  // By action
  const actionRows = await sql(
    `SELECT action, COUNT(*)::int as count FROM audit_logs ${orgFilter} GROUP BY action ORDER BY count DESC`,
    orgValue
  );
  const byAction: Record<string, number> = {};
  for (const row of actionRows as any[]) {
    byAction[row.action] = row.count;
  }

  // By role
  const roleWhere = organizationId
    ? `WHERE organization_id = $1 AND actor_role IS NOT NULL`
    : `WHERE actor_role IS NOT NULL`;
  const roleRows = await sql(
    `SELECT actor_role, COUNT(*)::int as count FROM audit_logs ${roleWhere} GROUP BY actor_role ORDER BY count DESC`,
    orgValue
  );
  const byRole: Record<string, number> = {};
  for (const row of roleRows as any[]) {
    byRole[row.actor_role] = row.count;
  }

  return { total, today, failed, byAction, byRole };
}
