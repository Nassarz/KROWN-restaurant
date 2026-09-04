import { NextRequest, NextResponse } from 'next/server';
import * as zoneService from '@/lib/services/zone.service';
import { extractTenantContext } from '@/lib/tenant';
import { hasPermission } from '@/lib/rbac';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tableNumber: string }> }
) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPermission(ctx.role, 'zones:manage_tables')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id, tableNumber } = await params;
    const body = await request.json();

    const zone = await zoneService.updateTable(ctx, id, decodeURIComponent(tableNumber), {
      seatsCount: body.seatsCount,
      shape: body.shape,
      status: body.status,
    });

    if (!zone) {
      return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
    }
    return NextResponse.json({ data: zone });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update table' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tableNumber: string }> }
) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPermission(ctx.role, 'zones:manage_tables')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id, tableNumber } = await params;
    const zone = await zoneService.deleteTable(ctx, id, decodeURIComponent(tableNumber));
    if (!zone) {
      return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
    }
    return NextResponse.json({ data: zone });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete table' }, { status: 500 });
  }
}
