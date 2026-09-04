import { NextRequest, NextResponse } from 'next/server';
import { listOrders, createOrder } from '@/lib/services/order.service';
import { extractTenantContext } from '@/lib/tenant';
import { hasPermission } from '@/lib/rbac';

export async function GET(request: NextRequest) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Missing tenant context' }, { status: 401 });
  }

  try {
    const branchId = request.nextUrl.searchParams.get('branchId') || ctx.branchId || undefined;
    const startDateStr = request.nextUrl.searchParams.get('startDate');
    const endDateStr = request.nextUrl.searchParams.get('endDate');
    const limitStr = request.nextUrl.searchParams.get('limit');

    const startDate = startDateStr ? Number(startDateStr) : undefined;
    const endDate = endDateStr ? Number(endDateStr) : undefined;

    let orders = await listOrders(ctx, branchId, startDate, endDate);

    if (limitStr) {
      const limit = parseInt(limitStr, 10);
      if (!isNaN(limit) && limit > 0) {
        orders = orders.slice(0, limit);
      }
    }

    return NextResponse.json({ data: orders });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to list orders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Missing tenant context' }, { status: 401 });
  }

  if (!hasPermission(ctx.role, 'orders:create')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const body = await request.json();
    // Accept both camelCase and snake_case input
    const items = (body.items || []).map((item: any) => ({
      productId: item.productId || item.product_id,
      quantity: item.quantity || 1,
      notes: item.notes,
      addOns: item.addOns || item.add_ons,
    }));
    const order = await createOrder(ctx, {
      branchId: body.branchId || body.branch_id || ctx.branchId,
      tableNumber: body.table || body.table_number || '1',
      seat: body.seat,
      items,
      staffId: body.staffId || body.staff_id,
      companyName: body.companyName || body.company_name,
      tin: body.tin,
      companyId: body.companyId || body.company_id,
    });
    return NextResponse.json({ data: order }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create order' }, { status: 500 });
  }
}
