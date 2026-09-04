import { getSql } from '@/lib/neon-server';
import type { TenantContext } from '@/lib/tenant';
import { setTenantContext } from '@/lib/tenant';
import { generateId } from '@/lib/id';

const VAT_RATE = 0.18;

export interface ExpenseInput {
  branchId?: string;
  branchName?: string;
  title: string;
  category?: string;
  amountUGX: number;
  notes?: string;
  receiptUrl?: string;
}

export interface Expense {
  id: string;
  branch_id: string | null;
  branch_name: string | null;
  title: string;
  category: string | null;
  amount_ugx: number;
  vat_amount_ugx: number;
  receipt_url: string | null;
  notes: string | null;
  organization_id: string;
  created_at: any;
}

export async function listExpenses(
  ctx: TenantContext,
  branchId?: string,
  startDate?: string,
  endDate?: string
): Promise<Expense[]> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  let paramIdx = 1;
  const conditions: string[] = [`organization_id = $${paramIdx++}`];
  const values: any[] = [ctx.organizationId];

  if (branchId) {
    conditions.push(`branch_id = $${paramIdx++}`);
    values.push(branchId);
  }
  if (startDate) {
    conditions.push(`created_at >= $${paramIdx++}`);
    values.push(startDate);
  }
  if (endDate) {
    conditions.push(`created_at <= $${paramIdx++}`);
    values.push(endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await sql(
    `SELECT * FROM expenses ${whereClause} ORDER BY created_at DESC`,
    values
  );

  return rows as Expense[];
}

export async function createExpense(
  ctx: TenantContext,
  input: ExpenseInput
): Promise<Expense> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const id = generateId();
  const vatAmount = Math.round(input.amountUGX * VAT_RATE * 100) / 100;

  const rows = await sql`
    INSERT INTO expenses (
      id, branch_id, branch_name, title, category,
      amount_ugx, vat_amount_ugx, receipt_url, notes,
      organization_id, created_at
    )
    VALUES (
      ${id},
      ${input.branchId ?? ctx.branchId},
      ${input.branchName ?? null},
      ${input.title},
      ${input.category ?? 'General'},
      ${input.amountUGX},
      ${vatAmount},
      ${input.receiptUrl ?? null},
      ${input.notes ?? null},
      ${ctx.organizationId},
      NOW()
    )
    RETURNING *
  ` as Expense[];

  return rows[0];
}
