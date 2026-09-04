import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { canViewAudit, hasPermission } from '@/lib/rbac';
import { getAuditStats } from '@/lib/audit';

export async function GET(request: NextRequest) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canViewAudit(ctx.role) && !hasPermission(ctx.role, 'audit:read')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const stats = await getAuditStats(ctx.organizationId);
    return NextResponse.json({ data: stats });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to get audit stats' }, { status: 500 });
  }
}
