import { NextRequest, NextResponse } from 'next/server';
import { extractVerifiedTenantContext, setTenantContext } from '@/lib/tenant';
import { getSql } from '@/lib/neon-server';
import { enrollDevice } from '@/lib/services/device.service';

export async function POST(request: NextRequest) {
  try {
    const ctx = await extractVerifiedTenantContext(request);
    if (!ctx) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { token, deviceFingerprint, credentialId, credentialPublicKey, branchId, browser, operatingSystem, ipAddress, userAgent } = body;
    if (!token || !deviceFingerprint || !credentialId || !credentialPublicKey || !branchId) {
      return NextResponse.json({ data: null, error: 'token, deviceFingerprint, credentialId, credentialPublicKey and branchId are required' }, { status: 400 });
    }
    if (!ctx.isSuperAdmin && ctx.role !== 'restaurant_admin' && ctx.branchId !== branchId) {
      return NextResponse.json({ data: null, error: 'Device branch does not match your assigned branch' }, { status: 403 });
    }

    const device = await enrollDevice(ctx, token, deviceFingerprint, { browser, operatingSystem, ipAddress, userAgent });
    const sql = getSql();
    await setTenantContext(sql, ctx.organizationId);
    const branch = await sql`SELECT id FROM branches WHERE id=${branchId} AND organization_id=${ctx.organizationId} LIMIT 1`;
    if (!branch.length) return NextResponse.json({ data:null, error:'Branch not found' }, { status:404 });
    await sql`UPDATE devices SET branch_id=${branchId}, credential_id=${String(credentialId).slice(0,128)}, credential_public_key=${String(credentialPublicKey)}, credential_version=1, auth_challenge=NULL, auth_challenge_expires_at=NULL, updated_at=NOW() WHERE id=${device.id} AND organization_id=${ctx.organizationId}`;
    const updated = await sql`SELECT * FROM devices WHERE id=${device.id} AND organization_id=${ctx.organizationId} LIMIT 1`;
    return NextResponse.json({ data: updated[0] });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e.message || 'Internal server error' }, { status: 500 });
  }
}
