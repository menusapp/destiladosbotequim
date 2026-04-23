-- Adiciona escolha de método de impressão padrão (PDF ou QZ Tray) por restaurante.
-- Default 'pdf' para preservar 100% o comportamento atual em quem ainda não configurou QZ Tray.
ALTER TABLE public.printer_settings
ADD COLUMN IF NOT EXISTS print_method text NOT NULL DEFAULT 'pdf';

-- Garante que apenas valores conhecidos sejam aceitos (evita typos no front).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'printer_settings_print_method_check'
  ) THEN
    ALTER TABLE public.printer_settings
    ADD CONSTRAINT printer_settings_print_method_check
    CHECK (print_method IN ('pdf', 'qz_tray'));
  END IF;
END $$;