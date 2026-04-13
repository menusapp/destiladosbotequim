CREATE OR REPLACE FUNCTION add_local_order_to_cash_register()
RETURNS TRIGGER AS $$
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
  -- Only process when payment_type changes from NULL/pending to a real value on local orders
  IF (NEW.order_type IS NULL OR NEW.order_type = 'local')
     AND NEW.table_id IS NOT NULL
     AND NEW.payment_type IS NOT NULL
     AND NEW.payment_type != 'pending'
     AND (OLD.payment_type IS NULL OR OLD.payment_type = 'pending')
  THEN
    
    v_restaurant_id := NEW.restaurant_id;
    
    SELECT service_fee_enabled, service_fee_percentage
    INTO v_service_fee_enabled, v_service_fee_percentage
    FROM restaurants
    WHERE id = v_restaurant_id;
    
    SELECT id INTO v_cash_session_id
    FROM cash_register_sessions
    WHERE restaurant_id = v_restaurant_id
      AND status = 'open'
    ORDER BY opened_at DESC
    LIMIT 1;
    
    IF v_cash_session_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Check by order_id first (robust), then fallback to description pattern
    SELECT id INTO v_existing_movement_id
    FROM cash_movements
    WHERE order_id = NEW.id
    LIMIT 1;
    
    IF v_existing_movement_id IS NULL THEN
      SELECT id INTO v_existing_movement_id
      FROM cash_movements
      WHERE cash_session_id = v_cash_session_id
        AND description LIKE 'Pedido Local #' || NEW.id::text || '%'
      LIMIT 1;
    END IF;
    
    IF v_existing_movement_id IS NOT NULL THEN
      UPDATE cash_movements
      SET payment_method = NEW.payment_type
      WHERE id = v_existing_movement_id;
      RETURN NEW;
    END IF;
    
    SELECT COALESCE(SUM(oi.price_at_order * oi.quantity + 
      COALESCE((SELECT SUM(oie.price_at_order) 
                FROM order_item_extras oie 
                WHERE oie.order_item_id = oi.id), 0)), 0)
    INTO v_bill_subtotal
    FROM order_items oi
    WHERE oi.order_id = NEW.id;
    
    IF v_service_fee_enabled THEN
      v_service_fee := v_bill_subtotal * (v_service_fee_percentage / 100);
    ELSE
      v_service_fee := 0;
    END IF;
    
    v_bill_total := v_bill_subtotal + v_service_fee;
    
    SELECT table_number INTO v_table_number
    FROM tables
    WHERE id = NEW.table_id;
    
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
      'Sistema',
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;