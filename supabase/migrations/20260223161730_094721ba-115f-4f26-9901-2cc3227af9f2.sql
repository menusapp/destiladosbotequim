
-- Remove Asaas-specific columns from online_payment_config
ALTER TABLE public.online_payment_config
  DROP COLUMN IF EXISTS asaas_api_key,
  DROP COLUMN IF EXISTS asaas_wallet_id,
  DROP COLUMN IF EXISTS asaas_account_id,
  DROP COLUMN IF EXISTS asaas_onboarding_url,
  DROP COLUMN IF EXISTS asaas_documents_data,
  DROP COLUMN IF EXISTS asaas_account_status;

-- Add Mercado Pago columns
ALTER TABLE public.online_payment_config
  ADD COLUMN IF NOT EXISTS mp_access_token TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS mp_public_key TEXT DEFAULT NULL;

-- Change default provider to mercadopago
ALTER TABLE public.online_payment_config
  ALTER COLUMN provider SET DEFAULT 'mercadopago';

-- Drop asaas_customers table
DROP TABLE IF EXISTS public.asaas_customers;
