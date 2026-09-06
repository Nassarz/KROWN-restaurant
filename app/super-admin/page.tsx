'use client';

import React, { useState, useEffect } from 'react';
import SuperAdminPage from '@/components/super-admin';
import { useRouter } from 'next/navigation';

export default function SuperAdminRootPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('krown_session_token');
    if (!token) {
      router.replace('/');
      return;
    }
    fetch('/api/auth/session', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(json => {
        if (json?.session?.user?.role === 'super_admin') {
          setUser(json.session.user);
          setReady(true);
        } else {
          localStorage.removeItem('krown_session_token');
          localStorage.removeItem('krown_staff_profile');
          router.replace('/');
        }
      })
      .catch(() => {
        localStorage.removeItem('krown_session_token');
        localStorage.removeItem('krown_staff_profile');
        router.replace('/');
      });
  }, [router]);

  if (!ready) return null;

  const handleSetView = (v: string) => {
    if (v === 'admin') router.push('/');
  };

  return (
    <>
      <SuperAdminPage user={user} setView={handleSetView as any} activeStaff={user} initialTab="dashboard" />
      <button
        type="button"
        onClick={() => router.push('/super-admin/onboard')}
        className="fixed bottom-6 right-6 z-[60] rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-white shadow-2xl shadow-orange-500/30 hover:bg-orange-600 active:scale-95 transition-all"
      >
        + Onboard Restaurant
      </button>
    </>
  );
}
