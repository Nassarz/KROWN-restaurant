import { generateId } from './id';

const API = '/api/db';

async function dbGet(table: string, id: string) {
  const res = await fetch(`${API}/${table}?id=${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  const json = await res.json();
  return json.data?.[0] || null;
}

async function dbUpsert(table: string, data: any) {
  const res = await fetch(`${API}/${table}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method: 'upsert', data, conflictKey: 'id' }),
  });
  if (!res.ok) throw new Error(`DB upsert failed on ${table}: ${res.status}`);
}

async function dbUpdate(table: string, id: string, updates: any) {
  const res = await fetch(`${API}/${table}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method: 'update', data: { id, ...updates } }),
  });
  if (!res.ok) throw new Error(`DB update failed on ${table}: ${res.status}`);
}

async function dbInsert(table: string, data: any) {
  const res = await fetch(`${API}/${table}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error(`DB insert failed on ${table}: ${res.status}`);
}

export async function placeOrderAtomic(orderData: any, items: any[]) {
  try {
    // Deduct ingredient stock
    for (const item of items) {
      if (item.recipe) {
        for (const req of item.recipe) {
          const ing = await dbGet('ingredients', req.ingredientId);
          if (ing) {
            const newQty = Math.max(0, (ing.quantity || 0) - req.quantity * item.quantity);
            await dbUpdate('ingredients', req.ingredientId, { quantity: newQty });
          }
        }
      }
    }

    // Write order
    const orderId = orderData.id || generateId();
    await dbUpsert('orders', {
      ...orderData,
      id: orderId,
      items,
      status: 'pending',
      created_at: Date.now(),
    });

    // Write to accounting ledger
    await dbInsert('accounting_ledger', {
      id: generateId(),
      order_id: orderId,
      restaurant_id: orderData.restaurantId,
      type: 'SALE',
      amount: orderData.total,
      created_at: Date.now(),
    });

    return { success: true, orderId };
  } catch (error) {
    console.warn('placeOrderAtomic failed:', error);
    throw error;
  }
}
