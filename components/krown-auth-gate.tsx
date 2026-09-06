'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { KeyRound, ShieldCheck, ScanLine, Smartphone, LockKeyhole, Eye, EyeOff, AlertCircle, RefreshCw } from 'lucide-react';
import { activateDevice, createDeviceProof, getDeviceId } from '@/lib/device-auth-client';

type StaffProfile = {
  id: string;
  name: string;
  email: string;
  role: string;
  branch?: string;
  assignedBranchId?: string | null;
  status?: string;
  avatar?: string;
};

function roleView(role: string) {
  const normalized = String(role).toLowerCase();
  if (normalized === 'super_admin' || normalized === 'admin' || normalized === 'super admin') return 'super_admin';
  if (normalized === 'restaurant_admin' || normalized === 'restaurant admin') return 'admin';
  if (normalized === 'branch_manager' || normalized === 'manager' || normalized === 'branch manager') return 'manager';
  if (normalized === 'cashier') return 'cashier';
  if (normalized === 'head_chef' || normalized === 'chef' || normalized === 'kitchen_staff' || normalized === 'kitchen staff') return 'kitchen';
  return 'pos';
}

export function KrownAuthGate() {
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'pin' | 'password' | 'activate'>('pin');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [activationPin, setActivationPin] = useState('');
  const [scanAvailable, setScanAvailable] = useState(false);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setDeviceId(getDeviceId());
    setScanAvailable(typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia);
    return () => {
      if (scanTimerRef.current) window.clearInterval(scanTimerRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const isActivated = !!deviceId;
  const pinHint = useMemo(() => isActivated ? 'Enter your staff PIN' : 'This terminal must be activated first', [isActivated]);

  function finishLogin(staff: StaffProfile, token: string, returnedDeviceId?: string | null) {
    if (token) localStorage.setItem('krown_session_token', token);
    localStorage.setItem('krown_staff_profile', JSON.stringify(staff));
    sessionStorage.setItem('krown_active_session', 'true');
    if (returnedDeviceId) setDeviceId(returnedDeviceId);
    window.location.reload();
  }

  async function handlePinLogin() {
    if (!/^\d{4,6}$/.test(pin)) {
      setError('Enter your 4–6 digit PIN.');
      return;
    }
    if (!isActivated) {
      setError('This terminal is not activated. Activate it with a one-time device PIN or QR code first.');
      setMode('activate');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const proof = await createDeviceProof(deviceId!);
      const response = await fetch('/api/auth/pin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, deviceId, challenge: proof.challenge, signature: proof.signature }),
      });
      const json = await response.json();
      if (!response.ok || !json?.data?.staff || !json?.data?.token) throw new Error(json?.error || 'Invalid PIN');
      const s = json.data.staff;
      finishLogin({
        id: s.id, name: s.name || 'Staff', email: s.email || '', role: s.role,
        branch: s.branch || 'Global HQ', assignedBranchId: s.assigned_branch_id || s.assignedBranchId || null,
        status: s.status || 'active', avatar: s.avatar,
      }, json.data.token, json.data.deviceId);
    } catch (e: any) {
      setError(e?.message || 'Unable to sign in securely.');
    } finally {
      setBusy(false);
    }
  }

  async function handleAdminPinLogin() {
    if (!/^\d{4,6}$/.test(pin)) {
      setError('Enter your 4–6 digit PIN.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/pin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const json = await response.json();
      if (!response.ok || !json?.data?.staff || !json?.data?.token) throw new Error(json?.error || 'Invalid PIN');
      const s = json.data.staff;
      finishLogin({ id: s.id, name: s.name || 'Admin', email: s.email || '', role: s.role, branch: s.branch || 'Global HQ', assignedBranchId: s.assigned_branch_id || null, status: s.status || 'active', avatar: s.avatar }, json.data.token);
    } catch (e: any) {
      setError(e?.message || 'Unable to sign in with PIN.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePasswordLogin() {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const json = await response.json();
      if (!response.ok || !json?.data?.staff || !json?.data?.token) throw new Error(json?.error || 'Wrong email or password');
      const s = json.data.staff;
      finishLogin({ id: s.id, name: s.name || email.split('@')[0], email: s.email || email, role: s.role, branch: s.branch || 'Global HQ', assignedBranchId: s.assigned_branch_id || null, status: s.status || 'active', avatar: s.avatar }, json.data.token);
    } catch (e: any) {
      setError(e?.message || 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }

  async function activate() {
    const cleaned = activationPin.trim().replace(/^KROWN-ACTIVATE:/i, '');
    if (!/^\d{8}$/.test(cleaned)) {
      setError('Enter the 8-digit activation PIN generated by the Super Admin.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const data = await activateDevice(cleaned);
      setDeviceId(data.id);
      setActivationPin('');
      setMode('pin');
      setError('');
    } catch (e: any) {
      setError(e?.message || 'Device activation failed.');
    } finally {
      setBusy(false);
    }
  }

  async function startScanner() {
    if (!scanAvailable || scanning) return;
    setScanning(true);
    setError('');
    try {
      const Detector = (window as any).BarcodeDetector;
      const detector = new Detector({ formats: ['qr_code'] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream;
      if (!videoRef.current) throw new Error('Camera preview unavailable');
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      scanTimerRef.current = window.setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        try {
          const results = await detector.detect(videoRef.current);
          const value = results?.[0]?.rawValue;
          if (value) {
            setActivationPin(value);
            stopScanner();
            await activate();
          }
        } catch { /* camera frame may not be decodable yet */ }
      }, 300);
    } catch (e: any) {
      setScanning(false);
      setError(e?.message || 'Camera access was unavailable. Use the activation PIN instead.');
    }
  }

  function stopScanner() {
    if (scanTimerRef.current) window.clearInterval(scanTimerRef.current);
    scanTimerRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setScanning(false);
  }

  return (
    <div className="fixed inset-0 z-[9999] min-h-screen flex items-center justify-center bg-[#F4F4F6] dark:bg-[#08080A] p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-[2rem] bg-white/90 dark:bg-[#121216]/95 backdrop-blur-2xl border border-black/5 dark:border-white/10 shadow-2xl p-6 sm:p-8">
        <div className="flex flex-col items-center text-center mb-7">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 p-1 shadow-xl shadow-orange-500/25 mb-4">
            <Image src="/icon.svg" alt="KROWN ERP" width={64} height={64} className="w-full h-full rounded-xl object-contain" priority />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">KROWN ERP</h1>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Secure restaurant staff access</p>
        </div>

        <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-black/30 mb-6">
          <button onClick={() => { setMode('pin'); setError(''); }} className={`py-3 rounded-xl text-xs font-black transition ${mode === 'pin' ? 'bg-white dark:bg-[#1D1D22] shadow text-slate-900 dark:text-white' : 'text-slate-500'}`}>PIN</button>
          <button onClick={() => { setMode('password'); setError(''); }} className={`py-3 rounded-xl text-xs font-black transition ${mode === 'password' ? 'bg-white dark:bg-[#1D1D22] shadow text-slate-900 dark:text-white' : 'text-slate-500'}`}>Email + Password</button>
          <button onClick={() => { setMode('activate'); setError(''); }} className={`py-3 rounded-xl text-xs font-black transition ${mode === 'activate' ? 'bg-white dark:bg-[#1D1D22] shadow text-slate-900 dark:text-white' : 'text-slate-500'}`}>Activate</button>
        </div>

        {mode === 'pin' && (
          <div className="space-y-5">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5" /> {isActivated ? 'Device ready' : 'Device activation required'}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">{pinHint}</p>
            </div>
            <input autoFocus inputMode="numeric" pattern="[0-9]*" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} onKeyDown={e => e.key === 'Enter' && handlePinLogin()} placeholder="••••" className="w-full text-center tracking-[0.45em] text-3xl font-black bg-slate-50 dark:bg-black/30 border border-black/5 dark:border-white/10 rounded-2xl py-5 outline-none focus:ring-2 focus:ring-orange-500/40" />
            <button disabled={busy} onClick={handlePinLogin} className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black shadow-lg shadow-orange-500/25 disabled:opacity-60">{busy ? 'Verifying…' : 'Unlock with PIN'}</button>
            {!isActivated && <button onClick={() => setMode('activate')} className="w-full py-3 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 text-xs font-bold">Activate this device</button>}
            <p className="text-[11px] text-center text-slate-400">Staff PIN login never asks waiters, kitchen staff, or cashiers for a username or email.</p>
          </div>
        )}

        {mode === 'password' && (
          <div className="space-y-4">
            <div className="relative"><input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Email address" className="w-full rounded-2xl bg-slate-50 dark:bg-black/30 border border-black/5 dark:border-white/10 px-4 py-4 text-sm outline-none focus:ring-2 focus:ring-orange-500/40" /></div>
            <div className="relative"><input value={password} onChange={e => setPassword(e.target.value)} type={showPassword ? 'text' : 'password'} placeholder="Password" onKeyDown={e => e.key === 'Enter' && handlePasswordLogin()} className="w-full rounded-2xl bg-slate-50 dark:bg-black/30 border border-black/5 dark:border-white/10 px-4 py-4 pr-12 text-sm outline-none focus:ring-2 focus:ring-orange-500/40" /><button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">{showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button></div>
            <button disabled={busy} onClick={handlePasswordLogin} className="w-full py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black disabled:opacity-60">{busy ? 'Signing in…' : 'Sign in with Email + Password'}</button>
            <p className="text-[11px] text-center text-slate-400">PIN is the primary KROWN login. Email + password remains available when required.</p>
          </div>
        )}

        {mode === 'activate' && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-blue-500/10 border border-blue-500/20 p-4 text-xs text-blue-700 dark:text-blue-300">
              <div className="font-black flex items-center gap-2"><Smartphone className="w-4 h-4" /> Register this terminal</div>
              <p className="mt-1 opacity-80">A Super Admin creates a one-time activation PIN for the restaurant and branch, then assigns the device type and staff roles allowed on it.</p>
            </div>
            <input autoFocus inputMode="numeric" maxLength={8} value={activationPin} onChange={e => setActivationPin(e.target.value.replace(/\D/g, ''))} placeholder="8-digit activation PIN" className="w-full text-center tracking-[0.25em] text-xl font-black bg-slate-50 dark:bg-black/30 border border-black/5 dark:border-white/10 rounded-2xl py-4 outline-none focus:ring-2 focus:ring-orange-500/40" />
            <button disabled={busy} onClick={activate} className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black disabled:opacity-60">{busy ? 'Activating…' : 'Activate Device'}</button>
            {scanAvailable && <button onClick={scanning ? stopScanner : startScanner} className="w-full py-3 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center gap-2"><ScanLine className="w-4 h-4" /> {scanning ? 'Stop QR Scanner' : 'Scan Activation QR'}</button>}
            {scanning && <video ref={videoRef} muted playsInline className="w-full aspect-square object-cover rounded-2xl bg-black" />}
            <button onClick={() => setMode('pin')} className="w-full text-xs font-bold text-slate-500">Back to PIN login</button>
          </div>
        )}

        {error && <div className="mt-5 rounded-2xl bg-red-500/10 border border-red-500/20 p-3.5 text-xs font-bold text-red-600 dark:text-red-400 flex gap-2"><AlertCircle className="w-4 h-4 shrink-0" /> <span>{error}</span></div>}
        {busy && <RefreshCw className="w-4 h-4 animate-spin text-orange-500 mx-auto mt-4" />}
        <div className="mt-6 pt-5 border-t border-black/5 dark:border-white/10 text-center text-[10px] text-slate-400 flex items-center justify-center gap-1"><LockKeyhole className="w-3 h-3" /> Server-verified authentication • No Google sign-in</div>
      </div>
    </div>
  );
}
