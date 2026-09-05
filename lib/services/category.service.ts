import { getSql } from '@/lib/neon-server';
import { setTenantContext } from '@/lib/tenant';
import type { TenantContext } from '@/lib/tenant';

export interface Category {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  sort_order: number;
  organization_id?: string;
  branch_id?: string;
  created_at: number;
}

export async function listCategories(ctx: TenantContext): Promise<Category[]> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);
  const rows = await sql`
    SELECT * FROM categories
    WHERE organization_id = ${ctx.organizationId}
    ORDER BY sort_order ASC, name ASC
  `;
  return rows as Category[];
}

export async function createCategory(
  ctx: TenantContext,
  data: { name: string; icon?: string; description?: string; sort_order?: number }
): Promise<Category> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);
  const id = crypto.randomUUID();
  const rows = await sql`
    INSERT INTO categories (id, name, icon, description, sort_order, organization_id, branch_id, created_at)
    VALUES (${id}, ${data.name}, ${data.icon || null}, ${data.description || null}, ${data.sort_order || 0}, ${ctx.organizationId}, ${ctx.branchId}, NOW())
    RETURNING *
  `;
  return rows[0] as Category;
}

export async function updateCategory(
  ctx: TenantContext,
  id: string,
  data: { name?: string; icon?: string; description?: string; sort_order?: number }
): Promise<Category | null> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);
  const rows = await sql`
    UPDATE categories SET
      name = COALESCE(${data.name}, name),
      icon = COALESCE(${data.icon}, icon),
      description = COALESCE(${data.description}, description),
      sort_order = COALESCE(${data.sort_order}, sort_order)
    WHERE id = ${id} AND organization_id = ${ctx.organizationId}
    RETURNING *
  `;
  return rows.length > 0 ? (rows[0] as Category) : null;
}

export async function deleteCategory(ctx: TenantContext, id: string): Promise<void> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);
  await sql`DELETE FROM categories WHERE id = ${id} AND organization_id = ${ctx.organizationId}`;
}
