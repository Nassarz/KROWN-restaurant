import { NextResponse } from 'next/server';
import { getSql } from '@/lib/neon-server';

export async function GET() {
  const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

  // Check database connectivity
  try {
    const start = Date.now();
    const sql = getSql();
    await sql`SELECT 1`;
    checks.database = { status: 'ok', latencyMs: Date.now() - start };
  } catch (e: any) {
    checks.database = { status: 'error', error: e.message || 'Connection failed' };
  }

  const allOk = Object.values(checks).every(c => c.status === 'ok');

  return NextResponse.json({
    status: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  }, { status: allOk ? 200 : 503 });
}
