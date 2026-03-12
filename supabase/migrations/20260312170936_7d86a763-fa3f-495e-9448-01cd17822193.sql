
CREATE TABLE public.reservation_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL,
  is_open boolean DEFAULT true,
  open_time text DEFAULT '11:00',
  close_time text DEFAULT '22:00',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(restaurant_id, day_of_week)
);

ALTER TABLE public.reservation_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on reservation_hours"
  ON public.reservation_hours
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
