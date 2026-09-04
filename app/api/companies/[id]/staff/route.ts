import { NextRequest, NextResponse } from 'next/server';
import * as companyService from '@/lib/services/company.service';
import { extractTenantContext } from '@/lib/tenant';
import { hasPermission } from '@/lib/rbac';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPermission(ctx.role, 'companies:read_staff')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const staff = await companyService.listCompanyStaff(ctx, id);
    return NextResponse.json({ data: staff });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to list company staff' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPermission(ctx.role, 'companies:manage_staff')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, workId, email, department, creditLimitUGX } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Staff name is required' }, { status: 400 });
    }

    const staff = await companyService.addCompanyStaff(ctx, id, {
      name: name.trim(),
      workId,
      email,
      department,
      creditLimitUGX,
    });

    return NextResponse.json({ data: staff }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Company not found') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: error.message || 'Failed to add company staff' }, { status: 500 });
  }
}
