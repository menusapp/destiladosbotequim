-- 1. Update process_order_stock_movement to only fire on delivered/picked_up
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
  -- Only deduct stock when order reaches delivered or picked_up
  IF (NEW.status IN ('delivered', 'picked_up'))
     AND (OLD.status IS NULL OR OLD.status NOT IN ('delivered', 'picked_up', 'completed')) THEN
    
    -- Check if already deducted (idempotency)
    SELECT EXISTS (
      SELECT 1 FROM stock_movements WHERE order_id = NEW.id LIMIT 1
    ) INTO v_already_deducted;
    IF v_already_deducted THEN RETURN NEW; END IF;
    
    v_restaurant_id := NEW.restaurant_id;
    
    FOR v_order_item IN
      SELECT oi.id, oi.quantity, oi.product_id FROM order_items oi WHERE oi.order_id = NEW.id
    LOOP
      -- Product ingredients
      FOR v_ingredient IN
        SELECT pi.stock_item_id, pi.quantity FROM product_ingredients pi WHERE pi.product_id = v_order_item.product_id
      LOOP
        UPDATE stock_items SET current_quantity = current_quantity - (v_ingredient.quantity * v_order_item.quantity) WHERE id = v_ingredient.stock_item_id;
        INSERT INTO stock_movements (stock_item_id, quantity, movement_type, order_id, reason)
        VALUES (v_ingredient.stock_item_id, v_ingredient.quantity * v_order_item.quantity, 'saida', NEW.id, 'Venda - Pedido #' || NEW.id);
      END LOOP;
      
      -- Extras with product_extra_id
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
      
      -- Extras WITHOUT product_extra_id (iFood/DD integrations) - match by name
      FOR v_extra IN
        SELECT oie.extra_name, COALESCE(oie.quantity, 1) AS qty
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

-- 2. Update deduct_stock_for_order_item to only work on delivered/picked_up
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

  -- Only deduct stock for finalized orders
  IF v_order_status NOT IN ('delivered', 'picked_up') THEN
    RETURN;
  END IF;

  -- 1) Deduct product ingredients
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

  -- 2) Deduct extras with product_extra_id
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

  -- 3) Deduct extras WITHOUT product_extra_id (iFood/DD)
  FOR v_extra IN
    SELECT oie.extra_name, COALESCE(oie.quantity, 1) AS qty
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

