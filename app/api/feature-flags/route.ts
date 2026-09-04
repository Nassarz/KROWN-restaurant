import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { getSql, queryWithRetry } from '@/lib/neon-server';

export async function GET(request: NextRequest) {
  try {
    const ctx = extractTenantContext(request);

    const sql = getSql();

    let rows;
    if (ctx) {
      rows = await queryWithRetry(() => sql`
        SELECT * FROM feature_flags WHERE enabled = TRUE
        AND (scope = 'global' OR (scope = 'organization' AND allowed_orgs @> ${JSON.stringify([ctx.organizationId])}::jsonb))
        ORDER BY key ASC
      `);
    } else {
      rows = await queryWithRetry(() => sql`
        SELECT * FROM feature_flags WHERE enabled = TRUE AND scope = 'global' ORDER BY key ASC
      `);
    }

    return NextResponse.json({ data: rows });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e.message || 'Internal server error' }, { status: 500 });
  }
}
