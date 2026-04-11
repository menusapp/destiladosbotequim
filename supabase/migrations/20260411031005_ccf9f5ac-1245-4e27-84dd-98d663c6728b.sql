
CREATE OR REPLACE FUNCTION add_totem_order_to_cash_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cash_session_id uuid;
  v_order_subtotal numeric;
  v_service_fee numeric;
  v_order_total numeric;
  v_service_fee_enabled boolean;
  v_service_fee_percentage numeric;
  v_delivery_label text;
BEGIN
  -- Only handle totem orders that are inserted already paid
  IF NEW.order_channel != 'totem' OR NEW.payment_status != 'paid' THEN
    RETURN NEW;
  END IF;

  -- Check for duplicate
  IF EXISTS (SELECT 1 FROM cash_movements WHERE order_id = NEW.id LIMIT 1) THEN
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

  -- Calculate subtotal from items
  SELECT COALESCE(SUM(
    oi.price_at_order * oi.quantity +
    COALESCE((SELECT SUM(oie.price_at_order) FROM order_item_extras oie WHERE oie.order_item_id = oi.id), 0) * oi.quantity
  ), 0)
  INTO v_order_subtotal
  FROM order_items oi WHERE oi.order_id = NEW.id;

  v_service_fee := CASE WHEN v_service_fee_enabled THEN v_order_subtotal * (v_service_fee_percentage / 100) ELSE 0 END;

  v_order_total := v_order_subtotal + v_service_fee
                   + CASE WHEN NEW.delivery_type = 'delivery' THEN COALESCE(NEW.delivery_fee, 0) ELSE 0 END
                   - COALESCE(NEW.coupon_discount, 0)
                   - COALESCE((NEW.loyalty_points_used * 0.01), 0);

  v_delivery_label := CASE
    WHEN NEW.order_type = 'local' AND NEW.table_id IS NOT NULL THEN 'Totem - Mesa'
    WHEN NEW.delivery_type = 'pickup' THEN 'Totem - Retirada'
    WHEN NEW.delivery_type = 'takeaway' THEN 'Totem - Viagem'
    WHEN NEW.delivery_type = 'delivery' THEN 'Totem - Entrega'
    ELSE 'Totem - Balcão'
  END;

  INSERT INTO cash_movements (
    cash_session_id, restaurant_id, movement_type, amount,
    payment_method, category, description, created_by, order_id
  ) VALUES (
    v_cash_session_id, NEW.restaurant_id, 'entrada', v_order_total,
    COALESCE(NEW.payment_type, 'pending'),
    'Totem',
    'Pedido ' || v_delivery_label || ' - ' || COALESCE(NEW.customer_name, 'Cliente'),
    'Sistema', NEW.id
  );

  RETURN NEW;
END;
$$;

-- Create the AFTER INSERT trigger (deferred so order_items exist)
DROP TRIGGER IF EXISTS orders_add_totem_to_cash_on_insert ON public.orders;

CREATE CONSTRAINT TRIGGER orders_add_totem_to_cash_on_insert
AFTER INSERT ON public.orders
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION add_totem_order_to_cash_on_insert();
