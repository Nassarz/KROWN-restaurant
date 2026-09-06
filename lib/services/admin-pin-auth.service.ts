import { createHash } from 'node:crypto';
import { getSql } from '@/lib/neon-server';
import { createToken, verifyPassword, type AuthResult } from '@/lib/auth';

const ADMIN_ROLES = new Set(['restaurant_admin', 'admin', 'super_admin']);

export async function authenticateAdminByPin(email: string, pin: string): Promise<AuthResult> {
  const sql = getSql();
  const cleanEmail = email.toLowerCase().trim();
  const rows = await sql`
    SELECT id,name,email,role,branch,assigned_branch_id,organization_id,pin_argon2,status
    FROM staff
    WHERE lower(email)=${cleanEmail}
    LIMIT 1
  `;

  if (!rows.length) return { success: false, error: 'Invalid email or PIN' };
  const staff = rows[0] as any;

  if (!ADMIN_ROLES.has(String(staff.role))) {
    return { success: false, error: 'A registered KROWN device is required for this account' };
  }
  if (staff.status !== 'active') return { success: false, error: 'Account is not active' };

  const lockout = await sql`
    SELECT failed_attempts,locked_until
    FROM staff_pin_lockouts
    WHERE staff_id=${staff.id}
    LIMIT 1
  `;
  if (lockout.length) {
    const lo = lockout[0] as any;
    const lockedUntil = lo.locked_until instanceof Date
      ? lo.locked_until.getTime()
      : Number(lo.locked_until || 0);
    if (lockedUntil > Date.now()) {
      return {
        success: false,
        error: `Account locked. Try again in ${Math.ceil((lockedUntil - Date.now()) / 60000)} minutes`,
      };
    }
  }

  const valid = !!staff.pin_argon2 && await verifyPassword(staff.pin_argon2, pin);
  if (!valid) {
    const attempts = lockout.length
      ? Number((lockout[0] as any).failed_attempts || 0) + 1
      : 1;
    const until = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : new Date(0);
    await sql`
      INSERT INTO staff_pin_lockouts(staff_id,failed_attempts,locked_until)
      VALUES(${staff.id},${attempts},${until})
      ON CONFLICT(staff_id) DO UPDATE
      SET failed_attempts=EXCLUDED.failed_attempts,locked_until=EXCLUDED.locked_until
    `;
    return {
      success: false,
      error: attempts >= 5
        ? 'Too many failed attempts. Account locked for 15 minutes'
        : 'Invalid email or PIN',
    };
  }

  await sql`DELETE FROM staff_pin_lockouts WHERE staff_id=${staff.id}`;

  const token = await createToken({
    sub: staff.id,
    org: staff.organization_id,
    role: staff.role,
    branch: staff.assigned_branch_id,
    email: staff.email,
  });

  await sql`
    INSERT INTO staff_sessions
      (organization_id,staff_id,device_id,token_hash,role,permissions,status,expires_at,last_active_at)
    VALUES
      (${staff.organization_id},${staff.id},NULL,
       ${createHash('sha256').update(token).digest('hex')},
       ${staff.role},'[]'::jsonb,'active',
       ${new Date(Date.now() + 24 * 60 * 60 * 1000)},NOW())
  `;

  return {
    success: true,
    token,
    staff: {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      branch: staff.branch || '',
      assignedBranchId: staff.assigned_branch_id || null,
      assigned_branch_id: staff.assigned_branch_id || null,
      organizationId: staff.organization_id,
      organization_id: staff.organization_id,
      status: staff.status || 'active',
    },
  };
}