-- Create helper function
create or replace function public.is_restaurant_closed_by_order_item(_order_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(not r.is_open, false)
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  join public.tables t on t.id = o.table_id
  join public.restaurants r on r.id = t.restaurant_id
  where oi.id = _order_item_id
  limit 1;
$$;

-- Policies for conditional deletes when restaurant is closed
DROP POLICY IF EXISTS "Delete order_items when restaurant is closed" ON public.order_items;
CREATE POLICY "Delete order_items when restaurant is closed"
ON public.order_items
FOR DELETE
USING (public.is_restaurant_closed_by_order_item(id));

DROP POLICY IF EXISTS "Delete order_item_extras when restaurant is closed" ON public.order_item_extras;
CREATE POLICY "Delete order_item_extras when restaurant is closed"
ON public.order_item_extras
FOR DELETE
USING (public.is_restaurant_closed_by_order_item(order_item_id));