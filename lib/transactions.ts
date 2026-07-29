import { db } from './firebase';
import { collection, doc, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore';

export async function placeOrderAtomic(orderData: any, items: any[]) {
  // Uses a Firestore transaction to deduct inventory and create the order atomically
  try {
    await runTransaction(db, async (transaction) => {
      // 1. Read all needed ingredients
      const ingredientRefs: Record<string, any> = {};
      const inventoryReads = [];
      
      for (const item of items) {
        if (item.recipe) {
          for (const req of item.recipe) {
            if (!ingredientRefs[req.ingredientId]) {
              const ref = doc(db, 'ingredients', req.ingredientId);
              ingredientRefs[req.ingredientId] = ref;
              inventoryReads.push(transaction.get(ref));
            }
          }
        }
      }

      const snapshots = await Promise.all(inventoryReads);
      const inventoryState: Record<string, number> = {};
      
      snapshots.forEach(snap => {
        if (snap.exists()) {
          inventoryState[snap.id] = snap.data().stock;
        }
      });

      // 2. Validate stock
      const stockUpdates: Record<string, number> = {};
      for (const item of items) {
        if (item.recipe) {
          for (const req of item.recipe) {
            const currentStock = inventoryState[req.ingredientId] || 0;
            const deduction = req.quantity * item.quantity;
            if (currentStock < deduction) {
              throw new Error(`Insufficient stock for ingredient ${req.ingredientId}`);
            }
            stockUpdates[req.ingredientId] = currentStock - deduction;
            inventoryState[req.ingredientId] = currentStock - deduction; // update for next item
          }
        }
      }

      // 3. Write updates
      // Update inventory
      for (const [id, newStock] of Object.entries(stockUpdates)) {
        transaction.update(ingredientRefs[id], { stock: newStock });
      }

      // Create order
      const newOrderRef = doc(collection(db, 'orders'));
      transaction.set(newOrderRef, {
        ...orderData,
        items,
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      
      // Post to accounting ledger (double entry)
      const ledgerRef = doc(collection(db, 'accountingLedger'));
      transaction.set(ledgerRef, {
        orderId: newOrderRef.id,
        restaurantId: orderData.restaurantId,
        type: 'SALE',
        debit: orderData.total,
        credit: orderData.total, // Simplified: Debit Cash, Credit Revenue
        timestamp: Date.now()
      });
    });
    
    return { success: true };
  } catch (error) {
    console.error('Transaction failed:', error);
    throw error;
  }
}
