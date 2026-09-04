import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { setPin } from '@/lib/services/staff.service';
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

    if (!hasPermission(ctx.role, 'staff:set_pin')) {
      return NextResponse.json({ data: null, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { pin } = body;

    if (!pin) {
      return NextResponse.json(
        { data: null, error: 'PIN is required' },
        { status: 400 }
      );
    }

    if (pin.length < 4 || pin.length > 8) {
      return NextResponse.json(
        { data: null, error: 'PIN must be between 4 and 8 digits' },
        { status: 400 }
      );
    }

    await setPin(ctx, id, pin);
    return NextResponse.json({ data: { success: true } });
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
