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
    const sql = getSql();

    // Suspend organization
    await sql`UPDATE organizations SET status = 'suspended', updated_at = NOW() WHERE id = ${id}`;

    // Cancel active subscription
    await sql`UPDATE tenant_subscriptions SET status = 'cancelled' WHERE organization_id = ${id} AND status = 'active'`;

    // Deactivate all staff
    await sql`UPDATE staff SET status = 'paused' WHERE organization_id = ${id} AND status = 'active'`;

    return NextResponse.json({ data: { success: true, message: 'Organization suspended' } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
