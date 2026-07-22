-- =====================================================================
-- SECURITY HARDENING — Parte 1: helpers de identidade + ajustes de schema
-- ---------------------------------------------------------------------
-- Base para o RLS: funções que leem os claims do JWT emitido no login
-- (edge function `issue-session-token`). Enquanto o app operar como `anon`
-- (cliente público), todas retornam NULL/false. Após o login do
-- staff/CEO, o token carrega restaurant_id/staff_id/role.
--
-- Nada aqui restringe acesso ainda — apenas cria as ferramentas. As
-- políticas entram na Parte 2.
-- =====================================================================

-- Restaurante do usuário autenticado (claim do JWT). NULL para anon.
CREATE OR REPLACE FUNCTION public.current_restaurant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT NULLIF(
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'restaurant_id'),
    ''
  )::uuid
$$;

-- Funcionário autenticado (claim do JWT). NULL para anon/CEO.
CREATE OR REPLACE FUNCTION public.current_staff_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT NULLIF(
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'staff_id'),
    ''
  )::uuid
$$;

-- Papel do funcionário (admin/garcom/caixa/...). NULL para anon.
CREATE OR REPLACE FUNCTION public.current_staff_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'staff_role'
$$;

-- true quando há um funcionário autenticado com restaurante definido.
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT public.current_restaurant_id() IS NOT NULL
     AND public.current_staff_id() IS NOT NULL
$$;

-- true quando o token é de um CEO (super-admin).
CREATE OR REPLACE FUNCTION public.is_ceo()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'ceo')::boolean,
    false
  )
$$;

-- Restaurante padrão do estabelecimento único. Usado em WITH CHECK de
-- inserts anônimos (checkout público). Revela apenas o próprio id do
-- estabelecimento, que toda página pública já conhece pelo slug.
CREATE OR REPLACE FUNCTION public.default_restaurant_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT id FROM public.restaurants ORDER BY created_at LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_restaurant_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_staff_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_staff_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_ceo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_restaurant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_staff_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_staff_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_ceo() TO authenticated;
GRANT EXECUTE ON FUNCTION public.default_restaurant_id() TO anon, authenticated;

-- ---------------------------------------------------------------------
-- Ajuste de schema: customer_cards (existe só no banco ao vivo, sem
-- migration). Materializa a tabela para que o RLS tenha o que proteger.
-- IF NOT EXISTS garante idempotência caso já exista.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  customer_cpf text NOT NULL,
  customer_phone text NOT NULL,
  card_id text NOT NULL,
  mp_customer_id text NOT NULL,
  payment_method_id text NOT NULL,
  last_four_digits text NOT NULL,
  first_six_digits text,
  expiration_month integer,
  expiration_year integer,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.customer_cards ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- Ajuste de schema: customer_addresses não tem restaurant_id, o que
-- impede o escopo por restaurante no RLS. Adiciona e faz backfill.
-- ---------------------------------------------------------------------
ALTER TABLE public.customer_addresses
  ADD COLUMN IF NOT EXISTS restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE;

-- Backfill pelo restaurante do cliente (via CPF); resto → estabelecimento padrão.
UPDATE public.customer_addresses ca
   SET restaurant_id = c.restaurant_id
  FROM public.customers c
 WHERE c.cpf = ca.customer_cpf
   AND ca.restaurant_id IS NULL;

UPDATE public.customer_addresses
   SET restaurant_id = public.default_restaurant_id()
 WHERE restaurant_id IS NULL;

-- DEFAULT no nível do banco: os inserts anônimos do checkout NÃO enviam
-- restaurant_id. Sem este default, a coluna ficaria NULL e a política
-- anon (restaurant_id = default_restaurant_id()) rejeitaria o insert.
ALTER TABLE public.customer_addresses
  ALTER COLUMN restaurant_id SET DEFAULT public.default_restaurant_id();

CREATE INDEX IF NOT EXISTS idx_customer_addresses_cpf ON public.customer_addresses (customer_cpf);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_restaurant ON public.customer_addresses (restaurant_id);

-- Índices para os joins de política multi-hop (performance do RLS).
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_item_extras_item_id ON public.order_item_extras (order_item_id);
CREATE INDEX IF NOT EXISTS idx_customer_cards_cpf ON public.customer_cards (customer_cpf);
