import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pvtyioofmwucykctbohc.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(req: Request) {
  try {
    const hasServiceRole = Boolean(
      SUPABASE_SERVICE_ROLE_KEY &&
      SUPABASE_SERVICE_ROLE_KEY !== SUPABASE_ANON_KEY &&
      SUPABASE_SERVICE_ROLE_KEY.trim().length > 10
    );

    // ── Authorization: only authenticated Super Admin / Branch Manager staff ──
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
    const { data: actor } = await checkClient
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

    const clientKey = hasServiceRole ? SUPABASE_SERVICE_ROLE_KEY : SUPABASE_ANON_KEY;
    const dbClient = createClient(SUPABASE_URL, clientKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    let authUsers: any[] = [];
    if (hasServiceRole) {
      try {
        const { data: listData } = await dbClient.auth.admin.listUsers({ perPage: 1000 });
        if (listData?.users) {
          authUsers = listData.users;
        }
      } catch (e) {
        console.warn('[SyncStaff API] auth.admin.listUsers notice:', e);
      }
    }

    // Fetch existing staff in DB
    const { data: dbStaff } = await dbClient
      .from('staff')
      .select('id, name, email, role, branch, assigned_branch_id, status, avatar, phone, id_type, id_number');

    if (hasServiceRole && authUsers.length > 0) {
      const existingMap = new Map<string, any>();
      (dbStaff || []).forEach(s => {
        if (s.id) existingMap.set(s.id, s);
        if (s.email) existingMap.set(s.email.toLowerCase(), s);
      });

      for (const user of authUsers) {
        const email = user.email?.toLowerCase();
        if (!email) continue;

        const existing = existingMap.get(user.id) || existingMap.get(email);
        const meta = user.user_metadata || {};

        const staffRecord = {
          id: user.id,
          name: existing?.name || meta.name || meta.full_name || email.split('@')[0],
          email: email,
          role: existing?.role || meta.role || (email.includes('admin') || email.includes('nassarz') ? 'Super Admin' : 'Senior Waiter'),
          branch: existing?.branch || meta.branch || (email.includes('admin') ? 'Global HQ' : 'FAZE 3'),
          status: existing?.status || 'active',
          avatar: existing?.avatar || meta.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(existing?.name || meta.name || email.split('@')[0])}&background=f97316&color=fff&bold=true&size=200`,
        };

        await dbClient.from('staff').upsert(staffRecord, { onConflict: 'id' });
      }
    }

    // Return current staff list from public.staff table
    const { data: allStaff } = await dbClient
      .from('staff')
      .select('id, name, email, role, branch, assigned_branch_id, status, avatar, phone, id_type, id_number')
      .order('created_at', { ascending: false });

    return NextResponse.json({
      success: true,
      message: `Staff synced successfully. Total staff members: ${(allStaff || dbStaff || []).length}`,
      staff: (allStaff || dbStaff || []).map(row => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role || 'Senior Waiter',
        branch: row.branch || 'Global HQ',
        assignedBranchId: row.assigned_branch_id || null,
        status: row.status || 'active',
        avatar: row.avatar,
        phone: row.phone,
        idType: row.id_type,
        idNumber: row.id_number,
      }))
    });
  } catch (err: any) {
    console.error('[SyncStaff API] Error:', err);
    return NextResponse.json({ error: err?.message || 'Server error syncing staff' }, { status: 500 });
  }
}
