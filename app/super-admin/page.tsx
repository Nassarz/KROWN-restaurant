'use client';

import React, { useState, useEffect } from 'react';
import SuperAdminPage from '@/components/super-admin';
import { useRouter } from 'next/navigation';

export default function SuperAdminRootPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const rawUser = localStorage.getItem('krown_staff_profile');
    if (rawUser) {
      try {
        setUser(JSON.parse(rawUser));
      } catch {}
    }
  }, []);

  const handleSetView = (v: string) => {
    if (v === 'admin') router.push('/');
  };

  return <SuperAdminPage user={user} setView={handleSetView as any} activeStaff={user} initialTab="dashboard" />;
}
