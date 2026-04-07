
-- CEO Users RPCs
CREATE OR REPLACE FUNCTION public.admin_list_ceo_users()
RETURNS TABLE(id uuid, username text, display_name text, is_active boolean, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, username, display_name, is_active, created_at
  FROM public.ceo_users
  ORDER BY created_at;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_ceo_user(
  p_id uuid DEFAULT NULL,
  p_username text DEFAULT NULL,
  p_display_name text DEFAULT NULL,
  p_password_hash text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_id IS NOT NULL THEN
    IF p_password_hash IS NOT NULL AND p_password_hash != '' THEN
      UPDATE public.ceo_users
      SET username = COALESCE(p_username, username),
          display_name = COALESCE(p_display_name, display_name),
          password_hash = p_password_hash,
          updated_at = now()
      WHERE id = p_id;
    ELSE
      UPDATE public.ceo_users
      SET username = COALESCE(p_username, username),
          display_name = COALESCE(p_display_name, display_name),
          updated_at = now()
      WHERE id = p_id;
    END IF;
  ELSE
    INSERT INTO public.ceo_users (username, display_name, password_hash)
    VALUES (p_username, p_display_name, p_password_hash);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_ceo_user(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.ceo_users;
  IF v_count <= 1 THEN
    RAISE EXCEPTION 'Deve haver ao menos 1 usuário CEO';
  END IF;
  DELETE FROM public.ceo_users WHERE id = p_id;
END;
$$;

-- Staff RPCs
CREATE OR REPLACE FUNCTION public.admin_check_has_staff(p_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurant_staff WHERE restaurant_id = p_restaurant_id
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_create_first_staff(
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
  IF EXISTS (SELECT 1 FROM public.restaurant_staff WHERE restaurant_id = p_restaurant_id) THEN
    RAISE EXCEPTION 'Staff já existe para este restaurante';
  END IF;
  INSERT INTO public.restaurant_staff (restaurant_id, display_name, username, password_hash, role, allowed_sections, is_active)
  VALUES (p_restaurant_id, p_display_name, p_username, p_password_hash, p_role, p_allowed_sections::jsonb, true);
END;
$$;

-- Payment Config RPCs
CREATE OR REPLACE FUNCTION public.admin_get_payment_config(p_restaurant_id uuid)
RETURNS TABLE(
  id uuid, restaurant_id uuid, enabled boolean, provider text,
  accept_pix boolean, accept_card boolean, enable_for_delivery boolean,
  connection_status text, mp_access_token text, mp_public_key text,
  mp_refresh_token text, mp_sandbox_payer_email text, connected_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, restaurant_id, enabled, provider, accept_pix, accept_card,
         enable_for_delivery, connection_status, mp_access_token, mp_public_key,
         mp_refresh_token, mp_sandbox_payer_email, connected_at
  FROM public.online_payment_config
  WHERE restaurant_id = p_restaurant_id;
$$;

CREATE OR REPLACE FUNCTION public.admin_ensure_payment_config(p_restaurant_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.online_payment_config WHERE restaurant_id = p_restaurant_id;
  IF v_id IS NULL THEN
    INSERT INTO public.online_payment_config (restaurant_id)
    VALUES (p_restaurant_id)
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_payment_config(p_restaurant_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.online_payment_config WHERE restaurant_id = p_restaurant_id;
$$;

-- Public View (safe fields only)
CREATE OR REPLACE VIEW public.online_payment_config_public AS
SELECT id, restaurant_id, enabled, accept_pix, accept_card,
       enable_for_delivery, connection_status, mp_public_key
FROM public.online_payment_config;

GRANT SELECT ON public.online_payment_config_public TO anon, authenticated;

-- Block direct access to sensitive tables
DROP POLICY IF EXISTS "Allow all operations on ceo_users for anon and authenticated" ON public.ceo_users;
CREATE POLICY "block_direct_access" ON public.ceo_users FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Allow all operations on restaurant_credentials" ON public.restaurant_credentials;
CREATE POLICY "block_direct_access" ON public.restaurant_credentials FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Allow all operations on restaurant_staff" ON public.restaurant_staff;
CREATE POLICY "block_direct_access" ON public.restaurant_staff FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Allow all operations on online_payment_config" ON public.online_payment_config;
CREATE POLICY "block_direct_access" ON public.online_payment_config FOR ALL USING (false) WITH CHECK (false);

-- Fiscal certificates path scoping
DROP POLICY IF EXISTS "fiscal_select" ON storage.objects;
DROP POLICY IF EXISTS "fiscal_insert" ON storage.objects;
DROP POLICY IF EXISTS "fiscal_update" ON storage.objects;
DROP POLICY IF EXISTS "fiscal_delete" ON storage.objects;

CREATE POLICY "fiscal_select_scoped" ON storage.objects FOR SELECT
USING (bucket_id = 'fiscal-certificates' AND EXISTS (SELECT 1 FROM public.restaurants WHERE id::text = (storage.foldername(name))[1]));

CREATE POLICY "fiscal_insert_scoped" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'fiscal-certificates' AND EXISTS (SELECT 1 FROM public.restaurants WHERE id::text = (storage.foldername(name))[1]));

CREATE POLICY "fiscal_update_scoped" ON storage.objects FOR UPDATE
USING (bucket_id = 'fiscal-certificates' AND EXISTS (SELECT 1 FROM public.restaurants WHERE id::text = (storage.foldername(name))[1]));

CREATE POLICY "fiscal_delete_scoped" ON storage.objects FOR DELETE
USING (bucket_id = 'fiscal-certificates' AND EXISTS (SELECT 1 FROM public.restaurants WHERE id::text = (storage.foldername(name))[1]));
