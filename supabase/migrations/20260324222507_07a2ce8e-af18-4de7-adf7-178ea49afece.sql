
CREATE TABLE public.nfe_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  numero_nota text NOT NULL,
  cnpj_fornecedor text,
  nome_fornecedor text,
  data_emissao text,
  valor_total numeric DEFAULT 0,
  arquivo_xml text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.nfe_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on nfe_imports"
  ON public.nfe_imports FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE UNIQUE INDEX idx_nfe_imports_unique ON public.nfe_imports (restaurant_id, numero_nota, cnpj_fornecedor);
