import { NextRequest, NextResponse } from 'next/server';
import { authenticateStaff, authenticateSuperAdmin } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { data: null, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Platform Super Admin accounts live in their own table and must be
    // authenticated before tenant staff accounts with the same email.
    const superAdminResult = await authenticateSuperAdmin(normalizedEmail, String(password));
    if (superAdminResult.success && superAdminResult.token && superAdminResult.staff) {
      const response = NextResponse.json({
        data: { token: superAdminResult.token, staff: superAdminResult.staff },
      });
      response.cookies.set('krown_session', superAdminResult.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24,
        path: '/',
      });
      return response;
    }

    const result = await authenticateStaff(normalizedEmail, String(password));

    if (!result.success || !result.token || !result.staff) {
      return NextResponse.json(
        { data: null, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      data: { token: result.token, staff: result.staff },
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
      { status: 500 }
    );
  }
}
