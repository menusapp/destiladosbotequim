-- =====================================================================
-- AUTENTICAÇÃO POR SESSÃO NO SERVIDOR (sem depender do JWT Secret do projeto)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.staff_sessions (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid,
  staff_id uuid,
  role text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.staff_sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_staff_sessions_token ON public.staff_sessions (token);

CREATE OR REPLACE FUNCTION public._app_token()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(
    NULLIF(current_setting('request.headers', true), '')::json ->> 'x-app-token',
    ''
  )::uuid
$$;

CREATE OR REPLACE FUNCTION public.current_restaurant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT s.restaurant_id FROM public.staff_sessions s
  WHERE s.token = public._app_token() AND s.expires_at > now()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_staff_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT s.staff_id FROM public.staff_sessions s
  WHERE s.token = public._app_token() AND s.expires_at > now()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_staff_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT s.role FROM public.staff_sessions s
  WHERE s.token = public._app_token() AND s.expires_at > now()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_sessions s
    WHERE s.token = public._app_token() AND s.expires_at > now()
      AND s.restaurant_id IS NOT NULL AND s.staff_id IS NOT NULL
  )
$$;

CREATE OR REPLACE FUNCTION public.is_ceo()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_sessions s
    WHERE s.token = public._app_token() AND s.expires_at > now()
      AND s.role = 'ceo'
  )
$$;

GRANT EXECUTE ON FUNCTION public._app_token() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_restaurant_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_staff_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_staff_role() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_ceo() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_staff_session(
  p_restaurant_id uuid, p_username text, p_password text
)
RETURNS TABLE(token uuid, staff_id uuid, display_name text, role text, allowed_sections jsonb, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_rec record;
  v_token uuid := gen_random_uuid();
  v_exp timestamptz := now() + interval '7 days';
BEGIN
  SELECT * INTO v_rec
  FROM public.validate_staff_credentials(p_restaurant_id, p_username, p_password)
  LIMIT 1;

  IF v_rec.staff_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.staff_sessions (token, restaurant_id, staff_id, role, expires_at)
  VALUES (v_token, p_restaurant_id, v_rec.staff_id, v_rec.role, v_exp);

  RETURN QUERY SELECT v_token, v_rec.staff_id, v_rec.display_name, v_rec.role, v_rec.allowed_sections, v_exp;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_ceo_session(p_username text, p_password text)
RETURNS TABLE(token uuid, ceo_user_id uuid, display_name text, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_rec record;
  v_token uuid := gen_random_uuid();
  v_exp timestamptz := now() + interval '7 days';
BEGIN
  SELECT * INTO v_rec
  FROM public.validate_ceo_credentials(p_username, p_password)
  LIMIT 1;

  IF v_rec.ceo_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.staff_sessions (token, restaurant_id, staff_id, role, expires_at)
  VALUES (v_token, NULL, v_rec.ceo_user_id, 'ceo', v_exp);

  RETURN QUERY SELECT v_token, v_rec.ceo_user_id, v_rec.display_name, v_exp;
END;
$$;

REVOKE ALL ON FUNCTION public.create_staff_session(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_ceo_session(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_staff_session(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_ceo_session(text, text) TO anon, authenticated;

DO $$
DECLARE
  r record;
  target_tables text[] := ARRAY[
    'cash_movements','cash_register_sessions','printer_settings','order_fiscal_notes',
    'suppliers','employee_credits','nfe_imports','stock_items','stock_categories',
    'stock_movements','variable_costs','fixed_costs','labor_costs','fiscal_configs',
    'delivery_config','marketing_campaigns','marketing_campaign_rules',
    'whatsapp_conversations','whatsapp_config','whatsapp_ai_config',
    'whatsapp_notification_configs','whatsapp_menu_options','owner_notification_config',
    'counter_orders','counter_order_items','customer_loyalty_progress',
    'product_ingredients','product_extra_ingredients','extra_category_item_ingredients',
    'restaurant_subscriptions','subscription_payments','subscription_plans','plan_payment_links',
    'restaurant_staff','restaurant_credentials','ceo_users','user_roles','profiles',
    'restaurants','products','product_extras','product_complement_groups','categories',
    'extra_categories','extra_category_items','business_hours','reservation_hours',
    'reservation_tables','delivery_zones','payment_methods','loyalty_programs',
    'loyalty_program_rewards','customers','customer_addresses','orders','order_items',
    'order_item_extras','loyalty_points','loyalty_transactions','loyalty_reward_redemptions',
    'coupons','comandas','bills','tables','online_payments','customer_cards','reservations',
    'marketing_scheduled_messages','kiosk_config','customer_sessions','restaurant_reviews',
    'product_upsells'
  ];
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public' AND tablename = ANY(target_tables)
  LOOP
    BEGIN
      EXECUTE format('ALTER POLICY %I ON public.%I TO public', r.policyname, r.tablename);
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END LOOP;
END $$;