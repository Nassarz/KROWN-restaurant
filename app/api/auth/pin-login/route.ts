import { NextRequest, NextResponse } from 'next/server';
import { authenticateByPin } from '@/lib/auth';
import { verifyDeviceChallenge } from '@/lib/services/device-auth.service';
import { authenticateAdminByPin } from '@/lib/services/admin-pin-auth.service';

const ADMIN_ROLES = new Set(['super_admin', 'restaurant_admin', 'admin']);

function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set('krown_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24,
    path: '/',
  });
}

export async function POST(request: NextRequest) {
  try {
    const { email, pin, deviceId, challenge, signature } = await request.json();

    if (!email || !pin) {
      return NextResponse.json(
        { data: null, error: 'Email and PIN are required' },
        { status: 400 }
      );
    }

    // Admin accounts are intentionally device-independent. PIN verification,
    // Argon2id and lockout protection remain server-side.
    // This branch is only selected when no device proof is supplied.
    if (!deviceId && !challenge && !signature) {
      const result = await authenticateAdminByPin(String(email), String(pin));
      if (!result.success || !result.token || !result.staff) {
        return NextResponse.json(
          { data: null, error: result.error || 'Authentication failed' },
          { status: result.error?.includes('registered KROWN device') ? 403 : 401 }
        );
      }
      if (!ADMIN_ROLES.has(result.staff.role)) {
        return NextResponse.json(
          { data: null, error: 'A registered KROWN device is required for this account' },
          { status: 403 }
        );
      }
      const response = NextResponse.json({
        data: {
          token: result.token,
          staff: result.staff,
          deviceId: null,
          branchId: result.staff.assigned_branch_id || null,
        },
      });
      setSessionCookie(response, result.token);
      return response;
    }

    // Ordinary staff must present complete cryptographic proof from an
    // enrolled device. Partial proof is never accepted.
    if (!deviceId || !challenge || !signature) {
      return NextResponse.json(
        { data: null, error: 'Complete registered-device proof is required' },
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
      data: {
        token: result.token,
        staff: result.staff,
        deviceId: device.deviceId,
        branchId: device.branchId,
      },
    });
    setSessionCookie(response, result.token);
    return response;
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e.message || 'Internal server error' },
      { status: 401 }
    );
  }
}