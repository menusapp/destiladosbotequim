-- Remover view com problemas de segurança
DROP VIEW IF EXISTS public.products_with_stock_availability;

-- Atualizar função com search_path correto
CREATE OR REPLACE FUNCTION public.check_product_availability(p_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM product_ingredients pi
    JOIN stock_items si ON si.id = pi.stock_item_id
    WHERE pi.product_id = p_product_id
      AND si.current_quantity <= 0
  );
$$;