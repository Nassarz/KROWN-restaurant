import { NextRequest, NextResponse } from 'next/server';
import { extractTenantContext } from '@/lib/tenant';
import { getSql } from '@/lib/neon-server';

export async function GET(request: NextRequest) {
  const ctx = extractTenantContext(request);
  if (!ctx || ctx.role !== 'super_admin') {
    return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
  }

  const sql = getSql();

  try {
    const start = Date.now();
    await sql`SELECT 1`;
    const latencyMs = Date.now() - start;

    const [dbSize, activeConns, tableStats, recentErrors] = await Promise.all([
      sql`SELECT pg_database_size(current_database()) as size`,
      sql`SELECT COUNT(*) as count FROM pg_stat_activity WHERE state = 'active'`,
      sql`SELECT
        schemaname,
        relname as table_name,
        n_live_tup as row_count,
        pg_size_pretty(pg_total_relation_size(relid)) as total_size
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(relid) DESC
      LIMIT 25`,
      sql`SELECT
        action,
        user_email as actor,
        details,
        created_at
      FROM audit_logs
      WHERE result = 'failure'
        AND created_at > NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
      LIMIT 20`,
    ]);

    return NextResponse.json({
      data: {
        database: {
          status: 'ok',
          latencyMs,
          sizeBytes: Number(dbSize[0]?.size ?? 0),
          sizeFormatted: `${(Number(dbSize[0]?.size ?? 0) / 1024 / 1024).toFixed(2)} MB`,
          activeConnections: Number(activeConns[0]?.count ?? 0),
        },
        tables: tableStats,
        recentErrors,
        server: {
          uptime: Math.floor(process.uptime()),
          memory: process.memoryUsage(),
          nodeVersion: process.version,
          platform: process.platform,
        },
        timestamp: new Date().toISOString(),
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch health' }, { status: 500 });
  }
}
