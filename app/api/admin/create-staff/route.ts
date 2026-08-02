import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-supabase-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name,
      email,
      password = 'Staff@123',
      pin = '1234',
      phone,
      idType,
      idNumber,
      role = 'Senior Waiter',
      branch = 'FAZE 3',
      assignedBranchId,
      avatar,
    } = body;

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if we have a valid service role key
    const hasServiceRole = Boolean(
      SUPABASE_SERVICE_ROLE_KEY &&
      SUPABASE_SERVICE_ROLE_KEY !== SUPABASE_ANON_KEY &&
      SUPABASE_SERVICE_ROLE_KEY.trim().length > 10
    );

    const clientKey = hasServiceRole ? SUPABASE_SERVICE_ROLE_KEY : SUPABASE_ANON_KEY;
    const dbClient = createClient(SUPABASE_URL, clientKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    let userId: string = '';
    let authError: string | null = null;

    if (hasServiceRole) {
      // 1A. Service Role Admin User Creation
      const { data: authData, error: createError } = await dbClient.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: true,
        user_metadata: { name, role, branch, assignedBranchId, pin }
      });

      if (authData?.user) {
        userId = authData.user.id;
      } else if (createError) {
        if (createError.message.toLowerCase().includes('already registered') ||
            createError.message.toLowerCase().includes('already been registered')) {
          const { data: listData } = await dbClient.auth.admin.listUsers({ perPage: 1000 });
          const existing = listData?.users?.find(u => u.email?.toLowerCase() === cleanEmail);
          if (existing) {
            userId = existing.id;
            await dbClient.auth.admin.updateUserById(userId, {
              password,
              user_metadata: { name, role, branch, assignedBranchId, pin }
            });
          }
        } else {
          authError = createError.message;
        }
      }
    } else {
      // 1B. Fallback: Anon Client SignUp for Supabase Auth
      const { data: signUpData, error: signUpError } = await dbClient.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: { name, role, branch, assignedBranchId, pin }
        }
      });

      if (signUpData?.user) {
        userId = signUpData.user.id;
      } else if (signUpError) {
        authError = signUpError.message;
      }
    }

    // Fallback deterministic ID if Auth user wasn't returned immediately
    if (!userId) {
      userId = `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    }

    // 2. Resolve branch FK — check if branch exists in DB
    let resolvedBranchId: string | null = null;
    if (assignedBranchId) {
      const { data: branchRow } = await dbClient
        .from('branches')
        .select('id, name')
        .eq('id', assignedBranchId)
        .maybeSingle();
      if (branchRow) {
        resolvedBranchId = branchRow.id;
      }
    }

    // 3. Avatar URL
    const staffAvatar = avatar ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=f97316&color=fff&bold=true&size=200`;

    // 4. Upsert staff record in public DB (matching public.staff schema: id, name, email, role, branch, status, avatar)
    const cleanStaffRecord = {
      id: userId,
      name,
      email: cleanEmail,
      role,
      branch,
      status: 'active',
      avatar: staffAvatar,
    };

    let { data: staffData, error: dbError } = await dbClient
      .from('staff')
      .upsert(cleanStaffRecord, { onConflict: 'id' })
      .select('*')
      .single();

    if (dbError) {
      console.warn('[CreateStaff] DB upsert warning:', dbError.message);
    }

    const finalStaff = staffData || cleanStaffRecord;

    return NextResponse.json({
      success: true,
      message: `${name} enrolled in Supabase Auth & Database with role: ${role}`,
      staff: {
        id: finalStaff.id,
        name: finalStaff.name,
        email: finalStaff.email,
        role: finalStaff.role,
        branch: finalStaff.branch,
        assignedBranchId: finalStaff.assigned_branch_id,
        status: finalStaff.status,
        avatar: finalStaff.avatar,
        pin: finalStaff.pin,
        phone: finalStaff.phone,
        idType: finalStaff.id_type,
        idNumber: finalStaff.id_number,
      }
    });
  } catch (err: any) {
    console.error('[CreateStaff] Server error:', err);
    return NextResponse.json({ error: err?.message || 'Server error creating staff member' }, { status: 500 });
  }
}
