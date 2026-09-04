import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { listDevices, registerDevice } from '@/lib/services/device.service';
import { hasPermission } from '@/lib/rbac';

export async function GET(request: NextRequest) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(ctx.role, 'devices:read')) {
      return NextResponse.json({ data: null, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as any || undefined;
    const deviceType = searchParams.get('deviceType') as any || undefined;

    const devices = await listDevices(ctx, { status, deviceType });
    return NextResponse.json({ data: devices });
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(ctx.role, 'devices:create')) {
      return NextResponse.json({ data: null, error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { deviceFingerprint, deviceName, deviceType, browser, operatingSystem, ipAddress, userAgent, allowedRoles } = body;

    if (!deviceFingerprint || !deviceName || !deviceType) {
      return NextResponse.json(
        { data: null, error: 'deviceFingerprint, deviceName, and deviceType are required' },
        { status: 400 }
      );
    }

    const device = await registerDevice(ctx, {
      deviceFingerprint,
      deviceName,
      deviceType,
      browser,
      operatingSystem,
      ipAddress,
      userAgent,
      allowedRoles,
    });

    return NextResponse.json({ data: device }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
