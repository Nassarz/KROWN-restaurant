import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { getSql } from '@/lib/neon-server';

export async function GET(request: NextRequest) {
  const ctx = extractTenantContext(request);
  if (!ctx || ctx.role !== 'super_admin') {
    return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
  }

  const query = request.nextUrl.searchParams.get('q')?.trim();
  if (!query || query.length < 2) {
    return NextResponse.json({ data: { restaurants: [], users: [], devices: [], orders: [], alerts: [], support: [] } });
  }

  const sql = getSql();
  const searchPattern = `%${query}%`;

  try {
    const [restaurants, users, devices, orders, alerts, support] = await Promise.all([
      sql`
        SELECT id, name, contact_email, status, created_at
        FROM organizations
        WHERE name ILIKE ${searchPattern} OR contact_email ILIKE ${searchPattern} OR tax_id ILIKE ${searchPattern}
        LIMIT 5
      `,
      sql`
        SELECT s.id, s.name, s.email, s.role, s.status, o.name as org_name
        FROM staff s
        LEFT JOIN organizations o ON o.id = s.organization_id
        WHERE s.name ILIKE ${searchPattern} OR s.email ILIKE ${searchPattern} OR s.phone ILIKE ${searchPattern}
        LIMIT 5
      `,
      sql`
        SELECT d.id, d.device_name, d.device_type, d.status, o.name as org_name
        FROM devices d
        LEFT JOIN organizations o ON o.id = d.organization_id
        WHERE d.device_name ILIKE ${searchPattern} OR d.device_token ILIKE ${searchPattern}
        LIMIT 5
      `,
      sql`
        SELECT o.id, o.order_number, o.total, o.payment_status, org.name as org_name, o.created_at
        FROM orders o
        LEFT JOIN organizations org ON org.id = o.organization_id
        WHERE o.order_number ILIKE ${searchPattern} OR o.id::text ILIKE ${searchPattern}
        LIMIT 5
      `,
      sql`
        SELECT sa.id, sa.title, sa.severity, sa.status, sa.created_at
        FROM security_alerts sa
        WHERE sa.title ILIKE ${searchPattern} OR sa.details::text ILIKE ${searchPattern}
        LIMIT 5
      `,
      sql`
        SELECT sc.id, sc.subject, sc.status, sc.priority, org.name as org_name, sc.created_at
        FROM support_conversations sc
        LEFT JOIN organizations org ON org.id = sc.organization_id
        WHERE sc.subject ILIKE ${searchPattern}
        LIMIT 5
      `,
    ]);

    return NextResponse.json({
      data: {
        restaurants,
        users,
        devices,
        orders,
        alerts,
        support,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Search failed' }, { status: 500 });
  }
}
