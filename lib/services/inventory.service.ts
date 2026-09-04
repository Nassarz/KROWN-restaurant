import { getSql } from '@/lib/neon-server';
import type { TenantContext } from '@/lib/tenant';
import { setTenantContext } from '@/lib/tenant';
import { generateId } from '@/lib/id';

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
}

export interface InventoryMovementRecord {
  id: string;
  ingredient_id: string;
  ingredient_name: string;
  type: string;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  order_id: string | null;
  product_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  performed_by: string | null;
  organization_id: string;
  created_at: any;
}

export interface Ingredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  deduct_from_sales: boolean;
  linked_product_id: string | null;
  deduct_amount_per_sale: number;
  branch_id: string | null;
  branch_name: string | null;
}

export interface ProductIngredient {
  product_id: string;
  ingredient_id: string;
  quantity_per_unit: number;
}

export async function deductInventory(
  ctx: TenantContext,
  items: OrderItem[],
  orderId: string,
  branchId: string | null,
  branchName: string | null
): Promise<InventoryMovementRecord[]> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  const movements: InventoryMovementRecord[] = [];

  for (const item of items) {
    // 1. Look up product_ingredients mapping
    const mappings = await sql`
      SELECT product_id, ingredient_id, quantity_per_unit
      FROM product_ingredients
      WHERE product_id = ${item.productId} AND organization_id = ${ctx.organizationId}
    ` as ProductIngredient[];

    for (const mapping of mappings) {
      const deductAmount = mapping.quantity_per_unit * item.quantity;
      const ingredient = await getIngredient(sql, ctx.organizationId, mapping.ingredient_id);
      if (!ingredient) continue;

      const qtyBefore = ingredient.quantity;
      const qtyAfter = qtyBefore - deductAmount;

      // Update ingredient quantity
      await sql`
        UPDATE ingredients
        SET quantity = ${qtyAfter}, updated_at = NOW()
        WHERE id = ${ingredient.id} AND organization_id = ${ctx.organizationId}
      `;

      // Record movement
      const movement = await recordMovement(sql, ctx.organizationId, {
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        type: 'deduction',
        quantityChange: -deductAmount,
        quantityBefore: qtyBefore,
        quantityAfter: qtyAfter,
        orderId,
        productName: item.productName,
        branchId,
        branchName,
        performedBy: ctx.userId,
      });

      movements.push(movement);
    }

    // 2. Check ingredients with deductFromSales + linkedProductId
    const linkedIngredients = await sql`
      SELECT * FROM ingredients
      WHERE linked_product_id = ${item.productId}
        AND deduct_from_sales = true
        AND (branch_id = ${branchId} OR branch_id IS NULL)
        AND organization_id = ${ctx.organizationId}
    ` as Ingredient[];

    for (const ingredient of linkedIngredients) {
      const deductAmount = ingredient.deduct_amount_per_sale * item.quantity;
      const qtyBefore = ingredient.quantity;
      const qtyAfter = qtyBefore - deductAmount;

      await sql`
        UPDATE ingredients
        SET quantity = ${qtyAfter}, updated_at = NOW()
        WHERE id = ${ingredient.id} AND organization_id = ${ctx.organizationId}
      `;

      const movement = await recordMovement(sql, ctx.organizationId, {
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        type: 'deduction',
        quantityChange: -deductAmount,
        quantityBefore: qtyBefore,
        quantityAfter: qtyAfter,
        orderId,
        productName: item.productName,
        branchId,
        branchName,
        performedBy: ctx.userId,
      });

      movements.push(movement);
    }
  }

  return movements;
}

