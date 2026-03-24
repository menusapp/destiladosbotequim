
-- Create suppliers table
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  cnpj text,
  email text,
  phone text,
  contact_name text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- RLS policy following project pattern
CREATE POLICY "Allow all operations on suppliers"
  ON public.suppliers
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Add supplier_id to stock_items
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;
