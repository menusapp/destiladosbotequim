-- =====================================================================
-- SECURITY HARDENING — Parte 4: RPCs seguras do fluxo do cliente
-- ---------------------------------------------------------------------
-- SECURITY DEFINER (rodam com privilégio elevado e ignoram RLS), mas o
-- CORPO de cada função é a fronteira de segurança: sempre reescopadas ao
-- estabelecimento (default_restaurant_id) e, quando keyed por CPF,
-- exigem o telefone correspondente antes de devolver dados. Retornam
-- apenas as colunas necessárias — nunca dump em massa.
--
-- Inertes até o frontend chamá-las (Parte 5 do frontend). Só depois disso
-- é seguro aplicar a Parte 5 SQL (remoção do acesso anônimo direto).
-- =====================================================================
SET search_path = public;

-- Prefill de cliente por CPF (nome/telefone/email). Retorna 1 linha.
CREATE OR REPLACE FUNCTION public.get_customer_by_cpf(p_cpf text)
RETURNS TABLE(id uuid, cpf text, name text, phone text, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT c.id, c.cpf, c.name, c.phone, c.email
  FROM public.customers c
  WHERE c.restaurant_id = public.default_restaurant_id()
    AND c.cpf = p_cpf
  LIMIT 1
$$;

-- Cria/atualiza cliente (checkout). Retorna o id.
CREATE OR REPLACE FUNCTION public.upsert_customer(
  p_cpf text, p_name text, p_phone text DEFAULT NULL, p_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_rid uuid := public.default_restaurant_id();
  v_id uuid;
BEGIN
  INSERT INTO public.customers (restaurant_id, cpf, name, phone, email)
  VALUES (v_rid, p_cpf, p_name, p_phone, p_email)
  ON CONFLICT (restaurant_id, cpf) DO UPDATE
    SET name = EXCLUDED.name,
        phone = COALESCE(EXCLUDED.phone, customers.phone),
        email = COALESCE(EXCLUDED.email, customers.email),
        updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Detalhes de um pedido pelo id (UUID não-adivinhável). Order + itens + extras.
CREATE OR REPLACE FUNCTION public.get_order_details(p_order_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT to_jsonb(o) || jsonb_build_object(
    'items', COALESCE((
      SELECT jsonb_agg(to_jsonb(oi) || jsonb_build_object(
        'extras', COALESCE((
          SELECT jsonb_agg(to_jsonb(oie))
          FROM public.order_item_extras oie WHERE oie.order_item_id = oi.id
        ), '[]'::jsonb)
      ))
      FROM public.order_items oi WHERE oi.order_id = o.id
    ), '[]'::jsonb)
  )
  FROM public.orders o
  WHERE o.id = p_order_id
    AND o.restaurant_id = public.default_restaurant_id()
$$;

-- Status de um pedido (para polling na tela de confirmação).
CREATE OR REPLACE FUNCTION public.get_order_status(p_order_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT status FROM public.orders
  WHERE id = p_order_id AND restaurant_id = public.default_restaurant_id()
$$;

-- Histórico de pedidos por CPF — exige telefone correspondente.
CREATE OR REPLACE FUNCTION public.get_customer_orders(p_cpf text, p_phone text)
RETURNS SETOF public.orders
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_rid uuid := public.default_restaurant_id();
BEGIN
  -- Só devolve se o telefone bater com o cadastro do cliente (anti-enumeração).
  IF NOT EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.restaurant_id = v_rid AND c.cpf = p_cpf
      AND (p_phone IS NOT NULL AND regexp_replace(COALESCE(c.phone,''), '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g'))
  ) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT * FROM public.orders o
    WHERE o.restaurant_id = v_rid AND o.customer_cpf = p_cpf
    ORDER BY o.created_at DESC;
END;
$$;

-- Endereços do cliente — exige CPF + telefone correspondentes.
CREATE OR REPLACE FUNCTION public.list_customer_addresses(p_cpf text, p_phone text)
RETURNS SETOF public.customer_addresses
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT * FROM public.customer_addresses ca
  WHERE ca.restaurant_id = public.default_restaurant_id()
    AND ca.customer_cpf = p_cpf
    AND regexp_replace(COALESCE(ca.customer_phone,''), '\D', '', 'g') = regexp_replace(COALESCE(p_phone,''), '\D', '', 'g')
  ORDER BY ca.is_default DESC, ca.created_at DESC
$$;

CREATE OR REPLACE FUNCTION public.add_customer_address(
  p_cpf text, p_name text, p_phone text, p_street text, p_number text,
  p_neighborhood text, p_city text, p_state text, p_zip_code text,
  p_complement text DEFAULT NULL, p_is_default boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.customer_addresses (
    restaurant_id, customer_cpf, customer_name, customer_phone,
    street, number, complement, neighborhood, city, state, zip_code, is_default
  ) VALUES (
    public.default_restaurant_id(), p_cpf, p_name, p_phone,
    p_street, p_number, p_complement, p_neighborhood, p_city, p_state, p_zip_code, p_is_default
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_customer_address(p_id uuid, p_cpf text)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.customer_addresses
  WHERE id = p_id AND customer_cpf = p_cpf
    AND restaurant_id = public.default_restaurant_id();
  RETURN FOUND;
END;
$$;

-- Saldo de fidelidade por CPF.
CREATE OR REPLACE FUNCTION public.get_loyalty_balance(p_cpf text)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((
    SELECT points_balance FROM public.loyalty_points
    WHERE restaurant_id = public.default_restaurant_id() AND customer_cpf = p_cpf
    LIMIT 1
  ), 0)
$$;

-- Aplica fidelidade de forma ATÔMICA (ganho/resgate) + registra transação.
-- Corrige também o cálculo de saldo antes feito no cliente.
CREATE OR REPLACE FUNCTION public.apply_loyalty(
  p_cpf text, p_points integer, p_type text, p_order_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_rid uuid := public.default_restaurant_id();
  v_balance integer;
BEGIN
  IF p_type NOT IN ('earn','redeem') THEN
    RAISE EXCEPTION 'tipo inválido';
  END IF;

  INSERT INTO public.loyalty_points (restaurant_id, customer_cpf, points_balance, total_earned, total_redeemed)
  VALUES (v_rid, p_cpf, 0, 0, 0)
  ON CONFLICT (restaurant_id, customer_cpf) DO NOTHING;

  IF p_type = 'earn' THEN
    UPDATE public.loyalty_points
       SET points_balance = points_balance + p_points,
           total_earned = total_earned + p_points,
           last_updated = now()
     WHERE restaurant_id = v_rid AND customer_cpf = p_cpf
     RETURNING points_balance INTO v_balance;
  ELSE
    UPDATE public.loyalty_points
       SET points_balance = points_balance - p_points,
           total_redeemed = total_redeemed + p_points,
           last_updated = now()
     WHERE restaurant_id = v_rid AND customer_cpf = p_cpf
       AND points_balance >= p_points
     RETURNING points_balance INTO v_balance;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Saldo de pontos insuficiente';
    END IF;
  END IF;

  INSERT INTO public.loyalty_transactions (restaurant_id, customer_cpf, order_id, points, type)
  VALUES (v_rid, p_cpf, p_order_id, p_points, p_type);

  RETURN v_balance;
END;
$$;

-- Cupons enviados ao cliente (só o código), por CPF.
CREATE OR REPLACE FUNCTION public.get_customer_coupons(p_cpf text)
RETURNS TABLE(coupon_code text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT m.coupon_code
  FROM public.marketing_scheduled_messages m
  WHERE m.restaurant_id = public.default_restaurant_id()
    AND m.customer_cpf = p_cpf
    AND m.coupon_code IS NOT NULL
$$;

-- Valida um cupom pelo código (retorna 1 linha se ativo/vigente).
CREATE OR REPLACE FUNCTION public.validate_coupon(p_code text)
RETURNS SETOF public.coupons
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT * FROM public.coupons c
  WHERE c.restaurant_id = public.default_restaurant_id()
    AND upper(c.code) = upper(p_code)
    AND c.is_active = true
    AND (c.valid_from IS NULL OR c.valid_from <= now())
    AND (c.valid_until IS NULL OR c.valid_until >= now())
    AND (c.usage_limit IS NULL OR c.used_count < c.usage_limit)
  LIMIT 1
$$;

-- Consome um uso do cupom (incremento atômico, respeitando o limite).
CREATE OR REPLACE FUNCTION public.redeem_coupon(p_code text)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_ok boolean;
BEGIN
  UPDATE public.coupons
     SET used_count = used_count + 1, updated_at = now()
   WHERE restaurant_id = public.default_restaurant_id()
     AND upper(code) = upper(p_code)
     AND is_active = true
     AND (usage_limit IS NULL OR used_count < usage_limit)
  RETURNING true INTO v_ok;
  RETURN COALESCE(v_ok, false);
END;
$$;

-- Status de um pagamento online (PIX) pelo id. Só status/paid_at.
CREATE OR REPLACE FUNCTION public.get_payment_status(p_payment_id uuid)
RETURNS TABLE(status text, paid_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT status, paid_at FROM public.online_payments
  WHERE id = p_payment_id AND restaurant_id = public.default_restaurant_id()
$$;

-- Cartões salvos do cliente — exige CPF + telefone.
CREATE OR REPLACE FUNCTION public.get_saved_cards(p_cpf text, p_phone text)
RETURNS SETOF public.customer_cards
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT * FROM public.customer_cards cc
  WHERE cc.restaurant_id = public.default_restaurant_id()
    AND cc.customer_cpf = p_cpf
    AND regexp_replace(COALESCE(cc.customer_phone,''), '\D', '', 'g') = regexp_replace(COALESCE(p_phone,''), '\D', '', 'g')
$$;

CREATE OR REPLACE FUNCTION public.delete_saved_card(p_id uuid, p_cpf text)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.customer_cards
  WHERE id = p_id AND customer_cpf = p_cpf
    AND restaurant_id = public.default_restaurant_id();
  RETURN FOUND;
END;
$$;

-- Disponibilidade de reservas por data (sem PII: mesa/data/hora/status).
CREATE OR REPLACE FUNCTION public.get_reservation_availability(p_date date)
RETURNS TABLE(reservation_table_id uuid, reservation_date date, reservation_time time, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT r.reservation_table_id, r.reservation_date, r.reservation_time, r.status
  FROM public.reservations r
  WHERE r.restaurant_id = public.default_restaurant_id()
    AND r.reservation_date = p_date
    AND r.status IN ('pending','confirmed')
$$;

-- "Minhas reservas" por CPF + telefone.
CREATE OR REPLACE FUNCTION public.get_my_reservations(p_cpf text, p_phone text)
RETURNS SETOF public.reservations
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT * FROM public.reservations r
  WHERE r.restaurant_id = public.default_restaurant_id()
    AND r.customer_cpf = p_cpf
    AND regexp_replace(COALESCE(r.customer_phone,''), '\D', '', 'g') = regexp_replace(COALESCE(p_phone,''), '\D', '', 'g')
  ORDER BY r.reservation_date DESC, r.reservation_time DESC
$$;

-- Status da comanda de uma mesa por CPF (autoatendimento).
CREATE OR REPLACE FUNCTION public.get_comanda_status(p_table_id uuid, p_cpf text)
RETURNS TABLE(id uuid, status text, table_id uuid, created_at timestamptz, closed_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT c.id, c.status, c.table_id, c.created_at, c.closed_at
  FROM public.comandas c
  WHERE c.restaurant_id = public.default_restaurant_id()
    AND c.table_id = p_table_id
    AND c.customer_cpf = p_cpf
  ORDER BY c.created_at DESC
  LIMIT 1
$$;

-- Config pública do WhatsApp (SEM api_token/telefone) — usada pelo fluxo
-- anônimo de reservas apenas para saber se deve disparar a confirmação.
CREATE OR REPLACE FUNCTION public.get_whatsapp_public_config(p_restaurant_id uuid)
RETURNS TABLE(enabled boolean, instance_status text, message_reservation_created text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT w.enabled, w.instance_status, w.message_reservation_created
  FROM public.whatsapp_config w
  WHERE w.restaurant_id = p_restaurant_id
  LIMIT 1
$$;

-- Grants: todas executáveis por anon (cliente público) e authenticated.
DO $$
DECLARE
  r record;
  fns text[] := ARRAY[
    'get_customer_by_cpf','upsert_customer','get_order_details','get_order_status',
    'get_customer_orders','list_customer_addresses','add_customer_address',
    'delete_customer_address','get_loyalty_balance','apply_loyalty','get_customer_coupons',
    'validate_coupon','redeem_coupon','get_payment_status','get_saved_cards',
    'delete_saved_card','get_reservation_availability','get_my_reservations','get_comanda_status',
    'get_whatsapp_public_config'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.proname = ANY(fns)
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', r.sig);
  END LOOP;
END $$;
