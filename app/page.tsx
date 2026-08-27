'use client';

import React, { useState, useEffect } from 'react';
import POSPage from '@/components/pos';
import AdminPage from '@/components/admin';
import ManagerPage from '@/components/manager';
import KitchenPage from '@/components/kitchen';
import CashierDashboard from '@/components/cashier';
import DashboardAuth from '@/components/dashboard-auth';
import { UtensilsCrossed, Lock, Mail, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '@/lib/supabase';
import type { StaffMember } from '@/lib/mockData';
import { dataStore } from '@/lib/dataStore';
import {
  cacheOfflineAuth,
  storeOfflinePasswordHash,
  verifyOfflineCredentials,
  getCachedOfflineProfile,
  isOffline
} from '@/lib/offlineAuth';

export default function AppRouter() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'pos' | 'admin' | 'manager' | 'kitchen' | 'cashier'>('pos');
  const [activeStaff, setActiveStaff] = useState<StaffMember | null>(null);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [pendingView, setPendingView] = useState<'pos' | 'admin' | 'manager' | 'kitchen' | 'cashier' | null>(null);

  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [loginMode, setLoginMode] = useState<'password' | 'pin'>('password');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Presence Tracking for Branch Online / Offline Status
  useEffect(() => {
    if (!activeStaff) {
      dataStore.setOnlineStaffPresence([]);
      return;
    }

    const presenceChannel = supabase.channel('krown-presence-room', {
      config: { presence: { key: activeStaff.id } }
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const onlineUsers: any[] = [];
        Object.values(state).forEach((presences: any) => {
          presences.forEach((p: any) => {
            if (p.staffId) onlineUsers.push(p);
          });
        });
        dataStore.setOnlineStaffPresence(onlineUsers);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            staffId: activeStaff.id,
            email: activeStaff.email,
            branch: activeStaff.branch,
            assignedBranchId: activeStaff.assignedBranchId,
            role: activeStaff.role,
            onlineAt: Date.now()
          });
        }
      });

    return () => {
      presenceChannel.unsubscribe();
    };
  }, [activeStaff]);

  useEffect(() => {
    const restoreStaffSession = async (authUser: any) => {
      if (!authUser) { setLoading(false); return; }
      try {
        // Try UID first, then email
        let dbStaff: any = null;
        const { data: byId } = await supabase.from('staff').select('*').eq('id', authUser.id).maybeSingle();
        if (byId) {
          dbStaff = byId;
        } else {
          const { data: byEmail } = await supabase.from('staff').select('*').eq('email', authUser.email?.toLowerCase()).maybeSingle();
          dbStaff = byEmail;
        }

        if (!dbStaff) {
          dbStaff = getCachedOfflineProfile(authUser.email || '');
        }

        if (dbStaff) {
          const staff: StaffMember = {
            id: dbStaff.id,
            name: dbStaff.name || authUser.email?.split('@')[0],
            email: dbStaff.email || authUser.email,
            role: dbStaff.role || 'Senior Waiter',
            branch: dbStaff.branch || 'Global HQ',
            assignedBranchId: dbStaff.assigned_branch_id || null,
            status: dbStaff.status || 'active',
            avatar: dbStaff.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(dbStaff.name || 'Staff')}&background=f97316&color=fff&bold=true&size=200`,
          };
          setUser({ uid: staff.id, displayName: staff.name, email: staff.email, photoURL: staff.avatar });
          setActiveStaff(staff);
          // Auto-route on session restore
          if (staff.role === 'Super Admin') setView('admin');
          else if (staff.role === 'Branch Manager') setView('manager');
          else if (staff.role === 'Cashier') setView('pos');
          else if (staff.role === 'Head Chef' || staff.role === 'Kitchen Staff') setView('kitchen');
          else setView('pos');
        }
      } catch (err) {
        console.warn('[Supabase Session] Restore error:', err);
      } finally {
        setLoading(false);
      }
    };

    const isTabSessionActive = typeof window !== 'undefined' && sessionStorage.getItem('krown_active_session') === 'true';

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !isTabSessionActive) {
        supabase.auth.signOut().then(() => {
          setUser(null);
          setActiveStaff(null);
          setEmail('');
          setPassword('');
          setPin('');
          setView('pos');
          setLoading(false);
        });
      } else {
        restoreStaffSession(session?.user ?? null);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setActiveStaff(null);
        setEmail('');
        setPassword('');
        setPin('');
        setLoginError(null);
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('krown_active_session');
        }
        setView('pos');
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleNavigateWithAuth = (targetView: 'pos' | 'admin' | 'manager' | 'kitchen' | 'cashier') => {
    const role = activeStaff?.role;

    if (role === 'Super Admin') {
      setView(targetView);
      return;
    }

    if (role === 'Branch Manager') {
      if (targetView === 'admin') {
        alert('Access Denied: Branch Managers cannot access Super Admin Global HQ Settings.');
        return;
      }
      setView(targetView);
      return;
    }

    if (role === 'Cashier') {
      if (targetView === 'admin' || targetView === 'manager') {
        alert('Access Denied: Cashier accounts cannot access Manager or Admin dashboards.');
        return;
      }
      setView(targetView);
      return;
    }

    if (role === 'Senior Waiter' && targetView !== 'pos') {
      alert('Access Denied: POS Waiter accounts are restricted to POS view.');
      return;
    }

    if ((role === 'Head Chef' || role === 'Kitchen Staff') && targetView !== 'kitchen') {
      alert('Access Denied: Kitchen staff accounts are restricted to Kitchen Display.');
      return;
    }

    setView(targetView);
  };

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    setLoginError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        }
      });
      if (error) setLoginError(error.message);
    } catch (err: any) {
      setLoginError(err?.message || 'Google Sign-In failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || pin.length < 4) {
      setLoginError('Please enter a 4-digit PIN code.');
      return;
    }
    setIsSubmitting(true);
    setLoginError(null);

    const allStaff = dataStore.getStaff();
    const matched = allStaff.find(s => (s.pinCode && s.pinCode === pin) || (s.id && s.id.endsWith(pin)));

    if (matched) {
      const staff: StaffMember = matched;
      setUser({ uid: staff.id, displayName: staff.name, email: staff.email, photoURL: staff.avatar });
      setActiveStaff(staff);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('krown_active_session', 'true');
      }

      dataStore.logAudit(
        staff.email,
        'LOGIN',
        { method: 'PIN_CODE', staffId: staff.id, role: staff.role },
        staff.assignedBranchId || undefined,
        staff.branch || undefined,
        'PIN Login'
      );

      if (staff.role === 'Super Admin') setView('admin');
      else if (staff.role === 'Branch Manager') setView('manager');
      else if (staff.role === 'Cashier') setView('pos');
      else if (staff.role === 'Head Chef' || staff.role === 'Kitchen Staff') setView('kitchen');
      else setView('pos');

      setEmail('');
      setPassword('');
      setPin('');
      setIsSubmitting(false);
      return;
    }

    setLoginError('Invalid PIN code. Please verify your PIN or use Password Login.');
    setIsSubmitting(false);
  };

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginMode === 'pin') {
      return handlePinLogin(e);
    }

    if (!email || !password) {
      setLoginError('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    setLoginError(null);

    const cleanEmail = email.trim().toLowerCase();
    let foundStaff: StaffMember | undefined;

    let authData: any = null;
    let authError: any = null;
    try {
      const res = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      });
      authData = res.data;
      authError = res.error;
    } catch (e: any) {
      authError = e;
    }

    if (authError) {
      const offlineEntry = await verifyOfflineCredentials(cleanEmail, password);
      if (offlineEntry && offlineEntry.staff) {
        const s = offlineEntry.staff;
        foundStaff = {
          id: s.id,
          name: s.name || cleanEmail.split('@')[0],
          email: s.email || cleanEmail,
          role: s.role || 'Senior Waiter',
          branch: s.branch || 'Global HQ',
          assignedBranchId: s.assigned_branch_id || s.assignedBranchId || null,
          status: s.status || 'active',
          avatar: s.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name || 'Staff')}&background=f97316&color=fff&bold=true&size=200`,
        };
      } else if (authError.message?.toLowerCase().includes('failed to fetch') ||
                 authError.message?.toLowerCase().includes('network') ||
                 isOffline()) {
        setLoginError('OFFLINE MODE: No internet detected and no cached login for this account. Connect to the internet once to cache credentials.');
      } else {
        if (authError.message.toLowerCase().includes('invalid login credentials') ||
            authError.message.toLowerCase().includes('invalid_credentials') ||
            authError.message.toLowerCase().includes('invalid email or password')) {
          setLoginError('Wrong email or password. Please try again.');
        } else if (authError.message.toLowerCase().includes('email not confirmed')) {
          setLoginError('Please confirm your email address before logging in.');
        } else if (authError.message.toLowerCase().includes('too many requests')) {
          setLoginError('Too many login attempts. Please wait a few minutes.');
        } else {
          setLoginError(`Login error: ${authError.message}`);
        }
      }
      setIsSubmitting(false);
      return;
    }

    if (authData?.user) {
      const authUid = authData.user.id;
      const authEmail = authData.user.email?.toLowerCase() || cleanEmail;

      let dbStaff: any = null;
      const { data: byId } = await supabase.from('staff').select('*').eq('id', authUid).maybeSingle();
      if (byId) {
        dbStaff = byId;
      } else {
        const { data: byEmail } = await supabase.from('staff').select('*').eq('email', authEmail).maybeSingle();
        dbStaff = byEmail;
      }

      if (dbStaff) {
        foundStaff = {
          id: dbStaff.id,
          name: dbStaff.name || authEmail.split('@')[0],
          email: dbStaff.email || authEmail,
          role: dbStaff.role || 'Senior Waiter',
          branch: dbStaff.branch || 'Global HQ',
          assignedBranchId: dbStaff.assigned_branch_id || null,
          status: dbStaff.status || 'active',
          avatar: dbStaff.avatar ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(dbStaff.name || 'Staff')}&background=f97316&color=fff&bold=true&size=200`,
        };
      } else {
        const displayName = authData.user.user_metadata?.name || authData.user.user_metadata?.full_name || authEmail.split('@')[0];
        const assignedRole = authData.user.user_metadata?.role || (authEmail.includes('admin') ? 'Super Admin' : 'Senior Waiter');
        const assignedBranch = authData.user.user_metadata?.branch || (assignedRole === 'Super Admin' ? 'Global HQ' : 'FAZE 3');
        const assignedBranchId = authData.user.user_metadata?.assignedBranchId || null;

        foundStaff = {
          id: authUid,
          name: displayName,
          email: authEmail,
          role: assignedRole,
          branch: assignedBranch,
          assignedBranchId: assignedBranchId,
          status: 'active',
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=f97316&color=fff&bold=true&size=200`,
        };

        await supabase.from('staff').upsert({
          id: authUid,
          name: displayName,
          email: authEmail,
          role: assignedRole,
          branch: assignedBranch,
          status: 'active',
          assigned_branch_id: assignedBranchId,
          avatar: foundStaff.avatar,
          created_at: Date.now(),
        }, { onConflict: 'id' });
      }
    }

    if (foundStaff) {
      if (foundStaff.status === 'banned') {
        setLoginError('Access Denied: This staff account is BANNED by Admin.');
        await supabase.auth.signOut();
        setIsSubmitting(false);
        return;
      }

      if (foundStaff.status === 'paused') {
        setLoginError('Account On Hold: Your shift account is currently paused.');
        await supabase.auth.signOut();
        setIsSubmitting(false);
        return;
      }

      setUser({
        uid: foundStaff.id,
        displayName: foundStaff.name,
        email: foundStaff.email,
        photoURL: foundStaff.avatar,
      });
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('krown_active_session', 'true');
      }
      setActiveStaff(foundStaff);

      try {
        await storeOfflinePasswordHash(cleanEmail, password);
        await cacheOfflineAuth(foundStaff, { uid: foundStaff.id, displayName: foundStaff.name, email: foundStaff.email, photoURL: foundStaff.avatar });
      } catch { /* non-fatal */ }

      if (foundStaff.role === 'Super Admin') setView('admin');
      else if (foundStaff.role === 'Branch Manager') setView('manager');
      else if (foundStaff.role === 'Cashier') setView('pos');
      else if (foundStaff.role === 'Head Chef' || foundStaff.role === 'Kitchen Staff') setView('kitchen');
      else setView('pos');

      setEmail('');
      setPassword('');
      setPin('');
      setIsSubmitting(false);
      return;
    }

    setLoginError('Login failed. Account not found.');
    setIsSubmitting(false);
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
        <div className="w-full max-w-md bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl p-8 rounded-[2.5rem] shadow-2xl border border-black/5 dark:border-white/10 ring-1 ring-black/5 dark:ring-white/10">
          <div className="flex flex-col items-center mb-6">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-xl shadow-orange-500/30 mb-4 p-1 overflow-hidden ring-4 ring-orange-500/20 bg-gradient-to-br from-orange-500 to-amber-500">
              <img
                src="/icon.svg"
                alt="KROWN ERP Logo"
                className="w-full h-full object-contain rounded-2xl"
              />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-center">KROWN ERP</h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 text-center font-medium">
              Multi-Branch Enterprise POS & Management System
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex bg-slate-100 dark:bg-black/40 p-1 rounded-2xl mb-6 border border-black/5 dark:border-white/10">
            <button
              type="button"
              onClick={() => { setLoginMode('password'); setLoginError(null); }}
              className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all ${
                loginMode === 'password'
                  ? 'bg-white dark:bg-[#1A1A1E] text-slate-900 dark:text-white shadow-md'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Password Login
            </button>
            <button
              type="button"
              onClick={() => { setLoginMode('pin'); setLoginError(null); }}
              className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all ${
                loginMode === 'pin'
                  ? 'bg-white dark:bg-[#1A1A1E] text-slate-900 dark:text-white shadow-md'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              🔑 Staff PIN Code
            </button>
          </div>

          <form onSubmit={handleStaffLogin} className="space-y-4">
            {loginMode === 'password' ? (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Staff Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@krown.ug"
                      className="w-full bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all text-sm font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all text-sm font-medium"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Staff 4-Digit Security PIN
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="password"
                    maxLength={6}
                    required
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="Enter 4-digit PIN..."
                    className="w-full bg-slate-50 dark:bg-black/40 border border-black/5 dark:border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all text-sm font-medium tracking-widest text-center text-lg"
                  />
                </div>
              </div>
            )}

            {loginError && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-2 text-red-500 text-xs font-semibold">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-orange-500/30 transition-all active:scale-[0.98] text-center flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                loginMode === 'pin' ? 'Unlock POS with PIN' : 'Log In to Staff Dashboard'
              )}
            </button>

            {/* Google OAuth Login Button */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-black/5 dark:border-white/10" /></div>
              <div className="relative flex justify-center text-xs font-semibold uppercase"><span className="bg-white dark:bg-[#121214] px-2 text-slate-400">Or Continue With</span></div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isSubmitting}
              className="w-full bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-900 dark:text-white py-3.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-3 transition-all border border-black/5 dark:border-white/10"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Sign in with Google Account</span>
            </button>
          </form>

          {/* PWA App Install Banner */}
          <div className="mt-4">
            <button
              onClick={() => {
                alert('📱 To install KROWN ERP as an App:\n\n1. On Chrome/Android: Tap menu (⋮) -> "Install App" or "Add to Home Screen".\n2. On Safari/iOS: Tap Share icon -> "Add to Home Screen".');
              }}
              className="w-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all border border-black/5 dark:border-white/10"
            >
              📱 Install KROWN ERP Desktop/Mobile App (Offline Enabled)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {view === 'pos' && (
          <motion.div key="pos" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="h-screen w-full absolute top-0 left-0 bg-[#F4F4F6] dark:bg-[#0A0A0C]">
            <POSPage user={user} setView={handleNavigateWithAuth} activeStaff={activeStaff} />
          </motion.div>
        )}
        {view === 'cashier' && (
          <motion.div key="cashier" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="min-h-screen w-full absolute top-0 left-0 bg-[#F4F4F6] dark:bg-[#0A0A0C]">
            <CashierDashboard setView={handleNavigateWithAuth} activeStaff={activeStaff} />
          </motion.div>
        )}
        {view === 'admin' && (
          <motion.div key="admin" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="min-h-screen w-full absolute top-0 left-0 bg-[#F4F4F6] dark:bg-[#0A0A0C]">
            <AdminPage user={user} setView={handleNavigateWithAuth} />
          </motion.div>
        )}
        {view === 'manager' && (
          <motion.div key="manager" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="min-h-screen w-full absolute top-0 left-0 bg-[#F4F4F6] dark:bg-[#0A0A0C]">
            <ManagerPage user={user} setView={handleNavigateWithAuth} />
          </motion.div>
        )}
        {view === 'kitchen' && (
          <motion.div key="kitchen" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="min-h-screen w-full absolute top-0 left-0 bg-[#F4F4F6] dark:bg-[#0A0A0C]">
            <KitchenPage setView={handleNavigateWithAuth} activeStaff={activeStaff} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Role Auth Screen Modal on Navigation */}
      <AnimatePresence>
        {showAuthModal && pendingView && (
          <DashboardAuth
            targetTitle={pendingView.toUpperCase()}
            onAuthenticated={(staff) => {
              setActiveStaff(staff);
              setView(pendingView);
              setShowAuthModal(false);
              setPendingView(null);
            }}
            onCancel={() => {
              setShowAuthModal(false);
              setPendingView(null);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
