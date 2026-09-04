import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { activateDevice, suspendDevice, revokeDevice } from '@/lib/services/device.service';
import { hasPermission } from '@/lib/rbac';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(ctx.role, 'devices:update')) {
      return NextResponse.json({ data: null, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, reason } = body;

    if (!action) {
      return NextResponse.json(
        { data: null, error: 'Action is required' },
        { status: 400 }
      );
    }

    const validActions = ['activate', 'suspend', 'revoke'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { data: null, error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    let device;
    switch (action) {
      case 'activate':
        device = await activateDevice(ctx, id);
        break;
      case 'suspend':
        device = await suspendDevice(ctx, id);
        break;
      case 'revoke':
        device = await revokeDevice(ctx, id, reason);
        break;
    }

    return NextResponse.json({ data: device });
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
