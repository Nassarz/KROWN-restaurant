import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { listTrustedDevices, createTrustedDevice } from '@/lib/services/security.service';

export async function GET(request: NextRequest) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const staffId = request.nextUrl.searchParams.get('staff_id') || ctx.userId;
    const devices = await listTrustedDevices(ctx, staffId);

    return NextResponse.json({ data: devices });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { staff_id, fingerprint, name, browser, os } = body;

    if (!staff_id || !fingerprint) {
      return NextResponse.json({ error: 'staff_id and fingerprint are required' }, { status: 400 });
    }

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;
    const device = await createTrustedDevice(ctx, staff_id, fingerprint, name, browser, os, ip || undefined);

    return NextResponse.json({ data: device }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e.message || 'Internal server error' }, { status: 500 });
  }
}
