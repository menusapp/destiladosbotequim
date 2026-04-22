CREATE OR REPLACE FUNCTION public.admin_cancel_order_item(
  p_order_item_id uuid,
  p_restaurant_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_id uuid;
BEGIN
  -- Verifica que o item pertence a um pedido do restaurante
  SELECT o.id INTO v_order_id
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE oi.id = p_order_item_id
    AND o.restaurant_id = p_restaurant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item não encontrado ou sem permissão';
  END IF;

  -- Devolve ao estoque (só age se status for accepted/preparing/ready/delivered)
  PERFORM public.restore_stock_for_order_item(p_order_item_id, p_restaurant_id);

  -- Remove extras vinculados ao item
  DELETE FROM order_item_extras WHERE order_item_id = p_order_item_id;

  -- Remove o próprio item
  DELETE FROM order_items WHERE id = p_order_item_id;
END;
$$;