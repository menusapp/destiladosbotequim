-- 1. DROP da trigger e função antiga com CASCADE
DROP TRIGGER IF EXISTS orders_add_to_cash_trigger ON orders;
DROP TRIGGER IF EXISTS trigger_add_order_to_cash ON orders;
DROP FUNCTION IF EXISTS add_order_to_cash_register() CASCADE;

-- 2. Nova função para pedidos LOCAIS (status = 'accepted')
CREATE OR REPLACE FUNCTION add_local_order_to_cash_register()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  -- Só processar quando status mudar para 'accepted' e for pedido LOCAL
  IF NEW.status = 'accepted' 
     AND (OLD.status IS NULL OR OLD.status != 'accepted')
     AND (NEW.order_type IS NULL OR NEW.order_type = 'local')
     AND NEW.table_id IS NOT NULL THEN
    
    v_restaurant_id := NEW.restaurant_id;
    
    -- Buscar configurações do restaurante
    SELECT service_fee_enabled, service_fee_percentage
    INTO v_service_fee_enabled, v_service_fee_percentage
    FROM restaurants
    WHERE id = v_restaurant_id;
    
    -- Buscar sessão de caixa aberta
    SELECT id INTO v_cash_session_id
    FROM cash_register_sessions
    WHERE restaurant_id = v_restaurant_id
      AND status = 'open'
    ORDER BY opened_at DESC
    LIMIT 1;
    
    -- Se não houver caixa aberto, não registrar
    IF v_cash_session_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Verificar se já existe movimento para este pedido
    SELECT id INTO v_existing_movement_id
    FROM cash_movements
    WHERE cash_session_id = v_cash_session_id
      AND description LIKE 'Pedido Local #' || NEW.id::text || '%'
    LIMIT 1;
    
    -- Se já existe, não criar duplicado
    IF v_existing_movement_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
    
    -- Calcular total do pedido
    SELECT COALESCE(SUM(oi.price_at_order * oi.quantity + 
      COALESCE((SELECT SUM(oie.price_at_order) 
                FROM order_item_extras oie 
                WHERE oie.order_item_id = oi.id), 0)), 0)
    INTO v_bill_subtotal
    FROM order_items oi
    WHERE oi.order_id = NEW.id;
    
    -- Aplicar taxa de serviço se habilitada
    IF v_service_fee_enabled THEN
      v_service_fee := v_bill_subtotal * (v_service_fee_percentage / 100);
    ELSE
      v_service_fee := 0;
    END IF;
    
    v_bill_total := v_bill_subtotal + v_service_fee;
    
    -- Buscar número da mesa
    SELECT table_number INTO v_table_number
    FROM tables
    WHERE id = NEW.table_id;
    
    -- Registrar movimento no caixa com payment_method = 'pending'
    INSERT INTO cash_movements (
      cash_session_id,
      restaurant_id,
      movement_type,
      amount,
      payment_method,
      category,
      description,
      created_by
    ) VALUES (
      v_cash_session_id,
      v_restaurant_id,
      'entrada',
      v_bill_total,
      'pending',
      'Pedido',
      'Pedido Local #' || NEW.id || ' - Mesa ' || COALESCE(v_table_number::text, '?') || 
      ' - ' || COALESCE(NEW.customer_name, 'Cliente') || 
      ' (Subtotal: R$ ' || ROUND(v_bill_subtotal, 2) || 
      CASE WHEN v_service_fee > 0 THEN ' + Taxa: R$ ' || ROUND(v_service_fee, 2) ELSE '' END || ')',
      'Sistema'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Nova função para pedidos DELIVERY (status = 'delivered' ou 'picked_up')
CREATE OR REPLACE FUNCTION add_delivery_order_to_cash_register()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
BEGIN
  -- Só processar quando status mudar para 'delivered' ou 'picked_up' e for pedido DELIVERY
  IF (NEW.status = 'delivered' OR NEW.status = 'picked_up')
     AND (OLD.status != 'delivered' AND OLD.status != 'picked_up')
     AND NEW.order_type = 'delivery' THEN
    
    v_restaurant_id := NEW.restaurant_id;
    
    -- Buscar configurações do restaurante
    SELECT service_fee_enabled, service_fee_percentage
    INTO v_service_fee_enabled, v_service_fee_percentage
    FROM restaurants
    WHERE id = v_restaurant_id;
    
    -- Buscar sessão de caixa aberta
    SELECT id INTO v_cash_session_id
    FROM cash_register_sessions
    WHERE restaurant_id = v_restaurant_id
      AND status = 'open'
    ORDER BY opened_at DESC
    LIMIT 1;
    
    -- Se não houver caixa aberto, não registrar
    IF v_cash_session_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Verificar se já existe movimento para este pedido
    SELECT id INTO v_existing_movement_id
    FROM cash_movements
    WHERE cash_session_id = v_cash_session_id
      AND description LIKE 'Pedido Delivery #' || NEW.id::text || '%'
    LIMIT 1;
    
    -- Se já existe, não criar duplicado
    IF v_existing_movement_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
    
    -- Calcular subtotal do pedido
    SELECT COALESCE(SUM(oi.price_at_order * oi.quantity + 
      COALESCE((SELECT SUM(oie.price_at_order) 
                FROM order_item_extras oie 
                WHERE oie.order_item_id = oi.id), 0)), 0)
    INTO v_order_subtotal
    FROM order_items oi
    WHERE oi.order_id = NEW.id;
    
    -- Aplicar taxa de serviço se habilitada
    IF v_service_fee_enabled THEN
      v_service_fee := v_order_subtotal * (v_service_fee_percentage / 100);
    ELSE
      v_service_fee := 0;
    END IF;
    
    -- Taxa de entrega (apenas para delivery, não para pickup)
    IF NEW.delivery_type = 'delivery' THEN
      v_delivery_fee := COALESCE(NEW.delivery_fee, 0);
    ELSE
      v_delivery_fee := 0;
    END IF;
    
    -- Desconto de cupom e pontos de fidelidade
    v_order_total := v_order_subtotal + v_service_fee + v_delivery_fee 
                     - COALESCE(NEW.coupon_discount, 0) 
                     - COALESCE((NEW.loyalty_points_used * 0.01), 0);
    
    -- Registrar movimento no caixa com payment_method do pedido
    INSERT INTO cash_movements (
      cash_session_id,
      restaurant_id,
      movement_type,
      amount,
      payment_method,
      category,
      description,
      created_by
    ) VALUES (
      v_cash_session_id,
      v_restaurant_id,
      'entrada',
      v_order_total,
      COALESCE(NEW.payment_type, 'pending'),
      'Delivery',
      'Pedido Delivery #' || NEW.id || ' - ' || COALESCE(NEW.customer_name, 'Cliente') || 
      ' (' || CASE WHEN NEW.delivery_type = 'pickup' THEN 'Retirada' ELSE 'Entrega' END || ')' ||
      ' - Subtotal: R$ ' || ROUND(v_order_subtotal, 2) || 
      CASE WHEN v_service_fee > 0 THEN ' + Taxa Serviço: R$ ' || ROUND(v_service_fee, 2) ELSE '' END ||
      CASE WHEN v_delivery_fee > 0 THEN ' + Taxa Entrega: R$ ' || ROUND(v_delivery_fee, 2) ELSE '' END ||
      CASE WHEN NEW.coupon_discount > 0 THEN ' - Cupom: R$ ' || ROUND(NEW.coupon_discount, 2) ELSE '' END,
      'Sistema'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Criar triggers
CREATE TRIGGER orders_add_local_to_cash_trigger
AFTER UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION add_local_order_to_cash_register();

CREATE TRIGGER orders_add_delivery_to_cash_trigger
AFTER UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION add_delivery_order_to_cash_register();