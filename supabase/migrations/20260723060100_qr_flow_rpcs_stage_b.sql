-- =====================================================================
-- SECURITY HARDENING — RPCs do fluxo de MESA/COMANDA (autoatendimento QR)
-- ---------------------------------------------------------------------
-- Cobrem as leituras diretas que ainda faltavam converter nas telas de
-- comanda (Menu.tsx / Comanda.tsx). Todas SECURITY DEFINER, reescopadas ao
-- estabelecimento (default_restaurant_id), retornando apenas o necessário.
-- =====================================================================
SET search_path = public;

-- Pedidos de uma comanda/mesa (estrutura aninhada usada pela tela de comanda).
-- Se p_comanda_id vier, filtra por ela; senão, por mesa+CPF apenas os pedidos
-- ainda abertos e criados após a última conta paga (evita histórico fechado).
CREATE OR REPLACE FUNCTION public.get_comanda_orders(
  p_table_id uuid,
  p_comanda_id uuid DEFAULT NULL,
  p_customer_cpf text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  WITH last_paid AS (
    SELECT max(b.paid_at) AS paid_at
    FROM public.bills b
    WHERE b.status = 'paid'
      AND (
        (p_comanda_id IS NOT NULL AND b.comanda_id = p_comanda_id)
        OR (p_comanda_id IS NULL AND b.table_id = p_table_id)
      )
  ),
  sel AS (
    SELECT o.*
    FROM public.orders o
    WHERE o.restaurant_id = public.default_restaurant_id()
      AND (
        (p_comanda_id IS NOT NULL AND o.comanda_id = p_comanda_id)
        OR (
          p_comanda_id IS NULL
          AND o.table_id = p_table_id
          AND o.customer_cpf = p_customer_cpf
          AND o.status IN ('pending','accepted','preparing','ready')
          AND (
            (SELECT paid_at FROM last_paid) IS NULL
            OR o.created_at > (SELECT paid_at FROM last_paid)
          )
        )
      )
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', o.id,
      'status', o.status,
      'created_at', o.created_at,
      'customer_name', o.customer_name,
      'notes', o.notes,
      'order_items', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', oi.id,
            'quantity', oi.quantity,
            'price_at_order', oi.price_at_order,
            'notes', oi.notes,
            'products', (
              SELECT jsonb_build_object('name', p.name, 'prep_time_minutes', p.prep_time_minutes)
              FROM public.products p WHERE p.id = oi.product_id
            ),
            'order_item_extras', COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'price_at_order', oie.price_at_order,
                'extra_name', oie.extra_name,
                'product_extras', (
                  SELECT jsonb_build_object('name', pe.name)
                  FROM public.product_extras pe WHERE pe.id = oie.product_extra_id
                )
              ))
              FROM public.order_item_extras oie WHERE oie.order_item_id = oi.id
            ), '[]'::jsonb)
          )
        )
        FROM public.order_items oi WHERE oi.order_id = o.id
      ), '[]'::jsonb)
    ) ORDER BY o.created_at DESC
  ), '[]'::jsonb)
  FROM sel o
$$;

-- Conta ativa (solicitada/a caminho) de uma comanda ou mesa. Só id/status.
CREATE OR REPLACE FUNCTION public.get_active_bill(
  p_table_id uuid,
  p_comanda_id uuid DEFAULT NULL
)
RETURNS TABLE(id uuid, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT b.id, b.status
  FROM public.bills b
  WHERE b.status IN ('requested','on_the_way')
    AND (
      (p_comanda_id IS NOT NULL AND b.comanda_id = p_comanda_id)
      OR (p_comanda_id IS NULL AND b.table_id = p_table_id)
    )
  ORDER BY b.created_at DESC
  LIMIT 1
$$;

-- A mesa tem alguma atividade em aberto? (conta não paga, comanda ativa ou
-- pedido em andamento). Usado para decidir se a mesa pode ser liberada.
CREATE OR REPLACE FUNCTION public.table_has_activity(p_table_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.bills b
      WHERE b.table_id = p_table_id AND b.status IN ('requested','on_the_way','pending')
    )
    OR EXISTS (
      SELECT 1 FROM public.comandas c
      WHERE c.table_id = p_table_id AND c.status = 'active'
        AND c.restaurant_id = public.default_restaurant_id()
    )
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.table_id = p_table_id AND o.status IN ('pending','accepted','preparing','ready')
        AND o.restaurant_id = public.default_restaurant_id()
    )
$$;

-- Grants
DO $$
DECLARE
  r record;
  fns text[] := ARRAY['get_comanda_orders','get_active_bill','table_has_activity'];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.proname = ANY(fns)
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', r.sig);
  END LOOP;
END $$;
