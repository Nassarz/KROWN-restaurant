import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { getSql } from '@/lib/neon-server';

const DEFAULT_SETTINGS = [
  { key: 'platform_name', value: { value: 'KROWN' }, description: 'Platform display name' },
  { key: 'support_email', value: { value: 'support@restaurant.com' }, description: 'Support contact email' },
  { key: 'maintenance_mode', value: { enabled: false }, description: 'Enable maintenance mode' },
  { key: 'max_login_attempts', value: { max: 5 }, description: 'Max login attempts before lockout' },
  { key: 'session_timeout_minutes', value: { minutes: 480 }, description: 'Session timeout in minutes' },
  { key: 'default_language', value: { language: 'en' }, description: 'Default platform language' },
];

export async function GET(request: NextRequest) {
  const ctx = extractTenantContext(request);
  if (!ctx || ctx.role !== 'super_admin') {
    return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
  }

  const sql = getSql();

  try {
    let settings = await sql`SELECT key, value, updated_at FROM platform_settings ORDER BY key`;

    if (settings.length === 0) {
      for (const s of DEFAULT_SETTINGS) {
        await sql`INSERT INTO platform_settings (key, value) VALUES (${s.key}, ${JSON.stringify(s.value)}::jsonb) ON CONFLICT (key) DO NOTHING`;
      }
      settings = await sql`SELECT key, value, updated_at FROM platform_settings ORDER BY key`;
    }

    return NextResponse.json({ data: settings });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const ctx = extractTenantContext(request);
  if (!ctx || ctx.role !== 'super_admin') {
    return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const { settings } = body;

  if (!Array.isArray(settings)) {
    return NextResponse.json({ error: 'settings must be an array' }, { status: 400 });
  }

  const sql = getSql();

  try {
    for (const s of settings) {
      if (!s.key) continue;
      await sql`INSERT INTO platform_settings (key, value, updated_by, updated_at)
        VALUES (${s.key}, ${JSON.stringify(s.value)}::jsonb, ${ctx.userId}, NOW())
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()`;
    }

    const updated = await sql`SELECT key, value, updated_at FROM platform_settings ORDER BY key`;
    return NextResponse.json({ data: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update settings' }, { status: 500 });
  }
}
