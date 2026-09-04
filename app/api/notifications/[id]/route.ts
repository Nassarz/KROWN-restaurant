import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { markAsRead, deleteNotification } from '@/lib/services/notification.service';

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
    const notification = await markAsRead(ctx, id);
    return NextResponse.json({ data: notification });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await deleteNotification(ctx, id);
    return NextResponse.json({ data: { deleted: true } });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e.message || 'Internal server error' }, { status: 500 });
  }
}
