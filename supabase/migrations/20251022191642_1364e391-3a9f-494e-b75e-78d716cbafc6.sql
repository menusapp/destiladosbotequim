-- Função para excluir pedido e sua conta associada
CREATE OR REPLACE FUNCTION admin_delete_order_and_bill(
  p_order_id UUID,
  p_restaurant_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_table_id UUID;
  v_bill_id UUID;
BEGIN
  -- Buscar table_id do pedido
  SELECT table_id INTO v_table_id
  FROM orders
  WHERE id = p_order_id;

  IF v_table_id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  -- Verificar se a mesa pertence ao restaurante
  IF NOT EXISTS (
    SELECT 1 FROM tables 
    WHERE id = v_table_id AND restaurant_id = p_restaurant_id
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Buscar conta associada à mesa
  SELECT id INTO v_bill_id
  FROM bills
  WHERE table_id = v_table_id
  LIMIT 1;

  -- Deletar extras dos itens do pedido
  DELETE FROM order_item_extras
  WHERE order_item_id IN (
    SELECT id FROM order_items WHERE order_id = p_order_id
  );

  -- Deletar itens do pedido
  DELETE FROM order_items WHERE order_id = p_order_id;

  -- Deletar o pedido
  DELETE FROM orders WHERE id = p_order_id;

  -- Se existe conta, deletá-la também
  IF v_bill_id IS NOT NULL THEN
    DELETE FROM bills WHERE id = v_bill_id;
  END IF;

  -- Liberar a mesa
  UPDATE tables
  SET is_occupied = false, occupied_by = NULL, occupied_at = NULL
  WHERE id = v_table_id;
END;
$$;

-- Função para excluir conta e todos os pedidos associados
CREATE OR REPLACE FUNCTION admin_delete_bill_and_orders(
  p_bill_id UUID,
  p_restaurant_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_table_id UUID;
BEGIN
  -- Buscar table_id da conta
  SELECT table_id INTO v_table_id
  FROM bills
  WHERE id = p_bill_id;

  IF v_table_id IS NULL THEN
    RAISE EXCEPTION 'Conta não encontrada';
  END IF;

  -- Verificar se a mesa pertence ao restaurante
  IF NOT EXISTS (
    SELECT 1 FROM tables 
    WHERE id = v_table_id AND restaurant_id = p_restaurant_id
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Deletar todos os extras dos itens dos pedidos da mesa
  DELETE FROM order_item_extras
  WHERE order_item_id IN (
    SELECT oi.id 
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.table_id = v_table_id
  );

  -- Deletar todos os itens dos pedidos da mesa
  DELETE FROM order_items
  WHERE order_id IN (
    SELECT id FROM orders WHERE table_id = v_table_id
  );

  -- Deletar todos os pedidos da mesa
  DELETE FROM orders WHERE table_id = v_table_id;

  -- Deletar a conta
  DELETE FROM bills WHERE id = p_bill_id;

  -- Liberar a mesa
  UPDATE tables
  SET is_occupied = false, occupied_by = NULL, occupied_at = NULL
  WHERE id = v_table_id;
END;
$$;