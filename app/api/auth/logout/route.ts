import { NextRequest, NextResponse } from 'next/server';
import { revokeSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const bearer = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
    const token = bearer || request.cookies.get('krown_session')?.value;
    if (token) await revokeSession(decodeURIComponent(token), 'logout');

    const response = NextResponse.json({ data: { success: true } });
    response.cookies.set('krown_session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });
    return response;
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e.message || 'Internal server error' }, { status: 500 });
  }
}
