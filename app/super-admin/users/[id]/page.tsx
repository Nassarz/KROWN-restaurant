'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, User, Mail, Phone, Shield, Clock, AlertTriangle, KeyRound, Lock, CheckCircle, Ban } from 'lucide-react';

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params?.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('krown_session_token') || '';
    if (!token) {
      router.replace('/');
      return;
    }
    fetch(`/api/super-admin/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => {
        if (d.data) setData(d.data);
        else if (d.error === 'Unauthorized') {
          localStorage.removeItem('krown_session_token');
          localStorage.removeItem('krown_staff_profile');
          router.replace('/');
        } else setError(d.error || 'Failed to load user profile');
        setLoading(false);
      })
      .catch(e => {
        setError(e.message || 'Network error');
        setLoading(false);
      });
  }, [userId, router]);

  return (
    <div className="min-h-screen bg-[#F4F4F6] dark:bg-[#0A0A0C] p-6 lg:p-10 font-sans">
      <header className="mb-6">
        <button onClick={() => router.push('/super-admin/users')} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white font-bold text-sm">
          <ChevronLeft className="w-4 h-4" /> Back to Users
        </button>
      </header>

      {loading ? (
        <div className="animate-pulse space-y-4 max-w-4xl mx-auto">
          <div className="h-20 bg-slate-200 dark:bg-white/5 rounded-3xl" />
          <div className="h-64 bg-slate-200 dark:bg-white/5 rounded-3xl" />
        </div>
      ) : error || !data?.user ? (
        <div className="max-w-xl mx-auto py-16 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{error || 'User not found'}</h2>
          <button onClick={() => router.push('/super-admin/users')} className="px-4 py-2 bg-orange-500 text-white font-bold rounded-xl text-sm">Return to Users</button>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="bg-white/80 dark:bg-[#121214]/80 border border-white/40 dark:border-white/5 rounded-[2.5rem] p-8 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-orange-500/20">
                {data.user.name?.charAt(0)}
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{data.user.name}</h1>
                <p className="text-xs text-slate-500">{data.user.email} &middot; {data.user.phone || 'No phone'} &middot; {data.user.organization_name || 'No organization'}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px] font-bold uppercase tracking-wider">
                    {data.user.role?.replace(/_/g, ' ')}
                  </span>
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${data.user.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                    {data.user.status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white/80 dark:bg-[#121214]/80 border border-white/40 dark:border-white/5 rounded-[2rem] p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Active Sessions</h3>
              {data.sessions?.length > 0 ? (
                <div className="space-y-2">
                  {data.sessions.map((s: any) => (
                    <div key={s.id} className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 text-xs text-slate-600 dark:text-slate-400 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{s.device_info || 'Unknown Browser/Device'}</p>
                        <p className="text-[10px] text-slate-500">IP: {s.ip_address || 'Unknown'}</p>
                      </div>
                      <span className="text-[10px] text-emerald-500 font-bold">Active</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-500 py-4">No active sessions</p>}
            </div>

            <div className="bg-white/80 dark:bg-[#121214]/80 border border-white/40 dark:border-white/5 rounded-[2rem] p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Recent Audit Activity</h3>
              {data.auditEvents?.length > 0 ? (
                <div className="space-y-2">
                  {data.auditEvents.map((a: any) => (
                    <div key={a.id} className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 text-xs">
                      <p className="font-bold text-slate-900 dark:text-white">{a.action}</p>
                      <p className="text-[10px] text-slate-500">{new Date(a.created_at).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-500 py-4">No audit logs recorded</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
