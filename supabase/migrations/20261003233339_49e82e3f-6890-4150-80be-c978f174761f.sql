ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS renewal_status text NOT NULL DEFAULT 'indefinido';
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS new_rent_amount numeric;