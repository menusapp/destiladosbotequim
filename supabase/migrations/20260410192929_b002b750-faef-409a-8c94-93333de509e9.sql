
CREATE OR REPLACE FUNCTION public.add_delivery_order_to_cash_register()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cash_session_id uuid;
  v_order_subtotal numeric;
  v_service_fee numeric;
  v_delivery_fee numeric;
  v_order_total numeric;
  v_service_fee_enabled boolean;
  v_service_fee_percentage numeric;
  v_delivery_label text;
  v_is_totem_paid boolean;
BEGIN
  -- Check for duplicate by order_id first (applies to all paths)
  IF EXISTS (
    SELECT 1 FROM cash_movements WHERE order_id = NEW.id LIMIT 1
  ) THEN
    RETURN NEW;
  END IF;

  -- Determine if this is a totem order that just got paid
  v_is_totem_paid := (
    NEW.order_channel = 'totem'
    AND NEW.payment_status = 'paid'
    AND (OLD.payment_status IS DISTINCT FROM 'paid')
  );

  -- Legacy path: delivery orders finalized operationally
  IF NOT v_is_totem_paid THEN
    IF NOT (
      (NEW.status = 'delivered' OR NEW.status = 'picked_up')
      AND (OLD.status != 'delivered' AND OLD.status != 'picked_up')
      AND NEW.order_type = 'delivery'
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Skip legacy path for totem orders (they use the totem path above)
  IF NOT v_is_totem_paid
     AND NEW.order_channel = 'totem' THEN
    RETURN NEW;
  END IF;

  SELECT service_fee_enabled, service_fee_percentage
  INTO v_service_fee_enabled, v_service_fee_percentage
  FROM restaurants WHERE id = NEW.restaurant_id;

  SELECT id INTO v_cash_session_id
  FROM cash_register_sessions
  WHERE restaurant_id = NEW.restaurant_id AND status = 'open'
  ORDER BY opened_at DESC LIMIT 1;

  IF v_cash_session_id IS NULL THEN RETURN NEW; END IF;

  -- Use total_amount if available (Totem persists this), otherwise calculate
  IF NEW.total_amount IS NOT NULL AND NEW.total_amount > 0 THEN
    v_order_total := NEW.total_amount;
  ELSE
    -- Calculate subtotal from items
    SELECT COALESCE(SUM(
      oi.price_at_order * oi.quantity +
      COALESCE((SELECT SUM(oie.price_at_order) FROM order_item_extras oie WHERE oie.order_item_id = oi.id), 0) * oi.quantity
    ), 0)
    INTO v_order_subtotal
    FROM order_items oi WHERE oi.order_id = NEW.id;

    v_service_fee := CASE WHEN v_service_fee_enabled THEN v_order_subtotal * (v_service_fee_percentage / 100) ELSE 0 END;
    v_delivery_fee := CASE WHEN NEW.delivery_type = 'delivery' THEN COALESCE(NEW.delivery_fee, 0) ELSE 0 END;

    v_order_total := v_order_subtotal + v_service_fee + v_delivery_fee
                     - COALESCE(NEW.coupon_discount, 0)
                     - COALESCE((NEW.loyalty_points_used * 0.01), 0);
  END IF;

  -- Build label
  IF v_is_totem_paid THEN
    v_delivery_label := CASE
      WHEN NEW.order_type = 'local' AND NEW.table_id IS NOT NULL THEN 'Totem - Mesa'
      WHEN NEW.delivery_type = 'pickup' THEN 'Totem - Retirada'
      WHEN NEW.delivery_type = 'takeaway' THEN 'Totem - Viagem'
      WHEN NEW.delivery_type = 'delivery' THEN 'Totem - Entrega'
      ELSE 'Totem - Balcão'
    END;
  ELSE
    v_delivery_label := CASE
      WHEN NEW.delivery_type = 'pickup' THEN 'Retirada'
      WHEN NEW.delivery_type = 'takeaway' THEN 'Viagem'
      ELSE 'Entrega'
    END;
  END IF;

  INSERT INTO cash_movements (
    cash_session_id, restaurant_id, movement_type, amount,
    payment_method, category, description, created_by, order_id
  ) VALUES (
    v_cash_session_id, NEW.restaurant_id, 'entrada', v_order_total,
    COALESCE(NEW.payment_type, 'pending'),
    CASE WHEN v_is_totem_paid THEN 'Totem' ELSE 'Delivery' END,
    'Pedido ' || v_delivery_label || ' - ' || COALESCE(NEW.customer_name, 'Cliente'),
    'Sistema', NEW.id
  );

  RETURN NEW;
END;
$$;
