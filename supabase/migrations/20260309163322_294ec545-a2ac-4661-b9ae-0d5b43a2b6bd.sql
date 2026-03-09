
-- Create restaurant_staff table
CREATE TABLE public.restaurant_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  username text NOT NULL,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  role text NOT NULL DEFAULT 'garcom',
  allowed_sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, username)
);

-- Enable RLS
ALTER TABLE public.restaurant_staff ENABLE ROW LEVEL SECURITY;

-- RLS policy - same pattern as project
CREATE POLICY "Allow all operations on restaurant_staff"
  ON public.restaurant_staff
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Updated_at trigger
CREATE TRIGGER update_restaurant_staff_updated_at
  BEFORE UPDATE ON public.restaurant_staff
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RPC to validate staff credentials
CREATE OR REPLACE FUNCTION public.validate_staff_credentials(
  p_restaurant_id uuid,
  p_username text,
  p_password text
)
RETURNS TABLE(staff_id uuid, display_name text, role text, allowed_sections jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT rs.id, rs.display_name, rs.role, rs.allowed_sections
  FROM public.restaurant_staff rs
  WHERE rs.restaurant_id = p_restaurant_id
    AND rs.username = p_username
    AND rs.password_hash = p_password
    AND rs.is_active = true
  LIMIT 1;
END;
$$;
