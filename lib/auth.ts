// KROWN POS — Authentication Module
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import { getSql, queryWithRetry } from './neon-server';

const configuredSecret = process.env.JWT_SECRET;
if (!configuredSecret || configuredSecret.length < 32) throw new Error('JWT_SECRET must be configured and at least 32 characters long.');
const JWT_SECRET = new TextEncoder().encode(configuredSecret);
const JWT_SECRET_STRING = configuredSecret;
const JWT_EXPIRY_HOURS = Math.max(1, parseInt(process.env.JWT_EXPIRY_HOURS || '24', 10) || 24);

export interface TokenPayload extends JWTPayload { sub: string; org: string; role: string; branch: string | null; email: string; }

export async function hashPassword(password: string): Promise<string> { return argon2.hash(password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 }); }
export async function verifyPassword(hash: string, password: string): Promise<boolean> { try { return await argon2.verify(hash, password); } catch { return false; } }

export async function createToken(payload: Omit<TokenPayload, 'iat' | 'exp' | 'iss'>): Promise<string> {
  return new SignJWT(payload as any).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setIssuer('krown-pos').setExpirationTime(`${JWT_EXPIRY_HOURS}h`).sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try { const { payload } = await jwtVerify(token, JWT_SECRET, { issuer: 'krown-pos', algorithms: ['HS256'] }); return payload as TokenPayload; } catch { return null; }
}

/** Synchronous signature/expiry verification for route helpers that cannot await authentication. Never accepts identity headers. */
export function verifyTokenSync(token: string): TokenPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET_STRING, { issuer: 'krown-pos', algorithms: ['HS256'] }) as jwt.JwtPayload;
    if (typeof payload.sub !== 'string' || typeof payload.org !== 'string' || typeof payload.role !== 'string') return null;
    return payload as TokenPayload;
  } catch { return null; }
}

export interface AuthResult { success: boolean; token?: string; staff?: { id: string; name: string; email: string; role: string; branch: string; assignedBranchId: string | null; organizationId: string }; error?: string; }
async function staffResult(staff: any, token?: string): Promise<AuthResult> { return { success: true, token, staff: { id: staff.id, name: staff.name, email: staff.email, role: staff.role, branch: staff.branch || '', assignedBranchId: staff.assigned_branch_id || null, organizationId: staff.organization_id } }; }

export async function authenticateStaff(email: string, password: string): Promise<AuthResult> {
  const sql = getSql();
  const rows = await queryWithRetry(() => sql`SELECT id,name,email,role,branch,assigned_branch_id,organization_id,password_argon2,status FROM staff WHERE lower(email)=${email.toLowerCase().trim()} LIMIT 1`);
  if (!rows.length) return { success: false, error: 'Invalid email or password' };
  const staff = rows[0] as any;
  if (staff.status !== 'active' || !staff.password_argon2 || !(await verifyPassword(staff.password_argon2, password))) return { success: false, error: 'Invalid email or password' };
  return staffResult(staff, await createToken({ sub: staff.id, org: staff.organization_id, role: staff.role, branch: staff.assigned_branch_id, email: staff.email }));
}

export async function authenticateByPin(email: string, pin: string): Promise<AuthResult> {
  const sql = getSql();
  const rows = await sql`SELECT id,name,email,role,branch,assigned_branch_id,organization_id,pin_argon2,status FROM staff WHERE lower(email)=${email.toLowerCase().trim()} LIMIT 1`;
  if (!rows.length) return { success: false, error: 'Invalid email or PIN' };
  const staff = rows[0] as any;
  if (staff.status !== 'active') return { success: false, error: 'Account is not active' };
  const lockout = await sql`SELECT failed_attempts,locked_until FROM staff_pin_lockouts WHERE staff_id=${staff.id} LIMIT 1`;
  if (lockout.length) { const lo = lockout[0] as any; const t = lo.locked_until instanceof Date ? lo.locked_until.getTime() : Number(lo.locked_until || 0); if (t > Date.now()) return { success: false, error: `Account locked. Try again in ${Math.ceil((t-Date.now())/60000)} minutes` }; }
  const valid = !!staff.pin_argon2 && await verifyPassword(staff.pin_argon2, pin);
  if (!valid) {
    const attempts = lockout.length ? Number((lockout[0] as any).failed_attempts || 0) + 1 : 1;
    const until = attempts >= 5 ? new Date(Date.now() + 15*60000) : new Date(0);
    await sql`INSERT INTO staff_pin_lockouts(staff_id,failed_attempts,locked_until) VALUES(${staff.id},${attempts},${until}) ON CONFLICT(staff_id) DO UPDATE SET failed_attempts=EXCLUDED.failed_attempts,locked_until=EXCLUDED.locked_until`;
    return { success: false, error: attempts >= 5 ? 'Too many failed attempts. Account locked for 15 minutes' : 'Invalid email or PIN' };
  }
  await sql`DELETE FROM staff_pin_lockouts WHERE staff_id=${staff.id}`;
  return staffResult(staff, await createToken({ sub: staff.id, org: staff.organization_id, role: staff.role, branch: staff.assigned_branch_id, email: staff.email }));
}

export async function getSession(token: string): Promise<AuthResult> {
  const payload = await verifyToken(token); if (!payload?.sub || !payload.org || !payload.role) return { success: false, error: 'Invalid or expired token' };
  const sql = getSql(); const rows = await sql`SELECT id,name,email,role,branch,assigned_branch_id,organization_id,status FROM staff WHERE id=${payload.sub} LIMIT 1`;
  if (!rows.length || (rows[0] as any).status !== 'active') return { success: false, error: 'Staff not found or inactive' };
  const staff = rows[0] as any;
  if (staff.organization_id !== payload.org || staff.role !== payload.role || (staff.assigned_branch_id || null) !== (payload.branch || null)) return { success: false, error: 'Session is no longer valid' };
  return staffResult(staff);
}

export async function authenticateSuperAdmin(email: string, password: string): Promise<AuthResult> {
  const sql = getSql(); const rows = await sql`SELECT id,name,email,password_hash,is_active FROM super_admins WHERE lower(email)=${email.toLowerCase().trim()} LIMIT 1`;
  if (!rows.length) return { success: false, error: 'Invalid email or password' }; const admin = rows[0] as any;
  if (!admin.is_active || !(await verifyPassword(admin.password_hash,password))) return { success: false, error: 'Invalid email or password' };
  await sql`UPDATE super_admins SET last_login_at=NOW() WHERE id=${admin.id}`;
  return { success: true, token: await createToken({ sub: admin.id, org: '00000000-0000-0000-0000-000000000000', role: 'super_admin', branch: null, email: admin.email }), staff: { id: admin.id, name: admin.name, email: admin.email, role: 'super_admin', branch: '', assignedBranchId: null, organizationId: 'super-admin' } };
}

export async function getUserFromRequest(request: Request): Promise<TokenPayload | null> {
  const authorization = request.headers.get('authorization'); const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]; const cookie = request.headers.get('cookie')?.match(/(?:^|;\s*)krown_session=([^;]+)/)?.[1]; const token = bearer || cookie;
  if (!token) return null; const payload = await verifyToken(decodeURIComponent(token)); if (!payload) return null;
  if (payload.role === 'super_admin') return payload;
  const session = await getSession(decodeURIComponent(token)); if (!session.success || !session.staff) return null;
  return { ...payload, sub: session.staff.id, org: session.staff.organizationId, role: session.staff.role, branch: session.staff.assignedBranchId, email: session.staff.email };
}
