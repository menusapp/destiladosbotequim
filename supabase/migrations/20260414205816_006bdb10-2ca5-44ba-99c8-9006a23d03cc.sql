DROP FUNCTION IF EXISTS public.admin_get_whatsapp_status(uuid);

CREATE OR REPLACE FUNCTION public.admin_get_whatsapp_status(p_restaurant_id uuid)
RETURNS TABLE(instance_status text, enabled boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT instance_status, enabled
  FROM whatsapp_config
  WHERE restaurant_id = p_restaurant_id
  LIMIT 1;
$$;