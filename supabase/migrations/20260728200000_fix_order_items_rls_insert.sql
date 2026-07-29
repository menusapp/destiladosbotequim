-- =====================================================================
-- FIX URGENTE: cliente não conseguia finalizar pedido — itens recusados
-- ("new row violates row-level security policy" em order_items)
-- ---------------------------------------------------------------------
-- Causa: as policies de INSERT anônimo de order_items/order_item_extras
-- validavam o pai com um EXISTS direto em orders/order_items:
--     WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE ...))
-- Sub-consultas de policy rodam SOB O RLS DO CHAMADOR. Enquanto existia a
-- policy temporária de leitura anônima (zz_temp_anon_read) em orders, o
-- EXISTS enxergava o pedido recém-criado e passava. Quando o Estágio B
-- removeu essas leituras, o EXISTS passou a não ver nada → WITH CHECK
-- falha → pedido é criado SEM NENHUM ITEM (só a taxa de entrega).
--
-- Correção: a validação do pai passa para funções SECURITY DEFINER
-- (enxergam o pedido sem depender de leitura anônima), mantendo o mesmo
-- escopo de segurança: só aceita item de pedido do estabelecimento.
-- =====================================================================
SET search_path = public;

-- O pedido pertence ao estabelecimento?
CREATE OR REPLACE FUNCTION public.order_in_default_restaurant(p_order_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = p_order_id
      AND o.restaurant_id = public.default_restaurant_id()
  )
$$;

-- O item pertence a um pedido do estabelecimento?
CREATE OR REPLACE FUNCTION public.order_item_in_default_restaurant(p_order_item_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.id = p_order_item_id
      AND o.restaurant_id = public.default_restaurant_id()
  )
$$;

GRANT EXECUTE ON FUNCTION public.order_in_default_restaurant(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.order_item_in_default_restaurant(uuid) TO anon, authenticated;

-- Recria as policies de INSERT anônimo usando as funções definer.
DROP POLICY IF EXISTS "anon_insert" ON public.order_items;
CREATE POLICY "anon_insert" ON public.order_items
  FOR INSERT TO public
  WITH CHECK (public.order_in_default_restaurant(order_id));

DROP POLICY IF EXISTS "anon_insert" ON public.order_item_extras;
CREATE POLICY "anon_insert" ON public.order_item_extras
  FOR INSERT TO public
  WITH CHECK (public.order_item_in_default_restaurant(order_item_id));
