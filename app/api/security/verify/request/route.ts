import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { generateVerificationCode } from '@/lib/services/security.service';

export async function POST(request: NextRequest) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { staff_id, purpose } = body;

    if (!staff_id || !purpose) {
      return NextResponse.json({ error: 'staff_id and purpose are required' }, { status: 400 });
    }

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;
    const ua = request.headers.get('user-agent') || undefined;

    const code = await generateVerificationCode(staff_id, purpose, ctx.organizationId, ip || undefined, ua || undefined);

    // In production, send code via email/SMS. For now, return it.
    return NextResponse.json({ data: { code_sent: true, code } });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e.message || 'Internal server error' }, { status: 500 });
  }
}
