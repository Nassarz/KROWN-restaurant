import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { listNotifications, createNotification } from '@/lib/services/notification.service';

export async function GET(request: NextRequest) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const recipientId = ctx.userId;
    const type = request.nextUrl.searchParams.get('type') || undefined;
    const unread_only = request.nextUrl.searchParams.get('unread_only') === 'true';
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50', 10);
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0', 10);

    const notifications = await listNotifications(ctx, recipientId, { type, unread_only, limit, offset });
    return NextResponse.json({ data: notifications });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { recipient_id, type, title, message, link_url, link_type, priority, metadata } = body;

    if (!recipient_id || !type || !title) {
      return NextResponse.json({ error: 'recipient_id, type, and title are required' }, { status: 400 });
    }

    const notification = await createNotification(ctx, {
      recipient_id,
      type,
      title,
      message,
      link_url,
      link_type,
      priority,
      metadata,
    });

    return NextResponse.json({ data: notification }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e.message || 'Internal server error' }, { status: 500 });
  }
}
