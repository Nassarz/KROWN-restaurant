import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { enrollDevice } from '@/lib/services/device.service';

export async function POST(request: NextRequest) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { token, deviceFingerprint, browser, operatingSystem, ipAddress, userAgent } = body;

    if (!token || !deviceFingerprint) {
      return NextResponse.json(
        { data: null, error: 'token and deviceFingerprint are required' },
        { status: 400 }
      );
    }

    const device = await enrollDevice(ctx, token, deviceFingerprint, {
      browser,
      operatingSystem,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ data: device });
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
