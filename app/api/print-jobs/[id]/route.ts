import { NextRequest, NextResponse } from 'next/server';
import * as printService from '@/lib/services/print.service';
import { extractTenantContext } from '@/lib/tenant';
import { hasPermission } from '@/lib/rbac';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPermission(ctx.role, 'print_jobs:update')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { status, attempts, lastError, printedAt } = body;

    if (!status?.trim()) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    const printJob = await printService.updatePrintJobStatus(ctx, id, status.trim(), {
      attempts,
      lastError,
      printedAt: printedAt ? new Date(printedAt) : undefined,
    });

    if (!printJob) {
      return NextResponse.json({ error: 'Print job not found' }, { status: 404 });
    }

    return NextResponse.json({ data: printJob });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update print job' }, { status: 500 });
  }
}
