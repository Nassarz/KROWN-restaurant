import { NextRequest, NextResponse } from 'next/server';
import { extractVerifiedTenantContext } from '@/lib/tenant';
import { listDevices, registerDevice } from '@/lib/services/device.service';
import { hasPermission } from '@/lib/rbac';

export async function GET(request: NextRequest) {
  try {
    const ctx = await extractVerifiedTenantContext(request);
    if (!ctx) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(ctx.role, 'devices:read')) return NextResponse.json({ data: null, error: 'Insufficient permissions' }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as any || undefined;
    const deviceType = searchParams.get('deviceType') as any || undefined;
    const devices = await listDevices(ctx, { status, deviceType });
    return NextResponse.json({ data: devices });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await extractVerifiedTenantContext(request);
    if (!ctx) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(ctx.role, 'devices:create')) return NextResponse.json({ data: null, error: 'Insufficient permissions' }, { status: 403 });
    const body = await request.json();
    const { deviceFingerprint, deviceName, deviceType, branchId, browser, operatingSystem, ipAddress, userAgent, allowedRoles } = body;
    if (!deviceFingerprint || !deviceName || !deviceType || !branchId) return NextResponse.json({ data: null, error: 'deviceFingerprint, deviceName, deviceType, and branchId are required' }, { status: 400 });
    if (!ctx.isSuperAdmin && ctx.role !== 'restaurant_admin' && ctx.branchId !== branchId) return NextResponse.json({ data:null, error:'Device must belong to your assigned branch' }, { status:403 });
    const device = await registerDevice(ctx, { deviceFingerprint, deviceName, deviceType, branchId, browser, operatingSystem, ipAddress, userAgent, allowedRoles });
    return NextResponse.json({ data: device }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e.message || 'Internal server error' }, { status: 500 });
  }
}
