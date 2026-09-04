import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { getSql } from '@/lib/neon-server';
import { logAuditEvent } from '@/lib/audit';

export async function GET(request: NextRequest) {
  const ctx = extractTenantContext(request);
  if (!ctx || ctx.role !== 'super_admin') {
    return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
  }

  const sql = getSql();

  try {
    const rows = await sql`
      SELECT value FROM platform_settings WHERE key = 'notification_rules' LIMIT 1
    `;

    const defaultRules = [
      { id: 'failed_logins', name: 'Failed Login Threshold', event: 'failed_login', threshold: 5, enabled: true, severity: 'high', delivery: 'in_app' },
      { id: 'new_device', name: 'New Device Registration', event: 'new_device', threshold: 1, enabled: true, severity: 'medium', delivery: 'in_app' },
      { id: 'critical_alert', name: 'Critical Security Alert', event: 'security_alert', threshold: 1, enabled: true, severity: 'critical', delivery: 'in_app' },
      { id: 'payment_failure', name: 'Subscription Payment Failure', event: 'payment_failed', threshold: 1, enabled: true, severity: 'high', delivery: 'in_app' },
      { id: 'support_escalation', name: 'Support Escalation', event: 'support_escalated', threshold: 1, enabled: true, severity: 'medium', delivery: 'in_app' },
    ];

    const rules = rows.length > 0 && rows[0].value ? rows[0].value : defaultRules;

    return NextResponse.json({ data: rules });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch notification rules' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = extractTenantContext(request);
  if (!ctx || ctx.role !== 'super_admin') {
    return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
  }

  const sql = getSql();

  try {
    const { rules } = await request.json();
    if (!Array.isArray(rules)) {
      return NextResponse.json({ error: 'Rules must be an array' }, { status: 400 });
    }

    await sql`
      INSERT INTO platform_settings (key, value, updated_at)
      VALUES ('notification_rules', ${JSON.stringify(rules)}::jsonb, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;

    await logAuditEvent({
      userId: ctx.userId,
      userEmail: ctx.userId,
      actorRole: 'super_admin',
      action: 'SUPER_ADMIN_UPDATE_NOTIFICATION_RULES',
      details: { count: rules.length },
    });

    return NextResponse.json({ success: true, data: rules });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update notification rules' }, { status: 500 });
  }
}
