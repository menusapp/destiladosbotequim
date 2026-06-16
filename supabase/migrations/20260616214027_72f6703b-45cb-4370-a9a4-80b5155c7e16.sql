CREATE OR REPLACE FUNCTION public.validate_restaurant_credentials(p_username text, p_password text)
RETURNS TABLE(restaurant_id uuid, restaurant_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public, extensions'
AS $function$
DECLARE
  v_rec RECORD;
  v_username text := lower(trim(coalesce(p_username, '')));
BEGIN
  FOR v_rec IN
    SELECT rc.restaurant_id AS rid, rc.password_hash AS phash, r.name AS rname
    FROM public.restaurant_credentials rc
    JOIN public.restaurants r ON r.id = rc.restaurant_id
    WHERE lower(trim(rc.username)) = v_username
  LOOP
    IF v_rec.phash LIKE '$2a$%' OR v_rec.phash LIKE '$2b$%' OR v_rec.phash LIKE '$2y$%' THEN
      IF v_rec.phash = extensions.crypt(p_password, v_rec.phash) THEN
        restaurant_id := v_rec.rid;
        restaurant_name := v_rec.rname;
        RETURN NEXT;
        RETURN;
      END IF;
    ELSE
      IF v_rec.phash = p_password THEN
        UPDATE public.restaurant_credentials
        SET password_hash = extensions.crypt(p_password, extensions.gen_salt('bf'))
        WHERE restaurant_id = v_rec.rid AND lower(trim(username)) = v_username;

        restaurant_id := v_rec.rid;
        restaurant_name := v_rec.rname;
        RETURN NEXT;
        RETURN;
      END IF;
    END IF;
  END LOOP;

  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_staff_credentials(p_restaurant_id uuid, p_username text, p_password text)
RETURNS TABLE(staff_id uuid, display_name text, role text, allowed_sections jsonb, can_manage_orders boolean, receives_order_notifications boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public, extensions'
AS $function$
DECLARE
  v_record RECORD;
  v_username text := lower(trim(coalesce(p_username, '')));
BEGIN
  SELECT rs.id, rs.display_name, rs.role, rs.allowed_sections, rs.password_hash,
         rs.can_manage_orders, rs.receives_order_notifications
  INTO v_record
  FROM public.restaurant_staff rs
  WHERE rs.restaurant_id = p_restaurant_id
    AND lower(trim(rs.username)) = v_username
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
      can_manage_orders := v_record.can_manage_orders;
      receives_order_notifications := v_record.receives_order_notifications;
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
      can_manage_orders := v_record.can_manage_orders;
      receives_order_notifications := v_record.receives_order_notifications;
      RETURN NEXT;
    END IF;
  END IF;

  RETURN;
END;
$function$;