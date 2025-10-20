-- Function to update restaurant settings bypassing RLS (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.admin_update_restaurant_settings(
  p_restaurant_id uuid,
  p_primary_color text,
  p_service_fee_enabled boolean,
  p_service_fee_percentage numeric,
  p_prep_time_minutes integer,
  p_target_cmv_percentage numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.restaurants
  SET
    primary_color = COALESCE(p_primary_color, primary_color),
    service_fee_enabled = COALESCE(p_service_fee_enabled, service_fee_enabled),
    service_fee_percentage = COALESCE(p_service_fee_percentage, service_fee_percentage),
    prep_time_minutes = COALESCE(p_prep_time_minutes, prep_time_minutes),
    target_cmv_percentage = COALESCE(p_target_cmv_percentage, target_cmv_percentage),
    updated_at = now()
  WHERE id = p_restaurant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_restaurant_settings(uuid, text, boolean, numeric, integer, numeric) TO PUBLIC;