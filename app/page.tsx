'use client';

import React, { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User } from 'firebase/auth';
import POSPage from '@/components/pos';
import AdminPage from '@/components/admin';
import ManagerPage from '@/components/manager';
import KitchenPage from '@/components/kitchen';
import { UtensilsCrossed } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function AppRouter() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'pos' | 'admin' | 'manager' | 'kitchen'>('pos');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F4F6] dark:bg-[#0A0A0C]">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
          <UtensilsCrossed className="w-10 h-10 text-orange-500" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F4F6] dark:bg-[#0A0A0C] text-slate-900 dark:text-slate-100 p-4">
        <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-amber-500 rounded-3xl flex items-center justify-center shadow-xl shadow-orange-500/30 mb-8">
          <UtensilsCrossed className="text-white w-10 h-10" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-2 text-center">Lumière POS</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-8 text-center max-w-sm">
          Premium Enterprise Restaurant Management System. Sign in to access your dashboard.
        </p>
        <button
          onClick={handleLogin}
          className="bg-white dark:bg-[#1A1A1E] text-slate-900 dark:text-white px-8 py-4 rounded-2xl font-semibold shadow-lg hover:shadow-xl transition-all active:scale-[0.98] border border-black/5 dark:border-white/10"
        >
          Sign In with Google
        </button>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {view === 'pos' && (
        <motion.div key="pos" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="h-screen w-full absolute top-0 left-0 bg-[#F4F4F6] dark:bg-[#0A0A0C]">
          <POSPage user={user} setView={setView} />
        </motion.div>
      )}
      {view === 'admin' && (
        <motion.div key="admin" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="min-h-screen w-full absolute top-0 left-0 bg-[#F4F4F6] dark:bg-[#0A0A0C]">
          <AdminPage user={user} setView={setView} />
        </motion.div>
      )}
      {view === 'manager' && (
        <motion.div key="manager" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="min-h-screen w-full absolute top-0 left-0 bg-[#F4F4F6] dark:bg-[#0A0A0C]">
          <ManagerPage user={user} setView={setView} />
        </motion.div>
      )}
      {view === 'kitchen' && (
        <motion.div key="kitchen" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="min-h-screen w-full absolute top-0 left-0 bg-[#F4F4F6] dark:bg-[#0A0A0C]">
          <KitchenPage setView={setView} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
