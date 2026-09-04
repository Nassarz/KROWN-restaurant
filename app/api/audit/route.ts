import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { hasPermission, canViewAudit } from '@/lib/rbac';
import { queryAuditLogs, logAuditEvent } from '@/lib/audit';

export async function GET(request: NextRequest) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canViewAudit(ctx.role) && !hasPermission(ctx.role, 'audit:read')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const params = request.nextUrl.searchParams;
    const action = params.get('action') || undefined;
    const actorRole = params.get('actorRole') || undefined;
    const result = params.get('result') || undefined;
    const startDate = params.get('startDate') || undefined;
    const endDate = params.get('endDate') || undefined;
    const search = params.get('search') || undefined;
    const limit = parseInt(params.get('limit') || '100', 10);
    const offset = parseInt(params.get('offset') || '0', 10);

    const { logs, total } = await queryAuditLogs({
      organizationId: ctx.organizationId,
      action,
      actorRole,
      result,
      startDate,
      endDate,
      search,
      limit,
      offset,
    });

    return NextResponse.json({ data: logs, total, limit, offset });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to list audit logs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPermission(ctx.role, 'audit:create')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { action, targetType, targetId, details, result, reason } = body;

    if (!action?.trim()) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      staffId: ctx.userId,
      actorRole: ctx.role,
      action,
      targetType,
      targetId,
      details,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      deviceId: request.headers.get('x-device-id') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      branchId: ctx.branchId || undefined,
      result: result || 'success',
      reason,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create audit log' }, { status: 500 });
  }
}
