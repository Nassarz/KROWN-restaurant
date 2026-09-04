import { NextRequest, NextResponse } from 'next/server';
import { updateQuantity } from '@/lib/services/ingredient.service';
import { extractTenantContext } from '@/lib/tenant';
import { hasPermission } from '@/lib/rbac';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Missing tenant context' }, { status: 401 });
  }

  if (!hasPermission(ctx.role, 'ingredients:update_quantity')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    if (typeof body.quantity !== 'number') {
      return NextResponse.json({ error: 'quantity must be a number' }, { status: 400 });
    }

    const ingredient = await updateQuantity(ctx, id, body.quantity);
    return NextResponse.json({ data: ingredient });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update quantity' }, { status: 500 });
  }
}
