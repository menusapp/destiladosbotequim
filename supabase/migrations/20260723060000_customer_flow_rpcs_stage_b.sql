-- =====================================================================
-- SECURITY HARDENING — RPCs adicionais do Estágio B (fluxo do cliente)
-- ---------------------------------------------------------------------
-- Depois que as políticas `zz_temp_anon_read*` foram removidas, o cliente
-- anônimo não lê mais PII direto pelas tabelas. Estas RPCs SECURITY DEFINER
-- cobrem as poucas LEITURAS que ainda faltavam ser convertidas no frontend
-- (resgates de fidelidade e unicidade de telefone). O corpo de cada função
-- é a fronteira de segurança: sempre reescopado ao estabelecimento
-- (default_restaurant_id) e devolvendo apenas o mínimo necessário.
-- =====================================================================
SET search_path = public;

-- Registra o resgate de uma recompensa de forma ATÔMICA, evitando resgate
-- duplicado (substitui o padrão "SELECT existe? -> INSERT" do frontend, que
-- exigia leitura anônima de loyalty_reward_redemptions). Retorna true se
-- registrou agora; false se o cliente já havia resgatado essa recompensa.
CREATE OR REPLACE FUNCTION public.record_reward_redemption(
  p_cpf text,
  p_program_id uuid,
  p_reward_id uuid,
  p_order_id uuid DEFAULT NULL,
  p_trigger_value numeric DEFAULT 0
)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_rid uuid := public.default_restaurant_id();
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.loyalty_reward_redemptions r
    WHERE r.restaurant_id = v_rid
      AND r.customer_cpf = p_cpf
      AND r.reward_id = p_reward_id
      AND (p_program_id IS NULL OR r.program_id = p_program_id)
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO public.loyalty_reward_redemptions
    (restaurant_id, customer_cpf, program_id, reward_id, order_id, trigger_value, redeemed_at)
  VALUES
    (v_rid, p_cpf, p_program_id, p_reward_id, p_order_id, p_trigger_value, now());

  RETURN true;
END;
$$;

-- Lista os IDs de recompensas já resgatadas por um cliente num programa.
-- Usado para marcar o que já foi resgatado na tela de fidelidade.
CREATE OR REPLACE FUNCTION public.list_reward_redemptions(
  p_cpf text,
  p_program_id uuid
)
RETURNS TABLE(reward_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT r.reward_id
  FROM public.loyalty_reward_redemptions r
  WHERE r.restaurant_id = public.default_restaurant_id()
    AND r.customer_cpf = p_cpf
    AND r.program_id = p_program_id
$$;

-- Verifica se um telefone já pertence a OUTRO cliente (unicidade), sem
-- expor nenhum dado do outro cliente — retorna apenas true/false.
CREATE OR REPLACE FUNCTION public.customer_phone_taken(
  p_phone text,
  p_exclude_cpf text DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.restaurant_id = public.default_restaurant_id()
      AND regexp_replace(COALESCE(c.phone,''), '\D', '', 'g') = regexp_replace(COALESCE(p_phone,''), '\D', '', 'g')
      AND p_phone IS NOT NULL AND p_phone <> ''
      AND (p_exclude_cpf IS NULL OR c.cpf <> p_exclude_cpf)
  )
$$;

-- Grants: executáveis por anon (cliente público) e authenticated.
DO $$
DECLARE
  r record;
  fns text[] := ARRAY[
    'record_reward_redemption','list_reward_redemptions','customer_phone_taken'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.proname = ANY(fns)
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', r.sig);
  END LOOP;
END $$;
