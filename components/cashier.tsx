'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Clock, ChevronRight, Printer, Download, Eye, Receipt, Building2,
  MapPin, X, CheckCircle2, DollarSign, Split, CreditCard, Banknote, Smartphone,
  Store, Shield, Filter, RefreshCw, ChevronLeft, ArrowRight, UserCheck, AlertCircle
} from 'lucide-react';
import { formatUGX } from '@/lib/mockData';
import { printTicket, downloadReceiptFile, generateFormattedThermalReceipt } from '@/lib/printer';
import { dataStore } from '@/lib/dataStore';
import { vibrate } from '@/lib/utils';
import { useNotification } from '@/hooks/use-notification';

export default function CashierDashboard({ setView, activeStaff }: { setView: (v: 'pos' | 'admin' | 'manager' | 'kitchen' | 'cashier') => void; activeStaff?: any }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'partially_paid' | 'paid'>('all');
  
  // Active Selected Order for Payment / Details
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>('80mm');

  // Role check
  const role = activeStaff?.role || 'Cashier';
  const isSuperAdmin = role === 'Super Admin';
  const isManager = role === 'Branch Manager' || isSuperAdmin;
  const isKitchen = role === 'Head Chef' || role === 'Kitchen Staff' || isManager;

  // Payment Form State
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'MTN Mobile Money' | 'Airtel Money' | 'Credit Card' | 'Corporate Credit'>('MTN Mobile Money');
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Split Bill Modal State
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitMode, setSplitMode] = useState<'equal' | 'item'>('equal');
  const [equalSplitsCount, setEqualSplitsCount] = useState<number>(2);
  const [selectedItemsForSplit, setSelectedItemsForSplit] = useState<string[]>([]);
  const [currentSplitIndex, setCurrentSplitIndex] = useState<number>(1);

  const { notify } = useNotification();

  useEffect(() => {
    const syncData = () => {
      const allOrders = dataStore.getOrders(selectedBranchId);
      setOrders(allOrders);
      const allBranches = dataStore.getBranches();
      setBranches(allBranches);
      const c = dataStore.getCompanies();
      setCompanies(c);
      if (!selectedCompanyId && c[0]) setSelectedCompanyId(c[0].id);
    };

    syncData();
    const unsub = dataStore.subscribe(syncData);
    return () => unsub();
  }, [selectedBranchId]);

  const availableCompanyStaff = dataStore.getCompanyStaff(selectedCompanyId);

  // Filter Orders by Lookup: Order Number, Table ID, Seat Number, or Company
  const filteredOrders = orders.filter(o => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || 
      (o.id || '').toLowerCase().includes(query) ||
      (o.table || '').toLowerCase().includes(query) ||
      (o.seat || '').toLowerCase().includes(query) ||
      (o.place || '').toLowerCase().includes(query) ||
      (o.companyName || '').toLowerCase().includes(query);

    const isPaid = o.paymentStatus === 'paid' || o.status === 'completed';
    const isPartiallyPaid = o.paymentStatus === 'partially_paid';
    const isUnpaid = !isPaid && !isPartiallyPaid;

    if (statusFilter === 'unpaid') return matchesSearch && isUnpaid;
    if (statusFilter === 'partially_paid') return matchesSearch && isPartiallyPaid;
    if (statusFilter === 'paid') return matchesSearch && isPaid;

    return matchesSearch;
  });

  const unpaidCount = orders.filter(o => o.paymentStatus !== 'paid' && o.status !== 'completed').length;
  const totalRevenueToday = orders
    .filter(o => o.paymentStatus === 'paid' || o.paymentStatus === 'partially_paid')
    .reduce((sum, o) => sum + (o.paidAmount || o.total || 0), 0);

  // Full Order Payment Handler
  const handleCompleteFullPayment = (order: any) => {
    setIsProcessing(true);
    vibrate(30);

    try {
      const activeCompObj = companies.find(c => c.id === selectedCompanyId);
      const activeStaffObj = availableCompanyStaff.find(s => s.id === selectedStaffId);

      if (paymentMethod === 'Corporate Credit' && activeCompObj?.status === 'suspended') {
        alert(`Account On Hold: ${activeCompObj.name} is suspended. Cannot bill corporate credit.`);
        setIsProcessing(false);
        return;
      }

      const updated = dataStore.payOrder(order.id, {
        paymentMethod,
        isCorporateCredit: paymentMethod === 'Corporate Credit',
        companyId: paymentMethod === 'Corporate Credit' ? selectedCompanyId : undefined,
        companyName: paymentMethod === 'Corporate Credit' ? activeCompObj?.name : undefined,
        companyStaffId: paymentMethod === 'Corporate Credit' ? selectedStaffId : undefined,
        companyStaffName: paymentMethod === 'Corporate Credit' ? activeStaffObj?.name : undefined,
        workId: paymentMethod === 'Corporate Credit' ? activeStaffObj?.workId : undefined,
      });

      if (updated) {
        // Auto-print thermal paid receipt for cashier & client
        printTicket('receipt', updated, paperWidth);
        setSelectedOrder(updated);
      }
    } catch (e) {
      console.warn('Payment error:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  // Process a Split Payment
  const handleProcessSplitPayment = () => {
    if (!selectedOrder) return;
    setIsProcessing(true);
    vibrate(30);

    try {
      const remainingTotal = selectedOrder.total - (selectedOrder.paidAmount || 0);
      let splitAmount = 0;

      if (splitMode === 'equal') {
        splitAmount = Math.round(remainingTotal / equalSplitsCount);
      } else {
        // Calculate total for selected items
        splitAmount = selectedOrder.items
          .filter((item: any) => selectedItemsForSplit.includes(item.name))
          .reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
        if (splitAmount === 0) splitAmount = Math.round(remainingTotal / 2);
      }

      const splitData = {
        amount: splitAmount,
        paymentMethod,
        splitIndex: (selectedOrder.splitPayments?.length || 0) + 1,
        totalSplits: splitMode === 'equal' ? equalSplitsCount : (selectedOrder.splitPayments?.length || 0) + 1,
        seatCovered: selectedOrder.seat
      };

      const updated = dataStore.addSplitPayment(selectedOrder.id, splitData);

      if (updated) {
        // Automatically print split thermal receipt
        printTicket('split', updated, paperWidth, splitData);
        setSelectedOrder(updated);
        setShowSplitModal(false);
        notify('ready');
      }
    } catch (e) {
      console.warn('Split payment error:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-[#F4F4F6] dark:bg-[#0A0A0C] font-sans selection:bg-orange-500/30">
      {/* Mobile Top Header Bar */}
      <div className="md:hidden bg-white/90 dark:bg-[#121214]/90 backdrop-blur-2xl border-b border-black/5 dark:border-white/5 px-4 py-3 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center shadow-md shadow-orange-500/30">
            <DollarSign className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm text-slate-900 dark:text-white leading-none">CASHIER POS</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">{role}</p>
          </div>
        </div>

        <button
          onClick={() => { vibrate(20); setView('pos'); }}
          className="p-2 bg-slate-100 dark:bg-white/10 rounded-xl font-bold text-xs flex items-center gap-1 text-slate-700 dark:text-slate-200"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Exit POS</span>
        </button>
      </div>

      {/* Desktop Sidebar Navigation */}
      <nav className="hidden md:flex w-20 lg:w-24 bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl border-r border-black/5 dark:border-white/5 flex-col items-center py-8 z-10 shrink-0">
        <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/30 mb-8">
          <DollarSign className="w-6 h-6 text-white" />
        </div>

        <div className="flex flex-col gap-4 w-full px-4">
          <button
            onClick={() => { vibrate(20); setView('pos'); }}
            className="flex flex-col items-center justify-center gap-1.5 w-full py-3 rounded-2xl transition-all duration-300 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2]" />
            <span className="text-[10px] font-medium tracking-wide">POS</span>
          </button>

          <button
            className="flex flex-col items-center justify-center gap-1.5 w-full py-3 rounded-2xl transition-all duration-300 text-orange-500 bg-orange-500/10"
          >
            <DollarSign className="w-5 h-5 stroke-[2]" />
            <span className="text-[10px] font-bold tracking-wide">Cashier</span>
          </button>

          {isKitchen && (
            <button
              onClick={() => { vibrate(20); setView('kitchen'); }}
              className="flex flex-col items-center justify-center gap-1.5 w-full py-3 rounded-2xl transition-all duration-300 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
            >
              <Clock className="w-5 h-5 stroke-[2]" />
              <span className="text-[10px] font-medium tracking-wide">Kitchen</span>
            </button>
          )}

          {isManager && (
            <button
              onClick={() => { vibrate(20); setView('manager'); }}
              className="flex flex-col items-center justify-center gap-1.5 w-full py-3 rounded-2xl transition-all duration-300 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
            >
              <Store className="w-5 h-5 stroke-[2]" />
              <span className="text-[10px] font-medium tracking-wide">Manager</span>
            </button>
          )}
        </div>
      </nav>

      {/* Main Cashier Workspace */}
      <main className="flex-1 flex flex-col h-full min-w-0 p-6 lg:p-8 overflow-y-auto custom-scrollbar">
        {/* Top Header & Metrics Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-orange-500" /> Cashier Dashboard & Payment Center
            </h1>
            <p className="text-slate-500 font-medium text-sm mt-1">
              Search orders by Order Number, Table ID, or Seat. Process split bills, settlements, and thermal receipts across branches.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Branch Selector */}
            <div className="bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10 rounded-2xl px-4 py-2.5 flex items-center gap-2 shadow-sm">
              <Store className="w-4 h-4 text-orange-500" />
              <select
                value={selectedBranchId}
                onChange={e => setSelectedBranchId(e.target.value)}
                className="bg-transparent font-bold text-xs text-slate-900 dark:text-white focus:outline-none cursor-pointer"
              >
                <option value="all">All Restaurant Branches</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl p-6 rounded-[2rem] border border-black/5 dark:border-white/10 shadow-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Unpaid / Open Orders</p>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-1">{unpaidCount}</h3>
            </div>
            <div className="w-12 h-12 bg-orange-500/10 text-orange-500 rounded-2xl flex items-center justify-center font-bold">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl p-6 rounded-[2rem] border border-black/5 dark:border-white/10 shadow-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Collected Today</p>
              <h3 className="text-2xl font-black text-green-500 mt-1">{formatUGX(totalRevenueToday)}</h3>
            </div>
            <div className="w-12 h-12 bg-green-500/10 text-green-500 rounded-2xl flex items-center justify-center font-bold">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl p-6 rounded-[2rem] border border-black/5 dark:border-white/10 shadow-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Thermal Printer Status</p>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">Ready ({paperWidth})</h3>
            </div>
            <div className="w-12 h-12 bg-purple-500/10 text-purple-500 rounded-2xl flex items-center justify-center font-bold">
              <Printer className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Live Search & Filter Bar */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Order # (e.g. ORD-8820), Table ID (e.g. T4), or Seat (e.g. Seat 1)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white text-sm font-medium shadow-sm"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {[
              { id: 'all', label: 'All Orders' },
              { id: 'unpaid', label: 'Unpaid / Pending' },
              { id: 'partially_paid', label: 'Partially Paid' },
              { id: 'paid', label: 'Completed / Paid' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { vibrate(15); setStatusFilter(tab.id as any); }}
                className={`px-5 py-3.5 rounded-2xl font-bold text-xs whitespace-nowrap transition-all ${
                  statusFilter === tab.id
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
                    : 'bg-white dark:bg-[#121214] text-slate-500 border border-black/5 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Orders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredOrders.map(order => {
              const isPaid = order.paymentStatus === 'paid' || order.status === 'completed';
              const isPartiallyPaid = order.paymentStatus === 'partially_paid';

              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={order.id}
                  onClick={() => { vibrate(20); setSelectedOrder(order); }}
                  className={`bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl border ${
                    isPaid ? 'border-green-500/40 shadow-green-500/5' :
                    isPartiallyPaid ? 'border-yellow-500/50 shadow-yellow-500/5' :
                    'border-orange-500/40 shadow-orange-500/5'
                  } rounded-[2.5rem] p-6 shadow-xl cursor-pointer hover:scale-[1.01] transition-all flex flex-col justify-between group`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-3 border-b border-black/5 dark:border-white/5 pb-3">
                      <div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                          #{order.id.slice(-5).toUpperCase()}
                          <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                            isPaid ? 'bg-green-500/20 text-green-600 dark:text-green-400' :
                            isPartiallyPaid ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400' :
                            'bg-orange-500/20 text-orange-600 dark:text-orange-400'
                          }`}>
                            {isPaid ? 'Paid' : isPartiallyPaid ? 'Split / Partial' : 'Unpaid'}
                          </span>
                        </h3>
                        <p className="text-xs font-bold text-orange-500 mt-1">
                          📍 {order.place || 'Main Dining'} • Table {order.table} ({order.seat || 'Whole Table'})
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{new Date(order.createdAt).toLocaleString()}</p>
                      </div>

                      <div className="text-right">
                        <span className="text-2xl font-black text-slate-900 dark:text-white block">
                          {formatUGX(order.total)}
                        </span>
                        {isPartiallyPaid && (
                          <span className="text-[11px] font-bold text-yellow-600 dark:text-yellow-400 block">
                            Paid: {formatUGX(order.paidAmount || 0)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Ordered Items Preview */}
                    <div className="space-y-1.5 mb-4 text-xs font-medium text-slate-600 dark:text-slate-300">
                      {order.items?.slice(0, 3).map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between">
                          <span className="truncate">{item.quantity}x {item.name}</span>
                          <span className="font-bold text-slate-900 dark:text-white">{formatUGX(item.price * item.quantity)}</span>
                        </div>
                      ))}
                      {order.items?.length > 3 && (
                        <p className="text-[10px] italic text-slate-400">+ {order.items.length - 3} more items...</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-black/5 dark:border-white/5">
                    <span className="text-xs font-bold text-slate-400">{order.branchName || 'Kampala Central'}</span>
                    <button className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1 shadow-md group-hover:translate-x-1 transition-transform">
                      Process Payment <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {filteredOrders.length === 0 && (
            <div className="col-span-full py-16 text-center text-slate-400">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-lg font-bold">No orders found matching lookup query</p>
              <p className="text-xs text-slate-500 mt-1">Try searching by Order Number, Table Number, or Seat</p>
            </div>
          )}
        </div>
      </main>

      {/* Order Payment & Detail Drawer Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#121214] rounded-[2.5rem] p-8 max-w-2xl w-full border border-black/10 dark:border-white/10 shadow-2xl space-y-6 max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-4">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Order #{selectedOrder.id.toUpperCase()}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {selectedOrder.place || 'Main Dining'} • Table {selectedOrder.table} ({selectedOrder.seat || 'Whole Table'})
                  </p>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-1">
                {/* Items Summary Table */}
                <div className="bg-slate-50 dark:bg-black/30 p-4 rounded-2xl border border-black/5 dark:border-white/5 space-y-2">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-2">Order Breakdown</h4>
                  {selectedOrder.items?.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-xs font-semibold text-slate-800 dark:text-slate-200">
                      <span>{item.quantity}x {item.name}</span>
                      <span>{formatUGX((item.price || 0) * item.quantity)}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-black/5 dark:border-white/5 flex justify-between text-xs text-slate-500">
                    <span>Subtotal</span>
                    <span>{formatUGX(selectedOrder.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>URA VAT (18%)</span>
                    <span>{formatUGX(selectedOrder.tax)}</span>
                  </div>
                  <div className="flex justify-between text-base font-black text-slate-900 dark:text-white pt-2 border-t border-black/5 dark:border-white/5">
                    <span>Grand Total</span>
                    <span className="text-orange-500">{formatUGX(selectedOrder.total)}</span>
                  </div>
                  {selectedOrder.paidAmount > 0 && (
                    <div className="flex justify-between text-xs font-bold text-green-500 pt-1">
                      <span>Already Paid (Splits)</span>
                      <span>{formatUGX(selectedOrder.paidAmount)}</span>
                    </div>
                  )}
                </div>

                {/* Payment Method Selection */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Select Payment Method</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {[
                      { id: 'Cash', label: 'Cash', icon: Banknote },
                      { id: 'MTN Mobile Money', label: 'MTN MoMo', icon: Smartphone },
                      { id: 'Airtel Money', label: 'Airtel Money', icon: Smartphone },
                      { id: 'Credit Card', label: 'Credit Card', icon: CreditCard },
                      { id: 'Corporate Credit', label: 'Corporate Credit', icon: Store }
                    ].map(pm => (
                      <button
                        key={pm.id}
                        onClick={() => setPaymentMethod(pm.id as any)}
                        className={`p-3 rounded-2xl border flex items-center gap-2 transition-all text-xs font-bold ${
                          paymentMethod === pm.id
                            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-md'
                            : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-black/5 dark:border-white/5'
                        }`}
                      >
                        <pm.icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{pm.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Corporate Credit Dropdowns */}
                {paymentMethod === 'Corporate Credit' && (
                  <div className="bg-slate-50 dark:bg-black/30 p-4 rounded-2xl border border-black/5 dark:border-white/5 space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Company Profile</label>
                      <select
                        value={selectedCompanyId}
                        onChange={e => setSelectedCompanyId(e.target.value)}
                        className="w-full bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 rounded-xl p-2.5 text-xs font-semibold text-slate-900 dark:text-white"
                      >
                        {companies.map(c => (
                          <option key={c.id} value={c.id}>{c.name} (Tax ID: {c.taxId})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Company Staff Member</label>
                      <select
                        value={selectedStaffId}
                        onChange={e => setSelectedStaffId(e.target.value)}
                        className="w-full bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 rounded-xl p-2.5 text-xs font-semibold text-slate-900 dark:text-white"
                      >
                        <option value="">-- Select Staff Account --</option>
                        {availableCompanyStaff.map(s => (
                          <option key={s.id} value={s.id}>{s.name} ({s.workId || 'Staff'}) - {s.department || 'Staff'}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Split Payments Log if any exist */}
                {selectedOrder.splitPayments?.length > 0 && (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-2xl space-y-2">
                    <h5 className="font-bold text-xs text-yellow-600 dark:text-yellow-400 uppercase tracking-wider">Recorded Split Payments</h5>
                    {selectedOrder.splitPayments.map((sp: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
                        <span>Split #{sp.splitIndex}: {sp.paymentMethod}</span>
                        <span className="font-bold">{formatUGX(sp.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowSplitModal(true)}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 text-xs transition-all active:scale-95"
                  >
                    <Split className="w-4 h-4" /> Split Bill (Equal / Items)
                  </button>

                  <button
                    onClick={() => printTicket('receipt', selectedOrder, paperWidth)}
                    className="bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 px-4 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-1.5 text-xs hover:bg-slate-200"
                  >
                    <Printer className="w-4 h-4" /> Thermal Print
                  </button>
                </div>

                <button
                  onClick={() => handleCompleteFullPayment(selectedOrder)}
                  disabled={isProcessing || selectedOrder.paymentStatus === 'paid'}
                  className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 text-white py-4 rounded-2xl font-bold shadow-xl shadow-orange-500/30 text-sm flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  {isProcessing ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    `Complete Full Settlement (${formatUGX(selectedOrder.total - (selectedOrder.paidAmount || 0))})`
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Split Bill Config Modal */}
      <AnimatePresence>
        {showSplitModal && selectedOrder && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#121214] rounded-[2.5rem] p-8 max-w-md w-full border border-black/10 dark:border-white/10 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Split className="w-5 h-5 text-orange-500" /> Split Order #{selectedOrder.id.slice(-5).toUpperCase()}
                </h3>
                <button onClick={() => setShowSplitModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl text-xs font-bold">
                  <button
                    onClick={() => setSplitMode('equal')}
                    className={`flex-1 py-2.5 rounded-xl transition-all ${splitMode === 'equal' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-500'}`}
                  >
                    Equal Splits
                  </button>
                  <button
                    onClick={() => setSplitMode('item')}
                    className={`flex-1 py-2.5 rounded-xl transition-all ${splitMode === 'item' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-500'}`}
                  >
                    By Selected Items
                  </button>
                </div>

                {splitMode === 'equal' ? (
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-500">Number of Ways to Split</label>
                    <div className="flex items-center gap-3">
                      {[2, 3, 4, 5, 6].map(count => (
                        <button
                          key={count}
                          onClick={() => setEqualSplitsCount(count)}
                          className={`flex-1 py-3 rounded-2xl font-black text-sm border ${
                            equalSplitsCount === count
                              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-lg'
                              : 'bg-slate-50 dark:bg-white/5 text-slate-600 border-black/5'
                          }`}
                        >
                          {count}x
                        </button>
                      ))}
                    </div>

                    <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-2xl text-center">
                      <span className="text-xs font-bold text-orange-600 dark:text-orange-400 block">Amount Per Person / Split</span>
                      <span className="text-2xl font-black text-orange-500">
                        {formatUGX(Math.round((selectedOrder.total - (selectedOrder.paidAmount || 0)) / equalSplitsCount))}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                    <label className="block text-xs font-bold text-slate-500 mb-1">Select Items For This Payment Split</label>
                    {selectedOrder.items?.map((item: any, idx: number) => {
                      const isChecked = selectedItemsForSplit.includes(item.name);
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            setSelectedItemsForSplit(prev =>
                              isChecked ? prev.filter(x => x !== item.name) : [...prev, item.name]
                            );
                          }}
                          className={`w-full p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
                            isChecked ? 'bg-orange-500/10 border-orange-500/40 text-orange-600' : 'bg-slate-50 dark:bg-white/5 border-black/5'
                          }`}
                        >
                          <span>{item.quantity}x {item.name}</span>
                          <span className="font-bold">{formatUGX(item.price * item.quantity)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <button
                  onClick={handleProcessSplitPayment}
                  disabled={isProcessing}
                  className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3.5 rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2 text-sm"
                >
                  {isProcessing ? (
                    <div className="w-5 h-5 border-2 border-white/30 dark:border-black/30 border-t-white dark:border-t-black rounded-full animate-spin" />
                  ) : (
                    'Process This Split & Print Receipt'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
