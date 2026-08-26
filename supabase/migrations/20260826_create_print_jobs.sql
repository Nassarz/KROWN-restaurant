-- Migration: Add Cash payment calculations and print jobs queue
-- Date: 2026-08-26

-- 1. Add amount_received and change_amount columns to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS amount_received NUMERIC;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS change_amount NUMERIC;

-- 2. Create print_jobs table
CREATE TABLE IF NOT EXISTS public.print_jobs (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES public.orders(id) ON DELETE SET NULL,
  type TEXT NOT NULL, -- 'KITCHEN_TICKET', 'BILL', 'CUSTOMER_RECEIPT'
  destination TEXT NOT NULL, -- e.g. 'Kitchen Printer', 'Receipt Printer'
  printer_id TEXT, -- e.g. 'kitchen', 'receipt'
  payload TEXT NOT NULL, -- Raw text layout or ESC/POS payload
  status TEXT NOT NULL DEFAULT 'QUEUED', -- 'QUEUED', 'PRINTING', 'PRINTED', 'FAILED'
  attempts INT DEFAULT 0,
  created_at BIGINT DEFAULT extract(epoch from now()) * 1000,
  last_error TEXT,
  printed_at BIGINT
);

-- Enable RLS
ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;

-- Create Policies for print_jobs
CREATE POLICY "Super Admin manage all print_jobs"
  ON public.print_jobs FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Staff manage branch print_jobs"
  ON public.print_jobs FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Enable Realtime for print_jobs
ALTER PUBLICATION supabase_realtime ADD TABLE public.print_jobs;
