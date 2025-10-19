-- Tabela para controle de versões do app desktop
CREATE TABLE IF NOT EXISTS public.app_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,
  release_notes TEXT,
  download_url_windows TEXT,
  download_url_mac TEXT,
  download_url_linux TEXT,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS policies - versões são públicas para leitura
ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read app versions"
  ON public.app_versions
  FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage versions"
  ON public.app_versions
  FOR ALL
  USING (public.has_role(auth.uid(), 'ceo'));

-- Inserir versão inicial
INSERT INTO public.app_versions (version, is_current, release_notes)
VALUES ('1.0.0', true, 'Versão inicial do Menu''s Desktop')
ON CONFLICT (version) DO NOTHING;