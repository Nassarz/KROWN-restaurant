import { getSql } from '@/lib/neon-server';
import { TenantContext, setTenantContext } from '@/lib/tenant';
import { assertBranchAccess } from '@/lib/access-control';
import { generateId } from '@/lib/id';
import { logAudit } from '@/lib/audit';

export interface PersonalCreditProfile {
  id: string;
  organization_id: string;
  branch_id: string;
  public_reference: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  credit_limit_ugx: number;
  current_balance_ugx: number;
  status: 'active' | 'suspended' | 'closed';
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

function assertCreditManager(ctx: TenantContext) {
  const role = String(ctx.role).toLowerCase();
  if (!(ctx.isSuperAdmin || role === 'restaurant_admin' || role === 'admin' || role === 'manager' || role === 'branch_manager')) {
    throw new Error('Personal credit is restricted to managers and administrators');
  }
}

function money(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error('Invalid monetary amount');
  return Math.round(n * 100) / 100;
}

async function nextPublicReference(sql: ReturnType<typeof getSql>): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const ref = `PCC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const rows = await sql`SELECT 1 FROM personal_credit_profiles WHERE public_reference = ${ref} LIMIT 1`;
    if (!rows.length) return ref;
  }
  throw new Error('Unable to allocate a credit profile reference');
}

export async function listPersonalCreditProfiles(ctx: TenantContext, branchId?: string) {
  assertCreditManager(ctx);
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);
  const effectiveBranch = branchId || ctx.branchId || undefined;
  if (effectiveBranch) assertBranchAccess(ctx, effectiveBranch);

  if (ctx.isSuperAdmin && !effectiveBranch) {
    return await sql`SELECT p.*, b.name AS branch_name, o.name AS organization_name FROM personal_credit_profiles p JOIN branches b ON b.id=p.branch_id JOIN organizations o ON o.id=p.organization_id ORDER BY p.updated_at DESC LIMIT 1000`;
  }
  if (!effectiveBranch) throw new Error('Branch is required');
  return await sql`SELECT p.*, b.name AS branch_name FROM personal_credit_profiles p JOIN branches b ON b.id=p.branch_id WHERE p.organization_id=${ctx.organizationId} AND p.branch_id=${effectiveBranch} ORDER BY p.updated_at DESC LIMIT 1000`;
}

export async function getPersonalCreditProfile(ctx: TenantContext, profileId: string) {
  assertCreditManager(ctx);
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);
  const rows = await sql`SELECT p.*, b.name AS branch_name FROM personal_credit_profiles p JOIN branches b ON b.id=p.branch_id WHERE p.id=${profileId} AND p.organization_id=${ctx.organizationId} LIMIT 1`;
  if (!rows.length) return null;
  const profile = rows[0] as any;
  assertBranchAccess(ctx, profile.branch_id);
  return profile;
}

export async function createPersonalCreditProfile(ctx: TenantContext, input: { branchId?: string; fullName: string; phone?: string; email?: string; creditLimitUgx?: number; notes?: string }) {
  assertCreditManager(ctx);
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);
  const branchId = input.branchId || ctx.branchId;
  if (!branchId) throw new Error('Branch is required');
  assertBranchAccess(ctx, branchId);
  const name = String(input.fullName || '').trim();
  if (name.length < 2 || name.length > 160) throw new Error('A valid customer name is required');
  const limit = money(input.creditLimitUgx ?? 0);
  const ref = await nextPublicReference(sql);
  const id = generateId();
  await sql`INSERT INTO personal_credit_profiles (id, organization_id, branch_id, public_reference, full_name, phone, email, credit_limit_ugx, current_balance_ugx, status, notes, created_by, created_at, updated_at) VALUES (${id},${ctx.organizationId},${branchId},${ref},${name},${input.phone?.trim()||null},${input.email?.trim().toLowerCase()||null},${limit},0,'active',${input.notes?.trim()||null},${ctx.userId},NOW(),NOW())`;
  await logAudit(ctx.userId, 'personal_credit.create', { profileId:id, publicReference:ref, branchId }, ctx.organizationId, branchId);
  return getPersonalCreditProfile(ctx, id);
}

export async function recordPersonalCreditPayment(ctx: TenantContext, profileId: string, amountInput: number, description?: string) {
  assertCreditManager(ctx);
  const amount = money(amountInput);
  if (amount <= 0) throw new Error('Payment must be greater than zero');
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);
  const rows = await sql`SELECT * FROM personal_credit_profiles WHERE id=${profileId} AND organization_id=${ctx.organizationId} FOR UPDATE`;
  if (!rows.length) throw new Error('Credit profile not found');
  const profile = rows[0] as any;
  assertBranchAccess(ctx, profile.branch_id);
  if (profile.status !== 'active') throw new Error('Credit profile is not active');
  const balance = Number(profile.current_balance_ugx);
  if (amount > balance) throw new Error('Payment cannot exceed the outstanding balance');
  const next = balance - amount;
  await sql`UPDATE personal_credit_profiles SET current_balance_ugx=${next}, updated_at=NOW() WHERE id=${profileId} AND organization_id=${ctx.organizationId}`;
  await sql`INSERT INTO personal_credit_ledger (id,organization_id,branch_id,profile_id,entry_type,amount_ugx,balance_after_ugx,description,created_by,created_at) VALUES (${generateId()},${ctx.organizationId},${profile.branch_id},${profileId},'payment',${amount},${next},${description?.trim()||'Credit payment'},${ctx.userId},NOW())`;
  await logAudit(ctx.userId, 'personal_credit.payment', { profileId, amount, balanceAfter:next }, ctx.organizationId, profile.branch_id);
  return getPersonalCreditProfile(ctx, profileId);
}

export async function getPersonalCreditHistory(ctx: TenantContext, profileId: string) {
  assertCreditManager(ctx);
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);
  const profile = await getPersonalCreditProfile(ctx, profileId);
  if (!profile) return null;
  const ledger = await sql`SELECT l.*, o.table_number, o.items, o.created_at AS order_created_at FROM personal_credit_ledger l LEFT JOIN orders o ON o.id=l.order_id WHERE l.profile_id=${profileId} AND l.organization_id=${ctx.organizationId} ORDER BY l.created_at DESC LIMIT 1000`;
  return { profile, ledger };
}

export async function chargePersonalCredit(ctx: TenantContext, profileId: string, orderId: string, amountInput: number) {
  assertCreditManager(ctx);
  const amount = money(amountInput);
  if (amount <= 0) throw new Error('Charge must be greater than zero');
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);
  const rows = await sql`SELECT * FROM personal_credit_profiles WHERE id=${profileId} AND organization_id=${ctx.organizationId} FOR UPDATE`;
  if (!rows.length) throw new Error('Credit profile not found');
  const profile = rows[0] as any;
  assertBranchAccess(ctx, profile.branch_id);
  if (profile.status !== 'active') throw new Error('Credit profile is not active');
  const remaining = Number(profile.credit_limit_ugx) - Number(profile.current_balance_ugx);
  if (amount > remaining) throw new Error(`Insufficient personal credit. Available: ${remaining}`);
  const orderRows = await sql`SELECT id, restaurant_id, organization_id, total, personal_credit_profile_id FROM orders WHERE id=${orderId} AND organization_id=${ctx.organizationId} LIMIT 1`;
  if (!orderRows.length) throw new Error('Order not found');
  const order = orderRows[0] as any;
  if (order.restaurant_id !== profile.branch_id) throw new Error('Order and credit profile belong to different branches');
  if (order.personal_credit_profile_id && order.personal_credit_profile_id !== profileId) throw new Error('Order is already linked to another personal credit profile');
  const next = Number(profile.current_balance_ugx) + amount;
  await sql`UPDATE personal_credit_profiles SET current_balance_ugx=${next}, updated_at=NOW() WHERE id=${profileId} AND organization_id=${ctx.organizationId}`;
  await sql`UPDATE orders SET personal_credit_profile_id=${profileId}, is_personal_credit=true, payment_status='unpaid', payment_method='personal_credit', updated_at=NOW() WHERE id=${orderId} AND organization_id=${ctx.organizationId}`;
  await sql`INSERT INTO personal_credit_ledger (id,organization_id,branch_id,profile_id,order_id,entry_type,amount_ugx,balance_after_ugx,description,created_by,created_at) VALUES (${generateId()},${ctx.organizationId},${profile.branch_id},${profileId},${orderId},'charge',${amount},${next},'Restaurant order credit charge',${ctx.userId},NOW())`;
  await logAudit(ctx.userId, 'personal_credit.charge', { profileId, orderId, amount, balanceAfter:next }, ctx.organizationId, profile.branch_id);
  return getPersonalCreditProfile(ctx, profileId);
}
