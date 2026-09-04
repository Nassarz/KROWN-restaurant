'use client';

import React, { useState } from 'react';
import SuperAdminPage from '@/components/super-admin';
import { useRouter, useParams } from 'next/navigation';

function readCachedUser(): any {
  try {
    const raw = localStorage.getItem('krown_staff_profile');
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export default function SuperAdminSectionPage() {
  const router = useRouter();
  const params = useParams();
  const rawSection = params?.section as string;
  const [user] = useState<any>(() => readCachedUser());

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
