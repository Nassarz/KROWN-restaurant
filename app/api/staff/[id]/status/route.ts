import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { updateStatus } from '@/lib/services/staff.service';
import { hasPermission } from '@/lib/rbac';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(ctx.role, 'staff:update_status')) {
      return NextResponse.json({ data: null, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { data: null, error: 'Status is required' },
        { status: 400 }
      );
    }

    const validStatuses = ['active', 'on_shift', 'off_shift', 'on_leave', 'paused', 'banned'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { data: null, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const staff = await updateStatus(ctx, id, status);
    return NextResponse.json({ data: staff });
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
