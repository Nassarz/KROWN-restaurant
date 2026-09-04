import { NextRequest, NextResponse } from 'next/server';
import * as companyService from '@/lib/services/company.service';
import { extractTenantContext } from '@/lib/tenant';
import { hasPermission } from '@/lib/rbac';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPermission(ctx.role, 'companies:settle')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { amount, paymentMethod, notes } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Settlement amount must be greater than zero' }, { status: 400 });
    }

    if (!paymentMethod?.trim()) {
      return NextResponse.json({ error: 'Payment method is required' }, { status: 400 });
    }

    const company = await companyService.settleBalance(ctx, id, amount, paymentMethod);
    return NextResponse.json({ data: company });
  } catch (error: any) {
    if (error.message === 'Company not found') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: error.message || 'Failed to settle balance' }, { status: 500 });
  }
}
