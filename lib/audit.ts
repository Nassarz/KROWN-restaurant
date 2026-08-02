import { supabase } from './supabase';

export const logAudit = async (userEmail: string, action: string, details: any) => {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      user_email: userEmail,
      action,
      details,
      created_at: Date.now(),
    });
    if (error) console.warn('[Supabase] audit log error:', error.message);
  } catch (e) {
    console.warn('Failed to write audit log', e);
  }
};
