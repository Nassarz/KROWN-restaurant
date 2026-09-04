import { NextRequest, NextResponse } from 'next/server';
import { listProducts, createProduct } from '@/lib/services/product.service';
import { extractTenantContext } from '@/lib/tenant';
import { hasPermission } from '@/lib/rbac';

export async function GET(request: NextRequest) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Missing tenant context' }, { status: 401 });
  }

  try {
    const branchId = request.headers.get('x-branch-id') || ctx.branchId || undefined;
    const products = await listProducts(ctx, branchId);
    return NextResponse.json({ data: products });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to list products' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Missing tenant context' }, { status: 401 });
  }

  if (!hasPermission(ctx.role, 'products:create')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const product = await createProduct(ctx, {
      name: body.name,
      price: body.price,
      category: body.category,
      image: body.image,
      available: body.available,
      requiresKitchen: body.requiresKitchen,
      description: body.description,
      branchId: body.branchId,
      linkedIngredientId: body.linkedIngredientId,
      deductFromInventory: body.deductFromInventory,
      inventoryDeductAmount: body.inventoryDeductAmount,
    });
    return NextResponse.json({ data: product }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create product' }, { status: 500 });
  }
}
