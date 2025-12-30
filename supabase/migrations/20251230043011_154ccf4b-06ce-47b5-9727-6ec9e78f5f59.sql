-- =====================================================
-- LOYALTY PROGRAMS & COUPONS ENHANCEMENT
-- =====================================================

-- 1. Nova tabela: loyalty_programs (Programas de Fidelidade)
CREATE TABLE public.loyalty_programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('purchases', 'spending')),
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Nova tabela: loyalty_program_rewards (Recompensas de cada programa)
CREATE TABLE public.loyalty_program_rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID NOT NULL REFERENCES public.loyalty_programs(id) ON DELETE CASCADE,
  trigger_value NUMERIC NOT NULL,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('discount_percentage', 'discount_fixed', 'free_item', 'free_delivery')),
  reward_value NUMERIC,
  reward_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Nova tabela: customer_loyalty_progress (Progresso de cada cliente em cada programa)
CREATE TABLE public.customer_loyalty_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  customer_cpf TEXT NOT NULL,
  program_id UUID NOT NULL REFERENCES public.loyalty_programs(id) ON DELETE CASCADE,
  purchase_count INTEGER DEFAULT 0,
  total_spent NUMERIC DEFAULT 0,
  last_reward_trigger NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (customer_cpf, program_id)
);

-- 4. Adicionar novos campos à tabela coupons
ALTER TABLE public.coupons 
  ADD COLUMN IF NOT EXISTS usage_limit_per_user INTEGER,
  ADD COLUMN IF NOT EXISTS target_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coupon_type TEXT DEFAULT 'discount' CHECK (coupon_type IN ('discount', 'free_product', 'free_delivery')),
  ADD COLUMN IF NOT EXISTS valid_from TIMESTAMP WITH TIME ZONE DEFAULT now();

-- 5. Enable RLS on new tables
ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_program_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_loyalty_progress ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for loyalty_programs
CREATE POLICY "Allow all operations on loyalty_programs"
  ON public.loyalty_programs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 7. RLS Policies for loyalty_program_rewards
CREATE POLICY "Allow all operations on loyalty_program_rewards"
  ON public.loyalty_program_rewards
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 8. RLS Policies for customer_loyalty_progress
CREATE POLICY "Allow all operations on customer_loyalty_progress"
  ON public.customer_loyalty_progress
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 9. Indexes for performance
CREATE INDEX idx_loyalty_programs_restaurant ON public.loyalty_programs(restaurant_id);
CREATE INDEX idx_loyalty_programs_active ON public.loyalty_programs(restaurant_id, is_active);
CREATE INDEX idx_loyalty_rewards_program ON public.loyalty_program_rewards(program_id);
CREATE INDEX idx_customer_progress_customer ON public.customer_loyalty_progress(customer_cpf);
CREATE INDEX idx_customer_progress_program ON public.customer_loyalty_progress(program_id);
CREATE INDEX idx_coupons_type ON public.coupons(coupon_type);

-- 10. Trigger for updated_at on loyalty_programs
CREATE TRIGGER update_loyalty_programs_updated_at
  BEFORE UPDATE ON public.loyalty_programs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 11. Trigger for updated_at on customer_loyalty_progress
CREATE TRIGGER update_customer_loyalty_progress_updated_at
  BEFORE UPDATE ON public.customer_loyalty_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();