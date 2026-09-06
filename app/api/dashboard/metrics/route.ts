import { NextRequest, NextResponse } from 'next/server';
import { extractVerifiedTenantContext } from '@/lib/tenant';
import { assertBranchAccess } from '@/lib/access-control';
import { getSql } from '@/lib/neon-server';

export async function GET(request: NextRequest) {
  try {
    const ctx = await extractVerifiedTenantContext(request);
    if (!ctx) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    const role = String(ctx.role).toLowerCase();
    if (!ctx.isSuperAdmin && !['restaurant_admin', 'admin', 'manager', 'branch_manager', 'cashier'].includes(role)) {
      return NextResponse.json({ data: null, error: 'Insufficient permissions' }, { status: 403 });
    }

    const params = new URL(request.url).searchParams;
    const requestedBranch = params.get('branchId');
    const branchId = requestedBranch || ctx.branchId || null;
    if (!ctx.isSuperAdmin && !branchId) return NextResponse.json({ data: null, error: 'Branch context is required' }, { status: 400 });
    if (branchId) await assertBranchAccess(ctx, branchId);

    const sql = getSql();
    await sql`SELECT set_config('app.org', ${ctx.organizationId}, false)`;

    const rows = await sql`
      SELECT
        COUNT(*) FILTER (WHERE o.created_at >= CURRENT_DATE AND o.created_at < CURRENT_DATE + INTERVAL '1 day')::int AS orders_today,
        COALESCE(SUM(o.total) FILTER (WHERE o.created_at >= CURRENT_DATE AND o.created_at < CURRENT_DATE + INTERVAL '1 day' AND o.status <> 'cancelled'), 0) AS total_amount_today,
        COALESCE(SUM(COALESCE(o.amount_received, 0)) FILTER (WHERE o.created_at >= CURRENT_DATE AND o.created_at < CURRENT_DATE + INTERVAL '1 day'), 0) AS cashier_received_today,
        COALESCE(SUM((SELECT COALESCE(SUM((item->>'quantity')::numeric), 0) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(o.items) = 'array' THEN o.items ELSE '[]'::jsonb END) item)) FILTER (WHERE o.created_at >= CURRENT_DATE AND o.created_at < CURRENT_DATE + INTERVAL '1 day' AND o.status <> 'cancelled'), 0) AS meals_sold_today,
        COUNT(*) FILTER (WHERE o.created_at >= CURRENT_DATE AND o.created_at < CURRENT_DATE + INTERVAL '1 day' AND o.status IN ('pending','preparing','ready','completed'))::int AS kitchen_orders_sent_today,
        COUNT(*) FILTER (WHERE o.created_at >= CURRENT_DATE AND o.created_at < CURRENT_DATE + INTERVAL '1 day' AND o.status = 'ready')::int AS kitchen_orders_ready_today,
        COUNT(*) FILTER (WHERE o.created_at >= CURRENT_DATE AND o.created_at < CURRENT_DATE + INTERVAL '1 day' AND o.payment_status = 'paid')::int AS paid_orders_today,
        COUNT(*) FILTER (WHERE o.created_at >= CURRENT_DATE AND o.created_at < CURRENT_DATE + INTERVAL '1 day' AND o.payment_status <> 'paid' AND o.status <> 'cancelled')::int AS unpaid_orders_today,
        COALESCE(SUM(o.total) FILTER (WHERE o.created_at >= CURRENT_DATE AND o.created_at < CURRENT_DATE + INTERVAL '1 day' AND o.is_personal_credit = true), 0) AS personal_credit_today,
        COALESCE(SUM(o.total) FILTER (WHERE o.created_at >= CURRENT_DATE AND o.created_at < CURRENT_DATE + INTERVAL '1 day' AND o.company_id IS NOT NULL), 0) AS corporate_credit_today
      FROM orders o
      WHERE o.organization_id = ${ctx.organizationId}
        AND (${branchId}::uuid IS NULL OR o.restaurant_id = ${branchId})
    `;

    return NextResponse.json({ data: { ...rows[0], branchId, generatedAt: new Date().toISOString() } });
  } catch (e: any) {
    const message = e?.message || 'Unable to load dashboard metrics';
    const status = /Forbidden/i.test(message) ? 403 : 400;
    return NextResponse.json({ data: null, error: message }, { status });
  }
}
