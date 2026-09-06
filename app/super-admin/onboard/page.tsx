'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import RestaurantOnboarding from '@/components/restaurant-onboarding';

export default function SuperAdminOnboardPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const value = localStorage.getItem('krown_session_token');
    if (!value) {
      router.replace('/');
      return;
    }
    fetch('/api/auth/session', { headers: { Authorization: `Bearer ${value}` } })
      .then(async res => {
        if (!res.ok) throw new Error('Unauthorized');
        const json = await res.json();
        if (json?.session?.user?.role !== 'super_admin') throw new Error('Super Admin access required');
        setToken(value);
      })
      .catch(() => {
        localStorage.removeItem('krown_session_token');
        localStorage.removeItem('krown_staff_profile');
        router.replace('/');
      });
  }, [router]);

  if (!token) return <div className="min-h-screen bg-[#F4F4F6] dark:bg-[#0A0A0C]" />;
  return <RestaurantOnboarding token={token} onDone={() => router.push('/super-admin')} />;
}
