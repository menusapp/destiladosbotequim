-- Create remote_configs table
CREATE TABLE public.remote_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT 'null'::jsonb,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.remote_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dev and CEO can manage remote_configs" ON public.remote_configs
  FOR ALL TO public
  USING (has_role(auth.uid(), 'dev'::app_role) OR has_role(auth.uid(), 'ceo'::app_role))
  WITH CHECK (has_role(auth.uid(), 'dev'::app_role) OR has_role(auth.uid(), 'ceo'::app_role));

CREATE POLICY "Anyone can read active remote_configs" ON public.remote_configs
  FOR SELECT TO public
  USING (true);

-- Seed initial configs
INSERT INTO public.remote_configs (key, value, description, is_active) VALUES
  ('maintenance_mode', 'false'::jsonb, 'Ativar modo de manutenção global', false),
  ('global_banner', '""'::jsonb, 'Mensagem de banner global para todos os restaurantes', false),
  ('max_order_items', '50'::jsonb, 'Limite máximo de itens por pedido', true);

-- Add build_url column to app_versions for web deployment
ALTER TABLE public.app_versions ADD COLUMN IF NOT EXISTS build_url text;