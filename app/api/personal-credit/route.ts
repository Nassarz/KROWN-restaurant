import { NextRequest, NextResponse } from 'next/server';
import { extractVerifiedTenantContext } from '@/lib/tenant';
import { createPersonalCreditProfile, listPersonalCreditProfiles } from '@/lib/services/personal-credit.service';

export async function GET(request: NextRequest) {
  try {
    const ctx = await extractVerifiedTenantContext(request);
    if (!ctx) return NextResponse.json({ data:null, error:'Unauthorized' }, { status:401 });
    const branchId = new URL(request.url).searchParams.get('branchId') || undefined;
    const data = await listPersonalCreditProfiles(ctx, branchId);
    return NextResponse.json({ data });
  } catch (e:any) {
    const status = /restricted|insufficient|branch is required|not found/i.test(e?.message || '') ? 403 : 400;
    return NextResponse.json({ data:null, error:e?.message || 'Unable to load personal credit' }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await extractVerifiedTenantContext(request);
    if (!ctx) return NextResponse.json({ data:null, error:'Unauthorized' }, { status:401 });
    const body = await request.json();
    const data = await createPersonalCreditProfile(ctx, {
      branchId: body.branchId,
      fullName: body.fullName,
      phone: body.phone,
      email: body.email,
      creditLimitUgx: body.creditLimitUgx,
      notes: body.notes,
    });
    return NextResponse.json({ data }, { status:201 });
  } catch (e:any) {
    const message = e?.message || 'Unable to create personal credit profile';
    const status = /restricted|insufficient|branch is required/i.test(message) ? 403 : 400;
    return NextResponse.json({ data:null, error:message }, { status });
  }
}
