import { NextRequest, NextResponse } from 'next/server';
import * as zoneService from '@/lib/services/zone.service';
import { extractTenantContext } from '@/lib/tenant';
import { hasPermission } from '@/lib/rbac';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPermission(ctx.role, 'zones:read')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const zone = await zoneService.getZone(ctx, id);
    if (!zone) {
      return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
    }
    return NextResponse.json({ data: zone });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to get zone' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPermission(ctx.role, 'zones:update')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const zone = await zoneService.updateZone(ctx, id, {
      name: body.name,
      icon: body.icon,
      description: body.description,
      branchId: body.branchId,
      branchName: body.branchName,
    });

    if (!zone) {
      return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
    }
    return NextResponse.json({ data: zone });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update zone' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPermission(ctx.role, 'zones:delete')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id } = await params;
    await zoneService.deleteZone(ctx, id);
    return NextResponse.json({ data: { success: true } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete zone' }, { status: 500 });
  }
}
