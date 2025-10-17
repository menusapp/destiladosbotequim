-- Tabela para sessões de caixa (abertura e fechamento)
CREATE TABLE public.cash_register_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  opened_by TEXT NOT NULL,
  closed_by TEXT,
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  closing_balance NUMERIC,
  expected_balance NUMERIC,
  difference NUMERIC,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela para movimentações de caixa
CREATE TABLE public.cash_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cash_session_id UUID NOT NULL REFERENCES public.cash_register_sessions(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('entrada', 'saida', 'venda', 'sangria', 'suprimento', 'despesa')),
  amount NUMERIC NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  payment_method TEXT,
  bill_id UUID REFERENCES public.bills(id),
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cash_register_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

-- Policies para cash_register_sessions
CREATE POLICY "Qualquer um pode ver sessões de caixa"
ON public.cash_register_sessions FOR SELECT
USING (true);

CREATE POLICY "Qualquer um pode criar sessões de caixa"
ON public.cash_register_sessions FOR INSERT
WITH CHECK (true);

CREATE POLICY "Qualquer um pode atualizar sessões de caixa"
ON public.cash_register_sessions FOR UPDATE
USING (true);

-- Policies para cash_movements
CREATE POLICY "Qualquer um pode ver movimentações de caixa"
ON public.cash_movements FOR SELECT
USING (true);

CREATE POLICY "Qualquer um pode criar movimentações de caixa"
ON public.cash_movements FOR INSERT
WITH CHECK (true);

CREATE POLICY "Qualquer um pode atualizar movimentações de caixa"
ON public.cash_movements FOR UPDATE
USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_cash_register_sessions_updated_at
BEFORE UPDATE ON public.cash_register_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_register_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_movements;