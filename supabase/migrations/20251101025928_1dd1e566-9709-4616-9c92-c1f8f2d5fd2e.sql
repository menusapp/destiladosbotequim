-- Fix add_order_to_cash_register to prevent duplicate entries and exclude manual bills
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
  -- Apenas processar quando o status mudar para 'accepted'
  -- E NÃO processar contas manuais (que são registradas via trigger de bill payment)
  IF NEW.status = 'accepted' 
     AND (OLD IS NULL OR OLD.status IS NULL OR OLD.status != 'accepted')
     AND (NEW.notes IS NULL OR NEW.notes != 'Conta Manual') THEN
    
    -- Buscar restaurant_id e configurações da mesa
    SELECT t.restaurant_id, r.service_fee_enabled, r.service_fee_percentage
    INTO v_restaurant_id, v_service_fee_enabled, v_service_fee_percentage
    FROM tables t
    JOIN restaurants r ON r.id = t.restaurant_id
    WHERE t.id = NEW.table_id;
    
    -- Buscar sessão de caixa aberta
    SELECT id INTO v_cash_session_id
    FROM cash_register_sessions
    WHERE restaurant_id = v_restaurant_id
      AND status = 'open'
    ORDER BY opened_at DESC
    LIMIT 1;
    
    -- Se houver caixa aberto, verificar se já existe movimentação para este pedido
    IF v_cash_session_id IS NOT NULL THEN
      -- Verificar se já existe entrada para este pedido (evitar duplicação)
      SELECT id INTO v_existing_movement_id
      FROM cash_movements
      WHERE cash_session_id = v_cash_session_id
        AND description LIKE 'Pedido #' || NEW.id || '%'
      LIMIT 1;
      
      -- Só inserir se não existir movimentação
      IF v_existing_movement_id IS NULL THEN
        -- Calcular subtotal do pedido (itens + extras)
        SELECT COALESCE(SUM(oi.price_at_order * oi.quantity + 
          COALESCE((SELECT SUM(oie.price_at_order) 
                    FROM order_item_extras oie 
                    WHERE oie.order_item_id = oi.id), 0)), 0)
        INTO v_bill_subtotal
        FROM order_items oi
        WHERE oi.order_id = NEW.id;
        
        -- Calcular taxa de serviço se habilitada
        IF v_service_fee_enabled THEN
          v_service_fee := v_bill_subtotal * (v_service_fee_percentage / 100);
        ELSE
          v_service_fee := 0;
        END IF;
        
        -- Calcular total (subtotal + taxa de serviço)
        v_bill_total := v_bill_subtotal + v_service_fee;
        
        -- Inserir movimentação no caixa com o total completo
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
          'Pedido #' || NEW.id || ' - ' || NEW.customer_name || 
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