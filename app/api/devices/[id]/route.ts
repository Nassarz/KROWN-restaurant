import { NextRequest, NextResponse } from 'next/server';
import { extractVerifiedTenantContext } from '@/lib/tenant';
import { getSql } from '@/lib/neon-server';
import { getDevice, updateDevice, revokeDevice } from '@/lib/services/device.service';
import { hasPermission } from '@/lib/rbac';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await extractVerifiedTenantContext(request);
    if (!ctx) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(ctx.role, 'devices:read')) return NextResponse.json({ data: null, error: 'Insufficient permissions' }, { status: 403 });
    const { id } = await params;
    const device = await getDevice(ctx, id);
    if (!device) return NextResponse.json({ data: null, error: 'Device not found' }, { status: 404 });
    return NextResponse.json({ data: device });
  } catch (e:any) { return NextResponse.json({ data:null, error:e?.message||'Internal server error' }, { status:500 }); }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await extractVerifiedTenantContext(request);
    if (!ctx) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(ctx.role, 'devices:update')) return NextResponse.json({ data: null, error: 'Insufficient permissions' }, { status: 403 });
    const { id } = await params;
    const body = await request.json();
    const device = await updateDevice(ctx, id, { device_name: body.deviceName, device_type: body.deviceType, allowed_roles: body.allowedRoles });
    return NextResponse.json({ data: device });
  } catch (e:any) { return NextResponse.json({ data:null, error:e?.message||'Internal server error' }, { status:500 }); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await extractVerifiedTenantContext(request);
    if (!ctx) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(ctx.role, 'devices:delete')) return NextResponse.json({ data: null, error: 'Insufficient permissions' }, { status: 403 });
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const device = await revokeDevice(ctx, id, body.reason);
    const sql = getSql();
    await sql`UPDATE staff_sessions SET status='revoked', revoked_at=NOW(), revoked_reason=${body.reason || 'device_revoked'}, last_active_at=NOW() WHERE device_id=${id} AND organization_id=${ctx.organizationId} AND status='active'`;
    return NextResponse.json({ data: device });
  } catch (e:any) { return NextResponse.json({ data:null, error:e?.message||'Internal server error' }, { status:500 }); }
}
