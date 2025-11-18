-- Melhorar função de liberação de mesas para verificar pedidos ativos
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
  
  -- Verificar se há contas não pagas
  SELECT COUNT(*) INTO v_unpaid_bills
  FROM bills
  WHERE table_id = v_table_id
    AND status != 'paid';
  
  -- Verificar se há pedidos ativos
  SELECT COUNT(*) INTO v_active_orders
  FROM orders
  WHERE table_id = v_table_id
    AND status IN ('pending', 'accepted', 'preparing', 'ready');
  
  -- Se não há contas não pagas E não há pedidos ativos, libera a mesa
  IF v_unpaid_bills = 0 AND v_active_orders = 0 THEN
    UPDATE tables
    SET 
      is_occupied = false,
      occupied_at = NULL,
      occupied_by = NULL
    WHERE id = v_table_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Criar função para limpar mesas órfãs (com contas pagas mas ainda ocupadas)
CREATE OR REPLACE FUNCTION public.cleanup_abandoned_tables()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Liberar mesas que:
  -- 1. Estão ocupadas
  -- 2. Não têm contas não pagas
  -- 3. Não têm pedidos ativos (pending, accepted, preparing, ready)
  UPDATE tables t
  SET 
    is_occupied = false,
    occupied_at = NULL,
    occupied_by = NULL
  WHERE 
    t.is_occupied = true
    AND NOT EXISTS (
      SELECT 1 FROM bills b 
      WHERE b.table_id = t.id 
      AND b.status != 'paid'
    )
    AND NOT EXISTS (
      SELECT 1 FROM orders o 
      WHERE o.table_id = t.id 
      AND o.status IN ('pending', 'accepted', 'preparing', 'ready')
    );
END;
$function$;

-- Criar função para liberar mesas ocupadas há mais de 1 hora sem nenhum pedido
CREATE OR REPLACE FUNCTION public.auto_release_inactive_tables()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Liberar mesas que:
  -- 1. Estão ocupadas
  -- 2. Foram ocupadas há mais de 1 hora
  -- 3. NÃO têm NENHUM pedido associado
  UPDATE tables t
  SET 
    is_occupied = false,
    occupied_at = NULL,
    occupied_by = NULL
  WHERE 
    t.is_occupied = true
    AND t.occupied_at < NOW() - INTERVAL '1 hour'
    AND NOT EXISTS (
      SELECT 1 FROM orders o 
      WHERE o.table_id = t.id
    );
END;
$function$;