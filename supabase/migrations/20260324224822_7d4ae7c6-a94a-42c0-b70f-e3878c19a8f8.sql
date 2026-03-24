
CREATE TABLE public.order_item_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  split_number integer NOT NULL,
  total_splits integer NOT NULL,
  value numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  payment_type text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.order_item_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on order_item_splits"
  ON public.order_item_splits
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
