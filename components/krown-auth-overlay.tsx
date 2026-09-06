'use client';

import { useEffect, useState } from 'react';
import { KrownAuthGate } from '@/components/krown-auth-gate';

export function KrownAuthOverlay() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (window.location.pathname !== '/') return;
    const sync = () => {
      const authenticated = !!localStorage.getItem('krown_session_token') && !!localStorage.getItem('krown_staff_profile');
      setShow(!authenticated);
    };
    sync();
    const timer = window.setTimeout(sync, 250);
    return () => window.clearTimeout(timer);
  }, []);

  if (!show) return null;
  return <KrownAuthGate />;
}
