import React, { useState, useEffect } from 'react';
import { Search, Plus, Box } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { vibrate } from '@/lib/utils';
import { User } from 'firebase/auth';
import { dataStore } from '@/lib/dataStore';
import { formatUGX } from '@/lib/mockData';

export default function ManagerInventory({ ingredients, user }: { ingredients: any[], user: User }) {
  const [search, setSearch] = useState('');
  const [activeItems, setActiveItems] = useState<any[]>(() => dataStore.getIngredients());
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    quantity: '',
    unit: 'kg',
    category: 'Produce',
    minThreshold: '10',
    costPerUnitUGX: '15000',
    supplier: 'Kampala Farmers Market'
  });

  useEffect(() => {
    const unsub = dataStore.subscribe(() => {
      setActiveItems(dataStore.getIngredients());
    });
    return () => unsub();
  }, []);

  const filtered = activeItems.filter(i => 
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.category || '').toLowerCase().includes(search.toLowerCase())
  );

  const updateQuantity = (id: string, current: number, change: number) => {
    vibrate(20);
    const newQty = Math.max(0, current + change);
    dataStore.updateIngredientQuantity(id, newQty);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.quantity) return;

    dataStore.addIngredient({
      name: formData.name,
      quantity: Number(formData.quantity),
      unit: formData.unit,
      category: formData.category,
      minThreshold: Number(formData.minThreshold),
      costPerUnitUGX: Number(formData.costPerUnitUGX),
      supplier: formData.supplier
    });

    setIsAdding(false);
    setFormData({
      name: '',
      quantity: '',
      unit: 'kg',
      category: 'Produce',
      minThreshold: '10',
      costPerUnitUGX: '15000',
      supplier: 'Kampala Farmers Market'
    });
    vibrate([30, 50]);
  };

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Stock & Inventory</h2>
          <p className="text-slate-500 font-medium">Real-time raw ingredient tracking</p>
        </div>
        <button 
          onClick={() => { vibrate(20); setIsAdding(true); }}
          className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-orange-500/20 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" /> Add Ingredient
        </button>
      </div>
      
      <div className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl border border-white/40 dark:border-white/5 shadow-2xl rounded-[2rem] p-6 ring-1 ring-black/5 dark:ring-white/10 flex-1 flex flex-col overflow-hidden">
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text"
            placeholder="Search ingredients or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 dark:bg-black/20 border border-black/5 dark:border-white/10 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto custom-scrollbar pr-2">
          {filtered.map(item => (
            <div key={item.id} className="bg-slate-50 dark:bg-black/20 p-5 rounded-2xl border border-black/5 dark:border-white/5 flex items-center justify-between shadow-sm hover:border-orange-500/30 transition-all">
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 dark:text-white text-base">{item.name}</h4>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <span className="bg-slate-200 dark:bg-white/10 px-2 py-0.5 rounded-md">{item.unit}</span>
                  {item.costPerUnitUGX && <span>{formatUGX(item.costPerUnitUGX)}/unit</span>}
                </div>
                {item.quantity <= (item.minThreshold || 5) && (
                  <p className="text-[11px] font-bold text-red-500 animate-pulse">⚠️ Low Stock Warning</p>
                )}
              </div>
              <div className="flex items-center gap-2 bg-white dark:bg-[#121214] rounded-2xl p-1.5 shadow-sm border border-black/5 dark:border-white/10">
                <button onClick={() => updateQuantity(item.id, item.quantity, -1)} className="w-8 h-8 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors text-lg">-</button>
                <span className="font-bold w-10 text-center dark:text-white text-base">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.id, item.quantity, 1)} className="w-8 h-8 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors text-lg">+</button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="col-span-full text-slate-500 text-center py-12">No inventory ingredients found.</p>}
        </div>
      </div>

      {/* Add Ingredient Modal */}
      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#121214] w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl border border-black/5 dark:border-white/10"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-orange-500/10 text-orange-500 rounded-xl flex items-center justify-center font-bold">
                  <Box className="w-5 h-5" />
                </div>
                <h3 className="text-2xl font-bold dark:text-white">Add New Ingredient</h3>
              </div>
              <form onSubmit={handleAddSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Ingredient Name</label>
                  <input required placeholder="e.g. Matooke Bunches, Tilapia Fillets" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border dark:border-white/10 rounded-xl p-3.5 bg-slate-50 dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Initial Quantity</label>
                    <input required type="number" min="0" placeholder="50" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} className="w-full border dark:border-white/10 rounded-xl p-3.5 bg-slate-50 dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Unit</label>
                    <select value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full border dark:border-white/10 rounded-xl p-3.5 bg-slate-50 dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none">
                      <option value="kg">kg</option>
                      <option value="Liters">Liters</option>
                      <option value="Bunches">Bunches</option>
                      <option value="Pieces">Pieces</option>
                      <option value="Packs">Packs</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Cost per Unit (UGX)</label>
                    <input type="number" placeholder="15000" value={formData.costPerUnitUGX} onChange={e => setFormData({...formData, costPerUnitUGX: e.target.value})} className="w-full border dark:border-white/10 rounded-xl p-3.5 bg-slate-50 dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Min Warning Threshold</label>
                    <input type="number" placeholder="10" value={formData.minThreshold} onChange={e => setFormData({...formData, minThreshold: e.target.value})} className="w-full border dark:border-white/10 rounded-xl p-3.5 bg-slate-50 dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Supplier Name</label>
                  <input placeholder="Supplier" value={formData.supplier} onChange={e => setFormData({...formData, supplier: e.target.value})} className="w-full border dark:border-white/10 rounded-xl p-3.5 bg-slate-50 dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsAdding(false)} className="flex-1 py-4 font-bold rounded-2xl bg-slate-100 dark:bg-white/5 dark:text-white hover:bg-slate-200">Cancel</button>
                  <button type="submit" className="flex-1 py-4 font-bold rounded-2xl bg-orange-500 text-white hover:bg-orange-600 shadow-lg shadow-orange-500/20">Save Ingredient</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
