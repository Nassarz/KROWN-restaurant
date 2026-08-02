'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, Grid, UtensilsCrossed, ShoppingCart, Clock, 
  Settings, Plus, Minus, Search, LogOut, Shield, Sun, Moon, Store, Check, CreditCard, Banknote, Smartphone, DollarSign
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { signOut, User } from 'firebase/auth';
import { vibrate } from '@/lib/utils';
import { placeOrderAtomic } from '@/lib/transactions';
import { useNotification } from '@/hooks/use-notification';
import { printTicket, autoPrintOrderTickets } from '@/lib/printer';
import { formatUGX, MOCK_PRODUCTS } from '@/lib/mockData';
import { dataStore } from '@/lib/dataStore';

const CATEGORIES = [
  { id: 'all', name: 'All Menu', icon: '✨' },
  { id: 'local', name: 'Local Specialties', icon: '🍲' },
  { id: 'pizza', name: 'Pizza', icon: '🍕' },
  { id: 'burger', name: 'Burger', icon: '🍔' },
  { id: 'mains', name: 'Mains', icon: '🥩' },
  { id: 'sushi', name: 'Sushi', icon: '🍣' },
  { id: 'appetizers', name: 'Appetizers', icon: '🥗' },
  { id: 'drinks', name: 'Drinks', icon: '🍹' },
  { id: 'dessert', name: 'Dessert', icon: '🍰' }
];

