import { NextRequest, NextResponse } from 'next/server';
import { extractVerifiedTenantContext } from '@/lib/tenant';
import { assertBranchAccess } from '@/lib/access-control';
import { getSql } from '@/lib/neon-server';

export async function GET(request: NextRequest) {
  try {
    const ctx = await extractVerifiedTenantContext(request);
    if (!ctx) return NextResponse.json({ data:null, error:'Unauthorized' }, { status:401 });
    const role = String(ctx.role).toLowerCase();
    if (!ctx.isSuperAdmin && !['restaurant_admin','admin','manager','branch_manager','cashier'].includes(role)) {
      return NextResponse.json({ data:null, error:'Insufficient permissions' }, { status:403 });
    }

    const params = new URL(request.url).searchParams;
    const requestedBranch = params.get('branchId');
    const branchId = requestedBranch || ctx.branchId || null;
    if (!ctx.isSuperAdmin && !branchId) return NextResponse.json({ data:null, error:'Branch context is required' }, { status:400 });
    if (branchId) assertBranchAccess(ctx, branchId);

    const sql = getSql();
    await sql`SELECT set_config('app.org', ${ctx.organizationId}, true)`;
    const scope = branchId ? sql`o.organization_id=${ctx.organizationId} AND o.restaurant_id=${branchId}` : sql`o.organization_id=${ctx.organizationId}`;
    const today = sql`o.created_at >= CURRENT_DATE AND o.created_at < CURRENT_DATE + INTERVAL '1 day'`;

    const rows = await sql`
      SELECT
        COUNT(*) FILTER (WHERE ${scope} AND ${today})::int AS orders_today,
        COALESCE(SUM(o.total) FILTER (WHERE ${scope} AND ${today} AND o.status <> 'cancelled'),0) AS total_amount_today,
        COALESCE(SUM(o.amount_received) FILTER (WHERE ${scope} AND ${today}),0) AS cashier_received_today,
        COALESCE(SUM((SELECT COALESCE(SUM((item->>'quantity')::numeric),0) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(o.items)='array' THEN o.items ELSE '[]'::jsonb END) item)) FILTER (WHERE ${scope} AND ${today} AND o.status <> 'cancelled'),0) AS meals_sold_today,
        COUNT(*) FILTER (WHERE ${scope} AND ${today} AND o.status IN ('pending','preparing','ready','completed'))::int AS kitchen_orders_sent_today,
        COUNT(*) FILTER (WHERE ${scope} AND ${today} AND o.status='ready')::int AS kitchen_orders_ready_today,
        COUNT(*) FILTER (WHERE ${scope} AND ${today} AND o.payment_status='paid')::int AS paid_orders_today,
        COUNT(*) FILTER (WHERE ${scope} AND ${today} AND o.payment_status <> 'paid' AND o.status <> 'cancelled')::int AS unpaid_orders_today,
        COALESCE(SUM(o.total) FILTER (WHERE ${scope} AND ${today} AND o.is_personal_credit=true),0) AS personal_credit_today,
        COALESCE(SUM(o.total) FILTER (WHERE ${scope} AND ${today} AND o.company_id IS NOT NULL),0) AS corporate_credit_today
      FROM orders o
    `;

    return NextResponse.json({ data: { ...rows[0], branchId, generatedAt: new Date().toISOString() } });
  } catch (e:any) {
    return NextResponse.json({ data:null, error:e?.message || 'Unable to load dashboard metrics' }, { status:400 });
  }
}
