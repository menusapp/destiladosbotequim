ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS ifood_display_id text,
  ADD COLUMN IF NOT EXISTS ifood_merchant_id text;

CREATE INDEX IF NOT EXISTS idx_orders_ifood_display_id ON public.orders (ifood_display_id) WHERE ifood_display_id IS NOT NULL;