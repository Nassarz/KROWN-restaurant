import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { verifyCode } from '@/lib/services/security.service';
import { hasPermission } from '@/lib/rbac';

export async function POST(request: NextRequest) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(ctx.role, 'staff:view') && !hasPermission(ctx.role, 'settings:view')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { code, purpose } = body;

    if (!code || !purpose) {
      return NextResponse.json({ error: 'code and purpose are required' }, { status: 400 });
    }

    // Verify against authenticated user only (not arbitrary staff_id)
    const result = await verifyCode(ctx.userId, code, purpose);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ data: { verified: true } });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e.message || 'Internal server error' }, { status: 500 });
  }
}
