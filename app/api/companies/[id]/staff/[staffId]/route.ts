import { NextRequest, NextResponse } from 'next/server';
import * as companyService from '@/lib/services/company.service';
import { extractTenantContext } from '@/lib/tenant';
import { hasPermission } from '@/lib/rbac';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; staffId: string }> }
) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPermission(ctx.role, 'companies:manage_staff')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id, staffId } = await params;
    const body = await request.json();

    const staff = await companyService.updateCompanyStaff(ctx, id, staffId, {
      name: body.name,
      work_id: body.workId,
      email: body.email,
      department: body.department,
      credit_limit_ugx: body.creditLimitUGX,
      status: body.status,
    });

    return NextResponse.json({ data: staff });
  } catch (error: any) {
    if (error.message === 'Company staff not found') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: error.message || 'Failed to update company staff' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; staffId: string }> }
) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPermission(ctx.role, 'companies:manage_staff')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id, staffId } = await params;
    await companyService.deleteCompanyStaff(ctx, id, staffId);
    return NextResponse.json({ data: { success: true } });
  } catch (error: any) {
    if (error.message === 'Company staff not found') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: error.message || 'Failed to delete company staff' }, { status: 500 });
  }
}
