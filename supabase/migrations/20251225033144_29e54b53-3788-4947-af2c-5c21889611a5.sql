-- Tabela principal de campanhas
CREATE TABLE public.marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de regras/gatilhos das campanhas
CREATE TABLE public.marketing_campaign_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  
  -- Gatilho: O que dispara a campanha
  trigger_type TEXT NOT NULL, -- 'product_purchased', 'category_purchased', 'any_purchase'
  trigger_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  trigger_category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  
  -- Delay: Quanto tempo depois do gatilho
  delay_value INTEGER NOT NULL DEFAULT 1,
  delay_unit TEXT NOT NULL DEFAULT 'days', -- 'minutes', 'hours', 'days'
  
  -- Mensagem a enviar
  message_template TEXT NOT NULL,
  
  -- Desconto oferecido
  discount_type TEXT, -- 'percentage', 'fixed', NULL (sem desconto)
  discount_value NUMERIC DEFAULT 0,
  discount_target_type TEXT DEFAULT 'any', -- 'product', 'category', 'any', 'same_category'
  discount_target_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  discount_target_category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  discount_validity_days INTEGER DEFAULT 7,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de mensagens agendadas (fila)
CREATE TABLE public.marketing_scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  rule_id UUID REFERENCES public.marketing_campaign_rules(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  customer_cpf TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  coupon_code TEXT,
  message_text TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'cancelled'
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_marketing_campaigns_restaurant ON public.marketing_campaigns(restaurant_id);
CREATE INDEX idx_marketing_campaigns_active ON public.marketing_campaigns(restaurant_id, is_active);
CREATE INDEX idx_marketing_campaign_rules_campaign ON public.marketing_campaign_rules(campaign_id);
CREATE INDEX idx_marketing_scheduled_messages_status ON public.marketing_scheduled_messages(status, scheduled_for);
CREATE INDEX idx_marketing_scheduled_messages_campaign ON public.marketing_scheduled_messages(campaign_id);
CREATE INDEX idx_marketing_scheduled_messages_restaurant ON public.marketing_scheduled_messages(restaurant_id);

-- Enable RLS
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaign_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_scheduled_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow all operations on marketing_campaigns" ON public.marketing_campaigns
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on marketing_campaign_rules" ON public.marketing_campaign_rules
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on marketing_scheduled_messages" ON public.marketing_scheduled_messages
  FOR ALL USING (true) WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_marketing_campaigns_updated_at
  BEFORE UPDATE ON public.marketing_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();