DROP FUNCTION IF EXISTS public.admin_create_first_staff(uuid, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.admin_check_has_staff(uuid);

CREATE FUNCTION public.admin_check_has_staff(p_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.restaurant_staff WHERE restaurant_id = p_restaurant_id);
$$;

CREATE FUNCTION public.admin_create_first_staff(
  p_restaurant_id uuid,
  p_display_name text,
  p_username text,
  p_password_hash text,
  p_role text DEFAULT 'admin',
  p_allowed_sections text DEFAULT '[]'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.restaurant_staff WHERE restaurant_id = p_restaurant_id) THEN
    RAISE EXCEPTION 'Este restaurante já possui equipe cadastrada';
  END IF;

  INSERT INTO public.restaurant_staff (
    restaurant_id, username, password_hash, display_name, role, allowed_sections, is_active
  ) VALUES (
    p_restaurant_id,
    trim(p_username),
    p_password_hash,
    p_display_name,
    COALESCE(p_role, 'admin'),
    COALESCE(p_allowed_sections, '[]')::jsonb,
    true
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_check_has_staff(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_create_first_staff(uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_check_has_staff(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_first_staff(uuid, text, text, text, text, text) TO anon, authenticated;