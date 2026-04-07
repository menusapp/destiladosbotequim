
-- Drop the problematic view
DROP VIEW IF EXISTS public.online_payment_config_public;

-- Create a safe RPC for public access (menu digital)
CREATE OR REPLACE FUNCTION public.get_public_payment_config(p_restaurant_id uuid)
RETURNS TABLE(
  id uuid, restaurant_id uuid, enabled boolean, accept_pix boolean,
  accept_card boolean, enable_for_delivery boolean, connection_status text,
  mp_public_key text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, restaurant_id, enabled, accept_pix, accept_card,
         enable_for_delivery, connection_status, mp_public_key
  FROM public.online_payment_config
  WHERE restaurant_id = p_restaurant_id;
$$;
