// KROWN POS — Ingredient CRUD + Inventory Movements
import { getSql } from '@/lib/neon-server';
import { TenantContext, setTenantContext, checkSubscriptionLimit } from '@/lib/tenant';
import { generateId } from '@/lib/id';
import { logAudit } from '@/lib/audit';

// ── Types ──────────────────────────────────────────────────────────────────
export interface Ingredient {
  id: string;
  organization_id: string;
  name: string;
  quantity: number;
  unit: string;
  min_threshold: number;
  category: string;
  cost_per_unit_ugx: number;
  supplier: string;
  branch_id?: string;
  linked_product_id?: string;
  deduct_from_sales: boolean;
  deduct_amount_per_sale: number;
  created_at: number;
  updated_at: number;
}

export interface InventoryMovement {
  id: string;
  organization_id: string;
  ingredient_id: string;
  branch_id?: string;
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  reason: string;
  staff_id?: string;
  created_at: number;
}

// ── Service Methods ────────────────────────────────────────────────────────

export async function listIngredients(
  ctx: TenantContext,
  branchId?: string
): Promise<Ingredient[]> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  let rows;
  if (branchId) {
    rows = await sql`SELECT * FROM ingredients WHERE organization_id = ${ctx.organizationId} AND (branch_id = ${branchId} OR branch_id IS NULL) ORDER BY name ASC`;
  } else {
    rows = await sql`SELECT * FROM ingredients WHERE organization_id = ${ctx.organizationId} ORDER BY name ASC`;
  }

  return rows as Ingredient[];
}

export async function getIngredient(
  ctx: TenantContext,
  ingredientId: string
): Promise<Ingredient | null> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const rows = await sql`SELECT * FROM ingredients WHERE id = ${ingredientId} AND organization_id = ${ctx.organizationId}`;
  return rows.length > 0 ? (rows[0] as Ingredient) : null;
}

export async function createIngredient(
  ctx: TenantContext,
  input: {
    name: string;
    quantity: number;
    unit: string;
    minThreshold: number;
    category: string;
    costPerUnitUGX: number;
    supplier: string;
    branchId?: string;
    linkedProductId?: string;
    deductFromSales?: boolean;
    deductAmountPerSale?: number;
  }
): Promise<Ingredient> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  // Check subscription limit (shared with menu_items for now)
  const countRows = await sql`SELECT COUNT(*)::int as count FROM ingredients WHERE organization_id = ${ctx.organizationId}`;
  const currentCount = (countRows[0] as any).count;
  const limitCheck = await checkSubscriptionLimit(ctx.organizationId, 'menu_items', currentCount);
  if (!limitCheck.allowed) {
    throw new Error(`Subscription limit reached: ${currentCount}/${limitCheck.limit} ingredients. Please upgrade your plan.`);
  }

  const id = generateId();

  await sql`
    INSERT INTO ingredients (id, organization_id, name, quantity, unit, min_threshold, category, cost_per_unit_ugx, supplier, branch_id, linked_product_id, deduct_from_sales, deduct_amount_per_sale, created_at, updated_at)
    VALUES (${id}, ${ctx.organizationId}, ${input.name}, ${input.quantity}, ${input.unit}, ${input.minThreshold}, ${input.category}, ${input.costPerUnitUGX}, ${input.supplier}, ${input.branchId || ctx.branchId}, ${input.linkedProductId || null}, ${input.deductFromSales ?? false}, ${input.deductAmountPerSale ?? 0}, NOW(), NOW())
  `;

  await logAudit(ctx.userId, 'ingredient.create', { ingredientId: id, name: input.name }, ctx.organizationId, ctx.branchId);

  const rows = await sql`SELECT * FROM ingredients WHERE id = ${id}`;
  return rows[0] as Ingredient;
}

