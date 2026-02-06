
-- =============================================
-- Fase 1: Migrar online_payment_config para Asaas
-- =============================================

-- Remover colunas do Mercado Pago
ALTER TABLE public.online_payment_config
  DROP COLUMN IF EXISTS mp_access_token,
  DROP COLUMN IF EXISTS mp_refresh_token,
  DROP COLUMN IF EXISTS mp_token_expires_at,
  DROP COLUMN IF EXISTS mp_user_id,
  DROP COLUMN IF EXISTS mp_public_key;

-- Adicionar colunas do Asaas
ALTER TABLE public.online_payment_config
  ADD COLUMN IF NOT EXISTS asaas_api_key text,
  ADD COLUMN IF NOT EXISTS asaas_wallet_id text,
  ADD COLUMN IF NOT EXISTS asaas_account_id text,
  ADD COLUMN IF NOT EXISTS asaas_onboarding_url text,
  ADD COLUMN IF NOT EXISTS asaas_account_status text DEFAULT 'pending';

-- Alterar default do provider para 'asaas'
ALTER TABLE public.online_payment_config
  ALTER COLUMN provider SET DEFAULT 'asaas';

-- =============================================
-- Criar tabela asaas_customers
-- =============================================
CREATE TABLE IF NOT EXISTS public.asaas_customers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid NOT NULL,
  customer_cpf text NOT NULL,
  asaas_customer_id text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT asaas_customers_restaurant_cpf_unique UNIQUE (restaurant_id, customer_cpf)
);

-- Enable RLS
ALTER TABLE public.asaas_customers ENABLE ROW LEVEL SECURITY;

-- RLS policies (allow all - same pattern as other tables)
CREATE POLICY "Allow all operations on asaas_customers"
  ON public.asaas_customers
  FOR ALL
  USING (true)
  WITH CHECK (true);
