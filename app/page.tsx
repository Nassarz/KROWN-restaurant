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
          // OFFLINE: Supabase unreachable — restore from the local offline cache
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
          else if (staff.role === 'Cashier') setView('pos'); // Cashier goes straight to POS / Table Management
          else if (staff.role === 'Head Chef' || staff.role === 'Kitchen Staff') setView('kitchen');
          else setView('pos');
        }
      } catch (err) {
        console.warn('[Supabase Session] Restore error:', err);
      } finally {
        setLoading(false);
      }
    };

    // Check existing session on mount (Enforce Auto-Logout on Browser/Tab Close or Shutdown)
    const isTabSessionActive = typeof window !== 'undefined' && sessionStorage.getItem('krown_active_session') === 'true';

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !isTabSessionActive) {
        // Browser or tab was closed/reopened or machine restarted -> Auto Log Out
        supabase.auth.signOut().then(() => {
          setUser(null);
          setActiveStaff(null);
          setView('pos');
          setLoading(false);
        });
      } else {
        restoreStaffSession(session?.user ?? null);
      }
    });

    // Listen for auth changes (login/logout from other tabs)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setActiveStaff(null);
        setView('pos');
        setLoading(false);
      }
      // Don't re-run on SIGNED_IN — login handler already handles it
    });

    return () => subscription.unsubscribe();
  }, []);



  const handleNavigateWithAuth = (targetView: 'pos' | 'admin' | 'manager' | 'kitchen' | 'cashier') => {
    const role = activeStaff?.role;

    // Super Admin has unrestricted access to all dashboards
    if (role === 'Super Admin') {
      setView(targetView);
      return;
    }

    // Branch Manager has full seamless access to Manager, POS, Cashier, Kitchen without auth prompts
    if (role === 'Branch Manager') {
      if (targetView === 'admin') {
        alert('Access Denied: Branch Managers cannot access Super Admin Global HQ Settings.');
        return;
      }
      setView(targetView);
      return;
    }

    // Cashier has full seamless access to POS (Table Management) and Cashier Portal without auth prompts
    if (role === 'Cashier') {
      if (targetView === 'admin' || targetView === 'manager') {
        alert('Access Denied: Cashier accounts cannot access Manager or Admin dashboards.');
        return;
      }
      setView(targetView);
      return;
    }

    // Role-Level Access Validation Policy (RLS Guard)
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

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setLoginError('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    setLoginError(null);

    const cleanEmail = email.trim().toLowerCase();
    let foundStaff: StaffMember | undefined;

    // Step 1: Authenticate via Supabase Auth (the single source of truth)
    // OFFLINE MODE: during an internet blackout, verify against the cached
    // credentials stored on this device from the last successful login.
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
      // Network failure or invalid credentials — try the offline cache
      const offlineEntry = await verifyOfflineCredentials(cleanEmail, password);
      if (offlineEntry && offlineEntry.staff) {
        const s = offlineEntry.staff;
        const staff: StaffMember = {
          id: s.id,
          name: s.name || cleanEmail.split('@')[0],
          email: s.email || cleanEmail,
          role: s.role || 'Senior Waiter',
          branch: s.branch || 'Global HQ',
          assignedBranchId: s.assigned_branch_id || s.assignedBranchId || null,
          status: s.status || 'active',
          avatar: s.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name || 'Staff')}&background=f97316&color=fff&bold=true&size=200`,
        };
        foundStaff = staff;
        console.warn('[OFFLINE AUTH] Verified from local cache — operating without internet.');
      } else if (authError.message?.toLowerCase().includes('failed to fetch') ||
                 authError.message?.toLowerCase().includes('network') ||
                 isOffline()) {
        setLoginError('OFFLINE MODE: No internet detected and no cached login for this account. Connect to the internet once to cache your credentials, or check the connection.');
      } else {
        // Supabase Auth rejected the credentials — surface the correct error
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

      // Step 2: Fetch staff profile — first by UID (most reliable), then by email
      let dbStaff: any = null;

      // Try by UID (staff.id = auth user UID)
      const { data: byId } = await supabase
        .from('staff')
        .select('*')
        .eq('id', authUid)
        .maybeSingle();
      
      if (byId) {
        dbStaff = byId;
      } else {
        // Fallback: query by email
        const { data: byEmail } = await supabase
          .from('staff')
          .select('*')
          .eq('email', authEmail)
          .maybeSingle();
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
        // No staff record exists yet — auto-create a profile from the auth user's metadata
        const displayName = authData.user.user_metadata?.name ||
          authData.user.user_metadata?.full_name ||
          authEmail.split('@')[0];

        const assignedRole = authData.user.user_metadata?.role ||
          (authEmail.includes('admin') ? 'Super Admin' : 'Senior Waiter');

        const assignedBranch = authData.user.user_metadata?.branch ||
          (assignedRole === 'Super Admin' ? 'Global HQ' : 'FAZE 3');

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

        // Persist the auto-created profile to the staff table
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

    // Step 3: Validate found staff profile
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

      // Cache credentials + profile for offline login during internet blackouts
      try {
        await storeOfflinePasswordHash(cleanEmail, password);
        await cacheOfflineAuth(foundStaff, { uid: foundStaff.id, displayName: foundStaff.name, email: foundStaff.email, photoURL: foundStaff.avatar });
      } catch { /* non-fatal */ }

      // Auto-route to the correct dashboard by role
      if (foundStaff.role === 'Super Admin') setView('admin');
      else if (foundStaff.role === 'Branch Manager') setView('manager');
      else if (foundStaff.role === 'Cashier') setView('pos'); // Cashiers go straight to Table Management (POS)
      else if (foundStaff.role === 'Head Chef' || foundStaff.role === 'Kitchen Staff') setView('kitchen');
      else setView('pos');

      setIsSubmitting(false);
      return;
    }

    setLoginError('Login failed. Your account may not have been set up in the system yet. Contact your admin.');
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

          <form onSubmit={handleStaffLogin} className="space-y-4">
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
                'Log In to Staff Dashboard'
              )}
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
