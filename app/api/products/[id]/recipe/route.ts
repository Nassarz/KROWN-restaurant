import { NextRequest, NextResponse } from 'next/server';
import { getRecipe, saveRecipe } from '@/lib/services/product.service';
import { extractTenantContext } from '@/lib/tenant';
import { hasPermission } from '@/lib/rbac';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Missing tenant context' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const recipe = await getRecipe(ctx, id);
    return NextResponse.json({ data: recipe });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to get recipe' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = extractTenantContext(request);
  if (!ctx) {
    return NextResponse.json({ error: 'Missing tenant context' }, { status: 401 });
  }

  if (!hasPermission(ctx.role, 'products:recipe')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const recipe = await saveRecipe(ctx, id, body.ingredients);
    return NextResponse.json({ data: recipe });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save recipe' }, { status: 500 });
  }
}
