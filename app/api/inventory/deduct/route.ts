import { NextRequest, NextResponse } from 'next/server';
import * as inventoryService from '@/lib/services/inventory.service';
import { extractTenantContext } from '@/lib/tenant';
import { hasPermission } from '@/lib/rbac';

export async function POST(request: NextRequest) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPermission(ctx.role, 'inventory:deduct')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { items, orderId, branchId, branchName } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Items array is required and must not be empty' }, { status: 400 });
    }

    if (!orderId?.trim()) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const movements = await inventoryService.deductInventory(ctx, items, orderId, branchId || null, branchName || null);
    return NextResponse.json({ data: movements });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to deduct inventory' }, { status: 500 });
  }
}
