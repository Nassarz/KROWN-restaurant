// KROWN POS — Legacy Generic CRUD Route (SECURED)
// This route is kept for backward compatibility with the offline sync engine.
// It is READ-ONLY and requires full JWT authentication + tenant isolation.
// Write operations should use the new typed API routes (/api/products, /api/orders, etc.)

import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/neon-server';
import { extractTenantContext, setTenantContext } from '@/lib/tenant';

const ALLOWED_TABLES = new Set([
  'branches', 'products', 'ingredients', 'orders', 'staff', 'categories',
  'companies', 'company_staff', 'zones', 'expenses', 'audit_logs',
  'inventory_movements', 'product_ingredients', 'print_jobs', 'accounting_ledger',
]);

function validateTable(table: string): string {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`Invalid table name: ${table}`);
  }
  return table;
}

// GET — Read-only, tenant-filtered
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ data: [], error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { table: rawTable } = await params;
    const table = validateTable(rawTable);
    const sql = getSql();
    await setTenantContext(sql, ctx.organizationId);

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500);

    // All queries are tenant-filtered
    const rows = await sql(
      `SELECT * FROM ${table} WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [ctx.organizationId, limit]
    );

    return NextResponse.json({ data: rows });
  } catch (e: any) {
    return NextResponse.json({ data: [], error: e.message }, { status: 500 });
  }
}

// POST — Forbidden (use /api/products, /api/orders, etc.)
export async function POST() {
  return NextResponse.json(
    { error: 'Direct inserts are not allowed. Use /api/products, /api/orders, or other typed endpoints.' },
    { status: 403 }
  );
}

// PUT — Forbidden
export async function PUT() {
  return NextResponse.json(
    { error: 'Direct updates are not allowed. Use typed API endpoints.' },
    { status: 403 }
  );
}

// DELETE — Forbidden
export async function DELETE() {
  return NextResponse.json(
    { error: 'Direct deletes are not allowed. Use typed API endpoints.' },
    { status: 403 }
  );
}