-- 3. Update revert_stock_on_cancel to revert from delivered/picked_up
CREATE OR REPLACE FUNCTION public.revert_stock_on_cancel()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_movement RECORD;
BEGIN
  -- Only revert if status changed to cancelled from a status that had stock deducted
  IF NEW.status = 'cancelled' 
     AND OLD.status IN ('delivered', 'picked_up') THEN
    
    FOR v_movement IN
      SELECT stock_item_id, quantity
      FROM stock_movements
      WHERE order_id = OLD.id 
        AND movement_type = 'saida'
    LOOP
      UPDATE stock_items
      SET current_quantity = current_quantity + v_movement.quantity
      WHERE id = v_movement.stock_item_id;
      
      INSERT INTO stock_movements (
        stock_item_id, quantity, movement_type, order_id, reason
      ) VALUES (
        v_movement.stock_item_id, v_movement.quantity, 'entrada', OLD.id,
        'Cancelamento - Pedido #' || OLD.id
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 4. Update revert_order_stock_movement (DELETE trigger) to match new logic
CREATE OR REPLACE FUNCTION public.revert_order_stock_movement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_movement RECORD;
BEGIN
  -- Only revert stock if the order had been finalized (delivered/picked_up)
  IF OLD.status NOT IN ('delivered', 'picked_up') THEN
    RETURN OLD;
  END IF;
  FOR v_movement IN
    SELECT stock_item_id, quantity FROM stock_movements WHERE order_id = OLD.id AND movement_type = 'saida'
  LOOP
    UPDATE stock_items SET current_quantity = current_quantity + v_movement.quantity WHERE id = v_movement.stock_item_id;
    INSERT INTO stock_movements (stock_item_id, quantity, movement_type, order_id, reason)
    VALUES (v_movement.stock_item_id, v_movement.quantity, 'entrada', OLD.id, 'Cancelamento - Pedido #' || OLD.id);
  END LOOP;
  RETURN OLD;
END;
$function$;

-- 5. Update add_local_order_to_cash_register to only work on delivered/picked_up
CREATE OR REPLACE FUNCTION public.add_local_order_to_cash_register()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_restaurant_id uuid;
  v_cash_session_id uuid;
  v_bill_subtotal numeric;
  v_service_fee numeric;
  v_bill_total numeric;
  v_service_fee_enabled boolean;
  v_service_fee_percentage numeric;
  v_existing_movement_id uuid;
  v_table_number integer;
BEGIN
  -- Only process when payment_type changes AND order is finalized (delivered/picked_up)
  IF (NEW.order_type IS NULL OR NEW.order_type = 'local')
     AND NEW.table_id IS NOT NULL
     AND NEW.payment_type IS NOT NULL
     AND NEW.payment_type != 'pending'
     AND (OLD.payment_type IS NULL OR OLD.payment_type = 'pending')
     AND NEW.status IN ('delivered', 'picked_up')
  THEN
    
    v_restaurant_id := NEW.restaurant_id;
    
    SELECT service_fee_enabled, service_fee_percentage
    INTO v_service_fee_enabled, v_service_fee_percentage
    FROM restaurants WHERE id = v_restaurant_id;
    
    SELECT id INTO v_cash_session_id
    FROM cash_register_sessions
    WHERE restaurant_id = v_restaurant_id AND status = 'open'
    ORDER BY opened_at DESC LIMIT 1;
    
    IF v_cash_session_id IS NULL THEN RETURN NEW; END IF;
    
    -- Check if already registered
    SELECT id INTO v_existing_movement_id
    FROM cash_movements WHERE order_id = NEW.id LIMIT 1;
    
    IF v_existing_movement_id IS NULL THEN
      SELECT id INTO v_existing_movement_id
      FROM cash_movements
      WHERE cash_session_id = v_cash_session_id
        AND description LIKE 'Pedido Local #' || NEW.id::text || '%'
      LIMIT 1;
    END IF;
    
    IF v_existing_movement_id IS NOT NULL THEN
      UPDATE cash_movements SET payment_method = NEW.payment_type WHERE id = v_existing_movement_id;
      RETURN NEW;
    END IF;
    
    SELECT COALESCE(SUM(oi.price_at_order * oi.quantity + 
      COALESCE((SELECT SUM(oie.price_at_order) FROM order_item_extras oie WHERE oie.order_item_id = oi.id), 0) * oi.quantity), 0)
    INTO v_bill_subtotal
    FROM order_items oi WHERE oi.order_id = NEW.id;
    
    IF v_service_fee_enabled THEN
      v_service_fee := v_bill_subtotal * (v_service_fee_percentage / 100);
    ELSE
      v_service_fee := 0;
    END IF;
    
    v_bill_total := v_bill_subtotal + v_service_fee;
    
    SELECT table_number INTO v_table_number FROM tables WHERE id = NEW.table_id;
    
    INSERT INTO cash_movements (
      cash_session_id, restaurant_id, movement_type, amount,
      payment_method, category, description, created_by, order_id
    ) VALUES (
      v_cash_session_id, v_restaurant_id, 'entrada', v_bill_total,
      NEW.payment_type, 'Pedido',
      'Pedido Local #' || NEW.id || ' - Mesa ' || COALESCE(v_table_number::text, '?') || 
      ' - ' || COALESCE(NEW.customer_name, 'Cliente') || 
      ' (Subtotal: R$ ' || ROUND(v_bill_subtotal, 2) || 
      CASE WHEN v_service_fee > 0 THEN ' + Taxa: R$ ' || ROUND(v_service_fee, 2) ELSE '' END || ')',
      'Sistema', NEW.id
    );
  END IF;
  
  -- Also handle: if order was already registered but status just changed to delivered/picked_up
  -- and payment was set before status (edge case for local orders with immediate payment)
  IF NEW.status IN ('delivered', 'picked_up')
     AND OLD.status NOT IN ('delivered', 'picked_up')
     AND (NEW.order_type IS NULL OR NEW.order_type = 'local')
     AND NEW.table_id IS NOT NULL
     AND NEW.payment_type IS NOT NULL
     AND NEW.payment_type != 'pending'
  THEN
    v_restaurant_id := NEW.restaurant_id;
    
    -- Check if already registered
    SELECT id INTO v_existing_movement_id
    FROM cash_movements WHERE order_id = NEW.id LIMIT 1;
    
    IF v_existing_movement_id IS NULL THEN
      SELECT service_fee_enabled, service_fee_percentage
      INTO v_service_fee_enabled, v_service_fee_percentage
      FROM restaurants WHERE id = v_restaurant_id;
      
      SELECT id INTO v_cash_session_id
      FROM cash_register_sessions
      WHERE restaurant_id = v_restaurant_id AND status = 'open'
      ORDER BY opened_at DESC LIMIT 1;
      
      IF v_cash_session_id IS NOT NULL THEN
        SELECT COALESCE(SUM(oi.price_at_order * oi.quantity + 
          COALESCE((SELECT SUM(oie.price_at_order) FROM order_item_extras oie WHERE oie.order_item_id = oi.id), 0) * oi.quantity), 0)
        INTO v_bill_subtotal
        FROM order_items oi WHERE oi.order_id = NEW.id;
        
        IF v_service_fee_enabled THEN
          v_service_fee := v_bill_subtotal * (v_service_fee_percentage / 100);
        ELSE
          v_service_fee := 0;
        END IF;
        
        v_bill_total := v_bill_subtotal + v_service_fee;
        
        SELECT table_number INTO v_table_number FROM tables WHERE id = NEW.table_id;
        
        INSERT INTO cash_movements (
          cash_session_id, restaurant_id, movement_type, amount,
          payment_method, category, description, created_by, order_id
        ) VALUES (
          v_cash_session_id, v_restaurant_id, 'entrada', v_bill_total,
          NEW.payment_type, 'Pedido',
          'Pedido Local #' || NEW.id || ' - Mesa ' || COALESCE(v_table_number::text, '?') || 
          ' - ' || COALESCE(NEW.customer_name, 'Cliente') || 
          ' (Subtotal: R$ ' || ROUND(v_bill_subtotal, 2) || 
          CASE WHEN v_service_fee > 0 THEN ' + Taxa: R$ ' || ROUND(v_service_fee, 2) ELSE '' END || ')',
          'Sistema', NEW.id
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;