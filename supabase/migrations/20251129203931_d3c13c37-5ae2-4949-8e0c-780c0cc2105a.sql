-- Criar tabela comandas
CREATE TABLE IF NOT EXISTS public.comandas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_cpf TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar coluna comanda_id na tabela orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS comanda_id UUID REFERENCES public.comandas(id) ON DELETE SET NULL;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_comandas_restaurant_id ON public.comandas(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_comandas_table_id ON public.comandas(table_id);
CREATE INDEX IF NOT EXISTS idx_comandas_status ON public.comandas(status);
CREATE INDEX IF NOT EXISTS idx_orders_comanda_id ON public.orders(comanda_id);

-- RLS policies para comandas
ALTER TABLE public.comandas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on comandas"
ON public.comandas
FOR ALL
USING (true)
WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_comandas_updated_at
  BEFORE UPDATE ON public.comandas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();