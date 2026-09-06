import { NextRequest, NextResponse } from 'next/server';
import * as companyService from '@/lib/services/company.service';
import { extractTenantContext } from '@/lib/tenant';
import { hasPermission } from '@/lib/rbac';
import { assertBranchAccess } from '@/lib/access-control';

export async function GET(request: NextRequest) {
  const ctx = extractTenantContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(ctx.role, 'companies:read')) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  try {
    const branchId = request.nextUrl.searchParams.get('branchId') || ctx.branchId || undefined;
    if (branchId) await assertBranchAccess(ctx, branchId);
    if (!branchId && !ctx.isSuperAdmin && ctx.role !== 'restaurant_admin') return NextResponse.json({ error: 'Branch is required' }, { status: 400 });
    const companies = await companyService.listCompanies(ctx, branchId);
    return NextResponse.json({ data: companies });
  } catch (error: any) {
    const message = error?.message || 'Failed to list companies';
    return NextResponse.json({ error: message }, { status: message.startsWith('Forbidden') ? 403 : 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = extractTenantContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(ctx.role, 'companies:create')) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  try {
    const body = await request.json();
    const { name, taxId, creditLimitUGX, contactPerson, phone } = body;
    const branchId = body.branchId || ctx.branchId;
    if (!name?.trim()) return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
    if (!branchId && !ctx.isSuperAdmin) return NextResponse.json({ error: 'Branch is required' }, { status: 400 });
    if (branchId) await assertBranchAccess(ctx, branchId);
    if (creditLimitUGX !== undefined && (!Number.isFinite(Number(creditLimitUGX)) || Number(creditLimitUGX) < 0)) return NextResponse.json({ error: 'Invalid credit limit' }, { status: 400 });
    const company = await companyService.createCompany(ctx, { name: name.trim(), taxId: taxId || '', creditLimitUGX: Number(creditLimitUGX || 0), contactPerson: contactPerson || '', phone: phone || '', branchId });
    return NextResponse.json({ data: company }, { status: 201 });
  } catch (error: any) {
    const message = error?.message || 'Failed to create company';
    return NextResponse.json({ error: message }, { status: message.startsWith('Forbidden') ? 403 : 500 });
  }
}
