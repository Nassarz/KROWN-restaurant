// KROWN POS — Authentication Module
// JWT creation, verification, session management

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import argon2 from 'argon2';
import { getSql } from './neon-server';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'krown-dev-secret-change-in-production');
const JWT_EXPIRY_HOURS = parseInt(process.env.JWT_EXPIRY_HOURS || '24');

export interface TokenPayload extends JWTPayload {
  sub: string;      // staff.id
  org: string;      // organizations.id
  role: string;     // staff role
  branch: string | null; // staff.assigned_branch_id
  email: string;
  iat?: number;
  exp?: number;
}

// ── Password Hashing ────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

// ── JWT Management ──────────────────────────────────────────────────────────

export async function createToken(payload: Omit<TokenPayload, 'iat' | 'exp' | 'iss'>): Promise<string> {
  return new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('krown-pos')
    .setExpirationTime(`${JWT_EXPIRY_HOURS}h`)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, { issuer: 'krown-pos' });
    return payload as TokenPayload;
  } catch {
    return null;
  }
}

// ── Staff Authentication ────────────────────────────────────────────────────

export interface AuthResult {
  success: boolean;
  token?: string;
  staff?: {
    id: string;
    name: string;
    email: string;
    role: string;
    branch: string;
    assignedBranchId: string | null;
    organizationId: string;
  };
  error?: string;
}

export async function authenticateStaff(email: string, password: string): Promise<AuthResult> {
  const { getSql, queryWithRetry } = await import('./neon-server');
  const sql = getSql();

  const staffRows = await queryWithRetry(() => sql`
    SELECT id, name, email, role, branch, assigned_branch_id, organization_id,
           password_hash, password_argon2, pin_hash, pin_argon2, status
    FROM staff
    WHERE email = ${email.toLowerCase().trim()}
    LIMIT 1
  `);

  if (staffRows.length === 0) {
    return { success: false, error: 'Invalid email or password' };
  }

  const staff = staffRows[0] as any;

  if (staff.status !== 'active') {
    return { success: false, error: 'Account is not active' };
  }

  // Verify password (try Argon2 first, then fallback to plaintext for migration)
  let passwordValid = false;

  if (staff.password_argon2) {
    passwordValid = await verifyPassword(staff.password_argon2, password);
  } else if (staff.password_hash) {
    // Legacy plaintext comparison (migration period only)
    passwordValid = staff.password_hash === password;
    if (passwordValid) {
      // Auto-migrate to Argon2 on successful login
      const hash = await hashPassword(password);
      await sql`UPDATE staff SET password_argon2 = ${hash} WHERE id = ${staff.id}`;
    }
  }

  if (!passwordValid) {
    return { success: false, error: 'Invalid email or password' };
  }

  // Create JWT
  const token = await createToken({
    sub: staff.id,
    org: staff.organization_id,
    role: staff.role,
    branch: staff.assigned_branch_id,
    email: staff.email,
  });

  return {
    success: true,
    token,
    staff: {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      branch: staff.branch,
      assignedBranchId: staff.assigned_branch_id,
      organizationId: staff.organization_id,
    },
  };
}

// ── PIN Authentication ──────────────────────────────────────────────────────

