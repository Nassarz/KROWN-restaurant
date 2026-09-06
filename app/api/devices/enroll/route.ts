import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/neon-server';
import { generateId } from '@/lib/id';

function clean(value: unknown, max: number) {
  return String(value || '').trim().slice(0, max);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = clean(body.token, 512);
    const deviceFingerprint = clean(body.deviceFingerprint, 512);
    const credentialId = clean(body.credentialId, 128);
    const credentialPublicKey = clean(body.credentialPublicKey, 8192);
    const browser = clean(body.browser, 120) || null;
    const operatingSystem = clean(body.operatingSystem, 120) || null;
    const ipAddress = clean(body.ipAddress, 120) || null;
    const userAgent = clean(body.userAgent, 1000) || null;

    if (!token || !deviceFingerprint || !credentialId || !credentialPublicKey) {
      return NextResponse.json({ data: null, error: 'token, deviceFingerprint, credentialId and credentialPublicKey are required' }, { status: 400 });
    }
    let parsedCredential: unknown;
    try { parsedCredential = JSON.parse(credentialPublicKey); } catch { return NextResponse.json({ data: null, error: 'credentialPublicKey must be valid JSON JWK' }, { status: 400 }); }
    if (!parsedCredential || typeof parsedCredential !== 'object') return NextResponse.json({ data: null, error: 'Invalid device credential' }, { status: 400 });

    const sql = getSql();
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const deviceId = generateId();
    const publicReference = `DEV-${deviceId.replace(/-/g, '').slice(0, 10).toUpperCase()}`;

    const rows = await sql`WITH claimed AS (
      UPDATE device_enrollment_tokens
      SET used=true, used_at=NOW(), used_by_device_id=${deviceId}
      WHERE token_hash=${tokenHash} AND used=false AND expires_at>NOW()
      RETURNING organization_id, branch_id, device_type, device_name, allowed_roles, created_by
    ), inserted AS (
      INSERT INTO devices (id, organization_id, branch_id, public_reference, device_fingerprint, device_name, device_type, status, trust_status, credential_id, credential_public_key, credential_version, enrolled_at, enrolled_by, browser, operating_system, ip_address, user_agent, allowed_roles, created_at, updated_at)
      SELECT ${deviceId}, c.organization_id, c.branch_id, ${publicReference}, ${deviceFingerprint}, c.device_name, c.device_type, 'active', 'pending', ${credentialId}, ${credentialPublicKey}, 1, NOW(), c.created_by, ${browser}, ${operatingSystem}, ${ipAddress}, ${userAgent}, COALESCE(c.allowed_roles,'[]'::jsonb), NOW(), NOW()
      FROM claimed c
      RETURNING id, organization_id, branch_id, public_reference, device_name, device_type, status, trust_status, credential_id, credential_version, enrolled_at, created_at
    ) SELECT * FROM inserted`;

    if (!rows.length) return NextResponse.json({ data: null, error: 'Invalid, expired, or already-used enrollment token' }, { status: 409 });
    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message || 'Device enrollment failed' }, { status: 400 });
  }
}
