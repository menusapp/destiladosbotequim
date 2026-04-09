CREATE TABLE public.employee_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
  employee_name text NOT NULL,
  employee_id text,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  due_date date,
  paid_at timestamptz,
  paid_amount numeric(10,2),
  paid_method text,
  created_at timestamptz DEFAULT now(),
  created_by text
);

CREATE INDEX idx_employee_credits_restaurant ON public.employee_credits(restaurant_id);
CREATE INDEX idx_employee_credits_status ON public.employee_credits(restaurant_id, status);

ALTER TABLE public.employee_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on employee_credits"
  ON public.employee_credits
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);