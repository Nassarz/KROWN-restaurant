import { NextRequest, NextResponse } from 'next/server';
import { addItemsToOrder } from '@/lib/services/order.service';
import { extractTenantContext } from '@/lib/tenant';
import { hasPermission } from '@/lib/rbac';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Missing tenant context' }, { status: 401 });
  }

  if (!hasPermission(ctx.role, 'orders:create')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'items array is required' }, { status: 400 });
    }

    const order = await addItemsToOrder(
      ctx,
      id,
      body.items.map((item: any) => ({
        productId: item.productId,
        quantity: item.quantity,
        notes: item.notes,
      }))
    );
    return NextResponse.json({ data: order });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to add items to order' }, { status: 500 });
  }
}
