import { NextRequest, NextResponse } from 'next/server';
import { authenticateByPin } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { email, pin } = await request.json();

    if (!email || !pin) {
      return NextResponse.json(
        { data: null, error: 'Email and PIN are required' },
        { status: 400 }
      );
    }

    const result = await authenticateByPin(email, pin);

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
