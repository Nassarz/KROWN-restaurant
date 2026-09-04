import { NextRequest, NextResponse } from 'next/server';
import { updateStatus } from '@/lib/services/order.service';
import { extractTenantContext } from '@/lib/tenant';
import { hasPermission } from '@/lib/rbac';

const VALID_STATUSES = ['preparing', 'ready', 'completed', 'cancelled'];

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

    if (!body.status || !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    const order = await updateStatus(ctx, id, body.status);
    return NextResponse.json({ data: order });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update order status' }, { status: 500 });
  }
}
