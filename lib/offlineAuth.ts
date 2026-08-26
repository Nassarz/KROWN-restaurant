// Offline Authentication Cache
// On first successful login we cache a SHA-256 hash of the credentials plus the
// staff profile. During an internet blackout the app can verify the same
// credentials locally and restore the full session without Supabase.

export interface OfflineAuthEntry {
  email: string;
  passwordHash: string;
  staff: any;              // full staff profile (id, name, email, role, branch...)
  cachedAt: number;
  lastSessionUser?: { uid: string; displayName: string; email: string; photoURL: string };
}

const OFFLINE_AUTH_KEY = 'krown_offline_auth_cache';

async function sha256(text: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback (non-secure context): simple hash so offline login still works
    let h = 0;
    for (let i = 0; i < text.length; i++) {
      h = ((h << 5) - h + text.charCodeAt(i)) | 0;
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

export async function cacheOfflineAuth(staff: any, sessionUser?: any) {
  const email = (staff?.email || '').toLowerCase();
  if (!email) return;
  const cache = readCache();
  const existing = cache[email] || {};
  cache[email] = {
    email,
    passwordHash: existing.passwordHash || '', // password only hashed on login
    staff,
    cachedAt: Date.now(),
    lastSessionUser: sessionUser || existing.lastSessionUser,
  };
  writeCache(cache);
}

export async function storeOfflinePasswordHash(email: string, password: string) {
  const cleanEmail = (email || '').toLowerCase();
  if (!cleanEmail) return;
  const cache = readCache();
  const existing = cache[cleanEmail] || { email: cleanEmail, staff: null, cachedAt: Date.now() };
  existing.passwordHash = await sha256(`${cleanEmail}:${password}`);
  writeCache({ ...cache, [cleanEmail]: existing });
}

export async function verifyOfflineCredentials(email: string, password: string): Promise<OfflineAuthEntry | null> {
  const cleanEmail = (email || '').toLowerCase();
  const cache = readCache();
  const entry = cache[cleanEmail];
  if (!entry || !entry.passwordHash) return null;
  const hash = await sha256(`${cleanEmail}:${password}`);
  if (hash !== entry.passwordHash) return null;
  return entry;
}

export function getCachedOfflineProfile(email: string): any | null {
  const cleanEmail = (email || '').toLowerCase();
  const cache = readCache();
  return cache[cleanEmail]?.staff || null;
}

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' ? !navigator.onLine : false;
}
