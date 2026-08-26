import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Building2, Plus, Users, CreditCard, ShieldCheck, DollarSign, Search, Briefcase, Printer, Download, Trash2, Ban, CheckCircle2, History, X, CheckCircle } from 'lucide-react';
import { dataStore } from '@/lib/dataStore';
import { formatUGX, CompanyProfile, CompanyStaff, Order } from '@/lib/mockData';
import { vibrate } from '@/lib/utils';

export default function AdminCompanies({ currentBranchId }: { currentBranchId?: string }) {
  const [companies, setCompanies] = useState<CompanyProfile[]>(() => dataStore.getCompanies(currentBranchId));
  const [staff, setStaff] = useState<CompanyStaff[]>(() => dataStore.getCompanyStaff());
  const [orders, setOrders] = useState<Order[]>(() => dataStore.getOrders(currentBranchId));

  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(() => {
    const comps = dataStore.getCompanies(currentBranchId);
    return comps.length > 0 ? comps[0].id : null;
  });

  // Modal States
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);

  // Search in Spending History Modal
  const [historySearch, setHistorySearch] = useState('');

  // Settle Balance Form
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState<'Cash' | 'MTN Mobile Money' | 'Airtel Money' | 'Credit Card'>('MTN Mobile Money');
  const [settleNotes, setSettleNotes] = useState('');

  // New Company Form State
  const [compName, setCompName] = useState('');
  const [compTaxId, setCompTaxId] = useState('');
  const [compCreditLimit, setCompCreditLimit] = useState('10000000');
  const [compContact, setCompContact] = useState('');
  const [compPhone, setCompPhone] = useState('');

  // New Company Staff Form State
  const [staffName, setStaffName] = useState('');
  const [staffWorkId, setStaffWorkId] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffDept, setStaffDept] = useState('');

  useEffect(() => {
    const unsub = dataStore.subscribe(() => {
      const comps = dataStore.getCompanies(currentBranchId);
      setCompanies(comps);
      setStaff(dataStore.getCompanyStaff());
      setOrders(dataStore.getOrders(currentBranchId));
      setSelectedCompanyId(prev => prev || (comps[0]?.id || null));
    });
    return () => unsub();
  }, [currentBranchId]);

  const handleCreateCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!compName.trim()) return;
    const branchObj = currentBranchId ? dataStore.getBranches().find(b => b.id === currentBranchId) : undefined;
    const newC = dataStore.addCompany({
      name: compName.trim(),
      taxId: compTaxId.trim() || 'URA-000000',
      creditLimitUGX: Number(compCreditLimit) || 10000000,
      contactPerson: compContact.trim() || 'N/A',
      phone: compPhone.trim() || '+256 700 000 000',
      branchId: currentBranchId,
      branchName: branchObj?.name
    });
    setCompName('');
    setCompTaxId('');
    setCompCreditLimit('10000000');
    setCompContact('');
    setCompPhone('');
    setShowAddCompany(false);
    setSelectedCompanyId(newC.id);
  };

  const handleCreateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim() || !selectedCompanyId) return;
    dataStore.addCompanyStaff({
      companyId: selectedCompanyId,
      name: staffName.trim(),
      workId: staffWorkId.trim() || undefined,
      email: staffEmail.trim() || undefined,
      department: staffDept.trim() || undefined
    });
    setStaffName('');
    setStaffWorkId('');
    setStaffEmail('');
    setStaffDept('');
    setShowAddStaff(false);
  };

  const activeCompany = companies.find(c => c.id === selectedCompanyId) || companies[0];
  const companyStaffList = staff.filter(s => s.companyId === activeCompany?.id);
  const companyOrdersList = orders.filter(o => o.companyId === activeCompany?.id || o.companyName === activeCompany?.name);

  // Filtered Spending History
  const filteredHistoryOrders = companyOrdersList.filter(o => {
    const q = historySearch.toLowerCase();
    return o.id.toLowerCase().includes(q) ||
      (o.companyStaffName || '').toLowerCase().includes(q) ||
      (o.workId || '').toLowerCase().includes(q) ||
      o.table.toLowerCase().includes(q) ||
      (o.branchName || '').toLowerCase().includes(q);
  });

  const totalCorporateOutstanding = companies.reduce((sum, c) => sum + (c.currentBalanceUGX || 0), 0);

  // Handle Settle / Clear Corporate Credit Balance
  const handleSettleBalance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompany || !settleAmount) return;
    const amt = parseFloat(settleAmount);
    if (isNaN(amt) || amt <= 0) return;

    dataStore.settleCompanyBalance(activeCompany.id, amt, settleMethod, settleNotes);
    vibrate([40, 60]);
    setShowSettleModal(false);
    setSettleAmount('');
    setSettleNotes('');
  };

  // Toggle company status
  const toggleCompanyStatus = (id: string, currentStatus: string) => {
    vibrate(20);
    const next = currentStatus === 'active' ? 'suspended' : 'active';
    dataStore.updateCompanyStatus(id, next as any);
  };

  // Toggle company staff status
  const toggleStaffStatus = (id: string, currentStatus: string) => {
    vibrate(20);
    const next = currentStatus === 'active' ? 'banned' : 'active';
    dataStore.updateCompanyStaffStatus(id, next as any);
  };

  // Print PDF Statement
  const printCompanyPDF = () => {
    if (!activeCompany || typeof window === 'undefined') return;
    const printWin = window.open('', '_blank');
    if (!printWin) return;

    const paperWidth = '80mm';
    const divider = '-'.repeat(48);
    const doubleDivider = '='.repeat(48);

    const ordersHtml = companyOrdersList.map(o => `
      <div style="margin-bottom: 6px;">
        <div class="justify">
          <span style="font-weight: bold;">#${o.id.slice(-6).toUpperCase()} (${new Date(o.createdAt).toLocaleDateString()})</span>
          <span style="font-weight: bold;">${formatUGX(o.total)}</span>
        </div>
        <div style="font-size: 11px; color: #333;">
          Staff: ${o.companyStaffName || 'Staff'} (${o.workId || 'N/A'})
        </div>
        <div style="font-size: 11px; color: #333;">
          Table: ${o.table} • Branch: ${o.branchName}
        </div>
      </div>
      <div>${divider}</div>
    `).join('');

    printWin.document.write(`
      <html>
        <head>
          <title>Company Credit Statement - Thermal</title>
          <style>
            @page { size: ${paperWidth} auto; margin: 0; }
            body {
              font-family: 'Courier New', Courier, monospace;
              width: ${paperWidth};
              padding: 10px;
              margin: 0 auto;
              font-size: 13px;
              line-height: 1.3;
              color: #000;
            }
            .center { text-align: center; font-weight: bold; }
            .justify { display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <div class="center">KROWN POS</div>
          <div class="center">CORPORATE CREDIT STATEMENT</div>
          <div class="center">${activeCompany.name.toUpperCase()}</div>
          <div>${divider}</div>
          <div class="justify"><span>Tax ID:</span> <span>${activeCompany.taxId}</span></div>
          <div class="justify"><span>Phone:</span> <span>${activeCompany.phone}</span></div>
          <div class="justify"><span>Credit Limit:</span> <span>${formatUGX(activeCompany.creditLimitUGX)}</span></div>
          <div class="justify" style="font-weight: bold; color: red;"><span>Outstanding Bal:</span> <span>${formatUGX(activeCompany.currentBalanceUGX)}</span></div>
          <div>${doubleDivider}</div>
          
          <div class="center">TRANSACTIONS LOG</div>
          <div>${doubleDivider}</div>
          ${ordersHtml}
          
          <div class="center">Powered by Krown POS</div>
          <br/><br/><br/>
        </body>
      </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); printWin.close(); }, 300);
  };

  // Export CSV
  const exportCompanyCSV = () => {
    if (!activeCompany) return;
    const headers = ['Order ID', 'Staff Name', 'Work ID', 'Table', 'Branch', 'Date', 'Amount (UGX)'];
    const rows = companyOrdersList.map(o => [
      o.id,
      `"${o.companyStaffName || 'Staff'}"`,
      `"${o.workId || 'N/A'}"`,
      `"${o.table}"`,
      `"${o.branchName}"`,
      `"${new Date(o.createdAt).toLocaleString()}"`,
      o.total
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${activeCompany.name.replace(/\s+/g, '_')}_Spending_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Corporate Accounts & Credit</h2>
          <p className="text-slate-500 font-medium text-xs">Manage corporate client profiles, staff credit limits, meal spending, and balance settlements</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-orange-500/10 border border-orange-500/20 px-4 py-2 rounded-2xl flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-orange-500" />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Corporate Due</span>
              <span className="text-sm font-black text-orange-500">{formatUGX(totalCorporateOutstanding)}</span>
            </div>
          </div>

          <button
            onClick={() => { vibrate(20); setShowAddCompany(true); }}
            className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-orange-500/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" /> Add Company Profile
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden">
        {/* Left: Companies List */}
        <div className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl border border-white/40 dark:border-white/5 shadow-2xl rounded-[2rem] p-6 ring-1 ring-black/5 dark:ring-white/10 flex flex-col overflow-hidden">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-orange-500" /> Corporate Clients ({companies.length})
          </h3>

          <div className="overflow-y-auto custom-scrollbar pr-1 space-y-3 flex-1">
            {companies.map(comp => {
              const isSelected = comp.id === activeCompany?.id;
              return (
                <div
                  key={comp.id}
                  onClick={() => { vibrate(15); setSelectedCompanyId(comp.id); }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20'
                      : 'bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white border-black/5 dark:border-white/5 hover:border-orange-500/40'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-sm tracking-tight">{comp.name}</h4>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : comp.status === 'suspended' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'
                    }`}>
                      {comp.status}
                    </span>
                  </div>
                  <p className="text-xs opacity-70 mt-1 font-mono">Tax ID: {comp.taxId}</p>
                  <div className="flex justify-between items-center mt-3 pt-2 border-t border-current/10 text-xs font-semibold">
                    <span>Outstanding Due:</span>
                    <span className={`font-bold ${isSelected ? 'text-white' : 'text-orange-500'}`}>{formatUGX(comp.currentBalanceUGX)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Company Detail Panel */}
        <div className="lg:col-span-2 bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl border border-white/40 dark:border-white/5 shadow-2xl rounded-[2rem] p-6 ring-1 ring-black/5 dark:ring-white/10 flex flex-col overflow-hidden">
          {activeCompany ? (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-black/5 dark:border-white/5">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{activeCompany.name}</h3>
                    <span className={`text-xs font-extrabold px-3 py-1 rounded-full uppercase ${
                      activeCompany.status === 'suspended' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'
                    }`}>
                      {activeCompany.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Tax ID: {activeCompany.taxId} • Contact: {activeCompany.contactPerson} ({activeCompany.phone})
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setShowSettleModal(true)}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95"
                  >
                    <CheckCircle className="w-4 h-4" /> Settle Balance
                  </button>

                  <button
                    onClick={() => toggleCompanyStatus(activeCompany.id, activeCompany.status)}
                    className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      activeCompany.status === 'active'
                        ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                        : 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
                    }`}
                  >
                    {activeCompany.status === 'active' ? 'Suspend' : 'Activate'}
                  </button>

                  <button
                    onClick={printCompanyPDF}
                    className="p-2.5 bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-200 text-xs font-bold flex items-center gap-1"
                    title="Print PDF Statement"
                  >
                    <Printer className="w-4 h-4 text-purple-500" />
                  </button>

                  <button
                    onClick={exportCompanyCSV}
                    className="p-2.5 bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-200 text-xs font-bold flex items-center gap-1"
                    title="Export CSV"
                  >
                    <Download className="w-4 h-4 text-blue-500" />
                  </button>

                  <button
                    onClick={() => setShowAddStaff(true)}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95"
                  >
                    <Plus className="w-4 h-4" /> Add Staff Account
                  </button>
                </div>
              </div>

              {/* Company Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-4">
                <div className="bg-slate-50 dark:bg-black/20 p-4 rounded-2xl border border-black/5 dark:border-white/5">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Credit Limit</span>
                  <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">{formatUGX(activeCompany.creditLimitUGX)}</p>
                </div>
                <div className="bg-slate-50 dark:bg-black/20 p-4 rounded-2xl border border-black/5 dark:border-white/5">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Current Balance Due</span>
                  <p className="text-lg font-bold text-orange-500 mt-1">{formatUGX(activeCompany.currentBalanceUGX)}</p>
                </div>
                <div className="bg-slate-50 dark:bg-black/20 p-4 rounded-2xl border border-black/5 dark:border-white/5 col-span-2 sm:col-span-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Registered Staff & History</span>
                  <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">{companyStaffList.length} Staff • {companyOrdersList.length} Orders</p>
                </div>
              </div>

              {/* Staff Table */}
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-orange-500" /> Authorized Staff Accounts ({companyStaffList.length})
                </h4>
                <button
                  onClick={() => setShowHistoryModal(true)}
                  className="text-xs font-bold text-orange-500 hover:underline flex items-center gap-1"
                >
                  <History className="w-3.5 h-3.5" /> View Spending Logs ({companyOrdersList.length})
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {companyStaffList.map(s => {
                    const isBanned = s.status === 'banned' || s.status === 'inactive';
                    return (
                      <div key={s.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-black/20 border border-black/5 dark:border-white/5 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white text-sm">{s.name}</span>
                            <span className="text-[10px] font-mono bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full font-bold">
                              {s.workId}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">{s.department || 'General'} • {s.email || 'No Email'}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleStaffStatus(s.id, s.status)}
                            className={`p-2 rounded-xl text-xs font-bold transition-all ${
                              isBanned
                                ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
                                : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                            }`}
                            title={isBanned ? 'Unban / Activate Staff' : 'Ban / Suspend Staff'}
                          >
                            {isBanned ? <CheckCircle2 className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400">Select a company profile to view details.</div>
          )}
        </div>
      </div>

      {/* Spending History Modal WITH REAL-TIME SEARCH */}
      <AnimatePresence>
        {showHistoryModal && activeCompany && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-[#121214] rounded-[2.5rem] p-8 max-w-3xl w-full border border-black/10 dark:border-white/10 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <History className="w-6 h-6 text-orange-500" /> {activeCompany.name} Corporate Spending History
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Filter spending records by Order ID, Staff Name, Work ID, or Branch</p>
                </div>
                <button onClick={() => setShowHistoryModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* SEARCH INPUT */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search spending logs by Order ID, Staff Name, Work ID, Table, Branch..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-black/20 border border-black/5 dark:border-white/10 rounded-2xl py-2.5 pl-10 pr-4 text-xs font-medium dark:text-white outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
                {filteredHistoryOrders.map(o => (
                  <div key={o.id} className="bg-slate-50 dark:bg-black/20 p-4 rounded-2xl border border-black/5 dark:border-white/5 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">#{o.id.toUpperCase()}</span>
                        <span className="bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {o.companyStaffName || 'Staff'} ({o.workId || 'N/A'})
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Table {o.table} ({o.place}) • Branch: {o.branchName}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{new Date(o.createdAt).toLocaleString()}</p>
                    </div>

                    <div className="text-right">
                      <span className="font-extrabold text-base text-orange-500">{formatUGX(o.total)}</span>
                      <span className="text-[10px] text-slate-400 block font-semibold">{o.items?.length || 0} items ordered</span>
                    </div>
                  </div>
                ))}
                {filteredHistoryOrders.length === 0 && (
                  <div className="py-12 text-center text-slate-400 text-xs">No matching corporate spending history logs found.</div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settle Balance Modal */}
      <AnimatePresence>
        {showSettleModal && activeCompany && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-[#121214] rounded-[2.5rem] p-8 max-w-md w-full border border-black/10 dark:border-white/10 shadow-2xl space-y-4">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Settle Corporate Credit Balance</h3>
              <p className="text-xs text-slate-500">Record full or partial payment received from {activeCompany.name}</p>

              <form onSubmit={handleSettleBalance} className="space-y-3">
                <div className="bg-orange-500/10 p-3 rounded-2xl text-xs font-semibold text-orange-600 dark:text-orange-400 flex justify-between">
                  <span>Current Balance Due:</span>
                  <span className="font-bold">{formatUGX(activeCompany.currentBalanceUGX)}</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Amount Paid (UGX) *</label>
                  <input
                    type="number"
                    required
                    max={activeCompany.currentBalanceUGX}
                    value={settleAmount}
                    onChange={e => setSettleAmount(e.target.value)}
                    placeholder="Enter amount paid"
                    className="w-full bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl p-3 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Payment Method *</label>
                  <select
                    value={settleMethod}
                    onChange={e => setSettleMethod(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl p-3 text-xs font-bold text-slate-900 dark:text-white outline-none"
                  >
                    <option value="MTN Mobile Money">MTN Mobile Money</option>
                    <option value="Airtel Money">Airtel Money</option>
                    <option value="Cash">Cash</option>
                    <option value="Credit Card">Credit / Debit Card</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Notes / Ref (Optional)</label>
                  <input
                    type="text"
                    value={settleNotes}
                    onChange={e => setSettleNotes(e.target.value)}
                    placeholder="e.g. Cheque #9920 / MoMo Txn Ref"
                    className="w-full bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl p-3 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowSettleModal(false)} className="flex-1 py-3 font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white text-xs">Cancel</button>
                  <button type="submit" className="flex-1 bg-emerald-500 text-white py-3 rounded-xl font-bold text-xs shadow-lg shadow-emerald-500/20">Clear / Record Payment</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Company Modal */}
      <AnimatePresence>
        {showAddCompany && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-[#121214] rounded-[2.5rem] p-8 max-w-md w-full border border-black/10 dark:border-white/10 shadow-2xl space-y-4">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Create Company Profile</h3>
              <form onSubmit={handleCreateCompany} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Company Name *</label>
                  <input type="text" required value={compName} onChange={e => setCompName(e.target.value)} placeholder="e.g. MTN Uganda HQ" className="w-full bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">URA Tax ID / Reg Number</label>
                  <input type="text" value={compTaxId} onChange={e => setCompTaxId(e.target.value)} placeholder="e.g. URA-100293841" className="w-full bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Credit Limit (UGX)</label>
                  <input type="number" value={compCreditLimit} onChange={e => setCompCreditLimit(e.target.value)} placeholder="10000000" className="w-full bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Contact Person</label>
                    <input type="text" value={compContact} onChange={e => setCompContact(e.target.value)} placeholder="Name" className="w-full bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Phone</label>
                    <input type="text" value={compPhone} onChange={e => setCompPhone(e.target.value)} placeholder="+256 7..." className="w-full bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white" />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowAddCompany(false)} className="flex-1 py-3 font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white">Cancel</button>
                  <button type="submit" className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-orange-500/20">Save Company</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Staff Modal */}
      <AnimatePresence>
        {showAddStaff && activeCompany && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-[#121214] rounded-[2.5rem] p-8 max-w-md w-full border border-black/10 dark:border-white/10 shadow-2xl space-y-4">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Add Staff to {activeCompany.name}</h3>
              <form onSubmit={handleCreateStaff} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Staff Full Name * (Required)</label>
                  <input type="text" required value={staffName} onChange={e => setStaffName(e.target.value)} placeholder="e.g. Patrick Muhire" className="w-full bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white font-semibold" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Work ID / Employee Code (Optional)</label>
                  <input type="text" value={staffWorkId} onChange={e => setStaffWorkId(e.target.value)} placeholder="e.g. MTN-8840" className="w-full bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white font-mono" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Department (Optional)</label>
                    <input type="text" value={staffDept} onChange={e => setStaffDept(e.target.value)} placeholder="e.g. Finance" className="w-full bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Work Email (Optional)</label>
                    <input type="email" value={staffEmail} onChange={e => setStaffEmail(e.target.value)} placeholder="email@co.ug" className="w-full bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white" />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowAddStaff(false)} className="flex-1 py-3 font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white">Cancel</button>
                  <button type="submit" className="flex-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3 rounded-xl font-bold shadow-lg">Save Staff Account</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
