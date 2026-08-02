import React from 'react';
import { Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { formatUGX, MOCK_ORDERS } from '@/lib/mockData';

export default function ManagerOrders({ orders }: { orders: any[] }) {
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const displayOrders = orders && orders.length > 0 ? orders : MOCK_ORDERS;
  const liveOrders = displayOrders.filter(o => o.status === 'pending' || o.status === 'preparing' || o.status === 'ready');

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Live Orders</h2>
          <p className="text-slate-500 font-medium">Real-time floor monitoring ({liveOrders.length} active)</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto custom-scrollbar">
        <AnimatePresence>
          {liveOrders.map(order => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className={`flex flex-col bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl border ${
                order.status === 'preparing' ? 'border-yellow-500/50 shadow-yellow-500/10' : 
                order.status === 'ready' ? 'border-green-500/50 shadow-green-500/10' :
                'border-orange-500/50 shadow-orange-500/10'
              } shadow-2xl rounded-[2rem] p-6`}
            >
              <div className="flex justify-between items-start border-b border-slate-100 dark:border-white/10 pb-4 mb-4">
                <div>
                  <h3 className="text-xl font-bold dark:text-white flex items-center gap-2">
                    #{order.id.slice(-5).toUpperCase()}
                    <span className="text-xs bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded-lg text-slate-600 dark:text-slate-300 font-medium">
                      Table {order.table || 'N/A'}
                    </span>
                  </h3>
                  <p className="text-sm text-slate-500 capitalize">{order.type} • {order.status}</p>
                </div>
                <div className="flex items-center gap-1.5 text-sm font-bold text-orange-500 bg-orange-500/10 px-3 py-1.5 rounded-full">
                  <Clock className="w-4 h-4" />
                  {Math.max(1, Math.floor((now - (order.createdAt || now)) / 60000))}m
                </div>
              </div>
              <div className="flex-1 space-y-3 max-h-40 overflow-y-auto custom-scrollbar mb-4">
                {order.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-start">
                    <div className="flex gap-3">
                      <span className="font-bold text-orange-500">{item.quantity}x</span>
                      <div>
                        <p className="font-semibold text-sm dark:text-white">{item.name}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t border-black/5 dark:border-white/5 flex justify-between items-center">
                <span className="text-xs text-slate-400 font-medium">{order.paymentMethod || 'Cash'}</span>
                <span className="font-bold text-orange-500">{formatUGX(order.total || 0)}</span>
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
