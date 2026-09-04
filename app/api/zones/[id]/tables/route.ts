import { NextRequest, NextResponse } from 'next/server';
import * as zoneService from '@/lib/services/zone.service';
import { extractTenantContext } from '@/lib/tenant';
import { hasPermission } from '@/lib/rbac';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPermission(ctx.role, 'zones:manage_tables')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { tableNumber, seatsCount, shape } = body;

    if (!tableNumber?.trim()) {
      return NextResponse.json({ error: 'Table number is required' }, { status: 400 });
    }
    if (!seatsCount || seatsCount <= 0) {
      return NextResponse.json({ error: 'Seats count must be greater than zero' }, { status: 400 });
    }

    const zone = await zoneService.addTable(ctx, id, tableNumber.trim(), seatsCount, shape);
    return NextResponse.json({ data: zone }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Zone not found') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: error.message || 'Failed to add table' }, { status: 500 });
  }
}
