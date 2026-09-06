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
  if (!ctx.isSuperAdmin) await setTenantContext(sql, ctx.organizationId);
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
  if (!ctx.isSuperAdmin) await setTenantContext(sql, ctx.organizationId);
  const rows = ctx.isSuperAdmin
    ? await sql`SELECT p.*, b.name AS branch_name FROM personal_credit_profiles p JOIN branches b ON b.id=p.branch_id WHERE p.id=${profileId} LIMIT 1`
    : await sql`SELECT p.*, b.name AS branch_name FROM personal_credit_profiles p JOIN branches b ON b.id=p.branch_id WHERE p.id=${profileId} AND p.organization_id=${ctx.organizationId} LIMIT 1`;
  if (!rows.length) return null;
  const profile = rows[0] as any;
  assertBranchAccess(ctx, profile.branch_id);
  return profile;
}

export async function createPersonalCreditProfile(ctx: TenantContext, input: { branchId?: string; fullName: string; phone?: string; email?: string; creditLimitUgx?: number; notes?: string }) {
  assertCreditManager(ctx);
  const sql = getSql();
  if (!ctx.isSuperAdmin) await setTenantContext(sql, ctx.organizationId);
  const branchId = input.branchId || ctx.branchId;
  if (!branchId) throw new Error('Branch is required');
  const branchRows = await sql`SELECT id,organization_id FROM branches WHERE id=${branchId} LIMIT 1`;
  if (!branchRows.length || (!ctx.isSuperAdmin && (branchRows[0] as any).organization_id !== ctx.organizationId)) throw new Error('Branch not found');
  assertBranchAccess(ctx, branchId);
  const organizationId = (branchRows[0] as any).organization_id;
  const name = String(input.fullName || '').trim();
  if (name.length < 2 || name.length > 160) throw new Error('A valid customer name is required');
  const limit = money(input.creditLimitUgx ?? 0);
  const ref = await nextPublicReference(sql);
  const id = generateId();
  await sql`INSERT INTO personal_credit_profiles (id, organization_id, branch_id, public_reference, full_name, phone, email, credit_limit_ugx, current_balance_ugx, status, notes, created_by, created_at, updated_at) VALUES (${id},${organizationId},${branchId},${ref},${name},${input.phone?.trim()||null},${input.email?.trim().toLowerCase()||null},${limit},0,'active',${input.notes?.trim()||null},${ctx.userId},NOW(),NOW())`;
  await logAudit(ctx.userId, 'personal_credit.create', { profileId:id, publicReference:ref, branchId }, organizationId, branchId);
  return getPersonalCreditProfile(ctx, id);
}

export async function recordPersonalCreditPayment(ctx: TenantContext, profileId: string, amountInput: number, description?: string) {
  assertCreditManager(ctx);
  const amount = money(amountInput);
  if (amount <= 0) throw new Error('Payment must be greater than zero');
  const sql = getSql();
  if (!ctx.isSuperAdmin) await setTenantContext(sql, ctx.organizationId);
  const id = generateId();
  const rows = await sql`WITH target AS (SELECT id,organization_id,branch_id,current_balance_ugx FROM personal_credit_profiles WHERE id=${profileId} AND (${ctx.isSuperAdmin} OR organization_id=${ctx.organizationId}) AND status='active'), updated AS (UPDATE personal_credit_profiles p SET current_balance_ugx=p.current_balance_ugx-${amount}, updated_at=NOW() FROM target t WHERE p.id=t.id AND p.current_balance_ugx >= ${amount} RETURNING p.id,p.organization_id,p.branch_id,p.current_balance_ugx), ledger AS (INSERT INTO personal_credit_ledger (id,organization_id,branch_id,profile_id,entry_type,amount_ugx,balance_after_ugx,description,created_by,created_at) SELECT ${id},u.organization_id,u.branch_id,u.id,'payment',${amount},u.current_balance_ugx,${description?.trim()||'Credit payment'},${ctx.userId},NOW() FROM updated u RETURNING profile_id) SELECT * FROM updated`;
  if (!rows.length) throw new Error('Payment exceeds the outstanding balance or credit profile is not active');
  const profile = rows[0] as any;
  assertBranchAccess(ctx, profile.branch_id);
  await logAudit(ctx.userId, 'personal_credit.payment', { profileId, amount, balanceAfter:Number(profile.current_balance_ugx) }, profile.organization_id, profile.branch_id);
  return getPersonalCreditProfile(ctx, profileId);
}

