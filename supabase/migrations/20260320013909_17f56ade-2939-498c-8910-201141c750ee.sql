CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.validate_restaurant_credentials(p_username text, p_password text)
 RETURNS TABLE(restaurant_id uuid, restaurant_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public, extensions'
AS $function$
DECLARE
  v_record RECORD;
BEGIN
  SELECT rc.restaurant_id, rc.password_hash, r.name
  INTO v_record
  FROM public.restaurant_credentials rc
  JOIN public.restaurants r ON r.id = rc.restaurant_id
  WHERE rc.username = p_username
  LIMIT 1;

  IF v_record IS NULL THEN
    RETURN;
  END IF;

  IF v_record.password_hash LIKE '$2a$%' OR v_record.password_hash LIKE '$2b$%' OR v_record.password_hash LIKE '$2y$%' THEN
    IF v_record.password_hash = extensions.crypt(p_password, v_record.password_hash) THEN
      restaurant_id := v_record.restaurant_id;
      restaurant_name := v_record.name;
      RETURN NEXT;
    END IF;
  ELSE
    IF v_record.password_hash = p_password THEN
      UPDATE public.restaurant_credentials
      SET password_hash = extensions.crypt(p_password, extensions.gen_salt('bf'))
      WHERE username = p_username;

      restaurant_id := v_record.restaurant_id;
      restaurant_name := v_record.name;
      RETURN NEXT;
    END IF;
  END IF;

  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_staff_credentials(p_restaurant_id uuid, p_username text, p_password text)
 RETURNS TABLE(staff_id uuid, display_name text, role text, allowed_sections jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public, extensions'
AS $function$
DECLARE
  v_record RECORD;
BEGIN
  SELECT rs.id, rs.display_name, rs.role, rs.allowed_sections, rs.password_hash
  INTO v_record
  FROM public.restaurant_staff rs
  WHERE rs.restaurant_id = p_restaurant_id
    AND rs.username = p_username
    AND rs.is_active = true
  LIMIT 1;

  IF v_record IS NULL THEN
    RETURN;
  END IF;

  IF v_record.password_hash LIKE '$2a$%' OR v_record.password_hash LIKE '$2b$%' OR v_record.password_hash LIKE '$2y$%' THEN
    IF v_record.password_hash = extensions.crypt(p_password, v_record.password_hash) THEN
      staff_id := v_record.id;
      display_name := v_record.display_name;
      role := v_record.role;
      allowed_sections := v_record.allowed_sections;
      RETURN NEXT;
    END IF;
  ELSE
    IF v_record.password_hash = p_password THEN
      UPDATE public.restaurant_staff
      SET password_hash = extensions.crypt(p_password, extensions.gen_salt('bf'))
      WHERE id = v_record.id;

      staff_id := v_record.id;
      display_name := v_record.display_name;
      role := v_record.role;
      allowed_sections := v_record.allowed_sections;
      RETURN NEXT;
    END IF;
  END IF;

  RETURN;
END;
$function$;