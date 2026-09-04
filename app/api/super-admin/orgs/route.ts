import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/neon-server';
import { extractTenantContext } from '@/lib/tenant';
import { generateSlug } from '@/lib/tenant';
import { hashPassword } from '@/lib/auth';
import { generateId } from '@/lib/id';

export async function GET(request: NextRequest) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx || ctx.role !== 'super_admin') {
      return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
    }

    const sql = getSql();
    const orgs = await sql`
      SELECT o.*,
        (SELECT COUNT(*) FROM branches WHERE organization_id = o.id) as branch_count,
        (SELECT COUNT(*) FROM staff WHERE organization_id = o.id) as staff_count,
        ts.status as subscription_status,
        sp.display_name as plan_name
      FROM organizations o
      LEFT JOIN tenant_subscriptions ts ON ts.organization_id = o.id AND ts.status = 'active'
      LEFT JOIN subscription_plans sp ON ts.plan_id = sp.id
      ORDER BY o.created_at DESC
    `;

    return NextResponse.json({ data: orgs });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = extractTenantContext(request);
    if (!ctx || ctx.role !== 'super_admin') {
      return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name, contactEmail, contactPhone, taxId, address, planId,
      branchName, branchLocation, managerName, managerEmail, managerPhone,
      adminName, adminEmail, adminPassword,
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'Organization name is required' }, { status: 400 });
    }

    const sql = getSql();
    const orgId = generateId();
    const slug = generateSlug(name);

    // Create organization
    await sql`
      INSERT INTO organizations (id, name, slug, contact_email, contact_phone, tax_id, address, status)
      VALUES (${orgId}, ${name}, ${slug}, ${contactEmail || null}, ${contactPhone || null}, ${taxId || null}, ${address || null}, 'active')
    `;

    // Assign subscription plan
    let selectedPlanId = planId;
    if (!selectedPlanId) {
      const dbPlans = await sql`SELECT id FROM subscription_plans WHERE is_active = true ORDER BY monthly_price_ugx ASC LIMIT 1`;
      selectedPlanId = dbPlans[0]?.id || null;
    }
    if (selectedPlanId) {
      await sql`
        INSERT INTO tenant_subscriptions (organization_id, plan_id, status, started_at, current_period_start, current_period_end, trial_ends_at)
        VALUES (${orgId}, ${selectedPlanId}, 'active', NOW(), NOW(), NOW() + INTERVAL '30 days', NOW() + INTERVAL '14 days')
      `;
    }

    // Always create a default "Main Branch"
    const mainBranchId = generateId();
    const defaultBranchName = branchName || 'Main Branch';
    await sql`
      INSERT INTO branches (id, name, location, manager, phone, email, tax_id, organization_id, status)
      VALUES (${mainBranchId}, ${defaultBranchName}, ${branchLocation || address || 'Kampala, Uganda'}, ${adminName || managerName || 'Branch Manager'}, ${contactPhone || managerPhone || '+256 700 000 000'}, ${contactEmail || managerEmail || ''}, ${taxId || 'URA-000000'}, ${orgId}, 'active')
    `;

    // Create default categories scoped to this organization
    const categories = [
      { name: 'Food', icon: 'UtensilsCrossed' },
      { name: 'Drinks', icon: 'Wine' },
      { name: 'Desserts', icon: 'Cake' },
      { name: 'Snacks', icon: 'Cookie' },
      { name: 'Combos', icon: 'Package' },
    ];
    for (const cat of categories) {
      await sql`
        INSERT INTO categories (id, name, icon, organization_id)
        VALUES (${generateId()}, ${cat.name}, ${cat.icon}, ${orgId})
        ON CONFLICT DO NOTHING
      `;
    }

    // Create Restaurant Admin account (primary user for this restaurant)
    if (adminEmail && adminPassword) {
      const passwordHash = await hashPassword(adminPassword);
      const staffId = generateId();
      await sql`
        INSERT INTO staff (id, name, email, role, branch, assigned_branch_id, organization_id, status, password_hash, password_argon2)
        VALUES (${staffId}, ${adminName || name + ' Admin'}, ${adminEmail.toLowerCase()}, 'restaurant_admin', ${defaultBranchName}, ${mainBranchId}, ${orgId}, 'active', ${adminPassword}, ${passwordHash})
      `;
    }

    // Also create Branch Manager account if different from admin
    if (managerEmail && managerName && managerEmail.toLowerCase() !== (adminEmail || '').toLowerCase()) {
      const tempPassword = Math.random().toString(36).substring(2, 10) + 'A1!';
      const passwordHash = await hashPassword(tempPassword);
      const staffId = generateId();
      await sql`
        INSERT INTO staff (id, name, email, role, branch, assigned_branch_id, organization_id, status, password_hash, password_argon2)
        VALUES (${staffId}, ${managerName}, ${managerEmail.toLowerCase()}, 'branch_manager', ${defaultBranchName}, ${mainBranchId}, ${orgId}, 'active', ${tempPassword}, ${passwordHash})
      `;
    }

    return NextResponse.json({
      data: {
        organization: { id: orgId, name, slug },
        branch: { id: mainBranchId, name: defaultBranchName },
        admin: adminEmail ? { email: adminEmail.toLowerCase(), role: 'restaurant_admin' } : null,
        message: 'Organization created with default branch, categories, and admin account',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
