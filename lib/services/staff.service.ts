// KROWN POS — Staff CRUD + Role Management
import { getSql } from '@/lib/neon-server';
import { TenantContext, setTenantContext, checkSubscriptionLimit } from '@/lib/tenant';
import { generateId } from '@/lib/id';
import { logAudit } from '@/lib/audit';
import { hashPassword } from '@/lib/auth';

// ── Types ──────────────────────────────────────────────────────────────────
export interface Staff {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  phone?: string;
  pin_code?: string;
  id_type?: string;
  id_number?: string;
  role: string;
  assigned_branch_id?: string;
  status: 'active' | 'on_shift' | 'off_shift' | 'on_leave' | 'paused' | 'banned';
  avatar?: string;
  created_at: number;
  updated_at: number;
}

const ROLE_HIERARCHY: Record<string, number> = {
  super_admin: 7,
  restaurant_admin: 6,
  branch_manager: 5,
  head_chef: 4,
  cashier: 3,
  kitchen_staff: 2,
  waiter: 1,
  senior_waiter: 2,
};

// ── Service Methods ────────────────────────────────────────────────────────

export async function listStaff(
  ctx: TenantContext,
  branchId?: string
): Promise<Staff[]> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  let rows;
  if (branchId) {
    rows = await sql`SELECT * FROM staff WHERE organization_id = ${ctx.organizationId} AND assigned_branch_id = ${branchId} AND role != 'super_admin' ORDER BY name ASC`;
  } else {
    rows = await sql`SELECT * FROM staff WHERE organization_id = ${ctx.organizationId} AND role != 'super_admin' ORDER BY name ASC`;
  }

  return rows as Staff[];
}

export async function getStaff(
  ctx: TenantContext,
  staffId: string
): Promise<Staff | null> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const rows = await sql`SELECT * FROM staff WHERE id = ${staffId} AND organization_id = ${ctx.organizationId}`;
  return rows.length > 0 ? (rows[0] as Staff) : null;
}

export async function createStaff(
  ctx: TenantContext,
  input: {
    name: string;
    email: string;
    phone?: string;
    pin?: string;
    password?: string;
    idType?: string;
    idNumber?: string;
    role: string;
    branchId?: string;
    avatar?: string;
  }
): Promise<Staff> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  // Check subscription limit
  const countRows = await sql`SELECT COUNT(*)::int as count FROM staff WHERE organization_id = ${ctx.organizationId}`;
  const currentCount = (countRows[0] as any).count;
  const limitCheck = await checkSubscriptionLimit(ctx.organizationId, 'staff', currentCount);
  if (!limitCheck.allowed) {
    throw new Error(`Subscription limit reached: ${currentCount}/${limitCheck.limit} staff members. Please upgrade your plan.`);
  }

  // Hash password — generate temp password if none provided
  const tempPassword = input.password || (Math.random().toString(36).substring(2, 8) + 'A1!');
  const passwordHash = await hashPassword(tempPassword);

  // Hash PIN if provided
  let hashedPin: string | null = null;
  if (input.pin) {
    hashedPin = await hashPassword(input.pin);
  }

  const id = generateId();

  await sql`
    INSERT INTO staff (id, organization_id, name, email, phone, pin_code, pin_argon2, id_type, id_number, role, assigned_branch_id, status, avatar, password_hash, password_argon2, created_at, updated_at)
    VALUES (${id}, ${ctx.organizationId}, ${input.name}, ${input.email}, ${input.phone || null}, ${input.pin || null}, ${hashedPin}, ${input.idType || null}, ${input.idNumber || null}, ${input.role}, ${input.branchId && input.branchId !== 'all' ? input.branchId : ctx.branchId}, 'active', ${input.avatar || ''}, ${tempPassword}, ${passwordHash}, NOW(), NOW())
  `;

  await logAudit(ctx.userId, 'staff.create', { staffId: id, name: input.name, role: input.role }, ctx.organizationId, ctx.branchId);

  const rows = await sql`SELECT * FROM staff WHERE id = ${id} AND organization_id = ${ctx.organizationId}`;
  return rows[0] as Staff;
}

