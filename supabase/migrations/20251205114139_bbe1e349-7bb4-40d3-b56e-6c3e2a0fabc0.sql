-- Remover constraint antiga se existir
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Criar nova constraint com out_for_delivery incluído
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
  CHECK (status = ANY (ARRAY['pending', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'picked_up', 'cancelled']));

-- Criar função para reverter estoque quando pedido é cancelado
CREATE OR REPLACE FUNCTION public.revert_stock_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_movement RECORD;
BEGIN
  -- Se o status mudou para cancelled e antes estava em um status que já deu baixa no estoque
  IF NEW.status = 'cancelled' 
     AND OLD.status IN ('accepted', 'preparing', 'ready', 'out_for_delivery') THEN
    
    -- Buscar todas as movimentações de saída deste pedido
    FOR v_movement IN
      SELECT stock_item_id, quantity
      FROM stock_movements
      WHERE order_id = OLD.id 
        AND movement_type = 'saida'
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
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Criar trigger para reverter estoque em cancelamento
DROP TRIGGER IF EXISTS trigger_revert_stock_on_cancel ON orders;
CREATE TRIGGER trigger_revert_stock_on_cancel
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION revert_stock_on_cancel();