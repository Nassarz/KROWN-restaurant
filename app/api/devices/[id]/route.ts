import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { getDevice, updateDevice, revokeDevice } from '@/lib/services/device.service';
import { hasPermission } from '@/lib/rbac';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(ctx.role, 'devices:read')) {
      return NextResponse.json({ data: null, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const device = await getDevice(ctx, id);

    if (!device) {
      return NextResponse.json({ data: null, error: 'Device not found' }, { status: 404 });
    }

    return NextResponse.json({ data: device });
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(ctx.role, 'devices:update')) {
      return NextResponse.json({ data: null, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { deviceName, deviceType, allowedRoles } = body;

    const device = await updateDevice(ctx, id, {
      device_name: deviceName,
      device_type: deviceType,
      allowed_roles: allowedRoles,
    });

    return NextResponse.json({ data: device });
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(ctx.role, 'devices:delete')) {
      return NextResponse.json({ data: null, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const device = await revokeDevice(ctx, id, body.reason);

    return NextResponse.json({ data: device });
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
