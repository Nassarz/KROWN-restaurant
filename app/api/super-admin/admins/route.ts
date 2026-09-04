import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { getSql } from '@/lib/neon-server';
import { hashPassword } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const ctx = extractTenantContext(request);
  if (!ctx || ctx.role !== 'super_admin') {
    return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
  }

  const sql = getSql();
  try {
    const admins = await sql`
      SELECT id, name, email, is_active, created_at, last_login_at
      FROM super_admins
      ORDER BY created_at DESC
    `;
    return NextResponse.json({ data: admins });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to list admins' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = extractTenantContext(request);
  if (!ctx || ctx.role !== 'super_admin') {
    return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const { name, email, password } = body;

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'name, email, and password are required' }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const sql = getSql();
  try {
    const existing = await sql`SELECT id FROM super_admins WHERE email = ${email.toLowerCase().trim()} LIMIT 1`;
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    }

    const password_hash = await hashPassword(password);
    const result = await sql`
      INSERT INTO super_admins (name, email, password_hash, is_active)
      VALUES (${name}, ${email.toLowerCase().trim()}, ${password_hash}, true)
      RETURNING id, name, email, is_active, created_at
    `;

    return NextResponse.json({ data: result[0] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create admin' }, { status: 500 });
  }
}
