// Offline Authentication Cache (SaaS Version)
// Uses PBKDF2 (Web Crypto API) for offline password verification.
// On online login, server returns Argon2id hash. We also derive a PBKDF2 hash
// for offline verification using the Web Crypto API (browser-compatible).

export interface OfflineAuthEntry {
  email: string;
  passwordHash: string;   // PBKDF2 hash for offline verification
  staff: any;             // full staff profile (id, name, email, role, branch, organizationId)
  organizationId: string;
  cachedAt: number;
}

const OFFLINE_AUTH_KEY = 'krown_offline_auth_cache';

const PBKDF2_ITERATIONS = 100000;

async function derivePBKDF2(password: string, salt: string): Promise<string> {
  try {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: new TextEncoder().encode(salt),
        iterations: PBKDF2_ITERATIONS,
      },
      keyMaterial,
      256
    );
    return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback: simple hash for non-secure contexts
    let h = 0;
    const s = `${salt}:${password}`;
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return 'fallback-' + (h >>> 0).toString(16);
  }
}

function readCache(): Record<string, OfflineAuthEntry> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_AUTH_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, OfflineAuthEntry>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(OFFLINE_AUTH_KEY, JSON.stringify(cache));
  } catch { /* storage full */ }
}

/**
 * Cache staff profile for offline use (called after successful online login).
 */
export async function cacheOfflineAuth(staff: any) {
  const email = (staff?.email || '').toLowerCase();
  if (!email) return;
  const cache = readCache();
  const existing = cache[email] || {};
  cache[email] = {
    email,
    passwordHash: existing.passwordHash || '',
    staff,
    organizationId: staff.organizationId || '',
    cachedAt: Date.now(),
  };
  writeCache(cache);
}

/**
 * Store PBKDF2 password hash for offline verification (called during online login).
 * The password is the one the user just typed — we derive a hash for offline use.
 */
export async function storeOfflinePasswordHash(email: string, password: string) {
  const cleanEmail = (email || '').toLowerCase();
  if (!cleanEmail) return;
  const cache = readCache();
  const existing = cache[cleanEmail] || { email: cleanEmail, staff: null, cachedAt: Date.now(), organizationId: '' };
  // Use email as salt (fixed per user — acceptable for offline verification)
  existing.passwordHash = await derivePBKDF2(password, cleanEmail);
  writeCache({ ...cache, [cleanEmail]: existing });
}

/**
 * Verify credentials offline using stored PBKDF2 hash.
 */
export async function verifyOfflineCredentials(email: string, password: string): Promise<OfflineAuthEntry | null> {
  const cleanEmail = (email || '').toLowerCase();
  const cache = readCache();
  const entry = cache[cleanEmail];
  if (!entry || !entry.passwordHash) return null;
  const hash = await derivePBKDF2(password, cleanEmail);
  if (hash !== entry.passwordHash) return null;
  return entry;
}

/**
 * Get cached staff profile for offline use.
 */
export function getCachedOfflineProfile(email: string): any | null {
  const cleanEmail = (email || '').toLowerCase();
  const cache = readCache();
  return cache[cleanEmail]?.staff || null;
}

/**
 * Get cached organization ID for offline use.
 */
export function getCachedOrganizationId(email: string): string | null {
  const cleanEmail = (email || '').toLowerCase();
  const cache = readCache();
  return cache[cleanEmail]?.organizationId || null;
}

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' ? !navigator.onLine : false;
}
