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

  if (!hasPermission(ctx.role, 'companies:read')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const company = await companyService.getCompany(ctx, id);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }
    return NextResponse.json({ data: company });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to get company' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPermission(ctx.role, 'companies:update')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const company = await companyService.updateCompany(ctx, id, {
      name: body.name,
      tax_id: body.taxId,
      credit_limit_ugx: body.creditLimitUGX,
      contact_person: body.contactPerson,
      phone: body.phone,
      branch_id: body.branchId,
    });

    return NextResponse.json({ data: company });
  } catch (error: any) {
    if (error.message === 'Company not found') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: error.message || 'Failed to update company' }, { status: 500 });
  }
}
