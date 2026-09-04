import { NextRequest, NextResponse } from 'next/server';
import { getProduct, updateProduct, deleteProduct } from '@/lib/services/product.service';
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
    const product = await getProduct(ctx, id);
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    return NextResponse.json({ data: product });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to get product' }, { status: 500 });
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

  if (!hasPermission(ctx.role, 'products:update')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const product = await updateProduct(ctx, id, {
      name: body.name,
      price: body.price,
      category: body.category,
      image: body.image,
      available: body.available,
      requires_kitchen: body.requiresKitchen,
      description: body.description,
      linked_ingredient_id: body.linkedIngredientId,
      deduct_from_inventory: body.deductFromInventory,
      inventory_deduct_amount: body.inventoryDeductAmount,
    });
    return NextResponse.json({ data: product });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update product' }, { status: 500 });
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

  if (!hasPermission(ctx.role, 'products:delete')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id } = await params;
    await deleteProduct(ctx, id);
    return NextResponse.json({ data: { success: true } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete product' }, { status: 500 });
  }
}
