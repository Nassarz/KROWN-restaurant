import { NextRequest, NextResponse } from 'next/server';
import { extractVerifiedTenantContext } from '@/lib/tenant';
import { issueDeviceChallenge } from '@/lib/services/device-auth.service';

export async function POST(request: NextRequest) {
  try {
    const ctx = await extractVerifiedTenantContext(request);
    if (!ctx) return NextResponse.json({ data:null, error:'Unauthorized' }, { status:401 });
    const body = await request.json();
    if (!body.deviceId) return NextResponse.json({ data:null, error:'deviceId is required' }, { status:400 });
    const data = await issueDeviceChallenge(ctx, String(body.deviceId));
    return NextResponse.json({ data });
  } catch (e:any) {
    const message=e?.message||'Unable to issue device challenge';
    return NextResponse.json({ data:null, error:message }, { status:/Forbidden|not active|not found/i.test(message)?403:400 });
  }
}
