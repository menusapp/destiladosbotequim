
-- ============================================
-- 1. Table: point_terminals
-- ============================================
CREATE TABLE public.point_terminals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  device_name text,
  operating_mode text DEFAULT 'PDV',
  is_active boolean DEFAULT true,
  use_on_kiosk boolean DEFAULT false,
  is_default_terminal boolean DEFAULT false,
  totem_id text,
  mp_store_id text,
  mp_pos_id text,
  mp_external_store_id text,
  mp_external_pos_id text,
  terminal_metadata jsonb,
  last_seen_at timestamptz,
  configured_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(restaurant_id, device_id)
);

ALTER TABLE public.point_terminals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "block_direct_access_point_terminals" ON public.point_terminals
  FOR ALL TO public USING (false) WITH CHECK (false);

CREATE TRIGGER update_point_terminals_updated_at
  BEFORE UPDATE ON public.point_terminals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 2. Table: point_order_payments
-- ============================================
CREATE TABLE public.point_order_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  mp_order_id text NOT NULL,
  mp_user_id text,
  terminal_id text NOT NULL,
  external_reference text,
  idempotency_key text NOT NULL,
  amount numeric NOT NULL,
  status text DEFAULT 'creating_payment',
  mp_status_payload jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.point_order_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "block_direct_access_point_order_payments" ON public.point_order_payments
  FOR ALL TO public USING (false) WITH CHECK (false);

CREATE TRIGGER update_point_order_payments_updated_at
  BEFORE UPDATE ON public.point_order_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 3. Add token_expires_at to online_payment_config
-- ============================================
ALTER TABLE public.online_payment_config
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz;

-- ============================================
-- 4. RPCs SECURITY DEFINER for point_terminals
-- ============================================

