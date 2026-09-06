import { NextRequest, NextResponse } from 'next/server';
import { authenticateByPin } from '@/lib/auth';
import { verifyDeviceChallenge } from '@/lib/services/device-auth.service';

const ADMIN_ROLES = new Set(['super_admin', 'restaurant_admin', 'admin']);

export async function POST(request: NextRequest) {
  try {
    const { email, pin, deviceId, challenge, signature } = await request.json();

    if (!email || !pin) {
      return NextResponse.json(
        { data: null, error: 'Email and PIN are required' },
        { status: 400 }
      );
    }

    // Admin accounts are intentionally device-independent. The PIN is still
    // verified server-side with Argon2id and the normal lockout controls.
    // Ordinary staff must present cryptographic proof from an enrolled device.
    let deviceContext: { deviceId: string; organizationId: string; branchId: string | null } | undefined;

    if (deviceId || challenge || signature) {
      if (!deviceId || !challenge || !signature) {
        return NextResponse.json(
          { data: null, error: 'Complete registered-device proof is required' },
          { status: 400 }
        );
      }
      const device = await verifyDeviceChallenge(String(deviceId), String(signature), String(challenge));
      deviceContext = {
        deviceId: device.deviceId,
        organizationId: device.organizationId,
        branchId: device.branchId,
      };
    }

    // First authenticate without device context only to determine whether this
    // is an admin account. Non-admin users are then rejected unless device proof
    // is present. This keeps the actual PIN verification and lockout logic in
    // the shared authentication service.
    if (!deviceContext) {
      const result = await authenticateByPin(String(email), String(pin));
      if (!result.success || !result.staff) {
        return NextResponse.json(
          { data: null, error: result.error || 'Authentication failed' },
          { status: 401 }
        );
      }

      if (!ADMIN_ROLES.has(result.staff.role)) {
        return NextResponse.json(
          { data: null, error: 'A registered KROWN device is required for this account' },
          { status: 403 }
        );
      }

      // Re-run through the shared flow is unnecessary: the successful result
      // already contains the securely-created session token.
      const response = NextResponse.json({
        data: { token: result.token, staff: result.staff, deviceId: null, branchId: result.staff.assigned_branch_id || null },
      });
      if (result.token) {
        response.cookies.set('krown_session', result.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24,
          path: '/',
        });
      }
      return response;
    }

    const result = await authenticateByPin(String(email), String(pin), deviceContext);
    if (!result.success || !result.token || !result.staff) {
      return NextResponse.json(
        { data: null, error: result.error || 'Authentication failed' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      data: { token: result.token, staff: result.staff, deviceId: deviceContext.deviceId, branchId: deviceContext.branchId },
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