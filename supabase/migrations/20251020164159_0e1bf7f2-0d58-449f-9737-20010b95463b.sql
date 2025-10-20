-- Preservar histórico: não apagar pedidos nem contas pagas e vincular pagamentos aos movimentos do caixa
CREATE OR REPLACE FUNCTION public.admin_mark_bill_paid(p_bill_id uuid, p_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_table_id uuid;
  v_payment_method text;
BEGIN
  -- Verifica e pega table_id e método de pagamento da conta
  SELECT b.table_id, b.payment_method INTO v_table_id, v_payment_method
  FROM bills b
  JOIN tables t ON t.id = b.table_id
  WHERE b.id = p_bill_id AND t.restaurant_id = p_restaurant_id;

  IF v_table_id IS NULL THEN
    RAISE EXCEPTION 'Not authorized to update this bill';
  END IF;

  -- Marca conta como paga (mantém o registro)
  UPDATE bills 
  SET status = 'paid', paid_at = now()
  WHERE id = p_bill_id;

  -- Vincula e atualiza método de pagamento nos movimentos de pedidos relacionados a esta mesa
  -- Extrai o order_id do texto "Pedido #<uuid>" e confere se pertence à mesa desta conta
  UPDATE cash_movements m
  SET payment_method = COALESCE(v_payment_method, 'cash'),
      bill_id = p_bill_id
  WHERE m.restaurant_id = p_restaurant_id
    AND m.category = 'Pedido'
    AND (m.payment_method IS NULL OR m.payment_method = 'pending')
    AND EXISTS (
      SELECT 1
      FROM orders o
      WHERE o.id::text = substring(m.description from 'Pedido #([0-9a-f-]+)')
        AND o.table_id = v_table_id
    );

  -- NÃO apagar pedidos nem a conta: manter histórico para relatórios/DRE
END;
$function$;