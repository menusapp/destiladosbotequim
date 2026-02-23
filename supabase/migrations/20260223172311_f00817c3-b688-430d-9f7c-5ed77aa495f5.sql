
-- Add fiscal columns to restaurants for NFC-e emission
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS cnpj TEXT,
  ADD COLUMN IF NOT EXISTS inscricao_estadual TEXT,
  ADD COLUMN IF NOT EXISTS certificado_digital_ref TEXT,
  ADD COLUMN IF NOT EXISTS razao_social TEXT,
  ADD COLUMN IF NOT EXISTS endereco_fiscal TEXT,
  ADD COLUMN IF NOT EXISTS municipio_codigo TEXT,
  ADD COLUMN IF NOT EXISTS uf TEXT DEFAULT 'SP';
