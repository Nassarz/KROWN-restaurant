import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { assignAgent } from '@/lib/services/support.service';
import { hasPermission } from '@/lib/rbac';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(ctx.role, 'support:assign') && ctx.role !== 'super_admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { agent_id } = body;

    if (!agent_id) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });
    }

    const conversation = await assignAgent(ctx, id, agent_id);
    return NextResponse.json({ data: conversation });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e.message || 'Internal server error' }, { status: 500 });
  }
}
