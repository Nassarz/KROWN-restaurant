import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { listAlerts, createAlert } from '@/lib/services/security.service';
import { hasPermission } from '@/lib/rbac';

export async function GET(request: NextRequest) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(ctx.role, 'security:read') && !hasPermission(ctx.role, 'security:view') && ctx.role !== 'super_admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const severity = request.nextUrl.searchParams.get('severity') || undefined;
    const status = request.nextUrl.searchParams.get('status') || undefined;
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50', 10);
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0', 10);

    const alerts = await listAlerts(ctx, { severity, status, limit, offset });
    return NextResponse.json({ data: alerts });
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

    if (!hasPermission(ctx.role, 'security:create') && ctx.role !== 'super_admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { alert_type, severity, title, description, target_type, target_id, source_ip, source_device_id, metadata } = body;

    if (!alert_type || !severity || !title) {
      return NextResponse.json({ error: 'alert_type, severity, and title are required' }, { status: 400 });
    }

    const alert = await createAlert(ctx, {
      alert_type,
      severity,
      title,
      description,
      target_type,
      target_id,
      source_ip,
      source_device_id,
      metadata,
    });

    return NextResponse.json({ data: alert }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e.message || 'Internal server error' }, { status: 500 });
  }
}
