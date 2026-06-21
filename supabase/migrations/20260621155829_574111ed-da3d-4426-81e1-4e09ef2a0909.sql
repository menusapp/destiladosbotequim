-- Limpar configuração duplicada do merchant 0d712aee... mantendo apenas o restaurante de homologação (Teste / 8947a1f1...)
UPDATE public.ifood_config
SET merchant_id = NULL,
    access_token = NULL,
    refresh_token = NULL,
    token_expires_at = NULL,
    enabled = false,
    updated_at = now()
WHERE restaurant_id = '9a786bc0-021f-44ce-99d7-5dc2bcb58888'
  AND merchant_id = '0d712aee-46d5-44fe-9771-24b8795a57c2';

-- Garantir unicidade do merchant_id (permite múltiplos NULL)
CREATE UNIQUE INDEX IF NOT EXISTS ifood_config_merchant_id_unique
  ON public.ifood_config (merchant_id)
  WHERE merchant_id IS NOT NULL;