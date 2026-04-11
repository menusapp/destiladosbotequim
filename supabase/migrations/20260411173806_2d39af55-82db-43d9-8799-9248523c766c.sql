CREATE OR REPLACE FUNCTION public.admin_get_pix_pos_config(p_restaurant_id uuid)
RETURNS TABLE(mp_pos_id text, mp_pos_name text, mp_user_id text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT mp_pos_id, mp_pos_name, mp_user_id
  FROM online_payment_config
  WHERE restaurant_id = p_restaurant_id;
$$;