-- Função para dar baixa no estoque dos ingredientes do produto E dos adicionais
CREATE OR REPLACE FUNCTION public.process_order_stock_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_item RECORD;
  v_ingredient RECORD;
  v_extra_ingredient RECORD;
  v_restaurant_id uuid;
BEGIN
  -- Se o pedido for aceito, dar baixa no estoque
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    -- Buscar restaurant_id do pedido
    SELECT t.restaurant_id INTO v_restaurant_id
    FROM tables t
    WHERE t.id = NEW.table_id;
    
    -- Processar cada item do pedido
    FOR v_order_item IN 
      SELECT oi.id, oi.quantity, oi.product_id
      FROM order_items oi
      WHERE oi.order_id = NEW.id
    LOOP
      -- Dar baixa nos ingredientes do produto
      FOR v_ingredient IN
        SELECT pi.stock_item_id, pi.quantity
        FROM product_ingredients pi
        WHERE pi.product_id = v_order_item.product_id
      LOOP
        -- Atualizar quantidade em estoque
        UPDATE stock_items
        SET current_quantity = current_quantity - (v_ingredient.quantity * v_order_item.quantity)
        WHERE id = v_ingredient.stock_item_id;
        
        -- Registrar movimentação
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
      
      -- Dar baixa nos ingredientes dos adicionais
      FOR v_extra_ingredient IN
        SELECT pei.stock_item_id, pei.quantity
        FROM order_item_extras oie
        JOIN product_extras pe ON pe.id = oie.product_extra_id
        JOIN product_extra_ingredients pei ON pei.product_extra_id = pe.id
        WHERE oie.order_item_id = v_order_item.id
      LOOP
        -- Atualizar quantidade em estoque
        UPDATE stock_items
        SET current_quantity = current_quantity - (v_extra_ingredient.quantity * v_order_item.quantity)
        WHERE id = v_extra_ingredient.stock_item_id;
        
        -- Registrar movimentação
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
$$;

-- Criar trigger para processar baixa de estoque
DROP TRIGGER IF EXISTS trigger_order_stock_movement ON orders;
CREATE TRIGGER trigger_order_stock_movement
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION process_order_stock_movement();

-- Função para repor estoque quando pedido for cancelado
CREATE OR REPLACE FUNCTION public.revert_order_stock_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_movement RECORD;
BEGIN
  -- Se um pedido for deletado, repor o estoque
  FOR v_movement IN
    SELECT stock_item_id, quantity
    FROM stock_movements
    WHERE order_id = OLD.id AND movement_type = 'saida'
  LOOP
    -- Repor quantidade em estoque
    UPDATE stock_items
    SET current_quantity = current_quantity + v_movement.quantity
    WHERE id = v_movement.stock_item_id;
    
    -- Registrar movimentação de reposição
    INSERT INTO stock_movements (
      stock_item_id,
      quantity,
      movement_type,
      order_id,
      reason
    ) VALUES (
      v_movement.stock_item_id,
      v_movement.quantity,
      'entrada',
      OLD.id,
      'Cancelamento - Pedido #' || OLD.id
    );
  END LOOP;
  
  RETURN OLD;
END;
$$;

-- Criar trigger para repor estoque quando pedido for deletado
DROP TRIGGER IF EXISTS trigger_revert_order_stock ON orders;
CREATE TRIGGER trigger_revert_order_stock
  BEFORE DELETE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION revert_order_stock_movement();