
CREATE OR REPLACE FUNCTION add_delivery_order_to_cash_register()
RETURNS TRIGGER AS $$
DECLARE
  v_restaurant_id uuid;
  v_cash_session_id uuid;
  v_order_subtotal numeric;
  v_service_fee numeric;
  v_delivery_fee numeric;
  v_order_total numeric;
  v_service_fee_enabled boolean;
  v_service_fee_percentage numeric;
  v_existing_movement_id uuid;
  v_description text;
  v_item_record record;
  v_items_text text := '';
  v_payment_label text;
BEGIN
  IF (NEW.status = 'delivered' OR NEW.status = 'picked_up')
     AND (OLD.status != 'delivered' AND OLD.status != 'picked_up')
     AND NEW.order_type = 'delivery' THEN

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

    SELECT id INTO v_existing_movement_id
    FROM cash_movements
    WHERE cash_session_id = v_cash_session_id
      AND description LIKE '%' || NEW.id::text || '%'
    LIMIT 1;

    IF v_existing_movement_id IS NOT NULL THEN
      RETURN NEW;
    END IF;

    -- Calculate subtotal
    SELECT COALESCE(SUM(oi.price_at_order * oi.quantity +
      COALESCE((SELECT SUM(oie.price_at_order)
                FROM order_item_extras oie
                WHERE oie.order_item_id = oi.id), 0) * oi.quantity), 0)
    INTO v_order_subtotal
    FROM order_items oi
    WHERE oi.order_id = NEW.id;

    -- Build items list
    FOR v_item_record IN
      SELECT oi.quantity, COALESCE(p.name, 'Produto') as product_name,
             oi.price_at_order * oi.quantity + COALESCE((SELECT SUM(oie.price_at_order) FROM order_item_extras oie WHERE oie.order_item_id = oi.id), 0) * oi.quantity as item_total
      FROM order_items oi
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = NEW.id
    LOOP
      v_items_text := v_items_text || chr(10) || v_item_record.quantity || 'x ' || v_item_record.product_name || ' - R$ ' || ROUND(v_item_record.item_total, 2);
    END LOOP;

    IF v_service_fee_enabled THEN
      v_service_fee := v_order_subtotal * (v_service_fee_percentage / 100);
    ELSE
      v_service_fee := 0;
    END IF;

    IF NEW.delivery_type = 'delivery' THEN
      v_delivery_fee := COALESCE(NEW.delivery_fee, 0);
    ELSE
      v_delivery_fee := 0;
    END IF;

    v_order_total := v_order_subtotal + v_service_fee + v_delivery_fee
                     - COALESCE(NEW.coupon_discount, 0)
                     - COALESCE((NEW.loyalty_points_used * 0.01), 0);

    -- Payment label
    v_payment_label := CASE
      WHEN NEW.payment_type = 'cash' THEN 'Dinheiro'
      WHEN NEW.payment_type = 'credit' THEN 'Crédito'
      WHEN NEW.payment_type = 'debit' THEN 'Débito'
      WHEN NEW.payment_type = 'pix' THEN 'PIX'
      WHEN NEW.payment_type = 'pix_online' THEN 'PIX Online'
      WHEN NEW.payment_type = 'card_online' THEN 'Cartão Online'
      ELSE COALESCE(NEW.payment_type, 'Pendente')
    END;

    -- Build rich description
    v_description := COALESCE(NEW.customer_name, 'Cliente') ||
      COALESCE('(' || NEW.customer_cpf || ')', '') || chr(10) ||
      CASE WHEN NEW.delivery_type = 'pickup' THEN 'Retirada' WHEN NEW.delivery_type = 'takeaway' THEN 'Para Viagem' ELSE 'Entrega' END ||
      CASE WHEN NEW.delivery_address IS NOT NULL AND NEW.delivery_type = 'delivery' THEN ' - ' || NEW.delivery_address ELSE '' END || chr(10) ||
      v_payment_label ||
      COALESCE(' - ' || NEW.payment_brand, '') || chr(10) ||
      chr(10) || 'Produtos' || v_items_text || chr(10) ||
      chr(10) || 'Subtotal: R$ ' || ROUND(v_order_subtotal, 2) ||
      CASE WHEN v_delivery_fee > 0 THEN chr(10) || 'Taxa Entrega: R$ ' || ROUND(v_delivery_fee, 2) ELSE '' END ||
      CASE WHEN v_service_fee > 0 THEN chr(10) || 'Taxa Serviço: R$ ' || ROUND(v_service_fee, 2) ELSE '' END ||
      CASE WHEN COALESCE(NEW.coupon_discount, 0) > 0 THEN chr(10) || 'Desconto: -R$ ' || ROUND(NEW.coupon_discount, 2) ELSE '' END ||
      chr(10) || 'Total: R$ ' || ROUND(v_order_total, 2);

    INSERT INTO cash_movements (
      cash_session_id, restaurant_id, movement_type, amount, payment_method, category, description, created_by
    ) VALUES (
      v_cash_session_id, v_restaurant_id, 'entrada', v_order_total,
      COALESCE(NEW.payment_type, 'pending'), 'Delivery', v_description, 'Sistema'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
