import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Always use the service role key for server-side DB writes (bypasses RLS cleanly).
// If service role key is not configured, fall back to anon key — the RLS policy
// "staff_allow_full_access" ensures anon writes succeed for this POS system.
function buildDbClient() {
  const key = (SUPABASE_SERVICE_ROLE_KEY && SUPABASE_SERVICE_ROLE_KEY.length > 20)
    ? SUPABASE_SERVICE_ROLE_KEY
    : SUPABASE_ANON_KEY;
  return createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: Request) {
  const dbClient = buildDbClient();
  const hasServiceRole = Boolean(
    SUPABASE_SERVICE_ROLE_KEY && SUPABASE_SERVICE_ROLE_KEY.length > 20
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
    const {
      name,
      email,
      password: inputPassword,
      pin: inputPin,
      phone,
      idType,
      idNumber,
      role = 'Senior Waiter',
      branch = 'FAZE 3',
      assignedBranchId,
      avatar,
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Staff name is required' }, { status: 400 });
    }
    if (!email?.trim()) {
      return NextResponse.json({ error: 'Staff email is required' }, { status: 400 });
    }

    const password = (inputPassword || 'Staff@123').trim();
    const pin = (inputPin || '1234').trim();
    const cleanEmail = email.trim().toLowerCase();

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    // ── Step 1: Create Auth user ────────────────────────────────────────────
    let userId = '';
    let isNewAuthUser = false;

    if (hasServiceRole) {
      const { data: authData, error: createError } = await dbClient.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: true,
        user_metadata: { name, role, branch, assignedBranchId, pin },
      });

      if (authData?.user) {
        userId = authData.user.id;
        isNewAuthUser = true;
      } else if (createError) {
        const msg = createError.message.toLowerCase();
        if (msg.includes('already registered') || msg.includes('already been registered')) {
          // Existing auth user — fetch their ID
          const { data: listData } = await dbClient.auth.admin.listUsers({ perPage: 1000 });
          const existing = listData?.users?.find(u => u.email?.toLowerCase() === cleanEmail);
          if (existing) {
            userId = existing.id;
            await dbClient.auth.admin.updateUserById(userId, {
              password,
              user_metadata: { name, role, branch, assignedBranchId, pin },
            });
          }
        } else {
          return NextResponse.json({
            error: `Auth creation failed: ${createError.message}`,
            code: createError.status,
          }, { status: 400 });
        }
      }
    } else {
      // No service role: signUp with anon client
      const { data: signUpData, error: signUpErr } = await dbClient.auth.signUp({
        email: cleanEmail,
        password,
        options: { data: { name, role, branch, assignedBranchId, pin } },
      });

      if (signUpData?.user) {
        userId = signUpData.user.id;
        isNewAuthUser = true;
      } else if (signUpErr && !signUpErr.message.toLowerCase().includes('already registered')) {
        console.warn('[CreateStaff] anon signUp warning:', signUpErr.message);
      }
    }

    // Fallback deterministic ID if no Auth user returned yet
    if (!userId) {
      userId = `staff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    // ── Step 2: Build the staff record ─────────────────────────────────────
    const staffAvatar =
      avatar ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=f97316&color=fff&bold=true&size=200`;

    const staffRecord = {
      id: userId,
      name: name.trim(),
      email: cleanEmail,
      role,
      branch,
      assigned_branch_id: assignedBranchId || null,
      phone: phone?.trim() || null,
      id_type: idType || null,
      id_number: idNumber?.trim() || null,
      pin,
      status: 'active',
      avatar: staffAvatar,
      created_at: Date.now(),
    };

    // ── Step 3: Upsert staff record ─────────────────────────────────────────
    const { data: staffData, error: dbError } = await dbClient
      .from('staff')
      .upsert(staffRecord, { onConflict: 'id' })
      .select('id, name, email, role, branch, assigned_branch_id, status, avatar, phone, id_type, id_number')
      .single();

    if (dbError) {
      console.error('[CreateStaff] Database upsert error:', {
        table: 'staff',
        errorCode: dbError.code,
        errorMessage: dbError.message,
        errorHint: dbError.hint,
        payload: { id: userId, email: cleanEmail, role },
        hasServiceRole,
      });
      // Roll back auth user if we just created them
      if (isNewAuthUser && hasServiceRole) {
        await dbClient.auth.admin.deleteUser(userId).catch(() => {});
      }
      return NextResponse.json({
        error: `Database record creation failed: ${dbError.message}`,
        code: dbError.code,
        hint: dbError.hint,
      }, { status: 500 });
    }

    const finalStaff = staffData || staffRecord;

    return NextResponse.json({
      success: true,
      message: `${name} enrolled successfully as ${role}`,
      temporaryCredentials: {
        email: cleanEmail,
        password,
        pin,
      },
      staff: {
        id: finalStaff.id,
        name: finalStaff.name,
        email: finalStaff.email,
        role: finalStaff.role,
        branch: finalStaff.branch,
        assignedBranchId: finalStaff.assigned_branch_id,
        status: finalStaff.status,
        avatar: finalStaff.avatar,
        phone: finalStaff.phone,
        idType: finalStaff.id_type,
        idNumber: finalStaff.id_number,
      },
    });
  } catch (err: any) {
    console.error('[CreateStaff] Unexpected server error:', err?.message || err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error creating staff member' },
      { status: 500 }
    );
  }
}
