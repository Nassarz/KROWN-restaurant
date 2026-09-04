'use client';

import React, { useState, useEffect } from 'react';
import SuperAdminPage from '@/components/super-admin';
import { useRouter, useParams } from 'next/navigation';

export default function SuperAdminSectionPage() {
  const router = useRouter();
  const params = useParams();
  const rawSection = params?.section as string;
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

  const tabMapping: Record<string, any> = {
    analytics: 'analytics',
    restaurants: 'restaurants',
    users: 'users',
    devices: 'devices',
    security: 'security',
    support: 'support',
    notifications: 'notifications',
    billing: 'billing',
    admins: 'admins',
    system: 'system-health',
    settings: 'platform-settings',
  };

  const initialTab = tabMapping[rawSection] || 'dashboard';

  const handleSetView = (v: string) => {
    if (v === 'admin') router.push('/');
  };

  return <SuperAdminPage user={user} setView={handleSetView as any} activeStaff={user} initialTab={initialTab} />;
}
