
-- Configuração da IA do WhatsApp
CREATE TABLE public.whatsapp_ai_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL UNIQUE,
  is_active boolean DEFAULT false,
  accept_orders_via_whatsapp boolean DEFAULT false,
  personality text DEFAULT 'friendly',
  welcome_message_type text DEFAULT 'numeric_menu',
  custom_welcome_message text,
  instructions text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.whatsapp_ai_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on whatsapp_ai_config"
  ON public.whatsapp_ai_config FOR ALL
  TO anon, authenticated
  USING (true) WITH CHECK (true);

-- Opções do menu numerado
CREATE TABLE public.whatsapp_menu_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
  position int NOT NULL,
  label text NOT NULL,
  action_type text NOT NULL,
  custom_message text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(restaurant_id, position)
);

ALTER TABLE public.whatsapp_menu_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on whatsapp_menu_options"
  ON public.whatsapp_menu_options FOR ALL
  TO anon, authenticated
  USING (true) WITH CHECK (true);

-- Estado das conversas
CREATE TABLE public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
  customer_phone text NOT NULL,
  current_step text DEFAULT 'welcome',
  order_draft jsonb DEFAULT '{}'::jsonb,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(restaurant_id, customer_phone)
);

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on whatsapp_conversations"
  ON public.whatsapp_conversations FOR ALL
  TO anon, authenticated
  USING (true) WITH CHECK (true);
