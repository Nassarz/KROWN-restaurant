import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { getSql } from '@/lib/neon-server';
import { logAuditEvent } from '@/lib/audit';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const ctx = extractTenantContext(request);
  if (!ctx || ctx.role !== 'super_admin') {
    return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
  }

  const sql = getSql();
  const userId = params.id;

  try {
    const [staffRows, sessions, trustedDevices, auditEvents] = await Promise.all([
      sql`
        SELECT s.id, s.name, s.email, s.phone, s.role, s.status, s.assigned_branch_id, s.organization_id,
               s.created_at, s.last_login_at, o.name as organization_name, b.name as branch_name
        FROM staff s
        LEFT JOIN organizations o ON o.id = s.organization_id
        LEFT JOIN branches b ON b.id = s.assigned_branch_id
        WHERE s.id = ${userId}
        LIMIT 1
      `,
      sql`
        SELECT id, device_info, ip_address, created_at, expires_at
        FROM staff_sessions
        WHERE staff_id = ${userId} AND expires_at > NOW()
        ORDER BY created_at DESC
      `,
      sql`
        SELECT id, device_id, device_name, trust_status, last_used_at, created_at
        FROM trusted_devices
        WHERE staff_id = ${userId}
        ORDER BY last_used_at DESC
      `,
      sql`
        SELECT id, action, details, result, created_at
        FROM audit_logs
        WHERE staff_id = ${userId} OR user_id = ${userId} OR user_email = (SELECT email FROM staff WHERE id = ${userId})
        ORDER BY created_at DESC
        LIMIT 20
      `,
    ]);

    if (staffRows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        user: staffRows[0],
        sessions,
        trustedDevices,
        auditEvents,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch user details' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const ctx = extractTenantContext(request);
  if (!ctx || ctx.role !== 'super_admin') {
    return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
  }

  const sql = getSql();
  const userId = params.id;

  try {
    const body = await request.json();
    const { name, email, phone, role, assignedBranchId } = body;

    const existingRows = await sql`SELECT * FROM staff WHERE id = ${userId} LIMIT 1`;
    if (existingRows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const existing = existingRows[0];

    const updatedRows = await sql`
      UPDATE staff
      SET 
        name = COALESCE(${name ?? null}, name),
        email = COALESCE(${email ? email.toLowerCase().trim() : null}, email),
        phone = COALESCE(${phone ?? null}, phone),
        role = COALESCE(${role ?? null}, role),
        assigned_branch_id = COALESCE(${assignedBranchId ?? null}, assigned_branch_id),
        updated_at = NOW()
      WHERE id = ${userId}
      RETURNING id, name, email, role, status, organization_id, assigned_branch_id
    `;

    await logAuditEvent({
      organizationId: existing.organization_id,
      userId: ctx.userId,
      userEmail: ctx.userId,
      actorRole: 'super_admin',
      action: 'SUPER_ADMIN_USER_UPDATE',
      targetType: 'staff',
      targetId: userId,
      details: { previous: { name: existing.name, role: existing.role }, updated: body },
    });

    return NextResponse.json({ data: updatedRows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update user' }, { status: 500 });
  }
}
