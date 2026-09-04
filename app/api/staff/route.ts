import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { listStaff, createStaff } from '@/lib/services/staff.service';
import { hasPermission } from '@/lib/rbac';

export async function GET(request: NextRequest) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId') || ctx.branchId || undefined;

    const staff = await listStaff(ctx, branchId);
    return NextResponse.json({ data: staff });
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(ctx.role, 'staff:create')) {
      return NextResponse.json({ data: null, error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, phone, pin, idType, idNumber, role, branchId: rawBranchId, avatar } = body;
    const branchId = rawBranchId && rawBranchId !== 'all' ? rawBranchId : undefined;

    if (!name || !email || !role) {
      return NextResponse.json(
        { data: null, error: 'Name, email, and role are required' },
        { status: 400 }
      );
    }

    const staff = await createStaff(ctx, {
      name,
      email,
      phone,
      pin,
      idType,
      idNumber,
      role,
      branchId,
      avatar,
    });

    return NextResponse.json({ data: staff }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
