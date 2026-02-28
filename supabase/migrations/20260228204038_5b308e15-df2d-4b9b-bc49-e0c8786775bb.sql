
CREATE TABLE public.order_fiscal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  nfe_number text,
  xml_url text,
  pdf_url text,
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.order_fiscal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant can view own fiscal notes"
  ON public.order_fiscal_notes
  FOR SELECT
  USING (true);

CREATE POLICY "Restaurant can insert own fiscal notes"
  ON public.order_fiscal_notes
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Restaurant can update own fiscal notes"
  ON public.order_fiscal_notes
  FOR UPDATE
  USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.order_fiscal_notes;
