-- Corrigir a função para usar 'entrada' ao invés de 'income'
CREATE OR REPLACE FUNCTION public.add_order_to_cash_register()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_restaurant_id uuid;
  v_cash_session_id uuid;
  v_bill_total numeric;
BEGIN
  -- Apenas processar quando o status mudar para 'accepted'
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    -- Buscar restaurant_id da mesa
    SELECT t.restaurant_id INTO v_restaurant_id
    FROM tables t
    WHERE t.id = NEW.table_id;
    
    -- Buscar sessão de caixa aberta
    SELECT id INTO v_cash_session_id
    FROM cash_register_sessions
    WHERE restaurant_id = v_restaurant_id
      AND status = 'open'
    ORDER BY opened_at DESC
    LIMIT 1;
    
    -- Se houver caixa aberto, adicionar movimentação
    IF v_cash_session_id IS NOT NULL THEN
      -- Calcular total do pedido
      SELECT COALESCE(SUM(oi.price_at_order * oi.quantity + 
        COALESCE((SELECT SUM(oie.price_at_order) 
                  FROM order_item_extras oie 
                  WHERE oie.order_item_id = oi.id), 0)), 0)
      INTO v_bill_total
      FROM order_items oi
      WHERE oi.order_id = NEW.id;
      
      -- Inserir movimentação no caixa usando 'entrada' em português
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
        'entrada',  -- Usar 'entrada' ao invés de 'income'
        v_bill_total,
        'pending',
        'Pedido',
        'Pedido #' || NEW.id || ' - ' || NEW.customer_name,
        'Sistema'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;