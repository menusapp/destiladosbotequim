
CREATE TABLE public.printer_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  paper_size text NOT NULL DEFAULT '80mm',
  auto_print_orders boolean NOT NULL DEFAULT false,
  auto_print_receipts boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(restaurant_id)
);

ALTER TABLE public.printer_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on printer_settings"
  ON public.printer_settings
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
