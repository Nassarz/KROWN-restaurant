import { NextRequest, NextResponse } from 'next/server';
import * as companyService from '@/lib/services/company.service';
import { extractTenantContext } from '@/lib/tenant';
import { hasPermission } from '@/lib/rbac';

export async function GET(request: NextRequest) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPermission(ctx.role, 'companies:read')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const branchId = request.nextUrl.searchParams.get('branchId') || undefined;
    const companies = await companyService.listCompanies(ctx, branchId);
    return NextResponse.json({ data: companies });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to list companies' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPermission(ctx.role, 'companies:create')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, taxId, creditLimitUGX, contactPerson, phone, branchId } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
    }

    const company = await companyService.createCompany(ctx, {
      name: name.trim(),
      taxId: taxId || '',
      creditLimitUGX: creditLimitUGX || 0,
      contactPerson: contactPerson || '',
      phone: phone || '',
      branchId,
    });

    return NextResponse.json({ data: company }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create company' }, { status: 500 });
  }
}
