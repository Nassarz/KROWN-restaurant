import React from 'react';
import { Store, Activity } from 'lucide-react';

export default function AdminBranches({ restaurants }: { restaurants: any[] }) {
  return (
    <div className="flex flex-col h-full gap-6">
      <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Branches Overview</h2>
      <div className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl border border-white/40 dark:border-white/5 shadow-2xl rounded-[2rem] p-6 ring-1 ring-black/5 dark:ring-white/10 flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {restaurants.map(r => (
            <div key={r.id} className="bg-slate-50 dark:bg-black/20 p-6 rounded-2xl border border-black/5 dark:border-white/5">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-black dark:bg-white flex items-center justify-center rounded-xl shadow-sm">
                  <Store className="w-6 h-6 text-white dark:text-black" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">{r.name}</h3>
                  <p className="text-sm text-slate-500">{r.location || 'Unknown Location'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                <Activity className="w-4 h-4 text-green-500" /> System Online
              </div>
            </div>
          ))}
          {restaurants.length === 0 && <p className="text-slate-500 col-span-full">No branches found.</p>}
        </div>
      </div>
    </div>
  );
}
