'use client';

import { useEffect, useState } from 'react';
import { KrownDeviceCenter } from '@/components/krown-device-center';

export function KrownDeviceCenterOverlay() {
  const [staff, setStaff] = useState<any>(null);
  useEffect(() => {
    const sync = () => {
      try { setStaff(JSON.parse(localStorage.getItem('krown_staff_profile') || 'null')); } catch { setStaff(null); }
    };
    sync();
    window.addEventListener('storage', sync);
    const timer = window.setInterval(sync, 1500);
    return () => { window.removeEventListener('storage', sync); window.clearInterval(timer); };
  }, []);
  return <KrownDeviceCenter activeStaff={staff} />;
}
