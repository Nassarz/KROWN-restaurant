import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { generateVerificationCode } from '@/lib/services/security.service';
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
    const { purpose } = body;

    if (!purpose) {
      return NextResponse.json({ error: 'purpose is required' }, { status: 400 });
    }

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;
    const ua = request.headers.get('user-agent') || undefined;

    // Use authenticated user's staff_id (not from body — prevents requesting codes for others)
    const code = await generateVerificationCode(ctx.userId, purpose, ctx.organizationId, ip || undefined, ua || undefined);

    // Never return the code in the response — in production send via email/SMS
    return NextResponse.json({ data: { code_sent: true, code: '***' } });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e.message || 'Internal server error' }, { status: 500 });
  }
}
