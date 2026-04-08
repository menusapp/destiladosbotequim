
-- Configurações de cada tipo de notificação WhatsApp
CREATE TABLE public.whatsapp_notification_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  template_message text,
  send_delay_minutes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, notification_type)
);

ALTER TABLE public.whatsapp_notification_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to whatsapp_notification_configs"
  ON public.whatsapp_notification_configs FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_whatsapp_notification_configs_updated_at
  BEFORE UPDATE ON public.whatsapp_notification_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Configuração do dono para receber notificações
CREATE TABLE public.owner_notification_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE UNIQUE,
  owner_name text,
  owner_phone text,
  receive_cashier_open boolean NOT NULL DEFAULT true,
  receive_cashier_close boolean NOT NULL DEFAULT true,
  receive_daily_summary boolean NOT NULL DEFAULT true,
  daily_summary_time time NOT NULL DEFAULT '23:00',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.owner_notification_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to owner_notification_config"
  ON public.owner_notification_config FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_owner_notification_config_updated_at
  BEFORE UPDATE ON public.owner_notification_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