export async function authenticateByPin(email: string, pin: string): Promise<AuthResult> {
  const sql = getSql();

  const staffRows = await sql`
    SELECT id, name, email, role, branch, assigned_branch_id, organization_id,
           pin_hash, pin_argon2, pin_code, status
    FROM staff
    WHERE email = ${email.toLowerCase().trim()}
    LIMIT 1
  `;

  if (staffRows.length === 0) {
    return { success: false, error: 'Invalid email or PIN' };
  }

  const staff = staffRows[0] as any;

  if (staff.status !== 'active') {
    return { success: false, error: 'Account is not active' };
  }

  // Check lockout
  const lockout = await sql`SELECT * FROM staff_pin_lockouts WHERE staff_id = ${staff.id} LIMIT 1`;
  if (lockout.length > 0) {
    const lo = lockout[0] as any;
    if (lo.locked_until > Date.now()) {
      const remainingMinutes = Math.ceil((lo.locked_until - Date.now()) / 60000);
      return { success: false, error: `Account locked. Try again in ${remainingMinutes} minutes` };
    }
  }

  // Verify PIN
  let pinValid = false;

  if (staff.pin_argon2) {
    pinValid = await verifyPassword(staff.pin_argon2, pin);
  } else if (staff.pin_code) {
    // Legacy plaintext comparison (migration period only)
    pinValid = staff.pin_code === pin;
    if (pinValid) {
      // Auto-migrate to Argon2
      const hash = await hashPassword(pin);
      await sql`UPDATE staff SET pin_argon2 = ${hash} WHERE id = ${staff.id}`;
    }
  }

  if (!pinValid) {
    // Handle lockout
    if (lockout.length > 0) {
      const lo = lockout[0] as any;
      const newAttempts = (lo.failed_attempts || 0) + 1;
      if (newAttempts >= 5) {
        await sql`UPDATE staff_pin_lockouts SET failed_attempts = ${newAttempts}, locked_until = ${Date.now() + 15 * 60000} WHERE staff_id = ${staff.id}`;
        return { success: false, error: 'Too many failed attempts. Account locked for 15 minutes' };
      }
      await sql`UPDATE staff_pin_lockouts SET failed_attempts = ${newAttempts} WHERE staff_id = ${staff.id}`;
    } else {
      await sql`INSERT INTO staff_pin_lockouts (staff_id, failed_attempts, locked_until) VALUES (${staff.id}, 1, 0)`;
    }
    return { success: false, error: 'Invalid email or PIN' };
  }

  // Reset lockout on success
  if (lockout.length > 0) {
    await sql`DELETE FROM staff_pin_lockouts WHERE staff_id = ${staff.id}`;
  }

  // Create JWT
  const token = await createToken({
    sub: staff.id,
    org: staff.organization_id,
    role: staff.role,
    branch: staff.assigned_branch_id,
    email: staff.email,
  });

  return {
    success: true,
    token,
    staff: {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      branch: staff.branch,
      assignedBranchId: staff.assigned_branch_id,
      organizationId: staff.organization_id,
    },
  };
}

// ── Session Management ──────────────────────────────────────────────────────

export async function getSession(token: string): Promise<AuthResult> {
  const payload = await verifyToken(token);
  if (!payload) {
    return { success: false, error: 'Invalid or expired token' };
  }

  const sql = getSql();
  const staffRows = await sql`
    SELECT id, name, email, role, branch, assigned_branch_id, organization_id, status
    FROM staff
    WHERE id = ${payload.sub}
    LIMIT 1
  `;

  if (staffRows.length === 0 || (staffRows[0] as any).status !== 'active') {
    return { success: false, error: 'Staff not found or inactive' };
  }

  const staff = staffRows[0] as any;

  return {
    success: true,
    staff: {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      branch: staff.branch,
      assignedBranchId: staff.assigned_branch_id,
      organizationId: staff.organization_id,
    },
  };
}

// ── Super Admin Authentication ──────────────────────────────────────────────

export async function authenticateSuperAdmin(email: string, password: string): Promise<AuthResult> {
  const sql = getSql();

  const adminRows = await sql`
    SELECT id, name, email, password_hash, is_active
    FROM super_admins
    WHERE email = ${email.toLowerCase().trim()}
    LIMIT 1
  `;

  if (adminRows.length === 0) {
    return { success: false, error: 'Invalid email or password' };
  }

  const admin = adminRows[0] as any;

  if (!admin.is_active) {
    return { success: false, error: 'Account is not active' };
  }

  const passwordValid = await verifyPassword(admin.password_hash, password);
  if (!passwordValid) {
    return { success: false, error: 'Invalid email or password' };
  }

  // Update last login
  await sql`UPDATE super_admins SET last_login_at = NOW() WHERE id = ${admin.id}`;

  // Create JWT with super_admin role
  // Use platform admin org so tenant context works; isSuperAdmin flag set in TenantContext
  const token = await createToken({
    sub: admin.id,
    org: '97830527-8b2d-45d8-b8d4-e3f83196fb4a',
    role: 'super_admin',
    branch: null,
    email: admin.email,
  });

  return {
    success: true,
    token,
    staff: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: 'super_admin',
      branch: '',
      assignedBranchId: null,
      organizationId: 'super-admin',
    },
  };
}

// ── Helper: Extract User from Request ───────────────────────────────────────

export function getUserFromRequest(request: Request): TokenPayload | null {
  const orgId = request.headers.get('x-org-id');
  const userId = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role');
  const branchId = request.headers.get('x-branch-id');

  if (!orgId || !userId || !role) return null;

  return {
    sub: userId,
    org: orgId,
    role,
    branch: branchId,
    email: '',
    iat: 0,
    exp: 0,
    iss: 'krown-pos',
  };
}
