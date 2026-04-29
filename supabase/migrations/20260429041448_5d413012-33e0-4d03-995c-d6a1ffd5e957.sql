-- Drop global unique on username, allow same username across different restaurants
ALTER TABLE public.restaurant_credentials
  DROP CONSTRAINT IF EXISTS restaurant_credentials_username_key;

ALTER TABLE public.restaurant_credentials
  ADD CONSTRAINT restaurant_credentials_restaurant_username_key
  UNIQUE (restaurant_id, username);

-- Update validate_restaurant_credentials to iterate over all matches and validate by password
CREATE OR REPLACE FUNCTION public.validate_restaurant_credentials(p_username text, p_password text)
 RETURNS TABLE(restaurant_id uuid, restaurant_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public, extensions'
AS $function$
DECLARE
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT rc.restaurant_id AS rid, rc.password_hash AS phash, r.name AS rname
    FROM public.restaurant_credentials rc
    JOIN public.restaurants r ON r.id = rc.restaurant_id
    WHERE rc.username = p_username
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
        WHERE restaurant_id = v_rec.rid AND username = p_username;

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