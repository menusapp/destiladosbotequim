
CREATE OR REPLACE FUNCTION public.process_order_stock_movement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order_item RECORD;
  v_ingredient RECORD;
  v_extra_ingredient RECORD;
  v_extra RECORD;
  v_matched_category_item_id uuid;
  v_restaurant_id uuid;
  v_already_deducted boolean;
BEGIN
  IF (NEW.status IN ('delivered', 'picked_up'))
     AND (OLD.status IS NULL OR OLD.status NOT IN ('delivered', 'picked_up', 'completed')) THEN
    
    SELECT EXISTS (
      SELECT 1 FROM stock_movements WHERE order_id = NEW.id LIMIT 1
    ) INTO v_already_deducted;
    IF v_already_deducted THEN RETURN NEW; END IF;
    
    v_restaurant_id := NEW.restaurant_id;
    
    FOR v_order_item IN
      SELECT oi.id, oi.quantity, oi.product_id FROM order_items oi WHERE oi.order_id = NEW.id
    LOOP
      FOR v_ingredient IN
        SELECT pi.stock_item_id, pi.quantity FROM product_ingredients pi WHERE pi.product_id = v_order_item.product_id
      LOOP
        UPDATE stock_items SET current_quantity = current_quantity - (v_ingredient.quantity * v_order_item.quantity) WHERE id = v_ingredient.stock_item_id;
        INSERT INTO stock_movements (stock_item_id, quantity, movement_type, order_id, reason)
        VALUES (v_ingredient.stock_item_id, v_ingredient.quantity * v_order_item.quantity, 'saida', NEW.id, 'Venda - Pedido #' || NEW.id);
      END LOOP;
      
      FOR v_extra_ingredient IN
        SELECT pei.stock_item_id, pei.quantity
        FROM order_item_extras oie
        JOIN product_extras pe ON pe.id = oie.product_extra_id
        JOIN product_extra_ingredients pei ON pei.product_extra_id = pe.id
        WHERE oie.order_item_id = v_order_item.id
          AND oie.product_extra_id IS NOT NULL
      LOOP
        UPDATE stock_items SET current_quantity = current_quantity - (v_extra_ingredient.quantity * v_order_item.quantity) WHERE id = v_extra_ingredient.stock_item_id;
        INSERT INTO stock_movements (stock_item_id, quantity, movement_type, order_id, reason)
        VALUES (v_extra_ingredient.stock_item_id, v_extra_ingredient.quantity * v_order_item.quantity, 'saida', NEW.id, 'Venda (adicional) - Pedido #' || NEW.id);
      END LOOP;
      
      FOR v_extra IN
        SELECT oie.extra_name, 1 AS qty
        FROM order_item_extras oie
        WHERE oie.order_item_id = v_order_item.id
          AND oie.product_extra_id IS NULL
          AND oie.extra_name IS NOT NULL
      LOOP
        SELECT eci.id INTO v_matched_category_item_id
        FROM extra_category_items eci
        JOIN extra_categories ec ON ec.id = eci.category_id
        WHERE ec.restaurant_id = v_restaurant_id
          AND UPPER(TRIM(eci.name)) = UPPER(TRIM(v_extra.extra_name))
        LIMIT 1;

        IF v_matched_category_item_id IS NOT NULL THEN
          FOR v_extra_ingredient IN
            SELECT ecii.stock_item_id, ecii.quantity
            FROM extra_category_item_ingredients ecii
            WHERE ecii.category_item_id = v_matched_category_item_id
          LOOP
            UPDATE stock_items SET current_quantity = current_quantity - (v_extra_ingredient.quantity * v_extra.qty * v_order_item.quantity) WHERE id = v_extra_ingredient.stock_item_id;
            INSERT INTO stock_movements (stock_item_id, quantity, movement_type, order_id, reason)
            VALUES (v_extra_ingredient.stock_item_id, v_extra_ingredient.quantity * v_extra.qty * v_order_item.quantity, 'saida', NEW.id, 'Venda (complemento) - Pedido #' || NEW.id);
          END LOOP;
        END IF;
      END LOOP;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.deduct_stock_for_order_item(p_order_item_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
  v_order_status text;
  v_product_id uuid;
  v_quantity integer;
  v_restaurant_id uuid;
  v_ingredient RECORD;
  v_extra_ingredient RECORD;
  v_extra RECORD;
  v_matched_category_item_id uuid;
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

  IF v_order_status NOT IN ('delivered', 'picked_up') THEN
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
      AND oie.product_extra_id IS NOT NULL
  LOOP
    UPDATE stock_items
    SET current_quantity = current_quantity - (v_extra_ingredient.quantity * v_quantity)
    WHERE id = v_extra_ingredient.stock_item_id;

    INSERT INTO stock_movements (stock_item_id, quantity, movement_type, order_id, reason)
    VALUES (v_extra_ingredient.stock_item_id, v_extra_ingredient.quantity * v_quantity, 'saida', v_order_id,
            'Adição de item (adicional) - Pedido #' || v_order_id);
  END LOOP;

  FOR v_extra IN
    SELECT oie.extra_name, 1 AS qty
    FROM order_item_extras oie
    WHERE oie.order_item_id = p_order_item_id
      AND oie.product_extra_id IS NULL
      AND oie.extra_name IS NOT NULL
  LOOP
    SELECT eci.id INTO v_matched_category_item_id
    FROM extra_category_items eci
    JOIN extra_categories ec ON ec.id = eci.category_id
    WHERE ec.restaurant_id = v_restaurant_id
      AND UPPER(TRIM(eci.name)) = UPPER(TRIM(v_extra.extra_name))
    LIMIT 1;

    IF v_matched_category_item_id IS NOT NULL THEN
      FOR v_extra_ingredient IN
        SELECT ecii.stock_item_id, ecii.quantity
        FROM extra_category_item_ingredients ecii
        WHERE ecii.category_item_id = v_matched_category_item_id
      LOOP
        UPDATE stock_items
        SET current_quantity = current_quantity - (v_extra_ingredient.quantity * v_extra.qty * v_quantity)
        WHERE id = v_extra_ingredient.stock_item_id;

        INSERT INTO stock_movements (stock_item_id, quantity, movement_type, order_id, reason)
        VALUES (v_extra_ingredient.stock_item_id, v_extra_ingredient.quantity * v_extra.qty * v_quantity, 'saida', v_order_id,
                'Adição de item (complemento) - Pedido #' || v_order_id);
      END LOOP;
    END IF;
  END LOOP;
END;
$function$;
