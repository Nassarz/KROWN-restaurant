import { NextRequest, NextResponse } from 'next/server';
import { toggleAvailability } from '@/lib/services/product.service';
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

  if (!hasPermission(ctx.role, 'products:toggle')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const product = await toggleAvailability(ctx, id);
    return NextResponse.json({ data: product });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to toggle availability' }, { status: 500 });
  }
}
