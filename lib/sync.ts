import { openDB } from 'idb';
import { db } from './firebase';
import { collection, addDoc } from 'firebase/firestore';
import { logAudit } from './audit';

const DB_NAME = 'LumierePOS_DB';
const STORE_NAME = 'offline_orders';

export const initDB = async () => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    },
  });
};

export const saveOfflineOrder = async (orderData: any) => {
  const db = await initDB();
  await db.add(STORE_NAME, { ...orderData, timestamp: Date.now() });
};

export const syncOfflineOrders = async () => {
  if (!navigator.onLine) return;
  
  const idb = await initDB();
  const tx = idb.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const orders = await store.getAll();

  if (orders.length === 0) return;

  for (const order of orders) {
    try {
      const { id, timestamp, ...orderData } = order;
      await addDoc(collection(db, 'orders'), {
        ...orderData,
      });
      if (orderData.userEmail) {
        await logAudit(orderData.userEmail, 'SYNC_OFFLINE_ORDER', { total: orderData.total, type: orderData.type });
      }
      await store.delete(id);
    } catch (e) {
      console.error('Failed to sync offline order:', e);
    }
  }
};
