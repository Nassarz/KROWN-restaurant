'use client';

import { useEffect, useState, useCallback } from 'react';
import { getPendingOpCount, onSyncStatusChange, syncOfflineQueue, clearAllPendingOps } from '@/lib/sync';

export function OfflineSyncBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingOps, setPendingOps] = useState(0);
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'success'>('idle');
  const [mounted, setMounted] = useState(false);

  const refresh = useCallback(async () => {
    const count = await getPendingOpCount();
    setPendingOps(count);
  }, []);

  const handleManualSync = useCallback(async () => {
    if (syncState === 'syncing') return;
    setSyncState('syncing');
    const result = await syncOfflineQueue();
    await refresh();
    if (result.synced > 0) {
      setSyncState('success');
      setTimeout(() => setSyncState('idle'), 3000);
    } else {
      setSyncState('idle');
    }
  }, [syncState, refresh]);

  const handleClearQueue = useCallback(async () => {
    if (confirm(`Clear ${pendingOps} pending offline operation${pendingOps !== 1 ? 's' : ''}? These changes will not be synced to the server.`)) {
      await clearAllPendingOps();
      await refresh();
      setSyncState('idle');
    }
  }, [pendingOps, refresh]);

  useEffect(() => {
    setMounted(true);
    setIsOnline(navigator.onLine);
    refresh();

    const handleOnline = async () => {
      setIsOnline(true);
      const count = await getPendingOpCount();
      if (count > 0) {
        setSyncState('syncing');
        const result = await syncOfflineQueue();
        await refresh();
        if (result.synced > 0) {
          setSyncState('success');
          setTimeout(() => setSyncState('idle'), 3000);
        } else {
          setSyncState('idle');
        }
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSyncState('idle');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = onSyncStatusChange(async (count) => {
      setPendingOps(count);
      if (navigator.onLine && count > 0) {
        const result = await syncOfflineQueue();
        const updatedCount = await getPendingOpCount();
        setPendingOps(updatedCount);
        if (result.synced > 0 && updatedCount === 0) {
          setSyncState('success');
          setTimeout(() => setSyncState('idle'), 3000);
        }
      }
    });

    // Auto-sync every 30s if there are pending ops
    const interval = setInterval(async () => {
      if (navigator.onLine) {
        const count = await getPendingOpCount();
        if (count > 0) {
          await syncOfflineQueue();
          await refresh();
        }
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
      clearInterval(interval);
    };
  }, [refresh]);

  if (!mounted) return null;
  if (isOnline && pendingOps === 0 && syncState === 'idle') return null;

  // Success flash
  if (syncState === 'success') {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 bg-emerald-500 text-white text-xs font-semibold py-1.5 px-4 shadow-lg animate-slide-down">
        <span>✓</span> All offline changes synced successfully
      </div>
    );
  }

  // Syncing state
  if (syncState === 'syncing') {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 bg-blue-600 text-white text-xs font-semibold py-1.5 px-4 shadow-lg animate-slide-down">
        <svg className="animate-spin w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Syncing {pendingOps} pending change{pendingOps !== 1 ? 's' : ''} to cloud...
      </div>
    );
  }

  // Online but still has pending ops — show Retry + Clear buttons
  if (isOnline && pendingOps > 0) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-3 bg-amber-500 text-white text-xs font-semibold py-1.5 px-4 shadow-lg animate-slide-down">
        <span>⚠</span>
        <span>{pendingOps} change{pendingOps !== 1 ? 's' : ''} pending sync</span>
        <button
          onClick={handleManualSync}
          className="bg-white/20 hover:bg-white/30 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors"
        >
          Retry Now
        </button>
        <button
          onClick={handleClearQueue}
          className="bg-white/10 hover:bg-white/20 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors"
        >
          Clear
        </button>
      </div>
    );
  }

  // Offline state
  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 bg-slate-800 border-b border-slate-700 text-white text-xs font-semibold py-1.5 px-4 shadow-lg animate-slide-down">
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M4.929 4.929l14.142 14.142M3 3l18 18" />
        </svg>
        You're offline
        {pendingOps > 0 && (
          <span className="ml-1 bg-white/20 rounded-full px-2 py-0.5 text-[10px]">
            {pendingOps} change{pendingOps !== 1 ? 's' : ''} saved locally
          </span>
        )}
        <span className="text-slate-400 font-normal ml-1">— will sync when reconnected</span>
      </div>
    );
  }

  return null;
}
