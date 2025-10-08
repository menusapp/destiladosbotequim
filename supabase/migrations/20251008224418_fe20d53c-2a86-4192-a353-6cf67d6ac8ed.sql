-- Criar tabela de categorias de adicionais
CREATE TABLE public.extra_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  restaurant_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela de itens das categorias de adicionais
CREATE TABLE public.extra_category_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.extra_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS para extra_categories
ALTER TABLE public.extra_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categorias de adicionais são públicas"
ON public.extra_categories
FOR SELECT
USING (true);

CREATE POLICY "Qualquer um pode criar categorias de adicionais"
ON public.extra_categories
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Qualquer um pode atualizar categorias de adicionais"
ON public.extra_categories
FOR UPDATE
USING (true);

CREATE POLICY "Qualquer um pode deletar categorias de adicionais"
ON public.extra_categories
FOR DELETE
USING (true);

-- RLS para extra_category_items
ALTER TABLE public.extra_category_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Itens de categorias são públicos"
ON public.extra_category_items
FOR SELECT
USING (true);

CREATE POLICY "Qualquer um pode criar itens de categorias"
ON public.extra_category_items
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Qualquer um pode atualizar itens de categorias"
ON public.extra_category_items
FOR UPDATE
USING (true);

CREATE POLICY "Qualquer um pode deletar itens de categorias"
ON public.extra_category_items
FOR DELETE
USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_extra_categories_updated_at
BEFORE UPDATE ON public.extra_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_extra_category_items_updated_at
BEFORE UPDATE ON public.extra_category_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();