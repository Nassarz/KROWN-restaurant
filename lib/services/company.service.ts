// KROWN POS — Company + Corporate Credit Management
import { getSql } from '@/lib/neon-server';
import { TenantContext, setTenantContext, checkSubscriptionLimit } from '@/lib/tenant';
import { generateId } from '@/lib/id';
import { logAudit } from '@/lib/audit';

// ── Types ──────────────────────────────────────────────────────────────────
export interface Company {
  id: string;
  organization_id: string;
  name: string;
  tax_id: string;
  credit_limit_ugx: number;
  current_balance_ugx: number;
  contact_person: string;
  phone: string;
  status: 'active' | 'suspended' | 'closed';
  branch_id?: string;
  created_at: number;
  updated_at: number;
}

export interface CompanyStaff {
  id: string;
  company_id: string;
  organization_id: string;
  name: string;
  work_id?: string;
  email?: string;
  department?: string;
  credit_limit_ugx?: number;
  status: 'active' | 'inactive' | 'banned';
  total_spent_ugx: number;
  created_at: number;
  updated_at: number;
}

// ── Service Methods ────────────────────────────────────────────────────────

export async function listCompanies(
  ctx: TenantContext,
  branchId?: string
): Promise<Company[]> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  let rows;
  if (ctx.isSuperAdmin) {
    // Super admins see all companies across all orgs
    if (branchId) {
      rows = await sql`SELECT * FROM companies WHERE (branch_id = ${branchId} OR branch_id IS NULL) ORDER BY name ASC`;
    } else {
      rows = await sql`SELECT * FROM companies ORDER BY name ASC`;
    }
  } else if (branchId) {
    rows = await sql`SELECT * FROM companies WHERE organization_id = ${ctx.organizationId} AND (branch_id = ${branchId} OR branch_id IS NULL) ORDER BY name ASC`;
  } else {
    rows = await sql`SELECT * FROM companies WHERE organization_id = ${ctx.organizationId} ORDER BY name ASC`;
  }

  return rows as Company[];
}

export async function getCompany(
  ctx: TenantContext,
  companyId: string
): Promise<Company | null> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const rows = await sql`SELECT * FROM companies WHERE id = ${companyId} AND organization_id = ${ctx.organizationId}`;
  return rows.length > 0 ? (rows[0] as Company) : null;
}

export async function createCompany(
  ctx: TenantContext,
  input: {
    name: string;
    taxId: string;
    creditLimitUGX: number;
    contactPerson: string;
    phone: string;
    branchId?: string;
  }
): Promise<Company> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const id = generateId();

  await sql`
    INSERT INTO companies (id, organization_id, name, tax_id, credit_limit_ugx, current_balance_ugx, contact_person, phone, status, branch_id, created_at, updated_at)
    VALUES (${id}, ${ctx.organizationId}, ${input.name}, ${input.taxId}, ${input.creditLimitUGX}, 0, ${input.contactPerson}, ${input.phone}, 'active', ${input.branchId || ctx.branchId}, NOW(), NOW())
  `;

  await logAudit(ctx.userId, 'company.create', { companyId: id, name: input.name }, ctx.organizationId, ctx.branchId);

  const rows = await sql`SELECT * FROM companies WHERE id = ${id}`;
  return rows[0] as Company;
}

export async function updateCompany(
  ctx: TenantContext,
  companyId: string,
  updates: Partial<Pick<Company, 'name' | 'tax_id' | 'credit_limit_ugx' | 'contact_person' | 'phone' | 'branch_id'>>
): Promise<Company> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const existing = await sql`SELECT * FROM companies WHERE id = ${companyId} AND organization_id = ${ctx.organizationId}`;
  if (existing.length === 0) throw new Error('Company not found');

  const fields: string[] = [];
  const values: any[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      fields.push(key);
      values.push(value);
    }
  }

  if (fields.length === 0) return existing[0] as Company;

  const setClauses = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  values.push(companyId, ctx.organizationId);

  await sql(`UPDATE companies SET ${setClauses}, updated_at = NOW() WHERE id = $${fields.length + 1} AND organization_id = $${fields.length + 2}`, values);

  await logAudit(ctx.userId, 'company.update', { companyId, fields }, ctx.organizationId, ctx.branchId);

  const rows = await sql`SELECT * FROM companies WHERE id = ${companyId}`;
  return rows[0] as Company;
}

export async function toggleStatus(
  ctx: TenantContext,
  companyId: string,
  newStatus: Company['status']
): Promise<Company> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const existing = await sql`SELECT * FROM companies WHERE id = ${companyId} AND organization_id = ${ctx.organizationId}`;
  if (existing.length === 0) throw new Error('Company not found');

  await sql`
    UPDATE companies SET status = ${newStatus}, updated_at = NOW()
    WHERE id = ${companyId} AND organization_id = ${ctx.organizationId}
  `;

  await logAudit(ctx.userId, 'company.toggle_status', { companyId, status: newStatus }, ctx.organizationId, ctx.branchId);

  const rows = await sql`SELECT * FROM companies WHERE id = ${companyId}`;
  return rows[0] as Company;
}

export async function listCompanyStaff(
  ctx: TenantContext,
  companyId: string
): Promise<CompanyStaff[]> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const rows = await sql`SELECT * FROM company_staff WHERE company_id = ${companyId} AND organization_id = ${ctx.organizationId} ORDER BY name ASC`;
  return rows as CompanyStaff[];
}

