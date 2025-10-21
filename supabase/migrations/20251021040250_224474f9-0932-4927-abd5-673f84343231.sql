-- Criar tabela para ingredientes dos itens de categorias de adicionais
CREATE TABLE IF NOT EXISTS public.extra_category_item_ingredients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_item_id UUID NOT NULL REFERENCES public.extra_category_items(id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.extra_category_item_ingredients ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Ingredientes de itens de categoria são públicos"
  ON public.extra_category_item_ingredients
  FOR SELECT
  USING (true);

CREATE POLICY "Qualquer um pode criar ingredientes de itens de categoria"
  ON public.extra_category_item_ingredients
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Qualquer um pode atualizar ingredientes de itens de categoria"
  ON public.extra_category_item_ingredients
  FOR UPDATE
  USING (true);

CREATE POLICY "Qualquer um pode deletar ingredientes de itens de categoria"
  ON public.extra_category_item_ingredients
  FOR DELETE
  USING (true);

-- Índices para performance
CREATE INDEX idx_extra_category_item_ingredients_item_id ON public.extra_category_item_ingredients(category_item_id);
CREATE INDEX idx_extra_category_item_ingredients_stock_item_id ON public.extra_category_item_ingredients(stock_item_id);