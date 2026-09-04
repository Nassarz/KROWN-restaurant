'use client';

import React, { useState } from 'react';
import SuperAdminPage from '@/components/super-admin';
import { useRouter } from 'next/navigation';

function readCachedUser(): any {
  try {
    const raw = localStorage.getItem('krown_staff_profile');
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export default function SuperAdminRootPage() {
  const router = useRouter();
  const [user] = useState<any>(() => readCachedUser());

  const handleSetView = (v: string) => {
    if (v === 'admin') router.push('/');
  };

  return <SuperAdminPage user={user} setView={handleSetView as any} activeStaff={user} initialTab="dashboard" />;
}