export async function addCompanyStaff(
  ctx: TenantContext,
  companyId: string,
  input: {
    name: string;
    workId?: string;
    email?: string;
    department?: string;
    creditLimitUGX?: number;
  }
): Promise<CompanyStaff> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const existing = await sql`SELECT * FROM companies WHERE id = ${companyId} AND organization_id = ${ctx.organizationId}`;
  if (existing.length === 0) throw new Error('Company not found');

  const id = generateId();

  await sql`
    INSERT INTO company_staff (id, company_id, organization_id, name, work_id, email, department, credit_limit_ugx, status, created_at)
    VALUES (${id}, ${companyId}, ${ctx.organizationId}, ${input.name}, ${input.workId || null}, ${input.email || null}, ${input.department || null}, ${input.creditLimitUGX || null}, 'active', NOW())
  `;

  await logAudit(ctx.userId, 'company.add_staff', { companyId, staffId: id, name: input.name }, ctx.organizationId, ctx.branchId);

  const rows = await sql`SELECT * FROM company_staff WHERE id = ${id}`;
  return rows[0] as CompanyStaff;
}

export async function updateCompanyStaff(
  ctx: TenantContext,
  companyId: string,
  staffId: string,
  updates: Partial<Pick<CompanyStaff, 'name' | 'work_id' | 'email' | 'department' | 'credit_limit_ugx' | 'status'>>
): Promise<CompanyStaff> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const existing = await sql`SELECT * FROM company_staff WHERE id = ${staffId} AND company_id = ${companyId} AND organization_id = ${ctx.organizationId}`;
  if (existing.length === 0) throw new Error('Company staff not found');

  const fields: string[] = [];
  const values: any[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      fields.push(key);
      values.push(value);
    }
  }

  if (fields.length === 0) return existing[0] as CompanyStaff;

  const setClauses = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  values.push(staffId, companyId, ctx.organizationId);

  await sql(`UPDATE company_staff SET ${setClauses}, updated_at = NOW() WHERE id = $${fields.length + 1} AND company_id = $${fields.length + 2} AND organization_id = $${fields.length + 3}`, values);

  await logAudit(ctx.userId, 'company.update_staff', { companyId, staffId, fields }, ctx.organizationId, ctx.branchId);

  const rows = await sql`SELECT * FROM company_staff WHERE id = ${staffId}`;
  return rows[0] as CompanyStaff;
}

export async function deleteCompanyStaff(
  ctx: TenantContext,
  companyId: string,
  staffId: string
): Promise<void> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const existing = await sql`SELECT * FROM company_staff WHERE id = ${staffId} AND company_id = ${companyId} AND organization_id = ${ctx.organizationId}`;
  if (existing.length === 0) throw new Error('Company staff not found');

  await sql`DELETE FROM company_staff WHERE id = ${staffId} AND company_id = ${companyId} AND organization_id = ${ctx.organizationId}`;

  await logAudit(ctx.userId, 'company.delete_staff', { companyId, staffId }, ctx.organizationId, ctx.branchId);
}

export async function settleBalance(
  ctx: TenantContext,
  companyId: string,
  amount: number,
  paymentMethod: string
): Promise<Company> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const existing = await sql`SELECT * FROM companies WHERE id = ${companyId} AND organization_id = ${ctx.organizationId}`;
  if (existing.length === 0) throw new Error('Company not found');
  const company = existing[0] as Company;

  const newBalance = company.current_balance_ugx - amount;
  if (newBalance < 0) throw new Error('Settlement amount exceeds current balance');

  await sql`BEGIN`;
  try {
    await sql`
      UPDATE companies SET current_balance_ugx = ${newBalance}, updated_at = NOW()
      WHERE id = ${companyId} AND organization_id = ${ctx.organizationId}
    `;

    await sql`
      INSERT INTO accounting_ledger (id, organization_id, restaurant_id, type, amount, created_at)
      VALUES (${generateId()}, ${ctx.organizationId}, ${company.branch_id || null}, 'SETTLEMENT', ${amount}, NOW())
    `;

    await sql`COMMIT`;
  } catch (e) {
    await sql`ROLLBACK`;
    throw e;
  }

  await logAudit(ctx.userId, 'company.settle_balance', { companyId, amount, method: paymentMethod }, ctx.organizationId, ctx.branchId);

  const rows = await sql`SELECT * FROM companies WHERE id = ${companyId}`;
  return rows[0] as Company;
}

export async function checkStaffAllowed(
  ctx: TenantContext,
  staffId: string
): Promise<{ allowed: boolean; reason?: string; companyStaff?: CompanyStaff }> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const rows = await sql`SELECT cs.*, c.status as company_status, c.credit_limit_ugx as company_credit_limit, c.current_balance_ugx as company_balance FROM company_staff cs JOIN companies c ON cs.company_id = c.id WHERE cs.id = ${staffId} AND cs.organization_id = ${ctx.organizationId}`;

  if (rows.length === 0) {
    return { allowed: false, reason: 'Staff member not found' };
  }

  const record = rows[0] as any;

  if (record.status !== 'active') {
    return { allowed: false, reason: 'Staff member is not active' };
  }

  if (record.company_status !== 'active') {
    return { allowed: false, reason: 'Company account is not active' };
  }

  if (record.credit_limit_ugx !== null && record.total_spent_ugx >= record.credit_limit_ugx) {
    return { allowed: false, reason: 'Staff credit limit reached' };
  }

  const companyStaff: CompanyStaff = {
    id: record.id,
    company_id: record.company_id,
    organization_id: record.organization_id,
    name: record.name,
    work_id: record.work_id,
    email: record.email,
    department: record.department,
    credit_limit_ugx: record.credit_limit_ugx,
    status: record.status,
    total_spent_ugx: record.total_spent_ugx,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };

  return { allowed: true, companyStaff };
}
