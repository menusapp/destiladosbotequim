-- Criar trigger para adicionar pedidos aceitos automaticamente ao caixa
CREATE OR REPLACE FUNCTION add_order_to_cash_register()
RETURNS TRIGGER AS $$
DECLARE
  v_restaurant_id uuid;
  v_cash_session_id uuid;
  v_bill_total numeric;
  v_payment_method text;
BEGIN
  -- Apenas processar quando o status mudar para 'accepted'
  IF NEW.status = 'accepted' AND OLD.status != 'accepted' THEN
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
      
      -- Inserir movimentação no caixa (assumindo que o pagamento será feito em dinheiro por padrão)
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
        'income',
        v_bill_total,
        'pending', -- Será atualizado quando a conta for paga
        'Pedido',
        'Pedido #' || NEW.id || ' - ' || NEW.customer_name,
        'Sistema'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_add_order_to_cash ON orders;
CREATE TRIGGER trigger_add_order_to_cash
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION add_order_to_cash_register();

-- Criar trigger para atualizar o método de pagamento quando a conta for paga
CREATE OR REPLACE FUNCTION update_cash_movement_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Quando uma conta for paga, atualizar a movimentação correspondente
  IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
    UPDATE cash_movements
    SET payment_method = NEW.payment_method
    WHERE bill_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para bills
DROP TRIGGER IF EXISTS trigger_update_cash_payment ON bills;
CREATE TRIGGER trigger_update_cash_payment
  AFTER UPDATE ON bills
  FOR EACH ROW
  EXECUTE FUNCTION update_cash_movement_payment();

-- Adicionar coluna bill_id à tabela cash_movements se ainda não existir (para rastreamento)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cash_movements' AND column_name = 'bill_id'
  ) THEN
    ALTER TABLE cash_movements ADD COLUMN bill_id uuid REFERENCES bills(id);
  END IF;
END $$;