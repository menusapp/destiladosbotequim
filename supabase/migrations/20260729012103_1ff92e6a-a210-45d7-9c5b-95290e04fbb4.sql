SET search_path = public;

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

DROP POLICY IF EXISTS "anon_insert" ON public.order_items;
CREATE POLICY "anon_insert" ON public.order_items
  FOR INSERT TO public
  WITH CHECK (public.order_in_default_restaurant(order_id));

DROP POLICY IF EXISTS "anon_insert" ON public.order_item_extras;
CREATE POLICY "anon_insert" ON public.order_item_extras
  FOR INSERT TO public
  WITH CHECK (public.order_item_in_default_restaurant(order_item_id));