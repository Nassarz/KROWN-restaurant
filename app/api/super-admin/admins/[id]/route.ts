import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { getSql } from '@/lib/neon-server';
import { hashPassword } from '@/lib/auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = extractTenantContext(request);
  if (!ctx || ctx.role !== 'super_admin') {
    return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
  }

  const sql = getSql();
  try {
    const admins = await sql`SELECT id, name, email, is_active, created_at, last_login_at FROM super_admins WHERE id = ${id}`;
    if (admins.length === 0) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }
    return NextResponse.json({ data: admins[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to get admin' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = extractTenantContext(request);
  if (!ctx || ctx.role !== 'super_admin') {
    return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const { name, email, is_active, password } = body;

  const sql = getSql();
  try {
    const existing = await sql`SELECT id FROM super_admins WHERE id = ${id}`;
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    if (email) {
      const emailCheck = await sql`SELECT id FROM super_admins WHERE email = ${email.toLowerCase().trim()} AND id != ${id}`;
      if (emailCheck.length > 0) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
      }
    }

    if (password) {
      if (password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
      }
      const hash = await hashPassword(password);
      await sql`UPDATE super_admins SET password_hash = ${hash} WHERE id = ${id}`;
    }

    await sql`UPDATE super_admins SET
      name = COALESCE(${name}, name),
      email = COALESCE(${email}, email),
      is_active = COALESCE(${is_active}, is_active)
    WHERE id = ${id}`;

    const updated = await sql`SELECT id, name, email, is_active, created_at FROM super_admins WHERE id = ${id}`;
    return NextResponse.json({ data: updated[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update admin' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = extractTenantContext(request);
  if (!ctx || ctx.role !== 'super_admin') {
    return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
  }

  const sql = getSql();
  try {
    const existing = await sql`SELECT id FROM super_admins WHERE id = ${id}`;
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    await sql`UPDATE super_admins SET is_active = false WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete admin' }, { status: 500 });
  }
}
