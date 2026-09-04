import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { sendMessage, getMessages } from '@/lib/services/support.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50', 10);
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0', 10);

    const messages = await getMessages(ctx, id, limit, offset);
    return NextResponse.json({ data: messages });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { content, sender_type, message_type, is_internal } = body;

    if (!content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const message = await sendMessage(ctx, id, content, sender_type || 'customer', message_type, is_internal);
    return NextResponse.json({ data: message }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e.message || 'Internal server error' }, { status: 500 });
  }
}
