import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function buildDbClient() {
  const key = (SUPABASE_SERVICE_ROLE_KEY && SUPABASE_SERVICE_ROLE_KEY.length > 20)
    ? SUPABASE_SERVICE_ROLE_KEY
    : SUPABASE_ANON_KEY;
  return createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const hasServiceRole = Boolean(
  SUPABASE_SERVICE_ROLE_KEY && SUPABASE_SERVICE_ROLE_KEY.length > 20
);

export async function POST(req: Request) {
  const dbClient = buildDbClient();

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing Authorization token' }, { status: 401 });
  }
  const checkClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userErr } = await checkClient.auth.getUser(authHeader.slice(7));
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: 'Unauthorized: invalid session' }, { status: 401 });
  }
  const sessionEmail = userData.user.email?.toLowerCase() || '';
  const { data: actor } = await dbClient
    .from('staff')
    .select('id, role, status')
    .eq('email', sessionEmail)
    .maybeSingle();
  if (!actor || actor.status !== 'active') {
    return NextResponse.json({ error: 'Unauthorized: staff record not found or inactive' }, { status: 403 });
  }
  if (actor.role !== 'Super Admin' && actor.role !== 'Branch Manager') {
    return NextResponse.json({ error: 'Forbidden: Super Admin or Branch Manager role required' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { action, staffId, password, pin, status, role } = body;

    if (!action || !staffId) {
      return NextResponse.json(
        { error: 'Both action and staffId are required' },
        { status: 400 }
      );
    }

    // ── DELETE ──────────────────────────────────────────────────────────────
    if (action === 'delete') {
      if (hasServiceRole) {
        await dbClient.auth.admin.deleteUser(staffId).catch((err: any) => {
          console.warn('[ManageStaff] Auth deleteUser note:', err?.message);
        });
      }
      const { error } = await dbClient.from('staff').delete().eq('id', staffId);
      if (error) {
        console.error('[ManageStaff] Delete error:', { staffId, error: error.message });
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: 'Staff member deleted successfully' });
    }

    // ── RESET PASSWORD ──────────────────────────────────────────────────────
    if (action === 'reset_password') {
      if (!password || password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
      }
      if (hasServiceRole) {
        const { error: authErr } = await dbClient.auth.admin.updateUserById(staffId, { password });
        if (authErr) {
          console.warn('[ManageStaff] Auth password reset error:', authErr.message);
        }
      }
      const updatePayload: Record<string, any> = {};
      if (pin) updatePayload.pin = pin;
      if (Object.keys(updatePayload).length > 0) {
        await dbClient.from('staff').update(updatePayload).eq('id', staffId);
      }
      return NextResponse.json({ success: true, message: 'Password and PIN updated successfully' });
    }

    // ── UPDATE STATUS (pause / ban / reactivate) ────────────────────────────
    if (action === 'update_status') {
      if (!status) {
        return NextResponse.json({ error: 'Status value is required' }, { status: 400 });
      }
      const { error } = await dbClient.from('staff').update({ status }).eq('id', staffId);
      if (error) {
        console.error('[ManageStaff] Status update error:', { staffId, status, error: error.message });
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: `Staff status updated to ${status}` });
    }

    // ── UPDATE ROLE ─────────────────────────────────────────────────────────
    if (action === 'update_role') {
      if (!role) {
        return NextResponse.json({ error: 'Role value is required' }, { status: 400 });
      }
      if (hasServiceRole) {
        await dbClient.auth.admin.updateUserById(staffId, {
          user_metadata: { role },
        }).catch((err: any) => console.warn('[ManageStaff] Auth role update note:', err?.message));
      }
      const { error } = await dbClient.from('staff').update({ role }).eq('id', staffId);
      if (error) {
        console.error('[ManageStaff] Role update error:', { staffId, role, error: error.message });
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: `Role updated to ${role}` });
    }

    // ── PROMOTE TO SUPER ADMIN ──────────────────────────────────────────────
    if (action === 'promote_admin') {
      if (hasServiceRole) {
        await dbClient.auth.admin.updateUserById(staffId, {
          user_metadata: { role: 'Super Admin', branch: 'Global HQ', assignedBranchId: null },
        }).catch((err: any) => console.warn('[ManageStaff] Auth promote note:', err?.message));
      }
      const { error } = await dbClient.from('staff').update({
        role: 'Super Admin',
        assigned_branch_id: null,
        branch: 'Global HQ',
      }).eq('id', staffId);
      if (error) {
        console.error('[ManageStaff] Promote admin error:', { staffId, error: error.message });
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: 'Staff promoted to Super Admin' });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('[ManageStaff] Unexpected server error:', err?.message || err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error managing staff member' },
      { status: 500 }
    );
  }
}
