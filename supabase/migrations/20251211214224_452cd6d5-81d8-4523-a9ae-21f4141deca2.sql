-- Create customers table for CRM
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  cpf TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(restaurant_id, cpf)
);

-- Indexes for fast search
CREATE INDEX idx_customers_restaurant_cpf ON customers(restaurant_id, cpf);
CREATE INDEX idx_customers_restaurant_name ON customers(restaurant_id, name);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Allow all operations on customers" 
ON public.customers 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Populate customers from existing orders data
INSERT INTO public.customers (restaurant_id, cpf, name, phone, created_at)
SELECT DISTINCT ON (restaurant_id, customer_cpf)
  restaurant_id,
  customer_cpf,
  customer_name,
  delivery_phone,
  MIN(created_at) OVER (PARTITION BY restaurant_id, customer_cpf)
FROM public.orders
WHERE customer_cpf IS NOT NULL AND customer_cpf != ''
ON CONFLICT (restaurant_id, cpf) DO NOTHING;

-- Also populate from customer_addresses
INSERT INTO public.customers (restaurant_id, cpf, name, phone)
SELECT DISTINCT ON (ca.customer_cpf)
  o.restaurant_id,
  ca.customer_cpf,
  ca.customer_name,
  ca.customer_phone
FROM public.customer_addresses ca
JOIN public.orders o ON o.customer_cpf = ca.customer_cpf
WHERE ca.customer_cpf IS NOT NULL AND ca.customer_cpf != ''
ON CONFLICT (restaurant_id, cpf) DO UPDATE SET
  phone = COALESCE(EXCLUDED.phone, customers.phone),
  name = COALESCE(EXCLUDED.name, customers.name);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;