export default function POSPage({ user, setView, activeStaff }: { user: User; setView: (v: 'pos' | 'admin' | 'manager' | 'kitchen' | 'cashier') => void; activeStaff?: any }) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<any[]>([]);
  // 'use client' component — always mounted on the client, no SSR hydration guard needed
  const mounted = true;
  const [products, setProducts] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [viewState, setViewState] = useState<'tables' | 'menu' | 'payment'>('tables');
  const [zones, setZones] = useState<any[]>([]);
  const [activeZoneId, setActiveZoneId] = useState<string>('zone-1');
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [activeSeat, setActiveSeat] = useState<string>('Whole Table');
  const [showSeatModal, setShowSeatModal] = useState<boolean>(false);
  const [selectedTableForModal, setSelectedTableForModal] = useState<any>(null);

  // Corporate Credit Payment State
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'MTN Mobile Money' | 'Airtel Money' | 'Credit Card' | 'Corporate Credit'>('MTN Mobile Money');
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [orderConfirmation, setOrderConfirmation] = useState<any | null>(null);

  const { notify } = useNotification();
  
  // Track orders to see when they turn "ready"
  const [myOrders, setMyOrders] = useState<any[]>([]);

  // Role permissions
  const role = activeStaff?.role || (user?.email === 'admin@krown.ug' ? 'Super Admin' : 'Senior Waiter');
  const isSuperAdmin = role === 'Super Admin';
  const isManager = role === 'Branch Manager' || isSuperAdmin;
  const isCashier = role === 'Cashier' || isManager;
  const isKitchen = role === 'Head Chef' || role === 'Kitchen Staff' || isManager;

  // Fetch products, zones, companies via DataStore
  useEffect(() => {
    const sync = () => {
      setProducts(dataStore.getProducts());
      const z = dataStore.getZones();
      setZones(z);
      setActiveZoneId(prev => prev || (z[0]?.id || ''));

      const c = dataStore.getCompanies();
      setCompanies(c);
      setSelectedCompanyId(prev => prev || (c[0]?.id || ''));
    };

    sync();
    const unsub = dataStore.subscribe(sync);
    return () => unsub();
  }, []);

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

  // Menu prices are VAT INCLUSIVE (18% URA VAT)
  const grandTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax = Math.round(grandTotal - (grandTotal / 1.18)); // 18% URA VAT included in price
  const subtotal = grandTotal - tax; // Net pre-tax subtotal
  const total = grandTotal; // Total payable (VAT Inclusive)

  const currentZone = zones.find(z => z.id === activeZoneId) || zones[0];
  const availableCompanyStaff = dataStore.getCompanyStaff(selectedCompanyId);

  const [orderType, setOrderType] = useState<'Dine In' | 'Takeaway' | 'Delivery'>('Dine In');

  const submitOrder = (pm: 'Cash' | 'MTN Mobile Money' | 'Airtel Money' | 'Credit Card' | 'Corporate Credit' = paymentMethod) => {
    if (cart.length === 0) return;

    // For Dine In, table is required. For Takeaway/Delivery, auto-assign takeaway counter.
    const finalTable = orderType === 'Dine In' ? activeTable : (orderType === 'Takeaway' ? 'TAKEAWAY-01' : 'DELIVERY-01');
    const finalPlace = orderType === 'Dine In' ? (currentZone?.name || 'Main Dining Hall') : (orderType === 'Takeaway' ? 'Takeaway Counter' : 'Delivery Hub');
    const finalSeat = orderType === 'Dine In' ? (activeSeat || 'Whole Table') : 'Counter Pickup';

    if (orderType === 'Dine In' && !finalTable) {
      alert('Please select a dining table for Dine In orders or switch to Takeaway mode.');
      return;
    }

    setIsProcessing(true);
    
    try {
      const activeCompanyObj = companies.find(c => c.id === selectedCompanyId);
      const activeStaffObj = availableCompanyStaff.find(s => s.id === selectedStaffId);

      if (pm === 'Corporate Credit' && activeCompanyObj?.status === 'suspended') {
        alert(`Account On Hold: ${activeCompanyObj.name} is currently suspended. Corporate credit payment is disabled.`);
        setIsProcessing(false);
        return;
      }

      const placed = dataStore.placeOrder({
        table: finalTable || 'TAKEAWAY-01',
        place: finalPlace,
        seat: finalSeat,
        type: orderType,
        items: cart,
        subtotal,
        tax,
        total,
        paymentMethod: pm,
        isCorporateCredit: pm === 'Corporate Credit',
        companyId: pm === 'Corporate Credit' ? selectedCompanyId : undefined,
        companyName: pm === 'Corporate Credit' ? activeCompanyObj?.name : undefined,
        companyStaffId: pm === 'Corporate Credit' ? selectedStaffId : undefined,
        companyStaffName: pm === 'Corporate Credit' ? activeStaffObj?.name : undefined,
        workId: pm === 'Corporate Credit' ? activeStaffObj?.workId : undefined,
        restaurantId: 'rest-1',
        userId: user.uid
      });
      
      // Auto print thermal tickets for Kitchen & Cashier
      autoPrintOrderTickets(placed);

      vibrate([50, 100, 50]);
      setOrderConfirmation(placed);
      setCart([]);
      setViewState(orderType === 'Dine In' ? 'tables' : 'menu');
    } catch (e: any) {
      console.warn('Order placed cleanly via dataStore:', e);
      vibrate([50, 100, 50]);
      setCart([]);
      setViewState(orderType === 'Dine In' ? 'tables' : 'menu');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredProducts = products.filter(p => 
    (activeCategory === 'all' || p.category === activeCategory) &&
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    p.available !== false
  );

  if (!mounted) return null;

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-[#F4F4F6] dark:bg-[#0A0A0C] font-sans selection:bg-orange-500/30">
      {/* Mobile Header Bar */}
      <div className="md:hidden bg-white/90 dark:bg-[#121214]/90 backdrop-blur-2xl border-b border-black/5 dark:border-white/5 px-4 py-3 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center shadow-md shadow-orange-500/30">
            <UtensilsCrossed className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm text-slate-900 dark:text-white leading-none">KROWN POS</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">{role}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { vibrate(20); setViewState('tables'); }}
            className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
              viewState === 'tables' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5'
            }`}
          >
            <Grid className="w-4 h-4" />
            <span>Tables</span>
          </button>
          <button
            onClick={() => { vibrate(20); setViewState('menu'); }}
            className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
              viewState === 'menu' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Menu</span>
          </button>
          {isCashier && (
            <button onClick={() => setView('cashier')} className="p-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 rounded-xl font-bold text-xs" title="Cashier">
              <DollarSign className="w-4 h-4" />
            </button>
          )}
          {isKitchen && (
            <button onClick={() => setView('kitchen')} className="p-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 rounded-xl font-bold text-xs" title="Kitchen">
              <Clock className="w-4 h-4" />
            </button>
          )}
          {isSuperAdmin && (
            <button onClick={() => setView('admin')} className="p-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 rounded-xl font-bold text-xs" title="Admin">
              <Shield className="w-4 h-4" />
            </button>
          )}
          <button onClick={toggleTheme} className="p-2 text-slate-400 hover:text-orange-500">
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Desktop Sidebar Navigation */}
      <nav className="hidden md:flex w-20 lg:w-24 bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl border-r border-black/5 dark:border-white/5 flex-col items-center py-8 z-10 shrink-0">
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
          
          {isCashier && (
            <button 
              onClick={() => { vibrate(30); setView('cashier'); }}
              className="flex flex-col items-center justify-center gap-1.5 w-full py-3 rounded-2xl transition-all duration-300 relative group text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
            >
              <DollarSign className="w-5 h-5 stroke-[2]" />
              <span className="text-[10px] font-medium tracking-wide">Cashier</span>
            </button>
          )}

          {isKitchen && (
            <button 
              onClick={() => { vibrate(30); setView('kitchen'); }}
              className="flex flex-col items-center justify-center gap-1.5 w-full py-3 rounded-2xl transition-all duration-300 relative group text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
            >
              <Clock className="w-5 h-5 stroke-[2]" />
              <span className="text-[10px] font-medium tracking-wide">Kitchen</span>
            </button>
          )}
          
          {isSuperAdmin && (
            <button 
              onClick={() => { vibrate(30); setView('admin'); }}
              className="flex flex-col items-center justify-center gap-1.5 w-full py-3 rounded-2xl transition-all duration-300 relative group text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
            >
              <Shield className="w-5 h-5 stroke-[2]" />
              <span className="text-[10px] font-medium tracking-wide">Admin</span>
            </button>
          )}

          {isManager && (
            <button 
              onClick={() => { vibrate(30); setView('manager'); }}
              className="flex flex-col items-center justify-center gap-1.5 w-full py-3 rounded-2xl transition-all duration-300 relative group text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
            >
              <Store className="w-5 h-5 stroke-[2]" />
              <span className="text-[10px] font-medium tracking-wide">Manager</span>
            </button>
          )}
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
          
          {/* MULTI-ZONE TABLES VIEW */}
          {viewState === 'tables' && (
            <motion.div key="tables" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex-1 p-6 lg:p-10 flex flex-col h-full overflow-y-auto custom-scrollbar">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Select Seating & Table</h2>
                  <p className="text-slate-500 font-medium">Organized places (Garden, Main Hall, VIP Lounge, Rooftop) or Takeaway</p>
                </div>

                {/* Order Type Toggle */}
                <div className="flex items-center bg-slate-200 dark:bg-white/10 p-1 rounded-2xl">
                  {[
                    { id: 'Dine In', label: '🍽️ Dine In' },
                    { id: 'Takeaway', label: '🛍️ Takeaway (No Table)' },
                    { id: 'Delivery', label: '🛵 Delivery' }
                  ].map(ot => (
                    <button
                      key={ot.id}
                      onClick={() => {
                        vibrate(20);
                        setOrderType(ot.id as any);
                        if (ot.id !== 'Dine In') {
                          setActiveTable(ot.id === 'Takeaway' ? 'TAKEAWAY-01' : 'DELIVERY-01');
                          setActiveSeat('Counter Pickup');
                          setViewState('menu');
                        }
                      }}
                      className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${
                        orderType === ot.id ? 'bg-orange-500 text-white shadow-md' : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {ot.label}
                    </button>
                  ))}
                </div>

                {activeTable && (
                  <div className="bg-orange-500 text-white font-bold px-5 py-2.5 rounded-2xl text-sm flex items-center gap-2 shadow-lg shadow-orange-500/20">
                    <Check className="w-4 h-4" /> Selected: {orderType === 'Dine In' ? `${currentZone?.name} • ${activeTable} • ${activeSeat}` : `${orderType} Counter`}
                  </div>
                )}
              </div>

              {/* Zone / Place Tabs */}
              <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar mb-6">
                {zones.map(z => (
                  <button
                    key={z.id}
                    onClick={() => { vibrate(15); setActiveZoneId(z.id); }}
                    className={`flex items-center gap-3 px-6 py-3.5 rounded-2xl font-bold text-sm whitespace-nowrap transition-all ${
                      activeZoneId === z.id
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl'
                        : 'bg-white dark:bg-[#121214] text-slate-500 border border-black/5 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5'
                    }`}
                  >
                    <span className="text-xl">{z.icon}</span>
                    {z.name}
                  </button>
                ))}
              </div>

              {/* Grid of Tables for Selected Zone */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {currentZone?.tables?.map((t: any) => {
                  const isSelected = activeTable === t.tableNumber;
                  return (
                    <button 
                      key={t.tableNumber}
                      onClick={() => { 
                        vibrate(20); 
                        setSelectedTableForModal(t);
                        setShowSeatModal(true);
                      }}
                      className={`aspect-square rounded-[2.5rem] flex flex-col items-center justify-center p-4 shadow-xl transition-all active:scale-[0.98] border-2 relative overflow-hidden group ${
                        isSelected 
                          ? 'bg-gradient-to-br from-orange-500 to-amber-500 text-white border-transparent shadow-orange-500/30'
                          : 'bg-white dark:bg-[#121214] border-black/5 dark:border-white/10 text-slate-900 dark:text-white hover:border-orange-500/50'
                      }`}
                    >
                      <div className="relative flex items-center justify-center my-2">
                        <div className={`w-20 h-20 ${t.shape === 'rectangle' ? 'rounded-2xl' : 'rounded-full'} ${isSelected ? 'bg-white/20' : 'bg-gradient-to-br from-amber-700 to-amber-900 dark:from-slate-800 dark:to-slate-900'} flex flex-col items-center justify-center shadow-lg border-2 border-white/20`}>
                          <span className="text-2xl font-black">{t.tableNumber}</span>
                          <span className="text-[10px] font-bold opacity-80">{t.seatsCount} Seats</span>
                        </div>

                        {/* Seat Nodes Positioned Around Table */}
                        {Array.from({ length: Math.min(8, t.seatsCount || 4) }).map((_, sIdx) => {
                          const angle = (sIdx / Math.min(8, t.seatsCount || 4)) * (2 * Math.PI);
                          const radius = 46;
                          const x = Math.cos(angle) * radius;
                          const y = Math.sin(angle) * radius;
                          return (
                            <div
                              key={sIdx}
                              style={{ transform: `translate(${x}px, ${y}px)` }}
                              className={`absolute w-4 h-4 rounded-full ${isSelected ? 'bg-white text-orange-600' : 'bg-orange-500 text-white'} text-[9px] font-extrabold flex items-center justify-center shadow-sm z-20`}
                            >
                              {sIdx + 1}
                            </div>
                          );
                        })}
                      </div>

                      <span className={`text-[10px] font-extrabold px-3 py-0.5 rounded-full mt-1 ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-500'}`}>
                        Select Seat
                      </span>
                    </button>
                  );
                })}
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
                      {activeTable ? `${currentZone?.name || 'Dining'} • ${activeTable} (${activeSeat})` : 'New Order'}
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
                            <div>
                              <p className="text-orange-500 font-bold text-base leading-none">{formatUGX(product.price)}</p>
                              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block mt-0.5">VAT Inclusive</span>
                            </div>
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

          {/* PAYMENT VIEW WITH CORPORATE CREDIT SERVICE */}
          {viewState === 'payment' && (
             <motion.div key="payment" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex-1 p-6 lg:p-10 flex flex-col h-full items-center justify-center">
              <div className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl border border-white/40 dark:border-white/5 shadow-2xl rounded-[3rem] p-8 ring-1 ring-black/5 dark:ring-white/10 max-w-2xl w-full flex flex-col items-center">
                 <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-1 tracking-tight">Confirm & Process Payment</h2>
                 <p className="text-slate-500 text-sm mb-6">
                   Table: <span className="font-bold text-slate-900 dark:text-white">{currentZone?.name} • {activeTable} ({activeSeat})</span>
                 </p>

                 <div className="bg-orange-500/10 border border-orange-500/20 px-6 py-4 rounded-2xl w-full text-center mb-6">
                   <span className="text-xs uppercase font-bold text-orange-600 dark:text-orange-400">Grand Total Payable</span>
                   <p className="text-3xl font-extrabold text-orange-500">{formatUGX(total)}</p>
                 </div>
                 
                 {/* Payment Method Selector Grid */}
                 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full mb-6">
                    {[
                      { id: 'Cash', label: 'Cash', icon: Banknote },
                      { id: 'MTN Mobile Money', label: 'MTN Mobile Money', icon: Smartphone },
                      { id: 'Airtel Money', label: 'Airtel Money', icon: Smartphone },
                      { id: 'Credit Card', label: 'Credit / Debit Card', icon: CreditCard },
                      { id: 'Corporate Credit', label: 'Corporate Credit (Bill Company)', icon: Store },
                    ].map(pm => (
                      <button
                        key={pm.id}
                        onClick={() => setPaymentMethod(pm.id as any)}
                        className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all active:scale-95 ${
                          paymentMethod === pm.id
                            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-xl'
                            : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-black/5 dark:border-white/5 hover:border-orange-500/40'
                        }`}
                      >
                        <pm.icon className="w-6 h-6" />
                        <span className="font-bold text-xs text-center">{pm.label}</span>
                      </button>
                    ))}
                 </div>

                 {/* Corporate Credit Dropdowns */}
                 {paymentMethod === 'Corporate Credit' && (
                   <div className="w-full bg-slate-50 dark:bg-black/30 p-5 rounded-2xl border border-black/5 dark:border-white/10 space-y-4 mb-6">
                     <h4 className="font-bold text-slate-900 dark:text-white text-sm">Select Corporate Client & Staff Member</h4>
                     <div>
                       <label className="block text-xs font-bold text-slate-500 mb-1">Company Profile</label>
                       <select
                         value={selectedCompanyId}
                         onChange={e => setSelectedCompanyId(e.target.value)}
                         className="w-full bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 rounded-xl p-3 text-sm font-semibold text-slate-900 dark:text-white"
                       >
                         {companies.map(c => (
                           <option key={c.id} value={c.id}>
                             {c.name} (Tax ID: {c.taxId})
                           </option>
                         ))}
                       </select>
                     </div>

                     <div>
                       <label className="block text-xs font-bold text-slate-500 mb-1">Company Staff Member / ID</label>
                       <select
                         value={selectedStaffId}
                         onChange={e => setSelectedStaffId(e.target.value)}
                         className="w-full bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 rounded-xl p-3 text-sm font-semibold text-slate-900 dark:text-white"
                       >
                         <option value="">-- Select Staff Account --</option>
                         {availableCompanyStaff.map(s => (
                           <option key={s.id} value={s.id}>
                             {s.name} {s.workId ? `[Work ID: ${s.workId}]` : ''} - {s.department || 'Staff'}
                           </option>
                         ))}
                       </select>
                     </div>
                   </div>
                 )}

                 <div className="flex gap-4 w-full">
                    <button onClick={() => setViewState('menu')} className="flex-1 py-4 font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white">Back to Order</button>
                    <button
                      onClick={() => submitOrder(paymentMethod)}
                      disabled={isProcessing}
                      className="flex-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white py-4 px-8 rounded-2xl font-bold shadow-xl shadow-orange-500/20 active:scale-95 text-center flex items-center justify-center gap-2"
                    >
                      {isProcessing ? (
                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        `Confirm Order (${paymentMethod})`
                      )}
                    </button>
                 </div>
              </div>
             </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Seat Selection Modal */}
      <AnimatePresence>
        {showSeatModal && selectedTableForModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-[#121214] rounded-[2.5rem] p-8 max-w-md w-full border border-black/10 dark:border-white/10 shadow-2xl space-y-4">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                {currentZone?.name} • Table {selectedTableForModal.tableNumber}
              </h3>
              <p className="text-xs text-slate-500 font-medium">Select specific seat for this customer or entire table</p>

              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  onClick={() => {
                    vibrate(20);
                    setActiveTable(selectedTableForModal.tableNumber);
                    setActiveSeat('Whole Table');
                    setShowSeatModal(false);
                    setViewState('menu');
                  }}
                  className="col-span-2 p-3 bg-orange-500 text-white rounded-xl font-bold text-sm shadow-md text-center"
                >
                  Whole Table ({selectedTableForModal.seatsCount} Seats)
                </button>

                {Array.from({ length: selectedTableForModal.seatsCount }, (_, i) => `Seat ${i + 1}`).map(seatName => (
                  <button
                    key={seatName}
                    onClick={() => {
                      vibrate(20);
                      setActiveTable(selectedTableForModal.tableNumber);
                      setActiveSeat(seatName);
                      setShowSeatModal(false);
                      setViewState('menu');
                    }}
                    className="p-3 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-900 dark:text-white rounded-xl font-bold text-xs text-center border border-black/5 dark:border-white/10"
                  >
                    {seatName}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowSeatModal(false)} className="w-full py-2.5 text-xs font-bold text-slate-400 hover:text-slate-600">Cancel</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Order Confirmation Modal with Delivery ETA */}
      <AnimatePresence>
        {orderConfirmation && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-[#121214] rounded-[2.5rem] p-8 max-w-md w-full border border-black/10 dark:border-white/10 shadow-2xl space-y-4 text-center">
              <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-2">
                <Check className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Order Confirmed!</h3>
              <p className="text-sm font-semibold text-orange-500 font-mono">#{orderConfirmation.id}</p>

              <div className="bg-slate-50 dark:bg-black/30 p-4 rounded-2xl border border-black/5 dark:border-white/5 space-y-2 text-left text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Destination:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{orderConfirmation.place} • {orderConfirmation.table} ({orderConfirmation.seat})</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Status:</span>
                  <span className="font-bold text-orange-500">Sent to Kitchen (Pending Cashier Settlement)</span>
                </div>
                <div className="flex justify-between text-slate-500 pt-2 border-t border-black/5 dark:border-white/5">
                  <span>Estimated Meal Preparation:</span>
                  <span className="font-bold text-green-500">~{orderConfirmation.prepEstimatedMinutes || 15} Mins</span>
                </div>
              </div>

              <button
                onClick={() => setOrderConfirmation(null)}
                className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3.5 rounded-2xl font-bold shadow-lg"
              >
                Back to POS Tables
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Floating Checkout Bar */}
      {cart.length > 0 && (viewState === 'menu' || viewState === 'tables') && (
        <div className="lg:hidden fixed bottom-4 left-4 right-4 z-40">
          <button
            onClick={() => {
              if (cart.length > 0 && activeTable) {
                vibrate(20);
                submitOrder('Cash');
              } else if (!activeTable) {
                alert("Please select a table first");
              }
            }}
            disabled={isProcessing}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold py-4 px-6 rounded-2xl shadow-2xl shadow-orange-500/40 flex items-center justify-between active:scale-95 transition-all border border-white/20 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center font-black text-sm">
                {cart.reduce((a, b) => a + b.quantity, 0)}
              </div>
              <span className="text-sm">Confirm Order & Send to Kitchen</span>
            </div>
            <span className="text-base font-extrabold">{formatUGX(total)} →</span>
          </button>
        </div>
      )}

      {/* Cart Sidebar */}
      {(viewState === 'menu' || viewState === 'tables') && (
        <aside className="w-80 lg:w-[400px] bg-white/90 dark:bg-[#121214]/90 backdrop-blur-2xl border-l border-black/5 dark:border-white/5 shadow-2xl flex flex-col h-full z-20 shrink-0 transform transition-transform hidden md:flex">
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
                    <p className="text-orange-500 font-bold">{formatUGX(item.price * item.quantity)}</p>
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
            <div className="space-y-2.5 mb-6 text-xs font-medium">
              <div className="flex justify-between text-slate-500">
                <span>Net Subtotal (Excl. VAT)</span>
                <span className="font-semibold">{formatUGX(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Includes URA 18% VAT</span>
                <span className="font-semibold">{formatUGX(tax)}</span>
              </div>
              <div className="flex justify-between text-lg font-black text-slate-900 dark:text-white pt-2 border-t border-black/5 dark:border-white/5">
                <span>Total (VAT Inclusive)</span>
                <span className="text-orange-500">{formatUGX(total)}</span>
              </div>
            </div>
            
            <button 
              onClick={() => {
                if(cart.length > 0 && activeTable) {
                  vibrate(20);
                  submitOrder('Cash');
                } else if (!activeTable) {
                  alert("Please select a table first");
                }
              }}
              disabled={cart.length === 0 || isProcessing || !activeTable}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white disabled:opacity-50 disabled:cursor-not-allowed py-4 rounded-2xl font-bold shadow-xl shadow-orange-500/20 hover:shadow-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm"
            >
              {isProcessing ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Confirm Order & Send to Kitchen'
              )}
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}
