import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-supabase-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, staffId, password, pin, status, role, assignedBranchId, branchName } = body;

    if (!action || !staffId) {
      return NextResponse.json({ error: 'Action and staffId are required' }, { status: 400 });
    }

    const hasServiceRole = Boolean(
      SUPABASE_SERVICE_ROLE_KEY &&
      SUPABASE_SERVICE_ROLE_KEY !== SUPABASE_ANON_KEY &&
      SUPABASE_SERVICE_ROLE_KEY.trim().length > 10
    );

    const clientKey = hasServiceRole ? SUPABASE_SERVICE_ROLE_KEY : SUPABASE_ANON_KEY;
    const dbClient = createClient(SUPABASE_URL, clientKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    if (action === 'delete') {
      if (hasServiceRole) {
        try {
          await dbClient.auth.admin.deleteUser(staffId);
        } catch (err) {
          console.warn('[ManageStaff API] Auth delete note:', err);
        }
      }
      const { error: dbErr } = await dbClient.from('staff').delete().eq('id', staffId);
      if (dbErr) {
        return NextResponse.json({ error: dbErr.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: 'Staff member deleted' });
    }

    if (action === 'reset_password') {
      if (hasServiceRole && password) {
        try {
          await dbClient.auth.admin.updateUserById(staffId, { password });
        } catch (err) {
          console.warn('[ManageStaff API] Auth update password note:', err);
        }
      }
      const updateData: any = {};
      if (password) updateData.password = password;
      if (pin) updateData.pin = pin;

      const { error: dbErr } = await dbClient.from('staff').update(updateData).eq('id', staffId);
      if (dbErr) {
        return NextResponse.json({ error: dbErr.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: 'Staff password and PIN updated successfully' });
    }

    if (action === 'update_status') {
      const { error: dbErr } = await dbClient.from('staff').update({ status }).eq('id', staffId);
      if (dbErr) {
        return NextResponse.json({ error: dbErr.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: `Staff status updated to ${status}` });
    }

    if (action === 'update_role') {
      if (!role) {
        return NextResponse.json({ error: 'Role is required' }, { status: 400 });
      }
      if (hasServiceRole) {
        try {
          await dbClient.auth.admin.updateUserById(staffId, {
            user_metadata: { role }
          });
        } catch (err) {
          console.warn('[ManageStaff API] Auth update role note:', err);
        }
      }
      const { error: dbErr } = await dbClient.from('staff').update({ role }).eq('id', staffId);
      if (dbErr) {
        return NextResponse.json({ error: dbErr.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: `Staff role updated to ${role}` });
    }

    if (action === 'promote_admin') {
      const updateData = {
        role: 'Super Admin',
        assigned_branch_id: null,
        branch: 'Global HQ'
      };
      if (hasServiceRole) {
        try {
          await dbClient.auth.admin.updateUserById(staffId, {
            user_metadata: { role: 'Super Admin', branch: 'Global HQ', assignedBranchId: null }
          });
        } catch (err) {
          console.warn('[ManageStaff API] Auth admin promotion note:', err);
        }
      }
      const { error: dbErr } = await dbClient.from('staff').update(updateData).eq('id', staffId);
      if (dbErr) {
        return NextResponse.json({ error: dbErr.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: 'Staff promoted to Super Admin' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('[ManageStaff API] Server error:', err);
    return NextResponse.json({ error: err?.message || 'Server error managing staff member' }, { status: 500 });
  }
}
