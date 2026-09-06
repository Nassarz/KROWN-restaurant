import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { getSql } from '@/lib/neon-server';
import { logAuditEvent } from '@/lib/audit';
import { hashPassword } from '@/lib/auth';

const ROLE_MAP: Record<string, string> = { admin: 'restaurant_admin', restaurant_admin: 'restaurant_admin', manager: 'manager', cashier: 'cashier', waiter: 'waiter', kitchen_staff: 'kitchen_staff' };

function auth(request: NextRequest) { const ctx = extractTenantContext(request); return ctx && ctx.role === 'super_admin' ? ctx : null; }

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params; const ctx = auth(request);
  if (!ctx) return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
  const sql = getSql(); const userId = params.id;
  try {
    const [staffRows, sessions, trustedDevices, auditEvents] = await Promise.all([
      sql`SELECT s.id,s.name,s.email,s.phone,s.role,s.status,s.assigned_branch_id,s.organization_id,s.created_at,s.last_login_at,o.name organization_name,b.name branch_name FROM staff s LEFT JOIN organizations o ON o.id=s.organization_id LEFT JOIN branches b ON b.id=s.assigned_branch_id WHERE s.id=${userId} LIMIT 1`,
      sql`SELECT id,device_info,ip_address,created_at,expires_at FROM staff_sessions WHERE staff_id=${userId} AND expires_at>NOW() ORDER BY created_at DESC`,
      sql`SELECT id,device_id,device_name,trust_status,last_used_at,created_at FROM trusted_devices WHERE staff_id=${userId} ORDER BY last_used_at DESC`,
      sql`SELECT id,action,details,result,created_at FROM audit_logs WHERE staff_id=${userId} OR user_id=${userId} OR user_email=(SELECT email FROM staff WHERE id=${userId}) ORDER BY created_at DESC LIMIT 20`,
    ]);
    if (!staffRows.length) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    return NextResponse.json({ data: { user: staffRows[0], sessions, trustedDevices, auditEvents } });
  } catch (error: any) { return NextResponse.json({ error: error.message || 'Failed to fetch user details' }, { status: 500 }); }
}

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params; const ctx = auth(request);
  if (!ctx) return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
  const sql = getSql(); const userId = params.id;
  try {
    const body = await request.json();
    const existingRows = await sql`SELECT * FROM staff WHERE id=${userId} LIMIT 1`;
    if (!existingRows.length) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const existing = existingRows[0] as any;
    const role = body.role ? (ROLE_MAP[String(body.role).toLowerCase()] || String(body.role).toLowerCase()) : null;
    const updatedRows = await sql`UPDATE staff SET name=COALESCE(${body.name ? String(body.name).trim() : null},name), email=COALESCE(${body.email ? String(body.email).trim().toLowerCase() : null},email), phone=COALESCE(${body.phone ?? null},phone), role=COALESCE(${role},role), assigned_branch_id=COALESCE(${body.assignedBranchId ?? null},assigned_branch_id), updated_at=NOW() WHERE id=${userId} RETURNING id,name,email,phone,role,status,organization_id,assigned_branch_id`;
    if (body.password) {
      if (String(body.password).length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
      await sql`UPDATE staff SET password_argon2=${await hashPassword(String(body.password))}, updated_at=NOW() WHERE id=${userId}`;
    }
    await logAuditEvent({ organizationId: existing.organization_id, userId: ctx.userId, userEmail: 'super_admin', actorRole: 'super_admin', action: 'SUPER_ADMIN_USER_UPDATE', targetType: 'staff', targetId: userId, details: { previous: { name: existing.name, role: existing.role, status: existing.status }, updated: body } });
    return NextResponse.json({ data: updatedRows[0] });
  } catch (error: any) { return NextResponse.json({ error: error.message || 'Failed to update user' }, { status: 500 }); }
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params; const ctx = auth(request);
  if (!ctx) return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
  const sql = getSql(); const userId = params.id;
  try {
    const body = await request.json();
    const action = String(body.action || '').toLowerCase();
    const statusMap: Record<string,string> = { suspend: 'suspended', suspended: 'suspended', ban: 'banned', banned: 'banned', activate: 'active', restore: 'active' };
    const nextStatus = statusMap[action];
    if (!nextStatus) return NextResponse.json({ error: 'Action must be suspend, ban, activate or restore' }, { status: 400 });
    const existing = await sql`SELECT id,name,email,role,status,organization_id FROM staff WHERE id=${userId} LIMIT 1`;
    if (!existing.length) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const previous = existing[0] as any;
    const updated = await sql`UPDATE staff SET status=${nextStatus}, updated_at=NOW() WHERE id=${userId} RETURNING id,name,email,role,status,organization_id,assigned_branch_id`;
    if (nextStatus !== 'active') await sql`UPDATE staff_sessions SET status='revoked', revoked_at=NOW(), revoked_reason=${nextStatus} WHERE staff_id=${userId} AND status='active'`;
    await logAuditEvent({ organizationId: previous.organization_id, userId: ctx.userId, userEmail: 'super_admin', actorRole: 'super_admin', action: `SUPER_ADMIN_USER_${nextStatus.toUpperCase()}`, targetType: 'staff', targetId: userId, details: { previousStatus: previous.status, nextStatus } });
    return NextResponse.json({ data: updated[0] });
  } catch (error: any) { return NextResponse.json({ error: error.message || 'Failed to change user status' }, { status: 500 }); }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params; const ctx = auth(request);
  if (!ctx) return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
  const sql = getSql(); const userId = params.id;
  try {
    const existing = await sql`SELECT id,name,email,role,status,organization_id FROM staff WHERE id=${userId} LIMIT 1`;
    if (!existing.length) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const user = existing[0] as any;
    if (user.role === 'super_admin') return NextResponse.json({ error: 'Platform Super Admin accounts cannot be deleted here' }, { status: 400 });
    // Soft-delete to preserve historical orders/audit records and prevent account reuse.
    const updated = await sql`UPDATE staff SET status='deleted', updated_at=NOW() WHERE id=${userId} RETURNING id,name,email,role,status,organization_id`;
    await sql`UPDATE staff_sessions SET status='revoked', revoked_at=NOW(), revoked_reason='deleted' WHERE staff_id=${userId} AND status='active'`;
    await logAuditEvent({ organizationId: user.organization_id, userId: ctx.userId, userEmail: 'super_admin', actorRole: 'super_admin', action: 'SUPER_ADMIN_USER_DELETE', targetType: 'staff', targetId: userId, details: { name: user.name, email: user.email, previousStatus: user.status } });
    return NextResponse.json({ data: updated[0] });
  } catch (error: any) { return NextResponse.json({ error: error.message || 'Failed to delete user' }, { status: 500 }); }
}
