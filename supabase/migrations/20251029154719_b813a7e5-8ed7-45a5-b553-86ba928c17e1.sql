-- Adicionar colunas para soft delete na tabela products
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Criar índice para melhorar performance em queries de produtos não deletados
CREATE INDEX IF NOT EXISTS idx_products_deleted ON public.products(deleted) WHERE deleted = false;