export async function restoreInventory(
  ctx: TenantContext,
  orderId: string
): Promise<InventoryMovementRecord[]> {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);

  // Look up order to get items and branch info
  const orderRows = await sql`
    SELECT items, branch_name, restaurant_id as branch_id
    FROM orders
    WHERE id = ${orderId} AND organization_id = ${ctx.organizationId} LIMIT 1
  ` as any[];

  if (orderRows.length === 0) throw new Error('Order not found');

  const order = orderRows[0];
  const orderItems: OrderItem[] = Array.isArray(order.items) ? order.items : [];
  const movements: InventoryMovementRecord[] = [];

  for (const item of orderItems) {
    // Reverse product_ingredients deductions
    const mappings = await sql`
      SELECT product_id, ingredient_id, quantity_per_unit
      FROM product_ingredients
      WHERE product_id = ${item.productId} AND organization_id = ${ctx.organizationId}
    ` as ProductIngredient[];

    for (const mapping of mappings) {
      const restoreAmount = mapping.quantity_per_unit * item.quantity;
      const ingredient = await getIngredient(sql, ctx.organizationId, mapping.ingredient_id);
      if (!ingredient) continue;

      const qtyBefore = ingredient.quantity;
      const qtyAfter = qtyBefore + restoreAmount;

      await sql`
        UPDATE ingredients
        SET quantity = ${qtyAfter}, updated_at = NOW()
        WHERE id = ${ingredient.id} AND organization_id = ${ctx.organizationId}
      `;

      const movement = await recordMovement(sql, ctx.organizationId, {
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        type: 'restoration',
        quantityChange: restoreAmount,
        quantityBefore: qtyBefore,
        quantityAfter: qtyAfter,
        orderId,
        productName: item.productName,
        branchId: order.branch_id,
        branchName: order.branch_name,
        performedBy: ctx.userId,
      });

      movements.push(movement);
    }

    // Reverse linked ingredient deductions
    const linkedIngredients = await sql`
      SELECT * FROM ingredients
      WHERE linked_product_id = ${item.productId}
        AND deduct_from_sales = true
        AND (branch_id = ${order.branch_id} OR branch_id IS NULL)
        AND organization_id = ${ctx.organizationId}
    ` as Ingredient[];

    for (const ingredient of linkedIngredients) {
      const restoreAmount = ingredient.deduct_amount_per_sale * item.quantity;
      const qtyBefore = ingredient.quantity;
      const qtyAfter = qtyBefore + restoreAmount;

      await sql`
        UPDATE ingredients
        SET quantity = ${qtyAfter}, updated_at = NOW()
        WHERE id = ${ingredient.id}
      `;

      const movement = await recordMovement(sql, ctx.organizationId, {
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        type: 'restoration',
        quantityChange: restoreAmount,
        quantityBefore: qtyBefore,
        quantityAfter: qtyAfter,
        orderId,
        productName: item.productName,
        branchId: order.branch_id,
        branchName: order.branch_name,
        performedBy: ctx.userId,
      });

      movements.push(movement);
    }
  }

  return movements;
}

async function getIngredient(
  sql: any,
  organizationId: string,
  ingredientId: string
): Promise<Ingredient | null> {
  const rows = await sql`
    SELECT * FROM ingredients
    WHERE id = ${ingredientId}
    LIMIT 1
  ` as Ingredient[];
  return rows.length > 0 ? rows[0] : null;
}

interface MovementInput {
  ingredientId: string;
  ingredientName: string;
  type: string;
  quantityChange: number;
  quantityBefore: number;
  quantityAfter: number;
  orderId: string;
  productName: string | null;
  branchId: string | null;
  branchName: string | null;
  performedBy: string;
}

async function recordMovement(
  sql: any,
  organizationId: string,
  input: MovementInput
): Promise<InventoryMovementRecord> {
  const id = generateId();

  const rows = await sql`
    INSERT INTO inventory_movements (
      id, ingredient_id, ingredient_name, type,
      quantity_change, quantity_before, quantity_after,
      order_id, product_name, branch_id, branch_name,
      performed_by, organization_id, created_at
    )
    VALUES (
      ${id},
      ${input.ingredientId},
      ${input.ingredientName},
      ${input.type},
      ${input.quantityChange},
      ${input.quantityBefore},
      ${input.quantityAfter},
      ${input.orderId},
      ${input.productName ?? null},
      ${input.branchId},
      ${input.branchName ?? null},
      ${input.performedBy},
      ${organizationId},
      NOW()
    )
    RETURNING *
  ` as InventoryMovementRecord[];

  return rows[0];
}
