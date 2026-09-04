import { NextRequest, NextResponse } from 'next/server';
import { authenticateStaff } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { data: null, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const result = await authenticateStaff(email, password);

    if (!result.success || !result.token || !result.staff) {
      return NextResponse.json(
        { data: null, error: result.error || 'Authentication failed' },
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
      maxAge: 60 * 60 * 24, // 24 hours
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
