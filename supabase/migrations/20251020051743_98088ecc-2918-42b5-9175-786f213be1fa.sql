-- Recreate public policies for bills
DROP POLICY IF EXISTS "Public can create bills for open restaurants" ON public.bills;
DROP POLICY IF EXISTS "Public can view bills for open restaurants" ON public.bills;

CREATE POLICY "Public can create bills for open restaurants"
ON public.bills
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tables t
    JOIN public.restaurants r ON r.id = t.restaurant_id
    WHERE t.id = bills.table_id AND r.is_open = true
  )
);

CREATE POLICY "Public can view bills for open restaurants"
ON public.bills
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tables t
    JOIN public.restaurants r ON r.id = t.restaurant_id
    WHERE t.id = bills.table_id AND r.is_open = true
  )
);