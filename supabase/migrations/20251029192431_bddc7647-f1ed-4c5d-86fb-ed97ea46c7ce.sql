-- ============================================
-- MIGRAÇÃO: Otimização completa do sistema Menu's
-- ============================================

-- 1. REMOVER CAMPO DELETED DA TABELA PRODUCTS
-- Produtos agora serão deletados permanentemente (hard delete)
ALTER TABLE public.products DROP COLUMN IF EXISTS deleted;
ALTER TABLE public.products DROP COLUMN IF EXISTS deleted_at;

-- 2. CRIAR ÍNDICES PARA MELHORAR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_products_category_available 
ON public.products(category_id, available) WHERE available = true;

CREATE INDEX IF NOT EXISTS idx_orders_table_created 
ON public.orders(table_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bills_table_status 
ON public.bills(table_id, status);

CREATE INDEX IF NOT EXISTS idx_order_items_order 
ON public.order_items(order_id);

-- 3. ATUALIZAR FUNÇÃO DE VERIFICAÇÃO DE DISPONIBILIDADE DE PRODUTO
-- Remover check do campo deleted
CREATE OR REPLACE FUNCTION public.check_product_availability(p_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT NOT EXISTS (
    SELECT 1
    FROM product_ingredients pi
    JOIN stock_items si ON si.id = pi.stock_item_id
    WHERE pi.product_id = p_product_id
      AND si.current_quantity <= 0
  );
$function$;

-- 4. LIMPEZA: Remover dados órfãos ou inconsistentes
-- Remover ingredientes de produtos que não existem mais
DELETE FROM product_ingredients
WHERE product_id NOT IN (SELECT id FROM products);

-- Remover adicionais de produtos que não existem mais  
DELETE FROM product_extras
WHERE product_id NOT IN (SELECT id FROM products);

-- 5. OTIMIZAÇÃO: Atualizar RLS policies para melhor performance
-- Manter policies existentes mas garantir que estão otimizadas