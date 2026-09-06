import { NextRequest, NextResponse } from 'next/server';
import { verifyDeviceChallenge } from '@/lib/services/device-auth.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.deviceId || !body.challenge || !body.signature) return NextResponse.json({ data:null, error:'deviceId, challenge and signature are required' }, { status:400 });
    const data = await verifyDeviceChallenge(String(body.deviceId), String(body.signature), String(body.challenge));
    return NextResponse.json({ data });
  } catch (e:any) {
    const message=e?.message||'Device verification failed';
    return NextResponse.json({ data:null, error:message }, { status:/not found|not active/i.test(message)?403:401 });
  }
}
