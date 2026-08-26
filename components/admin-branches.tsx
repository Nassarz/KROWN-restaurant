'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Store, Activity, MapPin, User, Phone, Layers, Plus, Receipt, Mail, X, Trash2 } from 'lucide-react';
import { formatUGX } from '@/lib/mockData';
import { dataStore } from '@/lib/dataStore';
import { vibrate } from '@/lib/utils';

export default function AdminBranches({ restaurants, selectedBranchId }: { restaurants: any[], selectedBranchId?: string }) {
  const displayBranches = (restaurants || []).filter(r => r.id !== 'all');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [city, setCity] = useState('Kampala');
  const [manager, setManager] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [taxId, setTaxId] = useState('URA-100293481');
  const [address, setAddress] = useState('');
  const [tablesCount, setTablesCount] = useState('20');
  const [receiptHeaderNote, setReceiptHeaderNote] = useState('');
  const [receiptFooterNote, setReceiptFooterNote] = useState('Thank you for dining with us! Powered by Krown Enterprise POS');

  const handleCreateBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !location.trim()) return;

    dataStore.addBranch({
      name: name.trim(),
      location: location.trim(),
      city: city.trim(),
      manager: manager.trim() || 'Branch Manager',
      phone: phone.trim() || '+256 700 000 000',
      email: email.trim() || `${name.toLowerCase().replace(/\s+/g, '')}@krownpos.com`,
      taxId: taxId.trim() || 'URA-100293481',
      address: address.trim() || location.trim(),
      receiptHeaderNote: receiptHeaderNote.trim() || `Welcome to ${name}`,
      receiptFooterNote: receiptFooterNote.trim() || 'Thank you for dining with us! Powered by Krown Enterprise POS',
      tablesCount: Number(tablesCount) || 20
    });

    setName('');
    setLocation('');
    setManager('');
    setPhone('');
    setEmail('');
    setAddress('');
    setShowAddModal(false);
  };

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Global Restaurant Branches</h2>
          <p className="text-slate-500 font-medium text-sm mt-1">Enterprise network status & receipt setup ({displayBranches.length} registered locations)</p>
        </div>

        <button
          onClick={() => { vibrate(20); setShowAddModal(true); }}
          className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-orange-500/20 transition-all active:scale-95 text-xs shrink-0"
        >
          <Plus className="w-4 h-4" /> Create New Branch
        </button>
      </div>

      <div className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl border border-white/40 dark:border-white/5 shadow-2xl rounded-[2rem] p-6 ring-1 ring-black/5 dark:ring-white/10 flex-1 overflow-y-auto custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayBranches.map(r => {
            const isOnline = dataStore.isBranchOnline(r.id, r.name);
            const allOrders = dataStore.getOrders('all');
            const branchOrders = allOrders.filter(o => {
              if (o.restaurantId && r.id) return o.restaurantId === r.id;
              return Boolean(o.branchName && r.name && o.branchName.toLowerCase() === r.name.toLowerCase());
            });

            const todayStart = new Date().setHours(0, 0, 0, 0);
            const todayPaidOrders = branchOrders.filter(o =>
              (o.paymentStatus === 'paid' || o.status === 'completed') && o.createdAt >= todayStart
            );
            const realTodaySales = todayPaidOrders.reduce((sum, o) => sum + (o.total || 0), 0);
            const totalBranchSales = branchOrders
              .filter(o => o.paymentStatus === 'paid' || o.status === 'completed')
              .reduce((sum, o) => sum + (o.total || 0), 0);

            const displaySales = realTodaySales > 0 ? realTodaySales : (r.dailyRevenueUGX || (branchOrders.length > 0 ? totalBranchSales : 0));

            return (
              <div key={r.id} className={`bg-slate-50 dark:bg-black/20 p-6 rounded-3xl border border-black/5 dark:border-white/5 flex flex-col justify-between hover:shadow-xl transition-all ${selectedBranchId === r.id ? 'ring-2 ring-orange-500/60 shadow-xl' : ''}`}>
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center rounded-2xl shadow-lg shadow-orange-500/20">
                      <Store className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        isOnline
                          ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'
                          : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                      }`}>
                        {isOnline ? 'ONLINE' : 'OFFLINE'}
                      </span>
                      <button
                        onClick={() => {
                          if (confirm(`Delete branch "${r.name}"? This action cannot be undone.`)) {
                            dataStore.deleteBranch(r.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                        title="Delete Branch"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <h3 className="font-bold text-xl text-slate-900 dark:text-white mb-1">{r.name}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 mb-4">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {r.location || 'Kampala, Uganda'}
                  </p>

                  <div className="space-y-2 py-3 border-t border-b border-black/5 dark:border-white/5 mb-4 text-xs font-medium text-slate-600 dark:text-slate-300">
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5 text-slate-400"><User className="w-3.5 h-3.5" /> Manager</span>
                      <span className="font-semibold">{r.manager || 'Branch Lead'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5 text-slate-400"><Phone className="w-3.5 h-3.5" /> Direct Phone</span>
                      <span>{r.phone || '+256 700 000 000'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5 text-slate-400"><Receipt className="w-3.5 h-3.5" /> Tax TIN</span>
                      <span className="font-mono">{r.taxId || 'URA-100293481'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5 text-slate-400"><Layers className="w-3.5 h-3.5" /> Floor Capacity</span>
                      <span className="font-bold">{r.tablesCount || 20} Tables</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Today Sales</p>
                    <p className="font-bold text-orange-500 text-lg">{formatUGX(displaySales)}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 dark:bg-white/5 px-3 py-1.5 rounded-xl">
                    <Activity className="w-4 h-4 text-orange-500" /> {branchOrders.length} Orders
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Branch Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-[#121214] rounded-[2.5rem] p-8 max-w-lg w-full border border-black/10 dark:border-white/10 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Store className="w-6 h-6 text-orange-500" /> Create New Restaurant Branch
                </h3>
                <button onClick={() => setShowAddModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateBranch} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Branch Name *</label>
                  <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Krown Mbarara Highway" className="w-full bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white font-bold" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">City / Region</label>
                    <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="Mbarara" className="w-full bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Floor Tables Count</label>
                    <input type="number" value={tablesCount} onChange={e => setTablesCount(e.target.value)} placeholder="20" className="w-full bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Physical Address / Location *</label>
                  <input type="text" required value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. High Street, Mbarara City Center" className="w-full bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Contact Phone Number</label>
                    <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+256 770 123 456" className="w-full bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Contact Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="mbarara@krownpos.com" className="w-full bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white" />
                  </div>
                </div>

                <div className="pt-2 border-t border-black/5 dark:border-white/5 space-y-2">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-orange-500">Thermal Receipt Printing Setup</h4>
                  
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">URA TIN / Tax Registration ID</label>
                    <input type="text" value={taxId} onChange={e => setTaxId(e.target.value)} placeholder="URA-100293481" className="w-full bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl p-3 text-sm font-mono text-slate-900 dark:text-white" />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Receipt Footer Mandatory Note</label>
                    <input type="text" value={receiptFooterNote} onChange={e => setReceiptFooterNote(e.target.value)} placeholder="Thank you for dining with us! Powered by Krown Enterprise POS" className="w-full bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl p-3 text-xs text-slate-900 dark:text-white font-medium" />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 font-bold text-slate-500">Cancel</button>
                  <button type="submit" className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-orange-500/20">Save Branch & Receipts</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
