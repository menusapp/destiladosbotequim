-- Secure admin update via SECURITY DEFINER verifying restaurant ownership
CREATE OR REPLACE FUNCTION public.admin_update_order_status(p_order_id uuid, p_new_status text, p_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- Verifica se o pedido pertence ao restaurante informado
  SELECT TRUE INTO v_exists
  FROM orders o
  JOIN tables t ON t.id = o.table_id
  WHERE o.id = p_order_id AND t.restaurant_id = p_restaurant_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not authorized to update this order';
  END IF;

  UPDATE orders SET status = p_new_status WHERE id = p_order_id;
END;
$$;