// KROWN POS — Branch Management
import { getSql } from '@/lib/neon-server';
import { TenantContext, setTenantContext, checkSubscriptionLimit } from '@/lib/tenant';
import { generateId } from '@/lib/id';
import { logAudit } from '@/lib/audit';

// ── Types ──────────────────────────────────────────────────────────────────
export interface Branch {
  id: string;
  organization_id: string;
  name: string;
  location: string;
  city?: string;
  manager: string;
  phone: string;
  email?: string;
  tax_id?: string;
  address?: string;
  receipt_header_note?: string;
  receipt_footer_note?: string;
  tables_count: number;
  daily_revenue_ugx: number;
  orders_today: number;
  status: 'online' | 'busy' | 'maintenance';
  created_at: number;
  updated_at: number;
}

// ── Service Methods ────────────────────────────────────────────────────────

export async function listBranches(
  ctx: TenantContext
): Promise<Branch[]> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const rows = await sql`SELECT * FROM branches WHERE organization_id = ${ctx.organizationId} ORDER BY name ASC`;
  return rows as Branch[];
}

export async function getBranch(
  ctx: TenantContext,
  branchId: string
): Promise<Branch | null> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const rows = await sql`SELECT * FROM branches WHERE id = ${branchId} AND organization_id = ${ctx.organizationId}`;
  return rows.length > 0 ? (rows[0] as Branch) : null;
}

export async function createBranch(
  ctx: TenantContext,
  input: {
    name: string;
    location: string;
    city?: string;
    manager: string;
    phone: string;
    email?: string;
    taxId?: string;
    address?: string;
    receiptHeaderNote?: string;
    receiptFooterNote?: string;
    tablesCount?: number;
  }
): Promise<Branch> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  // Check subscription limit
  const countRows = await sql`SELECT COUNT(*)::int as count FROM branches WHERE organization_id = ${ctx.organizationId}`;
  const currentCount = (countRows[0] as any).count;
  const limitCheck = await checkSubscriptionLimit(ctx.organizationId, 'branches', currentCount);
  if (!limitCheck.allowed) {
    throw new Error(`Subscription limit reached: ${currentCount}/${limitCheck.limit} branches. Please upgrade your plan.`);
  }

  const id = generateId();

  await sql`
    INSERT INTO branches (id, organization_id, name, location, city, manager, phone, email, tax_id, address, receipt_header_note, receipt_footer_note, tables_count, daily_revenue_ugx, orders_today, status, created_at, updated_at)
    VALUES (${id}, ${ctx.organizationId}, ${input.name}, ${input.location}, ${input.city || null}, ${input.manager}, ${input.phone}, ${input.email || null}, ${input.taxId || null}, ${input.address || null}, ${input.receiptHeaderNote || null}, ${input.receiptFooterNote || null}, ${input.tablesCount || 0}, 0, 0, 'online', NOW(), NOW())
  `;

  await logAudit(ctx.userId, 'branch.create', { branchId: id, name: input.name }, ctx.organizationId, ctx.branchId);

  const rows = await sql`SELECT * FROM branches WHERE id = ${id} AND organization_id = ${ctx.organizationId}`;
  return rows[0] as Branch;
}

export async function updateBranch(
  ctx: TenantContext,
  branchId: string,
  updates: Partial<Pick<Branch, 'name' | 'location' | 'city' | 'manager' | 'phone' | 'email' | 'tax_id' | 'address' | 'receipt_header_note' | 'receipt_footer_note' | 'tables_count'>>
): Promise<Branch> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const existing = await sql`SELECT * FROM branches WHERE id = ${branchId} AND organization_id = ${ctx.organizationId}`;
  if (existing.length === 0) throw new Error('Branch not found');

  const fields: string[] = [];
  const values: any[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      fields.push(key);
      values.push(value);
    }
  }

  if (fields.length === 0) return existing[0] as Branch;

  const setClauses = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  values.push(branchId, ctx.organizationId);

  await sql(`UPDATE branches SET ${setClauses}, updated_at = NOW() WHERE id = $${fields.length + 1} AND organization_id = $${fields.length + 2}`, values);

  await logAudit(ctx.userId, 'branch.update', { branchId, fields }, ctx.organizationId, ctx.branchId);

  const rows = await sql`SELECT * FROM branches WHERE id = ${branchId} AND organization_id = ${ctx.organizationId}`;
  return rows[0] as Branch;
}

export async function updateStatus(
  ctx: TenantContext,
  branchId: string,
  status: Branch['status']
): Promise<Branch> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const existing = await sql`SELECT * FROM branches WHERE id = ${branchId} AND organization_id = ${ctx.organizationId}`;
  if (existing.length === 0) throw new Error('Branch not found');

  await sql`
    UPDATE branches SET status = ${status}, updated_at = NOW()
    WHERE id = ${branchId} AND organization_id = ${ctx.organizationId}
  `;

  await logAudit(ctx.userId, 'branch.update_status', { branchId, status }, ctx.organizationId, ctx.branchId);

  const rows = await sql`SELECT * FROM branches WHERE id = ${branchId} AND organization_id = ${ctx.organizationId}`;
  return rows[0] as Branch;
}

export async function deleteBranch(
  ctx: TenantContext,
  branchId: string
): Promise<void> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const existing = await sql`SELECT * FROM branches WHERE id = ${branchId} AND organization_id = ${ctx.organizationId}`;
  if (existing.length === 0) throw new Error('Branch not found');

  // Cannot delete if has orders
  const orderCount = await sql`SELECT COUNT(*)::int as count FROM orders WHERE restaurant_id = ${branchId} AND organization_id = ${ctx.organizationId}`;
  if ((orderCount[0] as any).count > 0) {
    throw new Error('Cannot delete branch with existing orders. Set status to maintenance instead.');
  }

  await sql`DELETE FROM branches WHERE id = ${branchId} AND organization_id = ${ctx.organizationId}`;

  await logAudit(ctx.userId, 'branch.delete', { branchId }, ctx.organizationId, ctx.branchId);
}
