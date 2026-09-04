import { NextRequest, NextResponse } from 'next/server';
import * as branchService from '@/lib/services/branch.service';
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

  if (!hasPermission(ctx.role, 'branches:update_status')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || !['online', 'busy', 'maintenance'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status. Must be online, busy, or maintenance' }, { status: 400 });
    }

    const branch = await branchService.updateStatus(ctx, id, status);
    return NextResponse.json({ data: branch });
  } catch (error: any) {
    if (error.message === 'Branch not found') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: error.message || 'Failed to update branch status' }, { status: 500 });
  }
}
