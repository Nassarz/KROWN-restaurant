'use client';

import { FormEvent, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, ShieldCheck, Store, UserRound, XCircle } from 'lucide-react';

const initialForm = {
  name: '', contactEmail: '', contactPhone: '', taxId: '', address: '',
  branchName: '', branchLocation: '', adminName: '', adminEmail: '', adminPassword: '',
};

export default function RestaurantOnboarding({ token, onDone }: { token: string; onDone?: () => void }) {
  const [form, setForm] = useState(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const update = (key: keyof typeof form, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/super-admin/orgs', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to onboard restaurant');
      setResult(data.data);
      setForm(initialForm);
    } catch (err: any) {
      setError(err.message || 'Unable to complete onboarding');
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="min-h-screen bg-[#F4F4F6] dark:bg-[#0A0A0C] p-6 flex items-center justify-center">
        <div className="w-full max-w-2xl bg-white dark:bg-[#121214] rounded-[2.5rem] p-8 shadow-2xl border border-black/5 dark:border-white/5">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center"><CheckCircle2 className="w-7 h-7 text-emerald-500" /></div>
            <div><h1 className="text-2xl font-black text-slate-900 dark:text-white">Restaurant onboarded</h1><p className="text-sm text-slate-500">The tenant and its Restaurant Admin are ready to use.</p></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            <Info label="Restaurant ID" value={result.organization?.id} />
            <Info label="Branch ID" value={result.branch?.id} />
            <Info label="Admin ID" value={result.admin?.id} />
            <Info label="Admin Email" value={result.admin?.email} />
          </div>
          <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 mb-8">
            <p className="font-bold text-emerald-700 dark:text-emerald-300">Unlimited access enabled</p>
            <p className="text-sm text-slate-500 mt-1">No subscription, trial, plan, branch cap, staff cap, menu cap, or daily order cap was created.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setResult(null); }} className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-bold">Onboard Another</button>
            <button onClick={() => onDone?.()} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-white font-bold">Back to Control Center</button>
          </div>
        </div>
      </div>
    );
  }

  const input = (key: keyof typeof form, label: string, opts: { type?: string; required?: boolean; placeholder?: string } = {}) => (
    <div>
      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">{label}{opts.required ? ' *' : ''}</label>
      <input type={opts.type || 'text'} required={opts.required} value={form[key]} onChange={e => update(key, e.target.value)} placeholder={opts.placeholder} className="w-full bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F4F4F6] dark:bg-[#0A0A0C] p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3"><div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20"><Store className="w-5 h-5 text-white" /></div><div><h1 className="text-xl font-black text-slate-900 dark:text-white">Onboard Restaurant</h1><p className="text-xs text-slate-500">Create the tenant, first branch, categories, and Restaurant Admin together.</p></div></div>
          <button onClick={() => onDone?.()} className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-white/5"><XCircle className="w-5 h-5 text-slate-400" /></button>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <section className="bg-white dark:bg-[#121214] rounded-[2rem] p-6 sm:p-8 border border-black/5 dark:border-white/5 shadow-xl">
            <div className="flex items-center gap-3 mb-5"><Store className="w-5 h-5 text-orange-500" /><div><h2 className="font-bold text-slate-900 dark:text-white">Restaurant</h2><p className="text-xs text-slate-500">Core tenant identity and contact details.</p></div></div>
            <div className="grid sm:grid-cols-2 gap-4">
              {input('name', 'Restaurant Name', { required: true, placeholder: 'e.g. KROWN Restaurant' })}
              {input('contactEmail', 'Contact Email', { type: 'email', placeholder: 'info@restaurant.com' })}
              {input('contactPhone', 'Contact Phone', { placeholder: '+256...' })}
              {input('taxId', 'Tax ID', { placeholder: 'Optional' })}
              <div className="sm:col-span-2">{input('address', 'Address', { placeholder: 'Restaurant address' })}</div>
            </div>
          </section>

          <section className="bg-white dark:bg-[#121214] rounded-[2rem] p-6 sm:p-8 border border-black/5 dark:border-white/5 shadow-xl">
            <div className="flex items-center gap-3 mb-5"><Store className="w-5 h-5 text-blue-500" /><div><h2 className="font-bold text-slate-900 dark:text-white">First Branch</h2><p className="text-xs text-slate-500">A main branch is created automatically.</p></div></div>
            <div className="grid sm:grid-cols-2 gap-4">{input('branchName', 'Branch Name', { placeholder: 'Main Branch' })}{input('branchLocation', 'Branch Location', { placeholder: 'Kampala, Uganda' })}</div>
          </section>

          <section className="bg-white dark:bg-[#121214] rounded-[2rem] p-6 sm:p-8 border border-orange-500/20 shadow-xl">
            <div className="flex items-center gap-3 mb-5"><UserRound className="w-5 h-5 text-orange-500" /><div><h2 className="font-bold text-slate-900 dark:text-white">Restaurant Admin</h2><p className="text-xs text-slate-500">Required. This account belongs only to this restaurant.</p></div></div>
            <div className="grid sm:grid-cols-2 gap-4">
              {input('adminName', 'Full Name', { required: true, placeholder: 'Restaurant administrator' })}
              {input('adminEmail', 'Email Address', { required: true, type: 'email', placeholder: 'admin@restaurant.com' })}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Password *</label>
                <div className="relative"><KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type={showPassword ? 'text' : 'password'} required minLength={8} value={form.adminPassword} onChange={e => update('adminPassword', e.target.value)} placeholder="At least 8 characters" className="w-full bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl pl-11 pr-11 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/40" /><button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div>
              </div>
            </div>
          </section>

          <div className="p-5 rounded-2xl bg-blue-500/5 border border-blue-500/15 flex gap-3"><ShieldCheck className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" /><div><p className="text-sm font-bold text-slate-900 dark:text-white">Secure & unlimited</p><p className="text-xs text-slate-500 mt-1">Each organization, branch, category, and admin receives its own UUID. Tenant data is scoped by organization ID. Passwords are stored only as Argon2id hashes. No subscription record is created.</p></div></div>
          {error && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm font-semibold text-red-600 dark:text-red-400">{error}</div>}
          <button type="submit" disabled={loading} className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black shadow-lg shadow-orange-500/20 disabled:opacity-50 flex items-center justify-center gap-2">{loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Creating securely...</> : 'Create Restaurant & Restaurant Admin'}</button>
        </form>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 mt-1 break-all">{value || '—'}</p></div>;
}
