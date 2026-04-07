-- RPC to list all staff for a restaurant
CREATE OR REPLACE FUNCTION public.admin_list_staff(p_restaurant_id uuid)
RETURNS TABLE(
  id uuid,
  username text,
  display_name text,
  role text,
  allowed_sections jsonb,
  is_active boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT s.id, s.username, s.display_name, s.role, s.allowed_sections, s.is_active, s.created_at
    FROM public.restaurant_staff s
    WHERE s.restaurant_id = p_restaurant_id
    ORDER BY s.created_at ASC;
END;
$$;

-- RPC to upsert (create or update) a staff member
CREATE OR REPLACE FUNCTION public.admin_upsert_staff(
  p_restaurant_id uuid,
  p_id uuid DEFAULT NULL,
  p_username text DEFAULT NULL,
  p_password_hash text DEFAULT NULL,
  p_display_name text DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_allowed_sections text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_id IS NOT NULL THEN
    UPDATE public.restaurant_staff
    SET
      display_name = COALESCE(p_display_name, display_name),
      username = COALESCE(p_username, username),
      password_hash = COALESCE(p_password_hash, password_hash),
      role = COALESCE(p_role, role),
      allowed_sections = CASE WHEN p_allowed_sections IS NOT NULL THEN p_allowed_sections::jsonb ELSE allowed_sections END
    WHERE id = p_id AND restaurant_id = p_restaurant_id
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Staff não encontrado';
    END IF;
  ELSE
    INSERT INTO public.restaurant_staff (restaurant_id, username, password_hash, display_name, role, allowed_sections, is_active)
    VALUES (p_restaurant_id, p_username, p_password_hash, p_display_name, p_role, p_allowed_sections::jsonb, true)
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;

-- RPC to toggle staff active status
CREATE OR REPLACE FUNCTION public.admin_toggle_staff_active(p_staff_id uuid, p_restaurant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_status boolean;
BEGIN
  UPDATE public.restaurant_staff
  SET is_active = NOT is_active
  WHERE id = p_staff_id AND restaurant_id = p_restaurant_id
  RETURNING is_active INTO v_new_status;
  IF v_new_status IS NULL THEN
    RAISE EXCEPTION 'Staff não encontrado';
  END IF;
  RETURN v_new_status;
END;
$$;

-- RPC to create staff without the first-staff restriction (for CEO dashboard)
CREATE OR REPLACE FUNCTION public.admin_create_staff(
  p_restaurant_id uuid,
  p_display_name text,
  p_username text,
  p_password_hash text,
  p_role text,
  p_allowed_sections text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.restaurant_staff (restaurant_id, display_name, username, password_hash, role, allowed_sections, is_active)
  VALUES (p_restaurant_id, p_display_name, p_username, p_password_hash, p_role, p_allowed_sections::jsonb, true);
END;
$$;