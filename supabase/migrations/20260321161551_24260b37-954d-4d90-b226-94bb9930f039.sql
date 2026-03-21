
-- Table: deliverydireto_config
CREATE TABLE public.deliverydireto_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  enabled boolean DEFAULT false,
  store_id text,
  client_id text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  username text,
  password_hash text,
  webhook_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(restaurant_id)
);

ALTER TABLE public.deliverydireto_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on deliverydireto_config"
  ON public.deliverydireto_config FOR ALL
  TO anon, authenticated
  USING (true) WITH CHECK (true);

-- Add DD fields to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS dd_order_id text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS dd_source boolean DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS orders_dd_order_id_unique
  ON public.orders (dd_order_id) WHERE dd_order_id IS NOT NULL;
