/**
 * KROWN POS - Database Client
 * Re-exports the Neon API client as `supabase` for backward compatibility.
 * All database operations are routed through Next.js API endpoints.
 */
export { neonDB as supabase } from './neon-client';
