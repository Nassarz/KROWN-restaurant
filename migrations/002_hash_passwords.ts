// KROWN POS — Password Hash Migration Script
// Migrates plaintext passwords and PINs to Argon2id hashes
// Run: npx tsx migrations/002_hash_passwords.ts

import argon2 from 'argon2';
import { neon } from '@neondatabase/serverless';
import * as readline from 'readline';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

interface StaffRow {
  id: string;
  email: string;
  name: string;
  password_hash: string | null;
  pin_code: string | null;
  password_argon2: string | null;
  pin_argon2: string | null;
}

async function migratePasswords() {
  console.log('=== KROWN POS — Password Migration ===\n');

  // Fetch all staff with plaintext passwords or PINs
  const staff = await sql`
    SELECT id, email, name, password_hash, pin_code, password_argon2, pin_argon2
    FROM staff
    WHERE (password_hash IS NOT NULL AND password_argon2 IS NULL)
       OR (pin_code IS NOT NULL AND pin_argon2 IS NULL)
  ` as StaffRow[];

  console.log(`Found ${staff.length} staff members to migrate\n`);

  if (staff.length === 0) {
    console.log('Nothing to migrate. Exiting.');
    return;
  }

  let migrated = 0;
  let failed = 0;

  for (const s of staff) {
    try {
      const updates: string[] = [];
      const params: any[] = [];

      // Migrate password
      if (s.password_hash && !s.password_argon2) {
        const hash = await argon2.hash(s.password_hash);
        updates.push('password_argon2 = $' + (params.length + 1));
        params.push(hash);
      }

      // Migrate PIN
      if (s.pin_code && !s.pin_argon2) {
        const hash = await argon2.hash(s.pin_code);
        updates.push('pin_argon2 = $' + (params.length + 1));
        params.push(hash);
      }

      if (updates.length > 0) {
        params.push(s.id);
        await sql(`UPDATE staff SET ${updates.join(', ')} WHERE id = $${params.length}`, params);
        console.log(`✓ Migrated: ${s.name} (${s.email})`);
        migrated++;
      }
    } catch (err) {
      console.error(`✗ Failed: ${s.name} (${s.email}) — ${err}`);
      failed++;
    }
  }

  console.log(`\n=== Migration Complete ===`);
  console.log(`Migrated: ${migrated}`);
  console.log(`Failed: ${failed}`);

  if (migrated > 0) {
    console.log('\nNext steps:');
    console.log('1. Verify hashes in database');
    console.log('2. Run: ALTER TABLE staff DROP COLUMN password_hash, DROP COLUMN pin_code');
    console.log('3. Rename columns: ALTER TABLE staff RENAME COLUMN password_argon2 TO password_hash');
    console.log('4. Rename columns: ALTER TABLE staff RENAME COLUMN pin_argon2 TO pin_hash');
  }
}

migratePasswords().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
