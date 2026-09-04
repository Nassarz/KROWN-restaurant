import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { verifyCode } from '@/lib/services/security.service';

export async function POST(request: NextRequest) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { staff_id, code, purpose } = body;

    if (!staff_id || !code || !purpose) {
      return NextResponse.json({ error: 'staff_id, code, and purpose are required' }, { status: 400 });
    }

    const result = await verifyCode(staff_id, code, purpose);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ data: { verified: true } });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e.message || 'Internal server error' }, { status: 500 });
  }
}
