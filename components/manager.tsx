'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

import { User } from 'firebase/auth';
import { 
  ChevronLeft, Users, Store, Activity, Settings, 
  Box, Shield, Sun, Moon, UtensilsCrossed
} from 'lucide-react';
import { vibrate } from '@/lib/utils';
import { logAudit } from '@/lib/audit';
import ManagerMenu from './manager-menu';
import ManagerOrders from './manager-orders';
import ManagerInventory from './manager-inventory';
import ManagerReceipts from './manager-receipts';
import ManagerStaff from './manager-staff';
import AdminCompanies from './admin-companies';
import AdminZones from './admin-zones';
import { dataStore } from '@/lib/dataStore';

export default function ManagerPage({ user, setView }: { user: User, setView: (v: 'pos' | 'admin' | 'manager' | 'kitchen') => void }) {
  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'inventory' | 'staff' | 'receipts' | 'companies' | 'zones'>('orders');
  const [isDark, setIsDark] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);

  const restaurantId = 'default-restaurant';

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
    const syncData = () => {
      setOrders(dataStore.getOrders());
      setProducts(dataStore.getProducts());
      setIngredients(dataStore.getIngredients());
    };

    syncData();
    const unsub = dataStore.subscribe(syncData);
    return () => unsub();
  }, [restaurantId]);

  const toggleProductAvailability = (id: string, current: boolean) => {
    vibrate(40);
    dataStore.toggleProductAvailability(id);
  };

  return (
    <div className="min-h-screen bg-[#F4F4F6] dark:bg-[#0A0A0C] p-6 lg:p-10 font-sans flex">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col gap-2 pr-6 border-r border-black/5 dark:border-white/5 mr-8 shrink-0">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
            <Store className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold tracking-tight text-slate-900 dark:text-white">Downtown Branch</h1>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Manager</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1 flex-1 overflow-y-auto custom-scrollbar">
          {[
            { id: 'orders', icon: Activity, label: 'Live Orders' },
            { id: 'companies', icon: Settings, label: 'Corporate Accounts' },
            { id: 'zones', icon: Box, label: 'Seating Places' },
            { id: 'menu', icon: UtensilsCrossed, label: 'Menu Mgmt' },
            { id: 'inventory', icon: Box, label: 'Inventory' },
            { id: 'staff', icon: Users, label: 'Staff' },
            { id: 'receipts', icon: Settings, label: 'Receipts & Cashier' },
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
            Exit Manager
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 flex flex-col h-[calc(100vh-5rem)]">
        <AnimatePresence mode="wait">
          {activeTab === 'orders' && (
            <motion.div key="orders" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full">
              <ManagerOrders orders={orders} />
            </motion.div>
          )}

          {activeTab === 'companies' && (
            <motion.div key="companies" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full">
              <AdminCompanies />
            </motion.div>
          )}

          {activeTab === 'zones' && (
            <motion.div key="zones" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full">
              <AdminZones />
            </motion.div>
          )}

          {activeTab === 'menu' && (
            <motion.div key="menu" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full">
              <ManagerMenu products={products} user={user} />
            </motion.div>
          )}

          {activeTab === 'inventory' && (
            <motion.div key="inventory" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full">
              <ManagerInventory ingredients={ingredients} user={user} />
            </motion.div>
          )}

          {activeTab === 'staff' && (
            <motion.div key="staff" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full">
              <ManagerStaff />
            </motion.div>
          )}

          {activeTab === 'receipts' && (
            <motion.div key="receipts" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full">
              <ManagerReceipts orders={orders} />
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
