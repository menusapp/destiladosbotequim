-- ============================================
-- CORREÇÃO 1: Recriar trigger para registrar pedidos locais no caixa
-- ============================================

-- Remover triggers existentes
DROP TRIGGER IF EXISTS trigger_add_order_to_cash ON orders;
DROP TRIGGER IF EXISTS on_order_accepted ON orders;

-- Remover função com CASCADE
DROP FUNCTION IF EXISTS add_order_to_cash_register() CASCADE;

-- Criar função corrigida
CREATE OR REPLACE FUNCTION add_order_to_cash_register()
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
  -- Só processar quando status mudar para 'accepted' e for pedido local
  IF NEW.status = 'accepted' 
     AND (OLD.status IS NULL OR OLD.status != 'accepted')
     AND (NEW.order_type IS NULL OR NEW.order_type = 'local') THEN
    
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger
CREATE TRIGGER trigger_add_order_to_cash
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION add_order_to_cash_register();

-- ============================================
-- CORREÇÃO 2: Corrigir função admin_mark_bill_paid
-- ============================================

CREATE OR REPLACE FUNCTION admin_mark_bill_paid(p_bill_id uuid, p_restaurant_id uuid)
RETURNS void AS $$
DECLARE
  v_table_id UUID;
  v_payment_method text;
  v_bill_total numeric;
BEGIN
  -- Buscar dados da conta
  SELECT b.table_id, b.payment_method, b.total_amount
  INTO v_table_id, v_payment_method, v_bill_total
  FROM bills b
  JOIN tables t ON t.id = b.table_id
  WHERE b.id = p_bill_id AND t.restaurant_id = p_restaurant_id;

  IF v_table_id IS NULL THEN
    RAISE EXCEPTION 'Conta não encontrada ou sem permissão';
  END IF;

  -- 1. Marcar conta como paga
  UPDATE bills 
  SET status = 'paid', paid_at = NOW()
  WHERE id = p_bill_id;

  -- 2. Atualizar movimentos de caixa relacionados aos pedidos desta mesa
  UPDATE cash_movements m
  SET 
    payment_method = COALESCE(v_payment_method, 'cash'),
    bill_id = p_bill_id
  WHERE m.restaurant_id = p_restaurant_id
    AND m.category = 'Pedido'
    AND (m.payment_method IS NULL OR m.payment_method = 'pending')
    AND EXISTS (
      SELECT 1
      FROM orders o
      WHERE o.id::text = SUBSTRING(m.description FROM 'Pedido (?:Local )?#([0-9a-f-]{36})')
        AND o.table_id = v_table_id
    );

  -- 3. Verificar se ainda há contas não pagas nesta mesa
  IF NOT EXISTS (
    SELECT 1 FROM bills 
    WHERE table_id = v_table_id 
    AND status != 'paid'
  ) THEN
    -- 4. Liberar a mesa automaticamente
    UPDATE tables
    SET 
      is_occupied = false,
      occupied_at = NULL,
      occupied_by = NULL
    WHERE id = v_table_id;
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;