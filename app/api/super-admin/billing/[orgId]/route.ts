import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { getSql } from '@/lib/neon-server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const ctx = extractTenantContext(request);
  if (!ctx || ctx.role !== 'super_admin') {
    return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
  }

  const sql = getSql();
  try {
    const result = await sql`
      SELECT ts.*, sp.name as plan_name, sp.display_name as plan_display_name,
             sp.monthly_price_ugx, sp.max_branches, sp.max_staff,
             o.name as org_name
      FROM tenant_subscriptions ts
      JOIN subscription_plans sp ON sp.id = ts.plan_id
      JOIN organizations o ON o.id = ts.organization_id
      WHERE ts.organization_id = ${orgId}
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
    }

    return NextResponse.json({ data: result[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to get subscription' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const ctx = extractTenantContext(request);
  if (!ctx || ctx.role !== 'super_admin') {
    return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const { plan_id, status, end_date } = body;

  const sql = getSql();
  try {
    const existing = await sql`SELECT id FROM tenant_subscriptions WHERE organization_id = ${orgId}`;
    if (existing.length === 0) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
    }

    if (plan_id) {
      await sql`UPDATE tenant_subscriptions SET plan_id = ${plan_id}, updated_at = NOW() WHERE organization_id = ${orgId}`;
    }
    if (status) {
      await sql`UPDATE tenant_subscriptions SET status = ${status}, updated_at = NOW() WHERE organization_id = ${orgId}`;
    }
    if (end_date) {
      await sql`UPDATE tenant_subscriptions SET end_date = ${end_date}, updated_at = NOW() WHERE organization_id = ${orgId}`;
    }

    const updated = await sql`
      SELECT ts.*, sp.name as plan_name, sp.display_name as plan_display_name
      FROM tenant_subscriptions ts
      LEFT JOIN subscription_plans sp ON sp.id = ts.plan_id
      WHERE ts.organization_id = ${orgId}
    `;
    return NextResponse.json({ data: updated[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update subscription' }, { status: 500 });
  }
}
