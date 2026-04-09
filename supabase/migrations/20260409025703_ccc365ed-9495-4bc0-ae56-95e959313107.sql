-- Add order_id to cash_movements for direct order linking
ALTER TABLE public.cash_movements
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cash_movements_order_id ON public.cash_movements(order_id);

-- Replace delivery trigger to use order_id and short description
CREATE OR REPLACE FUNCTION public.add_delivery_order_to_cash_register()
RETURNS TRIGGER AS $$
DECLARE
  v_cash_session_id uuid;
  v_order_subtotal numeric;
  v_service_fee numeric;
  v_delivery_fee numeric;
  v_order_total numeric;
  v_service_fee_enabled boolean;
  v_service_fee_percentage numeric;
  v_delivery_label text;
BEGIN
  IF (NEW.status = 'delivered' OR NEW.status = 'picked_up')
     AND (OLD.status != 'delivered' AND OLD.status != 'picked_up')
     AND NEW.order_type = 'delivery' THEN

    -- Check for duplicate by order_id
    IF EXISTS (
      SELECT 1 FROM cash_movements WHERE order_id = NEW.id LIMIT 1
    ) THEN
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

    -- Calculate subtotal
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

    v_delivery_label := CASE
      WHEN NEW.delivery_type = 'pickup' THEN 'Retirada'
      WHEN NEW.delivery_type = 'takeaway' THEN 'Viagem'
      ELSE 'Entrega'
    END;

    INSERT INTO cash_movements (
      cash_session_id, restaurant_id, movement_type, amount,
      payment_method, category, description, created_by, order_id
    ) VALUES (
      v_cash_session_id, NEW.restaurant_id, 'entrada', v_order_total,
      COALESCE(NEW.payment_type, 'pending'), 'Delivery',
      'Pedido ' || v_delivery_label || ' - ' || COALESCE(NEW.customer_name, 'Cliente'),
      'Sistema', NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;