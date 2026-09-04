import { NextRequest, NextResponse } from 'next/server';
import { updateOrderTin } from '@/lib/services/order.service';
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

  if (!hasPermission(ctx.role, 'orders:update_status')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.tin || typeof body.tin !== 'string') {
      return NextResponse.json({ error: 'tin string is required' }, { status: 400 });
    }

    const order = await updateOrderTin(ctx, id, body.tin);
    return NextResponse.json({ data: order });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update TIN' }, { status: 500 });
  }
}
