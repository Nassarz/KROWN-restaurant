'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Shield, Search, User, Monitor, Clock, MapPin, Filter, ArrowUpDown } from 'lucide-react';
import { dataStore } from '@/lib/dataStore';
import { AuditLog } from '@/lib/mockData';

export default function ManagerAudit({ currentBranchId }: { currentBranchId?: string }) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');

  useEffect(() => {
    const updateLogs = () => {
      setLogs(dataStore.getAuditLogs(currentBranchId));
    };

    updateLogs();
    const unsub = dataStore.subscribe(updateLogs);
    return () => unsub();
  }, [currentBranchId]);

  const filteredLogs = logs.filter(log => {
    const query = search.toLowerCase();
    const matchesSearch =
      (log.action || '').toLowerCase().includes(query) ||
      (log.userEmail || '').toLowerCase().includes(query) ||
      (log.userName || '').toLowerCase().includes(query) ||
      (log.role || '').toLowerCase().includes(query) ||
      (log.section || '').toLowerCase().includes(query) ||
      (log.pcInfo || '').toLowerCase().includes(query) ||
      JSON.stringify(log.details || {}).toLowerCase().includes(query);

    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  const uniqueActions = Array.from(new Set(logs.map(l => l.action).filter(Boolean)));

  const getActionBadgeColor = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('LOGIN')) return 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20';
    if (act.includes('LOGOUT')) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    if (act.includes('ORDER') || act.includes('PAY') || act.includes('BILL')) return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20';
    if (act.includes('DELETE') || act.includes('VOID') || act.includes('BAN')) return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
    if (act.includes('SWITCH')) return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
    return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
  };

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Shield className="w-8 h-8 text-orange-500" />
            Branch Security & Audit Logs
          </h2>
          <p className="text-slate-500 text-xs font-medium">
            Real-time track of user logins, logouts, view switches, sales, and system modifications
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search user, action, PC..."
              className="w-full bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 text-slate-900 dark:text-white text-xs font-bold py-2 px-3 rounded-xl focus:outline-none cursor-pointer"
          >
            <option value="all">⚡ All Actions ({logs.length})</option>
            {uniqueActions.map(act => (
              <option key={act} value={act}>{act}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table / Cards */}
      <div className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl border border-black/5 dark:border-white/10 rounded-[2.5rem] p-6 shadow-xl flex-1 overflow-hidden flex flex-col">
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Shield className="w-12 h-12 mb-3 opacity-40" />
            <p className="font-bold text-sm">No audit activity logged for this query</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
            {filteredLogs.map(log => (
              <div
                key={log.id}
                className="bg-slate-50 dark:bg-black/20 p-4 rounded-2xl border border-black/5 dark:border-white/5 space-y-2 hover:border-orange-500/30 transition-all"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-extrabold px-3 py-1 rounded-full border ${getActionBadgeColor(log.action)}`}>
                      {log.action}
                    </span>
                    {log.section && (
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-200/60 dark:bg-white/10 px-2.5 py-0.5 rounded-lg">
                        {log.section}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-slate-600 dark:text-slate-300 pt-1">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                    <span className="font-bold text-slate-900 dark:text-white">
                      {log.userName || log.userEmail?.split('@')[0] || 'System Staff'}
                    </span>
                    <span className="text-[10px] text-slate-400">({log.role || 'Staff'})</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Monitor className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                    <span className="truncate text-slate-500 dark:text-slate-400 font-medium">
                      {log.pcInfo || log.ipAddress || 'Branch Workstation PC'}
                    </span>
                  </div>

                  {log.branchName && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        {log.branchName}
                      </span>
                    </div>
                  )}
                </div>

                {log.details && Object.keys(log.details).length > 0 && (
                  <pre className="bg-white dark:bg-black/40 p-2.5 rounded-xl text-[10px] font-mono text-slate-600 dark:text-slate-400 overflow-x-auto border border-black/5 dark:border-white/5 mt-1">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
