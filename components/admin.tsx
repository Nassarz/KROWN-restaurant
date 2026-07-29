'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { 
  ChevronLeft, Users, Store, Activity, Settings, 
  TrendingUp, Box, Shield, Sun, Moon, Search, Plus, Trash2, Edit3, UtensilsCrossed
} from 'lucide-react';
import { vibrate } from '@/lib/utils';
import { logAudit } from '@/lib/audit';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import ManagerMenu from './manager-menu';
import ManagerInventory from './manager-inventory';
import ManagerStaff from './manager-staff';
import AdminBranches from './admin-branches';

export default function AdminPage({ user, setView }: { user: User, setView: (v: 'pos' | 'admin' | 'manager' | 'kitchen') => void }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'branches' | 'menu' | 'staff' | 'inventory' | 'audit'>('overview');
  const [isDark, setIsDark] = useState(false);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const hasDarkClass = document.documentElement.classList.contains('dark');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsDark(hasDarkClass || isSystemDark);
    }
  }, []);

  const toggleTheme = () => {
    vibrate(20);
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  useEffect(() => {
    const unsubRests = onSnapshot(collection(db, 'restaurants'), snap => {
      setRestaurants(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubOrders = onSnapshot(collection(db, 'orders'), snap => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubUsers = onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubAudit = onSnapshot(query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc')), snap => {
      setAuditLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubProds = onSnapshot(collection(db, 'products'), snap => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubIngs = onSnapshot(collection(db, 'ingredients'), snap => {
      setIngredients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubRests(); unsubOrders(); unsubUsers(); unsubAudit(); unsubProds(); unsubIngs(); };
  }, []);

  const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalTax = orders.reduce((sum, o) => sum + ((o.total || 0) * 0.1), 0); // Mock 10% tax

  // Mock chart data
  const chartData = [
    { name: 'Mon', revenue: 400 },
    { name: 'Tue', revenue: 300 },
    { name: 'Wed', revenue: 550 },
    { name: 'Thu', revenue: 480 },
    { name: 'Fri', revenue: 700 },
    { name: 'Sat', revenue: 950 },
    { name: 'Sun', revenue: 800 },
  ];

  return (
    <div className="min-h-screen bg-[#F4F4F6] dark:bg-[#0A0A0C] p-6 lg:p-10 font-sans flex">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col gap-2 pr-6 border-r border-black/5 dark:border-white/5 mr-8 shrink-0">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 rounded-xl bg-black dark:bg-white flex items-center justify-center shadow-lg">
            <Store className="w-5 h-5 text-white dark:text-black" />
          </div>
          <div>
            <h1 className="font-bold tracking-tight text-slate-900 dark:text-white">LumiereHQ</h1>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Global Admin</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {[
            { id: 'overview', icon: Activity, label: 'Overview' },
            { id: 'branches', icon: Store, label: 'Branches' },
            { id: 'menu', icon: UtensilsCrossed, label: 'Global Menu' },
            { id: 'staff', icon: Users, label: 'Staff & Managers' },
            { id: 'inventory', icon: Box, label: 'Global Inventory' },
            { id: 'audit', icon: Shield, label: 'Audit & Security' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { vibrate(20); setActiveTab(tab.id as any); }}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-medium transition-all ${
                activeTab === tab.id 
                  ? 'bg-black text-white dark:bg-white dark:text-black shadow-md' 
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50 dark:hover:text-white dark:hover:bg-white/5'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-2">
           <button 
            onClick={toggleTheme}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-200/50 dark:hover:text-white dark:hover:bg-white/5 transition-all"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            Toggle Theme
          </button>
          <button 
            onClick={() => { vibrate(30); setView('pos'); }}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-200/50 dark:hover:text-white dark:hover:bg-white/5 transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
            Exit Admin
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 flex flex-col h-[calc(100vh-5rem)]">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div 
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-6"
            >
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">System Overview</h2>
                  <p className="text-slate-500 font-medium">Real-time metrics across all branches.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-orange-500 to-amber-500 shadow-2xl shadow-orange-500/20 rounded-[2rem] p-6 text-white relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                  <div className="flex items-center gap-3 text-white/80 mb-2 relative z-10">
                    <TrendingUp className="w-5 h-5" />
                    <span className="font-semibold">Total Revenue</span>
                  </div>
                  <h3 className="text-4xl font-bold relative z-10">${totalRevenue.toFixed(2)}</h3>
                </div>
                <div className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl border border-white/40 dark:border-white/5 shadow-2xl rounded-[2rem] p-6 ring-1 ring-black/5 dark:ring-white/10">
                  <div className="flex items-center gap-3 text-slate-500 mb-2">
                    <Store className="w-5 h-5" />
                    <span className="font-semibold">Active Branches</span>
                  </div>
                  <h3 className="text-4xl font-bold text-slate-900 dark:text-white">{restaurants.length}</h3>
                </div>
                <div className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl border border-white/40 dark:border-white/5 shadow-2xl rounded-[2rem] p-6 ring-1 ring-black/5 dark:ring-white/10">
                  <div className="flex items-center gap-3 text-slate-500 mb-2">
                    <Activity className="w-5 h-5" />
                    <span className="font-semibold">Total Orders</span>
                  </div>
                  <h3 className="text-4xl font-bold text-slate-900 dark:text-white">{orders.length}</h3>
                </div>
                <div className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl border border-white/40 dark:border-white/5 shadow-2xl rounded-[2rem] p-6 ring-1 ring-black/5 dark:ring-white/10">
                  <div className="flex items-center gap-3 text-slate-500 mb-2">
                    <Settings className="w-5 h-5" />
                    <span className="font-semibold">Total Tax Collected</span>
                  </div>
                  <h3 className="text-4xl font-bold text-slate-900 dark:text-white">${totalTax.toFixed(2)}</h3>
                </div>
              </div>

              <div className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl border border-white/40 dark:border-white/5 shadow-2xl rounded-[2rem] p-8 ring-1 ring-black/5 dark:ring-white/10 flex-1 min-h-[400px]">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Revenue Trend (7 Days)</h3>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                      <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: isDark ? '#121214' : '#FFF', color: isDark ? '#FFF' : '#000' }} />
                      <Line type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={4} dot={{ r: 4, fill: '#f97316', strokeWidth: 2, stroke: '#FFF' }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'audit' && (
            <motion.div 
              key="audit"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col h-full gap-6"
            >
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Security & Audit Logs</h2>
              <div className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl border border-white/40 dark:border-white/5 shadow-2xl rounded-[2rem] p-6 ring-1 ring-black/5 dark:ring-white/10 flex-1 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
                  <AnimatePresence>
                    {auditLogs.map(log => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        key={log.id} 
                        className="bg-slate-50 dark:bg-black/20 p-4 rounded-2xl border border-black/5 dark:border-white/5 flex flex-col gap-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-slate-900 dark:text-white">{log.action}</span>
                          <span className="text-[10px] text-slate-400 font-medium">{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-orange-600 dark:text-orange-400 font-medium truncate">{log.userEmail}</p>
                        <pre className="text-[10px] text-slate-500 mt-1 overflow-hidden whitespace-pre-wrap">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </motion.div>
                    ))}
                    {auditLogs.length === 0 && <p className="text-slate-500 text-center py-8">No audit logs available.</p>}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
          
          {activeTab === 'branches' && (
            <motion.div key="branches" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full">
              <AdminBranches restaurants={restaurants} />
            </motion.div>
          )}

          {activeTab === 'menu' && (
            <motion.div key="menu" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full">
              <ManagerMenu products={products} user={user} />
            </motion.div>
          )}

          {activeTab === 'staff' && (
            <motion.div key="staff" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full">
              <ManagerStaff />
            </motion.div>
          )}

          {activeTab === 'inventory' && (
            <motion.div key="inventory" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full">
              <ManagerInventory ingredients={ingredients} user={user} />
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
