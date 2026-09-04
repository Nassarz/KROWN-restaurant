import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { listConversations, createConversation } from '@/lib/services/support.service';

export async function GET(request: NextRequest) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const status = request.nextUrl.searchParams.get('status') || undefined;
    const agent_id = request.nextUrl.searchParams.get('agent_id') || undefined;
    const priority = request.nextUrl.searchParams.get('priority') || undefined;
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50', 10);
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0', 10);

    const conversations = await listConversations(ctx, { status, agent_id, priority, limit, offset });
    return NextResponse.json({ data: conversations });
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
    const { customer_staff_id, category, priority, subject, device_id, app_version, context } = body;

    if (!subject) {
      return NextResponse.json({ error: 'subject is required' }, { status: 400 });
    }

    // Use authenticated user's ID if customer_staff_id not provided
    const staffId = customer_staff_id || ctx.userId;

    const conversation = await createConversation(ctx, {
      customer_staff_id: staffId,
      category,
      priority,
      subject,
      device_id,
      app_version,
      context,
    });

    return NextResponse.json({ data: conversation }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e.message || 'Internal server error' }, { status: 500 });
  }
}
