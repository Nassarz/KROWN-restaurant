import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/neon-server';
import { extractTenantContext, setTenantContext } from '@/lib/tenant';

export async function POST(request: NextRequest) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { order_items } = await request.json();
    const sql = getSql();
    await setTenantContext(sql, ctx.organizationId);

    if (!order_items || !Array.isArray(order_items)) {
      return NextResponse.json({ data: null, error: 'order_items array is required' }, { status: 400 });
    }

    for (const item of order_items) {
      const productId = item.productId;
      const quantity = item.quantity || 1;

      // Find recipe mappings — tenant-scoped
      const recipeRows = await sql(
        'SELECT ingredient_id, quantity_per_unit FROM product_ingredients WHERE product_id = $1 AND organization_id = $2',
        [productId, ctx.organizationId]
      );

      for (const recipe of recipeRows) {
        const deductQty = Number(recipe.quantity_per_unit) * quantity;

        // Get current stock — tenant-scoped
        const ingRows = await sql(
          'SELECT quantity FROM ingredients WHERE id = $1 AND organization_id = $2',
          [recipe.ingredient_id, ctx.organizationId]
        );

        if (ingRows.length > 0) {
          const currentQty = Number(ingRows[0].quantity) || 0;
          const newQty = Math.max(0, currentQty - deductQty);

          await sql(
            'UPDATE ingredients SET quantity = $1 WHERE id = $2 AND organization_id = $3',
            [newQty, recipe.ingredient_id, ctx.organizationId]
          );
        }
      }

      // Also check legacy linked ingredients — tenant-scoped
      const linkedRows = await sql(
        'SELECT id, quantity, deduct_amount_per_sale FROM ingredients WHERE linked_product_id = $1 AND deduct_from_sales = true AND organization_id = $2',
        [productId, ctx.organizationId]
      );

      for (const linked of linkedRows) {
        const deductQty = (Number(linked.deduct_amount_per_sale) || 1) * quantity;
        const currentQty = Number(linked.quantity) || 0;
        const newQty = Math.max(0, currentQty - deductQty);

        await sql(
          'UPDATE ingredients SET quantity = $1 WHERE id = $2 AND organization_id = $3',
          [newQty, linked.id, ctx.organizationId]
        );
      }
    }

    return NextResponse.json({ data: { success: true } });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}
