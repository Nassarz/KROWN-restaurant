import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/neon-server';
import { extractTenantContext } from '@/lib/tenant';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx || ctx.role !== 'super_admin') {
      return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { planId } = body;

    if (!planId) {
      return NextResponse.json({ error: 'Plan ID required' }, { status: 400 });
    }

    const sql = getSql();

    // Verify plan exists
    const plan = await sql`SELECT * FROM subscription_plans WHERE id = ${planId} AND is_active = true LIMIT 1`;
    if (plan.length === 0) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // Cancel current subscription
    await sql`UPDATE tenant_subscriptions SET status = 'cancelled' WHERE organization_id = ${id} AND status = 'active'`;

    // Create new subscription
    await sql`
      INSERT INTO tenant_subscriptions (organization_id, plan_id, status, started_at, current_period_start, current_period_end)
      VALUES (${id}, ${planId}, 'active', NOW(), NOW(), NOW() + INTERVAL '30 days')
    `;

    return NextResponse.json({ data: { success: true, message: 'Subscription updated' } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
