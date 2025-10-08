-- Adicionar coluna image_url na tabela products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Criar bucket de storage para fotos dos produtos
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para fotos de produtos
CREATE POLICY "Imagens de produtos são públicas"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Qualquer um pode fazer upload de imagens de produtos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Qualquer um pode atualizar imagens de produtos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-images');

CREATE POLICY "Qualquer um pode deletar imagens de produtos"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-images');

-- Criar tabela de adicionais (extras) dos produtos
CREATE TABLE IF NOT EXISTS public.product_extras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS na tabela product_extras
ALTER TABLE public.product_extras ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para product_extras
CREATE POLICY "Adicionais são públicos"
ON public.product_extras FOR SELECT
USING (true);

CREATE POLICY "Qualquer um pode criar adicionais"
ON public.product_extras FOR INSERT
WITH CHECK (true);

CREATE POLICY "Qualquer um pode atualizar adicionais"
ON public.product_extras FOR UPDATE
USING (true);

CREATE POLICY "Qualquer um pode deletar adicionais"
ON public.product_extras FOR DELETE
USING (true);

-- Criar tabela para vincular extras aos itens do pedido
CREATE TABLE IF NOT EXISTS public.order_item_extras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  product_extra_id UUID NOT NULL REFERENCES public.product_extras(id) ON DELETE CASCADE,
  price_at_order NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS na tabela order_item_extras
ALTER TABLE public.order_item_extras ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para order_item_extras
CREATE POLICY "Qualquer um pode ver extras dos itens do pedido"
ON public.order_item_extras FOR SELECT
USING (true);

CREATE POLICY "Qualquer um pode criar extras dos itens do pedido"
ON public.order_item_extras FOR INSERT
WITH CHECK (true);

-- Criar trigger para atualizar updated_at em product_extras
CREATE TRIGGER update_product_extras_updated_at
BEFORE UPDATE ON public.product_extras
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS policies para INSERT, UPDATE e DELETE em products e categories
CREATE POLICY "Qualquer um pode criar produtos"
ON public.products FOR INSERT
WITH CHECK (true);

CREATE POLICY "Qualquer um pode atualizar produtos"
ON public.products FOR UPDATE
USING (true);

CREATE POLICY "Qualquer um pode deletar produtos"
ON public.products FOR DELETE
USING (true);

CREATE POLICY "Qualquer um pode criar categorias"
ON public.categories FOR INSERT
WITH CHECK (true);

CREATE POLICY "Qualquer um pode atualizar categorias"
ON public.categories FOR UPDATE
USING (true);

CREATE POLICY "Qualquer um pode deletar categorias"
ON public.categories FOR DELETE
USING (true);

CREATE POLICY "Qualquer um pode criar mesas"
ON public.tables FOR INSERT
WITH CHECK (true);

CREATE POLICY "Qualquer um pode atualizar mesas"
ON public.tables FOR UPDATE
USING (true);

CREATE POLICY "Qualquer um pode deletar mesas"
ON public.tables FOR DELETE
USING (true);