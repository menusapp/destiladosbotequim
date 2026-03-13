
ALTER TABLE public.printer_settings
ADD COLUMN IF NOT EXISTS font_family text NOT NULL DEFAULT 'Arial Black',
ADD COLUMN IF NOT EXISTS font_size integer NOT NULL DEFAULT 12,
ADD COLUMN IF NOT EXISTS font_bold boolean NOT NULL DEFAULT true;
