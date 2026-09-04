'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Shield, ChevronLeft, Store, Users, Smartphone, ShoppingBag, DollarSign, Activity, AlertTriangle, CheckCircle, Ban, RefreshCw } from 'lucide-react';

export default function RestaurantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params?.id as string;

  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('krown_session_token') || '';
    if (!token) {
      router.replace('/');
      return;
    }
    fetch(`/api/super-admin/orgs/${orgId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => {
        if (d.data) setOrg(d.data);
        else if (d.error === 'Unauthorized') {
          localStorage.removeItem('krown_session_token');
          localStorage.removeItem('krown_staff_profile');
          router.replace('/');
        } else setError(d.error || 'Failed to load restaurant details');
        setLoading(false);
      })
      .catch(e => {
        setError(e.message || 'Network error');
        setLoading(false);
      });
  }, [orgId, router]);

  return (
    <div className="min-h-screen bg-[#F4F4F6] dark:bg-[#0A0A0C] p-6 lg:p-10 font-sans">
      <header className="mb-6 flex items-center justify-between">
        <button onClick={() => router.push('/super-admin/restaurants')} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white font-bold text-sm">
          <ChevronLeft className="w-4 h-4" /> Back to Restaurants
        </button>
      </header>

      {loading ? (
        <div className="animate-pulse space-y-4 max-w-4xl mx-auto">
          <div className="h-20 bg-slate-200 dark:bg-white/5 rounded-3xl" />
          <div className="h-64 bg-slate-200 dark:bg-white/5 rounded-3xl" />
        </div>
      ) : error || !org ? (
        <div className="max-w-xl mx-auto py-16 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{error || 'Restaurant not found'}</h2>
          <button onClick={() => router.push('/super-admin/restaurants')} className="px-4 py-2 bg-orange-500 text-white font-bold rounded-xl text-sm">Return to Restaurants</button>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="bg-white/80 dark:bg-[#121214]/80 border border-white/40 dark:border-white/5 rounded-[2.5rem] p-8 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-orange-500/20">
                {org.name?.charAt(0)}
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{org.name}</h1>
                <p className="text-xs text-slate-500">{org.contact_email} &middot; {org.contact_phone || 'No phone'} &middot; {org.tax_id ? `Tax ID: ${org.tax_id}` : 'No Tax ID'}</p>
                <span className={`inline-block mt-2 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${org.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                  {org.status}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white/80 dark:bg-[#121214]/80 border border-white/40 dark:border-white/5 rounded-3xl p-6">
              <Store className="w-6 h-6 text-orange-500 mb-2" />
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{org.branchCount || 0}</p>
              <p className="text-xs text-slate-500">Branches</p>
            </div>
            <div className="bg-white/80 dark:bg-[#121214]/80 border border-white/40 dark:border-white/5 rounded-3xl p-6">
              <Users className="w-6 h-6 text-blue-500 mb-2" />
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{org.staffCount || 0}</p>
              <p className="text-xs text-slate-500">Staff Members</p>
            </div>
            <div className="bg-white/80 dark:bg-[#121214]/80 border border-white/40 dark:border-white/5 rounded-3xl p-6">
              <Smartphone className="w-6 h-6 text-purple-500 mb-2" />
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{org.deviceCount || 0}</p>
              <p className="text-xs text-slate-500">Devices</p>
            </div>
            <div className="bg-white/80 dark:bg-[#121214]/80 border border-white/40 dark:border-white/5 rounded-3xl p-6">
              <ShoppingBag className="w-6 h-6 text-emerald-500 mb-2" />
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{org.orderCount || 0}</p>
              <p className="text-xs text-slate-500">Total Orders</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
