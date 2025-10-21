-- Função para verificar se um produto tem ingredientes disponíveis
CREATE OR REPLACE FUNCTION public.check_product_availability(p_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM product_ingredients pi
    JOIN stock_items si ON si.id = pi.stock_item_id
    WHERE pi.product_id = p_product_id
      AND si.current_quantity <= 0
  );
$$;

-- View para produtos com disponibilidade baseada no estoque
CREATE OR REPLACE VIEW public.products_with_stock_availability AS
SELECT 
  p.*,
  CASE 
    WHEN p.available = false THEN false
    WHEN NOT EXISTS (SELECT 1 FROM product_ingredients WHERE product_id = p.id) THEN p.available
    ELSE check_product_availability(p.id)
  END as stock_available
FROM products p;