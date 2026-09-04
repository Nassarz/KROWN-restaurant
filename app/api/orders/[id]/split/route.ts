import { NextRequest, NextResponse } from 'next/server';
import { splitPayment } from '@/lib/services/order.service';
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

  if (!hasPermission(ctx.role, 'orders:split_pay')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    if (!Array.isArray(body.splits) || body.splits.length === 0) {
      return NextResponse.json({ error: 'splits array is required' }, { status: 400 });
    }

    const order = await splitPayment(
      ctx,
      id,
      body.splits.map((s: any) => ({
        method: s.paymentMethod,
        amount: s.amount,
        companyId: s.companyId,
      }))
    );
    return NextResponse.json({ data: order });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to split payment' }, { status: 500 });
  }
}
