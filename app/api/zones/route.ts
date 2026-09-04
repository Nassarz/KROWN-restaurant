import { NextRequest, NextResponse } from 'next/server';
import * as zoneService from '@/lib/services/zone.service';
import { extractTenantContext } from '@/lib/tenant';
import { hasPermission } from '@/lib/rbac';

export async function GET(request: NextRequest) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPermission(ctx.role, 'zones:read')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const branchId = request.nextUrl.searchParams.get('branchId') || ctx.branchId || undefined;
    const zones = await zoneService.listZones(ctx, branchId);
    return NextResponse.json({ data: zones });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to list zones' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPermission(ctx.role, 'zones:create')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, icon, description, branchId, branchName, tables } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Zone name is required' }, { status: 400 });
    }

    const zone = await zoneService.createZone(ctx, {
      name: name.trim(),
      icon,
      description,
      branchId,
      branchName,
      tables,
    });

    return NextResponse.json({ data: zone }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create zone' }, { status: 500 });
  }
}
