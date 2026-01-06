-- Adicionar novas colunas na tabela tables para unificar com reservation_tables
ALTER TABLE public.tables ADD COLUMN IF NOT EXISTS table_name TEXT;
ALTER TABLE public.tables ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.tables ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.tables ADD COLUMN IF NOT EXISTS min_capacity INTEGER DEFAULT 1;
ALTER TABLE public.tables ADD COLUMN IF NOT EXISTS max_capacity INTEGER DEFAULT 4;
ALTER TABLE public.tables ADD COLUMN IF NOT EXISTS is_available_for_reservation BOOLEAN DEFAULT true;
ALTER TABLE public.tables ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Migrar dados: preencher table_name com "Mesa X" para mesas existentes
UPDATE public.tables SET table_name = 'Mesa ' || table_number WHERE table_name IS NULL;

-- Adicionar coluna table_id na tabela reservations para referenciar a tabela unificada
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS table_id UUID REFERENCES public.tables(id);