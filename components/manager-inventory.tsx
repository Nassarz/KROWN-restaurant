import React, { useState, useEffect } from 'react';
import { Search, Plus, Box, History, AlertTriangle, Download, Printer, X, Edit3, Link2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { vibrate } from '@/lib/utils';
import { dataStore } from '@/lib/dataStore';
import { formatUGX, Ingredient, InventoryMovement } from '@/lib/mockData';

export default function ManagerInventory({ ingredients, user, branchId }: { ingredients: any[], user: any, branchId?: string }) {
  const [search, setSearch] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [activeItems, setActiveItems] = useState<Ingredient[]>(() => dataStore.getIngredients(branchId));
  const [movements, setMovements] = useState<InventoryMovement[]>(() => dataStore.getInventoryMovements(branchId));
  const [showMovementsModal, setShowMovementsModal] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<Ingredient | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    quantity: '',
    unit: 'kg',
    category: 'Produce',
    minThreshold: '10',
    costPerUnitUGX: '15000',
    supplier: 'Kampala Farmers Market',
    deductFromSales: true,
    deductAmountPerSale: '1',
    linkedProductId: '',
  });

  const availableProducts = dataStore.getProducts(branchId);

  useEffect(() => {
    const sync = () => {
      setActiveItems(dataStore.getIngredients(branchId));
      setMovements(dataStore.getInventoryMovements(branchId));
    };
    sync();
    const unsub = dataStore.subscribe(sync);
    return () => unsub();
  }, [branchId]);

  const handleUpdateStock = (id: string, delta: number) => {
    vibrate(20);
    const item = activeItems.find(i => i.id === id);
    if (!item) return;

    const newQty = Math.max(0, item.quantity + delta);
    dataStore.updateIngredient(id, { quantity: newQty });
  };

  const handleSetStock = (id: string, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) return;
    dataStore.updateIngredient(id, { quantity: num });
  };

  const openEdit = (item: Ingredient) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      quantity: String(item.quantity),
      unit: item.unit,
      category: item.category,
      minThreshold: String(item.minThreshold),
      costPerUnitUGX: String(item.costPerUnitUGX),
      supplier: item.supplier || '',
      deductFromSales: !!item.deductFromSales,
      deductAmountPerSale: String(item.deductAmountPerSale ?? 1),
      linkedProductId: item.linkedProductId || '',
    });
    setIsAdding(true);
  };

  const resolveBranch = () => {
    const activeStaff = dataStore.getStaff().find(s => s.email === user?.email);
    const bId = branchId && branchId !== 'all' ? branchId : (user?.assignedBranchId || activeStaff?.assignedBranchId || (activeStaff?.role === 'Super Admin' ? undefined : activeStaff?.branch));
    const branchObj = dataStore.getBranches().find(b => b.id === bId || b.name === bId);
    return { branchId: bId, branchName: branchObj?.name };
  };

  const handleAddIngredient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.quantity) return;

    const { branchId: bId, branchName } = resolveBranch();
    const payload = {
      name: formData.name,
      quantity: parseFloat(formData.quantity) || 0,
      unit: formData.unit,
      category: formData.category,
      minThreshold: parseFloat(formData.minThreshold) || 10,
      costPerUnitUGX: parseFloat(formData.costPerUnitUGX) || 15000,
      supplier: formData.supplier,
      deductFromSales: formData.deductFromSales,
      deductAmountPerSale: parseFloat(formData.deductAmountPerSale) || 1,
      linkedProductId: formData.linkedProductId || undefined,
      branchId: bId,
      branchName,
    };

    if (editingItem) {
      dataStore.updateIngredient(editingItem.id, payload);
    } else {
      dataStore.addIngredient(payload);
    }

    setIsAdding(false);
    setEditingItem(null);
    resetForm();
    vibrate([30, 50]);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      quantity: '',
      unit: 'kg',
      category: 'Produce',
      minThreshold: '10',
      costPerUnitUGX: '15000',
      supplier: 'Kampala Farmers Market',
      deductFromSales: true,
      deductAmountPerSale: '1',
      linkedProductId: '',
    });
  };

  const filtered = activeItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase()) ||
      (item.supplier || '').toLowerCase().includes(search.toLowerCase());
    const matchesLowStock = showLowStockOnly ? item.quantity <= item.minThreshold : true;
    return matchesSearch && matchesLowStock;
  });

  const lowStockCount = activeItems.filter(i => i.quantity <= i.minThreshold).length;
  const totalStockUnits = activeItems.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  const autoDeductCount = activeItems.filter(i => i.deductFromSales).length;

  // Export CSV Report
  const exportCSV = () => {
    const headers = ['ID', 'Name', 'Category', 'Quantity', 'Unit', 'Min Threshold', 'Unit Cost (UGX)', 'Auto Deduct', 'Supplier'];
    const rows = activeItems.map(i => [
      i.id,
      `"${i.name}"`,
      `"${i.category}"`,
      i.quantity,
      i.unit,
      i.minThreshold,
      i.costPerUnitUGX,
      i.deductFromSales ? 'Yes' : 'No',
      `"${i.supplier || ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Inventory_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print PDF Report
  const printInventoryPDF = () => {
    if (typeof window === 'undefined') return;
    const printWin = window.open('', '_blank');
    if (!printWin) return;

    const paperWidth = '80mm';
    const divider = '-'.repeat(48);
    const doubleDivider = '='.repeat(48);

    const itemsHtml = activeItems.map(i => `
      <div style="margin-bottom: 8px;">
        <div style="font-weight: bold;">${i.name.toUpperCase()} (${i.category})</div>
        <div class="justify">
          <span>Stock: ${i.quantity} ${i.unit} ${i.quantity <= i.minThreshold ? '(!LOW)' : ''}</span>
          <span>Cost: ${formatUGX(i.costPerUnitUGX)}</span>
        </div>
        <div class="justify" style="font-size: 11px; color: #333;">
          <span>Supplier: ${i.supplier || 'N/A'}</span>
          <span>Auto Deduct: ${i.deductFromSales ? 'YES' : 'NO'}</span>
        </div>
      </div>
      <div>${divider}</div>
    `).join('');

    printWin.document.write(`
      <html>
        <head>
          <title>Inventory Report - Thermal</title>
          <style>
            @page { size: ${paperWidth} auto; margin: 0; }
            body {
              font-family: 'Courier New', Courier, monospace;
              width: ${paperWidth};
              padding: 10px;
              margin: 0 auto;
              font-size: 13px;
              line-height: 1.3;
              color: #000;
            }
            .center { text-align: center; font-weight: bold; }
            .justify { display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <div class="center">KROWN POS</div>
          <div class="center">INVENTORY & STOCK LEDGER</div>
          <div class="center">Generated: ${new Date().toLocaleString()}</div>
          <div>${doubleDivider}</div>
          ${itemsHtml}
          <div class="center">Powered by Krown POS</div>
          <br/><br/><br/>
        </body>
      </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); printWin.close(); }, 300);
  };

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Stock & Inventory</h2>
          <p className="text-slate-500 font-medium text-xs">Real-time raw ingredient tracking & automatic POS sales deductions</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowMovementsModal(true)}
            className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all"
          >
            <History className="w-4 h-4" /> Stock Movements Log ({movements.length})
          </button>

          <button
            onClick={printInventoryPDF}
            className="bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-900 dark:text-white px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all"
          >
            <Printer className="w-4 h-4 text-purple-500" /> Print PDF
          </button>

          <button
            onClick={exportCSV}
            className="bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-900 dark:text-white px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all"
          >
            <Download className="w-4 h-4 text-blue-500" /> Export CSV
          </button>

          <button
            onClick={() => { vibrate(20); setIsAdding(true); }}
            className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-orange-500/20 transition-all active:scale-95 text-xs"
          >
            <Plus className="w-4 h-4" /> Add Ingredient
          </button>
        </div>
      </div>

      <div className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl border border-white/40 dark:border-white/5 shadow-2xl rounded-[2rem] p-6 ring-1 ring-black/5 dark:ring-white/10 flex-1 flex flex-col overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search ingredients, category, or supplier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 dark:bg-black/20 border border-black/5 dark:border-white/10 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:text-white text-sm font-medium"
            />
          </div>

          <button
            onClick={() => setShowLowStockOnly(prev => !prev)}
            className={`px-4 py-3 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all shrink-0 ${showLowStockOnly
              ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
              : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300'
              }`}
          >
            <AlertTriangle className="w-4 h-4" /> Low Stock Alerts ({lowStockCount})
          </button>
        </div>

        {/* REMAINING INVENTORY SUMMARY STRIP */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <div className="bg-slate-50 dark:bg-black/20 rounded-2xl border border-black/5 dark:border-white/5 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Total Items</p>
            <p className="text-2xl font-extrabold dark:text-white">{activeItems.length}</p>
          </div>
          <div className="bg-slate-50 dark:bg-black/20 rounded-2xl border border-black/5 dark:border-white/5 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Remaining Stock</p>
            <p className="text-2xl font-extrabold dark:text-white">{totalStockUnits.toLocaleString()} <span className="text-sm font-bold text-slate-400">units</span></p>
          </div>
          <div className={`bg-slate-50 dark:bg-black/20 rounded-2xl border p-4 ${lowStockCount > 0 ? 'border-red-500/30' : 'border-black/5 dark:border-white/5'}`}>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Low Stock</p>
            <p className={`text-2xl font-extrabold ${lowStockCount > 0 ? 'text-red-500' : 'dark:text-white'}`}>{lowStockCount}</p>
          </div>
          <div className="bg-slate-50 dark:bg-black/20 rounded-2xl border border-black/5 dark:border-white/5 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Auto-Deduct Items</p>
            <p className="text-2xl font-extrabold dark:text-white">{autoDeductCount}</p>
          </div>
        </div>

        {/* COMPACT CONTENT-START GRID TO ELIMINATE EMPTY VERTICAL WHITE SPACE */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 content-start auto-rows-max overflow-y-auto custom-scrollbar pr-2 flex-1">
          {filtered.map(item => {
            const isLow = item.quantity <= item.minThreshold;
            return (
              <div key={item.id} className="bg-slate-50 dark:bg-black/20 p-4 rounded-2xl border border-black/5 dark:border-white/5 flex flex-col justify-between shadow-sm hover:border-orange-500/30 transition-all gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">{item.name}</h4>
                      {item.deductFromSales && (
                        <span className="bg-green-500/10 text-green-600 dark:text-green-400 text-[9px] font-extrabold px-2 py-0.5 rounded-full">
                          ⚡ Auto Deduct
                        </span>
                      )}
                      {item.linkedProductId && (
                        <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[9px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Link2 className="w-3 h-3" /> {availableProducts.find(p => p.id === item.linkedProductId)?.name || 'Linked'}
                        </span>
                      )}
                      {isLow && (
                        <span className="bg-red-500/10 text-red-600 dark:text-red-400 text-[9px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Low Stock
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                      <span>{item.category}</span>
                      <span>•</span>
                      <span>{formatUGX(item.costPerUnitUGX)}/{item.unit}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 bg-white dark:bg-black/40 p-1.5 rounded-xl border border-black/5 dark:border-white/10 shrink-0">
                    <button
                      onClick={() => handleUpdateStock(item.id, -1)}
                      className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 flex items-center justify-center font-bold text-slate-700 dark:text-white transition-colors"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={item.quantity ?? ''}
                      onChange={(e) => handleSetStock(item.id, e.target.value)}
                      className="w-16 text-center font-black text-sm text-slate-900 dark:text-white bg-transparent focus:outline-none focus:ring-2 focus:ring-orange-500 rounded-lg"
                      title="Remaining stock — type to set exact quantity"
                    />
                    <button
                      onClick={() => handleUpdateStock(item.id, 1)}
                      className="w-7 h-7 rounded-lg bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center font-bold transition-colors shadow-sm"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => openEdit(item)}
                    className="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-300 transition-colors shrink-0"
                    title="Edit ingredient"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-black/5 dark:border-white/5">
                  <span>Unit: <strong className="text-slate-700 dark:text-slate-200">{item.unit}</strong></span>
                  <span>Min Threshold: <strong className="text-slate-700 dark:text-slate-200">{item.minThreshold} {item.unit}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stock Movements Modal */}
      <AnimatePresence>
        {showMovementsModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#121214] w-full max-w-3xl rounded-[2.5rem] p-6 shadow-2xl space-y-4 border border-black/10 dark:border-white/10 max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between border-b pb-4 border-black/5 dark:border-white/10">
                <div>
                  <h3 className="text-xl font-bold dark:text-white">Stock Movement History & Audit Log</h3>
                  <p className="text-xs text-slate-500">Every automatic POS sale deduction and manual stock adjustment</p>
                </div>
                <button onClick={() => setShowMovementsModal(false)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10">
                  <X className="w-5 h-5 dark:text-white" />
                </button>
              </div>

              <div className="overflow-y-auto custom-scrollbar flex-1 space-y-2 pr-1">
                {movements.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-sm">No stock movements recorded yet.</div>
                ) : (
                  movements.map(m => (
                    <div key={m.id} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-black/20 border border-black/5 dark:border-white/5 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">{m.ingredientName}</span>
                          <span className={`px-2 py-0.5 rounded-full font-extrabold text-[10px] ${m.quantityChange < 0 ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'
                            }`}>
                            {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
                          </span>
                        </div>
                        <p className="text-slate-400 mt-0.5">
                          {m.type === 'sale_deduction' ? `POS Sale Order #${m.orderId || ''} (${m.productName || 'Product'})` : `Manual adjustment by ${m.performedBy || 'Staff'}`}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="font-mono text-slate-500 dark:text-slate-400 block font-semibold">
                          {m.quantityBefore} ➔ {m.quantityAfter}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Ingredient Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#121214] w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl space-y-4 border border-black/10 dark:border-white/10"
            >
              <h3 className="text-2xl font-bold dark:text-white">{editingItem ? 'Edit Ingredient / Item' : 'Add New Ingredient / Item'}</h3>
              <form onSubmit={handleAddIngredient} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Ingredient Name *</label>
                  <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full border dark:border-white/10 rounded-xl p-3 bg-slate-50 dark:bg-black/20 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Initial Stock *</label>
                    <input required type="number" step="0.01" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} className="w-full border dark:border-white/10 rounded-xl p-3 bg-slate-50 dark:bg-black/20 dark:text-white text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Unit</label>
                    <input required value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} className="w-full border dark:border-white/10 rounded-xl p-3 bg-slate-50 dark:bg-black/20 dark:text-white text-sm focus:ring-2 focus:ring-orange-500 outline-none" placeholder="kg, L, Pcs" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Category</label>
                    <input value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full border dark:border-white/10 rounded-xl p-3 bg-slate-50 dark:bg-black/20 dark:text-white text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Min Threshold</label>
                    <input type="number" value={formData.minThreshold} onChange={e => setFormData({ ...formData, minThreshold: e.target.value })} className="w-full border dark:border-white/10 rounded-xl p-3 bg-slate-50 dark:bg-black/20 dark:text-white text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
                  </div>
                </div>

                {/* Deduct From Sales Option */}
                <div className="bg-orange-500/10 border border-orange-500/20 p-3.5 rounded-2xl space-y-3">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.deductFromSales}
                      onChange={e => setFormData({ ...formData, deductFromSales: e.target.checked })}
                      className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500 cursor-pointer"
                    />
                    <div>
                      <span className="font-bold text-xs text-slate-900 dark:text-white block">Deduct From Sales Automatically</span>
                      <span className="text-[10px] text-slate-500">Decreases stock automatically when the linked product is sold via POS</span>
                    </div>
                  </label>

                  {formData.deductFromSales && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Linked Menu Product</label>
                        <select
                          value={formData.linkedProductId}
                          onChange={e => setFormData({ ...formData, linkedProductId: e.target.value })}
                          className="w-full bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 rounded-xl p-2.5 text-xs font-semibold text-slate-900 dark:text-white"
                        >
                          <option value="">-- Select Product --</option>
                          {availableProducts.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({formatUGX(p.price)})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Units Deducted Per Sale</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.deductAmountPerSale}
                          onChange={e => setFormData({ ...formData, deductAmountPerSale: e.target.value })}
                          className="w-full bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 rounded-xl p-2.5 text-xs font-bold text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-3">
                  <button type="button" onClick={() => { setIsAdding(false); setEditingItem(null); resetForm(); }} className="flex-1 py-3 font-bold rounded-xl bg-slate-100 dark:bg-white/5 dark:text-white hover:bg-slate-200 text-sm">Cancel</button>
                  <button type="submit" className="flex-1 py-3 font-bold rounded-xl bg-orange-500 text-white hover:bg-orange-600 text-sm shadow-md">{editingItem ? 'Save Changes' : 'Save Ingredient'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
