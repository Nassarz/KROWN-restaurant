'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X, Box, UtensilsCrossed, Users, Receipt, Store, ShoppingCart } from 'lucide-react';
import { dataStore } from '@/lib/dataStore';
import { formatUGX } from '@/lib/mockData';
import { vibrate } from '@/lib/utils';

export default function GlobalSearchModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const results = dataStore.globalSearch(query);

  if (!isOpen) return null;

  const totalResults = results.products.length + results.ingredients.length + results.staff.length +
    results.companies.length + results.orders.length + results.branches.length;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-16 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          className="bg-white dark:bg-[#121214] rounded-[2.5rem] p-6 max-w-3xl w-full border border-black/10 dark:border-white/10 shadow-2xl space-y-4 max-h-[80vh] flex flex-col"
        >
          {/* Header Search Input */}
          <div className="flex items-center gap-3 border-b border-black/5 dark:border-white/5 pb-4">
            <Search className="w-6 h-6 text-orange-500 shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder="Type to search across Products, Inventory, Staff, Companies, Orders, Branches..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full bg-transparent text-lg font-bold text-slate-900 dark:text-white focus:outline-none placeholder:text-slate-400 placeholder:font-medium"
            />
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search Results Display */}
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-1">
            {!query.trim() ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                Start typing to search products, inventory, staff, corporate clients, orders, and branches.
              </div>
            ) : totalResults === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                No matching results found for &quot;{query}&quot;.
              </div>
            ) : (
              <>
                {/* Orders */}
                {results.orders.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <ShoppingCart className="w-4 h-4" /> Orders ({results.orders.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {results.orders.map(o => (
                        <div key={o.id} className="bg-slate-50 dark:bg-black/20 p-3 rounded-xl border border-black/5 dark:border-white/5">
                          <div className="flex justify-between font-bold text-xs text-slate-900 dark:text-white">
                            <span>#{o.id.toUpperCase()}</span>
                            <span className="text-orange-500">{formatUGX(o.total)}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1">Table {o.table} • {o.branchName}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Menu Products */}
                {results.products.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <UtensilsCrossed className="w-4 h-4" /> Menu Products ({results.products.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {results.products.map(p => (
                        <div key={p.id} className="bg-slate-50 dark:bg-black/20 p-3 rounded-xl border border-black/5 dark:border-white/5 flex justify-between items-center">
                          <div>
                            <span className="font-bold text-xs text-slate-900 dark:text-white">{p.name}</span>
                            <p className="text-[10px] text-slate-500">{p.category}</p>
                          </div>
                          <span className="font-extrabold text-xs text-slate-900 dark:text-white">{formatUGX(p.price)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stock Ingredients */}
                {results.ingredients.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-green-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Box className="w-4 h-4" /> Inventory Ingredients ({results.ingredients.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {results.ingredients.map(i => (
                        <div key={i.id} className="bg-slate-50 dark:bg-black/20 p-3 rounded-xl border border-black/5 dark:border-white/5 flex justify-between items-center">
                          <div>
                            <span className="font-bold text-xs text-slate-900 dark:text-white">{i.name}</span>
                            <p className="text-[10px] text-slate-500">{i.supplier}</p>
                          </div>
                          <span className="font-bold text-xs text-green-600 dark:text-green-400">{i.quantity} {i.unit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Staff */}
                {results.staff.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-purple-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Users className="w-4 h-4" /> Staff & Managers ({results.staff.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {results.staff.map(s => (
                        <div key={s.id} className="bg-slate-50 dark:bg-black/20 p-3 rounded-xl border border-black/5 dark:border-white/5">
                          <span className="font-bold text-xs text-slate-900 dark:text-white">{s.name}</span>
                          <p className="text-[10px] text-slate-500">{s.role} • {s.branch}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Corporate Accounts */}
                {results.companies.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Receipt className="w-4 h-4" /> Corporate Clients ({results.companies.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {results.companies.map(c => (
                        <div key={c.id} className="bg-slate-50 dark:bg-black/20 p-3 rounded-xl border border-black/5 dark:border-white/5">
                          <span className="font-bold text-xs text-slate-900 dark:text-white">{c.name}</span>
                          <p className="text-[10px] text-slate-500">Tax ID: {c.taxId} • Contact: {c.contactPerson}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Branches */}
                {results.branches.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-rose-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Store className="w-4 h-4" /> Branches ({results.branches.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {results.branches.map(b => (
                        <div key={b.id} className="bg-slate-50 dark:bg-black/20 p-3 rounded-xl border border-black/5 dark:border-white/5">
                          <span className="font-bold text-xs text-slate-900 dark:text-white">{b.name}</span>
                          <p className="text-[10px] text-slate-500">{b.location}, {b.city}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
