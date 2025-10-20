-- Função segura para marcar conta como "a caminho"
CREATE OR REPLACE FUNCTION public.admin_mark_bill_on_the_way(p_bill_id uuid, p_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verifica se a conta pertence ao restaurante
  IF NOT EXISTS (
    SELECT 1 FROM bills b
    JOIN tables t ON t.id = b.table_id
    WHERE b.id = p_bill_id AND t.restaurant_id = p_restaurant_id
  ) THEN
    RAISE EXCEPTION 'Not authorized to update this bill';
  END IF;

  UPDATE bills SET status = 'on_the_way' WHERE id = p_bill_id;
END;
$$;

-- Função segura para marcar conta como paga e limpar mesa
CREATE OR REPLACE FUNCTION public.admin_mark_bill_paid(p_bill_id uuid, p_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table_id uuid;
BEGIN
  -- Verifica e pega table_id
  SELECT b.table_id INTO v_table_id
  FROM bills b
  JOIN tables t ON t.id = b.table_id
  WHERE b.id = p_bill_id AND t.restaurant_id = p_restaurant_id;

  IF v_table_id IS NULL THEN
    RAISE EXCEPTION 'Not authorized to update this bill';
  END IF;

  -- Marca conta como paga
  UPDATE bills 
  SET status = 'paid', paid_at = now() 
  WHERE id = p_bill_id;

  -- Deleta todos os pedidos da mesa
  DELETE FROM orders WHERE table_id = v_table_id;

  -- Deleta a conta
  DELETE FROM bills WHERE id = p_bill_id;
END;
$$;