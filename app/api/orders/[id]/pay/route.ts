import { NextRequest, NextResponse } from 'next/server';
import { payOrder } from '@/lib/services/order.service';
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

  if (!hasPermission(ctx.role, 'orders:pay')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.paymentMethod) {
      return NextResponse.json({ error: 'paymentMethod is required' }, { status: 400 });
    }

    const order = await payOrder(ctx, id, {
      method: body.paymentMethod,
      amount: body.amountReceived || 0,
      companyId: body.companyId,
    });
    return NextResponse.json({ data: order });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to process payment' }, { status: 500 });
  }
}
