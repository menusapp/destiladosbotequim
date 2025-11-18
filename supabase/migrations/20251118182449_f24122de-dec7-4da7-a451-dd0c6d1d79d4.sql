-- 1. Tabela de cupons
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC NOT NULL CHECK (discount_value > 0),
  min_order_value NUMERIC DEFAULT 0 CHECK (min_order_value >= 0),
  max_discount NUMERIC CHECK (max_discount IS NULL OR max_discount > 0),
  is_active BOOLEAN DEFAULT true,
  usage_limit INTEGER CHECK (usage_limit IS NULL OR usage_limit > 0),
  used_count INTEGER DEFAULT 0 CHECK (used_count >= 0),
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT now(),
  valid_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coupons_restaurant ON public.coupons(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons(code) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on coupons" ON public.coupons FOR ALL USING (true) WITH CHECK (true);

-- 2. Tabela de endereços salvos
CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_cpf TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  street TEXT NOT NULL,
  number TEXT NOT NULL,
  complement TEXT,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_cpf ON public.customer_addresses(customer_cpf);

-- Enable RLS
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on customer addresses" ON public.customer_addresses FOR ALL USING (true) WITH CHECK (true);

-- 3. Tabela de programa de fidelidade
CREATE TABLE IF NOT EXISTS public.loyalty_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_cpf TEXT NOT NULL,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  points_balance INTEGER DEFAULT 0 CHECK (points_balance >= 0),
  total_earned INTEGER DEFAULT 0 CHECK (total_earned >= 0),
  total_redeemed INTEGER DEFAULT 0 CHECK (total_redeemed >= 0),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(customer_cpf, restaurant_id)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_points_cpf ON public.loyalty_points(customer_cpf);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_restaurant ON public.loyalty_points(restaurant_id);

-- Enable RLS
ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on loyalty points" ON public.loyalty_points FOR ALL USING (true) WITH CHECK (true);

-- 4. Tabela de transações de fidelidade
CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_cpf TEXT NOT NULL,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  points INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earn', 'redeem')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_cpf ON public.loyalty_transactions(customer_cpf);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_order ON public.loyalty_transactions(order_id);

-- Enable RLS
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on loyalty transactions" ON public.loyalty_transactions FOR ALL USING (true) WITH CHECK (true);

-- 5. Adicionar campos em orders (se não existirem)
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS coupon_code TEXT,
ADD COLUMN IF NOT EXISTS coupon_discount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS loyalty_points_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS loyalty_points_earned INTEGER DEFAULT 0;

-- 6. Configuração de fidelidade no restaurante
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS loyalty_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS loyalty_points_per_real NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS loyalty_real_per_point NUMERIC DEFAULT 0.01;

-- 7. Trigger para updated_at em coupons
CREATE OR REPLACE FUNCTION update_coupons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_coupons_updated_at ON public.coupons;
CREATE TRIGGER trigger_update_coupons_updated_at
BEFORE UPDATE ON public.coupons
FOR EACH ROW
EXECUTE FUNCTION update_coupons_updated_at();

-- 8. Trigger para updated_at em customer_addresses
DROP TRIGGER IF EXISTS trigger_update_customer_addresses_updated_at ON public.customer_addresses;
CREATE TRIGGER trigger_update_customer_addresses_updated_at
BEFORE UPDATE ON public.customer_addresses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();