import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Plus, Edit3, Image as ImageIcon, Loader2 } from 'lucide-react';
import { vibrate } from '@/lib/utils';
import { User } from 'firebase/auth';
import { formatUGX } from '@/lib/mockData';
import { dataStore } from '@/lib/dataStore';

export default function ManagerMenu({ products, user }: { products: any[], user: User }) {
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState<any | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [displayProducts, setDisplayProducts] = useState<any[]>(() => dataStore.getProducts());

  useEffect(() => {
    const unsub = dataStore.subscribe(() => {
      setDisplayProducts(dataStore.getProducts());
    });
    return () => unsub();
  }, []);

  const [formData, setFormData] = useState({
    name: '',
    price: '',
    category: 'mains',
    image: '',
  });
  const [uploading, setUploading] = useState(false);

  const filteredProducts = displayProducts.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    (p.category || '').toLowerCase().includes(search.toLowerCase())
  );

  const toggleProductAvailability = (id: string) => {
    vibrate(40);
    dataStore.toggleProductAvailability(id);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const form = new FormData();
    form.append('image', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: form
      });
      const data = await res.json();
      if (data.url) {
        setFormData(prev => ({ ...prev, image: data.url }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.price) return;

    if (isEditing) {
      dataStore.updateProduct(isEditing.id, {
        name: formData.name,
        price: parseFloat(formData.price),
        category: formData.category as any,
        image: formData.image,
      });
    } else {
      dataStore.addProduct({
        name: formData.name,
        price: parseFloat(formData.price),
        category: formData.category as any,
        image: formData.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
      });
    }

    setIsEditing(null);
    setIsAdding(false);
    setFormData({ name: '', price: '', category: 'mains', image: '' });
    vibrate([30, 50]);
  };

  const openEdit = (product: any) => {
    setIsEditing(product);
    setFormData({
      name: product.name,
      price: product.price.toString(),
      category: product.category || '',
      image: product.image || ''
    });
  };

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex justify-between items-end">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Menu Management</h2>
        <button 
          onClick={() => { setIsAdding(true); setFormData({ name: '', price: '', category: '', image: '' }); }}
          className="bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-xl font-bold flex items-center gap-2"
        >
          <Plus className="w-5 h-5" /> Add Item
        </button>
      </div>

      <div className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl border border-white/40 dark:border-white/5 shadow-2xl rounded-[2rem] p-6 ring-1 ring-black/5 dark:ring-white/10 flex-1 overflow-hidden flex flex-col">
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text"
            placeholder="Search menu items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 dark:bg-black/20 border border-black/5 dark:border-white/10 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto custom-scrollbar pr-2">
          {filteredProducts.map(product => (
            <div key={product.id} className="bg-slate-50 dark:bg-black/20 p-4 rounded-2xl border border-black/5 dark:border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-3xl bg-white dark:bg-black/40 w-12 h-12 rounded-xl flex items-center justify-center shadow-sm overflow-hidden">
                  {product.image?.startsWith('http') ? (
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <span>{product.image}</span>
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">{product.name}</h4>
                  <p className="text-sm font-semibold text-orange-500">
                    {formatUGX(product.price)} <span className="text-[10px] text-slate-400 font-medium">(VAT Inclusive)</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEdit(product)}
                  className="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-300 transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => toggleProductAvailability(product.id)}
                  className={`w-14 h-8 rounded-full transition-colors flex items-center px-1 ${product.available !== false ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                >
                  <motion.div 
                    className="w-6 h-6 bg-white rounded-full shadow-sm"
                    animate={{ x: product.available !== false ? 24 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {(isAdding || isEditing) && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#121214] w-full max-w-md rounded-[2rem] p-6 shadow-2xl"
            >
              <h3 className="text-2xl font-bold mb-6 dark:text-white">{isEditing ? 'Edit Item' : 'Add Item'}</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-slate-300">Name</label>
                  <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border dark:border-white/10 rounded-xl p-3 bg-slate-50 dark:bg-black/20 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-slate-300">Price UGX (18% URA VAT Inclusive) *</label>
                  <input required type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full border dark:border-white/10 rounded-xl p-3 bg-slate-50 dark:bg-black/20 dark:text-white font-bold" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-slate-300">Category</label>
                  <input required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full border dark:border-white/10 rounded-xl p-3 bg-slate-50 dark:bg-black/20 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-slate-300">Image (Upload or Emoji)</label>
                  <div className="flex gap-2">
                    <input value={formData.image} onChange={e => setFormData({...formData, image: e.target.value})} className="flex-1 border dark:border-white/10 rounded-xl p-3 bg-slate-50 dark:bg-black/20 dark:text-white" />
                    <label className="w-12 h-12 bg-slate-200 dark:bg-white/10 rounded-xl flex items-center justify-center cursor-pointer hover:bg-slate-300 transition-colors">
                      {uploading ? <Loader2 className="w-5 h-5 animate-spin dark:text-white" /> : <ImageIcon className="w-5 h-5 dark:text-white" />}
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                  </div>
                  {formData.image.startsWith('http') && (
                    <img src={formData.image} alt="Preview" className="w-16 h-16 object-cover rounded-xl mt-2" />
                  )}
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => { setIsAdding(false); setIsEditing(null); }} className="flex-1 py-3 font-bold rounded-xl bg-slate-100 dark:bg-white/5 dark:text-white hover:bg-slate-200">Cancel</button>
                  <button type="submit" disabled={loading || uploading} className="flex-1 py-3 font-bold rounded-xl bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50">Save</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
