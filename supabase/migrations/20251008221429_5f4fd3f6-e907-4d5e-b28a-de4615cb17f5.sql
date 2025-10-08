-- 1) Função server-side para marcar conta como 'A caminho' usando tempo do servidor
CREATE OR REPLACE FUNCTION public.mark_bill_on_the_way(_bill_id uuid)
RETURNS public.bills
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b public.bills;
  remove_fee boolean;
  new_total numeric;
BEGIN
  SELECT * INTO b FROM public.bills WHERE id = _bill_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'bill not found';
  END IF;

  -- Remove taxa de serviço somente se passados 5 minutos desde o pedido da conta
  remove_fee := (now() - COALESCE(b.bill_requested_at, now())) >= interval '5 minutes';
  new_total := CASE WHEN remove_fee THEN b.subtotal ELSE b.subtotal + b.service_fee END;

  UPDATE public.bills
  SET status = 'on_the_way',
      service_fee_removed = remove_fee,
      total_amount = new_total
  WHERE id = _bill_id
  RETURNING * INTO b;

  RETURN b;
END;
$$;

-- 2) Permitir deletar pedidos (necessário para limpar comanda após pagamento)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orders' AND policyname = 'Qualquer um pode deletar pedidos'
  ) THEN
    CREATE POLICY "Qualquer um pode deletar pedidos" ON public.orders
    FOR DELETE
    USING (true);
  END IF;
END $$;