import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, createToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token =
      authHeader?.replace('Bearer ', '') ||
      request.cookies.get('krown_session')?.value;

    if (!token) {
      return NextResponse.json({ data: null, error: 'No token provided' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ data: null, error: 'Invalid or expired token' }, { status: 401 });
    }

    const newToken = await createToken({
      sub: payload.sub,
      org: payload.org,
      role: payload.role,
      branch: payload.branch,
      email: payload.email,
    });

    const response = NextResponse.json({ data: { token: newToken } });

    response.cookies.set('krown_session', newToken, {
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
