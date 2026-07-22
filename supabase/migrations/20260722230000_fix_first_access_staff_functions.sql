-- =====================================================================
-- FIX: funções de PRIMEIRO ACESSO que faltavam no banco
-- ---------------------------------------------------------------------
-- A tela StaffLogin (/login/staff) usa:
--   * admin_check_has_staff(p_restaurant_id)  → decide se mostra o form de
--     "criar conta do proprietário" (primeiro acesso) ou o login normal.
--   * admin_create_first_staff(...)           → cria a conta do dono (admin)
--     no primeiro acesso.
-- Nenhuma das duas existia no banco, então o primeiro acesso quebrava.
-- Aqui elas são criadas seguindo o padrão de admin_upsert_staff
-- (allowed_sections chega como TEXT com JSON e é convertido para jsonb).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.admin_check_has_staff(p_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurant_staff
    WHERE restaurant_id = p_restaurant_id
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_create_first_staff(
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
  -- Proteção: só permite criar a PRIMEIRA conta (a do dono). Se já houver
  -- qualquer funcionário, novos usuários devem ser criados pelo painel
  -- (Equipe/Contas), que usa admin_upsert_staff.
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

-- Entradas públicas (chamadas antes de existir sessão) — anon precisa executar.
REVOKE ALL ON FUNCTION public.admin_check_has_staff(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_create_first_staff(uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_check_has_staff(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_first_staff(uuid, text, text, text, text, text) TO anon, authenticated;
