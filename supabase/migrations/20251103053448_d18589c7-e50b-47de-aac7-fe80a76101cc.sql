-- Adicionar campo order_type aos pedidos (local ou delivery)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'local' CHECK (order_type IN ('local', 'delivery'));

-- Adicionar campos de endereço para delivery
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS delivery_address TEXT,
ADD COLUMN IF NOT EXISTS delivery_phone TEXT,
ADD COLUMN IF NOT EXISTS delivery_neighborhood TEXT,
ADD COLUMN IF NOT EXISTS delivery_city TEXT;

-- Adicionar campo payment_type para delivery (pix, dinheiro, cartão)
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payment_type TEXT;

-- Criar tabela de configurações de WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT false,
  api_token TEXT,
  phone_number TEXT,
  message_accepted TEXT DEFAULT 'Seu pedido foi aceito e está em preparo! 🍔',
  message_out_for_delivery TEXT DEFAULT 'Seu pedido saiu para entrega! 🚚',
  message_delivered TEXT DEFAULT 'Seu pedido foi entregue! Obrigado pela preferência! 🙏',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(restaurant_id)
);

-- Trigger para atualizar updated_at
CREATE OR REPLACE TRIGGER update_whatsapp_config_updated_at
BEFORE UPDATE ON public.whatsapp_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS para whatsapp_config
ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view whatsapp config" 
ON public.whatsapp_config 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create whatsapp config" 
ON public.whatsapp_config 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update whatsapp config" 
ON public.whatsapp_config 
FOR UPDATE 
USING (true);

-- Criar tabela de configurações de delivery
CREATE TABLE IF NOT EXISTS public.delivery_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  min_order_value NUMERIC DEFAULT 0,
  delivery_fee NUMERIC DEFAULT 0,
  estimated_time_minutes INTEGER DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(restaurant_id)
);

-- Trigger para atualizar updated_at
CREATE OR REPLACE TRIGGER update_delivery_config_updated_at
BEFORE UPDATE ON public.delivery_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS para delivery_config
ALTER TABLE public.delivery_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view delivery config" 
ON public.delivery_config 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create delivery config" 
ON public.delivery_config 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update delivery config" 
ON public.delivery_config 
FOR UPDATE 
USING (true);

-- Comentários nas tabelas
COMMENT ON TABLE public.whatsapp_config IS 'Configurações de integração WhatsApp para envio automático de mensagens';
COMMENT ON TABLE public.delivery_config IS 'Configurações de delivery do restaurante';
COMMENT ON COLUMN public.orders.order_type IS 'Tipo de pedido: local (mesa) ou delivery (entrega)';
COMMENT ON COLUMN public.orders.delivery_address IS 'Endereço completo para entrega';
COMMENT ON COLUMN public.orders.delivery_phone IS 'Telefone para contato na entrega';
COMMENT ON COLUMN public.orders.payment_type IS 'Forma de pagamento para delivery';