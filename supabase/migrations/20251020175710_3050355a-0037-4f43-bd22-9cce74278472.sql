-- Atualizar função de excluir pedido para verificar liberação de mesa
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
  v_remaining_orders integer;
  v_unpaid_bills integer;
BEGIN
  -- Verifica se o pedido pertence ao restaurante e pega table_id
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

  -- Verifica se ainda há pedidos ou contas não pagas para esta mesa
  SELECT COUNT(*) INTO v_remaining_orders
  FROM orders
  WHERE table_id = v_table_id;

  SELECT COUNT(*) INTO v_unpaid_bills
  FROM bills
  WHERE table_id = v_table_id AND status != 'paid';

  -- Se não há mais pedidos nem contas não pagas, libera a mesa
  IF v_remaining_orders = 0 AND v_unpaid_bills = 0 THEN
    UPDATE tables
    SET 
      is_occupied = false,
      occupied_at = NULL,
      occupied_by = NULL
    WHERE id = v_table_id;
  END IF;
END;
$$;