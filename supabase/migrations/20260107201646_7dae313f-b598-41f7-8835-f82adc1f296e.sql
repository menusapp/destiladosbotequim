-- Tabela online_payment_config para armazenar configuração OAuth do Mercado Pago
CREATE TABLE IF NOT EXISTS public.online_payment_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT false,
  provider TEXT DEFAULT 'mercadopago',
  
  -- Mercado Pago OAuth tokens
  mp_access_token TEXT,
  mp_refresh_token TEXT,
  mp_token_expires_at TIMESTAMPTZ,
  mp_user_id TEXT,
  mp_public_key TEXT,
  
  -- Configurações
  require_prepayment BOOLEAN DEFAULT false,
  accept_pix BOOLEAN DEFAULT true,
  accept_card BOOLEAN DEFAULT true,
  enable_for_delivery BOOLEAN DEFAULT true,
  
  -- Status
  connection_status TEXT DEFAULT 'disconnected',
  connected_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT online_payment_config_restaurant_id_key UNIQUE(restaurant_id)
);

-- RLS para online_payment_config
ALTER TABLE public.online_payment_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on online_payment_config"
ON public.online_payment_config FOR ALL
USING (true)
WITH CHECK (true);

-- Tabela online_payments para registrar pagamentos
CREATE TABLE IF NOT EXISTS public.online_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id),
  
  provider TEXT NOT NULL DEFAULT 'mercadopago',
  provider_payment_id TEXT,
  provider_preference_id TEXT,
  
  amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending',
  payment_method TEXT,
  
  customer_name TEXT,
  customer_email TEXT,
  customer_cpf TEXT,
  customer_phone TEXT,
  
  pix_qr_code TEXT,
  pix_qr_code_base64 TEXT,
  pix_expiration TIMESTAMPTZ,
  
  webhook_received_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS para online_payments
ALTER TABLE public.online_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on online_payments"
ON public.online_payments FOR ALL
USING (true)
WITH CHECK (true);

-- Colunas em orders para rastrear pagamento online
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS online_payment_id UUID REFERENCES public.online_payments(id);

-- Templates WhatsApp para pagamento
ALTER TABLE public.whatsapp_config
ADD COLUMN IF NOT EXISTS message_payment_approved TEXT 
  DEFAULT 'Pagamento confirmado! Seu pedido #{pedido} foi pago com sucesso. 💳✅',
ADD COLUMN IF NOT EXISTS message_payment_rejected TEXT
  DEFAULT 'Pagamento não aprovado para o pedido #{pedido}. Tente novamente ou escolha outra forma de pagamento.';

-- Trigger para updated_at em online_payment_config
CREATE OR REPLACE FUNCTION public.update_online_payment_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_update_online_payment_config_updated_at ON public.online_payment_config;
CREATE TRIGGER trigger_update_online_payment_config_updated_at
  BEFORE UPDATE ON public.online_payment_config
  FOR EACH ROW EXECUTE FUNCTION public.update_online_payment_config_updated_at();

-- Trigger para updated_at em online_payments
CREATE OR REPLACE FUNCTION public.update_online_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_update_online_payments_updated_at ON public.online_payments;
CREATE TRIGGER trigger_update_online_payments_updated_at
  BEFORE UPDATE ON public.online_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_online_payments_updated_at();