
-- Bill paga por comanda (só o id, não PII)
CREATE OR REPLACE FUNCTION public.get_paid_bill_for_comanda(p_comanda_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT id FROM public.bills
  WHERE comanda_id = p_comanda_id AND status = 'paid'
  ORDER BY created_at DESC LIMIT 1
$$;

-- Contagem de comandas ativas na mesa
CREATE OR REPLACE FUNCTION public.count_active_comandas_for_table(p_table_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT COUNT(*)::int FROM public.comandas
  WHERE table_id = p_table_id AND status = 'active'
    AND restaurant_id = public.default_restaurant_id()
$$;

-- Status de uma comanda pelo id (sem PII)
CREATE OR REPLACE FUNCTION public.get_comanda_status_by_id(p_comanda_id uuid)
RETURNS TABLE(id uuid, status text, table_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT c.id, c.status, c.table_id
  FROM public.comandas c
  WHERE c.id = p_comanda_id
    AND c.restaurant_id = public.default_restaurant_id()
  LIMIT 1
$$;

-- Existência de uma bill (só o id)
CREATE OR REPLACE FUNCTION public.check_bill_exists(p_bill_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT id FROM public.bills WHERE id = p_bill_id LIMIT 1
$$;

-- Pedidos abertos numa mesa (agrupados por comanda ou cpf/nome) com total agregado.
-- Retorna o valor total dos pedidos em preparo para o cliente atual, incluindo extras.
CREATE OR REPLACE FUNCTION public.get_table_pending_orders_total(
  p_table_id uuid,
  p_comanda_id uuid DEFAULT NULL,
  p_customer_cpf text DEFAULT NULL,
  p_customer_name text DEFAULT NULL
)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(SUM(
    oi.price_at_order * oi.quantity +
    COALESCE((SELECT SUM(oie.price_at_order) FROM public.order_item_extras oie
              WHERE oie.order_item_id = oi.id), 0) * oi.quantity
  ), 0)::numeric
  FROM public.orders o
  JOIN public.order_items oi ON oi.order_id = o.id
  WHERE o.restaurant_id = public.default_restaurant_id()
    AND o.table_id = p_table_id
    AND o.status IN ('pending','accepted','preparing','ready')
    AND (
      (p_comanda_id IS NOT NULL AND o.comanda_id = p_comanda_id)
      OR (p_comanda_id IS NULL
          AND o.customer_cpf = p_customer_cpf
          AND o.customer_name = p_customer_name)
    )
$$;

GRANT EXECUTE ON FUNCTION public.get_paid_bill_for_comanda(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_active_comandas_for_table(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_comanda_status_by_id(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_bill_exists(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_table_pending_orders_total(uuid, uuid, text, text) TO anon, authenticated;
