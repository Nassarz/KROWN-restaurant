import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { getActiveSessionsByOrg } from '@/lib/services/session.service';
import { hasPermission } from '@/lib/rbac';

export async function GET(request: NextRequest) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(ctx.role, 'sessions:read')) {
      return NextResponse.json({ data: null, error: 'Insufficient permissions' }, { status: 403 });
    }

    const sessions = await getActiveSessionsByOrg(ctx);
    return NextResponse.json({ data: sessions });
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
