
CREATE OR REPLACE FUNCTION public.admin_upsert_payment_config(
  p_restaurant_id uuid,
  p_field text,
  p_value text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow known safe fields
  IF p_field NOT IN ('enabled', 'accept_pix', 'accept_card', 'enable_for_delivery', 'mp_sandbox_payer_email', 'connection_status', 'provider') THEN
    RAISE EXCEPTION 'Campo não permitido: %', p_field;
  END IF;

  -- Boolean fields
  IF p_field IN ('enabled', 'accept_pix', 'accept_card', 'enable_for_delivery') THEN
    EXECUTE format('UPDATE public.online_payment_config SET %I = $1, updated_at = now() WHERE restaurant_id = $2', p_field)
    USING (p_value = 'true'), p_restaurant_id;
  ELSE
    -- Text fields
    EXECUTE format('UPDATE public.online_payment_config SET %I = $1, updated_at = now() WHERE restaurant_id = $2', p_field)
    USING p_value, p_restaurant_id;
  END IF;
END;
$$;
