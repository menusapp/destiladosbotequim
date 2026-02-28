
-- Tabela fiscal_configs
CREATE TABLE public.fiscal_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL UNIQUE REFERENCES public.restaurants(id) ON DELETE CASCADE,
  cnpj text,
  razao_social text,
  nome_fantasia text,
  inscricao_estadual text,
  email text,
  telefone text,
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  municipio_codigo text,
  uf text DEFAULT 'SP',
  csc_id text,
  csc_code text,
  certificate_password text,
  certificate_file_path text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.fiscal_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on fiscal_configs"
  ON public.fiscal_configs FOR ALL
  USING (true) WITH CHECK (true);

-- Trigger updated_at
CREATE TRIGGER update_fiscal_configs_updated_at
  BEFORE UPDATE ON public.fiscal_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket privado para certificados
INSERT INTO storage.buckets (id, name, public)
VALUES ('fiscal-certificates', 'fiscal-certificates', false);

-- Policy de storage para usuários autenticados
CREATE POLICY "Authenticated users can manage fiscal certificates"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'fiscal-certificates')
  WITH CHECK (bucket_id = 'fiscal-certificates');
