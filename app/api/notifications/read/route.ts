import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { markAllAsRead } from '@/lib/services/notification.service';

export async function POST(request: NextRequest) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const recipientId = body.recipient_id || ctx.userId;

    const count = await markAllAsRead(ctx, recipientId);
    return NextResponse.json({ data: { marked: count } });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e.message || 'Internal server error' }, { status: 500 });
  }
}
