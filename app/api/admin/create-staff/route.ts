import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/neon-server';
import { extractTenantContext, setTenantContext } from '@/lib/tenant';
import { hashPassword } from '@/lib/auth';
import { generateId } from '@/lib/id';

export async function POST(req: NextRequest) {
  const ctx = extractTenantContext(req);
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Super Admin, Restaurant Admin, Branch Manager, or Manager can create staff
  const allowedRoles = ['super_admin', 'restaurant_admin', 'branch_manager', 'manager'];
  if (!allowedRoles.includes(ctx.role)) {
    return NextResponse.json({ error: 'Forbidden: Insufficient permissions to create staff' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      name,
      email,
      password: inputPassword,
      pin: inputPin,
      phone,
      idType,
      idNumber,
      role = 'Senior Waiter',
      branch = 'FAZE 3',
      assignedBranchId,
      avatar,
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Staff name is required' }, { status: 400 });
    }
    if (!email?.trim()) {
      return NextResponse.json({ error: 'Staff email is required' }, { status: 400 });
    }
    if (!assignedBranchId || assignedBranchId === 'all') {
      return NextResponse.json({ error: 'Please select a branch to assign this staff member' }, { status: 400 });
    }

    const sql = getSql();
    await setTenantContext(sql, ctx.organizationId);

    const password = (inputPassword || 'Staff@123').trim();
    const pin = (inputPin || '1234').trim();
    const cleanEmail = email.trim().toLowerCase();

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    // Hash password and PIN with Argon2id
    const hashedPassword = await hashPassword(password);
    const hashedPin = await hashPassword(pin);

    // Check if email already exists in this organization
    const existing = await sql(
      'SELECT id FROM staff WHERE email = $1 AND organization_id = $2',
      [cleanEmail, ctx.organizationId]
    );
    const userId = existing.length > 0 ? existing[0].id : generateId();

    const staffAvatar =
      avatar ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=f97316&color=fff&bold=true&size=200`;

    const staffRecord = {
      id: userId,
      name: name.trim(),
      email: cleanEmail,
      password_argon2: hashedPassword,
      role,
      branch,
      assigned_branch_id: assignedBranchId && assignedBranchId !== 'all' ? assignedBranchId : null,
      phone: phone?.trim() || null,
      id_type: idType || null,
      id_number: idNumber?.trim() || null,
      pin_argon2: hashedPin,
      status: 'active',
      avatar: staffAvatar,
      organization_id: ctx.organizationId,
      created_at: new Date().toISOString(),
    };

    const keys = Object.keys(staffRecord);
    const values = Object.values(staffRecord);
    const placeholders = keys.map((_, i) => `$${i + 1}`);
    const updateClauses = keys.filter(k => k !== 'id').map(k => `${k} = EXCLUDED.${k}`);

    await sql(
      `INSERT INTO staff (${keys.join(', ')}) VALUES (${placeholders.join(', ')})
       ON CONFLICT (id) DO UPDATE SET ${updateClauses.join(', ')}`,
      values
    );

    return NextResponse.json({
      success: true,
      message: `${name} enrolled successfully as ${role}`,
      staff: {
        id: userId,
        name: staffRecord.name,
        email: cleanEmail,
        role,
        branch,
        assignedBranchId: assignedBranchId && assignedBranchId !== 'all' ? assignedBranchId : null,
        status: 'active',
        avatar: staffAvatar,
        phone: staffRecord.phone,
        idType: idType || null,
        idNumber: idNumber?.trim() || null,
      },
    });
  } catch (err: any) {
    console.error('[CreateStaff] Unexpected server error:', err?.message || err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error creating staff member' },
      { status: 500 }
    );
  }
}
