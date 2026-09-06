'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Shield, ChevronLeft, Store, Users, Smartphone, ShoppingBag, AlertTriangle, Plus, X, Ban, UserX, UserCheck, Trash2, Loader2 } from 'lucide-react';

const ROLES = [
  { value: 'admin', label: 'Admin / Restaurant Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'cashier', label: 'Cashier' },
  { value: 'waiter', label: 'Waiter' },
  { value: 'kitchen_staff', label: 'Kitchen Staff' },
];

export default function RestaurantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params?.id as string;
  const [org, setOrg] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'cashier', password: '', assignedBranchId: '' });

  const token = () => localStorage.getItem('krown_session_token') || '';
  const headers = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

  const loadUsers = async () => {
    setUsersLoading(true); setUserError(null);
    try {
      const r = await fetch(`/api/super-admin/users?organizationId=${encodeURIComponent(orgId)}&limit=100`, { headers: headers() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to load restaurant users');
      setUsers(d.data || []);
    } catch (e: any) { setUserError(e.message || 'Failed to load users'); }
    finally { setUsersLoading(false); }
  };

  const loadRestaurant = async () => {
    setLoading(true); setError(null);
    try {
      const [orgRes, branchRes] = await Promise.all([
        fetch(`/api/super-admin/orgs/${orgId}`, { headers: headers() }),
        fetch(`/api/branches?organizationId=${encodeURIComponent(orgId)}`, { headers: headers() }),
      ]);
      const orgJson = await orgRes.json();
      if (!orgRes.ok || !orgJson.data) throw new Error(orgJson.error || 'Failed to load restaurant details');
      setOrg(orgJson.data);
      if (branchRes.ok) { const b = await branchRes.json(); setBranches(b.data || b.branches || []); }
      await loadUsers();
    } catch (e: any) { setError(e.message || 'Network error'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const t = token();
    if (!t) { router.replace('/'); return; }
    loadRestaurant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, router]);

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault(); setSavingUser(true); setUserError(null);
    try {
      const r = await fetch('/api/super-admin/users', { method: 'POST', headers: headers(), body: JSON.stringify({ ...form, organizationId: orgId, assignedBranchId: form.assignedBranchId || null }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to create user');
      setShowAddUser(false);
      setForm({ name: '', email: '', phone: '', role: 'cashier', password: '', assignedBranchId: '' });
      await loadUsers();
    } catch (e: any) { setUserError(e.message || 'Failed to create user'); }
    finally { setSavingUser(false); }
  };

  const userAction = async (id: string, action: 'suspend' | 'ban' | 'activate' | 'restore') => {
    if (!window.confirm(`${action === 'ban' ? 'Ban' : action === 'suspend' ? 'Suspend' : 'Activate'} this user?`)) return;
    setActionLoading(id + action);
    try {
      const r = await fetch(`/api/super-admin/users/${id}`, { method: 'PATCH', headers: headers(), body: JSON.stringify({ action }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Action failed');
      await loadUsers();
    } catch (e: any) { setUserError(e.message || 'Action failed'); }
    finally { setActionLoading(null); }
  };

  const deleteUser = async (id: string) => {
    if (!window.confirm('Delete this user? Their account will be disabled and retained for audit/history.')) return;
    setActionLoading(id + 'delete');
    try {
      const r = await fetch(`/api/super-admin/users/${id}`, { method: 'DELETE', headers: headers() });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Delete failed');
      await loadUsers();
    } catch (e: any) { setUserError(e.message || 'Delete failed'); }
    finally { setActionLoading(null); }
  };

  if (loading) return <div className="min-h-screen bg-[#F4F4F6] dark:bg-[#0A0A0C] p-10"><div className="max-w-5xl mx-auto animate-pulse space-y-4"><div className="h-24 bg-slate-200 dark:bg-white/5 rounded-3xl"/><div className="h-64 bg-slate-200 dark:bg-white/5 rounded-3xl"/></div></div>;
  if (error || !org) return <div className="min-h-screen bg-[#F4F4F6] dark:bg-[#0A0A0C] p-10 text-center"><AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4"/><h2 className="text-xl font-bold text-slate-900 dark:text-white">{error || 'Restaurant not found'}</h2></div>;

  return (
    <div className="min-h-screen bg-[#F4F4F6] dark:bg-[#0A0A0C] p-6 lg:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <button onClick={() => router.push('/super-admin/restaurants')} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white font-bold text-sm"><ChevronLeft className="w-4 h-4"/>Back to Restaurants</button>
          <button onClick={() => setShowAddUser(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 text-white font-bold text-sm shadow-lg shadow-orange-500/20"><Plus className="w-4 h-4"/>Add User</button>
        </header>

        <section className="bg-white/80 dark:bg-[#121214]/80 border border-white/40 dark:border-white/5 rounded-[2.5rem] p-8 shadow-xl flex items-center justify-between gap-6">
          <div className="flex items-center gap-4"><div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white font-bold text-2xl">{org.name?.charAt(0)}</div><div><h1 className="text-2xl font-black text-slate-900 dark:text-white">{org.name}</h1><p className="text-xs text-slate-500">{org.contact_email} · {org.contact_phone || 'No phone'}</p><span className="inline-block mt-2 px-3 py-1 rounded-lg text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-500">{org.status}</span></div></div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[['Branches',org.branch_count || 0,Store],['Staff Members',org.staff_count || 0,Users],['Devices',org.device_count || 0,Smartphone],['Total Orders',org.order_count || 0,ShoppingBag]].map(([label,value,Icon]: any) => <div key={label} className="bg-white/80 dark:bg-[#121214]/80 border border-white/40 dark:border-white/5 rounded-3xl p-6"><Icon className="w-6 h-6 text-orange-500 mb-2"/><p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p><p className="text-xs text-slate-500">{label}</p></div>)}
        </div>

        <section className="bg-white/80 dark:bg-[#121214]/80 border border-white/40 dark:border-white/5 rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-slate-200/70 dark:border-white/5 flex items-center justify-between"><div><h2 className="text-lg font-black text-slate-900 dark:text-white">Restaurant Users</h2><p className="text-xs text-slate-500 mt-1">Manage Admins, Managers, Cashiers, Waiters and Kitchen Staff</p></div><button onClick={loadUsers} className="text-xs font-bold text-orange-500">Refresh</button></div>
          {userError && <div className="m-4 p-3 rounded-xl bg-red-500/10 text-red-600 text-sm font-semibold">{userError}</div>}
          {usersLoading ? <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-500"/></div> : users.length === 0 ? <div className="p-12 text-center text-sm text-slate-500">No users yet. Add the Restaurant Admin first.</div> : <div className="divide-y divide-slate-200/70 dark:divide-white/5">{users.map(u => <div key={u.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div className="min-w-0"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center font-bold text-slate-700 dark:text-white">{u.name?.charAt(0)}</div><div><p className="font-bold text-slate-900 dark:text-white">{u.name}</p><p className="text-xs text-slate-500">{u.email}{u.branch_name ? ` · ${u.branch_name}` : ''}</p></div></div><div className="mt-2 flex gap-2"><span className="px-2 py-1 rounded-lg bg-blue-500/10 text-blue-600 text-[10px] font-bold uppercase">{String(u.role).replace(/_/g,' ')}</span><span className="px-2 py-1 rounded-lg bg-slate-500/10 text-slate-500 text-[10px] font-bold uppercase">{u.status}</span></div></div><div className="flex flex-wrap gap-2">{u.status === 'active' ? <><button onClick={() => userAction(u.id,'suspend')} disabled={!!actionLoading} className="px-3 py-2 rounded-xl bg-amber-500/10 text-amber-700 text-xs font-bold"><UserX className="inline w-3.5 h-3.5 mr-1"/>Suspend</button><button onClick={() => userAction(u.id,'ban')} disabled={!!actionLoading} className="px-3 py-2 rounded-xl bg-red-500/10 text-red-600 text-xs font-bold"><Ban className="inline w-3.5 h-3.5 mr-1"/>Ban</button></> : <button onClick={() => userAction(u.id,'activate')} disabled={!!actionLoading} className="px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-600 text-xs font-bold"><UserCheck className="inline w-3.5 h-3.5 mr-1"/>Activate</button>}<button onClick={() => deleteUser(u.id)} disabled={!!actionLoading} className="px-3 py-2 rounded-xl bg-red-500/10 text-red-600 text-xs font-bold"><Trash2 className="inline w-3.5 h-3.5 mr-1"/>Delete</button></div></div>)}</div>}
        </section>
      </div>

      {showAddUser && <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"><form onSubmit={createUser} className="w-full max-w-lg bg-white dark:bg-[#151517] rounded-3xl p-6 shadow-2xl space-y-4"><div className="flex items-center justify-between"><div><h2 className="text-xl font-black text-slate-900 dark:text-white">Add Restaurant User</h2><p className="text-xs text-slate-500">Create login credentials and assign a role.</p></div><button type="button" onClick={() => setShowAddUser(false)}><X className="w-5 h-5"/></button></div><input required placeholder="Full name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="w-full rounded-xl border p-3 bg-transparent"/><input required type="email" placeholder="Email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="w-full rounded-xl border p-3 bg-transparent"/><input placeholder="Phone" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} className="w-full rounded-xl border p-3 bg-transparent"/><select value={form.role} onChange={e=>setForm({...form,role:e.target.value})} className="w-full rounded-xl border p-3 bg-transparent">{ROLES.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}</select>{branches.length > 0 && <select value={form.assignedBranchId} onChange={e=>setForm({...form,assignedBranchId:e.target.value})} className="w-full rounded-xl border p-3 bg-transparent"><option value="">All / no specific branch</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select>}<input required minLength={8} type="password" placeholder="Password (minimum 8 characters)" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} className="w-full rounded-xl border p-3 bg-transparent"/><button disabled={savingUser} className="w-full rounded-xl bg-orange-500 text-white p-3 font-bold flex items-center justify-center gap-2">{savingUser && <Loader2 className="w-4 h-4 animate-spin"/>}{savingUser ? 'Creating…' : 'Create User'}</button></form></div>}
    </div>
  );
}
