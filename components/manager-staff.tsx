import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, getDocs } from 'firebase/firestore';
import { Users as UsersIcon } from 'lucide-react';

export default function ManagerStaff() {
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    // In a real app we'd fetch users from our auth system or a users collection.
    // Assuming a users collection exists:
    getDocs(collection(db, 'users')).then(snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }).catch(e => console.error(e));
  }, []);

  return (
    <div className="flex flex-col h-full gap-6">
      <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Staff Management</h2>
      <div className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl border border-white/40 dark:border-white/5 shadow-2xl rounded-[2rem] p-6 ring-1 ring-black/5 dark:ring-white/10 flex-1 overflow-y-auto">
        <div className="grid gap-4">
          {users.map(u => (
            <div key={u.id} className="bg-slate-50 dark:bg-black/20 p-4 rounded-2xl border border-black/5 dark:border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-500/20 text-orange-500 rounded-full flex items-center justify-center">
                  <UsersIcon className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">{u.email || u.id}</h4>
                  <p className="text-sm text-slate-500 capitalize">{u.role || 'Staff'}</p>
                </div>
              </div>
            </div>
          ))}
          {users.length === 0 && <p className="text-slate-500 text-center py-8">No staff members found.</p>}
        </div>
      </div>
    </div>
  );
}
