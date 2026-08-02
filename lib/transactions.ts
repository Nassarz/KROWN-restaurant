import { supabase } from './supabase';

export async function placeOrderAtomic(orderData: any, items: any[]) {
  try {
    // Deduct ingredient stock
    for (const item of items) {
      if (item.recipe) {
        for (const req of item.recipe) {
          const { data: ing } = await supabase
            .from('ingredients')
            .select('quantity')
            .eq('id', req.ingredientId)
            .single();

          if (ing) {
            const newQty = Math.max(0, (ing.quantity || 0) - req.quantity * item.quantity);
            await supabase.from('ingredients').update({ quantity: newQty }).eq('id', req.ingredientId);
          }
        }
      }
    }

    // Write order to Supabase
    const orderId = orderData.id || `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const { error } = await supabase.from('orders').upsert({
      ...orderData,
      id: orderId,
      items,
      status: 'pending',
      created_at: Date.now(),
    }, { onConflict: 'id' });

    if (error) throw error;

    // Write to accounting ledger
    await supabase.from('accounting_ledger').insert({
      id: `ledger-${Date.now()}`,
      order_id: orderId,
      restaurant_id: orderData.restaurantId,
      type: 'SALE',
      amount: orderData.total,
      created_at: Date.now()
    });

    return { success: true, orderId };
  } catch (error) {
    console.warn('placeOrderAtomic failed:', error);
    throw error;
  }
}
