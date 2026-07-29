'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy, doc, updateDoc, where } from 'firebase/firestore';
import { ChefHat, CheckCircle, Clock, ChevronLeft } from 'lucide-react';
import { vibrate } from '@/lib/utils';
import { useNotification } from '@/hooks/use-notification';
import { printTicket } from '@/lib/printer';

export default function KitchenPage({ setView }: { setView: (v: 'pos' | 'admin' | 'manager' | 'kitchen') => void }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const { notify } = useNotification();

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Only fetch orders that are pending or preparing
    const ordersQ = query(
      collection(db, 'orders'), 
      where('status', 'in', ['pending', 'preparing']),
      orderBy('createdAt', 'asc')
    );
    
    let previousOrdersCount = 0;

    const unsubscribe = onSnapshot(ordersQ, (snapshot) => {
      const ords: any[] = [];
      snapshot.forEach(doc => ords.push({ id: doc.id, ...doc.data() }));
      
      // Notify for new orders
      if (ords.length > previousOrdersCount && previousOrdersCount !== 0) {
        notify('new-order');
        
        // Find the new order (simplified)
        const newOrder = ords.find(o => o.status === 'pending');
        if (newOrder) {
          printTicket('prep', newOrder); // Print kitchen ticket
        }
      }
      previousOrdersCount = ords.length;
      
      setOrders(ords);
    });

    return () => unsubscribe();
  }, [notify]);

  const updateOrderStatus = async (order: any, newStatus: string) => {
    vibrate(40);
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: newStatus,
        updatedAt: new Date().getTime()
      });
      if (newStatus === 'ready') {
        // Only visually removing it from here, POS will pick up the 'ready' state and print receipt.
      }
    } catch (e) {
      console.error('Failed to update order status', e);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F4F6] dark:bg-[#0A0A0C] p-8 font-sans">
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => { vibrate(30); setView('pos'); }}
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/80 dark:bg-white/5 shadow-sm border border-black/5 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors backdrop-blur-xl"
          >
            <ChevronLeft className="w-6 h-6 text-slate-600 dark:text-slate-300" />
          </button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
              <ChefHat className="w-8 h-8 text-orange-500" /> Kitchen Display
            </h1>
            <p className="text-slate-500 font-medium">Live order monitoring</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence>
          {orders.map(order => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              key={order.id}
              className={`flex flex-col bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl border ${
                order.status === 'preparing' ? 'border-yellow-500/50 shadow-yellow-500/10' : 
                order.status === 'pending' ? 'border-orange-500/50 shadow-orange-500/10' : 
                'border-white/40 dark:border-white/5 shadow-black/5'
              } shadow-2xl rounded-[2rem] p-6 ring-1 ring-black/5 dark:ring-white/10`}
            >
              <div className="flex justify-between items-start mb-4 border-b border-slate-100 dark:border-white/10 pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">#{order.id.slice(-5).toUpperCase()}</h3>
                    <span className={`px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider ${
                      order.status === 'preparing' ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400' : 'bg-orange-500/20 text-orange-600 dark:text-orange-400'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-500">{order.type} • Table {order.table}</p>
                </div>
                <div className="flex items-center gap-1.5 text-sm font-bold text-orange-500 bg-orange-500/10 px-3 py-1.5 rounded-full">
                  <Clock className="w-4 h-4" />
                  {Math.floor((now - order.createdAt) / 60000)}m
                </div>
              </div>
              
              <div className="flex-1 space-y-3 mb-6 overflow-y-auto custom-scrollbar pr-2 min-h-[150px]">
                {order.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-start">
                    <div className="flex gap-3">
                      <span className="font-bold text-orange-500">{item.quantity}x</span>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{item.name}</p>
                        {item.note && <p className="text-xs text-slate-500 italic">Note: {item.note}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-auto pt-4 flex gap-3">
                {order.status === 'pending' ? (
                  <button
                    onClick={() => updateOrderStatus(order, 'preparing')}
                    className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-yellow-500/30 transition-all active:scale-[0.98]"
                  >
                    Start Preparing
                  </button>
                ) : (
                  <button
                    onClick={() => updateOrderStatus(order, 'ready')}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-green-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-5 h-5" /> Mark Ready
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {orders.length === 0 && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 opacity-60">
            <ChefHat className="w-20 h-20 mb-4" />
            <h2 className="text-2xl font-bold">No active orders</h2>
            <p className="font-medium">Kitchen is caught up!</p>
          </div>
        )}
      </div>
    </div>
  );
}
