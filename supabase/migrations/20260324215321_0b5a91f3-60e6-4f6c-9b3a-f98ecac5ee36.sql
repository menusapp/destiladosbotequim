
CREATE OR REPLACE FUNCTION revert_order_stock_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_movement RECORD;
BEGIN
  -- Only revert stock if the order actually had stock deducted (status was accepted or later)
  -- Stock is only deducted when status changes to 'accepted' (via process_order_stock_movement)
  -- So pending/cancelled orders that were never accepted should NOT trigger stock reversion
  IF OLD.status NOT IN ('accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered') THEN
    RETURN OLD;
  END IF;

  -- Se um pedido for deletado, repor o estoque
  FOR v_movement IN
    SELECT stock_item_id, quantity
    FROM stock_movements
    WHERE order_id = OLD.id AND movement_type = 'saida'
  LOOP
    -- Repor quantidade em estoque
    UPDATE stock_items
    SET current_quantity = current_quantity + v_movement.quantity
    WHERE id = v_movement.stock_item_id;

    -- Registrar movimentação de reposição
    INSERT INTO stock_movements (
      stock_item_id,
      quantity,
      movement_type,
      order_id,
      reason
    ) VALUES (
      v_movement.stock_item_id,
      v_movement.quantity,
      'entrada',
      OLD.id,
      'Cancelamento - Pedido #' || OLD.id
    );
  END LOOP;

  RETURN OLD;
END;
$$;
