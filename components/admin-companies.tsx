import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Building2, Plus, Users, CreditCard, ShieldCheck, DollarSign, Search, Briefcase } from 'lucide-react';
import { dataStore } from '@/lib/dataStore';
import { formatUGX, CompanyProfile, CompanyStaff } from '@/lib/mockData';

export default function AdminCompanies() {
  const [companies, setCompanies] = useState<CompanyProfile[]>(() => dataStore.getCompanies());
  const [staff, setStaff] = useState<CompanyStaff[]>(() => dataStore.getCompanyStaff());
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(() => {
    const comps = dataStore.getCompanies();
    return comps.length > 0 ? comps[0].id : null;
  });

  // New Company Form State
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [compName, setCompName] = useState('');
  const [compTaxId, setCompTaxId] = useState('');
  const [compCreditLimit, setCompCreditLimit] = useState('10000000');
  const [compContact, setCompContact] = useState('');
  const [compPhone, setCompPhone] = useState('');

  // New Company Staff Form State
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [staffName, setStaffName] = useState(''); // Required
  const [staffWorkId, setStaffWorkId] = useState(''); // Optional
  const [staffEmail, setStaffEmail] = useState('');
  const [staffDept, setStaffDept] = useState('');

  useEffect(() => {
    const unsub = dataStore.subscribe(() => {
      const comps = dataStore.getCompanies();
      setCompanies(comps);
      setStaff(dataStore.getCompanyStaff());
      setSelectedCompanyId(prev => prev || (comps[0]?.id || null));
    });
    return () => unsub();
  }, []);

  const handleCreateCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!compName.trim()) return;
    const newC = dataStore.addCompany({
      name: compName.trim(),
      taxId: compTaxId.trim() || 'URA-000000',
      creditLimitUGX: Number(compCreditLimit) || 10000000,
      contactPerson: compContact.trim() || 'N/A',
      phone: compPhone.trim() || '+256 700 000 000'
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
  const totalCorporateOutstanding = companies.reduce((sum, c) => sum + (c.currentBalanceUGX || 0), 0);

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Corporate Credit & Accounts
          </h2>
          <p className="text-slate-500 font-medium">
            Manage corporate client accounts (&quot;Eat Now, Pay Later&quot;) &amp; authorized staff IDs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-orange-500/10 border border-orange-500/20 px-4 py-2.5 rounded-2xl flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-orange-500" />
            <div>
              <p className="text-[10px] uppercase font-bold text-orange-600 dark:text-orange-400">Total Corporate Balance</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{formatUGX(totalCorporateOutstanding)}</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddCompany(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-orange-500/20 transition-all active:scale-95 text-sm"
          >
            <Plus className="w-4 h-4" /> Add Company Profile
          </button>
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Companies Sidebar List */}
        <div className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl border border-white/40 dark:border-white/5 shadow-2xl rounded-[2rem] p-6 ring-1 ring-black/5 dark:ring-white/10 flex flex-col">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-orange-500" /> Corporate Clients
          </h3>

          <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
            {companies.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCompanyId(c.id)}
                className={`w-full text-left p-4 rounded-2xl border transition-all flex flex-col gap-2 ${
                  selectedCompanyId === c.id
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-xl'
                    : 'bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white border-black/5 dark:border-white/5 hover:border-orange-500/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-base line-clamp-1">{c.name}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    selectedCompanyId === c.id ? 'bg-orange-500 text-white' : 'bg-orange-500/10 text-orange-500'
                  }`}>
                    {c.status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs opacity-80 mt-1">
                  <span>Contact: {c.contactPerson}</span>
                  <span className="font-mono font-semibold">{c.taxId}</span>
                </div>

                <div className="mt-2 pt-2 border-t border-black/10 dark:border-white/10 flex items-center justify-between text-xs font-bold">
                  <span>Balance Due:</span>
                  <span className={selectedCompanyId === c.id ? 'text-orange-400 dark:text-orange-600' : 'text-orange-500'}>
                    {formatUGX(c.currentBalanceUGX)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Selected Company Details & Staff Accounts */}
        <div className="lg:col-span-2 bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl border border-white/40 dark:border-white/5 shadow-2xl rounded-[2rem] p-8 ring-1 ring-black/5 dark:ring-white/10 flex flex-col overflow-hidden">
          {activeCompany ? (
            <>
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-black/5 dark:border-white/5 gap-4">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    {activeCompany.name}
                  </h3>
                  <p className="text-slate-500 text-xs mt-1">
                    Tax ID: <span className="font-mono font-semibold">{activeCompany.taxId}</span> • Contact: {activeCompany.contactPerson} ({activeCompany.phone})
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const nextStatus = activeCompany.status === 'suspended' ? 'active' : 'suspended';
                      dataStore.toggleCompanyStatus(activeCompany.id, nextStatus);
                    }}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all active:scale-95 shrink-0 ${
                      activeCompany.status === 'suspended'
                        ? 'bg-green-500 hover:bg-green-600 text-white shadow-md shadow-green-500/20'
                        : 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20'
                    }`}
                  >
                    {activeCompany.status === 'suspended' ? '✓ Reactivate Account' : '⚠️ Put Account On Hold'}
                  </button>

                  <button
                    onClick={() => setShowAddStaff(true)}
                    className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-md transition-all active:scale-95 shrink-0"
                  >
                    <Plus className="w-4 h-4" /> Add Company Staff Account
                  </button>
                </div>
              </div>

              {/* Company Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 my-6">
                <div className="bg-slate-50 dark:bg-black/20 p-4 rounded-2xl border border-black/5 dark:border-white/5">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Credit Limit</span>
                  <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">{formatUGX(activeCompany.creditLimitUGX)}</p>
                </div>
                <div className="bg-slate-50 dark:bg-black/20 p-4 rounded-2xl border border-black/5 dark:border-white/5">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Current Outstanding</span>
                  <p className="text-lg font-bold text-orange-500 mt-1">{formatUGX(activeCompany.currentBalanceUGX)}</p>
                </div>
                <div className="bg-slate-50 dark:bg-black/20 p-4 rounded-2xl border border-black/5 dark:border-white/5 col-span-2 sm:col-span-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Registered Staff</span>
                  <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">{companyStaffList.length} Members</p>
                </div>
              </div>

              {/* Staff Table */}
              <h4 className="font-bold text-slate-900 dark:text-white text-base mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-orange-500" /> Authorized Staff Accounts
              </h4>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {companyStaffList.map(s => (
                    <div key={s.id} className="bg-slate-50 dark:bg-black/20 p-4 rounded-2xl border border-black/5 dark:border-white/5 flex items-center justify-between">
                      <div>
                        <h5 className="font-bold text-slate-900 dark:text-white text-sm">{s.name}</h5>
                        <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                          {s.workId && <span className="font-mono bg-orange-500/10 text-orange-600 px-2 py-0.5 rounded text-[10px] font-bold">ID: {s.workId}</span>}
                          <span>{s.department || 'Staff'}</span>
                        </p>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-green-500" title="Active" />
                    </div>
                  ))}
                  {companyStaffList.length === 0 && (
                    <div className="col-span-2 py-8 text-center text-slate-400 text-xs">
                      No staff members registered under {activeCompany.name} yet. Click &quot;Add Company Staff Account&quot; to enroll staff.
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400">Select a company profile to view details.</div>
          )}
        </div>
      </div>

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
