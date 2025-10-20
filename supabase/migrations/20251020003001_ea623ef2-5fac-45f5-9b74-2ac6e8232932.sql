-- Function to validate restaurant credentials bypassing RLS securely
CREATE OR REPLACE FUNCTION public.validate_restaurant_credentials(
  p_username text,
  p_password text
)
RETURNS TABLE(restaurant_id uuid, restaurant_name text) AS $$
BEGIN
  RETURN QUERY
  SELECT rc.restaurant_id, r.name
  FROM public.restaurant_credentials rc
  JOIN public.restaurants r ON r.id = rc.restaurant_id
  WHERE rc.username = p_username
    AND rc.password_hash = p_password
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Allow web clients to execute this function
GRANT EXECUTE ON FUNCTION public.validate_restaurant_credentials(text, text) TO anon, authenticated;