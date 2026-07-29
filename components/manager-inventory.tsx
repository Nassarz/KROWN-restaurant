import React, { useState } from 'react';
import { db } from '@/lib/firebase';
import { updateDoc, doc } from 'firebase/firestore';
import { Search } from 'lucide-react';
import { vibrate } from '@/lib/utils';
import { User } from 'firebase/auth';
import { logAudit } from '@/lib/audit';

export default function ManagerInventory({ ingredients, user }: { ingredients: any[], user: User }) {
  const [search, setSearch] = useState('');

  const filtered = ingredients.filter(i => 
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  const updateQuantity = async (id: string, current: number, change: number) => {
    vibrate(20);
    const newQty = Math.max(0, current + change);
    await updateDoc(doc(db, 'ingredients', id), { quantity: newQty });
    logAudit(user.email || 'unknown', 'UPDATE_INVENTORY', { ingredientId: id, old: current, new: newQty });
  };

  return (
    <div className="flex flex-col h-full gap-6">
      <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Inventory</h2>
      
      <div className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl border border-white/40 dark:border-white/5 shadow-2xl rounded-[2rem] p-6 ring-1 ring-black/5 dark:ring-white/10 flex-1 flex flex-col">
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text"
            placeholder="Search inventory..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 dark:bg-black/20 border border-black/5 dark:border-white/10 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto custom-scrollbar">
          {filtered.map(item => (
            <div key={item.id} className="bg-slate-50 dark:bg-black/20 p-4 rounded-2xl border border-black/5 dark:border-white/5 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white">{item.name}</h4>
                <p className="text-sm font-medium text-slate-500">{item.unit}</p>
              </div>
              <div className="flex items-center gap-3 bg-white dark:bg-[#121214] rounded-xl p-1 shadow-sm border border-black/5 dark:border-white/10">
                <button onClick={() => updateQuantity(item.id, item.quantity, -1)} className="w-8 h-8 flex items-center justify-center font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">-</button>
                <span className="font-bold w-8 text-center dark:text-white">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.id, item.quantity, 1)} className="w-8 h-8 flex items-center justify-center font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">+</button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="col-span-full text-slate-500 text-center py-8">No ingredients found.</p>}
        </div>
      </div>
    </div>
  );
}
