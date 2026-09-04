import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token =
      authHeader?.replace('Bearer ', '') ||
      request.cookies.get('krown_session')?.value;

    if (!token) {
      return NextResponse.json({ session: null, data: null, error: 'No token provided' }, { status: 401 });
    }

    const result = await getSession(token);

    if (!result.success || !result.staff) {
      return NextResponse.json(
        { session: null, data: null, error: result.error || 'Invalid session' },
        { status: 401 }
      );
    }

    return NextResponse.json({ session: { user: result.staff }, data: { staff: result.staff } });
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
