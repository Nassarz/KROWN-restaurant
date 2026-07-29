import React from 'react';
import { Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ManagerOrders({ orders }: { orders: any[] }) {
  const liveOrders = orders.filter(o => o.status === 'pending' || o.status === 'preparing');

  return (
    <div className="flex flex-col h-full gap-6">
      <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Live Orders</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto custom-scrollbar">
        <AnimatePresence>
          {liveOrders.map(order => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className={`flex flex-col bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl border ${
                order.status === 'preparing' ? 'border-yellow-500/50' : 'border-orange-500/50'
              } shadow-2xl rounded-[2rem] p-6`}
            >
              <div className="flex justify-between items-start border-b border-slate-100 dark:border-white/10 pb-4 mb-4">
                <div>
                  <h3 className="text-xl font-bold dark:text-white">#{order.id.slice(-5).toUpperCase()}</h3>
                  <p className="text-sm text-slate-500">{order.type} • {order.status}</p>
                </div>
                <div className="flex items-center gap-1.5 text-sm font-bold text-orange-500 bg-orange-500/10 px-3 py-1.5 rounded-full">
                  <Clock className="w-4 h-4" />
                  {Math.floor((Date.now() - order.createdAt) / 60000)}m
                </div>
              </div>
              <div className="flex-1 space-y-3 max-h-40 overflow-y-auto custom-scrollbar">
                {order.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-start">
                    <div className="flex gap-3">
                      <span className="font-bold text-orange-500">{item.quantity}x</span>
                      <div>
                        <p className="font-semibold dark:text-white">{item.name}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
          {liveOrders.length === 0 && (
            <div className="col-span-full py-10 text-center text-slate-500">No live orders at the moment.</div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
