-- Tabela para custos operacionais mensais do restaurante
CREATE TABLE IF NOT EXISTS public.operational_costs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  month_year text NOT NULL, -- formato: 'YYYY-MM'
  fixed_cost numeric NOT NULL DEFAULT 0,
  variable_cost numeric NOT NULL DEFAULT 0,
  variable_cost_type text NOT NULL DEFAULT 'fixed', -- 'fixed' ou 'percentage'
  labor_cost numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(restaurant_id, month_year)
);

-- Tabela para taxas de cartões por bandeira
CREATE TABLE IF NOT EXISTS public.card_fees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  card_brand text NOT NULL,
  fee_percentage numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(restaurant_id, card_brand)
);

-- RLS para operational_costs
ALTER TABLE public.operational_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer um pode ver custos operacionais"
  ON public.operational_costs FOR SELECT
  USING (true);

CREATE POLICY "Qualquer um pode criar custos operacionais"
  ON public.operational_costs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Qualquer um pode atualizar custos operacionais"
  ON public.operational_costs FOR UPDATE
  USING (true);

CREATE POLICY "Qualquer um pode deletar custos operacionais"
  ON public.operational_costs FOR DELETE
  USING (true);

-- RLS para card_fees
ALTER TABLE public.card_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer um pode ver taxas de cartões"
  ON public.card_fees FOR SELECT
  USING (true);

CREATE POLICY "Qualquer um pode criar taxas de cartões"
  ON public.card_fees FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Qualquer um pode atualizar taxas de cartões"
  ON public.card_fees FOR UPDATE
  USING (true);

CREATE POLICY "Qualquer um pode deletar taxas de cartões"
  ON public.card_fees FOR DELETE
  USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_operational_costs_updated_at
  BEFORE UPDATE ON public.operational_costs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_card_fees_updated_at
  BEFORE UPDATE ON public.card_fees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();