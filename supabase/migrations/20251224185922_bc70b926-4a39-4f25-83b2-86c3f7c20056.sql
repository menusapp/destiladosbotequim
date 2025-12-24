-- Trigger para garantir que delivery_phone sempre use o telefone do cadastro customers
-- Isso é a "blindagem" do backend para WhatsApp ir sempre para o número certo

CREATE OR REPLACE FUNCTION public.ensure_order_phone_from_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_customer_phone TEXT;
BEGIN
  -- Buscar telefone do cadastro do cliente (se existir)
  SELECT phone INTO v_customer_phone
  FROM customers
  WHERE cpf = NEW.customer_cpf
    AND restaurant_id = NEW.restaurant_id
    AND phone IS NOT NULL
    AND phone != ''
  LIMIT 1;
  
  -- Se encontrou telefone no cadastro, usar esse (prioridade máxima)
  IF v_customer_phone IS NOT NULL THEN
    NEW.delivery_phone := v_customer_phone;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger que dispara ANTES de INSERT em orders
DROP TRIGGER IF EXISTS trigger_ensure_order_phone ON orders;
CREATE TRIGGER trigger_ensure_order_phone
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION ensure_order_phone_from_customer();