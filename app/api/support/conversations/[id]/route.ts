import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { getConversation, updateStatus, resolveConversation, closeConversation, reopenConversation } from '@/lib/services/support.service';

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
    const result = await getConversation(ctx, id);
    if (!result) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    return NextResponse.json({ data: result });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
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
    const { status: newStatus } = body;

    if (!newStatus) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 });
    }

    let conversation;
    switch (newStatus) {
      case 'resolved':
        conversation = await resolveConversation(ctx, id);
        break;
      case 'closed':
        conversation = await closeConversation(ctx, id);
        break;
      case 'open':
        conversation = await reopenConversation(ctx, id);
        break;
      default:
        conversation = await updateStatus(ctx, id, newStatus);
    }

    return NextResponse.json({ data: conversation });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e.message || 'Internal server error' }, { status: 500 });
  }
}
