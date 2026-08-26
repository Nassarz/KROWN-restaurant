/**
 * KROWN ERP - Comprehensive Offline Sync Engine
 * 
 * Stores all write operations in IndexedDB when offline.
 * Automatically replays the operation queue when connectivity is restored.
 * Works with any Supabase table: orders, branches, staff, products, ingredients,
 * zones, companies, company_staff, expenses, audit_logs.
 */

import { openDB, IDBPDatabase } from 'idb';
import { supabase } from './supabase';

const DB_NAME = 'KrownPOS_OfflineDB';
const DB_VERSION = 2;
const QUEUE_STORE = 'op_queue';        // Pending write operations
const ORDERS_STORE = 'offline_orders'; // Legacy: cached orders

export interface OfflineOp {
  id?: number;
  table: string;
  method: 'upsert' | 'update' | 'insert' | 'delete';
  payload: any;
  conflictKey?: string; // e.g. 'id'
  timestamp: number;
  retries: number;
}

let _db: IDBPDatabase | null = null;

export async function getDB(): Promise<IDBPDatabase> {
  if (_db) return _db;
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Op queue store
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
      }
      // Legacy orders store (for backward compat with existing code)
      if (!db.objectStoreNames.contains(ORDERS_STORE)) {
        db.createObjectStore(ORDERS_STORE, { keyPath: 'id', autoIncrement: true });
      }
    }
  });
  return _db;
}

/**
 * Queue a write operation to be replayed when back online.
 * Called automatically from dataStore.ts when a write fails or when offline.
 */
export async function queueOfflineOp(op: Omit<OfflineOp, 'id' | 'timestamp' | 'retries'>) {
  try {
    const db = await getDB();
    await db.add(QUEUE_STORE, {
      ...op,
      timestamp: Date.now(),
      retries: 0
    } as OfflineOp);
    console.log('[OfflineSync] Queued op for table:', op.table, op.method);
    notifySyncListeners();

    // If online, attempt background auto-flush immediately
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      setTimeout(() => {
        syncOfflineQueue().catch(err => console.warn('[OfflineSync] Auto-flush notice:', err));
      }, 150);
    }
  } catch (e) {
    console.warn('[OfflineSync] Failed to queue op:', e);
  }
}

/**
 * Get count of pending offline operations.
 */
export async function getPendingOpCount(): Promise<number> {
  try {
    const db = await getDB();
    return await db.count(QUEUE_STORE);
  } catch {
    return 0;
  }
}

/**
 * Replay all queued operations against Supabase.
 * Called automatically when the browser comes back online.
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
      let error: any = null;

      if (op.method === 'upsert') {
        const { error: e } = await supabase.from(op.table).upsert(op.payload, {
          onConflict: op.conflictKey || 'id'
        });
        error = e;
      } else if (op.method === 'insert') {
        const { error: e } = await supabase.from(op.table).insert(op.payload);
        error = e;
      } else if (op.method === 'update') {
        const { id, ...updates } = op.payload;
        const { error: e } = await supabase.from(op.table).update(updates).eq('id', id);
        error = e;
      } else if (op.method === 'delete') {
        if (op.payload?.where) {
          let query: any = supabase.from(op.table).delete();
          Object.entries(op.payload.where).forEach(([col, val]) => {
            query = query.eq(col, val);
          });
          const { error: e } = await query;
          error = e;
        } else {
          const { error: e } = await supabase.from(op.table).delete().eq('id', op.payload.id);
          error = e;
        }
      }

      if (!error) {
        await db.delete(QUEUE_STORE, op.id!);
        synced++;
        console.log(`[OfflineSync] ✓ Synced op: ${op.table} ${op.method}`);
      } else {
        // Increment retry count
        const newRetries = (op.retries || 0) + 1;
        // Remove ops that have failed too many times (3 retries = likely permanent error like FK constraint)
        if (newRetries >= 3) {
          await db.delete(QUEUE_STORE, op.id!);
          console.warn(`[OfflineSync] ✗ Dropping op after ${newRetries} retries (${error.message}): ${op.table} ${op.method}`);
        } else {
          await db.put(QUEUE_STORE, { ...op, retries: newRetries });
        }
        failed++;
      }
    } catch (e) {
      failed++;
      console.warn(`[OfflineSync] ✗ Error replaying op:`, op.table, op.method, e);
    }
  }

  notifySyncListeners();
  return { synced, failed };
}

// ── Legacy compat: save an order for offline and sync when online ─────────────
export async function saveOfflineOrder(orderData: any) {
  const db = await getDB();
  await db.add(ORDERS_STORE, { ...orderData, timestamp: Date.now() });
}

export async function syncOfflineOrders() {
  if (!navigator.onLine) return;
  const db = await getDB();
  const orders = await db.getAll(ORDERS_STORE);
  if (orders.length === 0) return;
  for (const order of orders) {
    try {
      const { id, ...orderData } = order;
      const orderId = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      const { error } = await supabase.from('orders').upsert({
        ...orderData,
        id: orderId,
        synced: true,
        updated_at: Date.now()
      }, { onConflict: 'id' });
      if (!error) await db.delete(ORDERS_STORE, id);
    } catch (e) {
      console.warn('[OfflineSync] Failed to sync order:', e);
    }
  }
}

/**
 * Clear ALL pending offline ops from the queue.
 * Used by the manual sync UI when the user wants to dismiss stuck ops.
 */
export async function clearAllPendingOps(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear(QUEUE_STORE);
    notifySyncListeners();
    console.log('[OfflineSync] Cleared all pending ops from queue');
  } catch (e) {
    console.warn('[OfflineSync] Error clearing queue:', e);
  }
}

/** Alias for manual sync trigger from UI */
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

  const handleOnline = async () => {
    console.log('[OfflineSync] Back online — syncing queue...');
    const result = await syncOfflineQueue();
    await syncOfflineOrders();
    if (result.synced > 0) {
      console.log(`[OfflineSync] Sync complete: ${result.synced} ops synced, ${result.failed} failed`);
    }
  };

  window.addEventListener('online', handleOnline);

  // Also sync on initial load if online and there are pending ops
  if (navigator.onLine) {
    setTimeout(() => {
      syncOfflineQueue().then(r => {
        if (r.synced > 0) console.log(`[OfflineSync] Initial sync: ${r.synced} ops synced`);
      });
    }, 3000);
  }
}
