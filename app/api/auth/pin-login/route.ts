import { NextRequest, NextResponse } from 'next/server';
import { authenticateByPin } from '@/lib/auth';
import { verifyDeviceChallenge } from '@/lib/services/device-auth.service';

export async function POST(request: NextRequest) {
  try {
    const { email, pin, deviceId, challenge, signature } = await request.json();

    if (!email || !pin || !deviceId || !challenge || !signature) {
      return NextResponse.json(
        { data: null, error: 'Email, PIN, registered device and device proof are required' },
        { status: 400 }
      );
    }

    const device = await verifyDeviceChallenge(String(deviceId), String(signature), String(challenge));
    const result = await authenticateByPin(String(email), String(pin), {
      deviceId: device.deviceId,
      organizationId: device.organizationId,
      branchId: device.branchId,
    });

    if (!result.success || !result.token || !result.staff) {
      return NextResponse.json(
        { data: null, error: result.error || 'Authentication failed' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      data: { token: result.token, staff: result.staff, deviceId: device.deviceId, branchId: device.branchId },
    });

    response.cookies.set('krown_session', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: '/',
    });

    return response;
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e.message || 'Internal server error' },
      { status: 401 }
    );
  }
}