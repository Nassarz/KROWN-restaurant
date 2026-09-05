import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { getStaff, updateStaff, deleteStaff } from '@/lib/services/staff.service';
import { hasPermission } from '@/lib/rbac';
import { hashPassword } from '@/lib/auth';
import { getSql } from '@/lib/neon-server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const staff = await getStaff(ctx, id);

    if (!staff) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
    }

    return NextResponse.json({ data: staff });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(ctx.role, 'staff:update')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, email, phone, idType, idNumber, role, branchId: rawBranchId, avatar } = body;
    const branchId = rawBranchId && rawBranchId !== 'all' ? rawBranchId : null;

    const staff = await updateStaff(ctx, id, {
      name,
      email,
      phone,
      id_type: idType,
      id_number: idNumber,
      role,
      assigned_branch_id: branchId,
      avatar,
    });

    return NextResponse.json({ data: staff });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(ctx.role, 'staff:delete')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    await deleteStaff(ctx, id);

    return NextResponse.json({ data: { success: true } });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(ctx.role, 'staff:update') && !hasPermission(ctx.role, 'staff:reset_pin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { password, pin } = body;

    const sql = getSql();

    if (password) {
      const passwordHash = await hashPassword(password);
      await sql`
        UPDATE staff SET password_argon2 = ${passwordHash}, updated_at = NOW()
        WHERE id = ${id} AND organization_id = ${ctx.organizationId}
      `;
    }

    if (pin) {
      const pinHash = await hashPassword(pin);
      await sql`
        UPDATE staff SET pin_code = ${pin}, pin_argon2 = ${pinHash}, pin_hash = ${pinHash}, updated_at = NOW()
        WHERE id = ${id} AND organization_id = ${ctx.organizationId}
      `;
    }

    const staff = await getStaff(ctx, id);
    return NextResponse.json({ data: staff });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
