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

  if (!hasPermission(ctx.role, 'companies:toggle_status')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || !['active', 'suspended', 'closed'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status. Must be active, suspended, or closed' }, { status: 400 });
    }

    const company = await companyService.toggleStatus(ctx, id, status);
    return NextResponse.json({ data: company });
  } catch (error: any) {
    if (error.message === 'Company not found') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: error.message || 'Failed to update company status' }, { status: 500 });
  }
}
