'use client';

import React, { useState, useMemo } from 'react';
import { Clock, Calendar, Download, Filter, ChevronDown, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatUGX } from '@/lib/mockData';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', preparing: 'Preparing', ready: 'Ready', served: 'Served', completed: 'Completed', cancelled: 'Cancelled'
};
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
  preparing: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
  ready: 'bg-green-500/10 text-green-500 border-green-500/30',
  served: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  completed: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
  cancelled: 'bg-red-500/10 text-red-500 border-red-500/30',
};

export default function ManagerOrders({ orders, allOrders }: { orders: any[]; allOrders: any[] }) {
  const [now, setNow] = useState(() => Date.now());
  const [activeTab, setActiveTab] = useState<'live' | 'history'>('live');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const liveOrders = useMemo(() => {
    return (orders || []).filter(o =>
      o.status !== 'completed' && o.status !== 'cancelled' &&
      o.paymentStatus !== 'paid'
    );
  }, [orders]);

  const historyOrders = useMemo(() => {
    const fromDate = new Date(dateFrom); fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(dateTo); toDate.setHours(23, 59, 59, 999);
    const fromMs = fromDate.getTime();
    const toMs = toDate.getTime();
    let filtered = (allOrders || []).filter(o => {
      const created = typeof o.createdAt === 'number' ? o.createdAt : new Date(o.createdAt).getTime();
      return created >= fromMs && created <= toMs;
    });
    if (statusFilter !== 'all') {
      filtered = filtered.filter(o => o.status === statusFilter);
    }
    return filtered.sort((a: any, b: any) => {
      const aTime = typeof a.createdAt === 'number' ? a.createdAt : new Date(a.createdAt).getTime();
      const bTime = typeof b.createdAt === 'number' ? b.createdAt : new Date(b.createdAt).getTime();
      return bTime - aTime;
    });
  }, [allOrders, dateFrom, dateTo, statusFilter]);

  const stats = useMemo(() => {
    const totalRevenue = historyOrders.reduce((s, o) => s + (o.paymentStatus === 'paid' || o.status === 'completed' ? (o.total || 0) : 0), 0);
    const paidOrders = historyOrders.filter(o => o.paymentStatus === 'paid' || o.status === 'completed').length;
    const unpaidOrders = historyOrders.filter(o => o.paymentStatus !== 'paid' && o.status !== 'completed' && o.status !== 'cancelled').length;
    const avgOrder = paidOrders > 0 ? totalRevenue / paidOrders : 0;
    return { totalRevenue, paidOrders, unpaidOrders, avgOrder, total: historyOrders.length };
  }, [historyOrders]);

  const downloadPDF = () => {
    import('jspdf').then(({ jsPDF }) => {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 20;

      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('KROWN ERP — Orders Report', pageWidth / 2, y, { align: 'center' });
      y += 10;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Date Range: ${dateFrom} to ${dateTo}`, 20, y);
      y += 6;
      doc.text(`Total Orders: ${stats.total} | Paid: ${stats.paidOrders} | Unpaid: ${stats.unpaidOrders}`, 20, y);
      y += 6;
      doc.text(`Total Revenue: ${formatUGX(stats.totalRevenue)} | Avg Order: ${formatUGX(stats.avgOrder)}`, 20, y);
      y += 10;

      doc.setDrawColor(200);
      doc.line(20, y, pageWidth - 20, y);
      y += 8;

      const headers = ['#', 'Order ID', 'Table', 'Type', 'Status', 'Payment', 'Items', 'Total', 'Date'];
      const colWidths = [10, 35, 18, 22, 22, 25, 15, 25, 35];
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      let x = 15;
      headers.forEach((h, i) => { doc.text(h, x, y); x += colWidths[i]; });
      y += 6;
      doc.line(15, y, pageWidth - 15, y);
      y += 4;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      historyOrders.forEach((o, idx) => {
        if (y > 275) { doc.addPage(); y = 20; }
        x = 15;
        const row = [
          String(idx + 1),
          (o.id || '').slice(-8).toUpperCase(),
          o.table || 'N/A',
          o.type || 'Dine In',
          STATUS_LABELS[o.status] || o.status,
          o.paymentStatus || 'unpaid',
          String((o.items || []).length),
          formatUGX(o.total || 0),
          new Date(typeof o.createdAt === 'number' ? o.createdAt : o.createdAt).toLocaleDateString('en-GB'),
        ];
        row.forEach((cell, i) => { doc.text(cell, x, y); x += colWidths[i]; });
        y += 5;

        if (o.items && o.items.length > 0) {
          doc.setFontSize(6);
          o.items.forEach((item: any) => {
            if (y > 275) { doc.addPage(); y = 20; }
            const price = Number(item.unitPrice) || 0;
            const lineTotal = price * (item.quantity || 1);
            doc.text(`    ${item.quantity}x ${item.name} @ ${formatUGX(price)} = ${formatUGX(lineTotal)}`, 15, y);
            y += 4;
          });
          doc.setFontSize(7);
        }
        y += 2;
      });

      doc.setFontSize(8);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 20, y + 10);
      doc.save(`KROWN_Orders_${dateFrom}_to_${dateTo}.pdf`);
    });
  };

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Orders</h2>
          <p className="text-slate-500 font-medium">
            {activeTab === 'live'
              ? `${liveOrders.length} active order${liveOrders.length !== 1 ? 's' : ''}`
              : `${historyOrders.length} order${historyOrders.length !== 1 ? 's' : ''} in range`
            }
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('live')}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'live' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-white dark:bg-[#121214] text-slate-500 border border-black/5 dark:border-white/10'
            }`}
          >
            <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> Live ({liveOrders.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'history' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-white dark:bg-[#121214] text-slate-500 border border-black/5 dark:border-white/10'
            }`}
          >
            <span className="flex items-center gap-2"><Package className="w-4 h-4" /> History ({historyOrders.length})</span>
          </button>
        </div>
      </div>

      {activeTab === 'live' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto custom-scrollbar flex-1">
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
                      #{(order.id || '').slice(-5).toUpperCase()}
                      <span className="text-xs bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded-lg text-slate-600 dark:text-slate-300 font-medium">
                        Table {order.table || 'N/A'}
                      </span>
                    </h3>
                    <p className="text-sm text-slate-500 capitalize">{order.type} • {STATUS_LABELS[order.status] || order.status}</p>
                  </div>
                  <span className={`text-xs px-3 py-1.5 rounded-full font-bold border ${STATUS_COLORS[order.status] || 'bg-slate-100 text-slate-500'}`}>
                    {STATUS_LABELS[order.status] || order.status}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-orange-500 mb-4">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="font-bold">
                    {Math.max(0, Math.floor((now - (typeof order.createdAt === 'number' ? order.createdAt : new Date(order.createdAt).getTime())) / 60000))}m ago
                  </span>
                </div>

                <div className="flex-1 space-y-2 max-h-48 overflow-y-auto custom-scrollbar mb-4">
                  {(order.items || []).map((item: any, idx: number) => {
                    const price = Number(item.unitPrice) || 0;
                    const lineTotal = price * (item.quantity || 1);
                    return (
                      <div key={idx} className="flex justify-between items-start bg-slate-50 dark:bg-white/5 rounded-xl px-3 py-2">
                        <div className="flex gap-2 items-center">
                          <span className="font-bold text-orange-500 text-sm">{item.quantity}x</span>
                          <p className="font-semibold text-sm dark:text-white">{item.name}</p>
                        </div>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{formatUGX(lineTotal)}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-3 border-t border-black/5 dark:border-white/5 flex justify-between items-center">
                  <span className="text-xs text-slate-400 font-medium">{order.paymentMethod || 'Cash'}</span>
                  <span className="font-bold text-orange-500 text-lg">{formatUGX(order.total || 0)}</span>
                </div>
              </motion.div>
            ))}
            {liveOrders.length === 0 && (
              <div className="col-span-full py-16 text-center">
                <Clock className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                <p className="text-lg font-bold text-slate-500">No live orders</p>
                <p className="text-sm text-slate-400 mt-1">Active orders will appear here in real-time</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">To</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500/50">
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="preparing">Preparing</option>
                <option value="ready">Ready</option>
                <option value="served">Served</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <button onClick={downloadPDF}
              className="flex items-center gap-2 bg-orange-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20">
              <Download className="w-4 h-4" /> Download PDF
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Total Orders', value: stats.total, color: 'text-slate-900 dark:text-white' },
              { label: 'Revenue', value: formatUGX(stats.totalRevenue), color: 'text-orange-500' },
              { label: 'Paid', value: stats.paidOrders, color: 'text-green-500' },
              { label: 'Unpaid', value: stats.unpaidOrders, color: 'text-red-500' },
              { label: 'Avg Order', value: formatUGX(stats.avgOrder), color: 'text-blue-500' },
            ].map(s => (
              <div key={s.label} className="bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10 rounded-2xl p-4 text-center">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {historyOrders.length === 0 ? (
              <div className="py-16 text-center">
                <Package className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                <p className="text-lg font-bold text-slate-500">No orders in this date range</p>
              </div>
            ) : (
              <div className="space-y-3">
                {historyOrders.map(order => {
                  const isPaid = order.paymentStatus === 'paid' || order.status === 'completed';
                  return (
                    <div key={order.id} className={`bg-white dark:bg-[#121214] border rounded-2xl p-5 ${
                      isPaid ? 'border-green-500/20' : 'border-orange-500/20'
                    }`}>
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-sm text-slate-900 dark:text-white">
                            #{(order.id || '').slice(-6).toUpperCase()}
                          </span>
                          <span className="text-xs bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded-lg text-slate-600 dark:text-slate-300">
                            Table {order.table || 'N/A'}
                          </span>
                          <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${STATUS_COLORS[order.status] || 'bg-slate-100 text-slate-500'}`}>
                            {STATUS_LABELS[order.status] || order.status}
                          </span>
                          <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                            isPaid ? 'bg-green-500/10 text-green-600' : 'bg-orange-500/10 text-orange-600'
                          }`}>
                            {isPaid ? 'Paid' : order.paymentStatus || 'Unpaid'}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-slate-500">{order.type}</span>
                          <span className="text-slate-400 text-xs">
                            {new Date(typeof order.createdAt === 'number' ? order.createdAt : order.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1.5 mb-3">
                        {(order.items || []).map((item: any, idx: number) => {
                          const price = Number(item.unitPrice) || 0;
                          const lineTotal = price * (item.quantity || 1);
                          return (
                            <div key={idx} className="flex justify-between items-center text-sm pl-4">
                              <span className="text-slate-600 dark:text-slate-400">
                                <span className="font-bold text-orange-500">{item.quantity}x</span> {item.name}
                              </span>
                              <span className="font-bold text-slate-700 dark:text-slate-300">{formatUGX(lineTotal)}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="border-t border-black/5 dark:border-white/5 pt-3 flex justify-between items-center">
                        <span className="text-xs text-slate-400">{order.paymentMethod || 'Cash'}</span>
                        <span className="font-bold text-orange-500 text-lg">{formatUGX(order.total || 0)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
