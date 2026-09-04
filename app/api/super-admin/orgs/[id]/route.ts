import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/neon-server';
import { extractTenantContext } from '@/lib/tenant';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx || ctx.role !== 'super_admin') {
      return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const sql = getSql();

    const org = await sql`
      SELECT o.*,
        (SELECT COUNT(*) FROM branches WHERE organization_id = o.id) as branch_count,
        (SELECT COUNT(*) FROM staff WHERE organization_id = o.id) as staff_count,
        (SELECT COUNT(*) FROM products WHERE organization_id = o.id) as product_count,
        (SELECT COUNT(*) FROM orders WHERE organization_id = o.id) as order_count,
        ts.status as subscription_status,
        ts.current_period_end,
        ts.trial_ends_at,
        sp.name as plan_name,
        sp.display_name as plan_display_name,
        sp.max_branches, sp.max_staff, sp.max_menu_items, sp.max_orders_per_day
      FROM organizations o
      LEFT JOIN tenant_subscriptions ts ON ts.organization_id = o.id AND ts.status = 'active'
      LEFT JOIN subscription_plans sp ON ts.plan_id = sp.id
      WHERE o.id = ${id}
      LIMIT 1
    `;

    if (org.length === 0) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json({ data: org[0] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx || ctx.role !== 'super_admin') {
      return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const sql = getSql();

    const { name, contactEmail, contactPhone, taxId, address, status } = body;

    const updated = await sql`
      UPDATE organizations SET
        name = COALESCE(${name}, name),
        contact_email = COALESCE(${contactEmail}, contact_email),
        contact_phone = COALESCE(${contactPhone}, contact_phone),
        tax_id = COALESCE(${taxId}, tax_id),
        address = COALESCE(${address}, address),
        status = COALESCE(${status}, status),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json({ data: updated[0] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
