-- Função para excluir pedido (admin)
CREATE OR REPLACE FUNCTION public.admin_delete_order(
  p_order_id uuid,
  p_restaurant_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_table_id uuid;
BEGIN
  -- Verifica se o pedido pertence ao restaurante
  SELECT o.table_id INTO v_table_id
  FROM orders o
  JOIN tables t ON t.id = o.table_id
  WHERE o.id = p_order_id AND t.restaurant_id = p_restaurant_id;

  IF v_table_id IS NULL THEN
    RAISE EXCEPTION 'Not authorized to delete this order';
  END IF;

  -- Exclui extras dos itens do pedido
  DELETE FROM order_item_extras
  WHERE order_item_id IN (
    SELECT id FROM order_items WHERE order_id = p_order_id
  );

  -- Exclui itens do pedido
  DELETE FROM order_items WHERE order_id = p_order_id;

  -- Remove movimentações de caixa relacionadas ao pedido
  DELETE FROM cash_movements
  WHERE description LIKE 'Pedido #' || p_order_id::text || '%';

  -- Exclui o pedido
  DELETE FROM orders WHERE id = p_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_order(uuid, uuid) TO PUBLIC;

-- Função para excluir conta (admin)
CREATE OR REPLACE FUNCTION public.admin_delete_bill(
  p_bill_id uuid,
  p_restaurant_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_table_id uuid;
BEGIN
  -- Verifica se a conta pertence ao restaurante
  SELECT b.table_id INTO v_table_id
  FROM bills b
  JOIN tables t ON t.id = b.table_id
  WHERE b.id = p_bill_id AND t.restaurant_id = p_restaurant_id;

  IF v_table_id IS NULL THEN
    RAISE EXCEPTION 'Not authorized to delete this bill';
  END IF;

  -- Remove referências em cash_movements
  UPDATE cash_movements
  SET bill_id = NULL
  WHERE bill_id = p_bill_id;

  -- Exclui a conta
  DELETE FROM bills WHERE id = p_bill_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_bill(uuid, uuid) TO PUBLIC;