-- Criar tabela de pedidos de balcão
CREATE TABLE public.counter_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id),
  table_id UUID NOT NULL REFERENCES public.tables(id),
  customer_name TEXT NOT NULL,
  customer_cpf TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  payment_method TEXT,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  fee_type TEXT CHECK (fee_type IN ('fixed', 'percentage')),
  fee_value NUMERIC DEFAULT 0,
  fee_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  finalized_at TIMESTAMP WITH TIME ZONE,
  created_by TEXT NOT NULL,
  notes TEXT
);

-- Criar tabela de itens de pedidos de balcão
CREATE TABLE public.counter_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  counter_order_id UUID NOT NULL REFERENCES public.counter_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  price_at_order NUMERIC NOT NULL,
  cost_snapshot NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de extras dos itens de pedidos de balcão
CREATE TABLE public.counter_order_item_extras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  counter_order_item_id UUID NOT NULL REFERENCES public.counter_order_items(id) ON DELETE CASCADE,
  product_extra_id UUID REFERENCES public.product_extras(id),
  price_at_order NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.counter_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counter_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counter_order_item_extras ENABLE ROW LEVEL SECURITY;

-- Policies para counter_orders
CREATE POLICY "Qualquer um pode ver pedidos de balcão"
  ON public.counter_orders FOR SELECT
  USING (true);

CREATE POLICY "Qualquer um pode criar pedidos de balcão"
  ON public.counter_orders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Qualquer um pode atualizar pedidos de balcão"
  ON public.counter_orders FOR UPDATE
  USING (true);

CREATE POLICY "Qualquer um pode deletar pedidos de balcão"
  ON public.counter_orders FOR DELETE
  USING (true);

-- Policies para counter_order_items
CREATE POLICY "Itens de pedidos de balcão são públicos"
  ON public.counter_order_items FOR SELECT
  USING (true);

CREATE POLICY "Qualquer um pode criar itens de pedidos de balcão"
  ON public.counter_order_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Qualquer um pode atualizar itens de pedidos de balcão"
  ON public.counter_order_items FOR UPDATE
  USING (true);

CREATE POLICY "Qualquer um pode deletar itens de pedidos de balcão"
  ON public.counter_order_items FOR DELETE
  USING (true);

-- Policies para counter_order_item_extras
CREATE POLICY "Extras de itens de balcão são públicos"
  ON public.counter_order_item_extras FOR SELECT
  USING (true);

CREATE POLICY "Qualquer um pode criar extras de itens de balcão"
  ON public.counter_order_item_extras FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Qualquer um pode deletar extras de itens de balcão"
  ON public.counter_order_item_extras FOR DELETE
  USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_counter_orders_updated_at
  BEFORE UPDATE ON public.counter_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função para processar finalização de pedido de balcão
CREATE OR REPLACE FUNCTION public.process_counter_order_finalization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_item RECORD;
  v_ingredient RECORD;
  v_extra_ingredient RECORD;
  v_cost_total NUMERIC := 0;
BEGIN
  -- Se o pedido foi finalizado (status mudou para 'paid' e finalized_at foi setado)
  IF NEW.status = 'paid' AND NEW.finalized_at IS NOT NULL 
     AND (OLD.finalized_at IS NULL OR OLD.status != 'paid') THEN
    
    -- Processar cada item do pedido
    FOR v_order_item IN 
      SELECT coi.id, coi.quantity, coi.product_id
      FROM counter_order_items coi
      WHERE coi.counter_order_id = NEW.id
    LOOP
      -- Calcular e armazenar custo snapshot do item
      SELECT COALESCE(SUM(pi.quantity * si.price_per_unit), 0) INTO v_cost_total
      FROM product_ingredients pi
      JOIN stock_items si ON si.id = pi.stock_item_id
      WHERE pi.product_id = v_order_item.product_id;
      
      UPDATE counter_order_items
      SET cost_snapshot = v_cost_total * v_order_item.quantity
      WHERE id = v_order_item.id;
      
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
          reason
        ) VALUES (
          v_ingredient.stock_item_id,
          v_ingredient.quantity * v_order_item.quantity,
          'saida',
          'Venda Balcão - Pedido #' || NEW.id
        );
      END LOOP;
      
      -- Dar baixa nos ingredientes dos adicionais
      FOR v_extra_ingredient IN
        SELECT pei.stock_item_id, pei.quantity
        FROM counter_order_item_extras coie
        JOIN product_extras pe ON pe.id = coie.product_extra_id
        JOIN product_extra_ingredients pei ON pei.product_extra_id = pe.id
        WHERE coie.counter_order_item_id = v_order_item.id
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
          reason
        ) VALUES (
          v_extra_ingredient.stock_item_id,
          v_extra_ingredient.quantity * v_order_item.quantity,
          'saida',
          'Venda Balcão (adicional) - Pedido #' || NEW.id
        );
      END LOOP;
    END LOOP;
    
    -- Registrar no caixa se houver sessão aberta
    DECLARE
      v_cash_session_id UUID;
    BEGIN
      SELECT id INTO v_cash_session_id
      FROM cash_register_sessions
      WHERE restaurant_id = NEW.restaurant_id
        AND status = 'open'
      ORDER BY opened_at DESC
      LIMIT 1;
      
      IF v_cash_session_id IS NOT NULL THEN
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
          NEW.restaurant_id,
          'entrada',
          NEW.total_amount,
          COALESCE(NEW.payment_method, 'cash'),
          'Balcão',
          'Pedido Balcão #' || NEW.id || ' - ' || NEW.customer_name,
          NEW.created_by
        );
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para processar finalização
CREATE TRIGGER trigger_process_counter_order_finalization
  AFTER UPDATE ON public.counter_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.process_counter_order_finalization();

-- Função para reverter pedido de balcão excluído
CREATE OR REPLACE FUNCTION public.revert_counter_order_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_movement RECORD;
BEGIN
  -- Se o pedido estava finalizado, reverter estoque
  IF OLD.status = 'paid' AND OLD.finalized_at IS NOT NULL THEN
    FOR v_movement IN
      SELECT stock_item_id, quantity
      FROM stock_movements
      WHERE reason LIKE 'Venda Balcão%Pedido #' || OLD.id || '%'
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
        reason
      ) VALUES (
        v_movement.stock_item_id,
        v_movement.quantity,
        'entrada',
        'Estorno Balcão - Pedido #' || OLD.id
      );
    END LOOP;
    
    -- Remover movimento de caixa
    DELETE FROM cash_movements
    WHERE description LIKE 'Pedido Balcão #' || OLD.id || '%';
  END IF;
  
  RETURN OLD;
END;
$$;

-- Trigger para reverter exclusão
CREATE TRIGGER trigger_revert_counter_order_deletion
  BEFORE DELETE ON public.counter_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.revert_counter_order_deletion();