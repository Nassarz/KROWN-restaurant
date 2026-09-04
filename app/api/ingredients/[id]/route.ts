import { NextRequest, NextResponse } from 'next/server';
import { getIngredient, updateIngredient, deleteIngredient } from '@/lib/services/ingredient.service';
import { extractTenantContext } from '@/lib/tenant';
import { hasPermission } from '@/lib/rbac';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Missing tenant context' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const ingredient = await getIngredient(ctx, id);
    if (!ingredient) {
      return NextResponse.json({ error: 'Ingredient not found' }, { status: 404 });
    }
    return NextResponse.json({ data: ingredient });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to get ingredient' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Missing tenant context' }, { status: 401 });
  }

  if (!hasPermission(ctx.role, 'ingredients:update')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const ingredient = await updateIngredient(ctx, id, {
      name: body.name,
      quantity: body.quantity,
      unit: body.unit,
      min_threshold: body.minThreshold,
      category: body.category,
      cost_per_unit_ugx: body.costPerUnitUGX,
      supplier: body.supplier,
      linked_product_id: body.linkedProductId,
      deduct_from_sales: body.deductFromSales,
      deduct_amount_per_sale: body.deductAmountPerSale,
    });
    return NextResponse.json({ data: ingredient });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update ingredient' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Missing tenant context' }, { status: 401 });
  }

  if (!hasPermission(ctx.role, 'ingredients:delete')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id } = await params;
    await deleteIngredient(ctx, id);
    return NextResponse.json({ data: { success: true } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete ingredient' }, { status: 500 });
  }
}
