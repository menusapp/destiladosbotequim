-- Criar tabela de custos fixos
CREATE TABLE IF NOT EXISTS public.fixed_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela de custos variáveis
CREATE TABLE IF NOT EXISTS public.variable_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  amount NUMERIC,
  percentage NUMERIC,
  type TEXT NOT NULL CHECK (type IN ('fixed', 'percentage')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela de custos de mão de obra (funcionários)
CREATE TABLE IF NOT EXISTS public.labor_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  role TEXT,
  salary NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela simplificada de taxas de cartão
CREATE TABLE IF NOT EXISTS public.card_fees_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  debit_fee NUMERIC NOT NULL DEFAULT 0,
  credit_fee NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(restaurant_id)
);

-- RLS Policies para fixed_costs
ALTER TABLE public.fixed_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view fixed costs"
  ON public.fixed_costs FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create fixed costs"
  ON public.fixed_costs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update fixed costs"
  ON public.fixed_costs FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete fixed costs"
  ON public.fixed_costs FOR DELETE
  USING (true);

-- RLS Policies para variable_costs
ALTER TABLE public.variable_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view variable costs"
  ON public.variable_costs FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create variable costs"
  ON public.variable_costs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update variable costs"
  ON public.variable_costs FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete variable costs"
  ON public.variable_costs FOR DELETE
  USING (true);

-- RLS Policies para labor_costs
ALTER TABLE public.labor_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view labor costs"
  ON public.labor_costs FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create labor costs"
  ON public.labor_costs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update labor costs"
  ON public.labor_costs FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete labor costs"
  ON public.labor_costs FOR DELETE
  USING (true);

-- RLS Policies para card_fees_config
ALTER TABLE public.card_fees_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view card fees config"
  ON public.card_fees_config FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create card fees config"
  ON public.card_fees_config FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update card fees config"
  ON public.card_fees_config FOR UPDATE
  USING (true);

-- Triggers para updated_at
CREATE TRIGGER update_fixed_costs_updated_at
  BEFORE UPDATE ON public.fixed_costs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_variable_costs_updated_at
  BEFORE UPDATE ON public.variable_costs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_labor_costs_updated_at
  BEFORE UPDATE ON public.labor_costs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_card_fees_config_updated_at
  BEFORE UPDATE ON public.card_fees_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();