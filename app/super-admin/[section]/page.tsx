'use client';

import React, { useState, useEffect } from 'react';
import SuperAdminPage from '@/components/super-admin';
import { useRouter, useParams } from 'next/navigation';

export default function SuperAdminSectionPage() {
  const router = useRouter();
  const params = useParams();
  const rawSection = params?.section as string;
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const rawUser = localStorage.getItem('krown_staff_profile');
    if (rawUser) {
      try {
        setUser(JSON.parse(rawUser));
      } catch {}
    }
  }, []);

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
