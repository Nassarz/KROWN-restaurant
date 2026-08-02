'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, ShieldAlert } from 'lucide-react';
import { dataStore } from '@/lib/dataStore';
import { vibrate } from '@/lib/utils';
import { StaffMember } from '@/lib/mockData';

interface DashboardAuthProps {
  requiredRole?: 'Super Admin' | 'Branch Manager' | 'Head Chef' | 'Cashier' | 'Senior Waiter' | 'any';
  targetTitle: string;
  targetIcon?: React.ReactNode;
  onAuthenticated: (staff: StaffMember) => void;
  onCancel?: () => void;
}

export default function DashboardAuth({
  requiredRole = 'any',
  targetTitle,
  targetIcon,
  onAuthenticated,
  onCancel
}: DashboardAuthProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const staffList = dataStore.getStaff();

  const handleVerifyCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    vibrate(20);

    const cleanEmail = email.trim().toLowerCase();
    let found = staffList.find(s => 
      s.email.toLowerCase() === cleanEmail && 
      (s.password === password || s.pin === password)
    );

    if (!found) {
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data: authData } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: password
        });

        if (authData?.user) {
          found = staffList.find(s => s.email.toLowerCase() === cleanEmail);
        }
      } catch (err) {
        console.warn('[DashboardAuth] Auth error:', err);
      }
    }

    if (!found) {
      setErrorMsg('Invalid email or password. Please try again.');
      return;
    }

    if (found.status === 'banned') {
      setErrorMsg('Access Denied: This staff account has been BANNED by Admin.');
      return;
    }

    if (found.status === 'paused') {
      setErrorMsg('Account On Hold: Shift is currently paused/on hold.');
      return;
    }

    onAuthenticated(found);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white/90 dark:bg-[#121214]/90 backdrop-blur-2xl rounded-[3rem] p-8 max-w-lg w-full border border-black/10 dark:border-white/10 shadow-2xl space-y-6"
      >
        <div className="text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-500 rounded-3xl flex items-center justify-center shadow-lg shadow-orange-500/30 mb-4 text-white">
            {targetIcon || <Lock className="w-8 h-8" />}
          </div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{targetTitle} Auth</h2>
          <p className="text-slate-500 text-xs font-semibold mt-1">Authenticate staff account to unlock dashboard access</p>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-2 text-red-500 text-xs font-bold">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleVerifyCredentials} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Staff Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="staff@krown.ug"
              className="w-full bg-slate-50 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-white font-medium text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-50 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-white font-medium text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white py-4 rounded-2xl font-bold shadow-xl shadow-orange-500/20 transition-all active:scale-[0.98] text-sm"
          >
            Verify & Log Into Dashboard
          </button>
        </form>

        {onCancel && (
          <button
            onClick={onCancel}
            className="w-full py-3 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
          >
            Cancel & Return
          </button>
        )}
      </motion.div>
    </div>
  );
}
