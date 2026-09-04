/**
 * Seed the first Super Admin user.
 * Run AFTER applying migrations: 001_add_tenant_isolation.sql
 *
 * Usage:
 *   SUPER_ADMIN_EMAIL=admin@krown.com SUPER_ADMIN_PASSWORD=yourpassword npx tsx migrations/003_seed_super_admin.ts
 */

import { neon } from '@neondatabase/serverless';
import argon2 from 'argon2';

const DATABASE_URL = process.env.DATABASE_URL || '';
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'admin@krown.com';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'changeme123';

async function main() {
  if (!DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const sql = neon(DATABASE_URL);

  // Check if super admin already exists
  const existing = await sql`SELECT id FROM super_admins WHERE email = ${SUPER_ADMIN_EMAIL} LIMIT 1`;
  if (existing.length > 0) {
    console.log(`Super admin ${SUPER_ADMIN_EMAIL} already exists (id: ${existing[0].id}). Skipping.`);
    return;
  }

  // Hash password with Argon2id
  const passwordHash = await argon2.hash(SUPER_ADMIN_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  // Generate ID
  const id = `sa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  await sql`
    INSERT INTO super_admins (id, email, password_hash, name, is_active, created_at)
    VALUES (${id}, ${SUPER_ADMIN_EMAIL}, ${passwordHash}, 'Super Admin', true, NOW())
  `;

  console.log(`✓ Super admin created: ${SUPER_ADMIN_EMAIL} (id: ${id})`);
  console.log(`  Password: ${SUPER_ADMIN_PASSWORD}`);
  console.log(`  ⚠ CHANGE THIS PASSWORD IN PRODUCTION`);
}

main().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
