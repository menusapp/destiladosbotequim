-- ============================================================
-- PROMPT 1: Permissões de pedidos por staff
-- ============================================================
ALTER TABLE public.restaurant_staff
  ADD COLUMN IF NOT EXISTS can_manage_orders boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS receives_order_notifications boolean NOT NULL DEFAULT true;

-- Garantir que admin sempre tenha as duas permissões = true
CREATE OR REPLACE FUNCTION public.enforce_admin_order_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.role = 'admin' THEN
    NEW.can_manage_orders := true;
    NEW.receives_order_notifications := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_admin_order_permissions ON public.restaurant_staff;
CREATE TRIGGER trg_enforce_admin_order_permissions
  BEFORE INSERT OR UPDATE ON public.restaurant_staff
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_admin_order_permissions();

-- Backfill: forçar admin existentes para true
UPDATE public.restaurant_staff
SET can_manage_orders = true, receives_order_notifications = true
WHERE role = 'admin'
  AND (can_manage_orders = false OR receives_order_notifications = false);

-- ============================================================
-- Atualizar admin_list_staff para retornar novas colunas
-- ============================================================
DROP FUNCTION IF EXISTS public.admin_list_staff(uuid);
CREATE OR REPLACE FUNCTION public.admin_list_staff(p_restaurant_id uuid)
RETURNS TABLE(
  id uuid, username text, display_name text, role text,
  allowed_sections jsonb, is_active boolean, created_at timestamp with time zone,
  can_manage_orders boolean, receives_order_notifications boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
    SELECT s.id, s.username, s.display_name, s.role, s.allowed_sections,
           s.is_active, s.created_at,
           s.can_manage_orders, s.receives_order_notifications
    FROM public.restaurant_staff s
    WHERE s.restaurant_id = p_restaurant_id
    ORDER BY s.created_at ASC;
END;
$$;

-- ============================================================
-- Atualizar admin_upsert_staff para aceitar novos parâmetros
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_upsert_staff(
  p_restaurant_id uuid,
  p_id uuid DEFAULT NULL::uuid,
  p_username text DEFAULT NULL::text,
  p_password_hash text DEFAULT NULL::text,
  p_display_name text DEFAULT NULL::text,
  p_role text DEFAULT NULL::text,
  p_allowed_sections text DEFAULT NULL::text,
  p_can_manage_orders boolean DEFAULT NULL::boolean,
  p_receives_order_notifications boolean DEFAULT NULL::boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
      allowed_sections = CASE WHEN p_allowed_sections IS NOT NULL THEN p_allowed_sections::jsonb ELSE allowed_sections END,
      can_manage_orders = COALESCE(p_can_manage_orders, can_manage_orders),
      receives_order_notifications = COALESCE(p_receives_order_notifications, receives_order_notifications)
    WHERE id = p_id AND restaurant_id = p_restaurant_id
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Staff não encontrado';
    END IF;
  ELSE
    INSERT INTO public.restaurant_staff (
      restaurant_id, username, password_hash, display_name, role,
      allowed_sections, is_active,
      can_manage_orders, receives_order_notifications
    )
    VALUES (
      p_restaurant_id, p_username, p_password_hash, p_display_name, p_role,
      p_allowed_sections::jsonb, true,
      COALESCE(p_can_manage_orders, true),
      COALESCE(p_receives_order_notifications, true)
    )
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;

-- ============================================================
-- Atualizar validate_staff_credentials para retornar permissões
-- ============================================================
DROP FUNCTION IF EXISTS public.validate_staff_credentials(uuid, text, text);
CREATE OR REPLACE FUNCTION public.validate_staff_credentials(
  p_restaurant_id uuid, p_username text, p_password text
)
RETURNS TABLE(
  staff_id uuid, display_name text, role text, allowed_sections jsonb,
  can_manage_orders boolean, receives_order_notifications boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public, extensions'
AS $$
DECLARE
  v_record RECORD;
BEGIN
  SELECT rs.id, rs.display_name, rs.role, rs.allowed_sections, rs.password_hash,
         rs.can_manage_orders, rs.receives_order_notifications
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
$$;

-- ============================================================
-- PROMPT 2: Configuração de via da cozinha
-- ============================================================
ALTER TABLE public.printer_settings
  ADD COLUMN IF NOT EXISTS print_kitchen_copy boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS kitchen_printer_name text,
  ADD COLUMN IF NOT EXISTS kitchen_copy_auto_print boolean NOT NULL DEFAULT true;