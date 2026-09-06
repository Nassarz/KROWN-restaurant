import { NextRequest, NextResponse } from 'next/server';
import { extractVerifiedTenantContext, setTenantContext } from '@/lib/tenant';
import { getSql } from '@/lib/neon-server';
import { hashPassword } from '@/lib/auth';
import { generateId } from '@/lib/id';
import { canManageRole, normalizeRole, isPlatformRole } from '@/lib/rbac';
import { assertBranchAccess } from '@/lib/access-control';

export async function POST(req: NextRequest) {
  const ctx = await extractVerifiedTenantContext(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageRole(ctx.role, 'cashier') && !isPlatformRole(ctx.role) && normalizeRole(ctx.role) !== 'restaurant_admin') return NextResponse.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });

  try {
    const body = await req.json();
    const { name, email, password: inputPassword, pin: inputPin, phone, idType, idNumber, role = 'waiter', branch = '', assignedBranchId, avatar } = body;
    if (!name?.trim()) return NextResponse.json({ error: 'Staff name is required' }, { status: 400 });
    if (!email?.trim()) return NextResponse.json({ error: 'Staff email is required' }, { status: 400 });
    if (!assignedBranchId || assignedBranchId === 'all') return NextResponse.json({ error: 'Please select a branch to assign this staff member' }, { status: 400 });
    if (!canManageRole(ctx.role, role)) return NextResponse.json({ error: 'Forbidden: you cannot assign this role' }, { status: 403 });

    await assertBranchAccess(ctx, assignedBranchId);
    const sql = getSql();
    await setTenantContext(sql, ctx.organizationId);
    const cleanEmail = email.trim().toLowerCase();
    const existing = await sql`SELECT id FROM staff WHERE email = ${cleanEmail} AND organization_id = ${ctx.organizationId} LIMIT 1`;
    if (existing.length) return NextResponse.json({ error: 'A staff member with this email already exists in this organization' }, { status: 409 });

    const password = (inputPassword || '').trim();
    const pin = (inputPin || '').trim();
    if (password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    if (!/^\d{4,6}$/.test(pin)) return NextResponse.json({ error: 'PIN must contain 4 to 6 digits' }, { status: 400 });

    const staffId = generateId();
    const hashedPassword = await hashPassword(password);
    const hashedPin = await hashPassword(pin);
    const staffAvatar = avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=f97316&color=fff&bold=true&size=200`;

    await sql`INSERT INTO staff (id,name,email,password_argon2,role,branch,assigned_branch_id,phone,id_type,id_number,pin_argon2,status,avatar,organization_id,created_at)
      VALUES (${staffId},${name.trim()},${cleanEmail},${hashedPassword},${role},${branch || ''},${assignedBranchId},${phone?.trim() || null},${idType || null},${idNumber?.trim() || null},${hashedPin},'active',${staffAvatar},${ctx.organizationId},NOW())`;

    return NextResponse.json({ success: true, message: `${name} enrolled successfully as ${role}`, staff: { id: staffId, name: name.trim(), email: cleanEmail, role, branch, assignedBranchId, status: 'active', avatar: staffAvatar, phone: phone?.trim() || null, idType: idType || null, idNumber: idNumber?.trim() || null } }, { status: 201 });
  } catch (err: any) {
    const message = err?.message || 'Internal server error creating staff member';
    const status = message.startsWith('Forbidden') ? 403 : 500;
    console.error('[CreateStaff] Unexpected server error:', message);
    return NextResponse.json({ error: message }, { status });
  }
}
