-- Migration: Fix Staff Table Row-Level Security (RLS) Policy
-- Description: Allows full read, write, update, and delete operations on staff table so RLS never blocks staff administration.

-- 1. Ensure RLS policy allows full access for staff table
ALTER TABLE IF EXISTS public.staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to staff table" ON public.staff;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.staff;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.staff;
DROP POLICY IF EXISTS "Enable update for users based on id" ON public.staff;

CREATE POLICY "Allow full access to staff table" 
ON public.staff 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Grant privileges to authenticated and anon roles
GRANT ALL ON public.staff TO anon;
GRANT ALL ON public.staff TO authenticated;
GRANT ALL ON public.staff TO service_role;