export async function updateIngredient(
  ctx: TenantContext,
  ingredientId: string,
  updates: Partial<Pick<Ingredient, 'name' | 'quantity' | 'unit' | 'min_threshold' | 'category' | 'cost_per_unit_ugx' | 'supplier' | 'linked_product_id' | 'deduct_from_sales' | 'deduct_amount_per_sale'>>
): Promise<Ingredient> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const existing = await sql`SELECT * FROM ingredients WHERE id = ${ingredientId} AND organization_id = ${ctx.organizationId}`;
  if (existing.length === 0) throw new Error('Ingredient not found');

  const fields: string[] = [];
  const values: any[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      fields.push(key);
      values.push(value);
    }
  }

  if (fields.length === 0) return existing[0] as Ingredient;

  const setClauses = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  values.push(ingredientId, ctx.organizationId);

  await sql(`UPDATE ingredients SET ${setClauses}, updated_at = NOW() WHERE id = $${fields.length + 1} AND organization_id = $${fields.length + 2}`, values);

  await logAudit(ctx.userId, 'ingredient.update', { ingredientId, fields }, ctx.organizationId, ctx.branchId);

  const rows = await sql`SELECT * FROM ingredients WHERE id = ${ingredientId}`;
  return rows[0] as Ingredient;
}

export async function deleteIngredient(
  ctx: TenantContext,
  ingredientId: string
): Promise<void> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const existing = await sql`SELECT * FROM ingredients WHERE id = ${ingredientId} AND organization_id = ${ctx.organizationId}`;
  if (existing.length === 0) throw new Error('Ingredient not found');

  await sql`DELETE FROM product_ingredients WHERE ingredient_id = ${ingredientId} AND organization_id = ${ctx.organizationId}`;
  await sql`DELETE FROM ingredients WHERE id = ${ingredientId} AND organization_id = ${ctx.organizationId}`;

  await logAudit(ctx.userId, 'ingredient.delete', { ingredientId }, ctx.organizationId, ctx.branchId);
}

export async function updateQuantity(
  ctx: TenantContext,
  ingredientId: string,
  newQuantity: number
): Promise<Ingredient> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const existing = await sql`SELECT * FROM ingredients WHERE id = ${ingredientId} AND organization_id = ${ctx.organizationId}`;
  if (existing.length === 0) throw new Error('Ingredient not found');
  const ingredient = existing[0] as Ingredient;

  const diff = newQuantity - ingredient.quantity;

  await sql`BEGIN`;
  try {
    await sql`
      UPDATE ingredients SET quantity = ${newQuantity}, updated_at = NOW()
      WHERE id = ${ingredientId} AND organization_id = ${ctx.organizationId}
    `;

    await sql`
      INSERT INTO inventory_movements (id, organization_id, ingredient_id, ingredient_name, type, quantity_change, quantity_before, quantity_after, branch_id, performed_by, created_at)
      VALUES (${generateId()}, ${ctx.organizationId}, ${ingredientId}, ${ingredient.name || null}, ${diff >= 0 ? 'adjustment_in' : 'adjustment_out'}, ${diff}, ${ingredient.quantity}, ${newQuantity}, ${ingredient.branch_id || null}, ${ctx.userId || null}, NOW())
    `;

    await sql`COMMIT`;
  } catch (e) {
    await sql`ROLLBACK`;
    throw e;
  }

  await logAudit(ctx.userId, 'ingredient.update_quantity', { ingredientId, old: ingredient.quantity, new: newQuantity }, ctx.organizationId, ctx.branchId);

  const rows = await sql`SELECT * FROM ingredients WHERE id = ${ingredientId}`;
  return rows[0] as Ingredient;
}

export async function listMovements(
  ctx: TenantContext,
  branchId?: string,
  limit: number = 50
): Promise<InventoryMovement[]> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  let rows;
  if (branchId) {
    rows = await sql`SELECT * FROM inventory_movements WHERE organization_id = ${ctx.organizationId} AND branch_id = ${branchId} ORDER BY created_at DESC LIMIT ${limit}`;
  } else {
    rows = await sql`SELECT * FROM inventory_movements WHERE organization_id = ${ctx.organizationId} ORDER BY created_at DESC LIMIT ${limit}`;
  }

  return rows as InventoryMovement[];
}
