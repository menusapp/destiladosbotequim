
-- ============================================
-- CORREÇÃO URGENTE: Remover triggers duplicadas
-- ============================================

-- PROBLEMA 1: Triggers duplicadas de estoque (CAUSA DEDUÇÃO DUPLA)
-- Duas triggers executando process_order_stock_movement() no mesmo evento
DROP TRIGGER IF EXISTS trigger_process_order_stock_movement ON public.orders;

-- PROBLEMA 2: Triggers duplicadas de caixa (CAUSA REGISTRO DUPLO)
-- Duas triggers executando add_order_to_cash_register() no mesmo evento
DROP TRIGGER IF EXISTS trigger_add_order_to_cash ON public.orders;

-- PROBLEMA 3: Limpar extras duplicados existentes
WITH ranked_extras AS (
  SELECT 
    id,
    product_id,
    name,
    price,
    ROW_NUMBER() OVER (PARTITION BY product_id, name ORDER BY created_at ASC) as rn
  FROM product_extras
)
DELETE FROM product_extras
WHERE id IN (
  SELECT id FROM ranked_extras WHERE rn > 1
);

-- MELHORIA: Adicionar constraint UNIQUE para evitar produtos duplicados no futuro
-- Primeiro limpar produtos duplicados se existirem
DO $$
DECLARE
  dup RECORD;
BEGIN
  FOR dup IN 
    SELECT 
      name,
      category_id,
      array_agg(id ORDER BY created_at DESC) as ids
    FROM products
    GROUP BY name, category_id
    HAVING COUNT(*) > 1
  LOOP
    -- Manter o mais recente, deletar os antigos
    FOR i IN 2..array_length(dup.ids, 1) LOOP
      -- Reatribuir ingredientes para o produto mantido
      UPDATE product_ingredients 
      SET product_id = dup.ids[1]
      WHERE product_id = dup.ids[i];
      
      -- Reatribuir extras para o produto mantido
      UPDATE product_extras 
      SET product_id = dup.ids[1]
      WHERE product_id = dup.ids[i];
      
      -- Deletar produto duplicado
      DELETE FROM products WHERE id = dup.ids[i];
    END LOOP;
  END LOOP;
END $$;

-- Adicionar constraint UNIQUE
ALTER TABLE products 
DROP CONSTRAINT IF EXISTS products_name_category_unique;

ALTER TABLE products 
ADD CONSTRAINT products_name_category_unique 
UNIQUE (name, category_id);

-- Comentários de confirmação
COMMENT ON TRIGGER trigger_order_stock_movement ON public.orders IS
'✅ ÚNICA trigger que processa estoque quando pedido é aceito';

COMMENT ON TRIGGER on_order_accepted ON public.orders IS
'✅ ÚNICA trigger que registra pedido no caixa quando aceito';
