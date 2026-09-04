import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/neon-server';
import { extractTenantContext } from '@/lib/tenant';

export async function GET(request: NextRequest) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx || ctx.role !== 'super_admin') {
      return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
    }

    const sql = getSql();
    const plans = await sql`SELECT * FROM subscription_plans WHERE is_active = true ORDER BY monthly_price_ugx ASC`;

    return NextResponse.json({ data: plans });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
