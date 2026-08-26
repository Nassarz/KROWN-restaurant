'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Plus, Grid, Layers, Trash2, Edit3, User, Minus, X } from 'lucide-react';
import { dataStore } from '@/lib/dataStore';
import { PlaceZone } from '@/lib/mockData';
import { vibrate } from '@/lib/utils';

export default function AdminZones({ currentBranchId }: { currentBranchId?: string }) {
  const [zones, setZones] = useState<PlaceZone[]>(() => dataStore.getZones(currentBranchId));
  const [showAddZone, setShowAddZone] = useState(false);
  const [showAddTableModal, setShowAddTableModal] = useState<string | null>(null);

  // New Zone Form State
  const [zoneName, setZoneName] = useState('');
  const [zoneIcon, setZoneIcon] = useState('🌿');
  const [zoneDesc, setZoneDesc] = useState('');
  const [tablePrefix, setTablePrefix] = useState('G');
  const [tableCount, setTableCount] = useState('6');
  const [defaultSeats, setDefaultSeats] = useState('4');

  // New Single Table Form State
  const [newTableNum, setNewTableNum] = useState('');
  const [newTableSeats, setNewTableSeats] = useState('4');
  const [newTableShape, setNewTableShape] = useState<'round' | 'rectangle'>('round');

  useEffect(() => {
    const unsub = dataStore.subscribe(() => {
      setZones(dataStore.getZones(currentBranchId));
    });
    return () => unsub();
  }, [currentBranchId]);

  const handleCreateZone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneName.trim()) return;

    const count = Math.max(1, Math.min(30, Number(tableCount) || 6));
    const seats = Math.max(1, Math.min(20, Number(defaultSeats) || 4));
    const prefix = tablePrefix.trim().toUpperCase() || 'T';

    const generatedTables = Array.from({ length: count }, (_, i) => ({
      tableNumber: `${prefix}${i + 1}`,
      seatsCount: seats,
      shape: 'round' as const
    }));

    const branchObj = currentBranchId ? dataStore.getBranches().find(b => b.id === currentBranchId) : undefined;
    dataStore.addPlaceZone({
      name: zoneName.trim(),
      icon: zoneIcon || '📍',
      description: zoneDesc.trim() || 'Restaurant seating zone',
      tables: generatedTables,
      branchId: currentBranchId,
      branchName: branchObj?.name
    });

    setZoneName('');
    setZoneDesc('');
    setShowAddZone(false);
  };

  const handleAddSingleTable = (zoneId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableNum.trim()) return;

    dataStore.addTableToZone(
      zoneId,
      newTableNum.trim().toUpperCase(),
      Number(newTableSeats) || 4,
      newTableShape
    );

    setNewTableNum('');
    setShowAddTableModal(null);
  };

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <MapPin className="w-8 h-8 text-orange-500" /> Places & Interactive Table Setup
          </h2>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Visual table builder. Add places (Garden, VIP, Main Hall), create tables, add/remove seats dynamically.
          </p>
        </div>

        <button
          onClick={() => { vibrate(20); setShowAddZone(true); }}
          className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-3.5 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-orange-500/20 transition-all active:scale-95 text-sm shrink-0"
        >
          <Plus className="w-4 h-4" /> Add Seating Place / Zone
        </button>
      </div>

      {/* Places & Tables Grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-8">
        {zones.map(z => (
          <div
            key={z.id}
            className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl border border-black/5 dark:border-white/10 shadow-2xl rounded-[2.5rem] p-6 lg:p-8 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-6 border-b border-black/5 dark:border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <span className="text-4xl bg-orange-500/10 p-3 rounded-2xl">{z.icon}</span>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">{z.name}</h3>
                    <p className="text-xs text-slate-500 font-medium">{z.description} • Total Tables: {z.tables.length}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { vibrate(15); setShowAddTableModal(z.id); }}
                    className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95"
                  >
                    <Plus className="w-4 h-4" /> Add Table
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(`Delete seating place "${z.name}" and all its tables?`)) {
                        dataStore.deletePlaceZone(z.id);
                      }
                    }}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                    title="Delete Seating Place"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Realistic Visual Table Layout Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {z.tables.map(t => (
                  <div
                    key={t.tableNumber}
                    className="bg-slate-50 dark:bg-black/30 p-5 rounded-[2rem] border border-black/5 dark:border-white/5 flex flex-col items-center justify-between relative shadow-sm group hover:border-orange-500/30 transition-all"
                  >
                    {/* Delete Table Action */}
                    <button
                      onClick={() => {
                        vibrate(10);
                        dataStore.deleteTableFromZone(z.id, t.tableNumber);
                      }}
                      className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete Table"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    {/* Realistic Visual Table Surface & Seat Nodes */}
                    <div className="relative my-4 flex items-center justify-center">
                      {/* Table Outer Surface */}
                      <div className={`w-28 h-28 ${t.shape === 'rectangle' ? 'rounded-2xl' : 'rounded-full'} bg-gradient-to-br from-amber-700 to-amber-900 dark:from-slate-800 dark:to-slate-900 border-4 border-amber-600/40 shadow-xl flex flex-col items-center justify-center text-white z-10`}>
                        <span className="font-black text-xl tracking-tight">{t.tableNumber}</span>
                        <span className="text-[10px] font-bold text-amber-200 uppercase">{t.seatsCount} Seats</span>
                      </div>

                      {/* Seat Nodes Positioned Around Table */}
                      {Array.from({ length: Math.min(12, t.seatsCount) }).map((_, sIdx) => {
                        const angle = (sIdx / Math.min(12, t.seatsCount)) * (2 * Math.PI);
                        const radius = 64; // Distance from center
                        const x = Math.cos(angle) * radius;
                        const y = Math.sin(angle) * radius;

                        return (
                          <div
                            key={sIdx}
                            style={{ transform: `translate(${x}px, ${y}px)` }}
                            className="absolute w-6 h-6 rounded-full bg-orange-500 text-white font-bold text-[10px] flex items-center justify-center shadow-md ring-2 ring-white dark:ring-black/40 z-20"
                          >
                            {sIdx + 1}
                          </div>
                        );
                      })}
                    </div>

                    {/* Dynamic Seat Count Editing Controls */}
                    <div className="w-full flex items-center justify-between pt-3 border-t border-black/5 dark:border-white/5">
                      <span className="text-xs font-bold text-slate-500">Seats: {t.seatsCount}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { vibrate(10); dataStore.removeSeatFromTable(z.id, t.tableNumber); }}
                          className="w-7 h-7 bg-white dark:bg-white/10 text-slate-700 dark:text-slate-200 rounded-lg flex items-center justify-center font-bold hover:bg-red-500 hover:text-white transition-colors"
                          title="Remove Seat"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { vibrate(10); dataStore.addSeatToTable(z.id, t.tableNumber); }}
                          className="w-7 h-7 bg-white dark:bg-white/10 text-slate-700 dark:text-slate-200 rounded-lg flex items-center justify-center font-bold hover:bg-orange-500 hover:text-white transition-colors"
                          title="Add Seat"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Seating Place Modal */}
      <AnimatePresence>
        {showAddZone && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-[#121214] rounded-[2.5rem] p-8 max-w-md w-full border border-black/10 dark:border-white/10 shadow-2xl space-y-4">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Add Seating Place</h3>
              <form onSubmit={handleCreateZone} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Place / Zone Name *</label>
                  <input type="text" required value={zoneName} onChange={e => setZoneName(e.target.value)} placeholder="e.g. Garden Terrace" className="w-full bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white font-medium" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Icon Emoji</label>
                    <input type="text" value={zoneIcon} onChange={e => setZoneIcon(e.target.value)} placeholder="🌿" className="w-full bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Table Code Prefix</label>
                    <input type="text" value={tablePrefix} onChange={e => setTablePrefix(e.target.value)} placeholder="G" className="w-full bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white font-mono uppercase" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Short Description</label>
                  <input type="text" value={zoneDesc} onChange={e => setZoneDesc(e.target.value)} placeholder="e.g. Outdoor garden dining" className="w-full bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Initial Tables Count</label>
                    <input type="number" value={tableCount} onChange={e => setTableCount(e.target.value)} placeholder="6" className="w-full bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Seats Per Table</label>
                    <input type="number" value={defaultSeats} onChange={e => setDefaultSeats(e.target.value)} placeholder="4" className="w-full bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white" />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowAddZone(false)} className="flex-1 py-3 font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white">Cancel</button>
                  <button type="submit" className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-orange-500/20">Save Place</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Single Table Modal */}
      <AnimatePresence>
        {showAddTableModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-[#121214] rounded-[2.5rem] p-8 max-w-md w-full border border-black/10 dark:border-white/10 shadow-2xl space-y-4">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Add Table to Place</h3>
              <form onSubmit={(e) => handleAddSingleTable(showAddTableModal, e)} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Table Code / Number *</label>
                  <input type="text" required value={newTableNum} onChange={e => setNewTableNum(e.target.value)} placeholder="e.g. VIP-5 or T10" className="w-full bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white font-bold" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Seats Count</label>
                    <input type="number" value={newTableSeats} onChange={e => setNewTableSeats(e.target.value)} placeholder="4" className="w-full bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Table Shape</label>
                    <select value={newTableShape} onChange={e => setNewTableShape(e.target.value as any)} className="w-full bg-slate-50 dark:bg-black/30 border border-black/10 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white">
                      <option value="round">Round Table</option>
                      <option value="rectangle">Square / Rectangle</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowAddTableModal(null)} className="flex-1 py-3 font-bold text-slate-500">Cancel</button>
                  <button type="submit" className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-orange-500/20">Add Table</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