-- Get terminals for a restaurant
CREATE OR REPLACE FUNCTION public.admin_get_point_terminals(p_restaurant_id uuid)
RETURNS TABLE(
  id uuid, restaurant_id uuid, device_id text, device_name text,
  operating_mode text, is_active boolean, use_on_kiosk boolean,
  is_default_terminal boolean, totem_id text, mp_store_id text, mp_pos_id text,
  mp_external_store_id text, mp_external_pos_id text, terminal_metadata jsonb,
  last_seen_at timestamptz, configured_by text, created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.point_terminals WHERE restaurant_id = p_restaurant_id ORDER BY created_at;
$$;

-- Upsert a terminal
CREATE OR REPLACE FUNCTION public.admin_upsert_point_terminal(
  p_restaurant_id uuid,
  p_device_id text,
  p_device_name text DEFAULT NULL,
  p_operating_mode text DEFAULT 'PDV',
  p_use_on_kiosk boolean DEFAULT false,
  p_is_default_terminal boolean DEFAULT false,
  p_totem_id text DEFAULT NULL,
  p_mp_store_id text DEFAULT NULL,
  p_mp_pos_id text DEFAULT NULL,
  p_mp_external_store_id text DEFAULT NULL,
  p_mp_external_pos_id text DEFAULT NULL,
  p_terminal_metadata jsonb DEFAULT NULL,
  p_configured_by text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  -- If setting use_on_kiosk, clear others first
  IF p_use_on_kiosk THEN
    UPDATE public.point_terminals
    SET use_on_kiosk = false
    WHERE restaurant_id = p_restaurant_id AND device_id != p_device_id;
  END IF;

  INSERT INTO public.point_terminals (
    restaurant_id, device_id, device_name, operating_mode,
    use_on_kiosk, is_default_terminal, totem_id,
    mp_store_id, mp_pos_id, mp_external_store_id, mp_external_pos_id,
    terminal_metadata, configured_by, last_seen_at
  ) VALUES (
    p_restaurant_id, p_device_id, p_device_name, p_operating_mode,
    p_use_on_kiosk, p_is_default_terminal, p_totem_id,
    p_mp_store_id, p_mp_pos_id, p_mp_external_store_id, p_mp_external_pos_id,
    p_terminal_metadata, p_configured_by, now()
  )
  ON CONFLICT (restaurant_id, device_id) DO UPDATE SET
    device_name = COALESCE(EXCLUDED.device_name, point_terminals.device_name),
    operating_mode = EXCLUDED.operating_mode,
    use_on_kiosk = EXCLUDED.use_on_kiosk,
    is_default_terminal = EXCLUDED.is_default_terminal,
    totem_id = EXCLUDED.totem_id,
    mp_store_id = COALESCE(EXCLUDED.mp_store_id, point_terminals.mp_store_id),
    mp_pos_id = COALESCE(EXCLUDED.mp_pos_id, point_terminals.mp_pos_id),
    mp_external_store_id = COALESCE(EXCLUDED.mp_external_store_id, point_terminals.mp_external_store_id),
    mp_external_pos_id = COALESCE(EXCLUDED.mp_external_pos_id, point_terminals.mp_external_pos_id),
    terminal_metadata = COALESCE(EXCLUDED.terminal_metadata, point_terminals.terminal_metadata),
    configured_by = EXCLUDED.configured_by,
    last_seen_at = now(),
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Delete a terminal
CREATE OR REPLACE FUNCTION public.admin_delete_point_terminal(p_restaurant_id uuid, p_device_id text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.point_terminals
  WHERE restaurant_id = p_restaurant_id AND device_id = p_device_id;
$$;

-- Get kiosk terminal for a restaurant (used by totem)
CREATE OR REPLACE FUNCTION public.get_kiosk_point_terminal(p_restaurant_id uuid)
RETURNS TABLE(
  device_id text, device_name text, mp_store_id text, mp_pos_id text
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT device_id, device_name, mp_store_id, mp_pos_id
  FROM public.point_terminals
  WHERE restaurant_id = p_restaurant_id AND use_on_kiosk = true AND is_active = true
  LIMIT 1;
$$;

-- ============================================
-- 5. RPCs SECURITY DEFINER for point_order_payments
-- ============================================

-- Insert a point order payment
CREATE OR REPLACE FUNCTION public.insert_point_order_payment(
  p_restaurant_id uuid,
  p_order_id uuid,
  p_mp_order_id text,
  p_mp_user_id text,
  p_terminal_id text,
  p_external_reference text,
  p_idempotency_key text,
  p_amount numeric,
  p_status text DEFAULT 'creating_payment'
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.point_order_payments (
    restaurant_id, order_id, mp_order_id, mp_user_id,
    terminal_id, external_reference, idempotency_key, amount, status
  ) VALUES (
    p_restaurant_id, p_order_id, p_mp_order_id, p_mp_user_id,
    p_terminal_id, p_external_reference, p_idempotency_key, p_amount, p_status
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Update point order payment status
CREATE OR REPLACE FUNCTION public.update_point_order_payment(
  p_mp_order_id text,
  p_status text,
  p_mp_status_payload jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.point_order_payments
  SET status = p_status, mp_status_payload = COALESCE(p_mp_status_payload, mp_status_payload), updated_at = now()
  WHERE mp_order_id = p_mp_order_id;
$$;

-- Get point order payment by mp_order_id
CREATE OR REPLACE FUNCTION public.get_point_order_payment(p_mp_order_id text)
RETURNS TABLE(
  id uuid, restaurant_id uuid, order_id uuid, mp_order_id text,
  mp_user_id text, terminal_id text, external_reference text,
  idempotency_key text, amount numeric, status text, mp_status_payload jsonb
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id, restaurant_id, order_id, mp_order_id, mp_user_id,
         terminal_id, external_reference, idempotency_key, amount, status, mp_status_payload
  FROM public.point_order_payments
  WHERE mp_order_id = p_mp_order_id
  LIMIT 1;
$$;

-- ============================================
-- 6. RPC to check token expiry
-- ============================================
CREATE OR REPLACE FUNCTION public.check_mp_token_expiry(p_restaurant_id uuid)
RETURNS TABLE(is_expired boolean, expires_at timestamptz, has_token boolean)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    CASE
      WHEN opc.token_expires_at IS NOT NULL AND opc.token_expires_at < now() THEN true
      ELSE false
    END as is_expired,
    opc.token_expires_at as expires_at,
    (opc.mp_access_token IS NOT NULL) as has_token
  FROM public.online_payment_config opc
  WHERE opc.restaurant_id = p_restaurant_id;
$$;
