-- 1. Adicionar coluna restaurant_id na tabela orders
ALTER TABLE orders 
ADD COLUMN restaurant_id uuid REFERENCES restaurants(id);

-- 2. Preencher restaurant_id para pedidos existentes (via table_id)
UPDATE orders o
SET restaurant_id = t.restaurant_id
FROM tables t
WHERE o.table_id = t.id;

-- 3. Tornar table_id nullable
ALTER TABLE orders 
ALTER COLUMN table_id DROP NOT NULL;

-- 4. Tornar restaurant_id obrigatório após preenchimento
ALTER TABLE orders 
ALTER COLUMN restaurant_id SET NOT NULL;

-- 5. Criar índices para performance
CREATE INDEX idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX idx_orders_order_type ON orders(order_type);

-- 6. Atualizar função add_order_to_cash_register para usar restaurant_id direto
CREATE OR REPLACE FUNCTION public.add_order_to_cash_register()
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
BEGIN
  IF NEW.status = 'accepted' 
     AND (OLD.status IS NULL OR OLD.status != 'accepted')
     AND (NEW.notes IS NULL OR NEW.notes != 'Conta Manual') THEN
    
    -- Usar restaurant_id direto da ordem
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
    
    IF v_cash_session_id IS NOT NULL THEN
      SELECT id INTO v_existing_movement_id
      FROM cash_movements
      WHERE cash_session_id = v_cash_session_id
        AND description LIKE 'Pedido #' || NEW.id::text || '%'
      LIMIT 1;
      
      IF v_existing_movement_id IS NULL THEN
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
          'Pedido #' || NEW.id || ' - ' || COALESCE(NEW.customer_name, 'Cliente') || 
          ' (Subtotal: R$ ' || ROUND(v_bill_subtotal, 2) || 
          CASE WHEN v_service_fee > 0 THEN ' + Taxa: R$ ' || ROUND(v_service_fee, 2) ELSE '' END || ')',
          'Sistema'
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 7. Atualizar função process_order_stock_movement para usar restaurant_id direto
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
  v_restaurant_id uuid;
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    -- Usar restaurant_id direto da ordem
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
          stock_item_id,
          quantity,
          movement_type,
          order_id,
          reason
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
          stock_item_id,
          quantity,
          movement_type,
          order_id,
          reason
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
$function$;

-- 8. Atualizar admin_update_order_status para verificar restaurant_id direto
CREATE OR REPLACE FUNCTION public.admin_update_order_status(p_order_id uuid, p_new_status text, p_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_exists boolean;
BEGIN
  -- Verificar direto via restaurant_id
  SELECT TRUE INTO v_exists
  FROM orders o
  WHERE o.id = p_order_id AND o.restaurant_id = p_restaurant_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not authorized to update this order';
  END IF;

  UPDATE orders SET status = p_new_status WHERE id = p_order_id;
END;
$function$;

-- 9. Atualizar admin_delete_order para só liberar mesa se houver table_id
CREATE OR REPLACE FUNCTION public.admin_delete_order(p_order_id uuid, p_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_table_id uuid;
  v_remaining_orders integer;
  v_unpaid_bills integer;
BEGIN
  -- Verificar se o pedido pertence ao restaurante e pegar table_id
  SELECT o.table_id INTO v_table_id
  FROM orders o
  WHERE o.id = p_order_id AND o.restaurant_id = p_restaurant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not authorized to delete this order';
  END IF;

  -- Excluir extras dos itens do pedido
  DELETE FROM order_item_extras
  WHERE order_item_id IN (
    SELECT id FROM order_items WHERE order_id = p_order_id
  );

  -- Excluir itens do pedido
  DELETE FROM order_items WHERE order_id = p_order_id;

  -- Remover movimentações de caixa relacionadas ao pedido
  DELETE FROM cash_movements
  WHERE description LIKE 'Pedido #' || p_order_id::text || '%';

  -- Excluir o pedido
  DELETE FROM orders WHERE id = p_order_id;

  -- Só verificar e liberar mesa se houver table_id (pedidos locais)
  IF v_table_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_remaining_orders
    FROM orders
    WHERE table_id = v_table_id;

    SELECT COUNT(*) INTO v_unpaid_bills
    FROM bills
    WHERE table_id = v_table_id AND status != 'paid';

    IF v_remaining_orders = 0 AND v_unpaid_bills = 0 THEN
      UPDATE tables
      SET 
        is_occupied = false,
        occupied_at = NULL,
        occupied_by = NULL
      WHERE id = v_table_id;
    END IF;
  END IF;
END;
$function$;

-- 10. Atualizar check_table_release para só rodar se table_id não for null
CREATE OR REPLACE FUNCTION public.check_table_release()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_table_id uuid;
  v_unpaid_bills integer;
  v_active_orders integer;
BEGIN
  v_table_id := NEW.table_id;
  
  -- Só processar se houver table_id (pedidos locais)
  IF v_table_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_unpaid_bills
    FROM bills
    WHERE table_id = v_table_id
      AND status != 'paid';
    
    SELECT COUNT(*) INTO v_active_orders
    FROM orders
    WHERE table_id = v_table_id
      AND status IN ('pending', 'accepted', 'preparing', 'ready');
    
    IF v_unpaid_bills = 0 AND v_active_orders = 0 THEN
      UPDATE tables
      SET 
        is_occupied = false,
        occupied_at = NULL,
        occupied_by = NULL
      WHERE id = v_table_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 11. Limpar mesa virtual 9999 se existir
DELETE FROM tables WHERE table_number = 9999;