import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Clock, ChevronRight, Printer, Download, Eye, Receipt, Building2, MapPin, X, CheckCircle2 } from 'lucide-react';
import { formatUGX, MOCK_ORDERS } from '@/lib/mockData';
import { printTicket, downloadReceiptFile, generateFormattedThermalReceipt } from '@/lib/printer';

export default function ManagerReceipts({ orders }: { orders: any[] }) {
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>('80mm');

  const displayOrders = orders && orders.length > 0 ? orders : MOCK_ORDERS;
  
  const filtered = displayOrders.filter(o => {
    const matchesSearch = (o.id || '').toLowerCase().includes(search.toLowerCase()) ||
                          (o.companyName || '').toLowerCase().includes(search.toLowerCase()) ||
                          (o.companyStaffName || '').toLowerCase().includes(search.toLowerCase()) ||
                          (o.table || '').toLowerCase().includes(search.toLowerCase());
    if (dateFilter) {
      const orderDate = new Date(o.createdAt).toISOString().split('T')[0];
      return matchesSearch && orderDate === dateFilter;
    }
    return matchesSearch;
  });

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Cashier Dashboard & Receipts
          </h2>
          <p className="text-slate-500 font-medium">
            Manage transactions, thermal printing (80mm/58mm), and corporate credit billing receipts.
          </p>
        </div>
      </div>
      
      <div className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl border border-white/40 dark:border-white/5 shadow-2xl rounded-[2rem] p-6 ring-1 ring-black/5 dark:ring-white/10 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text"
              placeholder="Search by Order ID, Company, Table..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 dark:bg-black/20 border border-black/5 dark:border-white/10 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:text-white text-sm"
            />
          </div>
          <input 
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-48 bg-slate-50 dark:bg-black/20 border border-black/5 dark:border-white/10 rounded-2xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:text-white text-sm"
          />
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3">
          {filtered.map(order => (
            <div 
              key={order.id} 
              onClick={() => setSelectedReceipt(order)}
              className="bg-slate-50 dark:bg-black/20 p-4 rounded-2xl border border-black/5 dark:border-white/5 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer group shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-500/10 text-orange-500 rounded-2xl flex items-center justify-center font-bold">
                  <Receipt className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                    #{order.id.slice(-5).toUpperCase()}
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                      order.paymentMethod === 'Corporate Credit' || order.isCorporateCredit
                        ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                        : 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                    }`}>
                      {order.paymentMethod || 'Paid'}
                    </span>
                  </h4>
                  <p className="text-xs font-medium text-slate-500 flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-slate-400" /> {new Date(order.createdAt).toLocaleString()}</span>
                    <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-orange-500" /> {order.place || 'Main Dining'} • {order.table} {order.seat ? `(${order.seat})` : ''}
                    </span>
                  </p>
                  {order.companyName && (
                    <p className="text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1 mt-1">
                      <Building2 className="w-3.5 h-3.5" /> Billed to: {order.companyName} ({order.companyStaffName || 'Staff'})
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-5">
                <div className="text-right">
                  <span className="font-extrabold text-orange-500 text-lg block">{formatUGX(order.total || 0)}</span>
                  <span className="text-[10px] font-bold text-green-500 uppercase tracking-wider">Confirmed</span>
                </div>
                <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-white/10 flex items-center justify-center text-slate-500 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-slate-500 text-center py-12">No receipts matching query found.</p>}
        </div>
      </div>

      {/* Receipt Action Modal */}
      <AnimatePresence>
        {selectedReceipt && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="bg-white dark:bg-[#121214] rounded-[2.5rem] p-8 max-w-xl w-full border border-black/10 dark:border-white/10 shadow-2xl space-y-6 max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-4">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Receipt #{selectedReceipt.id.toUpperCase()}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Cashier Transaction Details</p>
                </div>
                <button onClick={() => setSelectedReceipt(null)} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Thermal Receipt Preview Area */}
              <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-black/40 p-6 rounded-2xl border border-black/5 dark:border-white/5 font-mono text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed custom-scrollbar shadow-inner">
                {generateFormattedThermalReceipt(selectedReceipt, paperWidth)}
              </div>

              {/* Controls & Action Buttons */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between bg-slate-100 dark:bg-white/5 p-3 rounded-xl text-xs">
                  <span className="font-bold text-slate-600 dark:text-slate-300">Thermal Paper Width:</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setPaperWidth('80mm')}
                      className={`px-3 py-1 rounded-lg font-bold transition-all ${paperWidth === '80mm' ? 'bg-orange-500 text-white' : 'text-slate-500'}`}
                    >
                      80mm (Standard)
                    </button>
                    <button 
                      onClick={() => setPaperWidth('58mm')}
                      className={`px-3 py-1 rounded-lg font-bold transition-all ${paperWidth === '58mm' ? 'bg-orange-500 text-white' : 'text-slate-500'}`}
                    >
                      58mm (Compact)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => printTicket('receipt', selectedReceipt, paperWidth)}
                    className="bg-orange-500 hover:bg-orange-600 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 active:scale-95 text-sm"
                  >
                    <Printer className="w-4 h-4" /> Print Thermal Receipt
                  </button>

                  <button
                    onClick={() => downloadReceiptFile(selectedReceipt)}
                    className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 text-sm"
                  >
                    <Download className="w-4 h-4" /> Download Receipt (.txt)
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
