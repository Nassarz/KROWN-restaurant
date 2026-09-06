import { NextRequest, NextResponse } from 'next/server';
import { extractVerifiedTenantContext } from '@/lib/tenant';
import { getPersonalCreditHistory, recordPersonalCreditPayment } from '@/lib/services/personal-credit.service';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id:string }> }) {
  try {
    const ctx = await extractVerifiedTenantContext(request);
    if (!ctx) return NextResponse.json({ data:null, error:'Unauthorized' }, { status:401 });
    const { id } = await params;
    const data = await getPersonalCreditHistory(ctx, id);
    if (!data) return NextResponse.json({ data:null, error:'Credit profile not found' }, { status:404 });
    return NextResponse.json({ data });
  } catch (e:any) {
    return NextResponse.json({ data:null, error:e?.message || 'Unable to load credit history' }, { status:400 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id:string }> }) {
  try {
    const ctx = await extractVerifiedTenantContext(request);
    if (!ctx) return NextResponse.json({ data:null, error:'Unauthorized' }, { status:401 });
    const { id } = await params;
    const body = await request.json();
    if (body.action !== 'payment') return NextResponse.json({ data:null, error:'Unsupported credit action' }, { status:400 });
    const data = await recordPersonalCreditPayment(ctx, id, body.amountUgx, body.description);
    return NextResponse.json({ data });
  } catch (e:any) {
    const message = e?.message || 'Unable to update credit';
    const status = /restricted|insufficient/i.test(message) ? 403 : 400;
    return NextResponse.json({ data:null, error:message }, { status });
  }
}
