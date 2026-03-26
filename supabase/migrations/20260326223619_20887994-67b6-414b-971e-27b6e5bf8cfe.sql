
CREATE OR REPLACE FUNCTION public.deduct_stock_for_order_item(
  p_order_item_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_id uuid;
  v_order_status text;
  v_product_id uuid;
  v_quantity integer;
  v_restaurant_id uuid;
  v_ingredient RECORD;
  v_extra_ingredient RECORD;
BEGIN
  SELECT oi.order_id, oi.product_id, oi.quantity
  INTO v_order_id, v_product_id, v_quantity
  FROM order_items oi
  WHERE oi.id = p_order_item_id;

  IF NOT FOUND THEN RETURN; END IF;

  SELECT o.status, o.restaurant_id
  INTO v_order_status, v_restaurant_id
  FROM orders o
  WHERE o.id = v_order_id;

  IF v_order_status NOT IN ('accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered') THEN
    RETURN;
  END IF;

  FOR v_ingredient IN
    SELECT pi.stock_item_id, pi.quantity
    FROM product_ingredients pi
    WHERE pi.product_id = v_product_id
  LOOP
    UPDATE stock_items
    SET current_quantity = current_quantity - (v_ingredient.quantity * v_quantity)
    WHERE id = v_ingredient.stock_item_id;

    INSERT INTO stock_movements (stock_item_id, quantity, movement_type, order_id, reason)
    VALUES (v_ingredient.stock_item_id, v_ingredient.quantity * v_quantity, 'saida', v_order_id,
            'Adição de item - Pedido #' || v_order_id);
  END LOOP;

  FOR v_extra_ingredient IN
    SELECT pei.stock_item_id, pei.quantity
    FROM order_item_extras oie
    JOIN product_extras pe ON pe.id = oie.product_extra_id
    JOIN product_extra_ingredients pei ON pei.product_extra_id = pe.id
    WHERE oie.order_item_id = p_order_item_id
  LOOP
    UPDATE stock_items
    SET current_quantity = current_quantity - (v_extra_ingredient.quantity * v_quantity)
    WHERE id = v_extra_ingredient.stock_item_id;

    INSERT INTO stock_movements (stock_item_id, quantity, movement_type, order_id, reason)
    VALUES (v_extra_ingredient.stock_item_id, v_extra_ingredient.quantity * v_quantity, 'saida', v_order_id,
            'Adição de item (adicional) - Pedido #' || v_order_id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_stock_for_order_item(
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
  v_order_status text;
  v_product_id uuid;
  v_quantity integer;
  v_ingredient RECORD;
  v_extra_ingredient RECORD;
BEGIN
  SELECT oi.order_id, oi.product_id, oi.quantity
  INTO v_order_id, v_product_id, v_quantity
  FROM order_items oi
  WHERE oi.id = p_order_item_id;

  IF NOT FOUND THEN RETURN; END IF;

  SELECT o.status INTO v_order_status
  FROM orders o
  WHERE o.id = v_order_id AND o.restaurant_id = p_restaurant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado ou sem permissão';
  END IF;

  IF v_order_status IN ('accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered') THEN
    FOR v_ingredient IN
      SELECT pi.stock_item_id, pi.quantity
      FROM product_ingredients pi
      WHERE pi.product_id = v_product_id
    LOOP
      UPDATE stock_items
      SET current_quantity = current_quantity + (v_ingredient.quantity * v_quantity)
      WHERE id = v_ingredient.stock_item_id;

      INSERT INTO stock_movements (stock_item_id, quantity, movement_type, order_id, reason)
      VALUES (v_ingredient.stock_item_id, v_ingredient.quantity * v_quantity, 'entrada', v_order_id,
              'Remoção de item - Pedido #' || v_order_id);
    END LOOP;

    FOR v_extra_ingredient IN
      SELECT pei.stock_item_id, pei.quantity
      FROM order_item_extras oie
      JOIN product_extras pe ON pe.id = oie.product_extra_id
      JOIN product_extra_ingredients pei ON pei.product_extra_id = pe.id
      WHERE oie.order_item_id = p_order_item_id
    LOOP
      UPDATE stock_items
      SET current_quantity = current_quantity + (v_extra_ingredient.quantity * v_quantity)
      WHERE id = v_extra_ingredient.stock_item_id;

      INSERT INTO stock_movements (stock_item_id, quantity, movement_type, order_id, reason)
      VALUES (v_extra_ingredient.stock_item_id, v_extra_ingredient.quantity * v_quantity, 'entrada', v_order_id,
              'Remoção de item (adicional) - Pedido #' || v_order_id);
    END LOOP;
  END IF;

  DELETE FROM order_item_extras WHERE order_item_id = p_order_item_id;
  DELETE FROM order_items WHERE id = p_order_item_id;
END;
$$;
