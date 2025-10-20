-- Adicionar campo is_occupied na tabela tables
ALTER TABLE public.tables 
ADD COLUMN IF NOT EXISTS is_occupied boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS occupied_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS occupied_by text;

-- Função para marcar mesa como ocupada quando pedido é criado
CREATE OR REPLACE FUNCTION public.mark_table_occupied()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Marca mesa como ocupada quando primeiro pedido é criado
  UPDATE tables
  SET 
    is_occupied = true,
    occupied_at = NEW.created_at,
    occupied_by = NEW.customer_name
  WHERE id = NEW.table_id
    AND is_occupied = false;
  
  RETURN NEW;
END;
$$;

-- Trigger para marcar mesa como ocupada ao criar pedido
DROP TRIGGER IF EXISTS trigger_mark_table_occupied ON orders;
CREATE TRIGGER trigger_mark_table_occupied
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION mark_table_occupied();

-- Função para verificar se mesa pode ser liberada
CREATE OR REPLACE FUNCTION public.check_table_release()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_table_id uuid;
  v_pending_bills integer;
  v_unpaid_bills integer;
BEGIN
  -- Pega o table_id da conta que foi atualizada
  v_table_id := NEW.table_id;
  
  -- Verifica se todas as contas da mesa foram pagas
  SELECT COUNT(*) INTO v_unpaid_bills
  FROM bills
  WHERE table_id = v_table_id
    AND status != 'paid';
  
  -- Se não há contas não pagas, libera a mesa
  IF v_unpaid_bills = 0 THEN
    UPDATE tables
    SET 
      is_occupied = false,
      occupied_at = NULL,
      occupied_by = NULL
    WHERE id = v_table_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para verificar liberação de mesa quando conta é paga
DROP TRIGGER IF EXISTS trigger_check_table_release ON bills;
CREATE TRIGGER trigger_check_table_release
  AFTER UPDATE ON bills
  FOR EACH ROW
  WHEN (NEW.status = 'paid' AND OLD.status != 'paid')
  EXECUTE FUNCTION check_table_release();

-- Função para verificar liberação quando conta é excluída
CREATE OR REPLACE FUNCTION public.check_table_release_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_table_id uuid;
  v_unpaid_bills integer;
BEGIN
  v_table_id := OLD.table_id;
  
  -- Verifica se ainda há contas não pagas
  SELECT COUNT(*) INTO v_unpaid_bills
  FROM bills
  WHERE table_id = v_table_id
    AND status != 'paid';
  
  -- Se não há contas não pagas, libera a mesa
  IF v_unpaid_bills = 0 THEN
    UPDATE tables
    SET 
      is_occupied = false,
      occupied_at = NULL,
      occupied_by = NULL
    WHERE id = v_table_id;
  END IF;
  
  RETURN OLD;
END;
$$;

-- Trigger para verificar liberação quando conta é excluída
DROP TRIGGER IF EXISTS trigger_check_table_release_on_delete ON bills;
CREATE TRIGGER trigger_check_table_release_on_delete
  AFTER DELETE ON bills
  FOR EACH ROW
  EXECUTE FUNCTION check_table_release_on_delete();