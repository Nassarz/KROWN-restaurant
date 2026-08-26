-- ── INVENTORY MOVEMENTS TABLE & EXTENDED SCHEMAS ────────────────────────────

CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id TEXT PRIMARY KEY,
    ingredient_id TEXT,
    ingredient_name TEXT NOT NULL,
    type TEXT DEFAULT 'sale_deduction',
    quantity_change NUMERIC DEFAULT 0,
    quantity_before NUMERIC DEFAULT 0,
    quantity_after NUMERIC DEFAULT 0,
    order_id TEXT,
    product_name TEXT,
    branch_id TEXT,
    branch_name TEXT,
    performed_by TEXT DEFAULT 'System POS',
    created_at BIGINT DEFAULT (extract(epoch from now()) * 1000)::BIGINT
);

-- Add missing columns to products table if not present
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS deduct_from_inventory BOOLEAN DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS linked_ingredient_id TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS inventory_deduct_amount NUMERIC DEFAULT 1;

-- Add missing columns to ingredients table if not present
ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS deduct_from_sales BOOLEAN DEFAULT false;
ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS linked_product_id TEXT;
ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS deduct_amount_per_sale NUMERIC DEFAULT 1;

-- Add missing columns to orders table if not present
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_tin TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS notes TEXT;

-- Enable RLS and create permissive policy for inventory_movements
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access to all users" ON public.inventory_movements;
CREATE POLICY "Allow full access to all users" ON public.inventory_movements FOR ALL USING (true) WITH CHECK (true);
