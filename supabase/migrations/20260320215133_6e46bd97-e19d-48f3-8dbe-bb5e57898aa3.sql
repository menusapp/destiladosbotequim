CREATE TABLE public.ifood_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  enabled boolean DEFAULT false,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  merchant_id text,
  authorization_code_verifier text,
  last_polling_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(restaurant_id)
);

ALTER TABLE public.ifood_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on ifood_config"
  ON public.ifood_config FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS ifood_order_id text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS ifood_source boolean DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS orders_ifood_order_id_unique
  ON public.orders (ifood_order_id) WHERE ifood_order_id IS NOT NULL;