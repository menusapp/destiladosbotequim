-- Adicionar campos para sistema de complementos avançado na tabela product_extras
ALTER TABLE public.product_extras 
ADD COLUMN IF NOT EXISTS is_required boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS min_selection integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_selection integer DEFAULT null,
ADD COLUMN IF NOT EXISTS extra_category_id uuid REFERENCES public.extra_categories(id) ON DELETE SET NULL;

-- Criar tabela de ligação entre produtos e categorias de complementos
CREATE TABLE IF NOT EXISTS public.product_complement_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  extra_category_id uuid NOT NULL REFERENCES public.extra_categories(id) ON DELETE CASCADE,
  is_required boolean DEFAULT false,
  min_selection integer DEFAULT 0,
  max_selection integer DEFAULT null,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(product_id, extra_category_id)
);

-- Habilitar RLS
ALTER TABLE public.product_complement_groups ENABLE ROW LEVEL SECURITY;

-- Política de acesso público para product_complement_groups
CREATE POLICY "Allow all operations on product_complement_groups"
ON public.product_complement_groups
FOR ALL
USING (true)
WITH CHECK (true);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_product_complement_groups_product ON public.product_complement_groups(product_id);
CREATE INDEX IF NOT EXISTS idx_product_complement_groups_category ON public.product_complement_groups(extra_category_id);
CREATE INDEX IF NOT EXISTS idx_product_extras_category ON public.product_extras(extra_category_id);