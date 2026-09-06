import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/neon-server';
import { extractTenantContext } from '@/lib/tenant';
import { hashPassword } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx || ctx.role !== 'super_admin') {
      return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
    }

    const sql = getSql();
    const orgs = await sql`
      SELECT o.*,
        (SELECT COUNT(*)::int FROM branches WHERE organization_id = o.id) as branch_count,
        (SELECT COUNT(*)::int FROM staff WHERE organization_id = o.id) as staff_count,
        NULL::text as subscription_status,
        'Unlimited'::text as plan_name
      FROM organizations o
      ORDER BY o.created_at DESC
    `;

    return NextResponse.json({ data: orgs });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to load restaurants' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx || ctx.role !== 'super_admin') {
      return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const name = String(body?.name || '').trim();
    const contactEmail = String(body?.contactEmail || '').trim();
    const contactPhone = String(body?.contactPhone || '').trim();
    const taxId = String(body?.taxId || '').trim();
    const address = String(body?.address || '').trim();
    const branchName = String(body?.branchName || '').trim();
    const branchLocation = String(body?.branchLocation || '').trim();
    const adminName = String(body?.adminName || '').trim();
    const adminEmail = String(body?.adminEmail || '').trim().toLowerCase();
    const adminPassword = String(body?.adminPassword || '');

    if (!name) {
      return NextResponse.json({ error: 'Restaurant name is required' }, { status: 400 });
    }
    if (!adminName) {
      return NextResponse.json({ error: 'Restaurant Admin name is required' }, { status: 400 });
    }
    if (!adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
      return NextResponse.json({ error: 'A valid Restaurant Admin email is required' }, { status: 400 });
    }
    if (adminPassword.length < 8) {
      return NextResponse.json({ error: 'Restaurant Admin password must be at least 8 characters' }, { status: 400 });
    }

    // Passwords never enter the database in plaintext. Only the Argon2id hash is stored.
    const passwordArgon2 = await hashPassword(adminPassword);
    const sql = getSql();

    const rows = await sql`
      SELECT onboard_restaurant(
        ${name},
        ${contactEmail || null},
        ${contactPhone || null},
        ${taxId || null},
        ${address || null},
        ${branchName || null},
        ${branchLocation || null},
        ${adminName},
        ${adminEmail},
        ${passwordArgon2}
      ) AS result
    `;

    const result = rows[0]?.result;
    if (!result) {
      throw new Error('Restaurant onboarding did not return a result');
    }

    return NextResponse.json({
      data: {
        ...result,
        message: 'Restaurant created with a secure Restaurant Admin account and unlimited access',
      },
    }, { status: 201 });
  } catch (e: any) {
    const message = e?.message || 'Failed to create restaurant';
    const status = /already in use|already exists|required|valid|at least 8/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
