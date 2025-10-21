-- Criar tabela para ingredientes dos adicionais (extras)
CREATE TABLE IF NOT EXISTS public.product_extra_ingredients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_extra_id UUID NOT NULL REFERENCES public.product_extras(id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.product_extra_ingredients ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (mesmo padrão dos ingredientes de produtos)
CREATE POLICY "Ingredientes de adicionais são públicos"
  ON public.product_extra_ingredients
  FOR SELECT
  USING (true);

CREATE POLICY "Qualquer um pode criar ingredientes de adicionais"
  ON public.product_extra_ingredients
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Qualquer um pode atualizar ingredientes de adicionais"
  ON public.product_extra_ingredients
  FOR UPDATE
  USING (true);

CREATE POLICY "Qualquer um pode deletar ingredientes de adicionais"
  ON public.product_extra_ingredients
  FOR DELETE
  USING (true);

-- Índices para performance
CREATE INDEX idx_product_extra_ingredients_extra_id ON public.product_extra_ingredients(product_extra_id);
CREATE INDEX idx_product_extra_ingredients_stock_item_id ON public.product_extra_ingredients(stock_item_id);