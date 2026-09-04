import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { generateEnrollmentToken } from '@/lib/services/device.service';
import { hasPermission } from '@/lib/rbac';

export async function POST(request: NextRequest) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(ctx.role, 'devices:create')) {
      return NextResponse.json({ data: null, error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { deviceType, deviceName, allowedRoles } = body;

    if (!deviceType || !deviceName) {
      return NextResponse.json(
        { data: null, error: 'deviceType and deviceName are required' },
        { status: 400 }
      );
    }

    const result = await generateEnrollmentToken(ctx, deviceType, deviceName, allowedRoles || []);

    return NextResponse.json({ data: result });
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
