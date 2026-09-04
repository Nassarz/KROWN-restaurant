import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
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
    return NextResponse.json(
      { data: null, error: e.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
