'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, Grid, UtensilsCrossed, ShoppingCart, Clock, 
  Settings, Plus, Minus, Search, LogOut, Shield, Sun, Moon, Store, Check, CreditCard, Banknote, Smartphone
} from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy, doc, updateDoc, where } from 'firebase/firestore';
import { signOut, User } from 'firebase/auth';
import { vibrate } from '@/lib/utils';
import { placeOrderAtomic } from '@/lib/transactions';
import { useNotification } from '@/hooks/use-notification';
import { printTicket } from '@/lib/printer';

const CATEGORIES = [
  { id: 'pizza', name: 'Pizza', icon: '🍕' },
  { id: 'burger', name: 'Burger', icon: '🍔' },
  { id: 'sushi', name: 'Sushi', icon: '🍣' },
  { id: 'drinks', name: 'Drinks', icon: '🍹' },
  { id: 'dessert', name: 'Dessert', icon: '🍰' }
];

export default function POSPage({ user, setView }: { user: User, setView: (v: 'pos' | 'admin' | 'manager' | 'kitchen') => void }) {
  const [activeCategory, setActiveCategory] = useState('pizza');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [viewState, setViewState] = useState<'tables' | 'menu' | 'payment'>('tables');
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const { notify } = useNotification();
  
  // Track orders to see when they turn "ready"
  const [myOrders, setMyOrders] = useState<any[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    if (typeof window !== 'undefined') {
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const hasDarkClass = document.documentElement.classList.contains('dark');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsDark(hasDarkClass || isSystemDark);
    }
  }, []);

  // Fetch products
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'products'), (snapshot) => {
      const prods: any[] = [];
      snapshot.forEach(d => prods.push({ id: d.id, ...d.data() }));
      setProducts(prods);
    });
    return () => unsub();
  }, []);

  // Listen for "ready" orders for this staff
  useEffect(() => {
    if (!user.uid) return;
    const q = query(collection(db, 'orders'), where('userId', '==', user.uid), where('status', '==', 'ready'));
    let prevReadyIds = new Set<string>();

    const unsub = onSnapshot(q, (snapshot) => {
      const currentReady = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const currentReadyIds = new Set(currentReady.map(o => o.id));

      // Find newly ready orders
      const newReady = currentReady.filter(o => !prevReadyIds.has(o.id));
      if (newReady.length > 0) {
        notify('ready'); // Vibrate & chime
        newReady.forEach(order => {
          console.log("Order is ready! Printing customer receipt:", order.id);
          printTicket('receipt', order); // Print the final customer receipt
          // Acknowledge the ready status by moving it to 'served' (or another final state)
          // In a real flow, a waiter explicitly taps "Served", but we'll auto-ack here for demo
          updateDoc(doc(db, 'orders', order.id), { status: 'served' });
        });
      }
      
      prevReadyIds = currentReadyIds;
      setMyOrders(currentReady);
    });

    return () => unsub();
  }, [user.uid, notify]);

  const toggleTheme = () => {
    vibrate(20);
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const addToCart = (product: any) => {
    vibrate(10);
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    vibrate(10);
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQ = item.quantity + delta;
        return newQ > 0 ? { ...item, quantity: newQ } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax = subtotal * 0.1;
  const total = subtotal + tax;

  const submitOrder = async () => {
    if (cart.length === 0 || !activeTable) return;
    setIsProcessing(true);
    
    try {
      const orderData = {
        total,
        tax,
        type: 'Dine In',
        restaurantId: 'default-restaurant',
        userId: user.uid,
        table: activeTable,
      };

      // Atomic function includes stock validation and ledger entry
      await placeOrderAtomic(orderData, cart);
      
      vibrate([50, 100, 50]);
      setCart([]);
      setActiveTable(null);
      setViewState('tables');
    } catch (e: any) {
      console.error('Error placing order:', e);
      alert('Order failed: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredProducts = products.filter(p => 
    (activeCategory === 'all' || p.category === activeCategory) &&
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    p.available !== false
  );

  // Mock Tables
  const tables = Array.from({ length: 12 }, (_, i) => ({ id: `T${i+1}`, status: i % 4 === 0 ? 'occupied' : 'free' }));

  if (!mounted) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F4F6] dark:bg-[#0A0A0C] font-sans selection:bg-orange-500/30">
      {/* Sidebar Navigation */}
      <nav className="w-20 lg:w-24 bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl border-r border-black/5 dark:border-white/5 flex flex-col items-center py-8 z-10 shrink-0">
        <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/30 mb-8">
          <UtensilsCrossed className="w-6 h-6 text-white" />
        </div>
        
        <div className="flex flex-col gap-4 w-full px-4">
           <button 
            onClick={() => { vibrate(20); setViewState('tables'); }}
            className={`flex flex-col items-center justify-center gap-1.5 w-full py-3 rounded-2xl transition-all duration-300 relative group ${viewState === 'tables' ? 'text-orange-500 bg-orange-500/10' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5'}`}
          >
            <Grid className="w-5 h-5 stroke-[2]" />
            <span className="text-[10px] font-medium tracking-wide">Tables</span>
          </button>
          <button 
            onClick={() => { vibrate(20); setViewState('menu'); }}
            className={`flex flex-col items-center justify-center gap-1.5 w-full py-3 rounded-2xl transition-all duration-300 relative group ${viewState === 'menu' ? 'text-orange-500 bg-orange-500/10' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5'}`}
          >
            <ShoppingCart className="w-5 h-5 stroke-[2]" />
            <span className="text-[10px] font-medium tracking-wide">Order</span>
          </button>
          
          <button 
            onClick={() => { vibrate(30); setView('kitchen'); }}
            className="flex flex-col items-center justify-center gap-1.5 w-full py-3 rounded-2xl transition-all duration-300 relative group text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
          >
            <Clock className="w-5 h-5 stroke-[2]" />
            <span className="text-[10px] font-medium tracking-wide">Kitchen</span>
          </button>
          
          {user.email === 'walusansa1nassarz@gmail.com' && (
            <button 
              onClick={() => { vibrate(30); setView('admin'); }}
              className="flex flex-col items-center justify-center gap-1.5 w-full py-3 rounded-2xl transition-all duration-300 relative group text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
            >
              <Shield className="w-5 h-5 stroke-[2]" />
              <span className="text-[10px] font-medium tracking-wide">Admin</span>
            </button>
          )}

           <button 
              onClick={() => { vibrate(30); setView('manager'); }}
              className="flex flex-col items-center justify-center gap-1.5 w-full py-3 rounded-2xl transition-all duration-300 relative group text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
            >
              <Store className="w-5 h-5 stroke-[2]" />
              <span className="text-[10px] font-medium tracking-wide">Manager</span>
            </button>
        </div>

        <div className="mt-auto px-4 flex flex-col items-center gap-4 w-full">
          <button onClick={toggleTheme} className="text-slate-400 hover:text-orange-500 transition-colors p-2">
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button onClick={() => { vibrate(40); signOut(auth); }} className="text-slate-400 hover:text-red-500 transition-colors p-2">
            <LogOut className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-white dark:ring-white/10 shadow-md bg-slate-200 flex items-center justify-center">
            <span className="text-lg font-bold text-slate-600">{user?.displayName?.charAt(0) || 'S'}</span>
          </div>
        </div>
      </nav>

      {/* Main Area */}
      <main className="flex-1 min-w-0 flex flex-col h-full relative">
        <AnimatePresence mode="wait">
          
          {/* TABLES VIEW */}
          {viewState === 'tables' && (
            <motion.div key="tables" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex-1 p-6 lg:p-10 flex flex-col h-full">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-8 tracking-tight">Select a Table</h2>
              <div className="grid grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-6">
                {tables.map(t => (
                  <button 
                    key={t.id}
                    onClick={() => { 
                      if(t.status === 'free') {
                        vibrate(20); 
                        setActiveTable(t.id); 
                        setViewState('menu'); 
                      } else {
                        vibrate([20, 20]);
                        alert("Table is already occupied");
                      }
                    }}
                    className={`aspect-square rounded-[2rem] flex flex-col items-center justify-center gap-2 text-2xl font-bold shadow-xl transition-all active:scale-[0.98] border-2 ${
                      t.status === 'occupied' 
                        ? 'bg-slate-100 dark:bg-white/5 border-transparent text-slate-400 opacity-60 cursor-not-allowed'
                        : 'bg-white dark:bg-[#121214] border-black/5 dark:border-white/10 text-slate-900 dark:text-white hover:border-orange-500/50 hover:shadow-orange-500/10'
                    }`}
                  >
                    <span>{t.id}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* MENU VIEW */}
          {viewState === 'menu' && (
             <motion.div key="menu" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col h-full relative">
              <header className="px-6 lg:px-10 pt-8 pb-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-1">
                      {activeTable ? `Table ${activeTable}` : 'New Order'}
                    </h1>
                    <p className="text-slate-500 font-medium">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                  </div>
                  <div className="relative max-w-sm w-full group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                    <input 
                      type="text" 
                      placeholder="Search menu..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10 rounded-full py-4 pl-12 pr-6 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 shadow-sm transition-all text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Categories */}
                <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 mask-linear-fade">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => { vibrate(15); setActiveCategory(cat.id); }}
                      className={`flex items-center gap-3 px-6 py-4 rounded-full font-bold whitespace-nowrap transition-all active:scale-[0.98] ${
                        activeCategory === cat.id 
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg shadow-black/10 dark:shadow-white/10' 
                          : 'bg-white dark:bg-[#121214] text-slate-500 border border-black/5 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
                      }`}
                    >
                      <span className="text-xl">{cat.icon}</span>
                      {cat.name}
                    </button>
                  ))}
                </div>
              </header>

              <div className="flex-1 overflow-y-auto px-6 lg:px-10 pb-8 custom-scrollbar">
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                  <AnimatePresence>
                    {filteredProducts.map(product => (
                      <motion.button
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        key={product.id}
                        onClick={() => addToCart(product)}
                        className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-xl rounded-[2rem] p-4 flex flex-col items-center text-center gap-4 transition-all hover:shadow-xl hover:shadow-black/5 border border-black/5 dark:border-white/5 active:scale-95 group h-full"
                      >
                        <div className="w-full aspect-square bg-slate-50 dark:bg-black/20 rounded-2xl mb-4 overflow-hidden flex items-center justify-center relative shadow-inner">
                          {product.image?.startsWith('http') ? (
                            <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                          ) : (
                            <span className="text-6xl group-hover:scale-110 transition-transform duration-500">{product.image}</span>
                          )}
                        </div>
                        <div className="mt-auto w-full flex flex-col items-start text-left">
                          <h3 className="font-bold text-slate-900 dark:text-white text-lg leading-tight mb-1 line-clamp-2">{product.name}</h3>
                          <div className="flex w-full items-center justify-between mt-2">
                            <p className="text-orange-500 font-bold text-xl">${product.price.toFixed(2)}</p>
                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-500 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                              <Plus className="w-4 h-4" />
                            </div>
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </AnimatePresence>
                </div>
                {filteredProducts.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                    <Search className="w-12 h-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium">No items found</p>
                  </div>
                )}
              </div>
             </motion.div>
          )}

          {/* PAYMENT VIEW */}
          {viewState === 'payment' && (
             <motion.div key="payment" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex-1 p-6 lg:p-10 flex flex-col h-full items-center justify-center">
              <div className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl border border-white/40 dark:border-white/5 shadow-2xl rounded-[3rem] p-10 ring-1 ring-black/5 dark:ring-white/10 max-w-2xl w-full flex flex-col items-center">
                 <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">Complete Payment</h2>
                 <p className="text-slate-500 mb-8 text-xl">Total: <span className="font-bold text-orange-500">${total.toFixed(2)}</span></p>
                 
                 <div className="grid grid-cols-2 gap-4 w-full mb-8">
                    <button onClick={() => submitOrder()} className="py-6 bg-slate-50 dark:bg-white/5 rounded-3xl border-2 border-transparent hover:border-orange-500/50 hover:bg-orange-50 dark:hover:bg-orange-500/10 flex flex-col items-center gap-3 transition-all active:scale-95">
                      <CreditCard className="w-8 h-8 text-slate-600 dark:text-slate-300" />
                      <span className="font-bold text-slate-900 dark:text-white">Credit Card</span>
                    </button>
                    <button onClick={() => submitOrder()} className="py-6 bg-slate-50 dark:bg-white/5 rounded-3xl border-2 border-transparent hover:border-orange-500/50 hover:bg-orange-50 dark:hover:bg-orange-500/10 flex flex-col items-center gap-3 transition-all active:scale-95">
                      <Banknote className="w-8 h-8 text-slate-600 dark:text-slate-300" />
                      <span className="font-bold text-slate-900 dark:text-white">Cash</span>
                    </button>
                    <button onClick={() => submitOrder()} className="py-6 bg-slate-50 dark:bg-white/5 rounded-3xl border-2 border-transparent hover:border-orange-500/50 hover:bg-orange-50 dark:hover:bg-orange-500/10 flex flex-col items-center gap-3 transition-all active:scale-95">
                      <Smartphone className="w-8 h-8 text-slate-600 dark:text-slate-300" />
                      <span className="font-bold text-slate-900 dark:text-white">Mobile Pay</span>
                    </button>
                 </div>
                 <button onClick={() => setViewState('menu')} className="text-slate-500 font-bold hover:text-slate-900 dark:hover:text-white">Cancel</button>
              </div>
             </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Cart Sidebar */}
      {(viewState === 'menu' || viewState === 'tables') && (
        <aside className="w-80 lg:w-[400px] bg-white/90 dark:bg-[#121214]/90 backdrop-blur-2xl border-l border-black/5 dark:border-white/5 shadow-2xl flex flex-col h-full z-20 shrink-0 transform transition-transform">
          <div className="p-6 border-b border-black/5 dark:border-white/5">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Current Order</h2>
            {activeTable && <p className="text-slate-500 font-medium">Table {activeTable}</p>}
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            <AnimatePresence>
              {cart.map(item => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20, scale: 0.9 }}
                  key={item.id} 
                  className="flex items-center gap-4 bg-slate-50 dark:bg-black/20 p-3 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm"
                >
                  <div className="text-3xl bg-white dark:bg-black/40 w-12 h-12 rounded-xl flex items-center justify-center shadow-sm overflow-hidden">
                    {item.image?.startsWith('http') ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : item.image}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-900 dark:text-white truncate">{item.name}</h4>
                    <p className="text-orange-500 font-bold">${(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2 bg-white dark:bg-black/40 p-1 rounded-xl border border-black/5 dark:border-white/5">
                    <button onClick={() => updateQuantity(item.id, -1)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition-all">
                      <Minus className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                    </button>
                    <span className="w-4 text-center font-bold text-sm text-slate-900 dark:text-white">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, 1)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition-all">
                      <Plus className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {cart.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 opacity-50 py-20">
                <ShoppingCart className="w-12 h-12" />
                <p className="font-medium text-lg">Your cart is empty</p>
              </div>
            )}
          </div>

          <div className="p-6 bg-slate-50 dark:bg-black/20 border-t border-black/5 dark:border-white/5 rounded-t-[2rem]">
            <div className="space-y-3 mb-6 text-sm font-medium">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Tax (10%)</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold text-slate-900 dark:text-white pt-3 border-t border-black/5 dark:border-white/5">
                <span>Total</span>
                <span className="text-orange-500">${total.toFixed(2)}</span>
              </div>
            </div>
            
            <button 
              onClick={() => {
                if(cart.length > 0 && activeTable) {
                  vibrate(20);
                  setViewState('payment');
                } else if (!activeTable) {
                  alert("Please select a table first");
                }
              }}
              disabled={cart.length === 0 || isProcessing || !activeTable}
              className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed py-4 rounded-2xl font-bold shadow-xl shadow-black/10 dark:shadow-white/10 hover:shadow-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <div className="w-6 h-6 border-2 border-white/30 dark:border-black/30 border-t-white dark:border-t-black rounded-full animate-spin" />
              ) : (
                'Send to Kitchen & Pay'
              )}
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}
