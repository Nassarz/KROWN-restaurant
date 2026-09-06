'use client';

import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ChevronDown, Copy, Check, X, Plus, Smartphone, ShieldCheck } from 'lucide-react';

const ROLE_OPTIONS = [
  ['cashier', 'Cashier'],
  ['waiter', 'Waiter'],
  ['senior_waiter', 'Senior Waiter'],
  ['head_chef', 'Head Chef'],
  ['kitchen_staff', 'Kitchen Staff'],
  ['branch_manager', 'Branch Manager'],
  ['restaurant_admin', 'Restaurant Admin'],
];

const TYPE_OPTIONS = [
  ['pos', 'POS Terminal'],
  ['waiter_tablet', 'Waiter Tablet'],
  ['kitchen', 'Kitchen Display'],
  ['manager_desk', 'Manager Desk'],
  ['admin_desk', 'Admin Desk'],
  ['tablet', 'General Tablet'],
  ['mobile', 'Mobile'],
  ['general', 'General'],
];

export function KrownDeviceCenter({ activeStaff }: { activeStaff: any }) {
  const [open, setOpen] = useState(false);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [deviceType, setDeviceType] = useState('pos');
  const [allowedRoles, setAllowedRoles] = useState<string[]>(['cashier']);
  const [activation, setActivation] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('krown_session_token') || '' : '';
  const isSuperAdmin = String(activeStaff?.role || '').toLowerCase() === 'super_admin' || String(activeStaff?.role || '').toLowerCase() === 'super admin';
  const filteredBranches = useMemo(() => branches.filter(b => !organizationId || b.organization_id === organizationId), [branches, organizationId]);

  useEffect(() => {
    if (!isSuperAdmin || !open) return;
    fetch('/api/devices/setup-options', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d?.data) {
          setOrgs(d.data.organizations || []);
          setBranches(d.data.branches || []);
          if (!organizationId && d.data.organizations?.[0]?.id) setOrganizationId(d.data.organizations[0].id);
        }
      })
      .catch(() => {});
  }, [isSuperAdmin, open, token]);

  useEffect(() => {
    if (organizationId && !filteredBranches.some(b => b.id === branchId)) setBranchId(filteredBranches[0]?.id || '');
  }, [organizationId, filteredBranches, branchId]);

  if (!isSuperAdmin) return null;

  function toggleRole(role: string) {
    setAllowedRoles(current => current.includes(role) ? current.filter(r => r !== role) : [...current, role]);
  }

  async function createActivation() {
    if (!organizationId || !branchId || !deviceName.trim() || allowedRoles.length === 0) return;
    setBusy(true); setActivation(null);
    try {
      const res = await fetch('/api/devices/enrollment-token', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId, deviceName: deviceName.trim(), deviceType, allowedRoles }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Unable to create activation');
      setActivation(json.data);
    } catch (e: any) {
      alert(e?.message || 'Unable to create device activation');
    } finally { setBusy(false); }
  }

  async function copyPin() {
    if (!activation?.activationPin) return;
    await navigator.clipboard.writeText(activation.activationPin);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="fixed right-5 bottom-5 z-[7000] flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xl text-xs font-black">
        <Smartphone className="w-4 h-4" /> Device Center
      </button>

      {open && <div className="fixed inset-0 z-[8000] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-[2rem] bg-white dark:bg-[#121216] shadow-2xl border border-black/5 dark:border-white/10 p-6">
          <div className="flex items-start justify-between mb-6">
            <div><h2 className="text-2xl font-black text-slate-900 dark:text-white">Device Center</h2><p className="text-xs text-slate-500 mt-1">Register a terminal to the exact restaurant, branch and staff roles it may serve.</p></div>
            <button onClick={() => setOpen(false)} className="p-2 rounded-xl bg-slate-100 dark:bg-white/5"><X className="w-5 h-5" /></button>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div className="space-y-4">
              <label className="block text-xs font-black text-slate-500 uppercase">Restaurant
                <select value={organizationId} onChange={e => setOrganizationId(e.target.value)} className="mt-2 w-full rounded-xl bg-slate-50 dark:bg-white/5 px-3 py-3 text-sm font-bold">
                  <option value="">Select restaurant</option>{orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </label>
              <label className="block text-xs font-black text-slate-500 uppercase">Branch
                <select value={branchId} onChange={e => setBranchId(e.target.value)} className="mt-2 w-full rounded-xl bg-slate-50 dark:bg-white/5 px-3 py-3 text-sm font-bold">
                  <option value="">Select branch</option>{filteredBranches.map(b => <option key={b.id} value={b.id}>{b.name}{b.location ? ` — ${b.location}` : ''}</option>)}
                </select>
              </label>
              <label className="block text-xs font-black text-slate-500 uppercase">Device name
                <input value={deviceName} onChange={e => setDeviceName(e.target.value)} placeholder="Front Counter POS 01" className="mt-2 w-full rounded-xl bg-slate-50 dark:bg-white/5 px-3 py-3 text-sm font-bold" />
              </label>
              <label className="block text-xs font-black text-slate-500 uppercase">Device type
                <select value={deviceType} onChange={e => setDeviceType(e.target.value)} className="mt-2 w-full rounded-xl bg-slate-50 dark:bg-white/5 px-3 py-3 text-sm font-bold">
                  {TYPE_OPTIONS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
            </div>

            <div>
              <div className="text-xs font-black text-slate-500 uppercase mb-2">Allowed staff roles</div>
              <div className="grid grid-cols-2 gap-2">
                {ROLE_OPTIONS.map(([v,l]) => <button key={v} onClick={() => toggleRole(v)} className={`text-left rounded-xl px-3 py-3 text-xs font-bold border transition ${allowedRoles.includes(v) ? 'border-orange-500 bg-orange-500/10 text-orange-600' : 'border-black/5 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-500'}`}><span className="flex items-center gap-2">{allowedRoles.includes(v) ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}{l}</span></button>)}
              </div>
              <button disabled={busy || !branchId || !deviceName.trim() || allowedRoles.length === 0} onClick={createActivation} className="mt-5 w-full rounded-xl py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black disabled:opacity-50">{busy ? 'Generating secure activation…' : 'Generate Device Activation'}</button>
            </div>
          </div>

          {activation && <div className="mt-6 grid md:grid-cols-[220px_1fr] gap-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
            <div className="flex flex-col items-center gap-3"><div className="bg-white p-3 rounded-2xl"><QRCodeSVG value={activation.qrPayload} size={190} level="M" marginSize={4} title="KROWN device activation QR" /></div><span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">Scan on new device</span></div>
            <div className="space-y-3"><div className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white"><ShieldCheck className="w-5 h-5 text-emerald-500" /> Activation ready</div><p className="text-xs text-slate-500">{activation.branchName} • {activation.deviceName} • expires in 10 minutes</p><div className="rounded-xl bg-white dark:bg-black/30 border border-black/5 dark:border-white/10 p-4"><div className="text-[10px] font-black uppercase text-slate-400">One-time activation PIN</div><div className="flex items-center justify-between gap-3 mt-1"><span className="text-3xl font-black tracking-[0.25em] text-slate-900 dark:text-white">{activation.activationPin}</span><button onClick={copyPin} className="p-2 rounded-xl bg-slate-100 dark:bg-white/5">{copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}</button></div></div><p className="text-[10px] text-slate-400">The PIN is one-time and short-lived. Only its SHA-256 digest is stored server-side.</p></div>
          </div>}
        </div>
      </div>}
    </>
  );
}
