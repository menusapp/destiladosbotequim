
-- Table: customer_sessions
CREATE TABLE public.customer_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  session_token text NOT NULL,
  phone text,
  name text,
  last_activity timestamptz DEFAULT now(),
  cart_items jsonb DEFAULT '[]'::jsonb,
  cart_value numeric DEFAULT 0,
  status text DEFAULT 'browsing',
  abandoned_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.customer_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on customer_sessions"
  ON public.customer_sessions FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_customer_sessions_restaurant ON public.customer_sessions(restaurant_id);
CREATE INDEX idx_customer_sessions_status ON public.customer_sessions(status);
CREATE INDEX idx_customer_sessions_last_activity ON public.customer_sessions(last_activity);

-- Table: remarketing_lists
CREATE TABLE public.remarketing_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text,
  filters jsonb,
  customer_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.remarketing_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on remarketing_lists"
  ON public.remarketing_lists FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
