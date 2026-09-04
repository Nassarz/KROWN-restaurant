import { NextRequest, NextResponse } from 'next/server';
import * as expenseService from '@/lib/services/expense.service';
import { extractTenantContext } from '@/lib/tenant';
import { hasPermission } from '@/lib/rbac';

export async function GET(request: NextRequest) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPermission(ctx.role, 'expenses:read')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const branchId = request.nextUrl.searchParams.get('branchId') || undefined;
    const startDate = request.nextUrl.searchParams.get('startDate') || undefined;
    const endDate = request.nextUrl.searchParams.get('endDate') || undefined;

    const expenses = await expenseService.listExpenses(ctx, branchId, startDate, endDate);
    return NextResponse.json({ data: expenses });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to list expenses' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasPermission(ctx.role, 'expenses:create')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { title, category, amountUGX, notes, receiptUrl, branchId, branchName } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Expense title is required' }, { status: 400 });
    }
    if (!amountUGX || amountUGX <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than zero' }, { status: 400 });
    }

    const expense = await expenseService.createExpense(ctx, {
      title: title.trim(),
      category,
      amountUGX,
      notes,
      receiptUrl,
      branchId,
      branchName,
    });

    return NextResponse.json({ data: expense }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create expense' }, { status: 500 });
  }
}
