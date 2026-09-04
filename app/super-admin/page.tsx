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
    // Validate session with API
    fetch('/api/auth/session', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(json => {
        if (json?.session?.user) {
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

  return <SuperAdminPage user={user} setView={handleSetView as any} activeStaff={user} initialTab="dashboard" />;
}