export async function getPersonalCreditHistory(ctx: TenantContext, profileId: string) {
  assertCreditManager(ctx);
  const sql = getSql();
  const profile = await getPersonalCreditProfile(ctx, profileId);
  if (!profile) return null;
  const ledger = await sql`SELECT l.*, o.table_number, o.items, o.created_at AS order_created_at FROM personal_credit_ledger l LEFT JOIN orders o ON o.id=l.order_id WHERE l.profile_id=${profileId} AND l.organization_id=${profile.organization_id} ORDER BY l.created_at DESC LIMIT 1000`;
  return { profile, ledger };
}

export async function chargePersonalCredit(ctx: TenantContext, profileId: string, orderId: string, amountInput: number) {
  assertCreditManager(ctx);
  const amount = money(amountInput);
  if (amount <= 0) throw new Error('Charge must be greater than zero');
  const sql = getSql();
  if (!ctx.isSuperAdmin) await setTenantContext(sql, ctx.organizationId);
  const ledgerId = generateId();
  const rows = await sql`WITH profile AS (SELECT id,organization_id,branch_id,credit_limit_ugx,current_balance_ugx FROM personal_credit_profiles WHERE id=${profileId} AND (${ctx.isSuperAdmin} OR organization_id=${ctx.organizationId}) AND status='active'), ord AS (SELECT id,organization_id,restaurant_id,total,personal_credit_profile_id FROM orders WHERE id=${orderId} AND (${ctx.isSuperAdmin} OR organization_id=${ctx.organizationId})), eligible AS (SELECT p.*,o.id AS order_id FROM profile p JOIN ord o ON o.organization_id=p.organization_id AND o.restaurant_id=p.branch_id WHERE (o.personal_credit_profile_id IS NULL OR o.personal_credit_profile_id=p.id) AND p.current_balance_ugx+${amount} <= p.credit_limit_ugx), updated_profile AS (UPDATE personal_credit_profiles p SET current_balance_ugx=p.current_balance_ugx+${amount}, updated_at=NOW() FROM eligible e WHERE p.id=e.id RETURNING p.id,p.organization_id,p.branch_id,p.current_balance_ugx), updated_order AS (UPDATE orders o SET personal_credit_profile_id=${profileId}, is_personal_credit=true, payment_status='unpaid', payment_method='personal_credit', updated_at=NOW() FROM eligible e WHERE o.id=e.order_id AND EXISTS (SELECT 1 FROM updated_profile u WHERE u.id=e.id) RETURNING o.id), ledger AS (INSERT INTO personal_credit_ledger (id,organization_id,branch_id,profile_id,order_id,entry_type,amount_ugx,balance_after_ugx,description,created_by,created_at) SELECT ${ledgerId},u.organization_id,u.branch_id,u.id,uo.id,'charge',${amount},u.current_balance_ugx,'Restaurant order credit charge',${ctx.userId},NOW() FROM updated_profile u JOIN updated_order uo ON true RETURNING profile_id) SELECT u.*,uo.id AS order_id FROM updated_profile u JOIN updated_order uo ON true`;
  if (!rows.length) throw new Error('Credit charge failed: profile/order not found, branch mismatch, order already assigned, or credit limit exceeded');
  const profile = rows[0] as any;
  assertBranchAccess(ctx, profile.branch_id);
  await logAudit(ctx.userId, 'personal_credit.charge', { profileId, orderId, amount, balanceAfter:Number(profile.current_balance_ugx) }, profile.organization_id, profile.branch_id);
  return getPersonalCreditProfile(ctx, profileId);
}
