-- Atualizar função mark_bill_on_the_way para NÃO remover taxa quando o botão é clicado
-- A taxa só deve ser removida automaticamente pelo trigger após 5 minutos
CREATE OR REPLACE FUNCTION public.mark_bill_on_the_way(_bill_id uuid)
RETURNS public.bills
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b public.bills;
BEGIN
  SELECT * INTO b FROM public.bills WHERE id = _bill_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'bill not found';
  END IF;

  -- Apenas atualizar o status para 'on_the_way'
  -- NÃO remover a taxa aqui, ela será removida automaticamente pelo trigger se necessário
  UPDATE public.bills
  SET status = 'on_the_way'
  WHERE id = _bill_id
  RETURNING * INTO b;

  RETURN b;
END;
$$;