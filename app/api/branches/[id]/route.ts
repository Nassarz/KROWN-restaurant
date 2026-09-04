import { NextRequest, NextResponse } from 'next/server';
import * as branchService from '@/lib/services/branch.service';
import { extractTenantContext } from '@/lib/tenant';
import { hasPermission } from '@/lib/rbac';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPermission(ctx.role, 'branches:read')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const branch = await branchService.getBranch(ctx, id);
    if (!branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }
    return NextResponse.json({ data: branch });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to get branch' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPermission(ctx.role, 'branches:update')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const branch = await branchService.updateBranch(ctx, id, {
      name: body.name,
      location: body.location,
      city: body.city,
      manager: body.manager,
      phone: body.phone,
      email: body.email,
      tax_id: body.taxId,
      address: body.address,
      receipt_header_note: body.receiptHeaderNote,
      receipt_footer_note: body.receiptFooterNote,
      tables_count: body.tablesCount,
    });

    return NextResponse.json({ data: branch });
  } catch (error: any) {
    if (error.message === 'Branch not found') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: error.message || 'Failed to update branch' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPermission(ctx.role, 'branches:delete')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id } = await params;
    await branchService.deleteBranch(ctx, id);
    return NextResponse.json({ data: { success: true } });
  } catch (error: any) {
    if (error.message === 'Branch not found') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: error.message || 'Failed to delete branch' }, { status: 500 });
  }
}
