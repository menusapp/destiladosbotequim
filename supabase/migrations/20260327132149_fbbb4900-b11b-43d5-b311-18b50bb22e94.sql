
CREATE OR REPLACE FUNCTION process_order_stock_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_order_item RECORD;
  v_ingredient RECORD;
  v_extra_ingredient RECORD;
  v_restaurant_id uuid;
  v_already_deducted boolean;
BEGIN
  -- Check if this is the first transition to 'accepted' or 'preparing'
  -- Covers: normal orders (pending -> accepted) and PDV orders (pending -> preparing)
  IF (NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted'))
     OR (NEW.status = 'preparing' AND (OLD.status IS NULL OR OLD.status NOT IN ('accepted', 'preparing', 'ready', 'delivered', 'picked_up', 'completed'))) THEN

    -- Prevent double deduction: check if stock was already deducted for this order
    SELECT EXISTS (
      SELECT 1 FROM stock_movements WHERE order_id = NEW.id LIMIT 1
    ) INTO v_already_deducted;

    IF v_already_deducted THEN
      RETURN NEW;
    END IF;

    v_restaurant_id := NEW.restaurant_id;

    FOR v_order_item IN
      SELECT oi.id, oi.quantity, oi.product_id
      FROM order_items oi
      WHERE oi.order_id = NEW.id
    LOOP
      FOR v_ingredient IN
        SELECT pi.stock_item_id, pi.quantity
        FROM product_ingredients pi
        WHERE pi.product_id = v_order_item.product_id
      LOOP
        UPDATE stock_items
        SET current_quantity = current_quantity - (v_ingredient.quantity * v_order_item.quantity)
        WHERE id = v_ingredient.stock_item_id;

        INSERT INTO stock_movements (
          stock_item_id, quantity, movement_type, order_id, reason
        ) VALUES (
          v_ingredient.stock_item_id,
          v_ingredient.quantity * v_order_item.quantity,
          'saida',
          NEW.id,
          'Venda - Pedido #' || NEW.id
        );
      END LOOP;

      FOR v_extra_ingredient IN
        SELECT pei.stock_item_id, pei.quantity
        FROM order_item_extras oie
        JOIN product_extras pe ON pe.id = oie.product_extra_id
        JOIN product_extra_ingredients pei ON pei.product_extra_id = pe.id
        WHERE oie.order_item_id = v_order_item.id
      LOOP
        UPDATE stock_items
        SET current_quantity = current_quantity - (v_extra_ingredient.quantity * v_order_item.quantity)
        WHERE id = v_extra_ingredient.stock_item_id;

        INSERT INTO stock_movements (
          stock_item_id, quantity, movement_type, order_id, reason
        ) VALUES (
          v_extra_ingredient.stock_item_id,
          v_extra_ingredient.quantity * v_order_item.quantity,
          'saida',
          NEW.id,
          'Venda (adicional) - Pedido #' || NEW.id
        );
      END LOOP;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
