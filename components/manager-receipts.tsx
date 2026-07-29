import React, { useState } from 'react';
import { Search, Clock, ChevronRight } from 'lucide-react';

export default function ManagerReceipts({ orders }: { orders: any[] }) {
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const completedOrders = orders.filter(o => o.status === 'ready' || o.status === 'completed');

  const filtered = completedOrders.filter(o => {
    const matchesSearch = o.id.toLowerCase().includes(search.toLowerCase());
    if (dateFilter) {
      const orderDate = new Date(o.createdAt).toISOString().split('T')[0];
      return matchesSearch && orderDate === dateFilter;
    }
    return matchesSearch;
  });

  return (
    <div className="flex flex-col h-full gap-6">
      <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Receipts & History</h2>
      
      <div className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl border border-white/40 dark:border-white/5 shadow-2xl rounded-[2rem] p-6 ring-1 ring-black/5 dark:ring-white/10 flex-1 flex flex-col">
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text"
              placeholder="Search by Order ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 dark:bg-black/20 border border-black/5 dark:border-white/10 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
            />
          </div>
          <input 
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-48 bg-slate-50 dark:bg-black/20 border border-black/5 dark:border-white/10 rounded-2xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
          />
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
          {filtered.map(order => (
            <div key={order.id} className="bg-slate-50 dark:bg-black/20 p-4 rounded-2xl border border-black/5 dark:border-white/5 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white">#{order.id.slice(-5).toUpperCase()}</h4>
                <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
                  <Clock className="w-3 h-3" /> {new Date(order.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-bold text-orange-500 text-lg">${order.total?.toFixed(2)}</span>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-slate-500 text-center py-8">No receipts found.</p>}
        </div>
      </div>
    </div>
  );
}
