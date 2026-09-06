import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/neon-server';
import { extractTenantContext, setTenantContext } from '@/lib/tenant';
import { hasPermission } from '@/lib/rbac';
import { assertBranchAccess } from '@/lib/access-control';

export async function GET(request: NextRequest) {
  const ctx = extractTenantContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(ctx.role, 'inventory:view') && !hasPermission(ctx.role, 'inventory:read')) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });

  try {
    const sql = getSql();
    await setTenantContext(sql, ctx.organizationId);
    const requestedBranch = request.nextUrl.searchParams.get('branchId');
    const branchId = requestedBranch || ctx.branchId;
    if (!branchId && !ctx.isSuperAdmin) return NextResponse.json({ error: 'Branch is required' }, { status: 400 });
    if (branchId) await assertBranchAccess(ctx, branchId);
    const parsedLimit = parseInt(request.nextUrl.searchParams.get('limit') || '100', 10);
    const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 100, 1), 500);
    const rows = branchId
      ? await sql`SELECT * FROM inventory_movements WHERE branch_id=${branchId} AND organization_id=${ctx.organizationId} ORDER BY created_at DESC LIMIT ${limit}`
      : await sql`SELECT * FROM inventory_movements WHERE organization_id=${ctx.organizationId} ORDER BY created_at DESC LIMIT ${limit}`;
    return NextResponse.json({ data: rows });
  } catch (error: any) {
    const message = error?.message || 'Failed to list inventory movements';
    return NextResponse.json({ error: message }, { status: message.startsWith('Forbidden') ? 403 : 500 });
  }
}