export async function updateStaff(
  ctx: TenantContext,
  staffId: string,
  updates: Partial<Pick<Staff, 'name' | 'email' | 'phone' | 'id_type' | 'id_number' | 'role' | 'assigned_branch_id' | 'avatar'>>
): Promise<Staff> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const existing = await sql`SELECT * FROM staff WHERE id = ${staffId} AND organization_id = ${ctx.organizationId}`;
  if (existing.length === 0) throw new Error('Staff not found');

  const fields: string[] = [];
  const values: any[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      // Sanitize assigned_branch_id: "all" means null
      const sanitized = (key === 'assigned_branch_id' && value === 'all') ? null : value;
      fields.push(key);
      values.push(sanitized);
    }
  }

  if (fields.length === 0) return existing[0] as Staff;

  const setClauses = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  values.push(staffId, ctx.organizationId);

  await sql(`UPDATE staff SET ${setClauses}, updated_at = NOW() WHERE id = $${fields.length + 1} AND organization_id = $${fields.length + 2}`, values);

  await logAudit(ctx.userId, 'staff.update', { staffId, fields }, ctx.organizationId, ctx.branchId);

  const rows = await sql`SELECT * FROM staff WHERE id = ${staffId} AND organization_id = ${ctx.organizationId}`;
  return rows[0] as Staff;
}

export async function deleteStaff(
  ctx: TenantContext,
  staffId: string
): Promise<void> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const existing = await sql`SELECT * FROM staff WHERE id = ${staffId} AND organization_id = ${ctx.organizationId}`;
  if (existing.length === 0) throw new Error('Staff not found');

  await sql`DELETE FROM staff WHERE id = ${staffId} AND organization_id = ${ctx.organizationId}`;

  await logAudit(ctx.userId, 'staff.delete', { staffId }, ctx.organizationId, ctx.branchId);
}

export async function updateRole(
  ctx: TenantContext,
  staffId: string,
  newRole: string
): Promise<Staff> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const existing = await sql`SELECT * FROM staff WHERE id = ${staffId} AND organization_id = ${ctx.organizationId}`;
  if (existing.length === 0) throw new Error('Staff not found');
  const staff = existing[0] as Staff;

  // Enforce role hierarchy: caller cannot assign a role higher than their own
  const callerLevel = ROLE_HIERARCHY[ctx.role] || 0;
  const targetLevel = ROLE_HIERARCHY[newRole] || 0;
  if (targetLevel > callerLevel) {
    throw new Error('Cannot assign a role higher than your own');
  }

  await sql`
    UPDATE staff SET role = ${newRole}, updated_at = NOW()
    WHERE id = ${staffId} AND organization_id = ${ctx.organizationId}
  `;

  await logAudit(ctx.userId, 'staff.update_role', { staffId, from: staff.role, to: newRole }, ctx.organizationId, ctx.branchId);

  const rows = await sql`SELECT * FROM staff WHERE id = ${staffId} AND organization_id = ${ctx.organizationId}`;
  return rows[0] as Staff;
}

export async function updateStatus(
  ctx: TenantContext,
  staffId: string,
  status: Staff['status']
): Promise<Staff> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const existing = await sql`SELECT * FROM staff WHERE id = ${staffId} AND organization_id = ${ctx.organizationId}`;
  if (existing.length === 0) throw new Error('Staff not found');

  await sql`
    UPDATE staff SET status = ${status}, updated_at = NOW()
    WHERE id = ${staffId} AND organization_id = ${ctx.organizationId}
  `;

  await logAudit(ctx.userId, 'staff.update_status', { staffId, status }, ctx.organizationId, ctx.branchId);

  const rows = await sql`SELECT * FROM staff WHERE id = ${staffId} AND organization_id = ${ctx.organizationId}`;
  return rows[0] as Staff;
}

export async function setPin(
  ctx: TenantContext,
  staffId: string,
  pin: string
): Promise<void> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const existing = await sql`SELECT * FROM staff WHERE id = ${staffId} AND organization_id = ${ctx.organizationId}`;
  if (existing.length === 0) throw new Error('Staff not found');

  const hashedPin = await hashPassword(pin);

  await sql`
    UPDATE staff SET pin_code = ${pin}, pin_argon2 = ${hashedPin}, updated_at = NOW()
    WHERE id = ${staffId} AND organization_id = ${ctx.organizationId}
  `;

  await logAudit(ctx.userId, 'staff.set_pin', { staffId }, ctx.organizationId, ctx.branchId);
}

export async function syncStaff(
  ctx: TenantContext
): Promise<Staff[]> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  // Fetch fresh staff data from database
  const rows = await sql`SELECT * FROM staff WHERE organization_id = ${ctx.organizationId} ORDER BY name ASC`;
  return rows as Staff[];
}
