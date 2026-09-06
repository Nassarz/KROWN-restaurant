import { createHash, createPublicKey, randomBytes, verify as verifySignature } from 'node:crypto';
import { getSql } from '@/lib/neon-server';
import { TenantContext, setTenantContext } from '@/lib/tenant';
import { assertBranchAccess } from '@/lib/access-control';

function hashToken(value: string) { return createHash('sha256').update(value).digest('hex'); }

export async function issueDeviceChallenge(ctx: TenantContext, deviceId: string) {
  const sql = getSql();
  await setTenantContext(sql, ctx.organizationId);
  const rows = await sql`SELECT id, organization_id, branch_id, status, trust_status, credential_id FROM devices WHERE id=${deviceId} AND organization_id=${ctx.organizationId} LIMIT 1`;
  if (!rows.length) throw new Error('Device not found');
  const device = rows[0] as any;
  if (device.branch_id) await assertBranchAccess(ctx, device.branch_id);
  if (device.status !== 'active' || device.trust_status === 'revoked') throw new Error('Device is not active');
  if (!device.credential_id) throw new Error('Device has no cryptographic credential');
  const challenge = randomBytes(32).toString('base64url');
  await sql`UPDATE devices SET auth_challenge=${challenge}, auth_challenge_expires_at=NOW()+INTERVAL '2 minutes', updated_at=NOW() WHERE id=${deviceId} AND organization_id=${ctx.organizationId}`;
  return { challenge, expiresInSeconds: 120, deviceId: device.id, branchId: device.branch_id };
}

export async function verifyDeviceChallenge(deviceId: string, signatureBase64Url: string, challenge: string) {
  const sql = getSql();
  const rows = await sql`SELECT id, organization_id, branch_id, status, trust_status, credential_id, credential_public_key, auth_challenge, auth_challenge_expires_at FROM devices WHERE id=${deviceId} LIMIT 1`;
  if (!rows.length) throw new Error('Device not found');
  const device = rows[0] as any;
  if (device.status !== 'active' || device.trust_status === 'revoked') throw new Error('Device is not active');
  if (!device.credential_id || !device.credential_public_key) throw new Error('Device credential is not configured');
  if (device.auth_challenge !== challenge) throw new Error('Invalid device challenge');
  if (!device.auth_challenge_expires_at || new Date(device.auth_challenge_expires_at).getTime() <= Date.now()) throw new Error('Device challenge expired');
  const publicKey = createPublicKey({ key: JSON.parse(device.credential_public_key), format: 'jwk' });
  const signature = Buffer.from(signatureBase64Url, 'base64url');
  const valid = verifySignature('sha256', Buffer.from(challenge), { key: publicKey, dsaEncoding: 'ieee-p1363' }, signature);
  if (!valid) throw new Error('Invalid device signature');
  await sql`UPDATE devices SET auth_challenge=NULL, auth_challenge_expires_at=NULL, last_authenticated_at=NOW(), last_seen_at=NOW(), updated_at=NOW() WHERE id=${deviceId}`;
  return { deviceId: device.id, organizationId: device.organization_id, branchId: device.branch_id, credentialId: device.credential_id };
}

export function deviceAssertionDigest(challenge: string) { return hashToken(challenge); }
