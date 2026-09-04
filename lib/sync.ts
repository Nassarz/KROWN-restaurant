/**
 * KROWN ERP - Offline Sync Engine (SaaS Version)
 * 
 * Stores write operations in IndexedDB when offline.
 * Replays them through authenticated API endpoints when back online.
 */

import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'KrownPOS_OfflineDB';
const DB_VERSION = 3;
const QUEUE_STORE = 'op_queue';

export interface OfflineOp {
  id?: number;
  endpoint: string;    // e.g. '/api/products', '/api/orders'
  method: string;      // 'POST', 'PUT', 'DELETE'
  body: any;
  timestamp: number;
  retries: number;
}

let _db: IDBPDatabase | null = null;

export async function getDB(): Promise<IDBPDatabase> {
  if (_db) return _db;
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
      }
    }
  });
  return _db;
}

/**
 * Queue a write operation for offline replay.
 * endpoint: the API endpoint (e.g. '/api/products', '/api/orders/123/status')
 * method: HTTP method (POST, PUT, DELETE)
 * body: the request body
 */
export async function queueOfflineOp(op: { endpoint: string; method: string; body: any }) {
  try {
    const db = await getDB();
    await db.add(QUEUE_STORE, {
      ...op,
      timestamp: Date.now(),
      retries: 0,
    } as OfflineOp);
    console.log('[OfflineSync] Queued op:', op.method, op.endpoint);
    notifySyncListeners();

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      setTimeout(() => {
        syncOfflineQueue().catch(err => console.warn('[OfflineSync] Auto-flush error:', err));
      }, 150);
    }
  } catch (e) {
    console.warn('[OfflineSync] Failed to queue op:', e);
  }
}

export async function getPendingOpCount(): Promise<number> {
  try {
    const db = await getDB();
    return await db.count(QUEUE_STORE);
  } catch {
    return 0;
  }
}

/**
 * Replay all queued operations through authenticated endpoints.
 */
export async function syncOfflineQueue(): Promise<{ synced: number; failed: number }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  const db = await getDB();
  const ops: OfflineOp[] = await db.getAll(QUEUE_STORE);
  if (ops.length === 0) return { synced: 0, failed: 0 };

  console.log(`[OfflineSync] Replaying ${ops.length} queued operations...`);
  let synced = 0;
  let failed = 0;

  for (const op of ops) {
    try {
      const res = await fetch(op.endpoint, {
        method: op.method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(op.body),
      });

      if (res.ok) {
        await db.delete(QUEUE_STORE, op.id!);
        synced++;
        console.log(`[OfflineSync] ✓ Synced: ${op.method} ${op.endpoint}`);
      } else if (res.status === 401) {
        // Auth issue — clear the op (can't replay without login)
        await db.delete(QUEUE_STORE, op.id!);
        console.warn(`[OfflineSync] Cleared op (auth expired): ${op.method} ${op.endpoint}`);
        failed++;
      } else {
        const newRetries = (op.retries || 0) + 1;
        if (newRetries >= 3) {
          await db.delete(QUEUE_STORE, op.id!);
          console.warn(`[OfflineSync] Cleared op after ${newRetries} retries: ${op.method} ${op.endpoint}`);
        } else {
          await db.put(QUEUE_STORE, { ...op, retries: newRetries });
        }
        failed++;
      }
    } catch (e) {
      failed++;
      console.warn(`[OfflineSync] Error replaying:`, op.method, op.endpoint, e);
    }
  }

  notifySyncListeners();
  return { synced, failed };
}

/**
 * Clear ALL pending offline ops.
 */
export async function clearAllPendingOps(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear(QUEUE_STORE);
    notifySyncListeners();
    console.log('[OfflineSync] Cleared all pending ops');
  } catch (e) {
    console.warn('[OfflineSync] Error clearing queue:', e);
  }
}

export const forceSyncNow = syncOfflineQueue;

// ── Sync Event Listeners ──────────────────────────────────────────────────────
type SyncListener = (pendingCount: number) => void;
const syncListeners = new Set<SyncListener>();

export function onSyncStatusChange(fn: SyncListener) {
  syncListeners.add(fn);
  return () => syncListeners.delete(fn);
}

async function notifySyncListeners() {
  const count = await getPendingOpCount();
  syncListeners.forEach(fn => fn(count));
}

// ── Online/Offline Auto-Sync ──────────────────────────────────────────────────
let autoSyncInitialized = false;

export function initAutoSync() {
  if (autoSyncInitialized || typeof window === 'undefined') return;
  autoSyncInitialized = true;

  // Clear stale ops on startup
  (async () => {
    try {
      const db = await getDB();
      const ops: OfflineOp[] = await db.getAll(QUEUE_STORE);
      const stale = ops.filter(op => (op.retries || 0) >= 2);
      if (stale.length > 0) {
        console.warn(`[OfflineSync] Clearing ${stale.length} stale ops`);
        for (const op of stale) {
          await db.delete(QUEUE_STORE, op.id!);
        }
      }
    } catch { /* ignore */ }
  })();

  const handleOnline = async () => {
    console.log('[OfflineSync] Back online — syncing...');
    const result = await syncOfflineQueue();
    if (result.synced > 0) {
      console.log(`[OfflineSync] Sync complete: ${result.synced} synced, ${result.failed} failed`);
    }
  };

  window.addEventListener('online', handleOnline);

  if (navigator.onLine) {
    setTimeout(() => {
      syncOfflineQueue().then(r => {
        if (r.synced > 0) console.log(`[OfflineSync] Initial sync: ${r.synced} synced`);
      });
    }, 3000);
  }
}
