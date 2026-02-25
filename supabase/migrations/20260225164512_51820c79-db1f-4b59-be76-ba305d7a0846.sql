CREATE TABLE public.customer_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone text NOT NULL,
  customer_cpf text NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  mp_customer_id text NOT NULL,
  card_id text NOT NULL,
  last_four_digits text NOT NULL,
  payment_method_id text NOT NULL,
  first_six_digits text,
  expiration_month integer,
  expiration_year integer,
  created_at timestamptz DEFAULT now(),
  UNIQUE(restaurant_id, customer_cpf, card_id)
);

ALTER TABLE public.customer_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on customer_cards"
  ON public.customer_cards FOR ALL
  USING (true) WITH CHECK (true);